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
    togglePhysicsButtonId: "toggle-physics-btn",
    infoPanelContentId: "info-content",
  },
  nodes: {
    shape: "dot",
    size: 15,
    font: {
      size: 12,
      color: "#000000",
      face: "Arial",
    },
    borderWidth: 1,
    color: {
      background: "#D2E5FF",
      border: "#2B7CE9",
    },
  },
  edges: {
    width: 1.5,
    color: {
      color: "#8f8f8f",
      highlight: "#888888",
      hover: "#bbbbbb",
    },
    smooth: {
      enabled: true,
      type: "continuous",
      roundness: 0.5,
    },
    arrows: {
      to: { enabled: false },
    },
  },
  network: {
    layout: {},
    physics: {
      enabled: true,
      stabilization: {
        iterations: 200,
        updateInterval: 100,
        fit: true,
      },
      barnesHut: {
        gravitationalConstant: -5000,
        centralGravity: 0.3,
        springLength: 120,
        springConstant: 0.05,
        damping: 0.5,
      },
      solver: "barnesHut",
    },
    interaction: {
      hover: true,
      navigationButtons: false,
      keyboard: false,
      tooltipDelay: 200,
    },
  },
};

