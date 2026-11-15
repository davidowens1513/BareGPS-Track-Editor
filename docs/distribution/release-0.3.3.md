# BareGPS Track Editor 0.3.3 — build 75

Protects unreadable workspace records, retains the previous successful save, and adds complete workspace backup export/restore in Settings. Direct Export Edited GPX saves the selected edited input without planning. Renamed tracks/routes carry their names through to filenames. Incomplete/stale ascent is withheld consistently in lists, totals and Route Cards. Saved plan copies and confirmed routes show freshness warnings. Exporting an older confirmed route requires an explicit choice.

Android Studio migration retained: AGP 9.5.1, Gradle 9.6.0, compatibility properties and the corrected ProGuard configuration.

Distribution requires the permanent release certificate and a non-debuggable Android APK. Existing downloads remain available.

The editing controls now omit Close Loop. The four remaining point-editing controls have equal widths. Input rows provide extra depth, lower metrics, evenly spaced right-hand controls and centred plan-status text underneath. Repeated ascent-status wording is omitted from input rows; full guidance stays with the elevation profile.

Native preparation, direct Capacitor copies and Android builds detect numbered duplicates. Safe copies are preserved in an excluded local quarantine; differing source files stop the operation. The underlying writer remains unidentified.

Verification: 128 app/unit tests and nine isolated file-safety tests passed; TypeScript, native asset preparation and the web production build passed. The user reported installation through Xcode and Android Studio. These checks do not constitute App Store archive or TestFlight acceptance.
