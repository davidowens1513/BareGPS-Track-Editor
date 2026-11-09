# BareGPS Route Planner 0.2.11 — build 50

- Current About guide with a visible scope overview, expandable task sections, Credits & Attributions and the single green BareGPS Route Planner title. Settings sections and explanations follow the current workflow.
- Input rename pencil before colour; independent Create-to-Edit handoff; read-only confirmed-route preview with a medium-sized close control.
- Taller elevation graph with a blank initial state, concise terrain status and no reserved blank space below it.
- Confirmation for point deletion, input/plan removal, trimming and clearing. Dialogs share green titles, readable text and action-specific labels; all terrain progress close controls request cancellation.
- Add to Route Plan is full width below Edit tools; Route Plan is full width below Input Tracks. The visible point-selection strip is removed. Existing availability rules are retained.
- Browser cards show all measures, rightmost Create bins and full-width expanded tables. Expanded cards offer only Share Text/Share PDF, plus collapse.
- Updated native tests, isolated real-device runner and export-content verifier are part of the project. Native workflow results are recorded separately from broader release acceptance.

The proposed Route Plan dialog Preview and equal-sized dialog buttons were reverted and are not included.

Distribution: permanently release-signed, non-debuggable Android APK and ZIP; iOS Xcode source bundle with matching build identity, not a public IPA. Connected phones receive clean installs after private container backups stored outside source control and publication packages.

Validation: 75 unit tests, all 122 desktop/phone browser checks, formatting, TypeScript, native/web builds and both platform builds passed. Fresh isolated native acceptance runs on the physical Samsung and iPhone passed system Files import, Reverse, plan/confirm, native save cancellation/save, text/PDF share cancellation and reimport. Both exported GPX files passed independent point/order/height/name verification. These Debug test-copy runs do not establish TestFlight or Store acceptance.
