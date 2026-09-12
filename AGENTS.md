# viptv TV web development

Read DESIGN_REF, SPEC.md and the referenced viptv-org/design visual and behavior contracts before changing product behavior. This one frontend serves Tizen and Vizio; only src/player adapters and platform packaging differ. Preserve Roku action meaning, 700ms hold, focus restoration, explicit source intent and controlled Next. Platform decoder differences do not justify deleting product features.

Tests exercise remote UI, backend HTTP and playback adapter interfaces. Run unit/integration tests, production build and Playwright acceptance for changes. Mock only external platform/network boundaries. Inspect screenshots locally for layout but keep screenshots out of source/design/release files. Report browser simulation, real media and actual TV evidence separately; never claim 100% device coverage from simulated AVPlay.

Use GitHub issues in viptv-org/tv-web and design issue #4. Keep user data/secrets private. Playback prefers direct/copy/remux before server transcoding. Build signed TV distribution artifacts only when required certificates are available; never include signing keys.

## Current validation constraint

The owner reported server OOM and explicitly deferred joint testing. Until they resume testing, use static review and a single TypeScript check capped at 256 MB; keep emulators, Gradle, browsers and builds stopped. CI workflows are manual on hosted runners. Record each unexecuted test in TESTING.md; preserve current work and never label a candidate as device-qualified.
