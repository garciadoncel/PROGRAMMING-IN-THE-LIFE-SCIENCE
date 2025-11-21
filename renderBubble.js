function renderBubble(results) {
  // Prepare or reuse a container div with id="bubble"
  // If you want the chart inside a specific element, replace document.body.appendChild with
  // the desired parent (e.g. document.getElementById("myContainer").appendChild(...))
  let bubbleDiv = document.getElementById("bubble");
  if (!bubbleDiv) {
    bubbleDiv = document.createElement("div");
    bubbleDiv.id = "bubble";
    document.body.appendChild(bubbleDiv);
  } else {
    bubbleDiv.innerHTML = ""; // clear previous content when re-rendering
  }

  // Layout sizing:
  // - width uses the viewport width (window.innerWidth). For a fixed width use a number (e.g. 800).
  // - height subtracts a quarter of the viewport height to leave space for other UI. Adjust formula as needed.
  const width = window.innerWidth;
  const height = window.innerHeight - window.innerHeight / 4;

  // Aggregate counts for each biological process label.
  // d3.rollups groups by label and returns [[label, count], ...]
  // If labels are missing we map them to "Unknown Process".
  const processCounts = d3.rollups(
    results,
    v => v.length,
    d => d.biological_processLabel ? d.biological_processLabel.value : "Unknown Process"
  );

  // Convert the rollups into an array of objects suitable for d3.hierarchy
  const data = processCounts.map(([label, count]) => ({
    label,
    value: count
  }));

  // D3 pack layout:
  // - pack.size([width, height]) sets the available drawing rectangle.
  // - padding controls spacing between packed circles; increase padding to separate bubbles more.
  const pack = d3.pack().size([width, height]).padding(10);
  const root = d3.hierarchy({ children: data }).sum(d => d.value);
  const nodes = pack(root).leaves(); // leaves are the actual bubbles we will render

  // SVG setup: create an SVG inside the bubbleDiv
  const svg = d3.select(bubbleDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("background", "#f9f9f9"); // change to 'none' or another color if preferred

  const g = svg.append("g"); // group for pan/zoom transforms

  // Color scale: sequential blue interpolation
  // - domain uses [1, max] so very small counts still get visible color.
  // - To change the palette use d3.interpolateViridis etc.
  const color = d3.scaleSequential(d3.interpolateBlues)
    .domain([1, d3.max(data, d => d.value)]); // min=1 so small bubbles not too pale

  // Tooltip: appended to the body so it floats above SVG
  // - pointer-events:none prevents the tooltip from interfering with mouse events
  // - Change padding, border-radius, or shadow to customise appearance
  const tooltip = d3.select("body")
    .append("div")
    .style("position", "absolute")
    .style("background", "#fff")
    .style("padding", "6px 10px")
    .style("border-radius", "6px")
    .style("box-shadow", "0px 2px 6px rgba(0,0,0,0.2)")
    .style("pointer-events", "none")
    .style("opacity", 0);

  // Draw bubbles using the packed nodes
  const circles = g.selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("cx", d => d.x) // x coordinate from pack layout
    .attr("cy", d => d.y) // y coordinate from pack layout
    .attr("r", d => d.r)  // radius from pack layout
    .attr("fill", d => color(d.data.value)) // fill based on count
    .attr("stroke", "#333") // border color of circle; change to 'transparent' to hide
    .attr("stroke-width", 1.5) // border thickness; increase for stronger outline
    .style("cursor", "pointer") // indicates clickability; remove to disable pointer change
    .on("mouseover", function(event, d) {
      // Hover feedback: thicken stroke for the hovered circle
      d3.select(this).attr("stroke", "#000").attr("stroke-width", 3);

      // Find related proteins for this biological process (match by label string)
      const related = results
        .filter(r => (r.biological_processLabel ? r.biological_processLabel.value : "Unknown Process") === d.data.label)
        .map(r => r.itemLabel ? r.itemLabel.value : "Unnamed protein");

      // Build a shortened list for the tooltip to avoid huge popups
      const listHTML = related.slice(0, 15).map(p => `• ${p}`).join("<br/>");
      const extra = related.length > 15 ? `<br/><em>and ${related.length - 15} more…</em>` : "";

      // Position tooltip near cursor. event.pageX/Y are used to reposition on the page.
      // event is the native DOM event provided by d3; event.pageX/Y are page coordinates.
      tooltip.style("opacity", 1)
        .html(`<strong>${d.data.label}</strong><br/>${related.length} proteins:<br/>${listHTML}${extra}`)
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 20 + "px");
    })
    .on("mousemove", event => {
      // Keep tooltip following the pointer while inside the circle
      // event.pageX/Y track the mouse position; useful when zoom/pan shifts coordinates.
      tooltip.style("left", event.pageX + 10 + "px")
             .style("top", event.pageY - 20 + "px");
    })
    .on("mouseout", function() {
      // Restore stroke and hide tooltip when pointer leaves
      d3.select(this).attr("stroke", "#333").attr("stroke-width", 1.5);
      tooltip.style("opacity", 0);
    });

  // Click handler: build or update a table listing proteins related to the clicked process
  circles.on("click", function(event, d) {
    const related = results.filter(r => (r.biological_processLabel ? r.biological_processLabel.value : "Unknown Process") === d.data.label);
    let bubbleTable = document.getElementById("bubbleTable");

    // If table not present, create it and append to bubbleDiv
    if (!bubbleTable) {
      bubbleTable = document.createElement("table");
      bubbleTable.id = "bubbleTable";
      bubbleTable.style.width = "100%"; // table fills available container width
      bubbleTable.style.borderCollapse = "collapse"; // merge cell borders
      bubbleTable.style.marginTop = "20px"; // space between SVG and table

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
      bubbleDiv.appendChild(bubbleTable); // appending to the same container as the chart
    }

    const tbody = bubbleTable.querySelector("tbody");
    tbody.innerHTML = "";

    if (related.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4">No proteins found for "${d.data.label}".</td></tr>`;
      return;
    }

    // Populate rows for each related protein
    related.forEach(row => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.itemLabel ? row.itemLabel.value : ""}</td>
        <td>${row.uniprotid ? row.uniprotid.value : ""}</td>
        <td>${row.biological_process ? `<a href="${row.biological_process.value}" target="_blank" rel="noopener">${row.biological_process.value}</a>` : ""}</td>
        <td>${row.biological_processLabel ? row.biological_processLabel.value : ""}</td>
      `;
      // rel="noopener" prevents the newly opened page from accessing window.opener (security best practice)
      tbody.appendChild(tr);
    });

    // Smoothly scroll the newly created/updated table into view
    bubbleTable.scrollIntoView({ behavior: "smooth" });
  });

  // Add text labels inside bubbles:
  // - font-size is set relative to radius: Math.max(10, d.r / 3)
  // - pointer-events none ensures labels don't block circle mouse events
  g.selectAll("text")
    .data(nodes)
    .join("text")
    .attr("x", d => d.x)
    .attr("y", d => d.y)
    .attr("text-anchor", "middle") // center align text horizontally
    .attr("dy", "0.3em") // slight vertical tweak to center text visually
    .style("font-size", d => Math.max(10, d.r / 3) + "px") // adjust divisor to change label size relative to bubble
    .style("pointer-events", "none")
    .text(d => d.data.value)
    .style("fill", d => {
      // Choose label color based on bubble brightness for readability.
      // Steps:
      // 1) d3.color(...) returns an RGB object.
      // 2) brightness formula approximates perceived luminance.
      // 3) threshold (160) chooses black vs white text; lower threshold -> more black labels.
      const rgb = d3.color(color(d.data.value));
      const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
      return brightness > 160 ? "#000" : "#fff";
    });

  // Enable zoom and pan:
  // - scaleExtent restricts zoom levels; change [0.5, 5] to allow further zooming in/out.
  // - On zoom, update the transform of group 'g' so all children scale/translate together.
  svg.call(d3.zoom()
    .scaleExtent([0.5, 5])
    .on("zoom", event => g.attr("transform", event.transform))
  );
}