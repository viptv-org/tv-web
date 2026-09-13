# Responsive implementation validation

Implementation: real shared tv-web application; tracking [#3](https://github.com/viptv-org/tv-web/issues/3). Design: `502dcb5a310d73bd48b00e9d0f919f8699cbffa4`. Core: `d1897fb8fc0401368074698f6b49f1941823f5e5`.

Unlike the layout study, this application uses the existing real device-session restoration, account profiles, catalog/detail/source requests, watch state, player adapters and Rust normalization. All fixture data lives in tests, never the application bundle. Default responsive presentation preserves original VIPTV colors; TV configuration explicitly retains fixed-canvas presentation.

## Populated-layout correction — current

The owner reported a multi-screen-tall phone hero. A24-item shelf reproduced an actual5952×3348px hero and5968px internal scroll width in a390px application. The earlier sparse fixtures checked the outer document and missed this severe overflow in the fixed application scroller. Their passing results were insufficient UI evidence.

The corrected grid uses shrinkable tracks/children; only shelves scroll horizontally. Artwork remains16:9 within bounded phone/tablet/desktop dimensions. Desktop navigation now participates in the header layout; long profile labels cannot overlap it. Long headings, Search rows, filters, source text, avatar/focus frames and mobile browse-card sizing discard conflicting TV dimensions. Back restores page/shelf anchors and focus. Original VIPTV colors remain unchanged.

Current validation: production build with strict256MB grouped type checks;73 unit/controller tests;12 responsive scenarios including seven populated widths360/390/768/1024/1280/1440/2560 plus two Back-restoration scenarios; four explicit TV geometry/profile regressions. The last targeted four-case follow-up passed after correcting source text contrast and scroll-edge rounding expectations. Fixtures include72 Home cards, long profile/catalog/provider text,3840×2160 landscapes,2000×3000 posters, transparent logos and populated detail/source flows. Private phone/desktop Home/Discover/detail/source captures inspected; no screenshots committed. Phone hero is358×201.375px at390px width, not5952×3348.

Both LAN preview addresses now reach the real client: port4180 redirects without caching to4173. Fresh-browser live pairing through that redirect succeeded with zero alerts. No account/profile/provider/history data or backend production service was changed. Physical-device/native packaging limits below remain.

## Initial implementation evidence (sparse coverage)

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

Real viewing client: http://192.168.88.180:4173/ using the existing authorized SSH/LAN relay and same-origin verified-TLS upstream proxy. This is a development preview; the older static layout study on port4180 now redirects to this current preview. Production backend and account/admin services were not redeployed.

Live LAN smoke check after publishing: a fresh mobile browser loaded the responsive app at port4173, received HTTP200 from the real /api/auth/device/code endpoint, displayed a non-placeholder pairing code and had zero visible alerts. No credentials, pairing code or screenshot is recorded here. This establishes live startup/proxy integration, not signed-in provider playback. Implementation commit: 809f9d9.
