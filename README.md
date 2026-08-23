# TorBox Web Downloads for Firefox and Zen

This unofficial WebExtension finds TorBox-supported Hoster links on ordinary web pages. It creates TorBox Web Downloads after user confirmation. A one-link selection can finish in the popup; larger selections use a dedicated batch tab.

The first release targets Firefox and Zen Browser on Windows. It uses Firefox WebExtension APIs. Chromium is not supported yet.

This project is independent of TorBox and is not endorsed by TorBox. A TorBox account and API key are required.

## What v1 does

- Scans top-level HTTP and HTTPS pages after setup.
- Reads real anchor and image-map destinations only.
- Shows up to 100 distinct Hoster candidates from the current page. The popup discloses truncation. A later Zen benchmark may justify raising the cap.
- Supports exact-hostname exclusions, a global pause, optional NSFW Hosters, and private-window use after Zen grants access.
- Creates 1 to 60 Web Downloads sequentially and preserves partial results.
- Keeps a one-source download in the popup when TorBox reports one file, then shows a clickable Download icon when ready.
- Recovers ordinary batches for 24 hours and keeps terminal local history for seven days.
- Lets the user select reported files and generate at most 100 HTTPS links per action.
- Opens a generated link only after the user clicks it.

The extension does not scan frames, accept manual URLs, support Stream catalog entries, make ZIP links, delete TorBox account items, claim malware scanning, or call the browser Downloads API.

## Build

Requirements are Node.js 24 or later and pnpm 11.

```powershell
pnpm install
pnpm verify
```

The unpacked extension is written to `dist`.

## Install

The public AMO listing is being prepared. Firefox and Zen require Mozilla to sign an extension before it can remain installed in a normal release build. Files marked `unsigned` in GitHub Releases are reviewer and development packages, not normal-install packages.

Until the AMO listing is available, developers can load the extension temporarily:

1. Build the extension.
2. Open `about:debugging#/runtime/this-firefox` in Zen.
3. Choose **Load Temporary Add-on**.
4. Select `dist/manifest.json`.
5. Open the extension Settings page and save a TorBox API key.

Temporary installation ends when Firefox or Zen closes.

To use private windows, open the extension's Zen settings and grant private-window access. Private batches then remain available only for that browser session. They do not recover after Zen exits and never send notifications.

## Checks

```powershell
pnpm test
pnpm typecheck
pnpm build
pnpm lint:extension
pnpm smoke:zen -- "C:/path/to/zen.exe"
```

The headless smoke test creates an isolated temporary profile, checks that Zen records the extension as active, stops that process tree, and deletes the profile. It does not touch the normal Zen profile.

## First setup

Settings explains that Zen extension storage is local but is not an operating-system credential vault. Saving a key sends it to TorBox in an authenticated Hoster request. Discovery begins only after that request succeeds.

The popup displays the full source URL during selection, including embedded URL credentials and required Mega fragments. Confirmed ordinary batches may store unresolved source URLs and Hoster passwords locally. A Mega fragment can contain its decryption key. The extension deletes each password and replaces the raw URL after the create outcome, cancellation, or 24-hour cutoff. Resolved history keeps the source hostname and path, without credentials, query, or fragment.

See [PRIVACY.md](PRIVACY.md) and [docs/grilling-log.md](docs/grilling-log.md) for the full data and product decisions.

## Public release status

The source, automated verification, packaging workflow, AMO listing copy, reviewer notes, and privacy policy are kept in this repository. The remaining public-release gates are listed in [docs/release/release-checklist.md](docs/release/release-checklist.md).

Report normal bugs through [GitHub Issues](https://github.com/luanfernandes/torbox-firefox-extension/issues). Follow [SECURITY.md](SECURITY.md) for reports that contain credentials or other sensitive data.

## TorBox contract checks still requiring an account

The automated suite fixes the documented endpoint family, parameters, matching, batching, rate handling, recovery states, and generated-link policy. Before calling a build production-tested, use a user-owned API key and small legal files to record:

- the live create-body and success shape;
- the readiness sequence and list pagination;
- MD5 and creation-window reconciliation after a controlled lost response;
- the `redirect=false` generated-link response and expiry behavior.

Never place a real key or personal source URL in fixtures, screenshots, issues, or commits.
