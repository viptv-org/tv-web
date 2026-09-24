# viptv design

The shared product specification and app assets for viptv. Start with [DESIGN.md](DESIGN.md) and the [VIPTV design system](viptv-design-system/README.md), then the [platform plan](PLATFORM_PLAN.md), [repository map](REPOSITORIES.md), and [development process](DEVELOPMENT.md).

The initial baseline is the current Roku app, including its latest local polish. Its screen geometry, input behavior and state transitions define cross-platform parity. New platforms may adapt input and density, with documented equivalents for every familiar action. No app screenshots are stored here; the design system's reference screens are design renders.

Clone all repositories with authenticated GitHub access: `bash scripts/clone-workspace.sh /absolute/path/viptv-org`. See [migration validation](MIGRATION.md) and [specifications and tickets](TRACKING.md) for delivery status and remaining work.

## License

Copyright (C) 2026 viptv contributors.

This program is free software; you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation; version 2 of the License. See [LICENSE](LICENSE). The playback adapters (`viptv-org/video`, `viptv-org/tauri-video-plugin`) and the Android repository remain under their existing MIT OR Apache-2.0 terms.
