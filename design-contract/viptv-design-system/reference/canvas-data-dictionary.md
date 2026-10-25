# VIPTV — data dictionary (what the app can display)

Generic and provider-agnostic. Every screen in this package draws only these fields. Each section lists the boards that show it.

## A1. Title card

Used by Home rows, browse grids, search, lists and recommendations.

```
Card {
  title, subtitle?, description?
  poster (2:3)?, landscape (16:9)?, logo (transparent wordmark)?
  progress? 0..1              // draw a bar only when present
  badges[]                    // "Watched", "New episode", "Returning", "Ended"
  kind: movie | series | anime | live
  metadata {
    year?, runtime_minutes?, genres[], rating? (0–10, 1 decimal),
    rating_votes?, certification? (e.g. "TV-MA" → bordered chip), alternate_titles[]
  }
  identity.episode? { order, season?, episode }   // episode cards → "S1 E2"
}
```

How the boards draw it (`Tv3CardStates`, `D3CardStates`):

- **Missing values draw nothing.** There is no empty bar, no blank star and no dangling "·". Separators sit only between values that are present.
- **Meta line order:** year · runtime (`1h 48m`) · `★ 7.4`, then the certification as a bordered chip. Genres appear on the billboard and detail pages, not on cards. `rating_votes` appears only on detail pages.
- **No art:** a dark tile with the title and year, the same size as the art, so grids never shift.
- **Logo vs text:** if `logo` exists on a landscape card, it sits on the art and the text title is dropped. Otherwise the title goes under the art.
- **Badges:**
  - At most one text label on the art, in priority order New episode › Returning › Ended. Ended and Returning use the dark label.
  - Watched is a check in the corner, and the art is not dimmed.
  - Badges that don't fit move to the meta line.
- **Progress:** a bar only when `progress` is present (landscape cards).
- **Episode cards:** "S1 E2 · 52m" comes from `identity.episode`, and the series name is the subtitle.
- **Live:** a channel tile with the LIVE label; the current programme is the meta line.

## A2. Catalog rows and browse sources

```
HomeRow { id, title ("Continue watching" / "Popular"), state: READY|PENDING|EMPTY|FAILED,
          cards[], message? (FAILED text), next_cursor? (appends on scroll, never a Load-more button) }
Catalog { id, name ("Popular", "Top rated", "Watchlist"), type (movie|series|anime),
          connection_name? (provider display name for the picker) }
```

Row states are in `Tv3RowStates` and `D3RowStates`:

- **READY:** a normal row. With `next_cursor`, skeleton cards append as focus or scroll nears the end. There is never a Load more button.
- **PENDING:** the row title plus skeleton cards in the real card shape.
- **FAILED:** the row title plus one message card showing the server's `message` and a Try again button.
- **EMPTY:** not drawn at all. There is no title and no gap; the rows below move up.

The catalog picker groups catalogs by `connection_name` and shows only those matching the page's `type`. See `Tv3MoviesCatalogs`, `M3BrowseCatalogs`, `T3BrowseCatalogs` and `D3BrowseCatalogs`.

## A3. Facet filters (server-driven, any mix)

```
Control { id, label, kind: Text | SingleChoice | MultiChoice | Toggle | Number | Date,
          required, choices[] {value,label}, maximum_selections? (e.g. 3 of 20), min/max? }
Typical: Genre (multi), Sort (single), Decade (single), Rating (Any/7+/8+/9+), Keywords (text).
Applied filters show as chips.
```

How each `kind` renders:

| kind | Phone / tablet | Desktop / web rail | TV |
|---|---|---|---|
| MultiChoice | chips with checks, "2 of 3" | same, compact; at the limit other chips are disabled ("Limit reached") | full-screen options grid, "2 of 3" |
| SingleChoice ≤ 4 choices | segmented control | segmented control | option row |
| SingleChoice > 4 | chips | chips | option row |
| Text | text field with a clear button | search-style field | field + on-screen keyboard |
| Toggle | switch | switch | switch row |
| Number | − value + stepper, min/max shown | input + steppers | stepper |
| Date | date field | date field | date picker |

Other rules:

- A `required` control is labelled "Required" and its chip has no ×.
- Applied filters appear as removable chips with a "Clear all" link.
- The empty state offers to remove the newest filter first.

These are shown in `Tv3MoviesFilters`, `Tv3MoviesFilterText`, `M3BrowseFilters`, `T3Browse`, `D3Browse`, `W3Browse` and the matching Loading, Empty and Error boards.

## A4. Title detail

```
{ item: Card, episodes[]: Card (with S/E coords, progress, runtime), seasons[] {season, episode_count},
  recommendations[] ("More like this"), next_cursor? }
```

Shown in the existing title pages: `Tv3Title`, `Tv3Episodes`, `M3Title`, `D3Title`, `D3TitleUltra` and `W3TitlePage`.

## A5. Sources sheet rows

```
SourceCandidate { label, detail? (release/file info line), quality_height? (→ "1080p" chip),
  audio_languages[] (→ "EN"), presentation? { provider_name?, delivery_format? (hls|progressive),
  quality?, video_codec?, audio_codecs[], size_bytes? (→ "8.9 GB"), size_label? } }
```

The empty and torrent-only states are new:

- **No sources:** "No sources yet", with Check again and Manage add-ons.
- **Torrent links only:** the message "N providers returned torrent links this device cannot stream directly. Add a debrid service (for example TorBox)…". The unplayable rows are dimmed and tagged "Needs debrid".

Boards: `Tv3SourcesEmpty`, `Tv3SourcesTorrent`, `M3SourcesEmpty`, `M3SourcesTorrent`, `D3SourcesEmpty` and `D3SourcesTorrent`.

## A6. Source integrations (settings)

```
Integration { name ("VIPTV Sources" | "Xtream live TV" | "M3U live TV"),
              state: Ready | Needs configuration | Unavailable on this connection, configured }
Schema { name, credential_fields[] {id, label, required, secret(masked)},
         provider_choices[] {id,label}, maximum_providers (12; empty = default set) }
VIPTV Sources form: tmdb_api_key (secret) + provider multi-select (up to 12 of ~20)
Xtream form: server_url · username · password (secret)
M3U form: playlist_url (secret) · epg_url (optional, secret)
```

Values are write-only: they are never shown after saving, and they are per profile.

How the boards handle it:

- **List rows:** name, what it provides, state, a "Saved" chip with a summary when configured, and actions.
  - Configured: Replace and Remove.
  - Needs configuration: Configure.
  - Unavailable on this connection: dimmed, with the reason and no actions.
- **Forms by platform:**
  - TV: full screen, with an on-screen keyboard and D-pad provider rows. Save and Cancel only, no X; Back closes. A QR code lets you type long keys on a phone.
  - Phone: bottom sheet with a sticky Save.
  - Tablet: side sheet.
  - Desktop and web: dialog (Esc or X closes).
- **States:** unconfigured, configured, saving (button spinner, fields locked), error (inline field error plus "Nothing was saved") and unavailable. Remove asks for confirmation.

| Platform | Boards |
|---|---|
| TV | `Tv3SetSources`, `Tv3SourcesViptv`, `Tv3SourcesXtream`, `Tv3SourcesM3u`, `Tv3SourcesRemove` |
| Phone | `M3SetSources`, `M3SourcesViptv`, `M3SourcesXtream`, `M3SourcesM3u`, `M3SourcesRemove` |
| Tablet | `T3SetSources`, `T3SourcesViptv`, `T3SourcesXtream`, `T3SourcesM3u`, `T3SourcesRemove` |
| Desktop | `D3SetSources`, `D3SourcesViptv`, `D3SourcesXtream`, `D3SourcesM3u`, `D3SourcesRemove` |
| Web | `W3SetSources`, `W3SourcesViptv`, `W3SourcesXtream`, `W3SourcesM3u`, `W3SourcesRemove` |

## A7. Preferences

```
next_episode, skip_intros, source_selection ("Best match"/"Always ask"), max_quality_height?,
subtitles_enabled, audio/subtitle language?
```

Shown in the Playback and Subtitles & audio settings boards on each platform.

## Other screens added with this dictionary

- **Recovery codes:** `M3Recovery`, `D3Recovery`, `W3Recovery`.
- **Parental controls:** `Tv3SetParental`, `M3Parental`, `D3Parental`, `W3Parental`.
- **TV add-on by address, with the Install dialog:** `Tv3AddonEntry`, `Tv3AddonInstall`.
- **Display:** `Tv3SetDisplay`, `M3SetDisplay`.
- **About:** `Tv3SetAbout`, `M3About`, `D3SetAbout`.

## Sign-in

The methods are browser, email code, password, another device (QR or code), and no account. Xtream and M3U are **not** sign-in methods; they are Live TV source integrations in Settings.
