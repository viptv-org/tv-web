# MOTION-001 — Motion for pointer and touch layouts

Status: **proposed**, owner request 2026-10-29
([design#39](https://github.com/viptv-org/design/issues/39)). Nothing below is
implemented yet. TV is unchanged by this contract.

Source revision: design `ec0a430` for the tokens and component rules; app
`d2db87f` for the code each item changes: `components/ReducedMotion.kt`
(`motionSpec`, `LocalReducedMotion`), `components/FadeThrough.kt`,
`components/SearchableSelect.kt` (the phone sheet), `components/PopoverMenu.kt`,
`features/home/HeroCarousel.kt`, `features/home/HomeScreen.kt`,
`features/player/PlayerScreen.kt`, `components/PullRefresh.kt`.

## Intent

TV cannot afford much animation: every frame it spends is a frame the decoder
needs. Phone, tablet, the desktop app and web have room, and they currently
have almost none: pages swap in one frame, cards have no hover or press
transition, overlays appear and disappear instantly, and the player's controls
switch on and off. The result reads as abrupt rather than fast.

This contract adds the smallest set of motions that answers "where did that
come from, and where did it go": a page crossfade, an overlay arriving from its
own edge, a press that acknowledges the finger, a list that settles in once,
and player controls that fade. Nothing loops, bounces, overshoots or parallaxes,
and nothing delays an action: every state change (a chip's value, a pick, a
save, navigation) happens at the start of the motion, never at its end.

## Where it applies

| Layout | Pointer or touch | This contract |
|---|---|---|
| Phone (native, iOS) | touch | yes |
| Tablet (native, iOS) | touch | yes |
| Desktop app (Tauri) | pointer | yes |
| Web (any window width) | pointer | yes |
| TV (Android TV, TV-web) | remote | **no**: TV keeps the motion it has |

"Pointer" means a mouse or trackpad: hover exists, the cursor is a hand over
anything clickable. "Touch" means no hover and no cursor; the pressed state
replaces it.

TV's own motion (its player control fades, its drawer and billboard
transitions) is recorded where TV behaviour lives and is not restated here.
This contract neither adds to it nor changes it, and no item below has a TV
column.

## The scale

Five durations and two easings. The values are
[tokens](../../viptv-design-system/tokens/tokens.json) and are the only
durations this contract uses; a component never sets its own.

| Token | Value | Used for |
|---|---|---|
| `motion.response` | 120 ms | Anything the pointer's own movement causes: hover fills, press scales, a chip filling, a carousel dot resizing |
| `motion.arrive` | 200 ms | Content arriving in place: a list item, a hero slide, a page crossfade, a popover or dialog, player controls |
| `motion.leave` | 200 ms | Everything leaving, at every size |
| `motion.panel` | 300 ms | A bottom sheet or a drawer entering from its own edge |
| `motion.stagger-step` | 30 ms | Delay between two list items entering in one row, eight items at most |
| `motion.easing-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Decelerating: everything arriving and every state change |
| `motion.easing-exit` | `cubic-bezier(0.3, 0, 1, 1)` | Accelerating: surfaces leaving |

Leaving is never slower than arriving, so an exit uses `motion.leave` whatever
the surface's size. The desktop keyboard focus ring keeps its existing
`motion.focus` (150 ms); press scales are the existing `motion.pressed-scale*`
tokens (0.97 buttons, 0.99 full-width rows, 0.98 cards, 0.94 player transport
and tools).

Distances are geometry, not tokens: a list item rises 8, a popover and a
dialog scale from 0.98, a sheet travels its own height and a drawer its own
width. Nothing moves further than that and nothing moves on TV.

## Reduced motion

Every duration and easing above is read through the app's existing
`motionSpec()` (`components/ReducedMotion.kt`), which returns `snap()` while
`LocalReducedMotion` is set. Under reduce motion every item below changes in
the same frame as its state change: no fade, no travel, no scale, no stagger,
no crossfade. Nothing is skipped, reordered or delayed, and no content appears
later than it would have.

What still runs, because it reports time or work rather than decorating a
change:

- progress bars and spinners (the hero's slide progress, the pull indicator's
  arc, loading spinners);
- the hero carousel itself: slides still rotate, and the progress bar still
  fills;
- the Up Next countdown, which keeps its number and drops its ring
  ([PLAY-NEXT-AUTOPLAY-001](next-episode-autoplay.md#countdown)).

Colour, opacity and fill states still apply instantly: a hover fill, a set
chip, a watched badge and a focused ring all keep their meaning.

Reduce motion follows the platform preference — Android animator scale 0, iOS
Reduce Motion, browser `prefers-reduced-motion`, the desktop OS setting
(macOS Reduce motion, Windows client-area animations, GNOME animations) — and the device Display
record's **Reduce motion** value where that row exists (TV). Non-TV layouts
have no such row, the same as [PLAY-NEXT-AUTOPLAY-001](next-episode-autoplay.md#countdown)
records. A desktop setting the app cannot read counts as motion allowed.

## 1. Page and screen transitions

**Motion.** The page area crossfades: the outgoing page fades out over
`motion.response` (120 ms) while the incoming page fades in over
`motion.arrive` (200 ms), `motion.easing-standard`. Nothing moves, nothing
scales and the two pages never both sit at full opacity. The page's own layout is final from its first frame,
so nothing reflows during the fade.

**What stays put.** The phone bottom nav, the phone header, the desktop title
bar, the desktop rail and the tablet rail do not animate on a page change; only
the page area between them crossfades. Inside that chrome, the bottom nav's
current pill and the rail's current-item fill change over `motion.response`
(120 ms) instead of switching in one frame; the pill does not slide between
tabs, because it has no shared position to travel from.

**No transition at all** in these cases, where a fade would show a page
fading out of a place it never left:

- Sources opening over Details, or a drawer over the Details dialog: the page
  under the overlay is never removed, so there is nothing to fade, and the
  overlay has its own motion (§4);
- the player opening and closing: it replaces the whole shell in one frame,
  because fading a page under a starting video shows a ghost frame;
- startup, the startup cover, sign-in and the profile picker.

**Entry and exit.** Every page change a viewer can start uses this: the nav
rail, the phone bottom nav, a card or title tap, Back, and the See all action.
Back is a page change like any other and keeps the page it returns to exactly
as it was left (scroll position, filters, focus target).

**Focus and cancellation.** Focus is set on the incoming page in the frame it
composes, never after the fade; a fast keyboard user is never waiting on an
animation. Back during a fade starts the next fade from what is on screen.

**Reduced motion.** The page swaps in one frame.

**Platforms.** P, tablet, D. Not TV.

## 2. Card hover and press feedback

**Hover (D only).** The hover treatment is already drawn: art dims to 0.38, the
accent play disc and the inset 2 px off-white ring appear
([components.md §6](../../viptv-design-system/components.md#6-cards-and-tiles)).
It gains a transition: the scrim, the ring and the disc fade in over
`motion.response` (120 ms, `motion.easing-standard`) and fade out over the same
duration. The card does not scale, lift or move on hover, and nothing outside
the art frame changes on hover.

**Press (P, tablet, D).** Pressing scales the pressed surface to its token
value — a card to 0.98, a button or icon button to 0.97, a full-width row to
0.99, a player transport or tool control to 0.94 — over `motion.response` on
the way down and back to 1 over `motion.arrive` on release. The scale is
centred on the pressed surface, so the card's caption and its slot in the grid
never move. A press that turns into a drag (scrolling a shelf, swiping a
sheet) returns the scale at once and does not activate.

On touch the press scale is the only feedback before activation; on pointer it
sits under the hover fill. Buttons, chips and rows keep their existing hover
and pressed fills, and those fills change over `motion.response` too.

**The card preview (D).** The hover preview and the card menu are popovers
(§4): they fade in with their own overlay motion instead of appearing in one
frame. Their 450 ms hover dwell, their 180 ms dismissal grace and their
position above the 12 dp gap are unchanged.

**Reduced motion.** No scale and no fade; the hover fill, ring and disc appear
at once and the pressed fill applies at once.

**Platforms.** P, tablet, D. Not TV: TV focus is instant and never changes an
element's size.

## 3. The hero carousel

**What does not change.** The slide interval is 8 s, the artwork is decoded
before its interval starts, the progress bar fills over the interval, and the
carousel pauses while the pointer is on a Continue Watching card (§6) and
resumes where it paused. The dots stay non-interactive.

**Motion.** On a slide change:

- the outgoing artwork stays until the incoming artwork is decoded, then the
  two crossfade over `motion.arrive` (200 ms, `motion.easing-standard`); there
  is never a blank or half-loaded hero;
- the logo, title, meta line, description and actions crossfade over the same
  200 ms, as one block, with no travel;
- the active dot grows from the inactive dot's width to its pill width over
  `motion.response` (120 ms); the other dots do not animate and nothing slides.

**The hero never resizes.** A slide with a shorter title, a logo instead of a
wordmark, or a Continue Watching preview never changes the hero's height or
moves the rows below it. The hero's footprint is fixed before the first slide
is drawn.

**Reduced motion.** Artwork, logo and text snap to the new slide; the progress
bar and the dot still update, because they report when the next slide comes.

**Platforms.** P, tablet, D. Not TV: its billboard keeps its own transitions.

## 4. Opening and closing sheets, drawers, popovers and filter chips

The containers are the ones in
[components.md §8](../../viptv-design-system/components.md#8-overlays); only
their motion is new. In every case the page behind the overlay does not move,
dim progressively on its own, scale down or slide, and the overlay's own
content (grabber, title, rows, fields) never animates separately from its
container.

| Container | Enter | Exit |
|---|---|---|
| Phone bottom sheet (filters, card actions, remote) | container travels its own height from below to its resting place over `motion.panel` (300 ms, `motion.easing-standard`); the scrim fades 0 → its alpha over `motion.arrive` | container travels back over `motion.leave` (200 ms, `motion.easing-exit`); the scrim fades out over `motion.leave` |
| Tablet and desktop drawer, including the source drawer | travels its own width in from the right over `motion.panel`; the scrim fades over `motion.arrive` | travels back over `motion.leave`; the scrim fades over `motion.leave` |
| Centred dialog | fades in from 0.98 scale over `motion.arrive` | fades out to 0.98 over `motion.leave` |
| Anchored popover (card menu, card preview, chip list on D and tablet) | fades in from 0.98 scale over `motion.arrive`, anchored to its control's edge | fades out over `motion.leave`, without travel |
| Filter chip's list | whichever container the layout uses, above | the same container's exit |

**A pick applies at once.** A chip's value, a source, a toggle and a
single-choice pick all take effect and update the control in the frame they are
made; the overlay's exit follows. A closing overlay never leaves the control
showing a stale value, and an applying filter reloads the page from the first
item while the overlay leaves (§5 covers what the reloaded list may animate).

**Focus and dismissal.** The overlay's content is focusable from its first
frame, so a keyboard user can type or pick without waiting for the motion. On
close, focus returns to the control that opened it at the start of the exit,
not after it; the phone sheet's soft keyboard is raised or dismissed with the
same rule. Escape, Back, the scrim and a pick all use the same exit. A close
that arrives mid-open (Back before the sheet has settled) runs the exit from
wherever the container is, and never jumps to the open position first.

**Reduced motion.** Every overlay and its scrim appear and disappear in one
frame.

**Platforms.** P, tablet, D. Not TV: its right panel and its drawer keep their
own motion.

## 5. List items entering on load or refresh

**First load of a page.** Each item (a card, a source row, an episode card, a
live tile, a settings row) enters with a fade over `motion.arrive` (200 ms) and
an 8 dp rise, `motion.easing-standard`, delayed by `motion.stagger-step`
(30 ms) per item in the same row, at most eight items. The ninth and later
items in that row enter with the eighth, so a long shelf settles in about
410 ms. A row's heading enters with its first item and is not staggered
separately. The row occupies its final position from its first frame: the rise
is a translation, never a height, so nothing below it moves and no scroll
offset changes.

A skeleton that is replaced by real content crossfades in place over
`motion.arrive`, with no rise: the shape is already there.

**Refresh** — a pull (§7), the automatic refresh, or a foreground return —
never re-animates what was already shown. Items that survive the refresh are
updated in place with no fade; an item that is genuinely new crossfades in
where it belongs, over `motion.arrive`, without a rise and without a stagger,
so a refresh never looks like a page load.

**Never animated:** items appended by paging or scrolled into view, items
returning with a restored page state, and anything drawn on the player.

**Reduced motion.** No fade, no rise and no stagger: items appear as they
arrive, in the same frames as today.

**Platforms.** P, tablet, D. Not TV, which draws its own arrival and keeps it.

## 6. Continue Watching hover into the hero

**Entry (D only).** Pointing at a Continue Watching card on Home replaces the
featured hero with that title's hero, as it does today. The hero slot crossfades
between the featured slide and the preview over `motion.arrive` (200 ms,
`motion.easing-standard`), art, logo, text and actions as one block, and the
carousel's timer pauses while the preview is shown.

**Exit.** Pointing away from the row (or onto a different Continue Watching
card) crossfades back, or to the other preview, over the same 200 ms; the
carousel resumes from where it paused rather than restarting its 8 s interval.
The swap follows the pointer with no added dwell: the card's own 450 ms preview
popover is the only dwell on this interaction, and a hover shorter than that
still swaps the hero.

**Nothing else moves.** The hero keeps its footprint, the rows below never
shift, the carousel dots stay with the featured slide and are not drawn for the
preview, and the preview never scrolls the page.

**Touch and TV.** No hover means no preview: tablet and phone keep the hero they
have, and TV keeps its own behaviour.

**Reduced motion.** The hero swaps in one frame, in both directions.

## 7. Pull-to-refresh

[REFRESH-PULL-001](pull-to-refresh.md) owns the gesture, the threshold, what a
pull reloads, the failure behaviour and the return rules; its motion is the
Material 3 library's and stays that way. This contract adds three things.

- **The gesture is exempt from the scale.** A pull is direct manipulation: the
  indicator tracks the finger at half its speed and the library's settle and
  return animations are kept as they are. Re-timing them to `motion.panel` or
  `motion.arrive` would make the indicator lag the finger.
- **A reload does not re-animate the page.** After the indicator ends, the
  shown content is updated in place; new items follow §5's refresh rule and no
  item re-enters, so the page never looks like it reloaded.
- **Reduced motion.** The indicator appears as its disc with a still arc and
  does not rotate while the reload runs; the pull itself still follows the
  finger. The arc is the busy report, so it stays visible until the reload
  ends.

**Platforms.** Phone and tablet only, as REFRESH-PULL-001 defines. D and TV have
no gesture and no indicator.

## 8. Player controls showing and hiding

**Motion.** The whole control layer — the header, timeline, transport, tools
row, lock button and any scrim the layout draws — fades in over
`motion.arrive` (200 ms, `motion.easing-standard`) and out over `motion.leave`
(200 ms, `motion.easing-exit`), as one layer. Nothing slides in from an edge,
nothing scales and no group of controls animates on its own.

**The video frame never animates.** No zoom, no letterbox or fit-mode
animation and no dim of the picture of its own: the layer's own gradient
travels with the layer, and nothing else changes over the video.

**Timing and interaction.** The 5 s idle timer, the rule that a paused,
buffering, failed or open-panel player keeps its controls, and the rule that a
key or a tap shows them (a tap on the picture toggles them) are unchanged. The
fade starts in the frame the state changes; there is no delay before it and no
second timer.

**Panels.** A phone panel over the player (Episodes, Audio & subtitles, the
failure panel) fades in over `motion.arrive` and the control layer returns when
it closes, by the same fade. The lock button follows the layer it belongs to.

**Up Next.** The end panel keeps its own contract: the countdown ring is
progress, so it keeps emptying, and reduce motion leaves only the number
([PLAY-NEXT-AUTOPLAY-001](next-episode-autoplay.md#countdown)).

**Reduced motion.** The control layer appears and disappears in one frame.

**Platforms.** P, tablet, D. Not TV: its controls keep their own 200 ms fade in
and 300 ms fade out.

## What never moves

- The video frame, in any state.
- The page behind an overlay, and the hero behind a Continue Watching preview.
- Card captions, row positions, the hero's height and any scroll offset.
- A list's layout as items enter: the rise is a translation only.
- Focus. Focus rings change appearance; they are never animated into place.
- TV. This contract adds nothing to it.

There is no bounce, spring, overshoot, parallax, autoplaying decoration or
ambient motion in this contract, and no motion at all on a first frame after
startup.

## Copy

None. No item in this contract adds, changes or removes a visible string, and
nothing announces motion to the viewer.

## Accessibility

- **Nothing waits on motion.** Navigation, a pick, a save, a chip's value, a
  panel's content and focus are all effective at the start of the motion.
- **Reduce motion** is honoured on every platform (§Reduced motion). It removes
  motion, never information: the hero's progress, the pull indicator's arc and
  the Up Next number all remain.
- **No flashing** and no repeating motion outside spinners, the skeleton
  shimmer and progress bars.
- **Assistive technology** is unaffected: no item adds or removes a semantics
  node, an announcement or a focus stop, and a fade never hides a control from
  the accessibility tree.

## Acceptance

1. **MOTION-01:** on the desktop app, go Home → a title's Details → Back. The
   page area crossfades over about 200 ms, the rail and title bar stay still,
   and the restored page has its old scroll position and filters from its first
   frame. No page is ever half-faded with the other one behind it.
2. **MOTION-02:** on a phone, switch bottom-nav tabs. The pill's fill changes
   over about 120 ms, the pill does not slide, and the page area crossfades.
   Open Sources over Details and close it: Details never fades.
3. **MOTION-03:** with a mouse on a desktop card, the scrim, ring and disc fade
   in over about 120 ms and the card does not move. Press and hold a card, a
   button and a player control: each scales to 0.98, 0.97 and 0.94 and returns
   on release, and the caption and grid never shift. Press and drag a shelf:
   the scale returns and nothing opens.
4. **MOTION-04:** on a phone, press and hold a card: it scales to 0.98 with no
   hover state; release opens it. A long press that becomes a scroll cancels
   the scale.
5. **MOTION-05:** let a Home hero with three slides rotate. Each change
   crossfades art, logo, text and actions together with no blank hero frame and
   no row movement; the active dot grows into its pill while the others stay
   dots. A slide whose artwork has not decoded keeps the previous artwork until
   it has.
6. **MOTION-06:** on the desktop app, open a filter chip's list, a card menu
   and the source drawer. The popovers fade in from 0.98; the drawer travels in
   from the right over about 300 ms with the page behind it still. Escape
   returns focus to the opener at once and the exit is about 200 ms. Pick a
   value and the chip reads it before the overlay has left.
7. **MOTION-07:** on a phone, open and close a filter sheet. It rises its own
   height over about 300 ms and leaves over about 200 ms; the scrim fades with
   it. Press Back while it is still rising: it leaves from where it is, without
   jumping open first. Typing works immediately after the open.
8. **MOTION-08:** load Home on the desktop app. Each shelf's items fade in and
   rise 8 dp, 30 ms apart, eight at a time; the headings and rows do not move
   and the scroll position is unchanged. A shelf of twenty cards has fully
   settled in under half a second.
9. **MOTION-09:** pull to refresh on a phone, then let the automatic refresh
   run. Surviving items do not fade or move; a genuinely new item crossfades in
   where it belongs, with no stagger, and the page never looks like it reloaded.
   Scroll a shelf to load its next page: appended cards do not animate.
10. **MOTION-10:** on the desktop app, point at Continue Watching cards. The
    hero crossfades to each preview over about 200 ms, the rows below stay put,
    the dots disappear with the preview, and pointing away returns to the paused
    slide, which continues its interval from where it stopped.
11. **MOTION-11:** on a phone, hover does not exist: the Continue Watching cards
    never replace the hero.
12. **MOTION-12:** play on the desktop app and on a phone. The control layer
    fades in and out over about 200 ms with the video frame unchanged; after 5 s
    idle it fades out, and a key or a tap fades it back in at once. Open and
    close the phone's Episodes panel: it fades in and the controls return.
13. **MOTION-13:** open the player and let an episode end with autoplay on. The
    Up Next ring keeps emptying while the number counts; no other motion is
    added.
14. **MOTION-14:** with the system reduce motion on (Android animator scale 0,
    iOS Reduce Motion, browser `prefers-reduced-motion`), repeat MOTION-01 to
    MOTION-12. Every state change happens in one frame, in the same order and at
    the same time as before; the hero's progress bar, the pull indicator's arc
    and the Up Next number still update.
15. **MOTION-15:** with reduce motion on, pull to refresh on a phone. The
    indicator shows a still arc and does not rotate, the reload still runs, and
    the page updates without any item entering.
16. **MOTION-16:** on TV, repeat the page changes, card focus, drawer, hero,
    list load and player control checks. Nothing changes from today: no
    crossfade, no travel, no scale, and focus still never resizes an element.

## Unknowns

- No board draws any of this motion and none has to: it is timing, not
  geometry. No screen is re-exported for this contract.
- No device or desktop measurement exists. The durations are a proposal read
  against the app's current code (the phone sheet's 220 ms rise, the 180 ms
  artwork dissolve, the TV player's 200/300 fades), not measured against a
  running build.
- The Material 3 pull indicator, `DropdownMenu` and `Dialog` bring their own
  timings. This contract's durations replace them only where the app draws its
  own container, so the popover and dialog items are measured once the app
  draws them.
- Whether a page crossfade disturbs restored scroll or focus on any layout is
  untested; the acceptance scenarios above are the test.
- iOS shares the phone and tablet layouts, and nothing in this contract has been
  run there.
- No canvas or board defines what a "list item" is for a live guide or a
  calendar week; those rows are included by the general rule and may need their
  own pass if a stagger reads badly there.
- Whether a pointer move should reveal the player's controls on desktop and web
  is a behaviour question this contract does not answer: a key or a tap shows
  them today, and the motion only changes how they appear.
- `components.md` §3 draws the active carousel dot as an 18 × 6 pill and the
  others as 6 × 6, while the app draws 48 × 4 and 16 × 4. This contract states
  the motion without settling the geometry, which needs a board.
