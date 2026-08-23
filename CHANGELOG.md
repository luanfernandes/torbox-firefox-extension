# Changelog

This project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Added a local page with intentionally invalid, neutral candidate links for safe store screenshots.
- Added 512-pixel artwork for the extension listing.

### Changed

- Replaced the toolbar artwork with a green box and Lucide-style link mark, using new filenames to avoid stale browser icon caches.

## [0.1.1] - 2026-08-23

### Changed

- Renamed the extension to Torbox Web Helper and assigned its permanent Firefox ID.
- Rewrote the privacy policy from the implemented storage, scanning, TorBox API, and retention behavior.
- Added release packaging that produces matching AMO-upload and reviewer-source ZIP files with SHA-256 checksums.
- Run seven-day history cleanup at startup and during daily maintenance.
- Redact URLs and known submitted secrets from stored API error details.

### Distribution status

- The GitHub ZIP is prepared for AMO upload and still requires Mozilla signing before normal installation.

## [0.1.0] - 2026-08-22

### Added

- Automatic supported-Hoster discovery on eligible pages.
- Popup selection with one-source quick link generation.
- Durable multi-source batches with explicit file-link generation.
- Daily Hoster catalog refresh and live preflight before creation.
- Mega link support with required fragment preservation.
- Local settings, exact-hostname exclusions, private-window handling, and optional notifications.
- Firefox and Zen packaging, tests, extension linting, and isolated Zen smoke testing.

### Distribution status

- GitHub packages for this version are unsigned development and AMO-submission artifacts.
- Normal Firefox and Zen installation requires a Mozilla-signed XPI or the future AMO listing.

[0.1.0]: https://github.com/luanfernandes/torbox-firefox-extension/releases/tag/v0.1.0
[0.1.1]: https://github.com/luanfernandes/torbox-firefox-extension/releases/tag/v0.1.1
