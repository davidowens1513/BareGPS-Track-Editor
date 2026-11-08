# BareGPS Route Planner 0.2.9 — build 40

- Whole-input geometry editing with adjustable handles, Add/Insert/Delete, Close loop, Reverse and trims that retain the selected point. Dense points and retained metadata are preserved.
- Two rows of bordered map buttons, a thin selected-point strip and Route Plan controls below the map. Per-input colours sit beside each bin; section controls and input export are removed.
- Create fetches terrain manually or before Save Route. Edit fetches input heights under the map; Confirm Route fetches missing heights and connections before building the output. Valid recorded heights are preserved. Fetch failures offer explicit retry or incomplete-output choices, and cancellation preserves previous data.
- No automatic fetch on card expansion and no Fetch Terrain button on the Edit Route Card. Incomplete terrain is labelled in cards, text and PDF sharing.
- Elevation charts and surrounding spacing reduced by 33%, with equal empty/populated chart sizes.
- Routine success banners suppressed. Tile warnings are dismissible clear of the position button, clear on recovery and retry after reconnecting.
- Portrait phone layouts, Created Route/Edited Route defaults, updated About, Settings guidance, README and both platform instructions.

Validation: 75 unit tests, 92 browser checks across desktop/phone, formatting,
TypeScript, production/native/web builds, and updates installed and launched on
Samsung Galaxy A07 and iPhone 14. Installs preserve existing workspace data.

Public downloads now include the Android release-signed APK/bundle (Android build 41; iOS remains build 40) and iOS Xcode
source bundle. No public IPA or signing identities are included.

## Android signing correction — 8 November 2026

The public Android APK and bundled APK are replaced with a non-debuggable
release build signed by the permanent Route Planner release identity. No
application features or iOS binary changed. Android instructions explain that
existing debug-signed installations must preserve their work before migration.
Private signing material is kept outside the repository and excluded from bundles.
Packaging now verifies APK signatures and rejects debug/debuggable packages.

Verification: release assembly passed; APK Signature Scheme v2 verified against
`android-release-certificate.sha256`; package is non-debuggable, version 0.2.9
build 41, min SDK 24 / target SDK 36. The prior debug APK was rejected by the
new packaging guard. The release installed and cold-launched successfully in
an isolated read-only Android emulator. Existing phone installations were not
uninstalled, replaced or cleared during this signing-only task.
