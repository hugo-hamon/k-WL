import { GRAPH_VISUALIZATION_CONFIG } from "./config.js";

class GraphVisualizer {
    constructor(config) {
        this.config = config;
        this.selectedNodeId = null;
        this.network = null;

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
        const graphs = await eel.eel_get_graphs()();

        if (Array.isArray(graphs) && graphs.length > 0) {
            this.displayGraph(graphs[0]);
        } else if (this.statusInfo) {
            this.statusInfo.textContent = "Status: Aucun graphe généré.";
        }
    }

    convertGraphDictToVisData(graphData) {
        const nodes = new vis.DataSet();
        const edges = new vis.DataSet();
        const nodeConfig = this.config.nodes;
        const edgeConfig = this.config.edges;

        if (Array.isArray(graphData?.nodes)) {
            graphData.nodes.forEach((_, index) => {
                nodes.add({
                    id: index,
                    label: index.toString(),
                    shape: nodeConfig.shape,
                    size: nodeConfig.size,
                    font: { ...nodeConfig.font },
                    color: nodeConfig.color,
                    borderWidth: nodeConfig.borderWidth,
                });
            });
        }

        const defaultEdgeColor = edgeConfig.color?.color || "#000000";

        if (Array.isArray(graphData?.edges)) {
            graphData.edges.forEach(([from, to]) => {
                edges.add({
                    from,
                    to,
                    width: edgeConfig.width,
                    color: { color: defaultEdgeColor },
                });
            });
        }

        return { nodes, edges };
    }

    getNetworkOptions() {
        return {
            layout: { ...this.config.network.layout },
            physics: { ...this.config.network.physics },
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
    }

    handleNodeSelection(params) {
        if (params.nodes.length > 0) {
            this.selectedNodeId = params.nodes[0];
            if (typeof updateInfoPanelContent === "function") {
                updateInfoPanelContent();
            }
            if (typeof highlightSelection === "function") {
                highlightSelection(this.selectedNodeId);
            }
        } else {
            this.handleNodeDeselection();
        }
    }

    handleNodeDeselection() {
        this.selectedNodeId = null;
        if (typeof clearInfoPanel === "function") {
            clearInfoPanel();
        }
        if (typeof updateInfoPanelContent === "function") {
            updateInfoPanelContent();
        }
        if (typeof unhighlightAll === "function") {
            unhighlightAll();
        }
    }

    handleNetworkClick(params) {
        if (params.nodes.length === 0 && params.edges.length === 0) {
            if (typeof unhighlightGraphEdge === "function") {
                unhighlightGraphEdge();
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

export { GraphVisualizer, graphVisualizerInstance };
