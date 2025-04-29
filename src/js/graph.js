import { calculateNodeDegrees, generateColorMap } from "./utils.js";
import { getWLState } from "./wl_logic.js";

// --- Global State & Configuration ---
let network = null;
export let graphData = {
  nodes: new vis.DataSet(),
  edges: new vis.DataSet(),
};
let nodeDegrees = new Map();

// --- Graph Generation & Drawing ---
export function generateRandomGraph(size, density = 0.3) {
  console.log(
    `Generating random graph with up to ${size} nodes and edge probability ${density}...`
  );

  graphData.nodes.clear();
  graphData.edges.clear();

  const numNodes = size;

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
      if (Math.random() < density) {
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

  // Uncomment the following lines to ensure at least one edge per node
  // nodeDegrees = calculateNodeDegrees(graphData.nodes, graphData.edges);

  // for (let i = 1; i <= size; i++) {
  //   if (nodeDegrees.get(i) === 0) {
  //     let randomNode = -1;
  //     while (randomNode === -1 || randomNode === i) {
  //       randomNode = Math.floor(Math.random() * size) + 1;
  //     }
  //     graphData.edges.add({
  //       from: i,
  //       to: randomNode,
  //       width: 1.5,
  //     });
  //     nodeDegrees.set(randomNode, nodeDegrees.get(randomNode) + 1);
  //     nodeDegrees.set(i, 1);
  //   }
  // }

  if (network) {
    network.setData(graphData);
  }
}

function isValidBracketBlock(block) {
  const tuplePattern = /^\(\d+,\s*(\d+)?\)$/;
  const inner = block.slice(1, -1).trim();
  if (inner === "") return true;

  const tuples = inner
    .split("),")
    .map((s, i, arr) => (i !== arr.length - 1 ? s + ")" : s.trim()));
  return tuples.every((tuple) => tuplePattern.test(tuple.trim()));
}

function extractBracketBlocks(flatInput) {
  const blocks = [];
  let depth = 0;
  let startIdx = -1;

  for (let i = 0; i < flatInput.length; i++) {
    if (flatInput[i] === "[") {
      if (depth === 0) startIdx = i;
      depth++;
    } else if (flatInput[i] === "]") {
      depth--;
      if (depth === 0 && startIdx !== -1) {
        blocks.push(flatInput.slice(startIdx, i + 1));
        startIdx = -1;
      }
    }
  }
  return blocks;
}

export function generateGraphFromEdgeList(edgeListString) {
  console.log("Generating graph from edge list input...");

  // Clear old data
  graphData.nodes.clear();
  graphData.edges.clear();
  nodeDegrees.clear();

  const uniqueNodeIds = new Set();
  const edgesToAdd = [];
  let errorCount = 0;

  const previous_graph_nodes = new Set();
  let current_graph_nodes = new Set();

  // 1. Normalize the input: flatten and remove line breaks, excess whitespace
  const flatInput = edgeListString.replace(/\s+/g, "");
  const blocks = extractBracketBlocks(flatInput);

  blocks.forEach((block, index) => {
    if (!isValidBracketBlock(block)) {
      console.warn(
        `Invalid format in block ${index + 1}: "${block}". Skipping.`
      );
      errorCount++;
      return;
    }

    previous_graph_nodes.forEach((n) => current_graph_nodes.add(n));
    const tupleMatches = [...block.matchAll(/\((\d+),(\d*)\)/g)];

    tupleMatches.forEach((match) => {
      const u = parseInt(match[1], 10) + previous_graph_nodes.size;
      const v = match[2]
        ? parseInt(match[2], 10) + previous_graph_nodes.size
        : null;

      current_graph_nodes.add(u);
      if (v !== null) current_graph_nodes.add(v);

      uniqueNodeIds.add(u);
      if (v !== null) {
        uniqueNodeIds.add(v);
        edgesToAdd.push({ from: u, to: v });
      }
    });

    // Push current to previous for next block
    for (const node of current_graph_nodes) {
      previous_graph_nodes.add(node);
    }
    current_graph_nodes.clear();
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
      if (edge.to === undefined && edge.to === null) {
        return `(${edge.from}, )`;
      } else {
        return `(${edge.from}, ${edge.to})`;
      }
    })
    .reduce((acc, edge) => acc + edge + ", ", "[");

  // For each node that has a degree of 0, add it to the list to the form (x, )
  nodeDegrees = calculateNodeDegrees(graphData.nodes, graphData.edges);
  nodeDegrees.forEach((degree, nodeId) => {
    if (degree === 0 && !new_edges.includes(`(${nodeId}, )`)) {
      new_edges += `(${nodeId}, ), `;
    }
  });

  if (new_edges.length > 1) {
    new_edges = new_edges.slice(0, -2) + "]";
  } else {
    new_edges += "]";
  }
  return new_edges;
}

function updateNodeColorsFor2WL() {
  const wlState = getWLState();
  if (!wlState || wlState.k !== 2) return;

  const nodeUpdates = [];
  graphData.nodes.forEach((node) => {
    const importance = 0.5;
    const color = `rgb(100, 100, 128)`;

    nodeUpdates.push({
      id: node.id,
      color: { background: color, border: "#333333" },
      label: `${node.id}`,
      size: 12 + importance * 10,
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
    console.log("Unique labels:", uniqueLabels);
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
        color: "#8f8f8f",
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
