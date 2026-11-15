# Native file safety — 15 November 2026

The existing source/configuration and generated-output folders contained 914 numbered copies. Repeated controlled overwrite/copy tests did not reproduce their creation. Their timing correlates with asset preparation and incremental builds, but this does not identify the writer or prove that a sync client caused them. No OS, sync-client or IDE security settings were changed.

The initial copies were moved to `.native-file-backups/2026-11-15T12-15-07-754Z-b3890e1a-4681-4a13-84b4-07f16a176745/`. Its manifest records original paths, generated/source classification and hashes for source copies. Generated copies are preserved even when stale or unmatched because they are rebuildable output; original source copies must be identical before moving. Originals remain in place. Distinct or unmatched source files cause an error before any files are moved. Backups must not be published or added to Git. To restore a quarantined file, copy its recorded relative path back from the quarantine after reviewing the current counterpart.

Preparation now uses `scripts/native/sync.mjs`. It checks before and after Capacitor, repairs safe numbered copies, normalises the iOS package path only when needed, then checks again. `native:check` performs a filename scan without reading generated binary contents. `native:repair` preserves safe copies in quarantine. Symlinked directories outside the project are not traversed. Empty numbered directories left after quarantining their files are removed; their mirrored paths exist in quarantine.

`android/native-file-check.gradle` supplies read-only checks to direct Android Studio/Gradle builds, at preBuild and before duplicate-class checks and APK packaging. It checks configured native subprojects, including Capacitor and geolocation. A failure names the files and explains repair/clean/rebuild. It does not silently exclude resources or remove code. The existing ProGuard correction, Gradle migration and optional external build-directory setting are preserved.

Release packaging runs the file check and includes the preparation helpers in iOS source bundles. Tests use isolated temporary fixtures for identical/different/missing counterparts, generated output, Android resource names, classes, numbered directories, repeat repair and symlink handling. Two consecutive real native-copy runs passed without reporting new copies immediately afterwards. A later external writer can still create copies; Android builds and subsequent preparation will detect them.

Publishing and Git were on hold during this verification. Phone installations were not changed by this verification.

## Android Studio verification

A direct `:app:assembleDebug` run correctly stopped at preBuild when 21 numbered asset copies were found after the earlier clean scans. Several retained 11:57 file creation times, so detection time is not evidence that a newly created file was written then. Those copies were also preserved in a second dated quarantine. After repair, the same Android Studio task passed (`BUILD SUCCESSFUL in 1s`, 15 warnings). No installation or publishing was performed.

Capacitor before/after-copy hooks additionally run the same repair/check when copy or sync is invoked directly. Nine isolated filesystem tests pass. The writer of the restored/duplicated files remains unidentified; this change detects and contains it rather than claiming an OS synchronisation problem is cured.
