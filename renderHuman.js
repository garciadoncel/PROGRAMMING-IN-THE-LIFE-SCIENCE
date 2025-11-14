// Simple cache to avoid repeated organ queries
const organCache = {};

// Human body renderer with hover-to-load-organ-details
export function renderHuman(results) {
    let chartDiv = document.getElementById("chart");
    if (!chartDiv) {
        chartDiv = document.createElement("div");
        chartDiv.id = "chart";
        document.body.appendChild(chartDiv);
    } else {
        chartDiv.innerHTML = "";
    }

    const width = Math.min(window.innerWidth, 600);
    const height = Math.min(window.innerHeight - 200, 900);

    // Instruction / placeholder when no data is passed
    const header = document.createElement("div");
    header.style.padding = "10px 14px";
    header.style.fontFamily = "sans-serif";
    header.style.color = "#333";
    header.innerHTML = `<strong>Human body view</strong> — click an organ to load related proteins (from Wikidata).`;
    chartDiv.appendChild(header);

    // Create a content row so we can place the SVG and a right-side panel next to each other
    const contentRow = document.createElement("div");
    contentRow.style.display = "flex";
    contentRow.style.alignItems = "flex-start";
    contentRow.style.gap = "12px";
    contentRow.style.padding = "8px 14px";
    chartDiv.appendChild(contentRow);

    // SVG (left)
    const svg = d3.select(contentRow)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("background", "#ffffff");

    // Body image as background (place file at assets/body.png or adjust path)
    const bodyImgPath = "assets/body.png";
    svg.append("image")
        .attr("href", bodyImgPath)
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", width)
        .attr("height", height)
        .attr("preserveAspectRatio", "xMidYMid meet");

    // Right-side panel (hidden until an organ is clicked)
    const sidePanel = document.createElement("div");
    sidePanel.id = "organ-sidepanel";
    sidePanel.style.width = "360px";
    sidePanel.style.maxHeight = `${height}px`;
    sidePanel.style.overflow = "auto";
    sidePanel.style.borderLeft = "1px solid #e6e6e6";
    sidePanel.style.padding = "10px 12px";
    sidePanel.style.fontFamily = "sans-serif";
    sidePanel.style.background = "#ffffff";
    sidePanel.style.display = "none"; // shown when clicking an organ
    sidePanel.style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)";
    contentRow.appendChild(sidePanel);

    // small "no selection" placeholder inside sidePanel
    sidePanel.innerHTML = `<div style="color:#666;font-size:14px">Click an organ to view related proteins.</div>`;

    const organs = [
        { id: "brain", label: "Brain", xPct: 0.50, yPct: 0.07, rPct: 0.03, query: brain_query },
        { id: "heart", label: "Heart", xPct: 0.50, yPct: 0.44, rPct: 0.025, query: heart_query },
        // add more organs using percentage coords, e.g.
    ];

    // Draw organ overlays (small semi-transparent circles on top of the image)
    const organGroup = svg.append("g").attr("class", "organs");
    const base = Math.min(width, height);
    organs.forEach(o => {
        const cx = Math.round(o.xPct * width);
        const cy = Math.round(o.yPct * height);
        const r = Math.round(o.rPct * base);

        // visible semi-transparent circle
        organGroup.append("circle")
            .attr("cx", cx)
            .attr("cy", cy)
            .attr("r", r)
            .attr("fill", "#ff7f0e")
            .attr("fill-opacity", 0.24)
            .attr("stroke", "#ff7f0e")
            .attr("stroke-opacity", 0.7)
            .attr("stroke-width", 1.2)
            .attr("data-organ", o.id)
            .style("cursor", "pointer");

        // slightly larger, fully transparent hit area for easier clicking
        organGroup.append("circle")
            .attr("cx", cx)
            .attr("cy", cy)
            .attr("r", Math.round(r * 1.6))
            .attr("fill", "transparent")
            .attr("data-organ", o.id)
            .style("cursor", "pointer");

        // small label under the overlay
        svg.append("text")
            .attr("x", cx)
            .attr("y", cy + r + 14)
            .attr("text-anchor", "middle")
            .attr("font-size", 12)
            .attr("fill", "#666")
            .text(o.label);
    });

    // Helper to render results into the right-side panel as a scrollable table
    function showSidePanelForOrgan(organDef, rows) {
        // build header with close button
        sidePanel.innerHTML = "";
        const hdr = document.createElement("div");
        hdr.style.display = "flex";
        hdr.style.justifyContent = "space-between";
        hdr.style.alignItems = "center";
        hdr.style.marginBottom = "8px";

        const title = document.createElement("div");
        title.innerHTML = `<strong>${organDef.label}</strong> — ${rows.length} result${rows.length !== 1 ? "s" : ""}`;
        hdr.appendChild(title);

        const closeBtn = document.createElement("button");
        closeBtn.textContent = "Close";
        closeBtn.style.border = "none";
        closeBtn.style.background = "#eee";
        closeBtn.style.padding = "4px 8px";
        closeBtn.style.borderRadius = "4px";
        closeBtn.style.cursor = "pointer";
        closeBtn.onclick = () => { sidePanel.style.display = "none"; };
        hdr.appendChild(closeBtn);

        sidePanel.appendChild(hdr);

        // build table
        const table = document.createElement("table");
        table.style.width = "100%";
        table.style.borderCollapse = "collapse";
        table.style.fontSize = "13px";

        const thead = document.createElement("thead");
        thead.innerHTML = `<tr>
            <th style="text-align:left;padding:6px 4px;border-bottom:1px solid #eee">Protein</th>
            <th style="text-align:left;padding:6px 4px;border-bottom:1px solid #eee">UniProt</th>
        </tr>`;
        table.appendChild(thead);

        const tbody = document.createElement("tbody");

        // limit but allow scroll for full results
        rows.forEach(r => {
            const tr = document.createElement("tr");
            const proteinLabel = r.proteinLabel?.value || r.itemLabel?.value || r.item?.value || "Unnamed";
            const uniprot = r.uniprotID?.value || r.uniprotid?.value || "";

            tr.innerHTML = `
                <td style="padding:8px 4px;border-bottom:1px solid #f4f4f4">${proteinLabel}</td>
                <td style="padding:8px 4px;border-bottom:1px solid #f4f4f4"><code style="font-size:12px;color:#444">${uniprot}</code></td>
            `;
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        sidePanel.appendChild(table);
        sidePanel.style.display = "block";
    }

    // Click handlers: load organ query (cached) and display results in side panel
    organGroup.selectAll("[data-organ]")
        .on("click", async function(event) {
            // find the organ id (elements include both visible and hit-area circles)
            const organId = d3.select(this).attr("data-organ");
            const organDef = organs.find(o => o.id === organId);
            if (!organDef) return;

            // show loading message
            sidePanel.innerHTML = `<div style="color:#333;font-weight:600;margin-bottom:8px">${organDef.label}</div><div style="color:#666">Loading…</div>`;
            sidePanel.style.display = "block";

            try {
                if (!organCache[organId]) {
                    const rows = await fetchSparql(organDef.query);
                    organCache[organId] = rows;
                }
                const rows = organCache[organId] || [];
                if (rows.length === 0) {
                    sidePanel.innerHTML = `<div style="color:#333;font-weight:600;margin-bottom:8px">${organDef.label}</div><div style="color:#666">No proteins found.</div>`;
                } else {
                    showSidePanelForOrgan(organDef, rows);
                }
            } catch (err) {
                sidePanel.innerHTML = `<div style="color:#333;font-weight:600;margin-bottom:8px">${organDef.label}</div><div style="color:#c00">Error loading data</div>`;
                console.error(err);
            }

            // Stop propagation so clicking an organ doesn't trigger other listeners
            event.stopPropagation();
        });

    // Optional: clicking outside panel hides it
    document.addEventListener("click", (e) => {
        // if click is outside contentRow (svg+panel), hide panel
        if (!contentRow.contains(e.target)) {
            sidePanel.style.display = "none";
        }
    });
}
