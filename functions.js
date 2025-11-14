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
    import("./renderHuman.js").then(module =>
      module.renderHuman(results)
    );
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




