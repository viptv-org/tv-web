# Design changes

## 2026-11-06 — The toast carries a removal's Undo, and My List removals get a line

[app#892](https://github.com/viptv-org/app/issues/892) needs one notice surface for every
completed save and removal. [components.md §9](viptv-design-system/components.md#9-feedback)
now says the toast may carry **Undo**: a removal notice lasts 8 s, the action is a text
button at the end of the copy's line, Undo puts the title back where it was and dismisses
the notice, one notice shows at a time and a newer one replaces the old one, and a toast
never takes focus by itself — on T, Up from the page's topmost control reaches its action
and Down returns, as the backend banner's Dismiss does. [copy.md](viptv-design-system/copy.md#toasts-notices-and-loading)
gains **Removed from My List** and records both removals as the §9 toast with **Undo**,
replacing the Undo-dialog wording; [decisions.md](viptv-design-system/decisions.md#settled-with-the-product-owner)
§Settled 5 follows.

Refs [design#137](https://github.com/viptv-org/design/issues/137), [app#892](https://github.com/viptv-org/app/issues/892).

## 2026-11-05 — A Live preview frames its programme by the clock

[LIVE-PREVIEW-001](viptv-design-system/copy.md#live) records that the Live page's preview follows the clock, not the guide's selection: phone draws the **LIVE** badge, the progress bar and **"[N] min left"** only while the programme is on air, **"Starts at [time] · [N] min"** with the programme's own length before it starts and **"Ended"** after it ends. A programme that is not on air carries no LIVE badge and no bar. TV and the desktop preview keep their **"start – end"** line and append the same state. [copy.md](viptv-design-system/copy.md#live) gains the section and [components.md §3](viptv-design-system/components.md#3-badges-and-indicators) the rule that the badge marks only what is on air.

Refs [design#135](https://github.com/viptv-org/design/issues/135), [app#893](https://github.com/viptv-org/app/issues/893).

## 2026-11-05 — The player's failure page is one page with one set of copy

The owner decided [design#128](https://github.com/viptv-org/design/issues/128): every platform draws the same failure page from the same state. [components.md §10](viptv-design-system/components.md#10-player-controls) records it — **"This source stopped working"**, the source's failure (`[Source] didn’t respond. Choose another source.`, adding `to continue from [time]` when playback had a position above 0), then **Try [next source]** / **Choose another source** / **Back**. The Details disclosure is dropped because nothing implements it, phone and desktop said "Choose a source" where TV said "Choose another source"; all of them say **Choose another source** now. [copy.md](viptv-design-system/copy.md#errors) gains the strings. The `M3PlayerError`, `D3PlayerError` and `Tv3PlayerError` boards and their WebP exports are re-rendered with the new copy.

Refs [design#128](https://github.com/viptv-org/design/issues/128), [app#848](https://github.com/viptv-org/app/issues/848).

## 2026-11-04 — The player Audio & subtitles panel is redesigned with inline subtitle settings

[PLAY-TRACKS-001](specs/behavior/player-audio-subtitles-panel.md) records the owner-requested redesign of the player Audio & subtitles panel (app#647): subtitle rows become one line per language with the source as a quieter secondary line, grouped when several sources offer the same language, ellipsizing instead of wrapping, with equal row heights and a fixed selection-mark slot; the Audio column collapses to a single **Default audio** line with zero or one track; and the profile's subtitle settings — **Subtitles**, **Subtitle language**, **Size** (Small / Medium / Large) and **Background** (None / Box) — sit compactly in the panel, saved and applied live where the player supports it. [copy.md](viptv-design-system/copy.md#names) gains the panel strings and [components.md](viptv-design-system/components.md#10-player-controls) the panel geometry and rules. The `W3PlayerAudio` board is superseded until the canvas re-exports it.

Refs [app#647](https://github.com/viptv-org/app/issues/647).

## 2026-11-03 — The phone title source-summary row records real quality/provider/count

[AND-043](docs/platforms/ANDROID_DESIGN.md#and-043--title-source-summary-and-episode-watching-marker-2026-10-02) already defined the phone source summary and episode watching marker as proposed; the shipped phone surface is now recorded in the normative files so the title page has a matching component and copy spec. [components.md](viptv-design-system/components.md#6-cards-and-tiles) gains the AND-043 row and [copy.md](viptv-design-system/copy.md#names) its strings: a full-width 58 dp row under the primary Play/Resume action that reads the best source's quality badge (or **Auto**), **provider · N sources** and a chevron, opens the source picker without starting playback, and shows a skeleton before a source arrives, **No sources found** for a settled empty result and **Sources unavailable** for a failed or timed-out one. Records app PR [#582](https://github.com/viptv-org/app/pull/582) (app#560, branch `fix/560-phone-series-info`, targeting `edge`).

Refs [app#560](https://github.com/viptv-org/app/issues/560).

## 2026-11-03 — Episode rows show their air date and mark planned episodes as upcoming

[EPISODE-AIR-DATE-001](viptv-design-system/components.md#6-cards-and-tiles) records app PR
[#580](https://github.com/viptv-org/app/pull/580) (app#574, branch
`feat/574-episode-air-dates`, targeting `edge`): the Details episode selector
shows each episode's release date under the caption — month, day and year in the
device's locale. A future date, or no date later than the last released episode,
is upcoming: the row shows **Upcoming · Airs [month day]** (or **Upcoming** with
no date), mutes its title, drops the play affordance and explains **This episode
isn't out yet.** instead of fetching sources. Row height is unchanged whether or
not a date exists, and player episode pickers are unchanged.
[copy.md](viptv-design-system/copy.md#names) gains the selector copy and
[components.md](viptv-design-system/components.md#6-cards-and-tiles) the
EPISODE-AIR-DATE-001 entry.

Refs [app#574](https://github.com/viptv-org/app/issues/574).

## 2026-11-03 — The saved session's failed launch is retried, then retriable

[STARTUP-RECOVERY-001](specs/behavior/startup-recovery.md) records app PR
[#563](https://github.com/viptv-org/app/pull/563) (app#557, branch
`fix/557-post-update-launch-hang`, targeting `edge`): a saved session whose
first launch refresh hits a transport or 5xx failure retries quietly after 1 s,
2 s and 4 s before the entry screen shows anything; when every attempt fails the
reason line reads **Could not reach your server. Check the connection and try
again.** (transport) or the server's own message (5xx), with **Try again** below
it on every layout, and a return to the app retries by itself. An expired
session still goes straight to sign-in with **Session expired. Sign in again.**
and is never retried. [copy.md](viptv-design-system/copy.md#sign-in) gains the
**Try again** entry copy.

Refs [app#557](https://github.com/viptv-org/app/issues/557).

## 2026-11-02 — A failed first Live request is a failure, not an empty page

[LIVE-EMPTY-001](specs/behavior/live-empty-state.md) records app `1ca77237` on
app `edge` ([app#541](https://github.com/viptv-org/app/issues/541), [PR
#544](https://github.com/viptv-org/app/pull/544)): with no page and no request
open, `liveSpread` answers `LiveSpread.Failed`, so a first Live request that
fails reads **Could not load Live TV.**, the message the request read
(**Something went wrong. Try again.** when it carried none), **Try again** and,
when the viewer may change sources, **Source integrations** — the no-channels
state's block and metrics instead of its **No channels came back.** The state
table, LIVE-EMPTY-14 and the parity record carry it, and
[copy.md](viptv-design-system/copy.md#empty-states) gains the headline.
LIVE-EMPTY-11 loses **or source chosen**: a Source chip pick is not a filter, so
switching back to a source that sends nothing reproduces the no-channels state
LIVE-EMPTY-12 asks for ([app#539](https://github.com/viptv-org/app/issues/539)).

Refs [app#541](https://github.com/viptv-org/app/issues/541),
[app#539](https://github.com/viptv-org/app/issues/539).

## 2026-11-02 — The phone Watch on TV row, setup and remote surface ship

[components §11](viptv-design-system/components.md#11-tv-remote-phone-watch-on-tv--android-phone-and-tablet)
and [ACCT-SPLIT-001](specs/behavior/account-and-profile-settings.md) record the
phone **Watch on TV** row as shipped at app `09fef5c7` (app#486,
[app#512](https://github.com/viptv-org/app/pull/512)): `SettingsRow.WatchOnTv`
in the This device group, gated by `watchOnTvAvailable()` to non-television
Android UI modes, reading **Off** until a TV is paired. The setup flow ships at
app `04599d57` (app#487, [app#520](https://github.com/viptv-org/app/pull/520))
and the remote surface — the 44 dp header button, the one-time tip and the
bottom-sheet remote — ships at app `cc3684a0` on `edge` (app#488,
[app#536](https://github.com/viptv-org/app/pull/536)). The full **Watch on TV**
settings page, the error and permission lifecycle (app#489) and the browser
dialog stay proposed.

Refs [design#80](https://github.com/viptv-org/design/issues/80).

## 2026-11-02 — The phone Live empty state ends on the bottom bar's box

[LIVE-EMPTY-001](specs/behavior/live-empty-state.md) records app `06bc0a96`
([app#454](https://github.com/viptv-org/app/issues/454),
[PR #493](https://github.com/viptv-org/app/pull/493)): the shared bottom
clearance (`LocalBottomClearance`) is the bottom bar's own 80 dp box, so the
phone no-source block, its actions and the member who line end 28 dp lower than
the bar-plus-fade band they used to clear. The root applies
`WindowInsets.safeDrawing` around the page and the bar once, and nothing on the
page scrolls, so no fade is drawn over the block and the clearance reserves
neither the fade nor the navigation-bar inset. The P geometry row, the
LIVE-EMPTY-03 acceptance and the design-system P geometry row match.

Refs [design#75](https://github.com/viptv-org/design/issues/75).

## 2026-11-02 — The Live member who line ships

[LIVE-EMPTY-001](specs/behavior/live-empty-state.md) records app `434d10e2`
(app `edge`, [app#492](https://github.com/viptv-org/app/pull/492)): the Live
no-source block decides by `account.role`, so a member account session gets
**Only the household owner can set up live TV.** and no action while the owner
and local mode keep **Set up live TV** and **Add-ons** and a paired TV keeps its
own line. The same rule removes the no-channels **Source integrations**
secondary for a member. LIVE-EMPTY-05 ships, and the parity record lists the
member form with what matches instead of among its differences.

Refs [design#74](https://github.com/viptv-org/design/issues/74).

## 2026-11-02 — The phone remote pins its TV's certificate instead of weakening TLS

[AND-038](docs/platforms/ANDROID_DESIGN.md#and-038--android-phone-and-tablet-vizio-remote-2026-11-02)
and [CORE-003](docs/architecture/SHARED_CORE.md#core-003--vizio-smartcast-control)
now state the SmartCast transport rule the app implements at `d5f89ea6`
([app#485](https://github.com/viptv-org/app/issues/485),
[PR #496](https://github.com/viptv-org/app/pull/496)): Vizio SmartCast TVs
serve self-signed certificates, so the exact-TV-origin client pins the SHA-256
fingerprint of the TV's leaf certificate at a successful PIN pairing, seals it
with the token under the Android Keystore key, and afterwards accepts only that
certificate for that host and port. A different certificate fails the
connection and the existing recovery's **Pair again** replaces the pin on the
next successful pairing; pairing is the trust-establishing step and runs
unpinned, the first pairing trusts whichever certificate answers at the selected
address, **Forget** drops the pin with the token while a replacement TV under
**Change TV** pins its own, and there is no trust-all manager: the pin is stored
and checked per exact origin, and a self-signed certificate's names are not what
binds the connection. The ordinary backend and catalog
transport keep normal certificate validation. The pairing page keeps its copy,
geometry and auto-submitted four-digit PIN and shows no certificate
fingerprint, because the TV states none to compare it with
([components §11](viptv-design-system/components.md#11-tv-remote-phone-watch-on-tv--android-phone-and-tablet),
[decisions](viptv-design-system/decisions.md#phone-tv-remote-watch-on-tv--proposed-for-android-phone-and-tablet)).
[AND-039](docs/platforms/ANDROID_DESIGN.md#and-039--phone-remote-reliability-and-responsiveness)
keeps off-thread transport setup and names that pin instead of "no TLS
weakening".

Refs [design#76](https://github.com/viptv-org/design/issues/76).

## 2026-11-02 — Household configuration writes are owner-only again

[ACCT-SPLIT-001](specs/behavior/account-and-profile-settings.md) and
[LIVE-EMPTY-001](specs/behavior/live-empty-state.md) now record backend
`04bcbfc` ([backend#205](https://github.com/viptv-org/backend/pull/205)): a
member account session reads the household inventories and checks a shared
gateway's capacity but cannot write them — the household PIN, add-ons, source
integrations, connections, matches, gateways and device/session sign-outs answer
`403 owner_required` ("Only the account owner can change household settings."),
and `GET /auth/me` reports `capabilities.manage_account` only for the owner.
Reads stay open to any account session, and password, delete-account, pairing,
profile and parental-policy routes stay self-service. The Live member who line
**Only the household owner can set up live TV.** is no longer a parity
difference.

Refs [design#77](https://github.com/viptv-org/design/issues/77).

## 2026-11-02 — The Live no-source artwork is the shipped CC0 photograph

[LIVE-EMPTY-001](specs/behavior/live-empty-state.md#artwork) and
[components.md §13](viptv-design-system/components.md#13-empty-states-and-artwork)
now specify one artwork: two crops of Mario Klassen's CC0 photograph of the
Volksparkstadion, Hamburg, 1920 × 1080 for W and T and 1080 × 1440 for P,
copied into `assets/photography/` byte for byte from what viptv-org/app
packages since `2d7949b8` ([app#349](https://github.com/viptv-org/app/issues/349)),
with the photographer, both source URLs, the CC0 licence and the file hashes
recorded beside them and in `assets/ASSET_MANIFEST.md`. The reading scrim is
drawn in code at the stops the app ships. The two hand-authored SVGs are retired
from the contract and the inventory. Copy, layout and state selection are
unchanged.

Refs [design#70](https://github.com/viptv-org/design/issues/70).

## 2026-11-02 — The phone Vizio remote is specified for the KMP app

AND-038 now brings the phone Vizio remote into the KMP app on Android phone
and tablet, superseding AND-042's exclusion of it. The **Watch on TV** opt-in
row returns to Settings › This device, setup is intro → bounded LAN search on
both SmartCast ports (7345/9000) → manual IPv4 → four-digit auto-submitted PIN
→ connected, and one paired TV shows the 44 dp header remote button next to the
profile entry on Discover, Live and My List with the one-time "Your TV remote"
tip. The remote sheet keeps the D-pad/OK, Back, Play/Pause, volume and swipe
controls, an exact-TV-origin HTTPS transport with Android Keystore tokens, the
eight-command bounded queue with no replay on return, and offline, permission
and rejected-PIN recoveries. Android TV, iOS, desktop and web do not adopt it.

Refs [design#67](https://github.com/viptv-org/design/issues/67).

## 2026-11-02 — The Live empty states are implemented, with a parity record of what differs

[LIVE-EMPTY-001](specs/behavior/live-empty-state.md) is **implemented**, not
device-verified: both states ship in viptv-org/app at `86df58c1`
([app#304](https://github.com/viptv-org/app/issues/304),
[app#349](https://github.com/viptv-org/app/issues/349),
[app#376](https://github.com/viptv-org/app/issues/376)), and the spec carries
the per-state record [DESIGN_SYNC](docs/process/DESIGN_SYNC.md) asks for:
contract, implementation, functional, visual and device evidence, and
disposition. Matching the app: the state order, the empty page without a chip,
preview, guide or list, the copy, the action forms for local mode, the account
owner and a paired TV, six skeletons with only the Source chip while loading,
and the no-channels reason with **Try again** and **Source integrations**.
Differing: the app ships two credited CC0 photographs with the scrim in code
instead of the SVG illustration ([design#70](https://github.com/viptv-org/design/issues/70));
a member account session is offered the setup actions and refused only at the
source write ([viptv-org/app#484](https://github.com/viptv-org/app/issues/484));
a chosen source is not a filter, so its zero channels show the no-channels state;
and a failed first request shows no channels with no page in hand. The
no-channels block offsets and skeleton bars are the app's own padding and bar
widths, and the copy table drops its proposed tags.

Refs [design#69](https://github.com/viptv-org/design/issues/69).

## 2026-11-02 — The phone Live no-source layout is a top photo band

[LIVE-EMPTY-001](specs/behavior/live-empty-state.md)'s phone geometry now
matches what viptv-org/app ships at `86df58c1`
([app#376](https://github.com/viptv-org/app/issues/376)): under 640 dp the tall
artwork is a full-bleed band under the header, cropped bottom-anchored and
scrimmed into `bg` at its bottom edge, and the eyebrow, headline, body and
full-width actions sit below it on the 16 dp gutter. The band takes whatever
the copy and the shared bottom clearance leave — at most about 55 % of the page
area and about a third on a 411 × 914 dp phone — so it shrinks first on short
screens and the copy and buttons never sit under the bottom bar. The who line
still takes the action place. The design-system P geometry row and
LIVE-EMPTY-03 match.

Refs [design#54](https://github.com/viptv-org/design/issues/54).

## 2026-11-02 — The controlled next episode plays the best match on either Default source

[PLAY-NEXT-AUTOPLAY-001](specs/behavior/next-episode-autoplay.md) now says how
the next episode starts, from app `f19e0dc6`, `9e236f52` and `5e4ebbc7`: Next,
the TV pill, the end panel's primary action and the countdown play its best
match whatever the profile's **Default source** says, from the source prepared
during the last three minutes when there is one, otherwise from the series'
remembered source or from the best match at the end of discovery. The picker
plays nothing when no row survives the hard filters, a ranking request fails or
three starts fail. Picking any other episode still asks.

[SRC-BEST-MATCH-001](specs/behavior/source-best-match.md) records the shipped
[remembered source](specs/behavior/source-best-match.md#remembered-source),
names the two starts that **Always ask** now allows, and moves fallback with its
notices from proposed to shipped (app `805b7c0f`, [app#411](https://github.com/viptv-org/app/issues/411)).
[Playback capabilities](docs/playback/PLAYBACK_CAPABILITIES.md) names those
starts instead of treating Best match as the only exception.

Refs [design#62](https://github.com/viptv-org/design/issues/62).

## 2026-11-02 — The Episode # chip ends the season strip

[AND-EPISODE-JUMP-001](specs/behavior/episode-number-jump.md) now places the
`Episode #` chip at the end of the season strip, after every season badge, not
beside the selected badge. The TV Details header is one focus run: Right walks
the season badges and then reaches the chip, and Down from any badge enters the
episode row, so the viewer keeps stepping seasons and the chip never interrupts
that. The component and decision notes and the TV-044 pill row carry the same
order. viptv-org/app ships it at `c8d541ff`
([app#409](https://github.com/viptv-org/app/issues/409)); the reference screen
exports predate the chip and need no re-export.

Refs [design#63](https://github.com/viptv-org/design/issues/63).

## 2026-11-02 — The app updates contract is the shipped Android flow

[app-updates.md](specs/behavior/app-updates.md) now describes what
viptv-org/app ships at `62e0c949`: the prompt is **Update ready**, **Update
required** or **Couldn't update VIPTV** with **Install** · **Later**, a banner on
phone and tablet and a corner card on TV; the About status lines and last-check
line are the app's; the build downloads quietly before the prompt and there is
no download dialog; checks run at most once an hour; and a required update comes
back on every return to the app. The settings table no longer names GitHub
releases as the source: updates come from the signed-in server's
`/updates/android/update.json` and the APK it names.

Refs [design#55](https://github.com/viptv-org/design/issues/55).

## 2026-11-02 — Best match starts as soon as it meets every preference

[SRC-BEST-MATCH-001](specs/behavior/source-best-match.md) describes one start
rule: the first Best matches row starts as soon as a ranking reports that it
fully meets the profile's quality, audio, HDR and delivery preferences, and at
the end of discovery otherwise. The countdown, its hard deadline and its
Play now / Cancel controls, with the acceptance scenarios that assumed them,
make way for that rule. The status header separates what ships in app
`62e0c949`, backend `e1ec02d` and core `985a23f` — the ranking order and hard
filters without decode class and series memory, the Best matches and All sources
groups with their headers and marker, progressive ranking, and the early start —
from what is still proposed: decode class, series memory and device capability
([core#32](https://github.com/viptv-org/core/issues/32)), and fallback with its
notices ([app#411](https://github.com/viptv-org/app/issues/411)). A start stops
on a pick, a close, leaving the screen or a drag on the list; moving focus in
the list does not stop it. The marker and the row that starts are the same row.
`docs/playback/PLAYBACK_CAPABILITIES.md` names the automatic start.

Refs [design#56](https://github.com/viptv-org/design/issues/56).

## 2026-11-01 — The brand rasters are checked against the vector master

`scripts/validate.py` now regenerates `assets/brand/app-icon/` and
`brand-mark-tile.svg` from `assets/brand/viptv-v.svg` on every run and fails when
a committed file no longer matches: the SVGs byte for byte, the two PNGs within
resampling tolerance, so a Pillow other than the pin fails only on a changed
mark. A stale icon, a hand-edited layer or a raster left behind by a master
change can no longer pass validation. The committed rasters and the app's copies
of them — the 1024 px square and the TV banner — already come from the master
and are unchanged.

Refs [design#49](https://github.com/viptv-org/design/issues/49).

## 2026-10-30 — One vector master for the branded V

`assets/brand/viptv-v.svg` is the VIPTV V for every surface: the branded V of
the Roku wordmark as one closed path, traced from
`assets/roku/roku/images/viptv-mark.png` and checked by
`assets/brand/tools/trace_v.py`. It reproduces the raster at a mean absolute
coverage error of 0.004 of a pixel and keeps the mark's own geometry: the flat
top cut, the two outer edges, each arm's inner edge bending once on the way to
the notch apex, and a bottom tip rounded tangent to both outer edges.

`assets/brand/tools/make_app_icon.py` generates every variant from that path:

- **In-app mark tile** — `assets/brand/brand-mark-tile.svg`: accent ground at
  radius 30 (`radius.app-mark`), the V in the app's background colour.
- **Launcher icons** — the 72-unit square and its 1024 px render, the adaptive
  foreground for the 72-unit visible area and the monochrome layer, white on
  black as before.
- **TV banner** — 320 × 180, white "VIPTV" on black; both V's are the master at
  the cap height and "IPT" stay in Bricolage Grotesque ExtraBold.

So the icon, the tile and the banner stop being a typed font V; the app's
`BrandMark`, navigation logos and update screen follow in
[app#303](https://github.com/viptv-org/app/issues/303). `docs/branding.md` and
the asset manifest name the vector master as the source for every surface, with
the trace method, geometry, pinned tools and hashes. Refs
[design#46](https://github.com/viptv-org/design/issues/46).

## 2026-10-30 — Live with no source gets a designed first run

[LIVE-EMPTY-001](specs/behavior/live-empty-state.md) replaces the Live page's
single empty line with two states. With no live source configured the page is a
broadcast frame: a full-bleed night-stadium illustration, an eyebrow, a headline,
a body line naming both routes, and the action for whoever is signed in. With a
source configured that returns no channels, the page keeps its Source chip and
shows the reason and a retry, with skeleton rows while the request is open. The
filter row disappears when there is nothing to filter. Nothing is invented as a
destination: the primary opens the existing Settings › Source integrations, the
secondary Settings › Add-ons, and a member or a paired TV gets a line naming who
can act instead of an action the server answers `403` to.

The artwork is two hand-authored SVGs in `assets/illustrations/`, drawn only in
the tokens' colours and only from paths, rectangles, circles, ellipses and
gradients, with the reading scrim baked in: a 1920 × 1080 wide scene and a
1080 × 1920 tall one, so a phone gets its own composition instead of a sliver of
the wide one. `copy.md` gains four rows and retires three app strings;
`components.md` §13 records how empty states and artwork work on every layout;
`decisions.md` records the two states, the chip rule, the three who-can-act
forms and the missing free-add-on directory.

Refs [design#45](https://github.com/viptv-org/design/issues/45).

## 2026-10-30 — Settings split into Account, Profile, Playback and This device

[ACCT-SPLIT-001](specs/behavior/account-and-profile-settings.md) separates what
belongs to the household from what belongs to one viewer, and rebuilds the
Account page around it. Settings keeps one shell with four labelled groups in
this order on every platform: **Profile** (Profile · Linked services · Parental
controls · Import from Stremio), **Playback** (Playback · Subtitles & audio),
**This device** (Display on TV · Watch on TV on phone and tablet · About · Help)
and **Account** (Account · Password · Household PIN · Devices & sessions · Add a
device · Add-ons · Source integrations · Sign out · Delete account).

**Profile** becomes a real page: name, avatar, kids flag, maturity limit,
approved titles, profile lock, language (the profile's audio and subtitle
languages, opening the one editor) and delete profile. **Account** becomes the
household's own page: read-only identity (display name, `@username`, Owner or
Member), password, household PIN, devices and sessions, Add a device, add-ons,
source integrations, sign out and delete account.

Three facts the split has to live with: there is **no sign-in email** (an account
is a username, a display name and a password), **Simkl is per profile** and
becomes Profile › Linked services, and the backend has **no route to change a
password or delete an account**, so those two pages are specified as proposed and
stay absent until the routes exist. The Account group is visible to everyone
signed in; a TV device session cannot manage the account, so those rows are
disabled with "Manage this from a signed-in phone, computer or the web
dashboard." rather than hidden.

`copy.md` gains the row labels, the group names, the identity, household PIN,
devices, change-password and delete-account strings and four dialog rows;
`components.md` §5 the group labels and their geometry on each layout and §7 the
TV rail's labels with **Profile** and **Switch profile**; `decisions.md` the
settled decision. The phone, tablet, desktop and web boards keep their geometry
and lose their flat row order, `W3Account`'s sidebar is retitled **Settings**, and
`Tv3SetAbout` / `Tv3SignOut` keep their geometry while the rail gains the groups.
The boards' Recovery codes pages cannot be built: no route lists or regenerates
codes.

Refs [design#40](https://github.com/viptv-org/design/issues/40).

## 2026-10-29 — Proposed: motion for pointer and touch layouts

[MOTION-001](specs/behavior/motion.md) proposes the motion phone, tablet, the
desktop app and web get, and adds none of it to TV. One scale: 120 ms for what
the pointer's own movement causes (hover fills, press scales, a chip filling, a
carousel dot), 200 ms for content arriving in place (a list item, a hero slide,
a page crossfade, a popover or dialog, player controls), 200 ms for every exit,
300 ms for a sheet or drawer entering from its own edge, and 30 ms between two
list items in one row; easing `cubic-bezier(0.2, 0, 0, 1)` in and
`cubic-bezier(0.3, 0, 1, 1)` out. Pages crossfade in the page area only; cards
fade their hover treatment and scale 0.98 under a press; the hero crossfades
art, logo and text together and never resizes; overlays arrive from their edge
and their content is usable from the first frame; a page's first load staggers
its items 8 dp up, eight per row, while a refresh, paging and a restored page
animate nothing; the Continue Watching preview crossfades the hero; the pull
indicator keeps the library's timing as the one direct-manipulation exception;
and the player's control layer fades as one layer with the video frame
untouched.

Every duration is read through the app's existing `motionSpec()`, so reduce
motion snaps all of it in the frame of the state change; progress bars,
spinners, the skeleton shimmer, the hero rotation and the Up Next number keep
running, and the pull indicator holds a still arc. No copy is added.

`components.md` gains §12 Motion (the scale and a per-component table) and
motion notes on chips, cards, overlays, pull-to-refresh and player controls;
`tokens.json` gains `motion.response`, `motion.arrive`, `motion.leave`,
`motion.panel`, `motion.stagger-step`, `motion.easing-standard` and
`motion.easing-exit`, with `tokens.css` and `tokens.ts` regenerated;
`pull-to-refresh.md` gains the reduced-motion rule and loses its unverified
spinner unknown; `decisions.md` records the decision. No board is re-exported:
this contract is timing, not geometry.

Refs [design#39](https://github.com/viptv-org/design/issues/39).

## 2026-10-29 — Caught-up Continue Watching labels

The app's caught-up Continue Watching card states what the app already draws (app#149, app#163):
**`S3 E4 · Watched`** under the title on phone, tablet, desktop and web, then **`S3 E5 · Nov 4`**, or
**`S3 E5 coming soon`** while the next episode has no air date; with nothing announced, the first
label alone. TV keeps **`S3 E4`** and its corner check and adds the awaited episode to the same meta
line (**`S3 E4  S3 E5 · Nov 4`**), so the one-line caption box and the shelf geometry stay as they
were. A caught-up card opens the show's Details rather than the source picker for an episode already
watched.

`copy.md` gains the labels, the undated wording (no separator: **`S3 E5 coming soon`**), the
month-and-day air date in the device's locale without the year, and the accessibility reading;
`components.md` §6 the card they belong to.

Refs [app#132](https://github.com/viptv-org/app/issues/132),
[design#36](https://github.com/viptv-org/design/issues/36).

## 2026-10-28 — TV filters are the same chips and the right panel

[FILTER-CHIP-001](viptv-design-system/components.md#2-chips-and-segmented-controls)
now records TV as implemented: app#121 (PR
[app#148](https://github.com/viptv-org/app/pull/148), `90d6e47`) moved Browse /
Discover / Movies / Series / Anime, My List and the source picker onto the same
one-row dropdown chips as phone, tablet, desktop and web. Browse reads
**Catalog: Popular · Sort: Required · Genre: Any · Languages: Any · Free only ·
Search: Any**, My List **List: My List · Type: All · Sort by: Last watched ·
Status: Any · Genre: Any**, the source picker **Quality: All · Source: All
sources**, and the Catalog + Filters chips, the applied-chip strip and the
"Show results" full-page surface are gone. The only TV-specific part is the
container of the list: the right panel, 760 × scale wide over the 0.6 scrim with
the chip's title as its heading and 72 × scale rows, focus opening on the
current option. A pick applies at once — a single choice closes the panel, a
multiple stays open — and Back, Escape, the scrim or a pick close only the
panel, returning the remote to the chip that opened it. Chips are focus stops in
one row: the remote enters on the first chip, Left/Right walk it, and Clear
resets the facets and leaves the remote on the row.

`components.md` §2 gains the TV reading of the pattern and its chip geometry,
§5 the panel's rows and focus, §8 the container and its close rules, and the
implemented contracts name `BrowseFilterBar` / `LibraryFilterBar` /
`SourceFilters`, `LocalTvScale` and `TvFilterBarTest`. The retired TV filter
boards are marked superseded beside the desktop and phone ones: `Tv3Movies` and
`Tv3MoviesCatalogs` for the Catalog + Filters chips and applied strip,
`Tv3MoviesFilters` and `Tv3MoviesFilterText` for the full-page surface, and
`Tv3MyList` for its type segments and Sort pill. No board is re-exported, and
`decisions.md`'s 2026-10-19 TV filter decision carries the supersession.

Refs [app#121](https://github.com/viptv-org/app/issues/121),
[design#34](https://github.com/viptv-org/design/issues/34).

## 2026-10-28 — Proposed: the Android Updating screen and its copy

[AND-APP-UPDATE-001](specs/behavior/app-updates.md#updating-screen) records what
app#139 shipped (PR [app#145](https://github.com/viptv-org/app/pull/145),
`81cf5ae`) while the spec stays **proposed**: choosing **Install** now covers
the app with one full-screen Updating screen until Android has replaced the
process. It shows **Updating VIPTV to [version]…**, the write progress as a bar
with **"[N]%"**, becomes indeterminate behind Android's confirmation, carries
the install-permission step (**Allow updates**, **Open settings** or Fire TV's
**Try again**, **Later**) on the same cover instead of the prompt's dialog, and
makes Back do nothing while the session commits. An install Android rejects
returns to the prompt as **Couldn't update VIPTV** · **Android didn't install
the update.** · **Try again** · **Later**. Where the app can reopen itself it
does, and confirms **Updated to [version]** at the bottom for six seconds.
`copy.md` gains the strings, `components.md` §8 the cover and §9 the
confirmation bar, and `decisions.md` the entry.

No canvas board shows the screen (app `docs/DESIGN_GAPS.md` GAP-064 and
GAP-065), so the recorded geometry is the implementation's, unmeasured against
a board, and the section says so. The contract is retitled **Android in-app
updates** and its source corrected to what the app actually reads — the
signed-in server's `<server origin>/updates/android/update.json` feed (app#64) —
with GitHub Releases named as the planned future source (owner decision
2026-10-27) and acceptance for a missing, malformed and rejected feed. The
spec's permission step keeps its earlier wording honest by moving the copy to
the screen, and Back on the permission step is still the page's Back rather
than Later ([app#146](https://github.com/viptv-org/app/issues/146)). Refs
[app#139](https://github.com/viptv-org/app/issues/139),
[design#32](https://github.com/viptv-org/design/issues/32).

## 2026-10-28 — The dropdown chip and its list are the one filter pattern

[FILTER-CHIP-001](viptv-design-system/components.md#2-chips-and-segmented-controls)
records the rule the owner set on 2026-10-27 and the implementation in
app#117 (PR [app#130](https://github.com/viptv-org/app/pull/130), open while
this entry lands). Browse / Discover / Movies / Series / Anime, My List and
the source picker filter through one horizontal, scrolling row of dropdown
chips at the top of the page: the catalog or list chip first, a group divider,
one chip per facet, and a "Clear" chip at the end while anything is set. Each
chip opens the shared choice list — the anchored popover on desktop, web and
tablet, the bottom sheet on a phone — which adds a search field past 8 rows,
ticks checkboxes and respects the provider's cap for a multiple choice, and
applies a text filter on Enter or Done. A chip is filled while its value
differs from the page default. Picking applies at once: no "Filters" toggle,
no second panel and no Apply or "Show results" button. A set of 2–3 options,
an on/off filter and a text filter are all that same chip.

This retires the phone "Filters" toggle and applied-chip strip, the My List
filter sheet and segmented type chips, the source picker's chip rows, the
`W3Browse` filter rail, and the app#57 / app#59 segments-or-dropdown threshold.
**TV is out of scope for that PR:** it keeps the Catalog + Filters chips and
the "Show results" surface until [app#121](https://github.com/viptv-org/app/issues/121).
`components.md` §2 gains the rules, §5 the list content and §8 the containers;
`copy.md` gains the chip and list strings; the implemented component contracts
record `FilterBar.kt` / `SearchableSelect.kt` and the `FilterPatternScanTest`
that keeps the retired surfaces gone. No board is re-exported yet, and the
canvas frames that draw the retired filter forms need one.

Refs [app#117](https://github.com/viptv-org/app/issues/117), [design#30](https://github.com/viptv-org/design/issues/30).

## 2026-10-27 — Proposed: Phone and tablet pull-to-refresh

[REFRESH-PULL-001](specs/behavior/pull-to-refresh.md) records what the KMP
app shipped in app#35 (`b55f942`), with the My List rule from app#74
(`3aa4a3e`). On phone and tablet layouts, pulling down at the very top of
Home, My List, History or Details shows the Material 3 indicator and reloads
the page at once. On My List the very top means the collapsing header is
fully expanded. A pull released before the threshold does nothing. The pull
skips the revision check and rebuilds Home even when nothing changed. It
otherwise follows HOME-ADDON-001's quiet rules: no cover, no scroll reset, and
a failure keeps the shown data with no error. An expired session goes to
sign-in as usual. TV, the desktop app and the browser have no gesture. The source
picker, Browse, Calendar, Live, Search and Settings have none either, because
their loaders empty the page first. There is no copy.

The indicator is the Material default: a `color.text.secondary` arc on a
`color.surface.2` disc. That makes it the one non-accent spinner, an exception
recorded against the Spinner rule (`components.md` §3) and the README accent
principle. `components.md` §3 and §9, `copy.md`, the README, HOME-ADDON-001
and phone research note 8 ("skeletons not spinners", which covers first loads
only) gain pointers. No board is superseded. Owner request 2026-10-26
([app#1](https://github.com/viptv-org/app/issues/1),
[design#23](https://github.com/viptv-org/design/issues/23)). There is no
device evidence yet, and no canvas board shows the indicator.

## 2026-10-27 — Proposed: Wider desktop/web source drawer and no best-match hint

[SRC-DRAWER-001](specs/behavior/source-drawer.md) records what the KMP app
shipped in app#86 (`f80aa91`). The desktop and web source drawer is now
min(720, 55 % of the window) wide, never narrower than 460; at 1440 it is 720.
Other desktop drawers, the tablet drawer, the phone sheet and the TV panel are
unchanged. On web, the drawer opened from a title's Details dialog now stacks
over that dialog behind its 0.55 scrim. Focus starts on its ×, and Escape, the
× or a scrim click close only the drawer and return to the unchanged dialog.
The hint "Play always starts the best match. Change … in Settings › Playback."
is removed on every layout. TV keeps its status line only while add-ons
answer ("Checking add-ons · N sources so far") or a stream opens ("Opening
stream…"). `components.md` §8, `copy.md` and the README overview are amended.
The `D3Sources`, `D3SourcesEmpty`, `D3SourcesTorrent`, `CmpDesk3`, `M3Sources`,
`Tv3Sources` and `Tv3SourcesLoading` boards are listed as superseded until the
canvas re-exports them. Owner decision 2026-10-27
([app#60](https://github.com/viptv-org/app/issues/60),
[design#24](https://github.com/viptv-org/design/issues/24)). No device
evidence yet, and a board for the drawer over the web Details dialog is still
needed.

## 2026-10-27 — Proposed: Next-episode autoplay countdown and its setting

[PLAY-NEXT-AUTOPLAY-001](specs/behavior/next-episode-autoplay.md) records
what the KMP app shipped in app#48 and app#77. When a series episode ends, the
next-episode panel opens over the last frame. Its primary action counts down
10 seconds ("Next episode in 9", with a ring that empties; reduced motion keeps
only the number) and then plays the next episode. Any viewer action cancels it
for that end: the secondary action, Back/Escape, a seek, or any key or pointer
press. Finales, movies and live channels never count down. Settings › Playback
gains **Autoplay next episode**, on by default and stored per device because
the profile preference API has no field for it. The TV footnote reads "Starts
automatically. Press any button to cancel." while counting and "Nothing plays
on its own." otherwise.

This resolves the conflict between the Roku contract, AND-037 and
`decisions.md` #1 (a countdown) and the TV, phone and desktop boards ("Nothing
plays on its own"). The Roku baseline stays frozen and AND-037 is marked
superseded. Decision #1, the Up Next component, copy, the `up-next-countdown`
token (now 10000ms) and the research notes are amended. "Nothing ever plays on its
own" is retired from the `Next episode button` setting description. Owner
decision 2026-10-27 ([app#65](https://github.com/viptv-org/app/issues/65),
[design#26](https://github.com/viptv-org/design/issues/26)). Canvas boards for
the countdown and the setting row are still needed.

## 2026-10-27 — Black and white V app icon and TV banner master

`assets/brand/app-icon/` is the square app-icon and TV-banner master for
Android, Android TV and Fire TV: a white Bricolage Grotesque ExtraBold V on
black, an adaptive-icon foreground and monochrome layer, and a 320×180 banner
(the white "VIPTV" wordmark on black). Roku branding is unchanged. `assets/brand/tools/make_app_icon.py` generates it
reproducibly; provenance is in
[the asset manifest](assets/ASSET_MANIFEST.md#app-icon-and-tv-banner-master).
It replaces the amber V the KMP app shipped. Owner decision 2026-10-27
([design#21](https://github.com/viptv-org/design/issues/21)).

## 2026-10-26 — Proposed: Best matches source group, ranked as sources arrive

[SRC-BEST-MATCH-001](specs/behavior/source-best-match.md#source-groups-best-matches-and-all-sources)
now groups the source list in both Best match and Always ask: a **Best
matches** group with the top five rows that pass the hard filters, then **All
sources** in ranking order. Rows are ranked and grouped as providers answer
instead of being shown in arrival order and reordered at the end; re-ranking
keeps TV focus on the same source and the phone scroll anchor in place once the
viewer has navigated. The shared ranking supplies membership and the marker;
headers are non-focusable headings (copy in `copy.md`).
Best match autoplay is unchanged. Owner request 2026-10-26
([design#20](https://github.com/viptv-org/design/issues/20)); header boards
are still needed.

## 2026-10-22 — KMP subtitle mode and vertical TV Subtitles & audio

PLAY-SUBTITLE-MODE-001 is adopted by the KMP app: **Subtitles** offers Always /
`When audio isn't [language]` / Never on Subtitles & audio, and TV Playback drops
**Start with subtitles**. TV Subtitles & audio becomes one vertical Up/Down list
with the preview beside it (owner decision; canvas board pending).

## 2026-10-22 — Proposed: Best match autoplay, ranking and fallback

[SRC-BEST-MATCH-001](specs/behavior/source-best-match.md) replaces "wait for
every provider, then play the top row" with an early-start countdown that any
list navigation cancels. Ranking now covers device decode support, one
preferred-audio setting with dub/dual-audio evidence tiers, release type (WEB
and BluRay first, camera releases never autoplayed), an off-by-default
HDR/Dolby Vision preference, torrent health and per-series binge groups. A
failed Best match start tries the next source, at most three attempts.
`PLAYBACK_CAPABILITIES.md` names this as the one exception to explicit source
selection. Canvas boards are still needed.

## 2026-10-19 — Second canvas re-export: browse, source integrations, missing screens

The owner's design AI produced the requested boards (see
`plans/DESIGN_REQUEST-2026-10-18.md`): 264 screens now (tv 56, phone 69, tablet
18, desktop 55, web 40, simkl 26). New: browse page sets with catalog pickers,
facet filters and loading/empty/error states (D3/M3/T3/W3Browse*, Tv3Movies*),
source-integration settings and configure forms for VIPTV Sources, Xtream and
M3U with all states (SetSources, SourcesViptu/M3u/Xtream/Remove/Empty/Torrent),
parental controls, recovery codes, About/Display, TV add-on manual entry, and
card/row state sheets. The IPTV provider sign-in boards were removed per owner
decision (M3U and Xtream remain Live TV source integrations). The canvas data
dictionary (`reference/canvas-data-dictionary.md`) documents the generic field
shapes the boards draw from. Screens rendered with `tools/screenshots.mjs`
(scale 1) and stored as WebP q85.

## 2026-10-18 — Full canvas re-export: 197 current screens

The owner supplied the current canvas export (chat artifact
`ded73220-d76b-426c-8ea2-57d74c2d8473`). This replaces the reference screen set
wholesale: 197 boards — tv 37, phone 53, tablet 11, desktop 40, web 30, simkl
26 — including the previously missing season menu boards (`D3TitleSeason`,
`M3SeasonSheet`), tablet and Simkl surface sets, offline fonts, the canvas token
file (`reference/canvas-tokens.json`), per-platform research notes
(`viptv-design-system/notes/`) and the TV focus/row-motion demo
(`reference/extras/tv-focus-and-rows.html`). Screens were rendered with the
export's `tools/screenshots.mjs` (Playwright, scale 1) and stored as WebP q85.
Naming changed to the canvas prefixes: `M3*` phone, `T3*` tablet, `D3*`
desktop, `W3*` web, `Tv3*` TV, `Sk*` Simkl; the previous export's short names
(`Desk*`, `Web*`, `Ph*`, `Tv*`, `Main`, `Title`) are retired. The 9 component
sheets remain from the 2026-09-23 export; where a sheet and a new board
disagree, the new board wins. Notable canvas rules now visible in the boards:
primary buttons are off-white (accent stays on progress, marks/logo and
toggles); hero art is a framed 16:9 card with a blurred ambient fill; sign-in
methods on every platform are browser, email code, password, another device,
IPTV provider (Xtream/M3U) or no account; the desktop title bar hides search
until a profile is chosen. `copy.md`, `components.md` and `decisions.md` still
describe parts of the previous export and need follow-up passes against the
new boards.

## 2026-10-18 — Remove the IPTV provider sign-in method

Sign-in never included an IPTV provider method in this specification (see copy.md
Sign-in): VIPTV accounts sign in with a username and password, a browser/device
flow, or use local mode. An implementation draft exposed "IPTV provider (Xtream
Codes login or an M3U playlist)" as a sign-in option on TV, phone and desktop;
it was removed to restore parity with the specified sign-in set. M3U and Xtream
remain available as Live TV source integrations in Settings, not as sign-in.
Additionally, password sign-in fields are labelled "Username" (matching the
account system and WebSignIn reference); the field never required an email
address.

## 2026-10-18 — Stremio import in the KMP web and phone clients

The owner approved moving IMP-001 into the KMP app for the browser build and
Android phone and tablet, behind an "Import from Stremio" settings entry after
Devices, with the full dashboard feature set on each. TV, desktop and local mode
have no import UI. Signed-in device sessions may import into their own selected,
unrestricted profile, including adopting Stremio add-ons, as devices can already
manage shared add-ons. Long verification steps get an honest busy message and no
short client timeout, and failed add-ons are identified on their rows. Flow,
copy and history rules are otherwise unchanged.

## 2026-10-11 — Remove the v1 backend surface

After the verified 2026-10-09 cutover, BE-002 drops the `client_update_required`
stubs for retired media/setup/organizer namespaces and the unversioned
`/api/addons` routes; both now answer as unknown routes. Add-on management is
`/api/v2/addons` only. Paired viewing devices with a selected profile may manage
the account's shared add-ons there, preserving the existing TV/Roku settings
behavior; parent restrictions still apply. No screens or copy change.

## 2026-10-07 — Actionable source startup diagnostics

NT-09 requires the measured native preparation stage to survive its first
deadline through FFI and asynchronous completion. Cache preparation, metadata,
initialization, local endpoint, typed control-network failures and retiring work
have distinct closed explanations. The existing recovery dialog includes the
validated diagnostic code. Media3 failures preserve their measured numeric code
and HTTP status where present. No dependency text or source identifiers enter
display/log data; recovery actions, focus and delivery authority remain intact.

## 2026-10-07 — Bounded native torrent piece cache

The owner approved rolling pieces for large native Android video inputs. NT-10
requires bounded retained bytes, large-offset/backward reads, exact-file authority,
independent grants and joined retirement. The aggregate 2 GiB ceiling remains;
large inputs reserve 256 MiB instead of full logical payload. Capacity failure
copy describes observed cache admission rather than source size. Existing
recovery actions and layout remain unchanged; Android decode evidence is separate.

## 2026-10-07 — Observed native playback failure explanations

Amend SRC-TORRENT-NATIVE-001 with closed observed reason codes and exact safe
copy for acquisition/metadata deadlines, full-torrent cache budget, storage/cache,
metadata/file mismatch, grant expiry, connectivity and codec support. NT-09
requires native/actual-WASM copy agreement and safe asynchronous preservation.
Unknown failures remain generic; deadlines never imply absent seeders. Existing
recovery, focus, layout and source intent remain unchanged. Adapter/engine facts
and device acceptance require their own evidence.

## 2026-10-07 — Organize plans and engineering documentation

Grouped implementation plans under `plans/` and architecture, playback, platform,
process and historical references under `docs/`. Added navigation indexes and
updated live document links, agent pointers and validation paths. Existing
behavior specifications, visual assets and immutable historical references
retain their locations and meaning; this reorganization does not advance client
design pins or establish new implementation evidence.

## 2026-10-07 — Proposed episode annotations implementation plan

Added EPISODE-ANNOTATIONS-001: native filler/recap badges and manual intro/outro
skipping backed by replaceable metadata adapters, followed by separately gated
general-media lookup, opt-in automation and optional media analysis. The plan
defines repo ownership, proposed versioned reads, identity/applicability rules,
budgets and acceptance. Normative geometry/canvas exports, provider permissions,
implementation, immutable adoption and device evidence remain pending.

## 2026-10-06 — Approved Android native torrent contract

Owner-approved SRC-TORRENT-NATIVE-001 for local Markdown ticket 01 closes
negotiation, native request/grant JSON, exact-index v1 VOD, metadata bounds,
public peer/DHT privacy, lease/revocation, independent grant capabilities,
authorization-epoch cache limits, acquisition/quiescence and archive-free gates.
BE-002, gateway exclusions and playback capability/recovery rules reference this
narrow Android exception. Existing UI, source/resume/history and gateway HLS
remain unchanged. Approval is for implementation only; immutable consumer
adoption, engine/backend/core/Android implementation and qualification remain
pending. No production activation or physical-device claim follows.

## 2026-10-02 — Proposed add-on torrent gateway sources

Specified SRC-TORRENT-GATEWAY-001 for gateway issue 15: existing account-owned
add-on discovery retains opaque source handles while opt-in authorized gateways
prepare torrent/archive HLS for web, desktop and Android. The draft defines
supported input normalization, file selection, capability/scope checks, private
source metadata, safe producer copy and lease cancellation. Native peer delivery,
progressive integration and qualification remain separate; review and adoption
are pending.

## 2026-10-02 — Narrow phone watched-caption wrapping

Clarified AND-EPISODE-WATCHED-001: the complete badge wraps below the episode
number when a narrow phone text column cannot fit both. Artwork and the
44 dp options target retain their geometry; neither label is ellipsized.
The 320 dp native fixture exposed the constraint before Android publication.

## 2026-10-02 — Android completed episode indicators

Specified proposed AND-EPISODE-WATCHED-001 for Android TV and phone episode
cards: a readable check and Watched badge beside the episode number uses the
current profile's saved completion fact. Partial progress retains its bar,
completed episodes omit it, and updates cannot leak across profiles or recycled
cards. Rendering and device acceptance remain pending.

## 2026-10-02 — Website player Fit / Fill

Specified WEB-PLAYER-FIT-001 for the responsive website player. Fit shows the
whole video; Fill crops it to cover the viewport. The accessible toggle beside
Fullscreen applies to HTML video and MediaBunny canvas without changing the
playback session. Phone/desktop browser evidence and device checks are pending.

## 2026-10-02 — Android TV media rows reach the right edge

Specified AND-TV-ROW-EDGE-001: horizontal media card rows, including Popular
movies and Details episodes, reach the native Android TV viewport's right edge
with room for the focus ring. Header/text safe insets and card geometry remain;
TV-web retains its 1824 px bound. Android implementation and device evidence
are pending.

## 2026-10-02 — Android TV episode-number jump

Specified AND-EPISODE-JUMP-001: a compact chip beside the season badge opens
native numeric input and jumps to an exact episode in the current season by
scrolling and focusing its card. Invalid input stays editable; cancellation
preserves the row. Playback and hero Play/Resume remain unchanged. Android TV
implementation and device evidence are pending.

## 2026-10-01 — Native Android TV keyboard

Specified AND-KEYBOARD-001: Android TV uses its native device input method in
Search and text-entry dialogs, preserving catalog shelves, masked parent PIN,
Done/Cancel, keyboard-first Back and field/result return focus. Other TV
platforms retain their keyboard UI; native acceptance remains pending.

## 2026-10-01 — Distinct source producers and truthful outcomes

Specified SRC-PROVIDERS-001: source filters retain each observed configured
producer's identity and name, including zero-result and safe failed add-ons.
The picker explains unsupported formats and keeps partial playable rows usable.

## 2026-10-01 — Continue Watching episode source return

Specified CW-SOURCE-BACK-001: cancelling an episode's source picker from Continue
Watching opens its parent show details and Back restores the originating card.
Android and React/SolidTV implementation evidence remains pending.

## 2026-10-01 — Source picker descriptions and discovery status

Specified SRC-OVERFLOW-001 for Android phone/TV and responsive React/SolidTV:
every source description uses a two-line fixed window with focus/hover overflow
motion and reduced-motion fallback. Discovery shows a visible spinner and status
through partial results. Implementation and device evidence remain pending.

## 2026-09-30 — Android phone presentation and player track menus

Specified AND-042 for design issue 6. Phone Home now opens on the rounded hero,
the bottom navigation shows icons only, and cards carry minimal captions.
Catalog shelves are headed by content type, phone Home shows live channels as
logo tiles, and the bar is 6dp with lifted progress. Loading uses skeletons.
Phone and TV player audio/subtitle menus follow PhPlayerSubs and TvPlayerSubs.
Only AND-038's Home header remote entry changes; other TV geometry is
unchanged. Emulator and device evidence remain separate.

## 2026-09-30 — Canvas source, reference provenance and repository status

Recorded the VIPTV Redesign canvas as the visual source for the redesign beside
its committed `viptv-design-system/` export. Added `reference/FILES.json`
(SHA-256 and canvas-export source for all 453 reference files), verified by
`scripts/validate.py`. Clarified that canvas renders are allowed design
artifacts while app/device captures stay forbidden. Updated docs/architecture/REPOSITORIES.md
with current status, design-pin mechanism and specs for every repository,
including core, playback-gateway, workspace and desktop. No behavior change.

## 2026-09-30 — Android silent foreground identity validation

Specified AND-041 for Android issue 4: stable authenticated phone/TV presentation
during bounded foreground validation, coalesced refresh, actionable recovery,
explicit revocation and cancellation. Existing background-stop, exact-source
absolute Resume, native playback policy, geometry and assets remain unchanged.
Actual authenticated media and per-device/visual evidence remain required.

## 2026-09-30 — Bounded bidirectional admin VOD matching

Specified ADM-002-VOD-WINDOW for web issue 5: three retained title pages,
automatic reverse reload, complete owned-provider selection, scoped cancellation,
retry and dialog Back/scroll/focus restoration. Keeps ADM-002 tokens and row
geometry. Synthetic encrypted 100k-title HTTPS and per-viewport evidence remain
required; this design change alone establishes no rendered or device acceptance.

Review clarification: idle/failed dialogs dismiss without saving; a submitted
save retains the existing disabled-dismissal state until completion or a bounded
30-second timeout. A browser Back cannot undo an already submitted server write.

## TV-only LightningJS renderer migration proposed — 2026-09-24
Authorized a staged replacement of the React TV renderer and custom D-pad focus registry with one LightningJS Blits UI for Tizen, Vizio and LG webOS. The 1920×1080 current TV output and behavior are the 1:1 migration baseline; the pinned design images remain a separate design-parity reference. Phone web, responsive web and Tauri desktop retain their React entry. TV launchers remain on the existing renderer until matched-content pixel comparisons, remote flows and platform checks qualify the new entry. See docs/platforms/TV_IMPLEMENTATION.md. No parity or device claim is made by this spec update.

## VIPTV design system — 2026-09-23
Adopted [viptv-design-system/](viptv-design-system/README.md) as the single visual design for phone, desktop (Tauri), web and TV: `tokens/tokens.json` (source of truth), component rules, copy, settled decisions and reference screens. Removed the former visual layer (`tokens/`, `scripts/gen-tokens.mjs`, `specs/visual/`, RESPONSIVE_UI/PRODUCTION/VIPTV_ALIGNMENT, DESKTOP_LAYOUT, TV_WEB_UI_REBUILD, ANDROID_UI_REBUILD, TV_CANDIDATE_2026_09_12); they remain in git history. Behavior contracts under `specs/behavior/` are unchanged.

## Initial extraction — 2026-09-12
Captured the Roku baseline at vynxc/viptv@7d6b413 and established design-first cross-platform governance. This changes repository ownership, not Roku behavior. Android-only imports and proposed platform adapters are tracked separately from current Roku behavior.

## Baseline precision audit
Added exact dynamic guide geometry, search debounce/focus/partial-failure behavior and server-owned queue completion/cache rules. These clarify existing behavior without changing it. Source citations use the published split runtime snapshots.

## TV platform implementation
Authorized Android TV Compose and one shared Tizen/Vizio React frontend, with platform playback modules and design-based visual/remote testing. The baseline UX is preserved; host exit and on-screen keyboard equivalents are documented in docs/platforms/TV_IMPLEMENTATION.md.

## 2026-09-12 TV implementation candidate

Added the Android TV/shared Tizen-Vizio implementation checkpoint and owner-requested deferred joint testing. No Roku behavior or visual contract changed.

## 2026-09-12 — Resume identity extraction correction

Corrected the behavioral contract from addon plus human source name to addon plus nonempty server-authored source fingerprint. `Util.brs:45–59` at the frozen Roku revision already requires fingerprint equality. This repairs an extraction error; it does not change Roku or introduce a new UX. Added same-name/different-fingerprint and legacy missing-fingerprint acceptance cases.

## 2026-09-13 — Shared TV-web rebuild and design synchronization

Authorized the Roku-matching presentation replacement for the shared Tizen/Vizio frontend. TV_WEB_UI_REBUILD.md indexes complete screen/state acceptance against the existing normative visual and interaction specs without duplicating geometry. docs/process/DESIGN_SYNC.md defines immutable design adoption, vendored snapshot/asset integrity, separate freshness checks and per-platform parity evidence. Figma-first authoring is proposed for a future explicit adoption decision; the versioned design repository remains authoritative. No completed visual or device acceptance is claimed here.

## 2026-09-13 — Rail and action alignment extraction precision

Corrected the rail origin, row spacing and V-mark geometry from frozen Roku MainScene.xml, and made ActionRow horizontal/vertical centering explicit for Settings. These are source-backed extraction corrections, not Roku changes. Documented the shared TV-web existing source-quality filter as a retained implementation adaptation with explicit acceptance and parity limits; no owner-approved exception or completed parity is claimed.

## 2026-09-13 — Shared TV rebuild delivery

Recorded the shared React replacement, scoped 43-unit/49-browser validation, Settings/Search comparisons, source-filter difference, and immutable sync/PR workflow in TV_WEB_UI_REBUILD.md (removed; see git history). Physical TVs and other matched-content visual states remain pending.

## 2026-09-14 — Responsive history and populated-card corrections

Specified RUI-023 in RESPONSIVE_PRODUCTION.md (removed; see git history): actual page history and return context, top-left Back, OLED in Settings, direct live-channel activation, real Continue Watching semantics, stacked hero focus stability and contained live logos. These are owner-requested corrections under implementation; browser and hardware results remain separate evidence.

## 2026-09-17 — Shared platform matrix and playback consolidation decision

Recorded the accepted platform matrix (shared tv-web UI for web, Tizen, Vizio and desktop; Android keeps its own UI; no transcode on Android and desktop, probe-first on web, native-preferred on Tizen, managed-allowed on Vizio), the WebCodecs-not-WebAssembly browser gate, the verified absence of a deployed Vizio cast receiver, and the decision that tv-web's player stack becomes the canonical implementation moved into the video package while video's guest-js backends are replaced. No behavior changed; Roku remains the frozen baseline. See [docs/adr/0003-shared-platform-matrix-and-playback-consolidation.md](docs/adr/0003-shared-platform-matrix-and-playback-consolidation.md).

## 2026-09-18 — Desktop-first layout specification
 
Recorded the desktop shell decisions: a non-expanding left sidebar, no max
width with a window minimum instead of mobile breakpoints, hover/focus card
affordance, a hero with its own catalog-mix data decoupled from Continue
Watching, and card selection navigating directly to the info page instead of
mutating the hero. The layout shares tv-web components per the
shared-platform matrix; implementation is tracked separately.

## 2026-09-19 — Desktop frameless titlebar and sidebar refinement

Specified the integrated 30px desktop titlebar spanning the full width of the
window with isolated drag regions and no-drag button isolation, a 54px compact
left sidebar anchored beneath the titlebar, and scrollbar slot containment
starting beneath the header.

## 2026-09-20 — Desktop window decorations, player overlay, and selector UX

Specified frameless Wayland window resizing via 8-zone directional handles and
native outline/rounding (`10px`), titlebar focus elimination (`tabIndex={-1}` and
transparent focus override), back navigation in desktop header, windowed player
titlebar retention with fullscreen toggle, 2.5s player controls timeout, grey
buffered seekbar progress, live TV mute toggle semantic, sleek anchored audio and
subtitle popup cards with active track indicators, fixed 44x44 action buttons, and
compact 60px live TV channel rows.



## 2026-09-21 — Proposed local addon mode contract

Added [docs/archive/LOCAL_MODE.md](docs/archive/LOCAL_MODE.md) proposing account-free operation of the shared viewing client from an on-device addon registry: build-level availability (never in the backend-hosted flavor), sign-in-screen entry, a versioned registry schema with install/remove/error states, discover reuse of the RUI-030 hierarchy with the shared negotiation rules, direct-first playback without server sessions, and privacy rules treating manifest URLs as credentials. Watch-state is explicitly out of scope. Status: proposed; no adoption is claimed for any platform.

## 2026-09-21 — Local addon mode schema amendment

Amended docs/archive/LOCAL_MODE.md LM-002: the registry stores `nextOrdinal` and each addon a stable `ordinal` (a monotonic install counter, never reused) so addon selection survives restarts and removals. No other behavior changed.
## 2026-10-02 — AND-043 Title source summary

Specify Android Title discovery lifetime, shared Core ranking, safe source summary
copy and manual-picker adoption, with empty/failure/cancellation acceptance. The
TvTitle positive-progress WATCHING marker now has explicit state semantics and
geometry; completed episodes retain the existing Watched badge. Proposed scope
for design#6; emulator and physical parity remain independently unverified.
