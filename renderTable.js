// Render table format
// Main function to display SPARQL query results in an HTML table format
function renderTable(results) {
  // Get reference to the existing HTML table element in the DOM
  const table = document.getElementById("resultsTable");
  // Get the table body element where data rows will be inserted
  const tbody = table.querySelector("tbody");

  // Clear old chart if exists
  // Remove any previous chart visualization to avoid conflicts
  const oldChart = document.getElementById("chart");
  if (oldChart) oldChart.remove();

  // Make the table visible and show the header row
  table.style.display = "table";
  document.querySelector("#resultsTable thead").style.display = "table-header-group";

  tbody.innerHTML = ""; // clear previous results

  // Handle empty or null results
  // Display a "no results" message if the data array is empty
  if (!results || results.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4">No results found.</td></tr>`;
    return;
  }

  // Loop through each result row from the SPARQL query
  // Each 'row' contains protein data fields from Wikidata
  results.forEach(row => {
    // Create a new table row element
    const tr = document.createElement("tr");
    // Fill the row with 4 columns of data:
    tr.innerHTML = `
      <td>${row.itemLabel ? row.itemLabel.value : ""}</td>                                                                                                                    <!-- Column 1: Protein name -->
      <td>${row.uniprotid ? row.uniprotid.value : ""}</td>                                                                                                                    <!-- Column 2: UniProt ID -->
      <td>${row.biological_process ? `<a href="${row.biological_process.value}" target="_blank" rel="noopener">${row.biological_process.value}</a>` : ""}</td>              <!-- Column 3: Clickable link to biological process on Wikidata -->
      <td>${row.biological_processLabel ? row.biological_processLabel.value : ""}</td>                                                                                       <!-- Column 4: Human-readable biological process name -->
    `;
    // Add the completed row to the table body
    tbody.appendChild(tr);
  });
  // Store the table HTML content for potential future use or export
  window.lastTableHTML = tbody.innerHTML;
}


