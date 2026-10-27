# Tablet — research and decisions

Tablet is wide mobile, but three things change (Material adaptive window size classes; iPadOS size classes & multitasking):

1. Navigation: under 600 dp wide the phone tab bar stays; at 600 dp and up it becomes a rail on the leading edge (Home, Live, My List, Search; cast, settings, profile at the bottom). The 'Split View — narrow window' board shows the app falling back to the phone layout in a half-width window — same features, less on screen.
2. Canonical layouts: Home is a feed; the series page is list-detail (art + actions left, episodes right); the player gets a supporting pane for episodes (≈70 / 30); Settings is list-detail.
3. Don't stretch: sheets become a side sheet or a popover with a max width; sign-in is a centred card.
4. Pointer and keyboard: posters 'lift' on hover, Space plays/pauses, Esc closes (iPadOS pointer guidance; Android large-screen quality tier 2).
5. Portrait vs landscape: same feed, the hero grows taller in portrait. Layout follows the window size, never the device model.
