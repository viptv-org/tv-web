# Visual states and motion

## Focus transition rules

Focus must respond immediately to the remote and never be stolen by late data. It changes fill/outline and starts marquee only for the active element. Row/grid focus uses floating horizontal focus and fixed vertical focus where specified; preserve visible card positions rather than sliding whole pages unexpectedly.

Left from a first content item enters the rail; Right returns to content. Back restores route, filter, page and cursor. An explicit remote input cancels pending focus restoration, preventing delayed snapback.

## Loading

Cold startup/sign-in uses the full splash/loading gate. Once a user can see existing content, loading is local:

| Situation | Visual response |
| --- | --- |
| Hero high-res artwork | Keep the already-decoded low-res card image visible; swap only when sharp art is ready |
| Shelf/card artwork | Neutral title fallback remains; artwork fades/replaces when ready without moving card geometry |
| Source discovery | Retain source list and focus; status + source spinner indicate arrivals |
| Guide schedule | Retain logo nodes and cells; initial visible schedule wait is bounded, then partial schedule can appear |
| Details/catalog/search | Keep route surface and show inline state/retry; do not cover it with a global busy panel |
| Playback open/buffer/seek/next episode | Keep current video frame and player overlay visible; show `LOADING`/spinner in player chrome |

Full-screen busy treatment is reserved for cold states. It must never obscure a live playback frame or make a next-episode transition look like a return to Home.

## Art and data errors

An image load failure retries its original URL once if a resized/proxied request failed. If it still fails, use the component fallback without layout shift: title surface for landscape/episode, initials for profile, channel name for logo, dark hero canvas for hero. Do not repeat retries indefinitely.

Empty shelves are removed. Empty filtered/search/channel/source results remain an explicit, readable message in the existing panel, with the current filters and a route back. Source errors leave `Choose another source`/retry reachable; never silently select a different provider.

## Player lifecycle visuals

Opening/buffering/seeking forces overlay open. The overlay autohides after 7 seconds only while VOD is playing, no scrub preview is active, and it owns focus; paused/buffering/modal states keep it available. Back first closes open controls; a second Back exits. Back during a seek preview cancels the preview.

VOD seek shows a preview marker/thumbnail and target time. Remote repeat accelerates from base steps (Left/Right 10 seconds, FF/Rewind 60 seconds) through 3×, 6×, 15× and 60× multipliers as repeats accumulate; release schedules the 800ms debounced commit. On server-side replacement seek, the old frame stays visible until replacement plays; on failure restore old frame/state.

Next episode is a player-local transition: pause the outgoing episode, preserve its frame and overlay, present `LOADING`, then atomically replace it after source resolution/playback. If next episode is unavailable or user backs out, resume outgoing playback in place and present a truthful dialog (`caught up`, `upcoming`, or unavailable) with Open series/Done. The transition must not show Home underneath or a full-screen spinner.

## Animation character

Use platform focus interpolation sparingly: floating horizontal focus, fixed vertical rows, no decorative bounce. The only continuous motion is focused-text marquee (42–48px/s), busy spinner (1.1s cadence), and player overlay auto-hide timer. Hero metadata updates immediately on focus; the high-res backdrop swaps only once ready. Do not fade the whole page on normal navigation.

## Responsive and accessibility checks

Keep text contrast at the token values, preserve 48px minimum focus target height for remote controls, and ensure focus is discernible without colour alone (white fill/outline plus text inversion). Long labels scroll only when focused. Text must not overlap icon, timeline, or artwork bounds at 200% platform text scaling; use truncation/marquee/line limits as defined rather than shrinking type below the hierarchy.


Selection/current state is text-labelled, never colour alone: wherever the player offers a choice among audio tracks, subtitles or delivery engines, the active entry carries an explicit `Current` label (check plus text) and its accessible name includes "current"; unavailable entries stay listed with a visible unavailable marker. This applies to desktop anchored popups, TV choice dialogs and future settings selectors (RUI-028 in RESPONSIVE_PRODUCTION.md).