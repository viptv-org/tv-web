---
name: viptv-ui
description: Build or change any VIPTV screen or component (phone, desktop/Tauri, web, TV) using the VIPTV design system's tokens, component rules, copy and reference screens.
---

# VIPTV UI

Use this skill whenever you create or edit UI in this repo: screens, components, styles, copy, focus handling or layout.

The design system lives in `design/viptv-design-system/`. If the folder is somewhere else, find it by searching for `viptv-design-system/tokens/tokens.json`.

## Before writing any UI code

1. **Find the reference screen.** Open `reference/screens/index.json`, find the screens whose name or title matches the task, and look at the image(s) in `reference/screens/img/<platform>/<Name>.webp`. The HTML version in `reference/screens/html/` has the exact markup, sizes and copy. Match it.
2. **Read the component rules** in `components.md` for every component you touch (buttons, chips, fields, rows, cards, nav, overlays, feedback, player).
3. **Use tokens, never raw values.** Colours, type roles, radii, spacing, sizes and focus recipes come from `tokens/tokens.css` (CSS variables and `.viptv-type-*` classes), `tokens/tailwind.preset.js` or `tokens/tokens.ts`. If a value you need is missing, add it to `tokens.json` first, then use it.
4. **Use the exact copy** from `copy.md`. Do not invent new wording for existing states.

## Rules that must hold

- Dark only. The ground is `bg` (`#000` in OLED mode, set via `data-oled`).
- One accent primary per screen. The accent is also for progress, spinners, the caret and "Best match", and nothing else. Red is only for LIVE.
- The accent comes from `--viptv-accent` (the user picks gold, coral, mint or periwinkle). Never hard-code `#F5C542` in components.
- Pill rule: radius = height ÷ 2.
- Phone: targets are 44 px or more, frequent actions sit in the bottom third, the floating nav is 28 px above the edge, and overlays are bottom sheets. Phone has no hover or focus styling: the pressed state is scale 0.97 plus a surface step.
- Desktop / web: the 40 px custom title bar (Tauri) and the 84 px rail. `:focus-visible` = `0 0 0 2px bg, 0 0 0 4px text-primary`, never accent. Card hover = an inset ring, dimmed art and an accent play disc. Tiles keep fixed widths, so wider windows show more tiles and art is never stretched.
- TV: a 1920 × 1080 layout with a 96 × 54 safe area and exactly one focused element. Focus = off-white fill + 4 px white ring + scale (1.05 buttons, 1.06 tiles). No accent buttons. Text is 18 px or larger. Overlays are the right 820 panel. Text entry is full screen with the on-screen keyboard. Every screen shows a key legend.
- Loading is a layout skeleton on phone and desktop, and a "Starting VIPTV…" cover on TV. Never use a "Loading…" page or a "Load more" button.
- Naming: "My List" (not Library / Watchlist) and "Continue Watching". The search placeholder is "Search movies and series".
- Accessibility: real `button` / `a` / `input` + `label`. `aria-label` on icon-only buttons. `role="dialog"` + `aria-modal` on overlays. `role="status"` / `role="alert"` on toasts. Text contrast is 4.5:1 or better.
- Buttons need the reset `background: transparent; border: 0`. It is in `tokens.css`, so keep it if you write your own base styles.

## When you finish

Compare your result with the reference image side by side, whether that is a screenshot, a Storybook story or a dev server. Check spacing, sizes, copy and focus against `components.md`, and list anything you deliberately did differently.
