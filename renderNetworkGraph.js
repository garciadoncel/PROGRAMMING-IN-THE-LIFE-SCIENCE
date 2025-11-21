function renderNetworkGraph(results, searchType = null, searchValue = null) {
  // Get or create chart container
  let chartDiv = document.getElementById("chart");
  if (!chartDiv) {
    chartDiv = document.createElement("div");
    chartDiv.id = "chart";
    document.body.appendChild(chartDiv);
  } else {
    chartDiv.innerHTML = ""; // clear previous chart when re-rendering
  }

  // Canvas sizing:
  // - width uses viewport width. Replace with a fixed number for a fixed layout (e.g. 900).
  // - height subtracts a quarter of the viewport to leave room for controls/tables; adjust as needed.
  const width = window.innerWidth;
  const height = window.innerHeight - window.innerHeight / 4;

  // Prepare nodes and links from results
  // - nodesMap prevents duplicates (same protein/process used multiple times)
  // - links connect protein -> process
  const nodesMap = new Map();
  const links = [];
  results.forEach(d => {
    const proteinId = d.item?.value; // could be a URI or simple identifier
    const proteinLabel = d.itemLabel?.value || proteinId; // fallback to id if label missing
    const processId = d.biological_process?.value; // usually a URI (Wikidata)
    const processLabel = d.biological_processLabel?.value || processId;

    // Add protein node if present and not already added
    if (proteinId && !nodesMap.has(proteinId)) nodesMap.set(proteinId, { id: proteinId, label: proteinLabel, type: "protein" });
    // Add process node if present and not already added
    if (processId && !nodesMap.has(processId)) nodesMap.set(processId, { id: processId, label: processLabel, type: "process" });
    // Create link only when both ends exist
    if (proteinId && processId) links.push({ source: proteinId, target: processId });
  });

  const nodes = Array.from(nodesMap.values()); // final nodes array for the simulation

  // SVG and group container for pan/zoom
  const svg = d3.select(chartDiv).append("svg")
    .attr("width", width) // overall svg width
    .attr("height", height) // overall svg height
    .style("background", "#fcfcfcff"); // background color; set to 'none' for transparent

  const g = svg.append("g"); // group that will be transformed by zoom/pan

  // Links: visual representation of relationships
  const link = g.append("g")
    .attr("stroke", "#000000ff") // link stroke color; change to lighter color for subtle lines
    .attr("stroke-opacity", 0.6) // transparency of links
    .selectAll("line").data(links).join("line")
    .attr("stroke-width", 2); // thickness of link lines

  // Nodes: circles representing proteins and processes
  const node = g.append("g")
    .attr("stroke", "#fff") // stroke for node outline; white separates nodes from links
    .attr("stroke-width", 2)
    .selectAll("circle").data(nodes).join("circle")
    // radius: larger for proteins, smaller for processes; change numbers to alter visual emphasis
    .attr("r", d => d.type === "protein" ? 25 : 18)
    // fill color logic depends on searchType:
    // - when searching by process, highlight process nodes in blue
    // - otherwise highlight protein nodes in blue
   .attr("fill", d => {
    if (searchType === "process") {
        // Searching by biological process → highlight process nodes
        return d.type === "process" ? "#1f77b4" : "#ff7f0e"; // change hexes to alter palette
    } else {
        // Default: highlight protein nodes
        return d.type === "protein" ? "#1f77b4" : "#ff7f0e";
    }
  })
  // Enable dragging of nodes (mousedown on a node will start a drag)
  .call(d3.drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended)
  );

  // Native tooltip via title element (simple hover text)
  node.append("title").text(d => d.label);


  // Labels: text elements positioned near nodes
  const label = g.append("g").selectAll("text").data(nodes).join("text")
    .text(d => d.label)
    .attr("font-size", 16) // label font size; reduce for long names
    .attr("font-family", "sans-serif")
    .attr("font-weight", "bold")
    .attr("dx", 22) // horizontal offset from node center; adjust to move label closer/further
    .attr("dy", "0.35em") // vertical alignment tweak
    .style("pointer-events", "none") // prevent labels from capturing mouse events
    // Only show labels for the 'highlighted' node type to reduce clutter
    .style("display", d => {
        if (searchType === "process") {
            return d.type === "process" ? "block" : "none";
        } else {
            return d.type === "protein" ? "block" : "none";
        }
    })
    .each(function(d) {
        // Store a reference to the label element on the datum for quick access in events
        d.labelElement = d3.select(this);
    });

  // Hover logic: show label for hovered node; hide non-highlighted labels on mouseout
  node.on("mouseover", (event, d) => {
      d.labelElement.style("display", "block"); // reveal label when hovering
  })
  .on("mouseout", (event, d) => {
      // Determine if node belongs to the highlighted group (blue nodes)
      const isBlue = (searchType === "process" && d.type === "process") ||
                     ((searchType === "protein" || searchType === "uniprot" || !searchType) && d.type === "protein");

      if (!isBlue) {
          d.labelElement.style("display", "none"); // hide labels for non-highlighted nodes
      }
  });


  // Click behavior: open a relevant URL for the clicked node
  node.on("click", (event, d) => {
      let url = "";

      if (d.id.startsWith("http")) {
          url = d.id; // if id is already a full URL (e.g. Wikidata URI), use it
      } else if (d.type === "protein") {
          // If protein id is a UniProt accession, link to UniProt entry
          url = `https://www.uniprot.org/uniprot/${d.id}`; // change base URL if needed
      } else if (d.type === "process") {
          // For process nodes stored as Wikidata URIs, open the Wikidata page
          url = `https://www.wikidata.org/wiki/${d.id.split("/").pop()}`; // extract Q-id
      }

      if (url) {
          window.open(url, "_blank"); // open in a new tab; change to window.location = url for same-tab
      }
  });

  // Simulation: forces that drive node positioning
  const simulation = d3.forceSimulation(nodes)
    // Link force connects nodes; distance controls link length (increase to spread graph)
    .force("link", d3.forceLink(links).id(d => d.id).distance(250))
    // Charge force repels nodes; negative values push nodes apart. Tweak strength to alter packing.
    .force("charge", d3.forceManyBody().strength(-2000))
    // Centering force to keep graph near the middle of the SVG
    .force("center", d3.forceCenter(width / 2, height / 2))
    // On each tick update positions of links, nodes and labels
    .on("tick", () => {
      link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
      node.attr("cx", d => d.x).attr("cy", d => d.y);
      label.attr("x", d => d.x).attr("y", d => d.y);
    });

  // Drag handlers:
  // - dragstarted: raise simulation alpha to prevent layout freeze and fix node to cursor
  // - dragged: update fixed coordinates (fx/fy) during drag
  // - dragended: release node so simulation can reposition it again
  function dragstarted(event, d) { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }
  function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
  function dragended(event, d) { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }

  // Zoom/pan behavior:
  // - scaleExtent limits zoom (min, max). Change to e.g. [0.2, 8] for more range.
  // - Transform is applied to the 'g' group so links, nodes and labels pan/zoom together.
  svg.call(d3.zoom().scaleExtent([0.1, 5]).on("zoom", event => g.attr("transform", event.transform)));
  // Prevent node interactions from starting a background zoom (so dragging nodes works)
  node.on("mousedown.zoom touchstart.zoom", event => event.stopPropagation());
}