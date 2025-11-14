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


// Add text labels (number of proteins) inside each bubble
g.selectAll("text")
  .data(nodes)
  .join("text")
  .attr("x", d => d.x)
  .attr("y", d => d.y)
  .attr("text-anchor", "middle")
  .attr("dy", "0.3em")
  .style("font-size", d => Math.max(10, d.r / 3) + "px")
  .style("fill", "white")
  .style("pointer-events", "none")
  .text(d => d.data.value);

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
