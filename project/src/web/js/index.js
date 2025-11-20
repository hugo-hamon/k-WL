import { GRAPH_VISUALIZATION_CONFIG } from "./config.js";

class GraphVisualizer {
    constructor(config) {
        this.config = config;
        this.selectedNodeId = null;
        this.graphInstance = null;
        this.is3D = false;
        this.isPhysicsFrozen = false;
        this.currentGraphData = { nodes: [], links: []};
        this.colors = [];
        this.colorsMap = new Map();
        this.wlIteration = 0;

        // --- Get DOM elements ---
        this.generateButton = document.getElementById(config.selectors.generateButtonId);
        this.graphSizeInput = document.getElementById(config.selectors.graphSizeInputId);
        this.graphDensityInput = document.getElementById(config.selectors.graphDensityInputId);
        this.statusInfo = document.getElementById(config.selectors.statusInfoId);
        this.networkContainer = document.getElementById(config.selectors.networkContainerId);
        this.loadGraphButton = document.getElementById(config.selectors.loadGraphButtonId);
        this.edgeListInput = document.getElementById(config.selectors.edgeListInputId);
        this.saveGraphClipboardButton = document.getElementById(config.selectors.saveGraphClipboardButtonId);

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
        this.toggleModeButton.addEventListener("click", () => this.toggleMode());

        // Initialisation
        this.initGraph();
    }

    // --- Init or Re-init the graph engine (2D or 3D)
    initGraph() {
        // 1. Clean the previous container (remove the existing canvas)
        this.networkContainer.innerHTML = '';

        // 2. Instantiate the good library
        if (this.is3D) {
            this.graphInstance = ForceGraph3D()(this.networkContainer)
                .backgroundColor(this.config.graph3d.backgroundColor)
                .nodeLabel(node => String(node.id))
                .nodeResolution(16)
                .nodeVal(6)
                .onNodeClick(this.handleNodeClick)
                .onBackgroundClick(this.handleBackgroundClick)
                .linkWidth(this.config.graph3d.linkWidth);

            this.toggleModeButton.textContent = "Switch to 2D";
        } else {
            this.graphInstance = ForceGraph()(this.networkContainer)
                .backgroundColor(this.config.graph2d.backgroundColor)
                .nodeLabel(() => '')
                .nodeRelSize(6)
                .onNodeClick(this.handleNodeClick)
                .onBackgroundClick(this.handleBackgroundClick)
                .linkWidth(this.config.graph2d.linkWidth)
                .nodeCanvasObjectMode(() => 'after')
                .nodeCanvasObject((node, ctx, globalScale) => this.render2DNodeLabel(node, ctx, globalScale));

            this.toggleModeButton.textContent = "Switch to 3D";
        }

        // 3. Common configuration (Like the colors...)
        const determineNodeColor = (node) => {
            if (node.id === this.selectedNodeId) {
                return "white";
            }
            return this.getIntColor(this.colors[node.id]);
        };

        this.graphInstance
            .width(this.networkContainer.clientWidth)
            .height(this.networkContainer.clientHeight)
            .nodeColor(determineNodeColor)
            .linkColor(() => this.is3D ? this.config.graph3d.linkColor : this.config.graph2d.linkColor)


        // Resize management
        window.addEventListener('resize', () => {
            if (this.graphInstance) {
                this.graphInstance
                    .width(this.networkContainer.clientWidth)
                    .height(this.networkContainer.clientHeight);
            }
        });

        // 4. Reload the data if there is some
        if (this.currentGraphData.nodes.length > 0) {
            this.graphInstance.graphData(this.currentGraphData);

            // If the physics was frozen, we apply it again
            if (this.isPhysicsFrozen) {
                // Small delay to let the graph initialize before freezing
                setTimeout(() => this.applyFreeze(true), 500);
            }
        }
    }

    // --- Mode change logic ---
    toggleMode() {
        this.is3D = !this.is3D;
        // Rebuild the graph
        this.initGraph();
    }

    // --- Physics logic ---
    togglePhysics() {
        this.isPhysicsFrozen = !this.isPhysicsFrozen;
        this.applyFreeze(this.isPhysicsFrozen);

        // Update the button text
        this.togglePhysicsButton.textContent = this.isPhysicsFrozen
            ? "Release the nodes"
            : "Freeze the nodes";

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
            // Fix each node to its current position
            nodes.forEach(node => {
                node.fx = node.x;
                node.fy = node.y;
                if (this.is3D) node.fz = node.z;
            });
        } else {
            // Release the nodes
            nodes.forEach(node => {
                node.fx = null;
                node.fy = null;
                if (this.is3D) node.fz = null;
            });
        }
    }

    // --- Eel & Data calls ---

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

        // Update the buffer
        this.currentGraphData = gData;

        // Update the visual
        if (this.graphInstance) {
            this.graphInstance.graphData(gData);

            // If we are in "Frozen" mode, we must freeze the new nodes after a short stabilization
            if (this.isPhysicsFrozen) {
                this.statusInfo.textContent = "Status: Stabilizing new graph...";
                // Let it move a bit (1s) to let the graph unfold, then freeze
                setTimeout(() => {
                    this.applyFreeze(true);
                    this.statusInfo.textContent = "Status: Nodes Frozen";
                }, 1000);
            }
        }
    }

    convertGraphDictToForceData(graphData) {
        const nodes = [];
        const colors = [];
        const links = [];
        const addedLinks = new Set();
        const addedNodes = new Set();

        if (Array.isArray(graphData)) {
            graphData.forEach((object) => {
                if (!addedNodes.has(object.nodes)) {
                    nodes.push({ id: object.nodes})
                    addedNodes.add(object.nodes);
                }

                object.edges.forEach((edge) => {
                    const source = edge[0];
                    const target = edge[1];
                    // Ensure that the nodes exist
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
        for (let i = 0; i < nodes.length; i++) {
            colors.push(0);
        }

        this.colors = colors;
        return { nodes, links };
    }

    // --- Interactions ---

    handleNodeClick(node) {
        this.selectedNodeId = node.id;

        this.graphInstance.nodeColor(this.graphInstance.nodeColor());

        // If 3D, move the camera
        if (this.is3D) {
            this.graphInstance.nodeColor(n => n.id === this.selectedNodeId ? this.getIntColor(n.id) : this.getIntColor(n.id));
            const distance = 500;
            const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
            this.graphInstance.cameraPosition(
                { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
                node,
                500
            );
        } else {
            // If 2D, center the view
            this.graphInstance.centerAt(node.x, node.y, 500);
            this.graphInstance.zoom(4, 500);
        }

        this.updateInfoPanelContent();
    }

    handleBackgroundClick() {
        this.selectedNodeId = null;
        // Reset colors
        const conf = this.is3D ? this.config.graph3d : this.config.graph2d;
        this.graphInstance.nodeColor(this.graphInstance.nodeColor());

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
            this.infoPanelContent.innerHTML += `<p>Current WL Label: </p>`
            this.infoPanelContent.innerHTML += `<hr/>`
            this.infoPanelContent.innerHTML += `<h3>Previous Iteration (${this.wlIteration - 1}):</h3>`
            this.infoPanelContent.innerHTML += `<p>Previous WL Label: </p>`
            this.infoPanelContent.innerHTML += `<p>Previous Neighbors Labels: </p>`
            this.infoPanelContent.innerHTML += `Signature Computed: </p>`
            this.infoPanelContent.innerHTML += `<hr/>`
            this.infoPanelContent.innerHTML += `<h3>Neighbors (): </h3>`
            // Todo: Add WL information
        }
    }

    render2DNodeLabel(node, ctx, globalScale = 1) {
        const label = node.id === undefined || node.id === null ? '' : String(node.id);
        if (!label) return;

        const fontSize = 6;
        const verticalOffset = 8;

        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.fillStyle = "black";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, node.x, node.y + verticalOffset);

        if (node.id === this.selectedNodeId) {
            // Add a border to the selected node
            const conf = this.config.graph2d;
            ctx.lineWidth = 3;
            ctx.strokeStyle = this.getIntColor(node.id);
            ctx.beginPath();
            ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI);
            ctx.stroke();
        }
    }

    getIntColor(index) {
        if (index === undefined || index === null) return '#999';
        if (this.colorsMap.has(index)) return this.colorsMap.get(index);

        const hue = (index * 137.508) % 360;
        const lightness = 50;
        const newColor = `hsl(${hue}, 70%, ${lightness}%)`;
        this.colorsMap.set(index, newColor);
        return newColor;
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