# Vizio SmartCast hosting and qualification

Vizio uses the same static SolidTV bundle and remote/focus UI as Tizen. Its only platform-specific implementation is `VizioHtml5Adapter`, which receives a backend-compatible direct, copy/remux, audio-converted, or fully transcoded URL that has already been selected by the delivery service.

Deploy `dist/` behind HTTPS at the same VIPTV origin under `/tv`. Configure the server to return `index.html` for client routes, serve JavaScript/CSS with immutable content-hashed cache headers, and return correct MIME types for manifest/media resources. `npm run package:tv` also writes a deployable static ZIP under `artifacts/hosting/`. The API remains same-origin. Playback uses short-lived backend-authorized URLs, including a separately hosted gateway with media CORS for the frontend origin. Provider credentials stay behind the gateway. The shared UI requests server-authorized input-track replacement; the HTML adapter also exposes output tracks that its native engine or hls.js actually reports.

There is no public Vizio capability guarantee in the product contract. Qualify each TV and firmware with the eight fixture groups from `viptv-org/design/PLAYBACK_CAPABILITIES.md`; report direct success first, then copy/remux, audio conversion, and full transcode only when the earlier rung demonstrably fails. Record pass/fail/not-run with model, firmware, URL authorization shape, codec/container, controls, seek, subtitles, source identity, managed recovery, and final-ten-second next/Back behavior. Desktop browser tests verify the shared interface only; they do not establish SmartCast codec or sustained-playback support.

`VizioHtml5Adapter` is native `<video>` only: it prefers the engine's native
HLS and falls back to hls.js/MSE when the engine lacks native HLS, rejects
the selected stream, or never exposes its requested subtitle rendition. The
subtitle retry is bounded and retains the same URL, position and paused intent. It has no
MediaBunny, WebCodecs, or client-side transcode path, and it reports its
capability fields as probes. A future local MediaBunny path must be a
distinct adapter with its own runtime probe, memory evidence, fixture
results, and recovery tests; it must not be represented as an implicit
fallback by this adapter.
