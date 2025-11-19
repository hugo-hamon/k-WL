import { GRAPH_VISUALIZATION_CONFIG } from "./config.js";

class GraphVisualizer {
    constructor(config) {
        this.config = config;
        this.selectedNodeId = null;
        this.graphInstance = null; 
        this.is3D = true; // On commence en 3D par défaut
        this.isPhysicsFrozen = false; // État de la physique
        this.currentGraphData = { nodes: [], links: [] }; // Mémoire tampon des données

        // --- Récupération des éléments DOM ---
        this.generateButton = document.getElementById(config.selectors.generateButtonId);
        this.graphSizeInput = document.getElementById(config.selectors.graphSizeInputId);
        this.graphDensityInput = document.getElementById(config.selectors.graphDensityInputId);
        this.statusInfo = document.getElementById(config.selectors.statusInfoId);
        this.networkContainer = document.getElementById(config.selectors.networkContainerId);
        this.loadGraphButton = document.getElementById(config.selectors.loadGraphButtonId);
        this.edgeListInput = document.getElementById(config.selectors.edgeListInputId);
        this.saveGraphClipboardButton = document.getElementById(config.selectors.saveGraphClipboardButtonId);
        
        // Nouveaux / Modifiés
        this.togglePhysicsButton = document.getElementById(config.selectors.togglePhysicsButtonId);
        this.toggleModeButton = document.getElementById(config.selectors.toggleModeButtonId);
        
        this.infoPanelContent = document.getElementById(config.selectors.infoPanelContentId);

        // Bindings
        this.handleNodeClick = this.handleNodeClick.bind(this);
        this.handleBackgroundClick = this.handleBackgroundClick.bind(this);

        // Listeners
        this.generateButton.addEventListener("click", () => this.generateRandomGraph());
        this.loadGraphButton.addEventListener("click", () => this.loadGraphFromList());
        this.saveGraphClipboardButton.addEventListener("click", () => this.saveGraphToClipboard());
        
        this.togglePhysicsButton.addEventListener("click", () => this.togglePhysics());
        this.toggleModeButton.addEventListener("click", () => this.toggleMode()); // Nouveau listener

        // Initialisation
        this.initGraph();
    }

    // Initialise ou Ré-initialise le moteur de graphe (2D ou 3D)
    initGraph() {
        // 1. Nettoyer le conteneur précédent (supprime le canvas existant)
        this.networkContainer.innerHTML = '';

        // 2. Instancier la bonne librairie
        if (this.is3D) {
            this.graphInstance = ForceGraph3D()(this.networkContainer)
                .backgroundColor(this.config.graph3d.backgroundColor)
                .nodeLabel('id')
                .nodeResolution(16)
                .nodeVal(6)
                .onNodeClick(this.handleNodeClick)
                .onBackgroundClick(this.handleBackgroundClick)
                .linkWidth(this.config.graph3d.linkWidth);
                
            this.toggleModeButton.textContent = "Passer en 2D";
        } else {
            this.graphInstance = ForceGraph()(this.networkContainer)
                .backgroundColor(this.config.graph2d.backgroundColor)
                .nodeLabel('id')
                .nodeRelSize(6)
                .onNodeClick(this.handleNodeClick)
                .onBackgroundClick(this.handleBackgroundClick)
                .linkWidth(this.config.graph2d.linkWidth);

            this.toggleModeButton.textContent = "Passer en 3D";
        }

        // 3. Configuration commune (Couleurs dynamiques)
        // On définit la couleur selon si c'est 2D ou 3D
        const conf = this.is3D ? this.config.graph3d : this.config.graph2d;
        
        this.graphInstance
            .width(this.networkContainer.clientWidth)
            .height(this.networkContainer.clientHeight)
            .nodeColor(node => node.id === this.selectedNodeId ? conf.nodeSelectedColor : conf.nodeColor)
            .linkColor(() => this.is3D ? this.config.graph3d.linkColor : this.config.graph2d.linkColor)
            

        // Gestion du redimensionnement
        window.addEventListener('resize', () => {
            if(this.graphInstance) {
                this.graphInstance
                    .width(this.networkContainer.clientWidth)
                    .height(this.networkContainer.clientHeight);
            }
        });

        // 4. Recharger les données s'il y en a
        if (this.currentGraphData.nodes.length > 0) {
            this.graphInstance.graphData(this.currentGraphData);
            
            // Si la physique était gelée, on la ré-applique
            if (this.isPhysicsFrozen) {
                // Petit délai pour laisser le graphe s'initialiser avant de figer
                setTimeout(() => this.applyFreeze(true), 500); 
            }
        }
    }

    // --- Logique de changement de mode ---
    toggleMode() {
        this.is3D = !this.is3D; // Inverse le mode
        this.initGraph(); // Reconstruit le graphe
    }

    // --- Logique de Physique (Freeze / Unfreeze) ---
    togglePhysics() {
        this.isPhysicsFrozen = !this.isPhysicsFrozen;
        this.applyFreeze(this.isPhysicsFrozen);
        
        // Mise à jour du texte bouton
        this.togglePhysicsButton.textContent = this.isPhysicsFrozen 
            ? "Libérer les nœuds" 
            : "Figer les nœuds";
            
        if (this.statusInfo) {
            this.statusInfo.textContent = this.isPhysicsFrozen 
                ? "Status: Nodes Frozen (Drag enabled)" 
                : "Status: Physics Active";
        }
    }

    applyFreeze(shouldFreeze) {
        if (!this.graphInstance) return;

        const { nodes } = this.graphInstance.graphData();
        
        if (shouldFreeze) {
            // On fixe chaque nœud à sa position actuelle
            nodes.forEach(node => {
                node.fx = node.x;
                node.fy = node.y;
                if (this.is3D) node.fz = node.z;
            });
        } else {
            // On libère les nœuds (fx = null permet au moteur physique de reprendre le contrôle)
            nodes.forEach(node => {
                node.fx = null;
                node.fy = null;
                if (this.is3D) node.fz = null;
            });
            
            // On réchauffe le moteur pour relancer le mouvement
            this.graphInstance.d3AlphaTarget(0.3).restart(); 
        }
    }

    // --- Appels Eel & Data ---

    async generateRandomGraph() {
        const { size, density } = this.getGraphParameters();
        await eel.eel_generate_random_graph(size, density)();
        this.refreshGraphData();
    }

    async loadGraphFromList() {
        const graphList = this.edgeListInput.value;
        await eel.eel_load_graph_from_list(graphList)();
        this.refreshGraphData();
    }

    async refreshGraphData() {
        const graphRaw = await eel.eel_get_graph()();
        // Conversion
        const gData = this.convertGraphDictToForceData(graphRaw);
        
        // Mise à jour mémoire tampon
        this.currentGraphData = gData;

        // Mise à jour visuelle
        if (this.graphInstance) {
            this.graphInstance.graphData(gData);
            
            // Si on est en mode "Figé", on doit re-figer les nouveaux nœuds après une courte stabilisation
            if (this.isPhysicsFrozen) {
                this.statusInfo.textContent = "Status: Stabilizing new graph...";
                // On laisse bouger un peu (1s) pour que le graphe se déplie, puis on fige
                setTimeout(() => {
                    this.applyFreeze(true);
                    this.statusInfo.textContent = "Status: Nodes Frozen";
                }, 1000);
            }
        }
    }

    convertGraphDictToForceData(graphData) {
        const nodes = [];
        const links = [];
        const addedLinks = new Set();
        const addedNodes = new Set();
        
        if (Array.isArray(graphData)) {
            graphData.forEach((object) => {
                if (!addedNodes.has(object.nodes)) {
                    nodes.push({ id: object.nodes });
                    addedNodes.add(object.nodes);
                }
                
                object.edges.forEach((edge) => {
                    const source = edge[0];
                    const target = edge[1];
                    // Assurer que les noeuds existent (par sécurité)
                    if (!addedNodes.has(source)) { nodes.push({ id: source }); addedNodes.add(source); }
                    if (!addedNodes.has(target)) { nodes.push({ id: target }); addedNodes.add(target); }

                    const key = source < target ? `${source}-${target}` : `${target}-${source}`;
                    if (!addedLinks.has(key)) {
                        links.push({ source, target });
                        addedLinks.add(key);
                    }
                });
            });
        }
        return { nodes, links };
    }

    // --- Interactions ---

    handleNodeClick(node) {
        this.selectedNodeId = node.id;
        
        // Update couleur
        const conf = this.is3D ? this.config.graph3d : this.config.graph2d;
        this.graphInstance.nodeColor(n => n.id === this.selectedNodeId ? conf.nodeSelectedColor : conf.nodeColor);
        
        // Si 3D, on bouge la caméra
        if (this.is3D) {
            const distance = 40;
            const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
            this.graphInstance.cameraPosition(
                { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, 
                node, 
                3000
            );
        } else {
            // Si 2D, on peut centrer la vue (optionnel)
            this.graphInstance.centerAt(node.x, node.y, 1000);
            this.graphInstance.zoom(4, 2000);
        }
        
        this.updateInfoPanelContent();
    }

    handleBackgroundClick() {
        this.selectedNodeId = null;
        // Reset couleurs
        const conf = this.is3D ? this.config.graph3d : this.config.graph2d;
        this.graphInstance.nodeColor(n => conf.nodeColor);
        
        this.clearInfoPanelContent();
    }

    // --- Helpers & Info Panel ---
    getGraphParameters() {
        return {
            size: this.graphSizeInput.value,
            density: this.graphDensityInput.value,
        };
    }
    
    async saveGraphToClipboard() {
        const graph = await eel.eel_get_graph()();
        // Logique inchangée pour le formatage string...
        let string = "[";
        let edges = [];
        for (const object of graph) {
            for (const edge of object.edges) {
                if (!edges.includes(edge) && !edges.includes([edge[1], edge[0]])) {
                    string += `(${edge[0]},${edge[1]}), `;
                    edges.push(edge);
                }
            }
        }
        string = string.slice(0, -2) + "]";
        navigator.clipboard.writeText(string);
        if (this.statusInfo) this.statusInfo.textContent = "Status: Copied to clipboard.";
    }
    
    clearInfoPanelContent() {
        this.infoPanelContent.textContent = "Select a node to see details.";
    }

    updateInfoPanelContent() {
        if (this.selectedNodeId !== null) {
             this.infoPanelContent.innerHTML = `<h3>Node: ${this.selectedNodeId}</h3>`;
             // ... Votre logique d'affichage WL
        }
    }
}

function initializeGraphVisualizer() {
    return new GraphVisualizer(GRAPH_VISUALIZATION_CONFIG);
}

let graphVisualizerInstance = null;

document.addEventListener("DOMContentLoaded", () => {
    graphVisualizerInstance = initializeGraphVisualizer();
    graphVisualizerInstance.generateRandomGraph();
});

export { GraphVisualizer, graphVisualizerInstance };