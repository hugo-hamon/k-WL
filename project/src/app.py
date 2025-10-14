from .utils.graph import generate_random_graph
from .utils.message import log_error
from .config import load_config
import logging
import eel


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
            log_error(f"Invalid graph size or density: {graph_size} or {graph_density}", self.logger)

        self.logger.info(f"Generating random graph with size {graph_size} and density {graph_density}")

        new_graph = generate_random_graph(graph_size, graph_density)
        self.graphs = [new_graph]
        
        self.logger.info("Graph generated successfully")

    def eel_get_graphs(self) -> list[str]:
        """Get the current graphs"""
        list_nodes = [list(graph.nodes()) for graph in self.graphs]
        list_edges = [list(graph.edges()) for graph in self.graphs]
        
        return [{"nodes": nodes, "edges": edges} for nodes, edges in zip(list_nodes, list_edges)]


    def expose_functions(self) -> None:
        """Expose functions to JavaScript"""
        functions = self.__dir__()
        for function in functions:
            if function.startswith("eel_"):
                eel.expose(getattr(self, function))
