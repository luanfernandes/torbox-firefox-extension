# Manual Zen smoke test

Use the latest stable Zen Browser on Windows, a user-owned TorBox account, and small legal test files.

## Installation and setup

1. Run `pnpm verify`.
2. Load `dist/manifest.json` through `about:debugging#/runtime/this-firefox`.
3. Confirm that Settings opens on first install.
4. Confirm that no badge appears before setup.
5. Save a valid API key and confirm that Settings reports success without displaying the saved value.

## Discovery

1. Open a controlled fixture page with supported, duplicate, fragment, lookalike, Stream, unavailable, and NSFW destinations.
2. Confirm that only current allowed Hoster links appear.
3. Add, change, and remove an anchor. Confirm the badge and popup update after the debounce.
4. Test Pause everywhere, the exact-hostname exclusion, and NSFW opt-in.
5. Confirm that a large fixture shows truncation and does not freeze Zen.
6. Grant private-window access, create a private candidate, and confirm that private state disappears after the private session ends.
7. Scan controlled legacy and current Mega links. Confirm that the popup and create request preserve their complete fragments and that ordinary page anchors still deduplicate without fragments.

## Batch creation and recovery

1. Create a mixed batch with normal, password-protected, duplicate, and intentionally failing sources.
2. Confirm sequential create requests and partial results.
3. Confirm the duplicate warning requires another user confirmation.
4. Restart Zen during an ordinary queue. Confirm fresh Hoster preflight and recovery.
5. Confirm that private batches do not recover after Zen exits.
6. Confirm that resolved local history shows hostname and path without credentials, query, or fragment.

## Link generation

1. Select one source that reports one file. Confirm that no batch tab opens, the popup explains that TorBox is processing it, and a Download icon appears when ready.
2. Close and reopen the popup during processing. Confirm that the current quick batch returns without persisting a generated URL.
3. Test a source that reports several files. Confirm that the popup offers the batch tab instead of choosing a file.
4. Wait until TorBox reports files in a multi-source batch.
5. Confirm that an item with at most 100 files selects them all and provides Unselect all.
6. Generate selected files. Confirm at most four requests run together and no action accepts more than 100 files.
7. Confirm that every result is HTTPS and opens a new tab only after a click.
8. Reload the popup or batch tab and confirm that generated links disappear.
9. Search the extension storage and logs. Confirm that generated links and API keys are absent from batch records and diagnostics.

## Record

Record the Zen version, extension commit, TorBox response shapes, tested Hosters, and pass or failure for each section. Sanitize the record before committing it.
