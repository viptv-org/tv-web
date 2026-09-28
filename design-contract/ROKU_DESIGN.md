# ROK-042 — Native Roku design-system adoption

Status: owner authorized 2026-09-27. This replaces the extracted Roku visual
baseline with the current TV design system. Native SceneGraph, account/profile
IDs, source intent, 700 ms holds, Back restoration and playback remain owned by
the Roku implementation. Reference states: TvHome, TvMenu, TvTitle, TvSources,
TvProfiles, TvProfilesManage, TvProfileEdit, TvAvatars, TvSettings, TvSearch,
TvLive, TvMoreInfo and TvPlayer families.

Roku retains its HD logical canvas (1280×720). Design coordinates are scaled by
2/3 from 1920×1080: safe area 64×36, rail 96 wide (expanded 347), content x128,
Home cards 213×120 with 24 horizontal spacing, profile artwork 146 square,
action pills 48 tall, section headings 21 and body 17–19. Bundle Onest and
Bricolage Grotesque TrueType fonts and the design-owned Lucide PNG variants.
Use the #0B0B0C ground, #161618/#212124/#2A2A2E surfaces, #F4F2EE text,
#B6B4AF metadata and #F5C542 progress/spinners. TV action buttons use a neutral surface when unfocused and off-white when focused;
Resume follows TV-038 and retains the selected accent (default yellow) in both states. Pill radius is half its height. Draw a continuous
3px white focus border inside the fixed control bounds so native grid clipping
cannot trim its top/left edges; fill and border share one contour. Circular
controls remain circles at the HD canvas on both HD and FHD devices.
Focus never scales artwork,
controls or captions; it uses a white ring and the established focus fill.

Home retains its bounded native RowList and per-row cursor restoration. The
first shelf and hero fit together; lower rows remove the hero and use the
screen's safe area. No row counters or passive key legends. Each focused card
and ring must be fully visible; Left/Right stay in the same row and stop at its
ends. The hero uses landscape artwork, a soft ambient layer, left/bottom
scrims, logo-or-title, episode/progress when present, facts, two synopsis lines,
and icon-led Play/Resume and Details. Detail uses the same artwork treatment,
without the old portrait column. Missing art keeps a legible title fallback.

Native adaptations: Roku's decoded low-resolution ambient texture supplies
the soft backdrop without a custom blur shader. Episode browsing uses the TvTitle horizontal episode strip under the complete
title hero and actions. Up always returns to Season; Down restores the episode.
Roku Keyboard/MiniKeyboard remain the text and PIN input controls. These
adaptations must be recorded independently from exact reference-image parity.

Profiles retain native create/edit/avatar/delete/PIN and paging. The chooser
centres its people tiles and compact icon-led Manage/Done action. The editor
uses avatar left, name and Save/Cancel/Delete right. Selection and return focus
remain stable across mutations and cancelled PIN/delete flows. Primary profile
deletion remains unavailable. Settings and choice lists use rounded rows; modal
choices and source selection use the 547px right panel over a scrim. Source
rows retain complete details through the existing Info action.

Player uses the same fonts, Lucide transport icons, separate circular controls,
accent progress, title/status at the top, and title/episode/timeline/controls in
the lower safe area. Movies omit the episode line. Live retains its passive
programme progress and audio/captions/exit controls. Preparation and buffering
retain visible spinners; track/seek/Next cancellation and rollback are unchanged.

Acceptance: compile and package fonts/assets, validate immutable asset hashes,
run existing profile, source, seek, continuation, guide and return-focus
contracts; add checks for palette, font packaging, icon variants, no scaling,
Home row geometry, detail landscape layout and right panels. Check networkless
visual fixtures where a renderer is available. Physical Roku installation is
separate from source/package validation and requires an explicit device request.

## ROK-042 hardware close inspection corrections (2026-09-27)

The first physical install exposed a clipped ActionRow ring, inconsistent
nine-patch corner scaling, an obsolete 256×144 episode backing under 240×135
artwork, and truncated hero context/synopsis. Correct these against the existing
TV reference states. Home context separates compact S/E identity from elapsed
and total time; allow the synopsis two full lines. Keep profile actions centred,
icons aligned, and all card backgrounds, artwork, progress and rings within
the same bounds. TV card focus remains an outline without scale.

Remote press/release/hold, source choice, profile edits and cancellation retain
their established behavior. Acceptance on physical hardware: inspect Resume,
Details and icon-only focus at each grid edge; inspect profile Manage/Done,
name/Save/Cancel, avatar picker, Settings, Discover, series episodes, movie
detail, source panel, lower Home shelves and player controls. Check rightmost
Home card visibility and row boundaries, then Back focus restoration. Record
which states were actually reached; visual inspection does not authorize
destructive profile or account operations.

## ROK-043 — Complete TV screen audit and catalog correction

Owner requested 2026-09-27 after physical review. This supersedes conflicting
ROK-042 adaptations and extends TV-034/038/040/041 to native Roku presentation.
Reference HTML/images remain the baseline; later owner corrections take priority.
Resume is accent yellow with dark text and a white focus border, never scaled.

- Home retains personal shelves, then every enabled Stremio catalog in manifest
  order with addon/catalog identity. No synthetic Trending/Popular replacement
  for the full catalog inventory. Keep descriptor rows lightweight; load visible
  rows and one ahead, at most two catalog requests in flight, retain at most five
  catalog payloads around the viewport. Empty rows disappear; failed rows expose
  Retry. Required-filter rows open their actual catalog filters. Pagination is
  cursor-driven, deduplicated, stops on repeated/empty/non-advancing pages, and
  rejects stale profile/route completions. Returning restores the logical row.
- Expanded Home keeps the hero and first shelf. The lower browsing viewport
  shows three complete shelves: HD row pitch 214, 213×120 art, 24px horizontal
  gaps, captions inside each row; first heading y48 and final caption before684.
  Expanded hero spacing remains unchanged. Right stays in its own shelf.
- Card textures must cover the actual graphics-plane pixel dimensions, not just
  logical HD coordinates. Prefer real landscape metadata over enlarged portrait
  crops; sharp art never shares the low-resolution ambient texture.
- TvTitle: complete logo/title, facts, two-line synopsis and primary/source/My
  List/More info actions remain above Season and one horizontal episode strip.
  HD season y403, episode art y455, 240×135 thumbnails. Movies omit season and
  episodes without leaving placeholder controls. Back restores originating card.
- TvLive: programme identity/title/time/progress/next at the top, contained channel
  artwork preview at the right, horizontal scrollable categories below, then the
  channel-number/logo/name column and rounded programme cells on a timeline.
  HD content starts x128, category y250, timeline y307, rows y343 at67px pitch.
  Up from first channel reaches categories, Left/Right moves categories, OK/Down
  enters guide, Back reaches the main rail. Programme-window semantics remain.
  The rail expands above every browsing surface, including guide categories.
- Discover retains separate type and catalog/filter rows; all catalogs remain
  reachable. Source and track choices use the right panel. Full title information
  includes an actionable Close control. Profiles, editor, avatar picker, Settings,
  search, sources, player, loading, empty/error and confirmation states are audited
  against their reference families; no blanket parity claim from compilation.

Acceptance: test 100 catalog descriptors without sweeping requests, a slow and
failed catalog, eviction/refetch, cursor termination and profile/route cancellation;
show three populated shelves on hardware; inspect texture dimensions; inspect
movie and series title composition; traverse an episode strip longer than eight;
inspect Live header/categories/programmes and expanded rail above them; check
Resume accent and all primary action focus states. Publish per-screen evidence
and explicit remaining differences separately from automated checks.

ROK-043 audit follow-through: Search uses the six-column TvSearch keypad with
rounded keys and Lucide Space/Backspace/Delete, retaining mobile literal input.
My List exposes My List and Continue Watching segments. Programme details use
the TvLiveDetails side panel with explicit Watch and Close actions. PIN and
full text-entry still retain the native input semantics while using the shared
full-screen surface; these controls are never described as measured pixel parity.

## ROK-044 — Hero episode identity and measured inline progress

Owner correction, 2026-09-27. The earlier audit missed an absent episode title
in its own device captures; inventory coverage is not evidence for this state.

Home series context is `S2 E1 · [actual episode title]`, using the queued title
or the matching video in the series metadata. Match exact episode ID first,
then verified season/episode within the same series; never use another episode
or substitute the series title. Preserve logo and rating through the same cache
projection. Keep only episode titles needed by the current queue/context, and
reject stale metadata ownership. An unavailable title falls back to coordinates.

This overrides the earlier fixed-width episode column: measure the displayed
single-line context, cap long text at 340 HD pixels with ellipsis, then place the
120px progress bar 12px after it and elapsed/total text 12px after the bar. Short
or missing titles must not leave a reserved empty column. Movies omit episode
context and start progress at the normal left content edge. Unknown/zero duration
must not leave an empty progress slot. Metadata, progress and elapsed labels share
a centerline. The bar and label remain inside their allocated bounds.

Acceptance covers title supplied in the queue, title resolved from metadata,
short/long/unavailable titles, exact-ID versus S/E matching, specials (season 0),
Up Next, missing/zero progress, movies, logo/rating hydration, metadata arriving
after focus changes, and a changed episode of an already cached series. Verify
actual title text and measured adjacency on the physical TV; do not infer success
from a build, a screen-name checklist or an unrelated screenshot.

The same matched episode title must reach Continue Watching card captions.
Use compact `S2 E1 · [episode title]` there; include elapsed time only when the
short title fits. Long titles ellipsize inside the 213px card caption without
scrolling on focus. Metadata updates keep the caption in the same format as the
initial render. Focus changes the ring and caption contrast, never card size or
caption position. Movies show resume time without an empty episode field.

Direct playback of a series from an unloaded Home card must also show the
matching episode title in player chrome. Resolve it from already fetched
metadata or request that series metadata alongside source discovery. The title
request never blocks playback, survives preparation's transport cleanup only
while owned by the same account/profile/episode, and cannot relabel a later
session. Back and next-episode focus/identity continue to use the original
playback route. Verify a fast selection before card metadata arrives and a late
response after switching episodes or profiles.
