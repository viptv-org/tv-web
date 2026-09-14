# Browser playback capability and delivery contract

Status: authorized implementation, 2026-09-13; runtime/device qualification must be recorded separately. Applies to shared HTML/Vizio playback. Tizen AVPlay is a separate native engine and keeps its existing capability envelope; browser probes must not decide what AVPlay can decode. The existing Roku contract is unchanged.

## Capability checks

Before creating a browser playback session or ranking controlled Next sources, resolve a bounded runtime capability report. Check native MIME/container plus codec strings with `canPlayType`; query `MediaCapabilities.decodingInfo` when available for the actual supported reference profile, dimensions and audio configuration. Missing, rejected or timed-out APIs remain unknown or conservative fallback evidence, not universal codec support. `supported`, `smooth` and `powerEfficient` are distinct findings. A WebCodecs decoder or MSE MIME response alone does not prove that native `<video src>` can demux/play that format. [W3C Media Capabilities](https://www.w3.org/TR/media-capabilities/) defines these distinctions.

The current server codec policy accepts H.264 Baseline/Main/High through level 4.1 and 8-bit SDR HEVC Main through level 5.0 after stream inspection. Advertise a bounded reference envelope only; HDR, other profiles and unsupported audio remain outside this qualification. Prefer native HLS where available; otherwise use the explicit HLS/MSE playback engine with its own MIME checks. If no usable baseline H.264/AAC HLS output path exists, show an actionable playback error before requesting server conversion. Do not transcode into an output this browser cannot consume.

MP4 and HLS transport support are separate request fields (`direct_mp4`, `direct_hls`). Omission preserves legacy native clients. HTML clients send measured values for both. Until separate per-transport codec fields exist, HEVC is conservative across native MP4 and the active HLS engine. Every start and controlled Next uses the same report; managed seeks/track replacement retain its capability envelope. Back while probing invalidates the request before any playback lease is created.

## Same-origin media delivery

Browser media requests use the configured VIPTV HTTPS origin and opaque `/media/` session capabilities. The backend performs upstream requests and rewrites supported HLS playlists, segments, init maps and encryption-key references into those capabilities. Browser code does not fetch provider URLs, attach upstream credentials, or depend on provider CORS headers. MP4 byte ranges, HEAD, expired leases, redirects and playlist-relative resource resolution must be verified. Provider credentials remain on the server and are stripped when following a cross-origin redirect according to the existing policy.

Retain session authorization, public-network destination validation, provider connection budgets and lease cleanup. This is the existing selected-source proxy, not a caller-supplied arbitrary URL relay. Keep the browser's CORS protections and account/API origin checks enabled. Native AVPlay can have different network capabilities; retaining the same backend proxy still protects source credentials and ownership. [Samsung AVPlay](https://developer.samsung.com/smarttv/develop/guides/multimedia/media-playback/using-avplay.html) remains the native player reference.

## Recovery and acceptance

Direct native/MSE-supported delivery precedes copy/remux, audio conversion and full transcoding. Failed decoding must retain the selected source, position and pause intent, and use the existing Retry/Choose source flow. A capability report is a preflight hint; only actual decode establishes playback success. This change does not claim Mediabunny/WebCodecs playback is implemented.

Required evidence: supported/unsupported/absent/timed-out capability APIs; native-HLS versus MSE-HLS choice; no codec inference across engines; early refusal with zero backend sessions; cancellation during probing; transport-specific backend gates with legacy Roku defaults preserved; same-origin nested HLS/key/range requests; real browser HLS decode/seek/stop. Physical Vizio/Tizen model, OS, codec/profile, DRM and sustained playback results remain explicitly unverified until tested on those devices. Record current CI, fixture and deployment status in the owning repositories; passing code is not evidence that a running server was upgraded.

## Timeline duration and preparation recovery — RUI-029

The seek bar reports the title's real length, never the length of the delivery that is currently being produced. Managed server output is a rolling HLS window: its playlist grows and slides while segments are still being produced, so an engine duration taken from it describes only the produced part and makes the seek bar look like a progress indicator for the transcode.

- **Server total is authoritative.** The playback response's `duration` (the full inspected source length) is the timeline's length for every managed delivery, and it is reported immediately rather than after the window settles.
- **Only an original file may refine it, and only upward.** A direct file/playlist delivery may publish its engine duration when that value is larger than the server total; the reported length must never shrink afterwards. This mirrors the Roku player (`MainScene.brs`: `if m.playbackMode = "direct" and m.video.duration > 0` then grow `m.duration`), and Roku's comment stands as the rule: duration `0`/unknown means unknown, never the rolling window length.
- **Live stays duration-less.** A live channel keeps an unknown length; no marker or total is invented from a produced window.
- **A seek target is bounded by the timeline**, while engine addressing (native current time inside the produced window) remains the delivery's own limit. Managed seeks continue to prepare a replacement session at the absolute position.

Preparation recovery is bounded and stays on the selected source: a refused preparation is retried through the shared delivery ladder (original delivery, then managed output, then forced transcoding) before the user sees an error. Authorization, expiry, cancellation, capacity and out-of-range-position refusals keep their own meaning and are never retried as delivery problems. The client never chooses a different provider or source.

Source inspection must not fail permanently on a noisy response: when ffprobe's metadata is unreadable or larger than the inspection budget, the server asks again once with the smallest entry set that still contains the fields the delivery decision needs (stream indexes, codecs, dimensions, pixel format, channels, frame rate and transfer characteristics) before refusing the source.

Acceptance: a managed session whose engine reports a 32s window keeps reporting the full title length as that window grows; a direct file with a slightly longer intrinsic length adopts it and never falls back below the server total; a live channel still reports no duration; a prepared refusal shows the escalation attempts on the same source and only then an error; an unreadable metadata response still yields a described source after one reduced inspection.
