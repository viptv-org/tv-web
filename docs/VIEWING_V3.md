# Experimental v3 TV viewing adapter

Server content wire: core `a7495e753ba9bdace3eb83d7cf99d86b9ed7f200`. Host contract and lifecycle details are in the backend's `docs/VIEWING_CLIENT_V3.md`.

`engine-bootstrap.ts` owns the profile-scoped startup cache and shared in-flight request. A cancelled screen does not cancel other consumers. Profile/session replacement aborts the old scope and rejects late results. Successful library mutations retire the aggregate; refresh failures cannot reuse a signed-out profile's cached content.

`engine-card.ts` projects presentation fields while retaining the complete host-issued card. It does not derive opaque media IDs or mappings. Resume clocks apply only to matching identities. `engine-continuation.ts` additionally requires Resume status; Next retains the previous completed record separately and starts its target at zero.

`engine-catalog.ts` projects explicit shelf actions and typed detail/discovery pages. The current detail adapter automatically collects bounded 128-episode pages before publishing Details, including large series, with repeated-cursor checks and caller cancellation. Selected-season background windows remain a performance follow-up.

`engine-client.ts` connects these projections to the existing viewing UI and opaque v2 source/playback boundary. Home uses the bootstrap's featured media and cached shelf cards. Library views automatically read remaining bounded pages; Home does not hydrate the entire library. Provider-specific discovery controls, complete related-content UI and the five-title TV-web hero presentation remain migration work.

`engine-artwork.ts` resolves validated public image descriptors against the selected API origin. The image-negotiation header requests browser proxy delivery. The presentation helper leaves those descriptors on that origin rather than passing them to an external image resizer.

`engine-live.ts` projects profile-scoped channels, groups, guides and opaque source grants for native M3U as well as other host connections. Connection/channel/group IDs remain opaque; the client does not fabricate a playlist generation. Late responses from a replaced profile are rejected. Unsupported Live collections are hidden instead of falling back to another dataset.

Global search makes one `type=all` host request, grouping results as Anime, Movies and TV Shows while retaining host order within each row. The compatible WASM bridge is pinned to core `4f461e88f5088a9f73aa6fd532bfd70e96a3d9b0`, including explicit gateway timeline offsets. Its build retains older TV browser support.

The provider subtitle action is gated by the selected-profile bootstrap availability fact and requests opaque candidates only when opened. Missing/old-server availability defaults to hidden. No extra startup request is needed. Its bounded content transport fetches normalized WebVTT from the selected API origin with session refresh and profile replacement checks. Original-media cues render against the player’s absolute title clock through managed seeks, without subtracting the gateway cut again. Off clears provider cues without restarting video; embedded selection supersedes them. Source/title replacement and disposal abort outstanding selection and clear its state. Physical TV caption rendering remains unqualified.

Validation: 332 unit/component checks, full TypeScript check, production build and three Chromium launcher navigation checks passed. An authenticated real local HTTPS session reached Home and Details with one bootstrap and one metadata request; Search returned 38 Naruto results in one query, with zero failed requests or JavaScript errors on the warm run. An earlier cold traversal returned 37 artwork 502s. A fresh cold run now returned 53/53 successful images, with bounded diagnostics added; the original failure cause remains unconfirmed. Loaded screenshots were visually inspected. KMP real-device performance evidence is maintained in the application repository; Chromium navigation is not physical TV playback qualification.

Source and continuation polling cancel unfinished server discovery on early selection, Back, timeout or disposal. Cleanup has an independent five-second signal; already published source grants remain valid for playback. Normal terminal discovery does not add a DELETE request.

A read-only real provider returned 38 subtitle candidates and normalized WebVTT with 1,775 cues. The production cue selector matched five actual title-clock positions, retained one content fetch, and cleared on Off. This checks real content projection; it is not a physical-TV decoder/caption claim.
