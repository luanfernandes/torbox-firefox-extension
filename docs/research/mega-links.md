# Mega public links and TorBox Web Downloads

Research date: 2026-08-22. Sources are limited to TorBox's live public API and official SDK documentation, Mega's official SDK source, and the URI standard.

## Conclusion

TorBox currently advertises Mega as an available Web Download hoster. Its live public catalog returned a `Mega` record with `status: true`, domains `mega.nz`, `mega.io`, and `mega.co.nz`, a daily link limit of 100, and a 200 GiB per-link limit at `2026-08-22T19:16:46-03:00`. TorBox defines `status` as whether a hoster can be used at the current time. [Live TorBox hoster catalog](https://api.torbox.app/v1/api/webdl/hosters), [official TorBox Web Download SDK documentation](https://github.com/TorBox-App/torbox-sdk-py/blob/main/documentation/services/WebDownloadsDebridService.md#get_hoster_list)

The legacy Mega URL supplied for this project is a supported Mega public-link shape:

```text
https://mega.co.nz/#!CmZ2GDIS!a7XB7-YT831zM8e5SrCbwBfh_8wF2INWjqrEFRk_rFU
```

The fragment is required. In this legacy format, `CmZ2GDIS` is the public handle and the value after the next `!` is the file key. Mega's official SDK explicitly accepts `#!<public-handle>!<key>` file links. Its parser searches for `#!`, reads the handle, and then reads the key after `!`; it returns an incomplete-link error when no key is present. The same SDK's exported-link detector recognizes both `https://mega.co.nz/#!...` and the current `/file/...#...` form. [Mega SDK public-link parser](https://github.com/meganz/sdk/blob/b93cc672b92eb61fefe84a21719657c13a9b11c0/src/megaclient.cpp#L11817-L11892), [Mega SDK exported-link detector](https://github.com/meganz/sdk/blob/b93cc672b92eb61fefe84a21719657c13a9b11c0/src/autocomplete.cpp#L347-L365)

Stripping the fragment from this example leaves only `https://mega.co.nz/`. That removes both the public handle and decryption key, so it cannot identify or decrypt the file. This is not an ordinary page anchor. Mega uses the URI fragment as public-link data. URI syntax also defines the fragment as separate from the primary resource identifier and says clients process it separately after retrieving the resource. [RFC 3986 section 3.5](https://www.rfc-editor.org/rfc/rfc3986#section-3.5)

## What TorBox's public contract proves

The live catalog proves that TorBox currently recognizes the Mega domains and marks the hoster usable. TorBox's official documentation says the catalog is dynamic and recommends checking `status` immediately before submission. [Official TorBox Web Download SDK documentation](https://github.com/TorBox-App/torbox-sdk-py/blob/main/documentation/services/WebDownloadsDebridService.md#get_hoster_list)

TorBox's public documentation does not list accepted Mega URL variants. Its create route accepts one scalar `link` field but does not publish hoster-specific parsing behavior. Therefore the public sources do not prove that every legacy `mega.co.nz/#!...` link will succeed end to end. An authenticated create request with a controlled, known-good Mega file is still needed to confirm TorBox's current downloader accepts the legacy shape. The supplied example may also be expired or removed, independently of format support. [TorBox OpenAPI description](https://api.torbox.app/openapi.json), [official create-Web-Download documentation](https://github.com/TorBox-App/torbox-sdk-py/blob/main/documentation/services/WebDownloadsDebridService.md#create_web_download)

## Required extension behavior

1. Preserve the complete fragment for catalog-matched Mega URLs during extraction, canonicalization, deduplication, messaging, and Web Download submission.
2. Submit the complete Mega URL as the `link` form field. Do not set `URL.hash` to an empty string for `mega.nz`, `mega.io`, or `mega.co.nz`.
3. Treat both legacy `#!<handle>!<key>` and current `/file/<handle>#<key>` links as semantically distinct from their fragment-free versions.
4. Avoid logging or persisting Mega fragments unless needed for the existing batch recovery policy. The fragment contains the decryption key, according to Mega's official parser and API documentation. Mega's API describes public-link operations as requiring a link that includes its encryption key. [Mega SDK API documentation](https://github.com/meganz/sdk/blob/b93cc672b92eb61fefe84a21719657c13a9b11c0/include/megaapi.h#L14892-L14969)

The existing global policy of stripping fragments before deduplication and submission must gain a Mega exception. Preserving only the fragment for display but not submission is insufficient.
