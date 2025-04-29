import * as Graph from "./graph.js";
import { generateColorMap, areNodesConnected } from "./utils.js";
import { getWLState, compute1WLSignature } from "./wl_logic.js";
import {
  getNetworkInstance,
  highlightSelection,
  unhighlightAll,
} from "./graph.js";

// --- DOM Elements ---
const infoContent = document.getElementById("info-content");
const iterationInfo = document.getElementById("iteration-info");
const statusInfo = document.getElementById("status-info");

let selectedNodeId = null;

// --- Info Panel ---

export function updateInfoPanelContent() {
  const wlState = getWLState();
  const network = getNetworkInstance();

  if (selectedNodeId === null || !wlState || !network) {
    const network = getNetworkInstance();
    if (!network) {
      clearInfoPanel();
      return;
    }
    if (selectedNodeId === null && wlState && wlState.k === 2) {
      // Display matrices when no node is selected and k=2
      let matrixHtml = "<h3>Adjacency Matrices (2-WL State)</h3>";

      const nodes = network.getPositions(); // Use getPositions to get all nodes in the network
      const nodeIds = Object.keys(nodes)
        .map(Number)
        .sort((a, b) => a - b);
      const numNodes = nodeIds.length;
      const graphData = Graph.getGraphData();
      const edgesDataSet = graphData.edges; // Access edges from the network data

      if (numNodes === 0) {
        matrixHtml += "<p>No nodes in the graph.</p>";
      } else {
        // Function to generate a single matrix HTML
        const generateMatrixHtml = (title, labels, isInitial) => {
          let html = `<h4 style="margin-top: 1em;">${title}</h4>`;
          html += `
            <div style="overflow-x: auto; max-width: 100%;">
              <table class="adjacency-matrix-table" style="
                border-collapse: collapse;
                font-family: monospace;
                font-size: 0.8em;
                border: 1px solid #ccc;
              ">
                <thead style="position: sticky; top: 0; background-color: #f5f5f5;">
                  <tr>
                    <th></th>
                    ${nodeIds.map(id => `<th style="padding: 4px; border: 1px solid #ccc; text-align: center;">${id}</th>`).join("")}
                  </tr>
                </thead>
                <tbody>
          `;
        
          nodeIds.forEach(rowId => {
            html += `<tr><th style="padding: 4px; border: 1px solid #ccc; background-color: #f0f0f0; text-align: center;">${rowId}</th>`;
            nodeIds.forEach(colId => {
              const tupleId = rowId < colId ? `${rowId}_${colId}` : `${colId}_${rowId}`;
              const isConnected = areNodesConnected(rowId, colId, edgesDataSet);
              let cellColor = "#ffffff";
        
              if (isInitial) {
                cellColor = labels.get(tupleId) ? "#cccccc" : "#ffffff";
              } else {
                const label = labels.get(tupleId);
                if (label !== undefined) {
                  const uniqueLabels = [...new Set(labels.values())];
                  const colorMap = generateColorMap(uniqueLabels);
                  cellColor = colorMap[label] || "#cccccc";
                }
              }
        
              html += `<td style="width: 24px; height: 24px; padding: 0; border: 1px solid #ccc; background-color: ${cellColor};"></td>`;
            });
            html += "</tr>";
          });
        
          html += "</tbody></table></div>";
          return html;
        };

        // Display initial state matrix if current iteration is 0
        if (wlState.iteration === 0) {
          const initialLabels = new Map();
          for (let i = 0; i < nodeIds.length; i++) {
            for (let j = i + 1; j < nodeIds.length; j++) {
              const id1 = nodeIds[i];
              const id2 = nodeIds[j];
              const tupleId = `${id1}_${id2}`;
              const isConnected = areNodesConnected(id1, id2, edgesDataSet);
              initialLabels.set(tupleId, isConnected ? 1 : 0);
            }
          }
          matrixHtml += generateMatrixHtml(
            "Initial State",
            initialLabels,
            true
          );
        } else {
          // Display previous iteration matrix
          if (wlState.history.length > 1) {
            // Need at least 2 entries for prev and current
            const prevLabels =
              wlState.history[wlState.history.length - 2].labels;
            matrixHtml += generateMatrixHtml(
              `Iteration ${wlState.iteration - 1}`,
              prevLabels,
              wlState.iteration === 1
            );
          }

          // Display current iteration matrix
          matrixHtml += generateMatrixHtml(
            `Iteration ${wlState.iteration}`,
            wlState.labels,
            false
          );
        }
      }

      infoContent.innerHTML = matrixHtml;
      return; // Exit the function after displaying matrices
    }

    // Original code for displaying node information when a node is selected
    clearInfoPanel();
    return;
  }

  const k = wlState.k;
  const currentIter = wlState.iteration;
  const history = wlState.history || [];
  const prevIter = currentIter - 1;

  let content = `<h3>Node ${selectedNodeId} (Iteration ${currentIter})</h3>`;

  if (k === 1) {
    const currentLabels = wlState.labels;
    const currentLabel = currentLabels.get(selectedNodeId);
    const signature =
      wlState.currentSignatures?.get(selectedNodeId) || "N/A (Initial State)";

    content += `<p><strong>Current WL Label:</strong> ${
      currentLabel ?? "N/A"
    }</p>`;

    if (prevIter >= 0 && history[prevIter]) {
      const prevLabels = history[prevIter].labels;
      const prevLabel = prevLabels.get(selectedNodeId);
      const recomputedPrevSignature = compute1WLSignature(
        selectedNodeId,
        prevLabels,
        network
      );

      content += `<hr><p><strong>Previous Iteration (${prevIter}):</strong></p>`;
      content += `<p> - Previous Label: ${prevLabel ?? "N/A"}</p>`;

      const neighbors = network.getConnectedNodes(selectedNodeId);
      const prevNeighborLabels = neighbors
        .map((nid) => prevLabels.get(nid))
        .sort((a, b) => a - b);
      content += `<p> - Prev. Neighbor Labels: [${prevNeighborLabels.join(
        ", "
      )}]</p>`;
      content += `<p> - Signature Computed: ${recomputedPrevSignature}</p>`;
    } else if (currentIter === 0) {
      const initialSignature = signature;
      content += `<p><strong>Initial Signature (Degree):</strong> ${initialSignature}</p>`;
    } else {
      content += `<p>(History not available for iteration ${prevIter})</p>`;
    }

    const neighbors = network.getConnectedNodes(selectedNodeId);
    content += `<hr><p><strong>Neighbors (${
      neighbors.length
    }):</strong> ${neighbors.join(", ")}</p>`;
  } else if (k === 2) {
    content += `<p><strong>Mode:</strong> 2-WL</p>`;

    const tuples2WL = Array.from(wlState.labels.keys()).filter((tupleId) => {
      if ((tupleId.match(/_/g) || []).length === 1) {
        const [node1, node2] = tupleId.split("_").map(Number);
        return node1 === selectedNodeId || node2 === selectedNodeId;
      }
      return false;
    });

    content += `<p>Node ${selectedNodeId} participates in ${tuples2WL.length} 2-tuples:</p>`;

    if (tuples2WL.length > 0) {
      console.log("2-WL selected");
      content += `<div style="max-height: 500px; overflow-y: auto;"><table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">`;
      content += `<tr><th>Tuple</th><th>Label (Iter ${currentIter})</th>`;
      if (
        wlState.currentSignatures &&
        wlState.currentSignatures.size > 0 &&
        currentIter > 0
      ) {
        content += `<th>Signature (from Iter ${prevIter})</th>`;
      } else if (currentIter === 0) {
        content += `<th>Initial Signature</th>`;
      }
      content += `</tr>`;

      tuples2WL.forEach((tupleId) => {
        const [node1, node2] = tupleId.split("_").map(Number);
        const otherNode = node1 === selectedNodeId ? node2 : node1;
        const label = wlState.labels.get(tupleId);
        let signature = "N/A";
        if (currentIter === 0) {
          signature = "N/A";
        } else if (wlState.currentSignatures) {
          signature = wlState.currentSignatures.get(tupleId) || "N/A";
        }

        content += `<tr>`;
        content += `<td style="border: 1px solid #ddd; padding: 4px;">(${selectedNodeId}, ${otherNode})</td>`;
        content += `<td style="border: 1px solid #ddd; padding: 4px;">${label}</td>`;
        if (
          currentIter === 0 ||
          (wlState.currentSignatures && wlState.currentSignatures.size > 0)
        ) {
          content += `<td style="border: 1px solid #ddd; padding: 4px; word-break: break-all;">${signature}</td>`;
        }

        content += `</tr>`;
      });

      content += `</table></div>`;
      content += `<p style="margin-top: 10px; font-style: italic; font-size: 0.85em;">2-WL refines tuple labels based on the labels of related tuples involving neighboring nodes.</p>`;
    } else {
      content +=
        "<p>No 2-tuples involving this node found in current state.</p>";
    }
  }

  infoContent.innerHTML = content;
}

export function clearInfoPanel() {
  infoContent.innerHTML = "Select a node to see details.";
}

// --- UI Updates ---

export function updateIterationDisplay() {
  const wlState = getWLState();
  iterationInfo.textContent = `Iteration: ${wlState ? wlState.iteration : 0}`;
}

export function updateStatus(message, statusType = "info") {
  if (!statusInfo) return;

  statusInfo.textContent = `Status: ${message}`;

  statusInfo.classList.remove(
    "status-converged",
    "status-error",
    "status-busy",
    "status-info"
  );

  switch (statusType) {
    case "converged":
      statusInfo.classList.add("status-converged");
      break;
    case "error":
      statusInfo.classList.add("status-error");
      break;
    case "busy":
      statusInfo.classList.add("status-busy");
      break;
    case "info":
    default:
      break;
  }
}

// --- Event Handlers ---

export function handleNodeSelection(params) {
  if (params.nodes.length > 0) {
    selectedNodeId = params.nodes[0];
    updateInfoPanelContent();
    highlightSelection(selectedNodeId);
  } else {
    handleNodeDeselection();
  }
}

export function handleNodeDeselection() {
  selectedNodeId = null;
  clearInfoPanel();
  updateInfoPanelContent();
  unhighlightAll();
}

// --- Getters ---
export function getSelectedNodeId() {
  return selectedNodeId;
}
