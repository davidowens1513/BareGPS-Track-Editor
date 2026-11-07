# BareGPS Route Planner

**GPX Creator and Editor**

A local-first route creator and GPX editor for Android and iOS. Create walking routes by tapping the map, or open several tracks, choose the portions you want, split them or assemble a new walking route, preview it on OpenTopoMap, and save a GPX file back to Files.

## Run the preview

Use Node.js 22 or newer and npm.

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>. **Explore with sample tracks** loads two small, clearly labelled illustrative Irish tracks around Glendalough’s Upper Lake and the Spinc in County Wicklow. These samples are for exploring the editor, not navigation. GPX files are processed on the device; no account or upload service is required.

## Android and iOS

The repository includes native Capacitor 8 projects and a small, first-party Files bridge. Import uses the system document picker. Export uses Android's Create Document picker or iOS's Export to Files picker, so the user chooses the destination. File actions can be cancelled without losing edits. GPX files can also be opened/shared into the app from Files, whether the app is running or starting.

```sh
npm run native:sync
npm run android
# or
npm run ios
```

Android requires Android Studio, SDK 36 and Java 21. iOS 16.4 or newer is supported; development requires Xcode and its iOS SDK. Configure your Apple development team in Xcode for a physical iPhone or a signed distribution build. The included application identifier, `com.baregps.trackeditor`, should be checked against your own developer accounts before release.

Android command-line build:

```sh
cd android
./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`. This is a development build, not a Play Store release.

Unsigned iOS simulator build:

```sh
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/baregps-ios-build CODE_SIGNING_ALLOWED=NO build
```

## Editing

1. **Open files** accepts GPX tracks and GPX routes, including multiple tracks in one file.
2. Select a track. Drag **A** and **B** on the map, or move the two sliders to select the portion to keep. Distance, ascent, descent and the elevation profile update immediately.
3. **Save section** exports just the selection. **Split** creates two tracks at a chosen point, retaining the original. **Reverse** reverses the selected track's direction. Track colours can be chosen from presets or the colour picker.
4. **Start joined route** / **Append section to route** adds selected portions in walking order. The joined route remains separate from the source tracks. Preview, rename or save it from the route panel.
5. **Undo** and **Redo** cover edits, import, split, reverse, joining, renaming, colours and removal. Section selection itself is nondestructive. Use ⌘/Ctrl+Z and ⌘/Ctrl+Shift+Z.

The map fits the relevant tracks on import, track selection, route preview and the fit button. Switch between all tracks and the selected section. Expand the map for a larger workspace; collapse it or press Escape to return. The BareGPS header and distance/ascent/descent stay visible, including while the map is expanded.

## Walking connections and elevation

**Dashed connections count toward the route's distance and ascent.** They are straight connections between separated sections, not generated paths along trails or roads. Connections over one metre are dashed; virtually identical shared endpoints are deduplicated.

Distance uses great-circle calculations over every edge, including connections. Ascent sums positive elevation changes, and descent sums negative changes. Recorded elevations are not smoothed, so noisy GPX heights can inflate ascent. Missing elevations are never silently replaced with zero: the interface marks partial totals and explains the missing data.

Initially a connection's ascent uses its endpoint heights and is labelled estimated. **Fetch gap terrain** obtains terrain heights at roughly 90-metre intervals from Open Topo Data's Mapzen dataset, including endpoints, and recomputes the totals. This can reveal hills and valleys between the imported tracks. Terrain elevation remains an estimate; resolution, sampling and the actual path walked affect the result. Endpoint terrain heights replace those GPX endpoint heights for a continuous elevation profile. The whole update is atomic: cancellation, missing heights, timeouts and service errors leave the route unchanged.

The terrain dialog explains that connection coordinates are sent to Open Topo Data. Import and export do not need internet. Map tiles and optional terrain lookups do. Terrain requests are batched to 100 locations, spaced at least 1.1 seconds apart, with timeouts; the public service's availability and limits still apply. In the web development/preview server, `/terrain` is proxied to Open Topo Data; on Android/iOS, Capacitor's native HTTP API contacts it directly. A separately hosted web deployment needs that proxy as well.

Export produces a standard, continuous GPX track so other GPX readers include connection distance. BareGPS extensions preserve dashed edges, terrain status and colour when reimported. A reader that ignores these extensions will display a continuous line. Timestamps from recorded points are preserved; generated terrain points have no fabricated timestamps. Split files share the cut point so no length is lost.

## Error handling and recovery

- Invalid XML, missing track points, invalid coordinates/elevations and unsupported XML entities produce actionable errors.
- Valid files in a mixed batch can import while errors identify the invalid files.
- File reads, save failures, picker cancellation, service outages, missing terrain, timeouts and unavailable maps have separate handling. A failed map request does not disable editing or export; Retry reloads tiles.
- Workspace changes are automatically saved to IndexedDB on the device. Saved data is validated before restoring. Storage failures tell the user to export before closing.
- Undo history is limited to 20 changes and a point budget to avoid unbounded memory use. Undo history does not survive closing the app; the workspace does.
- Limits: 15 MB per GPX file, 20 files / 30 MB per picker batch, 150,000 points per imported file or joined route, 100 workspace tracks and 450,000 total workspace points. Terrain sampling is limited to 5,000 new locations per operation and 135 km per unsampled connector.

## Tests

```sh
npm test
npm run test:e2e
npm run build
npm run format:check
```

Unit tests cover GPX parsing and round-trip, invalid files, namespaced tracks and routes, splits, reversal, distance and ascent including gaps, missing heights, maximum point count, saved-state validation and terrain success/failure. Browser tests exercise import → trim → join → preview → export → restore, splitting/reversal, mixed valid/invalid files, safe filenames, map-handle dragging, expanded-map analytics, mobile layout and terrain failures. External map tiles are stubbed in automated browser tests; the real tile and terrain services are checked separately.

Browser tests use an installed Google Chrome on macOS by default. Set `BAREGPS_CHROME` to an alternative Chromium executable, or install Playwright's Chromium and remove the executable override in `playwright.config.ts`.

## Project layout

- `src/model.ts`: GPX data model, validation, editing, analytics, parsing and export.
- `src/main.ts`: workspace actions, UI, undo/redo and local recovery.
- `src/map.ts`: OpenTopoMap, track rendering, dashed gaps and draggable endpoints.
- `src/terrain.ts`: connector sampling and terrain lookup.
- `src/files.ts`: browser/native document operations.
- `android/.../BareFilesPlugin.java`: Android document picker, export and incoming-file intents.
- `ios/App/App/AppDelegate.swift`: iOS document picker, export and bridge registration; `SceneDelegate.swift` handles incoming documents.

## Maps, branding and dependencies

The logo shows two endpoints connected by a winding line. Its green matches `UIColor.systemGreen`, used by the BareGPS Ireland title (`#34C759` in light appearance). The header reads “BareGPS Route Planner”. The Saved indicator refers to automatic workspace recovery on the device; exporting a GPX file is a separate action. No map layer selector is included.

Map tiles use [OpenTopoMap](https://opentopomap.org/) with visible attribution to [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), SRTM and OpenTopoMap (CC-BY-SA). Optional terrain uses [Open Topo Data](https://www.opentopodata.org/) and its [Mapzen dataset](https://www.opentopodata.org/datasets/mapzen/). Mapping uses [Leaflet](https://leafletjs.com/); mobile packaging uses [Capacitor](https://capacitorjs.com/). Review public tile/terrain service capacity for a store release. There is no offline tile pack, trail routing, account system or remote workspace sync in this version.

## Native workflow checks

The native test suites exercise the actual system document pickers, cancellation and file export. The Android test also checks an incoming Files-style document intent. Use a disposable test simulator/emulator.

For Android, boot an emulator, put `tests/native-fixture.gpx` in its Downloads folder as `Native fixture.gpx`, then run:

```sh
adb push tests/native-fixture.gpx '/sdcard/Download/Native fixture.gpx'
cd android
./gradlew :app:connectedDebugAndroidTest
```

Use the `:app:` task prefix so Gradle does not run the generated plugin libraries' unrelated test targets. To keep compiled files outside a cloud-synced workspace, set `BAREGPS_ANDROID_BUILD_DIR=/tmp/baregps-android-build`. This is optional and does not affect app behavior.

For iOS, use the App scheme's UI tests in Xcode with a booted simulator and make `Native fixture.gpx` available in its local Files storage. The test finds it in On My iPhone or the BareGPS folder. It opens, reads and exports the GPX through the real iOS picker. Tests are in `ios/App/AppUITests/AppUITests.swift`.

Current public downloads: v0.2.2 platform bundles in `releases/bundles/0.2.2/`, linked from [Tools on appsbyonzy.dev](https://appsbyonzy.dev/#tools). The Android bundle includes the APK verified on Samsung; the iOS bundle includes source and prebuilt assets for Xcode. Current layout previews are in `docs/create-view/`. The test APK is signed with the local Android development key. Installing on a personal Android phone requires that phone's normal permission for installing a development APK. iPhone installation requires your own Apple signing team in Xcode.

## Website downloads

The Tools section on <https://appsbyonzy.dev/#tools> provides the iOS source
bundle, Android bundle, direct APK and platform-specific instructions.
The website source is maintained in `web-preview/site/` in the OpenBareMap
repository. This app repository retains the guides, platform bundles and
reproducible packaging/verification scripts under `docs/distribution/`,
`releases/bundles/` and `scripts/distribution/`.

```sh
python3 scripts/distribution/package-bundles.py /tmp/baregps-public-bundles/0.2.2
python3 scripts/distribution/verify-website.py /path/to/web-preview/site --base-url https://appsbyonzy.dev
```

The iOS ZIP is a source bundle with prebuilt web assets for Xcode; Apple
signing is required to install it on a device. The Android ZIP includes the
APK and installation instructions. The iOS row alone states: “Will be available
through App Store”. The GitHub link keeps its existing repository access policy.


### Create a route on the map

Choose **Create** above the map for an independent OpenTopoMap view. Tap the map to place the start and subsequent numbered waypoints; use **Insert point** and tap an existing line to insert one waypoint between its neighbours. **Add points** is the default, so taps beside existing lines always extend the route; insertion automatically returns to Add points. **Close loop** connects the last waypoint exactly to the start and includes that return leg in the totals. Drag markers to reshape the route. The grid lists walking order, coordinates, leg distance, cumulative distance and available heights. Grid controls locate or remove individual points. Each tab has its own undo/redo history; switching tabs preserves work and map position. Both drafts are saved in the device workspace, including a Create draft with only one point.

Set a route name and colour, then use **Save route** with at least two points to export GPX. Created routes connect points directly rather than following paths. **Fetch terrain** sends the route coordinates to the existing Open Topo Data service, sampling about every 90 metres for estimated ascent and descent; changing geometry clears those estimates. Terrain failure or cancellation leaves the route untouched. Creation is limited to 1,000 waypoints and uses the terrain service's existing sampling limits. An unavailable map or terrain service does not prevent local editing or GPX export.

The app opens with undo/redo controls inside the persistent title panel, below the device-save status. The empty Edit map starts around Carrauntoohil with an unobscured terrain backdrop and only the file-opening and Irish sample buttons over it.


### Browser preview

[Preview BareGPS Route Planner](https://appsbyonzy.dev/tools/baregps-route-planner/) runs the same Edit/Create app in the browser, including GPX import/export and terrain estimates. Files and drafts stay in that browser. The Preview action uses the same style as OpenBareMap. Build it with `npm run build:web`; copy `web-dist/` to the website's `tools/baregps-route-planner/` directory. The scoped Cloudflare Pages worker in `scripts/website/terrain-worker.mjs` proxies only validated terrain requests to Open Topo Data; `_routes.json` limits execution to that endpoint. The regular website and downloads remain static.
