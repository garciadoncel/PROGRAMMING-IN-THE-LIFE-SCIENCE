# Protein Sorting for Biological Function and Organ Mapping  
### README

## RQ: What are the links between the proteins and the biological processes in the human bodies? 

This project delivers an interactive web platform designed to explore how human proteins are organized, and functionally associated with specific organs. It serves as an intuitive tool for students, researchers, and anyone curious about proteomics.

When you open the HTML file, you’re taken to a dynamic interface where the dataset can be viewed in multiple formats. A **table view** provides a clear, structured listing of proteins, their ID's, and the biological processes for which they are invcolved. For visual learners, the **bubble graph** offers a proportional representation of protein presence and relevance, while the **network chart** shows relationships and interactions within the dataset.

A **search bar** allows queries by protein name, protein ID or biological process for quick access, and the **refresh button** resets the view so you can start new searches without fuss. The highlight is the **interactive human body graphic**. Clicking an organ instantly displays the proteins associated with it, making physiological connections obvious and easy to navigate. 

## Steps on how to access the interactive web page

1. Go to the home page, to the main branch of the repository.
2. Find a button labelled "code" that will the allow you to download the repository as a ZIP file.
2. Download the repository as a ZIP file.
3. Extract the folder from this ZIP file, and find the "Index2.html".
4. Open "Index2.html" on any browser to access the web page.

## Purpose and utility of each file:

1. # index2.html

This is the main entry point of the web page. It defines the layout of the page, including the control bar, display mode selector, query buttons, and the results table. It also loads the D3 library and all JavaScript modules that power the different interactive visualizations.

2. # functions.js

This file acts as the central controller for the web page. It:
- Defines the SPARQL endpoint and the main query for retrieving human proteins, UniProt IDs, and biological processes.
- Automatically runs the default query on page load.
- Builds and manages the search bar, allowing searches by protein name, UniProt ID, or biological process.
- Safely constructs search queries and fetches data from Wikidata.
- Calls the appropriate renderer (table, network graph, bubble chart, or human body view) depending on the selected display mode.

3. # renderTable.js

Responsible for rendering query results in a structured table format. It populates the results table with:
- Protein label
- UniProt ID
- Biological process URL (as a clickable link)
- Biological process label

It also handles displaying a fallback message when no results are found.

4. # renderNetworkGraph.js

Builds the interactive force-directed network graph using D3. This visualization constructs:
- Nodes for proteins and biological processes
- Links between them based on query results

Features include:
- Zoom and pan
- Draggable nodes
- Color-coded nodes depending on the search type
- Clickable nodes that open external pages (Wikidata, UniProt)

5. # renderBubble.js

Creates the bubble chart visualization. It groups data by biological process and displays:
- A bubble for each biological process
- Bubble size proportional to the number of proteins involved
- Color intensity representing frequency

Clicking a bubble displays a detailed table listing proteins associated with that process.

6. # renderHuman.js

Powers the interactive human body visualization. It overlays clickable organ regions onto a human body image. Each organ triggers a specialized SPARQL query to fetch:
- Proteins associated with that organ
- Biological processes

Results appear in a side panel. Data is cached to avoid repeated queries.