# Validation record

Checked on 6 November 2026. This records the actual verification scope, rather than treating a successful compile as proof of every interaction.

## Requirements and evidence

| Requirement | Evidence |
| --- | --- |
| Android and iOS projects | Capacitor native projects compile; Android development APK is packaged under `releases/`. |
| Native Files import/export | Android instrumentation and iPhone XCTest UI tests open the real system pickers, import a synthetic GPX and save it back to Files. Exported coordinates and elevations are read back and compared to the source. |
| File cancellation and repeated import | Native cancellation checks plus desktop/phone browser regression tests verify the Open controls remain usable. |
| Opening a GPX from Files | Android native test sends a GPX through an incoming document URI intent. iOS declares GPX as an editable document type and handles cold/warm scene URL deliveries; iOS picker round-trip is tested. External Files-app launch on iOS has not been separately automated. |
| Multiple files/tracks and GPX routes | Parser tests cover multiple tracks, routes and namespaces; browser tests import two separate files. |
| Dragging track endpoints | Browser tests drag a map handle and verify section selection changes. A separate closed-loop test verifies coincident start/end handles remain individually reachable. |
| Splitting, reversing and joining portions | Unit and browser tests exercise these operations, retain the original and verify section/route totals. |
| Dashed joins count in distance and ascent | Unit tests include a known gap and assert total distance, ascent and gap style. Browser tests verify joined route distance/ascent and the exported gap marker. |
| Terrain ascent through gaps | Unit tests verify sampled intermediate hills count, source data is unchanged on failure and missing heights reject the whole update. The real terrain endpoint was checked successfully. |
| OpenTopoMap and fit/expand/collapse | Real map tiles were loaded and visually checked; browser tests exercise expansion and collapse. Code fits selected/all geometry on import, selection, preview and the fit control. |
| Persistent green brand and analytics | Desktop, phone and native iPhone screenshots checked; browser tests assert the header and analytics remain visible during map expansion. Sticky analytics also remain visible during editing below the map. |
| Colour picker | Browser tests choose both a preset and custom colour, then export only the A–B section and verify its colour and point count; GPX round-trip tests preserve the chosen colour. |
| Save sections and joined routes | Browser download is parsed/checked for point count and gap markers; native Files exports are parsed and compared to the input's five coordinates/elevations. |
| Errors from the outset | Invalid XML/coordinates/elevations, missing heights, unsafe document entities, mixed file batches, map outages, storage/read/save failures, cancellation and service failures have explicit handling. Parser and service failure paths have automated checks. |
| Workspace recovery and undo/redo | Browser tests exercise restore after reload and undo; stored data is validated before restoration. |

## Executed checks

- `npm test`: **22 passing tests**.
- `npm run test:e2e`: **18 passing checks**, split between desktop Chromium and a phone viewport with touch enabled.
- `npm run build`: TypeScript and the production web bundle build successfully.
- `npm run format:check`: passes.
- Dependency installation audit: **0 known vulnerabilities** at installation time, with the lockfile included as the reproducible dependency record.
- Android: **1 passing native workflow test**, covering picker cancellation, import, save and a Files-style incoming document intent, on the Android 16 / API 36 emulator.
- iPhone: **2 passing native UI tests**, covering picker cancellation and Files import/export, on iOS 27.2 simulator.
- Android and iPhone exported GPX files: all five latitude/longitude/elevation tuples match the synthetic input fixture.

The native tests use disposable simulator data. `Native fixture.gpx` was made available to each platform's local Files provider before the tests. This computer's iPhone simulator cached the app-folder shortcut across reinstalls; placing the fixture in local Files storage allowed the real picker round-trip to be tested independently of that shortcut.

## Practical limits

The app is a development version, tested in simulators/emulators and browsers. Physical-device installation and launch were subsequently checked on an Honor BND-L21 (Android 9), Samsung Galaxy A07 / SM-A075F (Android 16), and the attached iPhone 14 (iOS 27.0.1). The iPhone build uses the existing Apple Development certificate and managed device profile. Full file-editing workflow checks remain those described above for simulators/emulators. TestFlight, App Store and Play Store publication are not included. iOS external open-in-app delivery is implemented but needs a separate Files-app launch check on an iPhone; the iOS system-picker import/export path is verified. No automatic trail routing or offline map packs were requested. Public map/terrain services require internet, and their capacity/availability is external to this app.

Connection distance always counts. Ascent is explicitly partial when recorded elevations are missing, and estimated for an unprofiled gap. Fetching terrain improves the gap profile; it does not turn a straight connector into a verified walkable trail.

## Version 0.1.1 update

Irish illustrative samples replace the Glen Coe samples: Glendalough Upper Lake and Spinc ridge. The starting map view is Ireland. Both native app icons, launch images, the web logo and header use the two-point winding-line mark; its `#34C759` green matches the light-appearance system green used in the BareGPS Ireland title. The full title is “BareGPS Track Editor”. The save indicator is now labelled with words, including on phones, and explains that it refers to workspace recovery rather than GPX export. The tracks panel also exposes Irish samples for existing workspaces.

The update passed 22 unit tests and 18 desktop/phone browser checks, including the full title and save label at 320, 360 and 390 pixels, Irish sample geometry and existing editing/export regression checks. Android and signed iPhone builds succeeded.

## Version 0.2.5 verification — 7 November 2026

Optional Create point names survive point changes, local recovery, undo/redo and GPX export/import. Text routecards include point labels, names, selected coordinates, distances and heights. Grid-reference settings use the Help dialog styling.

55 unit tests, TypeScript, formatting, native Android and signed iPhone builds passed. All 22 browser checks passed in a sequential run after an intermittent phone drag failure in the parallel run. Native text-sharing bridges compile; sending a routecard through another app was not separately tested on the physical devices.

The Samsung Galaxy A07 and iPhone 14 received update installs and launched successfully, without uninstalling or clearing data. The public preview assets match the production build, download checksums match all five platform files, previous links remain available, and the live terrain proxy returned OK. The release record is in docs/website/production-publication-0.2.5.json.

## Version 0.2.6 verification — 8 November 2026

The centred main Route Card has editable names of up to 10 characters, selected grid coordinates, height and a fifth-column bin. The expanded card adds distance and cumulative distance, ascent and cumulative ascent, with smaller cells, centred unit headings, cell borders, and text/PDF sharing. Route Card ascent includes fetched samples, with missing elevation marked unavailable. Settings contains Grid references and Created Route Colour; About contains the grid guidance. Metrics use their original layout.

56 unit tests and all 24 desktop/phone browser checks passed. The browser checks include point-name recovery, delete/undo, main/expanded columns, generated PDF download, Settings colour application and About guidance. Formatting, TypeScript, Android and signed iPhone builds passed. Main/expanded phone layouts and a generated route-card PDF were visually reviewed during implementation. Native PDF sharing bridges compile; sending the PDF to another app on physical phones was not separately automated.

The v0.2.6 preview and website description were published, all production preview assets match the build, all five download checksums match the release manifest, prior download paths remain available, and the live terrain proxy returned OK. Both phones received v0.2.6 build 12 updates in place. Samsung launch returned Status ok. The iPhone installation succeeded. After the user confirmed the phone was unlocked and authorized a retry, the app launched successfully. Full publication evidence is in docs/website/production-publication-0.2.6.json.

## Version 0.2.7 verification — 8 November 2026

The release includes the shared Edit/Create Route Card, whole-track/A–B/full-joined-route selection rules, default-off optional point naming, six-row reduced scrolling and fixed expanded sharing controls, single-line coordinate fitting, undoable Edit clearing and compact Your Tracks rows. Separators, app/PDF grids and elevation-profile guides have stronger contrast. About now has distinct Create and Edit streams, task subheadings, quick navigation and current Settings/data/terrain guidance. README and platform instructions describe the final behaviour.

56 unit tests, all 48 desktop/phone browser checks, TypeScript and formatting checks passed. Browser checks include About navigation, terrain confirmation/cancellation/recovery, optional naming persistence, Edit selection and joining, clearing/undo, coordinate fitting in all seven formats, and a 2,000-point track whose full contents remain scrollable and exportable. Narrow-phone and desktop About/Grid layouts were visually reviewed, as was a four-page PDF sample with the clearer grid. Native sharing bridges compile; sending files to another app on physical devices was not separately automated.

Both phones received v0.2.7 build 20 updates in place and launched successfully, without uninstalling or clearing data. The website preview and release downloads were published to production; all preview assets and five download checksums match the release build, prior links remain available, and the live terrain proxy returned OK. Publication evidence is in docs/website/production-publication-0.2.7.json.

## Local shared-screen build 21 — 8 November 2026

Create and Edit now use one Leaflet map and one Route Card. Switching tools preserves the selected drawing/imported/joined route, A–B section, map centre and zoom. The drawing is available directly in Edit and Your tracks without export/import or duplication. Imported tracks remain visible in Create; Use drawing/Start drawing explicitly selects the drawing. Joining selects the entire updated result; subsequent source selection is reflected consistently in the map, metrics and card. Undo/Redo is shared, and the last tool and selected route are recovered on reopening. Sampled terrain is retained through drawing sections, export, colour/rename, reversal and joining. About and README document the updated workflow; existing Settings continue to apply to the shared screen.

58 unit tests, all 54 desktop/phone browser checks, TypeScript/build, formatting and diff-whitespace checks passed. Checks cover direct drawing editing/joining, repeated switching, exact map-centre preservation, section selection/recovery, cross-tool Undo, deletion from an offset section, drawing access after sharing and sampled-terrain totals. Phone/desktop layouts were reviewed at 320, 390 and 1280 pixels; the map legend was moved clear of coordinates and drawing controls.

Android and signed iPhone builds succeeded. Samsung Galaxy A07 and iPhone 14 received v0.2.7 build 21 update installs and launched successfully, without uninstalling or clearing data. Git commits/pushes and website publication are on hold at the user's request.

## Separate-screen restoration — build 22, 8 November 2026

The shared-screen change was reverted at the user's request. Separate Create/Edit maps, route-card behaviour, controls and Undo histories are restored, along with the earlier About guide. Red/blue/pink import defaults and green joined-route defaults remain. Shared-screen workspace recovery preserves the drawing, sampled terrain, imported tracks and joined route while normalising an active drawing back to a valid Edit selection.

58 unit tests, all 50 desktop/phone browser checks, TypeScript/build, formatting and whitespace checks passed. The new browser recovery check exercises an actual saved shared-screen workspace on both viewport sizes. Android and signed iPhone builds succeeded. Both Samsung Galaxy A07 and iPhone 14 received build 22 updates in place and launched successfully after reconnection/unlocking, without uninstalling or clearing data. Git and website remain on hold.
