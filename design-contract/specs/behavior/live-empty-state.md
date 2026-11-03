# LIVE-EMPTY-001 — Live with no source, and Live with a source but no channels

Status: **implemented**, not device-verified. Both states ship in
viptv-org/app at `06bc0a96` (2026-11-02, the merge of app#493),
from the owner report 2026-10-30
([design#45](https://github.com/viptv-org/design/issues/45)).
Implemented is not verified: no device evidence exists, no board draws these
states, and [Parity](#parity) records the evidence per state.
Design commits: `bf8ac45` for this contract, `342a8c7` for the phone band and
[design#70](https://github.com/viptv-org/design/issues/70) for the artwork.
Implementation: [app#304](https://github.com/viptv-org/app/issues/304) (both
states), [app#349](https://github.com/viptv-org/app/issues/349) (the setup
actions and the shipped photographs),
[app#376](https://github.com/viptv-org/app/issues/376) (the phone band),
[app#492](https://github.com/viptv-org/app/pull/492) (the owner-role gate and
the member line) and [app#454](https://github.com/viptv-org/app/issues/454)
(the phone page bottom clearance), all of them promoted to app `main`, the
first three in `9577858` and `0074737`, plus
[app#541](https://github.com/viptv-org/app/issues/541) (the failed first
request) as [PR #544](https://github.com/viptv-org/app/pull/544) on `edge`, not
promoted yet.
Source revisions: app `06bc0a96`, `features/live/LiveEmptyState.kt`,
`LiveEmptyArtwork.kt`, `LiveRoute.kt`, `LiveScreen.kt`, `TvLiveScreen.kt`,
`connection/AccountAccess.kt`, `state/ControllerLiveSource.kt` and
`components/ScrollEdgeFade.kt`, with the desktop tests `LiveUiTest.kt`,
`LiveEmptyStateTest.kt`, `LiveEmptyArtworkTest.kt` and
`LiveEmptyPhoneLayoutTest.kt`. The failed first request is app `1ca77237` on
`edge`, the merge of [PR #544](https://github.com/viptv-org/app/pull/544):
`LiveSpread.Failed` and `LiveLoadFailed` in `features/live/LiveEmptyState.kt`,
drawn by `LiveScreen.kt` and `TvLiveScreen.kt`, with
`LiveEmptyStateTest.thePageFactsPickTheStateInTheSpecifiedOrder` and
`LiveUiTest.aFailedFirstRequestShowsTheErrorStateNotNoChannels`.
`AccountAccess` reads `account.role`:
`managesSources` is `role == "owner" && manage_account` and the member form is
`role == "member"`. Owner-only writes:
backend `04bcbfc` ([backend#205](https://github.com/viptv-org/backend/pull/205))
on `edge`, restoring the owner gate backend#149 added and backend#168 relaxed; it
reports `capabilities.manage_account` only for the owner.

## Intent

The Live page is two different stories and it tells neither: with no live
source configured it draws a filter chip over an empty page, one line and a
button into the whole of Settings. With a source configured but no channels
coming back it shows the same line again, so a broken provider looks like an
unconfigured account and the viewer is never told which it is.

Give the first state a designed, unmistakably VIPTV broadcast scene that says
what Live is and how to start it, and give the second state its own, cheaper
treatment with the reason and a retry. Hide the filter row when there is
nothing to filter, and stop sending people to a Settings page the signed-in
account may not be allowed to change.

## Which state the page shows

Only the page's own facts decide, in this order.

| Condition | State |
|---|---|
| Any channels | Today's page, unchanged |
| A filter is applied (Favourites on, or a group chosen) | Today's filtered-empty line, unchanged |
| No page yet and a request in flight | **Still loading** (LIVE-EMPTY-001B loading) |
| No page and no request open: the first request failed | **Could not load Live TV.** (LIVE-EMPTY-001B failed) |
| `LivePage.connections` is empty, or the page answered `NeedsConfiguration` | **No source** (LIVE-EMPTY-001A) |
| The page has connections and zero channels, and a request is in flight | **Still loading** (LIVE-EMPTY-001B loading) |
| The page has connections and zero channels after it answered | **No channels** (LIVE-EMPTY-001B) |

`LivePage.connections` is the page's live-capable connection list for this
profile (the app filters it by `enabled` for its Source chip), so it answers "is
a source configured" without guessing from an error string. The guide (`liveGuides`) is not a Live source and never satisfies
`connections`. A filter is Favourites on or a group chosen, never a source pick:
the Source chip is how a working connection is reached, so a source that answers
nothing keeps the no-channels state below (LIVE-EMPTY-12).

## No source (LIVE-EMPTY-001A)

The page becomes one broadcast frame: a full-bleed night-stadium photograph
behind a short, left-set text block.

- **Visible:** the artwork, an eyebrow, a one-line headline, a body line naming
  both routes (an IPTV connection with Xtream or M3U, or a live add-on), and the
  actions allowed for this account.
- **Not visible:** every filter chip (Favourites, Group, Source), the channel
  preview, the guide, the channel list and the progress bar. Nothing on the page
  is a filter, so the row that only filters has no reason to exist.
- **Headline and body:** `copy.md` owns the exact strings.

Actions, by who is looking:

| Viewer | Action block |
|---|---|
| Owner account session | Primary **Set up live TV**, secondary **Add-ons** |
| Member account session | No action; the who line **Only the household owner can set up live TV.** |
| Paired TV (a device session) | No action; the who line **Manage live TV from a signed-in phone, computer or the web dashboard.** |
| Local mode (no account) | Primary plus secondary; the device owns its own sources |

The who line occupies the action block's place, so the copy never moves between
the two forms. The facts come from the account identity the app already reads
(`/api/auth/me`): `account.role` is `owner`, `member` or `device`, and
`capabilities.manage_account` says whether this session may change household
settings at all — false for a paired TV and for a member account session, true
only for the owner's account session (backend `04bcbfc` reports it only for
`role == "owner"`; [app#300](https://github.com/viptv-org/app/issues/300) puts
that capability on the app's state; this state reads the same two fields and
depends on neither landing first). Local mode is the app's own local build. The
identity is requested when this state first appears. Until it answers, the text
block draws without an action block or who line and reserves their height; the
primary takes focus the frame it appears. No other loading state is drawn for
this.

**Set up live TV** opens Settings › Source integrations (Xtream and M3U live
there). **Add-ons** opens Settings › Add-ons. Both are the existing destinations;
nothing new is routed. A paired TV never reaches either from here, because the
server answers `403 account_session_required` to a source write, and the empty
state says so before the tap instead of after it. A member's write answers
`403 owner_required` ("Only the account owner can change household settings.");
the who line says so before the tap instead of after it.

## Sources, no channels (LIVE-EMPTY-001B)

No artwork: this is a working page whose source did not answer, not a first
run. The page ground is `bg` and the page keeps its normal inset.

- **Filter row:** the Source chip stays while more than one enabled connection
  exists, because switching source is the recovery path. Favourites and Group
  stay hidden while there are no channels: there is nothing yet to favourite or
  group.
- **Still loading:** no copy and no artwork. Six skeleton channel rows in the
  page's own row shape, in `surface-1` with the existing shimmer — TV rows
  1728 × 72, 8 apart, with a 50-wide number bar and a 300-wide title bar; P and
  W rows 72 tall with a 64 × 48 logo block and two bars, 150 and 96 wide on P
  and 220 and 160 wide on W, 8 apart. The page's linear progress bar keeps
  running under the chrome. The page never says "No channels" while a request
  is still open.
- **Answered with no channels:** headline, the server's own human reason when it
  sent one (the app's `ServerMessages` filter still decides that), and
  **Try again** as the primary when the failure is retryable. **Source
  integrations** is the secondary whenever the viewer may change sources, and
  absent otherwise. No reason and no failure → the neutral body line in
  `copy.md`.
- **Failed before any page:** with no page and no request open nothing has
  proved a source is configured, so the block never claims one is set up. It
  keeps this section's block and metrics and reads **Could not load Live TV.**,
  then the message the request read (the app's own error text, its generic
  message otherwise), **Try again**, and **Source integrations** whenever the
  viewer may change sources. There is no Source chip, no skeleton and no
  artwork.
- **Empty after a filter** stays today's line, not this state.

Retry re-requests the same query with the same filters and shows the loading
form again. Back from Source integrations returns here.

## Artwork

One photograph in two crops, both in `assets/photography/`, inventoried in
`assets/FILES.json` and described in `assets/ASSET_MANIFEST.md`:

| File | Size | Intended for |
|---|---|---|
| `assets/photography/live-empty-wide.webp` | 1920 × 1080 | Tablet, desktop, web and TV, and any layout 640 dp wide or more |
| `assets/photography/live-empty-tall.webp` | 1080 × 1440 | Phone and any layout under 640 dp |

Both are crops of one photograph of the Volksparkstadion in Hamburg: the roof
canopy and its blue-lit truss running across the frame, the floodlights beneath
it and the lit stands along the bottom edge. The wide crop carries the whole
curve with the stands as a band and, at the far side, the stadium's own video
screen playing an interview — about 110 × 75 px of the 1920 px frame, so at page
size it reads as stadium light; the tall crop turns to the roof's corner and the
right-hand stands, so a phone keeps the lights and the crowd instead of a sliver
of the wide frame. No team, league, club crest, VIPTV mark or legible face
appears in either crop.

- **Source, licence and credit:** Mario Klassen (`marioklassen`), [CC0 1.0
  Universal Public Domain
  Dedication](https://creativecommons.org/publicdomain/zero/1.0/), via
  Wikimedia Commons
  [Well lit soccer stadium (Unsplash)](https://commons.wikimedia.org/wiki/File:Well_lit_soccer_stadium_(Unsplash).jpg)
  and Unsplash [70YxSTWa2Zw](https://unsplash.com/photos/70YxSTWa2Zw). CC0
  requires no attribution; the product credits the photographer under
  Settings › About and About VIPTV anyway. `assets/photography/README.md` holds
  the same record beside the files.
- **Exact bytes:** lossy VP8 WebP, 8-bit RGB, no alpha, 173 KB wide and 111 KB
  tall. The wide crop's SHA-256 is
  `aa34ba0293dcb726421ffc79266716f91cc5b3caf779d10492b8a7ba1c89aa11`, the
  tall's
  `c212f2497a81515de0a4edb55c68c34ae43d018a85a6cbfa61c0e46e2b7ebefc`, and
  viptv-org/app packages the same two files at
  `composeApp/src/commonMain/composeResources/files/live/` since app `2d7949b8`
  ([app#349](https://github.com/viptv-org/app/issues/349)). Nothing is derived
  from them at build time and no vector source exists.
- **Scrim, drawn in code:** a page draws the crop once and then a `bg` gradient
  over it, so the copy and the actions always sit on the darkest part. Wide,
  left to right: 92 % at the left edge, 60 % at 45 %, 18 % at the right. Tall,
  top to bottom: 0 % at the top, 35 % at 40 %, 90 % at the bottom. Phone band,
  top to bottom: 0 %, 30 % at 45 %, 86 % at 80 %, 100 % at the bottom, so the
  band ends exactly on `bg` at its bottom edge. Those are the shipped stops; a
  page does not substitute its own.
- **Placement:** the page area only — under the TV navigation, the phone header,
  the desktop rail and the browser title bar, which keep their own grounds.
  Cover, anchored centre: at 1920 × 948 the wide crop loses 66 px at the top and
  66 at the bottom (roof edge and the nearest stands); a layout under 640 dp
  uses the tall crop instead, so a phone never crops the wide frame to a sliver.
  On a phone the tall crop is a full-bleed band under the header, cropped
  bottom-anchored rather than covering the page area; see the P row under
  Layout.
- **Arrival:** the page loads the crop asynchronously, so the page ground and
  its copy can paint before it (the app decodes with Coil). Nothing else on the
  page waits on the image and no placeholder is drawn.
- **Not named:** the artwork is decorative. It carries no content description
  and no accessible text; the heading, body and actions are the page.

## Layout

Platform keys follow [components.md](../../viptv-design-system/components.md)
(P phone under 640 dp, W tablet, desktop and web at 640 dp or more, T TV).
Coordinates are reference coordinates; no canvas board draws this state, so the
measurements below are derived from the type roles and the page insets in
`components.md` and are marked as derived below.

**T — 1920 × 1080, navigation 132 tall, page area 1920 × 948, inset 96**

| Element | Geometry |
|---|---|
| Artwork | 1920 × 948, cover, centre |
| Text block | x 96, width 840, vertically centred: 236 to 712 |
| Eyebrow | 18/700, +0.08em, uppercase, `text-secondary`; 22 tall at y 236 |
| Headline | D 56/700, −0.02em, line 64, at most 2 lines; y 276 |
| Body | 26/400, line 38, at most 3 lines, width ≤ 820; y 426 |
| Primary | 72 tall, radius 36, 34 side padding, 26/700; y 574 |
| Secondary | 52 tall, radius 26, 24 side padding, 22/600; y 660 |
| Gaps | 18 eyebrow→headline, 22 headline→body, 34 body→primary, 14 primary→secondary |
| Focus fill | Primary and secondary are off-white when focused, white 0.12 when not; no accent |

**W — 640 dp and wider, page inset 40**

| Element | Geometry |
|---|---|
| Artwork | fills the page area, cover, centre |
| Text block | x = 40 (the Live page's own inset), width ≤ 620, vertically centred |
| Eyebrow | 12/700, +0.06em, uppercase, `text-secondary` |
| Headline | D 40/700, −0.02em, line 46, at most 2 lines |
| Body | 16/400, line 24, at most 3 lines |
| Primary | 48 tall, radius 24, 22 side padding, accent fill, `on-accent` 16/700 |
| Secondary | 40 tall, quiet text, 15/600, `text-secondary` |
| Gaps | 16, 20, 28, 12 as on T, in that order |

**P — 390 × 844, page gutter 16, bottom bar 80**

| Element | Geometry |
|---|---|
| Artwork | the tall crop, full-bleed width, a band under the header from the top of the page area, cropped bottom-anchored; its bottom edge scrims into `bg` |
| Text block | below the band with a 20 gap, x 16, width 358; the block ends above the shared bottom clearance, the bottom bar's 80 dp box |
| Eyebrow | 11/700, +0.08em, uppercase, `text-secondary` |
| Headline | D 34/700, −0.02em, line 40, at most 3 lines |
| Body | 15/400, line 22, at most 3 lines |
| Primary | 54 tall, radius 27, full block width, accent fill, `on-accent` 17/700 |
| Secondary | 44 tall, quiet text, 15/600, `text-secondary` |
| Gaps | 12, 16, 24, 10 as on T and W, in that order |

The band's height is not fixed: it takes whatever the copy block and the shared
bottom clearance (`LocalBottomClearance`, app#345) leave it, at most about 55 %
of the page area, so it shrinks first on a short screen and the copy and
buttons never sit under the bottom bar. That clearance is the bar's own 80 dp
box and nothing more: the root applies `WindowInsets.safeDrawing` around the
page and the bar, and nothing on this page scrolls, so no page fade is drawn
over the block and neither the fade nor the navigation-bar inset is reserved.
On a 411 × 914 dp phone the copy and clearance leave roughly a third of the
page area for the band. This is what app `06bc0a96` ships
([app#376](https://github.com/viptv-org/app/issues/376),
[app#454](https://github.com/viptv-org/app/issues/454)); the who line still
takes the action block's place.

**LIVE-EMPTY-001B geometry.** Page inset and gutter as above; the block starts
at the page column's own top padding — T x 96, top 60, or top 24 when the
Source chip is drawn above it; W x 40, top 28; P x 16, top 8. T headline 44/700 line
50, body 24/400 line 34; W headline 28/700 line 34, body 15/400 line 22; P
headline 20/700 line 26, body 14/400 line 21. Actions use each layout's primary
and secondary geometry above. Skeleton rows start where channel rows start
today.

## Focus, input and timing

- **T:** entering Live focuses the navigation's own Live tab, as on every TV
  page. The first Down enters the page on the primary; Down again reaches the
  secondary; Up returns to the navigation. Right and Left do nothing on either
  action. The artwork, eyebrow, headline, body and who line are not focus stops.
  A held OK presses the focused action once; it does not repeat, and there is no
  hold action anywhere in this state.
- **T return:** Back from Settings › Source integrations or Add-ons returns to
  Live on the primary, re-requesting the page. If the request now has channels,
  today's Live page shows instead.
- **W:** no autofocus. Tab reaches the primary, then the secondary; Enter and
  Space activate. A pointer press keeps the existing 0.97 scale and hover steps.
- **P and tablet:** taps. The primary is 54 tall, above the bottom bar; the
  block does not scroll, so no page fade covers it and nothing in the block sits
  under the bar.
- **Motion:** nothing animates in, loops or delays an action. The block and the
  artwork appear in the same frame as the page here; the app's shipped
  photograph loads asynchronously, so it can arrive after the copy (see
  [Parity](#parity)). On TV the primary's focus fill keeps the existing 150 ms
  fill; `reduced motion` leaves it as it is.
- **Live updates:** if the page request answers with channels while this state
  is shown (a source added on the phone), the state is replaced in place with no
  transition and focus moves to the first channel row.

## Copy

Exact strings live in [copy.md](../../viptv-design-system/copy.md#empty-states):
the eyebrow, headline, body, both actions, both who lines, the no-channel
headline, body and retry, and the failure headline with its generic body.
Retired: the app's `No channels are available for this
profile.`, its `Manage add-ons` button, and the page's empty-page `All channels`
button in the no-source state.

## Accessibility

- The headline is the page's heading; the eyebrow, body and who line are text in
  reading order. The artwork is announced as nothing.
- The primary and secondary are real buttons with their visible labels. The who
  line is not an action and is not focusable.
- The page never reports "no channels" while the request is open, and never
  announces an empty list to a screen reader before the request answers.
- Announcements already in place (favourite toggles, guide errors) are unchanged.

## Acceptance

1. **LIVE-EMPTY-01:** a profile with no live connection, opened on TV at
   1920 × 1080. The stadium photograph fills the page area under the navigation,
   the eyebrow, headline and body read against its scrimmed left side, and there
   is no filter chip, no preview and no channel list anywhere on the page. The
   navigation's Live tab is focused; Down lands on **Set up live TV**.
2. **LIVE-EMPTY-02:** from LIVE-EMPTY-01, OK on the primary opens Settings on
    its **Source integrations** page; Back returns to Live with the primary
    focused and a re-requested page.
3. **LIVE-EMPTY-03:** the same profile on a phone at 390 × 844. The tall crop
    is a full-bleed band under the header, scrimmed into `bg` at its bottom
    edge; the eyebrow, headline, body and both actions sit below it on the 16 dp
    gutter; the primary is a full-width accent button and the actions end above
    the bottom bar's 80 dp box, with nothing reserved for a scroll fade.
4. **LIVE-EMPTY-04:** the same profile in a desktop window at 1440 × 900, in a
    browser at 1280 × 800, on a tablet at 1280 × 800 and with the desktop window
    narrowed to 600 wide. The first three use the wide crop; the 600-wide
    window uses the tall one. No layout shows a chip.
5. **LIVE-EMPTY-05 (member):** signed in as a member, the page shows the
    headline, body and **Only the household owner can set up live TV.** and no
    button; Tab (or Down on TV) finds nothing in the block, and the page has no
    focus stop beyond the navigation.
6. **LIVE-EMPTY-06 (paired TV):** a TV paired to an owner account shows
    **Manage live TV from a signed-in phone, computer or the web dashboard.**
    and no button. The same account on the phone still shows both actions.
7. **LIVE-EMPTY-07 (local mode):** a local build shows both actions and they
    reach Settings › Source integrations and Settings › Add-ons.
8. **LIVE-EMPTY-08 (no channels, loading):** one connection configured, the
    request open. The Source chip is present when a second connection exists and
    absent with one; no "No channels" copy is visible; six skeleton rows and the
    progress bar are, on TV, phone and desktop.
9. **LIVE-EMPTY-09 (no channels, failure):** the request answers with zero
    channels and a reason. The headline, the server's human reason and **Try
    again** appear; there is no artwork; OK/Tap retries, returns to the loading
    form and then to this state if it fails again.
10. **LIVE-EMPTY-10 (no channels, empty answer):** zero channels, no reason,
    no failure. The neutral body line shows and no error styling appears.
11. **LIVE-EMPTY-11:** with a filter applied (Favourites on, or a group chosen)
    and zero matching channels, the page keeps today's filtered line and
    today's chips, and neither new state appears.
12. **LIVE-EMPTY-12 (recovery):** from LIVE-EMPTY-09 with two connections,
    switching the Source chip to the working connection replaces the state with
    the channel list; switching back reproduces it.
13. **LIVE-EMPTY-13:** a source added elsewhere while this state is shown
    replaces it with the channel list in place, with no animation, and the
    remote lands on the first channel row.
14. **LIVE-EMPTY-14 (first request failed):** the first Live request fails with
    no page. The page reads **Could not load Live TV.**, the message the request
    carried, **Try again** and, when the viewer may change sources, **Source
    integrations**; it never reads **No channels came back.** or **This source
    is set up, but it isn't sending channels.** OK/Tap on **Try again** returns
    to the loading form and then to this state if it fails again.

## Parity

One row per state, in the fields [DESIGN_SYNC](../../docs/process/DESIGN_SYNC.md)
requires. No reference screen draws these states, so the visual column holds the
app's own rendered measurements, not a board comparison.

| Field | No source (LIVE-EMPTY-001A) | Still loading (LIVE-EMPTY-001B) | Answered with no channels (LIVE-EMPTY-001B) | Failed first request (LIVE-EMPTY-001B) |
|---|---|---|---|---|
| Contract | design `bf8ac45`, `342a8c7` and [design#70](https://github.com/viptv-org/design/issues/70); [No source](#no-source-live-empty-001a) and [Artwork](#artwork); LIVE-EMPTY-01–07 | design `bf8ac45`; [Sources, no channels](#sources-no-channels-live-empty-001b); LIVE-EMPTY-08 | design `bf8ac45`; the same section; LIVE-EMPTY-09–13 | this contract; the same section; LIVE-EMPTY-14 |
| Implementation | app `06bc0a96`: `LiveNoSourcePage` and `LiveEmptyArtwork` in `features/live/LiveEmptyState.kt` and `LiveEmptyArtwork.kt`; `AccountAccess` picks the owner, member and paired forms from `account.role`; `LiveRoute` returns before the page chrome; the phone block ends on `bottomBarClearance` | app `06bc0a96`: `liveSpread` → `Loading`, `LiveChannelSkeletons` in `LiveScreen.kt` and `TvLiveScreen.kt`, the route's progress bar | app `06bc0a96`: `liveSpread` → `NoChannels`, `LiveNoChannels`, the route's retry and Source integrations | app `1ca77237` (PR [#544](https://github.com/viptv-org/app/pull/544)): `liveSpread` → `Failed`, `LiveLoadFailed` in `features/live/LiveEmptyState.kt` drawn by `LiveScreen.kt` and `TvLiveScreen.kt`, the route's retry and Source integrations |
| Functional evidence | `LiveEmptyStateTest` and `LiveUiTest` cover the page facts, both actions and their Settings sections, identity loading, the TV focus entry and return, and the four layouts; the owner, member and paired forms are `ownerAccountSessionSeesTheSetupActionsAndNoWhoLine`, `memberAccountSessionSeesTheWhoLineAndNoSetupActions`, `aMemberOnTheTvGetsNoFocusStopInTheBlock`, `whoMayChangeSourcesFollowsTheHouseholdOwner` and `sourceIntegrationsWaitsForTheOwnerAsTheSetupActionsDo`; `LiveEmptyPhoneLayoutTest` covers the phone band and its who line | `LiveUiTest.noChannelsWhileTheRequestIsOpenDrawsSixSkeletonsAndOnlyTheSourceChip`, on TV and desktop with one and two connections | `LiveUiTest.noChannelsAnsweredShowsTheReasonAndRetryOnlyWhenSomethingFailed`, `sourceIntegrationsIsAbsentWhenTheViewerCannotManageSources`, `sourceIntegrationsWaitsForTheOwnerAsTheSetupActionsDo` and `aSourceAddedElsewhereReplacesTheEmptyStateInPlace` | `LiveUiTest.aFailedFirstRequestShowsTheErrorStateNotNoChannels` on desktop 1280 and TV 1920, with `LiveEmptyStateTest.thePageFactsPickTheStateInTheSpecifiedOrder` |
| Visual evidence | no board. `LiveEmptyArtworkTest` measures the photograph's distinct colours and its scrim luminance, `LiveEmptyPhoneLayoutTest` measures the band, gutter and clearance at 360 × 640 and 412 × 915 | no board; six rows and the row shape are asserted, not measured | no board; the copy, the absent artwork and the action geometry are asserted | no board; the failure headline, the read message, the retry and the absent no-channels copy are asserted |
| Device evidence | unverified: none | unverified: none | unverified: none | unverified: none |
| Disposition | implemented/unverified | implemented/unverified | implemented/unverified | implemented/unverified |

Run: app PR [#407](https://github.com/viptv-org/app/pull/407), `app checks`
[41326673788](https://github.com/viptv-org/app/actions/runs/41326673788), on the
revision that contains the tests above, and app PR
[#492](https://github.com/viptv-org/app/pull/492), `app checks`
[41443517520](https://github.com/viptv-org/app/actions/runs/41443517520), for the
member line, and app PR [#493](https://github.com/viptv-org/app/pull/493), `app
checks` [41448928194](https://github.com/viptv-org/app/actions/runs/41448928194),
for the phone page bottom clearance, and app PR
[#544](https://github.com/viptv-org/app/pull/544), `app checks`
[41528882283](https://github.com/viptv-org/app/actions/runs/41528882283), for the
failed first request. app#349's own change is
[app#352](https://github.com/viptv-org/app/pull/352)
([run 41269197286](https://github.com/viptv-org/app/actions/runs/41269197286)).

### What matches

- A filter wins over every other state. With a page in hand, empty
  `connections` or `NeedsConfiguration` is the no-source page, zero channels
  with a request open is the loading form, and zero channels answered is the
  no-channels state; with no page and no request open it is the failed form
  (`liveSpread`, `LiveEmptyStateTest.thePageFactsPickTheStateInTheSpecifiedOrder`).
- The no-source page returns before the page chrome: no filter chip, preview,
  guide, channel list or progress bar
  (`LiveUiTest.tvNoSourceIsOneBroadcastFrameAndBothSetupActionsReachTheirSettingsSection`).
- The action block follows the identity. Local mode and the account owner get
  **Set up live TV** and **Add-ons**; a member account session gets
  **Only the household owner can set up live TV.** and no action; a paired TV
  gets its own line and no action. While the identity is open the block's height
  is reserved; on TV the primary takes focus the frame it appears
  (`identityStillLoadingLeavesTheActionBlockEmpty`); Down from the navigation
  reaches it otherwise; Back from Settings returns to Live with the primary
  focused (`liveSetupReturnFocus`, `tvDownFromTheNavigationEntersThePageOnThePrimary`).
- The owner role decides. `AccountAccess` requires `role == "owner"`
  alongside `manage_account`, so a member gets neither the no-source actions nor
  the no-channels **Source integrations** secondary
  (`whoMayChangeSourcesFollowsTheHouseholdOwner`,
  `sourceIntegrationsWaitsForTheOwnerAsTheSetupActionsDo`).
- Copy matches `copy.md` word for word: the eyebrow, the headline, the body,
  both actions, both who lines, the no-channels headline, the neutral body, the
  failure headline and its generic body, **Try again** and **Source
  integrations**.
- A failed first request draws the no-channels block and metrics with
  **Could not load Live TV.**, the message it read and **Try again**, never the
  no-channels headline or neutral body
  (`aFailedFirstRequestShowsTheErrorStateNotNoChannels`).
- The loading form draws six skeletons in the page's row shape and no copy, with
  the page's progress bar; the Source chip survives only while a second enabled
  connection exists; Favourites and Group wait for channels.
- **Source integrations** is absent when the viewer may not change sources;
  **Try again** is the primary with a failure to retry.
- The artwork is the contract's own photograph: the two packaged WebP crops are
  byte-for-byte the files in `assets/photography/`, the tall crop carries the
  phone band, and the scrims use the stops above. The page's first frame can
  still show the copy before the crop decodes (Coil loads it).
- Phone and tablet use the tall photograph, every layout 640 dp or wider the
  wide one (`compact = maxWidth < 640.dp`), so a 600-wide desktop window uses the
  phone block (`narrowDesktopWindowUsesThePhoneBlock`).
- The phone block ends at the shared bottom clearance, the bar's own 80 dp box,
  and nothing scrolls, so no fade is drawn over it and neither the fade nor the
  navigation-bar inset is reserved
  (`LiveEmptyPhoneLayoutTest.thePhoneBlockFitsUnderTheHeaderWithItsActionsClearOfTheBottomBar`,
  `aViewerWhoCannotSetUpLiveReadsTheWhoLineWhereTheActionsWouldBe`).
- Retry re-requests the same `liveQuery` and shows the loading form again;
  channels arriving replace the state in place
  (`aSourceAddedElsewhereReplacesTheEmptyStateInPlace`, which does not assert the
  TV focus landing).

## Unknowns

- No device evidence exists for any of the three states on any platform; the
  evidence above is the app's desktop tests. No board draws these states, so
  their geometry is derived — the phone band measured by the app's own layout
  test.
- The issue's third next step, "find free live add-ons", has no destination in
  the product: there is no add-on directory, catalogue or recommendation list in
  the app, the web dashboard or the server. The body names the two routes that
  exist; a free-add-on directory needs its own design and its own route.
- How quickly the account identity answers is an app decision. This contract only
  says the action block waits for it and holds its height. `account.role` picks
  the owner/member/device form, and `capabilities.manage_account` — owner-only
  since backend `04bcbfc` — confirms the owner before the setup actions draw.
- A paired TV cannot write sources at all, so its line names other devices
  rather than an action. Whether that line should become a QR code or a deep
  link to the dashboard is open, and no origin string is added to copy.
- The wide artwork's top and bottom 66 px are cropped at 1920 × 948. A future
  page area of a different shape (an ultra-wide window) changes the crop, not
  the composition, but it has not been looked at on a 2560 × 1080 window.