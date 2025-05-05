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
              enabled: true,
              iterations: 100,
              fit: true
            },
            barnesHut: {
              gravitationalConstant: -1500,
              springLength: 80,
              springConstant: 0.04
            }
          },
          interaction: {
            hover: true,
            zoomView: false,
            dragView: false
          },
          layout: {
            improvedLayout: true,
            randomSeed: 1,
            hierarchical: {
              enabled: false
            }
          },
          width: '100%',
          height: '100%'
        };

        // Créer le réseau
        const previewNetwork = new vis.Network(
          previewContainer,
          { nodes: [], edges: [] },
          options
        );

        // Stocker la référence au réseau dans le conteneur
        previewContainer.__vis_network__ = previewNetwork;

        // Générer les données du graphe
        const nodes = [];
        const edges = [];
        
        // Créer les nœuds avec des positions initiales centrées
        const maxNode = Math.max(...graphData.edges.map(edge => {
          const [from, to] = edge.replace(/[()]/g, '').split(',').map(Number);
          return Math.max(from, to);
        }));
        
        // Calculer le rayon du cercle pour les positions
        const radius = 100;
        const centerX = 0;
        const centerY = 0;
        
        for (let i = 0; i <= maxNode; i++) {
          const angle = (2 * Math.PI * i) / (maxNode + 1);
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          nodes.push({ 
            id: i, 
            label: String(i),
            x: x,
            y: y
          });
        }
        
        // Créer les arêtes
        graphData.edges.forEach(edge => {
          const [from, to] = edge.replace(/[()]/g, '').split(',').map(Number);
          edges.push({ from, to });
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
          const edgeList = `[${graphData.edges.join(', ')}]`;
          navigator.clipboard.writeText(edgeList)
            .then(() => {
              UI.updateStatus(`Graphe ${graphData.name} copié dans le presse-papiers !`, "success");
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