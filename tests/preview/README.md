# Preview harness

Renders the app screens that correspond to the design's reference screens
(`../design/viptv-design-system/reference/screens/`) against a mock backend with
the reference sample data and artwork, at the reference sizes, so each app
screenshot can be compared one-to-one with its reference picture.

It is a development tool, not a test suite: nothing is asserted about pixels.
A shot is "ok" when its scenario reached the intended state, not when it
matches the design.

## Run

```sh
node tests/preview/shoot.mjs                    # every reachable screen (~5 min)
node tests/preview/shoot.mjs DeskHome TvHome    # named screens
node tests/preview/shoot.mjs --platform tv      # phone | desktop-web | tv
node tests/preview/shoot.mjs --list             # registry, sizes, unreachable reasons
node tests/preview/compare.mjs DeskHome         # reference | app side by side
node tests/preview/compare.mjs --all            # every screen + index.html
```

Output goes to `test-results/preview/`:

| File | What |
|---|---|
| `<Name>.png` | the app at the reference size |
| `<Name>.compare.png` | reference (left) and app (right) at the same scale, labelled; open it with the Read tool |
| `<Name>.failed.png` | with `--debug`: the page when a scenario failed |
| `index.html` | `compare.mjs --all`: every reference screen per platform with its comparison, or why there is none |
| `last-run.json` | the last shoot run's ok / failed names |

`npx playwright test` wipes `test-results/`, including the preview folder. Set
`PREVIEW_OUT=<dir>` to write somewhere else.

Options (shoot): `--keep` leaves the dev servers running for the next call
(much faster), `--headed` shows the browser, `--debug` saves `<Name>.failed.png`
and prints the page's console errors and the last API calls on failure.
Options (compare): `--shoot` re-shoots before composing (otherwise the existing
PNG is reused; a missing one is shot), `--width <px>` sets each half's width
(default: the reference width capped at 1200), `--stack` puts the reference above
the app, `--all [--platform p]` composes every screen and writes `index.html`.

Stop kept servers with `pkill -f 'vite.js.*--port 418[01]'`.

## How it works

- `shoot.mjs` starts Vite (or reuses one it recognises) on `127.0.0.1:4180`, and a
  local-mode build (`VITE_VIPTV_LOCAL_MODE=1`, config `vite.local.config.mjs` with its
  own dependency cache) on `4181` for the local-mode screens. It refuses a port that
  serves anything else (a LAN-preview or custom-API build would reach a real backend).
  Keep ports off the Fetch "bad ports" list (4190 is one): Node and Chromium refuse them.
- The frame comes from the reference size in `index.json`: phone 390×844 (mobile,
  touch), desktop app 1440×900 and ultra-wide 2560×1080 (dev-only `?desktop-shell`
  forces the Tauri title bar and rail), web 1280×800, TV 1920×1080 with
  `?platform=tizen` (the TV has no URL routing; scenarios use the remote).
- The clock is fixed at Wednesday 23 September 2026, 10:55 Eastern (phone 10:32), the
  reference time, so the guide, "now" lines and relative dates match.
- `backend.ts` is a self-contained mock of every `/api` route the screens use
  (shapes inferred from `src/api/*` and the vendored normalizers). Sample titles,
  copy, numbers and artwork (served from the reference `assets/`) follow the reference
  screens per family (phone / desk+web / TV). Every other external host is aborted,
  and a dev server can never proxy `/api` or `/media` anywhere.
- Media: Chromium has no H.264, so `installMediaStubs` makes the `<video>` element
  "play" without decoding and paints a reference still behind it; WebCodecs is hidden
  so the responsive player takes that HTML path instead of MediaBunny. A fake
  `webapis.avplay` stands in for Tizen. `stall` / `failAfter` make a source never
  become ready (the engines' 20 s open timeout is cut to 1.5 s); `error` fails AVPlay
  preparation.

## Adding or fixing a screen

Every reference screen has an entry in `screens.mjs` (`--list` shows gaps). Fields:

| Field | Meaning |
|---|---|
| `path` | responsive deep link (`/tv/home`, `/tv/title/<type>/<id>[/sources]`, `/tv/discover`, `/tv/live`, `/tv/my-list`, `/tv/search`, `/tv/settings[/playback\|/addons]`, `/tv/profiles`); ignored on TV |
| `query` | extra query string (e.g. `q=naruto`) |
| `backend` | `installBackend` options: `session` (`none` pairing/sign-in, `profiles` Who's watching), `manyProfiles`, `pairing`, `loginError`, `profilePin`, `signOutPin`, `wrongPin`, `queue`, `favorites`, `sourcesDone`, `addonInstallError/Hang`, `playbackHang/HangAfter/FailAfter`, `seekRefused`, `profileSaveHang`, `searchFail`, `noCatalogs`, `backendDown`, `catalogHang`, `localAddons`, `recentSearches`, `family` |
| `player` | install the media stubs, with `paused`, `position`, `duration`, `live`, `error`, `stall`, `failAfter` |
| `clock` | `'HH:MM'` Eastern, or `false` for real time (timers that need it, e.g. an expiring code) |
| `local` | use the local-mode server |
| `init` | a function run in the page before the app (e.g. seed the local addon registry) |
| `shell` | force the desktop title bar on/off |
| `steps` | `async h => {…}` to reach the state |
| `quiet` | ms of network silence to wait for before the shot (default 600) |
| `note` | a known difference from the reference state (shown in comparisons and `--list`) |
| `notReachable` | why the app cannot show this state; skipped by default runs |

Step helpers (`h`): `activate(target)` clicks (responsive) or focuses + OK (TV);
`button(name)` / `choose(name)` activate a button by accessible name, `choose` only
inside the topmost dialog (use it for modal choices: "Sign out" is also a Settings
row); `hold(target)` right-clicks / long-presses (TV: Info key); `focus`, `press(key, n)`,
`type(text)`, `fill(target, text)`, `wait(target)`, `waitText(text)`, `tvGo(label)`
(TV rail destination, retried until it is the current page), `settle()`, `sleep(ms)`.
A string target is a `data-focus-id` (`'episode-0'`, `'source-0'`, `'signout'`, …) or,
when it starts with `#`, `.` or `[`, a CSS selector; otherwise pass a Playwright
locator. Prefer focus ids, roles, labels and text over class names: the screen families
are being restyled and class names change.

Shared sequences at the top of `screens.mjs` open the player (`responsivePlayer`,
`tvPlayer`), the TV title / sources (`tvToTitle`, `tvToSources`), the profile editor,
Settings rows and the timeline (`seekTo`).

When a scenario fails, run it alone with `--debug`, open `<Name>.failed.png`, and read
the printed console errors and last API calls. A missing mock route answers
`404 Unhandled preview route <METHOD> <path>` and shows up there.

## Screens that are not reachable (18)

| Screen(s) | Why |
|---|---|
| PhStates, DeskStates, TvStates | composite boards of many states; the individual states have their own screens |
| PhPlayerBuffering, DeskPlayerBuffering, TvPlayerBuffering | ring + "The stream could not seek there." notice: a refused backend seek (`seekRefused`) currently surfaces as an HTTP 409 error toast, and a pending seek shows neither ring nor notice |
| PhUpNext, DeskUpNext, TvUpNext | the player has no Up Next card yet |
| PhOverflowCue | cards have no touch ⋯ button yet |
| WebLinkTv | tv-web has no "Link your TV" code-entry page |

## Known differences in reached screens

Recorded as `note` in `screens.mjs` (visible in `--list` and comparison labels), e.g.:
the PIN screens are reached through Sign out, so their title reads "Enter parent PIN to
sign out"; DeskLiveDetails opens the next-up programme (clicking a current programme
plays it); PhItemMenu uses Mayday (the phone Continue Watching set has no Monster);
new-profile screens show the default avatar; DeskPlayback has no engine row outside
Tauri. Player "preparing next" screens hold in next-episode source discovery.
