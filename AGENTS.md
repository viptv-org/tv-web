# viptv TV web development

Read DESIGN_REF, SPEC.md and the referenced viptv-org/design visual and behavior contracts before changing product behavior. This one frontend serves web, Tizen, Vizio and the native desktop app (housed in `viptv-org/desktop`); the playback adapters and the session controller live in the viptv-org/video repository and are consumed through the hash-pinned vendored source in `vendor/video` (VIDEO_REF), resolved by the `@viptv/video` path alias. Preserve Roku action meaning, 700ms hold, focus restoration, explicit source intent and controlled Next. Platform decoder differences do not justify deleting product features.

Tests exercise remote UI, backend HTTP and playback adapter interfaces. Run unit/integration tests, production build and Playwright acceptance for changes. Mock only external platform/network boundaries. Inspect screenshots locally for layout but keep screenshots out of source/design/release files. Report browser simulation, real media and actual TV evidence separately; never claim 100% device coverage from simulated AVPlay.

The player stack resolves from the vendored source in `vendor/video`: after changing viptv-org/video, commit it there and run `node scripts/video-sync.mjs sync ../video` (build ordering no longer matters; `npm run video:check` gates the build).

Use GitHub issues in viptv-org/tv-web and design issue #4. Keep user data/secrets private. Playback prefers direct/copy/remux before server transcoding. Build signed TV distribution artifacts only when required certificates are available; never include signing keys.

## Current validation constraint

The host has ample memory (32 GB) — run tests and builds with default heap settings; no worker or browser-job rationing is needed. The TV web workflow runs on pushes, pull requests and manual dispatch. Record current evidence and unexecuted scenarios in TESTING.md; distinguish browser tests from physical TV qualification.

## Design synchronization

Before visual, input, navigation or asset changes, read `design-contract/DESIGN_SYNC.md` and `design-contract/TV_WEB_UI_REBUILD.md`. Update the canonical design repository first, then import its immutable commit with `node scripts/design-sync.mjs sync ../design <full-commit>`. Keep `tests/PARITY_MATRIX.md` and `TESTING.md` honest about implemented, browser-reviewed and hardware-qualified states. Build checks enforce snapshot integrity; visual review verifies the rendered implementation.

Shared application rules are owned by ../core (viptv-org/core), pinned in CORE_REF. Change Rust and regenerate bindings/WASM there, commit, then run scripts/core-sync.mjs sync ../core. Never hand-edit vendor/core. Update Android's pin with the same revision for shared behavior changes. React owns rendering/focus and browser/player effects; provider aliases, artwork roles and continuation/source/resume rules belong in Rust. A passing hash check establishes the imported version, not device playback or visual acceptance.

Before changing responsive playback, fullscreen or sign-in, read the platform host requirements in `IMPLEMENTATION.md`.
