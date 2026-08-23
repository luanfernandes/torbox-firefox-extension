# Extension distribution and browser expansion

Research date: 2026-08-22

This note answers two questions for the current repository:

1. How to turn the temporary Zen installation into an extension that stays installed and updates normally.
2. What it would take to support more desktop operating systems and Chromium browsers.

Only official browser and store documentation is cited. Time estimates are engineering estimates for this repository, not store guarantees.

## Short answer

The shortest path is an AMO-signed Firefox extension. Zen's own documentation says it installs extensions from Mozilla Add-ons, so one Firefox release covers both Firefox and Zen without a separate Zen store submission. Firefox and Zen release builds require Mozilla signing for a normal persistent installation. Mozilla offers two channels: a public AMO listing with store discovery and automatic updates, or an unlisted signed XPI that the developer distributes. [Zen extension documentation](https://docs.zen-browser.app/user-manual/extensions), [Mozilla signing overview](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)

The current codebase is close to an AMO submission. The remaining work is mostly release preparation, privacy documentation, reviewer access, and the authenticated TorBox release checks already recorded in `docs/implementation-plan.md`. A public release should not go out before those checks pass.

Supporting Zen and Firefox on macOS and Linux is low effort because the extension contains no native executable or operating-system integration. Zen publishes desktop builds for Windows, macOS, and Linux. The extension package itself should be shared across those systems, but the UI, private-window behavior, suspend and restart recovery, notifications, and popup placement still need hands-on tests on each OS. [Zen download page](https://zen-browser.app/download/)

Chromium is a real port, but not a rewrite. The main change is Chrome Manifest V3's extension service worker. The current Firefox background event page cannot be used as Chrome's background declaration. [Chrome MV3 overview](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3), [cross-browser background manifests](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)

## Making the Firefox and Zen build normally installable

### Choose the release channel

Public AMO listing is the better default for general use.

- Users find and install the extension through AMO. Zen directs users to AMO for extensions.
- Firefox handles updates when a new AMO version is published.
- Mozilla provides free hosting and update services. [AMO about page](https://addons.mozilla.org/en-US/about)

Unlisted self-distribution is useful for a private beta or a small personal audience.

- The package still goes through AMO validation and Mozilla signing.
- The signed XPI is not discoverable on AMO. The developer downloads it and distributes it from a website or directly.
- Automatic updates require an `update_url` and a hosted update manifest, or users must install updates manually. [Mozilla self-distribution guide](https://extensionworkshop.com/documentation/publish/self-distribution/), [AMO submission guide](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)

All Firefox extensions need Mozilla signing for release and beta Firefox. Mozilla applies its add-on policies to listed and unlisted extensions and can manually review either channel. Automated signing can take up to 24 hours. A selected manual review can take longer. [Mozilla signing overview](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)

### Release work for this repository

1. Pick the permanent extension identity before the first submission. Manifest V3 signing requires a unique `browser_specific_settings.gecko.id`. The current `torbox-web-downloads@local` is syntactically valid, but its name says it is a local build. Changing the ID after release creates a different extension identity and a different storage namespace, so users would have to install again and re-enter their key. [Mozilla add-on ID documentation](https://extensionworkshop.com/documentation/develop/extensions-and-the-add-on-id/)

2. Finish the authenticated release checks in `docs/implementation-plan.md`. They cover create response encoding, Web Download readiness, list paging, MD5 reconciliation, `requestdl` response shape, HTTPS generated URLs, password cleanup, private-session loss, restart recovery, and partial failures.

3. Run the automated suite and repeat the current latest-stable Zen smoke test. Add a manual Firefox test. Test a clean installation as well as an update from the previous version.

4. Write and publish a privacy policy at a stable HTTPS URL. This extension transmits data from the device, so AMO requires a policy explaining what is sent and how it is used. The policy should cover automatic local page scanning, local API-key and unresolved-password storage, retention periods, private-window behavior, selected source URLs and credentials sent to TorBox, generated-link lifetime, the lack of telemetry, and how users clear stored data. It must name TorBox as the external recipient. [AMO submission fields](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/), [Mozilla add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/)

5. Keep the Firefox data declarations accurate. New AMO extensions must declare data transmission in `browser_specific_settings.gecko.data_collection_permissions`, and Manifest V3 signing requires the Gecko ID. The current required declarations are a reasonable match for the implemented transmissions:

   - `authenticationInfo` covers the TorBox API key and optional Hoster password.
   - `websiteContent` covers selected links discovered in page content.

   The scanner's automatic count summaries stay inside the browser, so they do not add an external-transmission category. Add `browsingActivity` only if a future version sends visited page URLs or domains outside the extension. Mozilla defines these categories separately. [Firefox built-in data consent](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/), [Gecko manifest settings](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)

6. Prepare the AMO listing. It needs a name, summary, detailed description, categories, license, support contact, privacy policy, and reviewer notes. Disclose that useful operation requires a non-free TorBox service. Explain why automatic discovery needs HTTP and HTTPS access on every page. Mozilla requires minimum necessary permissions and truthful behavior descriptions. [AMO submission guide](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/), [Mozilla add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/)

7. Give reviewers a reproducible way to test. Mozilla asks for testing instructions and credentials when functionality requires an account. This project should provide a temporary controlled TorBox test account or key, safe example source links, and exact steps for discovery, batch creation, observation, and link generation. Do not place that credential in the extension package or source archive. [Mozilla add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/)

8. Upload both the built extension and a source archive. The TypeScript is bundled by esbuild, so AMO needs the original source, lockfile, and exact build instructions for every submitted version. Obfuscated code is forbidden. Mozilla permits generated and minified code only when reviewers can reproduce and inspect it. The current non-minified build is helpful. [Mozilla source submission guide](https://extensionworkshop.com/documentation/publish/source-code-submission/)

9. Submit through the AMO Developer Hub or `web-ext sign`. For a public listing, AMO hosts the signed extension and updates. For an unlisted build, download the signed XPI and distribute it yourself. [Mozilla signing overview](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)

### Review points that deserve care

The broad `http://*/*` and `https://*/*` access is necessary for the owner-approved automatic scanning model, but it increases review scrutiny. The listing and onboarding should say plainly that the content script examines real link destinations locally, automatically reports only Hoster counts inside the extension, and sends a full link to TorBox only after the user selects it and creates a batch.

Private browsing also needs a clear review note. The current design keeps private batches in `storage.session`, sends no private notifications, and makes no restart guarantee. Mozilla's policy prohibits storing private-browsing data, so the submission should explain the memory-only design and confirm it against the current reviewer interpretation before release. [Mozilla add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/)

The product name and artwork should not imply that TorBox officially publishes or endorses the extension unless the owner has permission to make that claim. This is a release ownership check rather than a browser API issue.

## Other operating systems

The runtime code has no Windows-only dependency. HTML, CSS, content scripts, `fetch`, extension storage, alarms, tabs, and notifications are WebExtension features. One AMO-signed XPI should therefore run on Firefox and Zen across supported desktop operating systems.

The current smoke-test script is Windows-specific because it calls `taskkill.exe` and uses `windowsHide`. That script needs a portable process-shutdown path before it can validate macOS and Linux. This affects test automation, not the shipped extension.

Recommended OS matrix:

| Browser | Windows | macOS | Linux |
| --- | --- | --- | --- |
| Latest Firefox stable | install, popup, normal/private flow, restart | same plus native popup placement | same plus Wayland/X11 and package variants |
| Latest Zen stable | existing full smoke | popup/sidebar placement and private mode | popup/sidebar placement on Flatpak and one non-Flatpak build |

Linux Flatpak deserves its own smoke test because sandboxing and profile paths differ from native packages. Zen documents both Flatpak and direct Linux packages. [Zen Linux installation guide](https://docs.zen-browser.app/guides/install-linux)

## Chromium port

### Required implementation changes

Use separate Firefox and Chromium release manifests generated from shared metadata. A single cross-browser manifest can declare both background forms, but separate outputs make store-only fields, minimum versions, and validation failures easier to control.

The Chromium manifest needs these changes:

- Declare `background.service_worker: "background.js"`. Chrome Manifest V3 uses a service worker and ignores Firefox's `background.scripts`. Firefox uses `background.scripts` because it does not support extension background service workers. [cross-browser background manifests](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)
- Remove Firefox-only `browser_specific_settings`, `gecko.data_collection_permissions`, and `action.default_area` from the Chromium output.
- Add `minimum_chrome_version: "148"` if the project wants to keep its current unconditional `browser.*` calls and Promise-returning message listener. Chrome 148 added the `browser` namespace and native Promise responses for `runtime.onMessage`. If older Chromium releases must work, add a compatibility guard or polyfill and use the older `sendResponse` plus literal `true` listener pattern. [Chrome browser namespace transition](https://developer.chrome.com/docs/extensions/develop/concepts/browser-namespace)
- Produce PNG extension icons at 16, 32, 48, and 128 pixels. Chrome does not support SVG files for manifest icons and requires a 128-pixel PNG in the store package. The current manifest has only 48 and 96 pixel SVG files. [Chrome icon documentation](https://developer.chrome.com/docs/extensions/develop/ui/configure-icons), [Chrome Web Store image requirements](https://developer.chrome.com/docs/webstore/images)
- Build and validate a Chromium package separately. The current esbuild target is `firefox142`, and the current lint step validates only the Firefox-style `dist` directory.

Most foreground APIs used here have direct Chromium equivalents. `storage.local`, `storage.session`, alarms, tabs, action badges, optional notifications, and Promise-returning API methods exist in current Chrome. The notification already supplies the icon that Chrome requires. [Chrome storage API](https://developer.chrome.com/docs/extensions/reference/api/storage), [Mozilla Chrome incompatibilities](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities)

### The main engineering risk

The durable queue must be tested against service-worker termination. Chrome normally stops an extension service worker after 30 seconds of inactivity and tells developers to persist state rather than rely on globals. The current background coordinator persists batches, which is a strong starting point, but it also uses in-memory queue guards and a shared request promise. Tests must terminate and restart the service worker during creation, observation, rate-limit pause, and ambiguous network recovery. The worker must resume without duplicate TorBox POSTs. [Chrome service-worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle), [Chrome service-worker migration guide](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers)

The HTTP and HTTPS page-wide access is still needed for automatic discovery. Chrome flags patterns such as `https://*/*` and `<all_urls>` as factors that can lengthen review. The dashboard must justify every permission and state the extension's narrow single purpose. [Chrome review process](https://developer.chrome.com/docs/webstore/review-process), [Chrome privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)

### Chrome Web Store release work

1. Register a Chrome Web Store developer account, enable 2-Step Verification, and pay the one-time fee. Google's developer registration page confirms a one-time fee, and its official Web Store support form currently identifies it as US$5. [Chrome developer registration](https://developer.chrome.com/docs/webstore/register), [Chrome Web Store support](https://support.google.com/chrome_webstore/contact/one_stop_support)
2. Upload the Chromium ZIP and complete the listing, privacy, distribution, and testing fields.
3. Publish a privacy policy that covers local handling as well as TorBox transmission. Chrome treats website content, browsing activity, and authentication data as user data even when some processing stays local. The policy must explain collection, use, and every party that receives the data. [Chrome user-data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), [Chrome Web Store policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
4. Provide a 128-pixel PNG icon, a 440 by 280 promotional image, and at least one 1280 by 800 or 640 by 400 screenshot. [Chrome Web Store image requirements](https://developer.chrome.com/docs/webstore/images)
5. Justify `storage`, `alarms`, optional notifications, and page-wide host access in the dashboard. Declare that the package does not execute remote code. TorBox API responses are data, not remotely executed code.
6. Supply reviewer instructions and a safe TorBox test account or key.

Google says most reviews finish within a few days, but they can take a few weeks. A new developer, a new extension, broad host permissions, and substantial code can increase review time. [Chrome review process](https://developer.chrome.com/docs/webstore/review-process)

### Edge and other Chromium browsers

After the Chrome build is reliable, Microsoft Edge should require little additional code. Microsoft documents Chrome extension API and manifest compatibility as the normal porting route. Maintain a separate Edge listing even if the package is nearly identical, because Microsoft recommends a listing in each browser's store for discoverability. [Microsoft porting guide](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension), [Edge extension overview](https://learn.microsoft.com/en-us/microsoft-edge/extensions/)

Edge publishing uses Partner Center. Registration is free and supports individual accounts. The submission needs a ZIP, store description, logo, privacy information, markets, and certification notes. Public and hidden listings are available. [Edge developer registration](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account), [Edge publishing guide](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)

Other Chromium browsers can start with the Chrome package, but each browser still needs a smoke test and may have its own store, review policy, or minimum Chromium version. Do not claim support based only on a successful Chrome run.

## Cost and difficulty

| Target | Store cost documented by the store | Estimated engineering effort | Assessment |
| --- | --- | --- | --- |
| Signed unlisted Firefox and Zen XPI | Mozilla provides free hosting and updates | 1 to 2 focused days after authenticated release checks | Low. Fastest persistent install, but self-hosted automatic updates add operational work. |
| Public AMO listing for Firefox and Zen | Mozilla provides free hosting and updates | 2 to 5 focused days, plus review time | Low to medium. Most work is privacy, reviewer setup, source packaging, listing assets, and release testing. |
| Zen and Firefox on macOS and Linux | No extra store fee | 1 to 3 focused days for a first test pass, longer if Zen UI bugs appear | Low. Same XPI, wider test matrix. |
| Chrome Web Store | US$5 one-time registration fee | 4 to 8 focused days, plus a few days to a few weeks of review | Medium. Service-worker reliability, a Chromium manifest/build, PNG assets, privacy declarations, and broad-host review are the real work. |
| Microsoft Edge Add-ons after Chrome | No registration fee | Half a day to 2 focused days, plus certification | Low incremental effort. Reuse the Chromium package, then test and maintain a second listing. |

These estimates assume no TorBox API contract failures and no store rejection. The fastest sensible sequence is:

1. Finish authenticated release tests.
2. Publish a signed unlisted AMO beta.
3. Run clean-install and update tests on Zen and Firefox.
4. Prepare the public AMO listing.
5. Add macOS and Linux smoke coverage.
6. Build the Chrome 148 service-worker target and stress recovery.
7. Publish Chrome, then reuse that package for Edge after an Edge smoke pass.
