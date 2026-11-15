# Splitting App.tsx — what is done, what is next

`src/tv-solid/remote/App.tsx` is the TV application: one `createRemoteTvApp`
closure that owns every signal and returns the root screen. It started this work
at **3579 lines** and is **3333** now, with the render tree split into three
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
| `remote/render/live.tsx` | 81 | the Live screen and its three empty forms |
| `remote/render/browse.tsx` | 125 | catalog, library and search, with their toolbars |
| `remote/render/player.tsx` | 59 | the skip offer, the busy surface and the control row |
| `remote/live/program-line.ts` | 20 | a guide slot that never prints an out-of-range minute count |

`App.tsx` is **3333 lines** after those. Each extraction is a factory that takes
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
4. **`render/`** (partly done): Live, Browse and the player chrome are out.
   The rest of the tree is *smaller*, measured per screen block:

   | Block | Lines | App bindings it needs |
   | --- | --- | --- |
   | welcome | 6 | 2 |
   | profiles | 10 | 5 |
   | calendar | 13 | 7 |
   | home | 5 | 7 |
   | pairing | 13 | 8 |
   | detail | 22 | 27 |
   | overlaid chrome + overlays | ~110 | 36 |

   So: split it, one component per block, as `render/live.tsx` does.

   What not to do is pull the whole `render: () => (…)` body out as a **single**
   component. That one move needs ~110 bindings, has one call site, and hides
   nothing — a projection of the closure is indirection without depth, and every
   screen that later needs a new signal adds another prop to it. It is also
   quietly unsafe in Solid: props are getters, so passing `screen()` where the
   receiver wanted `screen` compiles under a loose contract and the screen simply
   stops updating. Per-screen components make that a type error.

   Render extraction alone cannot take `App.tsx` to ~900 lines either: only
   ~300 of its lines are JSX. The rest is the state machine in items 1–3 and 5.
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
