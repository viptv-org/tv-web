# Current correction: shared cards, browser navigation and real playback

Design revision: `6bdd58fe8b59e92a9a7ba889f71bd027bdc5bab8` (RUI-023). Shared core: `1388b17db29a6b0279af5f125cc1fafc76776459`.

The previous fixture pass did not establish that the owner's streams or populated live/queue artwork worked. The reported defects were real: compact-home specificity overlapped mobile hero artwork and copy, inherited logo offsets displaced card images, queue cells chose artwork and generic detail activation in React, appearance was exposed in the header, and screen state had no browser history.

Rust now returns CardPresentation (image/role, title, subtitle, normalized optional progress, action/label). Web and Kotlin consume that projection. Queue adapters fetch metadata with bounded concurrency; Rust merges only the matching episode still/title and preserves source/progress/previous-episode identity. Missing episode art never becomes a parent portrait. The regression fixture deliberately begins with only a saved parent poster and requires the exact episode image from metadata.

Responsive navigation uses /tv paths, stable title identifiers, Back/Forward and authorized reload. Theme/OLED values are local appearance preferences in Settings, never route parameters. Back appears before the brand in DOM and visual order. Responsive playback also uses an upper-left Back control that stops its lease and restores the prior route; the old bottom-right exit remains only in the TV remote layout. A live card plays directly without a detail/source intermediate screen; browser Forward to a retired live session returns Live TV without autoplay. Native TV remote behavior remains separately checked.

## Current evidence

- Shared Rust workspace: 40 tests and strict Clippy passed; generated Kotlin/TypeScript and WASM rebuilt.
- Web unit/controller/API: 81 tests passed, one worker and 256 MB Node heap.
- Responsive browser: 17 scenarios passed across 360–2560px, including real-shaped queue/live data, exact episode thumbnail identity, logo containment, compact-focus hero separation, left-hand Back, OLED Settings, profile geometry and scroll restoration.
- Browser routing: four scenarios passed for Back/Forward, player cleanup, direct live selection, clean URLs and profile-preserving reload without autoplay. Initial test failures were corrected fixture selectors (profile accessible name includes initials); the final tests exercise the real App/Rust/history with only external playback/backend boundaries mocked.
- TV shell browser regression: 28 passed and 12 intentional platform-specific exclusions across Tizen/Vizio fixture projects. Queue information is opened with explicit Details; normal queue activation retains Resume/Next intent.
- Production build with strict grouped type checks and immutable core/design checks passed.
- Actual production-adapter playback: native-first Cartoon Network reproduced `PipelineStatus::DEMUXER_ERROR_COULD_NOT_PARSE` at time zero. The same source/session decoded through hls.js/MSE at 1920×1080 with advancing time and no media error. The adapter now retries that local engine once before backend escalation. Actual default VOD playback also advanced at 1920×1080. No new transcode request or source substitution is introduced by that fallback. One separate VOD source failed backend video inspection before player creation; this is not reported as fixed.
- Final real React flow: restored profile → Live TV → search → select Cartoon Network. Video reached1920×1080 with advancing time, no media error, muted=false and volume1 under normal browser autoplay policy. Exactly one LIVE NOW label and no Sources button appeared. No page exceptions; the test's playback lease was stopped. The first six real queue image URLs matched Rust's projection, including exact episode thumbnails. One upstream thumbnail remained unavailable and showed its fallback.
- The integrated Home probe also reproduced a2,305,123-byte shared bridge merge that blanked the app: full episode lists were duplicated in queue occurrences and metadata raw. Core1388b17 removes those duplicates, retains the2MiB bound, and passes a400-episode regression. Real Home then rendered without exceptions or overflow.
- Private playback probe devices and leases were cleaned up. No credentials, provider URLs or screenshots are committed. Physical Tizen/Vizio decoder qualification remains separate.

Android consumes the same pinned core; hosted CI performs its native/Compose compilation. No local Gradle or emulator was used. See Android TESTING.md and the actual hosted run result for its evidence. No installed Tauri shell is claimed.

# Earlier implementation record

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

Real viewing client: http://<server-lan-ip>:4173/ using the existing authorized SSH/LAN relay and same-origin verified-TLS upstream proxy. This is a development preview; the older static layout study on port4180 now redirects to this current preview. Production backend and account/admin services were not redeployed.

Live LAN smoke check after publishing: a fresh mobile browser loaded the responsive app at port4173, received HTTP200 from the real /api/auth/device/code endpoint, displayed a non-placeholder pairing code and had zero visible alerts. No credentials, pairing code or screenshot is recorded here. This establishes live startup/proxy integration, not signed-in provider playback. Implementation commit: 809f9d9.
