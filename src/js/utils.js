export function calculateNodeDegrees(nodesDataSet, edgesDataSet) {
  const degrees = new Map();
  nodesDataSet.forEach((node) => degrees.set(node.id, 0));
  edgesDataSet.forEach((edge) => {
    degrees.set(edge.from, (degrees.get(edge.from) || 0) + 1);
    degrees.set(edge.to, (degrees.get(edge.to) || 0) + 1);
  });
  return degrees;
}

export function generateKTuples(k, nodesDataSet) {
  const nodeIds = nodesDataSet.getIds();
  const result = [];

  if (k <= 0 || k > nodeIds.length) {
    return result;
  }

  const generateTuples = (currentTuple, startIndex) => {
    if (currentTuple.length === k) {
      result.push([...currentTuple]);
      return;
    }

    for (let i = startIndex; i < nodeIds.length; i++) {
      currentTuple.push(nodeIds[i]);
      generateTuples(currentTuple, i);
      currentTuple.pop();
    }
  };

  generateTuples([], 0);
  return result;
}

export function tupleToId(tuple) {
  return [...tuple].sort((a, b) => a - b).join("_");
}

export function generateColorMap(uniqueLabels) {
  const colorMap = {};
  const pastelBase = 220;
  const step = 360 / uniqueLabels.length;

  uniqueLabels.sort().forEach((label, i) => {
    const hue = (pastelBase + i * step) % 360;
    colorMap[label] = `hsl(${hue}, 80%, 70%)`;
  });

  return colorMap;
}

export function areNodesConnected(nodeId1, nodeId2, edgesDataSet) {
  const edges = edgesDataSet.get({
    filter: (edge) => {
      return (
        (edge.from === nodeId1 && edge.to === nodeId2) ||
        (edge.from === nodeId2 && edge.to === nodeId1)
      );
    },
  });
  return edges.length > 0;
}
