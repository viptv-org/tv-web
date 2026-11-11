# TV polish acceptance — 2026-11-09

Owner-requested refinement of the existing shared TV app, without a redesign or
framework migration. Roku performance work covers both the SolidTV fork/native
host and tv-web. Read app's Android TV UI as a reference. Backend changes are permitted for server-side
metadata caching; investigate Cloudflare suitability before changing caching rules.
Keep credentials, device identifiers and private captures outside Git.

## Execution priority and evidence gates

1. Establish physical Roku baselines for vertical scrolling, horizontal repeats,
   reversals and artwork transitions. Record input acknowledgement, JavaScript
   stalls, native synchronization and actual visual motion separately. Aggregate
   render FPS alone cannot qualify scrolling.
2. Fix the measured bottlenecks in the SolidTV fork/native host and VIPTV. Evaluate
   render-thread animation, bounded node reuse and prioritized visual publication;
   preserve shared sources, clipping, focus order and animation lifecycle behavior.
3. Add headless TypeScript/native-adapter regression coverage and investigate the
   available native blur path and its measured cost. In-memory SDK tests establish
   behavior, not Hermes compatibility, GPU performance or physical presentation.
4. Complete the artwork, spacing, player, loading, season and session checks below,
   preserving browser and PS4 behavior. UI polish follows Roku performance work.
5. Run final real-media and physical-device acceptance, provision the dedicated
   beta account as specified in the private handoff, verify persistence and leave
   a working app. Commit/push verified changes and qualify beta served artifacts;
   retain explicit gaps rather than declaring untested requirements complete.

All remaining checklist items stay in scope. Performance completion requires
repeatable physical-device evidence, including fast vertical reversals under
image loading; a unit-test pass or high average FPS is insufficient.

## Hero, artwork and motion

- [ ] Remove the hero logo's horizontal entrance/teleport; use a short, simple fade.
- [ ] Coordinate backdrop, transparent logo and metadata as one stable presentation;
      prevent independently arriving art and repeated description disappearance.
- [ ] Reproduce the reported Collision Course (2026) metadata flash and distinguish
      stale callbacks, incomplete updates and mixed provider origins.
- [ ] Remove the unwanted white/gray hero band and keep navigation gradients beneath
      navigation labels, icons and focus treatment.
- [ ] Improve transparent-logo sizing within a stable layout slot, preserving aspect
      ratio and avoiding layout displacement or ad hoc scaling.
- [x] Use the owner-selected public image proxy for focused-backdrop blur; verify
      the processed image and keep filtering off the Roku client.
- [x] Align the hero portrait preview with the profile edge and add clear vertical
      spacing below the avatar; verify browser geometry and the physical Roku.
- [ ] Preserve the Home rows' fixed focus anchor while replacing card teleportation
      with smooth group motion. Check vertical transitions and fast repeated input.
- [ ] Compare implementation and device traces with the Solid TV demo's examples.

## Spacing, loading and screens

- [ ] Review all screens and overlays, beyond the examples explicitly reported.
- [ ] Reduce excessive separation between browse filters and their catalog/trending
      control; apply consistent padding and gaps on Movies, Series and Anime.
- [ ] Center and coordinate player buffering text/spinner without overlapping labels.
- [ ] Size short error/confirmation dialogs to their content with consistent padding;
      the sign-in recovery message must not occupy most of the display.
- [ ] Align the welcome wordmark/V mark and sign-in action as a coherent group.
- [ ] Check a single composed welcome background instead of many independently loaded
      poster images, retaining the existing visual direction.
- [ ] Refine profile-selection and pre-profile loading spacing and transitions.
- [ ] Recheck captions, focus, drawers, empty/error states, calendar and player layout
      for clipping, inconsistent alignment, unnecessary motion and layout shifts.

## Episodes and session behavior

- [ ] Compare app's Android TV season strip and phone/desktop picker; verify the compact TV-web chooser's remote behavior.
- [ ] Use the supplied special-season name, or an appropriate Special(s) label, rather
      than exposing the implementation value “Season 0”.
- [ ] Default to a regular season when one is available. Preserve an explicitly chosen
      special season or an actual resume target in it; keep those episodes accessible.
- [ ] Verify Roku sign-in and selected profile survive normal app exit/relaunch;
      distinguish registry persistence from expired/revoked server credentials.
- [ ] Exercise real playback, source reuse, paused/playing seek, track controls,
      intro/next/autoplay, controls hiding, source failures and Back recovery.

## Latency, images and shared metadata caching

- [ ] Measure network preparation, UI processing, image readiness and rendering
      separately; do not label a network delay as a rendering fix or vice versa.
- [ ] Reuse existing image proxy facilities such as wsrv with appropriate decode sizes,
      transparent-image handling and caching; avoid duplicate artwork work.
- [ ] Use aggressive shared caching for public Cinemeta metadata, with a documented
      refresh/invalidation policy suitable for movies versus changing series/episodes.
- [ ] Inspect actual API response personalization before considering Cloudflare caching.
      Auth/profile/watch-state/source-credential data must remain correctly isolated.
- [ ] Prefer caching raw public provider metadata on the backend if current API routes
      cannot safely share an edge cache. Do not redesign the API solely for caching.
- [ ] Add no heavyweight client metadata cache or persistent client image database;
      keep decoded images and temporary presentation state bounded on weak devices.
- [ ] Record before/after native frame timing, input/navigation latency, artwork readiness
      and memory across repeated navigation; leave unsupported targets explicit.

## Deferred account handoff

- [ ] After testing, create the requested dedicated beta account using the privately
      supplied credentials. Configure Cinemeta, VIPTV Sources and TorrentioTB, with
      no Simkl connection. Do not repurpose the existing test account or change global
      provider behavior to accomplish this. Never place account credentials in Git.

## Initial physical-device findings

The first hot sideload was accepted but did not initialize the UI. An unminified
diagnostic and an older working package also stalled. A device restart followed by
stopping the diagnostic app, installing the current package without auto-launch and
launching it explicitly restored startup. This suggests a stuck device/runtime state;
the exact hot-replacement cause remains unproven. The current native package contains
718945 JavaScript bytes and no browser Canvas renderer modules.

The current build reaches beta sign-in, profile selection and Home. Private native
captures also cover Movies, Series, Anime, Calendar, My List, Live and movie details.
These initial observations are not completion of the checklist above. Evidence and
final disposition belong in TESTING.md and tests/PARITY_MATRIX.md after verification.

Implementation is tracked in tv-web #103 with backend caching in backend #308.
The focused browser artwork, season and motion scenarios pass; final physical
acceptance and the account handoff are still pending. See TESTING.md.
