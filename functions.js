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

        if (searchType === "process") {
            // User searched for a process → proteins related to it are blue
            return d.type === "protein" &&
                   nodes.some(n => n.type === "process" && n.label.toLowerCase().includes(searchLower))
                   ? "#1f77b4"
                   : "#ff7f0e";
        } else if (searchType === "protein" || searchType === "uniprot") {
            // User searched for a protein or UniProt → processes related to it are blue
            return d.type === "process" &&
                   nodes.some(n => n.type === "protein" &&
                                   (n.label.toLowerCase().includes(searchLower) ||
                                    (n.id && n.id.toLowerCase().includes(searchLower))))
                   ? "#1f77b4"
                   : "#ff7f0e";
        }
    }

    // Default coloring
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
  .attr("font-weight", "bold")
  .attr("dx", 22)
  .attr("dy", "0.35em")
  .style("pointer-events", "none")
  .style("display", d => {
    if (searchType && searchValue) {
      const searchLower = searchValue.toLowerCase();
      // Always show labels for nodes that match the search
      if (d.label.toLowerCase().includes(searchLower) || 
          (d.id && d.id.toLowerCase().includes(searchLower))) {
        return "block";
      }
    }
    return "none"; // hide by default
  })
  .each(function(d) {
    d.labelElement = d3.select(this);
  });

// Hover logic
node.on("mouseover", (event, d) => {
  d.labelElement.style("display", "block"); // show label on hover
}).on("mouseout", (event, d) => {
  // Hide only if it doesn't match the search
  const searchLower = searchValue ? searchValue.toLowerCase() : "";
  if (!d.label.toLowerCase().includes(searchLower) &&
      !(d.id && d.id.toLowerCase().includes(searchLower))) {
    d.labelElement.style("display", "none");
  }
});

  // Simulation
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(250))
    .force("charge", d3.forceManyBody().strength(-2000))
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
  svg.call(d3.zoom().scaleExtent([0.1, 5]).on("zoom", event => g.attr("transform", event.transform)));
  node.on("mousedown.zoom touchstart.zoom", event => event.stopPropagation());
}

// Lightweight helper to run a SPARQL query and return bindings (does not re-render UI)
async function fetchSparql(query) {
    const url = endpoint + "?query=" + encodeURIComponent(query);
    const resp = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } });
    if (!resp.ok) throw new Error(`SPARQL error: ${resp.status}`);
    const data = await resp.json();
    return data.results?.bindings || [];
}

// Simple cache to avoid repeated organ queries
const organCache = {};

// Human body renderer with hover-to-load-organ-details
function renderHuman(results) {
    let chartDiv = document.getElementById("chart");
    if (!chartDiv) {
        chartDiv = document.createElement("div");
        chartDiv.id = "chart";
        document.body.appendChild(chartDiv);
    } else {
        chartDiv.innerHTML = "";
    }

    const width = Math.min(window.innerWidth, 600);
    const height = Math.min(window.innerHeight - 200, 900);

    // Instruction / placeholder when no data is passed
    const header = document.createElement("div");
    header.style.padding = "10px 14px";
    header.style.fontFamily = "sans-serif";
    header.style.color = "#333";
    header.innerHTML = `<strong>Human body view</strong> — click an organ to load related proteins (from Wikidata).`;
    chartDiv.appendChild(header);

    // Create a content row so we can place the SVG and a right-side panel next to each other
    const contentRow = document.createElement("div");
    contentRow.style.display = "flex";
    contentRow.style.alignItems = "flex-start";
    contentRow.style.gap = "12px";
    contentRow.style.padding = "8px 14px";
    chartDiv.appendChild(contentRow);

    // SVG (left)
    const svg = d3.select(contentRow)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("background", "#ffffff");

    // Body image as background (place file at assets/body.png or adjust path)
    const bodyImgPath = "assets/body.png";
    svg.append("image")
        .attr("href", bodyImgPath)
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", width)
        .attr("height", height)
        .attr("preserveAspectRatio", "xMidYMid meet");

    // Right-side panel (hidden until an organ is clicked)
    const sidePanel = document.createElement("div");
    sidePanel.id = "organ-sidepanel";
    sidePanel.style.width = "360px";
    sidePanel.style.maxHeight = `${height}px`;
    sidePanel.style.overflow = "auto";
    sidePanel.style.borderLeft = "1px solid #e6e6e6";
    sidePanel.style.padding = "10px 12px";
    sidePanel.style.fontFamily = "sans-serif";
    sidePanel.style.background = "#ffffff";
    sidePanel.style.display = "none"; // shown when clicking an organ
    sidePanel.style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)";
    contentRow.appendChild(sidePanel);

    // small "no selection" placeholder inside sidePanel
    sidePanel.innerHTML = `<div style="color:#666;font-size:14px">Click an organ to view related proteins.</div>`;

    const organs = [
        { id: "brain", label: "Brain", xPct: 0.50, yPct: 0.07, rPct: 0.03, query: brain_query },
        { id: "heart", label: "Heart", xPct: 0.50, yPct: 0.44, rPct: 0.025, query: heart_query },
        // add more organs using percentage coords, e.g.
    ];

    // Draw organ overlays (small semi-transparent circles on top of the image)
    const organGroup = svg.append("g").attr("class", "organs");
    const base = Math.min(width, height);
    organs.forEach(o => {
        const cx = Math.round(o.xPct * width);
        const cy = Math.round(o.yPct * height);
        const r = Math.round(o.rPct * base);

        // visible semi-transparent circle
        organGroup.append("circle")
            .attr("cx", cx)
            .attr("cy", cy)
            .attr("r", r)
            .attr("fill", "#ff7f0e")
            .attr("fill-opacity", 0.24)
            .attr("stroke", "#ff7f0e")
            .attr("stroke-opacity", 0.7)
            .attr("stroke-width", 1.2)
            .attr("data-organ", o.id)
            .style("cursor", "pointer");

        // slightly larger, fully transparent hit area for easier clicking
        organGroup.append("circle")
            .attr("cx", cx)
            .attr("cy", cy)
            .attr("r", Math.round(r * 1.6))
            .attr("fill", "transparent")
            .attr("data-organ", o.id)
            .style("cursor", "pointer");

        // small label under the overlay
        svg.append("text")
            .attr("x", cx)
            .attr("y", cy + r + 14)
            .attr("text-anchor", "middle")
            .attr("font-size", 12)
            .attr("fill", "#666")
            .text(o.label);
    });

    // Helper to render results into the right-side panel as a scrollable table
    function showSidePanelForOrgan(organDef, rows) {
        // build header with close button
        sidePanel.innerHTML = "";
        const hdr = document.createElement("div");
        hdr.style.display = "flex";
        hdr.style.justifyContent = "space-between";
        hdr.style.alignItems = "center";
        hdr.style.marginBottom = "8px";

        const title = document.createElement("div");
        title.innerHTML = `<strong>${organDef.label}</strong> — ${rows.length} result${rows.length !== 1 ? "s" : ""}`;
        hdr.appendChild(title);

        const closeBtn = document.createElement("button");
        closeBtn.textContent = "Close";
        closeBtn.style.border = "none";
        closeBtn.style.background = "#eee";
        closeBtn.style.padding = "4px 8px";
        closeBtn.style.borderRadius = "4px";
        closeBtn.style.cursor = "pointer";
        closeBtn.onclick = () => { sidePanel.style.display = "none"; };
        hdr.appendChild(closeBtn);

        sidePanel.appendChild(hdr);

        // build table
        const table = document.createElement("table");
        table.style.width = "100%";
        table.style.borderCollapse = "collapse";
        table.style.fontSize = "13px";

        const thead = document.createElement("thead");
        thead.innerHTML = `<tr>
            <th style="text-align:left;padding:6px 4px;border-bottom:1px solid #eee">Protein</th>
            <th style="text-align:left;padding:6px 4px;border-bottom:1px solid #eee">UniProt</th>
        </tr>`;
        table.appendChild(thead);

        const tbody = document.createElement("tbody");

        // limit but allow scroll for full results
        rows.forEach(r => {
            const tr = document.createElement("tr");
            const proteinLabel = r.proteinLabel?.value || r.itemLabel?.value || r.item?.value || "Unnamed";
            const uniprot = r.uniprotID?.value || r.uniprotid?.value || "";

            tr.innerHTML = `
                <td style="padding:8px 4px;border-bottom:1px solid #f4f4f4">${proteinLabel}</td>
                <td style="padding:8px 4px;border-bottom:1px solid #f4f4f4"><code style="font-size:12px;color:#444">${uniprot}</code></td>
            `;
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        sidePanel.appendChild(table);
        sidePanel.style.display = "block";
    }

    // Click handlers: load organ query (cached) and display results in side panel
    organGroup.selectAll("[data-organ]")
        .on("click", async function(event) {
            // find the organ id (elements include both visible and hit-area circles)
            const organId = d3.select(this).attr("data-organ");
            const organDef = organs.find(o => o.id === organId);
            if (!organDef) return;

            // show loading message
            sidePanel.innerHTML = `<div style="color:#333;font-weight:600;margin-bottom:8px">${organDef.label}</div><div style="color:#666">Loading…</div>`;
            sidePanel.style.display = "block";

            try {
                if (!organCache[organId]) {
                    const rows = await fetchSparql(organDef.query);
                    organCache[organId] = rows;
                }
                const rows = organCache[organId] || [];
                if (rows.length === 0) {
                    sidePanel.innerHTML = `<div style="color:#333;font-weight:600;margin-bottom:8px">${organDef.label}</div><div style="color:#666">No proteins found.</div>`;
                } else {
                    showSidePanelForOrgan(organDef, rows);
                }
            } catch (err) {
                sidePanel.innerHTML = `<div style="color:#333;font-weight:600;margin-bottom:8px">${organDef.label}</div><div style="color:#c00">Error loading data</div>`;
                console.error(err);
            }

            // Stop propagation so clicking an organ doesn't trigger other listeners
            event.stopPropagation();
        });

    // Optional: clicking outside panel hides it
    document.addEventListener("click", (e) => {
        // if click is outside contentRow (svg+panel), hide panel
        if (!contentRow.contains(e.target)) {
            sidePanel.style.display = "none";
        }
    });
}

// ---------- Master Render ----------
function renderResults(results, searchType = null, searchValue = null) {
  const displayMode = document.getElementById("displayMode").value;

  // Treat UniProt search as a protein search for all downstream logic
  if (searchType === "uniprot") {
    searchType = "protein";
  }

  // Remove/hide anything currently displayed
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
  else if (displayMode === "human") renderHuman(results);
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



function renderBubble(results) {
  // Prepare container
  let bubbleDiv = document.getElementById("bubble");
  if (!bubbleDiv) {
    bubbleDiv = document.createElement("div");
    bubbleDiv.id = "bubble";
    document.body.appendChild(bubbleDiv);
  } else {
    bubbleDiv.innerHTML = "";
  }

  const width = window.innerWidth;
  const height = window.innerHeight - window.innerHeight / 4;

  // Aggregate counts of biological processes
  const processCounts = d3.rollups(
    results,
    v => v.length,
    d => d.biological_processLabel ? d.biological_processLabel.value : "Unknown Process"
  );

  const data = processCounts.map(([label, count]) => ({
    label,
    value: count
  }));

  // D3 bubble layout setup
  const pack = d3.pack()
    .size([width, height])
    .padding(10);

  const root = d3.hierarchy({ children: data })
    .sum(d => d.value);

  const nodes = pack(root).leaves();

  // SVG setup
  const svg = d3.select(bubbleDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("background", "#f9f9f9");

  const g = svg.append("g");

  // Define color scale
  const color = d3.scaleSequential(d3.interpolateBlues)
    .domain([0, d3.max(data, d => d.value)]);

  // Draw circles
  const circles = g.selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("r", d => d.r)
    .attr("fill", d => color(d.data.value))
    .attr("stroke", "#333")
    .attr("stroke-width", 1.5)
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
  d3.select(this).attr("stroke", "#000").attr("stroke-width", 3);

  // Find all proteins/entries that belong to this biological process
  const related = results
    .filter(r => {
      const label = r.biological_processLabel ? r.biological_processLabel.value : "Unknown Process";
      return label === d.data.label;
    })
    .map(r => r.itemLabel ? r.itemLabel.value : "Unnamed protein"); // <-- changed here

  // Create HTML list of protein names (limit to 15 for readability)
  const listHTML = related
    .slice(0, 15)
    .map(p => `• ${p}`)
    .join("<br/>");

  const extra = related.length > 15 ? `<br/><em>and ${related.length - 15} more…</em>` : "";

  tooltip.style("opacity", 1)
    .html(`
      <strong>${d.data.label}</strong><br/>
      ${related.length} proteins:<br/>
      ${listHTML}${extra}
    `)
    .style("left", event.pageX + 10 + "px")
    .style("top", event.pageY - 20 + "px");
})
    .on("mousemove", function (event) {
      tooltip.style("left", event.pageX + 10 + "px").style("top", event.pageY - 20 + "px");
    })
    .on("mouseout", function () {
      d3.select(this).attr("stroke", "#333").attr("stroke-width", 1.5);
      tooltip.style("opacity", 0);
    });


  // Tooltip
  const tooltip = d3.select("body")
    .append("div")
    .style("position", "absolute")
    .style("background", "#fff")
    .style("padding", "6px 10px")
    .style("border-radius", "6px")
    .style("box-shadow", "0px 2px 6px rgba(0,0,0,0.2)")
    .style("pointer-events", "none")
    .style("opacity", 0);

  // Zoom interaction
  svg.call(
    d3.zoom()
      .scaleExtent([0.5, 5])
      .on("zoom", event => g.attr("transform", event.transform))
  );
}

