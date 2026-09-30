import { GRAPH_VISUALIZATION_CONFIG } from "./config.js";
import { initializeGallery } from "./gallery.js";
import { FWLPanel } from "./fwl.js";

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
        this.hoveredPair = null;
        this.busy = false;
        this.fwl = new FWLPanel(this);

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

        this.kValueInput.addEventListener("change", () => this.runAction(() => this.changeWLMode()));

        // Initialisation
        this.initGraph();
    }

    // --- Init or Re-init the graph engine (2D or 3D)
    initGraph() {
        // 1. Clean the previous container (remove the existing canvas)
        if (this.graphInstance && typeof this.graphInstance._destructor === 'function') this.graphInstance._destructor();
        this.networkContainer.innerHTML = '';

        // 2. Instantiate the good library
        if (this.is3D) {
            this.graphInstance = ForceGraph3D()(this.networkContainer)
                .backgroundColor(this.config.graph3d.backgroundColor)
                .nodeLabel(node => `G${node.graph + 1} · ${node.label}`)
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
            if (this.hoveredPair?.includes(node.id)) return "#ff8c00";
            let basedColor = this.kValueInput.value === "2" ? "#8c91a5" : this.getIntColor(this.colors.get(node.id));
            if (node.id === this.selectedNodeId) {
                return `hsl(215, 100%, 91%)`;
            }
            return basedColor;
        };

        this.graphInstance
            .width(this.networkContainer.clientWidth)
            .height(this.networkContainer.clientHeight)
            .nodeColor(determineNodeColor)
            .linkColor(link => this.isHighlightedLink(link) ? "#ff6500" : (this.is3D ? this.config.graph3d.linkColor : this.config.graph2d.linkColor))
            .linkWidth(link => this.isHighlightedLink(link) ? 5 : (this.is3D ? this.config.graph3d.linkWidth : this.config.graph2d.linkWidth))
            .linkCurvature(0.1);


        // Resize management
        if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
        this.resizeHandler = () => {
            if (this.graphInstance) {
                this.graphInstance
                    .width(this.networkContainer.clientWidth)
                    .height(this.networkContainer.clientHeight);
            }
        };
        window.addEventListener('resize', this.resizeHandler);

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
    async runAction(action) {
        if (this.busy) return;
        this.busy = true;
        const controls = [this.generateButton, this.loadGraphButton, this.iterateButton, this.kValueInput];
        controls.forEach(control => control.disabled = true);
        this.statusInfo.className = '';
        this.statusInfo.textContent = 'Calcul en cours…';
        try {
            await action();
        } catch (error) {
            this.statusInfo.className = 'status-error';
            this.statusInfo.textContent = `Erreur : ${error.message || error}`;
        } finally {
            this.busy = false;
            controls.forEach(control => control.disabled = false);
            this.iterateButton.disabled = this.kValueInput.value === '2' && Boolean(this.fwl.summary?.stable);
        }
    }

    checkResponse(result) {
        if (result?.error) throw new Error(result.error);
        return result;
    }

    async changeWLMode() {
        const pairs = this.kValueInput.value === '2';
        this.fwl.root.hidden = !pairs;
        this.infoPanelContent.hidden = pairs;
        document.querySelector('#info-panel h2').textContent = pairs ? '2-FWL · Couleurs des paires' : 'Node Information';
        this.highlightPair(null);
        this.refreshNodeStyles();
        if (pairs) {
            const summary = this.checkResponse(await eel.eel_fwl2(false)());
            await this.fwl.update(summary);
            this.showFWLStatus(summary);
        } else {
            this.fwl.request++;
            document.getElementById('iteration-info').textContent = `Iteration: ${this.wlIteration}`;
            this.statusInfo.textContent = '1-WL prêt.';
            this.updateInfoPanelContent();
        }
    }

    showFWLStatus(summary) {
        document.getElementById('iteration-info').textContent = `Iteration: ${summary.iteration}`;
        this.statusInfo.textContent = summary.stable ? '2-FWL : partition stable.' : '2-FWL prêt.';
        this.statusInfo.className = summary.stable ? 'status-converged' : '';
    }

    async iterateWL() {
        return this.runAction(async () => {
            if (this.kValueInput.value === '2') {
                const summary = this.checkResponse(await eel.eel_fwl2(true)());
                await this.fwl.update(summary);
                this.showFWLStatus(summary);
                return;
            }
            this.previousWLColors = new Map(this.colors);
            const newColors = await eel.eel_wl_1_iterative(Array.from(this.colors.entries()))();
            this.colors = new Map(Object.entries(newColors).map(([key, value]) => [Number(key), value]));
            this.wlIteration++;
            this.refreshNodeStyles();
            this.updateInfoPanelContent();
            document.getElementById('iteration-info').textContent = `Iteration: ${this.wlIteration}`;
            this.statusInfo.textContent = '1-WL prêt.';
        });
    }

    async generateRandomGraph() {
        return this.runAction(async () => {
            const { size, density } = this.getGraphParameters();
            this.checkResponse(await eel.eel_generate_random_graph(size, density)());
            await this.refreshGraphData();
        });
    }

    async loadGraphFromList() {
        return this.runAction(async () => {
            this.checkResponse(await eel.eel_load_graph_from_list(this.edgeListInput.value)());
            await this.refreshGraphData();
        });
    }

    async refreshGraphData() {
        const graphRaw = await eel.eel_get_graph()();
        this.fwl.reset();
        this.wlIteration = 0;
        document.getElementById("iteration-info").textContent = "Iteration: 0";
        this.previousWLColors.clear();
        this.selectedNodeId = null;
        this.clearInfoPanelContent();
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
        await this.changeWLMode();
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
                    nodes.push({ id: object.nodes, label: object.label, graph: object.graph })
                    addedNodes.add(object.nodes);
                }

                object.edges.forEach((edge) => {
                    const source = edge[0];
                    const target = edge[1];
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
        try {
            await navigator.clipboard.writeText(await eel.eel_export_graphs()());
            this.statusInfo.textContent = 'Graphes copiés dans le presse-papiers.';
        } catch (error) {
            this.statusInfo.textContent = `Copie impossible : ${error.message || error}`;
        }
    }

    isHighlightedLink(link) {
        if (!this.hoveredPair) return false;
        const source = typeof link.source === 'object' ? link.source.id : link.source;
        const target = typeof link.target === 'object' ? link.target.id : link.target;
        const [u, v] = this.hoveredPair;
        return (source === u && target === v) || (source === v && target === u);
    }

    highlightPair(pair) {
        this.hoveredPair = pair;
        this.refreshNodeStyles();
    }

    clearInfoPanelContent() {
        this.infoPanelContent.textContent = "Select a node to see details.";
    }

    updateInfoPanelContent() {
        if (this.selectedNodeId !== null && this.wlIteration > 0) {
            const selected = this.currentGraphData.nodes.find(node => node.id === this.selectedNodeId);
            this.infoPanelContent.innerHTML = `<h3>Node: G${selected.graph + 1}:${selected.label}</h3>`;
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
        const label = node.id === undefined || node.id === null ? '' : `G${node.graph + 1}:${node.label ?? node.id}`;
        const radius = 6;
        const isSelected = node.id === this.selectedNodeId || Boolean(this.hoveredPair?.includes(node.id));
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
        this.graphInstance.linkColor(this.graphInstance.linkColor());
        this.graphInstance.linkWidth(this.graphInstance.linkWidth());
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