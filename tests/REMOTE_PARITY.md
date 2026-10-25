> Qualification remains in progress. The current requirements and per-board
> inventory are in [REMOTE_COMPLETION_AUDIT.json](REMOTE_COMPLETION_AUDIT.json).
> This document describes the earlier implementation checkpoint and its limits.

> Qualification remains in progress. The current requirements and per-board
> inventory are in [REMOTE_COMPLETION_AUDIT.json](REMOTE_COMPLETION_AUDIT.json).
> This document describes the earlier implementation checkpoint and its limits.

> Qualification remains in progress. The current requirements and per-board
> inventory are in [REMOTE_COMPLETION_AUDIT.json](REMOTE_COMPLETION_AUDIT.json).
> The checkpoints below distinguish implemented behavior from exhaustive qualification.

# Server-authoritative TV wrapper — 2026-10-23

The active TV entry is `src/tv-solid/remote`. It replaces the previous SolidTV
application for Tizen, Vizio, webOS and explicit browser TV layout. The responsive
React entry is unchanged. Historical TV evidence in PARITY_MATRIX.md applies to
the retired application, not automatically to this one.

## Exact inputs

- Design: `4f3a1eae36399608f459b5973381ead969c2c2d1`; Tv3 boards are unchanged
  from the approved `07c76e0858ea62896aba88002cee2483d5d4796f`. Later design work
  before this pin concerns Roku KMP assets/docs; the pin includes TV Library/Search access paths and device-entry states without replacing the Tv3 boards.
- Backend producer: `0d8da118e2282c1d7cefa4bc590004bf6a97c211`, based on `7275bce`.
- Video: `76c73fde22984d6d87a4848aab2fb47d563fdf46`.
- Core pin retained for the separate React entry:
  `b6ee0548753483c9627cb1c73e7761b62f936933`. The TV graph does not load that engine.
- Shared contract and fixture: `../backend/TV_REMOTE_API.md` and
  `../backend/fixtures/remote-viewing-v3.json`. Roku BACKEND_HANDOFF.md was reviewed. Server engine snapshot: `65add90c6a73da8743021ed0a0ff5c862d78124d`.

## Scope and evidence by reference

| Tv3 references | Implementation and browser evidence | Difference / boundary |
| --- | --- | --- |
| Splash, Welcome, SignIn | Matched reference captures; monotonic expiry, cancelled refresh, passive/focused controls; bounded renderer-clock wall and normal/reduced motion | No guest/local entry; splash is an indeterminate load, not invented server progress |
| SignInChoose, SignInEmail, SignInCode, SignInPassword | Omitted in favour of the supported pairing flow | Server does not advertise these alternate authentication flows |
| SignedIn | Reference acknowledgement, 500ms entrance, 2.5s progress, server-directed profile/Home destination | Matched private capture/artwork bounds; normal/reduced motion, Back cancellation and actual producer pairing tested |
| SignedIn | Pairing currently proceeds directly to profile/Home | Missing reference success state; tracked as included, not an unsupported authentication method |
| SignedIn | Pairing currently proceeds directly to profile/Home | Missing reference success state; tracked as included, not an unsupported authentication method |
| Profiles, ProfileEdit, Pin | Matched Profiles capture; full-size rounded avatars, capability-gated controls and empty-list Retry; existing edit/parent authorization and nested Back | No fabricated profile PIN/language setting; parent PIN supports server-validated 4–8 digits and explicit submission |
| Home, Browse, HomeToRows, Motion | Billboard, ordered shelves, 400ms preview settling, 450ms row lift, independent focus, 700ms hold | Calendar removed as approved; image-mask composition approximates CSS gradients without five full-screen blends |
| HomeLoading, RowStates, CardStates | Loading/partial/empty/failed rows, server badges/progress, cancellation and return focus | Unknown state annotations are absent; no local watched/completion policy |
| Movies, MoviesCatalogs, MoviesFilters, MoviesFilterText | Server controls, virtual poster grid, choice/text overlays | Only returned catalogs, facets and choices are rendered |
| MoviesLoading, MoviesEmpty, MoviesError | Loading, empty and retryable failure states | Failure is a retry panel; no offline operating mode |
| Search, MyList, Live | Search keyboard/results; producer Library type/sort/filter/reset controls; virtual guide and explicit playback | My List matched capture and 14 exact artwork rectangles; draft cancellation/retry; guide source changes remain on channel routes and obey server action flags |
| Title, Movie, Episodes | Detail artwork, server viewing action/resume display, season offsets, episode and recommendation strips | Cast and unavailable episode annotations omitted; source summary appears only after discovery |
| Sources, SourcesLoading, SourcesEmpty, SourcesTorrent | Partial discovery, server ranking/facets/named best source, explicit selection, cancellation | Torrent delivery is server-managed; no native torrent progress or local engine |
| PlayerBuffer, PlayerControls, PlayerScrub, PlayerAudio, PlayerError | Producer action flags; source/track replacement reports observed clock and executes returned clock; actual HLS frames, retry/cancellation, expiry and auth loss | Paused/ended replacement and explicit decoder failure reporting still need qualification; native AVPlay/TV codecs not qualified here |
| PlayerNext | Explicit Next consumes the server continuation result | Countdown/auto-next omitted: no producer directive exists |
| PlayerSkip | Omitted | No authoritative skip-intro/credits annotation supplied |
| SetPlayback, SetSubs | Server preference descriptors, revision-confirmed mutations, caption appearance | Foreign-audio mode omitted from choices pending gateway support; existing saved foreign mode fails visibly, never becomes local policy |
| SetAddons, AddonEntry, AddonInstall | Inventory, URL installation, server-owned activation, removal, rejected-mutation retry | Installation is server submission/confirmation; no invented manifest-preview contract |
| SetSources, SourcesViptv, SourcesXtream, SourcesM3u, SourcesRemove | Server schema-driven configuration, secret fields, provider choices and explicit removal | Unavailable runtime schemas omitted; private credentials are never echoed; live service credentials were not exercised |
| SetParental, SetAbout, SignOut | Parent PIN/policy intents, app/server information, confirmed sign-out | No account-wide revocation or household destructive QA operations |
| SetDisplay | Omitted | No device-scoped remote preference contract |

## Current bounded channel traversal

Source `cb7224e` adopts the producer's previous/next descriptors in Live and
channel Search. Both retain two payload pages (at most 400 channels under the
wire limit), not a growing cursor history. A 241-channel round trip peaks at 80
fixture payloads and exactly twelve page requests. Delayed/rejected responses,
changed snapshots, revision refresh and playback return preserve identity and
focus. Pending reverse arrivals retain the visible focus rectangle. Search's
47 reference rectangles and before/after pixels are unchanged.

The final suite has 107 browser cases and 357 unit tests. Three alternating
performance pairs per workload pass the existing frame budget without long
tasks. Current artifact: `../.artifacts/tv-remote-channel-windows-20261024/`.
Home, discovery, Library and detail payload windows remain a separate obligation.

## Prior focused Browse

Source `ee23cf6` consumes producer-owned preview artwork, hint/progress and
Play/Details intent. The matched Browse capture has 19 rectangles, a pixel gate
and browser-reviewed visible layers. Five authority/cancellation/cache cases
pass; the complete browser suite has 95 cases. Episode tiles and parent-series
artwork remain separate. Home-to-rows motion is still unqualified. Small Play
blur pixels persist only for mounted tiles, avoiding repeated canvas readback.
The current delivered artifact is `../.artifacts/tv-remote-browse-20261024/`.

## Prior Home billboard

Source `291a061` matches default Home geometry, icons, glass and the 9s/14s
presentation motion. Interaction/menu/visibility pause, reduced motion and
image failure/cancellation are tested. There are 36 measured Home rectangles
and matched intermediate/end zoom regions. Browse is qualified above; Home-to-rows remains open.
Producer `1a361e4` supplies shared bounded reverse-page request descriptors;
client payload-window adoption is a separate remaining cache obligation.

## Earlier Home and large-directory follow-up

Source `3af20b8` adds 32 measured reduced-motion Home rectangles, correcting
metadata gaps, badge outlines and row typography. Home motion/glass behavior and
focused-title Browse remain unqualified. Producer `def82a0` fixes the Roku-reported
10,000-offset cursor rejection without client truncation; the shared boundary
fixture and browsing/search/category handler tests cover the last page.

## Earlier matched states

Source `d3ab4d9` has seven matched captures: Splash, Welcome, SignIn, SignedIn,
Profiles, MyList and Search. There are 80 measured rectangles and 32 Welcome
artwork-region comparisons. See REMOTE_VISUAL_MEASUREMENTS.json for bounds,
differences and limits. Live/Search page windows now consume the shared producer
snapshot identity and retire incompatible pages and guide reads. Remaining
references and state combinations are explicitly open in the completion audit.

## Earlier visual sweep (different fixture scope)

`tests/preview/remote-visual.mjs` produces 32 private captures and renderer bounds.
The checked bounds come from the reference HTML: Home row `(96,876,384,216)`,
episode cards `(96,236,448,252)` / `(568,236,448,252)`, recommendation posters
`(96,728,232,348)`, catalog posters `(96,244,232,348)` / `(344,244,232,348)`,
source drawer `(960,0,960,1080)`, settings rows `(640,220,1184,96)`, and PIN keypad
`(744,540,136,76)`. Normal-motion drawer endpoints and Back focus are also tested.

Captures were inspected privately against the corresponding Tv3 references.
The sweep corrected artwork layering, detail-logo bounds, metadata chips,
episode overlap, season text wrapping, drawer geometry and list virtualization.
Fixtures use reference artwork with synthetic identities; catalog ordering,
profile count, metadata and supported controls differ in some states. These are
component/geometry comparisons, **not a claim of zero pixel difference across
all 56 boards**. Font rasterization, CSS versus canvas blending and unadvertised
features remain explicit limits. Captures are excluded from source and artifacts.

## Browser versus hardware

Browser fixtures verify API routing, pending mutations, late-response rejection,
profile isolation, pairing/refresh, server source/episode selection, revisions,
partial discovery, cancellation, lease expiry, source replacement, 700ms hold,
reduced motion, scaled layout, season/recommendation focus and actual HLS decoding.
Production bundle analysis rejects the legacy core, local torrent runtime,
MediaBunny policy/remux and Tauri dependencies from the reachable TV entry.

Conservative H.264/AAC gateway delivery at 1080p is intentional. Tizen AVPlay,
webOS/Vizio firmware, 4K/HDR/DRM, physical remote repeat behaviour, device texture
limits and signed device installation still require physical qualification.
No production deployment or replacement of the shared QA binary occurred.
