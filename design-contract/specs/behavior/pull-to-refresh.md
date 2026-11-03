# REFRESH-PULL-001 — Phone and tablet pull-to-refresh

Status: **proposed**, owner request 2026-10-26
([app#1](https://github.com/viptv-org/app/issues/1),
[design#23](https://github.com/viptv-org/design/issues/23)). The KMP app
already implements it on phone and tablet layouts. It becomes baseline once
device evidence is recorded.
Source revisions: the gesture is app `b55f942`
([app#35](https://github.com/viptv-org/app/pull/35)): `components/PullRefresh.kt`,
`pullToRefresh()` in `state/ControllerFreshness.kt`, `PULL_REFRESH_SCREENS` in
`App.kt` and the app's `docs/SMART_REFRESH.md` §6. The My List interaction is
app `3aa4a3e` ([app#74](https://github.com/viptv-org/app/pull/74)).

The owner asked for this while the app was being built, so this contract
records what shipped. The evidence is desktop UI tests that drive a real touch
drag on the full app at phone size (`PullToRefreshUiTest`,
`LibraryCollapsingHeaderUiTest`) and controller tests (`PullToRefreshTest`).
No device evidence is recorded yet.

## Intent

Give phone and tablet viewers the standard touch gesture for "show me what's
new now". Pulling down at the top of a page reloads that page from the server
straight away. It does so quietly, like the automatic refresh of
[HOME-ADDON-001](home-addon-refresh.md): the page stays usable, and a failure
leaves it as it was.

## Where it applies

- **Layouts:** native phone and tablet layouts only. TV, the desktop app and
  the browser (at any window width) have no gesture and show no indicator.
  They rely on the automatic refresh: foreground return and the Home check.
  This is a touch addition, not a platform exception, because no layout loses
  an action.
- **Pages:** Home, My List, History and Details.
- **No gesture:** the source picker over Details, Browse (Discover, Movies,
  Series, Anime), Calendar, Live, Search, Settings and the player. Their
  loaders empty the page before reloading, which breaks the rule that a failed
  reload keeps the shown data. They need quiet reloads first.
- On tablet the gesture covers the page area only, not the navigation rail.

## Gesture

The gesture is Material 3 pull-to-refresh with its default indicator. The
values below are the library defaults, not VIPTV tokens. Measurements are in
dp, and "top" means the top of the page area: on phone Home and My List that
is below the phone header.

- **Start:** a touch drag downward while the page's scrolling content is at
  its very top. A downward drag while the page is scrolled down only scrolls
  it back (app#74 test). On My List the page is at its top only with the
  collapsing header fully expanded: the large title (tablet) and the History
  card showing.
- **Pull:** a 40 circular indicator comes down from the top of the page area,
  centred horizontally. It moves at half the finger's speed. Its arrow arc grows with
  the distance. The threshold is 80 of indicator travel, about 160 of finger
  travel.
- **Release before the threshold:** the indicator returns and nothing is
  requested. A pull of 46 of finger travel does nothing (app test).
- **Release past the threshold:** the indicator settles with its bottom edge
  80 below the top (its top 40 below) as an indeterminate spinner, and the
  reload starts at once.
- **Colours:** the indicator disc is `color.surface.2` with Material level-2
  elevation, and the arrow and spinner are `color.text.secondary` with no
  track. These are the app's Material colour-scheme mappings
  `surfaceContainerHigh` and `onSurfaceVariant`. This differs from the
  accent [Spinner](../../viptv-design-system/components.md#3-badges-and-indicators)
  (see [Superseded](#superseded)).
- **Timing:** the indicator's settle and return animations are the library's;
  VIPTV sets no durations. The pull is the one motion [MOTION-001](motion.md#7-pull-to-refresh)
  does not re-time: it is direct manipulation and must track the finger.
- **During a reload:** pulling again does nothing until the indicator ends.
  The page underneath scrolls, taps and navigates as usual.

There are no other inputs. Tap, long-press and Back keep their meanings, and
there is no hold or repeat behaviour.

## What a pull reloads

A pull asks the quiet refresh lane for a full refresh **now**. It skips the
revision check, so it has no "unchanged" short cut and no 2 s coalescing. It
rebuilds Home even when nothing changed. It is the only refresh the viewer
starts, and the only one with an indicator. The rebuild is the same one that
follows playback:

- **Home:** shelves, Continue Watching, profiles and preferences. A catalog
  row the viewer has already paged keeps its loaded tail.
- **My List:** the page on display, with its current list, type and filters.
- **History:** the history list.
- **Details:** the title is fetched again and the episodes already loaded take
  their fresh watched state and progress. The episode list, season, paging and
  focus stay, and art the reply lacks is kept.

The add-on list (Settings › Add-ons) is not reloaded. On a device-local
connection the same pages rebuild from the device's library instead of the
server.

If an automatic check or refresh is already running, the pull's refresh runs
right after it in the same lane, and the indicator stays until both finish.

## States and recovery

- **While reloading:** the indicator spins over the current page. There is no
  global loading cover, no skeleton, no scroll reset and no "refreshing" text.
  An operation the viewer started (a save, a source load, playback) is never
  cancelled.
- **Success:** the new data merges in place. The screen and scroll position
  stay, and focus is not moved. The indicator goes away. Nothing re-enters:
  a finished reload never animates the page
  ([MOTION-001](motion.md#7-pull-to-refresh)).
- **Failure** (network, server error): the shown data stays and no error or
  toast appears. The indicator goes away. The next pull or automatic check
  tries again.
- **Expired session (401):** the app goes to sign-in with the existing
  expired-session message `Session expired. Sign in again.`, as any expired
  session does.
- **Profile, account or connection change during a reload:** the late result
  is dropped (HAF-05). The indicator ends when the lane is idle.

## Return and navigation

- The indicator belongs to the page area, not to one page. If the viewer
  leaves for another page with the gesture while the reload runs (say Home to
  My List), the indicator stays until the reload finishes. Leaving for a page
  without the gesture (Browse, Calendar, Live, Search, Settings, the source
  picker) hides it, and the reload still finishes in the background. Coming
  back while it runs shows the indicator again. Opening the player or the
  profile picker ends the indicator for good: the reload still finishes, but
  coming back shows no indicator.
- Opening the source picker from Details turns the gesture off. Details stays
  composed behind the picker, so closing the picker returns to the same
  Details with the gesture on again.
- Back from Details, My List or History follows the usual return rules. A
  pull changes no navigation.

## Copy

The gesture adds none. The indicator has no label, and nothing reports
success or failure. Only an expired session shows text: the existing
`Session expired. Sign in again.` on sign-in.

## Accessibility

While it spins, the indicator exposes an indeterminate progress value, so
screen readers can announce that the page is busy. The gesture has no
accessibility action. Screen-reader users get fresh data from the automatic
refresh on foreground return and while Home is visible (HOME-ADDON-001).
Reduced motion ([MOTION-001](motion.md#reduced-motion)): the indicator appears
as its disc with a still arc and does not rotate while the reload runs, and the
pull still follows the finger. The arc is the busy report, so it stays until
the reload ends.

## Superseded

No board shows a refresh gesture or rules one out. These rules gain an
exception for the pull indicator:

- **Spinner** (`components.md` §3: "The track is `#45454B` and the arc is
  accent") and the README principle "The accent is for … spinners": the pull
  indicator is the Material default, a `color.text.secondary` arc with no
  track on a `color.surface.2` disc. It is the one non-accent spinner. Every
  other spinner stays accent.
- **HOME-ADDON-001:** a pull is the only refresh the viewer starts and the
  only one with an indicator. Automatic refreshes stay invisible.
- **"Skeletons, not spinners"** (phone research note 8, `components.md` §9,
  the README principle "Loading is a skeleton"): these rules govern first
  loads. The pull indicator is the only spinner over a whole page that is
  already shown. First loads still use their skeletons.

## Acceptance

1. **REFRESH-PULL-01:** on a phone, pull Home down past the threshold. The
   indicator spins and the current Home stays on screen with no cover. The
   rebuilt Home replaces it in place, including a new Continue Watching card.
   The indicator then goes away and no error shows.
2. **REFRESH-PULL-02:** repeat on My List, History and Details on phone and
   tablet. Each reloads, the indicator ends, and the same page is still shown.
3. **REFRESH-PULL-03:** a short pull (released before the threshold) requests
   nothing and shows no spinner.
4. **REFRESH-PULL-04:** pull with nothing changed on the server. Home is still
   rebuilt, with no revision check first.
5. **REFRESH-PULL-05:** fail the reload. The shown data stays, no error or
   toast appears, and the indicator ends. A later pull succeeds.
6. **REFRESH-PULL-06:** pull with an expired session. The app goes to
   sign-in and shows `Session expired. Sign in again.`
7. **REFRESH-PULL-07:** pull while an automatic check is running. The forced
   refresh runs after it, and the indicator ends only after its own rebuild.
8. **REFRESH-PULL-08:** scroll My List down so History and the title collapse,
   then drag down. The list scrolls back and nothing reloads. A pull from the
   very top reloads.
9. **REFRESH-PULL-09:** on TV, the desktop app and a browser (wide or phone
   width), the same drag requests nothing and shows no indicator. On Browse,
   Calendar, Live, Search, Settings and the source picker it does nothing
   either.
10. **REFRESH-PULL-10:** pull on Home, then go to My List before the reload
    ends. The indicator shows there until it ends. Go to Browse instead and
    it is hidden. Return to Home and the refreshed data is shown.
11. **REFRESH-PULL-11:** on Details, open the source picker. A drag does
    nothing. Close the picker: the same Details returns with the gesture on,
    and a pull reloads it.
12. **REFRESH-PULL-12:** pull, then switch profile before the reload ends. The
    old profile's result never shows in the new profile, and the indicator
    ends.

## Unknowns

- No device evidence yet. The phone emulator was signed into the owner's
  profile, so app#35 recorded desktop renders of the phone layout instead.
- The library defaults (threshold, drag resistance, elevation, animation
  timing) follow the Compose Material 3 version the app builds with. They
  have not been measured on a device.
- Whether the still arc under reduce motion reads as busy without the
  rotation is unverified; the disc and the progress value are what announce it.
- The browser case of REFRESH-PULL-09 rests on the layout rule (no gesture
  without a native touch layout). The app tests drive only the desktop and TV
  layouts.
- A single drag that starts scrolled down and reaches the top: whether the
  rest of it counts toward the pull is untested.
- On a page whose content does not scroll (for example the My List empty
  state below the pinned controls), whether a drag outside the list starts a
  pull is untested.
- After a refresh, a new first card in a Home row can sit partly off-screen to
  the left ([app#26](https://github.com/viptv-org/app/issues/26)). The
  automatic refresh does the same.
- iOS shares the phone and tablet layouts, but nothing has been run there.
- No canvas board shows the indicator.
