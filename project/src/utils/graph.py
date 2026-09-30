import ast
from array import array
from collections import Counter

import networkx as nx


def generate_random_graph(graph_size: int, graph_density: float) -> nx.Graph:
    """Generate a random graph"""
    return nx.erdos_renyi_graph(graph_size, graph_density)


def wl_1_iterative(graph: nx.Graph, colors: dict[int, int]) -> dict[int, int]:
    """
    Implémentation de l'algorithme 1-WL. Nécessite de le faire tourner sur 
    tout les graphes en même temps (graphes non connexes).
    """
    # Make the new representations for each node based on its neighbors
    signatures_per_node = {}
    for node in graph.nodes():
        root_color = colors[node]
        neighbor_colors = sorted([colors[neighbor] for neighbor in graph.neighbors(node)])
        signatures_per_node[node] = (root_color, tuple(neighbor_colors))

    unique_signatures = sorted(list(set(signatures_per_node.values())))
    signature_to_new_color = {sig: idx for idx, sig in enumerate(unique_signatures)}
    new_colors = {node: signature_to_new_color[signatures_per_node[node]] for node in graph.nodes()}

    return new_colors


def parse_graphs(text: str) -> list[nx.Graph]:
    """Read edge/adjacency tuples; (s,) declares an isolated vertex.

    Separate lists (adjacent, newline-separated, or nested) remain separate graphs.
    """
    text = text.strip()
    try:
        value = ast.literal_eval(text)
        values = value if isinstance(value, (list, tuple)) and value and all(isinstance(g, list) for g in value) else [value]
    except (SyntaxError, ValueError):
        values, depth, start, consumed = [], 0, 0, 0
        for index, char in enumerate(text):
            if char == '[':
                if depth == 0:
                    if text[consumed:index].strip(' \n\r\t,'):
                        raise ValueError('Texte inattendu entre les graphes.')
                    start = index
                depth += 1
            elif char == ']':
                depth -= 1
                if depth < 0:
                    raise ValueError('Crochets non équilibrés.')
                if depth == 0:
                    try:
                        values.append(ast.literal_eval(text[start:index + 1]))
                    except (ValueError, SyntaxError) as error:
                        raise ValueError('Format attendu : [(0, 1), (1, 2, 3), (4,)].') from error
                    consumed = index + 1
        if depth or text[consumed:].strip(' \n\r\t,'):
            raise ValueError('Liste de graphes invalide.')
    if not values:
        raise ValueError('Saisissez au moins une liste de tuples.')
    graphs, used, next_id = [], set(), 0
    for rows in values:
        if not isinstance(rows, list):
            raise ValueError('Chaque graphe doit être une liste de tuples.')
        graph = nx.Graph()
        for row in rows:
            if not isinstance(row, tuple) or not row or any(type(n) is not int or abs(n) > 2**53 - 1 for n in row):
                raise ValueError('Chaque tuple doit contenir au moins un identifiant entier (précision JavaScript).')
            graph.add_node(row[0])
            graph.add_edges_from((row[0], neighbor) for neighbor in row[1:])
        mapping, reserved = {}, used | set(graph)
        for node in graph:
            if node in used:
                while next_id in reserved:
                    next_id += 1
                mapping[node] = next_id
                reserved.add(next_id)
                next_id += 1
            else:
                mapping[node] = node
        nx.set_node_attributes(graph, {node: node for node in graph}, 'label')
        graph = nx.relabel_nodes(graph, mapping)
        used.update(graph)
        graphs.append(graph)
    return graphs


MAX_FWL_PAIRS = 1_000_000
MAX_FWL_WORK = 8_000_000


class FWL2:
    """Symmetric pair refinement on one disjoint union.

    This project's convention sorts BOTH the two colors of each witness and
    the multiset of witnesses, preserving multiplicities:
    c'(u,v) = intern(c(u,v), multiset(sort(c(u,w), c(w,v)) for w in C(u))).
    This differs from the ordered-witness definition of 2-FWL. The computed
    colors themselves are symmetric; no display-only projection is used.
    All connected components share one signature dictionary each round, so
    equal colors across input graphs mean equal refinement signatures.
    Pairs across components have no color and are never allocated/computed.
    """

    def __init__(self, graphs):
        self.graphs = graphs
        self.nodes = [list(g) for g in graphs]
        if any(graph.is_directed() or graph.is_multigraph() for graph in graphs):
            raise ValueError('Le visualiseur attend des graphes simples non orientés.')
        # Namespace vertices before taking the union: repeated input IDs must
        # never merge vertices from different graphs, including direct API use.
        self.union = nx.Graph()
        for index, graph in enumerate(graphs):
            self.union.add_nodes_from((index, u) for u in graph)
            self.union.add_edges_from(((index, u), (index, v)) for u, v in graph.edges())
        self.components = [list(nodes) for nodes in nx.connected_components(self.union)]
        if sum(len(nodes)**2 for nodes in self.components) > MAX_FWL_PAIRS:
            raise ValueError('2-FWL limité à 1 000 000 de paires connexes au total. Réduisez les graphes.')
        self.locations = {u: (component, i) for component, nodes in enumerate(self.components) for i, u in enumerate(nodes)}
        self.colors = []
        intern = {}
        for nodes in self.components:
            matrix = []
            for u in nodes:
                row = []
                for v in nodes:
                    signature = (u == v, self.union.has_edge(u, v),
                                 tuple(sorted((self.union.has_edge(u, u), self.union.has_edge(v, v)))))
                    row.append(intern.setdefault(signature, len(intern)))
                matrix.append(row)
            self.colors.append(matrix)
        self.previous = None
        self.iteration = 0
        self.stable = False

    def step(self):
        if self.stable:
            return
        if sum(len(nodes)**3 for nodes in self.components) > MAX_FWL_WORK:
            raise ValueError('Itération 2-FWL trop coûteuse (plus de 8 millions de triplets connexes). La matrice initiale reste consultable ; réduisez les composantes pour itérer.')
        intern, result = {}, []
        old_count = len({c for matrix in self.colors for row in matrix for c in row})
        for matrix in self.colors:
            size = len(matrix)
            updated = []
            for u in range(size):
                row = []
                for v in range(size):
                    # Inner sorting removes endpoint order; outer sorting
                    # encodes a multiset (never a set: counts must be retained).
                    pairs = sorted(tuple(sorted((matrix[u][w], matrix[w][v])))
                                   for w in range(size))
                    signature = (matrix[u][v], array('I', (c for pair in pairs for c in pair)).tobytes())
                    row.append(intern.setdefault(signature, len(intern)))
                updated.append(row)
            result.append(updated)
        self.previous, self.colors = self.colors, result
        self.iteration += 1
        self.stable = len(intern) == old_count

    def summary(self):
        component_histograms = [Counter(c for row in matrix for c in row) for matrix in self.colors]
        histograms, graph_info = [], []
        for graph_index, nodes in enumerate(self.nodes):
            components = {self.locations[graph_index, u][0] for u in nodes}
            histogram = Counter()
            for component in components:
                histogram.update(component_histograms[component])
            histograms.append(histogram)
            graph_info.append({'size': len(nodes), 'classes': len(histogram),
                               'components': len(components), 'pairs': sum(histogram.values())})
        groups = []
        for index, histogram in enumerate(histograms):
            match = next((group for group in groups if histograms[group[0]] == histogram), None)
            if match is None:
                groups.append([index])
            else:
                match.append(index)
        return {'iteration': self.iteration, 'stable': self.stable, 'groups': groups, 'graphs': graph_info}

    def window(self, graph_index, row, column, size=24):
        if not 0 <= graph_index < len(self.graphs):
            raise ValueError('Graphe inconnu.')
        size = max(1, min(int(size), 40))
        nodes = self.nodes[graph_index]
        row, column = max(0, int(row)), max(0, int(column))
        rows, columns = nodes[row:row + size], nodes[column:column + size]
        graph = self.graphs[graph_index]
        def color(matrices, u, v):
            component_u, i = self.locations[graph_index, u]
            component_v, j = self.locations[graph_index, v]
            if component_u != component_v:
                return None
            matrix = matrices[component_u]
            return matrix[i][j]
        def cut(matrices):
            return [[color(matrices, u, v) for v in columns] for u in rows]
        return {'rows': [{'id': u, 'label': graph.nodes[u].get('label', u)} for u in rows],
                'columns': [{'id': v, 'label': graph.nodes[v].get('label', v)} for v in columns],
                'current': cut(self.colors),
                'previous': cut(self.previous) if self.previous is not None else None,
                'edges': [[graph.has_edge(u, v) for v in columns] for u in rows]}
