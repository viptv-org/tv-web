# VIPTV components in the responsive layout

Status: owner-approved appearance contract for the responsive viewing client; see [RESPONSIVE_PRODUCTION.md](RESPONSIVE_PRODUCTION.md) for adoption. Supersedes the presentation choices in RUI-014–017 where they differ below. Existing TV/Roku app behavior is unchanged; native packaging and production deployment remain separate validation gates. Tracking: [design #8](https://github.com/viptv-org/design/issues/8).

## Intent and source

Keep the useful responsive arrangement, but make it visibly the same VIPTV product. The reference for appearance is [VISUAL_SYSTEM.md](specs/visual/VISUAL_SYSTEM.md), the frozen Roku contract, and current shared TV-web at `c228fac11e8def15d0906001db467cb84936ecbe` (`src/ui/tv.css` and `App.tsx`). The reference for responsive geometry is [RESPONSIVE_UI.md](RESPONSIVE_UI.md): bounded horizontal desktop navigation, contained hero art/title-logo, large episode cards, and compact phone action grouping. The external inspiration is no longer an appearance authority.

## Decisions and implementation plan

1. **Preserve layout.** Desktop header and body share a centered 1700px frame, including 21:9 windows; no detached sidebar or background-image hero. Phone has bottom navigation and one row of primary / My List / More actions. Keep large episode grid/swipe cards. Default A is the implementation direction; B/C remain historical comparison URLs and inherit the same VIPTV components.
2. **Restore component identity.** Use the canonical graphite surfaces, Arial/system bold hierarchy, 12px rounded rectangular buttons/filter chips, 8px artwork clipping, original VIPTV navigation/player icons, the canonical inactive/focused card frame, and white keyboard-focus inversion. Replace the reference-derived circular action backgrounds and thin small type. The new layout is not permission to invent a new skin.
3. **Restore content hierarchy/copy.** Home shelves use uppercase titles, prominent card names and episode context. Use Home, Search, Live TV, My List, Settings, Continue Watching and Recently Added; remove editorial greetings/taglines/collection badges. Keep transparent metadata title logos and readable text fallback. Normalized content and action labels still come from Rust.
4. **Apply across the study.** Home, detail/episodes, menus/sources, search/list/live, profiles, settings, player and TV-controller controls share this visual system. Import original design-owned icons/avatars with a path/hash manifest. Transport icon images use at least 28px display boxes, matching TV-web, because their source PNGs include internal padding. New actions lacking a canonical icon may retain a simple neutral supplementary glyph; do not pretend there is a source asset for them.
5. **Validate after the code batch.** Build once, run the browser matrix plus canonical component checks, privately inspect desktop/phone/21:9 states, and update the existing LAN study. Record the immutable revision and textual evidence; no screenshots in git.

## Geometry and type — RUI-018

| Component | Desktop/tablet | Phone adaptation |
| --- | --- | --- |
| Standard shelf card art | 256×144; 24px gap | 232×130.5; 16px gap; 16:9 preserved |
| Card title/context | 21px bold / 17px regular, 25/22px line height | 17px bold / 14px regular, 22/20px line height |
| Card name/context inset | 8px below art, then 4px | same rhythm; reserve space for visible More |
| Shelf heading | 22px bold uppercase | 20px bold uppercase |
| Hero fallback title | 44px bold, normal letter spacing | 32px bold |
| Body/context | 19–20px / 17px | 16px / 14px |
| Primary action | 56px high, 22px bold, radius 12px | 52px high, 18px bold, radius 12px |
| Secondary action | 56px square, radius 12px | 52px square, radius 12px; not circles |
| Navigation label/icon | 18px bold / 24px canonical asset | 12px bold / 24px; tablet icons retain accessible names |
| Source/menu row | 56px minimum, 22px bold title, 17px detail | 52px minimum, 18px title, 15px detail; wrap without overlap |
| Episode cards | retain large grid geometry; 21px bold title, 17px synopsis | retain swipe geometry; 18px title, 15px synopsis |

The canonical 256×144 home-card focus artwork is reused at full intrinsic geometry on desktop. Unfocused outline is 0.35 opacity; focused ownership is 1.0. It covers art only, never text. Larger episode cards use an equivalent 2px white outline and 8px radius to avoid scaling border thickness. Progress is 6px, inset 8px; nonzero fills retain a 6px minimum dot. Card content can truncate to its accessible full title; it must never overlap More. No automatic marquee is introduced on touch/pointer.

## Surface, focus and OLED — RUI-019

Canvas remains `#101112`; surface `#202224`, muted surface `#191b1d`, selected `#303234`, primary text/focus `#f5f5f5`, secondary `#c5c6c7`, muted `#a6a8aa`, track `#4a4c4e`. OLED changes the canvas to `#000000`, retaining the same component surfaces and contrast. This supersedes the initial darker OLED component colors.

A resting action is graphite with white text/icon. Keyboard focus fills it white and inverts its label/icon to `#101112`; hover uses selected graphite. No perpetual white primary pill imitates a focused control while another control owns focus. Primary placement/label preserve its meaning. Card focus remains an outline rather than an inverted artwork fill. All controls keep visible 2px focus outlines where inversion alone is insufficient; profiles retain their concentric 3px ring. Selected My List and theme controls use explicit pressed state rather than stale focus.

## Behavior and source-data boundaries — RUI-020

No data mutation, playback policy or source selection changes are authorized by this appearance pass. Preserve Rust-projected titleLogo/heroImage/episodeImage, progress, exact episode identity and primary labels. Changing presentation must not reset profile, query, route, modal, scroll anchor or source intent. More still contains Details/Choose source/My List/Watch on TV where eligible, with stable opener focus after cancel. Phone visible controls stay on one row at 320px; 48px minimum targets and safe-area clearance remain mandatory. Existing browser handoff versus native SmartCast simulation stays explicit.

## Acceptance and evidence — RUI-021

- Compare rendered dark/OLED tokens to canonical values, not a new palette.
- At 1440px verify 256×144 art, 21/17 card type, 24px gap, 12px action corners, canonical icon source and uppercase shelf headings.
- At 320/390px verify 17/14 card type and the same three 52px-high action targets on one row; no overflow or button/text collision.
- Verify resting versus keyboard-focused action fill/icon inversion and inactive versus focused card frame ownership.
- Verify the original avatar artwork and concentric profile focus ring.
- Re-run existing source/cancel, episode identity/return, logo fallback, Vizio, search, player-control and viewport coverage.
- Privately inspect Home/details/episodes/menu states at phone, desktop and 3440×1440. Report component measurements, not an unmeasured 90% screen-similarity claim: layout and fixture artwork intentionally differ from the TV canvas.
