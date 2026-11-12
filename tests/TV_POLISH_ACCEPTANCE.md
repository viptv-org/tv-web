# TV polish acceptance

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

## Foundation and platform requirements

- [x] Qualify navigation and artwork latency on the real Roku, including the My List
      row on Home; distinguish API refetch, image readiness and input handling.
- [x] Audit Program, Render and Task thread ownership; use real background execution
      where supported and keep synchronous CPU work from blocking navigation.
      Document unsupported worker APIs honestly and verify cancellation/cleanup.
- [x] Establish meaningful headless native-host tests and native TypeScript checks;
      compiler/bundler success alone does not prove firmware behavior.
- [x] Split large application and native-adapter modules into small focused files
      after behavior/performance is verified; remove fragile build-time patches
      where a proper pinned framework fix can replace them.
- [x] Complete the whole-app UI and functionality sweep after performance work.
      Browser, real-API and physical Roku coverage is recorded in TESTING.md;
      unavailable hardware and exact historical sequences remain explicit limits.
- [x] Investigate early PlayStation logout, including refresh rotation, cross-window
      coordination, storage and suspended-browser recovery; preserve revocation safety.
- [x] Support LG webOS and Samsung Tizen packaging, remote input, playback and recovery;
      test official emulators where feasible and browser/vendor API boundaries.
      No physical LG/Samsung devices are available; report that qualification limit.

## Newly reported focus regressions

- [x] Restore each Home row's last focused card and horizontal position on vertical return.
- [x] Keep top-navigation movement from scrolling or changing Continue Watching.
- [x] Reset recycled shelf positions before they enter view; verify WebGL, Canvas and Roku behavior within their recorded test scope.
- [x] Audit the other screens and overlays for the same shared-index/state leakage.

## Hero, artwork and motion

- [x] Remove the hero logo's horizontal entrance/teleport; use a short, simple fade.
- [x] Coordinate backdrop, transparent logo and metadata as one stable presentation;
      prevent independently arriving art and repeated description disappearance.
- [ ] Reproduce the reported Collision Course (2026) metadata flash and distinguish
      stale callbacks, incomplete updates and mixed provider origins. Current real
      catalogue/detail payloads confirm sparse versus full metadata; replay retains
      the synopsis within one authority. The original visual timing was not recaptured.
- [x] Remove the unwanted white/gray hero band and keep navigation gradients beneath
      navigation labels, icons and focus treatment.
- [x] Improve transparent-logo sizing within a stable layout slot, preserving aspect
      ratio and avoiding layout displacement or ad hoc scaling.
- [x] Use the owner-selected public image proxy for focused-backdrop blur; verify
      the processed image and keep filtering off the Roku client.
- [x] Align the hero portrait preview with the profile edge and add clear vertical
      spacing below the avatar; verify browser geometry and the physical Roku.
- [x] Preserve the Home rows' fixed focus anchor while replacing card teleportation
      with smooth group motion. Check vertical transitions and fast repeated input.
- [x] Compare implementation and device traces with the Solid TV demo's examples.

## Spacing, loading and screens

- [x] Review all screens and overlays, beyond the examples explicitly reported.
- [x] Reduce excessive separation between browse filters and their catalog/trending
      control; apply consistent padding and gaps on Movies, Series and Anime.
- [x] Center and coordinate player buffering text/spinner without overlapping labels.
- [x] Size short error/confirmation dialogs to their content with consistent padding;
      the sign-in recovery message must not occupy most of the display.
- [x] Align the welcome wordmark/V mark and sign-in action as a coherent group.
- [x] Check a single composed welcome background instead of many independently loaded
      poster images, retaining the existing visual direction.
- [x] Refine profile-selection and pre-profile loading spacing and transitions.
- [x] Recheck captions, focus, drawers, empty/error states, calendar and player layout
      for clipping, inconsistent alignment, unnecessary motion and layout shifts.
      Caption paint is browser/LG-simulator evidence; physical Roku captions remain unqualified.

## Episodes and session behavior

- [x] Compare app's Android TV season strip and phone/desktop picker; verify the compact TV-web chooser's remote behavior.
- [x] Use the supplied special-season name, or an appropriate Special(s) label, rather
      than exposing the implementation value “Season 0”.
- [x] Default to a regular season when one is available. Preserve an explicitly chosen
      special season or an actual resume target in it; keep those episodes accessible.
- [x] Verify Roku sign-in and selected profile survive normal app exit/relaunch;
      distinguish registry persistence from expired/revoked server credentials.
- [x] Retain the latest credential generation and signed-out state across an OS
      reboot. Package 11142 passes three verified restart boundaries, including
      exact prelaunch credentials and playback settings; see TESTING.md.
- [ ] Exercise real playback, source reuse, paused/playing seek, track controls,
      intro/next/autoplay, controls hiding, source failures and Back recovery.
      Real Roku playback/seek/Back and earlier episode handoff are qualified; the
      complete physical marker/track matrix and audible/lip-sync checks remain open.

## Latency, images and shared metadata caching

- [x] Measure network preparation, UI processing, image readiness and rendering
      separately; do not label a network delay as a rendering fix or vice versa.
- [x] Reuse existing image proxy facilities such as wsrv with appropriate decode sizes,
      transparent-image handling and caching; avoid duplicate artwork work.
- [x] Use aggressive shared caching for public Cinemeta metadata, with a documented
      refresh/invalidation policy suitable for movies versus changing series/episodes.
- [x] Inspect actual API response personalization before considering Cloudflare caching.
      Auth/profile/watch-state/source-credential data must remain correctly isolated.
- [x] Prefer caching raw public provider metadata on the backend if current API routes
      cannot safely share an edge cache. Do not redesign the API solely for caching.
- [x] Add no heavyweight client metadata cache or persistent client image database;
      keep decoded images and temporary presentation state bounded on weak devices.
- [ ] Record before/after native frame timing, input/navigation latency, artwork readiness
      and memory across repeated navigation; leave unsupported targets explicit.
      Repeated frame traces and input/art readiness are recorded. Shelf/decode bounds
      are verified, but they are not a full process/GPU memory measurement.

## Deferred account handoff

- [x] After testing, create the requested dedicated beta account using the privately
      supplied credentials. Configure Cinemeta, VIPTV Sources and TorrentioTB, with
      no Simkl connection. Do not repurpose the existing test account or change global
      provider behavior to accomplish this. Never place account credentials in Git.

## Initial physical-device findings (historical)

The first hot sideload was accepted but did not initialize the UI. An unminified
diagnostic and an older working package also stalled. A device restart followed by
stopping the diagnostic app, installing the current package without auto-launch and
launching it explicitly restored startup. This suggests a stuck device/runtime state;
the exact hot-replacement cause remains unproven. That early native package contained
718945 JavaScript bytes and no browser Canvas renderer modules.

That early build reached beta sign-in, profile selection and Home. Private native
captures also cover Movies, Series, Anime, Calendar, My List, Live and movie details.
These initial observations are not completion of the checklist above. Evidence and
final disposition belong in TESTING.md and tests/PARITY_MATRIX.md after verification.

Implementation is tracked in tv-web #103 with backend caching in backend #308.
The focused browser artwork, season and motion scenarios pass. Current delivery,
account handoff and remaining qualification limits are recorded in TESTING.md.
