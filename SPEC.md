# Shared SolidTV viewing client

Implements viptv-org/design#4 and TV_IMPLEMENTATION.md at DESIGN_REF. One SolidTV application owns remote focus, the 700ms hold, screens and user actions across browser TVs and Roku. Browsers use the v2 WebGL renderer when available and lazily load the existing Canvas renderer otherwise. Roku uses native SceneGraph primitives. The backend remains authoritative for profiles, queue/history, source ranking and media preparation.

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
Roku uses packaged scrims and artwork rather than simulated blur. Recovery dialogs
and player busy indicators share compact, consistently padded layouts.

Public Cinemeta metadata caching and optional prepared clearlogos are provided by
the companion backend change. Authenticated metadata responses retain their
private cache policy; image and metadata preparation stay off constrained clients
where the server supports it. TESTING.md records browser and hardware acceptance
separately.
