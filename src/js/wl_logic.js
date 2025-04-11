import { tupleToId, areNodesConnected, generateKTuples } from "./utils.js";

export let wlState = null;

export function initializeWLState(k, nodesDataSet, edgesDataSet, nodeDegrees) {
  wlState = {
    k: k,
    iteration: 0,
    labels: new Map(),
    converged: false,
    history: [],
    currentSignatures: new Map(),
  };

  if (k === 1) {
    const initialDegreeLabels = new Map();
    nodesDataSet.forEach((node) => {
      initialDegreeLabels.set(node.id, 1);
    });
    console.log(
      "Initialized 1-WL. Initial labels (degrees):",
      initialDegreeLabels
    );

    const uniqueDegrees = [...new Set(initialDegreeLabels.values())].sort(
      (a, b) => a - b
    );
    const degreeToCompressedLabel = new Map();
    uniqueDegrees.forEach((degree, index) => {
      degreeToCompressedLabel.set(degree, index);
    });

    const initialCompressedLabels = new Map();
    initialDegreeLabels.forEach((degree, nodeId) => {
      initialCompressedLabels.set(nodeId, degreeToCompressedLabel.get(degree));
    });
    wlState.labels = initialCompressedLabels;
    console.log("Initial labels compressed to:", wlState.labels);
  } else if (k === 2) {
    const initialTupleSignatures = new Map();
    const tuples = generateKTuples(2, nodesDataSet);
    tuples.forEach((tuple) => {
      const tupleString = tupleToId(tuple);
      const isConnected = areNodesConnected(tuple[0], tuple[1], edgesDataSet);
      const degreeSignature = tuple
        .map((nodeId) => nodeDegrees.get(nodeId) || 0)
        .sort((a, b) => a - b)
        .join("-");
      const signature = `k2-degs:${degreeSignature}-conn:${
        isConnected ? 1 : 0
      }`;
      initialTupleSignatures.set(tupleString, signature);
    });
    console.log(
      `Initialized 2-WL. Computed ${initialTupleSignatures.size} initial signatures.`
    );

    const uniqueInitialSignatures = [
      ...new Set(initialTupleSignatures.values()),
    ].sort();
    const signatureToCompressedLabel = new Map();
    uniqueInitialSignatures.forEach((sig, index) => {
      signatureToCompressedLabel.set(sig, index);
    });

    const initialCompressedLabels = new Map();
    initialTupleSignatures.forEach((sig, tupleString) => {
      initialCompressedLabels.set(
        tupleString,
        signatureToCompressedLabel.get(sig)
      );
    });
    wlState.labels = initialCompressedLabels;
    console.log(
      `Initial signatures compressed to ${
        uniqueInitialSignatures.length
      } labels (0-${uniqueInitialSignatures.length - 1}):`,
      wlState.labels
    );
  } else {
    console.error(`k=${k} is not supported.`);
    return;
  }

  wlState.history.push({ labels: new Map(wlState.labels), iteration: 0 });
}

export function compute1WLSignature(nodeId, currentLabels, networkInstance) {
  if (!networkInstance) {
    console.error("Network instance needed for compute1WLSignature");
    return "ERROR";
  }
  const neighbors = networkInstance.getConnectedNodes(nodeId);
  const neighborLabels = neighbors
    .map((neighborId) => currentLabels.get(neighborId))
    .filter((label) => label !== undefined)
    .sort((a, b) => a - b);

  const currentNodeLabel = currentLabels.get(nodeId);
  const signature = `${currentNodeLabel}|${neighborLabels.join(",")}`;
  return signature;
}

function run1WLIteration(networkInstance) {
  const currentLabels = wlState.labels;
  const signaturesThisIteration = new Map();
  let changed = false;

  console.log(`--- Début Itération ${wlState.iteration + 1} (1-WL) ---`);

  const nodeIds = Array.from(currentLabels.keys());
  nodeIds.forEach((nodeId) => {
    if (typeof nodeId === "number") {
      const signature = compute1WLSignature(
        nodeId,
        currentLabels,
        networkInstance
      );
      signaturesThisIteration.set(nodeId, signature);
    }
  });

  wlState.currentSignatures = new Map(signaturesThisIteration);

  const uniqueSignatures = [
    ...new Set(signaturesThisIteration.values()),
  ].sort();
  const signatureToNewLabelMap = new Map();
  uniqueSignatures.forEach((sig, index) => {
    signatureToNewLabelMap.set(sig, index);
  });

  const newLabels = new Map();
  signaturesThisIteration.forEach((sig, nodeId) => {
    newLabels.set(nodeId, signatureToNewLabelMap.get(sig));
  });

  nodeIds.forEach((nodeId) => {
    if (
      !currentLabels.has(nodeId) ||
      !newLabels.has(nodeId) ||
      newLabels.get(nodeId) !== currentLabels.get(nodeId)
    ) {
      changed = true;
    }
  });
  if (currentLabels.size !== newLabels.size) changed = true;

  console.log(
    `--- Fin Itération ${wlState.iteration + 1}. Changé: ${changed}. ${
      uniqueSignatures.length
    } signatures uniques mappées aux labels 0 à ${
      uniqueSignatures.length - 1
    }. ---`
  );

  if (!changed) {
    wlState.converged = true;
    console.log(
      `>>>>>> 1-WL CONVERGENCE DETECTEE à l'itération ${
        wlState.iteration + 1
      } <<<<<<`
    );
  } else {
    wlState.iteration++;
    wlState.labels = newLabels;
    wlState.history.push({
      labels: new Map(wlState.labels),
      iteration: wlState.iteration,
    });
  }
  return changed;
}

function get2TuplesFromLabels() {
  const tuples = [];
  wlState.labels.forEach((label, key) => {
    if (typeof key === "string" && (key.match(/_/g) || []).length === 1) {
      tuples.push(key);
    }
  });
  return tuples;
}

function compute2WLSignature(tuple, currentLabels, allNodeIds) {
  const tupleId = tupleToId(tuple);
  const [u, v] = tuple;
  const currentTupleLabel = currentLabels.get(tupleId);

  const multisetU = [];
  const multisetV = [];

  allNodeIds.forEach((w) => {
    if (w !== u && w !== v) {
      const uwTuple = [u, w].sort((a, b) => a - b);
      const uwTupleId = tupleToId(uwTuple);
      const uwLabel = currentLabels.get(uwTupleId);
      if (uwLabel !== undefined) {
        multisetU.push(uwLabel);
      }

      const vwTuple = [v, w].sort((a, b) => a - b);
      const vwTupleId = tupleToId(vwTuple);
      const vwLabel = currentLabels.get(vwTupleId);
      if (vwLabel !== undefined) {
        multisetV.push(vwLabel);
      }
    }
  });

  multisetU.sort((a, b) => a - b);
  multisetV.sort((a, b) => a - b);

  const signature = `${currentTupleLabel}|${multisetU.join(
    ","
  )}|${multisetV.join(",")}`;
  return signature;
}

function getTupleKeysFromLabels() {
  const tupleKeys = [];
  if (wlState && wlState.labels) {
    for (const key of wlState.labels.keys()) {
      if (typeof key === "string" && key.includes("_")) {
        tupleKeys.push(key);
      }
    }
  }
  return tupleKeys;
}

function run2WLIteration(nodesDataSet) {
  const currentLabels = wlState.labels;
  const signaturesThisIteration = new Map();
  let changed = false;
  const allNodeIds = nodesDataSet.getIds();
  const currentTupleIds = getTupleKeysFromLabels();

  console.log(`--- Début Itération ${wlState.iteration + 1} (2-WL) ---`);

  currentTupleIds.forEach((tupleId) => {
    const tuple = tupleId.split("_").map(Number);
    const signature = compute2WLSignature(tuple, currentLabels, allNodeIds);
    signaturesThisIteration.set(tupleId, signature);
  });

  wlState.currentSignatures = new Map(signaturesThisIteration);

  const uniqueSignatures = [
    ...new Set(signaturesThisIteration.values()),
  ].sort();
  const signatureToNewLabelMap = new Map();
  uniqueSignatures.forEach((sig, index) => {
    signatureToNewLabelMap.set(sig, index);
  });

  const newLabels = new Map();
  signaturesThisIteration.forEach((sig, tupleId) => {
    newLabels.set(tupleId, signatureToNewLabelMap.get(sig));
  });

  changed = false;
  currentTupleIds.forEach((tupleId) => {
    if (
      !newLabels.has(tupleId) ||
      newLabels.get(tupleId) !== currentLabels.get(tupleId)
    ) {
      changed = true;
    }
  });
  if (!changed && currentTupleIds.length !== newLabels.size) {
    changed = true;
  }

  console.log(
    `--- Fin Itération ${wlState.iteration + 1}. Changé: ${changed}. ${
      uniqueSignatures.length
    } signatures uniques mappées aux labels 0 à ${
      uniqueSignatures.length - 1
    }. ---`
  );

  if (!changed) {
    wlState.converged = true;
    console.log(
      `>>>>>> 2-WL CONVERGENCE DETECTEE à l'itération ${
        wlState.iteration + 1
      } <<<<<<`
    );
  } else {
    wlState.iteration++;
    wlState.labels = newLabels;
    wlState.history.push({
      labels: new Map(wlState.labels),
      iteration: wlState.iteration,
    });
  }
  return changed;
}

export function runWLIteration(networkInstance, nodesDataSet) {
  if (!wlState || wlState.converged) {
    console.log("WL algorithm not initialized or already converged.");
    return false;
  }

  let changed = false;
  if (wlState.k === 1) {
    if (!networkInstance) {
      console.error("runWLIteration: networkInstance manquant pour k=1");
      return false;
    }
    changed = run1WLIteration(networkInstance);
  } else if (wlState.k === 2) {
    if (!nodesDataSet) {
      console.error("runWLIteration: nodesDataSet manquant pour k=2");
      return false;
    }
    changed = run2WLIteration(nodesDataSet);
  } else {
    console.error(`k=${wlState.k} is not supported.`);
    wlState.converged = true;
    return false;
  }

  return changed;
}

export function getWLState() {
  return wlState;
}
