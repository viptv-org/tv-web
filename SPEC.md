# Shared Tizen and Vizio application

Implements viptv-org/design#4 and TV_IMPLEMENTATION.md at DESIGN_REF. One React TV UI/controller owns remote focus, 700ms hold, all Roku-baseline screens and user actions. Platform packaging and src/player provide AVPlay for Tizen or HTML media for Vizio/server-compatible delivery. The existing backend remains authoritative for profiles, queue/history and media preparation. No separate Tizen versus Vizio UI forks.

Acceptance: real backend device-auth integration; complete design scenario matrix through browser remote automation; visual geometry and responsive TV scaling verified with privately inspected screenshots; typed player contract tests for both external engines; production build, unsigned Tizen candidate and hosted Vizio bundle; CI checks and documented signing/device limitations. Test coverage is reported honestly by scenario and runtime, not a universal physical-device percentage. Transcoding remains last resort. Roku runtime and existing user data remain unchanged.

Implementation checkpoint: IMPLEMENTATION.md. Spec issue: https://github.com/viptv-org/tv-web/issues/1. Execution/acceptance issue: https://github.com/viptv-org/tv-web/issues/2.
