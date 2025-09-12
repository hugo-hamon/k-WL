import networkx as nx


def generate_random_graph(graph_size: int, graph_density: float) -> nx.Graph:
    """Generate a random graph"""
    return nx.erdos_renyi_graph(graph_size, graph_density)