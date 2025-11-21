// js/gallery.js
import { graphVisualizerInstance } from "./index.js";

let TYPICAL_GRAPHS = {};

// --- Helpers de parsing ---

/**
 * Convertit une liste d'arêtes string ["(0,1)", "(1,2)"] en format { nodes, links }
 * compatible avec force-graph.
 * Gère le décalage d'ID si plusieurs graphes sont affichés ensemble.
 */
function parseGraphData(graphsList) {
    const nodesMap = new Map();
    const links = [];
    let nodeIdOffset = 0;

    graphsList.forEach((graph) => {
        const currentGraphNodes = new Set();

        graph.edges.forEach(edgeStr => {
            // Parse "(0,1)" -> [0, 1]
            const [sourceRaw, targetRaw] = edgeStr.replace(/[()]/g, '').split(',').map(Number);

            // Créer des IDs uniques globaux pour ce canvas
            // On ajoute un préfixe ou un offset pour éviter que le noeud 0 du graphe 1 
            // ne soit relié au noeud 0 du graphe 2.
            const source = sourceRaw + nodeIdOffset;
            const target = targetRaw + nodeIdOffset;

            currentGraphNodes.add(source);
            currentGraphNodes.add(target);

            links.push({ source, target });
        });

        // Ajouter les noeuds au Map global
        currentGraphNodes.forEach(id => {
            nodesMap.set(id, { id: id, label: String(id) });
        });

        // Incrémenter l'offset pour le prochain graphe (on prend le max id + 100 par sécurité)
        if (currentGraphNodes.size > 0) {
            nodeIdOffset = Math.max(...currentGraphNodes) + 100;
        }
    });

    return {
        nodes: Array.from(nodesMap.values()),
        links: links
    };
}

// --- Génération HTML ---

function generateGalleryHTML(sections) {
    const galleryContainer = document.querySelector('.gallery-container');
    if (!galleryContainer) return;

    galleryContainer.innerHTML = '';

    sections.forEach(section => {
        const sectionElement = document.createElement('div');
        sectionElement.className = 'gallery-category collapsed'; // Par défaut replié
        sectionElement.dataset.loaded = "false";
        sectionElement.innerHTML = `
      <div class="gallery-category-header">
        <div>
          <h3>${section.name}</h3>
          <p class="gallery-category-description">${section.description}</p>
        </div>
        <span class="toggle-icon">▼</span>
      </div>
      <div class="gallery-category-content">
        ${Object.entries(section.graphs).map(([graphType, graphData]) => `
          <div class="gallery-item">
            <div class="gallery-item-header">
                <h4>${graphData.name}</h4>
                <button class="copy-btn" data-graph="${graphType}">Copier JSON</button>
                <button class="load-main-btn" data-graph="${graphType}">Charger dans l'application</button>
            </div>
            <div class="graph-preview" id="${graphType}-preview"></div>
            <p class="description-text">${graphData.description}</p>
          </div>
        `).join('')}
      </div>
    `;

        // Toggle logique
        const header = sectionElement.querySelector('.gallery-category-header');
        header.addEventListener('click', () => {
            sectionElement.classList.toggle('collapsed');

            const isOpen = !sectionElement.classList.contains('collapsed');
            const hasLoaded = sectionElement.dataset.loaded === "true";

            if (isOpen) {
                // Si ce n'est pas encore chargé, on le fait
                if (!hasLoaded) {
                    console.log(`Chargement des graphes pour la section : ${section.name}`);
                    setTimeout(() => {
                        Object.entries(section.graphs).forEach(([graphType, graphData]) => {
                            requestAnimationFrame(() => {
                                initForceGraphPreview(`${graphType}-preview`, graphData);
                            });
                        });
                        sectionElement.dataset.loaded = "true";
                    }, 50);
                }
                else {
                    setTimeout(() => {
                        window.dispatchEvent(new Event('resize'));
                    }, 50);
                }
            }
        });

        galleryContainer.appendChild(sectionElement);
    });
}

// --- Initialisation des graphes (Force Graph) ---

function initForceGraphPreview(containerId, graphRawData) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const graphData = parseGraphData(graphRawData.graphs);
    container.innerHTML = '';

    const Graph = ForceGraph()(container)
        .width(container.clientWidth || 300)
        .height(300)
        .backgroundColor('#ffffff')
        .graphData(graphData)
        .nodeLabel('label')
        .nodeRelSize(4)
        .nodeColor(() => '#69b3a2')
        .linkColor(() => '#ccc')
        .linkWidth(1.5)
        .cooldownTicks(100)
        .onEngineStop(() => {
            Graph.zoomToFit(400, 5);
        });

    Graph.d3Force('charge').strength(-50);

    // Paramètres statiques
    Graph.enableZoomPanInteraction(false);
    // Graph.enableNodeDrag(false);

    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
                Graph.width(width);
                Graph.height(height);
                Graph.zoomToFit(0, 5);
            }
        }
    });
    resizeObserver.observe(container);
}

// --- Logique principale ---

async function loadGraphs() {
    try {
        const response = await fetch('../data/graphs.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();

        // Générer le HTML
        generateGalleryHTML(data.sections);

        // Stocker les données
        TYPICAL_GRAPHS = {};
        data.sections.forEach(section => {
            Object.assign(TYPICAL_GRAPHS, section.graphs);
        });

        return true;

    } catch (error) {
        console.error('Erreur lors du chargement des graphes:', error);
        return false;
    }
}

export async function initializeGallery() {
    console.log("Initialisation de la galerie...");

    // 1. Charger les données et générer le HTML
    const loaded = await loadGraphs();
    if (!loaded) return;

    // 2. Configurer les boutons (Copier/Charger)
    // On attend juste que le DOM soit prêt, mais ON NE LANCE PLUS les graphes ici.
    setTimeout(() => {
        setupInteractionButtons();
    }, 100);
}

function setupInteractionButtons() {
    // Boutons Copier
    document.querySelectorAll('.copy-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation(); // Empêcher le toggle de l'accordéon
            const graphType = button.dataset.graph;
            const data = TYPICAL_GRAPHS[graphType];

            if (data) {
                // On formate pour le input de l'index [(0,1), (1,2)]
                const allEdges = data.graphs.flatMap(g => g.edges);
                const textToCopy = `[${allEdges.join(', ')}]`;

                navigator.clipboard.writeText(textToCopy).then(() => {
                    const originalText = button.textContent;
                    button.textContent = "Copié !";
                    setTimeout(() => button.textContent = originalText, 2000);
                });
            }
        });
    });

    document.querySelectorAll('.load-main-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const graphType = button.dataset.graph;
            const data = TYPICAL_GRAPHS[graphType];
            if (data && graphVisualizerInstance) {
                const allEdges = data.graphs.flatMap(g => g.edges);
                const formattedList = `[${allEdges.join(', ')}]`;

                // On remplit la zone de texte et on clique sur le bouton de chargement
                // C'est un moyen simple de simuler l'action sans modifier index.js en profondeur
                const edgeInput = document.getElementById('edge-list-input');
                const loadBtn = document.getElementById('load-graph-btn');

                if (edgeInput && loadBtn) {
                    edgeInput.value = formattedList;
                    loadBtn.click();

                    // Scroll vers le haut pour voir le résultat
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }
        });
    });
}