export const aboutGuide = `
<div id="about-guide" class="about-guide">
  <p class="about-intro">Two ways to plan your walk: build a new route in <strong>Create</strong>, or shape existing GPX tracks in <strong>Edit</strong>.</p>
  <nav class="about-navigation" aria-label="About guide sections"><a href="#about-create">Create</a><a href="#about-edit">Edit</a><a href="#about-settings">Settings</a></nav>

  <section id="about-create" class="about-stream" aria-labelledby="about-create-title">
    <div class="about-stream-title"><span aria-hidden="true">01</span><h3 id="about-create-title">Create</h3><p>Build a route from map points</p></div>
    <h4>Draw and shape</h4>
    <ol class="help-list">
      <li><strong>Add points.</strong> Tap the map to place your start and each next point. Every tap extends the route, even near an existing line.</li>
      <li><strong>Insert or move.</strong> Choose Insert point, then tap a route line to insert between its neighbours. Add points resumes afterwards. Drag numbered markers to reshape the route.</li>
      <li><strong>Close a loop.</strong> Close loop joins the last point precisely to the start and includes the return leg in the distance.</li>
    </ol>
    <h4>Use your Route Card</h4>
    <p>The reduced card shows up to six point rows before scrolling. Tap a point number to locate it on the map; use its bin to remove it. With naming off, the card shows Point, grid reference, Height and Distance. Turn on Allow Point Naming in Settings to show editable names instead of reduced-view Distance.</p>
    <p>Expand Route Card for per-leg and cumulative distance and ascent. The expanded grid scrolls as needed and keeps Share Text and Share PDF visible. Full coordinate values are kept on one line by reducing their text size when necessary.</p>
    <h4>Fetch terrain</h4>
    <p>With at least two points and no fetched terrain, expanding the card opens a confirmation. Choose Fetch route terrain to send the route coordinates to Open Topo Data and sample heights along the legs. Cancel leaves the expanded card usable without fetching. Fetch terrain is also available on the reduced card.</p>
    <p>Heights and ascent are estimates. Missing values are shown as a dash; zero in the metrics does not supply a missing height. Moving, inserting or removing points clears fetched terrain so it can be refreshed. Failed or cancelled fetches leave the route unchanged and expansion remains available.</p>
    <h4>Save or start again</h4>
    <p>Name the route in its card and choose Created Route Colour in Settings. Save route exports GPX. Clear route asks before clearing the Create points; Undo can restore them. Your Edit tracks stay in place.</p>
  </section>

  <section id="about-edit" class="about-stream" aria-labelledby="about-edit-title">
    <div class="about-stream-title"><span aria-hidden="true">02</span><h3 id="about-edit-title">Edit</h3><p>Work with tracks and join sections</p></div>
    <h4>Open and select</h4>
    <ol class="help-list">
      <li><strong>Open files.</strong> Import GPX tracks or routes from Files, including multiple tracks in one file. Choose a track in Your Tracks to work on it.</li>
      <li><strong>Choose A–B.</strong> Drag the map handles or use the start/end sliders. The selection metrics and elevation profile update immediately. Select whole track restores the complete selection.</li>
      <li><strong>Shape a section.</strong> Save section exports A–B. Split creates two tracks sharing the split point. Reverse changes the whole selected track’s direction. Source GPX files are not overwritten automatically.</li>
    </ol>
    <h4>Build a joined route</h4>
    <p>Start joined route with section, then choose other tracks and Append section to route in walking order. Dashed lines mark straight walking connections between separated sections. Their distance counts; Fetch gap terrain adds sampled heights along those connections. Preview selects the joined route on the map.</p>
    <h4>Read and share the Edit Route Card</h4>
    <p>The card at the bottom initially shows the whole selected track. Choosing A–B changes it to that section. <strong>When a joined route exists, the card always shows the entire joined route</strong>, even while you select source sections to append.</p>
    <p>The reduced card scrolls after six point rows. Expand it for cumulative distance and ascent, with Share Text and Share PDF fixed at the bottom. Both sharing options and the card’s Save button use all points in the displayed section or joined route, including points reached by scrolling.</p>
    <p>Point numbers refer to the source track, or the new walking order of a joined route. Tap one to locate it on the Edit map. If point naming is enabled, names can be edited here and those edits use Edit’s Undo history. Point bins are available only in Create.</p>
    <h4>Clear without losing your track library</h4>
    <p>The card’s Clear route asks before clearing the joined route and current Edit selection. Imported tracks remain in Your Tracks and the Create draft is untouched. Undo restores the cleared route. The bin in Your Tracks removes a track from this workspace; its original file stays in Files.</p>
  </section>

  <section id="about-settings" class="about-common">
    <h3>Settings</h3>
    <p>Open Settings using the cog beneath ?. Preferences are remembered on this device.</p>
    <h4>Created Route Colour</h4>
    <p>Use the spectrum, a preset or a hex value, then Apply colour. This sets the Create route and its GPX export. Imported tracks have their own Line colour control in Edit, using the same picker. Colour changes preserve fetched terrain.</p>
    <h4>Allow Point Naming</h4>
    <p>This is off by default. Turn it on to show the Name column in both cards and edit names of up to 10 characters. Off hides Name and adds Distance to the reduced grid; it does not delete names already stored with points.</p>
    <h3>Grid references</h3>
    <p>Available Systems offers Lat/Long (WGS84), Irish National Grid, British National Grid, Irish Transverse Mercator (ITM), MGRS, UTM and USNG. The choice applies immediately to both Route Cards, map-centre readouts and shared text/PDF cards. Grid headings use shorter labels. GPX always uses WGS84 Lat/Long, regardless of the display choice.</p>
    <p class="about-detail">Irish and British grid references use approximate datum conversions. ITM uses ETRS89; global formats use WGS84. Reference precision does not imply equivalent GPS accuracy. UTM, MGRS and USNG cover 80°S to 84°N. Regional grids identify positions outside their coverage.</p>
  </section>

  <section class="about-common">
    <h3>Maps, terrain and location</h3>
    <p>Lines connect points directly and do not automatically follow roads or paths. Check that the route follows walkable ground. The optional Irish samples are illustrative tracks, loaded only when requested.</p>
    <p>Create and Edit keep separate maps. Fit frames the relevant tracks; Expand map gives more space while keeping the header and metrics visible. The crosshair requests your current position only when tapped, showing a dot and accuracy circle. It never adds a point or starts background tracking.</p>
    <p>Map tiles and optional terrain requests need internet access. Terrain confirmations explain that coordinates are sent to Open Topo Data. Map outages do not prevent editing or export; Retry reloads the tiles. Missing elevations produce unavailable or partial ascent rather than invented heights.</p>
    <h3>Files, saving and undo</h3>
    <p>Saved on device means automatic workspace recovery, not an exported GPX file. Export routes you want to keep before uninstalling the app or clearing its data. Native apps use the system Files picker; browsers use file access or downloads. Share PDF creates a landscape route card; if browser sharing is unavailable, the PDF downloads. Share Text offers a copyable preview where device sharing is unavailable.</p>
    <p>Create and Edit have separate Undo/Redo histories. Use ⌘/Ctrl + Z to undo and ⌘/Ctrl + Shift + Z to redo. Escape closes a dialog or collapses an expanded card or map. The workspace survives reopening; Undo history does not.</p>
  </section>
  <button class="button primary full" data-close>Done</button>
</div>`;
