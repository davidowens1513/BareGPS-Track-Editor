# BareGPS Track Editor

Import, simplify, edit and combine GPX tracks into a confirmed walking-route plan.

**Current version: 0.3.0, build 59.** This is the standalone red Track Editor, split from the former combined BareGPS Route Planner on 10 November 2026. There is no Create screen or mode switch. This repository retains the original Track Editor history.

[Browser preview](https://appsbyonzy.dev/tools/baregps-track-editor/) · [Downloads and platform instructions](https://appsbyonzy.dev/#tools) · [Source](https://github.com/davidowens1513/BareGPS-Track-Editor)

## What it does

- Import GPX tracks, rename/recolour inputs, trim, reverse, insert, move and delete points.
- Preview simplification at a target of 10 handles/km with at most 10 metres deviation. Accept creates an independent copy and retains the original. Names, endpoints, bends and gap boundaries are protected; extra points may be needed.
- Each simplified handle controls one underlying point. Original dense inputs retain configurable handle spacing.
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
