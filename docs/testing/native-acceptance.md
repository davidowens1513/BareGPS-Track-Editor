# Native workflow acceptance tests

These tests use actual system Files/document pickers and share sheets on physical phones. Web controls are driven through XCTest on iOS and Espresso Web on Android; Android system dialogs use UI Automator. No native file plugin is mocked.

## Workspace protection

Run through `scripts/testing/run-native-tests.py`. It synchronizes current web assets, copies current native sources to a fresh results directory and assigns the copy the application ID `com.baregps.trackeditor.nativetest` and display name **BareGPS Native Tests**. The working `com.baregps.trackeditor` installation and its data are never cleared, uninstalled or overwritten. Only the disposable test app is reset. Test GPX files have dedicated names; no sharing recipient is selected.

Do not use the ordinary app scheme or `connectedDebugAndroidTest` directly against a working installation. The Android test also asserts the isolated identity before any actions. The iOS test explicitly addresses the isolated bundle.

## Run on a connected phone

Required: installed project dependencies, Node/npm on PATH, Android SDK and compatible Java 21 for Android; Xcode and an existing development team for iOS. Authorize USB debugging on Android. Unlock the iPhone, enable Developer Mode and approve the expected UI automation prompt if shown. Keep it unlocked while tests run.

```sh
python3 scripts/testing/run-native-tests.py android --device ANDROID_SERIAL --results /private/tmp/baregps-native-android-results
python3 scripts/testing/run-native-tests.py ios --device IPHONE_UDID --team APPLE_TEAM_ID --results /private/tmp/baregps-native-ios-results
```

Use a new results directory for each run. Device identifiers come from `adb devices -l` and `xcrun devicectl list devices`. The test run uses only its isolated app identity; it is not an App Store submission or a public APK build.

## Acceptance checks

1. Launch Edit and open the actual system import picker; cancel and verify that import remains available.
2. Import the dedicated five-point GPX fixture from Files/Downloads.
3. Reverse the whole input, add it to Route Plan and Confirm Route. The fixture has complete heights and a single continuous track, so this step needs no terrain request.
4. Open native GPX export, cancel, then export successfully.
5. Read the exported file back from phone storage and check five points in reversed order, every coordinate and elevation, and retained Start/Finish names. No success banner is required.
6. Open the actual text and PDF share sheets, cancel without sending, and verify the app is usable again.
7. Reimport the exported GPX through the system picker and verify the output appears as an input.

The independent host verifier is `scripts/testing/verify-native-export.py`. Android also checks exported content inside the device test. iPhone output is checked after the XCTest run using the copied file.

## Results and limitations

Logs, source copy and exported GPX stay under the selected results directory; iOS also keeps an xcresult bundle and final screenshot/accessibility attachments. System sheet screenshots can contain device-specific sharing suggestions: keep those local, outside Git and public downloads.

This is a focused native integration check. It does not establish release-archive/TestFlight acceptance, upgrade preservation, accessibility completeness, location permissions, dense-track performance or terrain cancellation under network failure. Those need their own acceptance cases. The isolated identity is deliberately unsuitable for claiming that an existing production workspace survives an upgrade.

## Recorded physical-device run — 9 November 2026

| Device | Native workflow | Export content readback |
| --- | --- | --- |
| Samsung Galaxy A07, Android 16 | Passed: 1 end-to-end test, including real Files and both share cancellations | All five points, reversed order, coordinates, heights and Start/Finish names passed |
| iPhone 14 | Passed: 1 end-to-end test, including real Files and both share cancellations | All five points, reversed order, coordinates, heights and Start/Finish names passed |

The Android run also passed through the new one-command runner. iPhone steps were run with the same isolated build/seed/XCTest/readback procedure. Its system share sheet uses a floating presentation; the test cancels by tapping the backdrop and verifies the sheet is gone. The first iPhone runner start timed out before the phone was unlocked; the successful run completed after UI automation was available. Initial test-selector failures were corrected before recording these passes.

Source fingerprints, local result paths and precise coverage are in `native-workflow-2026-11-09.json`. No normal app workspace was used or cleared, and no sharing recipient was selected. Temporary test applications were removed after readback verification; raw diagnostics remain local.
