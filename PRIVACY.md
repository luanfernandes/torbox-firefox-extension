# Privacy policy for Torbox Web Helper

Effective date: August 23, 2026

Torbox Web Helper is an unofficial, open-source Firefox and Zen Browser extension. It is independent of TorBox and is not endorsed by TorBox.

The extension has no analytics, telemetry, advertising, crash reporting, developer-operated server, or remote executable code. It scans link destinations locally. It sends data to TorBox only for API-key validation, Hoster catalog and batch status requests, a batch the user confirms, or a file link the user asks it to generate.

## Page access and automatic scanning

After setup, the extension runs on top-level HTTP and HTTPS pages unless the user pauses scanning or excludes the exact hostname. Its content script reads `href` destinations from anchors and image-map areas. It does not read page text, form values, cookies, media, embedded frames, page scripts, or shadow-root content.

The extension matches link destinations locally against the TorBox Hoster catalog. Complete candidate URLs remain in the isolated content script until the user opens the popup. Automatic scanning does not send a visited page URL or discovered candidate URL to TorBox, the developer, or another analytics service.

For the toolbar badge and popup, session storage records the top-level hostname, candidate count, Hoster identifiers and counts, scan time, catalog version, availability-verification state, private-window flag, and whether results were truncated. These summaries do not contain complete candidate URLs.

## Data sent to TorBox

The extension communicates only with `https://api.torbox.app` for TorBox operations. Depending on the action, it sends:

- the TorBox API key, normally in an authorization header and in the TorBox download-link request required by that endpoint;
- a selected source URL after the user confirms a batch, including its query, embedded URL credentials, and a Mega fragment when present;
- an optional Hoster password entered for that selected source;
- TorBox Web Download and file identifiers needed to check progress or request a generated link;
- paging parameters used to read the TorBox account's Web Download list.

The extension requests the authenticated Hoster catalog during setup, at most daily during normal maintenance, and immediately before creating or resuming a batch. TorBox may return account-specific Hoster usage and limit information. The extension stores that response as part of the cached catalog.

To observe extension-created batches and reconcile an uncertain creation result, the background process may temporarily read the TorBox account's full paged Web Download list. It filters that response in memory and stores file details only for Web Download identifiers owned by an extension batch. It does not transmit unrelated account records elsewhere.

When the user asks for a file link, TorBox returns a generated HTTPS URL. The extension keeps that URL only in the popup or batch tab that requested it. Clicking it sends a normal browser request to the address TorBox supplied. The destination service and the browser may then record the request or URL in server logs, browsing history, or download history. That processing occurs outside this extension.

TorBox processes these requests under its own terms and privacy practices. This extension does not control TorBox's server logs, account records, generated-link retention, or downstream download servers.

## Data stored in the browser

Firefox extension storage is tied to the browser profile. It is not an operating-system credential vault and is not guaranteed to be encrypted at rest.

### Local storage

The extension can store:

- the TorBox API key until the user clears it or uninstalls the extension;
- setup state, global pause, exact-hostname exclusions, NSFW display preference, and notification preference;
- the validated Hoster catalog, its account-specific usage counters when supplied, fetch time, and verification state until refreshed or the extension is uninstalled;
- ordinary batch state, TorBox Web Download identifiers, Hoster identifiers and names, status timestamps, sanitized errors, and reported file identifiers, names, MIME types, and sizes;
- the full unresolved source URL and optional Hoster password while creation is pending or its outcome is unknown;
- an MD5 source hash used only to warn about duplicate sources in recent batches;
- after a known create result, a source display value containing only hostname and path, without embedded credentials, query, or fragment.

The extension removes an ordinary-batch password and full source URL after TorBox returns a known creation outcome, the user cancels the item, or the 24-hour observation window ends. Before storing an API error, it redacts bearer tokens, token query values, HTTP and HTTPS URLs, and known submitted secrets.

Terminal ordinary-batch summaries are eligible for deletion seven days after their last update and can be dismissed sooner. Cleanup runs when the background process starts and during daily maintenance, so an expired record may remain until the browser or extension next runs. Dismissing a batch deletes only the extension's local record. It does not delete the corresponding item from the TorBox account.

Clearing the API key stops authenticated TorBox activity and automatic scanning. It does not remove existing ordinary-batch summaries. Users can dismiss those records separately or uninstall the extension to remove all extension storage from that browser profile.

### Session storage

Session storage holds candidate-count summaries, private-window batch state, unresolved private-batch source URLs and passwords, and a page-tab mapping for one-source quick batches. Session storage is cleared when the browser session ends or the extension reloads.

Private batches do not enter ordinary local batch history and never produce notifications. They can still send a user-confirmed source, password, API key, and status requests to TorBox. Private browsing does not hide those requests from TorBox or the generated-link destination.

### View memory

Complete current candidates stay in the page's isolated content-script memory until the popup requests them. Generated links stay only in the requesting popup or batch-tab document. Closing or reloading that view removes them from extension memory.

A generated link that the user already opened may remain in browser history or in the destination service's records. Mega fragments can contain decryption keys. Users should treat unresolved Mega URLs and generated links as credentials.

## Notifications

Notifications are optional and disabled by default. The extension asks for permission only when the user enables them in Settings. An ordinary batch can produce one notification when it becomes ready or first needs attention. Notifications contain batch status or a sanitized attention message. Private batches never notify.

## Data sharing and sale

The developer does not receive, sell, rent, or use extension data for advertising or profiling. The extension sends data only to TorBox for the user-requested functions described above and to a TorBox-supplied generated-link destination after the user clicks it.

## User controls

Users can:

- pause automatic scanning everywhere;
- exclude exact hostnames;
- keep NSFW Hosters hidden;
- disable notifications and remove their optional permission;
- clear the stored API key;
- cancel queued batch items;
- dismiss stored batch summaries;
- uninstall the extension to remove its browser-profile storage.

## Contact and policy changes

Report privacy questions through the project's [GitHub issue tracker](https://github.com/luanfernandes/torbox-firefox-extension/issues). Public issues must not contain API keys, passwords, embedded URL credentials, Mega fragments, generated links, private source URLs, or TorBox account responses. Use [GitHub private vulnerability reporting](https://github.com/luanfernandes/torbox-firefox-extension/security/advisories/new) for sensitive reports.

Material changes to data access, storage, transmission, or retention will update this policy's effective date and appear in the extension release notes.
