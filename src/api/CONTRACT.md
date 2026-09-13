# TV API contract

`TvApi` is the only HTTP boundary for Tizen and Vizio. It talks to a VIPTV HTTPS origin and uses the existing device grant flow: `POST /api/auth/device/code`, poll `POST /api/auth/device/token`, then rotate through `POST /api/auth/device/refresh`. Device tokens travel only as a Bearer header. The default `MemoryDeviceSessionStore` deliberately does not persist them; each platform must opt into its platform credential store.

The API normalizes server/add-on payloads into `MediaItem`, `MediaSource`, catalog, guide, library and playback types. Add-on `url`, header, authorization and token values are removed before they reach UI state. A playback `url` is a short-lived VIPTV server media capability, not an upstream source URL; the server emits it root-relative and `TvApi` validates and normalizes it to the configured same-origin HTTPS URL for AVPlay. Use it immediately in the player and never store it. Live categories are typed filter records (`id`, `name`, `count`), never playable media. Continuation preserves the server’s separate `episodeTitle` while `name` remains the series title.

Content routes are `GET /catalogs`, `GET /discover`, `GET /meta/:type/:id`, `POST /streams`, `GET /streams/:id`, `POST /playback`, `POST /playback/:id/heartbeat`, and `DELETE /playback/:id`. Detail is `/meta`, not an invented `/detail` route. Seek and track changes start a replacement playback session with `position` and track selection; the server has no standalone seek route. Profile-scoped routes cover favorites, progress (`action: watched|unwatched|position` for corrections), queue, preferences and the next episode. Live uses `/live`, `/live/categories`, and `/guide/:id`. Parent status returns `pin_configured`; updating an existing PIN requires both `pin` and `current_pin`.

`ApiScope` is an AbortSignal owner. The controller creates a scope for each screen/load generation and aborts it on focus changes, so stale shelves or source polls cannot update the current screen. `TvApi` refreshes only once for an authenticated 401 and coalesces concurrent refreshes. Errors intentionally expose a short user message and status/code, never a backend or upstream body.

`signOut()` clears the device grant only after `POST /api/auth/logout` succeeds. A parent-PIN rejection, cancelled request, or network failure preserves the durable grant so the UI can prompt, unlock, and retry the original action without making the TV pair again.

## Browser decoding and delivery

The canonical contract is pinned in `design-contract/BROWSER_PLAYBACK.md`.
HTML/Vizio probes H.264 High 4.1, HEVC Main 5.0 SDR and AAC-LC using MIME support and bounded MediaCapabilities checks before creating a playback session. It distinguishes native MP4 from native HLS or hls.js/MSE; WebCodecs availability alone is not proof that this player can decode a format. Missing or timed-out MediaCapabilities falls back to MIME evidence; an explicit unsupported result does not. The current conservative envelope is 1080p. Actual TV/firmware decoding still needs device verification.

The request serializes `directMp4`/`directHls` as optional `direct_mp4`/`direct_hls`. False disables that original delivery transport. Omission preserves existing native-client behavior. HTML clients require supported H.264/AAC HLS before requesting managed output; Back cancels pending preparation. AVPlay retains its native capability policy and does not use HTML decoder probes.

Serve the TV app and backend media on the same HTTPS origin. Provider requests remain server-side: `/media/` proxies media, playlists, segments, keys and init maps, retaining range seeking. This removes the browser's need for provider CORS permission without disabling browser security or creating an arbitrary URL proxy. HLS/MSE resources are additionally restricted to the active media-session path. Direct play and stream copy remain preferable to transcoding.
