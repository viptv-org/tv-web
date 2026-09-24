# Lightning TV Settings and performance checkpoint — 2026-09-24

The staged Blits rail now opens Settings. Browser fixtures reached the six root
rows, the profile tiles, Playback preferences, an API-backed choice/save, the
account addon list, addon Enable/Disable action, nested Remove confirmation,
and the sign-out confirmation. Back restores the parent row and then Home;
cancelling removal or sign-out leaves those resources intact. Settings and
Playback-choice captures were byte-equal in Tizen, Vizio and webOS browser
modes. Addon install text entry, confirmed removal, profile editing, and
parent-PIN sign-out remain unverified or incomplete in Blits; no TV launcher
was switched.

Matched 1920×1080 React-to-Blits comparisons remain open: `TvSettings`
172,804 changed pixels (8.3335%, SSIM 0.894380), `TvPlayback` 197,552
(9.5270%, SSIM 0.834234), `TvPlaybackChoice` 1,148,625 (55.3928%, SSIM
0.878242), `TvAddons` 177,432 (8.5567%, SSIM 0.852570), and `TvSignOut`
1,100,764 (53.0847%, SSIM 0.900069). `TvAddonManage` changed 1,030,417
(49.6922%, SSIM 0.891538) and `TvAddonRemove` 1,029,282 (49.6374%, SSIM
0.901659). These use the matching React PNG via
`--reference`; the comparator's default is the pinned design WebP, which is a
different comparison.

The production-bundle Chromium timing script is
`node tests/preview/perf-compare.mjs` against a local Vite preview mounted at
`/tv/` (`npx vite preview --base /tv/ --host 127.0.0.1 --port 4182`). On the
final bundle, five unthrottled runs with the same mocked Home data reached
first interactive focus at 201 ms median for React and 388 ms for Blits.
Five runs at 4× CPU throttle measured 663 ms and 1,238 ms. The
input-to-focus markers were React DOM `focusin` (0.5 ms median unthrottled)
and Blits lifecycle focus (21.8 ms), so they do not prove equal visual paint
stages; the harness explicitly focuses React's first action while Blits
focuses it automatically. Blits had 25 of 627 sampled frame intervals over 33 ms unthrottled;
React had 0 of 39, over shorter interactions. These results do **not** establish
a performance win. Chromium used a SwiftShader software GPU; these are browser
proxies, not physical-TV measurements. A separate steady-state diagnostic after
a three-second settle found only 1 of 162 slow frames unthrottled, but about
20 of 158 at 4× CPU throttle. Hidden route trees in the root Blits template
remain a likely startup cost and a candidate for further restructuring.
Playback is now loaded only when a source is chosen, and Home no longer waits
for unrelated catalog/live fallback requests when Continue Watching supplies
the hero. Reducing the Home reveal delay to one frame preserved the prior
Blits `TvHome` capture exactly (0 changed pixels); the browser player fixture
still reached playback. TV performance remains an open acceptance gate.

The artwork audit confirmed remote card and hero images already use the shared
wsrv policy. The remaining raw Home/title logos now request wsrv derivatives
at their rendered dimensions (410×118 and 310×90), and five visible title
episode stills request 360×200 rather than 544×300 derivatives. Home and title
fixture screenshots remained unchanged at the pixel level; actual network
latency and physical-TV decode cost have not been measured.

# Lightning TV Search — 2026-09-24

Search now keeps all result identities in a non-reactive navigation index but
mounts only cards intersecting its 1920×1080 viewport. A 120-result model
check showed nine mounted views and wsrv artwork URLs only for those nine;
offscreen cards retain their original positions for D-pad paging. The existing
browser scenario still moved through offscreen results, held a result menu,
restored focus and returned to Home. Its `TvSearch` frame was pixel-identical
to the prior Blits capture. This reduces component and image work during
Search; input latency and physical-TV frame rate have not been remeasured.

The staged Blits rail now opens Search. Its 39-key TV keyboard owns D-pad
focus, accepts physical keyboard letters, and searches normalized catalogs and
Live TV after 650 ms. Browser fixtures exercised a replaced query without a
stale request, 14 grouped Naruto results, result/keyboard focus movement,
title/Back restoration, Delete/Clear, no results, and partial catalog failure
that retained the live result. Populated and blank captures were byte-identical
across Tizen, Vizio and webOS browser configurations. At 1920 × 1080 against
matched React captures, populated `TvSearch` changed 407,982 pixels (19.6751%,
SSIM 0.942227); blank Search changed 79,744 pixels (3.8457%, SSIM 0.827156).
Both remain open visual deviations. Reproduce the blank React frame with
`node tests/preview/react-search-blank.mjs`; no-result and partial-failure
states have browser captures but no matched React pixel measurement.
`npm run build`, 169 unit tests and the targeted responsive/TV browser suite
(24 passed, 10 skipped) pass. Phone `Main` and desktop `DeskHome` are exactly
equal to their pre-migration captures (0 changed pixels). No physical Blits TV
run or TV launcher switch was performed.

# Lightning TV held-card menu — 2026-09-24

The staged Blits action menu now opens from Home, Search, Discover and My List tiles
on a 700 ms OK hold; ContextMenu also opens it. Back restores the tile, and a
held release does not also activate it. Tizen, Vizio and webOS browser-mode
captures of `TvItemMenu` were byte-identical. At 1920 × 1080 against the React
TV capture it changed 1,223,606 pixels (59.0088%, MAE 4.7415, RMSE 21.5925,
SSIM 0.886041). This remains an open visual deviation. Browser fixtures
exercised Choose source, previous-episode Resume at its saved position, restart
at zero, hide/Undo requests, My List toggle and watched correction through the
shared API. The fixture records hide/Undo calls but does not mutate its queue,
so a real backend and physical-TV confirmation remain pending. The Undo view
has not been compared pixel-for-pixel.

# Lightning TV My List — 2026-09-24

The staged Blits menu now opens My List. Browser fixtures cover saved titles,
Continue Watching, focus restoration through title detail and a direct Resume
source/player path, and refetch after a saved-title toggle. Queue and saved-grid
captures were byte-identical across Tizen,
Vizio and webOS browser modes. At 1920 × 1080, `TvLibrary` queue changed
614,925 pixels against React (29.6549%, SSIM 0.953726). A matched saved-grid
capture with six fixture favorites changed 463,694 pixels (22.3618%, SSIM
0.951455). Reproduce the two states with `node tests/preview/lightning-shoot.mjs TvLibrary`
and `node tests/preview/react-library-saved.mjs`, then run the pixel comparator.
Both are open deviations. Source/media behavior used browser stubs;
physical TV navigation, decoding, hide/Undo, watched correction and previous
episode actions remain unverified on hardware. Phone `Main` and
desktop `DeskHome` remained exactly equal to their pre-migration captures
(0 changed pixels at 390×844 and 1440×900). `npm run build`, 169 unit
tests and the targeted responsive/TV browser suite (24 passed, 10 skipped)
passed. The packaged TV launchers remain on React.

# Lightning TV Discover — 2026-09-24

The staged Blits menu now opens Discover. Its grid uses shared API catalogs,
Rust-normalized cards and Blits D-pad focus; a card opens title detail and Back
restores the same card. Browser fixtures exercised Genre choice, catalog/type
switching, three-row focus window movement and return to Home. Tizen, Vizio and
webOS browser captures were byte-identical for `TvDiscover` and
`TvDiscoverFilter`. At 1920 × 1080 against matched React TV captures,
`TvDiscover` changed 725,162 pixels (34.9712%, SSIM 0.952812), and
`TvDiscoverFilter` changed 1,178,903 pixels (56.8530%, SSIM 0.940365).
These are open visual deviations. Text-only required filters, horizontal chip
overflow and longer filter lists still need implementation. No physical Blits
TV run or launcher switch was performed. Build and 169 unit tests pass; the
targeted responsive/TV Playwright suite passed 24 with 10 platform skips on
the isolated rerun. Its prior concurrent run lost one browser execution
context while a build was running.

# Lightning TV menu — 2026-09-24

The staged Lightning TV entry now has a focus-owning expanded rail. Browser
captures for Tizen, Vizio and webOS matched byte-for-byte; the `TvMenu` capture
still differs from the React TV reference by 1,625,803 pixels (78.4049%,
SSIM 0.930841). The full-frame result includes the previously measured Home
background deviation. Browser D-pad checks covered menu entry, Discover focus,
Right/Back restoration and the profile route. This was the menu-only
checkpoint; Search, Live TV and Settings were added in later staged commits.
`npm run build`, 169 unit tests
and the targeted responsive/TV Playwright suite (24 passed, 10 skipped) pass.
The public TV launcher remains on React; this is staged browser evidence only.

# Physical Vizio cast recovery — 2026-09-24

The desktop SmartCast command launched Conjure (app 17, namespace 4), but the
public watch entry returned nginx HTTP 403 because its static bundle
directory was empty. A root-path build of tv-web commit `feeffe9` was
restored to the watch host. Its running container had retained an old empty
bind mount, so restarting that container was also necessary. The public
entry and JavaScript asset then returned HTTP 200 with the correct MIME
types. After another launch, the TV loaded assets and completed device
approval, profile and catalog requests. The user confirmed it works.

This is physical-TV evidence for launch, sign-in and entry to the viewing UI
on a 65-inch Vizio SmartCast set (firmware 2.600.596.0-10, Chrome 87 user
agent). It does not qualify every screen, remote action or media decoder.
The cast dialog's launch response proves only that the TV accepted the
command; receiver loading was verified separately through public HTTP and
the TV's subsequent requests.

# VIPTV design-system overhaul — 2026-09-23

Design revision `5740c91d6e9cb7616626bdbb0f635cb62f6ec0c2` was imported
for this pass. The phone browser, desktop web/Tauri shell preview and TV canvas
use the new tokens, primitives and screen-family styles. The old TV and
responsive CSS files were removed. The account website's designed WebLinkTv
screen is owned and validated separately in `web`.

The preview harness reached 151 of 155 reference screens and generated a
reference/app comparison for each. The remaining four are the three composite
States boards (their individual states are reachable) and WebLinkTv (in the
account website). A pixel-difference sweep covered all 151 pairs; Home,
Profiles, title/sources, Discover, Search, My List, Settings, casting, local
mode, player and TV focus states were inspected at native reference sizes.
The largest remaining differences are fixture content/counts and intentional
behavior: TV Search omits the reference's microphone because voice input is
not available, TV Sources retains the provider control, and the accent-colour
row has no reference screen. The mobile web header/nav insets were tightened
after review, so these layouts deliberately sit closer to the viewport edges
than the original phone sheets. See the current parity matrix for scoped
evidence and hardware limits.

Validation: `python3 ../design/scripts/validate.py` reports 516 design tokens;
`node ../design/viptv-design-system/tools/gen-themes.mjs --check` passes;
`npx vitest run` passes 169 tests; `npm run build` passes design, core,
video and TypeScript checks. `npx playwright test --reporter=dot` passes
127 browser scenarios with 75 deliberate platform skips across Tizen,
Vizio and responsive configurations. Local HTTPS serves the rebuilt viewing
bundle with a verified JavaScript asset. No physical Samsung/Vizio or
installed Tauri run was performed, and no production deployment was
attempted.

# Loading, player and polish pass — 2026-09-23

- Home loading: Home renders once its hero catalog and recent channels
  arrive; every other catalog shelf renders at once as a skeleton with its
  real title and loads its catalog as it nears the viewport (TV: all shelves
  in the background), at most four catalog requests in flight. Catalogs that
  cannot list without input (search-only) are skipped, required extras send
  their defaults, and loaded shelves survive Home reloads. Measured against
  a mock of 80 catalogs at 150 ms each: Home visible in ~0.4 s with 2–4
  catalog requests, instead of waiting for all 80. The local Caddy log showed
  real phone boots of 6–18 s with ~80 serial /api/discover calls.
- Startup: the startup cover is replaced (responsive shell) by HomeSkeleton,
  built from Home's own classes; its hero box matches the loaded hero at 390
  and 1440 px within 0.2 px.
- Nav responsiveness: windowed rows reuse their last measured pitch and size
  their first window from the viewport; returning to a heavy Home dropped
  from ~190–250 ms to ~85–97 ms at 4× CPU throttling.
- Cards (phone): title and minimal context in a fixed 40 px caption under the
  art; live channels are logo-width tiles without names; progress 6 px with
  2 px ends. Touch: no tap highlight, callout or text selection on held
  controls and art.
- Player (web/desktop): one row of same-sized icon controls with fullscreen at
  the end, Back and title across the top, tap toggles controls, double-click
  toggles fullscreen, a buffering ring over the picture; the TV overlay is a
  separate render path and unchanged.
- Detail: clickable genres (origin catalog, then the metadata's Stremio genre
  link, then any same-type catalog offering it), a cast row with photos when
  the metadata carries app_extras.cast, equal 48/56 px action squares.
- Audit fixes across dialogs, sign-in, text entry, profile editor, Settings
  (grouped list at every width), shelves inset, search/discover status,
  sources, Live TV gutter and now line, sidebar contrast.

Evidence (browser only): unit 148/148 (new `tests/ui/home-rows.test.ts`,
`tests/ui/search-popunder.test.tsx`); build green; Playwright on both
projects with no new failures against the previous run; screenshots
inspected privately. Not run on a phone, TV or the Tauri window.


# Poster cards and desktop header search — 2026-09-23

- Card shapes: `src/ui/cardShapes.ts` sets poster or landscape art per
  responsive surface; both shapes stay implemented, so any surface flips
  back with one value. Currently: Discover and Search results are posters;
  Continue Watching, Live TV and My List stay landscape; Home catalog shelves
  cycle poster, poster, landscape on every responsive width. Poster art is the
  Rust-projected `posterImage` role through the shared wsrv pipeline, retried
  at origin once, then falling back to the landscape art. Live channels and
  the TV canvas are always landscape.
- Phone card progress is 6px (was 3px).
- Desktop: the profile avatar anchors the bottom of the sidebar in both the
  browser and Tauri layouts; the Tauri titlebar drops its My List and avatar
  buttons and centres a real search field whose popunder lists per-profile
  recent searches and quick matches (arrow keys, Enter, Escape), handing
  Enter or "See all results" to the Search route. The browser layout no longer
  reserves the Tauri titlebar's empty 30px strip.
- Fixed while verifying: windowed shelves measured their pitch from a card
  wrapper and its own inner card, so every responsive row silently kept the
  280px landscape fallback. Measuring direct children (and re-rendering on a
  new pitch) makes Back restore poster and phone shelf offsets exactly.
  Remounted hero titles now promote an already-decoded logo on first render,
  so the page is no longer briefly 35px short while the phone offset restores.

Evidence (browser only): unit 144/144 including
`tests/ui/search-popunder.test.tsx`; `responsive-layout` Discover grid now
asserts poster tracks (160px minimum, three phone columns). The titlebar only
mounts under Tauri, so its rendering was inspected through a temporary
browser harness, not the desktop app; the native window was not run.


# Phone web UI pass — 2026-09-23

Owner-directed phone (≤599px) corrections to the responsive shell; the
desktop/Tauri responsive layout and the TV canvas are unchanged apart from the
two shared fixes noted below.

- Shell: no header bar on phones (the sidebar box leaves the flow, so short
  routes no longer carry 72px of phantom scroll); icon-only bottom navigation
  with a pill on the active destination; Watch on TV moved to Settings.
- Home: hero art is the first element with all corners rounded; no eyebrow
  when the hero stacks (≤899px); Details and My List share one 48px height;
  shelf headings name the content type (`Series · AniList Trending`) instead
  of the addon; rows start on the heading edge and bleed to the screen edge;
  tighter shelf spacing; no chevron pair on touch.
- Cards (phone): title and minimal context (`S1 E2`, or the year, plus a
  short queue state) printed inside the art above a flat 3px progress bar;
  no text rows, genres or resume times under the art.
- Discover (phone): type / catalog / filter chip rows and a two-column grid.
  Every layout, including the TV, now pages automatically through the
  `AutoLoad` sentinel; there is no Load more control anywhere (local mode
  included).
- My List (phone): segmented My List / Continue Watching switch.
- Live TV (phone): searchable channel list with category chips and now/next
  rows (current programme with progress, next start time) that pages itself;
  the timeline grid remains at ≥600px.
- Settings (phone): centred grouped list with inline notes, trailing values,
  an OLED switch and Watch on TV.
- Shared fixes: the idle hidden `<video>` no longer keeps the TV's 1280px
  width in the responsive shell, and the Search field no longer inherits the
  TV-only 10px baseline nudge.

Evidence (browser simulation only; no phone, tablet or TV hardware was used):
unit 141/141; `npm run build` green with design/core/video checks; Playwright
e2e on both projects compared against a pre-change baseline with no new
failures. Updated specs: `discover-filters` (automatic paging on the TV
layout), `responsive-layout` (phone Live TV list, phone two-column Discover),
`responsive-corrections` (timeline guide measured at 768/1440), `responsive`
(nav icons are SVG, phone OLED switch, in-art logo title separation).
Private phone/desktop captures were inspected locally and are not committed.

Still failing, all of them before this pass as well: the stale `responsive`
flow tests that expect the removed `.responsive-toolbar`, header profile
control and hero More options button; `populated responsive` (expects three
shelf sections); `responsive Back restores populated shelf offsets at 390`;
`browser-navigation` live card; `resilience-settings` focus; flaky
`next-episode` retries.


# Selectable engines and the autoplay test harness — 2026-09-17

The desktop app can now choose its playback engine and be tested without
driving the UI. `createPlayer({ platform: "tauri", engine })` in
`@viptv/video` requests `mpv` or `gstreamer` through the plugin's backend
field; `auto` follows the engine preference order the plugin reports in its
diagnostics (mpv first on Linux when its runtime is compiled — the Linux
shell now compiles both). The choice persists per device
(`viptv:playback:engine`) and is editable in Settings → Playback engine;
`VIPTV_ENGINE=mpv|gstreamer|auto` overrides it for one launch without
rewriting it. The engine actually serving the session is reported in
diagnostics (`PlayerDiagnostics.backend`) and shown as `Decoder: tauri-native
(mpv)` in the playback info sheet.

The autoplay harness runs the real player end to end from stdout:

    npm run test:autoplay          # VIPTV_TEST_AUTOPLAY=1 npm run tauri dev
    VIPTV_ENGINE=mpv npm run test:autoplay

Launch it against the local HTTPS backend (see the root README), sign in
once, and watch the terminal: the app autoplays the first movie on Home and
every player change prints one line

    [test] engine=tauri-native (mpv) state=playing position=12.3s error=none

State changes and errors print immediately, position beats at most every 2 s,
and a failing source shows `error=…` — the same failure the session
controller would act on. The shell owns the `[test]` prefix (`test_log`
command in `src-tauri/src/lib.rs`), so the lines stay greppable no matter
what the webview logs. Unit tests cover the env parsing (`src-tauri`), the
engine preference storage, and the harness probes, line format and pacing
(`tests/ui/engine-preference.test.ts`, `tests/testing/autoplay-harness.test.ts`).


# Direct-URL desktop delivery — 2026-09-17

The desktop host now plays the ORIGINAL absolute source URL natively and never accepts managed delivery. `PlaybackCapabilities.directUrls` (set by the Tauri profile) rides the same generic snake_case wire path as `directFiles` through the vendored core; the response normalizer accepts an absolute credential-free http(s) URL as that original source URL and maps the session's source `authorization` {cookie, user_agent} into the view, following the omitted-absent convention of the other view types. The session controller in @viptv/video does not escalate direct-URL clients up the delivery ladder — a delivery refusal, an unsupported-format open failure, or a late decoder failure surfaces instead of falling back to transcode — and the session's authorization flows into the open request, which the Tauri adapter already forwards as native_open cookies/userAgent.

- tauri-video-plugin: both seek arms (`desktop.rs`, `desktop/windows.rs`) wait bounded (3s) for the pending pipeline state change before seek_simple, so a resume seek right after open can no longer stall a transitioning playbin3. cargo fmt clean; cargo test 4/4.
- core: fmt/clippy clean; cargo test 40/40; typegen + build-wasm + test-wasm green. The wasm suite pins directUrls through the request wire, the credential-free URL boundary, and the authorization mapping.
- video: typecheck + 87 tests + dist-js build green, with four new direct-URL no-escalation/authorization cases and the Tauri profile declaring directUrls.
- tv-web: vendored core at aebc7bf (CORE_REF + generated TypeScript + wasm); typecheck + 87 tests + production build green. The client suite now rejects only credential-bearing playback URLs and accepts an original absolute source URL with its authorization mapped — the wire-level regen evidence. Browsers never declare directUrls, so web/TV behavior is unchanged; native playback of a real source through the new path awaits the server-side direct-url rung and a desktop smoke.


# Per-platform delivery profiles — 2026-09-17

Stage 5 of the shared-platform-desktop plan. Each platform entry point now resolves its delivery profile from one canonical declaration in `@viptv/video` `src/platform-profiles.ts`: `TIZEN_DELIVERY_CAPABILITIES` (native H.264/HEVC-Main-SDR envelope to 1080p), `VIZIO_DELIVERY_CAPABILITIES` (H.264/AAC baseline only — HEVC unclaimed, original-container rung off, managed ladder for the rest), the direct-play-only Tauri profile, and `webDeliveryCapabilities` (the measured browser probe behind the managed-HLS gate, memoized). `App.tsx` dispatches through `deliveryCapabilitiesFor(platform)`; the inline Tizen literal and the Vizio probe fallthrough are gone, so no TV engine consults a browser decoder probe.

- video: 9 test files / 83 tests passed (one worker, 256 MB Node heap), including the 6 new `tests/platform-profiles.test.ts` cases — declared profiles resolve without any probe, per-platform engine construction, server-ladder envelope values, web probe memoization, managed-HLS rejection, and the Vizio path driving `VizioHtml5Adapter` through a real open with zero `MediabunnyAdapter` constructions. Typecheck and dist-js build passed.
- tv-web: typecheck, 14 unit test files / 86 tests, and `npm run build` passed; the local HTTPS stack served the fresh bundle (asset hash matched `dist/`).
- Live receiver smoke (read-only; stack never restarted): `https://viptv.local.test:8443/tv/?platform=vizio` boots the receiver bundle and reaches the device-pairing screen with a code and QR (screenshot kept local). Pairing approval was blocked by owner credentials, not by code: the dashboard sign-in form enforces a 12-character minimum, and the only account password available in the private env was rejected by `/api/auth/login` (403), so no owner session could approve the device and a real source was not played this run.
- Real decode through the production Vizio engine: the `vizio` Playwright project passed all 3 media-decode cases — real Chromium WebM decode (pause/seek/end/cleanup) and real H.264/AAC same-origin HLS through both runtime-native HLS and forced hls.js/MSE. With the dispatch test, this is the "Vizio receiver loads the HTML/HLS engine, never mediabunny/WebCodecs" evidence at both dispatch and decode level.
- Backend delivery-matrix review: `direct_files`/`direct_video_codecs`/`direct_audio_codecs` gate the original-container rung (Tizen/Vizio leave it off), the native envelope is H.264 copy plus `hevc && hevc_sdr` Main/SDR with `direct_hls`/`direct_mp4` defaults, and `VIPTV_DIRECT_PLAY` remains an env override. The profiles map onto the server rungs as intended; no backend change was needed.


# Tauri desktop shell — 2026-09-17

Stage 3 of the shared-platform-desktop plan. `src-tauri` is the Tauri v2 shell registering `tauri-plugin-video`, `tauri-plugin-http` (native TLS roots + `unsafe-headers`) and `tauri-plugin-opener`; `src/player/tauri-native.ts` implements the shared Player contract over the plugin's raw `plugin:video|native_*` IPC and `TAURI_NATIVE_DELIVERY_CAPABILITIES` declares the no-transcode direct profile. Web builds are unchanged: `createPlayer` only constructs the native adapter inside the Tauri runtime and `main.tsx` selects the `tauri` platform only under `__TAURI_INTERNALS__`.

- 162 unit tests across 21 files passed (one worker, 256 MB Node heap), including the 17 new `tests/player/tauri-native.test.ts` cases for open/play/pause/seek/tracks/volume, wire-error mapping, stats polling and ended state, live refusal of VOD seeking, supersession cleanup, layout forwarding, aperture DOM handling, the Tauri gate, and the delivery profile. Typecheck and `npm run build` (design/core checks + vite build) passed. `cargo build` in `src-tauri` passed against GStreamer 1.28 / WebKitGTK 4.1 with the org-layout path dependency.
- `tauri dev` smoke against the running local stack (read-only; `https://viptv.local.test:8443`, never restarted): the shell boots the shared responsive UI and the pairing round-trip works through `tauri-plugin-http` after two desktop-only transport facts were fixed — `rustls-tls-native-roots` (the plugin's default bundled webpki roots reject the locally-trusted VIPTV Local Dev CA) and an explicit first-party `Origin` (the plugin otherwise pins the webview origin, e.g. `http://localhost:5173`, which the backend's single-origin pin rejects with 403). Caddy's access log shows the pairing code request succeeding and device-token polls returning the documented pending status; screenshots (local only) show the sign-in screen in its normal state.
- Not exercised: native playback of a real source (pairing approval requires owner credentials this run does not have), the Windows WebView2 texture-stream path (implemented per the plugin's documented flow, untested), and macOS (rejected honestly as `engine-unavailable`). The Linux aperture is the minimal honest version: it makes the DOM stack above the anchor transparent but does not reconstruct backgrounds around the video rectangle the way the plugin's own compositor does; the native black floor shows while a session is live.


# Shared application-core integration — 2026-09-13

Core pin: dd192cd09e3aac6810ec3cdd862119fb0646c82d. Design pin: e821c297de2e81b47a6a1b22ed8aa0522cdd04e5. The actual app now drives restoration, refresh, profile acceptance and sign-out through Crux; Rust also owns normalized responses, artwork roles and source/continuation/progress/request decisions. React keeps rendering/focus and platform effect execution.

Final validation: 65 unit tests across 10 files passed with the actual WASM artifact. The complete one-worker Chromium suite passed 55 cases with 35 intentional platform exclusions (90 collected), without retries. Native HLS and forced MSE decoding, pause/seek/resume, parent-PIN/profile flows, remembered-profile reload, Home/remote hold/Next and profile geometry checks passed. Build/typecheck, core/design integrity and candidate packaging passed.

The failed first browser pass exposed an unbounded profile-confirmation loop when identity omitted the accepted profile. Core now returns a recoverable error and preserves the grant instead of repeating mutations; native/WASM regressions cover it. Seven fixture backends were corrected to return their accepted profile, matching the real backend contract. Shared hero action labels now match the Roku contract; portrait posters never fill heroImage. Episode thumbnail rendering consumes the separate episode artwork role.

No production backend or household account/history was modified. Physical Android/Tizen/Vizio, owner-provider streams and installed Tauri were not newly qualified by this browser run. Earlier measured checkpoints below remain historical evidence for their named revisions.

# Shared Roku presentation rebuild — 2026-09-13

This checkpoint supersedes older presentation evidence below. Design pin: `3ab29a63cbe6369341ee4376f69a59d4cbb38fc8`. The final implementation commit and hosted CI run are recorded in execution issue [#2](https://github.com/viptv-org/tv-web/issues/2).

The shared renderer was rebuilt across all existing screens. Tizen and Vizio use the same components, styles, packaged artwork and controller behavior. Player adapters remain AVPlay and HTML media with direct/copy/remux before transcoding. Roku and production services/data were not deployed or changed by this work.

## Completed evidence

- 43 unit tests passed, including device transport, guide paging, text retry, 700 ms hold/release suppression, player adapters/controller, server guide timezone labels, episode thumbnails and series-history transport.
- TypeScript and production build passed. Fresh unsigned Tizen launcher and Vizio static candidate paths were generated; earlier artifacts were retained.
- Full Playwright batch: 49 passed, 33 intentional skips, 82 collected, one worker, no retries. Both platform configurations passed UI routes plus 1280×720 and 1920×1080 proportional layout/focus checks and real controller episode-history merge/row navigation. The history endpoint is mocked at HTTP, not bypassed inside the app.
- Shared functional coverage includes pairing, profile CRUD/PIN, source choice/exact Resume, subtitle/quality preferences, addons, queue corrections/Undo, bounded Next/cancel, pause/seek/debounce/track-dialog Back and stop cleanup. Chromium decoded the recorded WebM fixture through the Vizio adapter. AVPlay was simulated; this is not native Samsung decoding evidence.
- Design validates 697 canonical asset files. Imported snapshot integrity and authoritative-local-checkout freshness pass. Build checks verify the snapshot and packaged asset hashes; they do not independently assess visual parity or whether an unfetched checkout matches GitHub.

## Visual evidence

Private captures only; none are committed or embedded. Frozen Roku reference: `viptv-org/roku@a047d9ca5fc80898013eefb66120d20fab5048c0` / installed 1.9.9. Each image was normalized to 1280×720 using bilinear sampling, then compared with ssim.js whole-frame default SSIM, without masks or alignment changes.

| Matched screen/state | Whole-frame SSIM | Inspected differences |
| --- | --- | --- |
| Settings, Switch profile focused | 0.955989 (95.6%) | Browser font rasterization and different selected profile avatar; rail spacing, centered actions and description geometry match source. |
| Search, blank query, first key focused | 0.923059 (92.3%) | Browser fonts/avatar, platform-specific input help and vector/native keyboard symbol rendering. |

Also inspected browser fixture captures of Home, sources, Guide, profiles and episode progress. Their fixture content differs from the physical Roku references, so no matched-content score is claimed. The guide fixture deliberately spans a very long programme duration; its remaining-minute label is fixture data, not a real broadcast schedule. Geometry/functional assertions are not substitutes for matched screenshots across every screen/state. No universal 90% or 100% qualification claim is made.

## Remaining qualification and adaptations

Physical Tizen and Vizio model/OS/remote/decoder tests, Samsung signing, hosted AVPlay bridge availability, HDR/DRM/codec coverage and every detailed failure/return state remain unverified. No emulators or local Android builds were started. This commit prepares candidates; it does not install or deploy them.

The existing source Quality control is retained in the canonical help region, as recorded in the pinned design adaptation. Global Search uses the Roku blank composition; catalog-specific searches remain in Discover. Any further departure must be documented in design before implementation. [The parity matrix](tests/PARITY_MATRIX.md) records screen IDs and remaining evidence rather than treating passing suites as complete TV certification.

## Earlier checkpoints (historical)

# TV validation checklist

This checklist is intentionally evidence-based. A Playwright pass is browser simulation, not proof of AVPlay or Vizio playback. Screenshots are for local inspection only and are not committed.

## Current evidence

| Area | Evidence | Status |
| --- | --- | --- |
| Typed API boundary | `tests/api/client.test.ts` passed with 17 tests on 2026-09-12 | Current for the typed HTTP boundary; backend integration still required |
| TypeScript | `NODE_OPTIONS=--max-old-space-size=256 npx tsc --noEmit` passed on 2026-09-12 | Current source type check |
| Browser UI | Pairing, browse, source selection, guide, search, settings, profiles, held actions, resume mismatch, stale responses and Discover request contracts | 2026-09-12 local candidate: full two-project suite passed 41 tests with 29 intentional Tizen hardware exclusions, one worker and a 256 MB Node heap. It includes eight Next/Resume/recovery scenarios, three pairing lifecycle scenarios per project, direct/managed remote controls, and chrome timeout/modal Back behavior. |
| Vizio browser media | `tests/e2e/media-decode.spec.ts` records a local canvas WebM and drives the real HTML adapter through pause, seek, end and cleanup | Passed in the Vizio browser project; it does not establish playback on a physical Vizio model |
| Backend `/tv` static routes | Rust route test added with the backend change | Not run here; Runtime tests deferred by owner |
| Tizen AVPlay | Adapter and hosted-launcher path implemented | Physical TV/emulator evidence pending |
| Vizio | HTML adapter and same-origin hosting bundle implemented | Physical TV evidence pending |

Hosted run [34717122751](https://github.com/viptv-org/tv-web/actions/runs/34717122751) passed on `0775e4d`, including build and TV packaging. All 40 unit tests across API, remote input, Guide, text entry and player adapters/controllers passed, along with TypeScript and the 40-test browser suite without retries. The initial-focus/OK race was reproduced and corrected before this run; direct/managed player controls also passed five consecutive focused runs (15/15).

The local candidate above also passed `npm test` (40 tests), `npx tsc --noEmit`, and the one-worker browser suite before publication. These browser tests run the Vizio HTML-media boundary in Chromium. Tizen cases that require AVPlay or a physical remote stay explicitly skipped; neither result proves physical device decoding or remote behavior.

No entry above establishes 100% device coverage. Remaining scenario gaps are tracked in [tests/PARITY_MATRIX.md](tests/PARITY_MATRIX.md).

## Low-memory order

Run one command at a time after confirming the server is stable. Keep browser workers at one and do not run a production build alongside Rust tests or Playwright.

```sh
# API boundary only
NODE_OPTIONS=--max-old-space-size=256 npm run test -- --run tests/api/client.test.ts

# Static type check only
NODE_OPTIONS=--max-old-space-size=256 npx tsc --noEmit

# One browser project at a time; this starts a single Vite server and one worker
NODE_OPTIONS=--max-old-space-size=256 npx playwright test --project=tizen --workers=1
NODE_OPTIONS=--max-old-space-size=256 npx playwright test --project=vizio --workers=1
```

Run the backend route tests separately in the backend checkout with the configured Rust environment:

```sh
cd ../backend/server
CARGO_BUILD_JOBS=1 cargo test --locked --test dashboard_routes tv_bundle_has_its_own_same_origin_mount_without_replacing_dashboard_or_api -- --nocapture
```

Only then run a production build or package candidate, one at a time:

```sh
NODE_OPTIONS=--max-old-space-size=256 npm run build
npm run package:tv
```

## Shared UX acceptance

Run each item on both `?platform=tizen` and `?platform=vizio` in the hosted `/tv/` application.

- Pair a fresh device. Confirm the QR/code screen expires, Retry replaces it, approval reaches profile selection, and Sign out clears the local device session.
- Select, add, edit, page, manage and delete a profile. Confirm the parent-PIN prompt appears only when the backend requires it and a cancelled PIN returns focus to the prior action.
- Navigate Home, Discover, My List, Search, Live TV and Settings using directional keys. Confirm focus is visible, restored after overlays, and Back follows the prior screen rather than losing selection.
- Verify every card’s primary action opens details, and its 700 ms hold opens management. Check Resume, Choose source, watched/unwatched, queue hide and undo against the selected profile.
- Search with the remote keyboard; change the text before a delayed response returns and confirm stale results do not replace the latest result.
- Open a series, choose an episode and select an explicit source. Verify source picking never silently substitutes another ordinary source.
- Resume an ordinary VOD item only when the server-provided source identity matches. If it no longer matches, present source choice instead of guessing.
- Check the guide’s channel action, current/future program action, hold details, paging, Now action, collection filters and focus when a page changes.
- On a completed series, verify manual Next finds the next episode and honors Roku continuation policy: same IPTV account only; add-on sources ranked by capability/audio match with stable discovery-order ties.
- Toggle Autoplay next episode and confirm only the enabled setting starts the resolved next episode only in eligible final-ten-second playback or completion. Confirm unavailable/upcoming/caught-up states keep the outgoing session and explain the choice.
- Seek a direct session and a managed session. A managed seek must replace the server playback session at the requested title position, not merely seek within the old manifest.
- Change audio and subtitle tracks on direct and managed sessions. Managed changes must replace the server session; the visible selection must reflect the new delivery.
- Verify heartbeat/progress during playback, final progress on exit, clean backend stop, overlay timeout, remote rewind/fast-forward commit delay, and Back/Exit behavior.

## Device-specific evidence

On Tizen, verify the signed launcher opens the configured HTTPS `/tv/?platform=tizen` URL, AVPlay availability, adaptive playback, Back mapping, and native audio/subtitle behavior. Record model, firmware, stream type and result.

On Vizio, deploy the bundle at the API’s same HTTPS `/tv/` origin. Verify application load, remote mapping, media capability fallback, playback of direct and managed sessions, and Back/Exit behavior. Record model, firmware, stream type and result.

For both devices, verify a bad/add-on response never exposes upstream URL, headers, cookies or tokens in UI, logs or persisted browser storage.

The subsequent acceptance pass includes parent-gated profile selection/sign-out, partial search result retention, empty source-filter focus, full source details, and add-on install/enable/remove. Sign-out denial or network failure preserves the stored device grant. Canonical Browse heading/filter/grid positions are asserted at y=54/178/248. CI now runs automatically on main pushes and pull requests; manual dispatch also runs browser acceptance by default.

The queue restart follow-up passed the full suite with retries disabled (37 passed, 25 platform exclusions). Delayed screen/modal focus could steal an OK release or select a different track. Focus now settles before paint; the three player-remote cases passed five consecutive runs (15/15), followed by the full suite without retries. Hosted run 34715561355 at a3ca33c was green but contained one retry; use the later clean evidence when evaluating this fix.

The later source-recovery pass passed 40 browser tests (28 platform exclusions) with retries disabled. It adds same-IPTV-account Next, three-distinct-source attempt bounds, and explicit Resume failure recovery through exact Retry or manual source choice at the retained position.

Hosted validation [34721070923](https://github.com/viptv-org/tv-web/actions/runs/34721070923) passed on `09de6a4ad0302246a1b6b28e290795d1821483bd` without retries. It ran 40 unit tests (6 files), TypeScript/build, TV packaging, and the complete one-worker all-platform Playwright collection: 76 cases total, 44 passed and 32 intentional platform skips. This revision adds three held-action scopes: a queue-backed non-live hero opens Manage; a resumable non-queue hero opens explicit source selection; and a held non-queue Home card follows ordinary selection. It remains browser evidence only; physical Tizen and Vizio qualification is still pending.

Hosted validation [34721285708](https://github.com/viptv-org/tv-web/actions/runs/34721285708) passed on `7c9aba69f8e752d0e748f3bc7f70c6584a546edc` without retries. It ran the same build and packaging checks with 40 unit tests and 78 all-platform browser cases: 45 passed and 33 intentional platform skips. The added regression proves a held unselected series hero opens episode detail, never a source list. Physical Tizen and Vizio qualification remains pending.

## Browser codec / proxy checkpoint — 2026-09-13

Design: `fbafe1124fc8d9c2dc8a8c2c3c321b7aa856a937` (`BROWSER_PLAYBACK.md`).

- Unit suite: 56 passed, including runtime MIME/MediaCapabilities evidence, unsupported transports, HLS resource/session isolation, cleanup, and cancellation before a backend session. API transport serialization assertion also passed in the final focused API run (20 tests).
- Typecheck, design integrity and Tizen/Vizio packaging passed. Vite reports a large bundle warning after adding hls.js; this is not a build failure.
- Final complete Chromium suite: 51 passed, 35 intentionally skipped across two platform projects (86 collected), one worker. Real synthetic H.264/AAC HLS decoded through both the browser-selected native path and forced hls.js/MSE; decoded frames, pause, seek, resume, cleanup and same-origin playlist/segment requests passed. The MSE test suppresses only that video's native HLS hint; decoding remains real.
- Synthetic UI fixtures explicitly simulate native HLS and are not codec evidence. Earlier failures were an overlapping Playwright artifact-directory race and a test assumption that Chromium lacked native HLS; the final isolated run passed.
- No emulator, real Tizen/Vizio TV, HEVC hardware matrix, production deployment, or protected provider stream was exercised. Runtime probes are bounded capability evidence, not a guarantee for every file/profile/firmware.

## Crux adoption and reported TV failures — 2026-09-13

Design pin12e2a3a2a4ac62310c0597f4e08257e7d9c87300; core adoption recorded in CORE_REF. Identity/profile/catalog/media/source/playback normalization uses the real Rust WASM artifact; domain types derive from generated wire.ts.

Final complete Chromium suite55passed/35intentional platform skips (90collected), one worker. Real nativeHLS and forcedMSE decoding/pause/seek/resume pass. New regressions confirm remembered-profile restoration without pairing flash on reload and concentric profile-image/focus-outline geometry at1280×720 and1920×1080. Avatar displacement reported by the owner was not reproduced in these measurements; no speculative CSS patch was applied.

Unit suite62passed against actualWASM; runtime TypeScript tests9passed; core Rust14contracts and3sharednative/WASM startupvectors pass. Fixed failures discovered in final validation: optional catalog errors now retain a sanitized message while other shelves continue; parent series metadata replaces outgoing episode fields on return, retaining season selection.

Playback has one bounded same-source direct-to-managed retry for preparation and later decoder rejection, with stale error checks, position/pause preservation and Stop cancellation. This is not evidence that the owner's exact live stream is qualified. Production backend and household accounts/providers/history were not modified. No emulator, realAndroid/Tizen/Vizio or installedTauri tests performed. Remaining all-platform extraction is recorded in core/README.md.

Final packaging/typecheck and immutable core/design integrity checks passed. Live LAN preview loaded WASM with HTTP200 and completed pairing initiation with HTTP200 and no page errors; no account was approved or selected by this check.

## Responsive viewing client — 2026-09-13

See RESPONSIVE_VALIDATION.md and issue #3 for current immutable pins and results. Production build, strict application/test type checks, 72-test unit batch, five-test Guide follow-up, 60-scenario browser batch and five-scenario final responsive subset passed. Platform-specific duplicate browser exclusions are recorded separately from executed tests. Default browser now uses real responsive presentation; explicit TV platforms retain their prior renderer. Native Tauri packaging/SmartCast hardware and a public Vizio receiver remain unverified/unconfigured.

## Populated responsive correction — RUI-022

DESIGN_REF now pins502dcb5. The prior sparse layout tests missed internal fixed-root overflow:24 cards produced a5952×3348 phone hero. Current checks measure the application scroller and decoded imagery with full shelves at seven widths. Build,73 unit/controller tests,14 distinct responsive scenarios and4 explicit TV geometry/profile regressions pass across final runs. See RESPONSIVE_VALIDATION.md for detailed evidence, private visual review and live preview checks.

## 2026-09-14 owner-reported responsive correction

See RESPONSIVE_VALIDATION.md for the current evidence and earlier false coverage limits. New tests cover the complete shared card projection, metadata hydration without identity mutation, exact episode artwork, live logo containment, mobile lower-shelf focus, OLED Settings and real browser history. Actual upstream live and VOD adapter playback is verified separately from fixture UI tests.

## RUI-024 mobile focus styling

Mobile retains selected navigation surfaces without white focus outlines, inverted controls or bright card/profile focus frames. Desktop keyboard and TV remote focus remain. Production build and18 responsive browser cases passed, including focused Home/Settings, cards, profiles and actions, plus desktop keyboard focus preservation.

## RUI-025 pointer-first desktop/mobile web

Supersedes desktop focus styling in RUI-024: every responsive viewport uses neutral focus appearance and selected destination surfaces. Automatic navigation/card focus and TV spatial/hold/media key handling are disabled in responsive mode. Native browser input/dialog semantics and Escape remain. Production build,22 responsive/history browser cases and4 remote-input unit tests passed, including TV700ms hold preservation.

## RUI-026 — artwork failures, dialog backdrops and source loading (2026-09-14)

Design `58cc091b797b385dd44c8586455578973577c390`; shared core `b374711cc0af768572d7065744bb609cd5a5c6a8`. Card image transport retries its original URL if the resize derivative fails, then reports failed originals to Rust `cardPresentation.failedImages`. Rust selects the next permitted role; Continue Watching never substitutes a portrait for a failed episode still. Dialog backdrop dismissal uses existing cancel paths; profile PIN work is aborted on cancellation. Source discovery now has one in-row indicator; removed the absolutely positioned empty-state duplicate that could overlap navigation.

Final browser batch: 26 responsive/history/artwork/loading scenarios, 2 responsive profile/text-backdrop scenarios and 28 TV-shell scenarios passed, with 12 existing platform-specific TV-shell skips. Phone/desktop image tests return 404 for episode stills and confirm the shared landscape loads; dialog tests cover inside/outside clicks and unsaved draft cancellation. Spinner regression failed on both widths before the fix; corrected indicator remains in its status row across animation phases. Unit suite: 87 passed, including drag-out and late parent-authorization cancellation. Core's separate native 41 tests and WASM failure-policy regression passed. Device qualification and a new authenticated Bleach-origin check are not implied by fixture acceptance. No emulator, account/provider migration or Roku runtime change.

Final production build passed: design/core snapshot integrity, grouped strict TypeScript checks and Vite bundle. These checks are browser/source evidence, not physical playback certification.


## RUI-027 — responsive playback, guide, catalog and sign-in (2026-09-14)

Design f8ca89d2c3d039fa4b6b51bd095131aa9e870374; shared core a8ece4f10576b7ea72b6f2cf6c52ae7dd13dffe7. Final app unit suite: 117 tests across 19 files passed. Production build, grouped strict TypeScript, design/core integrity passed with the build's 384 MB Node heap. The final design-only documentation-link update also passed integrity checks.

Full one-worker browser batch: 100 passed, 59 intentional platform skips, one remote-player fixture failure. That fixture claimed successful playback with zero decoded dimensions, triggering the new first-frame recovery. Correcting its mocked video dimensions made all four affected remote-player cases pass (four platform skips); no production guard was weakened. This provides passing coverage for all 101 executable scenarios across the full run and focused rerun, rather than claiming a single clean full-suite run. Responsive assertions cover fullscreen, volume/mute, truthful playback diagnostics, centered sign-in, category selection, sticky channel/time axes, horizontal/vertical guide scrolling, independent Discover loading and custom addon namespaces. Native window fullscreen and external-browser approval are tested at the Tauri API boundary.

Real media was checked separately using temporary authorized sessions, which were stopped and signed out afterward. Cartoon Network decoded through MediaBunny to a changing 1920×1080 canvas with AAC audio and advancing time. The backend independently selected video/audio encoding; the client did not force transcoding. Project Hail Mary exercised a MediaBunny decode failure and successful same-session HLS.js fallback at 1920×1080, including pause/seek/resume. A byte-range Sintel MP4 fixture decoded through MediaBunny at 854×480 with start position, pause, seek, resume and volume/unmute checks. These samples do not establish universal codec compatibility.

MediaBunny requires secure-context WebCodecs; plain LAN HTTP can use the native/HLS.js fallback and reports that fact. Physical Tizen/Vizio qualification and installed Tauri packaging remain outstanding. Android consumed the same core pin; hosted Android validation run 34805828787 succeeded. No emulator or local Gradle was started. Core's separate 43 native tests passed; the account website's 95 unit tests and production build passed.

Real LAN sign-in also passed: login HTTP200 → CSRF device approval HTTP200 → device token HTTP200 → profile picker. At 390×844 and 1440×900, form centering error was zero in both axes with no overflow; cards measured 350×609.5 and 440×644 respectively. The password was absent from durable browser storage and removed from the form after success. Both temporary cookie and bearer sessions were signed out (HTTP200); no profile was selected and no history changed.


## RUI-028 — owner-directed responsive guide and browse layout (2026-09-14)

Design `b4c20fea6e97e90c74fbf7f8e5691787b34e3a2a` (RUI-028); shared core unchanged at `a8ece4f10576b7ea72b6f2cf6c52ae7dd13dffe7`. The owner reviewed the running responsive client and directed four corrections. Data, playback, source-selection and focus semantics are unchanged.

- **Live TV is one page row.** The separate `.epg-toolbar` is gone: the eyebrow/heading, the active channel filter with its date and timezone, the Live TV search field, Earlier/Now/Later and the schedule scroll instruction share one heading row. Below it the category sidebar and the guide box form one row with `align-items: stretch` and one shared height token. Measured at 1440×900: heading band y116–210 as a single row; sidebar 216×500 at x40 and guide 1120×500 at x280 — same top edge, same height, both ending on the 1400px frame edge, with the channel paging footer spanning the frame beneath them. At 1024×900 the header wraps to two rows and the columns measure 216×500 and 704×500.
- **Browse routes no longer cross-link.** Search no longer offers Discover and Discover no longer offers Search. Discover had been hidden from the phone bottom navigation below 600px, so that switch was the only phone route to the page; Discover now remains in the phone navigation.
- **No leading Back control in the shared header.** Detail, sources and profile screens keep brand, navigation, Watch on TV and profile. Browser Back, gesture and history still return, covered by the new `page.goBack()` case.
- **One card presentation for browse results.** Fixed 256px columns that ended 258px short of the 1440px frame edge, and one full-width card per phone screen, are both replaced. Columns now resolve from the frame width: 5 columns of 252.8px at 1440 (x40→1400 exactly) and 6 columns of 250px at 2560 (x470→2090 exactly), while 390px uses Home-style 232px tiles on one horizontally scrolling row (scrollWidth 5948 against a 358px client width). Search results are per-catalog sections and keep Home's shelf presentation, ending on the frame edge at 1440.
- **Tablet sidebar/guide swap fixed.** Header-only navigation wrapping is now scoped to `.responsive-toolbar nav`. The previous unscoped `nav { order: 2 }` also matched the guide's `<nav class="epg-categories">` as a grid item and moved the sidebar into the guide's column at 900–999px; at 900px the sidebar previously rendered at x280 with a 580px width while the guide sat at x40 with 216px.

- **The guide has no channel paging controls.** `Previous channels` and `Next channels` are removed from the responsive guide; the sidebar narrows channels, and reaching the end of the loaded rows loads the next 40-channel API page inside the same scroll. The footer keeps a text status only (`40 of 88 channels`). A new case pages 88 fixture channels through 40 → 80 → 88 rows by scrolling alone. The schedule cache grew to 200 entries so an appended page cannot evict the schedules of the rows above it; TV remote paging is unchanged.
- **Route changes no longer move the frame or the header.** The application scroller keeps a permanent vertical scrollbar slot (`overflow-y: scroll`), so Home (2147px tall) and Search or Live TV (900px, exactly the viewport) cannot differ in content width; the guide timeline scroller does the same for categories whose row count crosses the guide height. Headers and content stay on identical coordinates across Home, Discover, Search, Live TV and My List at 390, 900 and 1440px, and overlay-scrollbar platforms (this suite's Chromium, phones, tablets) lose no width for the slot. The header's profile control is a fixed slot (144px at ≥900px, 48px below), removing a measured 56px reflow of the Watch-on-TV action while the profile avatar and the chosen-screen toolbar settle.

Validation: 117 unit tests across 19 files passed; the full one-worker browser batch passed 111 cases with 59 intentional platform skips, including the new `tests/e2e/responsive-layout.spec.ts` (guide row/equality at 390 and 1440, browse frame fill at 390 and 1440, and the header/detail/sources/profile control check). Hosted validation for this revision: TV candidate validation run 34820428098 passed. Production build, grouped strict TypeScript, design-snapshot and core integrity checks passed locally with the build's 384MB Node heap. These are browser and fixture measurements: physical Tizen/Vizio qualification, matched real-content comparison and installed Tauri packaging remain unverified. No backend, account, provider, history, volume or Roku runtime change was made.

## RUI-029 — timeline duration and preparation recovery (2026-09-14)

Design `8f6419fc67d50f8d46e205b1643067fdd15a946a`; shared core unchanged. The owner reported that the browser's seek bar showed a length that kept growing, "as if it's showing only the transcoding progress duration", and one source that failed with the generic *VIPTV could not complete that request*.

**Cause.** Every managed server delivery is a rolling HLS window (`-hls_list_size` plus `delete_segments`), so the media engine's duration describes only the produced part; the browser adapter published exactly that value as the title length. The Roku player never does: it keeps the session/item duration and, for direct playback only, lets the engine raise it (`MainScene.brs`: `if m.playbackMode = "direct" and m.video.duration > 0 ...`). The failing source matched the single backend warning in the same window: `Source probe failed category=InvalidJson`, i.e. a preparation refusal (the route maps preparation errors to HTTP 400, which the client renders as the generic message).

**Implementation.** `OpenPlayerRequest` gained `timelineDurationSeconds` (the server's inspected source length) and `adoptEngineDuration` (true only for original-file delivery). One shared `timelineDuration`/`growOnlyDuration` rule serves the HTML, AVPlay and MediaBunny adapters: the server total is authoritative, only a direct file may raise it, and the reported length never shrinks. Live still reports no duration. `PlaybackSessionController.start` now answers a refused preparation with the next rung of the same source (managed output, then forced transcode) and never retries authorization, expiry, cancellation, capacity or out-of-range-position refusals. Server-side, an unreadable or over-budget ffprobe response earns one reduced-entry inspection (`InvalidJson`/`OversizedOutput`) before the source is refused.

**Evidence.** New unit coverage: a managed session whose engine reports a 32s window keeps reporting the 5400s title length while the window grows to 96s; a direct file adopts a longer intrinsic length and never falls below the server total; a 400 preparation refusal escalates to `managedOnly` then `managedOnly + forceTranscode`; 401/403/404/409/429 refuse exactly once. Backend: 179 lib tests passed with the new reduced-probe case and the updated bounded-attempt table (malformed or oversized stdout now costs exactly two attempts), strict Clippy clean. Web: build, 121 unit tests and 115 browser cases passed (59 intentional platform skips). The production server still runs the pre-split monorepo image, so the inspection fallback is not live until that backend is deployed; the client rule is live wherever this bundle is served.

## Organization cleanup — 2026-09-14 (56f5294)

Whole-repository cleanup under the organization plan (`viptv-org/.github CLEANUP_PLAN.md`): zero behaviour change, pinned paths untouched, one commit.

What changed: dead code found by `noUnusedLocals`/`noUnusedParameters` (MediaBunny's unused duration helpers and field, App.tsx's unused guide state and a controller subscription whose value nothing read, three unused API type imports, an unnecessary React import); duplication merged (`boundedPosition` now exists once in the player contract module, `activeSessionOrThrow` moved onto the shared `SessionPlayer` base class, `tests/api/client.test.ts` gained one `apiFor()` builder replacing 20 hand-written constructions and one shared token fixture, removing ~50 test lines). Net source+test delta: +68/-104.

A real defect surfaced while removing the dead imports: MediaBunny still published the produced rolling window as the title duration, so the RUI-029 rule had never actually reached that adapter. It is fixed and covered by a new managed-window case.

Evidence: 122 unit tests and 115 browser cases passed with 59 intentional platform skips; production build, strict TypeScript and design/core integrity passed. No test was deleted or weakened. `design-contract/`, `vendor/core/`, packaged assets and `dist/` were not touched.



## Playback consolidation — 2026-09-17 (ADR 0003)

The whole player stack moved to the sibling `viptv-org/video` repository (design ADR 0003) and is consumed as `@viptv/video` via `file:../video` (package 0.4.0, commit `5fb3940`). `src/player/` and its 8 test files (77 tests) moved with the code; tv-web keeps the UI, API and e2e suites. `exactResumeSource` — the core-owned resume rule — now lives in `src/ui/continuation.ts` with its assertions in `tests/ui/continuation.test.ts`; the playback contract types (`DirectFileCapabilities`, `PlaybackCapabilities`, `PlaybackStart`) re-export from the package in `src/api/types.ts`. The e2e decoder specs import the real adapter from the package's dev-server module URL (`/@fs/mnt/ALPH/code/viptv-org/video/dist-js/index.js`), verified served and transformed by the dev server.

Verification: grouped strict typecheck passed (application, tests/api, tests/e2e, tests/fixtures, tests/ui); 14 test files / 86 tests passed on one worker with a 256MB heap; production build passed (`vite build`, 2.05s) with the 384MB heap. The e2e decoder spec itself was not executed this round (no browser run against the running stack); its module URL was verified transformed, and the suite's browser qualification evidence is otherwise unchanged.

## Local addon mode — 2026-09-21 (design 329d792)

Implements LOCAL_MODE.md LM-001–LM-003 (status: proposed): account-free operation from an on-device addon registry. Local mode is a boot-level branch (`src/ui/LocalApp.tsx`) offered only in builds declaring `VITE_VIPTV_LOCAL_MODE=1`; the backend-hosted bundle renders no entry point. The registry (`src/local/registry.ts`, `viptv.local.registry.v1`, stable ordinals) and discovery client (`src/local/discovery.ts`) run the same shared provider negotiation/aggregation as the backend through the vendored core wasm (core `ace630e`), including genre/search/skip semantics, the 200-item cap, request validation copy and the unsupported-media-type error.

**Implemented:** sign-in entry ("Use without an account" with the focused privacy copy, responsive and TV pairing screens), local Home shelves per enabled catalog, catalog browse with declared genre/search filters and raw-page-length pagination, addon install/remove/enable management with the design's copy, confirmation dialog and focus return, exit to account sign-in, and empty/error states.

**Explicitly not implemented in this revision:** local playback (LM-004) — no stream discovery or player wiring exists in local mode, so browse cards are non-interactive; TV spatial-remote focus for the local shell (DOM/keyboard order only); local detail screens. These are recorded gaps, not claims.

**Evidence:** 141 vitest cases passed (20 new local data-layer tests, 8 LocalApp component tests, 1 sign-in entry test) against the real vendored wasm; production build with design/core/video integrity checks passed; a headless-Chromium script (VITE flag on, manifest/catalog routes mocked, backend aborted) verified entry → empty state → install → shelves → browse + genre filter → exit with no page errors. Physical TV, Tauri packaging and real addon hosts remain unverified; browser CORS governs which addon hosts a web fat build can reach (design LM-006).
# LightningJS TV-only migration checkpoint — 2026-09-24

## Profile screen continuation

The staged Lightning entry now uses focused Blits profile-tile components
with real `/api/auth/me` data, packaged avatar images, a letter fallback,
the Manage/Done control and a 700 ms hold that suppresses release selection.
The profile fixture verified Right then Enter selects profile 2, including
the rapid key sequence before Blits paints the new focus. Down then Enter
enters Manage, and held Enter does not select a profile. A 1920×1080
`TvProfiles` capture versus the unchanged React TV baseline has 292,096
changed pixels (14.0864%), MAE 3.4131, RMSE 24.6169, SSIM 0.721367.
`TvProfilesManage` has 301,406 changed pixels (14.5354%), MAE 4.0433,
RMSE 26.802 and SSIM 0.684476. These are open visual failures against 1:1.
Profile editing, PIN, paging beyond the first five, Home interactions and downstream TV
screens remain to migrate; the current TV launcher has not switched.
The profile capture from the production `/tv/` preview matched the development
metric above. The existing React `TvPairing` and `TvProfiles` screens were
recaptured and each matched its saved baseline exactly on the final repeat.
Checkpoint checks: 169 unit tests passed; the targeted existing TV shell
Playwright suite passed 10 scenarios with 8 deliberate skips; the Lightning
pairing/profile/hold browser fixtures and production build passed.

## Home data/render continuation

After a profile is selected, the staged Lightning entry now loads its queue,
catalogs, recent live channels and hero metadata through the shared API and
Rust presentation functions. It renders the real hero image/logo, progress,
synopsis, first Continue Watching shelf and collapsed rail rather than the
previous placeholder. The `TvHome` fixture observed the profile queue request
and captured this state at 1920×1080. Compared with the saved React TV Home,
1,406,199 pixels differ (67.8144%), MAE 8.8849, RMSE 26.6207, SSIM
0.857713. The ambient backdrop, card typography/progress, and rail geometry
need further visual work. This is an incomplete screen, not a parity
pass or a launcher switch. Tizen, Vizio and webOS browser-configuration Home
captures were byte-equal under the same fixture; no physical TV run occurred.
Home now uses focused Blits components for its three hero actions and first
queue shelf. The fixture's rapid Right+Right+Enter activated the shared My
List API, Down/Right visibly moved focus to the second card, and a 750 ms
held OK suppressed release activation. Play, Details, card routes, the
remaining shelves and rail navigation are still pending.
The same rapid My List activation and directional-focus fixture passed on
the production `/tv/` preview bundle; its initial Home pixel metric was
unchanged from the dev capture.
Final checkpoint checks: 169/169 unit tests, 24 targeted responsive/TV
Playwright passes with 10 deliberate skips, and the production build passed.
The existing React `TvHome` recapture still had zero changed pixels against
its saved baseline.

## Title route continuation

The staged Lightning Home Details action and Continue Watching cards now open
title pages from the selected item through the shared detail API. Series
progress is merged through the pinned Rust core before choosing the initial
episode. The title has Blits-focused actions and episode tiles. The browser
fixture confirmed Home Details → series title, Back restoring Details focus,
and the second queue card → its movie title → Back restoring that card's
focus; the title My List action reached
the shared API. An opt-in focus marker made the D-pad/Back assertions wait for
actual Blits component focus instead of an arbitrary delay.

The 1920×1080 Lightning `TvTitle` capture against matched React content has
1,474,821 changed pixels (71.1237%), MAE 8.2731, RMSE 27.3696, SSIM
0.793883. The ambient backdrop, source pill, focus shadow, episode details
and typography remain open visual differences. Full playback controls, More info and full
episode activation still need their intended flows;
the visible staged controls do not qualify those behaviors or a TV launcher.
The production `/tv/` preview reproduced the Title capture and metric, and
the existing React `TvTitle` recapture had zero changed pixels. At
this checkpoint 169/169 unit tests passed; targeted responsive-layout and TV
shell Playwright acceptance passed 24 scenarios with 10 deliberate skips;
design/core/video checks, TypeScript and production build passed.

## Source panel continuation

The title's Play and Choose source actions now preserve distinct Resume intent
and open a Lightning source panel. Discovery uses `TvApi.sources()` plus
`pollSourcesStep()` so the pinned Rust reducer owns cursor, deduplication and
completion. Blits components own focus for quality chips, provider choices,
source rows and the source-details Close button. Browser fixtures verified
12 normalized sources, choosing source 2 with its original item ID and
position, paging to source 7, 4K empty → 1080p filtering, a LordStreams
provider filter with three rows, Back restoring the title's source focus, and
no further poll after close. Play carried `resume=true`; Choose source carried
`resume=false`. Holding OK for 750 ms opened source details and suppressed
row activation on release. Tizen, Vizio and webOS browser-configuration
`TvSources` captures were byte-equal under the same fixture.

At 1920×1080, matched-content Lightning versus React measurements remain
open failures: `TvSources` 1,525,612 changed pixels (73.5731%), MAE 5.7584,
RMSE 22.7721, SSIM 0.887465; `TvSourceProvider` 1,267,892 changed pixels
(61.1445%), MAE 6.2317, RMSE 22.8690, SSIM 0.847848;
`TvSourceDetails` 184,921 changed pixels (8.9179%), MAE 2.4859, RMSE
20.9487, SSIM 0.627974. Background ambience, text metrics, panel/footer
geometry and focus shadows need correction. Source selection now passes the
exact intent to the pinned playback controller in the staged UI. Physical TV
input/decoder behavior and the TV launcher remain unqualified.
The staged panel currently mounts five quality chips and six provider-choice
slots; additional custom qualities/providers still need navigable overflow.
The production `/tv/` preview reproduced all three source-state captures and
their pixel metrics. The unchanged React `TvSources` recapture had zero
changed pixels. Checkpoint validation passed 169/169 unit tests, 24 targeted
responsive/TV Playwright scenarios with 10 deliberate skips, and the
design/core/video integrity, TypeScript and production-build checks.

## Player transport and overlay continuation

The staged Lightning entry now gives the pinned `@viptv/video` package the
explicit selected source and resume position. Its session controller starts
the backend delivery, opens the existing platform adapter, and preserves
source addon/fingerprint fields for progress saves. Vizio and staged webOS
browser paths render the media element beneath the transparent Lightning
canvas; Tizen uses AVPlay, whose browser stub advances state but paints no
video frame. A host CSS shade uses the design tokens so the video remains
visible behind Blits controls. WebOS currently uses the shared HTML fallback
profile rather than a dedicated device-qualified adapter.

The browser fixture verified a backend playback session, Pause, a relative
seek, seek-preview Back cancellation, Enter seek commit, first Back hiding
controls, second Back stopping the session and saving progress. Play with no
saved source fingerprint did not pick a lookalike stream automatically;
manual source selection preserved its ID and Resume intent. All three browser
platform configurations passed these transport-state checks. These are
mocked media/AVPlay boundaries, not physical codec, DRM or video-layer proof.

Matched Vizio-browser captures at 1920×1080 still fail the exact visual gate:
`TvPlayer` has 94,978 changed pixels (4.5803%), MAE 3.2571, RMSE 24.6134,
SSIM 0.753696; `TvPlayerSeek` has 114,621 changed pixels (5.5276%), MAE
3.4487, RMSE 24.7832, SSIM 0.737013. Control icon/text rasterization,
seek bubble/ring and placement remain open. Full track-panel paging, Next,
player error/recovery, live and DVR behavior, and real Tizen/Vizio/webOS
decoder/layering qualification remain incomplete; the TV launchers stay on
the React path.

## Audio/subtitle track continuation

The staged player now opens a Blits right panel focused on the current audio
or subtitle track. It uses the pinned video controller's direct/native track
when available, otherwise the server session's track list and managed
`replaceTracks` path. Subtitles Off follows the same native-versus-managed
rule as React. Browser fixtures on Tizen, Vizio and staged webOS verified
current-track focus, Back returning to the originating control, an
unavailable PGS choice staying open without a playback replacement, and
managed replacements for Subtitles Off and English Stereo audio. The UI
snapshot of the Vizio subtitle panel matched the fixture content but still
had 380,929 changed pixels (18.3704%), MAE 3.7155, RMSE 21.8704 and SSIM
0.862725 against React at 1920×1080. Panel typography, ring and footer
remain open deviations. The staged panel mounts eight track rows; longer
lists still need focusable paging and real-device track qualification.
The production `/tv/` preview reproduced the subtitle-panel capture and
metric. After this change, 169/169 unit tests, 24 targeted responsive/TV
Playwright scenarios (10 deliberate skips), and the production build passed.
Phone `Main` and desktop `DeskHome` recaptures remained pixel-identical to
the isolated pre-player baseline (0 changed pixels each).

The phone `Main` (390×844) and desktop `DeskHome` (1440×900) React captures
were compared against an isolated tv-web `de6adc1` checkout from before the
player wiring. Both had zero changed pixels, MAE/RMSE 0 and SSIM 1. The
temporary checkout was removed; screenshots remain under ignored test output.
The production `/tv/` preview repeated the Vizio Player/Seek fixture and
matched the dev pixel metrics. Final checkpoint checks passed 169/169 unit
tests, 24 targeted responsive/TV Playwright scenarios (10 deliberate skips),
and design/core/video integrity, TypeScript and production build.

Design pin `aa2a1d69935fc07a97bd37d5fa0f78ab8d1c7b47`. A separate
`lightning.html` entry now builds with LightningJS Blits 2.10 and the shared
`TvApi`/Rust session driver. Its first real screen requests a device code,
renders the address/code/QR, expires the code, and retries on Enter release.
`node tests/preview/lightning-shoot.mjs TvPairing` and the Loading/Expired
variants used the same mock backend as the React TV captures at 1920×1080.
Tizen, Vizio and webOS browser-configuration pairing captures were byte-equal;
the expired run verified a second pairing request after Enter. The existing
React TV pairing capture remained pixel-identical to its saved baseline after
the separate entry and build plugin were added.

The current Lightning `TvPairing` screenshot versus that React baseline has
331,807 changed pixels (16.0015%), MAE 3.7149, RMSE 25.1868 and SSIM
0.911408. The metric is an open failure against the requested 1:1 target,
not a parity claim. Text rasterization/weight, focus shadow, QR edges and
spacing remain visibly different. The screenshots and amplified diff are in
ignored `test-results/preview/`. Profile and Home currently have staging
placeholders; no other TV screen, D-pad flow, media adapter or webOS host is
migrated. Production Tizen/Vizio launchers and responsive web/Tauri still use
their existing entry. No Lightning run has been made on physical TV hardware.
Checkpoint validation: 169/169 Vitest tests passed, 127 Playwright scenarios
passed with 75 deliberate platform skips, and the production build passed its
design/core/video integrity and TypeScript checks. These existing suites cover
the unchanged entry; the new pairing fixture checks are browser-only.
The production bundle's separate `/tv/lightning.html` entry was also served
through Vite preview with base `/tv/`; it rendered the same pixel metric as
the dev capture. This does not mean the public site or TV package uses it.
# Lightning TV Live guide — 2026-09-24

The staged Blits Live rail destination now loads shared live categories, channels,
and schedules. It renders five channel rows and guide cells using the React
guide's shared window/cell calculations, shows the selected programme and
live-preview placeholder, opens a programme-details panel on held OK, and opens
sources for a current programme while future OK opens details. Browser fixtures
checked D-pad row/filter navigation, News category requests, programme focus
restoration, the 700 ms hold, details Back/Close, and a full-screen Live search
entry whose Done action sends the trimmed query to `/api/live`. The route also
supports hour-window navigation and 40-channel page requests; long real-world
channel lists and physical remote keys remain unqualified. Current-programme
Watch goes through the staged source picker, which differs from React's direct
play action. Physical typing preserves the query, but its focused keyboard key
does not consistently retain the white focus decoration after the text redraw.

Matched 1920×1080 React comparison remains open: `TvLive` changed 561,727
pixels (27.0895%), MAE 4.3172, RMSE 23.3649, SSIM 0.908843;
`TvLiveDetails` changed 1,235,755 (59.5947%), MAE 5.0488, RMSE 21.4385,
SSIM 0.877160; `TvLiveSearch` changed 144,918 (6.9887%), MAE 1.7969,
RMSE 14.4489, SSIM 0.824780. The previous larger changed-pixel figures used
the comparator's default design WebP and were incorrectly labelled React.
These are development measurements, not parity
acceptance. All three Blits frames were byte-equal across Tizen, Vizio, and
webOS browser modes. No physical TV run or launcher switch was made.

`npm run build`, all 169 unit tests, and the responsive/TV-shell Playwright
suite (24 pass, 10 expected skips) passed. Matched phone `Main` and desktop
`DeskHome` React frames were pixel-exact against the saved pre-migration
captures after a deterministic recapture (0 changed pixels each).
