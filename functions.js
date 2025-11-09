const endpoint = "https://query.wikidata.org/sparql";

// Automatically trigger the main query when the page loads
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("fetchBtn").click();
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

  const searchQuery = createProteinSearchQuery(raw, modeEl.value);
  fetchData(searchQuery, true, raw); // <-- searchValue passed here
});

// Run the main query when clicking "Run Query" button
document.getElementById("fetchBtn").addEventListener("click", () => {
  fetchData(main_query);   // fetch all proteins
  createSearchUI();        // show search input and button

  const resultsTable = document.getElementById("resultsTable");
  const displayMode = document.getElementById("displayMode").value;

  if (displayMode === "table") {
    document.querySelector("#resultsTable thead").style.display = "table-header-group";
    resultsTable.style.display = "table";
  } else {
    resultsTable.style.display = "none";
  }
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
async function fetchData(query, isSearch = false, searchValue = "") {
  const url = endpoint + "?query=" + encodeURIComponent(query);
  const response = await fetch(url, {
    headers: { 'Accept': 'application/sparql-results+json' }
  });

  const data = await response.json();
  const results = data.results.bindings || [];
  window.lastResults = results;

  let searchType = null;
  if (isSearch) {
    const modeEl = document.getElementById("searchMode");
    searchType = modeEl ? modeEl.value : null;
  }

  renderResults(results, searchType, searchValue);
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



// Build SPARQL query for searching proteins
function createProteinSearchQuery(name, mode) {
  name = escapeForSPARQL(name);

  if (mode === "name") {
    return `
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
    return `
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
    return `
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


function renderNetworkGraph(results, searchType = null, searchValue = null) {
  // Get or create chart container
  let chartDiv = document.getElementById("chart");
  if (!chartDiv) {
    chartDiv = document.createElement("div");
    chartDiv.id = "chart";
    document.body.appendChild(chartDiv);
  } else {
    chartDiv.innerHTML = ""; // clear previous chart
  }

  const width = window.innerWidth;
  const height = window.innerHeight - window.innerHeight / 4;

  // Prepare nodes and links
  const nodesMap = new Map();
  const links = [];
  results.forEach(d => {
    const proteinId = d.item?.value;
    const proteinLabel = d.itemLabel?.value || proteinId;
    const processId = d.biological_process?.value;
    const processLabel = d.biological_processLabel?.value || processId;

    if (proteinId && !nodesMap.has(proteinId)) nodesMap.set(proteinId, { id: proteinId, label: proteinLabel, type: "protein" });
    if (processId && !nodesMap.has(processId)) nodesMap.set(processId, { id: processId, label: processLabel, type: "process" });
    if (proteinId && processId) links.push({ source: proteinId, target: processId });
  });

  const nodes = Array.from(nodesMap.values());

  // SVG and group
  const svg = d3.select(chartDiv).append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("background", "#fcfcfcff");

  const g = svg.append("g");

  // Links
  const link = g.append("g")
    .attr("stroke", "#000000ff")
    .attr("stroke-opacity", 0.6)
    .selectAll("line").data(links).join("line")
    .attr("stroke-width", 2);

  // Nodes
const node = g.append("g")
  .attr("stroke", "#fff")
  .attr("stroke-width", 2)
  .selectAll("circle").data(nodes).join("circle")
  .attr("r", d => d.type === "protein" ? 25 : 18)
  .attr("fill", d => {
    if (searchType && searchValue) {
      const searchLower = searchValue.toLowerCase();
      const labelLower = d.label.toLowerCase();

      if (searchType === "process") {
        // User searched for process -> highlight related proteins
        if (d.type === "protein" && nodes.some(n => n.type === "process" && n.label.toLowerCase().includes(searchLower))) {
          return "#1f77b4"; // blue = related proteins
        } else {
          return "#ff7f0e"; // orange = other nodes
        }
      } else {
        // User searched for protein / UniProt -> highlight related processes
        if (d.type === "process" && nodes.some(n => n.type === "protein" && n.label.toLowerCase().includes(searchLower))) {
          return "#1f77b4"; // blue = related processes
        } else {
          return "#ff7f0e"; // orange = other nodes
        }
      }
    }

    // Default coloring if no search
    return d.type === "protein" ? "#1f77b4" : "#ff7f0e";
  })
  .call(d3.drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended)
  );

  node.append("title").text(d => d.label);

// Labels
const label = g.append("g").selectAll("text").data(nodes).join("text")
  .text(d => d.label)
  .attr("font-size", 16)
  .attr("font-family", "sans-serif")
  .attr("font-weight", "bold") // optional, makes it bold
  .attr("dx", 22)
  .attr("dy", "0.35em")
  .style("pointer-events", "none")
  .style("display", d => {
    if (searchType && searchValue) {
      if (searchType === "process") {
        return d.type === "process" ? "block" : "none"; 
      } else {
        return d.type === "protein" ? "block" : "none"; 
      }
    }
    return d.type === "process" ? "block" : "none";
  })
  .each(function(d) {
    d.labelElement = d3.select(this); // store reference to label
  });

// Hover for blue/highlighted nodes
node.on("mouseover", (event, d) => {
  if (d3.select(event.currentTarget).attr("fill") === "#1f77b4") {
    d.labelElement.style("display", "block"); // show label on hover
  }
}).on("mouseout", (event, d) => {
  if (d3.select(event.currentTarget).attr("fill") === "#1f77b4") {
    d.labelElement.style("display", "none"); // hide label after hover
  }
});

  // Simulation
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(250))
    .force("charge", d3.forceManyBody().strength(-1000))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .on("tick", () => {
      link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
          .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
      node.attr("cx", d => d.x).attr("cy", d => d.y);
      label.attr("x", d => d.x).attr("y", d => d.y);
    });

  // Drag functions
  function dragstarted(event, d) { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }
  function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
  function dragended(event, d) { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }

  // Zoom
  svg.call(d3.zoom().scaleExtent([0.1,5]).on("zoom", event => g.attr("transform", event.transform)));
  node.on("mousedown.zoom touchstart.zoom", event => event.stopPropagation());
}

// ---------- Master Render ----------
function renderResults(results, searchType = null, searchValue = null) {
  const displayMode = document.getElementById("displayMode").value;

  // First, remove/hide anything currently displayed
  const table = document.getElementById("resultsTable");
  const chart = document.getElementById("chart");
  const bubble = document.getElementById("bubble"); // if you have a bubble div

  if (table) table.style.display = "none";
  if (chart) chart.remove();
  if (bubble) bubble.remove();

  // Then render according to selected display mode
  if (displayMode === "table") renderTable(results);
  else if (displayMode === "graph") renderNetworkGraph(results, searchType, searchValue);
  else if (displayMode === "bubble") renderBubble(results);
}

// Automatically rerender or search when changing display mode
document.getElementById("displayMode").addEventListener("change", () => {
  const inputEl = document.getElementById("proteinInput");
  const modeEl = document.getElementById("searchMode");

  // If search input exists and has a value, trigger protein search
  if (inputEl && modeEl && inputEl.value.trim() !== "") {
    document.getElementById("SearchBtn").click(); // re-run search with current input
  } else if (window.lastResults) {
    // Otherwise just rerender the last fetched results
    renderResults(window.lastResults);
  }
});





