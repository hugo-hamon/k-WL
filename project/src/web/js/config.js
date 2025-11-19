export const GRAPH_VISUALIZATION_CONFIG = {
  selectors: {
    generateButtonId: "generate-btn",
    graphSizeInputId: "graph-size",
    graphDensityInputId: "graph-density",
    statusInfoId: "status-info",
    networkContainerId: "graph-network",
    loadGraphButtonId: "load-graph-btn",
    edgeListInputId: "edge-list-input",
    saveGraphClipboardButtonId: "save-graph-clipboard-btn",
    toggleModeButtonId: "toggle-mode-btn",
    togglePhysicsButtonId: "toggle-physics-btn",
    infoPanelContentId: "info-content",
  },
  // Configuration spécifique au rendu 3D
  graph3d: {
    nodeColor:"rgb(137, 0, 201)",
    nodeSelectedColor: "#ff3333",
    nodeResolution: 16, // Qualité de la sphère
    nodeSize: 6,
    linkColor: "rgb(10, 10, 10)",
    linkWidth: 2.0,
    backgroundColor: "#ffffff"
  },
  graph2d: {
    backgroundColor: "#ffffff",
    nodeColor: "rgb(137, 0, 201)",
    nodeSelectedColor: "#ff3333",
    linkColor: "rgb(10, 10, 10)",
    linkWidth: 1,
  }
};