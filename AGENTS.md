# viptv TV web development

Read DESIGN_REF, SPEC.md and the referenced viptv-org/design visual and behavior contracts before changing product behavior. This one frontend serves Tizen and Vizio; only src/player adapters and platform packaging differ. Preserve Roku action meaning, 700ms hold, focus restoration, explicit source intent and controlled Next. Platform decoder differences do not justify deleting product features.

Tests exercise remote UI, backend HTTP and playback adapter interfaces. Run unit/integration tests, production build and Playwright acceptance for changes. Mock only external platform/network boundaries. Inspect screenshots locally for layout but keep screenshots out of source/design/release files. Report browser simulation, real media and actual TV evidence separately; never claim 100% device coverage from simulated AVPlay.

Use GitHub issues in viptv-org/tv-web and design issue #4. Keep user data/secrets private. Playback prefers direct/copy/remux before server transcoding. Build signed TV distribution artifacts only when required certificates are available; never include signing keys.

## Current validation constraint

The owner resumed testing after the server OOM. Check available memory first; coordinate one browser job at a time, one worker and a 256 MB Node heap. Keep emulators and local Gradle stopped; use hosted Android builds. The TV web workflow runs on pushes, pull requests and manual dispatch. Record current evidence and unexecuted scenarios in TESTING.md; distinguish browser tests from physical TV qualification.

## Design synchronization

Before visual, input, navigation or asset changes, read `design-contract/DESIGN_SYNC.md` and `design-contract/TV_WEB_UI_REBUILD.md`. Update the canonical design repository first, then import its immutable commit with `node scripts/design-sync.mjs sync ../design <full-commit>`. Keep `tests/PARITY_MATRIX.md` and `TESTING.md` honest about implemented, browser-reviewed and hardware-qualified states. Build checks enforce snapshot integrity; visual review verifies the rendered implementation.
