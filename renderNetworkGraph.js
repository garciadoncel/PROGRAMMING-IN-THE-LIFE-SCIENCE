export function renderNetworkGraph(results, searchType = null, searchValue = null) {
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