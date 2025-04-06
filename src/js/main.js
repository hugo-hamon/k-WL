import * as Graph from "./graph.js";
import * as WLLogic from "./wl_logic.js";
import * as UI from "./ui.js";

// --- DOM Elements ---
const graphContainer = document.getElementById("graph-network");
const generateBtn = document.getElementById("generate-btn");
const iterateBtn = document.getElementById("iterate-btn");
const kInput = document.getElementById("k-value");
const statusInfo = document.getElementById("status-info");

const loadGraphBtn = document.getElementById("load-graph-btn");
const edgeListInput = document.getElementById("edge-list-input");

if (loadGraphBtn && edgeListInput) {
  loadGraphBtn.addEventListener("click", () => {
    const edgeList = edgeListInput.value;
    if (!edgeList.trim()) {
      UI.updateStatus("Edge list input is empty.", "error");
      return;
    }
    try {
      UI.updateStatus("Loading graph from list...", "busy");
      Graph.generateGraphFromEdgeList(edgeList);

      const k = parseInt(kInput.value, 10) || 1;
      const loadedGraphData = Graph.getGraphData();
      if (loadedGraphData.nodes.length > 0) {
        UI.updateStatus(
          `Initializing WL for k=${k} on loaded graph...`,
          "busy"
        );
        WLLogic.initializeWLState(
          k,
          loadedGraphData.nodes,
          loadedGraphData.edges,
          Graph.getNodeDegrees()
        );
        Graph.updateVisualization();
        UI.updateIterationDisplay();
        UI.clearInfoPanel();
        iterateBtn.disabled = false;
        UI.updateStatus("Graph loaded. Ready for iteration.");
      } else {
        UI.updateStatus("Failed to load graph or graph is empty.", "error");
        iterateBtn.disabled = true;
      }
    } catch (error) {
      console.error("Error loading graph from list:", error);
      UI.updateStatus("Error loading graph. Check console.", "error");
    }
  });
}

let network = null;

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  if (
    !graphContainer ||
    !generateBtn ||
    !iterateBtn ||
    !kInput ||
    !statusInfo
  ) {
    console.error("One or more essential DOM elements not found!");
    return;
  }

  network = Graph.setupNetwork(
    graphContainer,
    statusInfo,
    UI.handleNodeSelection,
    UI.handleNodeDeselection
  );

  if (!network) {
    UI.updateStatus("Network setup failed!", "error");
    console.error("Network initialization failed!");
    return;
  }

  function initializeVisualization() {
    UI.updateStatus("Generating graph...", "busy");
    Graph.generateRandomGraph();

    const k = parseInt(kInput.value, 10) || 1;
    UI.updateStatus(`Initializing WL for k=${k}...`, "busy");

    WLLogic.initializeWLState(
      k,
      Graph.getGraphData().nodes,
      Graph.getGraphData().edges,
      Graph.getNodeDegrees()
    );

    Graph.updateVisualization();
    UI.updateIterationDisplay();
    UI.clearInfoPanel();
    iterateBtn.disabled = false;
    UI.updateStatus("Ready");
  }

  // --- Event Listeners ---
  generateBtn.addEventListener("click", () => {
    initializeVisualization();
  });

  iterateBtn.addEventListener("click", () => {
    const wlState = WLLogic.getWLState();
    if (!wlState) {
      UI.updateStatus(
        "WL state not initialized. Generate graph first.",
        "error"
      );
      return;
    }

    if (wlState.converged) {
      UI.updateStatus(
        `Converged after ${wlState.iteration} iterations.`,
        "converged"
      );
      iterateBtn.disabled = true;
      return;
    }

    UI.updateStatus(`Running iteration ${wlState.iteration + 1}...`, "busy");
    iterateBtn.disabled = true;

    setTimeout(() => {
      let changed = false;
      if (wlState.k === 1) {
        changed = WLLogic.runWLIteration(network, null);
      } else if (wlState.k === 2) {
        changed = WLLogic.runWLIteration(null, Graph.getGraphData().nodes);
      }

      const updatedWlState = WLLogic.getWLState();

      if (updatedWlState.converged) {
        UI.updateStatus(
          `Converged after ${updatedWlState.iteration} iterations.`,
          "converged"
        );
        iterateBtn.disabled = true;
      } else {
        UI.updateStatus("Iteration complete. Ready.");
        iterateBtn.disabled = false;
      }

      Graph.updateVisualization();
      UI.updateIterationDisplay();
      UI.updateInfoPanelContent();
    }, 10);
  });

  kInput.addEventListener("change", () => {
    const k = parseInt(kInput.value, 10) || 1;
    const currentGraphData = Graph.getGraphData();

    if (currentGraphData.nodes.length > 0) {
      UI.updateStatus(`Switching to k=${k} and re-initializing...`, "busy");

      WLLogic.initializeWLState(
        k,
        currentGraphData.nodes,
        currentGraphData.edges,
        Graph.getNodeDegrees()
      );
      Graph.updateVisualization();
      UI.updateIterationDisplay();
      UI.clearInfoPanel();
      iterateBtn.disabled = false;
      UI.updateStatus(`Switched to k=${k}. Ready for iteration.`);
    } else {
      UI.updateStatus(`Switched to k=${k}. Generate graph first.`);
      iterateBtn.disabled = true;
    }
  });

  initializeVisualization();
});
