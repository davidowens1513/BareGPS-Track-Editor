# Development and validation notes

These notes describe development history and validation, separately from the as-is product description in the [README](../README.md).

## Opening-prompt stacking — local 0.3.6, build 80

The Open Track/Your route in five steps overlay now sits above both custom map controls (location and layers), as well as Leaflet controls. Transparent overlay space retains its existing click-through behaviour, so map controls remain usable outside the guide card. Build 80 was installed and launched on TestBed iOS through Xcode and SM-A075F Android 16 through Android Studio. The device reports Android versionCode 80/versionName 0.3.6; both native builds match the current web assets. TypeScript, production build and native preparation passed. Publication was subsequently authorised; see the release record below.

## Direction-review dialog layout — local 0.3.6, build 79

The suggested reversal occupies its own full-width row. Back to plan and Keep this join share an equal-width row underneath; labels wrap and columns can shrink on narrow screens. Keyboard order follows the visual order. Built and installed locally on TestBed iOS through Xcode and SM-A075F Android 16 through Android Studio; both apps launched as 0.3.6, build 79. All 157 tests, TypeScript checks, production build and native asset preparation passed. Installed native build assets match dist. Publication was subsequently authorised; see the release record below. The reversal algorithm remains unchanged: it compares reversing the first section, the next section, or both, including neighbouring connections. Equally good alternatives can exist; reversing a closed loop does not move its connection endpoints.

## Plan replacement direction and reversed-track timing — 0.3.5, build 78

Replacing a Route Plan entry preserves its `planReversed` choice, applies it to the refreshed input copy and keeps the source input signature so copy status stays accurate. The confirmed route changes only on reconfirmation. Ordinary and twice-reversed entries use the input's normal order.

Reversing an input or plan copy now removes recorded timestamps from the reversed copy, preventing backwards activity times in exported GPX. Point names, heights and connection markers are retained. Original inputs are unaffected by plan reversal; Undo and Reset Track restore input timestamps when reversing an input. About explains both behaviours.

Validation: all 155 unit/UI tests, TypeScript checks and the production web build passed. New checks cover reversed replacement after reload, partial sections, refreshed heights and copy status, ordinary/twice-reversed direction, GPX timestamp removal, input immutability, replacement Undo/Redo and reconfirmation, and restoring input timestamps with Undo or Reset Track. Version 0.3.5, build 78 is installed and launched on TestBed iOS and SM-A075F. Both APKs and the iOS app contain the current web assets. The public APK uses the permanent release identity; the phone update uses the compatible development identity. [Release verification](testing/release-0.3.5.json) · [Download checksums and signing metadata](distribution/release-0.3.5-manifest.json). Cloudflare production deployment `2b48fe2c-ab82-4c89-9c3e-ae9856623f07` is live. The homepage, browser allowance and About guidance were checked; the live APK and both bundles match their packaged checksums or expanded contents. Previous links and downloads remain available. Both repositories are published separately.

## Point limits and clearer planning — 0.3.5, build 78

Inputs retain the 150,000-point import limit, and adding/inserting now uses the same limit. At that limit those two tools are disabled with an explanation; trimming and simplification remain available. The Route Plan retains its 5,000-point total limit and displays the used allowance beneath its button and inside the plan. Adding or replacing an input that will not fit offers the existing simplification preview; replacement counts the space freed by its selected entry. A full plan points users to removing an entry. Simplification keeps the original and does not automatically add or replace plan entries.

Inputs above 5,000 points now explain the terrain limit and offer Simplify before a terrain request starts. Terrain sampling still enforces the 5,000-point limit, including added samples, with advice to simplify or trim. About explains these limits. Validation: all 150 unit/UI tests, TypeScript checks and the production web build passed. Regression checks cover editing above 5,000 points and at the 150,000 boundary, live plan allowance and Undo, replacement space, full-plan guidance, terrain boundaries and accepting a simplified copy while preserving its original. The README describes current behaviour; development and validation history stays in this linked file.

## Map layer control recovery — 0.3.5, build 78

The layers icon now explicitly follows the busy state on every render, restoring it after import, GPX save or terrain work finishes. Regression checks cover saving and terrain success, cancellation and failure, plus importing tracks; each verifies that the control can switch to Satellite afterwards.

## Map and join refinements — 0.3.4, build 77

- Clearing the confirmed route preserves the map view and input visibility.
- Adding or confirming one input keeps the other inputs visible.
- Confirmation reviews joins over 500 m when reversing sections cuts the gap to a third or less and saves at least 250 m without worsening neighboring connections overall. Joins over 5 km also prompt without a clear reversal. Users can reverse plan copies, keep the join or return to the plan. Input files remain unchanged; changes support Undo.
- A single layers icon toggles directly between OpenTopo/Satellite below the current-position button remembers the selected layer. Switching preserves the view; map and About credits follow the selected layer. Simplification previews use the same layer.
- Version and both native build numbers advanced to 0.3.4 (77). All 142 unit/UI tests and 9 native file-check tests passed; TypeScript, web build and native asset sync passed. Xcode installed and launched on TestBed iOS. Android release assembled; the phone has a development-signed install, so its compatible development update is separate from the public release-signed download. Android Studio installed build 77 successfully on the SM-A075F; Xcode is running build 77 on TestBed iOS. Cloudflare published the browser app and downloads to [appsbyonzy.dev](https://appsbyonzy.dev/#baregps-track-editor). Live Safari checks confirmed direct layer switching, loaded satellite imagery and matching About credits. The downloaded APK matched its SHA-256; Safari expanded both ZIPs and every extracted file matched the release bundle. [Live validation](testing/website-0.3.4-live.json) · [Staged validation](testing/website-0.3.4-staged.json).


## About and support update — build 74

- About uses a concise bullet guide, separate Heights and Route Cards sections, and matching icons for About, Settings, Fit, Expand, forward and back.
- Heights explains when and how to fetch terrain and how changes relate to plan copies.
- Support Page and Privacy Policy open the published Track Editor pages, each with the red app logo. Support contains help and contact details.
- Redundant shortcut links were removed; Credits retains attribution and licences.

Validation: 18 targeted app-flow checks, TypeScript and production/native builds passed. Build 74 installed and launched on iPhone and Samsung Android. Publication validation is recorded separately in docs/testing.

## Release 0.3.2, build 71

- Settings can save a default input colour before any track is loaded. New imports use that choice; an open input can still be recoloured individually.
- After the first import, an “Open another Track?” prompt occupies the original Open Track button position. Its joined white X dismisses it. Tapping the question also dismisses the prompt, including if the picker is cancelled. The Input Tracks file button remains available.
- Inputs remain visible together by default. The current input is drawn at full opacity; other inputs use a 3-pixel line at 65% opacity. The map’s current name and colour dot match the selected Input Tracks row.
- Tapping another visible input first makes it current without moving the map. A subsequent tap reveals its local handles. At coincident sections, the current input wins; the list allows explicit selection.
- Adding an input to Route Plan retains the current input selection. Importing another track makes the new input current and fits the inputs together.

Validation: all 116 unit/app-flow checks passed for this release. TypeScript, production/native web builds and native synchronisation passed. Builds through 70 were installed and launched on both attached phones; release build 71 was installed and launched on the Samsung phone. These checks are not a claim of complete device or App Store acceptance.

Further work includes device failure/lifecycle testing, accessibility and readability checks, measured size/performance limits, backup/restore, provider capacity review, and App Store/TestFlight preparation. Store distribution requires its own archive, validation and review.

## Earlier development record

The following record preserves the previous README’s development and release notes. It describes earlier builds; the README and current release downloads describe the available product.

# BareGPS Track Editor

Import, simplify, edit and combine GPX tracks into a confirmed walking-route plan.

**Current release: 0.3.1, build 65.** Standalone red Track Editor for importing, editing, simplifying and combining GPX tracks. Split from the former combined Route Planner on 10 November 2026. There is no route-creation screen or mode switch.

[Browser preview](https://appsbyonzy.dev/tools/baregps-track-editor/) · [Downloads and platform instructions](https://appsbyonzy.dev/#tools) · [Source](https://github.com/davidowens1513/BareGPS-Track-Editor)

## What it does

- Import GPX tracks, rename/recolour inputs, trim, reverse, insert, move and delete points.
- Preview simplification at a target of 10 handles/km with at most 10 metres deviation. Accept creates an independent copy and retains the original. Names, endpoints, bends and gap boundaries are protected; extra points may be needed.
- Inputs open as a clean line with Start and Finish markers. Tap the line for a small group of local handles; Done editing or tapping empty map space hides them.
- Dragging smoothly reshapes a section, retaining all underlying points. Larger drags widen the transition; moves without sufficient room to blend are rejected. GPX segment boundaries are protected.
- Assemble input snapshots into Route Plan, reorder/replace/remove entries and Confirm Plan explicitly.
- Show a green membership tick between an input's colour control and bin when included in the plan.
- Preview confirmed output, export GPX, and share text/PDF Route Cards.
- Retain original inputs up to 150,000 points per file, within a 15 MB file limit and bounded workspace. Plans/terrain remain limited to 5,000 points; larger inputs must be simplified or trimmed before planning.

## Terrain and Route Cards

Route Cards default to 30 checkpoints, retaining start, finish and every named point. More than 30 names can exceed the target. Full Card shows all points. Text/PDF sharing follows the chosen view; distances and ascent use the full route geometry, and GPX retains every route point.

Terrain uses Open Topo Data's Mapzen dataset, roughly 90-metre sampling and a 5,000-point job limit including added samples. Primary elevation totals show **u/a** while missing, incomplete or invalidated. Heights are unsmoothed estimates; noise can inflate ascent.

Cancellation returns promptly and late results are ignored. Each complete response is bounded to 20 seconds and the full job to three minutes. On phones an active native request may finish in the background after cancellation, without applying its result.

Lines connect points directly; they do not automatically follow paths. Check access and walkability. No navigation, activity recording, accounts, cloud sync or offline map packs are provided.

## Source layout

Track Editor contains input editing, simplification, Route Plan and confirmed-output UI only. It has no creation map, drawing actions, creation settings or drawing undo stack. Closed-loop geometry lives in a small editing helper.

The two products have independent entry points and storage models; there is no product-mode switch. The current main branch includes source cleanup after the versioned release linked above.

## Run and build

Requirements: Node.js with npm, installed dependencies, Xcode for iOS, Android SDK and Java 21 for Android.

```sh
npm ci
npm run dev
npm test
npm run test:e2e
npm run build
npm run native:sync
```

The browser tests exercise this standalone product. The old combined-app browser fixtures and cloning runners have been removed; they remain available in Git history. Shared geometry, terrain, coordinate and export helpers are retained only where this product uses them.

```sh
npm run ios
npm run android
```

Native smoke fixtures cover iOS launch and Android identity. Broader physical-device save/share, lifecycle and failure acceptance remains a release gate. Source cleanup verification is recorded separately from the published release evidence in `docs/testing/`.

## Android signing and installation

Application ID: `com.baregps.trackeditor`. Public APKs must be release-signed and non-debuggable. Private signing material is kept outside the repository and excluded from bundles.

```sh
# Point this at your private signing properties; never commit them.
export BAREGPS_ANDROID_SIGNING_PROPERTIES=/absolute/private/path/release.properties
cd android
./gradlew assembleRelease
```

The properties file supplies `storeFile`, `storePassword`, `keyAlias` and `keyPassword`. Keep the signing identity stable for future updates. `scripts/distribution/package-bundles.py` verifies the permanent certificate before packaging.

## iOS distribution

Bundle ID: `com.baregps.trackeditor`. Open `ios/App/App.xcodeproj`, select your own development team and build for a connected phone. Public iOS downloads are **source bundles with prebuilt web assets**, not installable IPAs or TestFlight packages. No signing certificates, private keys or provisioning profiles are bundled. App Store/TestFlight distribution still requires its own archive, validation and acceptance.

## Website and packages

`npm run build:web` builds the preview for `/tools/baregps-track-editor/`. The Tools heading at appsbyonzy.dev lists Route Maker and Track Editor as separate sections, each with its own preview, Android APK/ZIP, iOS source ZIP, instructions and Git link. Publishing uses the existing Cloudflare Pages site, not a new hosting project. Its scoped worker relays validated terrain requests for the preview paths.

```sh
python3 scripts/distribution/package-bundles.py
```

Packaging excludes local settings, dependency trees, build caches and signing material. Verify manifest/checksum agreement and archive contents before publishing.

## Storage, privacy and remaining work

Each standalone product has its own app identity and local workspace key. Autosave is device/browser recovery, not a complete backup. Keep original GPX files and export important routes. This split intentionally does not migrate the former combined workspace.

Map providers receive viewed map areas; terrain providers receive coordinates. Browser terrain uses the Cloudflare relay. Sharing sends files only to the destination selected by the user. The in-app guide is not a complete privacy policy.

Outstanding release work includes physical-device failure/lifecycle testing, accessibility/readability, measured supported sizes, a user backup/restore path, documented provider capacity, privacy/support/licence publication and actual TestFlight acceptance. Do not infer App Store readiness from a successful local install.

Copyright © AppsbyOnzy. Support: [appsbyonzy@gmail.com](mailto:appsbyonzy@gmail.com). Dependency and map credits are in About. No new source licence is implied by this split; third-party licences remain applicable.

## Shared phone refinements — build 63

Native builds target iPhone and Android handsets; tablets use the web version. iPhone app-scale zoom is fixed while map gestures remain available. Android reserves system bars, display cutouts and keyboard space natively. Input action labels wrap inside 34px buttons.

Reset Track restores only the selected input to its saved starting version, with confirmation and Undo. New imports and accepted simplified copies retain their initial points, name and colour. Older workspaces take their current saved inputs as starting versions at this update. Plan copies, confirmed output, other inputs and GPX files are unaffected. Reset starting versions persist in the workspace separately from plan copies.

Settings and About keep their headings and Done controls visible while content scrolls. Settings includes 14 named track colours in two rows, hex entry, a track selector and Apply; the input-row colour control opens the same picker. Route Cards retain their 30-checkpoint/full-card choice. PDFs use portrait A4, equal metric columns, an optional Name column and the same closing wording as text sharing.

Dependencies are local to this project; both native projects resolve this project's node_modules. Native sync normalises the generated iOS dependency path. No sibling Route Maker or Track Editor installation is required.

Build 64 corrects the Settings colour section: the same named palette/hex form is available inline, Apply stays in Settings, and an input selector chooses which track changes. The editing guide stays in About.

## Release 0.3.1 — build 65

- Clean-line imports with Start/Finish, local handles on tap and smooth section reshaping. Large moves without room to blend are rejected. Original point geometry is retained unless deliberately edited or simplified.
- Reset Track restores the selected input’s saved starting points, name and colour, with confirmation and Undo/Redo. Other inputs, staged plan copies, confirmed output and files are unaffected. Existing saved inputs take their state at upgrade as their initial reset version.
- Settings contains the 14-colour palette, hex entry, track selector and Apply; valid changes apply without closing Settings. The picker is also available beside each input. Settings/About retain their title, close and Done controls while content scrolls.
- iPhone page-zoom correction retains map zoom. Expansion controls recover after save/terrain success, cancellation and failure. Empty-map sizing and restored-workspace activation are fixed; Fit is disabled without tracks.
- Equal-width map buttons wrap inside the existing 34px height. Fetch Terrain stays on two lines. Done editing has its own row.
- Portrait A4 Route Card PDFs, optional Name column, equal metric widths and matching text/PDF closing wording. Summary/full-card policy remains; GPX retains all route points. Expand to Share makes sharing discoverable.
- Native targets iPhone and Android handsets; tablets use the web preview. Android reserves system-bar, cutout and keyboard space. Both projects use their own locked dependencies and local native paths.

Validation: 109 unit/app-flow checks (including the Settings palette and input selection), TypeScript and production builds, native builds and package checks. PDFs were rendered and inspected. Physical device gesture/layout acceptance remains separate from automated and build checks.

Downloads are a signed Android APK/ZIP and an iPhone Xcode source ZIP, not an IPA or TestFlight installation. Older versioned downloads remain available. This update does not change the app’s public name or publish it to either app store.

## Release 0.3.6 — build 80

Publication authorised on 16 November 2026. This release includes the phone-sized direction-review actions and the opening-guide stacking correction installed on both phones. The README describes the current app; this file retains progress. Public Android downloads use the permanent release key, separately from the compatible development-signed phone installation. Website and download verification is recorded in docs/testing/release-0.3.6.json.

Production deployment `e8b03317-4297-41a5-8c9b-24f481e0122a` is live. The homepage shows Track Editor 0.3.6 build 80 and Route Maker iOS 1.0.1 build 103 / Android 0.1.6 build 13. Both previews loaded; current About guidance and selected-layer credits were checked. Downloaded APK SHA-256 values and every file in both products’ expanded iOS/Android bundles match the packaged releases. All previous site files are retained. All three repositories were pushed; this verification record is committed separately. App Store Connect was observed showing Route Maker build 103 Waiting for Review.


## Release 0.3.7 — build 81 (17 November 2026)

Save confirmations are cleared before each new save so cancellation cannot leave an old success message visible. Bottom notices dismiss after ten seconds or via their close button; replacement messages receive their own timer. Empty workspaces reset preview and editing state. The browser GPX picker remains attached until completion and handles focus returning without a cancel/change event, without interrupting slow file reads. Import preparation now releases its busy state even if rendering fails.

Settings → Remember workspace defaults to on. Turning it off clears saved/current-history snapshots, keeps the active session usable, suppresses further automatic saves and starts fresh on relaunch or page reload. Turning it back on saves the active workspace. About and README describe this behaviour.

Validation before release preparation: 170 native-source unit/UI checks and 128 legacy web-source checks pass, including new picker, restart and preference regressions; TypeScript and production web builds pass. The web preview and both native builds will now use the same current source. Phone installation, public packaging, website deployment and Git push results are recorded below as verified.

Native preparation passed with both platforms using the same `dist` assets. Xcode built, installed and launched 0.3.7 (81) on TestBed iOS; the debug navigator shows the process running and the WebView loaded. Android Studio completed `assembleRelease` and `installDebug`, confirming installation on the attached SM-A075F. The phone retains its compatible development signature; the public APK uses the permanent release signature.

Publication completed on 17 November 2026. Cloudflare confirmed successful production deployment of the current browser app, matching versioned downloads and homepage changes. The Track Editor blurb ends before “Switch…” and displays “Still in Development” beneath it in softened vivid green. The browser Settings dialog visibly includes Remember workspace. Both downloaded ZIPs and the APK match their packaged SHA-256 checksums. A download-header version mismatch found during live checks was corrected and redeployed before completion; the APK now downloads successfully. All earlier website files remain available. [Release verification](testing/release-0.3.7.json) records builds, installs, packaging and live checks. Source and download commits were pushed through GitHub Desktop; final verification and website commits follow separately.
