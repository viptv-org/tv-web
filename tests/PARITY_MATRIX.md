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
| Settings/source preferences/addons/signout | `tv-shell.spec.ts` — autoplay and quality mutation | Remaining preference options and account-wide add-on copy; add-on install/enable/remove and sign-out are covered in `resilience-settings.spec.ts`; parent-gated select/logout cancellation and approval are covered in `parent-auth.spec.ts` |
| Stale request/session cancellation | `tv-shell.spec.ts` — obsolete Browse response cannot replace current search; `tests/player/*.test.ts` — stale adapter/controller callbacks | Stale pairing/profile/home/source/guide requests and focus restoration cancellation after directional input |
| Offline and partial failures | `tv-shell.spec.ts` — sanitized Discover failure and dismissal | Pairing/profile/source/player/guide offline paths and partial cross-catalog search result retention |

## Evidence limits

`media-decode.spec.ts` uses Chromium's real HTML media decoder with a recorded
WebM fixture. It does not prove a physical SmartCast decoder, Tizen AVPlay,
codec/DRM support, signing, store submission, or backend delivery behavior.
Those remain platform and hardware acceptance work.
