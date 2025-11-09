const endpoint = "https://query.wikidata.org/sparql";

// Automatically trigger the main query when the page loads
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("fetchBtn").click();
});



// Query to fetch all human proteins and their biological processes
const main_query = `
      SELECT ?item ?uniprotid ?tax_node ?biological_process ?biological_processLabel ?itemLabel WHERE {
        ?item wdt:P352 ?uniprotid;
              wdt:P703 wd:Q15978631.
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
        OPTIONAL { ?item wdt:P682 ?biological_process. }
        ?item wdt:P31 wd:Q8054.
      }
      LIMIT 1000
    `;

// Create Query that finds all proteins that have a biological process with anatomical location "heart"
const heart_query = `
    SELECT ?protein ?proteinLabel ?uniprotID ?biologicalProcess ?biologicalProcessLabel WHERE {
        ?protein wdt:P31 wd:Q8054;
            wdt:P703 wd:Q15978631;
            wdt:P352 ?uniprotID;
            wdt:P682 ?biologicalProcess.
        ?biologicalProcess (wdt:P927*) wd:Q1072.
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 1000 
    `;
// Create Query that finds all proteins that have a biological process with anatomical location "brain"
const brain_query = `
    SELECT ?protein ?proteinLabel ?uniprotID ?biologicalProcess ?biologicalProcessLabel WHERE {
        ?protein wdt:P31 wd:Q8054;
            wdt:P703 wd:Q15978631;
            wdt:P352 ?uniprotID;
            wdt:P682 ?biologicalProcess.
        ?biologicalProcess (wdt:P927*) wd:Q1073.
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 1000
    `;




// Function to fetch data from Wikidata and populate the table
// 'isSearch' indicates whether this is a search for a single protein
// 'proteinName' is used for display at the top of search results
async function fetchData(query, isSearch = false, proteinName = "") {
  const url = endpoint + "?query=" + encodeURIComponent(query);
  const response = await fetch(url, {
    headers: { 'Accept': 'application/sparql-results+json' }
  });

  const data = await response.json();
  const results = data.results.bindings || [];
  window.lastResults = results;
  const tbody = document.querySelector("#resultsTable tbody");
  const resultsTable = document.getElementById("resultsTable");
  const displayMode = document.getElementById("displayMode").value;
}


// Render table format
function renderTable(results) {
  const table = document.getElementById("resultsTable");
  const tbody = table.querySelector("tbody");

  // Clear old chart if exists
  const oldChart = document.getElementById("chart");
  if (oldChart) oldChart.remove();

  table.style.display = "table";
  document.querySelector("#resultsTable thead").style.display = "table-header-group";

  tbody.innerHTML = ""; // clear previous results

  if (!results || results.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4">No results found.</td></tr>`;
    return;
  }

  results.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.itemLabel ? row.itemLabel.value : ""}</td>
      <td>${row.uniprotid ? row.uniprotid.value : ""}</td>
      <td>${row.biological_process ? `<a href="${row.biological_process.value}" target="_blank" rel="noopener">${row.biological_process.value}</a>` : ""}</td>
      <td>${row.biological_processLabel ? row.biological_processLabel.value : ""}</td>
    `;
    tbody.appendChild(tr);
  });
  window.lastTableHTML = tbody.innerHTML;
}





// Function to create the search input, dropdown, and show the search button
function createSearchUI() {
  // Prevent creating the UI twice
  if (document.getElementById("proteinInput")) return;

  // Create the protein input box
  const input = document.createElement("input");
  input.type = "text";
  input.id = "proteinInput";
  input.placeholder = "Enter protein name or ID";

  // Create dropdown for selecting search mode
  const select = document.createElement("select");
  select.id = "searchMode";

  const options = [
    { value: "name", label: "Search by Protein Name" },
    { value: "uniprot", label: "Search by UniProt ID" },
    { value: "process", label: "Search by Biological Process" }
  ];

  options.forEach(opt => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    select.appendChild(option);
  });

  // Show and position the Search button
  const searchBtn = document.getElementById("SearchBtn");
  searchBtn.style.display = "inline";

  // Insert the input and dropdown before the search button
  searchBtn.before(input);
  searchBtn.before(select);
}

// Escape user input to safely include in SPARQL query (security against injection)
function escapeForSPARQL(s) {
  if (!s) return "";
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
}

// Run the main query when clicking "Run Query" button
document.getElementById("fetchBtn").addEventListener("click", () => {
  fetchData(main_query);   // fetch all proteins
  createSearchUI();        // show search input and button
  if (document.getElementById("displayMode").value === "table") {
    document.querySelector("#resultsTable thead").style.display = "table-header-group";
    document.getElementById("resultsTable").style.display = "table";
  } else {
    document.getElementById("resultsTable").style.display = "none";
  }
});

// Run a protein search when clicking "Search Protein" button
document.getElementById("SearchBtn").addEventListener("click", () => {
  const inputEl = document.getElementById("proteinInput");
  const modeEl = document.getElementById("searchMode");

  if (!inputEl || !modeEl) {
    return alert('Please click "Refresh Query" first to show the search box.');
  }

  const raw = inputEl.value.trim();
  if (!raw) return alert("Please enter a protein name or ID!");

  const name = escapeForSPARQL(raw);
  const mode = modeEl.value;

  let search_query = "";

  if (mode === "name") {
    // Search by protein label
    search_query = `
            SELECT ?item ?uniprotid ?biological_process ?biological_processLabel ?itemLabel WHERE {
                ?item wdt:P31 wd:Q8054;
                    wdt:P703 wd:Q15978631.
                OPTIONAL { ?item wdt:P352 ?uniprotid. }
                OPTIONAL { ?item wdt:P682 ?biological_process. }
                ?item rdfs:label ?itemLabel .
                FILTER(LANG(?itemLabel) = "en")
                FILTER(CONTAINS(LCASE(STR(?itemLabel)), LCASE("${name}")))
                OPTIONAL {
                ?biological_process rdfs:label ?biological_processLabel .
                FILTER(LANG(?biological_processLabel) = "en")
                }
            }
            LIMIT 200
            `;
  } else if (mode === "uniprot") {
    // Search by UniProt ID
    search_query = `
            SELECT ?item ?uniprotid ?biological_process ?biological_processLabel ?itemLabel WHERE {
                ?item wdt:P352 "${name}";
                    wdt:P703 wd:Q15978631.
                OPTIONAL { ?item wdt:P352 ?uniprotid. }
                OPTIONAL { ?item wdt:P682 ?biological_process. }
                SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
            }
            LIMIT 50
            `;
  } else if (mode === "process") {
    // Search by biological process label
    search_query = `
            SELECT ?item ?uniprotid ?biological_process ?biological_processLabel ?itemLabel WHERE {
                ?item wdt:P31 wd:Q8054;
                    wdt:P703 wd:Q15978631;
                    wdt:P682 ?biological_process.
                OPTIONAL { ?item wdt:P352 ?uniprotid. }
                ?biological_process rdfs:label ?biological_processLabel .
                FILTER(LANG(?biological_processLabel) = "en")
                FILTER(CONTAINS(LCASE(STR(?biological_processLabel)), LCASE("${name}")))
                SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
            }
            LIMIT 200
            `;
  }

  fetchData(search_query, true, raw).then(() => {
    const displayMode = document.getElementById("displayMode").value;
    const resultsTable = document.getElementById("resultsTable");
    if (displayMode === "graph") {
      resultsTable.style.display = "none";
      const chartDivId = "chart";
      let chartDiv = document.getElementById(chartDivId);
      if (!chartDiv) {
        chartDiv = document.createElement("div");
        chartDiv.id = chartDivId;
        document.body.appendChild(chartDiv);
      }
      renderNetworkGraph(window.lastResults, chartDiv);
    } else if (displayMode === "table") {
      resultsTable.style.display = "table";
      document.querySelector("#resultsTable thead").style.display = "table-header-group";
    } else {
      resultsTable.style.display = "none";
    }
  });
});

function renderResults(results) {
  const displayMode = document.getElementById("displayMode").value;
  const table = document.getElementById("resultsTable");
  const tbody = table.querySelector("tbody");

  // Remove old chart if exists
  const oldChart = document.getElementById("chart");
  if (oldChart) oldChart.remove();

  // Clear table content
  tbody.innerHTML = "";
  table.style.display = "none";

  if (!results || results.length === 0) {
    table.style.display = "table";
    document.querySelector("#resultsTable thead").style.display = "table-header-group";
    tbody.innerHTML = `<tr><td colspan="4">No results found.</td></tr>`;
    return;
  }

  // Show/hide table based on display mode
  if (displayMode === "table") {
    resultsTable.style.display = "table";
    document.querySelector("#resultsTable thead").style.display = "table-header-group";
  } else {
    resultsTable.style.display = "none";
    if (displayMode === "bubble") {
      chartDiv.textContent = "Bubble chart placeholder";
    } else if (displayMode === "graph") {
      renderNetworkGraph(results, chartDiv);
    }
  }
  // Can add more here with the human body

  // Listen for display mode changes and re-render results if available
  document.getElementById("displayMode").addEventListener("change", () => {
    if (window.lastResults) {
      renderResults(window.lastResults);
    }
  });

}

// D3 Network Graph Script
function renderNetworkGraph(results, container) {
  // Clear previous content
  container.innerHTML = "";

  // Set larger dimensions
  const width = 1200;
  const height = 800;

  // Prepare nodes and links
  const nodesMap = new Map();
  const links = [];

  // Helper function to add node if not exists
  function addNode(id, label, type) {
    if (!nodesMap.has(id)) {
      nodesMap.set(id, { id, label, type });
    }
  }

  results.forEach(d => {
    const proteinId = d.item ? d.item.value : null;
    const proteinLabel = d.itemLabel ? d.itemLabel.value : proteinId;
    const processId = d.biological_process ? d.biological_process.value : null;
    const processLabel = d.biological_processLabel ? d.biological_processLabel.value : processId;

    if (proteinId) {
      addNode(proteinId, proteinLabel, "protein");
    }
    if (processId) {
      addNode(processId, processLabel, "process");
    }
    if (proteinId && processId) {
      links.push({ source: proteinId, target: processId });
    }
  });

  const nodes = Array.from(nodesMap.values());

  // Create SVG and <g> group for zoom target
  const svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("background", "#fff");

  // Create a group for all graph elements to apply zoom/pan transforms
  const g = svg.append("g");

  // Draw links
  const link = g.append("g")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke-width", 2);

  // Draw nodes
  const node = g.append("g")
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("r", d => d.type === "protein" ? 25 : 18)
    .attr("fill", d => d.type === "protein" ? "#1f77b4" : "#ff7f0e")
    // Node drag behavior is separate from canvas pan/zoom
    .call(
      d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
    );

  // Add labels
  // For process nodes (orange), show label always. For protein nodes (blue), hide label by default, show on hover.
  const label = g.append("g")
    .selectAll("text")
    .data(nodes)
    .join("text")
    .text(d => d.label)
    .attr("font-size", 16)
    .attr("font-family", "sans-serif")
    .attr("dx", 22)
    .attr("dy", "0.35em")
    .style("pointer-events", "none")
    .style("display", d => d.type === "process" ? "block" : "none");

  // Tooltip
  node.append("title")
    .text(d => d.label);

  // Show/hide protein node labels on hover
  node.on("mouseover", function (event, d) {
    if (d.type === "protein") {
      // Show only this protein node's label
      label.filter(l => l.id === d.id)
        .style("display", "block");
    }
  }).on("mouseout", function (event, d) {
    if (d.type === "protein") {
      // Hide this protein node's label
      label.filter(l => l.id === d.id)
        .style("display", "none");
    }
  });

  // Create simulation
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(250))
    .force("charge", d3.forceManyBody().strength(-1000))
    .force("center", d3.forceCenter(width / 2, height / 2));

  // Simulation tick
  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node
      .attr("cx", d => d.x)
      .attr("cy", d => d.y);

    label
      .attr("x", d => d.x)
      .attr("y", d => d.y);
  });

  // Dragging functions for nodes
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  // Zoom handler
  function zoomed(event) {
    g.attr("transform", event.transform);
  }

  // Apply zoom behavior to the SVG, targeting the <g> group, allowing both wheel and drag gestures for pan/zoom.
  // On Mac, this will allow two-finger pan and pinch zoom, as well as mouse wheel and drag background to pan.
  svg.call(
    d3.zoom()
      .scaleExtent([0.1, 5])
      .on("zoom", zoomed)
  );

  // Prevent node drag from propagating to zoom/pan (default d3.drag does this)
  // But to be sure, stop propagation on node mousedown/touchstart
  node.on("mousedown.zoom", event => event.stopPropagation())
    .on("touchstart.zoom", event => event.stopPropagation());
}

