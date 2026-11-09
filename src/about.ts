export const aboutGuide = `
<div id="about-guide" class="about-guide">
  <section class="about-overview" aria-labelledby="about-overview-title">
    <h3 id="about-overview-title">Overview</h3>
    <p><strong>BareGPS Route Planner helps you turn a walking idea or existing GPX tracks into a practical route and a shareable Route Card.</strong> Draw and reshape routes on a map, trim and combine inputs in walking order, inspect distance and elevation, choose regional grid references, and save GPX or share text and PDF cards. Create New and Edit Existing give each task its own workspace; Open in Edit connects them when you are ready.</p>
    <p><strong>Designed for planning.</strong> Lines connect points directly, including joins between tracks; they do not automatically follow roads or paths. Check access and walkable ground yourself. Live navigation, turn-by-turn guidance, activity recording and emergency assistance are outside the app’s scope. The current-position button gives a single location fix, not tracking.</p>
    <p><strong>Useful estimates, with clear boundaries.</strong> Heights and ascent support planning, rather than surveying or safety-critical decisions. Map tiles and terrain services need internet and are subject to availability and processing limits; there is no downloadable offline map pack. GPX exports carry planned geometry and supported point information, rather than preserving every item in an activity file. Keep your original GPX files and export routes you want to retain: Saved on device is workspace recovery, not a project backup or cloud sync.</p>
  </section>

  <details id="about-create" class="about-section">
    <summary><h3>Create New</h3></summary>
    <div class="about-section-content">
      <p><strong>Draw.</strong> Tap the map to place your start and each next point. Add points extends the route on every tap, even near an existing line. Insert point adds between neighbours when you tap the line, then returns to Add points. Drag numbered markers to reshape; tap a marker and use Delete point, or use its Route Card bin. Close loop joins the end precisely to the start, including the return distance.</p>
      <p><strong>Prepare and save.</strong> Name the route in its card. Fetch Terrain estimates heights along its legs; Save Route fetches any terrain still needed before GPX export. Previously fetched terrain is reused. If a fetch fails, retry or explicitly choose Save without terrain. Clear route asks before clearing the drawing; Undo can restore it. Edit inputs remain intact.</p>
      <p><strong>Continue in Edit.</strong> With at least two points, Open in Edit copies the route and available terrain into Input Tracks, selects it and opens its editing handles. Your Create draft stays unchanged. The copies are independent, no terrain is fetched by the handoff, and nothing is added to Route Plan or confirmed automatically.</p>
    </div>
  </details>

  <details id="about-edit" class="about-section">
    <summary><h3>Edit Existing: input tracks</h3></summary>
    <div class="about-section-content">
      <p><strong>Open and select.</strong> Open GPX files, then select a track in Input Tracks. The map, metrics and elevation profile follow the selected input; the confirmed Route Card remains separate. Importing and editing do not overwrite the original file.</p>
      <p><strong>Shape the input.</strong> Add points extends the end; Insert point adds near the line; Delete point removes the selected point; Close loop joins the end to the start. Drag numbered handles to reshape. Dense points between handles move with a taper towards neighbouring handles. Tap the line to reveal an additional existing point.</p>
      <p><strong>Trim and reverse.</strong> Select a numbered handle. Trim before or Trim after removes points on that side while keeping the selected point and at least two points overall. Use both trims to keep a middle portion. Reverse changes the walking direction. Undo/Redo restores edits.</p>
      <p><strong>Name, colour and heights.</strong> Use the pencil beside an input to rename its workspace copy. The original filename and existing Route Plan snapshots stay unchanged. Each input has a colour circle beside its bin. Moving points clears affected stale heights and times; trimming retains the remaining points’ data. Fetch Terrain below the map refreshes the input after confirmation. It does not update existing plan copies or the confirmed output.</p>
      <p><strong>Handle spacing.</strong> Settings → Input Track Editing starts at one handle every 20 points, always including endpoints. At most 200 handles appear at once; zoom or pan to reveal others. Spacing changes the controls, not the underlying point count.</p>
    </div>
  </details>

  <details class="about-section">
    <summary><h3>Route Plan and confirmed output</h3></summary>
    <div class="about-section-content">
      <p><strong>Add and arrange.</strong> Add to Route Plan, below the editing controls, stores a snapshot of the whole current input. Route Plan sits below Input Tracks and reopens the saved plan. Select plan rows to Move up, Move down or Remove; Alt + Up/Down also reorders a selected row. When every listed input has contributed, the input selection clears. Select an input again to keep editing.</p>
      <p><strong>Update a snapshot deliberately.</strong> Later input edits leave saved plan copies unchanged. Select the edited input, open Route Plan, select its old row and choose Replace selected track with current input. Its position is retained.</p>
      <p><strong>Confirm Route.</strong> This builds the output in walking order and updates the Route Card, initially named Edited Route. It fetches missing or invalidated heights and new connections, retaining valid recorded heights. Unchanged complete terrain is reused. Dashed map lines mark straight connections between separated inputs; their distance counts towards the walk.</p>
      <p><strong>Failure and cancellation.</strong> Retry terrain tries again; Back to Route Plan preserves the previous output. Confirm without terrain explicitly creates an incomplete result with partial ascent. Confirm Route can retry later. Cancelling a fetch leaves the plan and previous confirmed route unchanged.</p>
      <p><strong>Preview and clear.</strong> Preview shows the confirmed output on the map. Use the × Preview Mode control at the upper left to return to the input. Changes to the plan replace the output only when confirmed again. Clear route asks before clearing the plan and confirmed output; it keeps Input Tracks and the Create draft. Undo restores the cleared route.</p>
    </div>
  </details>

  <details class="about-section">
    <summary><h3>Route Cards, saving and sharing</h3></summary>
    <div class="about-section-content">
      <p><strong>Read the card.</strong> Point numbers follow walking order; tap one to locate it on the map. Cards scroll after six rows in the normal view. Create has point bins at the right; Edit displays the entire confirmed route and has no point bins. Large Edit cards display a moving window of rows, while calculations and exports retain all points.</p>
      <p><strong>App and web layouts.</strong> The native app’s compact card shows Point, grid reference, Height and Distance; enabling point names swaps Distance for Name. Expand for per-leg and cumulative distance and ascent. On the web, those measures are visible before expansion, and the expanded table fills the available width. Narrow windows can scroll sideways.</p>
      <p><strong>Export.</strong> Save Route exports GPX using the card’s route name. Share Text creates a route summary and point table; Share PDF creates a landscape card. Expansion and sharing never fetch terrain. Where system sharing is unavailable, text can be copied and PDFs download. Very dense tracks can produce unwieldy text or PDFs: use GPX for exchanging detailed route geometry.</p>
      <p><strong>Name points.</strong> Enable Allow Point Naming in Settings to show editable names, with new names limited to 10 characters. Hiding names keeps stored names intact. Names in the confirmed Edit card use Edit Undo.</p>
    </div>
  </details>

  <details class="about-section">
    <summary><h3>Terrain status and elevation</h3></summary>
    <div class="about-section-content">
      <p>The status below the elevation profile follows the route or input currently shown: <strong>Terrain not fetched</strong> means heights are unavailable; <strong>Terrain up to date</strong> means heights are available with no known pending geometry changes; <strong>Terrain needs refresh</strong> means edits have invalidated heights; <strong>Terrain incomplete</strong> means some heights or connection estimates are missing. “Up to date” is a data state, not a guarantee of accuracy or a recent survey.</p>
      <p>Terrain requests send route coordinates to Open Topo Data, using its Mapzen dataset and sampling legs at roughly 90-metre intervals. Create fetches from its Route Card or before Save; Edit fetches the input below the map, or completes output terrain during Confirm Route. Changing Create geometry invalidates its previous terrain.</p>
      <p>Ascent adds positive height changes; descent adds negative changes. Heights are not smoothed, so noisy recorded data can inflate totals. Missing card heights show a dash. A zero ascent metric does not mean flat ground when heights are unavailable. Incomplete heights give partial totals; unsampled connections may miss hills between endpoints.</p>
      <p>Terrain is an external service with request and job limits. A dense GPX without heights can be editable yet too large for a terrain job; very long legs can also need intermediate points. Service availability is separate from local editing. Failed or cancelled fetches leave the existing route intact.</p>
    </div>
  </details>

  <details class="about-section">
    <summary><h3>Maps and current position</h3></summary>
    <div class="about-section-content">
      <p>Both screens use OpenTopoMap. Fit frames the relevant tracks; Expand map gives more room. Maps need internet; no offline tile pack is provided. You can import and edit locally without maps. A confirmed Edit route can export offline; Create Save offers an explicit Save without terrain choice if its fetch fails.</p>
      <p>The crosshair requests one current-position fix after you tap it and grant permission. A dot and accuracy circle show the result; it never adds a route point or starts background tracking. Position accuracy depends on the device and conditions.</p>
      <p>Retry reloads failed tiles; × dismisses a map warning. Warnings clear when failed tiles recover or leave view, and reconnecting retries failures. Map detail and direct connecting lines do not establish a right of access or a safe walking route.</p>
    </div>
  </details>

  <details id="about-settings" class="about-section">
    <summary><h3>Settings</h3></summary>
    <div class="about-section-content">
      <p>Open the cog beneath ?. Preferences are remembered on this device.</p>
      <p><strong>Created Route Colour.</strong> Choose from the spectrum, presets or a hex value, then Apply colour. This sets the Create line and export colour; existing terrain is retained. Inputs have independent colour controls. New imports without a saved colour begin red, blue and pink; joined routes begin green.</p>
      <p><strong>Allow Point Naming.</strong> Off by default. It shows or hides the Name column without deleting names.</p>
      <p><strong>Input Track Editing.</strong> Handle every sets input editing-handle spacing; Apply saves it and updates the editor. It never simplifies the track. Deletion and trimming change inputs, while plan snapshots and the confirmed output remain separate.</p>
    </div>
  </details>

  <details class="about-section">
    <summary><h3>Grid references and coordinates</h3></summary>
    <div class="about-section-content">
      <p>Settings offers Lat/Long (WGS84), Irish National Grid, British National Grid, Irish Transverse Mercator (ITM), MGRS, UTM and USNG. Your choice applies to map-centre readouts, both Route Cards and text/PDF exports. GPX always stores WGS84 latitude/longitude.</p>
      <p>Irish and British grid references use approximate datum conversions. ITM uses ETRS89; global formats use WGS84. Regional grids identify positions outside their coverage. UTM, MGRS and USNG cover 80°S to 84°N. Reference precision does not imply matching GPS accuracy; these are planning references, not surveying measurements. Long values may use smaller text to fit.</p>
    </div>
  </details>

  <details class="about-section">
    <summary><h3>GPX support and intended use</h3></summary>
    <div class="about-section-content">
      <p>Exports contain planned route geometry and supported point information, including names and available elevations. Some imported content, including standalone waypoints, activity extensions such as heart rate, and original descriptions, is not preserved. Keep original files for your complete recording or archive.</p>
      <p>Export writes one track segment and uses BareGPS gap extensions for discontinuities. Other apps may ignore that styling and draw continuous lines between parts. Check the exported route in your intended app or device.</p>
      <p>Retained timestamps can run backwards after Reverse, or jump between recordings when joining tracks. Geometry edits can remove affected times. Use outputs as planned routes, rather than evidence of a recorded activity, speed or chronology.</p>
      <p>Create supports up to 1,000 waypoints; GPX tracks support up to 150,000 points, subject to workspace limits. These are data limits, not a promise that every phone or terrain job handles the largest file comfortably. Working with smaller inputs can make editing and sharing more practical.</p>
    </div>
  </details>

  <details class="about-section">
    <summary><h3>Local saving, data and recovery</h3></summary>
    <div class="about-section-content">
      <p><strong>Saved on device</strong> means automatic workspace recovery, not a GPX export or a complete project backup. Export routes you want to keep before uninstalling, clearing app or browser data, or changing devices. There is no built-in cloud sync or full-project backup/restore. A GPX export does not preserve the complete input library and planning workspace.</p>
      <p>Importing and editing happen locally. Network requests are used for maps and terrain; map requests reveal the viewed area and terrain requests include route coordinates. The browser terrain relay uses Cloudflare before reaching Open Topo Data. Sharing or exporting passes the chosen output to the destination you select. This guide describes the workflow; it is not a complete privacy policy.</p>
      <p>Original files stay untouched unless you choose to overwrite one when saving. The Input Tracks bin removes the workspace copy, not its original file. Native apps use system file controls; browsers use available file access or downloads.</p>
    </div>
  </details>

  <details class="about-section">
    <summary><h3>Undo and keyboard shortcuts</h3></summary>
    <div class="about-section-content">
      <p>Deleting points, removing inputs or plan entries, trimming and clearing routes all ask for confirmation first. Cancel keeps the current data unchanged. Confirmed removals can be undone.</p>
      <p>Create and Edit keep separate Undo/Redo histories. Use the header arrows, ⌘/Ctrl + Z to undo, or ⌘/Ctrl + Shift + Z to redo. Workspace recovery survives reopening; Undo history does not.</p>
      <p>Escape closes a dialog or collapses an expanded card or map. In Route Plan, Alt + Up/Down reorders the selected row. Expand any heading in this guide to read it; activate it again to close it.</p>
    </div>
  </details>
  <details id="about-credits" class="about-section">
    <summary><h3>Credits &amp; Attributions</h3></summary>
    <div class="about-section-content">
      <p><strong>Copyright.</strong> © AppsbyOnzy · <a href="mailto:appsbyonzy@gmail.com">appsbyonzy@gmail.com</a></p>
      <p><strong>The BareGPS family.</strong> Visit <a href="https://appsbyonzy.dev" target="_blank" rel="noopener noreferrer">appsbyonzy.dev</a> for BareGPS apps and other outdoor mapping tools.</p>
      <p><strong>Maps.</strong> Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>, available under the Open Database Licence (ODbL), with SRTM elevation data. Map rendering © <a href="https://opentopomap.org" target="_blank" rel="noopener noreferrer">OpenTopoMap</a>, under <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer">CC BY-SA</a>. Thanks to the contributors who create and maintain these maps.</p>
      <p><strong>Terrain heights.</strong> Elevation estimates use <a href="https://www.opentopodata.org/datasets/mapzen/" target="_blank" rel="noopener noreferrer">Open Topo Data’s Mapzen dataset</a>, assembled from multiple open elevation sources. Credits and source-specific terms are listed in the <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener noreferrer">Mapzen / Tilezen terrain attributions</a>.</p>
      <p><strong>Open-source software.</strong> Built with <a href="https://capacitorjs.com" target="_blank" rel="noopener noreferrer">Capacitor</a> for the native app, <a href="https://leafletjs.com/" target="_blank" rel="noopener noreferrer">Leaflet</a> for interactive maps, <a href="https://proj4js.org/" target="_blank" rel="noopener noreferrer">Proj4js</a> and <a href="https://github.com/proj4js/mgrs" target="_blank" rel="noopener noreferrer">mgrs</a> for coordinate conversions, <a href="https://github.com/parallax/jsPDF" target="_blank" rel="noopener noreferrer">jsPDF</a> and <a href="https://github.com/simonbengtsson/jsPDF-AutoTable" target="_blank" rel="noopener noreferrer">jsPDF-AutoTable</a> for PDF cards, <a href="https://github.com/jakearchibald/idb-keyval" target="_blank" rel="noopener noreferrer">idb-keyval</a> for local storage, and <a href="https://github.com/web-padawan/vanilla-colorful" target="_blank" rel="noopener noreferrer">vanilla-colorful</a> for colour selection. These projects and their contributors retain their respective copyrights and licences.</p>
      <p><strong>Web hosting.</strong> The web preview and its terrain relay are hosted through Cloudflare.</p>
    </div>
  </details>
  <button class="button primary full" data-close>Done</button>
</div>`;
