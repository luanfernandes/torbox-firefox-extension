# Architecture plan

Status: v1 implementation authorized on 2026-08-22

Read `product-spec.md`, `grilling-log.md`, and `research/torbox-api.md` before changing behavior or TorBox calls.

## Platform

- Manifest V3 WebExtension for the latest stable Zen Browser on Windows.
- Firefox `background.scripts` event page, not a service worker.
- TypeScript bundled to classic scripts.
- Native `browser.*` promise APIs.
- Plain HTML, CSS, and DOM rendering.
- Temporary developer installation. No signing or public-store metadata in v1.

## Components

| Component | Owns |
| --- | --- |
| Content scanner | Public matcher, automatic top-level discovery, candidate cap, mutation debounce, complete candidate memory, count summaries |
| Popup | Current-page candidate request, selection, duplicate confirmation, per-source password input, batch confirmation, pause and hostname exclusion |
| Batch tab | Durable progress view, file selection, explicit link-generation sessions, in-memory generated URLs |
| Settings | API-key validation and removal, global pause, exact-hostname exclusions, NSFW opt-in, optional notification permission |
| Background coordinator | Secrets, catalog, badges, count summaries, private-context checks, batches, alarms, notifications, TorBox calls |
| TorBox client | Request encoding, runtime response parsing, rate headers, secret redaction |
| Catalog matcher | Hoster validation, IDNA domain normalization, URL normalization, domain-boundary matching |
| Batch engine | Sequential create transitions, persistence, recovery, observation, timeout, source and password cleanup |

UI pages never receive the API key. Content scripts never receive the API key, passwords, authenticated usage, TorBox responses, or generated links.

## Manifest access

Required permissions are `storage` and `alarms`. Required host access covers HTTP and HTTPS pages because discovery runs automatically. Register the scanner statically at `document_idle` with `all_frames: false`.

Declare `notifications` as optional. Request it only from Settings after a user gesture. Do not request `activeTab`, `scripting`, `tabs`, `downloads`, cookies, history, clipboard, `webNavigation`, or unlimited storage.

Declare required `authenticationInfo` and `websiteContent` data collection because the extension transmits the saved key, selected source URL, and optional Hoster password to TorBox.

Set the private-browsing manifest behavior supported by Firefox and Zen. Zen still requires the owner to grant private-window access in extension settings.

## Storage

### `storage.local`

- API key and validation flag.
- Catalog, fetch time, version, and whether current availability is verified.
- Settings: global pause, exact-hostname exclusions, NSFW opt-in, notifications enabled.
- Ordinary batch records, including unresolved raw sources and passwords.
- Terminal ordinary history for seven days.

Delete an ordinary password after known create resolution, cancellation, or timeout. Replace a resolved raw source with hostname and path. Never store credentials, query, or fragment in history.

### `storage.session`

- Per-document count summary: tab ID, scanner instance ID, Hoster counts, catalog version, truncation, and scan time.
- Private batch records and unresolved private passwords.

Session storage contains no automatically captured full candidates. Private data never appears in an ordinary-window query, notification, or durable record.

### Page and view memory

- The content scanner owns complete current candidates until the popup asks for them.
- The batch tab owns generated URLs until reload or closure.

## Catalog lifecycle

1. Setup validates the key by fetching the authenticated Hoster list.
2. Store only validated Hoster entries needed for matching and UI.
3. Recreate a 24-hour alarm at background startup.
4. Refresh when the catalog is missing or at least 24 hours old.
5. Keep the last valid catalog after failure and mark current availability unverified.
6. Broadcast matcher-version changes to page scanners.
7. Before batch creation or resumed POSTs, require one successful authenticated preflight and revalidate selected Hosters.

Filter `type !== "hoster"`, current `status: false`, and opted-out NSFW entries from a fresh matcher. A failed refresh may reuse cached domains but labels resulting candidates unverified until preflight.

Normalize domains through the URL parser, deduplicate them, and use exact or dot-suffix hostname matching. Validate that TorBox's current regex remains domain-equivalent. Exclude a future divergent entry rather than execute changing remote regex.

## Automatic discovery

The scanner creates a random document-instance ID and requests a matcher. The background enables it only when the key is valid, scanning is globally active, and the exact page hostname is not excluded.

The scanner resolves `a[href]` and `area[href]`, keeps HTTP and HTTPS URLs, strips fragments, and deduplicates the serialized results. Embedded URL credentials and queries remain. V1 stops at 100 candidates and discloses truncation. Raise that cap only after a Zen performance measurement.

The scanner sends only counts, service IDs, catalog version, truncation, and its instance ID automatically. The background validates that summary, stores it in `storage.session`, and updates the badge. When the popup requests candidates, the background forwards a message to the current tab. The scanner returns the complete in-memory candidates, and the background reparses and rematches them before returning them to the popup.

A MutationObserver watches link additions, removals, and `href` changes. One debounced full replacement is safer than an incremental index. The scanner ignores subframes and unrelated mutations.

## Batch model

An ordinary batch lives in local storage. A private batch uses the same serializable model in session storage and carries `private: true`.

Each child stores:

- local ID, Hoster ID and name;
- raw normalized source while unresolved;
- optional password while unresolved;
- redacted hostname-and-path display after resolution;
- TorBox Web Download ID when known;
- state, timestamps, user-safe error;
- reported file ID, name, MIME type, and size.

Child states are `queued`, `creating`, `create_unknown`, `processing`, `ready_to_generate`, `failed`, `cancelled`, and `timed_out`.

## Sequential create and recovery

Persist the batch before networking. Preflight selected Hoster IDs, then process one queued child at a time through `POST /v1/api/webdl/createwebdownload`.

After a known response, delete its password and replace its raw source with the redacted display value. Continue after link-specific failure. Stop the queue on authentication failure. Pause on HTTP `429` or zero remaining quota.

After an ambiguous transport failure, compute the documented MD5 of the exact normalized source and page Web Download list results through the creation window. Attach only one unique match. Otherwise leave `create_unknown`. A Retry action must warn that it may duplicate a TorBox item.

At background startup, resume ordinary batches younger than 24 hours after a fresh authenticated preflight. Private batches resume only while their session record exists. At 24 hours delete remaining passwords, mark active children timed out, and require explicit Resume for ordinary work.

## Observation

While a batch tab is visible, let it request one refresh no faster than every five seconds. The background reuses one paged `/webdl/mylist` sweep across known IDs when possible and discards unrelated records.

After the tab closes, one-shot alarms observe ordinary batches once a minute for the first hour and every 15 minutes afterward. Stop after 24 hours. Private batches have no background notifications and no restart guarantee.

The documented file model has no infection field. Persist only reported file metadata and make no safety claim. An authenticated contract test must settle readiness fields and response shapes.

## Link generation

The batch tab selects reported files and sends one `GENERATE_LINK` command per file, with at most four commands in flight and 100 files per user action. The background calls `/v1/api/webdl/requestdl` with `redirect=false`, validates an HTTPS result, and returns it to that requesting tab only.

The batch tab renders `target="_blank"` links with `rel="noreferrer noopener"`. It stores results in document memory. The background does not persist or notify with generated URLs.

## Notifications

Settings requests optional permission and stores the enabled preference. Ordinary batches emit at most one notification when ready and one when first needing attention. Coalesce child changes into the batch notification. Private batches emit none.

## Test seams

- Catalog parser and matcher through public catalog-to-candidate functions.
- TorBox client through endpoint-specific methods with a mocked network boundary.
- Batch engine through serializable commands and resulting batch state with mocked TorBox and storage adapters.
- Scanner through a document fixture and its published summary/requested candidates.
- Popup and batch tab through serializable view models and DOM events.
- Packaged extension through manifest inspection, `web-ext lint`, and a Zen smoke test.

## Release blockers

- Authenticate against production to verify create encoding and success data.
- Record Web Download readiness states and list pagination behavior.
- Verify MD5 and creation-window reconciliation with a controlled lost-response case.
- Record `requestdl?redirect=false` response shape and HTTPS generated URL behavior.
- Benchmark the candidate cap and run the full smoke test on the latest stable Zen for Windows.
