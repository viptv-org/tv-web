# Repository ownership

All repositories are independent copies, not GitHub forks. Visibility is set per repository on GitHub; a repository that needs separate access (currently `playback-gateway`) is optional in the workspace bootstrap. Local checkouts live side by side in one working directory created by the [workspace](https://github.com/viptv-org/workspace) repository's `setup.sh`.

The visual source for the redesign is the [VIPTV Redesign canvas](https://claude.ai/artifact/UX1E5AtPUoSKnaSLPou3Pp); its committed export is [viptv-design-system/](../../viptv-design-system/README.md). Apps pin an immutable design commit, never the canvas directly ([../process/DESIGN_SYNC.md](../process/DESIGN_SYNC.md)).

| Repository | Owns | Status | Design pin | Spec |
|---|---|---|---|---|
| [design](https://github.com/viptv-org/design) | UI/UX specifications, canvas export, app assets, parity and design-first workflow | Current | — | [SPEC.md](https://github.com/viptv-org/design/blob/main/SPEC.md) |
| [roku](https://github.com/viptv-org/roku) | Native Roku application | Current app; adopting the current TV design through [ROK-042](../platforms/ROKU_DESIGN.md) | `DESIGN_REF` | [SPEC.md](https://github.com/viptv-org/roku/blob/main/SPEC.md) |
| [backend](https://github.com/viptv-org/backend) | Rust backend, pinned web delivery bundle and deployment packaging | Current; BE-002 cutover in qualification | `DESIGN_REF` | [SPEC.md](https://github.com/viptv-org/backend/blob/main/SPEC.md) |
| [playback-gateway](https://github.com/viptv-org/playback-gateway) | Independent generic media ingestion, output jobs and viewer leases | Implemented and locally qualified for documented formats; not publicly deployed | none (no UI) | [SPEC.md](https://github.com/viptv-org/playback-gateway/blob/main/SPEC.md) |
| [web](https://github.com/viptv-org/web) | React account/admin web application | Current | `DESIGN_REF` | [SPEC.md](https://github.com/viptv-org/web/blob/main/SPEC.md) |
| [tv-web](https://github.com/viptv-org/tv-web) | Shared React viewing client for web, Smart TVs (Tizen/Vizio) and desktop | Implemented; Tizen/Vizio device qualification in progress | `DESIGN_REF` + verified `design-contract/` snapshot | [SPEC.md](https://github.com/viptv-org/tv-web/blob/main/SPEC.md) |
| [desktop](https://github.com/viptv-org/desktop) | Native Tauri v2 shell for Linux, Windows and macOS hosting tv-web | Implemented; Linux/Windows installers built, installed qualification pending | inherited from the `tv` submodule's `DESIGN_REF` | [SPEC.md](https://github.com/viptv-org/desktop/blob/main/SPEC.md) |
| [core](https://github.com/viptv-org/core) | Shared Crux Rust state, normalization, generated TypeScript/Kotlin bindings, SmartCast controller | Current; adopted by Android, tv-web and desktop (Roku excluded) | `DESIGN_REF` | [SPEC.md](https://github.com/viptv-org/core/blob/main/SPEC.md) |
| [android](https://github.com/viptv-org/android) | Android / Android TV app and Media3 playback module | Implemented; physical-device qualification pending | `DESIGN_REF` | [SPEC.md](https://github.com/viptv-org/android/blob/main/SPEC.md) |
| [tauri-video-plugin](https://github.com/viptv-org/tauri-video-plugin) | Tauri native playback adapter (GStreamer / MPV / system decoders) | Current | `DESIGN_REF` | [SPEC.md](https://github.com/viptv-org/tauri-video-plugin/blob/main/SPEC.md) |
| [video](https://github.com/viptv-org/video) | React/web/Tizen/Vizio video controller | Current | `DESIGN_REF` | [SPEC.md](https://github.com/viptv-org/video/blob/main/SPEC.md) |
| [workspace](https://github.com/viptv-org/workspace) | Organization bootstrap, portable agent skills and handoff coordination | Current | — | [SPEC.md](https://github.com/viptv-org/workspace/blob/main/SPEC.md) |
| [.github](https://github.com/viptv-org/.github) | Public viptv organization profile | Current | `meta/github/DESIGN_REF` in workspace | [meta/github/SPEC.md](https://github.com/viptv-org/workspace/blob/main/meta/github/SPEC.md) (in workspace) |

Roku/server/web extraction uses the actual local source at vynxc/viptv@7d6b413, including polish commits newer than original main. The monorepo retains history. MIGRATION.json in each extracted app maps its original files and hashes; packaging/doc/test changes are separately identified.

Backend's dashboard gitlink pins independent web source. Its checksummed compiled bundle permits CI without cross-repository credentials. Web promotion is explicit; see backend/DELIVERY.md.

Status reflects source and recorded evidence, not deployment or universal device parity; the [implementation ledger](../../plans/backend-v2/IMPLEMENTATION_V2.md) and each repository's tickets record exact qualification. Build workflows exist only for Android, desktop, Roku and TV-web (main pushes and manual dispatch, sideloading artifacts, no automatic deployment); other repositories rely on their documented local checks.
