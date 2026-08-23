# AMO listing copy

Use this copy for the first public Firefox and Zen listing. Recheck every statement against the submitted version.

## Identity

- Name: `TorBox Web Downloads (Unofficial)`
- Suggested slug: `torbox-web-downloads-unofficial`
- Extension ID: `torbox-web-downloads@luanfernandes.github.io`
- License: MIT
- Homepage: https://github.com/luanfernandes/torbox-firefox-extension
- Support: https://github.com/luanfernandes/torbox-firefox-extension/issues
- Privacy policy: https://github.com/luanfernandes/torbox-firefox-extension/blob/main/PRIVACY.md
- Requires a non-free service: Yes. The extension needs a TorBox account and API key. TorBox controls its plans and limits.
- Affiliation: Independent project. Not published or endorsed by TorBox.

## Summary

Find TorBox-supported Hoster links on a page, create selected Web Downloads, and generate individual file links on request.

## Description

TorBox Web Downloads scans link destinations on eligible pages and shows links that match the current TorBox Hoster catalog. Select one link for a quick result in the popup, or create a batch and choose individual files in a dedicated tab.

The extension does not start browser downloads. It asks TorBox for a generated HTTPS link only after an explicit Generate action, then opens that link only when the user clicks it.

Main controls include a global pause, exact-hostname exclusions, optional NSFW Hosters, private-window support, daily Hoster availability refresh, duplicate warnings, batch recovery, and optional notifications.

An existing TorBox account and API key are required. This project is independent of TorBox and is not endorsed by TorBox.

## Permission explanations

### Access data for all websites

Automatic discovery runs on top-level HTTP and HTTPS pages after setup. The content script reads `href` destinations from anchors and image-map areas and matches them locally against the TorBox Hoster catalog. It does not read page text, forms, cookies, media, or embedded frames. A complete source URL leaves the page only after the user selects it and confirms a batch.

### Storage

Local storage keeps the API key, settings, Hoster catalog, ordinary batch recovery state, and seven-day summaries. Private batches and automatic page-count summaries use session storage. Generated links remain only in the open popup or batch-tab memory.

### Alarms

Alarms refresh the Hoster catalog and observe ordinary TorBox batches for up to 24 hours after their tab closes.

### Notifications

Notifications are optional, off by default, and requested only from Settings. The extension sends no private-window notifications.

## Suggested categories

- Download Management
- Other

## Required listing assets

- 1280 by 800 or 640 by 400 screenshots showing Settings, candidate selection, quick-download progress, and a batch ready for file selection.
- A clean add-on icon derived from the bundled extension artwork.
- A support email owned by the maintainer. Keep it out of this public file if it should not be indexed.
