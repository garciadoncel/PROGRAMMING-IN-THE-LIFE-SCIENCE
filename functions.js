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





// Lightweight helper to run a SPARQL query and return bindings (does not re-render UI)
async function fetchSparql(query) {
    const url = endpoint + "?query=" + encodeURIComponent(query);
    const resp = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } });
    if (!resp.ok) throw new Error(`SPARQL error: ${resp.status}`);
    const data = await resp.json();
    return data.results?.bindings || [];
}


function renderResults(results, searchType = null, searchValue = null) {
  const displayMode = document.getElementById("displayMode").value;

  if (searchType === "uniprot") {
    searchType = "protein";
  }

  const table = document.getElementById("resultsTable");
  const chart = document.getElementById("chart");
  const bubble = document.getElementById("bubble");

  if (table) table.style.display = "none";
  if (chart) chart.remove();
  if (bubble) bubble.remove();

  if (displayMode === "table") {
    import("./renderTable.js").then(module => module.renderTable(results));
  }
  else if (displayMode === "graph") {
    import("./renderNetworkGraph.js").then(module =>
      module.renderNetworkGraph(results, searchType, searchValue)
    );
  }
  else if (displayMode === "bubble") {
    import("./renderBubble.js").then(module =>
      module.renderBubble(results)
    );
  }
  else if (displayMode === "human") {
    renderHuman(results); // call directly
  }
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