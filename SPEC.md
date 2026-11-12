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
Home and focused shelf backdrops stay sharp and occupy the right-hand 1440×810
rectangle at (480,0). A packaged smooth scrim keeps the title/logo area mostly
black and fades the artwork into the shelf below. Preview decoding stays bounded
at 960×540; the prepared nodes are reused through replacement. Focus settles for
120ms before preparing a replacement, and the displayed artwork remains until
readiness. The portrait preview remains 240×360 at (1584,144).

The owner-scoped presentation contract in [TV-web #114](https://github.com/viptv-org/tv-web/issues/114)
supersedes this client's earlier blurred/full-width Home composition and loading
copy, without claiming adoption by other clients or moving DESIGN_REF. The
supplied owner image is a composition reference only. Canonical scoped authority is
[TV-PRESENTATION-114](https://github.com/viptv-org/design/blob/3eb55db3fd248621bbf56dc30e8718450280c767/docs/platforms/TV_PRESENTATION_REFINEMENT.md)
and its [copy catalog](https://github.com/viptv-org/design/blob/3eb55db3fd248621bbf56dc30e8718450280c767/viptv-design-system/copy.md).
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
