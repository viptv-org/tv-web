# Decisions

## Live empty state (LIVE-EMPTY-001)

From the 2026-10-30 owner report
([design#45](https://github.com/viptv-org/design/issues/45)): Live with no source
is a blank page holding an orphan Favourites chip, one line and a button into the
whole of Settings, and Live with a source that returns no channels says exactly
the same thing. They ship in the app; the
[spec's parity record](../specs/behavior/live-empty-state.md#parity) records the
evidence per state.

Settled here:

- **Two states, not one.** *No source* (`LivePage.connections` empty, or the page
  answering `NeedsConfiguration`) gets the stadium artwork, the copy and the
  action. *Source, no channels* gets no artwork, keeps the Source chip as its way
  to another source, and shows the server's reason with **Try again**. A page
  emptied by a filter keeps today's line and today's chips.
- **The artwork is one credited photograph.** Two WebP crops of Mario Klassen's
  CC0 photograph of the Volksparkstadion, Hamburg: the wide crop for W and T,
  the tall crop for P, byte-identical to what the app packages (app `2d7949b8`,
  [app#349](https://github.com/viptv-org/app/issues/349)), with the reading
  scrim drawn in code at the stops LIVE-EMPTY-001 lists. CC0 requires no
  attribution; the product credits the photographer under Settings › About and
  About VIPTV. No vector source exists.
- **Chips only where there is something to filter.** The no-source state draws no
  filter row at all. The Source chip stays in the no-channels state while a
  second connection exists, because it is the only way to a working source;
  Favourites and Group wait for channels. This refines the issue's "hidden until
  there are channels" rule, which would have removed that recovery path.
- **A failed first request is a failure, not an empty answer.** With no page and
  no request open nothing has proved a source is configured, so the block reads
  **Could not load Live TV.** and the message the request carried, in the
  no-channels block and metrics, instead of claiming **No channels came back.** A
  first request still in flight is the loading form.
- **Who can act follows the server.** An owner account session and local mode get
  **Set up live TV** and **Add-ons**; a member reads "Only the household owner
  can set up live TV."; a paired TV reads "Manage live TV from a signed-in phone,
  computer or the web dashboard." because a device session cannot write a source
  at all. Backend `f30b2f5` (owner-only household writes,
  [backend#149](https://github.com/viptv-org/backend/pull/149)) is the rule
  behind the three forms; backend#168 relaxed it and
  [backend#205](https://github.com/viptv-org/backend/pull/205) restored it, also
  reporting `capabilities.manage_account` only for the owner.
- **No free live add-ons action.** No add-on directory, catalogue or
  recommendation list exists in the app, the web dashboard or the server, so the
  issue's third next step is not drawn as an action; the body names the two
  routes that do exist.

## Android completed episode indicators (AND-EPISODE-WATCHED-001)

Proposed from the 2026-10-02 owner request. Android TV and phone episode cards
show `Watched` beside their episode-number caption using the current profile's
saved completion fact. Core and backend own completion semantics; the renderer
does not infer completion from a progress percentage or another episode.
Press, hold and repeated remote input retain existing card actions; the badge
is informational and does not change source selection, Back or restored focus.
No artwork readiness gate or animation is introduced. Loading/error progress
does not fabricate completion; details remain browsable. Reopening details and
switching profiles must project fresh profile progress. A completed fact hides
the partial progress bar; resetting that fact removes the badge.

On narrow phones, the badge wraps immediately below the episode-number caption
when both cannot fit at full width. Keep the full label, existing artwork and
44 dp options target; use layout constraints rather than a fixed phone breakpoint.

Acceptance: render completed, partial, unwatched and missing-progress episodes
together on TV and phone; verify only completed cards display and announce
`Watched`. Replace a watched item with an incomplete item and switch profiles;
no old badge remains. Verify a 1,410-episode lazy row near its end and ordinary
source Back keep identity, selected episode and focus. Native emulator evidence
and physical TV compatibility are recorded separately. Other platforms retain
their pinned episode presentation until they explicitly adopt this addition.

## Settled with the product owner

1. **Up Next:** at the end of a series episode, a panel over the last frame whose primary action counts down 10 s ("Next episode in [N]", with a ring that empties) and then plays the next episode. Any viewer action cancels it, and Settings › Playback › **Autoplay next episode** (on by default, per device) turns it off. It does not take over the whole screen. Owner decision 2026-10-27, replacing the earlier "Starts in [8]" card with Play now / Cancel; see [PLAY-NEXT-AUTOPLAY-001](../specs/behavior/next-episode-autoplay.md).
2. **TV subtitles and audio:** one scrolling list in the right panel. The list opens focused on the current track.
3. **TV pairing code expiry:** a persistent expired state (the code struck through, "This code expired.", Try again focused, QR dimmed), plus a web page where the code is typed ("Link your TV").
4. **Protected profiles:** a lock badge only. The PIN is asked for when the profile is opened.
5. **Hiding from Continue Watching:** one menu item, "Remove from Continue Watching", followed by an Undo dialog.
6. **Touch overflow:** a visible ⋯ on phone cards (long-press still works).
7. **Sign-out copy:** "Sign out of VIPTV on this phone?" on phone, "Sign out of VIPTV on this device?" on tablet, desktop and web, "Sign out of this TV?" on TV.
8. **Desktop keyboard focus:** an off-white 2 px ring with a 2 px ground-coloured gap, shown on `:focus-visible` only. Never accent.
9. **Naming:** "My List" everywhere. It has two segments, My List | Continue Watching. History and counts are dropped from the tabs.
10. **Avatars:** hide broken categories and compute the count shown in the header.
11. **TV focus:** focused tiles, profiles, rows and controls keep their size. Use the white ring or off-white fill without scale.
12. **TV reliability corrections:** [TV-034](../docs/platforms/TV_POLISH.md) defines carousel bounds, stable rail geometry, profile activation, season navigation, live-only controls and progressive startup. These owner-requested corrections supersede conflicting static reference hints and spacing.
13. **Native Android:** [AND-035](../docs/platforms/ANDROID_DESIGN.md) adopts the current phone and 1920×1080 TV design, replacing the historical Android Roku reconstruction while retaining native Compose, Media3 and shared core behavior.
14. **Settings split into four groups:** Profile, Playback, This device and Account, in that order, on every platform ([ACCT-SPLIT-001](../specs/behavior/account-and-profile-settings.md)). Profile owns name, avatar, kids flag, maturity limit, approved titles, profile lock, language, Simkl and delete profile. Playback owns the two preference pages, per profile. This device owns Display, About and Help. Account owns identity, password, household PIN, devices and sessions, Add a device, add-ons, source integrations, sign out and delete account. The Account group is visible to everyone signed in; the rows a TV cannot use are disabled with their reason, and its devices list opens read-only. There is no email row, Simkl is profile-scoped because it tracks one person's viewing, and the phone, tablet, desktop and web boards' flat lists and the web sidebar titled **Account** are superseded on row order only, not geometry. Owner decision 2026-10-30 ([design#40](https://github.com/viptv-org/design/issues/40)).

## Design decisions made during the redesign

- The phone nav floats, with a separate search button. Search docks its field above the nav so typing stays in thumb reach.
- Desktop tiles have fixed widths. Wider windows (up to 2560 × 1080 ultra-wide) show more tiles and more hours in the guide, and never stretch art.
- Desktop overlay scrims cover the body row only, so the title bar (window controls) and rail stay usable.
- TV "More info" is its own button on the title screen. It opens a full-screen text panel, because the synopsis is clamped to 2 lines.
- Live programme details show the channel and time slot ("CNBC · [9:00] – 12:00") above the description.
- Manage profiles on TV shows a pencil cue on every tile, so it is clear that OK opens the editor.
- Skeletons match each screen's real layout. TV instead shows a "Starting VIPTV…" cover, then content.
- Buttons get a CSS reset (`background: transparent; border: 0`) so no browser default styling shows through.

## Open items (values to confirm in the app)

- `[Bracketed]` values are placeholders: times, counts, file names, track names, IP addresses, the device URL. The Up Next countdown is settled at 10 s ([PLAY-NEXT-AUTOPLAY-001](../specs/behavior/next-episode-autoplay.md)); `[N]` there is the live number.
- Whether the parent PIN length is fixed or 4–8 digits (drawn with 6 boxes, error copy says 4–8).
- The phone PIN helper copy ("Enter the parent PIN to continue.") replaces the TV-only "Use your remote or a connected keyboard." on phone and desktop.

## 14. Native Android follow-up (AND-036)

The 2026-09-26 owner request replaces phone device-code-only authentication with
native username/password sign-in, keeps pairing optional, and requires original
source playback on Android. Source feedback, player lifetime, provider groups,
stateful library actions, insets and the scrolling/blurred TV hero are specified
in `../docs/platforms/ANDROID_DESIGN.md#and-036--native-sign-in-direct-playback-and-interaction-corrections`.

## 15. Native Roku complete TV audit (ROK-043)

The owner extends the later TV corrections to Roku, including accent Resume,
all addon catalog shelves, bounded lazy loading, three lower Home shelves,
TvTitle composition and TvLive guide. See [ROK-043](../docs/platforms/ROKU_DESIGN.md#rok-043--complete-tv-screen-audit-and-catalog-correction).


## Phone TV remote (Watch on TV) — proposed for Android phone and tablet

The remote is proposed for the KMP app on Android phone and tablet
([AND-038](../docs/platforms/ANDROID_DESIGN.md#and-038--android-phone-and-tablet-vizio-remote-2026-11-02)),
superseding the earlier exclusion; no layout shows the Settings row it starts
from until it ships. A TV signs in with **Account › Add a device**
([ACCT-SPLIT-001](../specs/behavior/account-and-profile-settings.md)). The
decisions below stand for the day it is built.

Android owner follow-up AND-039 keeps pairing visible across backgrounding,
cancels abandoned TV challenges, and uses a 20 px glyph in the same borderless
44 px avatar-style header slot as the profile picture. Key traffic does not
change the launch button's appearance. See the Android contract for acceptance.

- **Opt-in, in Settings.** Most people never use it, so it is off by default and adds nothing to the app until a TV is paired.
- **The button goes in the Discover, Live and My List headers**, next to the avatar (Home keeps its headerless hero). The bottom nav and search stay identical for everyone. Remotes are opened occasionally, and the controls themselves sit in the thumb zone of the sheet, so reaching up for the button once is fine. A one-time tip shows where it went.
- **The remote is a sheet, not a page**, so the app stays underneath and closing it returns you where you were.
- **Two modes:** big buttons (the default) and a swipe touchpad. The last-used mode is remembered.
- **Honest setup:** the intro says nothing is mirrored before discovery. Android SDK 36 has no runtime LAN prompt; denied access gets recovery, never a fake permission prompt.
- **The PIN pairs automatically** on the 4th digit.
- **The TV's certificate is pinned on first pairing, and the PIN page shows no fingerprint.** SmartCast TVs serve self-signed certificates, so a client limited to the platform trust store fails every real TV; the remote pins the TV's leaf certificate at a successful pairing and accepts only that certificate for that exact origin afterwards, re-pairing on a change. The fingerprint is not displayed: Vizio's TV UI states no fingerprint to compare against, so the PIN page would ask people to check a value nothing else shows, while the four-digit PIN the TV displays is already the pairing proof. The first pairing trusts whichever certificate answers at the selected address; the pin protects every later connection.
- **Forget this TV turns the feature off**, so there's no separate master switch.
# Reliability follow-up — REL-001 (proposed, 2026-09-28)

Owner-approved scope: backend, shared core, Android, native Roku, browser/TV and
desktop. Extend existing surfaces; do not change source selection or auto-play.

- API errors retain stable `error_code` and a safe, actionable message. Provider
  connection capacity is distinct from request rate limiting, upstream access
  denial, expired sources, network failure and unsupported delivery. Never show
  URLs, cookies, credentials, stack traces or raw response markup. Unknown errors
  use a bounded safe message or status-specific fallback; retain Retry/Choose
  another source/Back and the selected source/time. Auth policy codes keep their
  existing meaning. Connection-limit copy: `This IPTV provider has reached its
  connection limit. Stop another stream or choose another provider.`
- Home renders usable saved/initial rows immediately. Remove Roku's metadata and
  artwork readiness cover, including re-entry triggers; loading images must not
  intercept input. Keep account restoration truthful and retryable. Refreshes
  preserve visible rows and focus. Metadata work follows visible items plus a
  bounded lookahead; no artwork-completion gate. Missing art uses existing ground.
- Roku time labels use a verified numeric font path without `monospacedDigits`
  substitution. Position/duration stay readable, including hours and zero values;
  validate on hardware before claiming physical acceptance.
- TV Home scroll-out/return must recreate visible text, controls and images after
  texture cleanup. Source/provider panels remain opaque surface-1 with the
  existing scrim. Verify repeated scroll and panel opening under memory pressure;
  do not hide a renderer defect by increasing memory without bounds.
- Browser header profile buttons open Settings. Switch profile remains an
  explicit Settings action; keep dedicated TV profile-selection navigation.
- Native SmartCast remotes expose Power and Mute with accessible labels, existing
  44dp-or-larger phone / desktop button geometry, and the TV's reported name
  (fallback `Vizio TV`). Only explicit presses send power/mute; no repeat/hold.
  Power off is not treated as expired pairing. On app return, silently verify the
  retained pairing with bounded retries, keeping the current remote layout/name.
  Show offline recovery only after verification fails; show pairing recovery only
  for rejected credentials. Background discards queued keys, never the PIN page.
- Android launch uses the bundled VIPTV mark on the existing dark ground, with
  matching system-bar colors and a compact in-app branded restoration state.
  No artificial minimum delay, artwork wait, or replayed splash on resume.

Acceptance: capacity/429/auth/404/5xx/timeout/malformed responses show distinct
safe outcomes on each client; slow or failed artwork never blocks Home; repeated
TV scroll/panel cycles survive cleanup; profile-to-Settings-to-profile navigation
works; delayed reconnect has no offline flash, eventual failure is recoverable,
and power/mute/name work via the synthetic SmartCast boundary. Measure Android
initial/offscreen requests and retain first-frame, device and fixture evidence
separately. Existing typography, palette and focus/Back contracts remain in force.

## Native Android TV keyboard (AND-KEYBOARD-001)

The 2026-10-01 owner request replaces Android TV custom character and PIN grids
with native Android editable fields and the installed device input method.
Search keeps separate progressive catalog shelves; Back dismisses native input
before leaving its screen/dialog. Roku and TV-web retain their current inputs.
The Android contract records focus, Results, secret input and return acceptance.

## Native Android TV media-row edge (AND-TV-ROW-EDGE-001)

The 2026-10-02 owner request extends horizontal Android TV media card rows,
including Popular movies and Details episodes, through the right viewport edge.
This explicitly supersedes the general 96 px right safe inset and TV-034's
1824 px final-card bound **for native Android TV media rows only**. Headings,
text and non-media content keep their safe inset. The
[media-row contract](../specs/behavior/android-tv-media-rows.md) defines the
geometry, focus restoration and acceptance cases.

## TV My List poster cards (TV-MYLIST-POSTER-001)

The 2026-10-11 owner request shows TV My List cards at 2:3. My List saves only
a portrait poster per title, which the 16:9 TV still crops to about 37 % of its
height; fetching backdrops instead would add a metadata lookup and still fall
back to posters for many IPTV titles. The My List segment uses a 7-column grid
of 200 × 300 posters and the Home My List shelf uses 160 × 240. Continue
Watching and all other TV cards keep their landscape shape. The
[poster contract](../specs/behavior/tv-my-list-posters.md) defines geometry,
scrolling, focus, removal and acceptance for every TV renderer.

## Phone 2:3 posters (PHONE-POSTER-001)

Proposed with the same 2026-10-11 request. Every phone poster card (My List,
Discover, Search and poster shelves) uses a 2:3 frame instead of 4:5, so the
whole poster shows; 4:5 cut about 17 % of its height. The 3-column grid,
radius 16, captions, ⋯ button and gaps are unchanged; at 390 px wide a card is
111 × 167 (`size.tile.phone-poster`). The phone reference renders still draw
4:5 and are superseded on this point until re-exported. Native Android phone
already draws 2:3; TV-web's responsive phone layout adopts it.

Acceptance: on a 390 px phone, My List, Discover and Search show three 2:3
posters per row with the whole poster visible and unchanged captions, ⋯ and
long-press menus; missing art fills the 2:3 frame.

## Android in-app updates (AND-APP-UPDATE-001)

The 2026-10-11 owner request lets installed Android builds update themselves
from the server they are signed in to: a quiet check on launch and on each
return to the app at most once an hour, a quiet download verified against the
feed, a prompt per version, and Check for updates inside About VIPTV. Nothing
checks, prompts or installs in the player, and a download pauses while it is
open. There is one channel and no backend version contract; the feed's notes
carry any request to update the server too. A feed's
`min_supported_version_code` above the installed build makes the prompt
required: it returns on every return to the app, and **Later** still lets the
viewer keep using it. GitHub Releases is the planned future source (owner
decision 2026-10-27).
See the [app updates contract](../specs/behavior/app-updates.md).

## Updating screen while Android installs (AND-APP-UPDATE-001)

Recorded 2026-10-28 with the 2026-10-28 request
([design#32](https://github.com/viptv-org/design/issues/32)) to write down what
app#139 shipped (PR [app#145](https://github.com/viptv-org/app/pull/145),
`81cf5ae`). Choosing **Install** no longer leaves the previous page on screen:
one opaque full-screen cover owns the app until Android replaces the process,
shows the write progress as a bar with a percent, stays behind Android's own
confirmation, carries the install-permission step instead of the prompt's
dialog, and tells the viewer whether VIPTV reopens itself. Where the app can
reopen itself it does, and confirms **Updated to [version]** for six seconds.
“Proposed” stays: there is no canvas board (app `docs/DESIGN_GAPS.md` GAP-065),
and the geometry in
[app-updates.md](../specs/behavior/app-updates.md#updating-screen) is the
implementation's. On the permission step Back is **Later**, handled by the
app's Back handler before the page sees it.

## Subtitle mode (PLAY-SUBTITLE-MODE-001)

The 2026-10-11 owner request replaces the Subtitles on/off preference with
`Always`, `Foreign audio only` and `Never`. Foreign audio only turns subtitles
on when the audio that plays is not the preferred audio language; the shared
core rule decides once the player knows its tracks and again after an audio
switch, until the viewer picks subtitles. See the
[subtitle mode contract](../specs/behavior/subtitle-mode.md).

## Next-episode autoplay (PLAY-NEXT-AUTOPLAY-001)

The 2026-10-27 owner decision ([app#65](https://github.com/viptv-org/app/issues/65))
gives the end-of-episode panel a 10-second countdown on its primary action.
At 0 the next episode plays through the same path as the button. Any key,
pointer press, seek, Back or the secondary action cancels it for that end.
Finales, movies and live channels never count down. With reduced motion only
the number counts, with no ring. Settings › Playback gains **Autoplay next
episode**, on by default. It is stored per device because the profile
preference API has no field for it.

"Nothing plays on its own" is now the TV footnote only when the setting is off
or after a cancel. The boards that promise nothing autoplays (`Tv3PlayerNext`,
`Tv3Motion` Play next and the Playback settings boards) are superseded until
the canvas re-exports them; the
[next-episode autoplay contract](../specs/behavior/next-episode-autoplay.md#superseded)
lists them.

## Android TV episode-number jump (AND-EPISODE-JUMP-001)

The proposed compact `Episode #` chip ends the season strip, after every season
badge, and opens a native numeric-input dialog. Right walks the season badges
and then reaches the chip; Down from any badge enters the episode row. Exact
current-season episode metadata controls the jump; success only scrolls and
focuses the card. Invalid input remains editable in the dialog, and Back first
hides the IME. [The behavior contract](../specs/behavior/episode-number-jump.md)
defines the full state and acceptance scenarios. This does not change the
shared Core hero Play/Resume rule or require Roku/TV-web adoption.

## Motion for pointer and touch layouts (MOTION-001)

Proposed from the 2026-10-29 owner request ([design#39](https://github.com/viptv-org/design/issues/39)):
TV cannot afford much animation, but phone, tablet, the desktop app and web
can. [The motion contract](../specs/behavior/motion.md) gives those layouts one
small scale — 120 ms for what the pointer's own movement causes, 200 ms for
content arriving or leaving, 300 ms for a sheet or drawer entering, 30 ms
between two list items, and two easings — and uses it for page crossfades, card
hover and press, the hero carousel, overlay entry and exit, list items entering
on a page's first load, the Continue Watching preview, pull-to-refresh and the
player's control layer. Nothing loops, bounces or overshoots; nothing moves on
a refresh, on paging, behind an overlay or in the video frame; and no state
change waits for an animation. Every duration is read through the app's
existing `motionSpec()`, so reduce motion snaps all of it while progress,
spinners and the Up Next number keep running. TV keeps the motion it has, and
no TV renderer adopts this.

## Desktop pointer and playback corrections (DESK-PLAYBACK-2026-10-03)

Owner approved 2026-10-03: the native desktop client uses pointer interaction.
Disable desktop keyboard shortcuts, Tab navigation, spatial navigation and
programmatic button arrival focus globally; text fields remain editable by
clicking and typing. Remove keyboard legends from desktop source pickers.
Clicking the player backdrop reveals controls and never hides them; existing
inactivity hiding and popup dismissal remain.

Relative skip clicks accumulate from the latest requested target until the
engine confirms it, in either direction. Ignore transient zero/old clock
reports while a seek is pending. Duration becomes available independently of
seeking, and the timeline draws actual reported buffered ranges. New source
selection retires the outgoing presentation before preparing the replacement.
If that explicit replacement fails, keep the player empty: do not restore the
previous video's duration, tracks, picture or audio. Managed seek/track/next
operations retain their separate recovery rules.

Returning from playback to the same open source selector retains its provider
and quality filters, including browser/titlebar Back. Opening a different title
or episode starts with All. Double-clicking the desktop titlebar during playback
uses the player's fullscreen action. Both it and the fullscreen button hide app
chrome and resize the native picture and controls to the fullscreen viewport;
exit restores the windowed layout. Outside playback, titlebar double-click keeps
the normal maximize action.

Render player controls as crisp vector icons with legible skip numbers. Native
desktop source rows use a smooth 16px radius and a 3px accent border for the best
match/selected source. Show configured provider artwork; missing artwork uses
a named monogram rather than an unknown-quality dash. All providers includes
both observed add-on and IPTV producers. Native track titles take precedence;
unknown-language tracks receive numbered labels, with codec facts when known.

Acceptance: rapid forward/backward presses and pointer scrubbing retain the
latest target without flashing zero; buffer/duration work before a skip; new
source preparation shows no outgoing video/audio; selecting All includes both
producer kinds; source artwork/borders remain smooth; desktop Tab/arrows/media
keys do not activate or navigate controls; text editing still works. Home uses
frame-bounded scroll measurement, cached card geometry and offscreen rendering
containment. Verify scrolling with many loaded shelves on the desktop host.

## 2026-10-19 — export reconciliation (264 platform boards, 273 files incl. components/simkl)

Counts at this export: TV 56, desktop 55, phone 69, tablet 18, web 40 (232
platform screens) plus 9 `components` and 26 `simkl` documents.

Decisions taken while implementing against this export:

- **Focus treatment is one rule, applied three ways.** Content rows and buttons:
  filled `#F4F2EE` with a 4 px white outline drawn *outside* the box plus a soft
  shadow. Sidebar items: the `0 0 0 3px #0B0B0C, 0 0 0 6px #F4F2EE` double ring.
  Cards: an inset 3 px white ring, no fill or size change. `Tv3SetPlayback`
  draws only the fill; TVU-16 states the outline explicitly, so the outline wins
  and the board frame is treated as incomplete.
- **A row with no cards is not drawn at all** (`Tv3RowStates` EMPTY), including
  the empty-state title. The app's old "Nothing here yet." line is gone.
- **Only state labels belong on artwork.** `New episode` (light), `Ended`
  (dark), `LIVE` (red). Presentation badges (4K/HDR/5.1/CC) are metadata and sit
  on the caption line with the certification chip.
- **No-art cards keep the board's title+year tile** (bottom-left stack), never an
  initials monogram.
- **Screens with no board are self-designed in the same vocabulary, not
  skipped:** TV History, TV Calendar, TV Recovery codes, TV Settings→Account,
  and `D3NotFound` (which does not exist in this export) has no implementation.
- **TV browse has no in-page page title**; the top navigation owns the heading and
  content starts at the 96 px inset.
- **Catalog + Filters chips replace inline facet chips on TV**, and filtering is
  applied once from the full-page filter surface ("Show results"), not per
  keystroke. (Superseded 2026-10-28 by FILTER-CHIP-001, [components.md §2](../viptv-design-system/components.md#2-chips-and-segmented-controls): app#121 put TV on the same dropdown chips and right panel as every other platform, and a pick applies at once.)
- **D-pad geometry is not trusted blindly.** A row's last card dead-ends Right
  instead of jumping to the profile avatar, Up from the first shelf row returns to
  the billboard, and Up/Down are clamped inside a settings page. The board frames
  do not show these edges; they are recorded here as deliberate navigational
  decisions.
