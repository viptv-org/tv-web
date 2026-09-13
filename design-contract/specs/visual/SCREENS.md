# Screens and layouts

All coordinates are logical pixels in the canonical frame. Screen headings use the shared x=100 header unless stated otherwise. The runtime layout, including dynamic overrides, is evidenced by [PresentationScene](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/PresentationScene.brs), [MainScene structure](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.xml), [HeroPanel](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/HeroPanel.brs), and [account gateway](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/AccountScene.brs). These links support auditing; this document is the reconstruction contract.

## Startup and sign-in

Startup is a full-canvas `canvas` screen with the VIPTV V mark centred. The gate keeps this same splash visible through initial shelf metadata and visible artwork readiness; bottom-centred status supplies a stage/count. Do not flash a partially populated Home screen. Cached return to Home skips this gate. The account loading cover uses the packaged splash, centred `Starting VIPTV…` text x=160 y=630 (960×36), and a 60px spinner at x=610 y=476.

The pairing screen places the V mark x=96 y=44, 42×36. Its heading is x=96 y=170, width 1088 and 52px. Instruction x=96 y=260 (640×84), URL x=96 y=364 (640×72), and manual code x=96 y=450 (640×60). QR surface is x=886 y=184, 298×298, with x=910 y=208 inner 250×250 artwork and a 24px quiet-zone inset. Pairing uses a 52px heading, 32px instruction, 28px URL and 44px manual code. It has a usable manual-code fallback after QR timeout/failure and a visible `Try again` action on error. There is no initial Cancel action; Back exits to the platform.

## Global navigation rail

The rail contains, in fixed order: Profile, Home, Discover, Live TV, My List, Search, Settings. The sidebar starts at x=21, y=108. Each icon row is 60×60, with a 14px vertical gap (74px pitch); all seven rows fit without scrolling. The rail surface is 88px wide and full-height. Its V mark sits at x=32, y=29, 36×31. These are the actual [MainScene.xml appChrome coordinates](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.xml#L83). A focused row has a 60×60 white rounded surface; the 30×30 icon sits x=15 y=15 and becomes dark. The selected profile uses a 44×44 avatar at x=8 y=8, with a dark rounded initials fallback. The compact rail is icon-only; never require an expanded label rail to navigate.

## Home

Home background contains the `HeroPanel`. In its expanded, first-shelf state, the shelf group begins x=92 y=466 and clips at 1188×254; the inner `HoldRowList` begins x=100 y=474. Each shelf item is a 256×200 logical card slot (144px artwork plus labels) with 24px horizontal gap. Two rows exist, but only the first row and an edge of the next fit in the clipping region. Row labels are medium bold white with a 12px offset.

The first shelf is pinned to the hero. In first-row focus, full hero remains visible. Moving to any lower shelf hides the hero and its actions and expands the separate shelf viewport: shelves move to x=92 y=100 and clip at 1188×620. The current `PresentationScene.brs` `uiHomeLayout()` explicitly sets the hero to `compact=false` and makes it visible only in expanded first-shelf state; the reusable HeroPanel compact variant is not used by Home. The hero never scrolls with the shelves. Home actions sit x=100 y=375 as two 144×50 items separated by 12px; a `Play next episode` action widens to 236px. The retry button is x=1030 y=64, 160–184px wide.

Shelf order: Continue Watching; Recently Watched Live TV; trending movie/series; Live Now/favorites when available; My List. Empty shelves are omitted. Home data arrival must not replace the first-row hero after the viewer begins navigation.

## Browse, collections, details and episodes

Browse header: identity x=930 y=34, right-aligned 284×32 muted; heading x=100 y=54; caption x=100 y=126. Discover filters are x=100 y=178, four 256×48 chips with 24px gaps. The generic poster grid begins x=100 y=198. With Discover filters visible it begins x=100 y=248. It is four columns by two rows, 256×192 slots, 24px horizontal/28px vertical gap.

Settings and generic action lists use x=100, y=144 when the caption is empty, or y=176 when present; rows are 536×56 with 12px gaps. Heading is (100,54), 42px. Focus updates a right-hand title at (778,listY+8), width424, 28px; description at (778,listY+52), 424×208, 22px, maximum seven lines. Action labels are centered horizontally and vertically, as defined by ActionRow in the visual system. The action background uses ui-round-fill.9.png, generated with an 8px radius. Detail actions are x=100 y=436, four 192×56 controls with 16px gaps.

Movie and series detail both keep a backdrop cropped into 1280×620 from y=0..620, followed by a canvas-colour overlay at 0.52 opacity and the packaged ui-hero-left/ui-hero-bottom gradients. This is distinct from Home’s 1280×720 backdrop framing. Portrait is x=112 y=126, 236×354. Its structured text column is title x=380 y=126, max width 804 at 46px; facts x=380 y=198, 706×48; synopsis x=380 y=276, width 804 at 23px, measured to at most four lines/128px. Action rows are x=380 at `276 + renderedSynopsisHeight + 28`; credits are x=380 at `276 + renderedSynopsisHeight + 108`, width 804, max 3 lines. Movie actions are `Choose source`, `+ My List` (or `Remove from My List`), and `More info`; positive resume position inserts `Resume at m:ss` before the source action. Do not reserve an arbitrary blank synopsis height: measure it before placing actions and credits. Maintain contrast over artwork.

Series detail overrides the generic detail column: title x=112 y=74, max width 900 at 36px; facts x=112 y=132; its long synopsis and portrait are hidden. Controls are x=112 y=188 as three 256×48 chips with 24px gap; their labels are the selected season dropdown, My List state, and More info. Episode heading is x=976 y=198, width 220 right-aligned. Episode grid x=112 y=262, four columns × two real rows, 256×330 slots, 24px horizontal/28px vertical gap, clipped to 1096×330. Only one row is visibly presented at a time; Down reveals the next four as a row. Preserve column where possible at row/page boundaries.

Episode card: art 256×144, watched badge at x=160 y=10 (86×26 white pill, dark `WATCHED`); 4px progress x=8 y=134 width based on 240px. Number y=158, title y=190, synopsis y=226 max 4 lines in 94px. Focus overlays ui-card-focus.png on the 256×144 artwork only and brightens title/summary; it never outlines the full 330px episode slot. The episode-number label uses the platform SmallSystemFont (22px reference), and absent thumbnail artwork shows the V mark and `Preview unavailable`.

## Source picker

Source screen retains standard heading and source context x=100 y=119. Provider filter is x=100 y=166. Status x=384 y=178 (480×30); contextual help x=804 y=178 (350px right-aligned); the normal compact spinner is x=1172 y=162 at 26×26. Source list begins x=100 y=234 and shows two 1096×216 cards with 16px vertical gap. While zero sources have arrived, hide the list and put a 60×60 spinner at x=610 y=294; empty title/message move to y=380/y=436 and say `Finding sources` / `Sources appear here as they arrive.`

Each source card is a 12px rounded graphite surface: provider x=20 y=10; description x=20 y=46, max 6 lines in 142px; badges x=20 y=190. Default text is white/muted/secondary. Focus inverts the surface and uses dark provider/body/badge text. Preserve original multiline metadata; never compress it into misleading summaries.

## Live TV and guide

Live tab chips begin x=100 y=142; the channel-list heading begins x=100 y=204; normal channel list begins x=100 y=234. A channel row is 588×74, x=16 y=11 fitted logo 64×52, title x=100 y=23, favorite heart x=547 y=23. Default surface is `surface-muted`; focus inverts it.

The guide is its own full-screen presentation. Left menu starts around x=104 and y=166, with a focused 184×42 white pill and vertically centred label. Timeline labels begin x=432, then every 201px; a channel-logo column spans x=300..428. Five 87px-high rows appear at y=166 plus 91px steps. Logo cells are 112×73 at x=308 y=7 within each row. Programme cells are graphite by default; selected/focused cell uses the white focus treatment. The current-time line is 2px `guide-now`, never opaque white. Missing logos show wrapped channel-name fallback.

## Search

Search heading is x=100 y=54 at 44px. Search panel is a `canvas` surface from x=88 y=130, 1192×590. Query label x=100 y=164, 304×44. The MiniKeyboard is x=96 y=216, scaled 0.82; its visible 300×322 charcoal tile grid begins around x=102 y=226. Keys are adjacent 50×46 cells, white text, with the white rounded focus outline extending 6–7px beyond the focused cell and drawn above neighbours. Alphabetic/numeric ordering is `abcdefghijklmnopqrstuvwxyz1234567890`; the final row has three 100px clear/space/delete symbol keys. Help text x=100 y=572, 304×64: `Type here or use the Roku app. Play/Pause opens results.` Result carousels live in a clipped group x=456 y=164, 740×484; status x=456 y=660. The query label is nonfocusable: focus begins on a key and returning from results restores that key.

## Profiles and dialogs

Profile chooser heading is horizontally centred at x=100 y=146, width 1080, 44px. It says `Who's watching?` or `Manage profiles`. Up to five 178×210 profile slots are horizontally centred at y=252 with 34px gaps. Profile cards use a 178×178 focus envelope. Avatar/fallback is x=9 y=9, 160×160 with 12px corners; name x=0 y=181, 178px centred, 22px. Focus shows a 3px white outline, turns name white, and scrolls a long name. The initials fallback remains visible until the remote avatar is ready.

Separate Add/Manage/Done actions are 240×56 at y=530, centred as a group with 16px gaps. Paging controls are 180×40 at y=612; page label is x=860 y=615. Never render actions as people. The current page renders five people maximum; Up/Down moves predictably between people, actions and pager.

Profile form: V x=96 y=44, title x=256 y=148, description x=256 y=222. Current avatar is x=256 y=302 in a 176×176 slot, with `Change avatar` at y=486. Profile-name semantic label starts x=464 y=292; name action is x=464 y=338, 560×64; input help y=420; error copy y=484. The Continue/Save, Cancel, and conditional Delete actions begin x=256 y=574, each 240×56 with 16px gaps. Errors preserve drafts and actionable controls instead of closing the form.

Avatar picker: heading x=96 y=112, hint y=178; category list is x=96 y=238, eight visible 216×44 rows with 8px gaps and 408px clipping; avatar grid is x=360 y=238, 6×3 128px tiles with 12px gaps. It shows 18 choices per page. Previous/Next are x=360 y=662, 180×40; focused character name begins x=360 y=664; page indicator x=812 y=664, right aligned. Picker Back returns to the unchanged form draft.

Text entry is a full canvas: V x=96 y=44, title x=180 y=112, instruction y=182, entered value y=242, native keyboard x=180 y=300, and Done/Cancel at x=180 y=608. Keep visible key focus and direct Roku-app/mobile input support.

Choice dialog darkens the full frame with `#080909DC`, then centres a `#191B1D` rounded surface of width 880. Surface height is `146 + visibleChoiceCount × 62`, capped to seven visible rows; title is 792×54 at 44px inset from panel x and 32px below its top; choices are 792×52, separated by 10px. Back dismisses. A notice toast is x=320 y=42, 640×100 dark rounded surface with two lines of 19px white text inset 28×18; it stays for five seconds.

Empty state is centred: heading x=250 y=304, 780×62; message x=250 y=360, 780px, max 3 lines. Full text source detail has `#101112F8` overlay, title x=100 y=72, scrollable body x=100 y=158 (1060×460), and Back hint x=100 y=650. 

## Player overlay

The video remains under a full-screen overlay; overlay gradients must cover the frame edge-to-edge. Top gradient is 1280×210; bottom is x=0 y=382, 1280×338. VOD header: small V x=64 y=40 36×32, content identity x=112 y=36 in a 700×40 box; status x=1048 y=36 right-aligned. Live replaces this brand slot with channel logo surface x=64 y=34 84×56, fitted logo x=72 y=40 68×48, and channel name x=164 y=42 (x=64 if no logo).

Body: eyebrow x=64 y=460, title x=64 y=486 max 1090 at 32px, context x=64 y=524. Busy spinner is centred x=610 y=330 at 60×60. Timeline x=64 y=572, width 1152, height 6; time labels y=584. The VOD track has white fill, 16px thumb and muted scrub preview marker. Live replaces it with programme progress and `ON NOW`/minutes-left labels.

Controls begin x=64 y=624. They have no permanent backing surface; focus is a 64×64 white rounded pill. All following control positions are offsets within that row (add 64 to obtain canvas x). VOD positions: rewind 0; pause 80; forward 160; Audio 928; Captions 1008; Exit 1088; Next episode 240 when available. Live exposes Audio at 544 and Exit at 1088; hide unsupported seek/skip controls. Use 28px icons inset 18px. Hint is x=64 y=672, centred in 1152×28 when needed.

## Guide geometry and live refresh details

The timeline displays a fixed two-hour interval `[window, window + 7200)` across 804px. Four half-hour labels start at x=`432 + 201*i`, each 197px wide. Programme geometry uses `int((time - window) / 7200 * 804)` and clips both ends to the interval. Fill schedule gaps with `No schedule available`; cap each row at 32 cells. Draw each cell at `max(1, geometry.width - 3)` wide, and show up to two title lines only when its original geometry width exceeds 52px.

Show five channel rows. The first visible row is `max(0, selectedRow - 4)`; each visible slot starts y=`166 + 91*n` and is 87px high. The guide page contains 40 channels. The independent now marker starts y=150, is 2×470px in `#FFFFFF80`, and appears at x=`432 + int((now-window)*804/7200)` only when `432 <= x < 1236`. It can overlap the selected programme. Selection uses `#F5F5F5` with a 3px white leading edge.

Prefetch schedule for the five visible channels plus the next two, with at most three concurrent requests. Cache 40 channel entries: successful schedule data lasts 300 seconds; failures last 60 seconds. Coalesce grid refresh at 180ms, reveal the initial grid after at most 800ms, and refresh a visible grid every 30 seconds. Reuse available schedule immediately during these updates rather than replacing it with an empty screen.

## Search composition details

Search has two result rows in its 740×484 clipped viewport. Each card is 256×200 with 20px horizontal and 8px row spacing. Its native text-edit box is hidden; the MiniKeyboard drives that box, which caps the query at 256 characters. The status line at (456,660) is 740×36. Keyboard focus and the results viewport are separate focus regions; the query label itself is not a focus target.

Guide display labels preserve the API `timeline[].display_time`, programme `display_time` and timezone. Device-local formatting is only a fallback when no server label exists; never drop the server zone label during decoding.

## Runtime settings and profile overrides

Settings actions, in order: Switch profile; Playback preferences; Manage profiles; About VIPTV; Addons; Sign out. About displays installed version and server origin in the right-hand description; activating it does not open another page. Preferences has six actions: Preferred audio; Preferred subtitles; Start with subtitles; Subtitle size; Subtitle appearance; Maximum quality. Selected values appear in the right-hand description, not appended to action labels. Addons begins with Install addon, followed by addon names; Enabled/Disabled appears in the right panel.

Profile chooser actions say Add profile and Manage profiles, or Done during management. Both 180×40 paging actions remain visible when multiple pages exist, centred at x452/x648, y612; indicator at (860,615) reads `1 / 3`. Profile editor title is42px; create action says Create profile. The avatar at (256,302),176×176 is actionable; Change avatar at y486 is a plain label. Avatar picker says Find your favorite and starts with category focus. Focusing categories updates the grid; selecting one enters it. Category changes reset to page1. Previous/Next are adjacent at x360/x552,y662 and wrap; selecting either returns focus to the grid. Category/page indicator is (812,664),372px, right-aligned.
