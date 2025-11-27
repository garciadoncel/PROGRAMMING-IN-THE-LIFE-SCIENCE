// Cache to avoid repeated organ queries
const organCache = {};

// Main function to render interactive human body visualization
// Takes results from main query (may be unused) and dependencies object
async function renderHuman(results, deps = {}) {
    // Path to the human body image
    const bodyImgPath = deps.bodyImgPath || "assets/body.png";

    // Organ query builder - creates SPARQL queries for specific organs.
    // Takes an organ's Wikidata QID and returns a complete SPARQL query string
    const organ_query = (organQID) => `
      SELECT ?protein ?proteinLabel ?uniprotID ?biologicalProcess ?biologicalProcessLabel       # include all these variables in output (aka "only pull this information from wikidata")
        WHERE {
          ?protein wdt:P31 wd:Q8054;             # any item--instance of-- protein.                                    Item must be a protein
                   wdt:P703 wd:Q15978631;        # (any item)--found in taxon--Homo sapiens.                           Item must be found in humans
                   wdt:P352 ?uniprotID;          # any item--UniProt protein ID--corresponding UniProt ID.             Item must have a UniProtID (any ID)
                   wdt:P682 ?biologicalProcess.  # any item--biological process--corresponding biological process.     Item must have a biological process (any biological process)
          ?biologicalProcess (wdt:P927*) wd:${organQID}. # any biological process--anatomical location--{input organ}. Biological process of the item must be connected by 0 or more steps of "anatomical location" (P927) to the input organ

          SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }        # binds all variables (Q numbers) to an English Language Label
      }
      LIMIT 1000
    `;

    // Define all organ queries
    // Each query uses the organ's specific Wikidata QID (Q-number)
    const heart_query = organ_query("Q1072");        // Q1072 = heart
    const liver_query = organ_query("Q9368");        // Q9368 = liver  
    const brain_query = organ_query("Q1073");        // Q1073 = brain
    const lung_query = organ_query("Q7886");         // Q7886 = lung
    const kidney_query = organ_query("Q9377");       // Q9377 = kidney
    const thyroid_query = organ_query("Q16399");     // Q16399 = thyroid gland
    const mouth_query = organ_query("Q9635");        // Q9635 = mouth
    const bladder_query = organ_query("Q9382");      // Q9382 = urinary bladder
    const pancreas_query = organ_query("Q9618");     // Q9618 = pancreas
    const gallbladder_query = organ_query("Q64386"); // Q64386 = gallbladder

    // Digestive system uses subclass relationship instead of anatomical location.
    // This query is indentical to organ_query, with the small difference of
    //  P927 (anatomical location) --> P279 (subclass of). and taking "digestion" (Q11978) as input
    const digestive_query = `
      SELECT ?protein ?proteinLabel ?uniprotID ?biologicalProcess ?biologicalProcessLabel   # include all these variables in output
        WHERE {
            ?protein wdt:P31 wd:Q8054;                # any item--instance of-- protein.                                 Item must be a protein
                     wdt:P703 wd:Q15978631;           # (any item)--found in taxon--Homo sapiens.                        Item must be found in humans
                     wdt:P352 ?uniprotID;             # any item--UniProt protein ID--corresponding UniProt ID.          Item must have a UniProtID (any ID)
                     wdt:P682 ?biologicalProcess.     # any item--biological process--corresponding biological process.  Item must have a biological process (any biological process)
            ?biologicalProcess (wdt:P279*) wd:Q11978. # any biological process--subclass of--digestion.                  Biological process of the item must be connected by 0 or more steps of "subclass of" (P279) to Q11978 ("digestion")

        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }      # binds all variables (Q numbers) to an English Language Label
      }
      LIMIT 1000
    `;

    // Clean up any existing global click handler before creating/reusing chartDiv
    // This prevents memory leaks when the function is called multiple times
    const existingChart = document.getElementById("chart");
    if (existingChart && existingChart._organDocClickHandler) {
        document.removeEventListener("click", existingChart._organDocClickHandler);
        existingChart._organDocClickHandler = null;
    }

    // Create or reuse the main chart container div
    // This div will hold the entire human body visualization interface
    let chartDiv = document.getElementById("chart");
    if (!chartDiv) {
        // Create new chart container if none exists
        chartDiv = document.createElement("div");
        chartDiv.id = "chart";
        document.body.appendChild(chartDiv);
    } else {
        // Clear existing content if chart div already exists
        chartDiv.innerHTML = "";
    }

    // Calculate responsive sizing for the visualization
    // Width: max 600px or full window width, whichever is smaller
    // Height: full window height minus 200px for other UI elements
    const width = Math.min(window.innerWidth, 600);
    const height = Math.min(window.innerHeight - 200, 900);

    // Instruction / placeholder when no data is passed
    // Creates a header explaining how to use the interface
    const header = document.createElement("div");
    header.style.padding = "10px 14px";
    header.style.fontFamily = "sans-serif";
    header.style.color = "#333";
    header.innerHTML = `<strong>Human body view</strong> — click an organ to load related proteins (from Wikidata).`;
    chartDiv.appendChild(header);

    // Create a content row so we can place the SVG and a right-side panel next to each other
    // Uses flexbox layout to arrange body image (left) and results panel (right)
    const contentRow = document.createElement("div");
    contentRow.style.display = "flex";            // Horizontal layout
    contentRow.style.alignItems = "flex-start";   // Align items to top
    contentRow.style.gap = "12px";                // Space between image and panel
    contentRow.style.padding = "8px 14px";        // Padding around entire content
    chartDiv.appendChild(contentRow);

    // SVG (left)
    // Creates the SVG canvas that will contain the body image and clickable organ overlays
    const svg = d3.select(contentRow)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("background", "#ffffff");

    // Body image as background
    // Loads the human body image and scales it to fit the SVG container
    svg.append("image")
        .attr("href", bodyImgPath)                      // Path to body image file
        .attr("x", 0)                                   // Position at top-left corner
        .attr("y", 0)
        .attr("width", width)                           // Scale to SVG width
        .attr("height", height)                         // Scale to SVG height
        .attr("preserveAspectRatio", "xMidYMid meet");  // Keep proportions, center image

    // Right-side panel (hidden until an organ is clicked)
    // This panel shows protein data when user clicks on an organ
    const sidePanel = document.createElement("div");
    sidePanel.id = "organ-sidepanel";
    sidePanel.style.width = "360px";                       // Fixed width for consistent layout
    sidePanel.style.maxHeight = `${height}px`;             // Match SVG height
    sidePanel.style.overflow = "auto";                     // Scrollable if content is too tall
    sidePanel.style.borderLeft = "1px solid #e6e6e6";      // Visual separator from SVG
    sidePanel.style.padding = "10px 12px";                 // Internal padding
    sidePanel.style.fontFamily = "sans-serif";             // Consistent typography
    sidePanel.style.background = "#ffffff";                // White background
    sidePanel.style.display = "none"; // shown when clicking an organ
    sidePanel.style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)";  // Subtle shadow for depth
    contentRow.appendChild(sidePanel);

    // small "no selection" placeholder inside sidePanel
    // Initial message displayed before any organ is clicked
    sidePanel.innerHTML = `<div style="color:#666;font-size:14px">Click an organ to view related proteins.</div>`;

    // Define organ positions and their corresponding queries
    // Each organ object contains: id, label, position (as percentages), size, and SPARQL query
    // xPct/yPct are percentages (0.0 to 1.0) of the SVG dimensions
    // rPct is radius as percentage of the smaller SVG dimension
    const organs = [
        { id: "brain", label: "Brain", xPct: 0.50, yPct: 0.07, rPct: 0.03, query: brain_query },
        { id: "heart", label: "Heart", xPct: 0.50, yPct: 0.44, rPct: 0.025, query: heart_query },
        { id: "lung", label: "Lungs", xPct: 0.40, yPct: 0.44, rPct: 0.025, query: lung_query },
        { id: "liver", label: "Liver", xPct: 0.40, yPct: 0.525, rPct: 0.025, query: liver_query },
        { id: "kidney", label: "Kidneys", xPct: 0.53, yPct: 0.61, rPct: 0.015, query: kidney_query },
        { id: "thyroid", label: "Thyroid", xPct: 0.4875, yPct: 0.26, rPct: 0.01, query: thyroid_query },
        { id: "mouth", label: "Mouth", xPct: 0.385, yPct: 0.185, rPct: 0.01, query: mouth_query },
        { id: "bladder", label: "Bladder", xPct: 0.49, yPct: 0.85, rPct: 0.01, query: bladder_query },
        { id: "pancreas", label: "Pancreas", xPct: 0.48, yPct: 0.53, rPct: 0.015, query: pancreas_query },
        { id: "gallbladder", label: "Gallbladder", xPct: 0.41, yPct: 0.57, rPct: 0.01, query: gallbladder_query },
        { id: "digestive", label: "Digestive System", xPct: 0.4875, yPct: 0.73, rPct: 0.045, query: digestive_query }
    ];

    // Draw organ overlays (small semi-transparent circles on top of the image)
    // Creates clickable areas positioned over the anatomical locations in the body image
    const organGroup = svg.append("g").attr("class", "organs");  // Group to hold all organ elements
    const base = Math.min(width, height);  // Use smaller dimension for radius calculation (keeps circles proportional)
    
    organs.forEach(o => {
        // Convert percentage positions to pixel coordinates
        const cx = Math.round(o.xPct * width);   // x position in pixels
        const cy = Math.round(o.yPct * height);  // y position in pixels  
        const r = Math.round(o.rPct * base);     // radius in pixels

        // visible semi-transparent circle (visual only)
        // This is the colored circle users see on the body image
        organGroup.append("circle")
            .attr("cx", cx)                          // Center x coordinate
            .attr("cy", cy)                          // Center y coordinate
            .attr("r", r)                            // Radius
            .attr("fill", "#ff7f0e")                 // Orange fill color
            .attr("fill-opacity", 0.24)              // Semi-transparent (24% opacity)
            .attr("stroke", "#ff7f0e")               // Orange border
            .attr("stroke-opacity", 0.7)             // More opaque border (70% opacity)
            .attr("stroke-width", 1.2)               // Border thickness
            .style("cursor", "pointer");             // Show hand cursor on hover

        // slightly larger, fully transparent hit area for easier clicking (this carries the data-organ)
        // Invisible larger circle that makes clicking easier and carries the organ identification
        organGroup.append("circle")
            .attr("cx", cx)                          // Same center as visible circle
            .attr("cy", cy)
            .attr("r", Math.round(r * 1.6))          // 60% larger radius for easier clicking
            .attr("fill", "transparent")             // Completely invisible
            .attr("data-organ", o.id)                // Data attribute for click handling
            .classed("organ-hitarea", true)          // CSS class for event targeting
            .style("cursor", "pointer");             // Show hand cursor

        // small label under the overlay (more visible)
        // Text label showing organ name positioned below the circle
        svg.append("text")
            .attr("x", cx)                           // Center horizontally with circle
            .attr("y", cy + r + 14)                  // Position below circle (radius + 14px margin)
            .attr("text-anchor", "middle")           // Center text horizontally
            .attr("font-family", "sans-serif")       // Font family
            .attr("font-weight", "700")              // Bold text
            .attr("font-size", 13)                   // Font size in pixels
            .attr("fill", "#333")                    // Dark gray color
            .attr("pointer-events", "none")          // Don't interfere with click events
            .text(o.label);                         // Display organ name
    });

    // Helper to render results into the right-side panel as a scrollable table
    // Takes organ definition and protein data, creates formatted table display
    function showSidePanelForOrgan(organDef, rows) {
        // Clear any existing content from the side panel
        sidePanel.innerHTML = "";
        
        // Create header section with title and close button
        const hdr = document.createElement("div");
        hdr.style.display = "flex";                    // Horizontal layout
        hdr.style.justifyContent = "space-between";    // Title left, button right
        hdr.style.alignItems = "center";               // Vertically center items
        hdr.style.marginBottom = "8px";                // Space below header

        // Create title showing organ name and result count
        const title = document.createElement("div");
        title.innerHTML = `<strong>${organDef.label}</strong> — ${rows.length} result${rows.length !== 1 ? "s" : ""}`;
        hdr.appendChild(title);

        // Create close button to hide the panel
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "Close";
        closeBtn.style.border = "none";                // Remove default border
        closeBtn.style.background = "#eee";            // Light gray background
        closeBtn.style.padding = "4px 8px";            // Internal padding
        closeBtn.style.borderRadius = "4px";           // Rounded corners
        closeBtn.style.cursor = "pointer";             // Hand cursor
        closeBtn.onclick = () => { sidePanel.style.display = "none"; };  // Hide panel when clicked
        hdr.appendChild(closeBtn);

        // Add header to panel
        sidePanel.appendChild(hdr);

        // Create data table for protein results
        const table = document.createElement("table");
        table.style.width = "100%";                    // Full width of panel
        table.style.borderCollapse = "collapse";       // Remove spacing between cells
        table.style.fontSize = "13px";                 // Compact text size

        // Create table header row
        const thead = document.createElement("thead");
        thead.innerHTML = `<tr>
            <th style="text-align:left;padding:6px 4px;border-bottom:1px solid #eee">Protein</th>
            <th style="text-align:left;padding:6px 4px;border-bottom:1px solid #eee">UniProt</th>
        </tr>`;
        table.appendChild(thead);

        // Create table body and populate with protein data
        const tbody = document.createElement("tbody");

        // Loop through each protein result and create a table row
        rows.forEach(r => {
            const tr = document.createElement("tr");
            // Extract protein name, trying different possible field names from SPARQL result
            const proteinLabel = r.proteinLabel?.value || r.itemLabel?.value || r.item?.value || "Unnamed";
            // Extract UniProt ID, trying different possible field names
            const uniprot = r.uniprotID?.value || r.uniprotid?.value || "";

            // Create row HTML with protein name and UniProt ID
            tr.innerHTML = `
                <td style="padding:8px 4px;border-bottom:1px solid #f4f4f4">${proteinLabel}</td>
                <td style="padding:8px 4px;border-bottom:1px solid #f4f4f4"><code style="font-size:12px;color:#444">${uniprot}</code></td>
            `;
            tbody.appendChild(tr);
        });

        // Add table to panel and show the panel
        table.appendChild(tbody);
        sidePanel.appendChild(table);
        sidePanel.style.display = "block";            // Make panel visible
    }

    // Click handlers: attach only to the hit areas to avoid double-firing
    // Set up event listeners for organ clicks - only targets the invisible hit areas
    organGroup.selectAll(".organ-hitarea")
        .on("click", async function(event) {
            // Get the organ ID from the clicked element's data attribute
            const organId = d3.select(this).attr("data-organ");
            // Find the organ definition object that matches this ID
            const organDef = organs.find(o => o.id === organId);
            if (!organDef) return;  // Exit if organ not found (shouldn't happen)

            // Show loading message immediately while query executes
            sidePanel.innerHTML = `<div style="color:#333;font-weight:600;margin-bottom:8px">${organDef.label}</div><div style="color:#666">Loading…</div>`;
            sidePanel.style.display = "block";

            try {
                // Check if we already have cached results for this organ
                if (!organCache[organId]) {
                    // Make SPARQL query to fetch protein data for this organ
                    // fetchSparql is injected via dependencies from functions.js
                    const rows = await fetchSparql(organDef.query);
                    // Cache the results to avoid repeated queries
                    organCache[organId] = rows;
                }
                // Get cached results (either just fetched or previously cached)
                const rows = organCache[organId] || [];
                
                if (rows.length === 0) {
                    // No proteins found for this organ
                    sidePanel.innerHTML = `<div style="color:#333;font-weight:600;margin-bottom:8px">${organDef.label}</div><div style="color:#666">No proteins found.</div>`;
                } else {
                    // Display proteins in formatted table
                    showSidePanelForOrgan(organDef, rows);
                }
            } catch (err) {
                // Handle any errors during the query process
                sidePanel.innerHTML = `<div style="color:#333;font-weight:600;margin-bottom:8px">${organDef.label}</div><div style="color:#c00">Error loading data</div>`;
                console.error(err);  // Log error details for debugging
            }

            // Prevent event from bubbling up to parent elements
            event.stopPropagation();
        });

    // Ensure we don't register multiple global click handlers when re-rendering
    // Set up click-outside-to-close functionality for the side panel
    const organDocClickHandler = (e) => {
        // If click happened outside the content area, hide the panel
        if (!contentRow.contains(e.target)) {
            sidePanel.style.display = "none";
        }
    };
    // Add the global click listener
    document.addEventListener("click", organDocClickHandler);
    // Store reference on chartDiv so it can be removed later if needed
    chartDiv._organDocClickHandler = organDocClickHandler;
}

// Export the function so it can be imported by other modules
export { renderHuman };
