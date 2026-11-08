export const aboutGuide = `
<div id="about-guide" class="about-guide">
  <p class="about-intro">Two ways to plan your walk: build a new route in <strong>Create New</strong>, or shape existing GPX tracks in <strong>Edit Existing</strong>.</p>
  <nav class="about-navigation" aria-label="About guide sections"><a href="#about-create">Create New</a><a href="#about-edit">Edit Existing</a><a href="#about-settings">Settings</a></nav>

  <section id="about-create" class="about-stream" aria-labelledby="about-create-title">
    <div class="about-stream-title"><span aria-hidden="true">01</span><h3 id="about-create-title">Create New</h3><p>Build a route from map points</p></div>
    <h4>Draw and shape</h4>
    <ol class="help-list">
      <li><strong>Add points.</strong> Tap the map to place your start and each next point. Every tap extends the route, even near an existing line.</li>
      <li><strong>Insert or move.</strong> Choose Insert point, then tap a route line to insert between its neighbours. Add points resumes afterwards. Drag numbered markers to reshape the route. Tap a marker to select it, then use Delete point to remove it.</li>
      <li><strong>Close a loop.</strong> Close loop joins the last point precisely to the start and includes the return leg in the distance.</li>
    </ol>
    <h4>Use your Route Card</h4>
    <p>The reduced card shows up to six point rows before scrolling. Tap a point number to locate it on the map; use its bin to remove it. With naming off, the card shows Point, grid reference, Height and Distance. Turn on Allow Point Naming in Settings to show editable names instead of reduced-view Distance.</p>
    <p>Expand Route Card for per-leg and cumulative distance and ascent. The expanded grid scrolls as needed and keeps Share Text and Share PDF visible. Full coordinate values are kept on one line by reducing their text size when necessary.</p>
    <h4>Fetch terrain</h4>
    <p>With at least two points, use Fetch Terrain on the reduced Create Route Card when you want heights. Choose Fetch route terrain in its confirmation to send coordinates to Open Topo Data and sample heights along the legs. Save Route also fetches any terrain still needed before exporting; previously fetched terrain is reused. If it fails, retry or explicitly choose Save without terrain. Expanding or sharing the card never starts a fetch.</p>
    <p>Heights and ascent are estimates. Missing values are shown as a dash; zero in the metrics does not supply a missing height. Moving, inserting or removing points clears fetched terrain so it can be refreshed. Failed or cancelled fetches leave the route unchanged and expansion remains available.</p>
    <h4>Save or start again</h4>
    <p>Name the route in its card and choose Created Route Colour in Settings. Save route exports GPX with the default filename Created Route.gpx. Clear route asks before clearing the Create points; Undo can restore them. Your Edit tracks stay in place.</p>
  </section>

  <section id="about-edit" class="about-stream" aria-labelledby="about-edit-title">
    <div class="about-stream-title"><span aria-hidden="true">02</span><h3 id="about-edit-title">Edit Existing</h3><p>Work with tracks and join sections</p></div>
    <h4>Open and edit an input track</h4>
    <p>Open GPX files, then select an input in Input Tracks. The entire input is editable immediately, with numbered handles on the map. Metrics and the elevation profile show the whole selected input. There are no A–B sections, sliders or separate editing modes.</p>
    <p>The map toolbar matches Create New: <strong>Add points</strong> extends the end, <strong>Insert point</strong> adds where you tap near the line, <strong>Delete point</strong> removes the selected point and <strong>Close loop</strong> joins the end to the start. Drag a handle to reshape the track, or tap the line to expose an additional existing point. Intervening dense points move gradually, tapering to neighbouring handles.</p>
    <h4>Select a point and trim</h4>
    <p>Tap a numbered handle to select it. Trim before, Trim after, Reverse and Fetch Terrain occupy one equal-width row below the map editing toolbar. <strong>Trim before</strong> removes every point before it; <strong>Trim after</strong> removes every point after it. Both keep the selected point. A trim must leave at least two points, and controls are disabled where no valid trim is possible. Use both trims in turn to keep just the part you want. <strong>Delete point</strong> removes only the selected point. Undo/Redo restores these edits.</p>
    <p>Handle spacing is set under <strong>Settings → Input Track Editing</strong>, starting at every 20 points, with the first and last always included. Spacing does not remove or simplify points. Up to 200 handles are displayed at once; zoom or pan to reveal others. Trimming renumbers the remaining points.</p>
    <h4>Reverse, colour and refresh heights</h4>
    <p><strong>Reverse</strong> changes its walking direction. Each Input Tracks row has a colour circle beside its bin, using the same picker as Create. The original GPX file stays untouched unless you explicitly overwrite it when saving.</p>
    <p>Moving points clears their stale heights and times. <strong>Fetch Terrain</strong> below the map toolbar estimates heights along changed legs after the Fetch Terrain Heights confirmation. Trimming preserves the retained points’ heights and times. Failed or cancelled fetches leave the input unchanged.</p>
    <h4>Build a Route Plan</h4>
    <ol class="help-list">
      <li><strong>Add to Route Plan.</strong> Store a copy of the entire edited input and open the planning grid. Once every listed input has been added, the input selection clears; select an input again to continue working.</li>
      <li><strong>Keep adding.</strong> Return to Input Tracks to work on another input. Route Plan reopens the saved list. Select rows and use Move up, Move down or Remove to arrange the walking order. Alt + Up/Down also moves a selected row.</li>
      <li><strong>Replace a planned track.</strong> Later input edits leave plan copies unchanged. Select the edited input, open Route Plan, select the old row and choose Replace selected track with current input. The replacement keeps its position.</li>
      <li><strong>Confirm Route.</strong> Fetch missing or invalidated heights and new walking connections from Open Topo Data, keeping valid recorded heights. Then build the planned tracks in order and update the Route Card. Complete terrain is reused when confirming an unchanged plan. Existing saved plans remain available, including copies made with the earlier section tools.</li>
    </ol>
    <p>The plan is saved on this device and uses Edit Undo/Redo. Dashed lines mark straight walking connections between separated tracks; their distance counts. The confirmed output defaults to Edited Route. Its name and Preview control are in the Route Card. Point geometry tools apply only to input tracks.</p>
    <h4>One fetch for the input, one step to confirm the plan</h4>
    <p>The Fetch Terrain button under the map refreshes the selected input, including tracks with no heights. It does not update saved Route Plan copies or the confirmed route. Add or replace the input in Route Plan when ready; Confirm Route fetches any heights still needed for the output. There is no Fetch Terrain button on the Edit Route Card.</p>
    <p>If plan terrain fails, Retry terrain tries again. Back to Route Plan keeps working without replacing the previous route. Confirm without terrain explicitly builds an incomplete result: its card says Terrain incomplete and ascent is partial. Confirm Route can retry terrain later. Cancel during a fetch leaves the plan and previous route unchanged.</p>
    <h4>Read and share the Edit Route Card</h4>
    <p>The Edit Route Card stays empty until you choose <strong>Confirm Route</strong> in Route Plan. Selecting or editing input tracks updates the map, metrics and elevation profile, but does not populate the card. After confirmation, the card shows the entire confirmed route, even while you edit further inputs. Pending plan changes do not replace it until you confirm again.</p>
    <p>The reduced card scrolls after six point rows. Expand it for cumulative distance and ascent, with Share Text and Share PDF fixed at the bottom. Both sharing options and the card’s Save button use all points in the confirmed route, including points reached by scrolling.</p>
    <p>Point numbers follow the confirmed route’s walking order. Tap one to locate it on the Edit map. If point naming is enabled, names can be edited here and those edits use Edit’s Undo history. Point bins are available only in Create New.</p>
    <p>Add the edited input to Route Plan and Confirm Route, then Save Route exports the confirmed route using the default filename Edited Route.gpx. Add to Route Plan and Route Plan sit below the eight map editing buttons. The thin point-selection strip is greyed out when no editable input points are available.</p>
    <h4>Clear without losing your track library</h4>
    <p>The card’s Clear route asks before clearing the joined route, Route Plan and current Edit selection. Imported tracks remain in Input Tracks and the Create draft is untouched. Undo restores the cleared route. The bin in Input Tracks removes a track from this workspace; its original file stays in Files.</p>
  </section>

  <section id="about-settings" class="about-common">
    <h3>Settings</h3>
    <p>Open Settings using the cog beneath ?. Preferences are remembered on this device.</p>
    <h4>Created Route Colour</h4>
    <p>Use the spectrum, a preset or a hex value, then Apply colour. This sets the Create route and its GPX export. Imported tracks have their own Line colour control in Edit, using the same picker. Colour changes preserve fetched terrain. New imports without a saved colour start red, blue and pink for the first three tracks; new joined routes start green. Each track’s Line colour remains adjustable.</p>
    <h4>Allow Point Naming</h4>
    <p>This is off by default. Turn it on to show the Name column in both cards and edit names of up to 10 characters. Off hides Name and adds Distance to the reduced grid; it does not delete names already stored with points.</p>
    <h4>Input Track Editing</h4>
    <p>Handle every sets the spacing of editing handles in input tracks, starting at 20 points. Apply saves it on this device and updates the input editor. First and last points are always included. Spacing changes only the handles. Delete point and Trim deliberately remove input points; neither changes saved Route Plan copies or the confirmed Edited Route.</p>
    <h3>Grid references</h3>
    <p>Available Systems offers Lat/Long (WGS84), Irish National Grid, British National Grid, Irish Transverse Mercator (ITM), MGRS, UTM and USNG. The choice applies immediately to both Route Cards, map-centre readouts and shared text/PDF cards. Grid headings use shorter labels. GPX always uses WGS84 Lat/Long, regardless of the display choice.</p>
    <p class="about-detail">Irish and British grid references use approximate datum conversions. ITM uses ETRS89; global formats use WGS84. Reference precision does not imply equivalent GPS accuracy. UTM, MGRS and USNG cover 80°S to 84°N. Regional grids identify positions outside their coverage.</p>
  </section>

  <section class="about-common">
    <h3>Maps, terrain and location</h3>
    <p>Lines connect points directly and do not automatically follow roads or paths. Check that the route follows walkable ground.</p>
    <p>Create New and Edit Existing keep separate maps and drafts. Switching screens does not transfer a drawing into Edit; save its GPX and open that file in Edit Existing when needed. Fit frames the relevant tracks; Expand map gives more space while keeping the header and metrics visible. The crosshair requests your current position only when tapped, showing a dot and accuracy circle. It never adds a point or starts background tracking.</p>
    <p>Map tiles and optional terrain requests need internet access. Terrain requests send route or connection coordinates to Open Topo Data after you confirm. Map outages do not prevent editing or export; Retry reloads the tiles; × dismisses a map warning. The warning clears when failed tiles recover or leave the view, and reconnecting retries failed tiles. Missing elevations produce unavailable or partial ascent rather than invented heights.</p>
    <h3>Files, saving and undo</h3>
    <p>Saved on device means automatic workspace recovery, not an exported GPX file. Export routes you want to keep before uninstalling the app or clearing its data. Native apps use the system Files picker; browsers use file access or downloads. Share PDF creates a landscape route card; if browser sharing is unavailable, the PDF downloads. Share Text offers a copyable preview where device sharing is unavailable.</p>
    <p>Create and Edit have separate Undo/Redo histories. Use ⌘/Ctrl + Z to undo and ⌘/Ctrl + Shift + Z to redo. Escape closes a dialog or collapses an expanded card or map. The workspace survives reopening; Undo history does not. Routine actions do not show bottom banners; warnings and errors remain visible until dismissed.</p>
  </section>
  <button class="button primary full" data-close>Done</button>
</div>`;
