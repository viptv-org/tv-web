# CORE-001 — Shared application core

Status: proposed implementation approved by the owner on 2026-09-13. Baseline references: tv-web@629f885 and the pinned Roku behavioral/visual contract. Roku remains unchanged.

## Ownership and interface

viptv-org/core owns the Rust Crux application model, events, view model, API normalization, session restoration and playback decisions. Browser/WASM and Android/native run the same Rust source. Tauri links the native core and executes HTTP using its native client; its React renderer does not repeat parsing or selection logic. Generated TypeScript and Kotlin interfaces come from the Rust protocol. Bindings and runtime adapters are versioned with the core.

Network, secure storage, clock and video-player operations are platform effects. Browser requests retain same-origin /api and /media proxy delivery. Tauri uses the native HTTP plugin/client with explicit origin scopes, verified TLS, cancellation, bounded response bodies and redirect handling that never leaks bearer credentials. Android supplies native networking and secure storage. Decoding remains AVPlay, browser native/MSE, Media3 or Tauri video; direct play and stream copy precede transcoding. Neither WASM nor shared code bypasses browser CORS.

## Startup and profile restoration

Entry: cold launch or app reload. Show existing viptv splash geometry/copy while durable credentials and server identity resolve; no transient pairing screen. An absent or definitively revoked grant enters existing pairing. A transient network/schema failure retains credentials, shows the existing error/retry affordance and permits retry without re-pairing. Resolve server profile identity and the remembered profile against current authorized profiles. Restore an eligible completed profile; require the existing server PIN/unlock flow for a protected profile. Deleted or inaccessible profiles return to the chooser. Profile selection persists only after server acceptance. Sign-out clears durable state only after accepted revocation. Cancellation/generation changes prevent obsolete requests from replacing current account/profile state.

No new pages, buttons, input timings or geometry are introduced. Splash, profile chooser, Home, dialogs and player retain specs/visual/SCREENS.md and specs/behavior/roku-ux-contract.md, including tap/hold/Back/focus restoration. The avatar focus outline remains concentric with its image. Valid partial catalogs remain visible when another row fails; a normalization error must not blank unrelated rows.

## Delivery and acceptance

First slice: working Crux core, native/WASM bridges, generated Kotlin/TypeScript protocol, browser and Tauri HTTP adapters, session/bootstrap and normalized catalog/playback contracts. Adoption is recorded per app; creating the library does not imply all existing logic has migrated. A single version pins bindings/runtime/core; CI produces artifacts consumed through explicit dependency updates and app rebuilds.

After code completion, test storage absent/valid/revoked, transient identity failures, valid/deleted/locked remembered profiles, mixed catalog payloads, media delivery format selection, cancellation and stale effects. Exercise identical core input sequences through native and WASM bridges. Test browser and native-fetch adapters for binary data, HTTP error statuses, aborts, headers and disallowed redirects/origins. Run browser startup/Home/profile geometry and real playback checks. Record failures, mocks and missing hardware separately. No emulator or screenshots committed.

## Deferred Roku experiment

wasm2brs is exploratory only. Its upstream repository was last pushed 2024-05-23 and documents floating-point, stack, variable, label and file limits. A later experiment should compile a small pure Rust normalization function, compare outputs and measure real Roku memory/time before considering any wider use. Do not run its auto-discovery/deployment tests against the household Roku during core work.

Sources: https://github.com/redbadger/crux ; https://v2.tauri.app/plugin/http-client/ ; https://github.com/MotleyCoderDev/wasm2brs
