import { GRAPH_VISUALIZATION_CONFIG } from "./config.js";
import { initializeGallery } from "./gallery.js";

class GraphVisualizer {
    constructor(config) {
        this.config = config;
        this.selectedNodeId = null;
        this.graphInstance = null;
        this.is3D = false;
        this.isPhysicsFrozen = false;
        this.currentGraphData = { nodes: [], links: [] };
        this.previousWLColors = new Map();
        this.colors = new Map();
        this.colorsMap = new Map();
        this.wlIteration = 0;
        this.selectedNodeNeighbors = new Set();

        // --- Get DOM elements ---
        this.generateButton = document.getElementById(config.selectors.generateButtonId);
        this.graphSizeInput = document.getElementById(config.selectors.graphSizeInputId);
        this.graphDensityInput = document.getElementById(config.selectors.graphDensityInputId);
        this.statusInfo = document.getElementById(config.selectors.statusInfoId);
        this.networkContainer = document.getElementById(config.selectors.networkContainerId);
        this.loadGraphButton = document.getElementById(config.selectors.loadGraphButtonId);
        this.edgeListInput = document.getElementById(config.selectors.edgeListInputId);
        this.saveGraphClipboardButton = document.getElementById(config.selectors.saveGraphClipboardButtonId);
        this.iterateButton = document.getElementById(config.selectors.iterateButtonId);
        this.kValueInput = document.getElementById(config.selectors.kValueInputId);

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
        this.iterateButton.addEventListener("click", () => this.iterateWL());

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
                .linkWidth(this.config.graph3d.linkWidth)
                

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
                .nodeCanvasObject((node, ctx, globalScale) => this.render2DNodeVisuals(node, ctx, globalScale));

            this.toggleModeButton.textContent = "Switch to 3D";
        }

        // 3. Common configuration (Like the colors...)
        const determineNodeColor = (node) => {
            let basedColor = this.getIntColor(this.colors.get(node.id));
            if (node.id === this.selectedNodeId) {
                return `hsl(215, 100%, 91%)`;
            }
            return basedColor;
        };

        this.graphInstance
            .width(this.networkContainer.clientWidth)
            .height(this.networkContainer.clientHeight)
            .nodeColor(determineNodeColor)
            .linkColor(() => this.is3D ? this.config.graph3d.linkColor : this.config.graph2d.linkColor)
            .linkCurvature(0.1);


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
        this.selectedNodeNeighbors.clear();
        this.selectedNodeId = null;
        this.refreshNodeStyles();
        this.clearInfoPanelContent();
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
    async iterateWL() {
        const k = parseInt(this.kValueInput.value);
        // Get new colors for each node
        if (k === 1) {
            // convert dict to list as [(node, color), (node, color), ...]
            this.previousWLColors = new Map(this.colors);
            const colorsList = Array.from(this.colors.entries()).map(([node, color]) => [node, color]);
            let newColors = await eel.eel_wl_1_iterative(colorsList)();
            newColors = new Map(Object.entries(newColors));
            newColors = new Map(Array.from(newColors.entries()).map(([key, value]) => [parseInt(key), value]));

            // Update colors for each node
            this.colors = newColors;

            // Increment iteration counter
            this.wlIteration++;
    
            // Refresh the visual display
            this.refreshNodeStyles();

            this.updateInfoPanelContent();
        }
    }

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
        this.updateSelectedNodeNeighbors();

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
        const colors = new Map();
        const links = [];
        const addedLinks = new Set();
        const addedNodes = new Set();

        if (Array.isArray(graphData)) {
            graphData.forEach((object) => {
                if (!addedNodes.has(object.nodes)) {
                    nodes.push({ id: object.nodes })
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
        for (const node of nodes) {
            colors.set(node.id, 0);
        }

        this.colors = colors;
        return { nodes, links };
    }

    // --- Interactions ---
    handleNodeClick(node) {
        this.selectedNodeId = node.id;
        this.updateSelectedNodeNeighbors();

        this.refreshNodeStyles();

        // If 3D, move the camera
        if (this.is3D) {
            this.graphInstance.nodeColor(n => n.id === this.selectedNodeId ? this.getIntColor(this.colors.get(n.id)) : this.getIntColor(this.colors.get(n.id)));
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
        this.selectedNodeNeighbors.clear();
        // Reset colors
        const conf = this.is3D ? this.config.graph3d : this.config.graph2d;
        this.refreshNodeStyles();

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
        const seenEdges = new Set(); 

        for (const object of graph) {
            for (const edge of object.edges) {
                const u = edge[0];
                const v = edge[1];

                const key = u < v ? `${u}-${v}` : `${v}-${u}`;

                if (!seenEdges.has(key)) {
                    seenEdges.add(key);
                    string += `(${u}, ${v}), `;
                }
            }
        }

        if (seenEdges.size > 0) {
            string = string.slice(0, -2);
        }
        string += "]";

        navigator.clipboard.writeText(string);
        if (this.statusInfo) this.statusInfo.textContent = "Status: Copied to clipboard.";
    }

    clearInfoPanelContent() {
        this.infoPanelContent.textContent = "Select a node to see details.";
    }

    updateInfoPanelContent() {
        if (this.selectedNodeId !== null && this.wlIteration > 0) {
            this.infoPanelContent.innerHTML = `<h3>Node: ${this.selectedNodeId}</h3>`;
            this.infoPanelContent.innerHTML += `<p>Current WL Label: ${this.colors.get(this.selectedNodeId)}</p>`
            this.infoPanelContent.innerHTML += `<hr/>`
            this.infoPanelContent.innerHTML += `<h3>Previous Iteration (${this.wlIteration - 1}):</h3>`
            this.infoPanelContent.innerHTML += `<p>Previous WL Label: ${this.previousWLColors.get(this.selectedNodeId)}</p>`
            let previousNeighborsLabels = "";
            for (const neighbor of this.selectedNodeNeighbors) {
                previousNeighborsLabels += `${this.previousWLColors.get(neighbor)}, `;
            }
            previousNeighborsLabels = previousNeighborsLabels.slice(0, -2);
            this.infoPanelContent.innerHTML += `<p>Previous Neighbors Labels: ${previousNeighborsLabels}</p>`

            // Signature = WL_label(node) | WL_label(neighbors[0]),WL_label(neighbors[1]),...
            let neighborsLabels = [];
            for (const neighbor of this.selectedNodeNeighbors) {
                neighborsLabels.push(parseInt(this.previousWLColors.get(neighbor)));
            }
            neighborsLabels.sort((a, b) => a - b);
            let signature = "";
            signature += `${this.previousWLColors.get(this.selectedNodeId)}|`;
            for (const neighbor of neighborsLabels) {
                signature += `${neighbor},`;
            }
            signature = signature.slice(0, -1);
            this.infoPanelContent.innerHTML += `<p>Signature Computed: ${signature}</p>`

            this.infoPanelContent.innerHTML += `<hr/>`
            let neighbors = "";
            for (const neighbor of this.selectedNodeNeighbors) {
                neighbors += `${neighbor}, `;
            }
            neighbors = neighbors.slice(0, -2);
            this.infoPanelContent.innerHTML += `<h3>Neighbors (${neighbors}): </h3>`
            // Todo: Add WL information
        } else if (this.selectedNodeId !== null && this.wlIteration === 0) {
            this.infoPanelContent.innerHTML = `Run the WL iteration to see the information.`;
        }
    }

    render2DNodeVisuals(node, ctx, globalScale = 1) {
        const label = node.id === undefined || node.id === null ? '' : String(node.id);
        const radius = 6;
        const isSelected = node.id === this.selectedNodeId;
        const isNeighbor = this.selectedNodeNeighbors.has(node.id);
        const baseStrokeWidth = isSelected ? 2 : isNeighbor ? 1 : 0.5;
        const strokeColor = isNeighbor ? "rgba(255,0,0,1.0)" : "black";

        ctx.save();

        ctx.lineWidth = baseStrokeWidth;
        ctx.strokeStyle = isSelected ? `hsl(214, 81%, 54%)` : strokeColor;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.stroke();

        if (label) {
            const fontSize = 6;
            const verticalOffset = 8;

            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.fillStyle = "rgba(0, 0, 0, 1.0)";

            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            ctx.fillText(label, node.x, node.y + verticalOffset);
        }
        ctx.restore();
    }

    getIntColor(index) {
        if (index === undefined || index === null) return '#999';
        if (this.colorsMap.has(index)) return this.colorsMap.get(index);

        // if (index === 0) return 'hsl(200, 100%, 60%)';

        const hue = (index * 137.508) % 360;
        const lightness = 80;
        const saturation = 70;
        const newColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        this.colorsMap.set(index, newColor);
        return newColor;
    }

    updateSelectedNodeNeighbors() {
        this.selectedNodeNeighbors.clear();
        if (this.selectedNodeId === null) return;

        this.currentGraphData.links.forEach(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id ?? link.source.index : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id ?? link.target.index : link.target;

            if (sourceId === this.selectedNodeId) {
                this.selectedNodeNeighbors.add(targetId);
            } else if (targetId === this.selectedNodeId) {
                this.selectedNodeNeighbors.add(sourceId);
            }
        });
    }

    refreshNodeStyles() {
        if (!this.graphInstance) return;
        this.graphInstance.nodeColor(this.graphInstance.nodeColor());
        if (!this.is3D && typeof this.graphInstance.refresh === "function") {
            this.graphInstance.refresh();
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

    initializeGallery();
});

export { GraphVisualizer, graphVisualizerInstance };