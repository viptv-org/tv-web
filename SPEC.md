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
Focused shelf backdrops use Gaussian blur through the existing public image proxy.
Their 960×540 decode target is independent of the 1920×1080 display rectangle;
blur sigma scales with source width (8 at 960px). Focus settles for 120ms before
preparing a replacement, and the displayed artwork remains until readiness.
The portrait preview is 240×360 at (1584,144), aligned to the 96px right inset with
50px clearance below the profile avatar. Roku uses packaged scrims. Recovery dialogs
and player busy indicators share compact, consistently padded layouts.

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
slots reset to their new row's position before painting.

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
