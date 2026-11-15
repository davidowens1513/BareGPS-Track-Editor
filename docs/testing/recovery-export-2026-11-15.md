# Recovery, export and route freshness — 15 November 2026

Implemented against the clean iPhoneDevelopment checkout, without changing either installed phone or publishing.

- Unreadable workspace records are quarantined before new saves are permitted. Quarantine failures lock saving and leave the original untouched. Each quarantine has a dated independent record; the latest is available for export through Settings.
- Normal saves atomically retain the previous successful workspace. Duplicate flushes do not rotate the previous copy. Validation and failed writes cannot replace the last good record.
- Settings → Workspace recovery and backup exports a complete workspace JSON, restores a validated backup, restores the previous saved workspace, or exports unreadable recovery data. Restoration supports Undo. GPX exports remain separate from workspace backups. Previous-copy restoration means the previous completed save, not an entire edit history.
- Export input GPX exports an input directly without planning or network requests. Confirmed-route exports use the current route name for the filename and GPX metadata. Export success feedback is visible; cancellation still leaves the editor usable.
- A shared elevation assessment suppresses incomplete/stale totals in the input list, analytics, Route Card, and text/PDF card rows. Individual recorded heights remain visible. Route building carries forward stale terrain status.
- New plan entries store input content signatures. Copies show Current copy, Input changed, or a cautious legacy/missing-input status. The existing replace-selected-entry control updates only the chosen occurrence.
- Confirmed output has a plan content signature. Changed plans produce a warning in the Route Card and beside export. Saving the older confirmed route requires choosing Export previous route explicitly.
- No change to automatic terrain fetching at confirmation (item 5 was not requested).

## Verification

TypeScript check and Vite production build passed. Automated tests passed across all 17 test files (128 tests), including a rerun of the UI test file after correcting the new test to select the input before reversing it. New tests cover quarantine persistence across relaunch, quarantine/write failures, duplicate saves, invalid snapshots, freshness across reload/Undo, duplicate plan entries, partial/stale ascent, native filenames/GPX content, JSON backup MIME type, recovery Undo, and stale-export confirmation.

The preview server was blocked by the session's local-listener permission (EPERM), so browser acceptance and fresh visual inspection were not completed. Physical iPhone/Android backup pickers, actual saved-file reimport, and native device builds remain to be checked before release. Existing automated native-save tests mock the bridge; they do not prove physical file-provider behavior.

## Revert

The pre-change source/test/package checkpoint is at `../../../work/checkpoints/track-editor-before-2026-11-15.tgz` relative to this document's directory; the native checkpoint is alongside it. The companion `revert-track-editor-2026-11-15.sh` restores exactly the previously tracked files changed by this work and removes the newly added source/tests and this note. It has not been run.

Run it from the outer project directory with:

```sh
sh work/checkpoints/revert-track-editor-2026-11-15.sh
```

This intentionally replaces subsequent edits to the same files. Rebuild and sync after restoring. The script does not alter on-device workspaces or original GPX files. New persistence fields are optional, and the original workspace schema/key is retained; quarantines and previous-save records use separate keys.
