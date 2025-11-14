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
    if (proteinId && !nodesMap.has(proteinId)) nodesMap.set(proteinId, {id: proteinId, label: proteinLabel,  type: "protein"});
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
    if (searchType === "process") {
        // Searching by biological process → process nodes blue, proteins orange
        return d.type === "process" ? "#1f77b4" : "#ff7f0e";
    } else {
        // Searching by protein name or UniProt → protein nodes blue, others orange
        return d.type === "protein" ? "#1f77b4" : "#ff7f0e";
    }
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
      // Blue nodes always have labels visible
      if (searchType === "process") {
          return d.type === "process" ? "block" : "none";
      } else {
          return d.type === "protein" ? "block" : "none";
      }
  })
  .each(function(d) {
      d.labelElement = d3.select(this);
  });

// Hover logic: optional, can show labels for all on hover
node.on("mouseover", (event, d) => {
  d.labelElement.style("display", "block"); // show label on hover
}).on("mouseout", (event, d) => {
  // Hide only if not a blue node
  if (searchType === "process" && d.type !== "process") d.labelElement.style("display", "none");
  if ((searchType === "protein" || searchType === "uniprot") && d.type !== "protein") d.labelElement.style("display", "none");
});


node.on("click", (event, d) => {
    // Determine the URL of the node
    // If your 'id' is a full URL, use it directly
    // Otherwise, you can construct a Wikidata link or UniProt link
    let url = "";

    if (d.id.startsWith("http")) {
        url = d.id; // full URL
    } else if (d.type === "protein") {
        // Example: link to UniProt
        url = `https://www.uniprot.org/uniprot/${d.id}`;
    } else if (d.type === "process") {
        // Example: link to Wikidata page
        url = `https://www.wikidata.org/wiki/${d.id.split("/").pop()}`;
    }

    if (url) {
        window.open(url, "_blank"); // open in a new tab
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