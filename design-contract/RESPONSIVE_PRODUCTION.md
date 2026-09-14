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

## Responsive navigation, live activation and populated cards — RUI-023

Status: owner-requested correction, implementation and validation in progress on 2026-09-14; no completed device acceptance is implied. This corrects the real client following RUI-022. It does not change the frozen Roku renderer. The baseline continuation behavior remains [Home and Continue Watching](specs/behavior/roku-ux-contract.md#home-hero-queue-and-title-detail), extracted from Roku `a047d9ca5fc80898013eefb66120d20fab5048c0`.

### Navigation and appearance

Responsive Back sits at the top-left of the header whenever a previous application destination exists, before the brand and destination controls in visual and keyboard order. It traverses actual application history. Returning from detail or sources restores the prior screen, filters, query, selected title, vertical page offset, horizontal shelf offset and originating focus. Browser Back and Forward follow that same sequence without exposing an intermediate Home page or leaving stale playback work active. Opening and dismissing a modal does not add a spurious page to history; dismissing restores its opener. Canceling pending work must suppress late navigation or playback effects.

OLED belongs in Settings, with visible copy **OLED mode** and explicit current state **On** or **Off**. It is removed from the global navigation/header. The default canvas remains `#101112`; enabling OLED changes only the canvas to `#000000`, retaining canonical component surfaces, artwork, text contrast, profile and current playback state. The existing local appearance preference persists across reloads. Changing appearance never signs out, switches profiles or resets a route.

### Live and continuation activation

A live-channel card's primary tap/click/OK starts that channel through the existing live playback controller. It does not first open title details or the VOD source picker. The visible More action retains channel options. Guide future-programme activation still opens programme details; this correction does not remove that existing distinction. Starting a channel shows preparing/loading state; failure stays recoverable with a meaningful error and return to the actual originating channel context.

Continue Watching is the first Home shelf when the active profile has queue entries. Use the real shared-core queue and continuation presentation: parent title, exact episode identity/context, artwork role, normalized progress, resume/next action and retained previous episode. Do not fabricate this shelf from recently added titles or unrelated history. Ordinary activation continues the selected entry through the existing controlled resume/next path. A next-episode entry must not resume the prior episode accidentally; previous-episode Resume remains available in its menu. My List's Continue Watching view uses the same queue meaning. More exposes the existing queue management actions and failure/Undo behavior; detail is an explicit secondary action rather than a replacement for continuation. A loaded empty queue omits the shelf; failed or pending queue retrieval must not masquerade as successful empty data.

### Artwork and layout ownership

Phone/tablet Home always has artwork in grid row 1, copy/actions in row 2 and shelves afterward. Focusing a lower shelf may set the inherited TV compact-state flag, but must never move responsive copy into the artwork row, hide the contained image or overlap the hero. Desktop retains its adjacent art/copy layout. Moving focus cannot change the responsive geometry contract.

A live logo occupies the same artwork box as every other card. Its full image element starts at the artwork origin; padding inside that box supplies breathing room and `contain` preserves the logo. Do not combine the TV image offset with the responsive full-card image dimensions. The image must not extend into the title, episode context, progress label or More action. This applies equally to fixed shelf cards and fluid mobile browsing cards. Loading, failed, transparent, square, very wide and large-intrinsic-size images retain identical outer geometry. Continue Watching uses landscape media artwork selected by the shared contract, never the live-logo presentation solely because its source supplied a logo field.

### Required acceptance

- On a populated phone Home, focus or tap cards in the second and later shelves, return to the hero and verify artwork/copy never overlap. Repeat at 390px and a tablet width across the stacked-layout breakpoint.
- Inspect live logos in Home, Recently Watched Live TV, Discover and My List, including fluid mobile cards. Assert every image stays inside its artwork area and above the title.
- With at least 24 real-shaped queue entries and long titles, activate a partially watched episode and a next-episode entry. Verify exact media identity, resume position and source intent at the controller boundary; verify queue menu and return position.
- Exercise Home → detail → sources → Back → Back, browser Back/Forward, direct live entry, loading cancellation and error recovery. Restore the same profile, query, filters, shelf position and focus without a top-of-page flash.
- Toggle OLED in Settings, navigate away and reload. Verify the stored appearance, canonical surfaces and absence of an OLED header button.
- Keep screenshots private. Record browser geometry/controller evidence separately from real upstream decoding and physical device validation.

### Shared card presentation authority

The shared Rust API owns the complete card presentation: artwork URL and role, parent title, episode/context label, normalized progress, live identity and primary activation intent. React receives that typed presentation and renders it directly. It must not choose between `poster`, `background`, `thumbnail` or `logo`, guess a card's media type, construct continuation labels, or reinterpret progress to decide how activation works. Core tests must cover live-logo containment intent, episode thumbnails, missing landscape artwork, resumed episodes, next episodes and retained previous episodes. Browser tests use the backend's actual live and continuation payload shapes through that core boundary. Platform adapters perform the requested effect; they do not duplicate its data selection policy.

## RUI-024 — mobile selection without remote focus styling

Phone layouts and touch-first tablets show the active navigation destination through the existing selected surface and icon/label. Programmatic focus restoration or tapping must not produce a white focus outline, inverted white button, bright card frame, or profile focus border. Apply this consistently to navigation, cards, actions, dialogs, profiles and player controls. Preserve normal text-input editing and DOM accessibility semantics. Desktop keyboard and TV remote focus indicators remain visible. Verify initial Home, tapping another destination, focused cards/actions, and an unchanged desktop keyboard focus indicator.

## RUI-025 — pointer-first desktop and mobile web

Extend RUI-024's neutral focus appearance to every responsive viewport, including the desktop header. Selected destinations keep their selected surface; focused controls do not invert, grow a white ring or brighten artwork frames. Responsive pages do not auto-focus navigation/cards on arrival or return and do not run TV spatial arrow navigation, Enter-hold actions or remote media-key mappings. Use pointer/touch controls and visible More actions. Native browser semantics, text editing, dialog focus and Escape dismissal remain available. TV layout retains its existing remote input and focus behavior. Verify desktop Home on arrival, destination selection, arrow keys without grid movement, and preserved TV hold behavior.
