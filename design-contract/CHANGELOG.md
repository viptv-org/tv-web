# Design changes

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

Recorded the shared React replacement, scoped 43-unit/49-browser validation, Settings/Search comparisons, source-filter difference, and immutable sync/PR workflow in [TV_WEB_UI_REBUILD.md](TV_WEB_UI_REBUILD.md). Physical TVs and other matched-content visual states remain pending.

## 2026-09-14 — Responsive history and populated-card corrections

Specified RUI-023 in [RESPONSIVE_PRODUCTION.md](RESPONSIVE_PRODUCTION.md): actual page history and return context, top-left Back, OLED in Settings, direct live-channel activation, real Continue Watching semantics, stacked hero focus stability and contained live logos. These are owner-requested corrections under implementation; browser and hardware results remain separate evidence.

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
