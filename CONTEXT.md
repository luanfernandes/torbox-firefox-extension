# TorBox web downloads

This context covers finding web links that TorBox can process and turning a user's selection into generated file links.

## Language

**Hoster catalog**:
The TorBox-provided list of web services, their matching data, availability, notes, and usage limits.
_Avoid_: Provider list, supported-sites cache

**Hoster**:
A hoster-catalog entry whose type is `hoster`. It describes a service that holds or serves downloadable content.
_Avoid_: Provider, vendor

**Candidate link**:
An HTTP or HTTPS link found in a page that matches one hoster-catalog entry. A candidate is not guaranteed to succeed at TorBox.
_Avoid_: Generated link, valid link

**Available candidate**:
A candidate link whose catalog entry currently has `status: true`. TorBox remains authoritative when the user submits it.
_Avoid_: Working link, guaranteed link

**Unverified candidate**:
A candidate link found with the last valid catalog after a refresh failure. It remains visible, but its availability is unknown until live preflight succeeds.
_Avoid_: Stale available link, working link

**Batch**:
A collection of candidate links the user selects and submits together.
_Avoid_: Bulk download, queue

**Batch item**:
One selected candidate and its resulting Web download inside a batch.
_Avoid_: Batch link, queue item

**Web download**:
The TorBox item created from one candidate link. It may still be processing and may contain one or many files.
_Avoid_: Torrent, browser download

**Web file**:
One file reported inside a completed Web download.
_Avoid_: Torrent file, source file

**Generated link**:
The short-lived CDN URL TorBox returns for one Web file after the user asks for it. The extension presents it but does not open it.
_Avoid_: Permalink, source URL

**Browser download**:
The transfer Firefox or Zen starts after the user follows a generated link.
_Avoid_: Web download, automatic download
