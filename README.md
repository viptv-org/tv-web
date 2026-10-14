# VIPTV TV-web

Experimental Smart TV client for Tizen, LG webOS and Vizio, rendered with SolidTV. Android, Android TV, desktop and the ordinary web client belong to the KMP application repository. TV-web requires the backend.

The SolidTV entry uses `EngineTvApi`. One authenticated v3 bootstrap supplies Home, featured media, the first library page, complete lightweight saved-title membership and continuation entries. Home shelves reuse the included cards and the server's explicit browse actions. Metadata, discovery, identity mapping, continuation decisions and provider configuration belong to the shared Rust engine on the host.

The generated engine contract is pinned in [vendor/engine/SOURCE.json](vendor/engine/SOURCE.json). The existing WASM session/presentation bridge has its separate hash-checked pin in [CORE_REF](CORE_REF).

Playback uses the existing scoped v2 source-discovery and playback lifecycle. Tizen uses AVPlay; browser-capable TV targets use the HTML media adapter. Native KMP's Media3/FFmpeg audio player is maintained in the KMP repository.

Browser image delivery uses the backend's public validated image descriptors. Relative descriptors resolve against the selected API origin and bypass external resizing. Transparent title logos retain the supplied image.

Current migration evidence: TypeScript and the production bundle passed; 323 unit/component checks passed; Tizen, Vizio and webOS launcher navigation passed in Chromium. The real local HTTPS backend displayed Home and Details with one startup aggregate, no per-card metadata fanout and no JavaScript errors. One host search returned 38 Naruto results grouped by media type. Profile-scoped Live uses opaque M3U and other native host connection IDs; unsupported collection controls are hidden. A cold artwork 502 regression after a backend restart is under investigation. These checks do not certify physical TV decoding or full design parity.

The tree still contains legacy React and Tauri integration awaiting retirement. The active experimental TV entry uses the remote engine adapter. Nothing in this branch has been deployed to production.

License: GPL-2.0-only.
