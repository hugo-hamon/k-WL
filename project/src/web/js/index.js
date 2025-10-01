

// Generate a random graph
function generate_random_graph() {
    const graph_size = document.getElementById('graph-size').value;
    const graph_density = document.getElementById('graph-density').value;
    eel.eel_generate_random_graph(graph_size, graph_density)();
}


// Listeners
document.getElementById('generate-btn').addEventListener('click', generate_random_graph);