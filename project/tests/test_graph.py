import unittest
from unittest.mock import patch

import networkx as nx
from project.src.utils.graph import FWL2, parse_graphs, wl_1_iterative
from project.src.app import App


class GraphTests(unittest.TestCase):
    def test_adjacency_edges_and_isolated_vertices(self):
        graph, = parse_graphs('[(0, 1, 2, 3), (3, 4), (8,), (0, 1)]')
        self.assertEqual(set(graph), {0, 1, 2, 3, 4, 8})
        self.assertEqual({frozenset(e) for e in graph.edges}, {frozenset(e) for e in [(0, 1), (0, 2), (0, 3), (3, 4)]})

    def test_separate_graphs_and_colliding_negative_ids(self):
        for text in ['[(-5, 0)]\n[(-5, 0, 2)]', '[(-5, 0)][(-5, 0, 2)]', '[[(-5, 0)], [(-5, 0, 2)]]', '[(-5, 0)], [(-5, 0, 2)]']:
            a, b = parse_graphs(text)
            self.assertTrue(set(a).isdisjoint(b))
            self.assertEqual(set(nx.get_node_attributes(b, 'label').values()), {-5, 0, 2})
            self.assertEqual(b.number_of_edges(), 2)

    def test_invalid_input_is_not_silently_ignored(self):
        for text in ['', '[(0,)] junk', '[(1,2)] [bad]', '[()]', '[(1,"a")]', '[(True,2)]', '[(1,2)', '[(1,2)]]', '[1, 2]', '[(9007199254740992,)]']:
            with self.subTest(text=text), self.assertRaises(ValueError):
                parse_graphs(text)
        self.assertEqual(len(parse_graphs('[]')[0]), 0)

    def test_no_cross_component_colors_and_joint_interning(self):
        state = FWL2(parse_graphs('[(0,1),(2,3),(4,)]\n[(0,1)]'))
        self.assertEqual(sum(len(c)**2 for c in state.components), 13)
        for _ in range(3):
            a, b = state.window(0, 0, 0), state.window(1, 0, 0)
            self.assertIsNone(a['current'][0][2])
            self.assertEqual(a['current'][0][:2], b['current'][0])
            self.assertEqual(a['current'][2][2:4], b['current'][0])
            state.step()
        self.assertTrue(state.stable)

    def test_reference_refinement_on_union(self):
        # Independent dictionary reference: only connected pairs exist.
        state = FWL2(parse_graphs('[(0,1,2),(1,2),(3,4)]\n[(0,1),(1,2),(2,3),(3,0)]'))
        union = state.union
        components = list(nx.connected_components(union))
        colors = {(u, v): (u == v, union.has_edge(u, v)) for comp in components for u in comp for v in comp}
        for _ in range(3):
            signatures = {(u, v): (colors[u, v], tuple(sorted(tuple(sorted((colors[u, w], colors[w, v]))) for w in comp))) for comp in components for u in comp for v in comp}
            intern = {}
            colors = {pair: intern.setdefault(sig, len(intern)) for pair, sig in signatures.items()}
            state.step()
            actual = {(u, v): state.colors[c][i][j] for c, nodes in enumerate(state.components) for i, u in enumerate(nodes) for j, v in enumerate(nodes)}
            pairs = list(colors)
            for p in pairs:
                for q in pairs:
                    self.assertEqual(colors[p] == colors[q], actual[p] == actual[q])

    def test_isomorphism_and_graph_order_invariance(self):
        a = nx.path_graph(5)
        b = nx.relabel_nodes(a, {i: 20 - i for i in a})
        c = nx.cycle_graph(range(30, 35))
        for graphs in ([a, b, c], [c, b, a]):
            state = FWL2(graphs)
            state.step()
            self.assertIn([0, 1] if graphs[0] is a else [1, 2], state.summary()['groups'])

    def test_2fwl_distinguishes_connected_regular_graphs(self):
        # Both 3-regular, but only the triangular prism has triangles.
        a = nx.circular_ladder_graph(3)
        b = nx.relabel_nodes(nx.complete_bipartite_graph(3, 3), lambda u: u + 10)
        union = nx.compose(a, b)
        self.assertEqual(len(set(wl_1_iterative(union, dict.fromkeys(union, 0)).values())), 1)
        state = FWL2([a, b])
        self.assertEqual(state.summary()['groups'], [[0, 1]])
        state.step()
        self.assertEqual(state.summary()['groups'], [[0], [1]])

    def test_limits_use_components_and_preserve_state(self):
        with patch('project.src.utils.graph.MAX_FWL_PAIRS', 5):
            with self.assertRaises(ValueError):
                FWL2([nx.path_graph(3)])
            state = FWL2([nx.empty_graph(5)])
        with patch('project.src.utils.graph.MAX_FWL_WORK', 4):
            before = state.colors
            with self.assertRaises(ValueError):
                state.step()
            self.assertIs(state.colors, before)
            self.assertEqual(state.iteration, 0)

    def test_bounded_windows_empty_and_loops(self):
        state = FWL2([nx.path_graph(100)])
        data = state.window(0, 95, 90, 500)
        self.assertEqual((len(data['current']), len(data['current'][0])), (5, 10))
        self.assertLessEqual(len(state.window(0, 0, 0, 500)['current']), 40)
        empty = FWL2([nx.Graph()]); empty.step()
        self.assertTrue(empty.stable)
        loop = FWL2(parse_graphs('[(0,0)]\n[(0,)]'))
        self.assertNotEqual(loop.colors[0][0][0], loop.colors[1][0][0])

    def test_eel_load_export_reset_and_validation(self):
        app = App('project/config/default.toml')
        try:
            self.assertEqual(app.eel_load_graph_from_list('[(0,1,2),(4,)]\n[(0,1)]'), {'ok': True})
            app.eel_fwl2(True)
            self.assertEqual(app.fwl2.iteration, 1)
            self.assertIn('error', app.eel_load_graph_from_list('[(1,)] rubbish'))
            self.assertEqual(len(app.graphs), 2)
            exported = app.eel_export_graphs()
            app.eel_load_graph_from_list(exported)
            self.assertIsNone(app.fwl2)
            self.assertEqual([len(g) for g in app.graphs], [4, 2])
            self.assertEqual(len({n['nodes'] for n in app.eel_get_graph()}), 6)
            self.assertIn('error', app.eel_generate_random_graph('bad', '0.5'))
        finally:
            app.fwl_pool.kill()


class FWLReferenceTests(unittest.TestCase):
    def test_repeated_ids_form_a_disjoint_union(self):
        a, b = nx.path_graph(5), nx.path_graph(5)
        state = FWL2([a, b])
        self.assertEqual(len(state.union), 10)
        for _ in range(4):
            self.assertEqual(state.window(0, 0, 0)['current'], state.window(1, 0, 0)['current'])
            self.assertEqual(state.summary()['groups'], [[0, 1]])
            state.step()
        self.assertEqual(list(a), list(b))  # Input graphs were not relabeled in place.

    def test_computed_colors_are_symmetric_and_displayed_unchanged(self):
        graphs = [nx.path_graph(4), nx.star_graph(4)]
        looped = nx.path_graph(4)
        looped.add_edge(0, 0)
        graphs.append(looped)
        state = FWL2(graphs)
        for _ in range(5):
            for matrix in state.colors:
                self.assertEqual(matrix, [list(row) for row in zip(*matrix)])
            for graph_index, graph in enumerate(graphs):
                data = state.window(graph_index, 0, 0)
                for i, u in enumerate(graph):
                    for j, v in enumerate(graph):
                        component, row = state.locations[graph_index, u]
                        column = state.locations[graph_index, v][1]
                        self.assertEqual(data['current'][i][j], state.colors[component][row][column])
                        if state.previous is not None:
                            self.assertEqual(data['previous'][i][j], state.previous[component][row][column])
            state.step()

    def test_cycle_vs_two_triangles(self):
        a, b = nx.cycle_graph(6), nx.disjoint_union(nx.cycle_graph(3), nx.cycle_graph(3))
        union = nx.disjoint_union(a, b)
        colors = dict.fromkeys(union, 0)
        for _ in range(3):
            colors = wl_1_iterative(union, colors)
            self.assertEqual(len(set(colors.values())), 1)
        state = FWL2([a, b]); state.step()
        self.assertEqual(state.summary()['groups'], [[0], [1]])
        self.assertIsNone(state.window(1, 0, 0)['current'][0][3])

    def test_shrikhande_and_rook_are_not_distinguished(self):
        # Classical non-isomorphic strongly regular graphs with parameters (16,6,2,2).
        shrikhande = nx.Graph()
        for x in range(4):
            for y in range(4):
                for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1)]:
                    shrikhande.add_edge(4*x+y, 4*((x+dx) % 4)+(y+dy) % 4)
        rook = nx.convert_node_labels_to_integers(nx.line_graph(nx.complete_bipartite_graph(4, 4)))
        self.assertFalse(nx.is_isomorphic(shrikhande, rook))
        state = FWL2([shrikhande, rook]); state.step()
        self.assertTrue(state.stable)
        self.assertEqual(state.summary()['groups'], [[0, 1]])
        self.assertEqual(state.summary()['graphs'][0]['classes'], 3)

    def test_against_color_relation_products_on_graph_atlas(self):
        # Independent reference: count length-two walks for every pair of color
        # relations: (A_a A_b + A_b A_a)[u,v] for a < b, and
        # (A_a A_a)[u,v] for a == b. No sorting of witness tuples here.
        for graph in nx.graph_atlas_g():
            if not 1 <= len(graph) <= 5 or not nx.is_connected(graph):
                continue
            state = FWL2([graph])
            nodes = list(graph)
            reference = [[0 if u == v else 1 if graph.has_edge(u, v) else 2 for v in nodes] for u in nodes]
            def partition(matrix):
                groups = {}
                for i, row in enumerate(matrix):
                    for j, color in enumerate(row):
                        groups.setdefault(color, set()).add((i, j))
                return {frozenset(pairs) for pairs in groups.values()}
            for _ in range(3):
                classes = sorted({c for row in reference for c in row})
                relations = {c: [[int(value == c) for value in row] for row in reference] for c in classes}
                signatures = []
                for u in range(len(nodes)):
                    row = []
                    for v in range(len(nodes)):
                        counts = tuple(
                            sum(relations[a][u][w] * relations[b][w][v]
                                + (relations[b][u][w] * relations[a][w][v] if a != b else 0)
                                for w in range(len(nodes)))
                            for a in classes for b in classes if a <= b)
                        row.append((reference[u][v], counts))
                    signatures.append(row)
                intern = {}
                reference = [[intern.setdefault(sig, len(intern)) for sig in row] for row in signatures]
                state.step()
                # Components may enumerate vertices differently; index via locations.
                actual = [[state.colors[state.locations[0,u][0]][state.locations[0,u][1]][state.locations[0,v][1]] for v in nodes] for u in nodes]
                self.assertEqual(partition(reference), partition(actual), f'Graph atlas edges: {list(graph.edges)}')


if __name__ == '__main__':
    unittest.main()
