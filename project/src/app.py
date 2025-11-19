from .utils.graph import generate_random_graph
from .utils.message import log_error
from .config import load_config
import networkx as nx
import logging
import eel
import ast


class App:
    def __init__(self, config_path: str) -> None:
        self.config = load_config(config_path)
        self.logger = logging.getLogger(__name__)

        self.graphs = []

    def run(self):
        try:
            eel.init("src/web")
            self.expose_functions()
            eel.start(
                "index.html",
                mode="firefox",
                open_browser=self.config.eel.open_browser_on_start,
                cmdline_args=["--start-fullscreen"],
                shutdown_delay=3,
            )
        except Exception as e:
            log_error(
                f"Erreur lors de l'initialisation de l'application: {str(e)}",
                self.logger,
            )

    def eel_generate_random_graph(self, graph_size: str, graph_density: str) -> None:
        """Generate a random graph, and set it as the current / only graph"""
        try:
            graph_size = int(graph_size)
            graph_density = float(graph_density)
        except ValueError:
            log_error(
                f"Invalid graph size or density: {graph_size} or {graph_density}",
                self.logger,
            )

        self.logger.info(
            f"Generating random graph with size {graph_size} and density {graph_density}"
        )

        new_graph = generate_random_graph(graph_size, graph_density)
        self.graphs = [new_graph]

        self.logger.info("Graph generated successfully")

    def _extract_valid_lists(self, s: str) -> list[list[tuple[int, int]]]:
        stack = []
        results = []

        for i, ch in enumerate(s):
            if ch == "[":
                stack.append(i)
            elif ch == "]" and stack:
                start = stack.pop()
                block = s[start : i + 1]

                # Tester si c'est une liste valide Python et qu'il contient des tuples et qu'il n'est pas vide
                try:
                    if (
                        isinstance(ast.literal_eval(block), list)
                        and all(isinstance(item, tuple) for item in ast.literal_eval(block))
                        and len(ast.literal_eval(block)) > 0
                    ):
                        results.append(ast.literal_eval(block))
                except Exception as _:
                    print("One string is not a valid list")

        return results

    def eel_load_graph_from_list(self, graph_list: list[str]) -> None:
        """Load a graph from a list"""
        # Make a single string from the list
        string = "".join(graph_list)
        string = string.replace(" ", "").replace("\n", "")

        # Match all [(x,y), (x,y), ...] exactly
        graphs = self._extract_valid_lists(string)

        normalized_graphs = []
        max_value = 0
        for graph in graphs:
            current_min_value = min(min(node) for node in graph)
            if current_min_value < max_value:
                new_graph = []
                for node in graph:
                    new_node = (node[0] + max_value, node[1] + max_value)
                    new_graph.append(new_node)
                normalized_graphs.append(new_graph)
                max_value = max(max(node) for node in new_graph) + 1
            else:
                normalized_graphs.append(graph)
                max_value = max(max(node) for node in graph) + 1

        # Create NetworkX graphs
        self.graphs = [nx.Graph(graph) for graph in normalized_graphs]

    def eel_get_graph(self) -> dict:
        """Get the current graphs as a single list of nodes and edges"""
        list_nodes = [list(graph.nodes()) for graph in self.graphs]
        list_edges = [list(graph.edges()) for graph in self.graphs]

        # Merge nodes and edges into a single list
        merged_nodes = []
        merged_edges = []
        for nodes, edges in zip(list_nodes, list_edges):
            merged_nodes.extend(nodes)
            merged_edges.extend(edges)

        to_send = []
        for node in merged_nodes:
            edges = [edge for edge in merged_edges if edge[0] == node or edge[1] == node]
            to_send.append({"nodes": node, "edges": edges})

        return to_send

    def expose_functions(self) -> None:
        """Expose functions to JavaScript"""
        functions = self.__dir__()
        for function in functions:
            if function.startswith("eel_"):
                eel.expose(getattr(self, function))
