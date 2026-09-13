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
