# VIPTV — design requests + real data dictionary (2026-10-18, v2)

For the design AI. Two parts: **(A) the actual data the app can display** —
generic, provider-agnostic field shapes; design every screen so these exact
fields plug in perfectly — and **(B) the screens that have no board yet**, plus
**(C) boards to delete**. Use the existing tokens, type roles, focus rules and
component vocabulary.

---

# A. The data dictionary (real fields, generic names)

## A1. Title card — used by home rows, browse grids, search, lists, recommendations

```
Card {
  title                 String          always present
  subtitle              String?         one line under the title (e.g. "52m · Watched", "S1 E2")
  description           String?         synopsis (long text, clamp to 2–3 lines in rows)
  poster                URL?            2:3 portrait artwork
  landscape             URL?            16:9 artwork
  logo                  URL?            transparent title wordmark (display instead of text when present)
  progress              0..1?           watch progress; null = not started. Only draw a bar when present
  badges                String[]        short chips: e.g. "Watched", "New episode", "Returning", "Ended"
  kind                  "movie" | "series" | "anime" | "live"
  metadata {
    year                Int?            e.g. 2026
    runtime_minutes     Int?            movies: 104; episodes: 52 (display "1h 44m" / "52m")
    genres              String[]        e.g. ["Biography","Crime","Drama"] (join with ", " or " · ")
    rating              0..10?          external rating, 1 decimal (display "IMDb 7.7" style or ★ 7.7)
    rating_votes        Int?
    certification       String?         e.g. "TV-MA" (chip, bordered)
    alternate_titles    String[]        (not for display in grids)
  }
  identity {
    id                  provider-specific id
    kind                same as kind
    ids                 [{ namespace: "imdb"|"tmdb"|"kitsu", value }]   (deep-link quality; not displayed)
    episode             { order: "aired", season: 1?, episode: 2 }      (present only on episode cards;
                                                                        display "S1 E2")
  }
}
```

Card grid/row geometry is already designed; **design only states that this data
can fill**: art present / art missing (title-initials fallback), progress bar,
0–3 badges, no metadata (year/genres can each be absent), logo vs text title.

## A2. Catalog rows and browse pages

```
HomeRow {              // one horizontal shelf
  id                   String
  title                String          shelf heading, e.g. "Continue watching", "Popular"
  state                "READY" | "PENDING" | "EMPTY" | "FAILED"
  cards                Card[]          (PENDING = skeleton cards; FAILED shows message + retry)
  message              String?         failure text for FAILED
  next_cursor          String?         more cards append on scroll (never a "Load more" button)
}

Catalog {              // a browse source the user can switch between
  id                   String
  name                 String          e.g. "Popular", "Top rated", "Trending", "Watchlist"
  type                 "movie" | "series" | "anime"
  connection_name      String?         the provider display name (shown on the picker)
}
```

## A3. Facet filters (server-driven; the UI must handle any mix of these)

```
Control {
  id                   String
  label                String          e.g. "Genre", "Sort by", "Decade", "Rating"
  kind                 "Text" | "SingleChoice" | "MultiChoice" | "Toggle" | "Number" | "Date"
  required             Bool
  choices              [{ value, label }]      for choice kinds (e.g. Genre: 20 items)
  maximum_selections   Int?            cap for MultiChoice (e.g. 3 of 20)
  minimum / maximum    number bounds   for Number kind
}
// Typical set on movie/series pages: Genre (multi), Sort (single:
// Popularity / Rating / Year / A–Z), Decade (single), Rating (single:
// Any / 7+ / 8+ / 9+), Keywords (text). Show applied filters as chips.
```

## A4. Title detail page (series/movie) — existing boards cover layout; data for completeness

```
Detail {
  item                 Card                    the title
  episodes             Card[]                  episode cards (have episode coordinates, progress, runtime)
  seasons              [{ season: 1?, episode_count: 10, offset }]
  recommendations      Card[]                  "More like this"
  next_cursor          String?                 episodes page on scroll
}
```

## A5. Sources sheet rows (existing boards cover layout; the data)

```
SourceCandidate {
  label                String          e.g. "VIPTV · 4K" or "LordStreams"
  detail               String?         second line (release name / file info), clamp
  quality_height       Int?            1080 → "1080p" (derive the quality chip)
  audio_languages      String[]        e.g. ["en"] ("EN" chip)
  presentation {
    provider_name      String?         addon name for the right column
    source_id          String?
    delivery_format    "hls" | "progressive" | null
    quality            String?         "4K", "1080p"
    video_codec        String?         "h264", "hevc"
    audio_codecs       String[]
    size_bytes         Int?            8_912_896_512 → "8.9 GB"
    size_label         String?
  }
}
```

## A6. Source integrations (settings)

```
Integration {          // one per row in the list
  name                 "VIPTV Sources" | "Xtream live TV" | "M3U live TV"
  state                "Ready" | "Needs configuration" | "Unavailable on this connection"
  configured           Bool            (connection_id != null)
}

// The configure form is described by a schema the server/engine sends:
Schema {
  name                 String
  credential_fields    [{ id, label, required, secret }]   // secret = masked entry
  provider_choices     [{ id, label }]                      // multi-select, ordered
  maximum_providers    Int                                     // e.g. 12; empty selection = default set
}

// Concrete forms the app has today:
VIPTV Sources:  tmdb_api_key   (label "TMDB API key", required, secret)
                + provider multi-select (up to 12 of ~20)
Xtream:         server_url (required) · username (required) · password (required, secret)
M3U:            playlist_url (required, secret) · epg_url (optional, secret)
```

Values are **write-only**: never displayed after saving. Per-profile.

## A7. Profile & preferences (for settings parity)

```
Profile { name, locked (PIN), avatar_id }
Preferences {
  next_episode         Bool     "Next episode button"
  skip_intros          Bool
  source_selection     "best" | "ask"      ("Best match" / "Always ask")
  max_quality_height   Int?                preferred quality
  subtitles_enabled    Bool
  preferred_audio_language / subtitle language  String?
}
```

---

# B. Screens that need boards (none exist yet)

## B1. Settings → Source integrations (TV, phone, tablet, desktop, web)

- **List section**: rows per `Integration` (name, state line, Configure/Replace,
  Remove when configured). States: unconfigured, configured, saving, error,
  unavailable, remove-confirm.
- **Configure page**: full-screen on TV (TV keyboard for secret fields, dpad
  provider rows, Save/Cancel as TV buttons, Back closes — **no X buttons on
  TV**); dialog on desktop/web; sheet on phone. Provider rows = multi-select
  chips with a "3 of 12" count. Save is busy-capable; validation errors inline.
- **Remove confirmation**: existing confirm pattern, states what is deleted
  (credentials + assignment from this profile).

## B2. Movies / Series browse pages (update existing browse boards)

Using A2/A3/A1 data only, redraw the browse page:
- **Catalog switcher** (named catalogs + provider display name; the active
  catalog is a heading).
- **Facet filter surface**: TV = full-screen sheet; phone = bottom sheet;
  desktop/web = rail/popover. Filter chips above the grid when applied.
- **Grid states**: loading skeleton, empty ("Nothing matches these filters"),
  error + retry, appending pages while scrolling.
- **Card states** per A1: with/without art, progress, badges, certification.

## B3. Smaller gaps (app renders these; no boards)

- **Recovery codes screen** — code display + "write it down" step + Done.
- **Parental controls settings content** — age rating picker, approved titles
  list, parent PIN management.
- **Sources sheet empty/error states** — "N providers returned torrent links
  this device cannot stream directly. Add a debrid service (for example
  TorBox)…", and "VIPTV Sources could not run. Check its TMDB key in
  Settings…" style failures.
- **TV add-on manual entry** — the address field + Install/Cancel dialog
  (complements the QR flow already designed).
- **Display settings** (accent/OLED) and **About** content pages.

---

# C. Delete / edit in the current canvas

**Delete these boards entirely:**
- `D3SignInIptv` (desktop), `M3SignInIptv` (phone), `Tv3SignInIptv` (TV),
  `W3SignInIptv` (web)

**Edit these boards — remove the "IPTV provider" sign-in option row:**
- `D3SignIn`, `M3SignIn`, `T3SignIn`, `Tv3SignInChoose`, `W3SignIn`,
  `W3SignInMobile`

**Update the notes text:** rule 7 in START-HERE and the per-platform research
notes lists sign-in methods including "IPTV provider (Xtream Codes / M3U)" —
remove that clause. M3U/Xtream **stay** as Live TV source integrations in
settings (B1 covers their design).
