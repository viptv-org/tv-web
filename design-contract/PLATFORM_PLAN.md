# Platform implementation plan

Status: proposed platform work; the Roku baseline remains unchanged.

The accepted platform matrix and playback-consolidation decision of 2026-09-17 are recorded in [docs/adr/0003-shared-platform-matrix-and-playback-consolidation.md](docs/adr/0003-shared-platform-matrix-and-playback-consolidation.md); where the rows below differ, that record is authoritative.

| Target | App | Preferred playback path | Last resort |
|---|---|---|---|
| Roku | Existing BrightScript/SceneGraph | Existing verified direct/remux delivery and native Video | Existing managed conversion |
| Android / Android TV | Kotlin Jetpack Compose, in-repo Media3 backend | Android native decoder through the player module; capability-tested direct playback | Backend conversion |
| Desktop | Tauri + React | Imported tauri-video-plugin; evaluate Mediabunny for supported media and packaging | Backend conversion |
| Web | React | Browser native media; imported video/Mediabunny when runtime supports required decode/demux | Backend conversion |
| Samsung Tizen | TV web UI; evaluate SolidTV/LightningJS | AVPlay after capability detection | Backend conversion |
| Vizio | TV web UI | Server-compatible delivery; copy/remux whenever viable | Server video/audio conversion only as necessary |

Mediabunny is a candidate, not a universal codec decoder guarantee. Check container, audio/video codec, profiles/levels, DRM, subtitles, device/browser decoder support and resource budget before selecting a path. Do not introduce transcoding solely because a container extension is unfamiliar. Prefer direct playback, local demux/decoding when verified, lossless remux, audio-only conversion if video is compatible, then full video transcode. Preserve source selection and recovery reasons across transitions.

## Shared module
Keep the already-Rust backend authoritative for account/profile access, queue/history, continuation and provider resource policy. Keep rendering/focus and platform player lifecycle local. Version HTTP contracts and fixtures for TypeScript and Kotlin clients; evaluate generated clients before adding Rust FFI. A speculative Rust core would add packaging and binding work without removing the need for native UI adapters.

## Future platform acceptance
Every app must exercise the design's baseline scenarios: cold pairing/profile gate; Home focus and hold actions; source browse versus explicit Resume; previous-episode Resume versus Next; final-ten-second transition eligibility; pause/seek/cancel/rollback; track/subtitle changes; library/history removal semantics; guide navigation; parental PIN and profile switching; failure and focus restoration. Publish a per-scenario pass/fail/not-run matrix with device and OS versions.
