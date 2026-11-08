# Tizen packaging and device qualification

Tizen uses the shared SolidTV application. The existing package is an HTTPS
redirect launcher, preserving the API's same-origin contract. Hosted playback
uses the HTML/native-HLS/hls.js path when Samsung AVPlay is unavailable.

Samsung explicitly excludes Tizen APIs from hosted pages. A redirect launcher
therefore does not establish AVPlay support; see [Samsung hosted application
restrictions](https://developer.samsung.com/smarttv/develop/faq/hosted-applications.html).
The shared entry can load `$WEBAPIS/webapis/webapis.js` in a packaged file
context and creates the required `application/avplayer` surface when that SDK
is present. The SDK-boundary tests exercise native state, track selection and
canvas/control layering independently from HTML media decoding.

A complete native package still needs locally bundled assets, an approved API
transport that preserves authentication/origin checks, a Samsung signing
profile, and target-device qualification. The current launcher is not that
native package. No browser shim or simulator result qualifies AVPlay codecs.

`npm run package:tv` builds the browser bundle and its hosting ZIP. Running
`node scripts/package-tv.mjs tizen` requires `TIZEN_PROFILE`; unsigned WGTs are
not installable. `VIPTV_TIZEN_HOSTED_URL` selects the hosted HTTPS entry. The
development package ID remains `VPTV000001` until signing is provisioned.

Record model, firmware, actual engine, codec/container, first decoded frame,
audio/subtitles, paused/playing seeks, source replacement and recovery results
separately. Samsung's simulator substitutes dummy video for some HLS paths;
its full emulator also has codec, seeking and DRM limits. Physical acceptance
remains distinct from SDK simulation and real desktop-browser decoding.
