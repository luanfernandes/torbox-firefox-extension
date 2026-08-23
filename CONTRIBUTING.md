# Contributing

Bug reports and focused pull requests are welcome. Review the README, privacy policy, and existing tests before changing behavior.

## Development setup

Use Node.js 24 or later and pnpm 11.

```powershell
pnpm install --frozen-lockfile
pnpm verify
```

Load `dist/manifest.json` through `about:debugging#/runtime/this-firefox` for a temporary Firefox or Zen test installation.

## Pull requests

- Keep changes narrow and explain the user-visible result.
- Add or update tests for behavior changes.
- Run `pnpm verify` before opening the pull request.
- Update `PRIVACY.md` when data access, storage, transmission, or retention changes.
- Update `CHANGELOG.md` for user-visible changes.
- Never commit an API key, password, private source URL, generated link, captured account response, or browser profile.

Use small legal files and a dedicated TorBox test account for authenticated manual checks. Sanitize logs and fixtures before sharing them.
