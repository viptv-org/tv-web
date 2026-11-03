# AND-APP-UPDATE-001 — Android in-app updates

Status: **proposed** for the design contract; every state, string and rule
below is what viptv-org/app ships at `62e0c949` (`origin/edge`, 2026-11-01),
except the planned future feed source noted under [Availability](#availability).
Source revision:
app `62e0c949`, `updates/AppUpdatePrompt.kt` (prompt banner and TV card, About
status and action labels), `updates/AppUpdater.kt` (check, download and install
states), `updates/UpdatePolicy.kt` (hourly limit, prompt and Back rules,
last-check labels), `updates/UpdateFeed.kt` (feed), `updates/AppUpdatingScreen.kt`
(Updating screen and **Updated to** notice),
`androidMain/updates/AndroidAppUpdatePlatform.kt` and
`androidMain/updates/UpdateRelaunchReceiver.kt`. No canvas board exists (app
`docs/DESIGN_GAPS.md` GAP-065), so the geometry here is the implementation's and
the copy is normative.

Android (phones, tablets, Android TV, Fire TV) only. Release packaging,
versioning and the feed's publishing tool are owned by the Android repository
(`docs/APP_UPDATES.md`). Roku, TV-web, desktop and the browser keep their own
delivery.

## Intent

Sideloaded Android installs learn about a newer build from the VIPTV server they
are signed in to and install it from inside the app, without a store, a computer
or ADB. There is one source: the connected server's feed at
`<server origin>/updates/android/update.json`. The server application's own
version is not part of that check; the feed's `notes` carry whatever the build
needs to say, including a request to update the server.

## Availability

- A build's `versionCode` is `1000` plus the commit count and its
  `versionName` is `0.1.<count>+<7-char sha>`, so a later commit always builds a
  higher code. Updates are on in every build except one packaged for QA torrent
  testing, whose package id differs so it could not install the feed's APK:
  that build has no check, no status line and no update action.
- Only a build a server publishes can be offered. With no signed-in server, and
  in local mode, there is no feed: About reads **`Updates come from your server.
  Sign in to a server to get them.`** and nothing is checked. A build carrying
  `-Pviptv.updateFeed` checks that address instead, with or without a server.
- An update is **available** when the feed's `version_code` is higher than the
  installed build's. The app never offers the same or a lower `version_code`.
- An update is **required** when the feed's `min_supported_version_code` is
  present and higher than the installed `version_code`. It is still a prompt,
  not a gate: the viewer can dismiss it and keep using the app (see
  [Update prompt](#update-prompt)).
- The feed must be a JSON object naming `version_code`, `version_name`, `url`,
  `sha256` and `size`; `notes` and `min_supported_version_code` are optional and
  unknown fields are ignored. `version_code` and a present
  `min_supported_version_code` are positive, `version_name` is non-blank,
  `sha256` is 64 hex characters, `size` is 1 byte to 1 GiB, and `url` is
  `https` — plain `http` only on `127.0.0.1` or `localhost`, for a local test
  feed. A relative `url` resolves against the feed's own address.
- The app installs only the APK the feed names, and only while its `size` and
  `sha256` match. It verifies the file again right before handing it to Android;
  a file that changed on disk is rejected.
- A server that publishes nothing answers 404 (its web app answers unknown paths
  with HTML): About says **`This server doesn't publish app updates.`** and
  nothing else happens. A feed that is not a JSON object, has a field out of
  range or names a disallowed address shows
  **`The server's update information is invalid.`** instead.
- GitHub Releases is the planned future source, not today's (owner decision
  2026-10-27). The feed format and the build's `-Pviptv.updateFeed` override
  already allow it; it stays blocked on moving the signing key out of the dev
  host, the private torrent-runtime build and the repository's visibility.

## When the app checks

1. **Automatically:** on launch and on every return to the app, at most once an
   hour, and also when the connected server changes and when the player closes.
   The hour is remembered across restarts. The check is quiet: no spinner and no
   error dialog.
2. **On demand:** from **Settings › About VIPTV**, any time; it skips the hour.

- A check never runs while the player is open; a due check runs when the player
  closes or the app next returns.
- Only a check that reached the feed starts the hour. A failed check is retried
  on the next return.
- A quiet check that fails keeps a build that is already downloaded or
  downloading, and shows no error. The failure line appears in About only when
  the viewer asks for a check.

## Download

A check that finds an available build downloads it at once, quietly, before the
viewer is asked anything.

- Into app-private storage as `viptv-<versionCode>-<sha prefix>.apk`, with a
  `.part` file while it runs. An interrupted download resumes with a `Range`
  request.
- A network failure is retried after 15 s, 1 min and 5 min; after that the
  download stops with **`Couldn't download the update. VIPTV will try again
  later.`** and the next check starts it again.
- A file whose size or `sha256` does not match the feed is deleted and the
  download stops with **`The download was damaged. VIPTV will try again
  later.`**
- The download pauses while the player is open and continues when it closes.
- Files for other versions are deleted when a new version is found, and all
  files once the installed build is current.
- Nothing is offered before the file is verified. There is no download dialog
  and no cancel action: the viewer first hears of the build when it is ready.

## Update prompt

A verified build raises the prompt unless the app is starting, the player is
open, or the viewer is on the sign-in or recovery-code screens.

| State | Title | Body | Buttons |
|---|---|---|---|
| A verified build is ready | **`Update ready`** | `VIPTV {version} is ready to install.` | **`Install`** · **`Later`** |
| The feed's `min_supported_version_code` is above the installed build | **`Update required`** | `VIPTV {version} is ready to install. This version is no longer supported.` | **`Install`** · **`Later`** |
| Android rejected the install, or the file changed before the write | **`Couldn't update VIPTV`** | `Android didn't install the update.` or `The download was damaged. VIPTV will try again later.` | **`Try again`** · **`Later`** |

- `{version}` is the feed's `version_name`, for example `0.1.1301+a1b2c3d`.
- A feed `notes` value that is not blank follows the body on a second line.
- **Phone and tablet:** a banner at the bottom centre. It is a raised surface,
  radius 16, at most 560 wide, 16 from the side edges and 88 above the bottom
  edge so it clears the bottom bar, with the title, the body and, right-aligned
  under them, **`Later`** then the primary action. The page behind stays live;
  only the banner's own buttons take a tap.
- **TV:** a card in the top-right corner, 96 × scale from the top and right
  edges (`scale` = width ÷ 1920), 760 × scale wide, radius 24, 44 × scale side
  and 40 × scale vertical padding, with a 40 × scale bold title at a 48 × scale
  line height, a 24 × scale body at a 34 × scale line height and 16 × scale
  gaps. Buttons sit in one row, 16 × scale apart: the primary
  (260 × 72 × scale) then **`Later`** (200 × 72 × scale), both 26 × scale bold.
  The primary takes focus 700 ms after the card appears, so the OK press that was
  meant for the page cannot start the install.
- **`Later`** and Back (TV) close the prompt and put that version off until the
  app restarts; a newer build asks again. The next start checks again and offers
  the same build if the feed still names it.
- While the update is **required**, the next return to the app forgets that
  dismissal and the prompt comes back. The app stays usable in between.
- **`Later`** on a failed install hides the prompt; About keeps the failure line
  and offers **`Install update`**.
- **`Install`** / **`Try again`** runs the [update flow](#update-flow) below.

## Settings › About VIPTV

About is a page on phone and tablet and a row list on TV; the rest of it is owned
by [account-and-profile-settings.md](account-and-profile-settings.md). The update
part is:

- **Phone and tablet:** under `Version {version}` the status line, then the
  last-check line, then one action: **`Install update`** (filled) when a build is
  offered, otherwise **`Check for updates`** (outlined). The action is disabled
  while a check or an install runs.
- **TV:** one row whose label is that action, whose subtitle is the status line
  and whose trailing value is the last-check line. Activating the row checks, or
  installs when a build is offered. The **Version** row opens the Build panel,
  which reads `Updates come from the server you are signed in to. VIPTV checks at
  most once an hour, never while you watch, downloads a new build quietly and
  asks before installing it.`
- A build with updates off (the QA torrent build) shows no update line and no
  action; its Build panel reads `Experimental native build. There is no update
  check in this build: updates are installed with a new build.`

| State | Status line | Action |
|---|---|---|
| Not checked | `Not checked yet` | `Check for updates` |
| No signed-in server, or local mode | `Updates come from your server. Sign in to a server to get them.` | `Check for updates` |
| Checking | `Checking for updates…` | `Check for updates`, disabled |
| No newer build | `Up to date` | `Check for updates` |
| Downloading | `Downloading VIPTV {version} · {percent}%` | `Check for updates` |
| Downloading while the player is open | `Downloading VIPTV {version}: paused while you watch` | `Check for updates` |
| Verified and ready | `VIPTV {version} is ready to install` | `Install update` |
| Android needs the install permission | `VIPTV {version} needs permission to install` | `Install update` |
| Writing into Android's installer | `Installing VIPTV {version}…` | `Install update`, disabled |
| A failed check | `Couldn't check for updates. Check your connection and try again.`, `This server doesn't publish app updates.` or `The server's update information is invalid.` | `Check for updates` |
| A failed download | `Couldn't download the update. VIPTV will try again later.` or `The download was damaged. VIPTV will try again later.` | `Check for updates` |
| A failed install | `Android didn't install the update.` | `Install update` |

The last-check line under the status:

| Elapsed since the last check that reached the feed | Line |
|---|---|
| None | `Not checked yet` |
| Under a minute | `Checked just now` |
| Under an hour | `Checked {n} min ago` |
| Under 48 hours | `Checked {n} h ago` |
| Otherwise | `Checked {n} days ago` |

Choosing the action always follows the status: it installs only when the status
offers a build, and otherwise checks. Before the first check the status line and
the last-check line both read `Not checked yet`.

## Update flow

`Install` (from the prompt) or `Install update` (from About) runs these steps:

1. **Permission.** If Android requires the viewer to allow VIPTV to install
   apps, the **Updating screen** ([below](#updating-screen)) carries the
   permission step: title **`Allow updates`**, description
   `Allow VIPTV to install apps in the screen that opens, then come back to
   finish the update.`, platform line
   `The update continues by itself when you come back.` and buttons
   **`Open settings`** · **`Later`**. `Open settings` opens the system setting
   for VIPTV. When the viewer returns with permission granted, the install
   continues by itself. Returning without it shows the same step again, and
   `Later` or Back leaves it and puts that version off until the app restarts.
   - When the device has no such setting screen (some Fire TV models), the
     description instead reads
     `On Fire TV, open Settings › My Fire TV › Developer options › Install
     unknown apps, turn on VIPTV, then come back.`
     with buttons **`Try again`** · **`Later`**.
2. **Install.** The **Updating screen** covers the app while the APK goes into
   Android's installer session, and stays up behind Android's confirmation and
   the replacement of the process ([below](#updating-screen)). Android can
   reopen VIPTV, so it does so at once on a fresh task, still signed in with
   settings and progress kept, and confirms `Updated to {version}`.
3. **Failure.** **`Couldn't update VIPTV`** with one description and
   **`Try again`**, plus the prompt's dismiss action (**`Later`**):
   - Android rejected the install: `Android didn't install the update.`
   - the verified file changed on disk before the write:
     `The download was damaged. VIPTV will try again later.`
   - the viewer cancelled the system confirmation: no prompt; the page returns
     and that version is not offered again until the app restarts.
   - the viewer left the app (Home) during the confirmation: on return the
     prompt offers **`Install`** again and a new press starts a fresh session,
     because Android never answered the old one.

## Updating screen

Status: **proposed**; the shipped implementation is app `62e0c949`
(`updates/AppUpdatingScreen.kt`, `updates/AppUpdater.kt`, `updates/UpdatePolicy.kt`,
`androidMain/updates/UpdateRelaunchReceiver.kt`). App renders were inspected
privately and are not committed here. **No canvas board exists yet** (app
`docs/DESIGN_GAPS.md` GAP-065), so the copy below is normative and the geometry
is the provisional implementation, unmeasured against a board.

### User intent

Choosing **Install** must not leave the previous page on screen with no feedback
until the app disappears. One full-screen cover now owns the app from that press
until Android has replaced the process: it says what is happening, how far the
write got and what happens next.

### Entry and exit

- **Entry:** the viewer chooses **Install** on the update prompt (phone bottom
  banner, TV corner card) or **Install update** in About, with a verified build
  ready. The prompt is hidden from that moment and never sits on top of the
  screen.
- **Exit into the update:** Android installs and replaces the process. Where
  the platform can reopen the app it does so at once (`MY_PACKAGE_REPLACED`) on
  the new build, clearing the old task so the app opens on its start screen
  rather than a stale page, and the new build confirms **`Updated to
  {version}`**.
- **Exit back to the app:** an install Android rejects, a cancel in Android's
  confirmation, or **`Later`** / Back on the permission step. The first goes
  back to the prompt's failure form; the others go back to the page the viewer
  was on, and that version is not offered again until the app restarts.
- The screen is never shown over the player or the sign-in screens: the prompt
  is not shown there, so Install cannot be chosen from them.

### Copy by state

| State | Title | Body | Progress | Line under the bar | Actions |
|---|---|---|---|---|---|
| The APK is written into Android's installer session | **`Updating VIPTV to {version}…`** | `Writing the update. Android asks you to confirm before it installs.` | Determinate bar and **`{N}%`** | `VIPTV restarts by itself when the update is installed.` | none |
| The session is committed and Android shows its confirmation, or is already replacing the process | **`Updating VIPTV to {version}…`** | `Confirm the update in the dialog Android is showing.` | Indeterminate bar, no percent | same restart line | none |
| Android needs "Install unknown apps" | **`Allow updates`** | `Allow VIPTV to install apps in the screen that opens, then come back to finish the update.` | none | `The update continues by itself when you come back.` | **`Open settings`** · **`Later`** |
| The same permission step where the device has no such setting screen (some Fire TV models) | **`Allow updates`** | `On Fire TV, open Settings › My Fire TV › Developer options › Install unknown apps, turn on VIPTV, then come back.` | none | same line | **`Try again`** · **`Later`** |

- `{version}` is the offered build's `versionName`, for example
  `0.1.1301+a1b2c3d`; the title uses the single-character ellipsis `…`.
- Where the platform cannot reopen the app after replacing it, the line under
  the bar reads `VIPTV closes when the update is installed. Open it again to
  finish.` instead of the restart line. Android can reopen it, so Android TV,
  Fire TV, phones and tablets show the restart line.
- Neither the writing nor the confirming state offers an action: the system
  installer owns the decision at that point.
- The layout has no other text: no step counter, no download speed, no
  remaining time, no cancel action. There is no empty or disabled state: the
  screen is either writing, confirming, or asking for the permission.

### Progress

The bar counts what has been written into Android's `PackageInstaller` session
(the copy of the already-verified APK, in 64 KiB chunks), not the feed download
that finished before the prompt appeared.

- The percent is the rounded-down fraction of the APK's size, so it starts at
  `0%`, moves in chunk-sized jumps and reaches `100%` as the write ends.
- As soon as the session is committed the percent disappears and the bar
  becomes indeterminate, because Android's confirmation and the process
  replacement are no longer measurable.
- A feed with no usable size (`size` 0) shows the indeterminate bar from the
  start and never shows a percent.
- The permission step shows no bar at all.

### Layout

Provisional implementation values in dp, text sizes in sp, to be replaced by
the board:

| | Phone and tablet | TV |
|---|---|---|
| Cover | full screen, opaque `color.bg`; safe-area insets; 32 padding | full screen, opaque `color.bg`; no inset change |
| Column | max 420 wide, centred horizontally and vertically, 16 gaps | 120 × scale side inset, centred vertically (`scale` = width ÷ 1920) |
| V mark | 56 | 120 × scale |
| Title | `headlineSmall`, `color.text.primary`, centred | 56 × scale bold, 68 × scale line height, centred |
| Body | `bodyLarge`, `color.text.secondary`, centred | 28 × scale, 40 × scale line height, centred |
| Percent | 13 sp, 8 above the bar, `color.text.body` | 24 × scale above the bar |
| Bar | column width × 6, `color.accent.default` on `color.surface.2`, rounded | 760 × scale wide, 8 × scale tall |
| Line under the bar | `bodySmall`, `color.text.tertiary`, centred | 24 × scale, 34 × scale line height, centred |
| Actions (permission step) | **`Later`** (`color.text.secondary`) then the primary (`color.accent.default`, semibold), 8 apart, centred, no container | 48 × scale below the line: primary 320 × 80 × scale, **`Later`** 200 × 80 × scale, 16 × scale apart |

The colours above are the design-system roles the implementation draws from
(`color.bg`, the surface, text and accent roles; the raised surfaces are
`Palette.raised` = `color.surface.2`). The V mark is the app's tile: an accent
rounded square (radius 28 % of its side) with the letter **V** at 62.5 % of the
side in the background colour, ExtraBold. The Material type styles it names
(`headlineSmall`, `bodyLarge`, `bodySmall`, `bodyMedium`) and the dp gaps still
need mapping onto the design-system type ramp and spacing on the board.

**After the update:** **`Updated to {version}`** is a bar at the bottom centre
(16 from the edges, radius 12, `color.surface.2`, 20 × 12 padding, semibold
`bodyMedium`). It has no action, never blocks the page, and the TV layout keeps
the same density-pixel sizes instead of scaling them — a board has to set the
TV size.

### Focus and inputs

- **Phone and tablet:** the cover takes every touch; nothing behind it reacts,
  and there is no tap-outside or swipe to dismiss.
- **TV:** the screen itself takes focus while it offers nothing to choose, so a
  D-pad press cannot reach the page behind it. On the permission step the
  primary action (**`Open settings`**, or **`Try again`** on Fire TV) takes
  focus **700 ms** after the screen appears, so the OK press that chose Install
  cannot also open the system screen; **`Later`** is one step away.
- **Back:** while the APK is being written and once the session is committed,
  Back does nothing — Android cannot cancel the install at that point. On the
  permission step Back is **`Later`**: it leaves the screen, puts that version
  off until the app restarts and never reaches the page behind the cover.
- No long-press, repeat or hold does anything on this screen.

### Failure and recovery

| Cause | What the viewer sees |
|---|---|
| Android rejects the install (`Failed` after an install attempt) | The screen goes away; the prompt returns with **`Couldn't update VIPTV`**, `Android didn't install the update.`, **`Try again`** · **`Later`**. **`Try again`** starts a fresh session and shows the Updating screen again. |
| The verified file changed on disk before the write | The screen goes away; the prompt returns with **`Couldn't update VIPTV`**, `The download was damaged. VIPTV will try again later.`, **`Try again`** · **`Later`**. |
| The viewer cancels Android's confirmation | The screen goes away, the page returns and no prompt is shown for that version until the app restarts. |
| The viewer leaves the app (Home) during the confirmation | Nothing is drawn on return: the app comes back with the update ready and the prompt's **`Install`** again, and a new press starts a fresh session, because Android never gave that session an answer. |
| The viewer chooses **`Later`** (or Back) on the permission step | The screen goes away and that version is not offered again until the app restarts. |

### Timing

| Event | Timing |
|---|---|
| Screen appears | at once on the Install press, before the first chunk is written |
| Percent and bar | one update per 64 KiB chunk written into the session |
| Bar becomes indeterminate | when the session is committed, before Android's confirmation appears |
| TV permission-step focus | 700 ms after the screen appears |
| **`Updated to {version}`** | shown after the relaunch for 6 s, then removed; a second announcement restarts the 6 s |

### Accessibility

- The bar is one progress indicator with platform progress semantics (the
  implementation exposes a `ProgressBarRangeInfo`) and the percent is a text
  label above it, so assistive technology reads the value in words.
- The permission-step actions are ordinary buttons: on phone and tablet in
  reading order **`Later`** then the primary action, on TV the primary action
  first and focused. Touch targets follow the button rules and the TV actions
  keep the standard focus treatment.
- Unknown: whether the screen appearing or the percent changing is announced as
  a live region, and whether a reduced-motion variant of the indeterminate bar
  exists. No board, no measurement and no screen-reader run exist yet. The V
  mark is drawn as the text "V", so a screen reader may announce it before the
  title; that has not been run.

### Platform scope

Android only (phones, tablets, Android TV, Fire TV), as part of
AND-APP-UPDATE-001. Roku, the desktop app, the browser and TV-web never show
it: they do not install themselves.

## Acceptance

1. **AND-APP-UPDATE-01:** an Android build with updates on shows `Version
   {version_name}`, a status line and one update action in About; a build with
   updates off (the QA torrent build) shows none of them, and its TV Build panel
   reads `Experimental native build. There is no update check in this build:
   updates are installed with a new build.`
2. **AND-APP-UPDATE-02:** a signed-in build whose feed names a higher
   `version_code` downloads the APK quietly, then shows **`Update ready`** with
   `VIPTV {version} is ready to install.` and **`Install`** · **`Later`**; a
   feed with `notes` shows them as a second body line. **`Later`** hides the
   prompt for that version until the app restarts, a newer build asks again, and
   About keeps `VIPTV {version} is ready to install` with **`Install
   update`**.
3. **AND-APP-UPDATE-03:** **`Install`** without the install permission shows
   `Allow updates` on the Updating screen; granting it in system settings and
   returning continues the install by itself; returning without it shows the
   same step; `Later` and Back leave it and put that version off until the app
   restarts; the updated app opens signed in.
4. **AND-APP-UPDATE-04:** no check runs and no prompt appears while the player
   is open; a download started earlier pauses with `Downloading VIPTV {version}:
   paused while you watch` and resumes when the player closes, and a due check
   runs then.
5. **AND-APP-UPDATE-05:** `Check for updates` when the feed names no newer build
   shows `Up to date` and `Checked just now`; with no network it shows
   `Couldn't check for updates. Check your connection and try again.`; a 404 or
   HTML feed shows `This server doesn't publish app updates.`; a malformed feed
   or one naming a plain-`http` address off loopback shows
   `The server's update information is invalid.`
6. **AND-APP-UPDATE-06:** a size or `sha256` mismatch deletes the download,
   shows `The download was damaged. VIPTV will try again later.` in About,
   offers no prompt and installs nothing; a download that keeps failing through
   the 15 s, 1 min and 5 min retries stops with `Couldn't download the update.
   VIPTV will try again later.`
7. **AND-APP-UPDATE-07:** every prompt and screen is reachable and dismissable
   with a TV remote (D-pad, OK, Back) on Android TV and Fire TV.
8. **AND-APP-UPDATE-08:** choosing `Install` on a 390-wide phone covers the page
   with the Updating screen: `Updating VIPTV to 0.1.1301+a1b2c3d…`,
   `Writing the update. Android asks you to confirm before it installs.`, a
   determinate bar with `{N}%` and
   `VIPTV restarts by itself when the update is installed.` The `Update ready`
   prompt is gone, and a tap where the page's controls were does nothing.
9. **AND-APP-UPDATE-09:** the same press on 1920-wide Android TV covers the page
   with the same screen; D-pad presses move nothing, and Back does nothing while
   the APK is written and after the session is committed.
10. **AND-APP-UPDATE-10:** without the install permission, `Install` shows
    `Allow updates` with
    `Allow VIPTV to install apps in the screen that opens, then come back to finish the update.`,
    `The update continues by itself when you come back.` and `Open settings` ·
    `Later`; on a Fire TV without that screen it shows the Fire TV path with
    `Try again` · `Later`. Returning with permission allowed continues the
    install without another press; returning without it shows the same step;
    `Later` and Back leave the screen and do not offer that version again until
    the app restarts.
11. **AND-APP-UPDATE-11:** an install Android rejects leaves the screen and the
    prompt returns with `Couldn't update VIPTV`,
    `Android didn't install the update.`, `Try again` · `Later`; `Try again`
    shows the Updating screen again, and `Later` returns to the page while About
    keeps the line with `Install update`.
12. **AND-APP-UPDATE-12:** cancelling Android's confirmation leaves the screen,
    returns the page the viewer was on, installs nothing and shows no prompt for
    that version until the app restarts.
13. **AND-APP-UPDATE-13:** when Android installs the update and reopens VIPTV,
    the app opens on its start screen, still signed in with settings and
    progress kept, and `Updated to {version}` sits at the bottom for six seconds
    and then goes away on its own.
14. **AND-APP-UPDATE-14:** with no signed-in server or in local mode, a build
    without `-Pviptv.updateFeed` reads
    `Updates come from your server. Sign in to a server to get them.` in About
    and nothing is checked or offered; a server that publishes no
    `/updates/android/update.json` (404, or the web app's HTML for unknown
    paths) shows `This server doesn't publish app updates.` and offers nothing.
15. **AND-APP-UPDATE-15:** a feed whose `min_supported_version_code` is above the
    installed build and whose `version_code` is higher shows **`Update
    required`** with `VIPTV {version} is ready to install. This version is no
    longer supported.` and **`Install`** · **`Later`**; `Later` dismisses it and
    the app stays usable, every return to the app shows it again, and a later
    check that finds no newer build clears it.
16. **AND-APP-UPDATE-16:** automatic checks run at most once an hour and the hour
    survives a restart; `Check for updates` always checks; a failed check does
    not start the hour, is retried on the next return, and leaves a downloaded
    or downloading build in place without showing an error.