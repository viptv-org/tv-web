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
