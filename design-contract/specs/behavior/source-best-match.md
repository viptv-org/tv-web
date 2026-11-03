# SRC-BEST-MATCH-001 — Best match source autoplay, ranking and fallback

Status: **partly implemented**. Shipped in app `62e0c949`, backend `e1ec02d`
and core `985a23f`: the ranking order and hard filters below without the
decode-class and series-memory keys, the Best matches and All sources groups
with their headers and the Best match marker, progressive ranking, and the
immediate start of the best match
([app#336](https://github.com/viptv-org/app/issues/336)). Also shipped: the
[fallback](#fallback) with its notices in app `805b7c0f`
([app#411](https://github.com/viptv-org/app/issues/411)), the [remembered
source](#remembered-source) in app `5e4ebbc7`
([app#419](https://github.com/viptv-org/app/issues/419), on the app's `edge`
branch) and the [controlled next
episode](next-episode-autoplay.md#how-the-next-episode-starts) with its
last-three-minutes preparation in app `f19e0dc6` and `9e236f52`
([app#417](https://github.com/viptv-org/app/issues/417),
[app#420](https://github.com/viptv-org/app/issues/420)). Proposed, not
implemented: decode-class ranking, series memory and device capability
reporting ([core#32](https://github.com/viptv-org/core/issues/32)). No device
evidence is recorded for the shipped parts.

Source revisions: design `05c6078`; app `62e0c949`, `805b7c0f`, `f19e0dc6`,
`9e236f52` and `5e4ebbc7`; backend `e1ec02d`; core `985a23f`. Prior art and
citations: [workspace research
note](https://github.com/viptv-org/workspace/blob/main/docs/research/source-autoplay.md).

Owner decisions: the best match starts as soon as it meets every preference and
at the end of discovery otherwise
([app#336](https://github.com/viptv-org/app/issues/336)); one audio preference
for every title type (no anime override); automatic fallback to the next source,
at most three attempts; WEB and BluRay releases preferred; HDR/Dolby Vision
preference exists but is off by default; the source list sorts by the preference
ranking into a named batch (see [Source
groups](#source-groups-best-matches-and-all-sources)).

## Intent

A profile whose **Default source** is **Best match** presses Play and gets the
source it would most likely have chosen itself: playable on this device, in the
audio it asked for, from a good release, without waiting for the slowest
provider. On **Always ask** ordinary Play opens the picker and nothing starts,
except for a title with a [remembered source](#remembered-source) and for the
[controlled next episode](next-episode-autoplay.md#how-the-next-episode-starts).
In both modes ranking orders the list, groups it under **Best matches** and
**All sources**, and marks the first Best matches row **Best match** (see
[Source groups](#source-groups-best-matches-and-all-sources)).

## Entry and exit

Entry: Play/Resume-with-new-source, an episode activation, or a next-episode
activation. The Sources picker opens and discovery streams rows into it. A
title with a remembered source, and the controlled next episode, reach that
discovery themselves (see below and
[PLAY-NEXT-AUTOPLAY-001](next-episode-autoplay.md#how-the-next-episode-starts)).

Exits: playback of the row that started, activated by the viewer or
automatically; cancellation, which leaves the viewer on the populated picker
with focus where the cancelling action put it; Back, which behaves exactly as
Back on the picker does; or an exhausted fallback, which leaves the viewer on
the picker with the failed rows annotated.

Exact-source Resume (same source as last time) keeps its own narrowly defined
path and never starts automatically. Two starts do: the [remembered
source](#remembered-source) and the [controlled next
episode](next-episode-autoplay.md#how-the-next-episode-starts).

## Start

1. On **Best match**, and on the remembered-source start, discovery streams
   rows into the picker and every ranking request ranks the rows received so
   far (see [Progressive ranking](#progressive-ranking)). Rows failing a hard
   filter never become the target.
2. The target is the first Best matches row, the same row that carries the Best
   match marker (`best_match_id`). Every rule below starts that row.
3. The target starts as soon as a ranking reports that it fully meets every
   preference (below). The picker closes and playback opens on that source,
   exactly as if the viewer had activated the row. A row that arrives later
   neither replaces it nor interrupts playback.
4. Without such a ranking the target starts when discovery ends, that is when
   the last provider has answered. When the provider ceiling ends discovery
   instead, the picker keeps the rows that arrived and nothing starts.
5. With no row passing the hard filters there is no target and nothing starts.
6. On **Always ask** nothing starts on its own, except a title with a
   [remembered source](#remembered-source) and the [controlled next
   episode](next-episode-autoplay.md#how-the-next-episode-starts).

A discovery starts at most one source. Group membership is computed before the
provider and quality filters, so a filter never changes the target.

### Fully meets every preference

The ranking reports `best_match_fully_matches` for the target when all four
hold:

| Preference | Met when |
|---|---|
| Quality | At the cap: the lower of the profile's **Preferred quality** and the device's display height, or whichever of the two is set. With no cap, any known height. |
| Audio | The row reports no audio languages, or one of them is the target language: the profile's **Preferred audio**, or the title's original language when none is preferred. With no target language, every row meets it. |
| HDR and Dolby Vision | **No preference**: always. **Prefer**: the row reports HDR or Dolby Vision. **Avoid**: it reports neither. |
| Delivery | Not a torrent: direct HTTP(S), including debrid, and a row whose transport is unknown. |

A lower release type or a resolution below the cap orders the row under another;
it does not withhold the start. The server ranks without the title's original
language, so with **Original language** every row meets the audio preference
there.

### What stops an automatic start

Any of these stops it, and nothing starts for the rest of that discovery:

- Choosing a source, closing the picker or leaving the screen; discovery is
  cancelled with it.
- A drag on the list, by touch or pointer.

These do not stop it: rows arriving and re-ranking, initial focus placement,
moving focus with the D-pad or arrow keys, wheel scrolling, pointer hover,
window focus changes, and changing the provider or quality filter.

## Remembered source

Shipped in app `5e4ebbc7` ([app#419](https://github.com/viptv-org/app/issues/419))
on both **Default source** values. It stores a choice; it does not rank. The
ranking order never reads it, and the proposed [series
memory](#order-each-key-breaks-ties-of-the-previous-one) stays a separate
[core#32](https://github.com/viptv-org/core/issues/32) item.

**Stored:** the add-on's `provider_id` and the source's audio languages, never
the source id or URL, because both expire and are resolved again from a fresh
discovery. One entry per profile and title, in the device's own store, at most
200 titles and 8 languages per title; it survives restarts and never leaves the
device. An episode is stored as its series, so every later episode inherits it;
a movie is stored as itself.

**Written** only by a source the viewer picked by hand that reached a presented
frame. A failed start, an undecodable start and an abandoned pick clear the
pending choice before any frame, so they never replace the last successful one.
An automatic start never writes it.

**Read** by Play of that title, including a resume from Continue Watching, and
by the successor start: Next, the TV Next pill, the end panel's primary action,
the countdown and the [next-episode preparation](next-episode-autoplay.md#preparation).
Discovery ranks the fresh rows as for any start and the viewer picks nothing.
The start is the first of:

1. a row from the remembered add-on carrying one of the remembered audio
   languages;
2. any row carrying one of those languages;
3. with no remembered language, a row from the remembered add-on;
4. nothing: the picker opens with the rows and nothing plays. A row in another
   audio language is never a substitute.

The remembered start is a Best match start, so its failures fall back over the
ranked rows and end on the picker with the `Didn’t start` labels.
**Choose source** always opens the picker, and so does any title without an
entry. Another profile never inherits one.

## Ranking

Rows are normalized once at ingestion (next section); ranking reads only the
structured fields, never display labels.

### Hard filters (autoplay and grouping)

These rows are never an autoplay or fallback target and never join the
**Best matches** group. In the list they remain visible and sort after every
other row:

- Camera, telesync, telecine, screener and R5 releases.
- 3D releases.
- Torrents reporting fewer than 5 seeders. Torrents with an unknown seeder
  count are not filtered.
- Decode class *unsupported* (device reports it cannot decode the video codec,
  profile or resolution). Proposed: no ranking reads decode class
  ([core#32](https://github.com/viptv-org/core/issues/32)).

### Order (each key breaks ties of the previous one)

The shipped order is this list without keys 1 and 4, which are proposed
([core#32](https://github.com/viptv-org/core/issues/32)).

1. **Decode class:** supported, unknown, risky. *Risky* is a Dolby Vision
   release without an HDR10/SDR base layer on a device without a Dolby Vision
   decoder, or a codec the device decodes only in software at this resolution.
2. **Language tier** (below).
3. **Quality cap class:** within cap, unknown height, over cap. With no profile
   cap the device's maximum decodable height is the cap.
4. **Series memory:** for an episode, a row from the same add-on binge group as
   the last successfully started episode of this series on this profile ranks
   first within its tier.
5. **Resolution:** highest first, within the cap.
6. **Release type:** WEB-DL and BluRay encodes; WEBRip; unknown; BluRay remux;
   HDTV, DVD and other rips. Remux sits below because its size makes starts
   slow; it is not filtered.
7. **HDR/Dolby Vision preference:** applies only if the profile changed it from
   **No preference**. *Prefer* ranks HDR10, HDR10+, HLG and decodable Dolby
   Vision first; *Avoid* ranks SDR first.
8. **Delivery:** direct HTTP(S) (including debrid) before torrents; among
   torrents, more seeders first.
9. Provider order, then arrival order (stable).

### Language tiers

The profile has one **Preferred audio** setting for every title type:
**Original language** or a specific language *L*. The title's original
language comes from its metadata (TMDB `original_language`); when it is
missing, **Original language** behaves as no language preference.

For requested language *L* (or the original language *O*):

| Tier | Release evidence |
|---|---|
| 1 | Audio languages explicitly include it. |
| 2 | Dual or multi audio whose listed languages do not include it, or list none (one track is usually the original). For a language other than *O*, also a **Dubbed** flag with no listed language. |
| 3 | No language evidence at all. When the requested language is *O* (chosen as **Original language** or named explicitly) this ties with tier 1, because most unmarked releases carry original audio. |
| 4 | Explicit languages without dual/multi audio that exclude it; for a requested *O*, also a **Dubbed** flag without dual/multi audio. Dual/multi audio always takes precedence over **Dubbed**, because PTT (and therefore Torrentio) marks every dual-audio release dubbed. |

Absence of a marker is never read as a specific language on its own; it is
original-language evidence only through the tier 3 rule. Some add-ons hide
English when it is the only language, and Torrentio removes Japanese from
anime language lines, which is why dual/multi audio never falls to tier 4.
Subtitle languages are never audio evidence.

After the source opens, the player selects the audio track in the preferred
language when the file has one (existing behaviour). If the file's actual
tracks contain no track in the requested language, show the notice
`This source has no [language] audio.` with **Next source** during a Best match
session, or with no action otherwise; playback continues
([app#411](https://github.com/viptv-org/app/issues/411)).

## Source groups: Best matches and All sources

Applies to every source-selection mode (Best match and Always ask) and every
surface (TV, phone, tablet, desktop, web).

Rationale: the ranking above already decides which sources the viewer would
most likely pick. Showing its top rows as a named group lets a viewer on
**Always ask**, or one who stopped an automatic start, choose from a short
trusted set without reading the whole list. Ranking while rows arrive, rather
than reshuffling everything when the last provider answers, keeps the list from
jumping under the viewer at the moment they are likely to act. Owner request
2026-10-26 ([design#20](https://github.com/viptv-org/design/issues/20)).

### Membership

Group membership is computed over every row of this discovery, before the
provider and quality filters. The shared ranking (backend and its `core` copy)
supplies it with the ranked rows: the Best match recommendation
(`best_match_id`) and the ids of the Best matches rows. Clients render what it
supplies and never infer membership or the marker from visible position
(consistent with [SRC-TORRENT-NATIVE-001](torrent-native-android.md) and the
[Roku KMP remote notes](../../docs/platforms/ROKU_KMP_REMOTE.md#source-best-match-presentation)).
The wire shape belongs to the implementation.

1. **Best matches:** the top-ranked rows that pass every
   [hard filter](#hard-filters-autoplay-and-grouping), at most **5**, in
   ranking order. Its first row carries the existing **Best match** marker
   (accent eyebrow).
2. **All sources:** every other row, in ranking order. Rows that pass the hard
   filters but rank below the fifth come first; hard-filtered rows come last,
   as the ranking already places them.

The provider and quality filters then hide rows in both groups without
changing membership. A row's group and the Best match marker therefore do not
depend on the filter: with a filter that hides the first Best matches row, no
visible row carries the marker. Fewer than five rows passing the hard filters
gives a shorter Best matches group; none gives an empty one.

After an exhausted Best match fallback, rows marked `Didn’t start`
keep their ranked positions and groups so the viewer sees what was tried; the
marker does not move.

### Headers

- A header labels each group: `Best matches` above the first group, `All
  sources` above the second (copy in `viptv-design-system/copy.md`).
- A header shows only while its group has at least one visible row. When
  Best matches has no visible row (empty, or every member filtered out) both
  headers hide and the list looks like a single ranked list. When All sources
  has no visible row only the Best matches header shows.
- Headers are part of the scrolling list, not sticky. They are uppercase group
  labels like the desktop settings Section nav, in the list's text column. Type
  size, colour, height and spacing come from the implementation; the canvas does
  not pin them (open items). Headers never change source row height
  (SRC-OVERFLOW-001).
- Headers are not focusable on TV or by keyboard and are not activatable by
  touch or pointer. Up/Down moves directly from the last visible Best matches
  row to the first visible All sources row and back. When focus moves to the
  first visible row of a group, the list scrolls so that group's header is
  visible too; at the top of the list the Best matches header is visible.
  Held Up/Down repeats exactly as in the list today, one row per repeat,
  skipping headers; a re-rank during a held press keeps focus on the same
  source (Progressive ranking, step 4) and the next repeat moves from there.
- Accessibility: each header is exposed as a heading (Android semantics
  `heading()`, web heading role), so screen reader heading navigation lands on
  it. Header changes are not announced on their
  own; the existing polite discovery status announcements are unchanged.

### Progressive ranking

1. Rows are ranked and grouped as they arrive. Every provider response is
   merged into the ranked list at the rows' ranked positions in one update; the
   list is never shown in arrival order and never reshuffled as a whole when
   discovery finishes.
2. An arrival can move rows between groups: a better row entering Best matches
   pushes its fifth row to the top of All sources. Rows can also move within a
   group.
3. **Initial placement:** until the viewer navigates in the list (any D-pad or
   arrow press, touch/wheel/keyboard scroll, or a filter change), focus on TV
   and keyboard surfaces stays on the first visible row, and phone, tablet and
   pointer lists stay scrolled to the top. A better row arriving there takes
   the first position, the marker and the initial focus. This is initial focus
   placement, so it does not stop the automatic start. If the picker opened with
   a selected row (the source currently playing or last chosen), initial focus
   goes to that row instead, as today, and stays on it while better rows
   arrive.
4. **After the viewer navigates (TV, desktop/web keyboard):** focus stays on
   the same source, identified by its stable row identity, never by index,
   while rows are inserted or moved around it and even when it changes group.
   The list scrolls so the focused row keeps its on-screen position where the
   list length allows; otherwise the minimal scroll keeps it fully visible.
5. **After the viewer scrolls (phone, tablet, pointer):** the scroll anchor is
   kept: the first fully visible row (the anchor) keeps its on-screen position
   while rows are inserted or moved above or below it, including when the
   anchor itself moves in rank. A touch in progress (drag or fling) is never
   interrupted.
6. **Selected row:** a row with Source details open and the selected row from
   step 3 keep their identity across re-ranking.
   Activating a row (OK, tap, click, Enter) always acts on the source under the
   press at that moment.
7. Row moves may use the platform's standard list item placement animation;
   with reduced motion they are instant. Moves never change row height.
8. The provider ceiling, filters, discovery status and empty states are
   unchanged. When the ranking request itself fails, rows stay in the order
   already shown, without headers or marker, late arrivals append in arrival
   order, and nothing starts automatically for this discovery (the picker
   behaves as on Always ask).

## Normalized source facts

The shared engine (backend and its `core` copy) derives these fields from the
add-on's declared fields first and the release name second (`filename`, then
title lines), using PTT-equivalent rules (research note, section 3), with
fixture tests drawn from real add-on responses:

| Field | Values |
|---|---|
| `release_type` | `web_dl`, `webrip`, `bluray`, `remux`, `hdtv`, `dvd`, `other_rip`, `cam`, `unknown` |
| `three_d` | boolean |
| `dynamic_range` | list of `dv`, `hdr10_plus`, `hdr10`, `hdr`, `hlg`; empty means unknown, not SDR |
| `dv_base_layer` (proposed) | `hdr10`, `sdr`, `none`, `unknown` |
| `audio_languages` | BCP-47 tags (existing field), audio evidence only |
| `audio_flags` | any of `dual`, `multi`, `dubbed` |
| `seeders` | integer or absent |
| `delivery` | `direct` or `torrent` (from the stream's transport, not text) |
| `binge_group` (proposed) | the add-on's `behaviorHints.bingeGroup`, add-on scoped |

Rules: `Dual Audio`, `Dual`, `Multi`, `Multi Audio`, `Tri Audio`, `Dubbed`,
`Dub`, `Dubs`, `Dublado` and Torrentio's `Dubbed`/`Dual Audio`/`Multi Audio`
markers set flags; `Multi Subs`, `VOSTFR`, `Subbed` and hardsub markers are
subtitle evidence only. Flag emoji map to languages as today. Seeders come from
a declared field or Torrentio's `👤 N` marker.

Source rows show the release type and audio flags beside the quality badge
(for example `WEB-DL`, `Dual audio`, `Dubbed`); badges that do not fit are
dropped. The two-line description window (SRC-OVERFLOW-001) is unchanged.

## Device capability

Proposed ([core#32](https://github.com/viptv-org/core/issues/32)): the client
sends its capabilities with every ranking request and the server never guesses
them. The request carries only the device's display height
(`device_max_height`) today. Android would derive the rest from
`MediaCodecList` and Media3 decoder queries plus the display's HDR types: per
codec (AVC, HEVC Main/Main10, AV1, VP9) maximum hardware-decodable height,
Dolby Vision decoder presence, display HDR types, and audio decode/passthrough
for AC-3, E-AC-3, TrueHD and DTS. Each answer is *supported*, *unsupported* or
*unknown*. Platforms without a reliable query report *unknown*. Emulators report
what their decoders report; emulator results are not device evidence.

## Fallback

Shipped in app `805b7c0f` ([app#411](https://github.com/viptv-org/app/issues/411)).
Only after an automatic start — a Best match start, the remembered source, the
prepared handoff or the successor start — never after a manual row activation;
every start failure shows the existing failure screen.

1. A start failure is: a player error before the first frame, the
   undecodable state (clock advances with no frame), or no first frame within
   the startup deadline (20 s for direct sources; for torrents, the native
   torrent runtime's own startup errors and deadlines).
2. On a start failure the player shows
   `[reason]. Trying the next best source…` with the next target's facts and a
   **Stop** button, for 2 s, then opens the next ranked row that survives hard
   filters and has not failed in this session. **Stop** shows the existing
   failure screen.
3. At most three attempts per session, counting the first. After the third
   failure, return to the picker with the banner
   `3 sources couldn’t start on this device. Choose a source.` and the label
   `Didn’t start` on each failed row. Focus goes to the first row that has not
   failed.
4. A Dolby Vision decode failure demotes every other risky Dolby Vision row for
   the rest of the session.
5. Mid-playback stalls never switch sources; the existing buffering and failure
   behaviour applies.

The existing failure screen keeps its **Try [next source]**, **Choose another
source** and **Back** actions for manual sessions and after **Stop**. Fallback
walks the ranked rows that survive hard filters, so it continues past the fifth
Best matches row into All sources.

## Settings

Playback preferences (profile scoped):

- **Default source:** Best match / Always ask. A manual pick also stores a
  [remembered source](#remembered-source) for that title on this device.
- **Preferred audio:** `Original language` or a language. Applies to every title
  type.
- **HDR and Dolby Vision:** No preference (default) / Prefer / Avoid.
- **Preferred quality:** Auto / 4K / 1080p / 720p. **Auto** means the device's
  own resolution: the client reports its display height snapped to
  2160/1440/1080/720/480 with every ranking request, and the cap is the lower of
  the profile choice and the device. The row shows `Auto (this device: 1080p)`
  when the height is known. A source closest to the device therefore ranks first
  and higher resolutions sort into the over-cap class.

No release-type setting: the order above is fixed.

## Timing summary

| Timer | Value |
|---|---|
| Start | The first ranking whose best match meets every preference, otherwise the last provider answer |
| Provider ceiling | 60 s; discovery ends there, the picker keeps the rows that arrived and nothing starts |
| Direct-source startup deadline | 20 s to first frame |
| Fallback notice | 2 s |
| Attempts | 3 per session |

The Best matches group size (at most 5 rows) is fixed the same way. Changing a
value needs a behaviour review. The last three timers belong to
[fallback](#fallback); the last-three-minutes preparation has its own timers in
[PLAY-NEXT-AUTOPLAY-001](next-episode-autoplay.md#preparation).

## Acceptance scenarios

1. Best match, **Preferred quality** 1080p: a direct provider returns a 4K
   WEB-DL and a 1080p WEB-DL. The 1080p row is the best match, carries the
   marker and starts at once; the 4K row is listed under `All sources`.
2. A second provider is still running when the first answer already ranks a
   1080p direct WEB-DL first, with **No preference** for HDR and no audio
   languages reported: that row starts immediately and the picker does not wait
   for the second provider.
3. The best match is a 1080p torrent with 40 seeders: it meets the quality and
   audio preferences but not delivery, so nothing starts while discovery runs;
   it starts when the last provider answers.
4. **HDR and Dolby Vision** set to **Prefer**: the best match is a 1080p direct
   WEB-DL with no HDR, so nothing starts while discovery runs. When a 1080p
   HDR10 direct row ranks first, that row starts immediately.
5. The viewer drags the list while discovery runs: nothing starts, neither when
   a fully matching row arrives nor when discovery ends. The picker stays with
   the rows, the headers and the marker.
6. Changing the provider or quality filter does not stop an automatic start.
7. Back during discovery closes the picker and nothing starts.
8. No ranking reports a best match that fully meets the preferences: the best
   match starts when the last provider answers. With only camera releases there
   is no best match and nothing starts.
9. Original-language preference on an anime episode with original language
   Japanese: an unmarked release ranks first, then Torrentio's
   `Dual Audio / 🇬🇧`, then a `Dubbed` release that lists only English. With
   English preference: `Dual Audio / 🇬🇧` and the English `Dubbed` release
   (tier 1) rank above an unlisted `Dual Audio` (tier 2), which ranks above the
   unmarked release (tier 3).
10. A Torrentio release with no language line on an English-original movie with
    English preference ties tier 1; the same release on a Japanese-original
    anime with English preference is tier 3.
11. The first target fails to decode: the fallback notice appears,
    the second target starts. Three failures return to the picker with the
    banner and `Didn’t start` labels; focus is on the first unfailed row.
12. A manually activated row that fails shows the existing failure screen and
    never auto-advances.
13. (proposed) Next episode of a series started from binge group G: a G row
    ranks first within its language tier and decode class.
14. Always ask, no remembered source, and no successor: nothing starts on its
    own; the list is grouped exactly as in Best match mode and the first Best
    matches row carries the Best match marker.
15. A file whose actual audio has no track in the preferred language
    shows the no-audio notice; playback continues.
16. Groups, either mode: discovery returns seven rows passing the hard filters
    and two camera releases. The list shows the `Best matches` header, the top
    five in ranking order with the marker on the first, then the `All sources`
    header, the sixth and seventh rows, then the two camera rows.
17. Three rows pass the hard filters and nothing else arrives: only the
    `Best matches` header shows, above all three rows.
18. Only camera releases arrive: no header shows and the rows are listed in
    ranking order without a marker; in Best match mode nothing plays
    (scenario 8).
19. A provider filter hides all five Best matches rows: both headers hide and
    the filter's rows show as one ranked list without a marker. Clearing the
    filter restores both headers and the marker on the same row as before.
20. Progressive ranking, TV, viewer has not navigated, on Always ask or with no
    best match meeting every preference yet: provider A returns three rows at
    1 s and they appear ranked under `Best matches` with focus on the first.
    Provider B returns a better row at 2 s: it appears first and takes the
    marker and the focus. At no point are rows shown in arrival order, and
    nothing reorders when the last provider finishes. On Best match the same
    rows start playback as soon as a best match meets every preference
    (scenario 2), so the list is only seen until then.
21. Progressive ranking, TV, viewer navigated: focus is on the fifth Best
    matches row when two better rows arrive. Focus stays on that same source,
    now the second All sources row, at the same on-screen position; Down moves
    to the row ranked below it; Up moves to the first All sources row, and Up
    again crosses the `All sources` header to the last Best matches row
    without stopping on the header.
22. Progressive ranking, phone: the viewer has scrolled so a mid-list row is
    the first fully visible row when rows arrive above it. That row stays at
    the same screen offset; the new rows are only seen by scrolling up. A
    viewer who has not scrolled sees the new best row at the top.
23. Screen reader on any surface: heading navigation lands on `Best matches`
    and `All sources`, each announced as a heading; on TV the D-pad never
    focuses a header.
24. Desktop/web pointer: Source details is open for a row when a re-rank moves
    it to All sources; the open details stay on that source, and closing them
    returns focus to the same row in its new position.
25. A manual pick of the English row from add-on A on episode 1 presents a
    frame, so the series is remembered as `addon:A` in English. Episode 2 plays
    with a fresh discovery that returns `addon:A` in English and `addon:B` in
    Japanese: `addon:A` starts with no picker. A later discovery returns
    only Japanese rows: the picker opens and nothing plays.
26. Remembered source on **Always ask**: Play from Home, Details, Continue
    Watching or the Calendar starts the remembered row with no picker. Next on
    the successor start does the same. **Choose source** still opens the picker.
27. Three failures of the remembered row walk the fresh rows and end on the
    picker with the `Didn’t start` labels; the stored choice is unchanged, and
    so it is after a single failed start.
28. Another profile, and an unrelated title, find no entry: the picker opens
    and nothing starts on its own.

## Open items

- Boards for the fallback notice and the failed-row label on every surface. The
  app ships them; the canvas does not pin them, like the group headers, the
  release/audio badges and the Best match marker.
- A prepared successor can hand off a source outside the remembered audio while
  the same next episode taken without a preparation opens the picker
  ([app#475](https://github.com/viptv-org/app/issues/475)).
- Series memory storage (proposed): server-side per profile and series, reset by
  a manual pick of a different source, or per device.
- Web and desktop capability reporting (proposed).
- Whether the playback gateway can remux/convert an undecodable source instead
  of ranking it down (not investigated).
