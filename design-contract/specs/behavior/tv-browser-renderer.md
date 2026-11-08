# TV-RENDERER-001 — Browser renderer fallback

Status: proposed for the shared SolidTV viewing client. The owner requests
automatic Canvas 2D fallback for the PS4 browser and square startup controls.

At launch, use the existing WebGL renderer when its context is available.
Otherwise load the existing SolidTV Canvas renderer and Canvas text engine.
Both render the same application components, server data, 1920 × 1080 layout,
focus order, images and playback controls. Do not introduce another application,
renderer chooser or platform-specific source-selection policy. Roku retains its
native SceneGraph host.

Scale the authored canvas uniformly to fit the available browser viewport,
including a console window with browser chrome visible. Center it without
cropping controls. Startup does not request browser fullscreen.
Pointer activation of Sign in uses the displayed canvas bounds and starts the
same pairing flow as Enter. Canvas precomposes the GPU-only welcome treatment
into a static wall; it does not redraw a static image on every animation frame.
PS4 Cross page clicks activate the currently focused TV item through the shared
Enter path. Directional navigation remains unchanged; native HTML controls keep
their browser click behavior. An already handled native Enter must not activate
the item again through its following click.

Canvas text updates keep the currently loaded glyph texture until the replacement
is loaded, then swap it atomically. Empty text clears immediately; superseded or
destroyed labels release pending resources. Do not blank labels between updates.

Hosts with unreliable native video frame reporting may explicitly use observed
playback time advancing across wall-clock samples as presentation evidence.
A native engine need not repeat `playing` or update frame/ready-state APIs.
Buffering notifications do not erase clock evidence; seeks and pauses reset the
sampling window. Advancing media recovers a stale buffering state without waiting
for another `playing` event. This also applies to ordinary HTML playback when
its decoded-frame APIs establish video presentation.
Do not invent a frame count. Keep ordinary frame-counter checks and failure bounds
on other hosts, and reject metadata-only, seek-only or stalled observations.
Control auto-hide measures five seconds of viewer inactivity; routine position
and buffer snapshots must not restart that timer. After presentation succeeds,
mid-playback buffering does not initiate another automatic source attempt.

Load the selected backend's fonts before mounting text. Canvas uses browser
fonts with the existing family names and metrics; it does not request SDF
atlases. A WebGL launch must not fetch the Canvas backend. Native browser video
remains separate from UI rendering and uses the current playback adapter.

If neither backend or the selected backend's required assets can start, retain
the existing recovery cover: “VIPTV could not start.” and “Try again”. The logo
tile and recovery button have square corners. Circular progress indicators
retain their circular shape. Retry reloads the entry and probes again without
clearing credentials, remembered source choices or device settings. Error focus,
Enter activation, browser Back and the existing startup timeout remain unchanged.

All normal screen press/release/repeat behavior and the 700 ms source-selection
hold remain shared. There is no renderer switch during a running playback
session. A context loss uses the existing host recovery behavior.

Acceptance:

- A WebGL-capable browser starts the shared application through v2 and fetches
  no Canvas backend or Canvas fonts.
- With WebGL unavailable, a real Canvas 2D context renders welcome, pairing,
  Home, detail and player controls. Focus, image readiness, source memory,
  prepared Next and autoplay retain their normal behavior.
- Both paths preserve text wrapping, clipping and alpha. Inspect reference
  states separately; passing functional checks does not establish pixel parity.
- Startup failure has a square logo tile/button and remains retryable. Both
  unavailable-context and failed-font cases preserve saved state.
- Browser simulation qualifies only the exercised backend and input boundary.
  PS4 firmware, controller input and actual media require physical evidence.
