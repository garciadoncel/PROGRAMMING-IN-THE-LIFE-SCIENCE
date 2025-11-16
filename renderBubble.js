export function renderBubble(results) {
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

  // D3 bubble layout
  const pack = d3.pack().size([width, height]).padding(10);
  const root = d3.hierarchy({ children: data }).sum(d => d.value);
  const nodes = pack(root).leaves();

  // SVG setup
  const svg = d3.select(bubbleDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("background", "#f9f9f9");

  const g = svg.append("g");

  // Improved color scale: darker for small bubbles
  const color = d3.scaleSequential(d3.interpolateBlues)
    .domain([1, d3.max(data, d => d.value)]); // min=1 so small bubbles not too pale

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

  // Draw bubbles
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
    .on("mouseover", function(event, d) {
      d3.select(this).attr("stroke", "#000").attr("stroke-width", 3);

      const related = results
        .filter(r => (r.biological_processLabel ? r.biological_processLabel.value : "Unknown Process") === d.data.label)
        .map(r => r.itemLabel ? r.itemLabel.value : "Unnamed protein");

      const listHTML = related.slice(0, 15).map(p => `• ${p}`).join("<br/>");
      const extra = related.length > 15 ? `<br/><em>and ${related.length - 15} more…</em>` : "";

      tooltip.style("opacity", 1)
        .html(`<strong>${d.data.label}</strong><br/>${related.length} proteins:<br/>${listHTML}${extra}`)
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 20 + "px");
    })
    .on("mousemove", event => {
      tooltip.style("left", event.pageX + 10 + "px")
             .style("top", event.pageY - 20 + "px");
    })
    .on("mouseout", function() {
      d3.select(this).attr("stroke", "#333").attr("stroke-width", 1.5);
      tooltip.style("opacity", 0);
    });

  // Click to render table of proteins
  circles.on("click", function(event, d) {
    const related = results.filter(r => (r.biological_processLabel ? r.biological_processLabel.value : "Unknown Process") === d.data.label);
    let bubbleTable = document.getElementById("bubbleTable");

    if (!bubbleTable) {
      bubbleTable = document.createElement("table");
      bubbleTable.id = "bubbleTable";
      bubbleTable.style.width = "100%";
      bubbleTable.style.borderCollapse = "collapse";
      bubbleTable.style.marginTop = "20px";

      const thead = document.createElement("thead");
      thead.innerHTML = `<tr>
        <th style="text-align:left;padding:6px 4px;border-bottom:1px solid #eee">Protein</th>
        <th style="text-align:left;padding:6px 4px;border-bottom:1px solid #eee">UniProt</th>
        <th style="text-align:left;padding:6px 4px;border-bottom:1px solid #eee">Process URL</th>
        <th style="text-align:left;padding:6px 4px;border-bottom:1px solid #eee">Process Name</th>
      </tr>`;
      bubbleTable.appendChild(thead);

      const tbody = document.createElement("tbody");
      bubbleTable.appendChild(tbody);
      bubbleDiv.appendChild(bubbleTable);
    }

    const tbody = bubbleTable.querySelector("tbody");
    tbody.innerHTML = "";

    if (related.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4">No proteins found for "${d.data.label}".</td></tr>`;
      return;
    }

    related.forEach(row => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.itemLabel ? row.itemLabel.value : ""}</td>
        <td>${row.uniprotid ? row.uniprotid.value : ""}</td>
        <td>${row.biological_process ? `<a href="${row.biological_process.value}" target="_blank" rel="noopener">${row.biological_process.value}</a>` : ""}</td>
        <td>${row.biological_processLabel ? row.biological_processLabel.value : ""}</td>
      `;
      tbody.appendChild(tr);
    });

    bubbleTable.scrollIntoView({ behavior: "smooth" });
  });

  // Add text labels inside bubbles with dynamic color for readability
  g.selectAll("text")
    .data(nodes)
    .join("text")
    .attr("x", d => d.x)
    .attr("y", d => d.y)
    .attr("text-anchor", "middle")
    .attr("dy", "0.3em")
    .style("font-size", d => Math.max(10, d.r / 3) + "px")
    .style("pointer-events", "none")
    .text(d => d.data.value)
    .style("fill", d => {
      // Invert color based on bubble brightness
      const rgb = d3.color(color(d.data.value));
      const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
      return brightness > 160 ? "#000" : "#fff";
    });

  // Zoom
  svg.call(d3.zoom()
    .scaleExtent([0.5, 5])
    .on("zoom", event => g.attr("transform", event.transform))
  );
}