# BareGPS Route Planner

**GPX Creator and Editor**

BareGPS Route Planner creates walking routes and edits GPX tracks on Android, iOS and in a browser. Work is stored on the device. Import GPX files, choose sections, split or join tracks, preview them on OpenTopoMap and export the result to Files.

[Browser Preview](https://appsbyonzy.dev/tools/baregps-route-planner/) · [Downloads and instructions](https://appsbyonzy.dev/#tools)

## Create a route

The app opens in **Create**, the left tab. An empty map starts at Carrauntoohil at zoom 13. Create and Edit have separate maps; Create retains its draft and map position.

- **Add points**, beneath the map, adds a starting point and subsequent points in walking order. Every tap extends the route, including taps near an existing line.
- **Insert point** inserts one point between neighbouring points on the chosen line, then returns to Add points.
- Drag numbered markers to move points. The centred **Route Card** lists Point, Name, the selected grid reference and Height, with a fifth-column bin button to remove points. Tap a point number to locate it on the map.
- Add optional names of up to **10 characters** in the **Name** column. Names stay attached as points move and are included in exported GPX files.
- **Expand Route Card** opens a fullscreen table with Distance, Cumul Distance, Ascent and Cumul Ascent. Names remain editable; deletion is available only in the main list. The expanded table uses a smaller type size; swipe sideways if needed. Cell borders, centred headings, units on separate heading lines and right-aligned measurements help comparison. Missing height/ascent data is shown as a dash.
- In the expanded card, **Share Text** shares a message summary and **Share PDF** shares a paginated landscape route card. Both use the selected coordinate format and include point names, heights, distances and ascent. Unnamed points retain their Point number in text summaries. Browsers without text sharing offer a copyable preview; browsers without PDF sharing download the PDF.
- **Close loop** joins the last point precisely to the start and includes the return leg in distance.
- **Fetch terrain** estimates ascent and descent along the route. Moving, adding or removing points clears terrain estimates; fetch again after reshaping.
- Choose a route name, set **Created Route Colour** in Settings, then **Save route** exports a GPX file. **Fetch terrain**, **Clear route** and **Save route** are equal-width buttons on the main card.

Lines connect points directly; the app does not automatically follow roads or paths. Undo and Redo are beneath the device-save status in the title panel. Create's undo history is separate from Edit's.

## Edit GPX tracks

Opening **Edit**, including switching from Create, resets its map to Carrauntoohil and shows **Open GPX files** and **Explore with sample tracks**. Imported tracks and joined routes remain saved. Select an imported track in **Your tracks** to resume editing it.

Examples are optional illustrative tracks around Glendalough's Upper Lake and the Spinc in County Wicklow. They appear only after choosing the sample button. Opening Edit hides them again; requesting them reuses retained samples rather than adding duplicates.

1. **Open files** accepts GPX tracks and routes, including multiple tracks within one file. On phones, GPX files can also be opened or shared into the app from Files.
2. Select a track, then drag **A** and **B** on the map or use the sliders to choose a section. Distance, ascent, descent and the elevation profile update immediately.
3. **Save section** exports the selection. **Split** creates two tracks sharing the cut point, retaining the original. **Reverse** reverses the selected track's direction.
4. **Start joined route** and **Append section to route** assemble selected sections in walking order. The joined route is separate from its sources and can be previewed, renamed and saved.
5. **Undo** and **Redo** cover editing, importing, splitting, reversal, joining, renaming, colour changes and removal. Use ⌘/Ctrl+Z and ⌘/Ctrl+Shift+Z on a keyboard.

**Select whole track** resets the section selection. The fit control frames relevant tracks; the track-view control switches between all tracks and the selected section. Expand the map for a larger workspace, then collapse it or press Escape. The header and metrics remain visible while expanded.

## Map, metrics and colour

Both maps use OpenTopoMap. The crosshair at the upper right requests one current-position fix and shows a blue dot and accuracy circle. It never adds a waypoint or starts background tracking. Location access is requested only after tapping the button; approximate Android permission is supported. Zoom controls sit at the lower left above the scale. The smaller map-centre readout is right-aligned immediately above the attribution.

Metrics show **Distance(km)**, **Ascent(m)** and **Descent(m)**, with labels and values centred in their columns. Empty ascent and descent display **0**. Where elevation is unavailable, the profile explains that heights are needed; displayed zero does not supply missing GPX heights. Terrain and partial-elevation totals are identified where applicable.

The cog beneath **?** opens **Settings**, with two sections: **Grid references** and **Created Route Colour**. The created-route colour control uses the same spectrum, preset swatches, hex field and preview as the **Line colour** picker in Edit. **Apply colour** makes one undoable change and preserves fetched terrain. Settings stays open after applying a colour. Editing an imported track’s colour does not change the created route. The metrics panel contains only route metrics.

The green BareGPS logo and title remain in the header. **About** and **Settings** carry the same logo. The **?** button opens **About**, with route-creation and editing guidance, a dedicated Grid references section covering display formats and accuracy, and Created route colour guidance.

## Coordinate display

Settings offers Lat/Long (WGS84), Irish National Grid, British National Grid, Irish Transverse Mercator (ITM), MGRS, UTM and USNG (WGS84). The choice is remembered on the device and applies to the Create Route Card, shared text/PDF route cards and map-centre coordinates in both views. Column headings use short format labels such as Irish Grid and British Grid. GPX storage and export, geometry calculations and terrain requests use WGS84 regardless of the display format.

Irish and British National Grid use approximate Helmert datum transformations. ITM uses ETRS89 with a null WGS84 transformation for walking-scale display. Regional formats identify positions outside their coverage. UTM, MGRS and USNG cover 80°S to 84°N. UTM zones include Norway/Svalbard exceptions and the date-line boundary. MGRS and USNG use full, spaced one-metre WGS84 references; the reference precision does not imply equivalent GPS accuracy.

References: [Proj4js](https://proj4js.org/), [MGRS](https://github.com/proj4js/mgrs), [OS coordinate tools](https://www.ordnancesurvey.co.uk/geodesy-positioning/coordinate-transformations/resources), [FGDC USNG](https://www.fgdc.gov/standards/projects/usng), and EPSG definitions for [Irish Grid](https://epsg.io/29903.proj4) and [ITM](https://epsg.io/2157.proj4).

## Walking connections and terrain

Dashed connections between separated sections count toward distance, ascent and descent because they must be walked. They are straight connections, not generated paths. Connections over one metre are dashed; virtually identical shared endpoints are deduplicated.

Distance uses great-circle calculations over every edge. Ascent sums positive elevation changes and descent sums negative changes. Recorded elevations are not smoothed, so noisy GPX heights can inflate ascent. Missing elevations remain missing in the data and produce partial totals where applicable.

A connection initially uses its endpoint heights for estimated ascent. **Fetch gap terrain** samples heights at roughly 90-metre intervals using Open Topo Data's Mapzen dataset and recomputes the totals. This can reveal hills and valleys between imported tracks. Endpoint terrain heights replace the relevant GPX endpoint heights to give a continuous profile. Cancellation, timeouts, missing heights or service errors leave the route unchanged.

Terrain dialogs explain that coordinates are sent to Open Topo Data. Requests are batched to 100 locations, spaced at least 1.1 seconds apart and bounded by timeouts. Import and export work offline; map tiles and optional terrain requests require internet. There is no offline tile pack, trail routing, account system or remote workspace sync.

GPX export forms a continuous track so other readers include connection distance. BareGPS extensions preserve dashed edges, terrain status and line colour on reimport. Readers that ignore these extensions display a continuous line. Recorded timestamps are preserved; generated terrain points have no fabricated timestamps.

## Files, saving and recovery

Android uses the system document picker and Create Document save picker. iOS uses its document picker and Export to Files. Browser Preview uses browser file access or downloads. File actions can be cancelled without losing edits.

The **Saved** header status refers to automatic workspace recovery in IndexedDB on this device, not an exported GPX file. Export work you want to keep before uninstalling the app or clearing its data. Undo history does not survive closing the app; the workspace does. Edit history is limited by a change count and point budget; Create retains up to 30 undo steps.

Invalid XML, unsupported entities, missing points, invalid coordinates/elevations and file-size limits produce errors. Valid files in a mixed batch can import while invalid files are identified individually. Save failures, cancelled pickers, unavailable storage, missing maps, service outages and unavailable location have explicit handling. Failed tile loading does not disable editing or export; Retry reloads tiles. Restored workspace data is validated before use.

Limits include 15 MB per GPX file, 20 files / 30 MB per picker batch, 150,000 points per imported file or joined route, 100 workspace tracks and 450,000 total workspace points. Create supports up to 1,000 waypoints. Terrain sampling is limited to 5,000 new locations per operation and 135 km per unsampled connector.

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

The public platform bundles are v0.2.6 in `releases/bundles/0.2.6/`, linked from [Tools](https://appsbyonzy.dev/#tools). Android includes an installable development APK, a ZIP bundle and instructions. iOS includes source, prebuilt web assets and Xcode instructions; it is not a publicly signed IPA. **Will be available through App Store**. Packaging excludes signing identities, private keys and provisioning profiles. The distribution verifier checks download hashes and archive contents.

## Source layout and dependencies

- `src/main.ts`: UI, actions, undo/redo, settings and local recovery.
- `src/model.ts`: GPX parsing/export, validation, track operations and analytics.
- `src/create.ts`: route creation and waypoint operations.
- `src/map.ts`: map rendering, draggable markers, current-position layers and framing.
- `src/coordinates.ts` and `src/location.ts`: coordinate formatting and one-shot location access.
- `src/terrain.ts`: sampling and terrain lookup.
- `src/files.ts`: browser/native file and sharing operations.
- `src/routecard.ts` and `src/routecard-pdf.ts`: shared route-card calculations, text summaries and paginated PDFs.
- `android/.../BareFilesPlugin.java` and `ios/App/App/AppDelegate.swift`: native Files bridges; iOS `SceneDelegate.swift` handles incoming documents.

Maps use [OpenTopoMap](https://opentopomap.org/) with attribution to [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), SRTM and OpenTopoMap (CC-BY-SA). Terrain uses [Open Topo Data](https://www.opentopodata.org/) and its [Mapzen dataset](https://www.opentopodata.org/datasets/mapzen/). Mapping uses [Leaflet](https://leafletjs.com/), mobile packaging uses [Capacitor](https://capacitorjs.com/), current position uses its [geolocation plugin](https://capacitorjs.com/docs/apis/geolocation), and the spectrum picker uses [vanilla-colorful](https://github.com/web-padawan/vanilla-colorful).
