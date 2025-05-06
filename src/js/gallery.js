import * as Graph from "./graph.js";
import * as UI from "./ui.js";

let TYPICAL_GRAPHS = {};

// Générer le HTML de la galerie
function generateGalleryHTML(sections) {
  const galleryContainer = document.querySelector('.gallery-container');
  if (!galleryContainer) return;

  // Vider le conteneur
  galleryContainer.innerHTML = '';

  // Générer le HTML pour chaque section
  sections.forEach(section => {
    const sectionElement = document.createElement('div');
    sectionElement.className = 'gallery-category collapsed';
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
            <h4>${graphData.name}</h4>
            <div class="graph-preview" id="${graphType}-preview"></div>
            <div class="graph-description">
              <p>${graphData.description}</p>
              <button class="copy-btn" data-graph="${graphType}">Copier</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Ajouter l'écouteur d'événements pour le toggle
    const header = sectionElement.querySelector('.gallery-category-header');
    header.addEventListener('click', () => {
      sectionElement.classList.toggle('collapsed');
      
      // Si la section est déployée, réinitialiser les graphes
      if (!sectionElement.classList.contains('collapsed')) {
        setTimeout(() => {
          Object.keys(section.graphs).forEach(graphType => {
            const previewContainer = document.getElementById(`${graphType}-preview`);
            if (previewContainer) {
              const network = previewContainer.__vis_network__;
              if (network) {
                network.fit({
                  animation: {
                    duration: 0
                  }
                });
              }
            }
          });
        }, 100);
      }
    });

    galleryContainer.appendChild(sectionElement);
  });
}

// Charger les graphes depuis le fichier JSON
async function loadGraphs() {
  try {
    console.log("Tentative de chargement des graphes...");
    const response = await fetch('../data/graphs.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log("Graphes chargés avec succès:", data);
    
    // Générer le HTML de la galerie
    generateGalleryHTML(data.sections);
    
    // Stocker tous les graphes dans un objet plat pour faciliter l'accès
    TYPICAL_GRAPHS = {};
    data.sections.forEach(section => {
      Object.assign(TYPICAL_GRAPHS, section.graphs);
    });
    
    return true;
  } catch (error) {
    console.error('Erreur lors du chargement des graphes:', error);
    UI.updateStatus("Erreur lors du chargement des graphes.", "error");
    return false;
  }
}

// Initialisation des visualisations de prévisualisation
export async function initializeGallery() {
  console.log("Initialisation de la galerie...");
  // Charger les graphes
  const loaded = await loadGraphs();
  if (!loaded) {
    console.error("Échec du chargement des graphes");
    return;
  }

  // Attendre que le DOM soit complètement chargé
  setTimeout(() => {
    console.log("Création des visualisations...");
    Object.entries(TYPICAL_GRAPHS).forEach(([graphType, graphData]) => {
      console.log(`Création de la visualisation pour ${graphType}...`);
      const previewContainer = document.getElementById(`${graphType}-preview`);
      if (previewContainer) {
        // Options de configuration pour le réseau
        const options = {
          nodes: {
            shape: 'circle',
            size: 16,
            font: {
              size: 12
            },
            color: {
              background: '#ffffff',
              border: '#666666',
              highlight: {
                background: '#ffffff',
                border: '#000000'
              }
            }
          },
          edges: {
            width: 1.5,
            color: {
              color: '#666666',
              highlight: '#000000'
            },
            smooth: {
              type: 'continuous'
            }
          },
          physics: {
            enabled: true,
            stabilization: {
              iterations: 200,
              updateInterval: 100,
              fit: true
            },
            barnesHut: {
              gravitationalConstant: -5000,
              centralGravity: 0.3,
              springLength: 120,
              springConstant: 0.05,
              damping: 0.5
            },
            solver: 'barnesHut',
            minVelocity: 0.75,
            maxVelocity: 30
          },
          interaction: {
            hover: true,
            zoomView: true,
            dragView: true,
            mouseWheel: {
              enabled: true,
              speed: 0.5,
              zoomAtCursor: true
            }
          },
          layout: {
            improvedLayout: true,
            randomSeed: 1,
            hierarchical: {
              enabled: false
            }
          },
          width: '100%',
          height: '100%',
          autoResize: true
        };

        // Créer le réseau
        const previewNetwork = new vis.Network(
          previewContainer,
          { nodes: [], edges: [] },
          options
        );

        // Stocker la référence au réseau dans le conteneur
        previewContainer.__vis_network__ = previewNetwork;

        // Fonction pour calculer les centres des graphes
        function calculateGraphCenters(numGraphs, containerWidth, containerHeight) {
          const centers = [];
          const padding = 150;
          const availableWidth = containerWidth - 2 * padding;
          const availableHeight = containerHeight - 2 * padding;
          
          // Pour 2 graphes, les placer horizontalement avec plus d'espace
          if (numGraphs === 2) {
            centers.push({
              x: -availableWidth / 3,
              y: 0
            });
            centers.push({
              x: availableWidth / 3,
              y: 0
            });
            return centers;
          }
          
          // Pour plus de 2 graphes, utiliser une disposition en grille
          const numCols = Math.ceil(Math.sqrt(numGraphs));
          const numRows = Math.ceil(numGraphs / numCols);
          
          const spacingX = availableWidth / (numCols + 1);
          const spacingY = availableHeight / (numRows + 1);
          
          for (let i = 0; i < numGraphs; i++) {
            const row = Math.floor(i / numCols);
            const col = i % numCols;
            
            centers.push({
              x: padding + spacingX * (col + 1) - containerWidth / 2,
              y: padding + spacingY * (row + 1) - containerHeight / 2
            });
          }
          
          return centers;
        }

        // Générer les données du graphe
        const nodes = [];
        const edges = [];
        
        // Obtenir les dimensions du conteneur
        const containerWidth = previewContainer.clientWidth || 600;
        const containerHeight = previewContainer.clientHeight || 400;
        
        // Calculer les centres pour tous les graphes
        const centers = calculateGraphCenters(graphData.graphs.length, containerWidth, containerHeight);
        
        // Calculer les positions pour chaque graphe
        graphData.graphs.forEach((graph, graphIndex) => {
          // Calculer le nombre total de nœuds dans ce graphe
          const graphNodes = new Set();
          graph.edges.forEach(edge => {
            const [from, to] = edge.replace(/[()]/g, '').split(',').map(Number);
            graphNodes.add(from);
            graphNodes.add(to);
          });
          
          // Utiliser le centre calculé
          const center = centers[graphIndex];
          
          // Calculer le rayon en fonction du nombre de graphes et de la taille du conteneur
          const baseRadius = Math.min(containerWidth, containerHeight) / 6;
          const radius = baseRadius / Math.sqrt(graphData.graphs.length);
          
          // Positionner les nœuds de ce graphe
          Array.from(graphNodes).forEach((nodeId, nodeIndex) => {
            const nodeAngle = (2 * Math.PI * nodeIndex) / graphNodes.size;
            const x = center.x + radius * Math.cos(nodeAngle);
            const y = center.y + radius * Math.sin(nodeAngle);
            
            // Vérifier si le nœud existe déjà
            const existingNode = nodes.find(n => n.id === nodeId);
            if (!existingNode) {
              nodes.push({ 
                id: nodeId, 
                label: String(nodeId),
                x: x,
                y: y,
                fixed: false // Fixer la position initiale
              });
            }
          });
        });
        
        // Créer les arêtes pour tous les graphes
        graphData.graphs.forEach(graph => {
          graph.edges.forEach(edge => {
            const [from, to] = edge.replace(/[()]/g, '').split(',').map(Number);
            edges.push({ from, to });
          });
        });
        
        console.log(`Données du graphe ${graphType}:`, { nodes, edges });
        
        // Mettre à jour la visualisation
        previewNetwork.setData({ nodes, edges });
        
        // Stabiliser le graphe
        previewNetwork.stabilize(100);
        
        // Forcer le centrage après la stabilisation
        setTimeout(() => {
          previewNetwork.fit({
            animation: {
              duration: 0
            }
          });
        }, 100);
      } else {
        console.warn(`Conteneur non trouvé pour ${graphType}`);
      }
    });

    // Ajouter les écouteurs d'événements pour les boutons de copie
    document.querySelectorAll('.copy-btn').forEach(button => {
      button.addEventListener('click', () => {
        const graphType = button.dataset.graph;
        const graphData = TYPICAL_GRAPHS[graphType];
        if (graphData) {
          // Générer les listes d'arêtes pour chaque graphe
          const edgeLists = graphData.graphs.map(graph => {
            return `[${graph.edges.join(', ')}]`;
          });

          // Copier toutes les listes dans le presse-papiers
          const textToCopy = edgeLists.join('\n\n');
          navigator.clipboard.writeText(textToCopy)
            .then(() => {
              UI.updateStatus(`${edgeLists.length} graphe(s) copié(s) dans le presse-papiers !`, "success");
            })
            .catch(err => {
              console.error('Erreur lors de la copie :', err);
              UI.updateStatus("Erreur lors de la copie du graphe.", "error");
            });
        }
      });
    });
  }, 100);
}