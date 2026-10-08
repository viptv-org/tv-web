# viptv design

[Package delivery policy](docs/process/BUILD_DELIVERY.md): Actions builds sideloadable apps;
production hosting remains manual.

The shared product specification and app assets for viptv. Start with [DESIGN.md](DESIGN.md) and the [VIPTV design system](viptv-design-system/README.md), then the [platform plan](plans/PLATFORM_PLAN.md), [repository map](docs/architecture/REPOSITORIES.md), and [development process](docs/process/DEVELOPMENT.md).

[Episode annotations implementation plan](plans/episode-annotations/PLAN.md): proposed phased delivery of intro/outro skipping and filler labels; normative UI design and implementation are pending.

## Find a document

| Location | Purpose |
| --- | --- |
| [plans/](plans/README.md) | Feature plans, backend v2 cutover and cross-platform direction |
| [docs/](docs/README.md) | Architecture, playback, platform references, process and archived proposals |
| [specs/behavior/](specs/behavior/roku-ux-contract.md) | Product interaction contracts and acceptance scenarios |
| [viptv-design-system/](viptv-design-system/README.md) | Visual tokens, components, copy and reference renders |
| [assets/](assets/FILES.json) | Authoritative app assets and provenance |

The root keeps the repository entry points, product vocabulary, contribution instructions and changelog.

The initial baseline is the current Roku app, including its latest local polish. Its screen geometry, input behavior and state transitions define cross-platform parity. New platforms may adapt input and density, with documented equivalents for every familiar action. No app screenshots are stored here; the design system's reference screens are design renders.

Clone all repositories with authenticated GitHub access: `bash scripts/clone-workspace.sh /absolute/path/viptv-org`. See [migration validation](docs/process/MIGRATION.md) and [specifications and tickets](docs/process/TRACKING.md) for delivery status and remaining work.

## License

Copyright (C) 2026 viptv contributors.

This program is free software; you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation; version 2 of the License. See [LICENSE](LICENSE). The playback adapters (`viptv-org/video`, `viptv-org/tauri-video-plugin`) and the Android repository remain under their existing MIT OR Apache-2.0 terms.
