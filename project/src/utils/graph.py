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
