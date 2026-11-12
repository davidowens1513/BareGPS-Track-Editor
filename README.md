# BareGPS Track Editor

Import, edit, simplify and combine GPX tracks into a walking route.

**Version 0.3.2 · build 71.** Available as a browser app, a signed Android APK and an iPhone Xcode source bundle.

[Open in browser](https://appsbyonzy.dev/tools/baregps-track-editor/) · [Downloads and instructions](https://appsbyonzy.dev/#baregps-track-editor) · [Development and validation notes](docs/development.md)

## Working with tracks

1. Open one or more GPX files. After the first import, “Open another Track?” provides another file picker in the same map position; tapping it or its white X dismisses the prompt. Open files under Input Tracks remains available.
2. Inputs stay visible together. The current input has the stronger line, a “Current: [name]” map label and a matching coloured dot in Input Tracks. Other inputs remain visible with lighter lines. Tap another line or its Input Tracks row to make it current. At overlapping sections, use the list to choose explicitly.
3. Tap the current line to reveal a small group of local editing handles. Drag to reshape a section; Done editing or tapping empty map space hides the local handles. Start and Finish remain labelled. Only the current input is editable.
4. Trim, reverse, insert, move or delete points as needed. Reset Track restores the current input’s saved starting points, name and colour, with confirmation and Undo/Redo. Other inputs, plan copies, confirmed output and exported files are unaffected.
5. Add inputs to Route Plan, reorder or replace its entries, then Confirm Plan. Export the confirmed GPX or share its text/PDF Route Card.

Simplify previews a separate copy, targeting 10 handles/km with at most 10 metres deviation. Accept retains the original. Names, endpoints, bends and segment boundaries are protected, so some tracks need more points.

Settings provides 14 named colours, hex entry and Apply. With no input open, it saves a default colour for new imports. With inputs open, its selector chooses the input to recolour. Settings also selects the coordinate system and enables point naming.

## Terrain and Route Cards

Fetch Terrain supplies missing elevation estimates from Open Topo Data’s Mapzen dataset. Route Cards default to 30 checkpoints, retaining endpoints and named points; more than 30 names can exceed that target. Full Card lists all points. Text and portrait A4 PDF sharing follow the chosen card view. Route metrics use the full geometry, and GPX export retains all route points.

Terrain sampling is roughly 90 metres. Incomplete, missing or invalidated elevation totals show **u/a**. Elevation estimates are unsmoothed, and noise can inflate ascent. Requests can be cancelled; late results do not change the route.

## Limits and use

- Inputs: up to 150,000 points per file, 15 MB per file and 20 files per import, within a bounded workspace.
- Planning and terrain jobs: up to 5,000 points; simplify or trim larger inputs first.
- Lines connect points directly and do not automatically follow paths. Check access, terrain and walkability yourself.
- Maps and terrain need internet. There is no navigation, activity recording, account, cloud sync or offline map pack.
- Native apps target iPhone and Android phones. Tablets can use the browser app.

## Saving and privacy

The workspace is saved on the current device or browser. Autosave is recovery, not a complete backup: retain original GPX files and export important routes. Reset Track uses the starting version retained for each input; inputs saved before that feature use their saved state at upgrade as the baseline.

Map providers receive viewed map areas. Terrain providers receive requested coordinates; browser terrain requests use the website’s Cloudflare relay. Sharing sends files to the destination you choose. Dependency and map credits are available in About.

## Install or build

Android downloads contain a release-signed, non-debuggable APK. The Android ZIP includes that APK, instructions and checksum. Application ID: `com.baregps.trackeditor`.

The iPhone download contains an Xcode source project with prebuilt web assets. It is **not an installable IPA, App Store or TestFlight package**. Open `ios/App/App.xcodeproj`, select your own development team and connected iPhone, then Build/Run. Bundle ID: `com.baregps.trackeditor`.

For source builds, use Node.js/npm, Xcode for iOS, and the Android SDK with Java 21 for Android:

```sh
npm ci
npm run dev
npm test
npm run test:e2e
npm run build
npm run native:sync
npm run ios
npm run android
```

`npm run build:web` builds the hosted preview. `python3 scripts/distribution/package-bundles.py` packages platform downloads after a signed Android release build. Signing properties are supplied externally through `BAREGPS_ANDROID_SIGNING_PROPERTIES`; private signing material is excluded from source and bundles. Both native projects use this project’s own dependencies.

## Support and terms

Provided **as is**, without warranty. Review routes and exported files before relying on them outdoors.

Copyright © AppsbyOnzy. [Support](mailto:appsbyonzy@gmail.com). No source licence is granted by this README; third-party licences remain applicable.
