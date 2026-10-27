# Web — research and decisions

0. Hero: a framed 16:9 picture at source size with a blurred fill — never a stretched full-bleed image.
1. Fluid rows with ~4% side padding; cards per row 2 / 3 / 4 / 5 / 6 at <500 / <800 / <1100 / <1400 / ≥1400, and a 7th past ~1800 instead of ballooning art (observed Netflix). Arrows and page ticks appear on hover; a partial card at the edge says 'scroll'. Boards at 390, 768, 1440, 1920.
2. Nav is fixed and transparent over the hero, solid once you scroll, a 'Browse' menu under 900 px. Skip link + scroll-padding so a focused card is never under the header (WCAG 2.4.11).
3. Details open in a modal over the page with a real URL (pushState): row and scroll position are kept, Back/Esc close it. A shared link opened cold gets the full title page (Netflix ?jbv= vs /title/).
4. Hover card after ~400–500 ms (still image, never video) with Resume / + / Remove / More; the same info on keyboard focus.
5. Player: Space/K, J/L, arrows, F, M, C; Fullscreen API on the player wrapper; Picture-in-Picture; Media Session for OS keys. Playback only ever starts when you press Play.
6. The pages TVs and the desktop app send people to: viptv.syek.tech/device (one code field, case-insensitive, no look-alike letters, paste OK → confirm the TV → pick a profile → done; RFC 8628, YouTube/Netflix tv pages) and /addons (paste a manifest, it installs on every device).
7. Signed-out landing: one promise, email + Get started, where it runs (Netflix's landing order). LCP: the hero image is fetchpriority=high, rows lazy-load.
8. WCAG 2.2: 24 px minimum targets, 2 px focus ring with offset, 4.5:1 text on scrims.

Sources: W3C WCAG 2.2 Understanding (2.5.8, 2.4.11, 2.4.13, 2.2.2), MDN (Fullscreen, PiP, Media Session, container queries), Chrome autoplay policy, web.dev (LCP, lazy loading), Netflix help + tv8 page + web performance case study, YouTube TV help, RFC 8628.
