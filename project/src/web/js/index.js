

// Generate a random graph
async function generate_random_graph() {
    const graph_size = document.getElementById('graph-size').value;
    const graph_density = document.getElementById('graph-density').value;

    // Send request to Python backend to generate the graph
    await eel.eel_generate_random_graph(graph_size, graph_density)();

    // Retrieve the generated graph data
    const graph_data = await eel.eel_get_graphs()();
    console.log('Generated Graph Data:', graph_data);

}


// Listeners
document.getElementById('generate-btn').addEventListener('click', generate_random_graph);