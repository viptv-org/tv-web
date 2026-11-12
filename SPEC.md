# Shared SolidTV viewing client

Implements viptv-org/design#4 and TV_IMPLEMENTATION.md at DESIGN_REF. One SolidTV application owns remote focus, the 700ms hold, screens and user actions across browser TVs and Roku. Browsers use the v2 WebGL renderer when available and lazily load the existing Canvas renderer otherwise. Startup retires a WebGL context lost before initial mount and retries with a fresh Canvas renderer. Roku uses native SceneGraph primitives. The backend remains authoritative for profiles, queue/history, source ranking and media preparation.

Acceptance separates browser automation, actual media and physical-device evidence. The shared remote layout fits the available viewport without requesting fullscreen at startup. Playback uses the pinned video adapters and real media; direct/copy/remux remain preferred where supported. Signing, firmware, controller input and performance limits are recorded in TESTING.md.

Implementation checkpoint: IMPLEMENTATION.md. Spec issue: https://github.com/viptv-org/tv-web/issues/1. Execution/acceptance issue: https://github.com/viptv-org/tv-web/issues/2.

## Hosted entry

`/tv/`, `solid.html` and the legacy `lightning.html` alias start the same SolidTV application. Hosting packages contain the emitted TV import graph. The account/admin surface remains separately owned; publishing the TV bundle does not replace it. Native desktop hosts retain their own fullscreen, transport and decoder acceptance requirements.

## TV polish scope

The owner-authorized TV-web refinement keeps the design pin and other client
repositories unchanged. Hero artwork uses a short coordinated fade; logos have
no horizontal entrance or glow. The active and incoming artwork nodes are reused
through the fade, with a text fallback for failed artwork. Home keeps a fixed
focus anchor, reuses three shelves with up to twelve card slots each, and moves
vertical content under one parent transform. Only neighboring shelves and the
current/incoming hero remain prepared; there is no persistent client metadata or
image database. Image requests match the physical stage size.

The compact season chooser labels season zero “Specials”, initially focuses a
regular season, and retains explicit or resumed specials. Android TV's current
reference uses a strip; its phone/desktop surfaces use a picker. This TV-web
chooser is an owner-scoped refinement, not a claim that Android TV uses a dropdown.
Featured and Continue/single-image artwork stays sharp inside the right-hand
1440×810 clip at (480,0). Its image content grows by 4/3, centered at local
(-240,-135) with a 1920×1080 image; hero decoding remains bounded at 1440×810,
and focused single-image decoding at 1280×720. Other portrait shelf previews use
a full-width 1920×1080 backdrop, proxy blur 8 and bounded 960×540 decoding, with
the separate sharp 240×360 poster at (1584,144). The packaged black copy/lower
mask stays unchanged. No client-side blur or per-frame image work is added.
Focus settles for 120ms before preparing a replacement, and the displayed
artwork remains until readiness; prepared image nodes are reused.

Home logos share one animated bottom anchor, so current, incoming and retiring
branding follows the summary through cached or delayed shelf changes. Movie and
series Details both compact branding at (96,54), fitting 220×68, when focus enters
their lower lists. Summary/list geometry uses the same 220ms ease-out motion;
reduced motion applies final positions immediately. Layout changes scale the
loader's existing prepared logo dimensions without fetching or rasterizing a
replacement. Known pending logos reserve their space without a title flash;
absent/failed logos retain the title fallback. Detail skeleton/shimmer is unchanged.

The owner-scoped contracts in [TV-web #114](https://github.com/viptv-org/tv-web/issues/114)
and [TV-web #133](https://github.com/viptv-org/tv-web/issues/133) supersede the
named earlier composition/loading rules without claiming adoption by other clients
or moving DESIGN_REF. Canonical scoped authority is
[TV-PRESENTATION-114/133](https://github.com/viptv-org/design/blob/a24d507c6f1bdd0b86e4565c4a39922aa2999f9d/docs/platforms/TV_PRESENTATION_REFINEMENT.md)
and its [copy catalog](https://github.com/viptv-org/design/blob/a24d507c6f1bdd0b86e4565c4a39922aa2999f9d/viptv-design-system/copy.md).
DESIGN_REF deliberately remains at `059b76344f4fed0639bedf8f89e0bd6e2b22cecd`;
unrelated upstream design changes are intentionally not adopted in this scope.
The generated Home mask
lives in `scripts/build-tv-masks.py`; `scripts/build-tv-artwork.py` owns packaged
textures and provenance hashes. Detail retains the pinned backdrop composition.

Selected hero indicators use ordinary off-white geometry during running and
parked states across WebGL, Canvas and native SceneGraph; the featured rotation
still runs once and parks. The vertical row indicator occupies the gutter at
x=1848, outside the clipped card viewport ending at x=1824; its 220px height
clamps to y=806 so the bottom remains inside the 54px safe inset.

Details prepare with title, metadata, synopsis, action and recommendation shapes
at their final positions. A restrained opacity shimmer runs on one parent only;
reduced motion keeps it static. Source discovery and a selected source's opening
show the title/logo, sharp right artwork and a centered indeterminate progress
indicator, with “Press Back to cancel”. The underlying source list retains its
focus and errors; actual admission and first-frame state determine completion.
Recovery dialogs retain their real error/retry behavior. Player tools use 56px
heights, 22px icons and 12px gaps. Back dismisses menus, then visible controls,
then exits playback; busy activity can remain without forcing the controls open.
The native `Back` key and browser aliases share that order.

Player controls use the existing pinned TV shade ramps: a 260px top fade from
80% ink to transparent and a 700px bottom fade from transparent through 82% at
45% to 95% at the edge. A single generated mask replaces the flat full-screen
veil, leaving the middle of the video unchanged. Canvas, WebGL and native hosts
share the packaged mask; native rendering assigns it explicitly to the scrim
paint band. The mask mounts with the controls and retires when they hide or
playback exits, without changing the video surface or controls geometry.
Implementation scope: [TV-web #124](https://github.com/viptv-org/tv-web/issues/124).

Public Cinemeta metadata caching and optional prepared clearlogos are provided by
the companion backend change. Authenticated metadata responses retain their
private cache policy; image and metadata preparation stay off constrained clients
where the server supports it. TESTING.md records browser and hardware acceptance
separately.


## Native motion

Roku scroll containers and hero opacity transitions use render-thread SceneGraph
animations. Native groups preserve nested transforms, stationary clipping and
logical paint order. TypeScript owns target values and lifecycle state; native
acknowledgements complete each run. Unsupported easing/repeat modes retain the
JavaScript driver. Hidden-renderer pause/resume and disposal also control native
runs. Hero retirement waits for native completion. Motion layers are prepared
when shared views mount, and coordinate caches invalidate on geometry changes.


Home stores each row's focused card separately from the navigation bar. Vertical
return resolves that card's identity against the current row; missing cards clamp
to a valid position. Header navigation cannot move an inactive rail. Reused rendering
slots reset to their new row's position before painting. Rendering preserves the
server's card positions, including repeated media identities, so the visible focus,
preview and activation address the same card.


## HTML playback observations

Sparse-event console engines publish their media clock throughout playback,
including after pause/resume, explicit seek and episode replacement. Decoded
counters, playback-quality frame counts and compositor callback positions retain
their distinct meanings. Video progress is unavailable when native frame APIs
supply no usable evidence. Observed frame stalls never trigger an automatic seek,
restart, conversion or engine replacement. Admitted server actions reach the UI
before decoder preparation completes; paused and seek-preview ownership remain
independent of startup and superseded Play acknowledgements.

Usable media-clock progress permits startup without asserting a video frame.
Source-choice persistence and automatic Next preparation require the existing
adapter video/native evidence authority; clock-only HTML evidence does not
satisfy them. The legacy first-frame endpoint also acknowledges usable transport
startup: torrent sessions require that handshake to clear their independent
startup deadline. Its compatibility acknowledgement is not a verified-video flag. Playback-quality totals exclude
dropped frames when accepted as video output evidence.

Compositor callbacks take priority over playback-quality counters. Valid quality
counters require non-dropped output before source learning or Next preparation;
a decoded counter alone cannot override all-dropped output. Decoded-only evidence
is labeled `decoded-counter` when usable quality counters are unavailable.

## Provider subtitle timing prototype

On browser HTML video hosts with gateway external-caption support, Audio &
subtitles includes Find provider subtitles. Discovery uses server-scoped title
and metadata-origin selectors; selection sends only the opaque provider ID to
this playback's authenticated subtitle attachment API. Roku and AVPlay hosts do
not advertise this browser path.

Provider captions retain canonical VTT times and render through one reusable
native TextTrack, with at most one bounded active text cue. Original timing is
visible while optional gateway analysis runs. Accepted matching-generation
corrections apply at an observed cue gap or after at most five content seconds
through the shared bounded inverse projection. Pauses do not advance this wait;
backward seeks reanchor an unapplied wait and forward content jumps may satisfy
it. Coalesced revisions retain the initial deadline. Malformed accepted records
cannot advance identity/revision state.
The player adapter already reports title time, so caption lookup adds no second
origin. Caption selection/correction never reloads or replaces media.

Subtitle timing offers Earlier by 0.5 s, Later by 0.5 s, and Reset automatic
timing. Manual delay is separately additive and freezes automatic changes,
including late results. Reset removes manual delay and starts a fresh correction
generation; unsupported analysis reports Automatic timing unavailable. Stopping,
provider replacement and Off remove the cue, abort pending work and stop the
matching server generation. Same-source managed seeks preserve only explicit
provider/manual intent, reattach on the new lease after video opens, and validate
the subtitle hash and selected audio identity before restoring it. Automatic
mapping/confidence is never copied. Changed source/audio/content, Off, exit or a
new selection reject stale reattachment. Stale responses cannot alter a
replacement selection.

Automatic timing is a disabled-by-default gateway prototype. Its speech/offset
confidence, timestamp mapping, added resource cost and paired playback impact
require qualification. Native HLS Safari and physical TV behavior are separate
acceptance gates. The standalone browser mechanism script uses an owned silent
WAV with mocked authenticated transport; it does not qualify gateway audio or
full playback timing.

The canonical provider-caption flow is advertised by delivery field
`provider_subtitles_version: 1`; older backends keep the new browser controls
hidden. External SRT attachment responses remain compatible with existing clients.

Subtitle interaction adoption follows the immutable
[subtitle synchronization contract](https://github.com/viptv-org/design/blob/3eb55db3fd248621bbf56dc30e8718450280c767/specs/behavior/subtitle-synchronization.md).
The authorized narrow behavior adoption retains the pinned visual baseline in
DESIGN_REF; unrelated design assets and upstream behavior are outside this change.

Missing or unavailable optional synchronization retains the revalidated canonical
provider/manual view across a seek. Returned audio/hash mismatches and authority
failures still reject restoration.

Hidden player Select pauses and reveals Play controls unless an independently
visible Skip intro/recap shortcut owns that press. Visible controls retain their
selected action. MediaPause and pause toggles reveal controls immediately; they
stay visible while pause is pending or playback is paused. Back may hide paused
controls without stopping playback. Resume restores the ordinary idle timeout.
New source admissions, including Next, retire pending transport chrome ownership;
late completion or failure from the outgoing command cannot change the new chrome.
