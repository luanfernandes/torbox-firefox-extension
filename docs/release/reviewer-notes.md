# AMO reviewer notes

Update the bracketed values in the private AMO submission form. Do not commit reviewer credentials.

## Build reproduction

Requirements:

- Node.js 24 or later
- pnpm 11.19.0

Commands:

```powershell
pnpm install --frozen-lockfile
pnpm verify
pnpm package
```

`pnpm build` bundles TypeScript with esbuild into classic, non-minified scripts in `dist`. It copies the static manifest, HTML, CSS, and icons from `src/static`. `pnpm package` then creates the Firefox ZIP in `web-ext-artifacts`.

The submitted source archive is produced from the release tag with `git archive`. It excludes ignored build output and dependencies because those files are not tracked.

## Test access

- TorBox test-account email: `[private AMO field]`
- TorBox API key: `[private AMO field]`
- Controlled test page: `[stable HTTPS URL with legal Hoster links]`
- Tested Firefox version: `[version]`
- Tested Zen version: `[version]`

The API key belongs only in private reviewer notes. Revoke it after review.

## Test procedure

1. Install the extension and open Settings.
2. Save the supplied TorBox API key. The extension validates it through the authenticated Hoster-list endpoint.
3. Open the controlled test page. The toolbar badge should show the number of currently available Hoster candidates.
4. Open the popup, select one safe source, and press Create. The popup should show that TorBox is processing it.
5. When TorBox reports one file, the popup requests its generated link under the user's original Create action. The Download icon opens the HTTPS result in a new tab only when clicked.
6. Select two safe sources to exercise the dedicated batch tab. Creation occurs sequentially. Select reported files and use Generate to request links explicitly.
7. Open Settings to test Pause everywhere, the exact-hostname exclusion, and optional notification permission.

## Data and privacy notes

The extension sends the saved API key, user-selected source URL, optional Hoster password, and TorBox item or file identifiers to `https://api.torbox.app`. It does not transmit all visited URLs or automatic discovery results. Full source links are sent only after batch confirmation.

The extension contains no analytics, advertising, telemetry, remote scripts, or remotely hosted UI assets. Its broad HTTP and HTTPS access exists because automatic discovery is the single purpose of the extension.

Private-window batches use `storage.session`, create no notifications, and are not copied into ordinary durable history. Generated TorBox links stay in the requesting extension view's memory and disappear when that view closes or reloads.
