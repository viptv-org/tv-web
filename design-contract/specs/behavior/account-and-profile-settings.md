# ACCT-SPLIT-001 — Account, profile and device settings

Status: **implemented**, not device-verified. The four-group shell, the Profile
page and every This device and Account row below exist on phone, tablet,
desktop, web and TV at the source revision cited next. Implemented is not
verified: no device evidence exists for these layouts (see [Unknowns](#unknowns)).

Not built: the **Notifications** row has no page (app#243); recovery codes and
editing the account's display name or username have no route; the phone
**Watch on TV** page has no **Open the remote** action and no **Remote button**,
**Vibrate on press**, **Keep screen on**, **Change TV** or **Forget this TV**
rows yet, and the error and permission lifecycle plus the browser dialog are
app#489 and later, still proposed (`components.md` §11). A TV signs in from
another device's **Account › Add a device**, not the phone remote.

Source revisions: the KMP app's Settings at app `62e0c949`
(`features/settings/`, `state/ControllerAccountDevices.kt`,
`state/ControllerAccountDeletion.kt`, `state/ControllerAccountPassword.kt`,
`state/SettingsPage.kt`, `state/SettingsRoute.kt`). The three account provider
pages below describe **baseline** app behavior and cite their own revisions.
Backend routes are cited from `server/src/routes.rs`,
`server/src/auth/middleware.rs`, `server/src/auth/actions.rs` and
`server/src/kids/` in viptv-org/backend. The owner-only household-write rule is
backend `04bcbfc` (`server/src/auth/principal.rs`,
`server/src/auth/handlers.rs`): household configuration writes answer
`403 owner_required` to a member account session and
`403 account_session_required` to a paired TV, while their reads stay open to
any account session.

Reference boards exist for the parts, not for the split: `M3Settings`,
`T3Settings`, `D3SetGeneral`, `W3Account`, `W3Recovery`, `M3Recovery`,
`D3Recovery`, `W3Parental`, `M3Parental`, `M3ProfileEdit`, `Tv3ProfileEdit`,
`Tv3SetAbout`, `Tv3SetParental`, `Tv3SignOut`, `SkSettings` and `SkSettingsOff`
in `viptv-design-system/reference/screens/`. Where a board and this contract
disagree, this contract wins for the group order and the row lists; the boards
win for geometry and type.

## Intent

Settings is one door with four rooms. A viewer changes the thing they are
looking at: the person watching (Profile), how it plays (Playback), the machine
in their hand (This device), or the household they signed in to (Account). An
account-level action is never mixed into a profile page, and a profile action is
never shown as if it changed the whole household.

The groups keep four kinds of row apart. A flat list makes "Account" read as
"my profile", and a sidebar headed **Account** makes a per-profile preference
look account-wide. The four labels answer "whose setting is this?" before a row
is opened.

## Who owns what

Every row below is one setting or one action, with its real owner. "Account" and
"Profile" are the terms in [CONTEXT.md](../../CONTEXT.md).

| Setting or action | Owner | Backend today |
|---|---|---|
| Display name, `@username`, role | Account | `GET /auth/me`; no edit route |
| Password | Account | `POST /auth/password` (current and new password) |
| Recovery codes | Account | issued once at register/recover; no list or regenerate route |
| Household PIN | Account owner; members read | `GET /parent/status`, `POST /parent/unlock` for any account session; `PUT /parent/pin` owner-only |
| Add-ons (inventory) | Account owner; members read | `GET /addons` for any account session; `POST /addons`, `PATCH/DELETE /addons/:id` owner-only |
| Add-on on/off for a profile | Profile | `GET/PUT /profiles/:id/addon-activation`, `GET/PUT /profiles/:id/integrations` |
| Source integrations (VIPTV Sources and M3U) | Account owner; members read | `GET /profiles/:id/source-integrations` for any account session; `PUT /profiles/:id/source-integrations`, `DELETE /profiles/:id/source-integrations/:connection` owner-only |
| Xtream connections | Account owner; members read | `GET/POST/PATCH/DELETE /iptv/connections`, credentials, refresh and live-default routes |
| VOD match overrides | Account owner; members read | `GET/PUT /iptv/matches` |
| Playback gateways and access grants | Gateway owner; shared accounts read and check capacity | `GET/POST/PATCH/PUT/DELETE /gateways*`; `POST /gateways/:id/check` stays open to a member |
| Devices and sessions | Account owner for sign-outs; members read | `GET /account/devices` for an account session only — a paired TV or other device session is refused `403 account_session_required`; `GET /auth/sessions` for any account session; `DELETE /account/devices`, `DELETE /account/devices/:id`, `DELETE /auth/sessions` owner-only |
| Add a device (pairing code approval) | Account | `POST /auth/device/lookup|approve|deny` for an account session only — a paired TV or other device session is refused `403 account_session_required` |
| Delete account | Account | `DELETE /auth/account` (username, password, household PIN) |
| Profile name and avatar | Profile | `PATCH /profiles/:id`, `DELETE /profiles/:id` |
| Kids flag and age limit | Profile | `GET/PUT /profiles/:id/kids` |
| Approved and blocked titles | Profile | `GET/POST /profiles/:id/approvals`, `GET /parent/search` |
| Profile lock (local builds) | Device + profile | local store only |
| Language: default audio and subtitles | Profile | `GET/PUT /profiles/:id/preferences` |
| Source selection, quality, HDR, subtitle mode, size and colour | Profile | `GET/PUT /profiles/:id/preferences` |
| Linked services (Simkl) | Profile | `GET/DELETE /profiles/:id/simkl`, `POST /profiles/:id/simkl/authorize` |
| Import from Stremio | Profile | `POST /profiles/:id/imports/stremio/preview|…/review|…/apply` |
| Autoplay next episode | Device | app-local; `PLAY-NEXT-AUTOPLAY-001` |
| Display (accent, text size, reduce motion, screen saver, fit) | Device | TV local store |
| App updates, diagnostics, licences | Device | app updates: the signed-in server's `/updates/android/update.json` and the APK it names |

Every row marked "Account owner; members read" follows one rule: the write is
owner-only. A member account session writing it answers `403 owner_required`
("Only the account owner can change household settings."), and a paired TV
answers `403 account_session_required`. The reads of those same inventories stay
open to any account session — a member still browses the household's PIN status,
add-ons, connections, matches, gateways, devices and sessions, and checks a
shared gateway's capacity — and the credential, profile and
parental-policy routes stay self-service for any account session. `GET /auth/me`
reports `capabilities.manage_account` only for the owner.

There is **no sign-in email** anywhere: an account is a `username`, a display
`name` and a password, and nothing sends mail. The identity page shows the
display name and `@username`, never an email row.

Simkl is profile-scoped because it tracks one person's viewing; it lives under
Profile. No account-wide link exists, so the Account group has no **Linked
services** row until one does.

## The four groups

The same four groups, in this order, on every platform. A row appears only
where the platform implements it.

| Group | Rows |
|---|---|
| **Profile** | Profile · Linked services · Parental controls · Import from Stremio |
| **Playback** | Playback · Subtitles & audio |
| **This device** | Display (TV) · Notifications (only where implemented) · Watch on TV (Android phone and tablet) · About · Help |
| **Account** | Account · Password · Household PIN · Devices & sessions · Add a device · Add-ons · Source integrations · Xtream connections · VOD matches · Playback gateways · Sign out · Delete account |

- **Profile** opens the page in [Profile](#profile): the current profile's name,
  avatar, kids flag, maturity limit, approved titles, lock, language, linked
  services and delete. The shell's profile card above the groups carries the
  switcher, so only TV needs a separate **Switch profile** entry (in its rail).
- **Parental controls** is the existing per-profile limits page (every profile's
  kids flag, age limit, approved and blocked titles). The household PIN that
  gates it is an account value and sits under Account. app#255 makes every one
  of those controls adjustable in the app.
- **Playback** and **Subtitles & audio** stay one page each, per profile, as
  `PLAY-NEXT-AUTOPLAY-001` and `PLAY-SUBTITLE-MODE-001` define them. **Autoplay
  next episode** keeps its note **"Plays the next episode after a 10-second
  countdown. Applies to this device."**
- **This device** holds what changes this machine only. **Display** exists on TV.
  **Notifications** appears only once it has a real page (app#243); until then no
  layout shows the row, because a row that opens "not available on this
  connection yet" is not a setting. The phone and tablet **Watch on TV** row
  (AND-038) ships at app `09fef5c7`
  ([app#512](https://github.com/viptv-org/app/pull/512)): it reads **Off** until
  a TV is paired, then the TV name, with **Use this phone as a Vizio TV remote**
  as its note, and it opens the **Watch on TV** page — the setup flow, or a
  status card once a TV is paired. `watchOnTvAvailable()` gates it to
  non-television Android UI modes, so Android TV, iOS, desktop and web show no
  row. The setup flow and remote surface ship per `components.md` §11.
- **Account** holds the household's own state, and it is visible to everyone
  signed in: signing out stays reachable from every device, a member's TV and
  phone included. See [Account](#account) for the rows a device session cannot
  use. **Add a device** is the only place a TV signs in, and only an account
  session can approve it: the TV shows a code, and a phone, computer or the web
  dashboard approves it.

Local mode (no server) keeps the same shell. Profile and Playback rows that need
a server are absent rather than disabled, This device keeps its rows, and
Account holds **Add a device** and **Sign out**, whose row reads **Change
connection** in local mode.

## Settings shell per platform

### Phone (390 × 844)

`M3Settings` geometry, unchanged: header 102 high over a 0.78 ground with a 48
row inside it (44 back button, 17/700 centred title), content padding 110 / 16 /
120, groups 18 apart, group card radius 14 on a 0.06 white fill with rows
8 / 16 padded and a hairline between them, row label 15/600, note 13/500 in
`text-secondary`, value 14/400 in `text-secondary`, chevron in `text-tertiary`,
44 minimum target.

- The profile card stays at the top, above the first group: 56 avatar, name
  18/700, **Switch profile** 14/500, chevron.
- **Group label:** 11/700, +0.08em, uppercase, `text.tertiary`, 8 above its card
  and 2 below the previous card. No board draws group labels on phone; the type
  role is the eyebrow from `tokens.json` and the spacing follows the 18 group
  gap it sits inside.
- Sub-pages replace the list (pushed page with a 48 back row), never a dialog,
  except the dialogs named in [Inputs](#inputs).
- **Sign out** is the last row of the Account group, danger text, and opens the
  existing confirmation.

### Tablet (1194 × 834)

`T3Settings` two-pane: 360 rail with 40 / 16 padding, rows 10 / 12 padded at
radius 14 with a 44 avatar in the profile card, section rows
8 / 16 at radius 12, 15/600 labels, the current row on a 0.10 white fill; detail
pane from x 360 with 40 padding, page title 26/700, group card radius 16 on a
0.05 white fill with 6 padding and 8 / 16 rows, note 13/500, value 14/400, toggle
45 × 26.

- Rail group labels: 11/700 uppercase, `text.tertiary`, 12/16 padding, 12 above
  the group's first row and 16 below its last.
- The rail keeps the profile card above the groups and the groups scroll under
  it; the detail pane scrolls on its own.

### Desktop app (1440 × 900)

`D3SetGeneral` two-pane: 260 rail with 28 / 16 padding, rows 8 / 12 at radius 8,
14/600 labels, the current row on a 0.10 white fill; content from x 260 with
28 / 48 padding, page title 24/700, group cards radius 12 on a 0.05 white fill
with 4 padding and 8 / 16 rows at radius 12, label 15/600, note 13/500, value
14/400, toggle 45 × 26, inline action 32 high at radius 10 with a 0.14 inset
ring.

- Rail group labels: 12/700, +0.06em, uppercase, `text.tertiary`, 8/12 padding.
- The desktop app is pointer-only (`DESK-PLAYBACK-2026-10-03`): no keyboard
  focus ring, no Tab order, no arrow navigation. Group labels are headings for
  assistive technology and nothing more.

### Web (1280 × 800, 1440 × 900)

`W3Account`: `main` on a 100 / 57 / 40 grid with 48 gap and columns
`240px minmax(0, 760px)`; nav title 26/700 with 0 / 12 / 14 padding; nav rows
min-height 40, 8 / 16 padded at radius 8, 14/600, current row on a 0.10 white
fill; content page title 24/700, lead line 14/400 `text-secondary`, group card on
a 0.05 white fill with 14 / 16 rows, an icon tile 40 at radius 10 on a 0.08
white fill, label 15/600, note 13/500, inline action 32 high at radius 10 with a
0.14 inset ring and 13/700, destructive action 240 × 40 at radius 12 on a
`rgba(229,72,77,0.14)` fill in `#FF8A80`.

- Nav group labels: 12/700 uppercase, `text.tertiary`, 12/16 padding.
- A window narrower than 640 uses the phone layout instead.

### TV (1920 × 1080)

`Tv3SetAbout` / `Tv3SignOut` geometry, unchanged: 560 sidebar on `surface-1`
with the **Settings** title at 96 / 96 (44/700), rows 440 × 72 at x 72 from
y 196, 24 side padding, radius 12, icon 28 and 18 gap, 26/500 label and 26/700
when current; content column at x 640, 1184 wide, page title 40/700, rows
1184 × 96 at radius 14 with 28 side padding, label 26/600, note 20/500, value
24/500, 8 gap between rows; a destructive row is 80 high with `#FF8A80` text.

- The rail gains **Profile** and its **Profiles** entry is renamed **Switch
  profile**, so the page and the switcher are not confusable. **Profile** opens
  the page in [Profile](#profile).
- Rail group labels sit in the expanded 520 labelled menu
  (`components.md` §7): 18/700, +0.08em, uppercase, `text.tertiary`,
  24 × scale above a group's first row and 8 × scale below its last. They are
  not focus stops.
- `Tv3SetParental` keeps its title **Parental controls** and moves under Profile:
  it lists every profile's limits with the profile pills at the top. The
  household PIN's last row (**PIN to leave [name]'s profile**) opens the PIN
  dialog from there, so TV needs no separate Household PIN page.

## Profile

One page, the current profile, title **Profile** (phone, tablet, desktop, web)
and the same rows on TV. Every row edits the profile that is selected; the
profile switcher at the top of the shell changes which one.

| Row | Value | Note | Opens |
|---|---|---|---|
| Name | `[name]` | — | Text entry (dialog on TV and desktop, sheet on phone) |
| Avatar | — (thumbnail at left) | — | The avatar picker: worlds as chips, a grid page at a time (15 on phone, 18 on tablet, desktop and TV), Previous / Next, **"[468] avatars. Pick a world, then pick your character."** |
| Kids profile | On / Off | **"Limits titles, search and Live for this profile."** | A toggle. Turning it on asks for the household PIN when none is set for the session |
| Maturity limit | **All ratings** or the chosen rating | **"Titles above this rating are hidden for this profile"** | Choice list: `G` `PG` `PG-13` `R` `NC-17` for movies and `TV-Y` `TV-Y7` `TV-G` `TV-PG` `TV-14` `TV-MA` for series, as `Tv3SetParental` draws them |
| Approved titles | `[N]` | **"Only these titles show in the kids library"** | The approved-titles page (`/parent/search` plus the profile's approvals). Shown only while Kids profile is on |
| Profile lock | On / Off | **"Ask for a PIN before this profile opens"** | Local builds: set, change or remove a 4–8 digit local PIN. Server accounts: the row opens Parental controls, because the household PIN is what locks a kids profile |
| Language | **"[Audio language] · [Subtitle language]"**, or **"Original language"** when unset | **"Default audio and subtitles for this profile"** | Playback › Subtitles & audio, which owns the one editor for these values |
| Delete profile | — | Danger row | **Delete [name]?** · **"This permanently removes this profile's watch history, favorites and preferences."** · Cancel · Delete profile (danger) |

- **Kids flag, maturity limit and approved titles are the same values** the
  Parental controls page edits. Whichever page saves, both show the new value.
- **Delete profile** is absent when it is the account's only profile, and when
  the server reports the profile as primary (`canDelete` false).
- **Language** is a summary, not a second editor: it opens the page that already
  holds the preferred audio and subtitle languages, so the two can never
  disagree. Menus are English only; no row offers a menu language.
- After a successful save the page stays put and shows the new value. A failed
  save keeps the typed value in the field and shows the error line; the row's
  stored value does not change.
- Back from Profile returns to the row that opened it on every layout, and on TV
  the remote returns to the **Profile** rail row.

## Account

Title **Account**. Rows, in order, each its own page or dialog:

1. **Account** — the identity page: **Name** `[display name]`, **Username**
   `@[username]`, **Role** `Owner` or `Member`. Read-only, because no route edits
   them. The name is set when the account is created.
2. **Password** — the page in [Change password](#change-password). The row is
   absent only on a server that predates the route (it answers 404).
3. **Household PIN** — set, change or remove the household PIN: **"Use a 4–8
   digit PIN to protect leaving kids profiles. Turn off kids mode on all profiles
   before removing the PIN."** Removing it is disabled while any profile has kids
   mode on, with **"Turn off kids restrictions on all profiles before removing
   the PIN."** Only the account owner can set, change or remove it; a member
   reads the household's PIN status.
4. **Devices & sessions** — the page in [Devices and sessions](#devices-and-sessions).
   Only the account owner can sign a device out; a member reads the same list.
   It is an account-session page: a device session gets no list, and the row
   reads **Manage on the web** and opens the server dashboard instead.
5. **Add a device** — the page where a TV signs in, opened from a device that
   holds an account session. A paired TV or other device session has no such
   row, and the server refuses its approval with `403 account_session_required`,
   so a TV viewer pairs another TV from a phone, computer or the web dashboard.
   **Add a device**, with
   **"Open VIPTV on the other device, choose Sign in, then enter the code it
   shows."** — or **"…then scan the code it shows."** where the platform offers
   scanning — then the 8-character code and **Continue**, **Sign in this
   device?** · **"Only continue if the code matches the one on that device."** ·
   **Sign in this device** / **Deny**, and **Device signed in** ("It can now pick
   its profile.") or **Denied** ("That device will not be signed in."). Both end
   on **Add another device**. Local mode has no server to approve a code, so the
   page reads **"TV sign-in uses a server account. Sign in to the same server on
   both devices to share profiles and progress."** with **Change connection**.
   This page, not a Settings row of its own, is how pairing is reached.
6. **Add-ons** — the existing inventory page. Add-ons belong to the account;
   only the account owner can install, enable, disable or remove one. The switch
   on a row enables one for the current profile and the page says so.
7. **Source integrations** — VIPTV Sources and M3U. Only the account owner can
   add, change or remove one; a member reads the list.
8. **Xtream connections** — the account's Xtream providers; see
   [Xtream connections](#xtream-connections-baseline).
9. **VOD matches** — provider titles and their metadata overrides; see
   [VOD matches](#vod-matches-baseline).
10. **Playback gateways** — shared stream gateways and their access grants; see
    [Playback gateways](#playback-gateways-baseline).
11. **Sign out** — danger, last but one, with the existing confirmation. Title
    **Sign out of VIPTV on this phone?** on phone, **Sign out of VIPTV on this
    device?** on tablet, desktop and web, **Sign out of this TV?** on TV, with
    **"Your profiles and progress stay on your account."** · Cancel · Sign out
    (danger). In local mode the row reads **Change connection** and asks
    **Change connection?** with **"Your local library and progress stay on this
    device. You'll choose a server or local mode next."** (TV: **"Your local
    library and progress stay on this TV. You'll choose a server or local mode
    next."**) · Cancel · Change connection (danger).
12. **Delete account** — danger, last, the page in
    [Delete account](#delete-account).

A TV device session cannot manage the account, cannot read the devices list and
cannot approve a pairing code: the server answers `account_session_required` to
all three, and the app does not offer the rows. On TV, **Password**,
**Household PIN** and **Delete account** are shown disabled with **"Manage this
from a signed-in phone, computer or the web dashboard."**, and the **Devices &
sessions** row reads **Manage on the web** and opens the server dashboard, not a
list the server refuses (app#532). The rest of the group stays usable, because a
TV must be able to sign out.

A member account session reads the household's inventory but cannot write it:
**Household PIN**, **Add-ons**, **Source integrations**, **Xtream connections**,
**VOD matches**, **Playback gateways** and the sign-out actions in **Devices &
sessions** answer `403 owner_required` ("Only the account owner can change
household settings."). The reads stay open — a member still lists add-ons,
connections, matches, gateways, devices and sessions, and checks a shared
gateway's capacity — while password, delete-account, profile and parental-policy
routes stay self-service for any account session.

Account-level pages sit after **Source integrations** and before **Sign out**:
**Xtream connections**, **VOD matches** and **Playback gateways**. Gateway
access grants are managed from the Playback gateways page by the gateway owner.

### Xtream connections (baseline)

Source revision: [app `c053998c727b66ef601a81da25a136eccc0b211f`](https://github.com/viptv-org/app/commit/c053998c727b66ef601a81da25a136eccc0b211f).

The **Xtream connections** page lists the account's connections. Each row shows
its name, **Enabled** or **Disabled**, sync state (**Sync queued**, **Syncing**,
**Up to date**, **Sync failed**, **Sync cancelled** or **Not synced yet**), and
the enabled content scopes (**Live TV**, **Movies**, **Series**, or **No content
enabled**). A failed refresh also shows the provider's mapped error. The page
shows **Default live playlist** only when there is at least one enabled live
connection; its choices are enabled live connections. The selected row is marked
**Default live**.

The page lead reads **"Xtream connections belong to this account. Live, movie
and series catalogues come from each connection you enable."** The list offers
**Add an Xtream connection**, **Refresh list**, and a connection count. With no
connections it reads **"No Xtream connections yet. Add one to browse its
catalogues."** A failed initial load reads **"Could not load connections."**
with **Retry**; while no request has loaded the list it reads **"Connections are
not loaded."**

An owner can add a connection with **Connection name**, **Server URL**,
**Username**, **Password**, and **Available content** choices (**Connection
enabled**, **Live TV**, **Movies**, **Series**). The primary action is **Add
connection** and is disabled until required values are valid. The server URL,
username and password are never rendered again after save; saved credentials are
never shown. Editing offers the name and content scopes only, with the note
**"The server address and username stay as they are. Saved credentials are never
shown."** **Replace password** asks only for **New password**. Each connection
offers **Edit**, **Replace password**, **Sync now**, **Use as default live** when
eligible, and **Remove**. Sync shows its returned state and any provider error;
the page notice reads **"Sync requested. Refresh the list to check progress."**
and a saved default notice reads **"Default live playlist saved."**

Remove opens **Remove [connection name]?** with **"This removes the connection
and its saved credentials. Its catalogues and live channels stop showing.
Viewing history is kept."** and **Remove** / **Cancel**. A connection whose
credentials have not been migrated shows **"Operator migration required before
this connection can be changed."** and disables Edit, Replace password, Sync
now and Remove.

Only the account owner can change connections. A member sees
**"Only the account owner can change connections."** and has no write actions.
A paired TV session reads **"Manage this from a signed-in phone, computer or the
web dashboard."** and has no write actions. Server/provider errors use mapped
copy, including **"The provider rejected this login. Check the username,
password and subscription."**, **"This provider login is already in your
account."**, **"This account has reached its limit of 64 connections."**,
**"This server cannot store credentials, so connections cannot be changed
here."**, and **"The provider could not be reached. Try again."**

On TV, the page replaces the list in place. Enter opens a connection's action
page; Up/Down move through the list and actions, Left returns to the rail, and
Back returns focus to the rail row that opened the page. Forms and remove
confirmation keep Cancel available and return focus to their opener. Touch
layouts use a sheet; pointer layouts use a dialog for the form.

### VOD matches (baseline)

Source revision: [app `01a7fa3ae43d016df059bacf39b4bcefb01f6391`](https://github.com/viptv-org/app/commit/01a7fa3ae43d016df059bacf39b4bcefb01f6391).

**VOD matches** lists provider titles without a metadata match. The lead reads
**"Provider titles without a metadata match. Set the metadata ID a title should
resolve to."** Filters are **Provider** (default **All providers**), **Type**
(default **All types**, with **Movies** and **Series**) and **Search titles**.
Rows show the title, provider, type, optional year, **No metadata match** or
**Matched to [metadata ID]**, and **Match title** or **Edit match**. **Load more
titles** appears when another page is available.

Selecting a row opens **Match title** or **Edit match** with its title, type,
provider, the **Metadata ID** field, the hint **"For example tt0111161 or
tmdb:550."**, and **Save match** / **Cancel**. Saving updates that row in place
and leaves the page, row order, filters and scroll position intact. The save
button is disabled for a blank ID and while saving. Empty unfiltered results
read **"No unmatched titles."**; an empty filtered result reads **"No matching
titles. Change the filters or search."** A load failure shows its error and
**Retry**. A profile restriction reads **"VOD matches aren’t available for this
profile. Unlock parental controls or use the account owner’s profile."**; an
unsupported server reads **"This server doesn’t support VOD matches. Update the
server and try again."** A missing provider title reads **"That title is no
longer in the provider catalog."**; an invalid metadata ID reads **"This title
cannot be matched to that metadata ID."** An unclassified failure reads
**"Could not load VOD matches. Try again."** or **"Could not save the match.
Try again."**

Members can list matches; only the account owner can save. A rejected save reads
**"Only the account owner can change matches."** A profile restriction while
loading reads **"VOD matches aren’t available for this profile. Unlock parental
controls or use the account owner’s profile."**

On phone, desktop and web, the match form is a dialog. On TV, provider, type and
search chips sit above the D-pad list. The search panel
uses the on-screen keyboard and debounces changes by 300 ms. Enter opens the
match form; its **Metadata ID** is entered with the on-screen keyboard. Escape
closes the form and restores focus to the row; when the list is empty, focus
starts on **Search**. Saving keeps the list and viewport in place.

### Playback gateways (baseline)

Source revision: [app `f9da79f00f08fc78d83bc17191c221a52711cdb7`](https://github.com/viptv-org/app/commit/f9da79f00f08fc78d83bc17191c221a52711cdb7).

The **Playback gateways** page lead reads **"Gateways transcode and deliver
streams this device cannot play directly. Gateways are shared across the
account."** Each row shows the name, **Yours** or **Shared with your account**,
endpoint, namespace, priority, **Enabled** or **Disabled**, and any capacity
check result: **Not ready**, **Capacity unknown**, or **Ready · [N] inputs, [N]
outputs, [N] viewers**. **Check capacity** becomes **Check again** after a
result. **Refresh** reloads the page; a load failure shows the error and **Retry**.
An empty list reads **"No gateways are configured for your account."**

An owner can enable or disable a gateway, **Register gateway**, **Replace** its
configuration, **Delete** it, and open **Access**. Register and Replace use
**Name**, **HTTPS endpoint**, **Namespace**, **Priority (0–10000)**, and a masked
**Integration key**; the key is required and is never prefilled. The action is
**Register** or **Replace**, with **Cancel**. Invalid priority reads **"Use a
priority from 0 to 10000."** A missing server encryption keyring disables
registration and explains **"The server's encryption keyring is not configured,
so no gateway can be registered until the operator configures it."** A failed
save reads **"Could not save the gateway. Try again."** or the mapped gateway
error.

Delete opens **Delete [gateway name]?** with **"Playback that uses this gateway
will stop until another gateway is configured or shared with your account."**
and **Delete** / **Cancel**. **Access to [gateway name]** explains **"Grant
access to another account ID. Revoked accounts lose this gateway at their next
playback."** It lists grantees as **Account [ID]**, or **"No account has access
yet."**; **Account ID** and **Grant** add access. **Revoke** opens **Revoke
access?** with **"Account [ID] will lose access to [gateway name]."** and
**Revoke** / **Cancel**. **Close** dismisses access management.

Only the gateway owner can change its configuration or grants. Members see
shared gateways and can check capacity, but have no enable, Replace, Delete or
Access action. On TV, the owner can toggle a gateway and check capacity; TV does
not expose registration, replacement, deletion or grant management. The D-pad
enters the first gateway, moves to **Check capacity**, and Left returns to the
rail. A playback failure with code `gateway_required` offers **Open Gateways**
and opens this page.

Gateway errors use mapped copy, including **"The server's encryption keyring is
not configured, so gateways can't be saved. Ask the server operator."**, **"Use
a scoped gateway integration key starting with pgk_."**, **"Use a public HTTPS
gateway endpoint."**, **"The gateway rejected this integration key."**, **"The
key must allow this namespace and all required playback operations."**, **"The
gateway is not ready or could not be reached securely. Try again."**, and
**"Gateway checks are busy. Try again shortly."**

## Change password

Page title **Change password**, three fields: **Current password**, **New
password** (at least 12 characters, matching the register rule), **Confirm new
password**. Primary **Change password**, secondary **Cancel**.

- Success: return to the Account page and show **"Password changed. Other devices
  stay signed in."** — accurate, because no route revokes them; offering
  **"Sign out other devices"** is the Devices page's job.
- Wrong current password: inline **"That password is not correct."** on the
  Current password field; the field is cleared, the new password is kept.
- Mismatch: inline **"Passwords do not match."** under Confirm.
- Rate limited: **"Too many attempts. Wait a minute and try again."**
- Server or network failure: **"Could not change your password. Try again."**
- Back, Cancel and Escape leave without saving and change nothing.

## Devices and sessions

The existing page (`W3Account` board), unchanged in shape. It is an
account-session page: a device session — a paired TV, or a phone whose session
was recorded without the native origin — cannot read the devices list, so its
Account page shows the **Manage on the web** row and opens the dashboard instead
(app#532).

- Lead: **"Everywhere [name]'s account is signed in. Signing a device out doesn't
  delete anything from the account."**
- One row per signed-in device: a 40 icon tile, the device name 15/600 — the
  session's own name, else **This browser** for a browser session and **VIPTV
  app** for an app session — and **Now** or **Signed in [when]**. The current
  device reads **This device** in place of a sign-out action.
- **Sign out** on each other row, where the server allows it, opening **Sign out
  [device name]?** · **"This device will need to sign in again. Your profiles,
  lists and history stay on your account."** · Cancel · Sign out (danger).
- **Sign out of all devices** below the list (240 × 40, danger fill), when the
  server allows it. It signs out this device too, so it is offered on the device
  you are using as well: **Sign out of all devices?** · **"Every device,
  including this browser, will need to sign in again. Your profiles, lists and
  history stay on your account."** · Cancel · Sign out of all devices (danger).
  Confirming clears this device's session and returns to sign-in.
- Empty: **"No other devices are signed in."** Loading: three 68-high skeleton
  rows. Failure: the error line plus **Retry**, with the list left as it was; a
  loaded list also offers **Refresh**.
- Refresh after every successful sign-out; a row that disappears stays gone.

## Delete account

Page title **Delete account**, danger. Body: **"This deletes [name]'s account,
its profiles, their history, My List, add-ons and paired devices. It cannot be
undone."** Fields: the account's username typed to confirm (**"Type [username]
to confirm"**), the account password, and the household PIN when one is set —
the PIN field is absent when the account has none. Primary **Delete account**
(danger, disabled until the typed username matches exactly, the password is not
empty and the PIN is well formed), secondary **Cancel**.

- Success: the app clears its session and opens the sign-in screen with
  **"Your account was deleted."**
- Wrong username or password: **"The username or password is not correct."**
- Wrong PIN: **"The parent PIN is not correct."**
- The last owner: **"Other accounts still need an owner. Have them delete their
  accounts first."**
- Failure: **"Could not delete your account. Nothing was changed. Try again."**
- Back, Cancel and Escape leave without deleting.

## Entry, Back and focus

- **Phone:** the Settings row on the profile sheet opens the list; the back arrow
  in the 48 header row leaves it. A sub-page's back arrow returns to the list with
  the list's scroll position kept. Android Back does the same. The groups do not
  change the list's position, so a viewer who was on Add-ons returns to Add-ons'
  row.
- **Tablet, desktop, web:** the rail is the navigation; opening a row never hides
  it, and the rail keeps the current row filled. Browser and app Back leave
  Settings. Desktop has no focus ring at all.
- **TV:** the rail is one focus column; Left from a content row returns to the
  rail row that opened the page, Up/Down clamp inside each column, and Back
  returns to the rail with the same row focused. A dialog returns the remote to
  the row that opened it. Nothing in the split changes these rules; only the row
  order and the two new rows do.
- Opening Settings from the player and pressing Back returns to the player
  (`settingsReturnsToPlayer` today) with the page it left, unchanged by this
  split.

## Inputs

- **Tap/OK** opens a row, toggles a switch, or picks a choice. Every row is one
  target; a row's value and chevron are inside it.
- **Long press, repeat and hold** do nothing in Settings on any layout; there is
  no hidden action behind a row.
- **Keyboard:** text fields are editable by clicking and typing on desktop; the
  TV uses the device IME (`AND-KEYBOARD-001`), and Back dismisses the IME before
  it leaves the dialog.
- Destructive rows and dialogs keep Cancel neutral and unfocused-by-default on
  desktop and TV, and put the destructive action second on phone.

## States

- **Loading:** the page's rows are drawn from what the app already has; a page
  whose data is still arriving shows its own skeleton rows (Devices) or its
  existing progress line (Parental controls). No page shows a full-screen spinner.
- **Failure:** the page keeps its title and any rows it can draw, and shows one
  error line plus a retry action. A failed save never claims success.
- **Empty:** Devices **"No other devices are signed in."**; Approved titles
  **"No approved titles yet."**; Linked services shows the connect action.
- **Disabled:** a row is disabled only when the server would reject it, with the
  reason as its note; otherwise the row is absent.
- **Session expired:** any page's 401 goes to sign-in with **"Session expired.
  Sign in again."**, as it does today.
- **Profile or account changed elsewhere:** late replies are dropped, never shown
  under the new profile (`HAF-05`, `pull-to-refresh.md`).

## Accessibility

- Group labels are headings for assistive technology, not list items, and are
  skipped by the TV remote.
- Every row is one node with its label, its value and its note, plus its role:
  switch rows expose on/off, choice rows expose the current value, and a disabled
  row exposes disabled with its note.
- Icon-only controls (avatar change, back, close) keep 44 targets on phone and
  tablet and an `aria-label`/content description.
- Contrast follows the tokens: labels `text-primary`, notes and values
  `text-secondary`, disabled 0.4 opacity with `text-tertiary`.
- The danger rows are the only red text on the page; focus never uses accent.

## Platform equivalents

| Action | Phone / tablet | Desktop / web | TV |
|---|---|---|---|
| Switch profile | Profile card → **Switch profile** | Rail profile card → **Switch profile** | **Switch profile** rail row → Who's watching? |
| Delete profile | Dialog over the Profile page | Dialog over the Profile page | Full-page dialog, Cancel focused |
| Sign out | Danger row → confirmation | Danger row → confirmation | Danger row → confirmation (`Tv3SignOut`) |
| Household PIN | Own page with 4–8 digit fields | Own page | Last row of Parental controls |
| Devices | Own page | Own page | **Manage on the web** row: a device session cannot read the list |
| Add a device | Own page, code entry | Own page, code entry | Not on TV; a TV shows the code and is signed in from a phone, computer or the web dashboard that holds an account session |

Every action keeps a stated equivalent. TV shows the account rows it cannot use
as disabled with the reason, the Devices & sessions row becomes **Manage on the
web**, and the pages that need a browser session say where to use them.

## Acceptance

1. **ACCT-SPLIT-01** On phone, desktop and TV, open Settings. Four labelled
   groups appear in the order Profile, Playback, This device, Account, and no row
   sits outside a group except the profile card.
2. **ACCT-SPLIT-02** The Account group shows Account, Password, Household PIN,
   Devices & sessions, Add a device, Add-ons, Source integrations, Xtream
   connections, VOD matches, Playback gateways, Sign out and Delete account; no
   row in it changes a single profile's playback.
3. **ACCT-SPLIT-03** The Playback group holds Playback and Subtitles & audio; on
   desktop and web the sidebar is no longer titled Account, and neither page is
   reachable from the Account group.
4. **ACCT-SPLIT-04** Profile opens the current profile's page; changing the name
   saves and the Profile page, the profile card and the switcher all show the new
   name without a restart. Cancelling changes nothing.
5. **ACCT-SPLIT-05** Turning Kids profile on asks for the household PIN when none
   is set; with the PIN set, the maturity limit and approved titles rows appear
   and save. The Parental controls page shows the same values after returning.
6. **ACCT-SPLIT-06** Language on the Profile page shows the profile's audio and
   subtitle languages, and opens Subtitles & audio; saving a language there is
   visible on the Profile row when it is shown again.
7. **ACCT-SPLIT-07** Delete profile on the only profile is absent; on a second
   profile it asks **Delete [name]?** and, on confirmation, returns to the
   profile switcher with the profile gone. Cancel returns to the Profile page.
8. **ACCT-SPLIT-08** Simkl appears under Profile › Linked services, not under
   Account, and links and unlinks for the selected profile only. Switching
   profiles shows that profile's link state.
9. **ACCT-SPLIT-09** On TV, the rail shows group labels, a **Profile** row and a
   **Switch profile** row; the remote walks the labels without stopping on them,
   Left returns to the rail row that opened a page, and Back from a page lands on
   that row.
10. **ACCT-SPLIT-10** On TV, Password, Household PIN and Delete account are
    disabled with **"Manage this from a signed-in phone, computer or the web
    dashboard."**; the Devices & sessions row reads **Manage on the web** and
    opens the dashboard instead of a list a device session cannot read, while
    Sign out keeps working.
11. **ACCT-SPLIT-11** Change password with a wrong current password shows
    **"That password is not correct."** and saves nothing; with a mismatch shows
    **"Passwords do not match."**; on success returns to Account with
    **"Password changed. Other devices stay signed in."**
12. **ACCT-SPLIT-12** Delete account is disabled until the typed username matches
    and the password is not empty; a wrong password or PIN fails without deleting
    anything; success clears the session and shows **"Your account was deleted."**
    on sign-in.
13. **ACCT-SPLIT-13** In local mode, no Account rows that need a server appear,
    the Account group holds **Add a device** and **Change connection**, and the
    Profile page offers the local profile PIN instead of a household PIN.
14. **ACCT-SPLIT-14** A failed load on Devices and on Parental controls keeps the
    page, shows one error line and a retry, and retrying recovers. An expired
    session from any row goes to sign-in with **"Session expired. Sign in again."**
15. **ACCT-SPLIT-15** On phone, Back from a sub-page returns to the list at the
    same scroll position with the same row visible; on tablet, desktop and web
    the rail stays visible and keeps the current row filled throughout.
16. **ACCT-SPLIT-16** An account owner adds an Xtream connection, changes its
    content scopes, replaces its password, syncs it, sets an eligible default
    live playlist and removes it with confirmation. Saved server details and
    credentials never appear in the list or edit form. A member and paired TV
    session see the stated read-only guidance; a connection requiring operator
    migration keeps its write actions disabled. Load, provider and sync failures
    keep the page available with mapped error copy and a retry path. TV Back
    returns focus to the row that opened the page.
17. **ACCT-SPLIT-17** A member filters and searches VOD matches and opens a
    title; the account owner saves its metadata ID and sees that row update
    without losing list position or filters. Empty, filtered-empty and failed-
    load states remain distinct. A member's rejected save shows the owner-only
    message; TV Escape returns focus to the title row and an empty list starts
    on Search.
18. **ACCT-SPLIT-18** A gateway owner registers and checks a gateway, replaces
    or deletes it with confirmation, and grants or revokes another account's
    access. A member can inspect shared gateways and check capacity but cannot
    change them. TV exposes the owner's toggle and capacity check, and a
    `gateway_required` playback failure opens Gateways. Missing secret storage,
    load errors and gateway failures show their mapped copy and recovery action.
19. **ACCT-SPLIT-19** A member account session reads the household PIN status,
    add-ons, source integrations, connections, matches, gateways, devices and
    sessions and checks a shared gateway's capacity, but every household write
    answers `403 owner_required` ("Only the account owner can change household
    settings.") while the account owner's same write succeeds; a paired TV answers
    `403 account_session_required` on the same writes.
20. **ACCT-SPLIT-20** A paired TV or other device session gets no **Add a device**
    row on any layout, and its approval answers `403 account_session_required`;
    an account session's **Add a device** approves a code as before, and the TV
    keeps **Sign out**.

## Superseded

- `M3Settings`, `T3Settings` and `D3SetGeneral` draw one flat list and put
  **Account** last with no group labels. Their geometry and type stand; their row
  lists are replaced by the four groups above.
- `W3Account`'s nav is titled **Account** and lists Profiles, Devices, Add-ons,
  Source integrations, Parental controls, Playback and Subtitles & audio. Its
  geometry, row shapes and destructive button stand; the nav is retitled
  **Settings** with the four groups, and Playback, Subtitles & audio and Parental
  controls move out of the account group.
- `Tv3SignOut` and `Tv3SetAbout` list Account, Profiles, Playback, Subtitles &
  audio, Add-ons, Source integrations, Display, Parental controls, About with no
  group labels. The rail gains the four labels, **Profile**, and **Switch
  profile** in place of **Profiles**.
- The app's current `AccountSettingsSidebar` (web), `SettingsSidebar` (desktop,
  phone) and `TvSettingsSidebar` row lists are replaced. `DESIGN_GAPS`-style
  placeholder pages (**Notifications**, **General**) are not carried over.
- The issue text's "sign-in email" is corrected here: there is no email. The
  household writes are gated by the server's owner role — a member answers
  `403 owner_required`, a paired TV `403 account_session_required` — while the
  other reads, credential, profile and parental-policy routes stay with
  any account session; the devices list and pairing approval are
  account-session only.

## Unknowns

- No board shows group labels on phone, tablet, desktop or TV, or the Profile
  page. Their geometry is derived from the type roles and the surrounding board
  spacing and is marked above; a canvas board should follow.
- **No route lists or regenerates recovery codes.** `W3Recovery`, `M3Recovery`
  and `D3Recovery` cannot be built as drawn; the Account page has no Recovery
  codes row until a route exists.
- **No route edits the account's display name or username.**
- **No per-profile menu language exists** and the app has one string language, so
  the Language row covers audio and subtitles only.
- A member account session reads the household inventories and checks a shared
  gateway's capacity, but cannot write household configuration: the household
  PIN, add-ons, source integrations, connections, matches, gateways and
  device/session sign-outs are owner-only (backend `04bcbfc`).
- No device evidence exists for the account page layouts. The three account
  provider pages above have app source revisions, but no device parity evidence.
