# VIPTV visual system

This token and component baseline is reconstructed from the pinned [Roku visual source](https://github.com/vynxc/viptv/tree/7d6b4131a44d87b58edcf12709af5851da387176/roku). Its design requirements are complete below; the link is retained for audit, not as a missing implementation dependency.

## Canonical frame

| Property | Value |
| --- | --- |
| Design canvas | 1280 × 720, 16:9 landscape |
| Page background | `#101112` |
| Standard content left edge | x=100; Home shelf x=92 with 8px inner offset |
| Standard content right edge | x=1196; player x=64..1216 |
| Header heading | x=100, y=54, 1096×64 |
| Header caption | x=100, y=126 |
| Rail touch zone | x=0..300; rail surface x=0..88; icon-row origin x=21, y=108 |
| Base rhythm | 8px; standard card gap 24px; vertical list gap 12px |

Use a dark, restrained cinema surface. Remote artwork supplies colour; interface chrome is neutral white and graphite. Do not add brand-colour gradients, shadows, glass, or floating text panels.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#101112` | Page and hero fallback |
| `surface` | `#202224` | Buttons, cards, source rows |
| `surface-muted` | `#191B1D` | Channel row |
| `surface-selected` | `#303234` | Selected unfocused filter/card state |
| `surface-dark` | `#242628` | Player and image fallback surface |
| `text-primary` | `#F5F5F5` | Titles, default controls |
| `text-strong` | `#FFFFFF` | Focused episode title |
| `text-secondary` | `#C5C6C7` / `#D5D6D7` | Hero eyebrow/summary |
| `text-muted` | `#A6A8AA` | Supporting labels, inactive controls |
| `text-player-secondary` | `#BFC1C3` | Player context |
| `on-light` | `#101112` | Focused labels/icons |
| `track` | `#4A4C4E` | Card progress track |
| `player-track` | `#5A5C5E` | Player timeline |
| `focus` | `#F5F5F5` | Every primary focus fill/outline |
| `guide-now` | `#FFFFFF66` | Current-time guide line |

Opaque component fills use their eight-digit source forms (`#202224FF`, `#F5F5F5FF`). Player control backing is `#242628C8`; channel-logo backing is `#242628E8`. Do not substitute blue focus rings: focus is white, and dark text/icons invert into it.

## Type

Use platform system fonts with the indicated weights. Preserve hierarchy, line limits and scrolling before substituting a custom font.

| Role | Roku baseline | Size | Notes |
| --- | --- | --- | --- |
| Page/hero title | LargeBoldSystemFont | 44; compact hero 38 | Hero single scrolling line |
| Page heading | LargeBoldSystemFont | platform large | 64px box |
| Player title | system | 32 | scrolling when open |
| Player header/content identity | MediumBoldSystemFont | platform medium | x=112 header VOD; live channel name x=164 |
| Card/action/filter/source title | SmallBoldSystemFont | 21–22 | source titles 22 |
| Card subtitle | SmallSystemFont | 17 | one scrolling line |
| Body/episode/source detail | SmallSystemFont | 19–20 | source is six lines max |
| Metadata/labels | SmallSystemFont | 14–19 | uppercase only for semantic labels |
| Episode watched badge | system | 14 | centered in 86×26 pill |

Long focused one-line labels scroll at 42–48px/s, repeating indefinitely. Unfocused labels do not scroll. Wrapped prose never scrolls and must clamp to the stated number of lines.

## Shared components

### Focus and selection

Focused actionable controls invert: fill `focus`, label and icon `on-light`. A non-focused selected filter is `surface-selected` with white label. Card focus is a 2px rounded white outline; profile focus is a 3px rounded white outline. There is no large zoom animation: bounded scale/floating focus cues retain layout stability.

The focus owner controls visual focus. A card selected by data but in an unfocused shelf remains visually neutral. When focus leaves a screen for rail/dialog/playback, do not leave a stale bright card behind.

### Action row

`ActionRow`: default 536×56 (detail variants may be 192×56; Home uses 144×50). It is a 12px-radius graphite pill (`ui-round-fill.9.png`) with a 22px bold label centered horizontally and vertically across the whole control. This alignment also applies to Settings and generic action-list rows; it is not the left-inset label alignment of FilterChip. [ActionRow.xml at the frozen split revision](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/components/ActionRow.xml#L13) supplies the alignment. Focus becomes solid white with dark text.

### Filter chip

256×48, 12px-radius graphite fill. Label x=18, vertically centred in the 48px control; chevron x=222, y=15, 18×18 only for a dropdown. Inactive label muted; selected label white on `surface-selected`; focused control white with dark label/icon.

### Artwork card

Landscape card image: 256×144 with 8px rounded visual clipping. Its title begins y=152 and subtitle y=178. Title/subtitle are scrolling single lines. Fallback is a centered 3-line muted title inside a neutral 256×144 surface. A logo source uses scale-to-fit in an inner 176×100 area at x=40, y=22. Portrait artwork may crop to fill a landscape card; never stretch.

Continue progress uses a 240×6 track at x=8, y=134. Hide both track and fill when unknown; hide fill at zero; draw a minimum 6px rounded dot for nonzero progress. HomeCard uses the exact `ui-card-focus.png` raster over the 256×144 artwork only, not the full 256×200 slot. Its inactive outline remains at 0.35 opacity; active ownership overlays the same raster at full opacity. Title size is 21px and subtitle is 17px. Subtitle uses PresentationContext (season, episode, episode title and `Resume at m:ss`, or the queue-status wording) when nonempty, otherwise PresentationFacts. Home shelf headings are uppercase. These measurements follow actual HomeCard.xml/HomeCard.brs and MainScene.homeRow; the episode card has its own focus geometry.

### Image rules

Use landscape metadata for shelves and hero. Request/display card art at 256×144; the hero immediately reuses that decoded image, scaled as its low-resolution continuity layer, while 1280×720 logical (up to 1920×1080 physical) high-quality art loads behind it. Keep the continuity image visible until the sharp image is ready. Detail portrait is 236×354 (or hero fallback 252×378). Logos always use contain/fit and retain transparent PNG where supplied.

Artwork clipping is alpha-mask based: episode visual masks must use display-pixel mask dimensions derived from actual graphics/layout scale. If masking is unsupported, retain normal content rather than square-cropping the artwork.

### Hero

Full hero: 1280×720. Backdrop is `scaleToZoom`; dark left and bottom raster gradients overlay it. Standard content: eyebrow x=100 y=128; title x=100 y=166 max 600; summary x=100 y=228, 548×80, max 3 lines; facts x=100 y=322 max 650. Optional portrait fallback is x=938 y=102, 252×378.

Compact hero keeps the same backdrop framing but clips at 336px height: eyebrow y=44, title y=76 (38px), facts y=138, summary y=178; portrait x=1010 y=28, 176×264. It is not a separate visual style.

Eyebrow derives from state: `FEATURED <TYPE>`, `LIVE NOW`, or `CONTINUE WATCHING`. Facts join year, runtime, up to two genres and context using `  ·  `. No artwork means a dark canvas with readable text; do not fabricate an image.

## Scaling and platform adaptation

Preserve the 16:9 composition on TV. Scale all coordinates uniformly from 1280×720; do not independently stretch controls. On desktop/web, maintain a minimum usable TV-mode content area of 1280×720 or provide a proportional viewport. At narrower widths, switch to a documented compact/reflowed layout while keeping this hierarchy, 48px minimum remote target height, 8px rhythm, focus inversion, and artwork aspect ratios.

Use safe-area insets on devices that report them; the stated 64px player and 100px content margins are minimum visual insets after safe-area handling.
