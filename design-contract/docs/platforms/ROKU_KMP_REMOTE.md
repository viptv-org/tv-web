# ROK-REMOTE-001 — KMP TV presentation, remote authority

Status: owner-approved implementation, 2026-10-23. This contract supersedes the
legacy Roku rail, Home composition and client-owned playback selection for the
remote rebuild. The owner selected the current KMP TV working tree, rather than
the older canvas boards, as the visual reference.

The adopting Roku repository records the KMP commit, source hashes and private
reference archive hash in `docs/KMP_REFERENCE.json`. Those source bytes define
the reference: later edits by another agent do not silently change this target.
Existing KMP source is read-only during this adoption.

`assets/roku/roku/images/design/remote-entry.jpg` is the byte-identical KMP
`composeApp/src/commonMain/composeResources/files/entry/feature.jpg`, verified
against that reference ledger before import. The `remote-*.png` scrims/masks
come from `make_kmp_assets.py`, which records their KMP component provenance.

## Presentation and input

Use the KMP 1920×1080 TV coordinate system, Onest and Bricolage fonts, 96px side
safe area, fixed-size focus treatment, top navigation and profile menu. Scale
uniformly for 720p. Match the recorded TvNavigation, TvHome, TvDetails,
TvSources, TvSearch, TvLive, TvLibrary, TvHistory, TvCalendar, TvProfiles,
TvSettings and TvPlayer sources, including loading/error/empty variants.

One remote focus target is active. Left/Right traverse a row; Up/Down change
rows; boundaries return to navigation. Back dismisses the topmost overlay,
restores its opener, then returns to the prior route/card/scroll position.
Late responses must not move focus. Source drawers use the KMP 300ms entry and
200ms exit motion. Repeated input cannot submit duplicate mutations. Text input
uses the KMP TV keyboard layout; passwords are masked and cleared on dismissal.

Supported controls retain their labels and actions. Omit local mode, local
torrent controls, downloads, unsupported authentication and controls with no
real server/platform implementation. Do not copy KMP preview-only values or
unavailable placeholder actions. Empty configured capabilities remain usable
through their supported configuration flow, rather than inventing media.

## Authority

The server owns identity, permissions, catalogs, discovery, ordering, artwork
roles, source eligibility/ranking, resume, next episode and persistent settings.
Roku owns presentation, focus, animation, transient drafts, transport and the
native decoder. It sends observed capabilities and user intent; it does not
derive business rules from titles, source names, filenames or cached history.
Use the same current API as web-TV; its agent owns backend implementation.

## Acceptance

ROK-R01: bootstrap/profile changes never expose stale account content.
ROK-R02: server source order, target episode and resume decision survive unchanged.
ROK-R03: every supported screen covers entry/success/empty/failure/Back focus.
ROK-R04: unavailable features have no selectable dead-end controls.
ROK-R05: visible-window loading bounds nodes/images/tasks during long browsing.
ROK-R06: cancellation and refresh cannot resurrect retired playback sessions.
ROK-R07: inspect equivalent reference/renderer states at 1080p and 720p.
ROK-R08: record actual TCL 50S435 frame time, input latency and memory; 60fps
and p95 focus response below 100ms are targets, not unmeasured claims.

Functional, visual and physical-device acceptance are separate. App captures
stay private; durable evidence contains measurements and source references.

## Entry reconstruction corrections (2026-10-23)

Private captures of TvWelcome, TvSignInChoice and TvPairingSignIn exposed omitted
entry states in the initial Roku adoption. Entry starts at TvWelcome: the same
40 poster placements (-60 + column*252, -100 + row*372; 236x354; radius10), alpha
.32, with a 500px horizontal drift over 60 seconds reversing, and the same
elliptical scrim (.92/.75/.45 alpha at 0/.55/1). Center the 80px brand mark and
92px wordmark in the y336 band. Tagline at y474, 34/42 typography. A single
360x72 Sign in action is centered at [780,584]; omit the unsupported local action.

Sign in opens Choice. Heading [96,96], 56/64; options [96,250], 900x100, gap16,
radius16, 32px horizontal padding, 32px icons and 26px icon/text gap. Titles
30/36 bold; subtitles22/30 medium. Keep phone, browser and password in that order;
omit unsupported email/local options. Feature art [1120,250],704x396,radius18,
alpha.6, with the 64px brand mark/72px wordmark at the bottom-left32px inset.
Explanation [1120,668],704 wide,26/38. Lists retain fixed geometry under focus;
never use the native wrapping-list default for these choices.

Pairing retains the KMP heading and columns: left [96,250],760 wide with
30/43.5 heading,26/37.7 instruction and 340px white QR surface at y424. Right
[1064,250],760 wide with numbered44px instructions, address at x1126, code
surface [1126,534],640x120 and refresh/expiry row at y676. Divider x959,y250,
2x560 with60px 'or' circle. Waiting state at[96,900]. Omit unsupported email
switch. QR image remains server supplied; transport must support its current
origin and TLS requirements. Back cancels pairing ownership and returns to
Choice; Back from Choice returns to Welcome. No email placeholder dialog.

Capture these three states at 1080p and scaled720p, compare native TCL renders,
and report differences before claiming parity. Source: recorded KMP entry files
and private `kmp-entry-reference-20261023` captures; not screenshot assets.

## Settings row reconstruction

`TvSettingsRow` fixes rows at96px, corner14, background#191919 and focused
#F4F2EE, with28px horizontal padding. Labels are26/32 semibold; optional
server-provided descriptions are20/26 medium, separated by4px. Choice values
are24/30 medium at the right with an8px gap before a24px chevron. Boolean
controls use a68x38 pill and30px thumb with4px inset, accent on and#494949 off.
Use only choices supplied by the current preference contract. Selecting a boolean
row sends the other supplied boolean choice; focus does not mutate state and
accepted server responses own the displayed value. Non-boolean rows open their
server-supplied choices. Do not synthesize skip-intro, frame-rate or other absent
controls. Row pitch108px; content starts[640,220],width1184. Heading40/48 at
[640,93] with -.8 tracking; profile explanation24/30 at[640,152].

## Detail reconstruction corrections

TvDetailHero exposes Play/Resume, saved-title and (only for a server resume
intent) Restart. Do not add a separate Sources circle to that row. Movie actions
start[96,668]; series actions[96,648]. Logos fit their existing bounding box but
align to its left, using decoded bitmap dimensions rather than centering a
letterboxed Poster. Missing/failed art keeps the server title readable.

TvRecommendationShelf uses232x348 poster art,16px gaps,12px corners,3px focus
outline and no labels. Heading is `More Like This` at the existing y836 shelf
origin (poster top888). Episode cards are448px wide with252px landscape art,
24px gaps,12px corners and3px focus outline. Captions24/29 semibold, subtitles
20/26, descriptions20/28 up to2lines. Use the server's episode identity and
progress; never infer completion, episode order or a next episode locally.

## History and calendar reconstruction

History retains top navigation, a40/48 heading at[96,228],24/32 explanation,
and a260x64 Clear history action at[1564,236]. Rows start at y340 and are
1728x148,corner16,gap12, with232x124 landscape thumbnails at12px inset/radius10.
Text starts268px from the row origin: title28/34 semibold and subtitle22/28.
The right edge can display the server progress fraction as a percentage. Only
`completed_at_millis` marks completion. Preserve server order; do not deduplicate,
reorder, or manufacture day groups. Day headers require server presentation.
The empty state says `Nothing watched yet` / `Titles you play show up here.`
and offers `Browse Home`; clear remains unavailable with no entries.

Calendar's content rows are1100x132 at[96,250],gap18. Its preview uses landscape
art at[1240,250],584x329, then title32 at y598 and description24/32 at y656.
Use supplied landscape art, with the supplied poster as the KMP missing-landscape
fallback; never replace this preview with a300x450 portrait. Airing labels,
personal progress narrative and Watch target must come from the producer.

## Profile menu

The current KMP `DropdownMenu` capture is a compact popup anchored at[1768,94],
117px wide,8px vertical padding and48px rows. Its text is14px medium with12px
horizontal inset; surface#161618,4px corners, no full-screen scrim. Roku uses
this popup instead of a960px source-style drawer. Keep Switch profile and
Settings in KMP order. Append History as the required supported Roku route
(the KMP navigation popup currently has no entry to its History screen).
Back restores the avatar focus. Entry/exit use a120ms opacity transition.

## Platform launch artwork

Retire the old white-V launcher and splash artwork from the Roku package.
`make_remote_branding.py` uses the pinned Bricolage glyphs, current yellow mark,
-.04em wordmark tracking and KMP background. The1280x720 platform splash scales
TvSplash's88px mark/104px wordmark/22px gap and y492 center from1920x1080.
The runtime startup state uses the same brand, at y440 in its104px box, and a
240x4 progress track at[840,600] with96px indicator moving over1.2seconds.

## Remote library header

Use the current remote `LibraryHeader`, not the local preview controls. Header
origin[96,140],width1728,height64. Preserve the server type-control choice order
and labels. Type group has6px inset,32px outer radius,#212124 background; each
choice is140x52 when more than3 choices, otherwise168x52,26px radius,24px regular
Onest text. Accepted query type owns the selected #0B0B0C fill; focus uses
#F4F2EE and dark text. Filters stays at the far right,64px high,32px radius,
24px icon,12px gap,24px horizontal padding. Hide list picker for one source.
Type activation resets the server offset, retires the prior request and waits
for the accepted response. Up returns to navigation, Down enters the grid;
return from detail restores query and focus. Empty results keep controls usable.

## Server-projected metadata and resume

Consume `Card.view.metadata_parts` for detail and `hero_metadata_parts` for
Home; show `hero_badges` in supplied order. Do not sort, alias or deduplicate.
Metadata uses24px medium Onest,32px line box,12px gaps on each side of the dot.
Badges follow after28px,30px tall,18px bold text with .36px tracking,8px horizontal inset,
5px corners,1.5px white55% outline and12px gaps. Tile state comes from
`view.tile_badge`, never from raw capability tokens. Source rows consume
`source.view.title/body/quality_label/format_label/addon_label/provider_label`.
Resume button consumes viewing-action `remaining_label` and `progress` exactly;
remaining text26px bold follows the action label with54px gap. Progress is4px
high,28px horizontal inset,12px from the button bottom. No resume threshold or
remaining-time calculation belongs in the renderer. Library focus outlines are
4px outside the pill bounds, following KMP `tvFocusOutline`.

Tile `view.tile_badge.role=watched` renders the KMP34px circle/check at10px
inset from the upper-right; never infer watched from progress. A `new_episodes`
role renders the supplied label at[10,10],18px bold,22px line height,10x4px
padding,6px corners,light fill/dark ink. Other supplied tile labels use dark80%
fill and light ink. Compact captions and progress consume `view` fields without
raw metadata fallbacks. Episode subtitles remain the supplied episode subtitle.

## Password entry reconstruction

`TvPasswordPanel` has a24/34.8 eyebrow at[96,96] and52/60 bold heading
`Sign in with your password` at[96,140.8],tracking-1.04. Form origin[96,230],
width1130. Username and Password each have24/30 labels,10px gap,84px-high
fields with14px corners,28px horizontal inset,34/41 text. Active field has2px
light border; inactive1px white14% border; fill white8%. Fields are separated
by16px; keyboard begins at y540 after46px gap. Four ten-key rows are104x76
with10px gaps. Final row: Shift104,Symbols104,Space332,.com218,@gmail.com332,
10px gaps. Keys have10px corners,white9% fill (suffix18%),28px semibold text.
Focus uses the existing4px outer white outline. Initial focus is `q`.

Actions occupy[1290,270],width534,height72,gap16: Sign in, Show/Hide password,
then the explanatory text and Delete character / Use another server. Omit
Forgot password because the current server does not offer that authentication
flow. Retain its discoverable phone/browser alternatives on the choice screen.
The explanation keeps KMP copy. Password is masked initially; Show/Hide is a
transient renderer choice. Username max320, password max512, no persistence.
Selecting either field changes the editing target. Keyboard Up enters the
Password field; Up again enters Username. Right from the keyboard reaches the
actions; Left returns to the retained key. Back cancels login ownership, clears
both drafts and returns to choice. Errors preserve username, clear password,
and leave the form usable; retry requires a new password submission. Server
address edits preserve form drafts until accepted; acceptance clears credentials
and reopens the form against the new origin. Never synthesize authentication.

Native password verification: KMP heading ink begins at[99,149]. Roku's native
Label baseline requires the tracked heading group at y137.8 (3px above the
nominal line-box origin) to align that ink. Reopening the form resets the
keyboard to lowercase `q`, while field/action round trips retain the current
key. Keyboard-to-field/action transfer explicitly focuses the target Group;
focusing only the enclosing form leaves the previous child focused on the TCL.

## Browse filter page

`TvFiltersPage` replaces the catalog screen with#0B0B0C,96px top/side and54px
bottom padding. Heading52/60 bold,tracking-1.04,then catalog label24/32 and28px
gap. Left facet column640px wide;64px gap to the choice column at x800.
Facet rows80px high,12px gaps,14px corners,26px horizontal padding;26px bold
labels,22px selected value right aligned (max300px),18px Required indicator.
Unfocused active facet fill white16%,other facets white4%; focus light fill/dark
ink and4px outer ring. Choices preserve producer order in three-column rows,
14px horizontal/vertical gaps,minimum200px width,64px height,32px radius,
24px semibold labels and24px horizontal padding. Checked choices include a22px
check with12px gap. Only producer maximum_selections limits drafts. Single choice
replaces; multichoice toggles; no quality/provider policy is allowed.

Bottom actions at y954: Show results340x72,Clear all220x72,Cancel220x72,
16px gaps. Back/Cancel discard the entire draft and restore the trigger focus.
Show results retires old request ownership and submits the whole draft once.
Clear all clears the draft and selected catalog; it does not issue a request.
The current Library filter is a separate800px right sheet, not this full page.
Toggle choices must be supplied by the server; do not manufacture On/Off values.

Browse choices disabled by a full server maximum_selections cap are skipped by
remote focus. Removing a selected choice makes the remaining choices reachable
again. Entering a capped group focuses its first enabled choice; never leave the
remote focused on a disabled item.

Text/number/date controls with no choices use `TvFacetText`: value field at
[800,313],819.2x84,14px corners,28px inset,30px text; the inline entry keyboard
starts at[800,413],width1024,76px key height and10px gaps. Its four ten-key rows
use equal widths; the final suffix key uses the remaining row width. Drafts are
bounded to64 characters, matching the KMP input control. A200x64 Clear action
appears16px below the keyboard when nonempty. Text input remains on the filter
page; Back cancels the page, Left returns to facets, and Down reaches Clear or
the page actions. Submitting text never issues an independent catalog request.

The matched KMP text-filter capture places the value field at y313 and the
keyboard at y413. Its1024px row allocates94px to the first four keys and93px
to the remaining six (10px gaps), preserving Compose's whole-pixel remainder
distribution. Activating a text facet requests its initial `q` key, while Up
from the first keyboard row focuses the value field.

## Library filter sheet

Use KMP's `LibraryFilterSheet`, not the full-screen browse editor. Panel origin
[1120,0],size800x1080,fill#161618; black55% scrim covers the screen. Insets24px.
Heading `Filters`32px regular at[1144,24]. Fields exclude the source/type controls
already in the Library header. In the matched reference, the first label starts
at y85 and its752x64 button at y117; following fields advance116px. Labels22px
medium,values24px regular,left inset18px,24px down-chevron at right inset18px.
Buttons have12px corners,#39393A fill; focus uses#F4F2EE/dark ink and4px outer
white ring. Bottom Clear/Apply buttons are370x64 at[1144,992]/[1526,992].

Choice menus anchor below the active button,minimum260px andmaximum600px width,
maximum480px height,8px vertical padding,64px rows. Menu text24px begins48px
from its left edge; the current server/draft selection has a24px check at12px.
Back closes the menu before closing the sheet, preserving field focus. Choices
change only the complete local form draft. Apply emits one current library query;
Back discards the draft. The server-returned query owns accepted values and null
optional fields are omitted from subsequent HTTP query parameters.

Clear copies the complete server-projected `default_query` into the draft,
including source/type/limits and optional omission. It performs no request and
does not apply the draft. Apply submits it; Back discards it. Missing defaults
are an incompatible-contract error, never a client-defined reset policy.
Entrance300ms uses KMP cubic(0,0,0,1); exit200ms uses cubic(.3,0,1,1), sampled
for native interpolation. Motion sampling is not frame-rate qualification.

Resolved KMP typography confirms menu items24px/weight500; field values and
footer actions24px/weight400,heading32px/weight400,field captions22px/weight500.
Native label baselines compensate by -3px for field captions,16px inset for
field-value text,17px inset for footer/menu text. These are renderer offsets to
match captured ink bounds, not changes to the reference control geometry.

The fixed-origin Roku package omits Use another server in the password panel,
as pairing/startup already do. Its Delete action remains reachable and inline
error text follows it. The public package retains server selection. This is a
package capability, not an unavailable-feature dialog or a local connection mode.


Direct KMP keyboard capture confirms that a choice menu opens without a focused
item, retains the current-value check, and does not act on Enter until navigation
enters the menu. Down first focuses the first item; Up first focuses the last.
Subsequent Up/Down wrap. Focused rows align to the viewport top while scroll range
allows, then clamp at the end. The native menu follows this rather than scrolling
to the current value automatically. This was verified with129 producer-ordered
choices and an accepted value at the end of the list.

## Bootstrap ownership and refresh

A server identity with no selected profile displays the supplied profile selector;
a locally remembered profile must never trigger selection. A selected server
profile owns all subsequent scoped requests. Refreshing the same origin/account/
profile preserves the current route, focus and transient form drafts. Home and
profile-list refreshes wait until overlaid forms close; profile focus restores by
server profile ID. Identity/origin changes retire old requests and release cached
views, artwork, guide pages, pending parent actions and form drafts. Current
rotating credentials remain preserved; backend account/profile/history records
are not migrated or rewritten by this renderer behavior.

## Player episode-list failure and ownership

An episode-list HTTP failure is a drawer error, not a decoder failure. Preserve
the active Video content and playback lease. Keep already-loaded episode rows
when a later page fails, and append an actionable Retry row using the existing
800x144 episode-row geometry. Loading/error/empty copy uses the existing drawer
footer at[1024,940],800x88,22px text. Retry clears the error only when explicitly
activated; focus changes must not cause automatic retry loops.

Each first-page/season request retires older episode requests and starts a new
renderer generation. Preserve server episode order, identity and cursor. Closing
the drawer or replacing/stopping playback cancels its outstanding metadata work.
Late replies cannot replace another season or reopen a closed drawer. This does
not qualify the separate real-media decoder/recovery paths.

Calendar date/week/type changes retire queued and running requests and pending
authentication retries for the previous range before submitting the latest one.
While loading, old-day rows/artwork are hidden and the existing status area reads
`Loading releases…`. Late results cannot clear a newer request's ownership or
populate its rows. Preserve supplied entry order and paging cursor; pagination
from an outdated cursor is not replayed after authentication refresh.

## Current producer navigation and playback directives

Bootstrap's ordered navigation entries own destination availability and labels.
Render supported IDs in returned order using the existing KMP dimensions; map
Profile to the avatar popup and Search to its icon. Omit unknown IDs. Refreshes
preserve focused destination identity when available, otherwise clamp focus to
the surviving list. No fixed destination inventory is exposed before bootstrap.

Playback buttons and commands require explicit server action flags. Missing or
false flags remain unavailable even when media metadata suggests eligibility.
Source/track replacement sends the opaque current lease and observed position;
the server resolves the delivery clock. Failed or cancelled preparation preserves
the current decoder/lease. Back cancels pending source/track admission and late
responses cannot start it. Timeout uses the same inline recovery as rejection.

Acceptance: consume the shared producer fixtures with contradictory VOD/track
metadata, non-default Library query values and restricted navigation. Verify
ordering, unavailable-action omission, retained focus and replacement cancellation.
These handler checks do not qualify visual parity, physical decoding or timing.

## Source best-match presentation

TvSourceRow's title line contains a trailing Best match tag only for the exact
server `best_match_id`, independent of display filtering. Never badge the first
visible row by position. The tag uses18px bold Onest,20px line height,10px
horizontal/4px vertical padding and5px corners. It uses row foreground as its
fill and the inverse foreground as text. It disappears on node reuse or when
the server omits the named ID. Preserve the supplied source order.

The add-on label measures its text up to170px, with28px right inset and20px gap
from the title/body column. Best match sits at that column's right edge; title
ellipsizes before the tag with12px separation. A one-line technical description
uses28px height with6px title gap, producing108px total row height. A missing
format vertically centers the quality label. Multiple description lines remain
a separate qualification gap; do not parse provider prose into local metadata.

## Pending preference saves

Keep confirmed settings visible while a preference PUT is outstanding. Additional
preference activation shows `Saving…` in the existing drawer footer or page
status area and submits no second snapshot. This busy state includes requests
waiting for authentication refresh or Parent PIN, plus the authoritative read
after a revision conflict. It does not block Back or section navigation.

A save response updates the confirmed preference model. It may close its own
preference drawer and refresh its invoking settings section only when the same
route generation still owns it. It must not reopen Settings after Back or close
an unrelated drawer. Failures retain confirmed values and allow explicit retry;
no optimistic values or deferred client-side preference policy is introduced.

Acceptance: repeated choice/toggle input produces one PUT; authentication and
parent-authorized retries retain the same intent; leaving Settings before success
does not navigate back or disturb current focus.

## Library metadata hydration refresh

Display the server's Library `reason` in the existing status region. A positive
`refresh_after_millis` schedules a refresh, quantized up to the next polling
second. Do not invent retry intervals when the directive is absent. Defer while
filters or another overlay are open. Preserve the visible list while re-reading
the retained page window, using accepted queries and server cursors only.

Retain at most three server pages (100 titles per page maximum in the current
contract). Assemble the replacement window offscreen, then swap it atomically
and restore focus by canonical identity. Refresh does not append duplicates.
Failures leave the visible window intact and expose explicit retry. Route,
profile or filter changes retire refresh ownership and partial replacement data.
Back from details restores the page window and any outstanding refresh deadline.
Acceptance: delayed hydration, two-page refresh, absent directives, failure/retry,
filter cancellation, no duplicate cards and focus preservation.

## Cross-client revision invalidation

A changed profile revision invalidates return-view snapshots and requests a fresh
bootstrap for server navigation, membership, preferences and management facts.
A visible Library schedules replacement of its retained page window even when
no hydration timer was supplied. Defer this replacement while its filter sheet,
keyboard or drawer is open. Once unblocked, retire prior Library work before
starting the current window refresh. Do not apply server updates to a form draft.
A route/profile/query change clears the pending invalidation because its new
request already targets current state. Unchanged revision polls issue no refresh.

## Empty Home focus safety

When Home has no hero and no cards, focus the server-projected navigation even
if empty shelf headings exist. No invisible or empty action list receives focus.
Select on a retired/empty action list is a no-op. This preserves access to Movies,
Library and profile Settings while sources are unconfigured or still loading.

## Native custom focus targets

Custom keyboard, Library header/sheet, filter page and password editor must
explicitly opt into native focus at every Group that receives `setFocus(true)`.
Decorative groups remain non-focusable. This is platform focus plumbing, not a
change to the KMP focus order. Verify physical remote entry, movement, activation
and return focus; simulator acceptance of setFocus is insufficient evidence.

## Decoder completion reporting

Only the decoder's explicit finished event triggers completion reporting; do not
infer it from duration/position thresholds. Handle it once per playback attempt.
Send the observed stop/progress with ended=true and request continuation only
when the server action permits it. Once finished, periodic progress cannot send
ended=false for that attempt. Repeated decoder notifications do not duplicate
completion or next-episode requests. This does not define an automatic-next
policy or qualify gateway end-of-stream/lease reclamation.

## Playback action revocation

Track, seek and source-change permissions are independent producer flags. A track
replacement requires tracks, not an additional change_source grant. Record the
active lease and required action with pending replacement intent. If heartbeat
withdraws that action, cancel its admission while preserving current playback
and show the existing inline failure feedback. A late response is cleaned up by
retired request ownership and cannot start the cancelled replacement. Revoked
next-episode permission also retires outstanding continuation replies; do not
cache a late next target for possible later re-enablement.

## Single-decoder recovery ownership

While a previous lease is retained for first-frame recovery, another source/track/
seek admission waits with `Playback is still starting…`; it cannot overwrite the
retained lease. The current decoder and previous recovery lease have independent
authority. A revoked, invalid or expired recovery lease is released without
restarting or stopping the current candidate. Only a failure of the current
candidate can recover the still-authorized previous lease. Admission heartbeat
failure cancels preparation without stopping already-active playback. Release
retires queued/running recovery heartbeats and authentication retries as well.

## Direct Live viewing intent

Live channel activation is an explicit Watch intent. Consume the channel-sources
response's action Card, label, resume and source_selection unchanged. Rank its
opaque streams through the shared source-ranking route. Only Watch plus the
server's best preference can start the returned best_match_id; opening the source
picker explicitly still requires selection. Direct Live results have no discovery
job and must not cause stream-job poll/delete requests. Channel switches and Back
retire request ownership, so late responses cannot replace a newer channel.

## Source row corner and tag alignment

Use TvSourceRow's14px corner radius and unfocused #222222 fill, rather than the
generic row shape/color. The28px Best match tag is centered in the34px title line:
its box begins23px below the row top (20px padding plus3px centering), with text
at27px. Existing row width/height and source ordering remain unchanged. Validate
corner geometry and tag position separately from still-unresolved text metrics.

## Fixed source badge glyph asset

KMP's Best match text resolves to18px/700, zero tracking,99x20 layout and
15.985px baseline. Its shaped advance is98.60339px; native Roku's font API and
SceneGraph both report95px even after loading. Render this fixed English label
from the pinned OFL Onest with contextual shaping into a99x20 transparent glyph
asset, baseline rounded to16px. This is generated font artwork, not an app
capture. Tint it with the existing inverse row foreground and retain10px/4px
padding, yielding119x28. Dynamic source/add-on text stays native and requires
separate metrics qualification. Do not generalize this fixed-label treatment
into rasterized arbitrary provider strings.

## Library reverse traversal

Retain the accepted server offset for each visited Library page, separately from
the three-page card window. Near the first retained row, refetch the preceding
visited offset with the accepted query; prepend its returned cards and evict the
last page if necessary. Never calculate offsets from title count or reorder cards.
Restore focus by canonical identity. Keep the tail page's next cursor so forward
navigation works again after backtracking. Up reaches the header only when the
retained window starts at the first page; otherwise it requests the prior page.

Return snapshots preserve cursor history/window position. Hydration and revision
refresh preserve preceding offsets while replacing the retained window. New
queries/profile/route ownership retire them. Cursor history is bounded to10001
scalar offsets (the current producer's maximum offset10000 with minimum limit1);
card payload remains bounded to three pages. Failures retain visible cards and
use existing explicit retry. Hardware scrolling latency/memory remain separate
qualification gates.

## Library page-error retry focus

A failed current Library request pauses automatic page lookahead, reverse fetch
and hydration until explicit Retry. Preserve visible cards and selected identity.
At a grid boundary, Down reaches the visible Retry action; Up from Retry restores
grid focus. At the first retained row of a noninitial window, Up can reach Retry
instead of silently resubmitting the failed reverse request. Retry submits the
exact failed query/context once and returns focus to visible cards when accepted
by the dispatcher. If the request queue is full, retain retry ownership. Ordinary
focus movement must not trigger a network retry loop.

## Native catalog boundary focus

Catalog grids explicitly use floatingFocus vertically: Up/Down at the real edge
must reach parent navigation/retry handling, never wrap through a divider to the
opposite end. RemoteActionBar is an explicit native focus target, including Retry,
source filters and player actions. Verify these behaviors on the physical device;
simulator default focus/wrapping behavior is not sufficient.

Content replacement can emit native focus at index0 before jumpToItem restores
identity. Suppress paging during restoration until its target notification arrives,
and discard stale focus notifications. The restoration event itself is not a
new user navigation intent. This prevents forward/reverse page oscillation.

## Library error/reason placement

TvLibraryScreen places its24px status text at[96,236], above the retained grid.
The measured one-line layout is31px tall (baseline23.68px) and errors use
#FF7A6E; server reasons use secondary text. Reserve31px for one line,62px for two
bounded lines, then start the grid below it. With no message, grid remains y236.
Never draw this status over poster artwork at y940. Keep the supported native
Retry action at its existing footer position and focus path; its opaque button
remains a Roku transport-recovery affordance, not a KMP placeholder action.
Successful refresh and route reset clear error color and restore normal geometry.

## Library return-state ownership

Returning from details restores the retained Library page's controls/defaults,
server reason and status-row geometry, without resurrecting Browse controls.
Preserve pending revision invalidation. A failed page remains a visible explicit
Retry state after return; store only its method/path/body/query/tag/context and
message, never a credential copy. Bind the restored intent to the current route
and catalog generation before replay. Profile/origin retirement still clears all
return snapshots. Back does not silently retry a failed page or hide an incomplete
server result.

## Mutation-safe return routes

Accepted mutations and changed server revisions retire cached return-view data,
not the navigation path itself. Preserve route and query intent so Back can refetch
the current Library, Browse or Home result. Clear cached cards, Home snapshots,
Library page/cursor/failed-refresh state and stale controls. Progress/event writes
also invalidate these return models; do not rely on the next revision poll to
remove obsolete completion/membership. Profile/origin changes still erase the
entire stack. Refetch uses current credentials and server ordering, with no local
membership/progress edits. Browse return keeps its query filters but restarts
pagination and refreshes advertised controls.

## Refetched catalog selection identity

Return snapshots retain the selected card's exact canonical identity key,
including metadata origin. After invalidation/refetch, match that key in the
server-returned cards rather than applying an obsolete numeric index. Do not
reorder results or equate same IDs from different origins. If absent, select the
first returned card; do not infer a replacement title or hunt through unrequested
pages. Query/route/profile changes clear pending restoration. Cached unchanged
windows may still restore their known index. Deep-window relocation and physical
focus ownership during a pending refetch remain separate qualification items.

## Live group request ownership

Changing a Live group retires that view's channel-page and guide requests,
including queued authentication retries, before submitting the new group.
Hide old channels/preview while the existing status area reads Loading channels…;
keep group navigation available. Each reply/failure must match the current Live
view generation and group query before changing UI. An outdated next/previous
page cursor cannot replay after another page changes the retained window. Live
source/playback intent has separate ownership and is not a synthetic guide job.

## Live guide failure recovery

A failed current Live data request pauses automatic guide/page reads until explicit
Retry; cached channel/program previews remain navigable. Authentication replay
also owns its request slot. Background guide failures must not replace a source
or settings drawer's status. Defer their message until Live content regains focus.
Successful retry clears the old failure message without hiding another current
failure. New groups retire this state. Retry never resubmits a request whose
renderer/profile/source scope has already retired.

## Guide cache refresh slots

The12-guide cache has one order entry per canonical channel ID. Replacing a guide
moves that channel to the newest slot instead of adding duplicates. Eviction can
remove only a distinct older channel and clears its attached row data; it must
not delete a freshly replaced guide because an old duplicate reached the front.
This cache bookkeeping never reorders channels/programs or selects a source.

## Live programme selection during refresh

Initial guide selection follows the producer's current_program_id/window. After
an explicit Left/Right browse, retain that programme ID across guide refresh and
retained channel-page replacement, even if server programme order changes. Keep
the renderer viewport on that programme. If it is no longer returned, clear the
manual selection and use the producer's current programme/window. Never infer
current programme from the local clock or rewrite the server's current marker.
Manual selection belongs to retained row state and is cleared by a new group.

## Live page metadata and unavailable transitions

A retained channel window preserves page order but takes group/connection/reason
metadata from the latest accepted response. Tail cursor/completion remain the
tail page's server values. A non-Available page retires old list/guide request
ownership and replaces the cached window with that response; do not merge old
channels into an unavailable state. Empty responses hide the old preview/rows
and leave group navigation usable without stealing focus from an open overlay.

## Live list focus restoration

When a retained channel window is replaced, establish the target channel index
before assigning content. Ignore transient focus notifications until that target
is acknowledged, and ignore stale focus notifications afterward. Guide/page reads
and hero preview wait for restoration; the existing focus-settle timer then
loads visible content. This prevents an intermediate index0 from requesting a
previous page or previewing the wrong channel. New routes/groups retire the guard.

## Native guide timestamp precision

Do not store absolute epoch seconds in a SceneGraph float field. The TCL probe
rounded1800001800 seconds down by8seconds. Keep producer epoch milliseconds in
an associative viewport record, preserving double/integer wire precision. Compute
programme offsets relative to that millisecond origin before converting to the
small pixel coordinates. Manual30-minute viewport alignment also uses millisecond
double arithmetic. Initial/current programme and window decisions stay server-owned.

The manual aligned viewport must be materialized as LongInteger before transfer
to the SceneGraph associative field. The native r3 probe confirms exact integer
1800003600000ms; a prior floating result was not sufficient evidence even when a
mixed-type subtraction printed zero. Pixel projection remains relative and small.

## Visible guide transport freshness

While Live is visible and idle, refresh the focused/nearby guide working set at
most once per30seconds, bounded to10 rows (four before focus through five after).
This is a transport/cache cadence, not a local current-programme calculation.
Keep cached rows visible and consume the returned current marker/window. Pause
for overlays, playback, focus restoration, failed-request Retry, authentication
replay and parent authorization. Do not repeatedly rebuild rows merely to poll.
A background guide parent-required response becomes explicit Retry rather than
opening a PIN over another operation; retry may request parent authorization.
Cancelling that authorization restores a paused retry state, not an automatic loop.

## Guide programme tile reuse

Retain at most32 programme tile groups per rendered guide row. Project only visible
programme index/title/geometry into a bounded display model. Clock-only response
changes do not rebuild identical tiles; reuse existing groups when text or geometry
changes and hide unused groups. Empty status uses one dedicated label. Clear all
text/model references when itemContent is retired. Cells narrower than their text
padding hide the label instead of assigning a negative width. Selection/color
updates remain independent from programme-layout changes.

## Backdrop decode bounds

Set backdrop loadWidth/loadHeight from its actual displayed reference box before
assigning the URI: Live preview640x360, compact Home browsing1160x620, and full
Home/detail1920x1080. Keep the same URI, crop mode and display geometry. Restore
full decode bounds when leaving a compact view. Native aspect-preserving decode
may slightly exceed one requested dimension; measure the active bitmap and its
specific texture allocation rather than attributing shared graphics totals to
this image.

## Live directory snapshot replacement

Consume the current shared `snapshot_id` as opaque server authority. Append or
prepend only pages with exactly the retained snapshot ID. On mismatch, retire
channel/guide work, discard the entire old window/cursors and request offset zero
for the unchanged query. Hide stale rows/hero/groups and focus top navigation while
showing existing “Loading channels…” copy. A failed reload exposes normal Retry;
Back remains available and cannot resurrect the incompatible window. Missing or
empty snapshot IDs are incompatible server responses, not legacy fallback input.
Acceptance: equal-ID pages preserve server order; changed-ID forward and backward
pages never splice; old guide replies are stale; reload failure/retry retains the
current query and no old channels. This does not claim native qualification.

When decode bounds change for an unchanged backdrop URI, explicitly invalidate
the previous Poster load before requesting the new size. Native Roku otherwise
retains the small decoded bitmap when expanding to full screen. Acceptance:
Live-to-full-to-compact transitions using identical image bytes must report new
bitmap dimensions, not only changed loadWidth/loadHeight. Visual transition
smoothness remains a separate hardware observation.

## Search capabilities and channel results

Use bootstrap Search entry's explicit media_search/channel_search booleans;
missing flags grant no capability. Keep current shared grouped /api/search media
results in producer order for KMP parity, and request channel results separately
from profile /live/channels?search= using the same draft. Do not issue a media
request for a Live-only profile. Query changes cancel/retire both requests,
authentication replays and queued work, clearing old results during debounce.
Channels follow the server media groups under “Channels”; selecting one uses
its server Card and connection ID through the normal Live source action.
Use the KMP356x200 image box,356-wide item,20px gap and title/subtitle below.
No invented programme captions or search suggestions. Channel pagination retains
two pages plus opaque cursor history; compare snapshot IDs and reload offset zero
on mismatch. Focus remains on the same channel identity across window updates.
Server failures retain independent successful result sets and expose Retry;
blank query clears both result sets. Back returns through the existing navigation.
Acceptance: Live-only, media-only, mixed and absent capabilities; stale responses
and auth replays after edit; ordered channel pagination both directions; changed
snapshot; channel activation uses server identity. Native focus/render geometry
must be qualified separately before parity is claimed.

Channel artwork uses dedicated356x200 radius10 masks,3px focus border and the
KMP linear gradient#1D2230→#121318. Logo fits140x140 centered; absent logo shows
the entire server title in Bricolage800 size56. The LIVE pill is red#E5484D,
height28/radius6 at12,12. Native letter-spacing/ink and matched capture remain
measurement gates. Reusing a scaled movie-card mask is not the final design.

## Search provider messages and stable focus

Preserve every server group in order, including empty/failed groups. Display its
message verbatim below the40px heading in secondary22px text,26px line height,
20px gaps. An empty group without a server message displays “No matches.”.
Do not create selectable placeholder cards. A partial response with complete=false
retains successful cards and offers Retry for the same search; a completed retry
clears only its own failure. Focus restoration uses group ID and canonical Card
identity, never the prior numeric item index. If the selected card disappears,
choose the first actual result; when all groups are empty, return to the keyboard
(or explicit Retry). Keep native pending focus guards synchronized with that target.
Acceptance: reorder/remove focused cards, late media response while channel focused,
all-empty response, failed group plus successful group, partial retry and query edit.
Native rendering must prove that empty headings/messages are visible before this
state can be called qualified.

## Search channel page ownership

Channel paging owns a generation separate from the search text/media request.
On producer snapshot mismatch, cancel/retire channel workers, queued requests and
authentication replays before reloading offset zero. A late old page must not
repopulate the new window even when the text and cursor happen to match. Accept
next/previous replies only for the current retained window's exact server cursor;
an initial response is current only while the channel window is empty. Successful
media results and their pending request survive this channel-only reset.
Acceptance: stale next page, stale initial response, auth replay across snapshot
replacement, previous-cursor mismatch and media success during channel reload.

## Search reverse-page boundary

Left at the start of a retained channel window with an earlier server page must
retain result focus while requesting/waiting for that page, rather than jumping
to the keyboard. Leave Left-to-keyboard unchanged at the real beginning or when
an explicit failed-page Retry is awaiting action. Start reverse lookahead within
three items of the retained edge. Do not duplicate reads awaiting auth replay or
parent authorization. Returning from keyboard to results preserves the current
valid result target, falling back to the first actual result only if it vanished.
Acceptance: delayed reverse page plus repeated Left stays in results; after load,
previous channels remain reachable; true beginning returns to keyboard; Right back
restores the selected result; authentication waits do not enqueue duplicate reads.

## Catalog focused-card viewport

KMP's catalog card occupies348px artwork plus76px caption space. The native
floating-focus grid can place a second row below the1080px viewport, clipping
its caption. Preserve the seven-column grid, native floating focus and server
ordering. Use the platform's actual focused-item scene bounds to apply only the
vertical correction needed to keep the full424px card within the catalog viewport.
Clip the grid at its original content origin so correction cannot paint over
filters/navigation. Restore the original origin when focus returns to the top row.
Re-evaluate after native focus/content layout settles and after viewport geometry
changes. Ignore missing focus, overlays, noncatalog routes and stale restoration.
Acceptance: second-row full caption visible; prior row clips at content top without
overlapping filters; first row returns to original origin; deep-page restoration,
Library status-height changes, empty results and Back retain valid layout. Motion
and720p require separate native evidence; static bounds alone do not prove parity.

## Current Roku parental-control scope

Current backend device sessions cannot use household-manager policy/approval APIs,
even after parent-PIN unlock. Roku must omit kids-policy/age/approval editors and
their search/mutation paths rather than presenting account-only actions that403.
These remain supported in the account browser, outside this device client.

Retain server-authorized profile create/rename/avatar/delete and profile selection,
including parent-required challenges. Parental settings show Unlock only when the
server reports a configured PIN without an active grant. A successful grant shows
“Parent PIN unlocked”; without a configured PIN, retain the account setup address.
No per-profile PIN editor or local age-choice policy is created. Back/cancel and
invalid-PIN states retain credentials and current viewer identity. Acceptance:
locked/unlocked/unconfigured states expose only supported elements; server-denied
policy/approval actions have no Roku entry points or dormant controllers; device
profile mutation/selection permissions follow server capabilities and challenges.
This is a producer-permission correction, not a full visual-parity claim.

Settings read-only parental status occupies the right content area at[640,220],
width1184,24px secondary text, rather than the generic left-origin footer hidden
under the sidebar. Locked state keeps the Unlock row there and no status overlap.
Settings failures use the right footer at[640,940], width1184 or870 beside Retry.
Entering/rebuilding a section restores sidebar selection/focus to its matching
server-supported section, including empty/read-only states. Acceptance: unlocked
and unconfigured status readable on native capture; empty Parental section keeps
focus on Parental rather than Account; failure text and Retry do not overlap rows.

## Profile mutation drafts and parent authorization

Profile create/rename retains the full transient name until server acceptance or
explicit form cancellation. Submit freezes editing, shows “Saving…” in secondary
text and sends one intent. A rejected save restores the same editable draft and
server error. Validation of names remains server-owned. Back retires the editor,
removes unissued queued work and restores its opener; accepted in-flight work
still invalidates profile/return caches but cannot reopen or navigate an old editor.
Avatar/delete mutations also capture their profile-editor version and route.

Parent-required responses preserve the original name while showing PIN entry.
PIN submission shows “Unlocking…” and keeps the PIN only in the masked transient form.
Invalid PIN permits editing/retry with the server error. Cancelling authorization
returns to the unsaved name draft; late grants cannot replay a cancelled intent.
Accepted authorization resumes only the original current intent. Accepted profile
changes clear the draft/overlays and refresh the server profile list. Busy input
consumes edits/duplicate submits while retaining Back/cancel. Acceptance: nonempty
rejected name; duplicate submit; Back before/after dispatch; late success/failure;
route/target change; invalid PIN retry; cancelled and accepted authorization; avatar
and delete acknowledgements. Transient versions are renderer ownership only and
are never serialized as product-policy fields. Full dialog visual parity remains
an independent native comparison gate.

A profile-selection failure arriving after its route has retired cannot open a
parent-PIN prompt or replay that old selection. A successful selection may already
have changed the server session identity; it still retires client profile views
and requests bootstrap, which alone determines the active profile. Do not locally
undo an accepted switch or infer active identity from the submitted target.

A retired selection with an indeterminate transport/5xx/malformed-success reply
also requests bootstrap to reconcile actual session identity, without replaying
the old selection or opening its PIN prompt. An error reply is not proof that
an already-issued mutation did not commit.

Identity replacement retires old bootstrap workers/queued reads and their pending
slot before requesting a fresh bootstrap. Token refresh belongs to the exact
origin/opaque refresh-token generation, not a profile epoch; a valid rotation for
the same credential owner must survive a profile change. Changed credentials cannot
adopt an old refresh reply. Forgetting credentials retires unissued refresh work;
a late successful retired rotation is logged out with its returned token.

## Measured KMP modal forms (2026-10-24)

Private ImageComposeScene captures of current KMP source record28 modal states at
1920x1080/1280x720, including focused field/buttons, entered PIN, busy and failure.
At1080, Name/Add profile panel[796,424,328,232]; parent unlock[680,424,560,232];
PIN failure[680,407,560,266]. Panel fill#212124,radius28; black scrim60%.
Insets24. Title24/32 Onest400. Field semantic box local[24,72,width-48,64],
actual outline localy80,height56,radius4; outline1px#5C5B5A or focused2px#F4F2EE.
Field value14/20,weight400,tracking.2; floating label12/16. Cancel/Save/Add/Unlock
14/20,weight500,tracking.1. Buttons localy164,height40; gap8,right24; Cancel70 wide,
Save/Add58,Unlock70. Focus capsule#363638. PIN failure adds14px gap plus20px line,
shifting the centered panel up17px and buttons down17px. Name errors use its
16px text-column gap; error presentation extends the shell without losing drafts.

Replace the full-page form with that modal. Activating its field opens the platform
text-entry step; Done returns the draft to the modal, Save/Unlock sends intent.
Back from text entry returns the previous modal draft; modal Cancel retires the
form. Trap focus among field/Cancel/confirm, restoring the opener after dismissal.
Only pending transport disables submit; do not copy KMP's local name/PIN eligibility
predicates. Server validation/capabilities remain authoritative, so empty/unchanged
submit styling cannot claim parity until producer-driven form eligibility exists.
Busy PIN blocks modal Cancel/Back as KMP does; route/system retirement still scopes
late replies. Busy Name keeps cancellation available. PIN text stays only in the
masked transient dialog until cancellation/success, as in the KMP form; completed
request payloads are scrubbed and no form text enters credential storage.

KMP's density1 HD reference retains328/560px modal widths. Roku's approved FHD-only
manifest uses documented automatic2/3 scaling; that discrepancy remains an explicit
HD modal comparison gate. Native1080 geometry and input-method adaptation require
separate captures. Do not claim whole-screen parity from modal-region measurements.

## History authority correction (2026-10-24)

History entry subtitles come directly from the current producer's Card.subtitle.
Never replace that subtitle from completed_at_millis or invent “In progress”. The
producer owns resume/watched classification. Do not format a numeric progress
fraction into a new watched-status label. The current observed history array has
no shared progress-label/day-heading projection: omit those labels pending an
agreed additive producer contract rather than derive them on Roku. Landscape art
uses the producer's landscape role; missing art keeps the neutral existing image
surface, with no client choice of another artwork role. Keep exact entry ordering
and canonical identities. Offset/limit request bookkeeping remains transport for
the current endpoint; bounded bidirectional pagination and explicit continuation
are separate producer dependencies. Acceptance: a completed timestamp cannot
overwrite an intentionally different server subtitle; missing subtitle/progress
presentation stays absent; reversed IDs retain response order; no poster-role
fallback. The row shell and art geometry stay unchanged; without a percentage label, the
text column extends to the16px right inset. Day headings and
percentage text remain explicit missing parity until server presentation exists.

## Bounded server-directed Live/channel Search paging (2026-10-24)

Adopt backend1a361e4/core65add90 shared `paging` projection. Retain at most two
payload pages and their returned `origin`, `limit`, `page_size`, `previous` and
`next` descriptors; no cursor-history arrays or accumulated page counters. Forward
prefetch sends the last retained page's `next`, reverse prefetch / Left at channel
Search's first retained item sends the first page's `previous`. Send cursor,limit,
page_size unchanged with current profile/query/group scope. Do not calculate a
cursor, infer previous-page size or use `next_cursor` as an alternate API. A short
reverse page near origin zero must restore the server's larger navigation budget
when moving forward again. Null descriptors stop that direction. Missing/malformed
paging is an update-required contract error, not a client-generated fallback.

Prepend/append preserves server row order and the selected canonical channel ID.
Keep the existing pending-focus guard until identity restoration settles; rapid
repeat cannot issue a duplicate or reverse oscillation. Only a request matching
the exact currently advertised descriptor (including limit/page_size) and route,
query, profile and snapshot generation can apply or replay after auth. Snapshot
mismatch clears the old window/dependent requests and reloads the initial page.
Errors retain usable content with explicit Retry; pending auth/parent grants own
the same request slot. No geometry/type/motion change. Acceptance: current shared
reverse fixture5→2→0 then0→2→5, non-overlapping short first page, past-end return,
unchanged UINT32 cursor text, >10000 boundary, many forward/reverse pages with
constant two-page storage, same-cursor changed-limit stale reply, pending/cancel/
retry, profile/query changes, snapshot replacement and restored focus on device.

Short-page focus restoration is not a new navigation intent. Paging prefetch must
follow actual movement toward its boundary, so a reverse prepend that restores an
item inside the short window cannot immediately request the opposite forward
page. Initial lookahead may read forward once; applying a page resets that intent
until subsequent input moves focus. This also prevents oscillation when both edge
lookahead regions overlap in a short directory. Guide reads still refresh after
focus restoration. Acceptance includes restoration at index zero and middle,
up/down/left/right movement, and no repeated page requests while focus is idle.

## Native player input ownership (2026-10-24)

The Scene owns remote input while player controls are hidden, and when the server
provides no supported action buttons. The native Video node remains non-focusable:
`enableUI=false` hides most built-in UI but does not remove all native key handling
or the system Options caption panel. Every pause/seek/source/track intent must go
through the current server action gate before native operations or an admission.
Do not expose system caption selection or native trickplay that bypasses the
server's track/seek/replacement decisions. Showing supported action buttons focuses
them; hiding controls returns focus to the Scene. Back, hold/repeat, cancellation,
drawers and seek drafts retain the existing controller behavior and geometry.
Acceptance: hidden-controls Play pauses only when allowed; Fwd/Select creates the
server seek admission and consumes its returned position; denied actions do not
move/pause video; Options opens supported app controls rather than a system track
panel; successful/failed source/track replacement retains single-decoder recovery.
This corrects input routing observed on TCL, not the separate media-output duration
problem discovered by the qualification fixture.

Dedicated Fast-forward/Rewind keys enter the server-authorized seek draft even
when the action row is visible and focused. Left/Right alone retain horizontal
button navigation in that state. Confirm sends the seek admission; Back cancels
the draft. Each dedicated press/repeat uses the existing10-second seek step and
server duration bounds. A denied seek consumes those transport keys without a
native seek. Acceptance: pause/resume may reveal the action row, then Fwd+OK must
still send the exact observed-position draft to the server; no track drawer opens
as a side effect of confirmation intended for seek.

On native Roku, use a dedicated empty focusable Group in the Scene as the player's
input target. It has no visual elements or local product state; keys bubble to the
Scene controller. Merely requesting focus on the Scene did not move focus away
from the player action row during the TCL seek check, so confirmation activated
Audio & subtitles instead of submitting the seek. Hidden controls, an empty action
row and a seek draft focus this Group. Verify its native hasFocus and the actual
admission after Fwd/OK; simulator Scene focus alone is insufficient evidence.

Raise player drawers above the video before opening/focusing their controls.
Detaching and reattaching a drawer after rOpenDrawer has focused its list can
retire native focus and leave the underlying player button active. Apply the
ordering to source, audio/subtitle and episode drawers. Acceptance: Options→Audio
& subtitles→Down→OK selects the second server track, sends its opaque input index
and preserves the server-authorized position; Back restores the opener. Loading,
empty, error/retry and late episode/source responses retain the same focus scope.

Implement that empty input target as a custom Group component with an explicit
press event forwarded to the Scene controller. A raw Group reported native focus
but did not reliably deliver later transport/Options keys after controls hid.
The component has no visual children or decisions: it forwards every press/repeat
unchanged and consumes release events. The Scene alone handles Back, authorized
transport and opening controls. Acceptance: after controls hide, Options/OK/Down/OK
still enters the app track drawer and selects the intended server-projected track;
Back exits playback and cleanup runs. No platform caption panel or dead input state.


Qualification clarification: the early Options-based sequence failed with both
raw and custom input targets; it does not establish the raw Group as the cause of
that Options result. The accepted custom component makes press/repeat event
payload forwarding explicit. Native Up→controls→track selection and dedicated
seek confirmation passed. The TV's Options path remains a separate unverified
platform/input gate, rather than a claimed fix or a replacement of Up navigation.

## Home focus reconstruction and producer preview (2026-10-24)

Source: KMP88bc463cce7df91695b5bd521b2cd91c084ac282 plus the twelve unchanged
working-tree source hashes recorded by Roku's `home_focus_20261024` reference
ledger. Six actual TvHomeScreen renders cover hero, landscape and poster focus
at1920x1080 and1280x720. This records reference measurements, not Roku parity.

The billboard keeps its existing full-frame layout. Browsing hides the top
navigation over200ms and hides hero actions. The focused summary uses title
box[96,96,1000,120],48/58 bold, bottom aligned; optional logo[96,96,420,120];
metadata[96,240]; description[96,290,700,114],26/38, at most3lines. Do not add
another caption/progress panel absent from TvBrowseSummary. Landscape artwork
is[760,0,1160,620], with the existing560px horizontal fade and vertical fade
from y380 to620. Landscape shelf heading y691, art y743,422.4x237.6, gap20;
poster heading y545, art y597,255.2x382.8, gap16. Preserve server row.card_shape
and card order, even when row names or IDs disagree with KMP's local policies.

Poster focus adds a sharp supplied poster at[1520,96,280,420],radius12.
Its soft background requires a producer artwork role matching KMP's70px blur,
.45 opacity,1920x620 plane and1.2 scale. Until available, leave the background
neutral and record the missing blur as a parity dependency. Never construct a
third-party proxy URL, parse provider hosts or blur full images on the render
thread. Logos require producer-trimmed alpha bounds for exact parity.

Consume the current backend0d8da118 Home row card `view.preview.action` exactly:
`play` opens the existing fresh viewing-action flow; `details` opens details.
No row-ID/percentage/subtitle fallback. Landscape preview uses only
`view.preview.background`, retaining the episode's original tile landscape.
Null stays absent. Missing/invalid preview is an update-required contract error.
The current producer supplies bounded complete rows with no continuation;
remove the dormant Home-to-discover paging adapter rather than invent a cursor.
Other catalog and Live pagination retain their existing current contracts.

Focus preview waits120ms normally or350ms during repeats less than400ms apart,
and waits until shelf movement finishes. Retire pending previews on route/profile
change, drawer/playback entry or Home response replacement. A transient content
reset cannot select the first card over a restored canonical identity. Refresh
restores the same row ID and exact card identity/origin; a removed card uses the
nearest surviving position without reordering. Up/Back returns to the billboard
and restores navigation; Down resumes the previous shelf item. Detail return
restores the browsing plane and item. Press/repeat retain native row movement;
release does not activate. Null art keeps readable text and a neutral surface.

Acceptance ROK-HOME-FOCUS: Continue+details must open details, arbitrary row+play
must request fresh server authority; tile/preview artwork stay distinct; absent
preview fails contract validation; late timer after reset cannot render prior
content; reordered refresh restores identity and preserves new response order;
removed identity chooses a surviving neighbor; hidden navigation cannot receive
focus; return restores its opacity; no Home discover request. Compare all six
reference states on Roku separately. Metadata formatter differences, poster blur,
logo trim, row loading/error shells and native motion remain explicitly open
until measured and supported by their owning contracts.

The shared TvCatalogCard artwork uses12px corners and a3px light focus stroke
inside its unchanged bounds (both poster and landscape), rather than the earlier
Roku10px/4px extraction. Home rows expose the partially visible trailing tile to
the right screen edge; the96px safe area anchors the first tile, not a right-edge
clip. The native custom title component occupies40px followed by a12px gap.
Collapse hidden message geometry because native Group bounds otherwise include
its old rectangle and push artwork/captions down. These are renderer corrections
to the existing KMP shell, not server ordering or catalog decisions.
