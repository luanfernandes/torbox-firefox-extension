# Product specification

Status: v1 implemented; Firefox and Zen public-release preparation started on 2026-08-22

## Product outcome

The extension scans eligible pages for links handled by TorBox Web Downloads. The user opens the toolbar popup and selects up to 60 links. A one-link selection stays in the popup through processing and link generation when TorBox reports exactly one file. Larger selections open a dedicated batch tab.

The extension never starts a local download. Zen follows a generated link only after the user clicks it.

## V1 boundary

- Verify on the latest stable Zen Browser on Windows. Use Firefox WebExtension APIs so later Firefox support remains practical.
- Prepare v1 for Mozilla signing and a public AMO listing. Keep GitHub packages labeled as unsigned until Mozilla returns a signed XPI.
- Scan top-level HTTP and HTTPS documents after onboarding and API-key validation.
- Inspect `a[href]` and `area[href]` only. Ignore text URLs, embedded frames, buttons, page scripts, and shadow-root internals.
- Provide a global pause and exact-hostname exclusions.
- Permit private-window use after the owner enables extension access in Zen. Private batches are session-only, do not recover after browser exit, and never notify.
- Support catalog entries whose `type` is `hoster`. Ignore Stream entries.
- Hide current `status: false` Hosters. If refresh fails, cached matches may remain visible as availability unverified.
- Hide NSFW Hosters until the user opts in.
- Omit manual URL entry, ZIP generation, TorBox account cleanup, remote icons, analytics, localization, Chromium support, and malware claims.

## Primary flow

1. Onboarding explains broad HTTP and HTTPS page access and local credential storage.
2. The user saves a TorBox API key. Settings validates it with an authenticated Hoster request.
3. Eligible pages begin automatic discovery. The badge shows the available-candidate count for the current document.
4. The popup asks the page scanner for its current complete candidates, groups them by Hoster, and allows multi-selection.
5. The user supplies an optional password per selected source and confirms a batch of 1 to 60 links.
6. For one selected source, the popup remains open, reports TorBox progress, and generates the sole reported file link when ready. If the item contains several files, the popup offers the dedicated batch tab instead of choosing one.
7. For two or more sources, the background opens the dedicated batch tab. All batches perform one authenticated Hoster preflight and create one TorBox Web Download per source sequentially.
8. Accepted items remain visible while TorBox processes them. Ordinary batches recover after event-page suspension or browser restart for 24 hours. Private batches last only for the current browser session.
9. In the batch tab, the user selects files. Items with no more than 100 files start with all files selected and include Select all and Unselect all.
10. Generate selected or Generate all ready requests at most 100 file links per action.
11. The popup renders a quick result as a Download icon. The batch tab renders each generated HTTPS URL as a filename link. Both open a new tab only after a click, and both forget generated URLs when their extension view closes or reloads.

## Catalog and discovery

- Fetch `GET /v1/api/webdl/hosters` when no validated catalog exists or the stored catalog is at least 24 hours old.
- Recreate the daily alarm whenever the background context starts.
- Authenticate when a key exists so usage data can accompany the public catalog.
- Keep the last validated catalog if a refresh fails. Label its matches availability unverified and require a successful live preflight before creation.
- Treat `status: true` and `type: "hoster"` as selectable after a current refresh.
- Treat zero daily limits as unlimited.
- Match exact domains and subdomains at DNS-label boundaries. Normalize internationalized domains to their ASCII URL-hostname form and deduplicate catalog domains.
- Do not execute TorBox-provided regular expressions. At refresh, reject an entry whose regex no longer describes the same domain set until the contract is reviewed.
- Resolve relative link destinations against `document.baseURI`.
- Keep HTTP and HTTPS sources. Accept embedded URL credentials and preserve queries. Strip ordinary navigation fragments before deduplication and submission. Preserve complete fragments for Mega domains because Mega stores the public handle or decryption key there.
- Keep complete candidates inside the isolated content script until the popup requests them. Automatically publish counts, service identifiers, catalog version, and truncation only.
- Store count summaries in `storage.session`. Replace them on navigation and remove them on tab close or browser exit.
- Debounce added, removed, and changed link destinations. Ignore unrelated mutations.
- Apply a 100-candidate cap in v1 and show when results were truncated. Raise it only after a Zen performance measurement.

## Selection and privacy

- Render page URLs and TorBox strings as text.
- Show the full selected source URL during selection and confirmation, including embedded URL credentials. Q34 explicitly rejected special credential masking and warnings.
- Deduplicate equal normalized sources inside one batch.
- If an active or recent extension batch contains the same source, warn and require explicit confirmation.
- Store the API key in `storage.local`, never `storage.sync`. Settings states that extension storage is not an operating-system credential vault and provides Replace and Clear.
- Store unresolved ordinary-batch passwords in `storage.local`. Store private-batch passwords in `storage.session`.
- Delete a password after its create outcome becomes known, the user cancels it, or the 24-hour window ends. Seven-day history contains no passwords.
- Give content scripts public matcher data only. API keys, passwords, authenticated counters, TorBox responses, and generated URLs stay out of page code.
- Include no telemetry, remote scripts, or remote UI assets.

## Batch creation

- Persist the batch before the first create request.
- Cap one batch at 60 sources.
- Revalidate selected sources and Hoster status with one authenticated live preflight.
- Call `POST /v1/api/webdl/createwebdownload` once per source and process the queue sequentially.
- Continue after link-specific failures. Stop on authentication failure.
- Pause when the API returns HTTP `429` or `X-RateLimit-Remaining: 0`, then honor reset information. Do not treat a positive-quota `Retry-After` header as throttling.
- Never repeat a create POST automatically after an ambiguous transport failure.
- Reconcile a lost response by the documented MD5 of the exact submitted URL, a creation window, and a unique Web Download list match. Otherwise keep `create_unknown` and offer a manual retry with a duplicate warning.
- After a known create outcome, replace the raw source with a display value containing hostname and path only. Remove credentials, query, and fragment.
- Cancel remaining affects locally queued sources only. V1 never deletes TorBox-side items.
- Resume confirmed ordinary queues automatically for 24 hours. Run a fresh authenticated Hoster preflight before the next POST after restart. After 24 hours, require Resume.

## Batch observation

- Prefer one paged `GET /v1/api/webdl/mylist` sweep to update all extension-owned IDs, then discard unrelated account records from memory.
- Use `GET /v1/api/webdl/mylist?id=...` as a targeted fallback for a known ID.
- Poll no faster than five seconds while the batch tab is open.
- Use one-shot alarms after the tab closes. Poll once a minute for the first hour, then every 15 minutes until the 24-hour cutoff.
- Treat the readiness sequence as a release contract test. Do not claim that a file is safe or infected because the documented file model exposes no such field.
- Persist reported file ID, name, MIME type when present, and byte size.
- Retain terminal ordinary-batch summaries and reported file metadata for seven days or until dismissal. Dismissal deletes local history only.
- Keep private batches in session storage and send them no notifications.

## Explicit link generation

- Do not call `requestdl` before a Generate action. Confirming a one-source quick download is an explicit request to generate its link after TorBox reports exactly one file.
- If a quick item reports several files, do not generate any link automatically. Offer the dedicated batch tab for file selection.
- Let the user select individual reported files. Select all initially when an item has no more than 100 files.
- Include Select all and Unselect all.
- Limit one generation action to 100 selected files. Users may run another action for the rest.
- Request one file at a time from `GET /v1/api/webdl/requestdl` with `token`, `web_id`, `file_id`, `redirect=false`, and `append_name=true`.
- Use at most four concurrent link requests.
- Require the returned URL to use HTTPS.
- Keep generated URLs in the requesting popup or batch-tab document memory only. Regeneration replaces them.
- Render filename anchors with `target="_blank"` and `rel="noreferrer noopener"`. Omit custom Copy buttons.
- Never call the browser Downloads API and never navigate without a user click.

## Controls and notifications

- The popup exposes Pause everywhere and Pause on this hostname. Settings lists and removes exact-hostname exclusions.
- Keep Select all, Unselect all, Create batch, and Settings visible in a fixed popup action bar. Render them as labeled Lucide icon controls with mouse-hover tooltips.
- NSFW display is an explicit Settings opt-in.
- Notifications are optional and off by default. Request permission only from the user's Enable notifications action.
- When enabled, send at most one notification per batch when it becomes ready or first needs attention. Attention includes invalid authentication, a required password, a rate-limit pause, terminal failure, or timeout.
- Open the dedicated batch tab automatically after confirmation only when the user selected two or more sources. Keep a one-source batch in the popup unless TorBox reports several files or the user opens batch details.

## Accessibility

- Support keyboard-only setup, candidate selection, Select all, Unselect all, confirmation, cancellation, refresh, file selection, generation, and generated-link navigation.
- Keep visible focus, labels for every control, and status live regions that avoid announcing every progress tick.
- Do not use color as the only state signal.
- Wrap long URLs and keep them selectable.
- Use headings and per-item status text so a 60-item batch remains navigable.

## Acceptance criteria

- No page scanning occurs before successful setup.
- Loading an eligible top-level page scans real link destinations without opening the popup and updates the badge.
- Dynamic link changes update results without continuous rescans.
- Global pause, exact-hostname exclusion, NSFW filtering, private-window permission, and the candidate cap behave as specified.
- Full source URLs stay in the page scanner until the popup asks for them. Automatic session data contains counts and service identifiers only.
- Stream, unavailable, and opted-out NSFW Hosters do not appear. Cached matches after a failed refresh say availability unverified.
- A batch creates one attributable Web Download per selected source, sequentially, while preserving partial failures.
- Duplicate sources across recent batches require confirmation. Ambiguous POST outcomes never retry automatically.
- Ordinary batches recover for 24 hours. Private batches and generated links disappear after their approved lifecycle.
- Stored passwords and raw source URLs are removed at their specified transition.
- No final-link request occurs before Generate.
- A confirmed one-source quick download waits for readiness, generates only when TorBox reports one file, and shows a clickable Download icon without opening a batch tab.
- One action requests at most 100 selected files and renders HTTPS links without starting a browser download.
- Optional notifications produce no more than one ready or attention notification per batch.
- Automated tests, type checking, a production build, extension lint, and a manual latest-stable Zen-on-Windows smoke test pass before v1 is called complete.

## Decision record

`grilling-log.md` records Q1 through Q44. Resume the interview at Q45 after v1 work pauses or finishes.
