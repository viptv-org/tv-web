# Adopt one shared platform matrix and consolidate playback backends

Status: accepted 2026-09-17. This record supersedes the platform rows of [PLATFORM_PLAN.md](../../PLATFORM_PLAN.md) with an audited matrix and records two code-level findings that gate the shared-platform desktop work: the Vizio cast receiver does not exist yet, and the working playback stack lives in tv-web rather than in the `video` package that claims it. Audited source revisions: tv-web@34ab5bc, video@6735a0b, backend@e8216e3, core@e23883c, web@f9cf591, android@cea61b4, tauri-video-plugin@9c193e1. Roku remains the frozen baseline; nothing here claims new physical-device qualification. Runtime and device qualification still follow [TV_IMPLEMENTATION.md](../../TV_IMPLEMENTATION.md) and [BROWSER_PLAYBACK.md](../../BROWSER_PLAYBACK.md).

## Decision

One shared UI — the tv-web React bundle — serves web browsers, Samsung Tizen, Vizio SmartCast and the Tauri desktop host. Android keeps its own Compose UI, which is already true today: the android application consumes core's SmartCast facade and does not use tv-web. In a later stage the tv-web playback stack moves into the `video` package as the canonical headless controller, and `video`'s parallel guest-js backends are replaced rather than merged.

### Platform matrix

Terms follow [CONTEXT.md](../../CONTEXT.md): Direct play, Remux, Transcode.

| Platform | UI | Playback engine | Transcode policy | Entry and capability declaration |
|---|---|---|---|---|
| Web browser | tv-web responsive layout; `?layout=tv` keeps the TV frame | MediaBunny (WebCodecs) preferred behind `html5-fallback.ts` — secure-context plus `VideoDecoder`/`AudioDecoder` gate with a bounded open timeout — then HTML `<video>` with native HLS and hls.js/MSE | Probe-first direct play; server copy/remux, then managed transcode only when the measured capability report refuses the source | Default entry, platform `html5`; measured report from `probeBrowserPlaybackCapabilities` (`canPlayType`, `MediaCapabilities.decodingInfo`, MSE, WebCodecs probe) with separate `direct_mp4` and `direct_hls` fields |
| Samsung Tizen | tv-web TV layout | AVPlay native (`tv-web/src/player/tizen-avplay.ts`) | Native decode preferred; conversion stays the last resort of the ladder in [PLAYBACK_CAPABILITIES.md](../../PLAYBACK_CAPABILITIES.md) | `?platform=tizen`; `TIZEN_AVPLAY_CAPABILITIES`, cookies/User-Agent only when the injected runtime exposes `setStreamingProperty` |
| Vizio SmartCast | tv-web TV layout loaded on the TV through the cast receiver (same bundle, `?platform=vizio`) | HTMLMediaElement with native HLS, then hls.js/MSE (`tv-web/src/player/vizio-html5.ts`); **no WebCodecs path** | Managed server delivery allowed: copy/remux when viable, audio or full conversion only as necessary | `?platform=vizio` on a deployed HTTPS receiver; `VIZIO_HTML5_CAPABILITIES` (no request headers, no audio-track selection) |
| Desktop (Tauri) | tv-web shared UI in a Tauri v2 shell (later stage) | `tauri-video-plugin` native engine (GStreamer; mpv optional) | No transcode: native playback only | Tauri host detected via `__TAURI_INTERNALS__`; a direct-play-only capability profile declared the way `VIZIO_HTML5_CAPABILITIES` is; API and media through the Tauri HTTP plugin |
| Android / Android TV | Own Compose UI (android repository) | In-repo Media3 backend (org.viptv.video, previously described as mediamp) | No transcode | Native profile in the android application; unchanged |
| Roku | Existing BrightScript/SceneGraph app | Existing native Video | Existing verified direct/remux/managed ladder | Unchanged frozen baseline |

## Finding: the browser gate is WebCodecs, not WebAssembly

Verified by search at tv-web@34ab5bc and video@6735a0b: neither playback stack (tv-web `src/player/`, video `guest-js/`) contains WebAssembly. MediaBunny 1.56.2 and its `@mediabunny/ac3`, `@mediabunny/dts` and `@mediabunny/prores` extensions are TypeScript over WebCodecs. The only WebAssembly in the tv-web bundle is the vendored core state module (`src/core/index.ts` imports `vendor/core/wasm/viptv_core`, the Rust normalization artifact), which is not part of playback.

Consequence: "can SmartCast run WebAssembly" is the wrong question; no platform path depends on it. The browser gate is WebCodecs availability, and SmartCast's old Chromium lacks it — which is exactly why the Vizio path is the HTML adapter with managed delivery rather than MediaBunny. [PLAYBACK_CAPABILITIES.md](../../PLAYBACK_CAPABILITIES.md) already forbids claiming a MediaBunny path for Vizio until target hardware proves it; this audit confirms the code already encodes that split.

## Finding: no Vizio cast receiver exists yet

Verdict: **no receiver exists.** The receiver is not a separate codebase to find — it is the same tv-web production bundle (vite `base: "/tv/"`) deployed at a public HTTPS origin and selected with `?platform=vizio`. Evidence at tv-web@34ab5bc:

- `src/ui/App.tsx` line 3170: `receiverUrl={import.meta.env.VITE_VIZIO_RECEIVER_URL}`.
- `src/ui/CastController.tsx` documents the contract — "Public receiver deployed by the host; never the local Tauri window origin" — and launches it with `run("launchConjure", { url: receiverUrl })`.
- The variable is unset and undocumented: tv-web contains no `.env`, `.env.example` or `.env.local`; `vite.config.ts` is a single SPA entry with no receiver build; `public/` holds only artwork assets. No `receiver` implementation exists anywhere else in the organization workspace (searched web, backend/server/src, core, roku and the workspace ops notes).
- Live check on 2026-09-17: `GET https://viptv.syek.tech/tv/?platform=vizio` returned 404 `text/html` serving the dashboard shell (root asset `assets/index-FS32ZJ5j.js`), and `GET /` returned 200 with the same asset. The server answers unknown paths with the dashboard SPA; no tv-web bundle is deployed at `/tv/`. This matches the 404 already recorded in tv-web `RESPONSIVE_VALIDATION.md` and [RESPONSIVE_PRODUCTION.md](../../RESPONSIVE_PRODUCTION.md).

The backend already supports the mount: `router_with_tv` "Mount the account dashboard at `/` and the TV React bundle at `/tv` without changing API/media origins or enabling cross-origin credentials". Making casting real is therefore a deployment and build task, not new receiver code: deploy the tv-web bundle at the public `/tv/` base path, build it with `VITE_VIZIO_RECEIVER_URL` pointing at that URL, and verify the served asset hash afterwards — deploys have reported success while failing, so the served hash, not a deployment log, is the acceptance evidence.

## Decision: tv-web's player stack is canonical; video's guest-js backends are replaced

The `video` package (`@get-air/video` 0.3.0) describes itself as the shared headless controller, but nothing consumes it: tv-web's `package.json` has no dependency on it. tv-web instead carries the working stack — `src/player/types.ts`, `session.ts`, `browser-capabilities.ts`, `mediabunny.ts`, `html5-fallback.ts`, `vizio-html5.ts`, `tizen-avplay.ts`, `index.ts` — exercised by its full suite (145 tests across 20 files, passing at 34ab5bc on 2026-09-17). video's parallel `guest-js/backends/` (`html.ts`, `tizen.ts`, `shared.ts`, `lifecycle.ts`) carries 32 test blocks across six files (counted from source; not executed in this audit), has no HLS engine, no MediaBunny backend and no server-session coordination.

In the later consolidation stage the tv-web stack moves into the `video` package keeping the interface the 145 tests exercise; video's guest-js backends are deleted. The move must reconcile these concrete API differences:

1. **Control surface.** tv-web `Player` (`types.ts`): synchronous `snapshot` plus `subscribe(listener)` push, a ten-state machine, and session-ID invalidation (`SessionPlayer.isCurrent` makes stale engine callbacks inert). video: DOM `CustomEvent` stream on the attached element plus `MediaInfo` polling.
2. **Delivery ownership.** tv-web `open(OpenPlayerRequest)` accepts an already-selected delivery URL — `deliveryMode: 'direct' | 'managed'`, `timelineOffsetSeconds`, `timelineDurationSeconds`, `adoptEngineDuration`, `authorization` (cookie/User-Agent) — and `PlaybackSessionController` escalates delivery refusals (406) and network failures through the server's delivery ladder for the same source while preserving position and pause intent. video `attachVideo(element, options)` owns routing itself: `backend`/`fallbackBackends` chains, `VideoRoutingAttempt` phases, and a `VideoSource` with `headers`, `cookies`, `userAgent`, `referrer`, `tlsCaFile` over `@get-air/http`.
3. **HLS.** tv-web `vizio-html5.ts`: hls.js 1.7.3 with native-HLS-first, an error-code-specific one-shot MSE retry, a 20-second open watchdog and a session-scoped HLS resource-prefix check. video `backends/html.ts`: bare `element.src` with no HLS engine.
4. **Tizen binding.** tv-web injects a narrow `AvplayManager` (testable without a TV; cookies/User-Agent capability-gated on optional `setStreamingProperty`; optional `setDisplayRect`). video binds the global `window.webapis.avplay` through an object-element player surface with a global ownership symbol, DRM and subtitle events, and `getStreamingProperty` live detection.
5. **Errors.** tv-web: typed `PlayerErrorCode` union with `PlayerOperationError`. video: Effect `Schema.TaggedError` values marked with a `Symbol.for` marker and error-map augmentation.
6. **Tracks and subtitles.** tv-web: `PlayerTrack` (audio/text) with `selectAudioTrack` and `selectTextTrack(id | null)`. video: `MediaTrack` (video/audio/subtitle with `streamIndex`, codec and forced flags) plus an external VTT/SRT subtitle pipeline (`@plussub/srt-vtt-parser`). The merged interface either keeps video's external-subtitle capability or records its conscious removal.
7. **Surface control and telemetry.** video offers `setVideoFit`, `setVideoZoom`, `setPlaybackRate`, `SessionStats` and `PlaybackQuality`; tv-web offers volume/mute and `PlayerDiagnostics` (engine, transport, codecs, resolution). The merged API keeps the union the shared UI actually uses.
8. **Transport.** tv-web's session-scoped `sessionMediaFetch` (session resource-prefix check; Tauri HTTP plugin under `__TAURI_INTERNALS__`) replaces video's generic `HttpTransport`.

## Constraint: the backend pins one browser origin

The account API keeps its same-origin cookie/CSRF contract ([ADR 0002](0002-preserve-rust-and-same-origin-web.md)). The backend's origin policy exists to stop cross-site account requests, and cross-origin reads are permitted only for session media through `VIPTV_MEDIA_CORS_ORIGINS` (read-only, no credentials). A Tauri window's origin is not the pinned browser origin, so the desktop host must call the API and fetch media through the Tauri HTTP plugin rather than browser fetch. tv-web already encodes this: `src/main.tsx` wires `@tauri-apps/plugin-http` with `maxRedirections: 0`, and `mediabunny.ts` `sessionMediaFetch` routes through the plugin with `redirect: 'error'` under `__TAURI_INTERNALS__`. Any desktop adapter keeps that transport; browser fetch stays browser-only.
