# Current delivery boundaries

| Area | Verified evidence | Limit |
| --- | --- | --- |
| Hosted beta | TV d559dbb/backend 8d995a5, healthy container, exact running binary and 41 served assets; configuration and root frontend preserved | One asset read needed a bounded retry; production unchanged |
| Home navigation and art | Remembered row index/scroll, isolated top navigation, recycled shelves, proxy blur, portrait spacing and prepared-logo paint pass; Nocturne inspected on physical Roku | Quantitative frame traces remain scoped to build 11128 and fail the 16.67 ms target |
| Sign-out and fresh-account handoff | 337 shared/50 native units; 11142 passes refreshed credentials, signed-out null and fresh login/media across three verified OS reboots, with exact prelaunch credential/settings checks; earlier 11131 covers real Search, paused seek and navigation | Physical Roku evidence is scoped to the tested device/OS; audible/lip-sync and physical caption presentation remain unqualified |
| Provider metadata | Live cold/warm/cross-account reuse; personal responses no-store and cross-profile requests refused | Samples do not establish universal upstream latency |
| Collision Course synopsis | Exact 2026 title's real Simkl payloads replay sparse catalogue → full detail → sparse refresh without losing text; other authority stays separate | Historical visual race not recaptured; no attribution to Simkl |
| PS4 session reliability | Rotated credentials adopted before persistence, durable-write retry and missing Web Locks/storage failure covered | Physical PlayStation logout retest unavailable; lost network responses and cross-window replay remain separate limits |
| Reproducible installation | Root npm and independent pinned Roku pnpm installs, committed renderer patches, hosting/webOS CI pass | Samsung signing certificates unavailable; no signed WGT claim |

Earlier source-specific records follow; their old hardware availability and deployment
statements do not replace the current qualification above.

# LG webOS and Samsung qualification

| Boundary | Browser / package evidence | Emulator / physical limits |
| --- | --- | --- |
| Shared host detection, numeric Back, legacy Search and media lifecycle |33 Chromium/Firefox/WebKit cases pass; explicit API/image origins covered by focused units | No physical LG/Samsung devices available |
| Samsung local package |43-file/8.6MiB verified local closure; two file-entry/SDK cases pass; signing/API-origin gates retained | No signed WGT, actual Samsung file-origin API transport or AVPlay decoding claim |
| LG webOS player | Official LG22 / Chromium 87: healthy WebGL, real 160×90 HLS 3.085 s / 77 frames, stable pause/paused seek/resume, WebVTT selection/Off, Back/Stop and all six lease releases pass; CLI3.2.6 IPK built/inspected | Owned software-graphics runner and synthetic media; physical codecs/audio/DRM/remote unqualified; read-only currentSrc retains stale metadata after otherwise complete reset |
| LG startup graphics | Directly observed context loss is recovered through a fresh Canvas host; visible Home/media plus nine ownership/two real context-loss browser cases pass | No shipped bitmap disable/UA exception; healthy-WebGL cue state and Canvas caption pixels verified separately; no comprehensive caption-paint or hardware claim |
| Live-empty / source-hint contracts | Focused cases pass with navigation by route identity and canonical provider fields; product assertions are retained | Browser evidence, not physical firmware qualification |

Detailed commands and disposition: [platform qualification](../platform/QUALIFICATION.md).

# Provider-first discovery

Core `1ea4de6`, SDK `4dd3a11`, backend `8b0293d`, design `059b763`.
Core/SDK/server checks and 18 three-engine source-reuse/override cases pass for preferred
supplier dispatch, language eligibility, deadline/fallback and durable device
settings. Real hosted beta validates CineWave first, no picker, confirmed English
and unchanged manual memory for a different movie and relaunched Continue Watching.
Admission takes 1.61–1.64 s; first-frame signals take 9.64–10.43 s. The full five-second
startup target remains unmet because of preparation/decode time after admission.
Inception exercises the five-second preferred deadline and successful fallback without
changing the saved preference. The managed beta release, 59 assets and Canvas pairing
are verified. Roku builds but the device is unreachable; physical PS4/Roku acceptance
is incomplete. No renderer-specific source-selection policy is introduced.

# Shared TV source reuse and episode handoff — 2026-11-08

| Surface | Browser execution | Roku evidence / limits |
| --- | --- | --- |
| Manual source memory, supplier/language matching and opt-in cross-show reuse | Rust policy/HTTP regressions; decoded HLS and durable storage across Chromium, Firefox and WebKit; selected delivery language wins over bilingual source metadata | Native registry/relaunch, English-only observation and actual CineWave reuse verified after beta backend 28818eb |
| Last-three-minute preparation and controlled Next | No extra admission, one cache consumption, expiry/cancellation, configuration fences and bounded startup fallback; preferred result does not wait for a stalled provider | Prepared successor observed on TV; manual Next starts episode 2 and end autoplay starts episode 3 without a source picker; native request counts unobserved |
| End-only autoplay and manual override | Ten-second countdown, input/Back cancellation, next-frame race fence, autoplay-off, 700 ms hold, hidden ended controls and fresh Media Play replay verified | Real episode end, ten-second packaged countdown, Right cancellation, Back dismissal and first-Select reveal verified; actual automatic successor playback verified after beta backend rollout |
| Standalone Intro/Recap | Valid markers only; paused seek and missing markers covered | Uses native TvView/TvText; physical marker action not newly qualified |
| Platform playback preservation | Existing Live, track, replacement, authorization and native-SDK boundary cases pass | Samsung/LG/Vizio physical qualification remains separate |
| High-rate CineWave continuity | Actual beta browser decoded 102 seconds with PCM after gateway rollout | Same previously failing source advances beyond 332 seconds with H.264/AAC; pause, paused seek and resume verified; whole-title continuity unqualified |
| Browser Canvas fallback and PS4 controls | 15 Canvas startup/media/layout/recovery cases plus three Cross-selection cases pass across Chromium, Firefox and WebKit; deployed asset hashes and actual beta sign-in checked | Owner confirms physical PS4 rendering and pairing; owner confirms physical navigation and Cross selection; physical media unqualified |
| Resume buffering and control inactivity | 54 Canvas/platform/recovery cases pass in three browser engines; real nonzero HLS Resume without repeated playing events clears Buffering, avoids another source attempt and hides controls; HTML/Tizen adapter regressions pass | Owner reports Torrentio playback on PS4; acceptance of these new recovery fixes on PS4 and other TV firmware pending |
| Source discovery while filtering | Late results append after viewer interaction, filtered focus retains stable identity and open filter options stay fixed; covered in all three engines | Physical discovery timing and filter focus pending |
| Native frame pacing | Browser simulation does not qualify native presentation | Final Home trace render plus swap p95 22.02 ms; 16.67 ms target remains unmet. Continuous JS, native Animation, minimal scene and system Home diagnostics report about 48 graphics FPS in this session; clean client restored |

Exact pins, commands, outcomes and remaining gates are recorded in [TESTING.md](../TESTING.md).
The sections below are historical checkpoints.

# SolidTV startup and loading acceptance

| Contract | Implementation / execution | Functional evidence | Visual evidence | Tizen | Vizio | webOS | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| First-load skeleton principle, startup recovery copy, TV 1920×1080; design `8b7f85941addf5a65390fe6eca4f11aba9584a17` | Application `4a6ba5e0c6624f70b7b789270b100a6897851869`, browser Vizio/public TV and direct SolidTV/legacy entries; [execution issue #78](https://github.com/viptv-org/tv-web/issues/78) | `remote/startup.spec.ts` and `remote/loading-navigation.spec.ts`: 26 passed, including Vizio/Tizen/webOS/native-host selection, delayed assets/data, remote recovery, history Back, cancellation and decoded HLS retry/controls. Eight existing billboard cases pass; selected wider navigation/source/player coverage is 68/69, with drawer timing tracked in [#79](https://github.com/viptv-org/tv-web/issues/79). ES2017 emitted-HTML build regression passes. Logs: `/tmp/viptv-78-es2017-browser-green.log`, `/tmp/viptv-78-es2017-loading.log`, `/tmp/viptv-78-final-browser.log` | Startup card bounds/fill asserted; private startup/recovery/first-frame/settled Home captures inspected at 1920×1080. Full-reference metric unmeasured | Hardware unverified | Hardware unverified | Hardware unverified | Verified for the stated startup/loading browser and fixture-media scope; wider drawer timing unresolved |

# Home featured-pass acceptance

| Contract | Implementation / execution | Functional evidence | Visual evidence | Tizen | Vizio | webOS | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Tv3Home, TV_SERVER_WRAPPER Home billboard motion, design `8b7f85941addf5a65390fe6eca4f11aba9584a17` | Application `9b70b07352b7ffd7a2e8a552660ad2e89f6f00c5`, browser Vizio configuration; [execution issue #71](https://github.com/viptv-org/tv-web/issues/71) | `remote/billboard.spec.ts`: uninterrupted and restarted full passes, pause, eventual indicator retirement and no playback; eight cases verified (`/tmp/viptv-71-final-browser.log`, `/tmp/viptv-71-first-retry.log`) | Existing reduced-motion pixel and artwork-retirement assertions retained; reference metric unmeasured | Hardware unverified | Hardware unverified | Hardware unverified | Verified for the stated browser scope |

# SolidTV source-picker hint suppression

| Contract | Implementation / execution | Functional evidence | Visual evidence | Tizen | Vizio | webOS | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SRC-DRAWER-09, TV 1920×1080, design `8b7f85941addf5a65390fe6eca4f11aba9584a17` | `fe115118c6d628b7ddae1592b01a6c29d8693403`, browser Vizio configuration; [execution issue #61](https://github.com/viptv-org/tv-web/issues/61) | `remote/source-hint.spec.ts`: both server hints absent during discovery and idle; source rows selectable; Back restores Home focus; 2 passed (`/tmp/viptv-61-browser-green.log`) | Private screenshots inspected at 1920×1080; reference metric unmeasured | Hardware unverified | Hardware unverified | Hardware unverified | Verified for the stated browser scope |

# Completion audit in progress — 2026-10-23

The authoritative outstanding-work inventory is
[REMOTE_COMPLETION_AUDIT.json](REMOTE_COMPLETION_AUDIT.json). Passing the current
40 browser cases and selected geometry checks does not establish all-state
parity. See the latest [testing checkpoint](../TESTING.md) for reproduced
regressions, bounded guide measurements and validation scope.

The adopted design contract pin is `1f68aa8280a4152f687013cf8246a5fbebebc902`
([DESIGN_REF](../DESIGN_REF)). Design revisions cited inside the dated
checkpoints below record the pin each checkpoint was measured against; they are
historical, and none of them is the current pin.

The older checkpoint sections below remain historical.

---

# Active server-authoritative TV wrapper — 2026-10-23

The current TV entry is the remote SolidTV wrapper. Its implementation,
per-reference exclusions, browser evidence and physical-device limits are tracked
in [REMOTE_PARITY.md](REMOTE_PARITY.md), with exact pins/results in
[TESTING.md](../TESTING.md). The older sections below remain historical evidence
for the retired client-policy implementation and the separate React entry.

| Boundary | Current result |
| --- | --- |
| Current backend contracts | Unversioned APIs, server ordering/actions/resume/ranking/continuation/preferences |
| Local operation | Removed from reachable TV graph; only durable device credentials persist |
| Tv3 geometry/focus | Private capture review and selected exact geometry checks; 30 browser acceptance tests |
| Playback | Gateway-selected delivery, actual browser HLS frame/progress evidence, independent lease expiry |
| Missing server features | Omitted; Calendar excluded by owner; no invented local fallbacks |
| Hardware / deployment | Not qualified or deployed by this conversion |

---

## Native Recovery Integration - 2026-10-05

| Surface | Current evidence | Limits |
| --- | --- | --- |
| Managed seek identity | Real controller decoder replacement retains accumulated target; new selected source cancels old queue | Unit/controlled decoder boundary, not a physical TV |
| Input scope and return | Trusted HTTPS desktop/browser/phone backdrop behavior, controls within viewport; filter return, fullscreen and restoration | Synthetic media; screenshots inspected privately |
| Native control failures and buffers | Owning Video tests cover asynchronous and immediate refusal, retired-source feedback, buffer gaps/offsets and bounded startup retry | Linux native engine coverage recorded in desktop; Windows/macOS unverified |
| Main baseline preservation | Current retry/Vizio media source and immutable asset configuration retained; design/video snapshots synchronized | Not a production deployment or refreshed hardware qualification |

## Desktop playback follow-up — 2026-10-03

Design `8b7f85941addf5a65390fe6eca4f11aba9584a17` is the adopted pin; this
2026-10-03 checkpoint measured
`a8b5acac2f810e3d447334e64b7fc3f44c696b4d`, which later revisions superseded.
See [TESTING.md](../TESTING.md) for pin and execution details.

| Surface | Verified scope | Native evidence / limits |
| --- | --- | --- |
| Same-selector source return | Provider/quality survive player, titlebar and browser Back; another episode resets to All | Trusted HTTPS browser fixture; TV physical input not newly qualified |
| Player fullscreen and lifecycle | Primary command ownership, fallback, late completion, pre-existing window fullscreen and titlebar callback | Real GStreamer/MPV GTK/X11 chrome removal and viewport restoration; Windows/macOS unverified |
| Initial VOD timeline and controls | Live-flag VOD duration/buffer, immediate stopped state, refused explicit replacement and cancellation | Normal local-backend VOD admission on both engines before any seek; first OS pointer seek and real buffer span verified |
| Error and outage surfaces | Bounded/redacted native HTTP causes; persistent outage dismissal and recovery | Native HTTP 407 fixture plus separate fixture-admission UI run on both engines; exact Lanterns/provider failure remains open |
| Native scrolling | Actual GTK/WebKit OS-wheel frame samples recorded on isolated X11 | Ordinary desktop smoothness and reported sidebar symptom remain open |

## BE-002 raw live cutover — 2026-09-29

Design `4e153a7daca300389049e5fcfd5c3bc0af5edbee`; application evidence and
local reproduction are recorded in [TESTING.md](../TESTING.md).

| Surface | Verified scope | Device evidence / limits |
| --- | --- | --- |
| React phone/desktop/TV guide | Bounded forward/back cursor window, scroll anchor/eviction, visible EPG, stale-route cancellation, >200 category boundary/reverse and snapshot mismatch; future programme slot retained on page crossings | Browser fixtures; physical remote and real provider data unverified |
| Solid Tizen/Vizio/webOS guide and live player | Existing geometry/Back focus, v2 exact source/lease, failed and delayed-cancelled admission, 90 stable end-time frames; Vizio >200 categories and reverse boundary refetch | Simulated platform/decoder boundaries; physical TV/TLS/4K/tracks unverified |
| Home/Live/Playback preferences | Private 1920x1080 captures inspected; profile Maximum quality and local-only boot/sign-in removed | No measured full visual parity or signed device packages claimed |

## TV-038 hosted DOM follow-up — 2026-09-26

| Surface | Browser evidence | Device evidence |
| --- | --- | --- |
| Rail, Home/carousel, episodes, Discover | Five HTTPS scenarios at full/scaled TV sizes, with exact focus/bounds and pagination assertions; 14 existing Vizio regression cases passed | Android TV Resume visually verified; physical Vizio remote/media acceptance not newly performed |
| Hero blur, Resume, chip/grid/scrollbar/legend styling | Inspected captures and computed geometry/color checks against Android TV's layout | No universal visual/device parity claim |

# TV-034 corrections (2026-09-25)

Design revision: `8ab5b6e95cdc9c6154efec2ff418a4ee1eecf55e`.
The detailed current evidence and reproduction commands are in [TESTING.md](../TESTING.md).

| Surface | Implemented and browser checked | Physical Tizen / Vizio |
| --- | --- | --- |
| Profiles / Settings / rail | Selection without restart, rail escape/return, common icon coordinates, real cog/pencil assets and padded edit badges | Unverified / Unverified |
| Home / search / library / discover | Full selected-card visibility, bounded final card, tighter shelves, equal actions, nonoverlapping progress, stable focus geometry, shared catalogue card | Unverified / Unverified |
| Series | Entire episode list, season changes, correct selected episode identity and Back restoration | Unverified / Unverified |
| Live player | Live card to sources to playback; only audio/subtitles/exit, no VOD seek/pause; return to channel/card | Unverified / Unverified |
| Startup / text | Immediate shell, progressive queue and catalogue/search results, cancellation guards, buffered glyph replacement | Unverified / Unverified |

Historical measurements below remain historical; they do not override TV-034's
owner-requested geometry corrections or imply current pixel/hardware parity.

---

# SolidTV renderer adoption — 2026-09-24

Pinned design: `8b7f85941addf5a65390fe6eca4f11aba9584a17`. These 2026-09-24
entries were measured against the then-pinned
`fa8b20e0e63d465498b6b2af8571a4e9cdc1015f` and bound the migration from the
Blits canvas to `src/tv-solid`; prior platform coverage and outstanding product
gaps are historical records below.

| Surface | SolidTV browser evidence | Physical device evidence |
| --- | --- | --- |
| Pairing/profiles | Loading, expiry/retry, chooser, manage focus/hold, create/edit/rename/avatar/delete and profile paging scenarios passed | Unverified |
| Home/rail/title | Navigation, every loaded shelf, horizontal/vertical focus restoration, detail/episode focus and Back passed | Unverified |
| Discover/library/search | Filters, paging, keyboard, menu/Undo and restoration passed | Unverified |
| Live | Guide movement, future programme details, long hold and live search passed | Unverified |
| Settings | Root rows, preferences/save, addon actions and cancellation, sign-out cancellation passed | Unverified |
| Sources/player | Quality/provider/details, paging, holds, playback, seek, subtitles/audio replacement, explicit Next and Back cancellation passed | Unverified |

All 30 migrated scenarios passed with the Tizen browser flag. The five profile
editor states, twelve-profile paging and explicit Next/cancellation passed in
additional browser fixtures. Home, Live and PlayerSubs additionally passed
with Vizio and webOS flags. 43 before/after
captures measured migration drift; see [metrics](solid-tv-visual-metrics.json)
and [TESTING.md](../TESTING.md). Geometry/tokens/assets remain pinned. The
comparison is not byte equality or complete canonical-design certification.

---

# VIPTV design-system overhaul — 2026-09-23

Current design: `8b7f85941addf5a65390fe6eca4f11aba9584a17`, with the
authoritative [screen index](../design-contract/viptv-design-system/reference/screens/index.json),
[components](../design-contract/viptv-design-system/components.md),
[copy](../design-contract/viptv-design-system/copy.md), and
[decisions](../design-contract/viptv-design-system/decisions.md). The table
below describes the current build. The 2026-09-23 checkpoint was measured
against `732244c79c05da9a47004dd97cdc6caf1ed534be`, which later revisions
superseded. The older Roku-based record farther down is historical evidence for
a superseded design revision.

| Surface | Browser and reference evidence | Remaining limit |
| --- | --- | --- |
| Shell and Home | Phone, desktop app preview, browser and TV Home, rail, title bar and phone nav captured and compared; responsive Back and remote focus exercised. | Desktop app frame is a browser preview, not an installed Tauri run. |
| Title, sources, menus | Phone/desktop/TV title, sources, provider/details and menu/Undo states captured; source identity, hold, filter and Back checked. | Reference and fixture source counts differ; TV provider control remains an explicit adaptation. |
| Discover, My List, Search, Live | P/D/T results, filters, queue, keyboard and guide states captured; paging, stale response suppression and D-pad flow checked. | Reference uses a voice-search mic; the app has no voice input. Some fixture counts and artwork differ. |
| Account | Sign-in, pairing expiry, profiles, edit, avatar, text and PIN states captured; auth/focus flows checked. | A protected-profile lock badge awaits a protection flag in the profile data. |
| Settings, casting, local mode | P/D/T settings and addon states, desktop SmartCast preview and browser/local-mode states captured; local and cast unit flows checked. The desktop command paired with and launched a physical Vizio on 2026-09-24. | Accent-colour choice has no reference screen. Other cast states remain browser simulations. |
| Player and shared states | P/D/T VOD, live, seek, tracks, Up Next, buffering and error states captured; Next, focus, rollback and notices checked in browser. | Browser media stubs and AVPlay simulation do not qualify device decoding. Composite States boards are reviewed through individual states. |

All 151 tv-web-reachable reference screens produced side-by-side comparisons;
the WebLinkTv code-entry page is implemented in `web`. Browser screenshots
and comparison artifacts remain ignored local test output. Physical Vizio
launch, sign-in and viewing entry were confirmed on 2026-09-24; other
physical Vizio states, Tizen and installed Tauri evidence remain unverified.
See TESTING.md for the scoped observation and validation commands.

# Prior shared TV visual rebuild parity — 2026-09-13

Design: `3ab29a63cbe6369341ee4376f69a59d4cbb38fc8`. Contract IDs refer to that revision's TV_WEB_UI_REBUILD acceptance index, now removed from the current snapshot. Local batch at the time: 43 unit tests, 49 browser passes / 33 deliberate platform skips. Implementation/CI revision is recorded in [execution issue #2](https://github.com/viptv-org/tv-web/issues/2) and TESTING.md. The evidence columns bound what was verified then.

| IDs / surface | Browser evidence | Matched Roku visual evidence | Tizen hardware | Vizio hardware |
| --- | --- | --- | --- | --- |
| TVW-01 startup/pairing | Pending/approved/expiry/QR failure/manual/retry | Fixture inspected; full matched set pending | Unverified | Unverified |
| TVW-02/03 profiles/avatar/text/PIN | CRUD/protection/failed draft/unlock/cancel, captured chooser | Matched set pending | Unverified | Unverified |
| TVW-04/05 rail/Home | Routes/holds, initial shelves and focus; canonical rail geometry | Fixture inspected; real-content Home comparison pending | Unverified | Unverified |
| TVW-06 Discover/My List | Filters/defaults/paging and queue actions | Matched set pending | Unverified | Unverified |
| TVW-07 movie | Manual source, saved source intent and Resume failure paths | Matched set pending | Unverified | Unverified |
| TVW-08 episodes | Real API decoding/history merge, watched/progress, initial focus and Down to complete next row | Fixture inspected; matched artwork/title set pending | Unverified | Unverified |
| TVW-09 sources | Filter/empty/hold details/exact Resume identity, canonical list geometry | Fixture inspected; retained Quality adaptation | Unverified | Unverified |
| TVW-10 Search | Debounce/stale/partial results, fixed keyboard and result geometry | Blank first-key state SSIM 0.923059; populated states pending | Unverified | Unverified |
| TVW-11 Guide | Five rows/gaps/filter/40-channel page/Back/server labels | Fixture inspected; real schedule comparison pending | Unverified | Unverified |
| TVW-12 Settings/addons | Six actions/nested preferences/return focus/addon mutations/signout; 720p/1080p scaling | Switch-profile state SSIM 0.955989; other states pending | Unverified | Unverified |
| TVW-13/14 player/Next | Direct decoder fixture, seek/repeat/cancel/track-modal Back, controlled Next/previous Resume | Full matched overlay set pending | Unverified | Unverified |
| TVW-15 queue menus | Hold release suppression/corrections/hide/Undo | Matched set pending | Unverified | Unverified |
| TVW-16 lifecycle/shared states | Scoped stale-response errors, fixed-canvas focus/scaling; see scenario gaps below | Complete dialog/error/motion matrix pending | Unverified | Unverified |

No row implies every branch is covered. Per-screen gaps and physical platform limits remain below; superseded old labels/layout assertions were updated to Roku controls rather than preserved as a second design.

## Detailed scenario coverage

# TV behavior parity matrix

Audit target: `design/TV_IMPLEMENTATION.md` required scenario groups and
`design/specs/behavior/roku-ux-contract.md`. This records automated scenario
coverage present in this checkout on 2026-09-12. A linked test means one
scenario exists; it is not a claim that every state in the group, or physical
Tizen/Vizio behavior, is verified.

| Required group | Existing automated scenario(s) | Explicitly missing from current suite |
| --- | --- | --- |
| Pairing pending, approved, expired, error, retry | `tests/e2e/tv-shell.spec.ts` — pairing page and Retry; `pairing-lifecycle.spec.ts` — pending approval, expiry/retry and QR failure with manual pairing | Slow-down/network error and stale poll cancellation |
| Profile choose/create/edit/avatar/delete/primary protection/unlock | `tv-shell.spec.ts` — create, avatar selection, protected edit/unlock, secondary deletion and primary no-delete | Five-card paging through 12 profiles, unlock cancellation/rate-limit and profile-selection cancellation |
| Home focus, hero, loading, Back | `tv-shell.spec.ts` — Home arrives after profile selection; canonical shelf geometry; held non-live queue hero opens Manage; held resumable/new-movie heroes enter explicit source choice; held series-root hero opens episode detail; held non-queue Home cards follow ordinary detail selection | Hero/action changes with focus, stable shelf order under delayed requests, rail/Home focus restoration, playback Back destinations and loading states |
| Discover filters and paging | `tests/e2e/discover-filters.spec.ts` — declared defaults, filter changes and pagination reset | Type/catalog switching, failed/empty page behavior and return focus |
| Search keyboard, debounce, results, failure | `tests/ui/text-entry.test.tsx` — rejected text draft remains editable; `tv-shell.spec.ts` — basic Search view | 650 ms replacement, blank/empty copy, result identity retention and keyboard-to-result movement; partial-source retention/status now covered in `resilience-settings.spec.ts` |
| Movie, series, season and episode state | `tv-shell.spec.ts` — movie detail/source entry, held series-root hero detail entry, and series season/episode source entry | Episode initial-focus/progress choice, unreleased episode behavior and detail Back restoration |
| Manual source paging/filter/explicit selection/Resume identity | `tv-shell.spec.ts` — explicit source starts and lookalike Resume returns to manual choice | Late-result focused-row stability and source paging. `next-episode.spec.ts` now covers failed exact Resume, Retry/manual source choice at retained position and Back; empty-filter focus/full source details are covered in `resilience-settings.spec.ts` |
| Player pause/seek/repeat/debounce/cancel/rollback/tracks/exit | `tests/e2e/media-decode.spec.ts` — real DOM decode advances, pauses, seeks, ends and disposes; `tests/player/*.test.ts` — adapter/controller failures and replacement boundaries; `player-remote.spec.ts` — direct preview/repeat/debounce, managed seek/subtitle-Off, Exit/Sources progress, seven-second chrome hide, modal timer suspension, modal-first Back/focus restoration and chrome-then-exit Back order | Managed rollback recovery UI, track-dialog paging/focus transitions beyond the Audio-close path, and physical remote/decoder behavior |
| Next scoped selection/last-ten eligibility/cancel/previous Resume | `tests/player/session-controller.test.ts` — cancellation/restoration boundaries | `next-episode.spec.ts` verifies the three-distinct-attempt bound, same-IPTV-account continuation despite a competing first result, app-level ranked Next, final-ten guards, cancellation, explicit near-end Resume and previous-episode Resume/Back. Remaining: failed native rollback recovery UI. |
| Queue hide/undo/watched/history | `tv-shell.spec.ts` — held OK opens queue management; Hide then Undo restores visibility | `queue-progress.spec.ts` covers watched/unwatched correction, queue/history refetch, restored focus and manual restart at position zero without premature history writes. Remaining: queue paging and focus when the removed row was the final item. |
| Live guide future OK versus Play/filters/windows/gaps | `tests/ui/guide.test.tsx` — category filters, five rows, previous page final-row focus, gap/cell cap and remote search trim/bounds/Back | Future-programme OK detail versus transport Play, details key consumption, hour bounds/follow-now, guide search copy and missing-schedule Watch |
| Settings/source preferences/addons/signout | `tv-shell.spec.ts` — subtitle-start and quality mutation through the six-row nested preferences | Remaining preference options and account-wide add-on copy; add-on install/enable/remove and sign-out are covered in `resilience-settings.spec.ts`; parent-gated select/logout cancellation and approval are covered in `parent-auth.spec.ts` |
| Stale request/session cancellation | `tv-shell.spec.ts` — obsolete Browse response cannot replace current search; `tests/player/*.test.ts` — stale adapter/controller callbacks | Stale pairing/profile/home/source/guide requests and focus restoration cancellation after directional input |
| Offline and partial failures | `tv-shell.spec.ts` — sanitized Discover failure and dismissal | Pairing/profile/source/player/guide offline paths and partial cross-catalog search result retention |

## Evidence limits

`media-decode.spec.ts` uses Chromium's real HTML media decoder with a recorded
WebM fixture. It does not prove a physical SmartCast decoder, Tizen AVPlay,
codec/DRM support, signing, store submission, or backend delivery behavior.
Those remain platform and hardware acceptance work.

## Responsive production adoption (issue #3)

Contract: design `2411c28a169412fbedd38a293adc1a7482dcc9c0`, RESPONSIVE_PRODUCTION and RUI-018–021. Browser default adopts responsive layout; explicit TV layout retains the prior canvas and behavior. Real controller/API integration and native command payloads are covered separately from physical decoding. Current validation evidence will be recorded in RESPONSIVE_VALIDATION.md. No measured Roku screenshot match or native packaging claim is made by moving this pin.

RUI-022 populated content correction: design502dcb5. Seven populated viewport checks plus phone/desktop Back anchors and existing responsiveflows passed. Real fixed-root scrollWidth and16:9 artwork bounds are now asserted. Sparse previous checks were insufficient; do not cite them as complete responsive visual acceptance. Physical TV/native-host evidence remains unchanged.

## RUI-023 correction

Shared Rust CardPresentation owns shelf image roles, labels, progress and activation for Android/web. Queue image regression starts with a poster-only history row and requires metadata's exact episode still. Responsive lower-shelf focus and live logos are checked at390/768/1440px; routing tests verify Back/Forward, left-hand Back, reload without playback and no live Sources detour. Actual upstream adapter decoding is recorded separately in RESPONSIVE_VALIDATION.md. No device-wide 100% parity claim.

RUI-024: mobile selected-state styling and desktop focus preservation browser-verified; mobile visual focus suppression does not remove DOM/text-input editing semantics.

RUI-025 supersedes desktop keyboard focus presentation: responsive desktop/mobile use selected states without TV keyboard navigation; TV-mode input remains unchanged. Browser and remote-input regression checks pass.

| RUI-026 / TVW-05, 09, 16 | Shared failed-image recovery; dismissible dialog backdrops; one local source spinner | Core b374711 / design58cc091. Phone390 and desktop1440 browser failure/dismissal/geometry scenarios pass; profile draft and stale authorization cancellation covered. Responsive/history and both TV-shell configurations pass (12 platform-specific skips). | Physical Tizen/Vizio unverified; no new Roku runtime change. |


| RUI-027 | Responsive fullscreen/volume/decoder diagnostics; category sidebar and native-scroll guide; shared addon namespaces; centered web/native approval | Design f8ca89d / core a8ece4f. Browser viewport/scroll/fullscreen/auth boundaries and 117 app unit tests pass. Real MediaBunny live/MP4 and same-session HLS.js fallback exercised; detailed counts and rerun caveat in TESTING.md. | Installed Tauri and physical TV qualification pending; insecure LAN HTTP uses available native decoding. |
# LightningJS TV-only migration — 2026-09-24

Design pin `aa2a1d69935fc07a97bd37d5fa0f78ab8d1c7b47`; React TV
baseline `6f335d7631e1334be398b7aa5977ce4ce51ac50a`.

| TV state / path | Lightning browser evidence | 1:1 visual evidence | Device evidence / disposition |
| --- | --- | --- | --- |
| Pairing, loading, expiry, retry | Shared device API/QR mocked at 1920×1080; expiry Enter release caused a new device-code request. Tizen/Vizio/webOS browser captures were byte-equal. | Pairing vs current React: 331,807 pixels changed (16.0015%), MAE 3.7149, RMSE 25.1868, SSIM 0.911408. Open deviation. | Physical Tizen/Vizio/webOS unverified; staged entry only. |
| Profiles / Manage / hold | SolidTV focused tiles and Manage retain size and use cached settings/check icons under the then-pinned design `fa8b20e0e63d465498b6b2af8571a4e9cdc1015f`. The lazy shared editor handles create, rename, avatar, save, delete and PIN through the same API/UI flow as React. Fixture requests and return focus passed; a twelve-profile fixture paged to page two and selected profile 6. | `TvProfiles`, `TvProfilesManage`, `TvProfileEdit`, `TvProfileName`, `TvAvatars`, `TvProfileDelete` inspected at 1920×1080. Focused profile is ring-only and Manage text/icon are centred. Historic pixel metrics below predate this refinement. | Browser fixture only; physical remote/PIN hardware qualification remains. |
| Home first frame / action and shelf focus | Shared API/Rust hero and queue projections feed staged Home. Live/catalog/My List shelves load after the first usable queue frame. Browser D-pad fixtures reached the last queue card, stayed in the row on Right, moved to the next shelf on Down and restored the cursor on Up. | `TvHome` and a lower-shelf capture inspected at 1920×1080. The hero art disappears on lower shelves. Historic metric: 1,406,199 pixels changed (67.8144%), MAE 8.8849, RMSE 26.6207, SSIM 0.857713 against React `TvHome`; it predates this refinement. | Browser fixture only; no launcher or device qualification. |
| Expanded TV menu | Left from the first Home action opens seven Blits focus rows; Down focuses Discover. Right/Back restore the remembered Home action. Profile activates profile selection; Home, Search, Discover, Live TV, My List and Settings route to content. Tizen/Vizio/webOS browser captures were byte-equal. | `TvMenu` vs React: 1,625,803 changed pixels (78.4049%), MAE 3.7609, RMSE 12.2046, SSIM 0.930841. The Home background contributes to the full-frame difference; exact pixel parity remains open. | Browser fixture only; physical remote behavior unverified. |
| TV Search | Blits on-screen keys and physical typing search the same catalog/live API after 650 ms; replacement cancels stale work. Browser fixtures exercised 14 grouped Naruto results, D-pad result/keyboard navigation including offscreen results, title/Back focus, held-card menu, Delete/Clear, no results, partial catalog failure with retained Live TV, and rail return through Discover/My List. Search keeps all result positions for navigation but mounts and reprojects at most nine viewport cards per D-pad window move; a 120-result model check confirmed only visible cards receive wsrv URLs. Populated and blank captures were byte-equal in Tizen/Vizio/webOS browser modes, and the windowing edits left the Blits `TvSearch` frame pixel-identical. | `TvSearch` populated vs React: 407,982 changed pixels (19.6751%), MAE 4.5274, RMSE 23.1041, SSIM 0.942227. Matched blank Search: 79,744 changed (3.8457%), MAE 1.3043, RMSE 13.4446, SSIM 0.827156. Both open deviations; no-result and partial-failure states lack React pixel baselines. Search input latency was not remeasured after windowing. | Browser fixtures only; physical keyboard/remote behavior unverified. Voice search is unavailable in the current React baseline too. |
| Live guide / programme details / Live search | Shared live and schedule APIs feed Blits five-row guide, hero, category chips, schedule gaps, now line, held-OK details, and a full-screen text entry. Browser fixtures exercised future OK versus current OK, News filter request, Back/focus restoration, and typed `cnb` submission; five repeated guide runs passed after cancelling stale focus callbacks. Hour-window and channel-page code paths need longer-data/browser coverage. | Matched React comparisons: `TvLive` 561,727 changed pixels (27.0895%), MAE 4.3172, RMSE 23.3649, SSIM 0.908843; `TvLiveDetails` 1,235,755 (59.5947%), MAE 5.0488, RMSE 21.4385, SSIM 0.877160; `TvLiveSearch` 144,918 (6.9887%), MAE 1.7969, RMSE 14.4489, SSIM 0.824780. All open deviations; Live search's physical-typing focus decoration is still missing. Earlier design-WebP metrics were incorrectly labelled React. | Tizen/Vizio/webOS browser captures byte-equal for all three states. Current OK uses staged source picker versus React's direct play. Physical TV and live source playback unverified. |
| Settings / playback choices / addons / sign-out confirmation | Blits root rows and profile tiles use current session data. Browser fixtures exercised D-pad profile focus, preference PUT/Back, addon list, Enable/Disable API request, nested Remove cancellation, sign-out cancellation and return to Home. Addon install text entry, confirmed removal, profile editing, parent-PIN sign-out and rows beyond six remain incomplete or unverified. | Matched React: `TvSettings` 172,804 changed (8.3335%, SSIM 0.894380); `TvPlayback` 197,552 (9.5270%, SSIM 0.834234); `TvPlaybackChoice` 1,148,625 (55.3928%, SSIM 0.878242); `TvAddons` 177,432 (8.5567%, SSIM 0.852570); `TvSignOut` 1,100,764 (53.0847%, SSIM 0.900069); `TvAddonManage` 1,030,417 (49.6922%, SSIM 0.891538); `TvAddonRemove` 1,029,282 (49.6374%, SSIM 0.901659). All open deviations. | Tizen/Vizio/webOS browser captures byte-equal for Settings and Playback choice; physical TV unverified. |
| TV navigation performance | Production-bundle Chromium Home fixture measured five unthrottled and five 4× CPU-throttled runs after deferring playback import and the Home reveal delay. Home screenshot remained exact against its previous Blits frame. A three-second-settled diagnostic separates texture warmup from steady-state navigation. | Final-bundle median first interactive focus: React 201 ms versus Blits 388 ms unthrottled; 663 ms versus 1,238 ms at 4× throttle. Focus-hook timing and sampled frame intervals also favor React, but marker stages differ. Performance target not met. | Chromium used SwiftShader; no physical Tizen/Vizio/webOS latency or FPS measurement. TV launcher remains React. |
| Discover / Genre filter | The staged Blits route loads normalized catalogs and cards from the shared API/core. Browser D-pad fixtures exercised a 4-column focus window, selected-card detail/Back restoration, Genre choice request, catalog/type switching and return to Home. The modal keeps its own focus and Back. Tizen/Vizio/webOS browser captures were byte-equal for both states. Required text entry, horizontally overflowing chips, long filter lists and physical navigation remain pending. | With landscape art fitted as React renders it, `TvDiscover` vs React: 725,162 changed pixels (34.9712%), MAE 3.1006, RMSE 16.5307, SSIM 0.952812. `TvDiscoverFilter`: 1,178,903 changed (56.8530%), MAE 3.3850, RMSE 14.9249, SSIM 0.940365. Both open deviations. | Browser fixtures only; no physical Tizen/Vizio/webOS run of Blits. |
| My List / Continue Watching | Saved titles and queue are fetched from the shared profile API. Blits tabs, grid focus, direct queue Resume source/position, player exit and source Back restore the originating library tile; saved-title detail My List mutation refetches the grid. Held OK opens the staged action menu and suppresses release activation. Tizen/Vizio/webOS browser captures were byte-equal for queue and saved grids. | `TvLibrary` queue: 614,925 changed pixels (29.6549%), MAE 2.8698, RMSE 16.7688, SSIM 0.953726. Saved grid with six fixture favorites: 463,694 changed (22.3618%), MAE 1.9608, RMSE 14.0516, SSIM 0.951455 against a matched React browser capture. Both open deviations. | Browser fixtures with platform media stubs only; no physical TV run. |
| Held-card title menu / queue corrections | Blits focus rows open on 700 ms OK hold or ContextMenu; Back restores the card. Browser fixtures exercised Choose source, previous episode at its saved position, restart at zero, hide/Undo API calls, favorite toggle, and watched correction through the shared API. Hide/Undo backing data is mocked and physical remote Menu/Info keys remain unverified. | `TvItemMenu` vs React: 1,223,606 changed pixels (59.0088%), MAE 4.7415, RMSE 21.5925, SSIM 0.886041. Open deviation; Home underlay and menu icon/shadow rendering differ. Undo view is unmeasured. | Tizen/Vizio/webOS browser captures byte-equal; no physical TV run. |
| Title / episode row | Home Details and a selected card loaded distinct metadata through the shared API/core. Back restored the originating Home action/card focus; title My List reached the API. Action and episode tiles own Blits focus. | `TvTitle`: 1,474,821 pixels changed (71.1237%), MAE 8.2731, RMSE 27.3696, SSIM 0.793883. Open deviation. | Full playback controls, More info, full episode activation and physical devices unverified. |
| Sources / provider / details | Rust-owned source polling, Blits D-pad filters, provider choices, six-row window paging, exact source ID/position and Resume intent, nested Back/focus and 700 ms details hold exercised in browser fixtures. Explicit selection now reaches the pinned playback controller. | `TvSources`: 1,525,612 changed (73.5731%), MAE 5.7584, RMSE 22.7721, SSIM 0.887465. `TvSourceProvider`: 1,267,892 changed (61.1445%), MAE 6.2317, RMSE 22.8690, SSIM 0.847848. `TvSourceDetails`: 184,921 changed (8.9179%), MAE 2.4859, RMSE 20.9487, SSIM 0.627974. All open deviations. | Tizen/Vizio/webOS browser captures byte-equal for Sources; physical remote, player and decoders unverified. |
| Player / seek | Pinned platform adapter and session controller opened the selected source. Browser media/AVPlay stubs verified Pause, relative seek, preview cancel/commit, two-level Back, session stop and progress save. Explicit series Next reached the next playback request on Tizen/Vizio browser stubs; Back cancelled a hanging Vizio replacement while retaining the outgoing session. | Vizio-browser `TvPlayer`: 94,978 changed (4.5803%), MAE 3.2571, RMSE 24.6134, SSIM 0.753696. `TvPlayerSeek`: 114,621 changed (5.5276%), MAE 3.4487, RMSE 24.7832, SSIM 0.737013. Open deviations. | Tizen browser AVPlay does not paint a frame; physical video layering, codecs/DRM, automatic Next, error/recovery and live/DVR unverified. |
| Audio/subtitles panel | Blits panel focuses the current track. Browser fixtures on Tizen/Vizio/staged webOS exercised unavailable PGS, Back restoration, managed Subtitles Off and English Stereo replacements. | Vizio-browser `TvPlayerSubs`: 380,929 changed (18.3704%), MAE 3.7155, RMSE 21.8704, SSIM 0.862725. Open deviation. | Lists longer than eight rows and physical track capabilities unverified. |
| Responsive web and desktop isolation | Phone `Main` and desktop `DeskHome` from current React entry captured against isolated tv-web `de6adc1` before player wiring. | Both exact: 0 changed pixels, MAE/RMSE 0, SSIM 1 at 390×844 and 1440×900 respectively. | Installed Tauri run unverified; no responsive source changes. |
| All other TV states | No Lightning acceptance result. | Unmeasured. | Not migrated or qualified. |
| React TV launch path | `TvPairing` capture remains exactly equal to saved React baseline (0 changed pixels). | Existing path unchanged for that state. | Current Tizen/Vizio launcher retained. |


---

# Preserved SolidTV completion branch evidence

# SolidTV completion checkpoint — 2026-09-24

Design pin: `268e42c6a456f82a1e6f5b3c8893eccbcc7c1b2d`.
Native SolidTV focus now owns the active element, focus path and remote routing.

| Surface | Added browser acceptance | Remaining evidence |
| --- | --- | --- |
| Home | Primary Play, held menu/source actions, queued Next, stale Next after navigation; Vizio Home shelves, catalog rows, and carousel/vertical navigation delivered from real API feeds | Full canonical visual inventory and remote focus movement review |
| Profiles | Edit/name/avatar/PIN, create/delete, protected selection, 12-profile paging, cancellation | Pixel-exact canonical review; physical TV |
| Text entry | Required filters, addon URL validation/install, held Delete, sign-out PIN success/retry | Full long-input/error states on TV |
| Player | Next, three source attempts, rollback failure and exact-source Retry, paused/cancelled Up Next, final-ten-second Resume | Physical video surface/codec checks; all canonical overlays |
| Live | Direct channel/programme playback, exact focus return, failure Back, no live progress writes | Physical stream playback and remote |
| Title / long lists | Season selection, tenth episode/source identity, stable Resume target, full More info/Source text scrolling, 12 audio/subtitle tracks | Complete visual comparison; physical TV |
| Recovery | Current controller session metadata/heartbeat, terminal error callback, committed seek target, authenticated Home retry | Physical decoder failures and codec fallback |
| Visuals | Matched Home backdrop/typography, SVG rail/key/player/profile icons, profile field/keyboard geometry, non-overlapping player hints | Full exact design parity is not yet certified |

Matched profile screenshot metrics are in [solid-completion-visual-metrics.json](solid-completion-visual-metrics.json): Edit mean channel error 1.1668/255 (10.6429% pixels differ), Name 1.4608/255 (5.8199% pixels differ). These are **not pixel-identical**.

Default launchers remain React until delivery gates pass. Current measurements
and limitations are in [PERFORMANCE.md](../PERFORMANCE.md); earlier results below
belong to earlier immutable checkpoints. No physical TV or production claim is
made from browser platform flags.

---

# SolidTV renderer adoption — 2026-09-24

Pinned design: `aa2a1d69935fc07a97bd37d5fa0f78ab8d1c7b47`. The entries below
bound the migration from the Blits canvas to `src/tv-solid`; prior platform
coverage and outstanding product gaps are historical records below.

| Surface | SolidTV browser evidence | Physical device evidence |
| --- | --- | --- |
| Pairing/profiles | Loading, expiry/retry, chooser, manage focus and hold scenarios passed | Unverified |
| Home/rail/title | Navigation, paging, detail/episode focus and Back passed | Unverified |
| Discover/library/search | Filters, paging, keyboard, menu/Undo and restoration passed | Unverified |
| Live | Guide movement, future programme details, long hold and live search passed | Unverified |
| Settings | Root rows, preferences/save, addon actions and cancellation, sign-out cancellation passed | Unverified |
| Sources/player | Quality/provider/details, paging, holds, playback, seek, subtitles/audio replacement passed | Unverified |

All 30 migrated scenarios passed with the Tizen browser flag. Home, Live and
PlayerSubs additionally passed with Vizio and webOS flags. 43 before/after
captures measured migration drift; see [metrics](solid-tv-visual-metrics.json)
and [TESTING.md](../TESTING.md). Geometry/tokens/assets remain pinned. The
comparison is not byte equality or complete canonical-design certification.

---

# LightningJS TV-only migration — 2026-09-24

Design pin `aa2a1d69935fc07a97bd37d5fa0f78ab8d1c7b47`; React TV
baseline `6f335d7631e1334be398b7aa5977ce4ce51ac50a`.

| TV state / path | Lightning browser evidence | 1:1 visual evidence | Device evidence / disposition |
| --- | --- | --- | --- |
| Pairing, loading, expiry, retry | Shared device API/QR mocked at 1920×1080; expiry Enter release caused a new device-code request. Tizen/Vizio/webOS browser captures were byte-equal. | Pairing vs current React: 331,807 pixels changed (16.0015%), MAE 3.7149, RMSE 25.1868, SSIM 0.911408. Open deviation. | Physical Tizen/Vizio/webOS unverified; staged entry only. |
| Profiles / Manage / hold | Blits focused tile components consume shared API data. Right+Enter selected profile 2; Down+Enter entered Manage; held Enter suppressed release selection. | `TvProfiles`: 292,096 changed pixels (14.0864%), MAE 3.4131, RMSE 24.6169, SSIM 0.721367. `TvProfilesManage`: 301,406 changed pixels (14.5354%), MAE 4.0433, RMSE 26.802, SSIM 0.684476. Both open deviations. | Browser fixture only; profile editing, PIN and paging incomplete. |
| Home first frame / action and shelf focus | Shared API/Rust hero and queue projections feed staged Home. Rapid Right+Right+Enter toggled My List; Down/Right moved Blits focus between cards; 750 ms hold suppressed release activation. Details and cards now open title; Play and other shelves remain pending. | 1,406,199 pixels changed (67.8144%), MAE 8.8849, RMSE 26.6207, SSIM 0.857713 against current React `TvHome`. Open deviation. | Browser fixture only; no launcher or device qualification. |
| Expanded TV menu | Left from the first Home action opens seven Blits focus rows; Down focuses Discover. Right/Back restore the remembered Home action. Profile activates profile selection; Home, Search, Discover, Live TV, My List and Settings route to content. Tizen/Vizio/webOS browser captures were byte-equal. | `TvMenu` vs React: 1,625,803 changed pixels (78.4049%), MAE 3.7609, RMSE 12.2046, SSIM 0.930841. The Home background contributes to the full-frame difference; exact pixel parity remains open. | Browser fixture only; physical remote behavior unverified. |
| TV Search | Blits on-screen keys and physical typing search the same catalog/live API after 650 ms; replacement cancels stale work. Browser fixtures exercised 14 grouped Naruto results, D-pad result/keyboard navigation including offscreen results, title/Back focus, held-card menu, Delete/Clear, no results, partial catalog failure with retained Live TV, and rail return through Discover/My List. Search keeps all result positions for navigation but mounts and reprojects at most nine viewport cards per D-pad window move; a 120-result model check confirmed only visible cards receive wsrv URLs. Populated and blank captures were byte-equal in Tizen/Vizio/webOS browser modes, and the windowing edits left the Blits `TvSearch` frame pixel-identical. | `TvSearch` populated vs React: 407,982 changed pixels (19.6751%), MAE 4.5274, RMSE 23.1041, SSIM 0.942227. Matched blank Search: 79,744 changed (3.8457%), MAE 1.3043, RMSE 13.4446, SSIM 0.827156. Both open deviations; no-result and partial-failure states lack React pixel baselines. Search input latency was not remeasured after windowing. | Browser fixtures only; physical keyboard/remote behavior unverified. Voice search is unavailable in the current React baseline too. |
| Live guide / programme details / Live search | Shared live and schedule APIs feed Blits five-row guide, hero, category chips, schedule gaps, now line, held-OK details, and a full-screen text entry. Browser fixtures exercised future OK versus current OK, News filter request, Back/focus restoration, and typed `cnb` submission; five repeated guide runs passed after cancelling stale focus callbacks. Hour-window and channel-page code paths need longer-data/browser coverage. | Matched React comparisons: `TvLive` 561,727 changed pixels (27.0895%), MAE 4.3172, RMSE 23.3649, SSIM 0.908843; `TvLiveDetails` 1,235,755 (59.5947%), MAE 5.0488, RMSE 21.4385, SSIM 0.877160; `TvLiveSearch` 144,918 (6.9887%), MAE 1.7969, RMSE 14.4489, SSIM 0.824780. All open deviations; Live search's physical-typing focus decoration is still missing. Earlier design-WebP metrics were incorrectly labelled React. | Tizen/Vizio/webOS browser captures byte-equal for all three states. Current OK uses staged source picker versus React's direct play. Physical TV and live source playback unverified. |
| Settings / playback choices / addons / sign-out confirmation | Blits root rows and profile tiles use current session data. Browser fixtures exercised D-pad profile focus, preference PUT/Back, addon list, Enable/Disable API request, nested Remove cancellation, sign-out cancellation and return to Home. Addon install text entry, confirmed removal, profile editing, parent-PIN sign-out and rows beyond six remain incomplete or unverified. | Matched React: `TvSettings` 172,804 changed (8.3335%, SSIM 0.894380); `TvPlayback` 197,552 (9.5270%, SSIM 0.834234); `TvPlaybackChoice` 1,148,625 (55.3928%, SSIM 0.878242); `TvAddons` 177,432 (8.5567%, SSIM 0.852570); `TvSignOut` 1,100,764 (53.0847%, SSIM 0.900069); `TvAddonManage` 1,030,417 (49.6922%, SSIM 0.891538); `TvAddonRemove` 1,029,282 (49.6374%, SSIM 0.901659). All open deviations. | Tizen/Vizio/webOS browser captures byte-equal for Settings and Playback choice; physical TV unverified. |
| TV navigation performance | Production-bundle Chromium Home fixture measured five unthrottled and five 4× CPU-throttled runs after deferring playback import and the Home reveal delay. Home screenshot remained exact against its previous Blits frame. A three-second-settled diagnostic separates texture warmup from steady-state navigation. | Final-bundle median first interactive focus: React 201 ms versus Blits 388 ms unthrottled; 663 ms versus 1,238 ms at 4× throttle. Focus-hook timing and sampled frame intervals also favor React, but marker stages differ. Performance target not met. | Chromium used SwiftShader; no physical Tizen/Vizio/webOS latency or FPS measurement. TV launcher remains React. |
| Discover / Genre filter | The staged Blits route loads normalized catalogs and cards from the shared API/core. Browser D-pad fixtures exercised a 4-column focus window, selected-card detail/Back restoration, Genre choice request, catalog/type switching and return to Home. The modal keeps its own focus and Back. Tizen/Vizio/webOS browser captures were byte-equal for both states. Required text entry, horizontally overflowing chips, long filter lists and physical navigation remain pending. | With landscape art fitted as React renders it, `TvDiscover` vs React: 725,162 changed pixels (34.9712%), MAE 3.1006, RMSE 16.5307, SSIM 0.952812. `TvDiscoverFilter`: 1,178,903 changed (56.8530%), MAE 3.3850, RMSE 14.9249, SSIM 0.940365. Both open deviations. | Browser fixtures only; no physical Tizen/Vizio/webOS run of Blits. |
| My List / Continue Watching | Saved titles and queue are fetched from the shared profile API. Blits tabs, grid focus, direct queue Resume source/position, player exit and source Back restore the originating library tile; saved-title detail My List mutation refetches the grid. Held OK opens the staged action menu and suppresses release activation. Tizen/Vizio/webOS browser captures were byte-equal for queue and saved grids. | `TvLibrary` queue: 614,925 changed pixels (29.6549%), MAE 2.8698, RMSE 16.7688, SSIM 0.953726. Saved grid with six fixture favorites: 463,694 changed (22.3618%), MAE 1.9608, RMSE 14.0516, SSIM 0.951455 against a matched React browser capture. Both open deviations. | Browser fixtures with platform media stubs only; no physical TV run. |
| Held-card title menu / queue corrections | Blits focus rows open on 700 ms OK hold or ContextMenu; Back restores the card. Browser fixtures exercised Choose source, previous episode at its saved position, restart at zero, hide/Undo API calls, favorite toggle, and watched correction through the shared API. Hide/Undo backing data is mocked and physical remote Menu/Info keys remain unverified. | `TvItemMenu` vs React: 1,223,606 changed pixels (59.0088%), MAE 4.7415, RMSE 21.5925, SSIM 0.886041. Open deviation; Home underlay and menu icon/shadow rendering differ. Undo view is unmeasured. | Tizen/Vizio/webOS browser captures byte-equal; no physical TV run. |
| Title / episode row | Home Details and a selected card loaded distinct metadata through the shared API/core. Back restored the originating Home action/card focus; title My List reached the API. Action and episode tiles own Blits focus. | `TvTitle`: 1,474,821 pixels changed (71.1237%), MAE 8.2731, RMSE 27.3696, SSIM 0.793883. Open deviation. | Full playback controls, More info, full episode activation and physical devices unverified. |
| Sources / provider / details | Rust-owned source polling, Blits D-pad filters, provider choices, six-row window paging, exact source ID/position and Resume intent, nested Back/focus and 700 ms details hold exercised in browser fixtures. Explicit selection now reaches the pinned playback controller. | `TvSources`: 1,525,612 changed (73.5731%), MAE 5.7584, RMSE 22.7721, SSIM 0.887465. `TvSourceProvider`: 1,267,892 changed (61.1445%), MAE 6.2317, RMSE 22.8690, SSIM 0.847848. `TvSourceDetails`: 184,921 changed (8.9179%), MAE 2.4859, RMSE 20.9487, SSIM 0.627974. All open deviations. | Tizen/Vizio/webOS browser captures byte-equal for Sources; physical remote, player and decoders unverified. |
| Player / seek | Pinned platform adapter and session controller opened the selected source. Browser media/AVPlay stubs verified Pause, relative seek, preview cancel/commit, two-level Back, session stop and progress save across Tizen/Vizio/staged webOS configurations. | Vizio-browser `TvPlayer`: 94,978 changed (4.5803%), MAE 3.2571, RMSE 24.6134, SSIM 0.753696. `TvPlayerSeek`: 114,621 changed (5.5276%), MAE 3.4487, RMSE 24.7832, SSIM 0.737013. Open deviations. | Tizen browser AVPlay does not paint a frame; physical video layering, codecs/DRM, Next, error/recovery and live/DVR unverified. |
| Audio/subtitles panel | Blits panel focuses the current track. Browser fixtures on Tizen/Vizio/staged webOS exercised unavailable PGS, Back restoration, managed Subtitles Off and English Stereo replacements. | Vizio-browser `TvPlayerSubs`: 380,929 changed (18.3704%), MAE 3.7155, RMSE 21.8704, SSIM 0.862725. Open deviation. | Lists longer than eight rows and physical track capabilities unverified. |
| Responsive web and desktop isolation | Phone `Main` and desktop `DeskHome` from current React entry captured against isolated tv-web `de6adc1` before player wiring. | Both exact: 0 changed pixels, MAE/RMSE 0, SSIM 1 at 390×844 and 1440×900 respectively. | Installed Tauri run unverified; no responsive source changes. |
| All other TV states | No Lightning acceptance result. | Unmeasured. | Not migrated or qualified. |
| React TV launch path | `TvPairing` capture remains exactly equal to saved React baseline (0 changed pixels). | Existing path unchanged for that state. | Current Tizen/Vizio launcher retained. |

## TV-040 — Native SolidTV polish

Design pin: `dec7f75` (TV_POLISH.md TV-040 and packaged Lucide source icon).
Affected states: TvHome, TvTitle, TvProfiles, TvProfilesManage, TvDiscover,
TvSearch, TvLive, TvMenu, TvSettings and preparation/live/VOD player overlays.
Native browser checks cover 1080p/720p long chip rows, no-scroll first shelf,
whole shelf headings, stable rail geometry, progressive addon rows, native frame
stability, actual logo textures, preparation cancellation and passive live
progress. Private visual captures were inspected; exact reference-image error
metrics were not recomputed. Tizen/Vizio/webOS physical-device qualification
remains unverified. See TESTING.md for commands and scoped frame evidence.

## TV-041 — Bounded Home, idle player chrome and seek feedback

Design: `30e9367` / TV_POLISH.md TV-041. Native browser checks: a 100-catalog
fixture, twenty-shelf outward/return navigation, payload/window bounds, cancellation,
caption/focus restoration, five-second hiding under continuous ticks, pause/seek
exceptions, reveal-only input, buffered gaps and focused thumb, and the lower
1080p control geometry. See TESTING.md for measured texture-cache figures and
commands. Physical Vizio/Tizen/webOS RAM/decoder constraints remain unverified.

PB-001 browser pipeline: React and SolidTV consume the same pinned player
contract. Local audio/server fallback, caption Off and HLS quality/Auto use the
existing controls. Asynchronous discovery preserves Back and source identity.
React remote behavior was tested over trusted HTTPS; SolidTV Player/Seek/Subtitle
screens were reviewed with controlled fixtures. Actual media and physical Vizio
qualification are separate from those UI simulations (see TESTING.md).
## LG host packaging — 2026-09-27

Existing visual contract retained; design@0430d90 defines host/delivery scope.

| Surface | Evidence | Physical LG webOS 22+ |
| --- | --- | --- |
| Pairing, Home, Sources, Player | Existing shared renderer; four HTTPS Chromium fixture scenarios passed | Unverified |
| Background/relaunch, root exit, media keys | Focus/key reuse plus three host-boundary tests | Unverified |
| IPK and hosted ZIP | Packaged locally and uploaded by Actions 36359987582 | Install and playback unverified |
## REL-001 — 2026-09-28

| Surface | Verified scope | Remaining boundary |
| --- | --- | --- |
| TV Home → sources/provider/details | HTTPS Chromium, repeated scroll/texture cleanup, visible foreground and opaque panels | Physical Tizen/Vizio/webOS |
| Browser header / early Home | Settings navigation, explicit profile switching, failed art and delayed catalogs | Production deployment |
| Desktop remote | Synthetic Power/Mute wire requests and native shell compilation/tests | Real SmartCast TV and installed Windows/Linux runtime |

## HOME-ADDON-001: automatic Home add-on refresh, 2026-10-01

Design: `8b92d90842c9307df7e2daef5eeb0d9a61bbce51`.

| Surface | Verified scope | Remaining boundary |
| --- | --- | --- |
| React Home | Chromium fixture: add-on revision changes, retained card focus/scroll, unchanged polls and retry after a catalog 502 | Installed desktop and physical TV |
| SolidTV Home | Chromium fixture: changed shelves, retained focus/scroll and automatic catalog retry without another revision change | Physical Vizio/Tizen/webOS |
| Development deployment | Matching backend and production viewing assets served on dev.embedez.com; public asset hashes and Solid entry checked | Production rollout and real provider changes during an active Home session |

The full unit suite passed 250 tests and both targeted Playwright checks passed.
No reference-image parity metrics or playback/device capability claims were
added by this change. See TESTING.md for the qualification scope.

## SRC-OVERFLOW-001 / CW-SOURCE-BACK-001 — 2026-10-01

Design pin `ce7084ff80d0541257509748ea772ef0f95d8058`; implementation
commits `61dc20c`, `faf203c`, `a906e47`, and regression follow-up `4d500a3`.
Affected reference states: PhSources, DeskSources, TvSources, TvSourceDetails,
and queue-origin TvTitle. Native Tizen/Vizio/webOS evidence remains unverified.

| Contract/state | Browser functional evidence | Visual evidence and disposition |
| --- | --- | --- |
| PhSources / DeskSources / TvSources description window | Chromium responsive fixture checked equal row heights, exactly two clipped lines, long unbroken filename, full button label, focus motion, and reduced motion. SolidTV TvSources preview passed source paging, filters and Back. | Private 390 px phone and 1920×1080 SolidTV captures inspected; no matched reference metric. Implemented, browser reviewed; device unverified. |
| PhSources / DeskSources / TvSources discovery | Chromium delayed fixture observed `Finding sources` before a row, `Still checking sources` and a usable row while pending, then spinner removal at completion. SolidTV model unit test covered empty/partial/done transitions; TvSources preview displayed the pending spinner with rows. | Stable status placement inspected in private captures; no matched reference metric. Implemented, browser reviewed; real provider timing unverified. |
| Continue Watching episode source Back / parent title | Chromium 390 px fixture checked queue episode source → parent series detail → another episode source → detail → focused Home queue card; a forced parent-metadata 503 offered Retry and returned to the same card. SolidTV TvLibrary preview checked source Back → focused episode detail → originating library card; existing 700 ms hold and explicit source/Resume intent assertions passed. | Parent title and source captures inspected locally; focus and return exercised in fixtures. Physical remotes and installed clients unverified. |

## SRC-PROVIDERS-001 — 2026-10-01

Design pin `d088071106e4d5479aea761469152e037f011a3c`. React and SolidTV source pickers retain each observed account add-on ID as a separate provider choice, including producers with no playable rows. Stable filter keys come from the shared core `sourceDisplay` projection; installed names come from the account add-on list. A zero-result selection reports pending, unsupported format, or safe failure state without promising torrent playback.

| Surface | Browser/model evidence | Remaining boundary |
| --- | --- | --- |
| React TvSources | Chromium Vizio fixture: Torrentio TB HTTP row remained usable while Torrentio and TorrentsDB returned unsupported formats. A second fixture added seven producers while the menu was open; Cancel retained focus, the seventh was selectable, and a distinct source description remained accessible in the row and details. Private 1920×1080 capture inspected. | Live account add-ons and physical Vizio remote unverified. |
| SolidTV TvSources | Model tests checked core-derived filtering, full source body and seven-producer windowing. SolidTV Vizio browser preview selected the seventh provider using six native focus nodes; a private 1920×1080 capture was inspected. | Physical Tizen/Vizio/webOS provider panel and real add-on timing unverified. |
## WEB-PLAYER-FIT-001 — responsive player picture mode (2026-10-02)

Design `02fbcdd24a5a32f0ee87e97ede83c7e30345c833`; PhPlayer and DeskPlayer reference families with the normative Fit/Fill amendment in `specs/behavior/responsive-player-fit-fill.md`.

| Surface | Functional and visual evidence | Device evidence / limit |
| --- | --- | --- |
| Responsive website phone, 390×844 | Decoded HLS Chromium scenario: Fit full picture and centered Fill crop inspected privately; five controls fit, keyboard/touch toggle, source return retains mode, leaving and returning resets Fit | Browser simulation; physical phone unverified |
| Responsive website desktop, 1440×900 | Decoded HLS Chromium scenario: button and both video/canvas CSS modes, paused session unchanged, Enter/Space focus, fullscreen retention and back to Fit | Browser simulation; real MediaBunny decoding and installed desktop host unverified |
| Tizen/Vizio remote player | No Fit/Fill change; original remote actions and player geometry retained | Device playback unverified for this amendment |
# Responsive pending Home/Discover — 2026-10-02

Design `1742afa`, existing DeskStates Home/Discover skeleton geometry. Slow
catalog HTTP boundaries retain the appropriate empty Home or Discover layout,
saved Home cards remain usable, cold Discover routing completes before optional
Home content, and browser Back reloads cancelled optional data. Four full
React/API regressions pass. All seven DeskStates cells were reached and
privately inspected at 1440×900 over trusted local HTTPS with API/media mocks.
This adds a scoped composite-state inspection; native/installed and uniform
visual parity remain unqualified. DeskPlayerRestore's separate browser fixture
qualification is recorded below.

# Populated responsive source rows — 2026-10-02

Twelve-entry source pickers preserve their existing100px desktop/108px phone
rows without overlap at1440×900/390×844, scroll and reach the final row. Both
public UI/HTTP cases are red before/green after the responsive-only flex fix;
existing two-line/focus/reduced-motion behavior passes. TV layout and source
semantics are unchanged; native/hardware and uniform pixels remain separate.

# Desktop restoration failure fixture — 2026-10-02

At 1440×900 over trusted local HTTPS, explicit Next fails its candidate and
outgoing restoration, and the existing recovery dialog presents Retry, Choose
source and Back over the bare picture. Distinct playback lease IDs preserve
the outgoing viewer during candidate cleanup; disabling the unstubbed MSE path
ensures all local paths fail as requested. This corrects the old preview timeout.
The responsive dialog also carries the drawn Retry icon and suppresses duplicate
failure toast feedback. Retry preserves the outgoing source/position; Choose
source and Back do not admit playback. The final board was privately
inspected. Delayed external-video failure after Back cannot overwrite newer
feedback/busy state, while an owned deadline still offers recovery. These two
public-stage regressions pass; the cancelled case failed before the ownership
fence. All47 board inspections remain scoped across their recorded revisions.
This includes DeskStates' seven separately matched cells, and is neither uniform pixel parity
nor installed/native failure recovery or hardware acceptance.

# SolidTV Live empty-state arrival

| Contract | Functional browser evidence | Visual evidence | Device evidence |
| --- | --- | --- | --- |
| LIVE-EMPTY-13; design `8b7f85941addf5a65390fe6eca4f11aba9584a17` | Four HTTPS Chromium cases cover no-source/no-channels with initial navigation/action focus, revision-driven channel arrival, first-row focus and Down to the next row. Disabling arrival focus makes the regression fail. | With reduced motion disabled, observed arrival frames contain the first row at x 96, y 636, opacity 1, with no intervening loading frame or screen navigation. This is scoped frame geometry, not uniform screenshot parity. | Tizen, Vizio and webOS unverified; mocked HTTP only. |

# SolidTV channel-page failure ownership

Implementation `4cf36237e70b387aacad8a3c5521d5f2ee9eaf9e`;
[execution](https://github.com/viptv-org/tv-web/issues/74); design
`8b7f85941addf5a65390fe6eca4f11aba9584a17`. Local run logs:
`/tmp/viptv-74-final-min.log`, `/tmp/viptv-74-other.log`,
`/tmp/viptv-74-search-retry.log`, `/tmp/viptv-74-matrix.log`,
`/tmp/viptv-74-seven.log` and `/tmp/viptv-74-search-seven.log`.

| Scenario | Browser functional evidence | Reference metric | Tizen | Vizio | webOS | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| Live/Search page failures and bounded traversal | Thirteen scoped HTTPS Chromium cases pass with mocked HTTP, including four short-page timeout/retry cases, original reverse/revision cases, 200 groups, bounded guides and Search's complete 480-input seven-page roundtrip with playback, exact requests and bounded payloads. | Unmeasured; focus/data assertions only. | Unverified | Unverified | Unverified | Verified for the stated browser scenarios. |
| Live seven-page roundtrip | Forward 0→240, fixture playback, return focus and reverse 240→70 pass: 410/480 verified directional inputs. The 180-second host deadline prevents final return/request-order qualification. | Unmeasured. | Unverified | Unverified | Unverified | Partial on the software WebGL host; no input-latency or hardware claim. |

# Shared Roku/browser playback and rendering sweep

| Scenario | Browser evidence | Roku evidence | Limits |
| --- | --- | --- | --- |
| Seek and source lifecycle | Four controller regressions; Chromium playing/paused FF, repeat suppression, retained playback on replacement failure, explicit retry and authorization fences pass | HLS clock advances; pause, paused FF/resume and playing FF exercised on TCL 50S435/C157X, OS 16.0.4 | Native intro/recap markers and buffering auto-hide unverified |
| Artwork, opacity and layering | Production build and beta screen traversal; real 1920×1080 HLS decoding | Private captures reviewed for Home hero/gradient, labels, square surfaces, source drawer and Settings; opaque grounds excluded from backdrop scrims | Hardware video-plane picture and scrim darkness, matched Android/reference metrics unverified |
| Profile menu and Settings | Regression reaches Settings with zero sources; preference writes, calibration, late-save focus and screen saver tests pass | Beta pairing/profile selection, Settings entry and tab changes exercised | Native idle screen saver and forced error-card recovery unverified |
| Calendar and wider navigation | Calendar route reached; 29 focused browser scenarios have combined passing evidence as recorded in TESTING.md | Live guide exercised; populated Calendar unverified | Two exploratory Search failures and older fixed-index Live empty fixtures remain outside the passing set; no other TV hardware qualified |

# Roku performance ownership and pacing

| Scenario | Automated evidence | Roku evidence | Limits |
| --- | --- | --- | --- |
| Frame pacing, synchronization and visual ownership | Injected-work/pause/easing regressions; 60 updates per 60 simulated ticks; affected-subtree and shallow motion-group updates; one Poster/URI per artwork primitive | Beta Home/rows/source-drawer smoke on TCL 50S435/C157X, OS 16.0.4 | Render+swap p95 22.04 ms over 758 frames; 16.67 ms target unmet, no sustained-FPS claim |
| Image decode/readiness and background swaps | Native observer and stale-callback tests, opaque handles, size hints before URI, compact packaged masks, proxy variants, bounded two-frame handover | Home imagery and row-preview changes captured privately | Same-origin network bytes are unchanged; only native decode is resized without a server transformation contract |


## Roku-first performance checkpoint

| Area | Headless evidence | Physical evidence / remaining gap |
|---|---|---|
| Native ancestor coordinates | Mounted coordinates, 27 direction combinations, reparenting and linear traversal bound pass in both native hosts | Candidate starts and renders Home; one navigation comparison shows no meaningful stall reduction |
| Vertical scrolling | Native adapter logic is testable without hardware | Timer gaps still reach about 700 ms in the fixed-key run; smooth motion remains unqualified |
| TypeScript runtime | SDK in-memory component testing is available; native boundary tests pass | Hermes CPU profiling works on the real device; in-memory tests do not establish firmware or GPU parity |

| Home shelf/card reuse | Seven-row reversal plus horizontal slot wrap retain shelf/poster IDs and display changed artwork; all seven polish cases pass | Corrected native background/poster ordering inspected; ten-key timer maximum remains 795 ms, so motion acceptance is open |


## Native motion and preview artwork

| Area | Automated evidence | Physical Roku evidence / limits |
|---|---|---|
| Scroll and hero fade compositor | Native completion, pause/resume, retarget, stale acknowledgement, disposal and nested geometry cases pass | Positions and opacity continue during a measured 1000 ms JS block; presented FPS and overall input latency remain unqualified |
| Proxy backdrop blur | URL effect preservation and private-image transport cases pass; live proxy returns processed image | Softened backdrop and sharp poster inspected |
| Hero portrait placement | Right edge matches profile avatar, at least 48px top clearance, bottom above shelf | Updated 240×360 preview at (1584,144) inspected |
| Shared browser behavior | Eight polish cases pass, including recycled artwork identity and fixed focus | Physical PS4 follow-up remains separate |

| Home My List preview | Existing coherent-artwork cases pass; shelf reuse now also asserts no Home/Library API reads; decode sizing is bounded separately from display size | No list/card refetch observed. Warm preview readiness about205ms vs453–458ms; first observed visit561ms vs788ms. Overall performance acceptance remains open |

| Home focus isolation | Four regressions pass: remembered row/hero return, top-nav isolation, WebGL/Canvas recycled-row reset; identity refresh/clamp/profile clear covered in units | Roku card5 returns at the same x=-2116 offset and header navigation leaves it fixed; broader focus sweep remains open |

## Shared UI focus and recovery audit

| Area | Browser evidence | Device limits |
|---|---|---|
| Catalog/Anime/Library focus | Header and filter navigation keep deep grids stationary; selected identity survives reordered refreshes | Native/browser-TV firmware follow-up pending |
| Detail and Calendar focus | Independent episode/recommendation selections; season/hero return; Calendar date return, empty focus and withdrawn routes/history | No new physical-device claim |
| Source cancellation | Retired discovery no longer consumes a later Back; initial admission cancels to the originating page; outgoing replacement lease remains protected | Actual device cancellation timing remains separate |
| Samsung root Return | Hero, rows, header and signed-out root confirm; Cancel is default; affirmative exit and history/drawer precedence use a simulated application API | Samsung signing/firmware qualification pending |
| Layout and media preservation | Current browse actions/progress, composed welcome, Library controls, compact recovery, consistent selector gaps, centered managed-seek activity, track/style and playback-authority regressions | Exact reported title/provider sequence and physical caption presentation remain unqualified |
| Slow artwork | Initial text and mounted preparation; valid delayed completion beyond 2500ms; coherent replacement and canceled-node retirement | Native callback timing and exact first-title follow-up pending |
| Skip/Playback settings | Intro/Recap range boundaries, visible shortcut/toolbar, paused Select seek, invalid/disabled markers; distinct server settings and device autoplay order/copy | Provider-specific markers and physical shortcut acceptance remain separate |

## Owner-scoped TV presentation refinement

Contract: TV-web #114 and SPEC.md, scoped design amendment
`3eb55db3fd248621bbf56dc30e8718450280c767`, pinned asset snapshot
`059b76344f4fed0639bedf8f89e0bd6e2b22cecd`. Implementation source:
`7c8c0ecdd15ce621ad96b2dcde0a8af8e6fdcac6`. This scope supersedes the older
blurred Home-preview row above for this client.

| State | Functional and visual browser evidence | Device evidence / disposition |
|---|---|---|
| Home hero and Continue Watching | WebGL/Canvas sharp right artwork, black copy region, generated bottom fade, untouched foreground art, prepared-node reuse and bounded preview decoding; exact-baseline private captures inspected | Native package/type checks pass; physical Roku and other TV firmware unverified |
| Hero and shelf indicators | Running/parked off-white geometry, once-through cycle and interruptions; shelf marker outside card clip with safe bottom bounds | Native Back mapping unit passes; native indicator pixels unqualified |
| Detail preparation | Movie/series layout shapes, restrained parent shimmer and static reduced motion; Back rejects abandoned metadata | Browser reviewed; native compile only |
| Source preparation and recovery | Centered clearlogo or title fallback, artwork/progress/cancel, no retained drawer text, guarded artwork preservation; real admission failure/retry, Back cancel and replacement lease cleanup | Browser fixture/decoded-media evidence; physical cancellation timing pending |
| Player controls | Uniform icon size and 12px gaps; menu-first Back, rendered chrome dismissal during playback/seek/buffering/end, continued media, ignored Back repeats and eventual cleanup | Browser/native-key translation verified; physical Roku reproduction remains to be retested |
