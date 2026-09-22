# Desktop layout

Status: accepted specification — implementation tracked separately
Date: 2026-09-18

The desktop (Tauri) app currently renders the responsive web layout inside
its window: a max-width column, a hero that mirrors the selected row item,
and cards without pointer affordance. That layout was designed for phone,
tablet, and TV. The desktop shell is a desktop-first layout that still
shares tv-web's components, per the shared-platform matrix in
`docs/adr/0003-shared-platform-matrix-and-playback-consolidation.md`.

## Decisions

1. **Left sidebar, never expanding.** Navigation is a fixed-width icon rail
   (Home, Search, Library, Settings). It does not collapse, expand, or open
   a drawer; there is no hamburger.
2. **No max width.** Content fills the window. There is no centered column
   cap; rows and grids stretch to the frame.
3. **No mobile UI at small sizes.** The desktop layout never switches to
   the responsive breakpoints. Instead the window enforces a minimum size
   (Tauri min-width/min-height) so the desktop layout is always viable.
4. **Hover and focus on cards.** Cards respond to hover and keyboard focus
   with the same visible effect (outline, elevation, or scale with a short
   transition); pointer and keyboard affordances match.
5. **The hero has its own data.** The hero is decoupled from Continue
   Watching: it renders a mix of the catalogs (rotating or promoted items),
   never the resume row.
6. **Selecting a card opens its info page.** Card selection never mutates
   the hero. One interaction: card → detail page.
7. **Shared components, desktop-only shell.** tv-web's card, row, hero, and
   detail components are reused; only the shell (sidebar, grid, sizing,
   window minimum) is desktop-specific. The responsive web, Tizen, and
   Vizio layout is untouched.
8. **Integrated frameless titlebar (30px).** Full-width dark header (`#141618`)
   at the top of the desktop shell containing the VIPTV brandmark, draggable
   spacer, search pill, bookmarks icon, profile avatar, and window controls
   (minimize, maximize, close). The window drag region is constrained to
   non-interactive areas, with interactive controls explicitly isolated from
   drag events.
9. **Thinner fixed left sidebar (54px).** Positioned directly beneath the 30px
   titlebar, reduced from 72px to 54px for a compact footprint, with centered
   icon buttons and profile avatar.
10. **Scrollbar containment.** The main content scrollable track begins at
    `top: 30px` directly beneath the titlebar, preventing scrollbars from
    overlapping or starting above the window titlebar.
11. **Frameless window decorations & border resizing.** When windowed (not maximized,
    not fullscreen), the window renders a subtle outline (`1px solid rgba(255, 255, 255, 0.14)`)
    and rounded corners (`10px`). Eight resize handles along edges (6px) and corners (12px)
    invoke Tauri's `startResizeDragging` for native Wayland/KDE Plasma compatibility.
12. **Titlebar focus elimination and back navigation.** Titlebar buttons use `tabIndex={-1}`
    and blur-on-activate with transparent focus overrides, eliminating focus retention after click.
    A back arrow (`<`) appears dynamically in the titlebar when in-app navigation history is available.
13. **Desktop player controls and layout.** Windowed playback retains the desktop titlebar
    (with player height adjusted to `calc(100% - 30px)`), auto-hiding the titlebar upon entering fullscreen.
    The player overlay features a top-left back button, top-right fullscreen toggle, custom volume
    slider with draggable thumb, grey buffered range on the seekbar, 2.5s auto-hide timeout, and live TV
    streams toggle mute instead of pause.
14. **Anchored track selector popup.** Audio and subtitle selectors use an anchored floating popup
    card with active track indicators (`✓`) rather than full-page modal dialogs.
15. **Sleek non-modal notifications.** Error toasts use glassmorphism with automatic 4-second auto-dismiss.
16. **Compact live TV guide and desktop settings.** Channel list rows are compact (60px) and the guide
    extends to the bottom of the window; settings navigation rail is constrained to 260px on desktop.


