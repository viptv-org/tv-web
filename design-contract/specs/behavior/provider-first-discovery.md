# PROVIDER-FIRST-001 — Remembered provider discovery

Status: approved for implementation. Existing Remember source choices and Use
source choice across shows settings retain their values, defaults and scope.

Core chooses title/series memory before the enabled cross-title choice. A successful
manual source selection records integration connection, stable SDK source_id,
provider label and confirmed audio language. Automatic fallback never replaces
that preference. Current explicit audio preference takes precedence over remembered
audio; subtitles do not establish audio language. Unknown language cannot satisfy
a known target. A selected multilingual track must match that target.

A capable server dispatches the exact remembered supplier first, outside the normal
provider queue. No unrelated add-on, supplier or IPTV discovery starts during this
phase. Its five-second budget includes metadata preparation, resolution and validation.
A usable preferred result starts immediately, without waiting for job completion,
other resolutions or an exact soft quality/HDR match. Device and hard eligibility
checks still apply. Core owns precedence, readiness and preferred/fallback transitions.

On empty, incompatible, failed or timed-out preferred discovery, cancel its work
and expand discovery, excluding the attempted supplier for this intent. Existing
three-attempt playback recovery remains bounded. Back, profile/configuration changes
and superseding intent fence every publication. Keep current loading feedback and
700 ms manual picker override; do not create playback leases speculatively.

Capability negotiation makes optional discovery preferences additive. Older memories
resolve labels uniquely against enabled suppliers; ambiguous, disabled or removed
suppliers safely use fallback. Never persist expiring stream IDs, URLs or secrets.

Acceptance: provider A among thirty suppliers must be dispatched first and play
without a request to the other twenty-nine. Cover setting scopes, persistence,
manual/automatic updates, multilingual/unknown/wrong audio, lower eligible resolution,
five-second timeout, immediate errors, canceled/late work, stale configuration and
old/new client-server compatibility. Record browser, real API and physical TV evidence
separately; under-five-second playback is a target for healthy sources, not a network
guarantee. Rendering and gateway/seek contracts remain unchanged.

Discovery requests carry optional remembered_source/cross_title_source and device
hints after preferred_source_discovery_supported is advertised in bootstrap. The
existing source-ranking result adds Core-computed source_reuse_ready independently
of perfect soft matches. A reuse_audio_language observation is forwarded through
the existing audio_language playback intent, preserving explicit track overrides.
Startup failure requests fallback with exclude_preferred_source; the server validates
and excludes only the scoped, resolved supplier. Exhausted matching shows
“No matching source could start. Choose a source.” without rewriting preferences.
