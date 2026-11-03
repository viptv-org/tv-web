# Legacy React transport contract

The current SolidTV entry uses `src/tv-solid/remote/api.ts` and the unversioned
server contract in `backend/TV_REMOTE_API.md`. The historical v2/WASM transport
below remains for the separate React entry; it is not loaded by the TV wrapper.


The explicit `startPlaybackV2`, `playbackStatusV2`, `renewPlaybackV2` and
`stopPlaybackV2` methods now execute the generated canonical v2 contract.
Startup waits at most 45 seconds, checks expiry and response identity, and polls
without renewing implicitly. Cancellation/failure releases the admitted id;
ambiguous admission is reconciled with the same immutable request id/body before
release, under an independent five-second cleanup deadline. If control remains
unreachable, backend/gateway expiry is the final cleanup bound. Renewal failures
are authoritative and callers must stop using cached media when authorization or
expiry is lost. Control requests never follow the returned media URL.

Ordinary movie/exact-episode `startPlayback` calls now use v2 with a fresh request
ID and shared-core capability/track/conversion mapping. Live channel starts remain
on the explicitly tracked legacy path until raw catalog migration. Active v2
sessions renew at the returned interval, stop on refusal/expiry, and pause for
foreground validation before resuming. Disposal cancels renewal; late heartbeats
cannot restore a released cache entry. Player operation cancellation reaches the
backend admission signal. This does not complete the all-client/live cutover.

### Route versions: what this transport actually requests

The backend retired every versioned API prefix (`backend` `ea82f19`), so no
`/api/v2/...` or `/api/v3/...` route exists. Request paths now come from two
places, and only one of them is fixed here.

Request literals in this transport are unversioned: `GET/POST /api/addons`,
`PATCH/DELETE /api/addons/:id`, `GET /api/playback/:id/progress`,
`GET /api/profiles/:id/continue`, `GET /api/profiles/:id/progress/page`,
`GET /api/profiles/:id/favorites`, `PUT /api/profiles/:id/preferences`.

Everything the shared Rust core builds through `normalize("request", ...)` —
stream discovery (`/api/v2/streams`), live catalog and guide
(`/api/v2/iptv/...`), playback protocol/start/heartbeat/stop
(`/api/v2/playback*`, `/api/v2/playback-decoder-start`) — is still versioned,
because those strings live inside the pinned `vendor/core` WASM. Until that pin
moves, source discovery, live browsing and playback control issued through this
transport still answer `API route not found`. Do not describe them as migrated,
and do not promote a `/api/v2/...` path to "current" here again.

`POST /streams` and `GET /streams/:id?after=N` are the routes the server serves
today for those core operations; only the pin controls whether they are asked
for.

### Continue Watching

`GET /api/profiles/:id/continue?offset=<cursor>&limit=40` returns a cursor
envelope — `{scope, revision, entries, next_cursor, complete}` — not an offset
page. Each entry is a server-rendered `card` plus the playback `record` it stands
on, and the client flattens them into the existing shelf row: the card supplies
identity, title and artwork, the record supplies position, duration and
`updated_at`, and `status` maps to the shelf's `queueStatus` (`next`,
`caught_up`, `pending`, `upcoming`, `unavailable`, `resume`). A `next` row keeps
`previous_identity` as `previousEpisode`, because resume finishes the episode the
viewer just watched rather than the announced one. `next_cursor` is opaque and is
passed back verbatim.

There is no `continue/settings` route, and `/api/profiles/:id/preferences`
rejects `autoplay` with 422: the profile preference now carries
`next_episode_button` (offer Next, never auto-play) instead. The transport has no
autoplay setting of its own.

`TvApi` is the only HTTP boundary for Tizen and Vizio. It talks to a VIPTV HTTPS origin and uses the existing device grant flow: `POST /api/auth/device/code`, poll `POST /api/auth/device/token`, then rotate through `POST /api/auth/device/refresh`. Device tokens travel only as a Bearer header. The default `MemoryDeviceSessionStore` deliberately does not persist them; each platform must opt into its platform credential store.

The API normalizes server/add-on payloads into `MediaItem`, `MediaSource`, catalog, guide, library and playback types. Add-on transport credentials are removed from catalog/source-card metadata. Authorized v2 direct playback deliberately carries the original HTTP(S) source URL and required headers; gateway delivery carries an absolute HTTPS capability under the registered gateway origin/base path. Treat either as sensitive transient playback state: never persist or log it, and never send backend credentials to the media origin. Live categories remain legacy typed filter records (`id`, `name`, `count`) until raw catalog migration. Continuation preserves the server’s separate `episodeTitle` while `name` remains the series title.

Content routes are `GET /catalogs`, `GET /discover`, `GET /meta/:type/:id`, `POST /streams`, `GET /streams/:id`, `POST /playback`, `POST /playback/:id/heartbeat`, and `DELETE /playback/:id`. Detail is `/meta`, not an invented `/detail` route. Seek and track changes start a replacement playback session with `position` and track selection; the server has no standalone seek route. Profile-scoped routes cover favorites, progress (`action: watched|unwatched|position` for corrections), queue, preferences and the next episode. Live uses `/live`, `/live/categories`, and `/guide/:id`. Parent status returns `pin_configured`; updating an existing PIN requires both `pin` and `current_pin`.

`ApiScope` is an AbortSignal owner. The controller creates a scope for each screen/load generation and aborts it on focus changes, so stale shelves or source polls cannot update the current screen. `TvApi` refreshes only once for an authenticated 401 and coalesces concurrent refreshes. Errors intentionally expose a short user message and status/code, never a backend or upstream body.

`signOut()` clears the device grant only after `POST /api/auth/logout` succeeds. A parent-PIN rejection, cancelled request, or network failure preserves the durable grant so the UI can prompt, unlock, and retry the original action without making the TV pair again.

## Browser decoding and delivery

The canonical contract is pinned in `design-contract/BROWSER_PLAYBACK.md`.
HTML/Vizio probes H.264 High 4.1, HEVC Main 5.0 SDR and AAC-LC using MIME support and bounded MediaCapabilities checks before creating a playback session. It distinguishes native MP4 from native HLS or hls.js/MSE; WebCodecs availability alone is not proof that this player can decode a format. Missing or timed-out MediaCapabilities falls back to MIME evidence; an explicit unsupported result does not. The current conservative envelope is 1080p. Actual TV/firmware decoding still needs device verification.

The request serializes `directMp4`/`directHls` as optional `direct_mp4`/`direct_hls`. False disables that original delivery transport. Omission preserves existing native-client behavior. HTML clients require supported H.264/AAC HLS before requesting managed output; Back cancels pending preparation. AVPlay retains its native capability policy and does not use HTML decoder probes.

Serve the TV app and backend media on the same HTTPS origin. Provider requests remain server-side: `/media/` proxies media, playlists, segments, keys and init maps, retaining range seeking. This removes the browser's need for provider CORS permission without disabling browser security or creating an arbitrary URL proxy. HLS/MSE resources are additionally restricted to the active media-session path. Direct play and stream copy remain preferable to transcoding.

## Shared card presentation

`CardPresentation` is generated from Rust and supplies shelf artwork/role, title, subtitle, optional0–1 progress, and primary action/label. Renderers do not choose from poster/background/thumbnail fields. Queue transport performs at most three concurrent metadata requests and passes the responses to Rust `enrichHome`; only the matching episode contributes episode artwork. Source/progress identity stays from the original occurrence. Full episode catalogs remain on detail responses rather than being copied into every shelf occurrence. `raw` excludes already-typed episode arrays and synopsis fields to keep bridge requests bounded.

Device refresh belongs to the session rather than the screen that first encounters an expired bearer. A screen cancellation stops its own retry but allows shared rotation to finish and durably save replacement credentials. Concurrent requests with late 401 responses reuse an already-replaced bearer. Only a definitive refresh 401 clears the adapter's stored grant; network failures and forbidden responses preserve it for recovery.

Hosts sharing a durable grant may supply `DeviceSessionStore.withLock`. The browser uses an origin-scoped Web Lock to serialize startup/session transactions and adopt a replacement grant saved by another tab before refreshing. The two-tab regression covers simultaneous expired startup and later request expiry. Environments without Web Locks retain per-instance coalescing but do not gain cross-tab coordination.
