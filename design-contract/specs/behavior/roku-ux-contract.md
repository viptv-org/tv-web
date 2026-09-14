# VIPTV Roku UX behavior contract

**Status:** normative cross-platform interaction contract, captured from Roku source at `viptv` commit `7d6b4131a44d87b58edcf12709af5851da387176` (2026-09-12).  
**Scope:** observable behavior, focus, remote commands, playback and recovery. Visual geometry belongs in the visual specification. No screenshot is a normative input.

## Product invariants

1. A viewer can move between VIPTV clients without relearning a primary action. `OK`/tap opens or confirms; Back returns one meaningful level; an action menu is invoked by `*`/Info or a hold; destructive actions name their consequence before committing.
2. A source is always a viewer choice in **ordinary** playback flows: Play, episode selection, Sources, and return to sources open the populated source list. **Resume is the sole automatic ordinary-source entry** and only for the exact saved source identity. The separate controlled Next-episode flow is the only other automatic candidate selection; it is available only from explicit Next/Home-next or eligible final-ten-second series playback and remains bounded to its continuation scope. If either flow cannot start, show sources or resume the outgoing episode as applicable; never silently pick an unrelated substitute. The manual list may rank compatibility and audio evidence, but ranking must never cause an automatic start or dislodge the focused source when later discovery arrives. [PLAYBACK.md](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/PLAYBACK.md) “Source ownership”; [PresentationScene.brs](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/PresentationScene.brs#L1244-L1344); `roku/components/MainScene.brs:477-482, 2822-2852`.
3. Preserve context: Back from non-live Home-shelf playback always opens that title’s detail page, including a queue/Home Resume shortcut. Playback started from detail returns there; other playback returns to its saved page, item and focus. A saved source screen retains its list, filters, source identity and current playback position when it is still the same account/profile/media. [MainScene.brs:1263-1270, 1707-1787, 2908-3040](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs).
4. Progress, favorites, preferences, profile, title and source identity are profile-scoped. Changes mark Home stale and refresh affected lists without changing an unrelated focused item. [MainScene.brs:1475-1496, 3175-3259](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs).
5. Automatic behavior is bounded and cancellable. Viewer input wins over delayed focus restoration, pending Resume, next-episode preparation and in-flight discovery. [Home focus restoration source](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs); `MainScene.brs:2042-2152, 2384-2404, 3261-3269`.

## Input vocabulary and accessibility mapping

| Intent | Roku input | Cross-platform implementation |
| --- | --- | --- |
| Activate | `OK` / Select | Primary button, Enter, tap/click |
| Return/cancel | Back | Escape, browser Back, platform Back |
| Context/manage | `*` / Info | overflow menu / right-click / long press where no Info key |
| Secondary intentional source/manage action | hold `OK` | long press; provide the same action in overflow for non-hold devices |
| Play/pause | Play | play/pause keyboard or transport control |
| Step back | Replay / Instant Replay | 10-second back transport control |
| Scrub | Left/Right, Rewind/Fast Forward | seek bar and keyboard transport controls |

Hold is exposed by `HoldSelect`: pressing OK starts a **0.7-second** one-shot timer; timer fire while the control still has focus and remains pressed emits `held=true` once and suppresses the later normal release activation. Releasing before timer fire stops the timer and emits `held=false` once. Directional key presses are forwarded as navigation and do not change the hold state. There is no repeat behavior. All parity clients use a 700 ms long-press threshold and must expose the same action in overflow/keyboard menus. [HoldSelect.brs](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/HoldSelect.brs#L1-L29), [HoldGrid.xml](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/HoldGrid.xml#L1-L5), [HoldRowList.xml](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/HoldRowList.xml#L1-L8). Do not assign a hold action to a control unless listed below.

## Global navigation, focus, and Back

The fixed left navigation rail order is **Profile, Home, Discover, Live TV, My List, Search, Settings**. Profile opens the chooser; Discover begins movie discovery and exposes type/catalog filters rather than separate rail entries; My List opens favorites (Continue Watching remains a Home/library destination). Selecting a rail destination clears stale browsing work; non-Home selections save a return view. [MainScene.brs](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs#L2204-L2248).

* Left moves from the first column/card to the rail. In a four-column episode or grid view, Left remains in content unless focus is in column 1. In Home, Left remains in the shelf while the card index is above zero. Right or Back from the rail returns focus to its content; on Home it restores the saved shelf cursor. [MainScene.brs:2715-2741](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs).
* Back closes a modal through its native dialog behavior. Back from source discovery or automatic Resume cancels that request; if a next transition is being prepared it resumes the outgoing episode. Back from active VOD exits playback; Back when overlay is open first hides the overlay; Back when a seek preview is active cancels the preview. [MainScene.brs:2072-2080, 2128-2149](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs); [PlayerOverlay.brs:210-219](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/PlayerOverlay.brs).
* Back from a non-Home page restores the prior snapshot; Back from Home exits the app. Required pairing also propagates Back to Roku app exit rather than revealing a signed-out configuration page. [MainScene.brs:2088-2097, 2128-2149](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs).
* Focus restoration must cancel immediately on an actual directional command. Do not apply a later timer and snap focus back after the person moves. Preserve both Home shelf/card coordinates and compact/expanded hero state together. [Home focus restoration source](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs); `MainScene.brs:2370-2414, 2984-3055`.
* Repeated Left/Right remains in the current horizontal shelf. Once the next card crosses the clipped edge, scroll the row with visible motion and place the focused card near the trailing two-card region so its new position is legible. A held direction may advance at a bounded repeat rate; it must not escape into another shelf or skip focus while the viewport catches up.

### Acceptance scenarios

* From a Home card in column 3, Left stays on the prior card; after reaching column 1, Left selects the rail. Right returns to the same Home card.
* Start a movie from a browse list, stop it, and land on the same list/card. Start a non-live item from a Home shelf (including Resume), stop it, and land on its title detail. Enter Sources, start the same episode, exit, and return to its source list with retained filter/cursor and current position.
* Return to Home while a delayed shelf refresh is pending, press Right once, and verify the cursor stays on the next card instead of later jumping back.

## Home, hero, queue and title detail

Home is shelf-first. Its stable order puts Continue Watching first, then recently watched live, then the remaining curated shelves; completion order of network requests must not reorder shelves. [MainScene.brs:3210-3219](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs); [Current Home and browse source](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs).

Home has a featured hero and action row for the currently focused item. This table describes the **hero primary action**, not a shelf card. An eligible queue context takes precedence over its hold action: when logical Home row 0 is selected, a non-live, non-action item opens queue Manage even if the hero primary is focused. Manage offers Resume when the retained item (or its `previous_episode`) has progress, Choose source, Remove from Continue Watching, and Cancel.

| Hero item/state | Primary activation | Hold `OK` / overflow, after queue interception |
| --- | --- | --- |
| New movie or selected episode | Manual source selection | Open the same explicit source picker |
| Series without a selected episode | Episodes | no special hold |
| Resumable VOD/episode | Resume exact saved source | Choose source (the explicit picker) |
| Queue item marked `next` | Controlled next-episode selection | Manage queue, including the preserved previous episode |
| Live | Watch live | no special hold |

Shelf-card holds follow a separate rule. Eligible non-live, non-action cards on logical Home row 0 open queue Manage, regardless of whether their queue status is `next`, resumable, or new. Other Home shelf cards have no special hold action; a held activation falls through to their normal selection. Do not reuse the hero's Choose source hold predicate for those cards. My List and episode-card menus follow the exhaustive activation inventory below.

This distinction is extracted from the frozen runtime: [PresentationScene.brs:1346–1366](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/PresentationScene.brs#L1346) checks `queueMenu()` before its hero-primary source hold and does not require saved progress for that source hold; [ContinuationScene.brs:168–200](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/ContinuationScene.brs#L168) limits Home queue management to logical row 0 and otherwise performs normal selection. This clarifies the earlier short table; it does not change Roku behavior.

On Home focus, title/action/context update immediately. The hero uses the current card’s image for continuity while its full-quality backdrop is warmed in four hidden texture slots, so a focus change should show a sharp hero without a timed delay or a blank swap. This is presentation behavior that clients should preserve even when their image cache implementation differs. [MainScene.brs:2576-2669](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs); [PresentationScene.brs:1037-1078](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/PresentationScene.brs); [HeroPanel.brs:1-73](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/HeroPanel.brs).

VOD detail actions include Play, Resume when position/source exists, Choose source, My List add/remove, More information, episode navigation for series, and source-level retry after a failure. `*`/Info toggles the selected non-live title in My List when not otherwise claimed by a library or live-guide menu. [MainScene.brs:478-502, 2150-2159](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs); [PresentationScene.brs:333-428](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/PresentationScene.brs).

Series episode selection is manual source selection. The episode view offers a season selector, four-column episode movement, paging in blocks of 80, and progress badges. Initial focus goes to the latest watched episode, or the first unreleased-safe unwatched episode following it; progress corrections refresh badges without moving a viewer who has navigated elsewhere. [MainScene.brs:1206-1239, 3221-3305](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs); [Current Home and browse source](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs).

### Continue Watching and corrections

Continue Watching pages at 40. On a queue item, normal `OK` plays `next` or starts a controlled continuation from a prior item. `*`/Info or hold `OK` opens Manage: Resume (when position exists), Choose source, Remove from Continue Watching, Cancel. Removing immediately refreshes Home/list and offers Undo/Done. For a normal episode card, the same menu provides Mark watched/Mark unwatched and Watch from the beginning. For a My List card it offers Remove from My List. [ContinuationScene.brs:147-209](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/ContinuationScene.brs); [LibraryScene.brs:45-84](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/LibraryScene.brs).

### Acceptance scenarios

* Begin episode 2, leave at 15 minutes, then select its Home card: tap Resume starts only the saved provider/source; hold opens the source picker.
* Mark an episode watched from its context menu. Its badge changes and the series selection remains on the viewer’s current episode rather than jumping.
* Remove a queue item, select Undo, and find the same queue state restored. Choose Done and verify it stays removed.

## Sources and explicit Resume

Source discovery draws sources into a manual list as they arrive, de-duplicates them, bounds the list, preserves focused source identity through updates, and exposes provider filter chips. A source card names the human/provider source and shows filename/quality/audio badges; labels are informational, not consent gates. Empty filtered results return focus to the filter chips and say to choose another provider. [PresentationScene.brs:1215-1344](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/PresentationScene.brs).

The source screen keeps a visible animated discovery indicator for the entire in-flight search, including after the first source arrives. Continue Watching episode cards resolve their parent-series metadata before presenting detail, so title context, synopsis, genres, series episodes and episode progress do not depend on which shelf opened the title.

Choosing a source starts that exact source. A selected-source failure, early end, expired identifier or preparation failure does **not** advance to another candidate. The recovery screen offers Retry and Choose another source while preserving title and absolute position. Source retry is bounded to three attempts / 180 seconds where continuation logic applies. [PLAYBACK.md](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/PLAYBACK.md); `MainScene.brs:1451-1477, 2770-2944`; `ContinuationScene.brs:211-251`.

Resume requires the exact saved `source_addon_id` plus a nonempty server-authored `source_fingerprint`, originating from a prior explicit selection. Human source names and ephemeral stream IDs never authorize Resume. A same-name release with a different fingerprint is not a match; missing/stale identity opens manual sources. This is baseline behavior in [Util.brs:45–59](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/source/Util.brs#L45). Opening Sources, Play, episode selection, and returning from player never consumes a resume intent. Back during automatic Resume cancels it and leaves manual sources available. [Explicit Resume and seek source](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs); `MainScene.brs:2864-2895, 3307-3315`.

### Acceptance scenarios

* With two discovered sources, select A, stop playback, then Resume: A starts. Remove A from discovery and resume again: show sources, never start B. Repeat with B using the same source name and addon as A but a different fingerprint: it still must not start. Legacy history without a fingerprint remains manual.
* Filter sources to a provider with zero matches: focus moves to the provider chips and the explanatory empty state appears.
* Cause preparation failure for A: present retry/Choose another source at the retained time; do not silently test B.

## Next episode behavior

The player Next action, Home’s Play next episode action, and active series playback in the last ten seconds use the controlled continuation flow. Auto-start requires: series episode, VOD (not live), known duration, playing (not paused), not seeking, next episode known and available. It does not trigger simply by focusing a title or opening Sources. Explicit Resume inside the last ten seconds plays the remainder, then normal completion may advance. [Controlled continuation source](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/ContinuationScene.brs); `MainScene.brs:1507-1535`; `ContinuationScene.brs:62-145`.

On a permitted transition, retain the outgoing frame/session while showing loading. Request the next episode, then start it. Back during preparation cancels next playback and resumes the outgoing episode in place. If no next item/caught up/upcoming state exists, resume the outgoing episode and explain the result with Open series/Done. [ContinuationScene.brs:62-126](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/ContinuationScene.brs).

Continuation source policy is intentionally narrower than ordinary source browsing: addon candidates use weighted audio/device/profile suitability with stable discovery order as tie-breaker; IPTV selects the first result from the previous provider. Failures stay bounded and never broaden to unrelated providers. The previous episode remains resumable in the queue and hold/overflow shows its Resume and Choose source actions. [Controlled continuation source](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/ContinuationScene.brs); [ContinuationScene.brs:211-270](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/ContinuationScene.brs).

### Acceptance scenarios

* Pause with eight seconds left: no next request. Resume and reach the final ten seconds: request next only then.
* While next preparation is visible, press Back: the outgoing video resumes at its prior timeline and its session remains usable.
* On the queue’s Play next episode action, hold OK: find Resume and Choose source for the previous episode, not a hidden automatic replacement.

## Player contract

The overlay is the focused player surface. It auto-hides only while actively playing, no modal owns focus, no seek preview exists, and the player is not buffering; a new session/state change restarts its hide timer. Any recognized player input reveals/restarts the overlay. [PlayerOverlay.brs:14-55](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/PlayerOverlay.brs).

### VOD controls

The control row order is Rewind 10s, Pause/Resume, Forward 30s, Next episode (series only), Audio, Subtitles, Exit. `*`/Info opens that row with Audio selected. Up returns from controls to seek; Down enters controls. `OK` on the timeline toggles pause if no seek preview is present. Play toggles pause and leaves controls visible. [PlayerOverlay.brs:137-169, 221-301](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/PlayerOverlay.brs); [MainScene.brs:1537-1553](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs).

Pause keeps the same video node, decoded frame, content, playback session and heartbeat. Resume uses that same node. It must not blank the video plane or destroy the session. [PLAYBACK.md](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/PLAYBACK.md); [MainScene.brs:1798-1816](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs).

### Seek preview and commit

VOD seek is preview-first. Left/Right begins from current position in 10-second steps; Rewind/Fast Forward starts at 60 seconds. Repeating the same direction accelerates at repeats 2/5/9/15 to ×3/×6/×15/×60; all targets clamp to duration. Replay is an immediate -10 second seek. Releasing a scrub key starts a debounce commit; `OK` commits immediately; Back cancels preview. A target within 0.5 seconds of current position makes no request. [PlayerOverlay.brs:175-184, 186-335](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/PlayerOverlay.brs); [MainScene.brs:1818-1876](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs).

Direct media uses native seek and preserves paused intent. Managed/remux/transcode output requests a replacement at the absolute target: pause visible playback, retain old content/session, start prepared output on the existing decoder, and only retire old session after success. A successful managed seek restores the prior paused state and selected tracks. On failed preparation or playback, restore the old session/content/full timeline and its pause/play intent. If restoration itself fails, exit to truthful source retry UI. [PLAYBACK.md](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/PLAYBACK.md); [MainScene.brs:1824-2050](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs).

### Audio, captions, and exit

Audio opens a paged dialog of up to five tracks at a time; labels say language is informational. Captions provides Off only when output supports subtitles, labels unavailable tracks, and explains that image subtitles cannot display. Selecting audio/caption persists the title-local track choice, saves progress, and replaces playback at the same position so output can honor it. Caption Off preserves the original global caption setting to restore on playback exit. A delayed dialog close must restore focus to the still-valid player overlay, never steal a newer dialog/sidebar focus. [MainScene.brs:1569-1710](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs).

Exit stops playback, saves progress, cleans active and pending sessions, restores captions, then restores detail or saved view. During a seek, exit cancels outstanding startup/replacement work first. [MainScene.brs:1716-1775](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs).

### Live-player differences

Live hides the seek row and exposes only Audio, Subtitles, Exit; Play/pause, scrub, Replay and Next do nothing. It labels current programme when schedule data is active, otherwise says Live broadcast. The player can request managed-live recovery after an error; show “Reconnecting channel…” while server recovery is in progress. After three failed managed heartbeat/recovery responses, stop and present a source failure with a truthful reason; no unbounded retry. [PlayerOverlay.brs:37-42, 127-166, 202-207](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/PlayerOverlay.brs); [MainScene.brs:3167-3208](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs).

### Acceptance scenarios

* Pause VOD, wait, resume: the last decoded frame remains visible and playback resumes without a new source selection.
* Hold Right through repeats: preview accelerates through the stated multipliers and never exceeds duration. Back cancels preview with no playback request.
* Seek a managed stream while paused, then succeed: it remains paused at target. Force the new output to fail: old content resumes/pauses as it was. Force rollback to fail: show Choose source again.
* Open captions, choose Off, exit player: captions return to their pre-playback global setting. Close the track dialog: overlay regains focus.

## Live TV and guide

Opening Live TV opens the EPG. Filters begin Search Live TV, All US channels, My channels, Recent, then categories; category selection reloads channels from page 0. Guide routes are 40-channel pages, guide data requests at most three concurrent channel guides, and a visible guide keeps only bounded cache. [EpgScene.brs:13-112](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/EpgScene.brs); [EpgGrid.brs:1-139](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/EpgGrid.brs).

Guide movement: Up/Down moves channel rows and crosses pages at boundaries; Left/Right moves time selection and turns off follow-now; Replay/Instant Replay restores live/current-time follow. Left moves into the filter column. Filter `OK`/Right applies filter; Search opens keyboard. `OK` on a programme opens details; `OK` there watches its channel, including when schedule is missing. Back closes detail first, then leaves guide to the rail. [EpgGrid.brs:301-380](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/EpgGrid.brs).

### Acceptance scenarios

* With a future programme selected, Replay returns timeline to now; Left/Right afterward stops following now.
* Guide detail for a channel without schedule says it can still be watched; OK starts the channel.
* On the top row, Up loads the previous 40-channel page and focuses its final channel.

## Search, Discover, Library, settings and profiles

Search begins with an inline keyboard/search field; text is trimmed, delayed before requests, and every edit cancels obsolete requests. It creates source-labelled rows across matching movie/series catalogs plus live channels (scope permitting), up to 24 unique items per source, with up to three concurrent source requests. The field remains focusable when no result exists; Enter/Play moves to results, Right moves from field to results, and Left from first result returns to field. Preserve selected result identity while result rows update. [SearchScene.brs:10-177](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/SearchScene.brs); [SearchPanel.brs:16-87](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/SearchPanel.brs).

Discover begins by content type/catalog and presents declared filters/options; catalog-specific search and pagination remain separate from cross-catalog search. A collection opens actual member movies, excluding self-references. [Current Home and browse source](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs); `MainScene.brs:683-792, 1147-1239`.

Library separates My List and Continue Watching. Settings includes account/profile controls, playback preferences, addons, server/about information and sign-out. Playback preferences use one-choice dialogs and apply to subsequent playback without overriding the viewer’s explicit current track choice. Addon management exposes install by manifest URL plus Enable/Disable and Remove with cancellation. [MainScene.brs:323-405](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs); [AddonScene.brs:1-80](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/AddonScene.brs).

Profile behavior: the chooser shows people only, with Add profile and Manage/Done below; render at most five people per page and use pager controls for up to twelve. Selecting an established profile acknowledges it before Home. Edit has name, avatar, Save/Cancel, and delete for secondary profiles; primary profiles cannot be deleted. Delete requires a dialog explicitly warning that history, favorites and preferences will be removed. A child/restricted mutation requires a masked 4–8 digit parent PIN; cancel preserves the draft. Opening profile chooser does not sign out. [ACCOUNT-UX.md](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/ACCOUNT-UX.md); [AccountScene.brs:471-860](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/AccountScene.brs).

Required sign-in exposes QR plus manual URL/code, polls token state, and offers retry on failure. It has no Cancel control. A paired device restores only a last profile that still belongs to the account and is setup-complete; otherwise show the chooser/setup flow. [ACCOUNT-UX.md](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/ACCOUNT-UX.md); `AccountScene.brs:140-318, 471-518`.

### Acceptance scenarios

* Type a query, focus result 3, let another source return: focus remains on the same result by identity. Empty results leave focus in the field.
* Manage 12 profiles: only five person cards render on a page; Add/Manage/Done remain separate from people; pager works.
* Attempt to delete primary: no delete action. Delete a secondary: Cancel preserves it; confirm removes its isolated history/favorites/preferences and returns selected profile to chooser.

## Platform adaptation rules

Keep behavior before control shape. Touch, pointer, keyboard and remote clients may present an overflow menu instead of a physical `*` button, but every Roku hold/Info action above must remain discoverable. Desktop/web tooltips should state the keyboard equivalent. Platforms without reliable long press must place “Choose source” and queue management in overflow and should use a secondary visual affordance on resumable items.

Do not auto-transcode to make an interaction succeed. Playback capability selection is separate from UX: direct/native playback first, platform player/MediaBunny next where supported, server transcoding only when required. A playback fallback must preserve the same explicit-source, pause/seek/track/recovery contracts.

## Traceability and review checklist

When changing a client, update this contract only after behavior changes are agreed. A change is incomplete until it names: primary input, Back behavior, overflow/hold equivalent, focus restoration, loading/cancel state, playback/source consequence, and at least one acceptance scenario. Cross-client tests must cover each scenario in the player, sources, queue/next, guide, search, profile, and library sections.

## Complete activation and hold inventory

This table is intentionally exhaustive for `MainScene.selectItem`, Home/queue hold activation, and `*`/Info handling. An action without a listed hold behavior is ordinary activation only.

| Surface / item | Normal activation | Hold / Info behavior | Failure, cancel, and return contract |
| --- | --- | --- | --- |
| Home primary: new movie | Manual `Choose a source` | hold opens the same explicit source picker | Back cancels discovery and restores Home; no source is auto-selected. |
| Home primary: resumable VOD | Resume exact saved source | hold opens `Choose a source` | Back while `Resuming… Back to choose a source` cancels automatic Resume and leaves manual sources. |
| Home primary: series without episode | Episodes | no special hold | Detail/episode navigation owns Back. |
| Home primary: queued `next` | controlled next-episode selection | hold opens queue Manage if eligible | next preparation Back resumes outgoing episode. |
| Home primary: live | Watch live | no special hold | Back from player restores saved view. |
| Home secondary | Details; live opens Guide | no special hold | Guide loading stays in context. |
| Home/Continue Watching card | select according to queue/title state | **only queue cards**: Manage if non-live, non-action item on logical Home row 0 | Manage options are Resume when position > 0, Choose source, Remove from Continue Watching, Cancel. |
| Detail Play | manual source list | hold opens manual source list too | ordinary Play and hold both require a choice; hold exists for consistent “source control” muscle memory. |
| Detail Resume | exact saved source | no special hold | stale saved identity falls back to source list. |
| Detail Sources | manual source list | no special hold | source route preserves position/title. |
| My List card | open title | Hold OK or `*` opens `Remove from My List`, `Cancel` | removal restores the retained list index. |
| Episode card | manual source list | Hold OK or `*` opens `Mark watched`/`Mark unwatched`, `Watch from the beginning`, `Cancel` | correction refreshes badges/progress only; restart opens manual sources at 0. |
| Continue Watching card | queue/title selection | Hold OK or `*` opens queue Manage | live and pager/action rows have no queue menu. |
| Source list item | start exactly that source | `*`/Info opens scrollable `Source details` | Back closes detail and restores source-list focus. |
| Live browse card | starts live | `*`/Info opens `Watch live`, Add/Remove favorites, `Program guide` | nothing in this menu alters provider/source selection. |
| Addon row | Manage addon | no special hold | Manage shows Enable/Disable, Remove addon, Cancel; Remove opens a second confirmation. |
| Profile card | choose profile or edit while managing | no special hold | all profile destructive actions have their own confirmation/PIN route. |

`HoldSelect` is exact: it emits a boolean `held` after 700 ms or emits `held=false` on an earlier release. After a hold fires it clears its pressed state, so release cannot also trigger normal selection; key repeat does not emit additional actions. `queueActivation` attempts library/queue management only for `held=true`; otherwise, or if ineligible, it executes normal selection. [HoldSelect.brs](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/HoldSelect.brs#L1-L29), [ContinuationScene.brs](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/ContinuationScene.brs#L168-L200), [PresentationScene.brs](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/PresentationScene.brs#L1346-L1366).

### Queue hiding, undo, and suppression

Remove sends a profile-scoped hidden flag and preserves the current queue index before reloading. On success, Home is marked stale and the current queue page reloads (or Home reloads when invoked there). It then opens the modal titled **“Removed from Continue Watching”** with `Undo` and `Done`. This modal has no timer and no automatic expiry: it remains until an explicit choice or Back. `Undo` sends hidden=false; `Done` is cancellation of the dialog only. Failed mutations leave the item and show **“Could not update Continue Watching. Try again.”** [ContinuationScene.brs](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/ContinuationScene.brs#L24-L58).

## Exact dialogs, forms, errors, and loading

### Dialog rules

The reusable choice panel is modal, initially focuses the requested index (otherwise first option), renders one to seven rows at once, supports up to 2,048 items, consumes Left/Right, and Back dismisses it. On dismissal, restore focus to the originating source filter, season selector, Home action, episode grid, Discover filters, EPG, search results, or normal list as appropriate. A response generated for an older navigation generation is ignored and focus restores without mutation. [UiChoice.brs](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/UiChoice.brs#L1-L55), [PresentationScene.brs](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/PresentationScene.brs#L549-L644).

| Trigger | Exact title | Choices and consequences |
| --- | --- | --- |
| Sign out | `Sign out of VIPTV?` | `Keep watching` cancels; `Sign out` calls logout. A restricted session may then require PIN. |
| Addon manage | `Manage {addon name}` | `Enable` or `Disable`; `Remove addon`; `Cancel`. Toggle reloads Addons and clears Home cache. |
| Addon remove | `Remove {addon name}?` | `Cancel`; `Remove` deletes it. |
| My List manage | title name | `Remove from My List`; `Cancel`. |
| Episode correction | episode title/name | `Mark watched` or `Mark unwatched`; `Watch from the beginning`; `Cancel`. |
| Queue manage | queue item name | conditionally `Resume`; `Choose source`; `Remove from Continue Watching`; `Cancel`. |
| Queue remove result | `Removed from Continue Watching` | `Undo`; `Done`, with no expiry. |
| Next unavailable | explanatory string below | `Open series`; `Done`. Exact messages: `You're caught up. No next episode is listed yet.`; `The next episode hasn't been released yet.`; otherwise `Episode information is unavailable. Open the series to choose an episode.` |
| Player audio | `Audio tracks` | up to five track choices, More/Previous tracks, `Back to player`; selected track prefixes `Playing ·`; unavailable prefixes `Unavailable ·`. |
| Player subtitles | `Subtitles` | `Off` only when output supports captions; then up to five tracks, More/Previous, `Back to player`. Explain unavailable/image-caption limitation. |
| Live overflow | channel name | `Watch live`; `Add to favorites` or `Remove from favorites`; `Program guide`. |
| Discover | Browse/Catalogs/genre/extra label | selection changes current filter, resets pagination, and reloads catalog results; optional extras include `Any`. |

The profile-delete confirmation is a native dialog rather than the generic panel: title **`Delete {name}?`**, message **`This removes this profile's watch history, favorites and preferences. Other profiles are kept.`**, buttons `Cancel`, `Delete profile`. Primary profile never exposes delete; confirmation index 1 is required. [AccountScene.brs](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/AccountScene.brs#L827-L860).

### Text entry and parent authorization

Text entry always exposes `Done` and `Cancel`; Enter is Done; Back is Cancel; Down/Up traverses field/actions. Canceled normal text returns empty. PIN entry masks the displayed value, clears the native buffer/result after submission, allows only 4–8 numeric digits, and never persists it. [TextEntry.brs](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/TextEntry.brs#L1-L69), [AccountScene.brs](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/AccountScene.brs#L777-L813).

When the server requires parent authority, profile selection prompts **`Enter parent PIN`**; profile create/edit/delete prompts **`Enter parent PIN to manage profiles`**; sign-out prompts **`Enter parent PIN to sign out`**. Back/Cancel returns to profile editor or Settings with its draft/session intact. Invalid shape reopens **`Enter a 4–8 digit parent PIN`**. An incorrect PIN says **`Incorrect PIN. Try again.`**; rate limiting says **`Too many attempts. Wait before trying again.`** and the retry heading says **`Too many attempts · wait, then try again`**. While unlock is in flight, status is **`Unlocking… Back cancels.`**; Back invalidates its epoch so a delayed success cannot perform the mutation. Successful profile mutation resends the originally held request; successful logout continues logout; successful profile choice re-attempts the pending profile. [AccountScene.brs](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/AccountScene.brs#L318-L467).

### Account and profile states

Startup/sign-in uses an opaque loading cover with **`Connecting to your account…`**. QR artwork has a six-second readiness deadline; if it fails/times out, the page remains usable with **`Enter this code on your phone to sign in.`**, manual visit text, and code. A device code expires at server expiry and reports **`That code expired. Request a new one to continue.`**. Token pending/slow-down/network/server errors reschedule polling; slow-down increases interval by 5 seconds capped at 60. Refresh interruption retries after 30 seconds. Revocation reports **`This TV was signed out. Scan a new code to reconnect.`**. [AccountScene.brs](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/AccountScene.brs#L140-L304).

Profile chooser loading is **`Loading profiles…`**. It uses people cards first, Add/Manage/Done actions second, and Previous/Next pager third. Up/Down transitions people/actions/pager; Back from Manage exits management, and Back from a normal chooser returns Home when a profile is selected. Add profile says **`Add a profile`** with Create profile/Cancel; edit says **`Edit profile`** with Save/Cancel and Delete profile for a non-primary managed profile. Blank submit says **`Enter a name to continue.`**; request state says **`Saving profile…`** or **`Deleting profile…`**; failed mutation says **`Couldn't save your profile. Please try again.`**. Avatar picker has category-to-grid, grid-to-pager navigation; 18 avatars per page; Back from picker returns form with avatar focus without losing draft. [AccountScene.brs](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/AccountScene.brs#L471-L860), [ProfileEditor.brs](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/ProfileEditor.brs#L1-L184).

### Browse, settings, and pagination action index

The action routes below complete the `selectItem` inventory and must stay functionally identical across clients.

| Area | Activation routes | Empty/error/loading behavior |
| --- | --- | --- |
| Movies/Series | rail destination loads catalogs; catalog opens browse; `Next page`/`Previous page` use returned offsets | shows `Loading catalogs…`; clearing a filter resets offset history. |
| Search | Search, Search movies, Search series, Search channels open text entry; submitted query opens cross-catalog or scoped search | empty query remains a usable field; source failures append `Some sources couldn't load.` |
| Discover | Discover movie/series opens catalog discovery. Filters select type, catalog, genre, declared extra, or catalog search; changing one resets offset history and reloads from zero | required extras get default/first value; optional extras begin at `Any`; an extra without enumerated values opens text entry. |
| Live | Live opens guide; My channels/Recent apply EPG collection filters; categories use 80-item pages; All channels/Clear restores unfiltered browse | empty guide tells the viewer to choose another filter; channel request failure gives `Press OK to retry, or Left to choose another filter.` |
| Library | My List opens favorites page; Continue Watching opens queue page; page routes use 40 items | failed My List page has a single `Try again`; an empty non-first page returns to prior page. |
| Settings | Playback preferences, Addons, Profiles, Sign out, server status, About | status/About are informational routes; Addons say `Shared by all profiles and devices on your account.` |

Playback preferences are profile-scoped and use one-choice dialogs. The exact controls/options are: Preferred audio and Preferred subtitles (`System default`, English, Spanish, French, German, Italian, Portuguese, Japanese, Korean, Chinese, Hindi, Arabic); Start with subtitles (On/Off); Subtitle size (Small/System default/Large); Subtitle appearance (System default/Text with shadow/White text on black); Maximum quality (Auto/1080p/720p/480p). Subtitle/pref changes say **`Applies to your next playback. Manual track choices take priority.`** and must not override a viewer’s current explicit audio/caption choice. [MainScene.brs](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs#L323-L558), [MainScene.brs](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.brs#L3326-L3347).

### Loading and time bounds

Do not mask an already usable surface with a global loading layer. Player next/managed seek uses player-local `LOADING`/`Seeking to {time}…`; next retains the outgoing frame. Cold auth may use the full loading cover. Current timings are: input search debounce 0.65s; source polling 1.5s; player overlay hide 7s; seek key-release debounce 0.8s; playback budget 180s; player start timeout 25s; managed seek timeout 60s then 25s primary replacement; detail layout 0.05s; card artwork scheduling 0.15s; hero metadata delay 0.35s; Home/list focus guards 0.15s; notices 5s; player tick 0.5s; normal heartbeat 15s (managed live 3s); pairing QR readiness 6s. A timing change requires a behavior review because it changes cancellation/focus/feedback. [MainScene.xml](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/MainScene.xml#L114-L139), [PlayerOverlay.xml](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/PlayerOverlay.xml#L58-L59).

## Source ranking: what the viewer may infer

Manual source selection remains manual even though rows are ranked. The app computes compatibility/audio preference rank and direct-play likelihood, marks only the first best candidate, and keeps a focused row stable while late discovery arrives. It must never move focus to a later “better” row or play it. Displayed badges communicate source/provider/quality and audio evidence. Audio labels including `Unknown` and `Dubbing / multiple audio` are hints, never an authorization gate; subtitle availability is not audio evidence. Source detail is the canonical place for fuller provider/track facts. [PresentationScene.brs](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/PresentationScene.brs#L1244-L1344), [Source audio scoring policy](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/source/PresentationPolicy.brs).

## Feature coverage matrix

This matrix is the implementation handoff: every row names the source owner, normative section, and one minimum end-to-end acceptance test. It is intentionally organized by user behavior, not BrightScript module boundaries.

| Source handler/screen | Contract section | Minimum concrete test |
| --- | --- | --- |
| `MainScene.selectItem` | Complete activation inventory; Home; Sources; Library | Exercise every listed action branch with an asserted destination/request and Back target. |
| `MainScene.onKeyEvent` | Global navigation; player; parent PIN | Test modal, pairing, pending Resume, pending next, VOD play/replay, discover filters, Back/Info precedence. |
| `PresentationScene.uiPresentationKey` / `uiChoiceSelected` | Dialogs; focus | Dismiss every dialog and assert its exact saved focus; send stale response and assert no mutation. |
| `HoldSelect`, `uiResumeAction`, `queueActivation` | Hold inventory | Normal press fires normal selection once; held eligible item opens listed menu once; held ineligible item remains normal selection. |
| `PlayerOverlay` / player commands | Player contract | Run every control, seek repeat tier, cancel/commit, auto-hide, track dialog return, direct and managed rollback. |
| `ContinuationScene` | Next episode; queue hiding | Test last-ten-seconds guards, no-next dialogue, Back resume, scoped candidate selection, 3/180 bound, Undo with no elapsed auto-dismiss. |
| `EpgGrid` / `EpgScene` | Live TV and guide | Test filter/search, row page boundaries, timeline/follow-now, detail/Watch, schedule-missing channel. |
| `SearchScene` / `SearchPanel` | Search | Test 0.65s query cancellation, identity focus retention, empty field focus, field/results movement. |
| `LibraryScene` | Library | Test 40-item paging, failed page Try again, removal focus restoration, watched/unwatched/restart. |
| `AccountScene`, `ProfileEditor`, `TextEntry` | Account/profile/PIN | Test QR fallback/expiry, 12-profile paging, non-primary deletion confirmation, each parent PIN cancel/retry/rate limit/success route. |
| `AddonScene` | Settings/addons | Test installation entry cancel, enable/disable reload, nested remove cancellation/confirmation, account-wide explanatory copy. |

## Guide input and search precision

The guide displays five rows within a 40-channel page and a two-hour time window. Future-programme **OK** opens programme details; **Play** watches that channel immediately even when the selected programme is in the future. While details are open, Back closes them and OK watches; all other keys are consumed. Rewind shifts the window back one hour, never earlier than the current half-hour. Left/Right move between programme cells and cross window edges by one hour; the future limit is the current half-hour plus 24 hours. Left at the earliest edge moves to filters. Replay/Instant Replay restores follow-now.

Guide search is separate from the general search keyboard. Search Live TV opens TextEntry titled `Search Live TV`, capped at 128 characters. Submit trims the result, sets the guide query and restores the guide. Its empty result message is `No matching US channels or current programmes. Try a channel name, section, or another title.`

Acceptance: select a future programme and compare OK (details) with Play (watch now); press an unrelated key in details and verify it is consumed; move Left through the current window to filters; move a future window then Replay and verify current-time following resumes; search with surrounding whitespace and verify trimmed results and exact empty copy.

## General search timing and focus precision

Each edit cancels prior browse work, clears sections/results immediately, trims the query and resets a one-shot **650ms** delay. Blank status is `Find your next favorite.`; nonblank initial status is `Searching…`. During incoming results show `Searching…  {n} results`, then `{n} results` once settled, or `No results. Try another title.` when empty. Any request failure appends `  Some sources couldn't load.`

Keep at most 24 unique item IDs per source-labelled section; deduplication is within a section, not across different sources. Bound catalog discovery to 128 and source requests to three concurrent. The live request uses limit 80 and is included unless scope is movies or series. Preserve incoming-result focus by the combined section name and item ID. Enter/Play or Right from the keyboard attempts to move to results; with none, focus stays on the keyboard. Left from the first result returns to the keyboard.

Acceptance: blank the query during an outstanding search and verify late results cannot repopulate it; edit again before 650ms and verify the previous delay is replaced; focus a result while another source returns and verify the same section/item remains selected; test Enter/Play/Right both before and after any results exist; verify a partial source failure retains successful results and adds the failure suffix.

## Server-owned queue and next-episode eligibility

The queue is profile-scoped and excludes live progress. Group history by media type plus title identity and use only the latest activity row per title. Hide suppressed queue titles. A row requires positive progress or an explicit progress correction. Movies leave Continue Watching when marked watched, or when known-duration progress reaches **95%**. Unknown-duration movies remain eligible. Series remain eligible so completion can lead to another episode.

For a series, set pending continuation when `duration > 10` and `position >= duration - 10`, **or** when explicitly marked watched. A duration of exactly ten seconds does not satisfy the automatic near-end rule. Only a matching continuation cache entry less than one hour old supplies a resolved queue state. A cached next episode replaces the displayed queue item but retains previous source hints, audio language, activity timestamp, queue title identity and the complete previous episode. Therefore its Manage Resume/Choose source actions still address the previous episode. Cached caught-up, upcoming and unavailable states remain distinct.

Next metadata must identify a strictly later season/episode in the same numbering scheme. No later episode means caught up; an unreleased date means upcoming; invalid or ambiguous metadata means unavailable. Never infer “next” by incrementing a title string or replaying the current episode.

Acceptance: verify a movie at 94.9% remains and at 95% disappears; unknown duration remains; mark a series episode watched before its final ten seconds and verify continuation eligibility; test durations below/equal/above ten seconds; expire the one-hour cache and verify stale next metadata is not presented as fresh; verify Next shows the next episode while Manage Resume opens the full prior episode at its saved position.

Precision source references: [guide geometry and input](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/EpgGrid.brs), [guide interval geometry](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/source/EpgPolicy.brs), [search behavior](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/SearchScene.brs), [backend queue and continuation](https://github.com/viptv-org/backend/blob/3f1b46b94573a3b3c31932b617146c54e2d1e568/server/src/continuation.rs).
