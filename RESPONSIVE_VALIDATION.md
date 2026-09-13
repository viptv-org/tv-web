# Responsive implementation validation

Implementation: real shared tv-web application; tracking [#3](https://github.com/viptv-org/tv-web/issues/3). Design: `2411c28a169412fbedd38a293adc1a7482dcc9c0`. Core: `d1897fb8fc0401368074698f6b49f1941823f5e5`.

Unlike the layout study, this application uses the existing real device-session restoration, account profiles, catalog/detail/source requests, watch state, player adapters and Rust normalization. All fixture data lives in tests, never the application bundle. Default responsive presentation preserves original VIPTV colors; TV configuration explicitly retains fixed-canvas presentation.

## Evidence

- Production build and immutable design/core integrity checks passed.
- Unit/controller suite: 72 tests passed in 11 files, one worker, 256 MB Node heap. Includes actual Rust WASM normalization, session restoration, playback controller/adapters and mocked native SmartCast command workflow.
- Full browser regression: 60 passed, 38 platform-specific duplicate exclusions, one worker. Includes browser WebM decoding and both native-browser/default and forced-MSE HLS paths; simulated AVPlay remains explicitly simulated.
- Final responsive subset: five scenarios covering 390×844, 1440×900 and 2560×1080, real profile restoration/API routing, OLED persistence, More/Back focus, browser SmartCast handoff, header bounds, keyboard contrast, mobile Discover access, episode layout and title-logo success/failure. Private Home and series captures inspected.
- Responsive Guide follow-up: all five Guide tests passed, including new touch channel paging across the 40-channel API boundary, channel playback identity and Earlier/Now/Later restoration.
- The original all-in-one TypeScript graph exceeded its 256 MB heap after test expansion. The build now strictly type-checks application and test groups sequentially at the same cap; the full production build then passed. No heap limit increase was used.
- No emulator or Gradle process used. Private browser captures remain outside committed sources.

## Delivery limits

Browser fixtures verify real client code against controlled backend responses, not account/provider availability or physical decoder compatibility. Native Tauri host registration/package and real TV pairing remain separate checks. The public `/tv/?platform=vizio` receiver returned HTTP404 during this task; launch is unavailable unless a deployed HTTPS receiver is configured with VITE_VIZIO_RECEIVER_URL. The responsive renderer currently uses the same pinned Rust WASM artifact; Tauri API transport uses its native HTTP plugin. Backend/account/admin deployment and real user records are unchanged.

## Preview

Real viewing client: http://192.168.88.180:4173/ using the existing authorized SSH/LAN relay and same-origin verified-TLS upstream proxy. This is a development preview; the older static layout study on port4180 is a separate historical preview. Production backend and account/admin services were not redeployed.
