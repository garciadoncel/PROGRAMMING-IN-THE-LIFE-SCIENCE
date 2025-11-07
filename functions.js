const endpoint = "https://query.wikidata.org/sparql";

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

// Function to fetch data from Wikidata and populate the table
async function fetchData(query, isSearch = false, proteinName = "") {
  const url = endpoint + "?query=" + encodeURIComponent(query);
  const response = await fetch(url, {
    headers: { Accept: "application/sparql-results+json" },
  });

  const data = await response.json();
  const results = data.results.bindings || [];
  const tbody = document.querySelector("#resultsTable tbody");
  tbody.innerHTML = "";

  if (results.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4">No results found.</td></tr>`;
    return;
  }

  if (isSearch) {
    const first = results[0];
    const infoRow = document.createElement("tr");
    infoRow.innerHTML = `
      <td colspan="4">
        <strong>Protein Name:</strong> ${first.itemLabel ? first.itemLabel.value : ""} &nbsp;|&nbsp;
        <strong>UniProt ID:</strong> ${first.uniprotid ? first.uniprotid.value : "N/A"}
      </td>
    `;
    tbody.appendChild(infoRow);

    results.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td colspan="2"></td>
        <td>${row.biological_process ? row.biological_process.value : ""}</td>
        <td>${row.biological_processLabel ? row.biological_processLabel.value : ""}</td>
      `;
      tbody.appendChild(tr);
    });

    document.querySelector("#resultsTable thead").style.display = "none";
  } else {
    document.querySelector("#resultsTable thead").style.display = "table-header-group";

    results.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.itemLabel ? row.itemLabel.value : ""}</td>
        <td>${row.uniprotid ? row.uniprotid.value : ""}</td>
        <td>${row.biological_process ? row.biological_process.value : ""}</td>
        <td>${row.biological_processLabel ? row.biological_processLabel.value : ""}</td>
      `;
      tbody.appendChild(tr);
    });
  }
}

// Create the search input and show the search button
function createSearchUI() {
  if (document.getElementById("proteinInput")) return;

  const input = document.createElement("input");
  input.type = "text";
  input.id = "proteinInput";
  input.placeholder = "Enter protein name";

  const searchBtn = document.getElementById("SearchBtn");
  searchBtn.style.display = "inline";

  searchBtn.before(input);
}

// Escape user input for SPARQL
function escapeForSPARQL(s) {
  if (!s) return "";
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
}

// Event listeners
document.getElementById("fetchBtn").addEventListener("click", () => {
  fetchData(main_query);
  createSearchUI();
  document.querySelector("#resultsTable thead").style.display = "table-header-group";
});

document.getElementById("SearchBtn").addEventListener("click", () => {
  const inputEl = document.getElementById("proteinInput");
  if (!inputEl) {
    return alert('Please click "Run Query" first to show the search box.');
  }

  const raw = inputEl.value.trim();
  if (!raw) return alert("Please enter a protein name!");

  const name = escapeForSPARQL(raw);

  const search_query = `
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

  fetchData(search_query, true, raw);
});
