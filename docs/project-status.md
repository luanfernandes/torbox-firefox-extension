# Project status

Updated 2026-08-23.

## Release state

- Version 0.1.1 is published as a GitHub prerelease with AMO-upload and reviewer-source archives.
- The owner reported that version 0.1.1 was uploaded to AMO and is awaiting Mozilla review.
- Treat the AMO submission as external state. Uploading, withdrawing, deleting, or replacing a version requires current owner direction.
- The repository root contains an untracked `torbox-web-downloads-0.1.0-firefox-unsigned.zip`. Preserve it unless the owner explicitly asks to remove it.

## Identity gate

The current manifest uses `torbox-web-helper@luanfernandes.github.io`. An earlier AMO validation error said its listing expected `torbox-web-downloads@luanfernandes.github.io`; the owner later reported that 0.1.1 reached review.

Before the next AMO package, inspect the listing and submitted version in the Mozilla Developer Hub and set the manifest ID to that exact listing-bound value. The display name remains `Torbox Web Helper` and does not determine the technical ID.

## Changes after 0.1.1

The following commits are not included in the submitted 0.1.1 package:

- `02e9705` adds `docs/screenshots/safe-demo-page.html`, a localhost fixture with seven intentionally invalid candidate links.
- `18ebbe5` replaces the extension artwork with cache-busting `torbox-link-48.svg` and `torbox-link-96.svg` files and adds `docs/artwork/torbox-web-helper-icon-512.png`.

The artwork borrows the green cube association from TorBox and replaces the official lightning bolt with a link mark. Confirm branding permission or choose a more independent design before broad publication.

## Resume sequence

1. Check the 0.1.1 AMO review status and capture any reviewer request verbatim.
2. Reconcile the manifest ID with the AMO listing before changing the version or packaging.
3. Resolve the artwork and TorBox branding-permission decision.
4. Bump the next submitted version to at least 0.1.2 and move the Unreleased changelog entries into that version.
5. Run `pnpm verify`, complete the Firefox and Zen smoke checks, and create matching upload and source archives with `pnpm package:release` from a clean tracked tree.
6. Inspect both archives for secrets and confirm the packaged manifest version, name, ID, and icon paths before uploading.

## Local testing

Run `pnpm build`, open `about:debugging` in Zen or Firefox, select **This Firefox**, and load `dist/manifest.json`. Click **Reload** after rebuilding. A temporary extension loaded from an old ZIP must be removed and loaded again from `dist/manifest.json` to see source changes.
