# Components

Each section gives the rules first, then sizes per platform, then the states that are drawn on the component sheets (`reference/components/CmpPhone1-3`, `CmpDesk1-3`, `CmpTv1-3`). The sheets come from the 2026-09-23 canvas export; the 2026-10-18 screen boards in `reference/screens/` are newer. When a board and a sheet disagree, the board wins; this file needs a follow-up pass against the new boards.

Platform keys: **P** = phone, **D** = desktop app and web, **T** = TV.

---

## 1. Buttons

**Rules**
- There is one accent **primary** per screen. TV has no accent buttons: the primary action wins by its position and by getting default focus.
- The **pill rule**: radius = height ÷ 2.
- Kinds: `primary` (accent fill, `on-accent` text), `secondary` (surface-3), `light` (off-white fill, `on-light` text), `outline` (transparent, 1 px 0.14 line, secondary text), `destructive` (surface-3 fill, danger text), `quiet` / text link.
- Weights: primary 700, others 600. All TV buttons are 700.
- Icons: P 20, D 18, T 28. The Play icon is a filled triangle.

| | P | D | T |
|---|---|---|---|
| Height | 54 (58 on title detail) | 48 | 72 (small pill 52) |
| Text | 17 primary / 16 | 16 | 26 |
| Side padding | 22 | 22 | 34 |
| Icon-only | 54 round | 48 round | 72 round |

**States**
- Hover (D only): secondary / destructive move to surface-4, the primary brightens 8%, light goes to pure white, outline / quiet get a 0.06 white wash.
- Pressed: scale 0.97. The primary darkens to 90%, secondary / destructive move to surface-2, light goes to `#DDDBD6`.
- Keyboard focus (D): `0 0 0 2px bg, 0 0 0 4px text-primary`. Never accent.
- TV focus: off-white fill, `on-light` text (destructive: `#B42318`), 4 px white ring and 0 24 60 shadow. Geometry stays fixed.
- TV unfocused: white at 0.12. TV pressed (OK held): `#DDDBD6`.
- Disabled: opacity 0.4.
- Loading: a spinner replaces the icon and the label reads "Saving…" / "Signing in…".

**Special buttons**
- **Split button (D):** Play plus a chevron that opens the source drawer. Each half hovers separately, and there is one focus ring around the pair.
- **TV source pill:** quality badge + provider name ("1080p LordStreams"). It opens the source panel.

---

## 2. Chips and segmented controls

**The single filter pattern (FILTER-CHIP-001).** The dropdown chip and the choice list it opens (§5) are the one way a page filters, on every platform and on every page that filters: Browse / Discover / Movies / Series / Anime, Live, Calendar, My List and the source picker. Status: implemented on phone, tablet, desktop and web in app#117 ([app#130](https://github.com/viptv-org/app/pull/130)) and on TV in app#121 ([app#148](https://github.com/viptv-org/app/pull/148), `90d6e47`). Live and Calendar use the shared row in app#172 (`6234c3eacf30f8c1c12de1c0daa1af1aeabeca6b`) and app#302 (`7731d46c9f268e8f29d33a6ecb2b844ab23b5e96`). The Live row reads "Group: All · Source: [feed] · Favourites"; Calendar reads "Type: All · Shows: Your shows · Previous week · This week · Next week · [week range]". Type offers All (default, TV, anime and movies together), TV, Anime and Movies. Shows defaults to Your shows (the profile's library, My List and Continue Watching) and offers All. When nothing from the viewer's list releases in the visible week, show every public release with "Nothing from your list this week — showing all releases." above the list; keep the chosen Shows value so either option remains reachable. The three week controls are action chips: Previous week and Next week move one week, This week returns to the current week, and the range label follows them. TV also composes the same row in place of its retired Catalog + Filters chips, applied-chip strip and "Show results" full-page surface: Browse reads "Catalog: Popular · Sort: Required · Genre: Any · Languages: Any · Free only · Search: Any", My List "List: My List · Type: All · Sort by: Last watched · Status: Any · Genre: Any" and the source picker "Quality: All · Source: All sources". Only the container the list opens in differs there (§8).

- **One bar, one row.** The top of the page holds one horizontal, scrolling row of dropdown chips, one per filter ("Genre: Any ⌄", "Sort: Popular ⌄"), 8 px apart. The catalog chip (or My List's list chip) comes first, then a group divider when facets follow, then one chip per facet. A **Clear** chip ends the row while any filter is set. On a browse or list page the row pins above the grid and scrolls sideways; a wheel over it scrolls the row, not the page.
- **A chip opens its list** (§5): the anchored popover on D and tablet, the bottom sheet on P (§8), the right panel on T. A list with more than 8 rows, "Any" included, adds a search field at its top; that field takes focus on pointer layouts only, so a phone sheet never raises the keyboard by itself. A multiple choice uses checkboxes, stays open and respects the provider's cap (`maximum_selections`); at the cap the unticked rows are disabled. A single choice ticks, reads "Current" and closes.
- **Picking applies immediately.** There is no "Filters" toggle, no second filter panel and no Apply or "Show results" button.
- **Every shape is the same chip.** A set of 2–3 options is the chip, never segments. An on/off filter is a chip that toggles, with a check while on. A text, number or date filter is a chip whose list holds one field and applies on Enter, or Done on a soft keyboard; a set value leaves an "Any" row that clears it.
- **Filled means changed.** A chip is filled (surface-3 with a 0.22 border and primary text) while its value differs from the page default, and unfilled (transparent, 0.10 border, secondary text) while it is at the default. A catalog or list chip always has a value, so it is never filled.
- **Clear resets the filters, not the page.** Browse keeps the chosen catalog and drops every facet; My List keeps its list and returns to the default query; the source picker clears Quality and Source; Live returns to Group: All, Source: [feed] and Favourites off; Calendar returns to Type: All and Shows: Your shows without changing the selected week.
- **Live and Calendar actions.** Live's Group and Source chips open their choice lists; Favourites toggles in place. Calendar's Type and Shows chips open their choice lists; each week action applies immediately and leaves focus on that action chip while the row remains visible. Returning from a release restores the same week, filters and focused release. Acceptance: All Type shows TV, anime and movie releases together; Your shows shows matching profile releases; an empty matching week shows all public releases and the fallback line while retaining Your shows; Shows switches between both values; Clear restores All + Your shows and keeps the week. Previous week, This week and Next week each load their indicated range, and return navigation restores the prior selection. Failed reloads retain the chosen range and filters beside the error line.
- **Applying reloads from the first item.** A failed reload keeps the bar, the chosen values and the rows already shown beside the page's error line. An empty result keeps the bar and offers the page's clear action ("Clear all filters" on Browse).
- **Return keeps the filters.** Coming back from a title or playback returns to the page with the same values, so the bar still shows them.
- **Closing returns to the chip** that opened the list. On P the ×, the scrim and Back close only the sheet; on D, Escape or a click outside close only the popover. On T the panel has no close button: Back, Escape, the scrim or a pick close it and the remote lands back on the chip that opened it, with the page and its applied values untouched.

This supersedes the segments-or-dropdown threshold of app#57 / app#59 (`useSelect`: more than 5 options, or labels over 30 characters), the applied-chip strip and the phone "Filters" toggle, the canvas dictionary §A3 table's segmented-control and removable-applied-chip rows and its whole TV column, and the `W3Browse` board's filter rail with its facet segments, toggles and segmented type chips. The reference files still document those retired forms until the canvas is re-exported. TV's retired filter surface is the last of them: `Tv3Movies` and `Tv3MoviesCatalogs` still draw the Catalog + Filters chips and the applied-chip strip, `Tv3MoviesFilters` and `Tv3MoviesFilterText` the full-page facet surface with "Show results", and `Tv3MyList` the type segments and Sort pill of the old My List header (the drawer that header opened had no board; it was self-designed, and app#121 deleted it).

**Chip geometry and states**
- **Filter chip:** unset = transparent with a 0.10 border and secondary text. Set = surface-3 with a 0.22 border and primary text. P 44 tall, D and tablet 40, T 56 × scale.
- **Clear chip:** an action, not a filter: no border, an × and the word in secondary text, in the row's own chip geometry.
- **Dropdown chip:** "Genre: Any ⌄". "Genre: " stays secondary; the value is secondary while it is the default or "Any" and primary once it is set. Pill radius, 14 sp (P) / 13 sp (D) semibold text, a 14 chevron, at most 280 wide with an over-long value ellipsized.
- **Required chip:** an unset required chip reads "Genre: Required" in its value slot and offers no "Any" row; app#130 draws no separate "Required" tag. An empty required filter shows the empty state "Choose the required filters to browse this catalog."
- **Catalog chip:** always reads "Catalog: [name]", for example "Catalog: Popular". A row carries its add-on name on the right when that differs from the catalog name, which tells apart two add-ons' "Popular".
- **Quality and source chips (source picker):** "Quality: All ⌄" and "Source: All sources ⌄". Each row carries its source count in tertiary text on the right ("1080p 5"), and the clearing row carries the total ("All 12").
- **Segmented control:** a surface-1 track with 4 px padding. The selected segment is an off-white fill with `on-light` text. P 44 (full width), D 40. It never filters: it only switches modes inside one control, such as the phone remote's Buttons / Swipe (§11).
- **Group divider:** a 1 px × 20 vertical hairline with 4 px either side, between the catalog or list chip and the facets.
- **Motion:** a chip's fill, border and text change over 120 ms (`motion.response`); the chip never moves or resizes, and its list opens with its container's motion (§8, [MOTION-001](../specs/behavior/motion.md#4-opening-and-closing-sheets-drawers-popovers-and-filter-chips)).
- **TV:** 56 × scale tall with 22 × scale text, 24 × scale start and 20 × scale end insets, a 22 × scale chevron and at most 420 × scale wide. A chip is a focus stop in the row: focused it takes the off-white focus fill with dark ink, "[Title]: " in `on-light` at 0.62, and the board's 4 px ring drawn outside it; a set but unfocused chip is surface-3 with the 0.22 border, the same as P and D. The row reserves the outside ring's room so scrolling never clips it at either end. The "Clear" action chip is a focus stop too, with no border and no fill until it is focused.

---

## 3. Badges and indicators

- **Quality badge:** "1080p", "4K", "SD". 4 px radius (D) or 8 px (T), with a 0.16 white fill.
- **LIVE:** red `#FF5A4E` is used only here. It appears as a glass badge over art (a 6 px dot + "LIVE"), as a row label, and on TV as a solid red block. It marks only the programme that is on air: the Live preview draws it, with the progress bar and "[N] min left", while `now` is inside the programme, and reads "Starts at [time] · [N] min" before it and "Ended" after it (`copy.md` §Live, LIVE-PREVIEW-001).
- **UP NEXT** and **WATCHING:** uppercase eyebrow badges on episodes.
- **Android completed episode (proposed, AND-EPISODE-WATCHED-001):** a noninteractive check + `Watched` pill beside the episode-number caption on TV and wider phone layouts. On a narrow phone text column, wrap the full badge onto the next caption line when the complete episode number and badge cannot fit together; retain their reading order and never ellipsize the badge or episode number. Keep existing artwork and the 44 dp episode-options target. Use surface-3 ground and text-primary, accent check, pill radius, height 32 px on TV or 24 dp on phone, 8 px/dp horizontal padding and 4 px/dp icon gap. TV text is 18 px with a 20 px icon; phone text is 11 sp with a 14 dp icon. Render only the current profile's authoritative `watched=true`; no local completion percentage threshold. Completed cards omit the partial-progress bar; incomplete cards retain it. Preserve artwork, title, card geometry and remote focus behavior. Include `Watched` in the card's accessible content without another focus stop. Missing or failed progress has no completed badge; a false fact removes it. Lazy-card reuse and profile switching cannot retain another episode/profile's badge.
- **Best match:** an accent eyebrow on the first source row of the **Best matches** group (proposed, SRC-BEST-MATCH-001; previously specified as the first source row).
- **Progress:** P/D 4 px (3 px on small tiles), T 6 px. The track is white at 0.22 and the fill is accent.
- **Live dot:** 8 px, or 12 px on TV.
- **Carousel dots:** the active dot is an 18 × 6 pill, the others are 6 × 6.
- **Spinner:** 12 (P/D) or 18 (T). The track is `#45454B` and the arc is accent. The one exception is the pull-to-refresh indicator (§9, REFRESH-PULL-001).
- **Buffering ring:** 48, centred over the video.
- **Key hints:** D uses `kbd` keycaps. T uses a legend: bottom-right, keycaps with a 2 px 0.28 outline and radius 10, for example "OK Select · BACK Close".
- **Status words (TV player):** PLAYING / PAUSED / BUFFERING / LOADING, 20/700 with +0.1em tracking.

---

## 4. Inputs

- **Text field:** surface-1 with a hairline border. P 54 tall with radius 16, D 48 with radius 12, T 80 with radius 20 (0.07 fill). Focus raises the border to 1.5 px at 0.22 and shows an accent caret. D also adds the keyboard ring. Error = a 1.5 px danger border plus an inline error line (an alert icon and danger text).
- **Password:** masked, with a show / hide eye button.
- **PIN:** 4–8 boxes (the drawn example has 6). Filled boxes show a dot, the active box shows the accent caret, and errors turn the boxes' borders danger. Error copy: "Incorrect PIN. Try again." / "Enter a 4–8 digit parent PIN".
- **URL field:** monospace value. Errors: "Enter an HTTPS manifest URL." / "That does not look like an addon URL." / "This addon is already installed."
- **Search:** P is a pill field docked above the nav, with a fade behind it. D has a title-bar search (460 × 30, radius 9, "Search movies and series", a clear button once there is text, no shortcut hint) and a page search on web. T has a field with a caret plus the on-screen keyboard; native Android TV uses its device IME under AND-KEYBOARD-001.
- **TV text entry:** Android TV uses a native editable field and device IME with Done/Cancel (AND-KEYBOARD-001); the app renders no character or PIN key grid. Other TV platforms use the full-screen design: the field on the left, the keyboard on the right (a–z, 0–9, `: / . - _ @`, Aa, Space, Delete, Done, Cancel). Digits use the **PIN keypad** (1–9, ⌫, 0, Done, Cancel).
- **Android TV episode jump (proposed, AND-EPISODE-JUMP-001):** a compact `Episode #` chip ends the season strip above the lazy episode row, after every season badge; Right steps the seasons and then reaches the chip, and Down from any badge enters the episode row. It opens a native numeric-input dialog; a successful exact current-season match scrolls to and focuses the card. See [episode-number-jump.md](../specs/behavior/episode-number-jump.md) for input, error and Back rules. Roku and TV-web keep their existing episode controls.
- **Android TV horizontal media rows (proposed, AND-TV-ROW-EDGE-001):** Home, Search, library and Details episode card viewports extend to the right TV viewport edge, retaining each row's small content and focus padding. Row headings and other text keep the right safe inset. See [android-tv-media-rows.md](../specs/behavior/android-tv-media-rows.md) for geometry and focus bounds; this does not alter TV-web's 1824 px final-card bound.
- **Toggle:** 52 × 32 (T 72 × 42). On = accent track. Off = surface-3 (T 0.2 white). Disabled = 0.4 opacity.

---

## 5. Selection and settings rows

- **Choice list:** the list a filter chip opens (§2). The current value shows a check and "Current". Unavailable options read "· unavailable" in tertiary text and cannot be selected. A multiple choice ticks checkboxes and disables the unticked rows once the cap is reached. More than 8 rows adds a search field that filters as you type ("Search genre") and reports "No matches for [text]" when nothing matches. On TV the same rows are the right panel's focus stops: focus opens on the current option (scrolled into view), the D-pad walks the rows, Up reaches the search field past 8 rows, and OK or Enter picks. A single choice reads "Current" and closes the panel; a multiple choice stays open and keeps the remote in the panel. Each row keeps its radio (single) or checkbox (multiple) role, and the panel's title is its heading.
- **Radio rows:** used for settings choices such as Subtitle size (Small / System default / Large).
- **Settings group:** a surface-1 card with rows split by hairlines. Each row is icon + title (+ note) + value + chevron. Values never wrap. Rows that hold a toggle have no chevron.
- **Destructive row:** danger text, for example "Sign out" or "Remove addon".
- **Section nav (D settings):** a left list with uppercase group labels (Profile, Playback, This device, Account). The current item has a surface-2 fill. The rows inside each group, and the Profile and Account pages they open, are [ACCT-SPLIT-001](../specs/behavior/account-and-profile-settings.md).
- **Phone Settings page title:** the Settings root and every sub-page (Playback, Subtitles & audio, Add-ons, Watch on TV, Profile, Account and the information pages) share one header row — the 44 back control at the leading edge and a centred 17/700 page title — never a large left-aligned heading.
- **Settings groups and their labels:** every layout shows the same four groups in that order. Phone and tablet put each group in a card (radius 14 on phone, 16 on tablet) with a label above it; desktop and web put the labels in the rail (12/700, +0.06em, uppercase, `text.tertiary`, 8/12 padded on desktop, 12/16 on web); phone uses 11/700, +0.08em, `text.tertiary`, 8 above its card and 2 below the previous one, and tablet 11/700, +0.08em, 12/16 padded with 12 above and 16 below the group. Labels are headings for assistive technology, never focus stops. No board draws them; the type is the eyebrow role and the spacing follows each board's group gap.
- **Settings rows:** icon + title + note + value + chevron, values never wrap, and a switch row has no chevron. A disabled row keeps its label and carries the reason as its note ("Manage this from a signed-in phone, computer or the web dashboard."); a row a platform does not implement is absent, never disabled.
- **TV settings rows** are 80 tall with radius 22. The focused row is off-white. A description panel on the right explains the focused row.

---

## 6. Cards and tiles

| Card | P | D | T |
|---|---|---|---|
| Poster | 3-column grid, 2:3 (111 × 167 at 390 wide), radius 16, proposed | 172 × 258 (web 164 × 246), radius 14 | grid 360 × 202 still; My List: 2:3 poster 200 × 300, 7 columns (Home My List shelf 160 × 240), proposed |
| Continue watching | 292 × 96 (thumb + text + play disc) | still 256 × 128 + caption | still 320 × 180 + caption |
| Episode | row | 272 × 150 + number, title, 2-line synopsis | 360 × 200 |
| Live | live-now card 200 wide | live tile 220 × 124 with a text monogram | guide blocks |
| Source row | quality badge + provider + file line + ▶ | same, in the drawer | same, in the panel (focused = off-white) |
| Profile tile | rounded square, radius 20% | same | same, focused = ring without scale |

- **Caught-up Continue Watching card (`copy.md`):** the card keeps the episode the profile finished and names the one it waits for. A caught-up card (a series episode, watched, with no progress bar and no caption of its own) draws **`S3 E4 · Watched`** under its title on P, D and web, then a second line **`S3 E5 · Nov 4`**, or **`S3 E5 coming soon`** while the next episode has no air date; with nothing announced it draws the first label alone. TV keeps its board's coordinate caption **`S3 E4`** and the corner check, and puts the awaited episode on the same meta line: **`S3 E4  S3 E5 · Nov 4`**. The caption box stays one meta line tall, so TV geometry is unchanged. A card the profile is still watching keeps its progress bar and its own caption. A caught-up card opens the show's Details, never the source picker for an episode already watched; Back returns to the card.
- **Details episode-row air date (proposed, EPISODE-AIR-DATE-001):** in the Details episode selector every episode row shows its release date under the episode caption — month, day and year in the device's locale. An episode with a future date, or with no date while later than the last released episode, is upcoming: the row shows **`Upcoming · Airs [month day]`** (or **`Upcoming`** with no date), mutes its title, drops the play affordance, and opening it explains **`This episode isn't out yet.`** instead of fetching sources. The row height is the same whether or not a date exists, and a no-date row that is not upcoming shows no date line. Player episode pickers are unchanged.
- **Details hero title without logo art:** a title with no transparent logo sets its name in text where the logo would sit: phone 28/34 bold, tablet 30/36, desktop 44/48, web 30–32/36–38, `text.primary`. The name wraps at its column and the title area grows to every line it takes — metadata, buttons and the rest of the page move down with it, and no header caps the name at a set number of lines or cuts a glyph. The TV hero's title region is pinned by its board (800 × 134 × scale for a series, 190 for a film, bottom-aligned at 250 × scale), so a name that needs more than the two complete lines that fit ends with an ellipsis on the last complete line.
- **Title Starring line:** in the phone and TV detail hero, a muted **`Starring [names]`** line sits directly under the description and lists up to three top-billed cast names, comma-separated in billing order; it is omitted when the title has no cast. Phone: 14 sp on a 21 sp line height, secondary text, one line with a trailing ellipsis. TV: 22 × scale sp on a 30 × scale line height, secondary text, at the hero's 96 × scale left and 586 × scale top coordinate, 800 × scale wide.
- **TV My List posters (proposed, TV-MYLIST-POSTER-001):** My List stores only each title's portrait poster, so TV My List cards show it in a 2:3 frame instead of cropping it to a 16:9 still: 200 × 300 in a 7-column grid on the My List segment, 160 × 240 on the Home My List shelf. Continue Watching and every other TV card keep their landscape shape. See [tv-my-list-posters.md](../specs/behavior/tv-my-list-posters.md) for geometry, scrolling, focus and acceptance.
- **Missing art:** a surface-2 block with a film icon and the title set in display type. Never stretch a small image to fill.
- **Source description window (proposed, SRC-OVERFLOW-001):** Every source row, for every provider and on phone, desktop/web and TV, reserves exactly two visible text lines for the file/description beneath its quality and provider facts. Wrap at the row's available width, including long unbroken filenames, hashes or URLs; clip overflow within that fixed two-line window. Increase the row's fixed height where needed so the title/badges, two full description line heights, padding and focus ring fit without overlap; all rows in a given picker use that same height, including blank and one-line descriptions and the Best match row. If the full wrapped description exceeds two lines, only the focused TV/keyboard row or hovered pointer row moves its text *upward inside the stationary two-line viewport*, revealing the final lines below. Start at the top, dwell 1.5 seconds, traverse at approximately one text line per 1.5 seconds, dwell 1.5 seconds at the bottom, then reset to the top and repeat while active. Stop and reset immediately on blur, pointer exit, row replacement or filter change. Touch rows do not animate without focus. Motion never changes row height, focus order or list position. With reduced motion enabled, leave the first two lines static. The full description remains available to assistive technology and Source details, without placing raw source URLs or secrets in logs.
- **Source groups (proposed, SRC-BEST-MATCH-001):** In every source-selection mode the source list opens with a **Best matches** group, the top-ranked rows (at most five) that pass the hard filters, followed by **All sources**, every other row in ranking order with hard-filtered rows last. Membership is computed before the provider and quality filters, which then hide rows in either group. Each group has a non-focusable uppercase group-label header, exposed as a heading to assistive technology; a header shows only while its group has a visible row, and both hide when Best matches has none. Rows are ranked and grouped as they arrive, never shown in arrival order and reshuffled at the end; re-ranking keeps TV/keyboard focus on the same source and the touch/pointer scroll anchor in place once the viewer has navigated. Header geometry needs a board. See [source-best-match.md](../specs/behavior/source-best-match.md#source-groups-best-matches-and-all-sources).
- **Source discovery status (proposed, SRC-OVERFLOW-001):** Keep the existing accent spinner visible beside **Finding sources** while the picker is open and discovery is pending with no rows. Once at least one row arrives, show the same spinner beside **Still checking sources** until the actual in-flight discovery finishes or is cancelled. The status occupies a stable place above the list, is not focusable and does not displace or disable arriving rows. On completion remove the spinner/status; if no sources arrived, use the existing empty state. Announce state changes politely to assistive technology without repeatedly announcing each animation frame.
- **Producer outcomes (proposed, SRC-PROVIDERS-001):** The Provider choice includes each distinct account-owned producer observed in this discovery, including producers reporting zero playable sources or a safe failure. Identify installed add-ons by their stable configured add-on ID and display their configured name; never group on upstream branding or source title. A producer with no row is still selectable and its filtered view explains its observed outcome. While discovery is pending, say **Still checking [provider]** when no final outcome is known; after completion, say **No playable sources from [provider]** for a zero-result producer. For the safe `source_format_unsupported` outcome, say **[provider] returned formats this app cannot play. Choose another source.** The revised format copy and opt-in torrent acquisition/delivery rules are proposed by [SRC-TORRENT-GATEWAY-001](../specs/behavior/torrent-gateway-sources.md); review and immutable adoption remain pending. Other safe producer failures use their server-projected message without exposing raw source data. A producer with playable rows keeps those rows usable even if another producer fails. Preserve the selected provider and focused source identity as events arrive; a disappearing account-owned producer must not leave a stale selectable filter. Do not show fabricated percentages, pending counts, torrent/magnet playback promises, or an automatic replacement source. The global discovery spinner follows the actual in-flight job, and Back cancels it.
- **Channel logos** are always text monograms (CNN, CNBC, abc) in display type.
- **Phone title source-summary row (AND-043):** on the phone title page a full-width 58 dp row under the primary Play/Resume action summarizes the exact Play/Resume target's sources and keeps its 58 dp height in every state. It is one tap target with the accessible name **Choose source**; activating it opens the source picker and never starts playback. With a best source it draws an outlined quality badge (17 dp tall, 1 dp border at 0.5 alpha, 4 dp radius, bold 10 sp text) reading the best source's quality, or **Auto** when it has none, then **`[provider] · [N sources]`** (**`1 source`** singular) in 13 sp / 18 sp secondary text and a trailing 16 dp chevron in tertiary. Before a source arrives it shows the chevron beside two layout-matching skeleton blocks (38 × 17 dp badge and 142 × 14 dp text). A settled discovery with no rows reads **No sources found**; a failed or timed-out discovery with no rows reads **Sources unavailable**. Both stay actionable and open a fresh picker attempt. A failure after partial rows keeps those rows and their summary. Only safe display facts are exposed — no stream URLs, headers or tokens — and a title that issues no discovery (a series without an available episode, a live channel) keeps the skeleton. See [AND-043](../docs/platforms/ANDROID_DESIGN.md#and-043--title-source-summary-and-episode-watching-marker-2026-10-02).
- **Hover (D):** art dims to 0.38, an accent play disc appears, and an inset 2 px off-white ring is drawn (inset, so the card's clipping never cuts it). The scrim, ring and disc fade in and out over 120 ms (`motion.response`); the card does not scale, lift or move.
- **Press (P, tablet, D):** the art frame scales to 0.98 (`motion.pressed-scale-card`) under the press and returns on release; the caption and the card's slot in the grid never move. A press that becomes a scroll returns the scale and does not activate.
- **Focus (D):** the keyboard ring outside the tile. **Focus (T):** a 4 px white ring without scale; the caption brightens.
- **Touch overflow (P):** a ⋯ button (44 target) on posters and continue cards opens the title menu. Long-press does the same.
- **Profile tiles:** a lock badge on PIN-protected profiles. "Add profile" shows as a dashed tile and is disabled at 12 profiles.
- **Avatar tiles:** the selected tile shows a check badge. Worlds are shown as chips, one grid page at a time (P 15, D and T 18) with Previous / Next.

---

## 7. Navigation

- **Phone bottom nav:** a floating glass bar (`rgba(32,32,35,0.94)`, 20 px blur), 64 tall, 28 px above the edge, 16 px side insets. Tabs are Home, Live, Calendar, My List (Discover is reached from the Home pills, not the bar). The current tab is an off-white pill with dark text. Search is a separate 64 round button. It appears on tab screens only, with a 150 px fade behind it. Scrolling the page down slides the bar out of view (translate down plus fade, about 200 ms); scrolling back up about 48 dp, or reaching the top, slides it back in. The bottom clearance is list content padding (80 dp while the bar is shown, 0 dp while hidden) and animates with the bar so nothing jumps; the list's bottom fade turns off while the bar is hidden. The last row still scrolls clear of the bar when it is visible, and the bar stays on pages that don't scroll, while a sheet or dialog is open, and when the content is shorter than the screen.
- **Phone headers:** a wordmark + avatar (Home), a screen title, back + sub-page title, or a glass back button over art.
- **Phone browse header (Home, Movies, Series, Anime, Discover):** a 44 dp wordmark/avatar row. On the pill scopes (Home, Movies, Series, Anime) the All / Movies / Series / Anime pills sit directly beneath it at the same spot on every scope. The page title sits 8 dp below the pills (a Discover page with no pills sits the title below the wordmark instead). The wordmark row and the pills stay pinned while the page scrolls; the page title collapses — its height shrinks and it fades, about 200 ms — as soon as the list scrolls, and returns at the top with no jump. Home has no separate title (the wordmark names it).
- **Back control (P, tablet, D and web):** a page or sub-page back is always the `Lucide.ChevronLeft` icon, plus an optional label, in a fixed top-left header slot — never a bare text "Back" button. P and tablet: 24 icon in a 44×44 hit target. D and web: 20 icon in a 44-tall hit target, with a 14/600 label when one is shown. The chevron glyph's left edge aligns with the page content edge (P/tablet 16 dp gutter); the hit target extends outward so the glyph never sits inset. The same control, size and slot appear on a page and on every page it opens.
- **Desktop title bar (Tauri):** 40 tall + hairline. It holds the wordmark, Back / Forward, a centred 460 search, and window controls. It is hidden in the fullscreen player. It has a pairing variant for sign-in (no search).
- **Rail (D):** 84 wide. Items are 64 × 58 with radius 14: Home, Discover, Live, My List (web adds Search). The bottom holds Settings and the avatar. The current item has a surface-2 fill.
- **TV rail:** 144 wide, icons only. Focusing it expands a 520 labelled menu over a 0.55 scrim, with the profile on top, then Search, Home, Discover, Live TV, My List, and Settings at the bottom. The Settings menu carries the four group labels (18/700, +0.08em, uppercase, `text.tertiary`, 24 × scale above a group's first row and 8 × scale below its last) and holds **Profile**, **Switch profile**, Playback, Subtitles & audio, Display, About, Account, Add-ons, Source integrations, Parental controls ([ACCT-SPLIT-001](../specs/behavior/account-and-profile-settings.md)).

---

## 8. Overlays

| | P | D | T |
|---|---|---|---|
| Container | Bottom sheet, auto height, radius 28 top, grabber | Centred dialog 460 (radius 18, padding 24); right drawer 460 (source drawer: min(720, 55 % of the window), never under 460, SRC-DRAWER-001); anchored popover | Right panel 820, padding 64 / 96 / 120 / 64 |
| Scrim | 0.62 black | 0.55, body row only (title bar and rail stay bright) | 0.6 |
| Actions | Stacked full width, 54 tall | Stacked 48 tall | Rows 80 tall |
| Close | Grabber, or tap the scrim | × disc top-right, Esc | BACK |

- **Motion:** on P, tablet and D a sheet rises its own height over 300 ms (`motion.panel`), a drawer travels its own width in from its edge over the same 300 ms, and a dialog or popover fades in from 0.98 scale over 200 ms (`motion.arrive`). Every exit takes 200 ms (`motion.leave`) with `motion.easing-exit`. The scrim fades with its container; the page behind it never moves. A pick applies in the frame it is made and focus is set at the start of an exit, so nothing waits on the motion. Durations, reduced motion and the per-container table are in [MOTION-001](../specs/behavior/motion.md#4-opening-and-closing-sheets-drawers-popovers-and-filter-chips).
- A destructive action uses danger text on surface-3. Cancel stays neutral and gets default focus on D and T.
- **Source drawer (proposed, SRC-DRAWER-001):** on desktop and web the source drawer is min(720, 55 % of the window) wide, never under 460 (a window under 640 gets the phone sheet). Other D drawers and the tablet source drawer stay 460. On web, a drawer opened from the Details dialog opens over it behind the 0.55 scrim, and closing it returns to the unchanged dialog. No layout shows a hint about how Play picks a source; TV keeps its status line only while add-ons answer or a stream opens. Geometry, focus, Escape, scrim, return paths, acceptance and the superseded `D3Sources`, `D3SourcesEmpty`, `D3SourcesTorrent`, `CmpDesk3`, `M3Sources`, `Tv3Sources` and `Tv3SourcesLoading` boards are in [source-drawer.md](../specs/behavior/source-drawer.md).
- A **popover** belongs to one control (a menu for a card, a filter chip's list, the catalog, the genre, the provider or the engine) and has no scrim.
- **Filter chip list (FILTER-CHIP-001):** the same list in the containers above: the anchored popover on D and tablet, a bottom sheet on P holding up to 80 % of the screen with 48 tall rows, the chip title as a heading and a × close, and the right panel on T — 760 × scale wide over the 0.6 scrim, narrower than the 820 overlay panel, with the chip's title as its heading at 44 × scale, 56 × scale side and 72 × scale top padding, and 72 × scale rows 10 × scale apart. On P nothing raises the keyboard until the viewer types; the ×, the scrim and Back close only the sheet. On T focus opens on the current option, a pick applies at once (a single choice closes the panel, a multiple stays open), and Back, Escape, the scrim or a pick close only the panel and return the remote to its chip.
- **TV full-screen text panel:** long text (More info, Source details) scrolls inside an opaque surface-1 box with a scroll bar and the legend "▲▼ Scroll".
- **Updating screen (proposed, AND-APP-UPDATE-001):** a full-screen opaque cover, not an overlay on a page, while Android writes, confirms and installs an update. It covers the update prompt too. One centred column: V mark, title, what is happening, a progress bar with a percent, the restart line and, on the permission step only, a primary action and **Later**. Phone: 32 inset, column max 420, 16 gaps. TV: 120 × scale side inset, 120 × scale mark, 320 × 80 primary. Copy, states, focus, Back, failure, timing and acceptance are in [app-updates.md](../specs/behavior/app-updates.md#updating-screen); no board exists yet (app `docs/DESIGN_GAPS.md` GAP-065).
- The **title menu** (⋯ / right-click / long-press / TV hold OK) holds: Resume previous episode, Choose source, Mark watched, Watch from the beginning, Remove from Continue Watching, Add to My List, Cancel.

---

## 9. Feedback

- **Toast:** P sits above the nav (bottom 116), D sits bottom-centre 24 from the edge, T sits top-centre. Surface-3, radius 20. Notices last 5 s with text only. Errors last 4 s and carry Dismiss (a startup error carries "Try again"). A removal carries **Undo** for 8 s: the action is a text button at the end of the copy's line, Undo puts the title back where it was and dismisses the notice, and the same notice answers every trigger of the removal. One notice shows at a time; a newer one replaces the old one and its timer. A toast never takes focus by itself: on T, Up from the page's topmost control reaches its action and Down returns to the page, as the backend banner's Dismiss does. Maximum width is 358 (P) or 560 (D).
- **Player notice pill:** 4 s, for example "The stream could not seek there."
- **Preparing playback:** a pill on P/D ("Preparing playback…") and a centred panel with a spinner on T.
- **Backend banner:** "Can't reach the backend", the explanation and "Backend unreachable since [time]". The explanation's [n] is the client's own next retry in seconds, so the banner never promises a wait the client is not keeping. It has Dismiss and clears itself when the backend answers.
- **Inline error:** an alert icon + danger text under the field.
- **Status line:** a spinner + tertiary text, for example "Still checking 2 addons".
- **Empty state:** a 52 round icon, a title and one line of help, sometimes with one action (for example "Browse Discover").
- **Loading more:** a spinner + "Loading more titles…" / "Loading more channels… [120] of [860]" at the end of a list. There are never Load more buttons.
- **Skeletons:** these have the real layout's shapes (featured card, posters, continue cards, list rows) and appear on P and D. TV has no skeletons: it shows a "Starting VIPTV…" cover at launch, then real content.
- **Pull-to-refresh (proposed, REFRESH-PULL-001):** phone and tablet layouts only, on Home, My List, History and Details. Pulling down at the very top of the page past the threshold shows the Material 3 indicator (a 40 disc in `color.surface.2` with a `color.text.secondary` spinner, top centre) over the shown content and reloads the page at once. There is no cover, skeleton or text, and a failure keeps the shown data with no error. D and T have no gesture. Gesture, reload scope, failure, return and acceptance are in [pull-to-refresh.md](../specs/behavior/pull-to-refresh.md); its motion stays the library's, and a finished reload re-animates nothing ([MOTION-001](../specs/behavior/motion.md#7-pull-to-refresh)).
- **Updated to [version] (proposed, AND-APP-UPDATE-001):** after Android installs an update and reopens the app, a semibold bar at the bottom centre (radius 12, `color.surface.2`, 20 × 12 padding, 16 from the edges) for six seconds. It has no action and never blocks the page. TV currently draws the phone's density sizes instead of scaling them, so the board has to set the TV size; the copy and timing are in [app-updates.md](../specs/behavior/app-updates.md#updating-screen).

**Instant feedback.** No action may show nothing for more than about 100 ms (app `ApplicationController.run` clears `busy` only when the operation settles, and several writes now ship on the explicit Save button, so the rule applies to every handler that waits on the network, the player or storage). Every action answers in the frame it is made:

1. **A pressed state, always.**
2. **An optimistic change where the result is predictable** — a selection, a toggle, a chip pick, a slide or segment value, a My List add, a track or source choice — applied to the state immediately, before the network, the player or storage answers. The optimistic value draws in the frame of the press and reverts only on a real failure.
3. **Otherwise a pending indicator on the exact element acted on** — a spinner replacing the icon or label ("Saving…" / "Signing in…", §1 button state), a progress ring over a card, a thin bar inside the row or sheet — never a spinner somewhere else, and never a global busy alone.
4. **De-duplicate repeat taps:** a second press on an action already in flight is ignored, not re-sent, and every pending element stays cancellable where cancelling is safe.
5. **On failure, revert and offer Retry in place:** put the element back to its previous state (or the known-good snapshot), show an inline error on that element or surface, and let the same element retry.
6. **One shared mechanism per action.** Every surface that can trigger the same action reads one pending state keyed by the action's identity, so the pending indicator, the de-duplication and the revert are written once and shared by every trigger of that action.

---

## 10. Player controls

| | P (portrait) | D | T |
|---|---|---|---|
| Layout | Header (back, title, S·E), video, timeline, transport row, tools row | Overlay: header top-left, timeline, left group (−10, play, +30, next) and right group (audio, subs, volume, info, fullscreen) | Status top-right, NOW PLAYING + title, timeline, controls row, legend |
| Play / Pause | 54 accent disc | 52 accent disc | 72 pill (focused = off-white) |
| Other buttons | 44 transparent | 44 transparent | 72 round, white at 0.12 |
| Volume | Hidden | Slider (disabled when the engine cannot set it) | None |
| Track popups | Full-height end sheet (0.82 × window) | Bottom-right popover above the transport bar, up to 680 wide × 460 tall | Right panel (scrolling list) |

- **Timeline:** accent played fill, a lighter buffered segment, and a white knob. The time labels are `[12:48]` / `[52:10]`. Hovering (D) or seeking (T) shows a preview bubble above the bar.
- **Showing and hiding (P, tablet, D):** the whole control layer fades in over 200 ms (`motion.arrive`) and out over 200 ms (`motion.leave`) as one layer; nothing slides or scales, and the video frame never dims, zooms or letterboxes. The 5 s idle timer and the paused, buffering, failed and open-panel rules are unchanged, and a key or a tap starts the fade in that frame. Reduced motion switches it in one frame. TV keeps its own 200 ms fade in and 300 ms fade out. [MOTION-001](../specs/behavior/motion.md#8-player-controls-showing-and-hiding).
- **Up Next (end panel, PLAY-NEXT-AUTOPLAY-001):** when a series episode ends, a panel over the last frame. TV: a right-hand column with "Next episode", the episode, its facts and description, **Play next episode** and **Keep watching credits**, and a footnote. Phone, desktop and web: a bottom strip with a 128×72 still, "Up next", the episode and runtime, **Watch credits** and **Next episode**. With **Autoplay next episode** on, the primary action reads "Next episode in [N]" for 10 s inside a ring that empties (number only with reduced motion), then plays. Any viewer action cancels it. Geometry and copy are in [next-episode-autoplay.md](../specs/behavior/next-episode-autoplay.md#panel-layout-and-copy); the earlier "Starts in [8]" card with Play now / Cancel is retired.
- **Playback info:** key / value rows in monospace (decoder, transport, container, delivery, codecs, resolution).
- **Responsive picture mode:** the 44 px Fit/Fill button is immediately before Fullscreen on phone and desktop. Fit (the default) contains the full picture; Fill covers the viewport with centered crop. Its state and transitions are in [WEB-PLAYER-FIT-001](../specs/behavior/responsive-player-fit-fill.md). Existing static player renders predate this control.
- **Audio & subtitles panel (PLAY-TRACKS-001):** the popover lists audio as a collapsed **Default audio** line (zero or one track) or names, subtitles grouped by language with the source as a quieter secondary line, and inline settings — **Show subtitles**, **Language**, **Size** (Small / Medium / Large) and **Background** (None / Box) — that save to the profile and apply live where the player reports it. Geometry, grouping and apply rules are in [player-audio-subtitles-panel.md](../specs/behavior/player-audio-subtitles-panel.md).
- **Errors:** one page on every platform, from the same state: **"This source stopped working"**, the source's failure (`[Source] didn’t respond. Choose another source.`, adding `to continue from [time]` when playback had a position above 0), then **Try [next source]** / **Choose another source** / **Back**. Phone and tablet keep the title and the back chevron in the header; desktop and web put **Back** in the row. There is no Details disclosure. "Playback could not be restored" appears on resume.
- **Live:** no timeline or next. It shows the channel name, "Live TV" and the live dot, and audio / exit only on TV.


## 11. TV remote (phone, Watch on TV) — Android phone and tablet

**Status:** shipping for the KMP app on Android phone and tablet
([AND-038](../docs/platforms/ANDROID_DESIGN.md#and-038--android-phone-and-tablet-vizio-remote-2026-11-02)),
superseding the earlier exclusion. The **Watch on TV** settings row ships on app
`main` at `09fef5c7` (app#486, [app#512](https://github.com/viptv-org/app/pull/512)):
`SettingsRow.WatchOnTv` in the This device group, gated by
`watchOnTvAvailable()` to non-television Android UI modes (phone and tablet),
reading **Off** until a TV is paired and then the persisted TV name, with
**Use this phone as a Vizio TV remote** as its note. The setup flow ships on app
`main` at `04599d57` (app#487, [app#520](https://github.com/viptv-org/app/pull/520)).
The remote surface — the 44 dp header button, the one-time tip and the
bottom-sheet remote — ships on app `edge` at `cc3684a0` (app#488,
[app#536](https://github.com/viptv-org/app/pull/536)), not yet promoted to
`main`, and is phone-only today: the header button lives in the compact phone
header, so a tablet can pair a TV but has no header entry point to open the
sheet. TV, iOS, desktop and web do not adopt it, so the desktop title bar's
cast and remote buttons have no caller and draw nowhere. A TV signs in with
**Settings › Account › Add a device**, which approves the code the TV shows;
that page is the pairing story, not this one. Still proposed: the full **Watch
on TV** settings page (a TV card with **Open the remote**, the Remote-button /
Vibrate / Keep-screen-on toggles, **Change TV** and **Forget this TV**), the
error and permission lifecycle (app#489), and the browser **Watch on TV**
dialog (`PhCastUnavailable`). The rules below describe the remote that ships
and name the parts that remain proposed.

**Rules**
- Off by default. The **Watch on TV** row reads **Off** until a TV is paired,
  then the persisted TV name, with **Use this phone as a Vizio TV remote** as
  its note. It opens the **Watch on TV** page — the setup flow while no TV is
  paired, and a status card (name, value, note) once one is, with no **Open the
  remote** action or toggles yet. The opt-in and the chosen TV (name and
  `https://` origin) persist device-locally, never to a server or profile.
  Nothing else changes for people who never set it up.
- Setup is a pushed page flow, not a dialog: intro → choose your TV (bounded
  search) → manual IPv4 → PIN → connected. The intro says what the remote does
  and does NOT do (nothing playing on the phone moves to the TV) before
  discovery starts, and reads "VIPTV searches your local network only to find
  your TV." The search is bounded (16 results, 30 s) and adds candidates as
  they arrive; a failed search offers manual entry. The manual step takes a
  private IPv4 address (optionally `:7345` or `:9000`) canonicalized to `https`.
  The PIN page pairs as soon as the 4th digit goes in. Android SDK 36 requires
  no runtime local-network prompt.
- **Remote button (phone):** once a TV is paired, a 44 round button (surface-1,
  remote icon 20) sits in the phone header of Discover, Live and My List, next
  to the avatar (Home keeps its headerless hero). Its label is "TV remote:
  [TV name]". It never goes in the bottom nav. The first time it appears, a
  one-time tip (a 260-wide off-white bubble with `on-light` text) reads
  **Your TV remote** / "It stays up here on Discover, Live and My List. Turn it
  off in Settings › Watch on TV." with **Got it**; dismissing it persists. The
  tablet has no header button, so it cannot open the sheet yet.
- **The remote** is a phone bottom sheet (radius 30 top, `Palette.surface`,
  scrim 0.62, navigation-bar padding, scrolls):
  - Header: a 44 TV tile (radius 12, raised) + the TV name (17/700) + a status
    line (**Connected · [host:port]** while online, the host alone while it is
    still checking, **Not reachable** with a wifi-off icon while offline) + a
    44 close button.
  - **Open VIPTV on TV**: the accent primary, full width, 54 tall, shown while
    the TV is reachable or being checked; while offline it is replaced by the
    offline card.
  - A Buttons / Swipe segmented control (232 wide, 40 tall).
  - Buttons mode: a 272 round pad (raised, hairline) with 88 arrow targets and
    a 104 off-white OK. Swipe mode: a 358 × 272 touchpad (raised, radius 28,
    "Swipe to move · Tap for OK"), narrower on small screens; a swipe past
    32 dp sends one direction, a tap sends OK.
  - Bottom row: Back, Play, Pause (64 round, `surface-3`, labels 12/600 in
    `text-tertiary`), and two 64 round volume keys (− / +) under a **Volume**
    caption. Commands serialize into an eight-command bounded queue and are
    dropped beyond it, with no replay on return.
- Vibrate on every key press and keep the screen on while the sheet is open.
  Both ship always-on on the phone remote; settings toggles for them are still
  proposed (see the settings bullet).
- **TV not reachable:** the Open button is replaced by a raised card
  ("Can't reach [TV name]", "Turn the TV on and check it's on the same Wi-Fi as
  this phone.", a **Try again** text button), and every control drops to
  opacity 0.4. Only transport, HTTP-status and authentication failures take the
  TV offline; a single rejected command does not.
- **Pairing PIN:** 4 boxes 64 × 72 (radius 18). It pairs automatically when the
  4th digit goes in, so there's no confirm button. **New PIN** starts a fresh
  challenge and **Cancel** leaves it. The page shows no certificate fingerprint:
  the app pins the TV's certificate on first pairing, and the TV displays
  nothing to compare a fingerprint with, so the four-digit PIN is the only
  pairing proof.
- **Watch on TV settings (still proposed):** a TV card (name, status, "Open the
  remote"), then Remote (Remote button, Vibrate on press, Keep screen on) and
  TV (Change TV; Forget this TV, danger). Forgetting the TV turns the feature
  off and removes the button. None of this ships yet: the Watch on TV page is
  the setup flow or the status card only.
- Phone **browsers** can't pair: web, desktop, iOS and TV simply have no row,
  and the proposed `PhCastUnavailable` dialog that points to the desktop app
  does not ship.

**Screens (boards only; no layout draws them):** PhTvSetup, PhTvSearch, PhTvNoAccess, PhTvManual, PhTvPin, PhTvDone, PhHomeRemote, PhRemote, PhRemoteSwipe, PhRemoteOffline, PhTvSettings, PhTvForget.

## 12. Motion

Pointer and touch layouts (P, tablet, D) animate; TV keeps the motion it already has, and nothing here is added to it. [MOTION-001](../specs/behavior/motion.md) owns the platforms, reduced motion and acceptance scenarios; this section is the component view.

| Token | Value | Used for |
|---|---|---|
| `motion.response` | 120 ms | What the pointer's own movement causes: hover fills, press scales, a chip filling, a carousel dot resizing |
| `motion.arrive` | 200 ms | Content arriving in place: a list item, a hero slide, a page crossfade, a popover or dialog, player controls |
| `motion.leave` | 200 ms | Everything leaving, at every size |
| `motion.panel` | 300 ms | A sheet or a drawer entering from its own edge |
| `motion.stagger-step` | 30 ms | Between two list items entering in one row, eight items at most |
| `motion.easing-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Everything arriving, every state change |
| `motion.easing-exit` | `cubic-bezier(0.3, 0, 1, 1)` | Surfaces leaving |

| Component | Motion |
|---|---|
| Page area | Crossfade: the outgoing page out over 120 ms while the incoming page comes in over 200 ms. The nav, header, title bar and rail stay still; a page under an overlay, the player, startup and sign-in do not fade. |
| Bottom nav pill, rail item | Fill changes over 120 ms; the pill does not slide between tabs |
| Card | Hover scrim, ring and disc fade over 120 ms; press scales the art frame to 0.98 |
| Button, row, player control | Press scales to 0.97, 0.99 and 0.94; the press returns on release |
| Hero carousel | Art, logo, text and actions crossfade over 200 ms with no travel; the active dot grows into its pill over 120 ms; the hero's footprint never changes |
| Continue Watching preview (D) | Hero crossfades to the preview and back over 200 ms; the carousel pauses and resumes where it paused |
| Sheet, drawer | Container travels its own height or width over 300 ms; the scrim fades over 200 ms; every exit takes 200 ms |
| Dialog, popover, chip list | Fade from 0.98 scale over 200 ms; exit fades out over 200 ms without travel |
| List item | Fade over 200 ms plus an 8 dp rise, 30 ms apart, eight per row; only on a page's first load. A refresh and paging never animate, and a skeleton crossfades in place |
| Player controls | The whole layer fades in and out over 200 ms; the video frame never moves or dims |
| Pull indicator | The library's own drag, settle and return; the one motion VIPTV does not re-time |

Every duration and easing above is read through the app's `motionSpec()`, which snaps under reduce motion: the change happens in the same frame as its state change. Progress bars, spinners, the hero rotation and the Up Next countdown number keep running. No motion delays an action, and no item adds copy.

## 13. Empty states and artwork

**Rules**

- An empty state says what the page is, why it is empty, and the one action that
  fixes it. It is a page, not a dialog: no scrim, no centred card, no
  illustration inside a frame.
- A first-run empty state may carry full-bleed artwork (Live's is a
  photograph); every other empty state is text on the page ground, next to the
  filters it belongs to. A page never draws two empty states at once.
- The artwork sits behind the page area only — under the navigation, the
  phone header, the rail and the title bar, which keep their own grounds. It is
  `cover`-anchored centre, a `bg` scrim is drawn in code over it, and it is
  decorative: no accessible name, because the heading, body and actions carry
  the meaning. The scrim is not part of the image.
- Filter chips are not drawn on a page with nothing to filter. An empty state
  caused by a filter keeps the row, because the row is the way out.
- One primary action per empty state, plus at most one secondary. Loading is a
  skeleton in the page's own row shape, never a "Loading…" line, and never an
  empty state while a request is open.
- An action the signed-in account may not take is replaced by one line naming
  who can take it. The line takes the action's place, so nothing else moves.

**States**

| State | Artwork | Filters | Actions |
|---|---|---|---|
| Live, no source (T, P, W) | `live-empty-wide` / `-tall` crops of one stadium photograph, full bleed | none | primary and secondary for the owner and local mode; a who line for a member or a paired TV |
| Live, source, no channels | none | Source chip while a second source exists | the retry, and Source integrations when the viewer may change sources |
| Live, source, still loading | none | as above | none; skeleton rows |
| Live, first request failed | none | none: no page names a source | the retry, and Source integrations when the viewer may change sources |
| My List, Discover, Search, Continue Watching | none | per [FILTER-CHIP-001](#2-chips-and-segmented-controls) | the page's own clear or browse action |

**Geometry** (the block's stack, gaps and copy are
[LIVE-EMPTY-001](../specs/behavior/live-empty-state.md))

| | Block | Headline | Body | Primary |
|---|---|---|---|---|
| T | x 96, width 840, centred in the page area | D 56/700, line 64 | 26/400, line 38 | 72 tall, radius 36, 26/700, off-white |
| W | x 40 (the Live page's own inset), width ≤ 620, centred | D 40/700, line 46 | 16/400, line 24 | 48 tall, radius 24, 16/700, accent |
| P | below the photo band, x 16, width 358, clear of the bottom bar's 80 dp box | D 34/700, line 40 | 15/400, line 22 | 54 tall, radius 27, full width, accent |

**Artwork**

One photograph in `assets/photography/`, inventoried in `assets/FILES.json` and
described in `assets/ASSET_MANIFEST.md`: the Volksparkstadion roof, its blue-lit
truss and the floodlit stands, by Mario Klassen under CC0 1.0, as a 1920 × 1080
wide crop for W and T and a 1080 × 1440 tall crop for P. A page draws the crop
once, `cover` and centre-anchored, then a `bg` gradient in code — wide
left-to-right 92 / 60 % at 45 % / 18 %, tall top-to-bottom 0 / 35 % at 40 % /
90 %, phone band 0 / 30 % at 45 % / 86 % at 80 % / 100 % — so the copy and
actions sit on the darkest part. Decorative: no accessible name.
[LIVE-EMPTY-001](../specs/behavior/live-empty-state.md#artwork) owns the crops,
the exact bytes, the source, the licence and the credit.

## 14. Text over artwork

**Rules**

- Copy drawn over a title's or a channel's artwork keeps 4.5:1 against the
  brightest pixel behind it, and a flat white frame is the test.
- The page draws the scrim in code, in one of the stops below, and it is the
  ground at that opacity: `bg`, the OLED black, or, for the web Details hero,
  the browser dialog's own surface (`#181818`). A surface never invents its own
  stops; the app reads them from `Scrim` (`theme/Scrims.kt`).
- The stop under copy is opaque enough for `text.secondary` and `text.tertiary`
  as well as `text.primary` and `text.body`, because a hero draws all four.
- The scrim is not part of the artwork and adds no copy, motion or focus stop.

**Stops** (fraction of the surface, then the ground's opacity)

| Surface | Stops |
|---|---|
| TV hero, wide | 95, 90 at 46 %, 55 at 62 %, clear |
| TV hero, tall | 30, clear at 45 %, 90 at 80 %, ground |
| TV top navigation band | 94, 82 at 72 %, clear |
| Phone hero | clear to 45 %, 84 at 72 %, 98 |
| Tablet hero | 93, 84 at 50 %, clear at 72 %; and clear to 50 %, 84 at 76 %, 98 |
| Desktop Home backdrop | 30, 78 at 55 %, ground |
| TV Details, wide | 95, 92 at 46 %, 55 at 60 %, clear at 80 % |
| TV Details, lower band | clear, 95 at 60 % of the 480 px band that starts at y 600, ground |
| Phone Details artwork | 55, clear at 30 %, clear at 55 %, ground |
| Tablet Details pane | 30, clear at 30 %, 95 at 70 % |
| Desktop Details | 88, 92 at 50 %, ground |
| Web Details hero | clear to 30 %, 55 at 52 %, 86 at 70 %, the dialog's own surface |

`TextOverArtworkContrastTest` in `viptv-org/app` renders every Home hero, every
Details layout and the TV top bar over flat white artwork, samples the brightest
background around every drawn line and fails the ones under 4.5:1.

## Implemented component contracts (2026-10-19)

- **TV focus**: `TvFocusTreatment.kt` — `tvFocusOutline` (content), `tvFocusColumn`
  clamping (settings pages), `tvCardFocusOutline` (inset card ring). The outline
  must be applied *before* `graphicsLayer`/`clip`, otherwise it is clipped away.
- **TV card**: one accessibility node per card; focus only restarts the ring,
  play badge and caption colour; state labels/progress/cert come from `Card`
  fields per the canvas dictionary §A1.
- **TV shelf**: `1` card peeks on the leading edge and `2` on the trailing edge;
  scrolling is driven from `LazyListState.layoutInfo`, never a shadow index.
- **TV settings page**: sidebar 560 wide with the 72 px double-ring row, content
  column at x=640, rows 1184×96 radius 14; Up/Down clamp inside the content
  column, Left returns to the sidebar.
- **TV browse**: `BrowseFilterBar` above a 7-across grid at 1920 with
  232×348 cards, 16/36 spacing, 96 inset, appending pages. `TvBrowseChrome`,
  the `TvLibrary*` filter files and `TvSourcesFilters` are deleted, so no TV
  page has a filter surface of its own.
- **Filter bar**: `FilterBar.kt` draws the one scrolling chip row (8 dp gaps, the
  group divider, a trailing "Clear" action chip) and picks the list container —
  the bottom sheet on a phone-width touch layout, the right panel on a TV, the
  popover everywhere else. `SearchableSelect.kt` is the chip and its list, and
  `QueryControlFilter` maps a provider control to a single, multiple, toggle or
  text chip. `BrowseFilterBar.kt`, `LibraryFilterBar.kt` /
  `LibraryControls.kt`, `SourceFilters.kt`, `LiveFilters.kt` and
  `CalendarControls.kt` build it for Browse, My List, the source picker, Live
  and Calendar. Live has no separate filter surface: `TvLiveFilters.kt` and
  `LiveSourceSelector.kt` are deleted. `FilterPatternScanTest` keeps retired
  filter surfaces from coming back and asserts the shared bars are composed;
  `TvFilterBarTest` walks the remote through the row and the panel. The TV row
  is a focus group, so a closing panel or Clear lands the remote back on a chip,
  and it reserves the outside ring's room so the scrolling edge never clips it;
  `LocalTvScale` (`TvFocusScroll.kt`) scales shared chips and the panel to the TV viewport.
- **Phone browse**: 3 cards across, cards fill their cell; the single filter bar
  only exists when the server supplied browsable controls.
- **Desktop browse**: 6 columns at ≥1200 dp, 4 below; cards fill their cell
  (`minmax(0,1fr)`), never a fixed width.
- **Desktop window**: one painted surface under the rounded frame so a host
  without a compositor cannot show an opaque black block.
