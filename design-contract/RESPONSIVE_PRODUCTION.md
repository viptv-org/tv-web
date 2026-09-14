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

Mobile Search and Discover do not cross-link to each other (RUI-028). Discover stays in the phone bottom navigation, so the visible Search/Discover switch is removed and catalog browsing remains reachable without it. Desktop keyboard focus inverts both label and background even on selected or hovered navigation. Native text fields retain cursor/editing keys and focus directly rather than focusing hidden TV keys. Modal Tab remains inside the active dialog; closing returns to its opener.

Live TV retains its channel/time coordinate mapping in an internally scrollable timeline. Responsive controls expose Earlier/Now/Later and the category sidebar; RUI-028 removed the responsive Previous/Next channel buttons and loads the next channel page when the guide scroll reaches the end of the loaded rows. TV remote paging is unchanged. The application and guide scrollers keep a permanent vertical scrollbar slot (no width change between tall and short routes; overlay-scrollbar platforms lose no width), and the header profile control uses a fixed slot, so route changes cannot shift the frame or reflow the header. A current-time label and timeline marker remain visible.

## Adoption evidence and limits

The implementation's RESPONSIVE_VALIDATION.md records functional, viewport and decoding checks. The first final batch passed 72 unit/controller tests and 60 browser scenarios (38 platform-specific duplicate exclusions), including actual browser WebM/HLS decoding. Responsive phone/desktop/ultrawide use the real controller against controlled backend responses. These results do not establish real upstream provider playback or physical Tizen/Vizio/Tauri compatibility. Native host packaging and configured public Vizio receiver remain separate work; the public receiver path returned HTTP404 during verification. Android Compose mobile remains a separate renderer awaiting adoption.

## Populated-content sizing correction — RUI-022

The first real-client implementation failed with populated shelves: on a390px viewport,24 cards enlarged the grid/hero to5952×3348px. Its single-item viewport tests measured the document, missing overflow inside the fixed application scroller. This is an implementation defect, not an approved layout.

All responsive layout tracks and their children must shrink to the available content width. Shelves own horizontal overflow; the application itself must never scroll horizontally. Hero and detail artwork retain16:9 bounded boxes: phone width equals the content width (358×201.375 at390px), tablet artwork caps at400px tall, desktop artwork caps at440px tall inside the1700px content frame. Full shelves, long names and image intrinsic dimensions must not enlarge them. No background-image hero.

Preserve original colors and component geometry. Use compact natural-flow header/actions, readable text and restrained spacing. Home fallback titles clamp to two phone lines/three desktop lines; full titles remain accessible and available on detail. Shelf headings allow two lines at natural height. Credits and synopsis previews are bounded; More info keeps their complete content. Real text must wrap rather than forcing the layout wider. Search rows, modal choices and avatar grids must discard obsolete fixed TV dimensions that clip responsive content. Profile labels truncate within bounded header space; navigation and toolbar controls cannot overlap at any breakpoint.

Validate populated Home/Discover/Search/My List and series detail, not only sparse fixtures. Include24-item shelves, long labels/profile names and portrait/large landscape artwork; measure the actual application scrollWidth and every hero box at360,390,768,1024,1280,1440 and2560px. Inspect private phone/desktop captures and check tap/focus, scroll restoration, menus, source entry and player controls. Explicit TV rendering keeps its existing contract.

Mobile Discover/My List and Search results use Home's own shelf presentation (RUI-028):232px fluid tiles on one horizontally scrolling row with a next-card peek, never one full-width card per screen. At600px and wider browse results form a filled grid whose columns resolve from the content-frame width, so its outer edges coincide exactly with the header's; fixed-width columns that leave a ragged strip are superseded. Filter rows span the available phone width; browsing/source headings use32px type. The mobile Home synopsis preview is two lines, with full content on detail. Responsive labels use explicit ellipsis, not stopped TV marquee fragments. Back restores the prior page and horizontal shelf offsets before paint and returns focus to the originating control.

## Responsive navigation, live activation and populated cards — RUI-023

Status: owner-requested correction, implementation and validation in progress on 2026-09-14; no completed device acceptance is implied. This corrects the real client following RUI-022. It does not change the frozen Roku renderer. The baseline continuation behavior remains [Home and Continue Watching](specs/behavior/roku-ux-contract.md#home-hero-queue-and-title-detail), extracted from Roku `a047d9ca5fc80898013eefb66120d20fab5048c0`.

### Navigation and appearance

Detail, sources and profile screens keep the shared header, and browser Back, gesture, Forward and application history retain the same traversal and restoration described here. Returning from detail or sources restores the prior screen, filters, query, selected title, vertical page offset, horizontal shelf offset and originating focus. Browser Back and Forward follow that same sequence without exposing an intermediate Home page or leaving stale playback work active. Opening and dismissing a modal does not add a spurious page to history; dismissing restores its opener. Canceling pending work must suppress late navigation or playback effects.

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

## RUI-026 — Failed artwork, dismissible dialogs and source loading

Status: implementation requested; browser acceptance pending. Applies to the shared web UI and shared card policy; Roku remains unchanged.

Continue Watching retains its exact episode still as primary artwork. If fetching/decoding it fails, the renderer reports that failed original URL to Rust's card presentation policy and renders the next permitted candidate: the known series landscape. A failed episode still must not leave a blank card when usable landscape art exists, and must never become a portrait crop. Each candidate is attempted once per mounted card identity; exhaustion retains the existing readable fallback. The core owns ordering and artwork role on every retry, consistently for Android and web.

Clicking/tapping a dialog backdrop dismisses the topmost dialog using the same cancellation path as Back/Cancel. Clicking inside the panel, dragging out from it, and interacting with fields/choices must not dismiss it. Cancellation never submits a form or approves a destructive action. In-flight authorization retains the existing cancellation guard. TV remote Back and responsive Escape remain available; responsive navigation does not acquire a TV focus ring.

Source discovery shows one local spinner alongside **Finding sources…** in the source-filter status row, inside the content area. It must not float into the header, overlap navigation or duplicate the empty-state loading spinner. The indicator occupies a fixed 26×26 box and rotates about its own center; surrounding labels remain still. Empty results retain explanatory text. Source completion removes the discovery spinner.

Acceptance: a failed exact-episode image followed by a successful landscape image renders that landscape without changing queue identity, progress or action; all failed candidates stop retrying. On phone and desktop, dismiss a choices dialog and a text-entry dialog by backdrop click, verify inside clicks retain it and no pending save executes. While a source response is held pending, verify exactly one spinner stays inside the source status row, below navigation, at multiple animation phases; completion removes it. Device evidence is separate from browser checks.

## RUI-027 — Responsive playback controls, guide and account access

Status: requested implementation; final evidence belongs in adopting clients. Preserve frozen Roku behavior and its shared data/action meanings.

### Playback controls and transparent delivery

Website and Tauri player overlays expose Fullscreen/Exit fullscreen, mute/unmute, and a labeled Volume range wherever the actual engine supports software volume. Unsupported system-controlled volume is identified as **Use device volume buttons**, without a nonfunctional slider. Fullscreen encompasses the picture, controls and dialogs; website uses the Fullscreen API with native-video fallback where available, Tauri uses its window API. External fullscreen exits update the label. Back/stop releases fullscreen entered by this player, but never changes a preexisting native-window fullscreen state. Errors remain visible and controls recover. Phone controls wrap without overflowing; tapping/dragging a control keeps the overlay visible.

**Playback info** opens a dismissible panel showing the actual decoder (MediaBunny/WebCodecs, native media, hls.js/MSE, AVPlay, or a native plugin), network transport (direct/browser proxy/native HTTP), and server delivery (direct, remux/copy, transcode, or unknown). Display reported codec/resolution and fallback reason when available. Never infer transcoding solely from a proxied URL or label a native engine as MediaBunny. Do not expose signed source URLs, tokens or cookies. The responsive web adapter prefers MediaBunny when its runtime and codecs can decode the selected media; failure preserves a working native/HLS path before seeking more expensive server delivery. Direct/copy/remux still precede transcoding. Secure-context and platform limitations are reported honestly.

### Live TV

Desktop retains Roku's category-led organization: persistent leading category sidebar, selected category, search, channel list and a much larger programme timeline. RUI-028 keeps every piece of guide page chrome (heading, active filter with its date/timezone, search, Earlier/Now/Later and the scroll instruction) in one row above a single row in which the sidebar and the guide box are equal; the channel paging controls span the frame below it. The guide has native vertical and horizontal scrolling with a sticky channel column and time labels, a current-time marker, and readable programme blocks. Wheel/trackpad/touch scrolling must work without stepping through directional buttons. Earlier/Now/Later change the time window; pagination controls apply to channel API pages only, not each visible row. Tapping the channel or current programme plays it; future programme selection opens its existing information action. Scroll position and selected category survive guide interaction without switching channels accidentally.

On narrow screens replace the sidebar with a labeled category picker; preserve selected category, search and time navigation above a scrollable guide. Keep channel identity pinned while swiping the timeline, show several substantial rows, and avoid squeezing programme text into tiny cells. Retain the established graphite canvas, cards and typography. Existing TV remote layout and interactions remain unchanged.

### Discover and session resilience

All enabled addons' declared catalogs must survive shared normalization, including custom catalog type identifiers; preserve exact addon/catalog/type identity in requests. Distinguish identically named catalogs by addon name and expose content-type and declared extra filters. Source-only addons are not invented as catalogs. Catalog loading must survive unrelated Home/preferences failures, and entering Discover refreshes its inventory. Errors remain recoverable without replacing successful catalog data with empty success.

Screen cancellation must not abort a shared token rotation or discard a newly issued grant. Retry a late unauthorized response with the current token before rotating again; transient network/5xx failures do not log out the household. Definitive server revocation still returns to sign-in. Account/profile/provider/history data must be preserved.

### Sign-in

Responsive website sign-in uses a centered, bounded account card with the design-owned viptv mark, heading **Sign in to viptv**, visible username and password labels, password-manager autocomplete, a primary **Sign in** button, pending feedback, and inline recoverable error. Existing secure backend login and device approval establish the viewing session; credentials are never persisted. A secondary account access link provides existing registration/recovery. QR/code linking becomes an optional **Use another device** path on web, remaining primary on TV. Native Tauri uses a centered **Continue in browser** flow through the existing account/device approval page, then returns through the established pending grant; opening failure shows a usable link/code. The account website's existing sign-in/register/recovery forms are also vertically centered with safe scrolling on short viewports. No new accounts, password policy or TV auth changes are implied.

Acceptance covers browser fullscreen enter/external exit, native-host command boundary, volume/mute engine dispatch, sanitized true playback diagnostics, real decoded media with fallback, loaded/empty/failing guide and native scrolling at phone/desktop widths, all addon catalog types and duplicate names, canceled/overlapping token refresh, and sign-in pending/error/success/layout. Browser fixtures, real-media decoding, native host boundaries and physical devices are reported separately; no emulator required.

### RUI-027 implementation geometry and research

At widths >=900px, the guide uses the existing page gutters with a 216px category sidebar, 24px gap and a remaining-width timeline column. The timeline is a 1440px six-hour canvas with 120px half-hour divisions, a 168px sticky channel column, 48px sticky time header and 84px channel rows. Its viewport height and the category sidebar share one clamp token (RUI-028: `clamp(420px, 100dvh - 400px, 860px)`), so the sidebar and the guide box have the same top edge and the same height; the sidebar scrolls internally instead of ending short. At widths <900px, the sidebar becomes a native labeled category picker, the sticky channel column is 112px, and the guide has at least 360px vertical viewing space. Horizontal and vertical scrolling are native; long programme labels remain within view as their leading edge scrolls behind the channel column. Server timezone labels and programme times use the same valid zone; invalid/absent zones explicitly use local time. Forty-channel API pages and three concurrent schedule fetches remain bounded. Selected categories use the existing #303234 surface and a white leading marker; the timeline marker is white. No new colored accent theme.

Responsive account sign-in has a 440px maximum card, 36px desktop / 28px-by-24px phone padding, 20px corners, 48px design-owned mark, 30px title, 50px labeled input fields and primary action. Center it in the available viewport, retaining page scrolling if the keyboard or short viewport requires it. Graphite #202224 card sits on #101112 canvas; primary action is #f5f5f5 with #101112 text. Username/current-password autocomplete is explicit. Replacing a pending pairing code cancels any in-flight submission; late success must not disable the replacement form.

Playback utilities share the existing 56px desktop / 48px phone button sizing. Volume is a real native range input with a minimum 44px hit-height, 72–130px desktop width and 100px phone width. On narrow screens the utilities wrap to a second row, with volume leading and information/fullscreen trailing. Muted-to-nonzero volume unmutes. Escape exits fullscreen while retaining playback; unrelated non-player navigation never changes a preexisting native fullscreen window. An eight-second missing-video-frame guard prevents an apparently successful audio-only black player for expected-video sessions; actual engine failure remains recoverable through the existing delivery policy.

The leading desktop navigation and compact category picker apply [Android adaptive-navigation guidance](https://developer.android.com/develop/ui/views/layout/build-responsive-navigation). Pinned labels and bounded native scrolling apply the separation principle in [Apple scroll-view guidance](https://developer.apple.com/design/human-interface-guidelines/scroll-views); these exact EPG measurements are VIPTV decisions. Fullscreen follows the [browser API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API) and [Tauri window methods](https://tauri.app/reference/javascript/api/namespacewindow/). MediaBunny's actual input/sink decoding path follows its [media sinks guide](https://mediabunny.dev/guide/media-sinks). These references inform platform adaptation and do not replace this immutable specification.
