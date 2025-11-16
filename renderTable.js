// Render table format
export function renderTable(results) {
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


