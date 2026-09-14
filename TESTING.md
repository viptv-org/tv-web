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

Design `62988154c207b223741a8abfdda076edf3224481` (RUI-028); shared core unchanged at `a8ece4f10576b7ea72b6f2cf6c52ae7dd13dffe7`. The owner reviewed the running responsive client and directed four corrections. Data, playback, source-selection and focus semantics are unchanged.

- **Live TV is one page row.** The separate `.epg-toolbar` is gone: the eyebrow/heading, the active channel filter with its date and timezone, the Live TV search field, Earlier/Now/Later and the schedule scroll instruction share one heading row. Below it the category sidebar and the guide box form one row with `align-items: stretch` and one shared height token. Measured at 1440×900: heading band y116–210 as a single row; sidebar 216×500 at x40 and guide 1120×500 at x280 — same top edge, same height, both ending on the 1400px frame edge, with the channel paging footer spanning the frame beneath them. At 1024×900 the header wraps to two rows and the columns measure 216×500 and 704×500.
- **Browse routes no longer cross-link.** Search no longer offers Discover and Discover no longer offers Search. Discover had been hidden from the phone bottom navigation below 600px, so that switch was the only phone route to the page; Discover now remains in the phone navigation.
- **No leading Back control in the shared header.** Detail, sources and profile screens keep brand, navigation, Watch on TV and profile. Browser Back, gesture and history still return, covered by the new `page.goBack()` case.
- **One card presentation for browse results.** Fixed 256px columns that ended 258px short of the 1440px frame edge, and one full-width card per phone screen, are both replaced. Columns now resolve from the frame width: 5 columns of 252.8px at 1440 (x40→1400 exactly) and 6 columns of 250px at 2560 (x470→2090 exactly), while 390px uses Home-style 232px tiles on one horizontally scrolling row (scrollWidth 5948 against a 358px client width). Search results are per-catalog sections and keep Home's shelf presentation, ending on the frame edge at 1440.
- **Tablet sidebar/guide swap fixed.** Header-only navigation wrapping is now scoped to `.responsive-toolbar nav`. The previous unscoped `nav { order: 2 }` also matched the guide's `<nav class="epg-categories">` as a grid item and moved the sidebar into the guide's column at 900–999px; at 900px the sidebar previously rendered at x280 with a 580px width while the guide sat at x40 with 216px.

Validation: 117 unit tests across 19 files passed; the full one-worker browser batch passed 111 cases with 59 intentional platform skips, including the new `tests/e2e/responsive-layout.spec.ts` (guide row/equality at 390 and 1440, browse frame fill at 390 and 1440, and the header/detail/sources/profile control check). Hosted validation for this revision: TV candidate validation run 34820428098 passed. Production build, grouped strict TypeScript, design-snapshot and core integrity checks passed locally with the build's 384MB Node heap. These are browser and fixture measurements: physical Tizen/Vizio qualification, matched real-content comparison and installed Tauri packaging remain unverified. No backend, account, provider, history, volume or Roku runtime change was made.
