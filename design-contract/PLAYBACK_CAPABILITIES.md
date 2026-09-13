# Playback capabilities and fallback contract

**Status:** proposed adapter plan. This document does not claim a working web, Tizen, Vizio, Desktop, or Android player. The only implementation baseline is Roku at `vynxc/viptv@7d6b413`; its UX contract is [specs/behavior/roku-ux-contract.md](specs/behavior/roku-ux-contract.md). The existing [PLATFORM_PLAN.md](PLATFORM_PLAN.md) is correctly framed as proposed and does not promise an existing web player.

Current browser implementation work is governed by [BROWSER_PLAYBACK.md](BROWSER_PLAYBACK.md); older proposed-platform statements below are historical context, not current delivery status.

## Decision rule

Transcoding is a last resort. A player adapter must first inspect the selected stream and actual device capability, then use the cheapest path that passes a playback probe. A container suffix alone is not evidence that transcoding is required. A capability probe must account for container/demux support, video codec plus profile/level, audio codec, subtitle representation, DRM, headers/cookies, adaptive protocol, seek/range behavior, hardware/resource budget, and the actual engine/browser/TV model.

No probe may override product intent. Ordinary Play/Sources remains explicit source selection; exact-source Resume and controlled next episode retain their narrowly defined automatic paths; a failed path must preserve pause/position/track intent and expose retry/Choose source rather than silently selecting a different provider. See the [Roku UX contract](specs/behavior/roku-ux-contract.md).

## Verified capability facts

### Browser native video and Mediabunny

**Verified:** Mediabunny is a JavaScript media toolkit that wraps demuxing and WebCodecs work; it supports a broad list of containers/codecs and exposes capability utilities. Its WebCodecs codec availability is browser-dependent and not guaranteed by the library. Built-in PCM coding is distinct from browser-provided video/audio decode. Extensions/custom coders can provide some missing codecs, but those are an explicit product dependency and must be budget-tested; they do not make an arbitrary browser decoder universally available. [Mediabunny introduction](https://mediabunny.dev/guide/introduction), [supported formats and codecs](https://mediabunny.dev/guide/supported-formats-and-codecs).

**Implication:** `@mediabunny/*` is a strong candidate for browser capability probing, demuxing, metadata and supported WebCodecs playback. It is not evidence that an old TV browser can decode H.264/HEVC/AV1, render a required subtitle type, accept custom headers, or sustain a software/WASM path. Browser native `<video>` remains the first direct path when it can play the inspected rendition; Mediabunny is the next local path only after runtime probe succeeds.

### Samsung Tizen / AVPlay

**Verified:** Samsung documents HTML5 media for common formats and AVPlay for capabilities beyond HTML5, including adaptive streaming, additional subtitle formats and UHD. AVPlay has explicit NONE/IDLE/READY/PLAYING/PAUSED states, accepts absolute remote URIs, reports structured errors including invalid state, unsupported format, seek failure and connection failure, exposes video/audio/text tracks, and has streaming properties for cookies, user agent and adaptive/live handling. HLS, DASH and Smooth Streaming are documented adaptive engines; supported codec/container/DRM combinations are model/year-specific General Specifications, not a single universal table. [Using AVPlay](https://developer.samsung.com/smarttv/develop/guides/multimedia/media-playback/using-avplay.html), [AVPlay API](https://developer.samsung.com/smarttv/develop/api-references/samsung-product-api-references/avplay-api.html), [adaptive streaming](https://developer.samsung.com/smarttv/develop/guides/multimedia/adaptive-streaming.html?device=htv), [Samsung multimedia FAQ](https://developer.samsung.com/smarttv/develop/faq/multimedia.html).

**Implication:** Tizen should ship an AVPlay adapter after per-model capability qualification. It can map VIPTV pause, seek, tracks, buffering, error and recovery states directly, but it must honor AVPlay state restrictions and model-specific format support. Do not assume an HTML5/Mediabunny behavior transfers to AVPlay. AVPlay prebuffer capability can support a controlled next transition only after a device test proves two-player resource use is safe.

### Tauri desktop / `tauri-video-plugin`

**Verified:** `get-air/tauri-video-plugin` is a Tauri 2 native playback backend for the shared `@get-air/video` controller; DOM remains responsible for layout, controls and overlays. Its README documents Linux (GStreamer default, optional mpv), Windows (GStreamer), and Android/Android TV (Media3/MediaCodec, API 24+); it currently lists macOS and iOS as unsupported. It reports playback, seeking, volume, tracks, custom headers and telemetry across engines. Crop/zoom is not universal; playback-rate and frame-accurate seeking are documented unsupported. Package/crate versions must be compatible. [tauri-video-plugin README](https://github.com/get-air/tauri-video-plugin), [Linux engine behavior](https://github.com/get-air/tauri-video-plugin/blob/main/docs/linux.md).

**Implication:** Desktop is React plus the Tauri plugin adapter, not a separate UI/player design. Use Tauri native engine first; use Mediabunny only for an explicitly qualified in-WebView path or capability inspection. The web UI must account for reported unsupported operations instead of claiming pixel/frame-accurate parity. Desktop support statement remains provisional until a chosen target/engine build and test matrix passes.

### Vizio / SmartCast

**Verified limit:** in this bounded review, no public first-party Vizio/SmartCast playback API/specification was located that establishes codec, adaptive protocol, WebCodecs, subtitle, custom-header, or multi-track guarantees for the target TV browser. That absence is not evidence of lack of support; it means no capability may be claimed from this design document.

**Implication:** Treat Vizio as a web-runtime adapter with an unknown capability profile. Begin with a direct server-compatible `<video>` rendition and measure it on the exact TV/firmware. Use the server’s inspected copy/remux path when that removes only a container/audio incompatibility. Escalate to audio conversion, then full server video transcode only after recorded device evidence shows direct/local delivery cannot meet playback. Do not plan a Mediabunny/WASM decode path for Vizio until WebCodecs, memory, rendering, and sustained playback are proven on target hardware.

### Optional `movi-player` reference

**Verified:** `movi-player` describes itself as a WebCodecs plus FFmpeg-WASM web player, with adaptive streaming integrations, track/subtitle controls and a React wrapper. Its own documentation shows sizeable WASM transfer figures and states that plain-web examples use cross-origin isolation so its WASM demuxer can use `SharedArrayBuffer`. [movi-player README](https://github.com/mrujjwalg/movi-player), [examples README](https://github.com/MrUjjwalG/movi-player/blob/main/examples/README.md), [React wrapper](https://github.com/MrUjjwalG/movi-player/blob/main/packages/README.md).

**Decision:** research reference only. Do not make it the web/TV baseline now: it adds a full UI and WASM engine that would need a separate low-memory TV qualification and could conflict with the design-owned player controls. Re-evaluate only if a desktop/browser proof shows it fills a concrete capability gap that `@get-air/video` plus native/Mediabunny paths cannot.

## Proposed adapter ladder

This is the required ordering for a selected source; it is not a promise that every rung is implemented.

| Order | Adapter action | Gate | Result when gate fails |
| --- | --- | --- | --- |
| 1 | Direct native playback | platform player can play inspected container/codecs/protocol/tracks with required authorization | retain original source; evaluate local demux/remux path |
| 2 | Local browser demux/decode | Mediabunny/WebCodecs (or a qualified extension) reports support and device resource test passes | retain original source; evaluate server copy/remux |
| 3 | Server copy/remux | incompatible container/packetization only; video/audio codecs remain qualified | retain title/source identity and use generated direct-compatible URL |
| 4 | Audio-only conversion | qualified video but incompatible audio/subtitle delivery | preserve video; explicitly report track availability changes |
| 5 | Full managed transcode | inspected capability failure has a recorded reason and no less-expensive path passes | start server conversion under existing resource/provider limits |

Never retry a different provider automatically after rungs 1–5 fail. Report the underlying class to the existing recovery UI: unsupported format/track, authorization/header failure, connection failure, seek failure, preparation timeout, or playback error. A direct/managed switch preserves absolute position, pause intent and title-local audio/subtitle choice. If replacement fails, restore the old playable session; if restoration fails, show Retry and Choose source with the saved position.

## Proposed capability test contract

Each platform adapter must emit a bounded capability record before starting a source:

```text
platform, device/model, OS/firmware, player engine/version,
container, video codec/profile/level, audio codec, subtitle kind,
protocol, DRM, authorization mode, range/seek support,
direct result, local result, remux result, transcode reason,
startup time, first-frame result, track results, recovery result
```

Test these source fixtures on the actual target device, not only desktop Chrome:

1. Direct MP4/H.264/AAC with byte-range seek, pause/resume and normal subtitles.
2. Adaptive HLS with live/current-programme handling and VOD seek.
3. Container-only mismatch whose codecs are otherwise supported, to prove copy/remux before conversion.
4. Video-supported/audio-unsupported source, to prove audio-only conversion and truthful track labels.
5. Multi-audio and selectable text-subtitle source, including one unavailable track.
6. A known unsupported codec/profile/container to prove no false positive and a single bounded managed fallback.
7. Header/cookie/signed-URL source, including expiry and recovery without exposing secrets.
8. Final-ten-second next transition, explicit Resume, user Back cancel, managed seek rollback, source failure, and return-focus scenarios from the Roku behavior contract.

Pass criteria are product and playback criteria together: selected source identity is retained; controls remain responsive; direct success avoids conversion; fallback reason is recorded; pause/position/tracks survive a replacement; no platform silently loses a Roku-baseline action. Record pass/fail/not-run with fixture, device, OS/firmware, engine version, and measurable limits. A simulator/emulator is insufficient evidence for TV/browser codec support.

## Implementation boundary

**Implemented baseline:** Roku’s existing direct/remux/managed behavior and UX only.

**Approved architecture direction, not implemented:** Android/Android TV Compose adapter; Tauri + React desktop adapter; React web adapter; Tizen AVPlay adapter; Vizio web adapter; SolidTV/LightningJS as a web-TV UI evaluation. All new adapter code requires a design-linked implementation issue and the capability test matrix above before it may claim support.
