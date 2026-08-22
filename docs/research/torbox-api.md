# TorBox Web Download API research

Research date: 2026-08-22. Sources are limited to TorBox's live API/OpenAPI description, TorBox's official generated SDK, and Mozilla's WebExtension documentation.

## What the extension should build against

The two corrections that matter most are:

- The hoster endpoint is `GET /v1/api/webdl/hosters`. There is no documented `PUT` method on this route. "Optional" refers to authentication: omit the bearer token for the public hoster catalog, or include it to get the user's live usage counters. The unrelated WebDL `PUT` route is `/v1/api/webdl/editwebdownload`, which edits an existing download item. [TorBox API docs](https://api-docs.torbox.app/#0a17f8b0-87a1-459c-b2d9-32d34b00c2ae), [live OpenAPI](https://api.torbox.app/openapi.json)
- `GET /v1/api/torrents/requestdl` is the torrent route. Its required item parameter is `torrent_id`. Web downloads have a separate route, `GET /v1/api/webdl/requestdl`, whose required item parameter is `web_id`. The torrent permalink shown inside TorBox's generated WebDL prose is a copy-and-paste documentation error. The live OpenAPI description defines the routes separately. [live OpenAPI](https://api.torbox.app/openapi.json), [official WebDL SDK documentation](https://github.com/TorBox-App/torbox-sdk-js/blob/main/documentation/services/WebDownloadsDebridService.md)

## Verified API contract

### Hoster catalog and limits

Request:

```http
GET https://api.torbox.app/v1/api/webdl/hosters
Authorization: Bearer <API_KEY>  # optional
```

The public call succeeds without authentication. TorBox calls the list dynamic and says `status` represents whether a hoster can be used "at the current time". It recommends checking `status` before submitting a download. `type` is `hoster` or `stream`; TorBox says both work the same way. `note` is intended for display to users. [TorBox WebDL service documentation](https://github.com/TorBox-App/torbox-sdk-py/blob/main/documentation/services/WebDownloadsDebridService.md)

A live unauthenticated response on the research date used the standard envelope:

```json
{
  "success": true,
  "error": null,
  "detail": "Hosters list and information retrieved successfully.",
  "data": [
    {
      "id": 2,
      "name": "1Fichier",
      "domains": ["1fichier.com"],
      "url": "https://1fichier.com",
      "icon": "https://torbox.app/images/hoster-icons/1fichier.png",
      "status": true,
      "type": "hoster",
      "note": null,
      "nsfw": false,
      "daily_link_limit": 50,
      "daily_link_used": 0,
      "daily_bandwidth_limit": 10737418240000,
      "daily_bandwidth_used": 0,
      "per_link_size_limit": 214748364800,
      "regex": "^https?://(?:[^./]+\\.)*(1fichier\\.com)(/|$)"
    }
  ]
}
```

Source: [live hoster endpoint](https://api.torbox.app/v1/api/webdl/hosters). The live response has more fields than the generated SDK model, so the extension should preserve unknown fields and validate the fields it uses instead of treating the SDK model as exhaustive. [official SDK hoster model](https://github.com/TorBox-App/torbox-sdk-py/blob/main/documentation/models/GetHosterListOkResponse.md)

Without a bearer token, `daily_link_used` and `daily_bandwidth_used` are not guaranteed to be the current user's values. TorBox documents optional bearer authentication as the way to obtain accurate user usage. A zero limit means unlimited. TorBox recommends using the daily link limit rather than the bandwidth limit. [TorBox WebDL service documentation](https://github.com/TorBox-App/torbox-sdk-py/blob/main/documentation/services/WebDownloadsDebridService.md)

No TorBox source prescribes a 24-hour cache for this endpoint. A daily cache is an extension policy, not an API guarantee. The live response had no `Cache-Control`, `ETag`, or `Last-Modified` header and Cloudflare marked it `DYNAMIC`. Because both `status` and user usage can change during the day, a cached list is suitable for page discovery, but not as a hard guarantee at submission time.

### Create a Web Download

Request:

```http
POST https://api.torbox.app/v1/api/webdl/createwebdownload
Authorization: Bearer <API_KEY>
Content-Type: application/x-www-form-urlencoded

link=<URL>&password=<optional>&name=<optional>&as_queued=false&add_only_if_cached=false
```

The current live OpenAPI schema requires `link` and defines these optional fields:

| Field | Type | Default or meaning |
| --- | --- | --- |
| `link` | string | Required. TorBox's prose says it must be accessible and must not be a redirect. |
| `password` | string or null | Password for a protected file. |
| `name` | string or null | User-supplied download name. |
| `as_queued` | boolean or null | Defaults to `false`. |
| `add_only_if_cached` | boolean or null | Defaults to `false`; reject rather than add when TorBox has no cached copy. |

Sources: [live OpenAPI](https://api.torbox.app/openapi.json), [TorBox API docs](https://api-docs.torbox.app/#533ea9ba-d6d6-42f2-af4b-1132d69054b3).

There is a first-party encoding discrepancy. The current OpenAPI says `application/x-www-form-urlencoded`, while TorBox's official generated JavaScript SDK sends `multipart/form-data`. For a browser implementation that only sends fields, the live OpenAPI contract is the better default; integration tests should cover this before release. [official SDK service implementation](https://github.com/TorBox-App/torbox-sdk-js/blob/main/src/services/web-downloads-debrid/web-downloads-debrid-service.ts)

The official SDK maps a successful raw response as:

```json
{
  "success": true,
  "error": null,
  "detail": "...",
  "data": {
    "auth_id": "...",
    "hash": "...",
    "webdownload_id": "..."
  }
}
```

Source: [official success response model](https://github.com/TorBox-App/torbox-sdk-js/blob/main/src/services/web-downloads-debrid/models/create-web-download-ok-response-data.ts). The current OpenAPI leaves successful response schemas unspecified, so runtime validation should accept the standard envelope and check `data.webdownload_id` explicitly. The SDK types `webdownload_id` as a string, while later endpoints describe IDs as integers. Treat it as an opaque identifier in storage and serialize it unchanged in query parameters.

The create response is not enough to produce the final file download. It has an item ID and hash, but no file IDs or CDN URL.

### Batch capability

#### Verified by TorBox sources

- TorBox does not document a bulk Web Download create request. Both `POST /webdl/createwebdownload` and `POST /webdl/asynccreatewebdownload` require one scalar string field named `link`; neither schema accepts an array or repeated-link collection. The async route has the same request fields as the synchronous route. Its successful response schema is empty in the live OpenAPI, and the current official generated SDK does not expose it. [live OpenAPI](https://api.torbox.app/openapi.json), [official WebDL SDK documentation](https://github.com/TorBox-App/torbox-sdk-js/blob/main/documentation/services/WebDownloadsDebridService.md)
- `GET /webdl/requestdl` also works on one item at a time. `web_id` and `file_id` are scalar integers. A call requests either one file or, with `zip_link=true`, one ZIP for that Web Download; TorBox says the ZIP option takes precedence when both options are supplied. There are no documented `web_id[]` or `file_id[]` parameters. [live OpenAPI](https://api.torbox.app/openapi.json), [official WebDL SDK documentation](https://github.com/TorBox-App/torbox-sdk-js/blob/main/documentation/services/WebDownloadsDebridService.md)
- `GET /webdl/mylist` accepts zero or one scalar `id`. Omitting `id` returns the user's list, which the official SDK models as an array, and supports `offset` and `limit` with defaults of `0` and `1000`. One unfiltered call can therefore observe several Web Download IDs, but the API does not accept an arbitrary set of IDs in one query. [live OpenAPI](https://api.torbox.app/openapi.json), [official WebDL list model](https://github.com/TorBox-App/torbox-sdk-js/blob/main/documentation/models/GetWebDownloadListOkResponse.md), [official WebDL SDK documentation](https://github.com/TorBox-App/torbox-sdk-js/blob/main/documentation/services/WebDownloadsDebridService.md)
- `GET` or `POST /webdl/checkcached` is the documented multi-input operation relevant to this flow. It checks several link hashes for cached availability; it does not create Web Downloads or return final download links. [live OpenAPI](https://api.torbox.app/openapi.json), [official WebDL SDK documentation](https://github.com/TorBox-App/torbox-sdk-js/blob/main/documentation/services/WebDownloadsDebridService.md)

#### Recommended extension policy

1. Implement a batch as client-side orchestration. Each selected page URL gets its own create request, Web Download ID, state, and error. A failed item must not erase successful items.
2. Start with `createwebdownload`. Do not switch to `asynccreatewebdownload` until an authenticated contract test confirms its success body, returned identifier, and recovery behavior.
3. Poll the unfiltered `mylist` no faster than every five seconds and correlate its array to the batch's tracked IDs. If a tracked ID is missing from the returned page, query that ID directly rather than assuming failure.
4. Do nothing with final files until the user clicks "Generate links". Then call `requestdl?redirect=false` once per ready file and present each returned URL. Do not start browser downloads. A whole-item ZIP, if offered, is a separate generation request and must not replace the individual file links by default.
5. Queue create and link-generation calls with bounded concurrency. Keep each item's result visible, stop starting new requests when the API reports exhaustion, and never retry an ambiguous create timeout automatically.

### Obtain file IDs and wait for readiness

Use the ID from the create response:

```http
GET https://api.torbox.app/v1/api/webdl/mylist?id=<WEBDOWNLOAD_ID>
Authorization: Bearer <API_KEY>
```

TorBox says `id` makes this route return one object rather than a list. The documented item fields include `download_finished`, `download_present`, `download_state`, `error`, `progress`, and `files`. Each file contains at least `id`, `name`, `short_name`, `size`, `mimetype`, `md5`, and `s3_path` in the official SDK schema. [list response documentation](https://github.com/TorBox-App/torbox-sdk-js/blob/main/documentation/models/GetWebDownloadListOkResponse.md), [official list service documentation](https://github.com/TorBox-App/torbox-sdk-js/blob/main/documentation/services/WebDownloadsDebridService.md)

TorBox says live WebDL list information updates every five seconds. Polling faster than five seconds has no documented benefit. The exact readiness rule and the full set of `download_state` values are not documented, so this needs a real-account integration test. At minimum, the extension must wait until the requested file appears in `files` and surface the item's `error` and `download_state` while waiting.

### Request the final link

Correct WebDL route:

```text
https://api.torbox.app/v1/api/webdl/requestdl
  ?token=<API_KEY>
  &web_id=<WEBDOWNLOAD_ID>
  &file_id=<FILE_ID>
  &redirect=true
```

The live OpenAPI parameters are:

| Parameter | Required | Meaning |
| --- | --- | --- |
| `token` | yes | API key in the query string. |
| `web_id` | yes | Web Download ID. |
| `file_id` | no | File ID; OpenAPI default is `0`. |
| `zip_link` | no | Defaults to `false`. TorBox's prose says it is required when no `file_id` is supplied and takes precedence if both are supplied. |
| `user_ip` | no | Used to choose a nearby CDN. |
| `redirect` | no | Defaults to `false`; `true` redirects to the CDN link. |
| `append_name` | no | Defaults to `false`; asks TorBox to add a filename parameter. |

Source: [live OpenAPI](https://api.torbox.app/openapi.json), [TorBox API docs](https://api-docs.torbox.app/#0e681f46-531f-4c97-9a41-358ee5e14d90).

TorBox recommends permalinks instead of saving generated CDN URLs, because CDN URLs are not permanent. Resetting the API token or deleting the item invalidates a permalink. The documentation contradicts itself about validity: the same paragraph says the endpoint opens a link for three hours and then calls it a one-hour limit. Do not hard-code either duration. With `redirect=true`, the request redirects to the CDN link.

TorBox's official Postman example shows `redirect=false` returning the standard JSON envelope with the generated URL in `data`:

```json
{
  "success": true,
  "error": null,
  "detail": "Web download requested successfully.",
  "data": "https://..."
}
```

The live OpenAPI leaves that response schema untyped and the generated JavaScript SDK incorrectly models it as no content, so an authenticated contract test should still capture the production response. [official WebDL request-link example](https://www.postman.com/torbox/torbox-api/request/ynqdb2t/request-download-link), [official JavaScript SDK service](https://github.com/TorBox-App/torbox-sdk-js/blob/main/src/services/web-downloads-debrid/web-downloads-debrid-service.ts)

### Optional cache check

`GET /v1/api/webdl/checkcached` accepts the MD5 hash of a link, with `format=object|list` and optional `list_files`. TorBox documents a practical maximum of about 100 hashes for GET and a one-hour server cache. The POST form accepts a JSON body such as `{"hashes":["..."]}` for larger batches. This endpoint answers whether the Web Download itself is cached. It does not replace the hoster `status` check or report user hoster limits. It requires bearer authentication. [TorBox WebDL service documentation](https://github.com/TorBox-App/torbox-sdk-py/blob/main/documentation/services/WebDownloadsDebridService.md), [live OpenAPI](https://api.torbox.app/openapi.json)

## Authentication and errors

- Protected WebDL endpoints use `Authorization: Bearer <API_KEY>`. The hoster list is the exception, with optional authentication for accurate user usage. The final `/requestdl` route requires `token` in the query string. [TorBox API docs](https://api-docs.torbox.app/), [official SDK README](https://github.com/TorBox-App/torbox-sdk-js)
- TorBox's standard response is `{success, error, detail, data}`. `detail` is intended to be user-friendly. The docs list `400` for bad input, `403` for authentication, `500` for server errors, and `200` for success. [TorBox API docs](https://api-docs.torbox.app/)
- The live service is less uniform than that prose. On the research date, a create request with no authorization returned HTTP `401` and `{"detail":"Not authenticated"}`. The same request with an invalid bearer token returned HTTP `403` and the standard envelope with `error: "BAD_TOKEN"`. The live OpenAPI also documents FastAPI-style HTTP `422` validation responses with a `detail` array. The client must branch on HTTP status first, then parse either the TorBox envelope or FastAPI's `detail` shape. [live OpenAPI](https://api.torbox.app/openapi.json)
- Other relevant documented TorBox error codes include `NO_AUTH`, `BAD_TOKEN`, `AUTH_ERROR`, `INVALID_OPTION`, `MISSING_REQUIRED_OPTION`, `DOWNLOAD_TOO_LARGE`, `MONTHLY_LIMIT`, `COOLDOWN_LIMIT`, `ACTIVE_LIMIT`, `LINK_OFFLINE`, `VENDOR_DISABLED`, `DOWNLOAD_SERVER_ERROR`, and `PLAN_RESTRICTED_FEATURE`. Do not enumerate these as an exhaustive TypeScript union; preserve unknown error strings. [TorBox API docs](https://api-docs.torbox.app/)

## Rate limits and cache guidance

### Verified TorBox behavior

- Unless an endpoint has a stated exception, TorBox documents `300` requests per minute per API token.
- `POST /webdl/createwebdownload` has a separate `60` requests per hour per-token limit.
- On 2026-08-22, harmless invalid-token POSTs to the live `createwebdownload` and `asynccreatewebdownload` endpoints both returned `X-RateLimit-Limit: 60`. They also returned `Retry-After` while `X-RateLimit-Remaining` was still positive: `58` with `Retry-After: 2438` for the synchronous route, and `59` with `Retry-After: 3600` for the async route. This confirms that the live async route currently uses a 60-per-hour window even though TorBox's rate-limit article lists only `createwebdownload`. It also shows that `Retry-After` is not, by itself, a signal that the client has been throttled. TorBox does not document these headers or their units. [live synchronous create endpoint](https://api.torbox.app/v1/api/webdl/createwebdownload), [live async create endpoint](https://api.torbox.app/v1/api/webdl/asynccreatewebdownload), [TorBox rate-limit guide](https://support.torbox.app/en/articles/13726368-api-rate-limits)

Source for documented limits and five-second updates: [TorBox rate-limit guide](https://support.torbox.app/en/articles/13726368-api-rate-limits), [TorBox API docs](https://api-docs.torbox.app/), [official WebDL service documentation](https://github.com/TorBox-App/torbox-sdk-js/blob/main/documentation/services/WebDownloadsDebridService.md).

### Recommended extension policy

- Pause batch work on HTTP `429` or when `X-RateLimit-Remaining` reaches `0`. Honor `Retry-After` in that state, with `X-RateLimit-Reset` as a fallback. Do not pause merely because a response includes `Retry-After`.
- Do not automatically retry create requests after a network timeout unless idempotency has been established. A successful first request followed by a lost response could otherwise add the same Web Download twice.
- While a batch page is open, poll the unfiltered `/webdl/mylist` no faster than every five seconds and use one response to reconcile all extension-owned IDs. After that page closes, use bounded one-shot alarms and a resumable status view rather than an endless background loop. A targeted `?id=...` lookup remains a fallback for an owned ID missing from the shared response.
- Cache the public hoster catalog with a stored `fetchedAt`. A 24-hour TTL is reasonable for page scanning, but refresh on extension startup when stale and consider refreshing before create because `status` means current availability. Authenticated usage counters should refresh when the download UI opens and after a successful create if the UI presents them as current.

## Firefox and Zen extension constraints

- Put all TorBox API calls in the background context or another extension page. Firefox Manifest V3 content-script `fetch` calls are subject to the page's CORS rules, and host permissions do not lift that restriction in content scripts. Background scripts can make cross-origin requests to hosts listed in `host_permissions`. The live TorBox hoster response did not include `Access-Control-Allow-Origin`. Request `https://api.torbox.app/*` and message only URLs, IDs, and results between the content script and background. Never send the API key into the page/content-script boundary. [Mozilla host permissions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/host_permissions), [Mozilla content scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts), [Mozilla background scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Background_scripts)
- Scanning every page automatically requires broad persistent page access, normally content-script matches covering the pages to scan. A user-triggered scan can use `activeTab`, which grants temporary access only after a user action and avoids a permanent `<all_urls>` grant. This is a product/privacy choice, not an API requirement. [Mozilla permissions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/permissions)
- Use `browser.storage.local`, not page `localStorage`, for the token and cached catalog. Mozilla states that extension storage is not encrypted. Keep the token in the background layer and redact it from errors, logs, telemetry, and UI. Query-token `/requestdl` URLs may appear in navigation or download history, so prefer a background request with `redirect=false` if integration testing confirms its response format; otherwise disclose the permalink tradeoff. [Mozilla extension storage](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage)
- Use the `alarms` API for a daily wake-up, but also enforce the TTL whenever the background starts or a scan occurs. Mozilla says alarms do not persist across browser sessions and firing may be delayed, so recreate the alarm on startup and do not use the alarm alone as a freshness guarantee. [Mozilla alarms](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/alarms), [Mozilla alarms.create](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/alarms/create)
- Starting a file through `browser.downloads.download()` would require the `downloads` permission, but this product does not start downloads. It requests each link in the background and presents a normal clickable anchor after the user's Generate action, so the first release does not need that permission. Keep API-token handling and request-link construction out of scanned pages. [Mozilla downloads API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/downloads), [Mozilla downloads.download](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/downloads/download)
- For Firefox signing/distribution, current Manifest V3 packages need a Gecko extension ID. New AMO submissions must also declare applicable data-collection categories. Review `authenticationInfo` and the website-content/activity categories because the extension sends an API key and a user-selected page URL to TorBox. [Mozilla browser-specific settings](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)

## Recommended matching policy

This section is inference, not TorBox contract.

1. Cache all hoster records, not only `status: true`, so the UI can explain a recognized but unavailable hoster and show its `note`.
2. For each absolute HTTP(S) link found in the page, parse it with `URL` and match normalized `hostname` against `domains` using exact or dot-suffix boundaries. This is easier to audit than executing server-supplied regular expressions and naturally handles subdomains. Deduplicate links by normalized URL.
3. Mark a link selectable only when its matched hoster has `status: true`. Show `note`, NSFW status, per-link size limit, and authenticated usage where relevant. Do not reject from stale usage counters; let the create endpoint remain authoritative.
4. Revalidate the chosen URL and current hoster status in the background before create. Content-script data is untrusted input.

## Unknowns to settle with an authenticated integration test

- Exact successful response bodies from `createwebdownload`, `asynccreatewebdownload`, `mylist?id=...`, and `requestdl` with `redirect=false` on the current production API. In particular, confirm whether the async route returns a `webdownload_id` immediately and how a caller recovers after losing its response. Postman's request-link example supplies a JSON shape, but the live OpenAPI and generated SDK do not agree with it.
- Whether production accepts both URL-encoded and multipart create bodies, as the live OpenAPI and official SDK disagree.
- The exact WebDL completion/readiness condition and possible `download_state` values.
- Ordering and pagination behavior for `mylist` without `id`, including whether a newly created batch can always be found within the first requested page. The docs give offsets and limits but no ordering guarantee.
- Whether TorBox guarantees the observed rate-limit headers and what `Retry-After` means on non-`429` responses. The published rate-limit guide documents quotas, not header semantics.
- The actual lifetime of generated CDN links, because TorBox's prose says both three hours and one hour.
- Whether bearer authentication is accepted as an alternative to the query token on `webdl/requestdl`. It is not documented, so the plan must assume the query token is required.
- Redirect chains for submitted hoster URLs. TorBox says the submitted `link` cannot itself be a redirect, but hoster/share URLs commonly redirect. Test representative supported hosters before locking the UX.
