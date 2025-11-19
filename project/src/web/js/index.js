import { GRAPH_VISUALIZATION_CONFIG } from "./config.js";

class GraphVisualizer {
    constructor(config) {
        this.config = config;
        this.selectedNodeId = null;
        this.network = null;
        this.physicsEnabled = true;
        this.wlIteration = 0;

        this.generateButton = document.getElementById(
            config.selectors.generateButtonId,
        );
        this.graphSizeInput = document.getElementById(
            config.selectors.graphSizeInputId,
        );
        this.graphDensityInput = document.getElementById(
            config.selectors.graphDensityInputId,
        );
        this.statusInfo = document.getElementById(config.selectors.statusInfoId);
        this.networkContainer = document.getElementById(
            config.selectors.networkContainerId,
        );
        this.loadGraphButton = document.getElementById(config.selectors.loadGraphButtonId);
        this.edgeListInput = document.getElementById(config.selectors.edgeListInputId);
        this.saveGraphClipboardButton = document.getElementById(config.selectors.saveGraphClipboardButtonId);
        this.togglePhysicsButton = document.getElementById(config.selectors.togglePhysicsButtonId);
        this.infoPanelContent = document.getElementById(config.selectors.infoPanelContentId);

        this.handleNodeSelection = this.handleNodeSelection.bind(this);
        this.handleNodeDeselection = this.handleNodeDeselection.bind(this);
        this.handleNetworkClick = this.handleNetworkClick.bind(this);

        if (
            !this.generateButton ||
            !this.graphSizeInput ||
            !this.graphDensityInput ||
            !this.statusInfo ||
            !this.networkContainer
        ) {
            throw new Error(
                "GraphVisualizer: Impossible de trouver certains éléments de l'interface.",
            );
        }

        this.generateButton.addEventListener("click", () => {
            this.generateRandomGraph();
        });
        this.loadGraphButton.addEventListener("click", () => {
            this.loadGraphFromList();
        });
        this.saveGraphClipboardButton.addEventListener("click", () => {
            this.saveGraphToClipboard();
        });
        this.togglePhysicsButton.addEventListener("click", () => {
            this.togglePhysics();
        });
    }

    getGraphParameters() {
        return {
            size: this.graphSizeInput.value,
            density: this.graphDensityInput.value,
        };
    }

    async generateRandomGraph() {
        const { size, density } = this.getGraphParameters();

        await eel.eel_generate_random_graph(size, density)();
        const graph = await eel.eel_get_graph()();

        if (Array.isArray(graph) && graph.length > 0) {
            this.displayGraph(graph);
        } else if (this.statusInfo) {
            this.statusInfo.textContent = "Status: Aucun graphe généré.";
        }
    }

    async saveGraphToClipboard() {
        const graph = await eel.eel_get_graph()();
        // Make a single string as [(x,y), (x,y), ...]
        let string = "[";
        let edges = [];

        // Build the string
        for (const object of graph) {
            for (const edge of object.edges) {
                if (!edges.includes(edge) && !edges.includes([edge[1], edge[0]])) {
                    string += `(${edge[0]},${edge[1]}), `;
                    edges.push(edge);
                }
            }
        }
        // Remove the last comma and add the closing bracket
        string = string.slice(0, -2);
        string += "]";
        
        navigator.clipboard.writeText(string);
        if (this.statusInfo) {
            this.statusInfo.textContent = "Status: Graphe sauvegardé dans le presse-papiers.";
        }
    }

    async loadGraphFromList() {
        const graphList = this.edgeListInput.value;
        await eel.eel_load_graph_from_list(graphList)();
        const graph = await eel.eel_get_graph()();

        if (Array.isArray(graph) && graph.length > 0) {
            this.displayGraph(graph);
        } else if (this.statusInfo) {
            this.statusInfo.textContent = "Status: Aucun graphe chargé.";
        }
    }

    convertGraphDictToVisData(graphData) {
        const nodes = new vis.DataSet();
        const edges = new vis.DataSet();
        const nodeConfig = this.config.nodes;
        const edgeConfig = this.config.edges;

        if (Array.isArray(graphData)) {
            graphData.forEach((object) => {
                nodes.add({
                    id: object.nodes,
                    label: object.nodes.toString(),
                    shape: nodeConfig.shape,
                    size: nodeConfig.size,
                    font: { ...nodeConfig.font },
                    color: nodeConfig.color,
                    borderWidth: nodeConfig.borderWidth,
                });
            });
        }

        const defaultEdgeColor = edgeConfig.color?.color || "#000000";

        if (Array.isArray(graphData)) {
            graphData.forEach((object) => {
                object.edges.forEach((edge) => {
                    edges.add({
                        from: edge[0],
                        to: edge[1],
                        width: edgeConfig.width,
                        color: { color: defaultEdgeColor },
                    });
                });
            });
        }

        return { nodes, edges };
    }

    getNetworkOptions() {
        return {
            layout: { ...this.config.network.layout },
            physics: {
                ...this.config.network.physics,
                enabled: this.physicsEnabled,
            },
            interaction: { ...this.config.network.interaction },
            nodes: {
                shape: this.config.nodes.shape,
                size: this.config.nodes.size,
                font: { ...this.config.nodes.font },
                borderWidth: this.config.nodes.borderWidth,
                color: this.config.nodes.color,
            },
            edges: {
                width: this.config.edges.width,
                color: { ...this.config.edges.color },
                smooth: { ...this.config.edges.smooth },
                arrows: { ...this.config.edges.arrows },
            },
        };
    }

    displayGraph(graphData) {
        const visData = this.convertGraphDictToVisData(graphData);
        const options = this.getNetworkOptions();

        this.network = new vis.Network(this.networkContainer, visData, options);

        this.network.on("stabilizationProgress", (params) => {
            if (!this.statusInfo || !params.total) {
                return;
            }
            const percent = Math.round((params.iterations / params.total) * 100);
            this.statusInfo.textContent = `Status: Stabilizing... ${percent}%`;
        });

        this.network.on("stabilizationIterationsDone", () => {
            if (this.statusInfo) {
                this.statusInfo.textContent = "Status: Ready";
            }
            this.network?.fit();
        });

        if (options.physics?.enabled) {
            this.network.stabilize();
        } else {
            this.network.fit();
            if (this.statusInfo) {
                this.statusInfo.textContent = "Status: Ready";
            }
        }

        this.network.on("selectNode", this.handleNodeSelection);
        this.network.on("deselectNode", this.handleNodeDeselection);
        this.network.on("click", this.handleNetworkClick);

        // Mettre à jour le texte du bouton pour refléter l'état actuel
        if (this.togglePhysicsButton) {
            this.togglePhysicsButton.textContent = this.physicsEnabled
                ? "Désactiver la physique"
                : "Activer la physique";
        }
    }

    handleNodeSelection(params) {
        if (params.nodes.length > 0) {
            this.selectedNodeId = params.nodes[0];
            this.updateInfoPanelContent();
            if (typeof highlightSelection === "function") {
                highlightSelection(this.selectedNodeId);
            }
        } else {
            this.handleNodeDeselection();
        }
    }



    handleNodeDeselection() {
        this.selectedNodeId = null;
        this.clearInfoPanelContent();
        this.updateInfoPanelContent();
        if (typeof unhighlightAll === "function") {
            unhighlightAll();
        }
    }

    clearInfoPanelContent() {
        this.infoPanelContent.textContent = "Select a node to see details.";
    }

    updateInfoPanelContent() {
        if (this.selectedNodeId !== null) {
            const nodeId = this.selectedNodeId;
            this.infoPanelContent.innerHTML = `<h3>Node: ${nodeId} (Iteration ${this.wlIteration})</h3>`;
            this.infoPanelContent.innerHTML += `<p>Current WL Label: </p>`
            this.infoPanelContent.innerHTML += `<hr/>`
            this.infoPanelContent.innerHTML += `<h3>Previous Iteration (${this.wlIteration - 1}):</h3>`
            this.infoPanelContent.innerHTML += `<p>Previous WL Label: </p>`
            this.infoPanelContent.innerHTML += `<p>Previous Neighbors Labels: </p>`
            this.infoPanelContent.innerHTML += `Signature Computed: </p>`
            this.infoPanelContent.innerHTML += `<hr/>`
            this.infoPanelContent.innerHTML += `<h3>Neighbors (): </h3>`
        }
    }

    handleNetworkClick(params) {
        if (params.nodes.length === 0 && params.edges.length === 0) {
            if (typeof unhighlightGraphEdge === "function") {
                unhighlightGraphEdge();
            }
        }
    }

    togglePhysics() {
        if (!this.network) {
            return;
        }

        // Inverser l'état de la physique
        this.physicsEnabled = !this.physicsEnabled;

        this.network.setOptions({
            physics: {
                enabled: this.physicsEnabled,
            },
        });

        // Mettre à jour le texte du bouton
        if (this.togglePhysicsButton) {
            this.togglePhysicsButton.textContent = this.physicsEnabled
                ? "Désactiver la physique"
                : "Activer la physique";
        }

        // Si on active la physique, stabiliser le réseau
        if (this.physicsEnabled) {
            this.network.stabilize();
            if (this.statusInfo) {
                this.statusInfo.textContent = "Status: Stabilisation en cours...";
            }
        } else {
            if (this.statusInfo) {
                this.statusInfo.textContent = "Status: Physique désactivée";
            }
        }
    }
}

function initializeGraphVisualizer() {
    return new GraphVisualizer(GRAPH_VISUALIZATION_CONFIG);
}

let graphVisualizerInstance = null;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        graphVisualizerInstance = initializeGraphVisualizer();
    });
} else {
    graphVisualizerInstance = initializeGraphVisualizer();
}

// Generate a random graph on load
graphVisualizerInstance.generateRandomGraph();

export { GraphVisualizer, graphVisualizerInstance };
