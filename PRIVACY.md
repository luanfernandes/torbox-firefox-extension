# Privacy notes

V1 is a local personal-development extension. It has no analytics, telemetry, advertising, crash reporting, or remote UI code.

## Page access

Automatic discovery requires access to top-level HTTP and HTTPS pages. After setup, the content script reads `href` values from anchors and image-map areas. It does not read page text, form values, cookies, media, or embedded frames.

Complete matching URLs remain inside the page's isolated content script until the popup asks for them. Automatic session state contains the candidate count, Hoster identifiers, scan time, and truncation state. It does not contain complete page candidates.

The user can pause discovery everywhere or exclude an exact hostname.

## Data sent to TorBox

The extension sends the following data to `https://api.torbox.app`:

- the API key for authenticated requests;
- a selected source URL, including any embedded URL credentials and any required Mega fragment;
- an optional Hoster password supplied for that selected source;
- TorBox Web Download and file identifiers needed to observe an item or generate a link.

It sends a source only after the user confirms a batch. Generated-link requests happen only after the user presses Generate.

The Firefox manifest declares required `authenticationInfo` and `websiteContent` data collection permissions because these values leave the browser for TorBox processing.

## Local data

`storage.local` may contain:

- the API key;
- settings and exact-hostname exclusions;
- the validated Hoster catalog;
- ordinary batch state;
- unresolved source URLs and Hoster passwords;
- seven-day batch history with reported file metadata.

Extension storage is not an operating-system credential vault. Settings provides Replace and Clear API-key actions.

The extension deletes a Hoster password after its create outcome, cancellation, or 24-hour timeout. Once a create outcome is known, it replaces the raw source URL with its hostname and path. It removes credentials, query, and fragment from history.

`storage.session` contains candidate-count summaries and private-batch state. Zen clears it when the browser session ends.

Generated links remain only in the requesting popup or batch tab's memory. Reloading or closing that view removes them. Mega fragments can contain decryption keys; unresolved Mega source URLs follow the same temporary batch-storage lifecycle as other raw sources.

## Private windows

Zen disables private-window access until the user grants it. Private batches use session storage, do not recover after Zen exits, do not enter ordinary history, and never send notifications.

## Remote deletion

Dismissing local history deletes local batch records only. V1 never deletes a Web Download from the TorBox account.
