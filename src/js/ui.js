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
  unhighlightAll();
}

// --- Getters ---
export function getSelectedNodeId() {
  return selectedNodeId;
}
