from .utils.graph import generate_random_graph, wl_1_iterative, parse_graphs, FWL2
from .utils.message import log_error
from .config import load_config
import networkx as nx
import logging
import eel
from gevent.threadpool import ThreadPool


class App:
    def __init__(self, config_path: str) -> None:
        self.config = load_config(config_path)
        self.logger = logging.getLogger(__name__)

        self.graphs = []
        self.fwl2 = None
        self.fwl_pool = ThreadPool(1)

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

    def eel_generate_random_graph(self, graph_size: str, graph_density: str):
        try:
            size, density = int(graph_size), float(graph_density)
            if not 0 <= size <= 10000 or not 0 <= density <= 1:
                raise ValueError("Taille attendue : 0 à 10 000 ; densité : 0 à 1.")
            self.graphs = [generate_random_graph(size, density)]
            self.fwl2 = None
            return {"ok": True}
        except (ValueError, TypeError) as error:
            return {"error": str(error)}

    def eel_load_graph_from_list(self, graph_list):
        try:
            text = graph_list if isinstance(graph_list, str) else "".join(graph_list)
            graphs = parse_graphs(text)
            self.graphs = graphs
            self.fwl2 = None
            return {"ok": True}
        except (ValueError, TypeError) as error:
            return {"error": str(error)}

    def eel_get_graph(self):
        return [{"nodes": node, "label": graph.nodes[node].get("label", node),
                 "graph": index, "edges": list(graph.edges(node))}
                for index, graph in enumerate(self.graphs) for node in graph]

    def eel_export_graphs(self):
        # Preserve graph boundaries and isolated vertices, using original labels.
        result = []
        for graph in self.graphs:
            label = lambda u: graph.nodes[u].get("label", u)
            rows = [(label(u), label(v)) for u, v in graph.edges()]
            rows.extend((label(u),) for u in graph if graph.degree(u) == 0)
            result.append(str(rows))
        return "\n".join(result)

    def eel_fwl2(self, advance=False):
        # Native worker keeps Eel's event loop responsive during cubic refinement.
        def calculate():
            if self.fwl2 is None:
                self.fwl2 = FWL2(self.graphs)
            if advance:
                self.fwl2.step()
            return self.fwl2.summary()
        try:
            return self.fwl_pool.spawn(calculate).get()
        except ValueError as error:
            return {"error": str(error)}

    def eel_fwl2_window(self, graph_index, row, column, size=24):
        try:
            if self.fwl2 is None:
                raise ValueError("Initialisez le 2-FWL avant de consulter sa matrice.")
            return self.fwl2.window(int(graph_index), row, column, size)
        except (ValueError, TypeError) as error:
            return {"error": str(error)}

    def eel_wl_1_iterative(self, colors: list[tuple[int, int]]):
        # convert list to dict as {node: color, node: color, ...}
        colors_dict = {color[0]: color[1] for color in colors}

        unique_graph = nx.Graph()
        
        # Keep the same node id as in G1
        for graph in self.graphs:
            for node in graph.nodes():
                unique_graph.add_node(node)
        for graph in self.graphs:
            for edge in graph.edges():
                unique_graph.add_edge(edge[0], edge[1])

        new_colors = wl_1_iterative(unique_graph, colors_dict)
        return new_colors

    def expose_functions(self) -> None:
        """Expose functions to JavaScript"""
        functions = self.__dir__()
        for function in functions:
            if function.startswith("eel_"):
                eel.expose(getattr(self, function))
