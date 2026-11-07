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
