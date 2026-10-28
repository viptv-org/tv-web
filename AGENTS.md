# viptv TV web development

Delivery policy (owner approved 2026-09-27): only Android, desktop, Roku and TV-web
build workflows remain, triggered by main pushes and manual dispatch. No PR
gates, automatic releases, image publishing or deployment. Retain local checks.
This supersedes older automation/release-gate instructions below.

## Scope: this repository serves every web-based TV platform

`tv-web` is the viewing client for **web-based TV platforms**, and it is the only
client that can serve them. That means:

- **Smart TVs whose apps are web apps:** Tizen (Samsung), Vizio SmartCast,
  LG webOS, plus the other web-based TV runtimes (e.g. Philips/HiSense, Hisense
  VIDAA, Panasonic My Home Screen, Fire TV web views) and any browser-based TV
  or set-top shell.
- **The browser and desktop viewing surfaces** that share the same bundle.

These platforms run JavaScript on a browser engine with a canvas/WebGL or DOM
renderer. They cannot run a Kotlin Multiplatform native client: the KMP app
(`viptv-org/app`) targets Android/Android TV, iOS and desktop JVM, and it has no
Tizen, webOS, Vizio or vendor-firmware target. A KMP client is therefore not a
substitute for this repository on those platforms, and this repository is not
superseded by it. Do not retire, deprecate or close `tv-web` work on the grounds
that "the KMP app covers TV" - it does not cover web-based TV firmware.

Practical consequences for changes here:

- Keep the bundle compatible with the constrained TV engines (ES2017 target,
  no runtime the platform lacks, vendored player adapters per platform).
- Tizen/Vizio target acceptance and signing remain these platforms' own tracks;
  see the repository issues and the platform qualification specs instead of
  assuming browser simulation proves device support.

Read DESIGN_REF, SPEC.md and the referenced viptv-org/design visual and behavior contracts before changing product behavior. This one frontend serves web, Tizen, Vizio and the native desktop app (housed in `viptv-org/desktop`); the playback adapters and the session controller live in the viptv-org/video repository and are consumed through the hash-pinned vendored source in `vendor/video` (VIDEO_REF), resolved by the `@viptv/video` path alias. Preserve Roku action meaning, 700ms hold, focus restoration, explicit source intent and controlled Next. Platform decoder differences do not justify deleting product features.

Tests exercise remote UI, backend HTTP and playback adapter interfaces. Run unit/integration tests, production build and Playwright acceptance for changes. Mock only external platform/network boundaries. Inspect screenshots locally for layout but keep screenshots out of source/design/release files. Report browser simulation, real media and actual TV evidence separately; never claim 100% device coverage from simulated AVPlay.

The player stack resolves from the vendored source in `vendor/video`: after changing viptv-org/video, commit it there and run `node scripts/video-sync.mjs sync ../video` (build ordering no longer matters; `npm run video:check` gates the build).

Use GitHub issues in viptv-org/tv-web and design issue #4. Keep user data/secrets private. Playback prefers direct/copy/remux before server transcoding. Build signed TV distribution artifacts only when required certificates are available; never include signing keys.

## Current validation constraint

The development host is shared with other agents and builds, so keep test runs to a single worker: `npx vitest run --pool=forks --poolOptions.forks.singleFork` for unit tests, and Playwright stays at its configured single worker. Prefer the targeted specs for a change over the full Playwright collection, and do not run a production build alongside a browser suite. Default heap settings are fine.

CI (`.github/workflows/build.yml`) runs only on pushes to `main` and manual dispatch: unit tests, `npm run build`, and hosting/webOS/Tizen packaging uploaded as workflow artifacts. It does not run Playwright, gate pull requests or deploy; the Tizen job fails until the Samsung signing secrets exist. Record current evidence and unexecuted scenarios in TESTING.md; distinguish browser tests from physical TV qualification.

TypeScript enforces `noUnusedLocals` in every `npm run typecheck` group; delete unused imports and locals rather than suppressing them.

## Design synchronization

Before visual, input, navigation or asset changes, read `design-contract/docs/process/DESIGN_SYNC.md` and the pinned `design-contract/viptv-design-system/` README, components, copy, decisions, tokens and matching reference screens. Update the canonical design repository first, then import its immutable commit with `node scripts/design-sync.mjs sync ../design <full-commit>`. Keep `tests/PARITY_MATRIX.md` and `TESTING.md` honest about implemented, browser-reviewed and hardware-qualified states. Build checks enforce snapshot integrity; visual review verifies the rendered implementation.

Shared application rules are owned by ../core (viptv-org/core), pinned in CORE_REF. Change Rust and regenerate bindings/WASM there, commit, then run scripts/core-sync.mjs sync ../core. Never hand-edit vendor/core. Update Android's pin with the same revision for shared behavior changes. React owns rendering/focus and browser/player effects; provider aliases, artwork roles and continuation/source/resume rules belong in Rust. A passing hash check establishes the imported version, not device playback or visual acceptance.

Use platform facts → Rust decision/projection → platform effects. Prefer existing
core episode/history and metadata merges, card/hero/queue actions, source ranking
and producer projections, and scoped lifecycle decisions over TypeScript copies.
Preserve optional watched/active-rewatch/completion-only facts and timestamps.
Batch collection projections; keep bridge calls off animation/input hot paths.
Browser rendering, focus, clocks, HTTP/storage/player execution and native callback
fences remain adapters. Backend delivery/lease/release facts remain authoritative;
unknown observations must not become invented policy or automatic source fallback.

Before changing responsive playback, fullscreen or sign-in, read the platform host requirements in `IMPLEMENTATION.md`.

## SolidTV canvas renderer

The former Blits entry is now `solid.html` / `src/tv-solid`; the legacy
`lightning.html` URL loads that same entry. JSX in this directory uses the
SolidTV universal compiler, separately from the React entry. Preserve the
pinned geometry and the remote controller contract when changing the adapter.
Run `tests/preview/solid-shoot.mjs` for the migrated TV acceptance scenarios.
