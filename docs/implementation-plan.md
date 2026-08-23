# Implementation plan

Status: v1 implemented; authenticated TorBox smoke checks remain

## Completed

- TypeScript Manifest V3 extension shell with classic Firefox background script.
- Automatic top-level anchor and area discovery after validated setup.
- Daily Hoster catalog refresh, cached unverified fallback, domain-boundary and IDNA matching, regex-equivalence guard, current-status filtering, Hoster-only scope, and NSFW opt-in.
- Global pause, exact-hostname exclusions, private-window session behavior, 100-candidate cap, badge summaries, and on-demand complete candidate retrieval.
- Popup multi-selection, fixed Lucide action bar, per-source passwords, duplicate confirmation, 60-source cap, one-source quick-download progress and generated-link icon, and automatic batch-tab opening for larger selections.
- Mega fragment preservation through discovery, deduplication, recovery hashing, and submission while ordinary navigation fragments remain stripped.
- Local ordinary batches, session-only private batches, sequential create queue, password cleanup, redacted history, rate-limit pause, ambiguous-create state, MD5 reconciliation, 24-hour recovery, seven-day history, and optional notifications.
- Web Download observation, reported-file selection, default selection for sets up to 100, 100-link action cap, four-request concurrency, memory-only HTTPS links, and user-click navigation.
- Settings, privacy notes, build scripts, automated tests, extension lint, and a repeatable isolated Zen smoke script.

## Verification commands

```powershell
pnpm test
pnpm typecheck
pnpm build
pnpm lint:extension
pnpm smoke:zen -- "C:/path/to/zen.exe"
```

## Release checks requiring a TorBox account

Use a user-owned key and small legal test files. Sanitize every captured fixture.

1. Verify production accepts the URL-encoded create body and record the success envelope and ID type.
2. Record the Web Download readiness sequence, list ordering, maximum page size, and targeted-ID response shape.
3. Verify that production `hash` is the MD5 of the exact submitted URL and test one controlled lost-response reconciliation.
4. Record the `requestdl?redirect=false` response and confirm that the returned URL is HTTPS.
5. Exercise the manual workflow in `manual-smoke-test.md`, including password cleanup, private-session loss, restart recovery, partial failure, rate limiting where practical, and generated-link removal.

## Resume point

The design-tree interview remains paused after Q44. Read `grilling-log.md` and continue at Q45 instead of reopening settled questions.
