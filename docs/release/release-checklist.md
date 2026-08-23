# Firefox and Zen release checklist

The public AMO listing is the normal installation channel. GitHub keeps source, issue tracking, release notes, and unsigned reviewer packages.

## Repository preparation

- [x] Preserve the GitHub repository's MIT license.
- [x] Use the owner-approved public name `Torbox Web Helper`.
- [ ] Confirm the exact AMO listing-bound extension ID before the next package; see `docs/project-status.md`.
- [x] Label the project as unofficial in the manifest description, listing, README, and privacy policy.
- [x] Publish the privacy policy, support policy, security policy, changelog, and contribution guide.
- [x] Add continuous verification and tag-based release packaging.
- [x] Prepare AMO listing copy, reviewer notes, and reproducible build instructions.
- [x] Enable GitHub private vulnerability reporting, secret scanning, push protection, dependency alerts, and automated security fixes.
- [ ] Confirm the public name and artwork do not violate TorBox branding rights.

## Release verification

- [ ] Complete every authenticated TorBox check in `docs/implementation-plan.md` with a dedicated account and small legal files.
- [ ] Record a complete pass of `docs/manual-smoke-test.md` on the latest stable Firefox for Windows.
- [ ] Record a complete pass on the latest stable Zen Browser for Windows.
- [x] Run `pnpm verify` from a clean GitHub Actions checkout with the lockfile frozen.
- [x] Inspect the tracked tree, package, and source archive for API keys, passwords, source credentials, Mega keys, generated links, account responses, and browser-profile data. Repeat this check after screenshots and manual-test logs exist.
- [x] Confirm `package.json`, the manifest, changelog, tag, and release title use version `0.1.1`.

## Owner and AMO work

- [x] Approve the permanent extension identity and public listing name.
- [x] Create or sign into the Mozilla Add-ons developer account and accept the current developer agreement.
- [x] Owner reported version 0.1.1 uploaded and awaiting Mozilla review on 2026-08-23.
- [ ] Choose a support email for the private AMO listing field.
- [ ] Create a dedicated, revocable TorBox reviewer account or API key.
- [ ] Host a stable HTTPS test page with small legal Hoster examples.
- [ ] Capture sanitized screenshots at the required AMO dimensions.
- [ ] Review and approve `PRIVACY.md` as the publisher.
- [ ] Confirm that AMO received the matching 0.1.1 source archive and any private reviewer notes it requested.
- [ ] Download and test the Mozilla-signed XPI in clean Firefox and Zen profiles.
- [ ] Publish the AMO listing only after the signed build passes installation, update, private-window, and removal checks.

Mozilla account creation, legal acceptance, MFA, CAPTCHA, private reviewer credentials, and the final publish decision remain owner actions.
