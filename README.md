# BareGPS Route Planner

**GPX Creator and Editor**

BareGPS Route Planner creates walking routes and edits GPX tracks on Android, iOS and in a browser. Work is stored on the device. Import GPX files, edit or trim input tracks, arrange them in a Route Plan, preview them on OpenTopoMap and export the result to Files.

[Browser Preview](https://appsbyonzy.dev/tools/baregps-route-planner/) · [Downloads and instructions](https://appsbyonzy.dev/#tools)

## Create New

The app opens in **Create New**, with an empty map at Carrauntoohil. Create retains its draft, map position and separate undo history.

- **Add points** extends the route with every map tap, even near an existing line. **Insert point** inserts between neighbours on the chosen line, then returns to Add points.
- Drag numbered markers to reshape the route. **Close loop** joins precisely to the start and includes the return leg in the distance.
- The **Route Card** lists points in walking order. Its reduced view scrolls after six point rows. Tap a number to locate it on the map; use its bin to remove it.
- **Fetch terrain** estimates heights and ascent/descent along every leg. Expanding a card with at least two points and no fetched terrain opens the same confirmation. Coordinates are sent to Open Topo Data only after confirming. Cancel leaves the expanded card usable. Success, failure and cancellation all leave expansion available.
- Moving, adding or removing points clears terrain estimates. Fetch again after reshaping. Missing heights/ascent are marked unavailable; zero in the metrics does not supply a missing height.
- Name the route in its card and choose **Created Route Colour** in Settings, then **Save route** exports GPX. **Clear route** asks before clearing Create points, with Undo available. Edit tracks remain in place.

**Fetch Terrain**, **Clear route** and **Save route** are equal-width controls on the reduced Create Route Card. Create New fetches heights manually along the drawing. In Edit, Fetch Terrain under the map refreshes the input; Confirm Route fetches missing heights and new connections before building the output. Edit’s Route Card has only Clear route and Save Route. Lines connect points directly and do not automatically follow roads or paths.

## Edit Existing

**Edit Existing** opens at Carrauntoohil with **Open GPX files**. Existing imported tracks and joined routes remain on the device; choose a track in **Input Tracks** to resume it. The compact list uses small route icons and closely spaced rows.

1. **Open files**, then select an input. Numbered editing handles appear immediately. Metrics and elevation show the whole input; there are no section sliders, A–B handles, Split or separate editing modes.
2. The matching Create/Edit toolbar offers **Add points**, **Insert point**, **Delete point** and **Close loop**. Drag a numbered handle to move it; tap it to select it. Tap the line to expose another existing point. Dense points are retained and move with a taper towards neighbouring handles.
3. **Trim before** and **Trim after** remove the points on the chosen side while retaining the selected point. At least two points must remain. Use both trims to keep a desired portion; Undo/Redo restores changes. Trimming preserves retained elevations and timestamps.
4. **Reverse** changes its direction. **Fetch Terrain** refreshes edited legs after **Fetch Terrain Heights** confirmation. Each Input Tracks row has its own colour picker beside the bin. Source files are not overwritten automatically.
5. **Add to Route Plan** copies the entire current input. Select rows to move or remove them. Later input edits leave those snapshots unchanged; select an edited input and use **Replace selected track with current input** to replace a planned row in place. **Confirm Route** alone builds/updates the output Route Card, default **Edited Route**. Existing plans from earlier versions remain available.
6. When all listed inputs have contributed, the input controls clear; reselect an input to continue. Plans survive reopening and use Edit Undo/Redo. The confirmed card remains whole while editing inputs, with Rename and Preview beside its name and Fetch Terrain, Clear route and Save Route beneath it. Clear route keeps imported inputs and the Create draft, and can be undone.

## Route Cards and sharing

Create and Edit use the same card layout, grid-reference preference and optional naming setting. The reduced table shows at most six point rows before scrolling; the expanded table scrolls within the screen and keeps **Share Text** and **Share PDF** visible at the bottom.

- With naming off (the default), the reduced grid shows Point, the selected grid reference, Height and Distance. Create also has a point-bin column. With naming on, Name replaces reduced-view Distance; `[Name]` marks an empty name field. Newly entered names are limited to 10 characters. Existing names are retained when hidden, and names survive point changes, recovery and GPX round trips.
- Expanded cards add Distance, Cumul Distance, Ascent and Cumul Ascent. Headers and units are centred, measurements are right-aligned, and Lat/Lon values are centred. Borders and separators distinguish cells clearly. Long coordinate values reduce their font size to fit one line without truncation or changing stored coordinates.
- **Share Text** produces a message summary. Where browser sharing is unavailable, a copyable preview is offered. **Share PDF** produces a paginated landscape route card; browsers without file sharing download it.
- Edit cards and their exports use the entire confirmed route. Large tracks render a scrolling window of rows to remain responsive, while calculations and exports retain all points. Text and PDF point numbers follow the confirmed route’s walking order.

## Map, metrics and colour

New imports without a saved colour default to red, blue and pink for the first three tracks across files/batches. New joined routes default to green. Saved and individually chosen colours are preserved.

Both maps use OpenTopoMap. The crosshair at the upper right requests one current-position fix and shows a blue dot and accuracy circle. It never adds a waypoint or starts background tracking. Location access is requested only after tapping the button; approximate Android permission is supported. Zoom controls sit at the lower left above the scale. The smaller map-centre readout is right-aligned immediately above the attribution.

Metrics show **Distance(km)**, **Ascent(m)** and **Descent(m)**, with labels and values centred in their columns. Empty ascent and descent display **0**. Where elevation is unavailable, the profile explains that heights are needed; displayed zero does not supply missing GPX heights. Terrain and partial-elevation totals are identified where applicable.

The cog beneath **?** opens **Settings**, with **Grid references**, **Created Route Colour**, **Allow Point Naming** and **Input Track Editing** sections separated by visible rules. The created-route colour control uses the same spectrum, preset swatches, hex field and preview as the **Line colour** picker in Edit. **Apply colour** makes one undoable change and preserves fetched terrain. Settings stays open after applying a colour. Editing an imported track’s colour does not change the created route. The metrics panel contains only route metrics.

The elevation profile reserves its populated size from the start, with a plain empty background and no upper-right placeholder text.

The green BareGPS logo and title remain in the header. The **?** button opens the branded **About** guide, with separate Create and Edit streams, clear task subheadings and quick navigation. Common sections explain Settings, grid references, terrain, location, saving and Undo. **Allow Point Naming** defaults off and is remembered on the device; turning it off hides names without deleting them.

## Coordinate display

Settings offers Lat/Long (WGS84), Irish National Grid, British National Grid, Irish Transverse Mercator (ITM), MGRS, UTM and USNG (WGS84). The choice is remembered on the device and applies to both Route Cards, shared text/PDF route cards and map-centre coordinates in both views. Column headings use Lat/Lon, Irish Grid, British Grid, ITM, MGRS, UTM and USNG; the Available Systems picker retains full descriptions. GPX storage and export, geometry calculations and terrain requests use WGS84 regardless of the display format.

Irish and British National Grid use approximate Helmert datum transformations. ITM uses ETRS89 with a null WGS84 transformation for walking-scale display. Regional formats identify positions outside their coverage. UTM, MGRS and USNG cover 80°S to 84°N. UTM zones include Norway/Svalbard exceptions and the date-line boundary. MGRS and USNG use full, spaced one-metre WGS84 references; the reference precision does not imply equivalent GPS accuracy.

References: [Proj4js](https://proj4js.org/), [MGRS](https://github.com/proj4js/mgrs), [OS coordinate tools](https://www.ordnancesurvey.co.uk/geodesy-positioning/coordinate-transformations/resources), [FGDC USNG](https://www.fgdc.gov/standards/projects/usng), and EPSG definitions for [Irish Grid](https://epsg.io/29903.proj4) and [ITM](https://epsg.io/2157.proj4).

## Walking connections and terrain

Dashed connections between separated tracks count toward distance, ascent and descent because they must be walked. They are straight connections, not generated paths. Connections over one metre are dashed; virtually identical shared endpoints are deduplicated.

Distance uses great-circle calculations over every edge. Ascent sums positive elevation changes and descent sums negative changes. Recorded elevations are not smoothed, so noisy GPX heights can inflate ascent. Missing elevations remain missing in the data and produce partial totals where applicable.

A connection initially uses its endpoint heights for estimated ascent. **Fetch Terrain** on the reduced Edit Route Card samples heights at roughly 90-metre intervals using Open Topo Data's Mapzen dataset and recomputes the totals. This can reveal hills and valleys between imported tracks. Endpoint terrain heights replace the relevant GPX endpoint heights to give a continuous profile. Cancellation, timeouts, missing heights or service errors leave the route unchanged.

After confirmation, terrain requests send route or connection coordinates to Open Topo Data. Edit’s confirmation says **Fetch Terrain Heights**; expanding its card and confirming a plan do not fetch. Requests are batched to 100 locations, spaced at least 1.1 seconds apart and bounded by timeouts. Import and export work offline; map tiles and optional terrain requests require internet. There is no offline tile pack, trail routing, account system or remote workspace sync.

GPX export forms a continuous track so other readers include connection distance. BareGPS extensions preserve dashed edges, terrain status and line colour on reimport. Readers that ignore these extensions display a continuous line. Recorded timestamps are preserved; generated terrain points have no fabricated timestamps.

## Files, saving and recovery

Default GPX filenames are **Created Route.gpx** in Create New and **Edited Route.gpx** in Edit Existing, for confirmed route exports. The track’s name inside the GPX remains its chosen name. To use a drawing in Edit Existing, save it from Create New and open the GPX file there. The screens retain separate workspaces and Undo histories.

Android uses the system document picker and Create Document save picker. iOS uses its document picker and Export to Files. Browser Preview uses browser file access or downloads. File actions can be cancelled without losing edits.

The **Saved** header status refers to automatic workspace recovery in IndexedDB on this device, not an exported GPX file. Export work you want to keep before uninstalling the app or clearing its data. Undo history does not survive closing the app; the workspace does. Edit history is limited by a change count and point budget; Create retains up to 30 undo steps.

Invalid XML, unsupported entities, missing points, invalid coordinates/elevations and file-size limits produce errors. Valid files in a mixed batch can import while invalid files are identified individually. Save failures, cancelled pickers, unavailable storage, missing maps, service outages and unavailable location have explicit handling. Failed tile loading does not disable editing or export; Retry reloads tiles. Restored workspace data is validated before use.

Limits include 15 MB per GPX file, 20 files / 30 MB per picker batch, 150,000 points per imported file or joined route, 100 workspace tracks and 600,000 total workspace points including staged Route Plan tracks. Create supports up to 1,000 waypoints. Terrain sampling is limited to 5,000 new locations per operation and 135 km per unsampled connector.

## Run locally

Use Node.js 22 or newer and npm:

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>. Browser files and drafts stay within that browser's local storage. The development server proxies terrain requests to Open Topo Data. Native Android/iOS builds use Capacitor's native HTTP API for terrain.

```sh
npm test
npm run test:e2e
npm run build
```

Unit tests cover GPX/model operations, route creation and saving, coordinate formats, location permissions/errors and the terrain worker. Browser tests cover editing, export, restoration, examples, colour selection, map interactions and responsive layout. External map tiles are stubbed in browser tests. Browser tests use installed Google Chrome on macOS; set `BAREGPS_CHROME` to another Chromium executable if needed.

## Build Android and iOS

The native projects use Capacitor 8 and the first-party Files bridge. Android requires SDK 36 and Java 21. iOS supports 16.4 or newer and requires Xcode and its iOS SDK. Location permissions and usage descriptions are included for the optional current-position control. The application identifier is `com.baregps.trackeditor`.

```sh
npm ci
npm run native:sync
npm run android
# or
npm run ios
```

Android command-line build:

```sh
cd android
./gradlew :app:assembleDebug
```

The default output is `android/app/build/outputs/apk/debug/app-debug.apk`. Set `BAREGPS_ANDROID_BUILD_DIR` to a Mac-local directory to keep compiled files off an external project disk; Gradle caches can also remain on the Mac.

For an unsigned iOS simulator build:

```sh
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/baregps-ios-build CODE_SIGNING_ALLOWED=NO build
```

For a physical iPhone, choose the App scheme, your connected device and your own Apple development team in Xcode. Normal Apple signing and provisioning rules apply. Run `npm ci` before opening the bundled Xcode source: its local Swift package depends on the installed geolocation plugin.

Native document-picker tests are in `android/app/src/androidTest` and `ios/App/AppUITests`. Use a disposable test emulator/simulator with `tests/native-fixture.gpx` in Files/Downloads. Android runs them with `./gradlew :app:connectedDebugAndroidTest`; iOS uses the App scheme's UI tests.

## Website and downloads

The browser Preview runs the same application at [appsbyonzy.dev/tools/baregps-route-planner/](https://appsbyonzy.dev/tools/baregps-route-planner/). Build it with `npm run build:web` and copy `web-dist/` into the website's `tools/baregps-route-planner/` directory. The scoped Cloudflare Pages worker in `scripts/website/terrain-worker.mjs` proxies validated terrain requests; `_routes.json` limits execution to that endpoint. The rest of the website and its downloads are static.

The public platform bundles are v0.2.9 in `releases/bundles/0.2.9/`, linked from [Tools](https://appsbyonzy.dev/#tools). Android includes an installable development APK, a ZIP bundle and instructions. iOS includes source, prebuilt web assets and Xcode instructions; it is not a publicly signed IPA. **Will be available through App Store**. Packaging excludes signing identities, private keys and provisioning profiles. The distribution verifier checks download hashes and archive contents.

## Source layout and dependencies

- `src/main.ts`: UI, shared Create/Edit Route Card, undo/redo, settings and local recovery.
- `src/about.ts`: the structured Create/Edit About guide.
- `src/model.ts`: GPX parsing/export, validation, track operations and analytics.
- `src/create.ts`: route creation and waypoint operations.
- `src/route-plan.ts`: staged input snapshots, ordering and explicit route assembly.
- `src/map.ts`: map rendering, draggable markers, current-position layers and framing.
- `src/coordinates.ts` and `src/location.ts`: coordinate formatting and one-shot location access.
- `src/terrain.ts`: sampling and terrain lookup.
- `src/files.ts`: browser/native file and sharing operations.
- `src/routecard.ts` and `src/routecard-pdf.ts`: shared route-card calculations, text summaries and paginated PDFs.
- `android/.../BareFilesPlugin.java` and `ios/App/App/AppDelegate.swift`: native Files bridges; iOS `SceneDelegate.swift` handles incoming documents.

Maps use [OpenTopoMap](https://opentopomap.org/) with attribution to [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), SRTM and OpenTopoMap (CC-BY-SA). Terrain uses [Open Topo Data](https://www.opentopodata.org/) and its [Mapzen dataset](https://www.opentopodata.org/datasets/mapzen/). Mapping uses [Leaflet](https://leafletjs.com/), mobile packaging uses [Capacitor](https://capacitorjs.com/), current position uses its [geolocation plugin](https://capacitorjs.com/docs/apis/geolocation), and the spectrum picker uses [vanilla-colorful](https://github.com/web-padawan/vanilla-colorful).

### Input editing handles

**Settings → Input Track Editing** saves the handle interval (default 20). First and last points are always included; at most 200 handles are displayed at once. Zoom/pan to reveal others, or tap near the line to expose another existing point. Changing spacing does not simplify the track. Delete removes one point; Trim removes all points on the selected side and renumbers those retained.

Moved points lose stale heights and timestamps. Terrain pending flags survive recovery and GPX export. Fetch Terrain refreshes changed legs after confirmation, preserving unaffected metadata. Input edits, trims and terrain fetches do not alter queued Route Plan copies or the confirmed Edited Route until explicit replacement and confirmation.

**Add to Route Plan** and **Route Plan** sit below the eight map editing buttons; the empty Edit Input Track panel has been removed. The point-selection message has its own thin strip, greyed out without editable input points. **Trim before**, **Trim after**, **Reverse** and **Fetch Terrain** share an equal-width single row below the map editing toolbar. Input export has been removed; use **Save Route** after confirming the plan.

### Terrain workflow

Create offers a manual **Fetch Terrain** on the reduced card; **Save Route** also fetches any terrain still needed before exporting and reuses existing terrain. Failure offers Retry terrain and save or an explicit Save without terrain. Expansion and sharing never prompt or fetch. Edit’s map fetch refreshes the current input, including missing or invalidated heights. **Confirm Route** fetches any missing heights, edited legs and new connections in the output, preserving valid recorded elevations and reusing complete terrain for an unchanged plan. Plan snapshots and inputs are unchanged by output terrain sampling.

Fetch failures leave the plan and previous output intact. Users may retry, return to Route Plan, or explicitly **Confirm without terrain**; incomplete results are labelled with partial ascent. Cancel keeps prior data. The Edit Route Card has no Fetch Terrain control. Elevation charts in both modes are 33% shorter with the same reserved empty/populated size.
