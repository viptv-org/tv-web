# Shared TV implementation checkpoint

The source candidate implements one React UI for Tizen and Vizio with separate playback adapters. The authoritative design revision is in DESIGN_REF. Roku is unchanged. This checkpoint is ready for joint validation; it is not a device-qualified release.

Implemented flows include pairing with QR/manual code and retry; profile selection/paging/editing/avatars/PIN; Home hero/shelves; Discover/catalog paging; source-labelled Search including live scope; movie/series/season/episode details; source filters and explicit selection; exact provider-plus-fingerprint Resume; My List/queue watched correction/hide/undo; guide time window/channel paging/current/future actions; preferences, add-ons and sign-out; playback controls, accelerated seek preview, native/managed tracks, progress and heartbeat; controlled next-episode preparation with cancellation and bounded provider-scoped retry.

The player controller owns candidate sessions and rollback. Direct seek stays native. Managed seek and tracks prepare the same selected source at an absolute position and retire the old session only after candidate playback succeeds. Stop/newer work invalidates older completions. Transcoding is never forced by the frontend; backend inspection chooses compatible delivery.

Current validation and remaining hardware limitations are recorded in TESTING.md.

Before calling parity complete, run TESTING.md on both shared frontend configurations and the Android checklist, inspect each screen against the pinned design, then verify actual TVs. In particular, remote-hosted Samsung AVPlay availability, Vizio codec/HLS behavior, output track mapping, focus geometry, source ranking equivalence and same-origin hosting are pending real execution. Any deviation found belongs in the design issue and a regression test; no screenshot becomes a design asset.


## Responsive platform host requirements (RUI-027)

Website playback uses MediaBunny when a secure context exposes WebCodecs and WebAudio. Otherwise, or if preparation/decoding fails, the same selected session falls back to native HTML/HLS.js. MediaBunny is a decoder; proxy delivery and server copy/remux/transcoding are separate facts reported by Playback info. A video stream that never produces dimensions triggers the first-frame guard after eight seconds. Audio-only sessions explicitly opt out.

Tauri hosts must register plugin-http for scoped backend/media requests, plugin-opener for the device-approval URL, and window fullscreen permissions. The player uses native window fullscreen and restores only fullscreen it entered itself. The website uses element fullscreen, with native-video fallback where available. This checkout implements and tests these adapter boundaries; it does not package or qualify an installed Tauri host.

Website sign-in uses a cookie session and CSRF-protected device approval, then the shared device session poll. Tauri opens approval in the system browser. Passwords remain transient form state. Changing pairing codes cancels pending approval. The opt-in HTTP LAN preview strips Secure only from the two development auth cookies; production HTTPS preserves their flags. Web Locks coordinate refresh across tabs where available; insecure non-localhost HTTP lacks that browser guarantee.

Responsive guide geometry and interactions are defined by the pinned design contract, with research in GUIDE_UX_RESEARCH.md. TV remote rendering remains separate from the pointer/touch guide.
