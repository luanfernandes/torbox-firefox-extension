# TorBox browser extension

Build a WebExtension for the latest stable Zen Browser on Windows. Keep the implementation compatible with Firefox WebExtension APIs. It scans eligible pages automatically for candidate links from the TorBox Hoster catalog, accepts multi-link selections, creates TorBox Web Downloads, and generates individual file links only when the user asks.

## Current phase

V1 is implemented and passes automated verification plus isolated Zen 154 installation. Public Firefox and Zen release preparation is active. Authenticated TorBox checks and Mozilla submission tasks remain in `docs/release/release-checklist.md`. The design-tree interview is paused after Q44 and resumes at Q45.

## Working rules

- Verify v1 on the latest stable Firefox and Zen Browser on Windows. Treat Chromium and other operating systems as later work.
- Scan every eligible top-level HTTP and HTTPS page automatically. Keep the required broad site access visible in the manifest, onboarding, store listing, and privacy disclosure.
- Keep the TorBox token and every TorBox request in the background context. Page-scanning code receives public matcher data, publishes counts automatically, and returns full matched candidates only when the popup requests them.
- Treat a user batch as an extension queue. The TorBox WebDL API currently creates one link per request.
- Use Web Download endpoints under `/v1/api/webdl`. Torrent IDs and `/torrents/requestdl` are outside this product flow.
- Generate requested file links only after an explicit user action. Present them as clickable links and never start a local download automatically.
- Preserve fragments for Mega sources throughout matching and submission. Strip ordinary navigation fragments from other Hosters.
- Keep one-source work in the popup when TorBox reports one file. Use the dedicated batch tab for larger selections and multi-file choice.
- Use the best-fitting Lucide icon for every owner-requested icon control. Bundle icons locally and include accessible labels and hover tooltips.
- Keep generated links in the requesting popup or batch-tab memory. Store the TorBox API key and unresolved ordinary-batch passwords locally, never in synced storage. Delete each password when its create outcome becomes known, the user cancels it, or the 24-hour window ends.
- Refresh the hoster catalog every 24 hours and revalidate selected hosters immediately before creating a batch.
- Make the smallest change that meets the current acceptance criteria. State uncertain assumptions before implementation and verify each phase before moving on.

## Context pointers

- **Product behavior:** Read `docs/product-spec.md` before changing automatic scanning, batches, UI states, privacy behavior, generated links, or acceptance criteria.
- **Architecture:** Read `docs/architecture.md` before changing permissions, component boundaries, storage, matching, scheduling, API calls, batch state, or link generation.
- **Delivery plan:** Read `docs/implementation-plan.md` before starting implementation, adding dependencies, planning tests, or packaging a release.
- **Public release:** Read `docs/release/release-checklist.md` before changing the permanent identity, version, release artifacts, GitHub automation, signing, AMO metadata, or reviewer material.
- **Domain language:** Read `CONTEXT.md` before naming product concepts, models, messages, tests, or issues.
- **TorBox API contract:** Read `docs/research/torbox-api.md` before implementing or reviewing a TorBox request, response, rate limit, or batch assumption. Recheck the live official contract when that note is stale.
- **Mega links:** Read `docs/research/mega-links.md` before changing fragment normalization, Mega matching, source hashing, persistence, or submission.
- **Grilling:** Read `docs/grilling-log.md` before resuming the design interview. Continue at Q45 and preserve Q1-Q44 unless the owner explicitly revises one.
- **Issue tracker:** Read `docs/agents/issue-tracker.md` when creating, reading, updating, or closing GitHub issues.
- **Triage:** Read `docs/agents/triage-labels.md` when applying or interpreting triage labels.
- **Domain documentation:** Read `docs/agents/domain.md` when editing the glossary or recording an architectural decision.
