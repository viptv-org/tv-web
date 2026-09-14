# Shared TV visual rebuild parity — 2026-09-13

Design: `3ab29a63cbe6369341ee4376f69a59d4cbb38fc8`. Contract IDs refer to [the pinned acceptance index](../design-contract/TV_WEB_UI_REBUILD.md). Local batch: 43 unit tests, 49 browser passes / 33 deliberate platform skips. Implementation/CI revision is recorded in [execution issue #2](https://github.com/viptv-org/tv-web/issues/2) and TESTING.md. Every surface below is implemented; the evidence columns bound what was actually verified.

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
