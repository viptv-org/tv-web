# Splitting App.tsx — what is done, what is next

`src/tv-solid/remote/App.tsx` is the TV application: one `createRemoteTvApp`
closure that owns every signal and returns the root screen. It started this work
at **3579 lines** and is **1461** now, with the render tree split into three
screen components and six behaviour modules. This note records what has been extracted, and the exact next
slices so the remainder can be done mechanically instead of by feel.

## Extracted so far

| Module | Lines | Owns |
| --- | --- | --- |
| `remote/layout.ts` | 40 | the logical frame, the shared edges and gaps |
| `remote/hero-stage.ts` | 90 | the ambient band, its fade and the carousel line |
| `remote/player/skip-intro.ts` | 75 | the skip offer window, its rect and the shared seek |
| `remote/player/segments.ts` | 70 | skip markers, the active window and the offer clock |
| `remote/calendar-scene.ts` | 22 | calendar snapshot, day and day entries |
| `remote/settings-scene.ts` | 190 | the nine Settings boards, their reload and profile management |
| `remote/render/entry.tsx` | 40 | welcome, pairing and the signed-in confirmation |
| `remote/render/profiles.tsx` | 24 | who is watching |
| `remote/render/calendar.tsx` | 24 | the calendar board |
| `remote/render/home.tsx` | 24 | the featured title and its shelves |
| `remote/render/detail.tsx` | 17 | one title's page |
| `remote/render/browse.tsx` | 125 | catalog, library and search, with their toolbars |
| `remote/render/live.tsx` | 81 | the Live screen and its three empty forms |
| `remote/render/player.tsx` | 59 | the skip offer, the busy surface and the control row |
| `remote/render/overlays.tsx` | 190 | the drawer, preparation, error card, toast and idle saver |
| `remote/hero-scene.ts` | 171 | the featured card, the carousel, the shelf preview and the billboard pass |
| `remote/player-chrome.ts` | 104 | the control row's buttons, their two layout groups, the selection clamp and the auto-hide clock |
| `remote/live-scene.ts` | 284 | the Live page: four forms, guide window, group loader, first-request timeout |
| `remote/detail-scene.ts` | 71 | one title's page and its two remembered lists |
| `remote/paging-scene.ts` | 121 | one machine for a page request and the focus it asked for |
| `remote/search-scene.ts` | 130 | the query, its per-provider rows and its channel column |
| `remote/player-scene.ts` | 225 | the engine, transport keys, episode preparation, Up-next and its countdown |
| `remote/source-picker-scene.ts` | 137 | the drawer's list, filters, menu, failed rows and prewarm |
| `remote/source-play-scene.ts` | 216 | the play intent, the attempt that owns it, and the stream that starts |
| `remote/navigation-scene.ts` | 300 | the history stack, navigation, restore and the detail open |
| `remote/stremio-home.ts` | 31 | the Simkl-off rules for rows, featured and catalogs |
| `remote/back-scene.ts` | 208 | the Back key's ordered decision tree and leaving the player |
| `remote/session-scene.ts` | 227 | startup, bootstrap, profile reset, revisions and pairing |
| `remote/activate-scene.ts` | 290 | the Select key's ordered answer |
| `remote/menu-scene.ts` | 129 | the menu key and the hold's identity |
| `remote/debug-surface.ts` | 111 | the facts a browser session reads |
| `remote/input-scene.ts` | 165 | the D-pad's controller order and the on-screen keyboard |
| `remote/live/program-line.ts` | 20 | a guide slot that never prints an out-of-range minute count |

`App.tsx` is **1461 lines** after those. Each extraction is a factory that takes
an explicit dependency object; nothing reaches back into the closure.

## Why this is not one big diff

The closure is the app's state machine: paging, focus, navigation and playback
orchestration all read and write the same twenty signals, and the browser tests
that cover them (500 unit + ~200 Playwright cases) are the only thing that
proves a slice is safe. A slice is therefore done only when its spec file is
green, and each slice must move *behaviour with its state* — moving state alone
would just replace one global bag with another.

## Next slices, in dependency order

Each row lists what must be handed over; the shapes are already visible in the
`createX` factories that exist today.

1. **`live-scene.ts`** (~250 lines): `livePages`, `liveGroup`, `groups`,
   `liveIdentity`, `liveSpread`, `liveViewer`, `liveEmptyFocus`,
   `liveRecovery`, `guideInfo`, `liveChannelIndex`, `guideRowStart`,
   `currentProgram`, `guideWindow`, `guideStart`, `adoptLiveSnapshot`,
   `loadLiveFirstPage`, `loadLiveGroup`. Needs: `api`, `scope`, the programs and
   channels signals, `loading`/`error`, `navIndex`, `edgeRequest`, and the
   paging helpers (`moveToItem`, `more`).
2. **`paging-scene.ts`** (~200 lines): `pagingScope`, `pendingFocus`,
   `pageSignal`, `restartPaging`, `moveToItem`, `settlePendingFocus`,
   `channelPending`, `channelRetry`, `adoptChannelWindow`. Needs: the page and
   catalog signals, `zone`/`column`/`row`, `loading`, `error`.
3. **`player-scene.ts`** (~350 lines): `playIntent`, `playSource`,
   `startSourceCandidate`, `advanceEpisode`, `leavePlayer`, `revealEndedControls`,
   `dismissNext`, the countdown and the episode preparation. Needs: `player`,
   `playerTransport`, `overlays`, `notify`, `fail`, `retry`, `sources`,
   `activeAction`, `activeChannel`, `devicePlayback`, `preferences`.
4. **`render/`** (done): every screen block is its own component. App's render
   body is now the chrome, a dispatch list and the overlays.

   What was *not* done, deliberately: pulling the whole `render: () => (…)` body
   out as a **single** component. That move needs ~110 bindings, has one call
   site and hides nothing, and in Solid it is quietly unsafe — props are getters,
   so passing `screen()` where the receiver wanted `screen` compiles under a
   loose contract and the screen silently stops updating. One component per
   screen makes that a type error instead.

   Render extraction alone cannot take `App.tsx` to ~900 lines: only ~260 of its
   lines were JSX. The rest is the state machine in items 1–3 and 5.
5. **`navigation-scene.ts`** (~330 lines): `navigate`, `back`,
   `restorePrevious`, `settlePendingFocus`, the history stack and the per-screen
   navigation controllers.

## Rules that kept the earlier slices honest

- One slice per commit, message naming the behaviour that moved.
- `npm run typecheck` catches nearly everything, because accessors are typed as
  accessors: passing `value()` where `Accessor<value>` is expected fails.
- Run the slice's own spec file, not the whole suite; the whole suite is slow
  and includes pre-existing environment failures (see TESTING.md).
- A factory's dependency object is a contract, not a bag: if a slice needs
  fifteen unrelated things, it is probably two slices.

## Bad state machines found on the way

Three of these are worth fixing next, in this order. They are the places where
the app's state can *disagree with itself*, which is what makes the closure hard
to reason about:

1. **One focus position kept in two signals.** `timelineFocused` and `choice`
   both describe where the remote is: when the timeline has focus, `choice`
   still holds the last tool index (the controller keeps `lastTool` privately).
   Every place that shows or hides the chrome has to remember that pair, and
   `move()` has to reset `choice` when the controls close. A single
   `focus: { kind: "timeline" | "tool" | "none"; index: number }` removes a class
   of "focus appears to be on a button that is not drawn" bugs.
2. **Four booleans for one busy player.** `loading`, `openingSource`, `seeking`
   and `snapshot.state === "buffering"` are combined by hand in three places
   (`BusySurface` visibility, `data-tv-player-busy`, the control row's own
   guard). They can disagree; a `playerBusy: "opening" | "seeking" | "buffering" | "none"`
   union cannot.
3. **Hero readiness assembled outside the hero.** `heroCycle.setReady(...)`
   takes a predicate built in App out of the presentation's frames; the scene
   already owns the frames. Move the predicate in.
4. **Deleted:** a write-only `Set` of Live favourites, fetched and updated by the
   menu and read by nothing. A store nobody reads reads like state the UI needs.

## What is left, with sizes

`App.tsx` is 1461 lines; what is left is not a slice but the shell:, in dependency order, are roughly:

| Slice | Lines | Notes |
| --- | --- | --- |
| Done | — | live, detail, paging, search, hero, player chrome, player transport + episodes, source picker, play intent → source → player, navigation + history, Back, session/bootstrap |
| signal declarations | ~400 | the `createSignal` chain, now the largest single block |
| render dispatch | ~300 | `Root`/`defineScreen` wiring per screen |
| effects and helpers | ~700 | boot, caption appearance, idle, held select, misc |

Each is a factory with an explicit dependency object, like the ones already
moved. None of them needs more than ~20 dependencies, and each has a spec file
that can be run alone.
