import { calculateNodeDegrees, generateColorMap } from "./utils.js";
import { getWLState } from "./wl_logic.js";

// --- Global State & Configuration ---
let network = null;
export let graphData = {
  nodes: new vis.DataSet(),
  edges: new vis.DataSet(),
};
let nodeDegrees = new Map();

const MAX_NODES = 8;
const EDGE_PROBABILITY = 0.3;

// --- Graph Generation & Drawing ---
export function generateRandomGraph() {
  console.log(
    `Generating random graph with up to ${MAX_NODES} nodes and edge probability ${EDGE_PROBABILITY}...`
  );

  graphData.nodes.clear();
  graphData.edges.clear();

  const numNodes = MAX_NODES;

  for (let i = 1; i <= numNodes; i++) {
    graphData.nodes.add({
      id: i,
      label: `${i}`,
      shape: "dot",
      size: 15,
      font: { size: 12, color: "#000000" },
      color: { background: "#D2E5FF", border: "#2B7CE9" },
    });
  }

  for (let i = 1; i <= numNodes; i++) {
    for (let j = i + 1; j <= numNodes; j++) {
      if (Math.random() < EDGE_PROBABILITY) {
        graphData.edges.add({
          from: i,
          to: j,
          width: 1.5,
        });
      }
    }
  }

  console.log(
    "Random graph data generated:",
    graphData.nodes.length,
    "nodes,",
    graphData.edges.length,
    "edges."
  );

  nodeDegrees = calculateNodeDegrees(graphData.nodes, graphData.edges);

  for (let i = 1; i <= MAX_NODES; i++) {
    if (nodeDegrees.get(i) === 0) {
      let randomNode = -1;
      while (randomNode === -1 || randomNode === i) {
        randomNode = Math.floor(Math.random() * MAX_NODES) + 1;
      }
      graphData.edges.add({
        from: i,
        to: randomNode,
        width: 1.5,
      });
      nodeDegrees.set(randomNode, nodeDegrees.get(randomNode) + 1);
      nodeDegrees.set(i, 1);
    }
  }

  if (network) {
    network.setData(graphData);
  }
}

export function generateGraphFromEdgeList(edgeListString) {
  console.log("Generating graph from edge list input...");

  // Clear old data
  graphData.nodes.clear();
  graphData.edges.clear();
  nodeDegrees.clear();

  const uniqueNodeIds = new Set();
  const edgesToAdd = [];
  const lines = edgeListString.trim().split("\n");
  let errorCount = 0;

  // 1. Parse input string
  let previous_graph_nodes = new Set();
  let current_graph_nodes = new Set();
  lines.forEach((line, index) => {
    line = line.trim();
    if (!line) return;

    if (line.includes("[")) {
      // Append current graph nodes to previous graph nodes
      previous_graph_nodes = previous_graph_nodes.union(current_graph_nodes);
      current_graph_nodes = new Set();

    }

    // Split [(u, v), (u, ), ...] to get pairs
    const pairs = line.match(/\((\d+),\s*(\d*)\)/g);
    if (pairs) {
      pairs.forEach((pair) => {
        const match = pair.match(/\((\d+),\s*(\d*)\)/);
        if (match) {
          const u = parseInt(match[1], 10) + previous_graph_nodes.size;
          const v = match[2] ? parseInt(match[2], 10) + previous_graph_nodes.size : null;

          current_graph_nodes.add(u);
          if (v !== null) {
            current_graph_nodes.add(v);
          }

          uniqueNodeIds.add(u);
          if (v !== null) {
            uniqueNodeIds.add(v);
            edgesToAdd.push({ from: u, to: v });
          } else {
            edgesToAdd.push({ from: u, to: null });
          }
        } else {
          console.warn(
            `Invalid format on line ${index + 1}: "${line}". Expected format: "(u, v)" or "(u, )". Skipping.`
          );
          errorCount++;
        }
      });
    } else {
      console.warn(
        `Invalid format on line ${index + 1}: "${line}". Expected format: "[(u, v), (u, ), ...]". Skipping.`
      );
      errorCount++;
    }
  });


  if (uniqueNodeIds.size === 0 && errorCount === lines.length) {
    console.error("No valid edges found in input.");
    return;
  }

  // 2. Add Nodes
  const sortedNodeIds = [...uniqueNodeIds].sort((a, b) => a - b);
  sortedNodeIds.forEach((nodeId) => {
    graphData.nodes.add({
      id: nodeId,
      label: `${nodeId}`,
      shape: "dot",
      size: 15,
      font: { size: 12, color: "#000000" },
      color: { background: "#D2E5FF", border: "#2B7CE9" },
    });
  });

  // 3. Add Edges
  graphData.edges.add(edgesToAdd);

  console.log(
    "Graph generated from input:",
    graphData.nodes.length,
    "nodes,",
    graphData.edges.length,
    "edges."
  );
  if (errorCount > 0) {
    console.warn(`${errorCount} lines were skipped due to invalid format.`);
  }

  // 4. Calculate node degrees
  nodeDegrees = calculateNodeDegrees(graphData.nodes, graphData.edges);
  console.log("Node degrees calculated:", nodeDegrees);

  // 5. Update the visualization if the network object already exists
  if (network) {
    network.setData(graphData);
    // Stabilize physics if enabled
    if (network.physics.options.enabled) {
      network.stabilize();
    } else {
      network.fit();
    }
  }
}

export function generateEdgeList(edges) {
  let new_edges = edges
    .map((edge) => {
      if (edge.to === undefined || edge.to === null) {
        return `(${edge.from}, )`;
      } else {
        return `(${edge.from}, ${edge.to})`;
      }
    })
    .reduce((acc, edge) => acc + edge + ", ", "[");

  if (new_edges.length > 1) {
    new_edges = new_edges.slice(0, -2) + "]";
  } else {
    new_edges = new_edges + "]";
  }
  return new_edges;
}

function updateNodeColorsFor2WL() {
  const wlState = getWLState();
  if (!wlState || wlState.k !== 2) return;

  const nodeImportance = new Map();
  graphData.nodes.getIds().forEach((id) => nodeImportance.set(id, 0));

  wlState.labels.forEach((label, tupleString) => {
    if ((tupleString.match(/_/g) || []).length === 1) {
      const [node1, node2] = tupleString.split("_").map(Number);
      nodeImportance.set(node1, (nodeImportance.get(node1) || 0) + 1);
      nodeImportance.set(node2, (nodeImportance.get(node2) || 0) + 1);
    }
  });

  const importanceValues = Array.from(nodeImportance.values());
  const minImportance = Math.min(...importanceValues);
  const maxImportance = Math.max(...importanceValues);

  const nodeUpdates = [];
  graphData.nodes.forEach((node) => {
    const importance = nodeImportance.get(node.id) || 0;
    const normalizedImportance =
      maxImportance > minImportance
        ? (importance - minImportance) / (maxImportance - minImportance)
        : 0.5;

    const r = Math.round(255 * (1 - normalizedImportance));
    const b = Math.round(255 * normalizedImportance);
    const color = `rgb(${r}, 100, ${b})`;

    nodeUpdates.push({
      id: node.id,
      color: { background: color, border: "#333333" },
      label: `${node.id}\nTuples: ${importance}`,
      size: 12 + normalizedImportance * 10,
    });
  });
  graphData.nodes.update(nodeUpdates);
}

export function updateVisualization() {
  const wlState = getWLState();
  if (!wlState) return;

  const nodeUpdates = [];

  if (wlState.k === 1) {
    const currentLabels = wlState.labels;
    console.log("Current labels:", currentLabels);
    const uniqueLabels = [...new Set(currentLabels.values())];
    const colorMap = generateColorMap(uniqueLabels);

    graphData.nodes.forEach((node) => {
      const labelValue = currentLabels.get(node.id);
      const color = colorMap[labelValue] || "#cccccc";
      nodeUpdates.push({
        id: node.id,
        color: { background: color, border: "#333333" },
        label: `${node.id}\nL:${labelValue}`,
        size: 15,
      });
    });
    graphData.nodes.update(nodeUpdates);
  } else if (wlState.k === 2) {
    updateNodeColorsFor2WL();
  }
}

export function highlightSelection(selectedNodeId) {
  if (!selectedNodeId || !network) return;
  const wlState = getWLState();
  const nodeUpdates = [];

  unhighlightAll();

  nodeUpdates.push({
    id: selectedNodeId,
    borderWidth: 3,
    color: { border: "red" },
    shadow: { enabled: true, color: "rgba(255,0,0,0.5)", size: 10 },
  });

  if (wlState && wlState.k === 1) {
    const neighbors = network.getConnectedNodes(selectedNodeId);
    neighbors.forEach((nid) => {
      nodeUpdates.push({
        id: nid,
        color: { border: "orange" },
        shadow: { enabled: true, color: "rgba(255,165,0,0.3)", size: 5 },
      });
    });
  }
  graphData.nodes.update(nodeUpdates);
}

export function unhighlightAll() {
  updateVisualization();

  const nodeUpdates = graphData.nodes.getIds().map((id) => ({
    id: id,
    borderWidth: 1,
    shadow: { enabled: false },
  }));
  if (nodeUpdates.length > 0) {
    graphData.nodes.update(nodeUpdates);
  }
}

// --- Initialization ---

export function setupNetwork(
  container,
  statusElement,
  selectHandler,
  deselectHandler
) {
  const options = {
    layout: {},
    physics: {
      enabled: true,
      stabilization: {
        iterations: 200,
        updateInterval: 25,
        fit: true,
      },
      barnesHut: {
        gravitationalConstant: -5000,
        centralGravity: 0.3,
        springLength: 120,
        springConstant: 0.05,
        damping: 0.09,
      },
      solver: "barnesHut",
    },
    interaction: {
      hover: true,
      navigationButtons: false,
      keyboard: true,
      tooltipDelay: 200,
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
    },
    edges: {
      width: 1.5,
      color: {
        color: "#cccccc",
        highlight: "#888888",
        hover: "#bbbbbb",
      },
      smooth: {
        enabled: true,
        type: "continuous",
      },
      arrows: { to: { enabled: false } },
    },
  };

  network = new vis.Network(container, graphData, options);
  console.log("Network object created:", network);

  network.on("stabilizationProgress", function (params) {
    statusElement.textContent = `Status: Stabilizing... ${Math.round(
      (params.iterations / params.total) * 100
    )}%`;
  });

  network.on("stabilizationIterationsDone", function () {
    statusElement.textContent = "Status: Ready";
    network.fit();
  });

  if (options.physics.enabled) {
    network.stabilize();
  } else {
    network.fit();
    statusElement.textContent = "Status: Ready";
  }

  network.on("selectNode", selectHandler);
  network.on("deselectNode", deselectHandler);

  return network;
}

export function getNetworkInstance() {
  return network;
}

export function getGraphData() {
  return graphData;
}

export function getNodeDegrees() {
  return nodeDegrees;
}
