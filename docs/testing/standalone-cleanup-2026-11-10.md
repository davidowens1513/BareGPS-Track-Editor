# Standalone source cleanup — 10 November 2026

Track Editor now has its own entry point, workspace model, map and active tools. The product-mode switch and the other app’s screen, event handlers and unused modules have been removed. Shared-purpose coordinate, terrain, route card and export helpers remain where used.

Route Maker retains drawing, point naming, terrain, GPX saving and route card sharing. Its native file bridge no longer includes track import. Track Editor retains import, input editing, simplification preview with preserved originals, route planning, confirmation and exports; its route creation module has been removed.

Verification on this source revision:

- TypeScript build, including unused-code checks: passed.
- Unit tests: 81 passed.
- Browser checks: 6 passed across desktop and phone sizes.
- Production web build and Capacitor sync: passed.
- Android release build: passed.
- iOS device-target build: passed using the generic iOS destination; the physical iPhone was unavailable.
- Phone and desktop layouts inspected.

The native smoke fixtures were refreshed but were not executed on physical devices in this cleanup. These builds were not installed. Published versioned app downloads remain the earlier release snapshots; this source cleanup is ready for a subsequent release.

The website’s Tools section now uses a fresh red SVG logo URL for Track Editor; Route Maker remains green. The corrected homepage and logo were published to the existing Cloudflare Pages project and verified live.
