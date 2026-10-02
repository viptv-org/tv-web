# Design changes

## 2026-10-01 — Distinct source producers and truthful outcomes

Specified SRC-PROVIDERS-001: source filters retain each observed configured
producer's identity and name, including zero-result and safe failed add-ons.
The picker explains unsupported formats and keeps partial playable rows usable.

## 2026-10-01 — Continue Watching episode source return

Specified CW-SOURCE-BACK-001: cancelling an episode's source picker from Continue
Watching opens its parent show details and Back restores the originating card.
Android and React/SolidTV implementation evidence remains pending.

## 2026-10-01 — Source picker descriptions and discovery status

Specified SRC-OVERFLOW-001 for Android phone/TV and responsive React/SolidTV:
every source description uses a two-line fixed window with focus/hover overflow
motion and reduced-motion fallback. Discovery shows a visible spinner and status
through partial results. Implementation and device evidence remain pending.

## 2026-09-30 — Android phone presentation and player track menus

Specified AND-042 for design issue 6. Phone Home now opens on the rounded hero,
the bottom navigation shows icons only, and cards carry minimal captions.
Catalog shelves are headed by content type, phone Home shows live channels as
logo tiles, and the bar is 6dp with lifted progress. Loading uses skeletons.
Phone and TV player audio/subtitle menus follow PhPlayerSubs and TvPlayerSubs.
Only AND-038's Home header remote entry changes; other TV geometry is
unchanged. Emulator and device evidence remain separate.

## 2026-09-30 — Canvas source, reference provenance and repository status

Recorded the VIPTV Redesign canvas as the visual source for the redesign beside
its committed `viptv-design-system/` export. Added `reference/FILES.json`
(SHA-256 and canvas-export source for all 453 reference files), verified by
`scripts/validate.py`. Clarified that canvas renders are allowed design
artifacts while app/device captures stay forbidden. Updated REPOSITORIES.md
with current status, design-pin mechanism and specs for every repository,
including core, playback-gateway, workspace and desktop. No behavior change.

## 2026-09-30 — Android silent foreground identity validation

Specified AND-041 for Android issue 4: stable authenticated phone/TV presentation
during bounded foreground validation, coalesced refresh, actionable recovery,
explicit revocation and cancellation. Existing background-stop, exact-source
absolute Resume, native playback policy, geometry and assets remain unchanged.
Actual authenticated media and per-device/visual evidence remain required.

## 2026-09-30 — Bounded bidirectional admin VOD matching

Specified ADM-002-VOD-WINDOW for web issue 5: three retained title pages,
automatic reverse reload, complete owned-provider selection, scoped cancellation,
retry and dialog Back/scroll/focus restoration. Keeps ADM-002 tokens and row
geometry. Synthetic encrypted 100k-title HTTPS and per-viewport evidence remain
required; this design change alone establishes no rendered or device acceptance.

Review clarification: idle/failed dialogs dismiss without saving; a submitted
save retains the existing disabled-dismissal state until completion or a bounded
30-second timeout. A browser Back cannot undo an already submitted server write.

## TV-only LightningJS renderer migration proposed — 2026-09-24
Authorized a staged replacement of the React TV renderer and custom D-pad focus registry with one LightningJS Blits UI for Tizen, Vizio and LG webOS. The 1920×1080 current TV output and behavior are the 1:1 migration baseline; the pinned design images remain a separate design-parity reference. Phone web, responsive web and Tauri desktop retain their React entry. TV launchers remain on the existing renderer until matched-content pixel comparisons, remote flows and platform checks qualify the new entry. See TV_IMPLEMENTATION.md. No parity or device claim is made by this spec update.

## VIPTV design system — 2026-09-23
Adopted [viptv-design-system/](viptv-design-system/README.md) as the single visual design for phone, desktop (Tauri), web and TV: `tokens/tokens.json` (source of truth), component rules, copy, settled decisions and reference screens. Removed the former visual layer (`tokens/`, `scripts/gen-tokens.mjs`, `specs/visual/`, RESPONSIVE_UI/PRODUCTION/VIPTV_ALIGNMENT, DESKTOP_LAYOUT, TV_WEB_UI_REBUILD, ANDROID_UI_REBUILD, TV_CANDIDATE_2026_09_12); they remain in git history. Behavior contracts under `specs/behavior/` are unchanged.

## Initial extraction — 2026-09-12
Captured the Roku baseline at vynxc/viptv@7d6b413 and established design-first cross-platform governance. This changes repository ownership, not Roku behavior. Android-only imports and proposed platform adapters are tracked separately from current Roku behavior.

## Baseline precision audit
Added exact dynamic guide geometry, search debounce/focus/partial-failure behavior and server-owned queue completion/cache rules. These clarify existing behavior without changing it. Source citations use the published split runtime snapshots.

## TV platform implementation
Authorized Android TV Compose and one shared Tizen/Vizio React frontend, with platform playback modules and design-based visual/remote testing. The baseline UX is preserved; host exit and on-screen keyboard equivalents are documented in TV_IMPLEMENTATION.md.

## 2026-09-12 TV implementation candidate

Added the Android TV/shared Tizen-Vizio implementation checkpoint and owner-requested deferred joint testing. No Roku behavior or visual contract changed.

## 2026-09-12 — Resume identity extraction correction

Corrected the behavioral contract from addon plus human source name to addon plus nonempty server-authored source fingerprint. `Util.brs:45–59` at the frozen Roku revision already requires fingerprint equality. This repairs an extraction error; it does not change Roku or introduce a new UX. Added same-name/different-fingerprint and legacy missing-fingerprint acceptance cases.

## 2026-09-13 — Shared TV-web rebuild and design synchronization

Authorized the Roku-matching presentation replacement for the shared Tizen/Vizio frontend. TV_WEB_UI_REBUILD.md indexes complete screen/state acceptance against the existing normative visual and interaction specs without duplicating geometry. DESIGN_SYNC.md defines immutable design adoption, vendored snapshot/asset integrity, separate freshness checks and per-platform parity evidence. Figma-first authoring is proposed for a future explicit adoption decision; the versioned design repository remains authoritative. No completed visual or device acceptance is claimed here.

## 2026-09-13 — Rail and action alignment extraction precision

Corrected the rail origin, row spacing and V-mark geometry from frozen Roku MainScene.xml, and made ActionRow horizontal/vertical centering explicit for Settings. These are source-backed extraction corrections, not Roku changes. Documented the shared TV-web existing source-quality filter as a retained implementation adaptation with explicit acceptance and parity limits; no owner-approved exception or completed parity is claimed.

## 2026-09-13 — Shared TV rebuild delivery

Recorded the shared React replacement, scoped 43-unit/49-browser validation, Settings/Search comparisons, source-filter difference, and immutable sync/PR workflow in TV_WEB_UI_REBUILD.md (removed; see git history). Physical TVs and other matched-content visual states remain pending.

## 2026-09-14 — Responsive history and populated-card corrections

Specified RUI-023 in RESPONSIVE_PRODUCTION.md (removed; see git history): actual page history and return context, top-left Back, OLED in Settings, direct live-channel activation, real Continue Watching semantics, stacked hero focus stability and contained live logos. These are owner-requested corrections under implementation; browser and hardware results remain separate evidence.

## 2026-09-17 — Shared platform matrix and playback consolidation decision

Recorded the accepted platform matrix (shared tv-web UI for web, Tizen, Vizio and desktop; Android keeps its own UI; no transcode on Android and desktop, probe-first on web, native-preferred on Tizen, managed-allowed on Vizio), the WebCodecs-not-WebAssembly browser gate, the verified absence of a deployed Vizio cast receiver, and the decision that tv-web's player stack becomes the canonical implementation moved into the video package while video's guest-js backends are replaced. No behavior changed; Roku remains the frozen baseline. See [docs/adr/0003-shared-platform-matrix-and-playback-consolidation.md](docs/adr/0003-shared-platform-matrix-and-playback-consolidation.md).

## 2026-09-18 — Desktop-first layout specification
 
Recorded the desktop shell decisions: a non-expanding left sidebar, no max
width with a window minimum instead of mobile breakpoints, hover/focus card
affordance, a hero with its own catalog-mix data decoupled from Continue
Watching, and card selection navigating directly to the info page instead of
mutating the hero. The layout shares tv-web components per the
shared-platform matrix; implementation is tracked separately.

## 2026-09-19 — Desktop frameless titlebar and sidebar refinement

Specified the integrated 30px desktop titlebar spanning the full width of the
window with isolated drag regions and no-drag button isolation, a 54px compact
left sidebar anchored beneath the titlebar, and scrollbar slot containment
starting beneath the header.

## 2026-09-20 — Desktop window decorations, player overlay, and selector UX

Specified frameless Wayland window resizing via 8-zone directional handles and
native outline/rounding (`10px`), titlebar focus elimination (`tabIndex={-1}` and
transparent focus override), back navigation in desktop header, windowed player
titlebar retention with fullscreen toggle, 2.5s player controls timeout, grey
buffered seekbar progress, live TV mute toggle semantic, sleek anchored audio and
subtitle popup cards with active track indicators, fixed 44x44 action buttons, and
compact 60px live TV channel rows.



## 2026-09-21 — Proposed local addon mode contract

Added [LOCAL_MODE.md](LOCAL_MODE.md) proposing account-free operation of the shared viewing client from an on-device addon registry: build-level availability (never in the backend-hosted flavor), sign-in-screen entry, a versioned registry schema with install/remove/error states, discover reuse of the RUI-030 hierarchy with the shared negotiation rules, direct-first playback without server sessions, and privacy rules treating manifest URLs as credentials. Watch-state is explicitly out of scope. Status: proposed; no adoption is claimed for any platform.

## 2026-09-21 — Local addon mode schema amendment

Amended LOCAL_MODE.md LM-002: the registry stores `nextOrdinal` and each addon a stable `ordinal` (a monotonic install counter, never reused) so addon selection survives restarts and removals. No other behavior changed.
