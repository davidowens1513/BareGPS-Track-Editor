# Track Editor shared phone refinements — build 63

Date: 12 November 2026. Development source: iPhoneDevelopment.

## Requested scope

Port Route Maker changes 1–5, 6 as Reset Track, 8–12, 14, 16, 17 and 19.

- iPhone native viewport correction retains map gestures; no web viewport restriction.
- Expansion controls recover on success, cancellation and failure for save and terrain jobs.
- Empty-map sizing refreshes and Fit is disabled without geometry. Restored inputs activate normally.
- Five equal primary input buttons wrap inside the existing 34px height; Done editing keeps its own row. Fetch Terrain stays on two lines.
- Reset Track confirms and restores only the active input’s saved starting version, with Undo/Redo. Snapshots persist independently of plan copies, confirmed output and exported files. New imports and simplified copies capture their initial state; legacy saved inputs capture their current state on upgrade.
- Settings and About use fixed headers/actions and scrolling bodies. Input colours offer 14 named presets and validated hex changes. About retains Editor instructions and adds support, in-app privacy/storage navigation and third-party notices; no new published privacy page is implied.
- Page footer removed; Expand to Share hint added. Card summary/full policy retained.
- Portrait A4 PDF, optional Name column, equal metric column widths and shared text/PDF closing wording. PDF sharing fallback handles absent navigator.share.
- iPhone native target family 1, Android handset screen filters. Editor’s GPX open/share intents remain.
- Android native system-bar, cutout and keyboard padding, avoiding doubled WebView insets.
- Both native projects reference this project’s physical node_modules; native sync normalises iOS dependency paths. No sibling project is needed. Unused colour-spectrum dependency removed from package/lock files.

## Verification

- 106 unit and app-flow checks passed across 14 test files, including real Leaflet marker hit testing, reset persistence/isolation/Undo/Redo, settings/about actions, colour validation, terrain/save recovery and PDF layout contracts.
- TypeScript and Vite production build passed. Capacitor sync and dependency normalisation passed.
- Actual PDF samples rendered with PDFKit and reviewed: summary without names (2 pages), full with names (4 pages). Portrait page boxes, continued table headings, footers and optional names verified.
- Xcode device build 63 installed and launched on TestBed iOS. UIDeviceFamily [1], version, identity and bundled assets match the current production output.
- Android Studio :app:assembleDebug passed (91 tasks). APK identity com.baregps.trackeditor, versionCode 63, and assets verified. Existing flatDir/deprecation build warnings remain.
- Native handset settings and retained Editor Android GPX VIEW/SEND_MULTIPLE intents checked.

Android on-device insets/keyboard acceptance and physical iPhone gesture/layout acceptance are not claimed by these automated/build checks. No website, Git remote, App Store or Play Store publication was performed.
