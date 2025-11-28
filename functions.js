const endpoint = "https://query.wikidata.org/sparql";

// Automatically trigger the main query when the page loads
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("fetchBtn").click();
});


// Lightweight helper to run a SPARQL query and return bindings (does not re-render UI)
async function fetchSparql(query) {
    const url = endpoint + "?query=" + encodeURIComponent(query);
    const resp = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } });
    if (!resp.ok) throw new Error(`SPARQL error: ${resp.status}`);
    const data = await resp.json();
    return data.results?.bindings || [];
}


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
  fetchData(searchQuery, true, raw);
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
      SELECT ?item ?uniprotid ?biological_process ?biological_processLabel ?itemLabel   # include all these variables in output (aka "only pull this information from wikidata")
        WHERE {
          ?item wdt:P352 ?uniprotid;                        # any item--UniProt protein ID--corresponding UniProt ID.            Item must have a UniProtID
                wdt:P703 wd:Q15978631.                      # (any item)--found in taxon--Homo sapiens.                          Item must be found in humans

          SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }   # binds all variables (Q numbers) to an English Language Label (In other words, define itemLabel and biological_processLabel)

          OPTIONAL { ?item wdt:P682 ?biological_process. }  # any item--biological process--corresponding biological process.    If the item doesn't have a biological process, still include it
          ?item wdt:P31 wd:Q8054.                           # any item--instance of-- protein.                                   Item must be a protein
        }
      LIMIT 5000
    `;



// Function to fetch data from Wikidata and populate the table
// 'isSearch' indicates whether this is a search for a single protein
// 'proteinName' is used for display at the top of search results
async function fetchData(query, isSearch = false) {
  showThrobber(); // Show throbber while loading

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

  hideThrobber(); // Hide throbber after loading

  renderResults(results, searchType);
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
//makes sure there will be none of \, " or newlines in the input
// Replaces \ with \\, " with \", and newlines with spaces
// Returns the escaped string
// If input is null or undefined, returns an empty string
// This function helps prevent SPARQL injection attacks
function escapeForSPARQL(s) {
  if (!s) return "";
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
}



// Build SPARQL query for searching proteins
function createProteinSearchQuery(name, mode) {
  name = escapeForSPARQL(name);
//There are three modes for different input types:
//  "name" (for proteins) "uniprot" (for uniprot IDs), "process" (for biological processes)
  if (mode === "name") {
    return `
    SELECT ?item ?uniprotid ?biological_process ?biological_processLabel ?itemLabel   # include all these variables in output
      WHERE {
        ?item wdt:P31 wd:Q8054;                           # any item--instance of--protein.                                                    Item must be a protein
              wdt:P703 wd:Q15978631.                      # (any item)--found in taxon--Homo sapiens.                                          Item must be found in humans
        OPTIONAL { ?item wdt:P352 ?uniprotid. }           # optionally include any item--UniProt protein ID--corresponding UniProtID.          Item can have a UniProtID, still include items that don't
        OPTIONAL { ?item wdt:P682 ?biological_process. }  # optionally include any item--biological process--corresponding biological process. Item can have a biological process, still include items that don't

        SERVICE wikibase:mwapi {                          # use a mediawiki api service to handle searching for strings. 
        bd:serviceParam wikibase:endpoint "www.wikidata.org";
        wikibase:api "Search";
        mwapi:srsearch "${name} haswbstatement:P703";     # protein must have property P703 "found in taxon". This optimises the search by excluding/ignoring all items that do not have this property
        mwapi:srlimit "max".
        ?item wikibase:apiOutputItem mwapi:title.
      }
        # Note: The output of the mwapi search service also includes entries that have the input {name} in their Alias
        
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } # binds all variables (Q numbers) to an English Language Label
      }
      LIMIT 200
    `;
  } else if (mode === "uniprot") {
    return `
    SELECT ?item ?uniprotid ?biological_process ?biological_processLabel ?itemLabel   # include all these variables in output
      WHERE {
        ?item wdt:P352 "${name}";                         # item--UniProt protein ID--{UniprotID user input}.                                  Item must have input UniProtID
              wdt:P703 wd:Q15978631.                      # (any item)--found in taxon--Homo sapiens.                                          Item must be found in humans          
        OPTIONAL { ?item wdt:P352 ?uniprotid. }           # optionally include any item--UniProt protein ID--corresponding UniProtID.          Item can have a UniProtID, still include items that don't 
        OPTIONAL { ?item wdt:P682 ?biological_process. }  # optionally include any item--biological process--corresponding biological process. Item can have a biological process, still include items that don't

        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }  # binds all variables (Q numbers) to an English Language Label
      }
      LIMIT 50
    `;
  } else if (mode === "process") {
    return `
    SELECT ?item ?uniprotid ?biological_process ?biological_processLabel ?itemLabel   # include all these variables in output
        WHERE {
    
          SERVICE wikibase:mwapi {                         # use a wikidata service to handle searching for strings. 
            bd:serviceParam wikibase:endpoint "www.wikidata.org";
            wikibase:api "Search";
            mwapi:srsearch "${name} haswbstatement:P31";
            mwapi:srlimit "max".
            ?biological_process wikibase:apiOutputItem mwapi:title.
          }
          # The output of the search service also includes entries that have the input {name} in their Alias
          # This service must happen before the rest of the query
          # -> Otherwise the biological process found by the query would overrule the ?biological_process the user inputted

          ?item wdt:P682 ?biological_process;            # any item--biological process--corresponding biological process  Item must have a biological process
                wdt:P703 wd:Q15978631;                   # (any item)--found in taxon--Homo sapiens.                       Item must be found in humans 
                wdt:P31 wd:Q8054.                        # (any item)--instance of--protein.                               Item must be a protein
          
                OPTIONAL { ?item wdt:P352 ?uniprotid. }  # optionally include any item--UniProt protein ID--corresponding UniProtID.  If the item doesn't have a UniProt ID, still include it
        
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } # binds all variables (Q numbers) to an English Language Label
      }
      LIMIT 200
    `;
  }
}

function renderResults(results, searchType = null) {
  const displayMode = document.getElementById("displayMode").value;

  if (searchType === "uniprot") {
    searchType = "protein";
  }

  const table = document.getElementById("resultsTable");
  const chart = document.getElementById("chart");
  const bubble = document.getElementById("bubble");

  if (table) table.style.display = "none";

  // Clean up event listeners before removing elements
  if (chart && chart._organDocClickHandler) {
    document.removeEventListener("click", chart._organDocClickHandler);
    chart._organDocClickHandler = null;
  }

  if (chart) chart.remove();
  if (bubble) bubble.remove();

  if (displayMode === "table") {
    renderTable(results);
  }
  else if (displayMode === "graph") {
    renderNetworkGraph(results, searchType);
  }
  else if (displayMode === "bubble") {
    renderBubble(results);
  }
  else if (displayMode === "human") {
    renderHuman(results);
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

// Helper to show the throbber spinner
function showThrobber() {
  let throbber = document.getElementById("throbber");
  if (!throbber) {
    throbber = document.createElement("div");
    throbber.id = "throbber";
    throbber.style.textAlign = "center";
    throbber.style.margin = "1.5rem 0";
    throbber.innerHTML = `<img src="assets/throbber.gif" alt="Loading..." style="width:48px;height:48px;">`;
    // Insert above results table
    const resultsTable = document.getElementById("resultsTable");
    if (resultsTable && resultsTable.parentNode) {
      resultsTable.parentNode.insertBefore(throbber, resultsTable);
    } else {
      document.body.appendChild(throbber);
    }
  }
  throbber.style.display = "block";
}

// Helper to hide the throbber spinner
function hideThrobber() {
  const throbber = document.getElementById("throbber");
  if (throbber) throbber.style.display = "none";
}