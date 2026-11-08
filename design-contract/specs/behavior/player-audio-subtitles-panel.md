# PLAY-TRACKS-001 — Player Audio & subtitles panel and inline subtitle settings

Status: **proposed**, owner request 2026-11-04
([app#647](https://github.com/viptv-org/app/issues/647)). Source revision is the
app branch `feat/647-subtitle-panel-redesign` targeting `edge`
(`features/player/PlaybackTrackPicker.kt`,
`features/player/PlaybackTrackChoice.kt`); it becomes baseline once the PR
merges and device evidence is recorded.

## Intent

The player's **Audio & subtitles** panel looked cramped. Labels wrapped onto two
or three tight lines, the selected row clipped at the bottom, row heights were
uneven, the check column did not line up between columns, and the Audio column
showed an empty-state block. This contract fixes those rows and puts the
profile's subtitle settings — the same ones the **Subtitles & audio** Settings
page edits — compactly inside the panel, so a viewer changes them without
leaving playback.

## Panel

One panel serves desktop and web (the same component), with a phone sheet and a
TV panel for the focus model ([playback parity](#platforms)). It opens from the
transport **Audio & subtitles** button and closes with the same rules as before:
the ×, Escape/Back (key up), or the scrim. Desktop keeps its pointer behaviour;
the popover is focusable and keyboard focus stays inside on web.

- **Header:** the panel title **Audio & subtitles** and the × (accessible
  **Close track selection**). The panel's pane is titled **Audio and
  subtitles**.
- **Audio:** when zero or one audio track is known the column collapses to one
  quiet line, **Default audio**. With two or more tracks it lists them by name,
  one line each; the selected one carries the check.
- **Subtitles:** **Off** as the first row, followed by one row per language.
  Provider sources that offer the same language are grouped into that single
  row: the primary line is the language in full words, the secondary line names
  the source or sources. A subtitle with no source part (for example an
  embedded **English (SDH)**) is its own row with no secondary line.
- **Inline settings:** the compact settings below the two columns edit the
  profile's subtitle preferences and apply immediately (see
  [apply](#apply)). They are **Show subtitles** (mode), **Language**,
  **Size** and **Background**.
- **Footer:** the **Subtitles & audio settings** link stays and opens the full
  page, unchanged.

## Track rows

Every subtitle row is a fixed height, never wraps, and never clips:

- The primary line is the language name in full words (**English**,
  **Croatian**); the secondary line is the source, quieter and smaller
  (**OpenSubtitles v3**). A single source shows it alone; several sources of
  one language join with ** · **.
- Both lines ellipsize at the end (`TextOverflow.Ellipsis`, one line each). A
  long name that would clip is cut with an ellipsis, never wrapped.
- The selection mark sits in a fixed-width slot at the start of the row, so the
  checks in the Subtitles and Settings columns share one vertical line.
- Selecting a grouped language selects the first source of that language;
  **Off** selects no subtitle. The existing selection note
  (PLAY-SUBTITLE-MODE-001 #3) still holds: a manual choice stops automatic
  choices for that playback.

## Inline settings

The panel edits the profile preferences the **Subtitles & audio** Settings page
owns (`subtitle_mode`, `preferred_subtitle_language`, `subtitle_font_scale`,
`subtitle_background_color`). Values and copy are shared:

| Setting | Values | Preference |
|---|---|---|
| **Show subtitles** | **Always** · **When audio isn’t [language]** · **Never** | `subtitle_mode` (+ `subtitles_enabled`) |
| **Language** | **Default** then the language list | `preferred_subtitle_language` |
| **Size** | **Small** (0.75) · **Medium** (1.0) · **Large** (1.25) | `subtitle_font_scale` |
| **Background** | **None** · **Box** | `subtitle_background_color` (`#00000000` / `#B3000000`) |

- **Size** and **Background** are segmented controls shown inline. **Show subtitles**
  and **Language** are radio rows whose value opens the same one-choice
  dialog the Settings page uses; choosing a value returns to the panel.
- **Extra large** (1.5) stays on the full page only, so the panel's Size stays
  three segments.
- A **shadow** (a text edge without a box) still has no shared preference field
  and no live path in any renderer, so the inline Background stays **None** /
  **Box**. The TV Settings page's **Shadow** option is unchanged and still
  writes a box colour.
- A **subtitle timing offset** is not offered: no renderer reports support for
  a live ±0.5 s cue delay. It is a future setting, not a gap to paper over.

### Apply

- **Size** re-scales the live captions at once (`PlayerCommand.SubtitleSize`)
  and saves `subtitle_font_scale`.
- **Background** restyles the live captions at once
  (`PlayerCommand.SubtitleBackground` on the renderers that honour it) and
  saves `subtitle_background_color`.
- **Show subtitles** and **Language** save immediately and the panel shows
  the saved value at once. They govern auto-selection, which runs when a track
  changes or the next playback opens; a track already chosen is
  left alone (the manual-choice rule).

## Geometry

Platform keys follow [components.md](../../viptv-design-system/components.md)
(P phone, D desktop app and web, T TV). Reference frames are desktop 1440 × 900
and 1280 × 800.

| Layout | Panel |
|---|---|
| D (desktop app, web) | Bottom-right popover above the transport bar: end inset 150, bottom inset 76, width up to 680, height up to 460. It stays inside the player at 1280 and 1440 wide. |
| P | Full-height end sheet, 0.82 × window wide, single-column stack (Audio, Subtitles, inline settings) |
| T | Bottom focus panel, existing geometry (1920 × 1080, 540 × scale tall): Audio, Subtitles and Subtitle size columns, unchanged |

On D the two track columns sit side by side above the inline settings; on P they
stack vertically so the grouped two-line rows have room on a 390-wide screen.

## Platforms

- **P (phone):** the end sheet keeps the pointer model (tap to choose, swipe/×
  to dismiss). Inline settings stack at the bottom of the sheet.
- **D (desktop app, web):** one component; tab focus and Escape behave as on the
  web Details dialog (focus stays inside, Escape closes only the panel).
- **T (TV):** the focus panel is unchanged in this revision — Up/Down walk the Audio, Subtitles and Subtitle size columns, and the size column keeps **Extra large**. The grouped tracks, the **Default audio** collapse and the other inline settings (mode, language, background) are available to TV through the panel's **Subtitles & audio settings** link to the full page, which already edits the same preferences.

## Copy

All strings live in [copy.md](../../viptv-design-system/copy.md#player-audio--subtitles-panel-play-tracks-001).

## Superseded

- The `W3PlayerAudio` canvas board draws the old panel: three narrow columns,
  single-line track names with no grouping, no inline settings, and no header.
  It stays exported until the canvas re-exports it.
- The existing D popover (520–560 wide, 300 tall, three columns) and the phone
  end sheet (0.56 wide) are replaced by the geometry above.

## Acceptance

1. **PLAY-TRACKS-01:** at 1440 × 900 and 1280 × 800 the panel is fully inside
   the player; no subtitle label wraps or clips (long names ellipsize), and
   every subtitle row has the same height with the check in the same column.
2. **PLAY-TRACKS-02:** two provider sources of English show as one **English**
   row whose secondary line names both sources; an **English (SDH)** embedded
   track stays its own row.
3. **PLAY-TRACKS-03:** one or no audio track shows **Default audio**; two audio
   tracks list their names.
4. **PLAY-TRACKS-04:** changing Size re-scales the live captions and persists
   `subtitle_font_scale`; changing Background restyles live captions and
   persists `subtitle_background_color`.
5. **PLAY-TRACKS-05:** changing **Show subtitles** or **Language** persists
   the preference and the panel reflects it at once; the value survives an app
   restart and a profile switch back.
6. **PLAY-TRACKS-06 (phone):** the end sheet lays Audio, Subtitles and the
   inline settings out vertically; choosing Size or Background updates captions
   live; the sheet closes with the ×, swipe, Back or a scrim tap.
7. **PLAY-TRACKS-07 (TV):** the focus panel keeps working unchanged; Up/Down reach Audio, Subtitles and Subtitle size, the size column retains **Extra large**, and the **Subtitles & audio settings** link opens the full page where mode, language and background are set.
8. **PLAY-TRACKS-08:** the **Subtitles & audio settings** link still opens the
   full page, and returning from it reopens the player without losing the
   changes the panel already saved.

## Unknowns

- No device evidence yet (web browsers, desktop app windows, phones, Android
  TV).
- The `W3PlayerAudio` board still shows the old panel until the canvas
  re-exports it.
- Whether any renderer can re-run auto-selection live for mode/language is
  per-renderer and not part of this baseline.