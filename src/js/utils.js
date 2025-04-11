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

  function generateCombinations(start_index, current_tuple) {
    if (current_tuple.length === k) {
      result.push([...current_tuple].sort((a, b) => a - b));
      return;
    }

    for (let i = start_index; i < nodeIds.length; i++) {
      current_tuple.push(nodeIds[i]);
      generateCombinations(i + 1, current_tuple);
      current_tuple.pop();
    }
  }

  generateCombinations(0, []);
  return result;
}

export function tupleToId(tuple) {
  return [...tuple].sort((a, b) => a - b).join("_");
}

export function generateColorMap(uniqueLabels) {
  const colors = {};
  const randomSeed = 15;

  // This is a simple pseudo-random generator based on sine function
  const random = (seed) => {
    const x = Math.sin(seed) * 1000;
    return x - Math.floor(x);
  };

  uniqueLabels.forEach((label) => {
    let seed = label + randomSeed;
    let hue = Math.floor(random(seed) * 360);
    colors[label] = `hsl(${hue}, 70%, 60%)`;
  });

  return colors;
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
