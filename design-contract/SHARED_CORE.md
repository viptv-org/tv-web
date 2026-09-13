# CORE-001 — Shared application core

Status: proposed implementation approved by the owner on 2026-09-13. Baseline references: tv-web@629f885 and the pinned Roku behavioral/visual contract. Roku remains unchanged.

## Ownership and interface

viptv-org/core owns the Rust Crux application model, events, view model, API normalization, session restoration and playback decisions. Browser/WASM and Android/native run the same Rust source. Tauri links the native core and executes HTTP using its native client; its React renderer does not repeat parsing or selection logic. Generated TypeScript and Kotlin interfaces come from the Rust protocol. Bindings and runtime adapters are versioned with the core.

Network, secure storage, clock and video-player operations are platform effects. Browser requests retain same-origin /api and /media proxy delivery. Tauri uses the native HTTP plugin/client with explicit origin scopes, verified TLS, cancellation, bounded response bodies and redirect handling that never leaks bearer credentials. Android supplies native networking and secure storage. Decoding remains AVPlay, browser native/MSE, Media3 or Tauri video; direct play and stream copy precede transcoding. Neither WASM nor shared code bypasses browser CORS.

## Startup and profile restoration

Entry: cold launch or app reload. Show existing viptv splash geometry/copy while durable credentials and server identity resolve; no transient pairing screen. An absent or definitively revoked grant enters existing pairing. A transient network/schema failure retains credentials, shows the existing error/retry affordance and permits retry without re-pairing. Resolve server profile identity and the remembered profile against current authorized profiles. Restore an eligible completed profile; require the existing server PIN/unlock flow for a protected profile. Deleted or inaccessible profiles return to the chooser. Profile selection persists only after server acceptance. Sign-out clears durable state only after accepted revocation. Cancellation/generation changes prevent obsolete requests from replacing current account/profile state.

No new pages, buttons, input timings or geometry are introduced. Splash, profile chooser, Home, dialogs and player retain specs/visual/SCREENS.md and specs/behavior/roku-ux-contract.md, including tap/hold/Back/focus restoration. The avatar focus outline remains concentric with its image. Valid partial catalogs remain visible when another row fails; a normalization error must not blank unrelated rows.

## Delivery and acceptance

Delivery includes the Crux core, native/WASM bridges, generated Kotlin/TypeScript protocol, browser and Tauri HTTP adapters, session/bootstrap and normalized catalog/playback contracts. CORE-002 below extends adoption into the playback applications. Adoption is recorded per app; creating the library does not imply all existing logic has migrated. A single version pins bindings/runtime/core; CI produces artifacts consumed through explicit dependency updates and app rebuilds.

After code completion, test storage absent/valid/revoked, transient identity failures, valid/deleted/locked remembered profiles, mixed catalog payloads, media delivery format selection, cancellation and stale effects. Exercise identical core input sequences through native and WASM bridges. Test browser and native-fetch adapters for binary data, HTTP error statuses, aborts, headers and disallowed redirects/origins. Run browser startup/Home/profile geometry and real playback checks. Record failures, mocks and missing hardware separately. No emulator or screenshots committed.

## Deferred Roku experiment

wasm2brs is exploratory only. Its upstream repository was last pushed 2024-05-23 and documents floating-point, stack, variable, label and file limits. A later experiment should compile a small pure Rust normalization function, compare outputs and measure real Roku memory/time before considering any wider use. Do not run its auto-discovery/deployment tests against the household Roku during core work.

Sources: https://github.com/redbadger/crux ; https://v2.tauri.app/plugin/http-client/ ; https://github.com/MotleyCoderDev/wasm2brs

## CORE-002 — Shared presentation and application policy

Approved scope, 2026-09-13: Android/Android TV and shared Tizen/Vizio/TV-web consume the same Rust implementation. Roku behavior and rendering remain the reference and are unchanged. This contract describes required ownership; each consuming repository records implemented and validated coverage separately.

Rust owns provider-response validation, canonical media/profile/source identity, catalog filtering, continuation ordering and progress, resume thresholds, source/audio preference ranking, next-episode decisions, request construction and artwork selection. Frontends consume generated typed results rather than interpreting provider JSON or recreating fallback chains. Platform code executes network/storage/player effects and translates device events. CSS/Compose layout, focus movement, animations and decoder integration remain in their renderer. Platform capability observations are inputs to shared decisions; the core cannot infer a codec works merely from its file extension.

Presentation models expose distinct heroImage, posterImage and episode artwork roles. A hero uses explicit backdrop/landscape metadata for the selected title, or the parent series when appropriate for an episode; it never falls back to portrait poster/cover artwork. Missing landscape artwork produces the existing background treatment, with title, metadata and actions intact. A landscape slot does not require cropping a poster to fill it. Cards keep their specified poster or episode artwork. The core retains media and parent IDs so enriching artwork cannot replace the selected episode or its playback/resume identity. The current hero bug is corrected through this data contract without changing hero geometry, focus or remote actions.

The shared result supplies semantic values such as progress, resume position, available actions and display metadata. Rendering dimensions, gradients, typography and device focus geometry stay in the existing visual specification. Shared copy is centralized where it expresses a product rule; accessibility and localized rendering can use typed semantic fields. An app must not introduce a second selection rule after receiving the core model.

Browser HTTP uses fetch through the configured gateway/proxy; Tauri uses native fetch through its scoped plugin adapter; Android uses its native HTTP adapter. They return status, headers and bytes to the core, including HTTP errors, and preserve cancellation. Browser CORS remains enforced. The shared library controls data interpretation and decisions, while platform adapters retain the operations that require the operating system or decoder.

### Synchronization and acceptance

Every consumer records an immutable CORE_REF with a hash-checked source/bindings/runtime snapshot. Updating one Rust implementation changes the canonical rule once; adopting applications must still update their pin, rebuild and deploy. Native Kotlin and browser WASM must be generated from that same revision. Vendored Rust is a reproducible build input, never a second editable implementation. Platform-specific code must be an explicit effect adapter or renderer responsibility.

After implementation, verify identical shared inputs on native and WASM for mixed/malformed catalogs, hero backdrop versus portrait-only metadata, episode/series identity, continuation progress/order, resume and source selection, session restore/failure and stale effects. Verify app use through browser flows and hosted Android compilation/unit checks. Physical Tizen/Vizio/Android decoder coverage remains separately recorded; successful host tests do not certify every stream or device. No emulator is required or authorized for this delivery.
