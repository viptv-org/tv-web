# Responsive client implementation

Status: implemented in the real shared viewing client ([tv-web #3](https://github.com/viptv-org/tv-web/issues/3)), following the approved responsive layout and original VIPTV appearance. This promotes the layout contract, not the fixture application.

## Contract and ownership

Use [RESPONSIVE_VIPTV_ALIGNMENT.md](RESPONSIVE_VIPTV_ALIGNMENT.md) RUI-018–021 and [RESPONSIVE_UI.md](RESPONSIVE_UI.md). Preserve the Roku baseline for TV. Browser and desktop-webview presentation share the real tv-web application controller, Rust DTOs, device authentication, profile persistence, catalog requests, source discovery and player session implementation. The web repository remains the account/admin application; do not duplicate the viewing controller there. A single viewing bundle can be mounted alongside it at /tv/.

Ordinary browsers use responsive presentation; explicit Tizen/Vizio platform configuration retains TV presentation. `?layout=tv` enables browser inspection of that TV layout. Presentation does not change decoder capabilities. Tauri hosts inject native HTTP through the official HTTP plugin with redirects disabled; browser requests retain the existing same-origin API/media proxy. Native packaging and hardware decoding are separate acceptance gates.

## Screens and actions

Implement real startup, pairing, profile chooser/editor, Home, Search, Discover, My List, Live TV, detail/episodes, source selection, playback, Settings and existing modal/error states. Preserve backend identities, history and source choices. No fixture catalog, fake timer-based playback, simulated pairing or invented account persistence enters the production bundle.

Home and detail use contained landscape artwork and shared-core transparent title logos with readable text fallback. Desktop header/body align within a bounded 1700px frame. Mobile navigation and action groups remain reachable without horizontal document overflow; shelves and episode strips scroll within their own regions. Visible More exposes hold actions on touch. Existing Back/cancel and return focus semantics remain; keyboard text editing is native in responsive input fields. OLED stores only a local appearance preference, never profile/auth state.

## Acceptance

After the implementation batch: build with design/core integrity checks; run unit/controller tests and a single-worker browser pass covering phone, desktop and ultrawide. Assert the canonical default canvas, confined horizontal scrolling, real API-driven profile/home/detail/source flows, accessible buttons and logo fallback. Retain explicit TV tests. Privately inspect representative rendered screens; commit textual evidence only. Backend fixtures establish client integration, not successful upstream playback or physical Tizen/Vizio/Tauri validation. Record limitations truthfully and keep real server/account data unchanged.

## Input adaptations

Mobile Search exposes a visible Search/Discover switch so reducing bottom-navigation density does not remove catalog browsing. Desktop keyboard focus inverts both label and background even on selected or hovered navigation. Native text fields retain cursor/editing keys and focus directly rather than focusing hidden TV keys. Modal Tab remains inside the active dialog; closing returns to its opener.

Live TV retains its channel/time coordinate mapping in an internally scrollable timeline. Responsive controls expose Previous/Next channels and Earlier/Now/Later, using the existing channel pages and time windows. A current-time label and timeline marker remain visible.

## Adoption evidence and limits

The implementation's RESPONSIVE_VALIDATION.md records functional, viewport and decoding checks. The first final batch passed 72 unit/controller tests and 60 browser scenarios (38 platform-specific duplicate exclusions), including actual browser WebM/HLS decoding. Responsive phone/desktop/ultrawide use the real controller against controlled backend responses. These results do not establish real upstream provider playback or physical Tizen/Vizio/Tauri compatibility. Native host packaging and configured public Vizio receiver remain separate work; the public receiver path returned HTTP404 during verification. Android Compose mobile remains a separate renderer awaiting adoption.

## Populated-content sizing correction — RUI-022

The first real-client implementation failed with populated shelves: on a390px viewport,24 cards enlarged the grid/hero to5952×3348px. Its single-item viewport tests measured the document, missing overflow inside the fixed application scroller. This is an implementation defect, not an approved layout.

All responsive layout tracks and their children must shrink to the available content width. Shelves own horizontal overflow; the application itself must never scroll horizontally. Hero and detail artwork retain16:9 bounded boxes: phone width equals the content width (358×201.375 at390px), tablet artwork caps at400px tall, desktop artwork caps at440px tall inside the1700px content frame. Full shelves, long names and image intrinsic dimensions must not enlarge them. No background-image hero.

Preserve original colors and component geometry. Use compact natural-flow header/actions, readable text and restrained spacing. Home fallback titles clamp to two phone lines/three desktop lines; full titles remain accessible and available on detail. Shelf headings allow two lines at natural height. Credits and synopsis previews are bounded; More info keeps their complete content. Real text must wrap rather than forcing the layout wider. Search rows, modal choices and avatar grids must discard obsolete fixed TV dimensions that clip responsive content. Profile labels truncate within bounded header space; navigation and toolbar controls cannot overlap at any breakpoint.

Validate populated Home/Discover/Search/My List and series detail, not only sparse fixtures. Include24-item shelves, long labels/profile names and portrait/large landscape artwork; measure the actual application scrollWidth and every hero box at360,390,768,1024,1280,1440 and2560px. Inspect private phone/desktop captures and check tap/focus, scroll restoration, menus, source entry and player controls. Explicit TV rendering keeps its existing contract.

Mobile Discover/My List grids fill the content column with fluid16:9 cards; horizontal shelves retain232px tiles and a next-card peek. Filter rows span the available phone width; browsing/source headings use32px type. The mobile Home synopsis preview is two lines, with full content on detail. Responsive labels use explicit ellipsis, not stopped TV marquee fragments. Back restores the prior page and horizontal shelf offsets before paint and returns focus to the originating control.
