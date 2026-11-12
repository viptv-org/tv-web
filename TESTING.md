# Coherent branding and preview composition — issue #133

Movie and series Details both compact their branding on entry to lower lists.
Home logos share one animated bottom anchor with their summary geometry, so
current, incoming and retiring artwork cannot use different motion phases.
Layout changes fit the loader's existing prepared dimensions rather than
fetching or rasterizing new logo sizes. Known pending logos retain their slot;
absent/failed logos retain title fallback. Detail skeleton/shimmer is unchanged.

The unmodified `46d499e` bundle fails three intended browser probes: movie logo
pixels end at y410 over a synopsis at y326; Continue→portrait logo pixels end
at y356 over metadata near y307; a supplied pending Detail logo exposes title
fallback text. The corrected production build/typechecks, 394 shared units,
52 native-host units and 47 browser cases pass. The 16 new cases cover Canvas
and WebGL at 1920×1080/1540×754, movie/series motion, reduced motion, delayed
and cached shelf reversals, and pending/failed/absent logos. The 31 related cases
retain prepared-node reuse, bounded shelf/card pools, identity-safe activation,
hero cycling, skeleton/source preparation, stale artwork and Back behavior.

Poster previews request full-width proxy blur 8 with 960×540 decode bounds and
a separate sharp poster. Single-image content grows by 4/3 inside the existing
right clip, with 1280×720 preview and 1440×810 hero decode bounds; the black
copy/lower mask stays unchanged. Request assertions verify cover fitting, blur
selection and scaled bounds using fixture JPEGs. Real transparent-wordmark/JPEG
captures are inspected in all four renderer/viewport combinations: branding
remains clear of copy and the black text area is preserved. Private captures/logs:
`/tmp/viptv-priority-private/tv-polish/issue133/`. These are browser/fixture and
native-host unit results, not live-proxy blur-quality or physical TV qualification.

Canonical scoped amendment: design `a24d507c6f1bdd0b86e4565c4a39922aa2999f9d`
([design PR #219](https://github.com/viptv-org/design/pull/219)); its validator
passes. DESIGN_REF stays unchanged, with no unrelated import or asset changes.

# Continue Watching selection identity — issue #125

Home shelves preserve the server's card order and positions. The former
render-only `cardKey` filter removed repeated kind/ID pairs while navigation,
preview and Play still indexed the original row. A repeated first card therefore
made the second visible card show one title while its preview and Play addressed
the preceding title. The filter also ignored provider and episode distinctions.
Removing that local filter keeps the visible selection, summary and requested
title aligned without adding an index offset or changing source selection.

The regression fails on the unmodified `e9591e1` production bundle in WebGL and
Canvas: column 1 displays Bravo inside the focus ring while Alpha remains the
preview. The corrected candidate passes both renderer cases with a repeated
first entry and three distinct titles, actual card pixels, rendered synopsis,
prepared logos/backdrops, delayed artwork, cached traversal in both directions,
and `viewing-action` plus source-discovery identities before and after preview
settlement. Production build/typechecks, 22 focused row/artwork unit tests and
17 Home/preview browser cases pass. A subsequent four-case WebGL/Canvas matrix
also passes the three-distinct control and repeated-first-entry cases.
Private captures and logs:
`/tmp/viptv-priority-private/tv-polish/issue125/`.
These are fixture browser results; no live account, actual media or physical
PS4/Roku/TV qualification is claimed. The affected physical session's original
row payload has not been captured.

# Grouped Search

Search consumes the authenticated `/api/search` rows in server order. Provider,
catalog and media-type identity, card origins, successful rows, empty rows and
failed rows remain separate. Rows remember card identity and position; Up/Down
changes shelves, Right scrolls within a shelf, Left returns to the keyboard,
and Back from Details restores the originating shelf. Retry retains the current
query and usable results. New queries and profile retirement cancel obsolete work.

The grouped endpoint supplies bounded cross-catalog results without continuation
cursors. Catalog-specific discovery and independently paged channel Search retain
their existing endpoints. This client does not invent grouped-search pagination.

Validation: production build and grouped TypeScript checks; 347 shared units and
52 native-host units; 20 affected Search/Canvas browser cases, including WebGL
and forced Canvas catalog fixtures with duplicate titles across providers and
media types, failed Simkl, horizontal scrolling, empty catalogs, retry failure,
Details return focus, query cancellation and channel paging/auth retirement.
WebGL and patched Canvas captures are inspected privately. At 1920×1080 all five
Canvas shelf captions paint 713–737 bright pixels each; the focused outline adds
1590 bright pixels over identical unfocused artwork. Shared Canvas paint tests
also cover 1540×754 and occupied artwork decode slots. The isolated Canvas graph
matches the committed patch; the primary shared dependency graph is unchanged.
Physical PS4 input/rendering, native Roku Search and other TV firmware remain
unverified for this change.

# Canvas presentation candidate

The candidate retains the UI presentation branch at `a73e0d0`; hosted beta
remains `d559dbb`. Canvas text pixels bypass artwork fetch/decode slots. Choice
rows reserve bounded label/value columns with 24px right padding. Browser hero
artwork waits for its packaged scrim. The seek thumb is visible only while the
timeline has focus. This presentation intent supersedes the always-visible thumb.
Native artwork and scrim paint bands remain unchanged. The isolated local Roku
release build and its typechecks pass; its package is not installed.

Production build, grouped typechecks, 344 shared units (including four
source/distribution texture tests) and 52 native-host units pass. Nine final
Canvas/hero checks pass; 30 existing Canvas, preparation and player checks pass. Canvas pixel checks at 1920×1080 and 1540×754 cover
focus colors during occupied artwork decode slots, unchanged correct colors
1100ms later, season option containment and delayed scrims. Buffering controls
retain the server lease's tools; a separate admission snapshot fix publishes
those capabilities before decoder open finishes. Existing WebGL/Canvas hero
contrast, preparation, source progress, Back and disposal checks remain covered.

Private before/after captures and logs are under
`/tmp/viptv-priority-private/agents/canvas117/`. These are fixture browser and
native-host results. Physical PS4, Roku and Samsung acceptance remains unverified
for this candidate; no deployment or physical-device operation is included.

# Current TV delivery and qualification

Beta serves TV `d559dbb` and backend `8d995a5`. Managed rollout, container health,
running binary, both TV entry pages and all 41 served assets are verified. Runtime
configuration, mounts and the root frontend are preserved; production is unchanged.
One asset read timed out; a bounded retry verified its exact bytes. The known
Cloudflare Insights script is checked separately from application HTML.

Native package 11142 is built from `66753cc`, merged in TV main `188dbc5`. Its
storage adapter changes require no hosted-beta rollout. The shared client passes
337 units, 50 native-host units, grouped browser/native typechecks and both builds.
Two focused browser session cases pass on this revision; six session/sign-out
cases passed on the preceding hosted revision. The
preceding combined gate passed 37 cases for focus, hero pixels, late artwork,
context loss, storage, Skip/Recap, playback authority, Calendar and Samsung Return.
An authenticated real-API sweep reached every navigation screen without requesting
fullscreen on startup. Native SDK mocks and browser fixtures are separate from
physical decoding evidence.

The final sign-out request sends the JSON body required by the real auth endpoint.
The regression holds server acknowledgement and verifies that the grant remains
until success, then checks Welcome, durable removal and signed-out reload. Actual
Roku acceptance found the preceding HTTP 415; the fixture now enforces the same
content-type and JSON boundary. Native package 11131 is exactly package 11130's
compiled JavaScript plus the three-character JSON argument; all packaged assets
and launch settings match apart from the build number. Both use run_as_process=1.

Package 11131 physically qualifies row-index/scroll restoration on the first
populated fresh-profile rail and top-navigation isolation. During a deliberate
1,000 ms Program-thread block, a native motion group's y position still advances
at the sampled points; temporary geometry and diagnostic globals are restored.
That is independent native animation evidence, not a presented-FPS measurement.

The dedicated account uses only the requested Cinemeta, VIPTV Sources and Torrentio
TB connections, with no Simkl link. Real Search uses its discovered addon/catalog
IDs and opens Interstellar. HLS/H.264/AAC playback advances 73→75 seconds; pause holds
75, a managed ten-second seek holds paused at 85, resume advances to 87, and controls
hide. Authoritative title duration is 10144.256 seconds. Back restores Detail, both
leases return DELETE 200, and the native player closes without error. Normal
this-TV sign-out returns 200 and removes its in-session registry entry; pairing
again and normal exit/relaunch retain the new account/profile and show only its
new viewing progress. These checks do not establish persistence across an OS reboot.

A development replacement stalled the SDK before JavaScript started. Normal system
restart restored the runtime. A Home key can only wake the OS screensaver, so device
qualification verifies actual settled OS Home and prior exit completion before
launch. The old test grant was then replay-rejected by the server and the client
cleared its credentials as designed; family/timestamp correlation establishes that
sequence. Subsequent controlled tests reproduced a prior credential generation
after an OS reboot, before the app was launched. Freshly paired or refreshed
credentials matched the server and registry after normal exit, but the reboot
restored an older record. This is a native persistence failure, not ordinary
expiry; server replay rejection remains intact. Other account sessions and data
were preserved.

The native JSON adapter serializes each complete read/write operation and stores
two byte-distinct encodings of the same new value in separate, naturally completed
BrightScript Tasks. Each Task checks Write, section Flush and readback. Retrying
an interrupted write chooses a preparation encoding different from the current
record; an unconfirmed Task blocks later storage work until relaunch. Clear writes
JSON null through the same path. Playback settings are canonicalized before their
16 KiB limit is checked. Authentication and replay protection are unchanged.

Package 11142 passes three real-device OS reboot boundaries. Every run verifies an
actual uptime reset and reads the registry before launching the app:

- Controlled access expiry produces an ordinary 401 → refresh200 → successful
  retry. The exact updated generation matches the server after exit and before
  post-reboot launch, then restores visible signed-in Home.
- Normal this-TV logout200 stores exact JSON null with no credentials. That state
  remains after exit and reboot, then restores visible Welcome.
- Fresh normal pairing and real HLS play/pause/resume/Back cleanup retain the exact
  current credentials and existing playback settings after exit and reboot, then
  restore visible signed-in Home. Both raw and canonical settings match.

All recorded storage operations finish in order, without failed or pending work
or recorder overflow. Positive acknowledgements alone were insufficient in the
earlier single-write, identical-repeat and extra-Flush experiments; those failures
remain separate from the final package's reboot evidence. Firmware internals and
other Roku hardware/OS versions are unproven. Private harness type, output-parsing,
idle-state and cleanup-route checks were corrected using retained evidence without repeating
completed reboots or media playback. Root's known-private-value scan passes on all
278 changed-source/package files, and the final Home capture was reviewed directly.

The final ordinary exit/relaunch also retains the current server-matched family
and settings. The real app is left at signed-in Home with temporary observers
removed and playback inactive. Five abandoned QA device families were revoked
through the normal owner API; the final family and unrelated devices remain.
Fresh checks confirm the dedicated account is the sole owner, its predecessor
remains a member, and only the requested three integrations are assigned with no
Simkl link. Temporary local fixture servers are stopped.

Prepared clearlogos follow validated public redirects while preserving the existing
URL/DNS, downgrade, deadline and byte limits. Interstellar, Heart of the Beast and
Nocturne return PNG with matching ETags/304 responses. Nocturne's formerly dark
letters are white without added glow, and its hero/card logos were inspected on the
real Roku. Public cache headers and a Cloudflare HIT are observed. The live metadata
check measured one title at 2650 ms cold, 160 ms warm and 417 ms through a different
account/addon registration. The raw public cache entry remained unchanged; personal
responses remain no-store/DYNAMIC and cross-account profile reads return 403 in both
directions. These samples are not a universal latency guarantee.

Collision Course (2026), IMDb tt38793125, currently has no Cinemeta synopsis. Its
Simkl catalogue card also omits text while full metadata supplies 151 characters.
Replaying those real payloads through the presentation merger retains all 151
characters after a sparse refresh and during preparation, without borrowing from
the other metadata authority. The original visual race was not recaptured, and no
claim is made that Simkl itself caused it.

Fresh root npm and independent frozen Roku pnpm installs reproduce the pinned
Solid 1.9.17/fork 451dcbc and committed renderer patches. A task-local npm cache
avoids this host's pre-existing global-cache permission error. Hosting and webOS CI
pass on 188dbc5; Tizen stops at its unchanged Samsung-certificate requirement.
The Solid fork main 9ab7982 passes 745 tests with 13 skips. Its test-only rAF clock
normalization preserves real scheduling; no production clock or timeout changed.

Backend validation passes 941 default/953 live-runtime tests with 12/13 existing
ignores, canonical integrity, optimized build and release CI. Backend/app native
Core pin eee3d90 is on Core main 7921f313. TV's existing WASM helpers remain b6ee054;
its video pin f0fff094 is on video main ffa11e26. App autoplay parity is merged and
promoted at 2c579a7e with full release CI: 2437 tests pass, five specified cases skip,
and Android, Wasm and iOS compile gates pass. The primary app's existing user work
is preserved.

An earlier first selection from partial discovery failed without captured original
admission/native diagnostics; a later successful selection was a different source.
That failure remains unclassified. Physical captions, audibility/lip sync, broad
codec/DRM coverage and sustained 60 FPS are not certified. LG/Samsung/PlayStation
hardware limits and current browser/simulator evidence are recorded below and in
[the parity matrix](tests/PARITY_MATRIX.md). Private captures and credentials remain
outside Git.

# LG webOS and Samsung package boundaries

Host changes `6e64769` and native packaging `393598d` preserve the shared TV
application. Samsung defaults to a local relative-base asset closure and an
explicit HTTPS API origin; the redirect alternative is `tizen-hosted`. The
unsigned local closure is43 files/8.6MiB; two file-entry browser/SDK cases pass.
LG's hosted IPK is built/inspected with official CLI3.2.6. Missing signing
profile/API origin and insecure API origin fail closed; no signed WGT is claimed.

Grouped typecheck and hosted/relative production builds pass. Thirty-eight
focused unit cases pass. The final hosted build passes33 host/media/SDK/lifecycle
cases across Chromium, Firefox and WebKit; each webOS/Tizen query also passes17
Chromium authority/recovery cases. Owned HLS video decodes with active WebVTT;
SDK fixtures establish API/state contracts without native Samsung decoding.

Official LG22 simulator 1.4.1 / Chromium 87 passes the extended player run with
healthy WebGL and unchanged native APIs: owned 160×90 H.264/AAC HLS advances
3.085 seconds / 77 frames with zero reported drops and a positive AAC byte counter.
Pause holds its clock for 700 ms; paused rewind holds position 0 for 500 ms; resume,
English WebVTT selection/Off, numeric Back 461 and MediaStop 413 pass. Both exits
restore Home/focus, reset media to NETWORK_EMPTY/HAVE_NOTHING with no source
attribute or buffers, and release all six admitted leases. The SDK retains a
stale read-only currentSrc blob string after reset; it is recorded rather than
artificially cleared.

The owned Xvfb runner uses --disable-gpu, --disable-dev-shm-usage and a bounded
1.5 GiB memory-headroom preflight in this 5 GiB container. Those are simulator
settings, not product defaults or a hardware/performance qualification. Earlier
constrained runs directly observed context loss with valid decoded font atlases
waiting on a stopped loop. Startup recovery now retires that renderer and uses a
fresh Canvas host; ordinary Canvas Home/media and nine ownership/two real
context-loss browser regressions pass. No global bitmap disable or UA rule ships.

Actual simulator-window captures show video and controls; a Canvas capture also
shows the caption. The reviewed healthy-WebGL paused window also shows the active
English cue. Track modes, active cue contents and that visible cue are verified;
this is not a complete caption-style pixel sweep. Physical LG/Samsung
codecs, audible output, DRM, firmware lifecycle and remote behavior remain
unqualified. Earlier LG26/bitmap-disable diagnostics are not current LG22 passes.
Live-empty and source-hint fixtures now navigate by route identity and use the
canonical provider fields; their focused acceptance cases pass. Commands, limits and official sources:
[platform qualification](platform/QUALIFICATION.md).

# Core-owned provider-first discovery

Canonical Core `1ea4de65493b9c3036d51ab46040d8ff69d1b999` owns preference
precedence, stable/legacy supplier resolution, selected-language eligibility,
early readiness and the five-second preferred/fallback policy. SDK
`4dd3a114235d0569afccb3ffc3f07da440b0c6c1` dispatches the selected supplier outside
normal fanout, reuses verified metadata and publishes probe completions. Backend
`8b0293d2071d21c30a1aa9cb7821ff55e3d0cbf7` enforces job/source scope and defers
unrelated discovery. Client flags negotiate optional fields with older servers.

Core: 180 checks passed, one ignored. SDK: 33 engine/probe, eight CineWave and
eight cache checks passed. Backend: 924 default checks and 936 live-runtime checks
passed, with 12/13 existing ignored cases. Tests cover
preferred A without requesting the other 29, five-second deadline, cancellation,
changed configuration, selected audio versus available tracks and lower soft quality.
Server tests used a package-local debug-symbol override to fit the shared build
host; production profile/settings are unchanged.

Client grouped typecheck, 213 shared tests, 15 native tests and production build
pass. Eighteen Chromium/Firefox/WebKit source-reuse and manual-override scenarios
pass, including stable supplier identity, early readiness despite a soft quality mismatch, startup fallback,
no language match and the three-attempt cap. Provider-first fixture cases isolate
continuation preparation so request counts refer to the tested episode. Explicit
spoken-language intent reaches admission; manual tracks/direct play retain control.

CineWave incremental extraction publishes direct and embed results without waiting
for its remaining lookups. Validation batches run concurrently with bounded shared
probe capacity. Regression coverage includes a stalled hub, stalled embeds and a
stalled probe while another extraction becomes ready. Discovery reuses its verified
metadata proof with local authority revalidation; identity checks skip recommendations.
Changed identity assertions and revoked configuration remain rejected.

The Roku build passes (718945 JavaScript bytes). Sideload and the native inspector
could not reach the configured device; physical Roku and PS4 acceptance is incomplete.

No default or existing setting values changed. Automatic fallback preserves manual
preferences. Beta runs backend `8b0293d` with TV client `9b6ef7c`. Managed deployment,
HTTPS health, Canvas welcome-to-pairing and all 59 TV asset hashes pass. The root
frontend, runtime configuration and unrelated containers are retained. Two announced
beta restart windows were used: the combined release and its real-acceptance fixes.
Production was not deployed.

Real hosted-beta acceptance used persisted manual CineWave/English preferences and
the existing cross-show toggle, with no API or media mocks. A different movie and a
relaunched Continue Watching card both admitted only CineWave, showed no source picker,
decoded 1920x1080 video and retained the manual preference. Selected English delivery
tracks and PCM samples were observed. Readiness did not require a perfect soft match.

| Real API entry | Preferred phase ready | Play to admission | Play to first-frame signal |
| --- | --- | --- | --- |
| Different movie: Interstellar | 1.026 s | 1.638 s | 10.428 s |
| Relaunch, Continue Watching: Interstellar | 0.888 s | 1.608 s | 9.636 s |

Preferred timings start at the server phase; admission/frame timings start at Select.
The full under-five-second playback target remains unmet in these runs: gateway
preparation plus decoder startup took another 8.0–8.8 s after admission. Raw supplier
response, validation and first audible audio were not individually isolated by these
hosted traces. This is browser/API evidence; it does not establish firmware timing
or lip sync.

Continue Watching for Inception produced no eligible CineWave result before the
5.007 s deadline. Broad fallback excluded that supplier, decoded actual video with
nonzero PCM, kept the picker hidden and preserved the original preference. Admission
occurred at 6.005 s and the first-frame signal at 12.557 s. An earlier run took about
21 s, demonstrating that upstream/delivery latency is not a fixed guarantee.

Earlier release checkpoints follow.

Beta seek client `6e60ea6de0fb0c8cf6cab76433c8bc9c349fec82` is deployed.
Managed rollout is done; health, entry and all 59 asset hashes plus hosted Canvas
pairing pass. Backend/root frontend and runtime configuration are preserved;
unrelated containers are unchanged. Typecheck, 209 shared tests, 15 native tests,
production browser build and Roku build pass. Physical PS4 fullscreen behavior
remains unverified.

# Stable seek presentation and PS4 Back — 2026-11-08

Real beta playback reproduced a separate gateway-capacity refusal when a seek
admitted a second producer before retiring the outgoing lease. Managed seeks now
pause the existing picture, release that slot, then admit/open the requested
position. Source-replacement semantics remain unchanged. Late errors from the
retired picture cannot cancel the new seek admission.

Timeline presentation retains the requested position, duration, available controls
and tracks through internal stopped/opening snapshots and delayed metadata. A
superseded seek cannot publish over its successor, failed admission restores the
remaining outgoing presentation when available, and a second early seek preserves
known duration. Raw decoder facts/progress reporting remain separate.

Real beta paused seek requested 13.185784 seconds, admitted that exact gateway
offset, retained duration with zero zero-position/duration samples, then resumed
and advanced beyond the target. Sampling interval was 5 ms; this is browser/API
evidence, not frame-perfect physical PS4 qualification. Six nearby browser cases
pass in Chromium/WebKit (paused seek, player navigation, paused Skip intro).

PS4 cancels delivered Back defaults in capture while preserving propagation to
shared navigation, including when the video element has keyboard focus. Editable
fields retain Backspace behavior; other browsers are unchanged. BrowserBack also
maps to shared Back. Unit tests cover this event boundary; browser-reserved,
noncancelable fullscreen exit and physical PS4 behavior remain unverified. The
app does not force fullscreen back on after exit.

Beta resume client `709e610aeaaca32e422e861e5738b31aafab01c8` is deployed.
Managed rollout is done; HTTPS health, entry and all 59 asset hashes, plus hosted
Canvas pairing, pass. The first health probe timed out during rollout; the fresh
verification passes. Other containers, runtime configuration, backend binary and
root frontend are preserved. Typecheck, 219 shared/native tests, browser build
and Roku build pass. Physical PS4 timing remains unmeasured.

# Continue Watching responsiveness — 2026-11-08

Real beta API timing from Continue Watching: action 489 ms; first ranked sources
available at 1.3 s; unrelated providers continued for 23 s. A remembered exact
supplier previously delayed early start even with an eligible same-language
alternative. The supplier now gets a three-second discovery head start; after
that only server-approved fully matching reuse IDs can start early. Unknown or
different remembered languages are never substituted. The hidden-picker path
immediately shows Finding a matching source… / Press Back to cancel; cancellation
keeps the originating card and aborts discovery without starting another lease.

Two real API remembered resumes decoded video in 7880 ms and 4918 ms. The latter
resolved action in 240 ms, obtained a ranked match by 1158 ms and admitted at
1176 ms; remaining time includes managed stream preparation and first decode.
This is not a universal five-second guarantee or physical PS4 qualification.
All 12 Chromium/Firefox/WebKit cases pass for bounded preference wait, visible
preparation, cancellation, no-language-match behavior and the three-attempt cap.
No backend or gateway code changed.

Beta client `32f643e520cd7e5402970dc5319e831b574968a9` is deployed. Managed
rollout completed, entry plus 59 asset hashes match, and hosted Canvas pairing
passes. Runtime environment/mounts/network/devices and all other containers are
retained. Roku build passes (714377 JavaScript bytes). Physical PS4 retest remains
pending while the owner is away.

# Real-beta UI and player navigation pass — 2026-11-08

Paired a browser through the real beta API and reviewed Home, detail, real source
discovery (210 results), Movies, Series, Anime, Live, Calendar, My List, Search
and Settings. API responses were not mocked; the candidate TV bundle was served
locally at the beta origin. Private captures were inspected for spacing/readability.
The hosted detail page reproduced a persistent white backdrop: initially absent
image URLs lost their reactive binding. Retaining that binding restores real
artwork. Source drawer subtitle/hint/filter/group/row bounds are now separated.

Real beta playback decoded 1920x1080 video (10 reported frames), paused, retained
its selected toolbar button across repeated Up and Down/Up, and released playback.
Player vertical movement no longer resets horizontal selection; Left/Right can
reach Play/Pause within the toolbar, and leaving a seek preview cancels it.
Physical PS4 acceptance of these changes remains pending.

Four artwork regressions pass across Chromium/WebKit and Canvas/WebGL. Canvas
fixture tests disable workers so fixture HTTP interception also covers image
loads (WebKit worker requests bypass page routes); real API review uses normal
runtime workers. The player regression passes in both engines, including cancelling
a seek preview before activating Play without opening another lease. Grouped
typecheck, 204 shared tests, 15 native tests and production build pass.

The wider pre-change fixture sweep has 18 passes and 14 failures. Several assume
old navigation positions (for example Live opens Anime after the added Anime tab)
or omit current supported routes. Those results are retained separately and do
not establish new regressions or a clean full-suite gate. Real API review does
not qualify all firmware, every source or whole-title playback.

Beta now serves client `5326b2956e501e4011ee95453dc4453a4d0a29f9`.
Managed deployment completed; HTTPS entry plus all 59 assets match the validated
package, and hosted Canvas welcome/Cross-to-pairing works. The backend binary,
root frontend, environment, mounts, network mode and devices are retained; every
other running container ID is unchanged. The database backup passes quick_check.

Final grouped typecheck, 204 shared tests, 15 native tests, production browser build
and Roku build pass. The three nearby scenarios (Skip intro, the three-attempt
startup cap and late-source focus) pass across browser engines. The Firefox focus
case initially sent Down before initial ranking arrived; waiting for actual rows
and input readiness fixes that test race without relaxing its identity assertions.

# Shared playback recovery and source stability — 2026-11-08

The owner confirms Torrentio plays on physical PS4, but reports stuck Buffering
on resume, automatic startup retries despite visible playback, persistent controls
and source/filter selection shifts during discovery. CineWave can still fail;
this change does not establish that every upstream source is playable.

HTML adapters now recover stale buffering from advancing decoded media without
requiring another playing event. The explicit PS4 frame-reporting fallback samples
the media clock across elapsed wall time, including coarse events and buffering.
It does not require reliable ready-state/frame APIs or invent frame counts.
Paused, stalled and seek-only clocks still fail the bounded startup check. Tizen
also recovers from successive advancing SDK clock callbacks when buffering-complete
is missing, while preserving paused intent. Canonical video pin: `d55ad9d6c1681eb8fa249101b68fc2afb6f86b39`;
192 video tests, typecheck and build pass.

Controls use a five-second inactivity deadline preserved across clock updates and
brief buffering. Discovery appends new rows once the viewer interacts, retains
focus by identity within the filtered list, and snapshots open filter options.
Automatic candidate ordering remains server-owned. Design pin:
`b5c3387145cca9de78383a3f825afa715125cbcd`.

All 54 Canvas/platform/recovery cases pass across Chromium, Firefox and WebKit.
They decode actual HLS, exercise a nonzero remembered Resume position with missing
playing events, verify that only one new lease starts, cross the prior watchdog
boundary, and check controls hide again after input. Filtered-row and open-provider
selection survive higher-ranked arrivals. The canonical adapter tests additionally
cover coarse clocks without ready-state reports, seeking, stalled/paused media,
and Tizen buffering recovery. Browser/SDK-boundary evidence does not qualify
Samsung, LG, Vizio or PS4 firmware. Physical acceptance of this new batch remains
pending; no new upstream-source or native frame-rate qualification is claimed.

The beta TV entry and all 59 packaged assets for client `49e493c` match the
qualified release bytes. Managed deployment reports done, HTTPS health is ready,
and hosted Canvas startup plus focused Cross activation opens pairing. The
backend remains `28818eb`; all other running container IDs are preserved.

# PS4 native playback evidence and Canvas text updates — 2026-11-08

The owner reports video/audio initially playing but then being stopped by the
zero-decoded-frame watchdog. PS4 explicitly opts into native presentation evidence
from an observed playing event, decode-ready media and advancing time. No frame
count or dimensions are invented. Metadata-only, seek-only and stalled states
remain failures; other hosts retain their ordinary counter checks. Video pin:
`fd2f20ad01072fa23a0ca9c276ff5463f2fd4088`; its typecheck/build and 185 tests pass.

The pinned Canvas 1.10.2 patch keeps loaded glyph pixels until their replacement
is loaded and swaps ownership atomically. Superseded/destroyed replacements release
pending resources; intentionally empty labels clear. Unpatched browser regression:
36 blank frames; patched: zero. The patch is applied reproducibly after install
and was verified by reversing/reapplying it. Player control descriptors also
retain identity across clock-only updates, avoiding Source/track-label remounts.

All 24 Canvas/input/media cases pass across Chromium, Firefox and WebKit; the
stronger stable-control check passes in each engine after waiting for first-frame
acknowledgment and pausing the five-second fixture. These decode actual HLS while
frame reports are forced to zero. Grouped typecheck, production build and all
219 shared/native tests pass. Physical PS4 video/text acceptance awaits retest.

# PS4 Cross activation — 2026-11-08

The owner confirms physical PS4 Canvas startup and pairing after the signed-out
hotfix, then reports directional focus working while Cross does not select.
The PS4 input adapter maps page clicks to the existing focused Enter action and
normalizes native Enter codes. It leaves native HTML controls alone and fences
a click following an already handled Enter. Browser regressions select navigation
and a non-first source row with Cross-style clicks and decode real HLS. This
qualifies the tested input boundary. The owner subsequently confirms physical
PS4 navigation and Cross selection; physical media remains pending.

The hosting workflow uses Node 24 and installs the Roku host's pinned dependencies
before the shared/native unit command, matching its declared runtime requirement.

# Signed-out Canvas startup hotfix — 2026-11-08

The deployed signed-out path exposed two gaps missed by the signed-in cases:
legacy Canvas needed a requestRender adapter, and an initially absent asynchronous
texture binding was discarded. Both are corrected. The Canvas welcome wall is
composed once with the existing dark vignette; it uses no WebGL shader or idle
animation loop. Poster tiles are square. Sign in accepts pointer activation in
the fitted canvas and the existing Enter action.

The reproduced white welcome and blocked sign-in fail before the fix. Signed-out
startup, recovery removal, dark background, click-to-pairing, Back and Enter pass
in Chromium, Firefox and WebKit without WebGL and with motion enabled. The full
Canvas matrix passes 15 cases; grouped typecheck, production build and 219 unit/
native tests pass. Private welcome/pairing captures are inspected separately
from physical PS4 qualification, which still requires the owner's retest.

# Canvas fallback and live episode handoff — 2026-11-08

The hosted entries use the shared SolidTV application. WebGL-capable browsers
retain renderer 2.0.7; unavailable WebGL selects the existing 1.10.2 Canvas
renderer and Canvas text engine through the shared framework factory. Canvas
fonts use WOFF and actual browser measurements; SDF atlases are not requested.
The startup logo tile and recovery button are square. The authored canvas fits
and centers in a 1540 × 754 console-browser window without requesting fullscreen.
Navigation text and fallback badge backgrounds fit their actual rendered labels.
The unreferenced React appearance module is removed.

Framework pin: `vynxc/solid` main `de6c0454d092c62ec093aff31a2398fd2ad2faab`.
Its build passes, 738 tests pass with 13 skipped, and lint passes with existing
warnings. Its public export contract includes both renderer factory methods.
Git preparation builds its distribution without requiring global pnpm.
Design pin: `0cbb058` (full revision in DESIGN_REF).

Client checks: grouped typecheck, 204 shared and 15 native tests, production
build and Roku build pass. The combined Chromium/Firefox/WebKit matrix reports
63 passing Canvas/episode cases; its controller shell terminated after the pass
summary. A separate focused Canvas matrix completes cleanly with 12 passes.
These exercise real Canvas 2D rendering and decoded HLS with WebGL disabled,
prepared Next, font widths, square failure recovery, viewport fitting, and the
unchanged WebGL path without a Canvas-chunk fetch. Private screenshots were
inspected; no pixel-perfect parity or PS4 hardware qualification is claimed.

Backend `28818eb` is deployed to beta after an online SQLite backup and integrity
check. Deployment is done, the running image/binary match, and authenticated
ranking reports source_reuse_supported=true. Environment, mounts, devices and
network settings are unchanged; all other service container IDs are unchanged.
The initial backend-only rollout preserved the served frontend hashes.

Actual Roku after that rollout: persisted CineWave/English memory starts Loki
episode 1 without a picker; final-three-minute discovery prepares episode 2;
manual Next reaches episode 2; a real episode end shows the ten-second countdown
and automatically starts episode 3 without a picker. Telemetry confirms advancing
H.264/AAC playback. The measured countdown-close to playing/ready sample is about
6.2 seconds, not an instantaneous decoder handoff. Long-hold source override also
opens the picker. Native HTTP admission counts were not observed; the no-extra-
preparation-admission assertion is browser evidence. The native 60 FPS target and
physical PS4 input/media acceptance remain unqualified.

# Preferred-source preparation and sustained playback follow-up — 2026-11-08

Preparation now stops waiting for unrelated providers once the server reports a
qualifying preferred source. Its own discovery is cancelled after the ranked
snapshot is retained, without opening a playback lease or stopping the current
video. The slow-provider regression fails on the earlier build and passes in
Chromium, Firefox and WebKit, including using that cached result without another
source discovery. Eligibility, language matching and ranking remain server facts.

A successful manual source choice now records the server-selected delivery
audio language when available. The actual bilingual CineWave source selected
English, so the stored observation is `eng` rather than both English and Hindi.
Source-reported languages remain the fallback when delivery metadata is unknown.
Design pin: `1f68aa8280a4152f687013cf8246a5fbebebc902`.

A real Roku run exposed another gateway issue: the 13.2 GiB 1080p AVC source
started successfully but was retired by the unchanged cache watchdog. An API/
browser reproduction decoded picture and PCM audio before failing around 33
seconds; aggregate cache reached 390.4 MiB, beyond the 384 MiB limit. Gateway
`a3dc95d` selects its existing bounded encoder for known high-rate VOD HLS while
preserving ordinary copy/original/streaming paths. The candidate stayed decoded
for 160 seconds and its measured cache peaked at 51.9 MiB. Content samples align
picture on a 100 ms grid and English audio within about 20 ms. This trades the
original high video bitrate for bounded managed playback; Direct is unchanged.

That gateway revision is deployed to beta through the managed Compose entry
after an online SQLite backup. The deployment is `done`, HTTPS readiness is 200,
and only the beta gateway container ID changed. All other container IDs stayed
the same. The physical Roku subsequently advanced beyond 332 seconds on the
same source with H.264/AAC, no playback error, successful pause, paused 10-second
seek and resume. A post-deployment browser run decoded 102 seconds with PCM
audio and a healthy lease. These samples do not establish whole-title or
whole-catalog continuity.

The Roku also reached a real episode end after seeking to the last 20 seconds:
Up Next opened with its ten-second countdown and packaged ring; Right cancelled
and Back dismissed it. A reproduced return-flow defect kept ended controls
visible. The corrected native capture has no player chrome after dismissal,
and the next Select reveals it without restarting. Browser tests cover that
flow and ensure a later Media Play restarts through fresh source discovery.
The known VOD clock now reaches its exact end despite firmware's one-second
notifications. Reduced motion keeps the full play glyph; cancelling the count
restores it too. Hardware-plane last-frame visibility cannot be proved by Roku
screenshots and remains a separate physical observation.

Current checks pass: 204 shared tests, 15 native tests, grouped typecheck,
production build, native Roku build, 17 complete Chromium episode cases and 12
focused Chromium/Firefox/WebKit source/language/end/replay cases. The gateway
workspace passes 285 tests with 62 opt-in cases ignored. All screenshots,
credentials, source URLs and device identifiers remain outside this repository.

Still unqualified: live preferred-source autoplay/handoff on Roku requires the
application backend's new ranking capability. Beta currently returns no such
capability; the previously requested application-backend deployment approval is
still pending. No hosted application-backend/frontend update was performed.
The final native Home trace has 399 paired render/swap samples: p50 18.15 ms,
p95 22.02 ms and p99 46.68 ms. Render alone is 4.32 ms at p95; swap is
19.21 ms. The output reports 2160p60, but the 16.67 ms frame-work target still
fails. Intermittent-key graphics-FPS samples include idle and cannot establish
sustained presentation.

Follow-up continuous diagnostics separate the clock from presentation: an
existing card's nine-second Animator motion records 539 ticks (elapsed tick
p50 16.68 ms, p95 17.75 ms), with steady graphics FPS about 48. A temporary
native SceneGraph Animation also reports about 48, including with the app's
root children hidden; those values are restored and the probe removed. Roku's
system Home under continuous alternating input similarly settles near 48 in
this session. This supports investigating presentation beyond the JavaScript
clock; it does not establish a firmware cap or qualify 60 FPS. The clean
710180-byte client was sideloaded again, and its inspector confirms no
temporary animation hooks remain. No sustained 60 FPS qualification is claimed.

# Remembered sources and episode handoff — 2026-11-08

The shared TV application now remembers a successful manual source choice per
server, profile and title (episodes use their series). It persists only the
add-on connection, structured supplier and reported audio languages, after a
presented frame. Expiring source IDs, stream URLs and credentials never enter that
store. Browser local storage and Roku's flushed native registry share the same
bounded format: 200 records and 16 KiB. Automatic fallbacks never overwrite a
manual choice. Cross-show reuse is optional and off by default; autoplay is
local to the device and on by default. Both switches persist without adding
unsupported fields to profile preference requests.

Matching remains Rust policy: core `071854f3fe317177d9e82aceeb39edd9b8037537`
is imported into the backend engine snapshot. It prefers the selected supplier
and add-on, then eligible sources in the remembered language, retaining existing
ranking and hard filters. Known audio never falls back to unknown/different
audio. The server negotiates this capability before the client sends memory
observations; an older server opens the picker instead of guessing a match.
This engine-only extension does not change existing ranking or the unused
native/WASM bridge, so the TV client's legacy CORE_REF is unchanged.

Next-episode identity comes from the continuation API. Discovery begins in the
last three minutes, after the current frame and manual-choice write, without a
second lease or decoder. Preparation has a 45-second deadline, a 15-minute TTL,
and scope/source/preference/configuration cancellation. Next consumes it once
and revalidates metadata/configuration; pending metadata remains retryable.
Fresh automatic startup tries at most three server-ranked candidates, with a
two-second fallback notice, then leaves the annotated picker available.

Next bypasses the ordinary Ask default. A 700 ms hold on Play or Next explicitly
opens source selection. At the end, the last frame stays under a ten-second
countdown; input cancels it, Back dismisses the panel, and deadline-frame input
wins. Movies, Live and finales have no invented successor. Skip Intro/Recap now
also has a standalone shortcut when controls hide, using valid server markers
and preserving paused intent and tracks. No markers means no shortcut.

Design pin: `fdf24421668651816a310e0e18fc3c90998bfd03`. The authored horizontal
scrim and countdown artwork are hash-pinned and mirrored into the Roku package;
the browser reuses an atlas and native Roku uses small packaged PNG frames.
Reduced motion omits the ring/movement. Countdown paint updates are quantized
to the 101 authored frames rather than publishing every animation frame.

Fresh validation:

- Grouped typecheck, 203 shared tests and 14 native tests pass. Core engine:
  171 tests pass, including six matching-policy regressions; type generation
  has no output changes.
- Backend Cargo gates pass: 917 default tests and 929 with live-runtime;
  respectively 12 and 13 existing external-service/binary cases are ignored.
  Engine snapshot integrity and design validation pass.
- Browser production build and Roku local build pass; design/core/video
  integrity checks pass. A shared-host I/O stall caused an existing timing
  test to time out initially; the unchanged full suite passes with heavy
  linking serialized away from the frontend gate.
- Chromium, Firefox and WebKit: 30 decoded-HLS episode/source cases pass,
  including prepared handoff, countdown/cancellation, durable reuse, strict
  missing-match recovery, three-attempt fallback, paused marker seek,
  configuration invalidation, and long-hold Next. Three additional Settings
  cases pass and confirm device switches never enter profile PUT payloads.
- Seventeen existing player authority/platform cases passed in Chromium,
  including Live, tracks, authorization loss, replacement recovery and paused
  media-key seek. These include browser platform flags and a simulated AVPlay
  boundary; they do not qualify physical Samsung, LG or Vizio TVs.
- Physical Roku: the shared build is sideloaded. Pairing, Home and Playback
  settings render; sign-in and an explicit autoplay-off value survive closing
  and relaunching the channel. Autoplay was restored on afterward. The beta
  test profile had Next episode visibility off; it is now on, while Skip Intro
  remains enabled. No credentials or device identifiers are recorded here.

The Chromium acceptance batch passes all 29 episode, Settings, platform
and player-authority cases. Firefox/WebKit pass four further prepared-handoff
and pending-metadata recovery cases. The motion-enabled end-panel scrim, ring,
spacing and square actions were privately inspected; its pointer cancellation
case passes. A further Chromium/Firefox/WebKit regression verifies Back during
incoming admission restores the outgoing episode's UI and paused decoder,
without releasing its lease. Full-screen reference pixel parity is not measured.

Remaining acceptance: live Roku remembered-source matching,
end-panel handoff and supplier fallback need the new backend capability on beta;
no hosted backend/frontend deployment is included in the current delivery.
Roku registry persistence is physical-device evidence, not qualification of
unexecuted end-of-episode playback. Five-day persistence is tested with a new
storage instance and advanced clock, not a five-day physical soak. No new
60 FPS certification is claimed. Older checkpoints below remain historical.

# TV-only tree — 2026-11-06

The React responsive web client, its entry selection, tests and dependencies
were removed (issue #100). `index.html`, `solid.html` and `lightning.html` all
load `src/tv-solid/main.ts`; the startup cover always applies, and `/tv/*`
(including a bare `/tv/home`) is the SolidTV TV client. Phones and tablets use
the KMP app instead. React-based sections later in this file describe previous
releases and are kept as history, not current acceptance.

# SolidTV startup and delayed loading

The production TV entries (`/tv/?platform=vizio`, `?layout=tv`,
`/tv/solid.html`, `/tv/lightning.html`) show an inline static skeleton before
module, stylesheet, font or bootstrap requests complete. The cover leaves after
application readiness and the following rendered frame. Failed assets and a
30-second unfinished startup expose **VIPTV could not start.** and a focused
**Try again** button. Browser Back preserves the TV document before bootstrap
and during direct-entry playback. Every entry (`/tv/`, `solid.html`,
`lightning.html`) is the SolidTV TV app; see the TV-only section below. The complete
inline script targets ES2017; the emitted-HTML build regression rejects scripts
that still require newer syntax transformations.

At 1920×1080 over isolated HTTPS, all 26 startup/loading browser cases pass:
Vizio/Tizen/webOS and native-host selection, entry delays, pinned card bounds
and fill, stylesheet/font/bootstrap delays,
asset failure and remote retry, bounded recovery, delayed Discover/detail/Live
cancellation, initial playback stall/refusal recovery, pause/play, and direct
SolidTV/legacy history Back with real HLS. Eight existing billboard cases also
pass with controlled clocks. The wider selected navigation/source/player batch
has 68 passing cases of 69; the intermediate drawer-exit timing observation is
tracked in [#79](https://github.com/viptv-org/tv-web/issues/79).

The production build, design/core/video integrity checks, grouped typecheck and
421 unit tests in 66 files (one fork) pass. Private startup, recovery, first-frame
and settled Home screenshots were inspected; the hero artwork arrives after the
initial usable controls and rows. Geometry assertions cover the startup cards,
not full-screen visual parity. Media evidence uses the existing decoded HLS
fixture and server API boundary. Physical Tizen, Vizio and webOS qualification,
production provider playback and deployment remain unverified.

# SolidTV renderer 2.0 migration — 2026-11-05

The TV entry runs `@solidtv/renderer` 2.0.7 and `@solidtv/solid` 1.7.1 (issue
#98). The app-facing changes the browser suite sees:

- **SDF text.** Renderer 2.0 draws SDF text only, so `src/tv-solid/sdf/` ships
  ten `ssdf` atlases (image + BMFont JSON) for the faces the entry names:
  Onest 400/500/600/700 and Onest700Tabular, Bricolage 700/800, and three
  Bricolage 800 optical instances (28/56/90) that the size bands in
  `src/tv-solid/fonts.ts` alias. `main.ts` loads them with `loadFonts`; the
  canvas text rasterizer (`@solidtv/renderer/canvas`) and `text-raster.ts` are
  gone. `TvText` measures with `renderer.measureText` and renders one `text`
  node.
- **Built-in shaders.** `@solidtv/solid` 1.7 ships `registerDefaultShaders()`
  but does not call it for renderer 2.0, so `main.ts` calls it once. Without it
  every `color`/`rounded` node draws as an unrounded quad; the entry pixel test
  for a half-alpha accent node and the rounded Play button/avatar ring depend on
  it.
- **App shaders** register with `renderer.registerShaderType` and pass their
  uniforms as shader props, written by a 1.10-style `update()`; the 1.9.4
  `rounded` opacity override is deleted because 2.0 applies node alpha once.
- **Scene inspection for specs.** The remote specs read
  `window.__viptvRenderer.stage.root` with 1.x node fields (`isRenderable`,
  `props`, `shaderKey`, `shader.uniforms`, `texture.state`, `parent`,
  `worldAlpha`). `installRemoteBackend` now installs a test-only adapter over
  the 2.0 scene, and the app records shader names at registration so the
  adapter can report them. The adapter is not in the app bundle.
- **Defaults.** 2.0's changed defaults (`targetFPS` uncapped, `boundsMargin`,
  `imageDecodeConcurrency`, `textureProcessingTimeLimit`) are pinned to 1.10's
  values in `main.ts`; with the frozen browser clock some specs also need one
  explicit frame (`clock.runFor(32)`) before paint-driven focus is observed.
- **Startup resource cases** delay or fail `**/*.ssdf*.json` instead of
  `**/*.woff2`: the TV entry no longer fetches WOFF2 (the DOM still does, from
  `theme/fonts.css`).

## Regenerating the SDF atlases

Sources are the WOFF2 faces the entry already shipped
(`@fontsource/onest/files/onest-latin-*-normal.woff2`,
`@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-{700,800}-normal.woff2`
and `@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2`).

1. Convert each WOFF2 to TTF and instance the variable display face with
   fontTools (`instantiateVariableFont`, `wght=800`, `opsz` in {28, 56, 90}).
   Onest700Tabular is Onest700 with the `tnum` glyphs written into the cmap:
   SDF atlases carry glyphs, not OpenType feature shaping.
2. Run `solid-tv/msdf-generator` 1.4.0 (`msdf-bmfont-xml` 2.8.0) with a charset
   string of printable ASCII, Latin-1, the Latin-extended characters the fonts
   ship and the punctuation the UI uses (`…`, `·`, `→`, `⌫`, `✓`), `ssdf`,
   `textureSize` 1024 and `fontSize` 42 (Onest) / 48 (Bricolage). The charset is
   passed as `{"charset": "…", "presets": []}` in `font-src/charset.config.json`;
   overrides go in `font-src/overrides.json`. Keep every face on one page:
   renderer 2.0 loads one atlas image per face. On this host the generator's
   bundled `msdfgen.linux` needed GLIBC 2.38 and the host has 2.36, so the
   binary from `msdf-bmfont-xml` 2.7.0 was used; the JSON/PNG output is the
   same format.
3. Copy the `.ssdf.json` and `.ssdf.png` pairs into `src/tv-solid/sdf/` and
   update the imports in `src/tv-solid/fonts.ts`.

`TvText` measures the label with `renderer.measureText` and reports the layout
box (`w`/`maxwidth`) as the node width: the renderer derives a text node's
`maxWidth` from its width when none is set, so a measured glyph run would wrap
the text at its own edge. Alignment is applied to the block by the adapter; the
design only aligns single-line labels, so line-level `textAlign` is not set
(setting it without `contain` logs a warning per node).

Two entry assertions changed with the renderer: the countdown label's hardcoded
175×48 box became the height plus its colour (the SDF text width differs), and
the 1.x `shaderManager.valuesCache` counter became a live shader count (2.0 has
no per-frame prop cache).

Verification on this branch: `npm run build` and 431 unit/integration tests in
68 files passed twice before the last text-box fix; after it the React guide
suite flakes exactly as it does on unmodified `main` under the same load (5 of
19 there). The remote browser suite (19 specs, 139 tests) ran on an idle host
against a fixture-built `dist`: **138 passed, one startup case timed out** at
its 5-second readiness threshold (all startup specs had passed in the same run
batch earlier); every spec has passed on this build across the runs. On a
busy host the 5-second startup cases time out, the same contention pattern the
suite already records. Six matched Home/focus states differ from the 1.9.4
build only in glyph rasterization, and the pairing screen capture matches the
1.9.4 render (PERFORMANCE.md). Physical TV qualification remains #2/#4.

# Home featured-pass acceptance

`tests/remote/billboard.spec.ts` verifies an uninterrupted featured pass parks,
and that menu, visibility and remote activity restart complete passes from the
title in view. Each pass preserves server order, retires its indicator, stays
parked for 30 seconds and sends no viewing, source or playback request. Existing
artwork-retirement and reduced-motion assertions remain in the same suite.

Verified coverage at 1920×1080 against isolated HTTPS output: eight billboard
cases (`billboard.spec.ts`, including the selected `--grep='uninterrupted Home'`
case). Unit coverage is 419 cases from
`vitest run --pool=forks --poolOptions.forks.singleFork` plus the selected Guide
reverse-paging case with `--testTimeout=15000`.
Typecheck, immutable snapshot checks and the production build passed. Browser
simulation only; physical TV qualification remains unverified.

# SolidTV source-picker hint suppression

`tests/remote/source-hint.spec.ts` checks SRC-DRAWER-09 at 1920×1080 against
isolated HTTPS output. Both server `selection_note` variants are absent from
the rendered picker during discovery and when idle. Source rows remain visible
and selectable, `Still checking sources` remains while discovery is pending,
and Back restores Home and its prior focus. Private screenshots were inspected.

Validation: both regressions fail on the prior renderer and pass with the
footer removed; five existing source-picker browser cases, all 420 unit tests
in 65 files (single fork), typecheck and the production build pass. The existing
normal-motion drawer case passed alone after its initial 40ms exit assertion
failed in the grouped run. Browser
playback uses the fixture HTTP/media boundary. Physical TV qualification and
deployment remain unverified.

# Completion audit checkpoint — 2026-10-23

The rebuild is **not fully qualified**. `tests/REMOTE_COMPLETION_AUDIT.json` tracks
42 obligations from the approved scope: 15 verified for their stated scope,
21 partial, five open, and deployment/physical certification outside this task.
Of 56 Tv3 reference boards, 50 remain included. The earlier 32 captures label
30 references and assert nine rectangles; that is not exhaustive visual parity.

The adopted design contract pin is `8b7f85941addf5a65390fe6eca4f11aba9584a17`
([DESIGN_REF](DESIGN_REF)). Design revisions cited inside the dated checkpoints
below record the pin each checkpoint was measured against; they are historical,
and none of them is the current pin.

## Cited revisions

`f2122a6` reconstructed this repository's history from session transcripts.
Source revisions recorded before that reconstruction are absent from the object
store: `git cat-file -t` fails on every one of them here and in
`viptv-org/video`, `viptv-org/core`, `viptv-org/backend`, `viptv-org/design`,
`viptv-org/playback-gateway`, `viptv-org/roku`, `viptv-org/android` and
`viptv-org/metadata`. A checkpoint that names one cannot be re-derived from
code. The recorded values stay: they are the only surviving evidence for those
checkpoints, and they are recorded observations rather than re-runnable gates.

| Unreachable revision | Recorded in | Recorded measurement |
| --- | --- | --- |
| `ee23cf6` | Focused Browse and shared Home previews | preview artwork, 19 Browse rectangles, 95 browser cases |
| `291a061` | Home billboard and shared reverse paging | default Home geometry, 36 rectangles, 9s/14s motion |
| `3af20b8` | Large Live directories and Home geometry | 32 reduced-motion Home rectangles, 10,041-channel offset counterexample |
| `d3ab4d9` | Entry fidelity, animation cost and Live snapshot coherence | seven matched captures, 80 rectangles |
| `c9c1aae` | Completion audit checkpoints | paired Home bundle comparison |
| `5613158` | Navigation availability follow-up | three paired Home runs |
| `76c73fde` | Producer, playback and navigation checkpoint; Server-authoritative TV rebuild | Video pin absent from `viptv-org/video` |
| `c7e4aa6` | BE-002 native source headers | native plugin MP4/HTTP 401 qualification |

Producer, design, core and Video revisions cited beside these do resolve in the
repository that owns them. The anchors the build checks are [DESIGN_REF](DESIGN_REF)
`8b7f85941addf5a65390fe6eca4f11aba9584a17`, [VIDEO_REF](VIDEO_REF)
`4b52aa5bfaf7f993ad6aa791e759f884ff4e23fd` and [CORE_REF](CORE_REF)
`b6ee0548753483c9627cb1c73e7761b62f936933`.

This checkpoint fixed regressions reproduced by 14 failing cases: stale HTTP
errors, lost refresh rotations, cancellation blocked by refresh, late outcomes
from retired authentication sessions, unbounded response-body consumption,
invisible Live category focus, revision focus/cache restoration, explicit media
key semantics, and a cancelled episode picker changing the active player target.
Additional tests cover host suspension, webOS root Back and EPG refresh when
profile revisions remain unchanged. Platform admission now reports web, Tizen,
Vizio or webOS explicitly instead of always reporting web.

Validation on isolated HTTPS output `/tmp/viptv-tv-audit-20261023`:

- Production build/type checks/immutable dependency checks passed; reachable TV
  boundary passed for 176 emitted modules, including the pure webOS host helper.
- Full unit suite: **342 passed / 60 files**. Transport: 29 cases; webOS host
  helper: three cases. The final UI-only intent separation was then checked by
  another production build and the complete browser run.
- Full single-worker browser suite: **40 passed**.
- A subsequent extended round trip visited all 120 fixture channels: **238 focus
  samples**, at most **17 observed retained guide snapshots** and **one observed
  active request**. An earlier 198-sample run observed five active requests. The
  assertions enforce ceilings of 25 snapshots and five active requests.
- All 200 category choices remain selectable with exactly one visible focus and
  at most nine rendered category chips. Moving focus dispatches no category fetch;
  only activating the selected category does.
- Oversized streamed-response test cancels after at most 65 × 64 KiB chunks;
  the retained response budget is 4 MiB, with one incoming transport chunk of
  possible overshoot before rejection. Split UTF-8 decoding is verified.

Five paired performance runs used identical current API fixture data for the
previous `c9c1aae` bundle and the candidate; `c9c1aae` is unreachable (see
[Cited revisions](#cited-revisions)). Served HTML is checked against the
selected build directory before measurement. All current runs passed the strict
17.5ms p95 frame gate, with zero long tasks/frames over 50ms. These measurements
cover the Home workload only; see PERFORMANCE.md for distributions and limits.

Backend producer remains `23b9675`. Its three reproduced baseline failures have
not been resolved in this UI checkpoint. Concurrent gateway media-lab edits were
preserved. No shared QA binary or production hosting was replaced. The previous
hosting ZIP remains a historical checkpoint; a final replacement awaits the
full completion audit.

---

# Focused Browse and shared Home previews — 2026-10-24

Source `ee23cf6fb9c84191a1fe96c724c291ed473deb4f` (unreachable; see
[Cited revisions](#cited-revisions)); producer
`0d8da118e2282c1d7cefa4bc590004bf6a97c211`; design
`6bd0c0b3dd76f43d96a76e281ef7e4ec4886794c`. The canonical engine remains
`65add90c6a73da8743021ed0a0ff5c862d78124d`; React's core pin is unchanged.

Home row cards project `view.preview.background`, caption, progress and activation
intent. The producer reuses scoped continuation and verified metadata, retaining
episode artwork on tiles and separate series artwork in the focused preview.
Only eligible Continue Watching entries project Play. The same resumed title in
My List projects Details. Viewing-action still makes the fresh playback decision.
A regression covers missing parent artwork: sibling episode frames cannot leak
into each other's preview fallback. Provider/client view fields are not trusted.

Browse uses reference geometry, logo aspect, metadata, description, resume hint,
progress and focused Play treatment. Geometry/pixel gates and private captures
cover 19 measured rectangles; Home retains its 36 measured rectangles. Server
badge ordering/wording and minute-based subtitles are preserved; unsupported
release-age badges are absent. Whole-frame scores are measured browser results,
not universal pixel identity. Exact values are in REMOTE_VISUAL_MEASUREMENTS.json.
Home-to-rows choreography remains a separate unqualified reference.

Five new browser cases cover explicit Play versus Details with contradictory
caption/progress, no inferred resume when preview is absent, rapid focus/late
artwork cancellation, and bounded blur reuse. Hover sends no metadata, viewing
or source request; activation consumes the fresh server episode. Back restores
tile focus. Initial repeated blur readbacks increased work/key to 43.917ms;
retaining one small result per mounted tile reduces it to 26.972ms. See
PERFORMANCE.md for the comparison and separately reported memory.

Final checks: 95 single-worker browser cases; 345 unit tests / 60 files;
real-producer HTTPS pairing/profile/reload/preferences flow; type/design/core/
video gates and production build (194 reachable TV modules, no local engine or
business-policy runtime). Backend: 570 passed / 11 ignored, including scoped
parent artwork, same-title action differences and the sibling-frame regression.
Three navigation runs and three 30-second normal-motion Home runs have frame
p95 ≤16.8ms, zero long tasks and zero intervals above 50ms.

Isolated bundle: `../.artifacts/tv-remote-browse-20261024/tv-web-hosting.zip`.
Remaining references, bounded payload windows, per-screen lazy loading,
unique-art stress, equivalent original baseline and playback edge cases remain
open in the completion audit. The Roku handoff also records
`ROK-MEDIA-20261024-MKV-COPY`: truncated Matroska-to-HLS output in its frozen
producer/gateway fixture. That producer investigation is open; no client timing
workaround was added. Concurrent gateway edits were preserved. No deployment,
shared QA replacement or physical-TV certification occurred.

---

# Home billboard and shared reverse paging — 2026-10-24

Source `291a061c3300dfb979d182e4030f527d8d049a69` (unreachable; see
[Cited revisions](#cited-revisions)); producer
`1a361e4dc7923cf2909ff0be828912fb8530fa48`; engine
`65add90c6a73da8743021ed0a0ff5c862d78124d`; design
`09c75289adceb80c6c343a3812369d20414eb989`.

Home follows the server's featured order with the reference 9-second indicator
and 14-second ease-out zoom to 106%. Input, menus, pending/error and hidden-page
states pause/restart the cycle. Reduced motion remains static. Cycling never
requests viewing intent, sources or playback. Image clocks retire after 14s;
failed, late and zero-size artwork cannot block controls or cover another route.

The backdrop composes its fixed gradients in one pass. Small yielded canvas
jobs prepare bounded glass textures; zoom coordinates are calculated per vertex.
Static uniforms avoid per-frame cache growth. Pixel checks cover the foreground
as well as node geometry, after the first capture exposed late artwork layering.
The focused controls, icons and shadow now use reference geometry and treatment.
Default Home has **36 matched rectangles**. At 7s and 14s, artwork/control region
mean differences are all below **1.67/255**. Whole-frame mean is **1.366/255**;
these are browser measurements, not universal pixel identity.

The shared Live response now contains server-owned `paging.origin`, applied
limit, navigation `page_size`, and nullable previous/next request descriptors.
Clients can keep bounded payload/metadata windows without cursor arithmetic.
A short reverse slice preserves its original navigation budget for the next
forward request. Tests cover arbitrary origins, changed slice sizes, past-end,
empty/unconfigured, private directories and unchanged snapshot scope.

Accepted gates: **90 browser cases**, **345 web unit tests**, real-producer HTTPS
pairing/profile/reload flow, type/design/core/video checks and production build
(**192 TV modules**, no local engine/policy). Producer: **569 passed / 11 ignored**;
Live-runtime: **20 passed / 1 ignored**; shared engine: **115 passed / 1 ignored**.
Three navigation pairs and three 30-second normal-motion runs pass the frame
budget with no long tasks or >50ms intervals. A proposed retained-control-layer
optimization reproducibly missed the motion gate and was removed; diagnostics
are kept separate from acceptance data. See PERFORMANCE.md for measured costs.

The conversion remains in progress. Browse/Home-to-rows, remaining references,
bounded client payload windows, original fixture equivalence, unique-art stress
and remaining playback cases are still open. No deployment, shared QA replacement
or physical-TV certification occurred.

---

# Large Live directories and Home geometry — 2026-10-23

Source `3af20b865b7945ef729b876a0d3b3ac6d427c727` (unreachable; see
[Cited revisions](#cited-revisions)), producer
`def82a0fce40317ae9e15554c325626064bd5157`, canonical server engine
`62b45fca8e82593a0a9ab3320b1adb7cf4f63a98`; design remains `bf5d1e1`.

The Roku handoff's offset counterexample was reproduced: a 10,041-channel
catalog emitted cursor 10040, then rejected that request. The canonical query
now accepts the full existing u32 offset range while retaining the 200-row page
limit and other input budgets. Native readers clamp to available rows before
adding the limit. Browsing, Search and category-filter cases reach the final
channel; maximal past-end requests return empty/complete. No client truncation,
new endpoint or changed native schema/ABI was introduced. React's core pin is
unchanged. The shared fixture includes this boundary expectation.

Home now uses separate server-ordered metadata parts, correctly spaced and
outlined badges, and the reference row-heading and tile-badge typography.
All **32 measured rectangles** match within one pixel. Whole-frame mean channel
difference falls from 2.031 to 1.449/255. This is reduced-motion geometry evidence;
Home's carousel/zoom timing and glass/backdrop details remain open.

Gates: full build/type/integrity checks pass (**188 TV modules**); **84 browser
cases**, **345 web unit tests**, and the real-producer HTTPS flow pass. Backend
**568 passed / 11 ignored**, Live-runtime **19 passed / 1 ignored**, canonical
engine **115 passed / 1 ignored**, and the native-core boundary case passes.
Three matched Home performance pairs pass the existing frame budget with zero
long tasks or >50ms intervals; see PERFORMANCE.md. Shared QA and production were
not changed; concurrent gateway work remains untouched. The complete conversion
is still in progress, as recorded in the completion audit.

---

# Entry fidelity, animation cost and Live snapshot coherence — 2026-10-23

Runtime source `d3ab4d900500dc7418aea9194a2084da7fb73498` (unreachable; see
[Cited revisions](#cited-revisions)); producer
`e8e7b5fa74a581dc6c40d6876edee9ab3f9a665d`; design
`bf5d1e1476b40e3f57b4e30e4f3e8bc6e4d65877`. Later design commits change Roku
notes only; the included Tv3 HTML/artwork remains unchanged.

Splash, Welcome, SignIn and Profiles now use the reference geometry, typography,
artwork treatment and motion. Pairing uses server-issued values and a monotonic
expiry duration, clears abandoned codes during refresh and rejects cancelled
replies. Profile controls obey management capabilities, including an empty-list
Retry state. Required authentication remains the only entry path.

The shared Live API now projects `snapshot_id`. Live and channel Search compare
it before appending pages, discard incompatible windows and reload offset zero;
Live also retires dependent guide requests. The producer reuses existing IPTV
catalog generations and private directory cache identities. No core ABI/native
cache-struct change or separate TV business engine was introduced.

Private matched captures cover seven states, with **80 measured rectangles**
and **32 Welcome artwork-region comparisons**. Entry geometry is within one
pixel; the earlier three boards retain their 0.5px bounds. Welcome artwork
regions, excluding foreground controls/text, differ by at most 0.61 RGB channel
levels on average. These measurements do not assert universal pixel identity.

The initial moving wall failed the frame budget. Profiling and a repeatable
cache probe exposed **119 additional shader-cache entries in two seconds**.
The final implementation uses a bounded artwork atlas, one compositing pass and
the renderer clock: the same probe stays at **2 → 2 entries**. Reusing the guide
locale formatter also removes a measured JavaScript hot spot. Failed probes are
retained separately; final performance results are in PERFORMANCE.md.

Final isolated-output gates (`/tmp/viptv-tv-entry-clock-20261023`):

- Production, TypeScript and immutable design/core/video checks pass; the TV
  dependency boundary contains **187 modules**, with no legacy engine/policy.
- **84 browser cases** and **345 unit/integration tests in 60 files** pass, with
  one worker. The real-producer HTTPS pairing/profile/reload flow also passes.
- Backend: **567 passed, zero failed, 11 ignored** in the shared working tree.
  The Live-runtime group has **18 passed, 1 external fixture ignored**.
- Three matched Home and Live pairs, a final Search run, three normal-motion
  Welcome/pairing runs and a continuous 60-second Welcome run all meet the
  17.5ms frame-p95 gate, with zero long tasks or frames above 50ms.

The full completion audit remains open: seven of fifty included references have
matched captures. Remaining screen/state coverage, original pre-conversion
fixture equivalence, unique-art stress and playback qualification are tracked
in `tests/REMOTE_COMPLETION_AUDIT.json`. No shared QA binary/data, production
hosting or physical-TV certification was changed.

---

# Search, typography and session retirement — 2026-10-23

Producer `38a89cc09fa282bde962e4961870a4720fd6a14c`; design
`008791323a2c2b23624f08f6eaa46a48940fd9d3`. Later local design commits affect
Roku documentation only; the included Tv3 reference HTML/artwork is unchanged.

Search now uses the reference input, Space/Delete/alphanumeric keyboard,
212×318 posters and channel row. Media and channel availability come from
separate server facts; channel-only profiles avoid media queries. Results keep
server order and provenance. Each query retires prior requests/results, partial
results remain retryable, channel paging keeps the boundary intent, and playback
returns to the selected channel. Unsupported query suggestions, channel numbers
and program captions remain omitted under the canonical scope.

Text now uses the shipped font metrics and CSS line boxes, native-size glyph
bitmaps, and native letter spacing where supported. The older-platform fallback
is exercised. All 62 measured rectangles across SignedIn, My List and Search
match within 0.5px. Private capture differences and font provenance are recorded
in `tests/REMOTE_VISUAL_MEASUREMENTS.json`; whole-frame metrics are not a claim
of universal pixel identity or physical-TV qualification.

Auth retirement now stops obsolete revision polling, fences unsignalled replies
and queued playback observations, and cannot let progress bookkeeping prevent
decoder shutdown. A failing full-suite case exposed the shutdown issue before
it was fixed; the final run passes it and the new re-pairing regressions.

Final gates on isolated `/tmp/viptv-tv-search-20261023`:

- Production, TypeScript, immutable dependency/design checks and TV boundary
  passed: **181 modules**, no local engine/client business-policy runtime.
- Full single-worker browser suite: **76 passed**.
- Full single-fork unit suite: **344 passed / 60 files**.
- Actual producer HTTPS flow, with no API interception: **passed**, now including
  Search as well as pairing, profile selection, reload, detail, save and preferences.
- Backend library suite: **566 passed, zero failed, 11 ignored** in the shared
  tree, including the preserved concurrent media-lab harness.
- **15 candidate performance runs passed** across five workloads. The final
  paging-auth guard has separate final-build checks; see PERFORMANCE.md.

The overall completion audit remains open. Remaining reference states, source
form fidelity, original matched pre-conversion fixtures, unique-art stress and
remaining playback/state gaps still require verification. No shared QA runtime,
database or production hosting was replaced.

---

# Live source authority follow-up — 2026-10-23

Producer `74e0ac964a88be08738704f570d53d6c43aceae4` returns the canonical Live
viewing action and saved source-selection preference. The TV consumes that
response and the existing source-ranking API; it no longer hard-codes Ask or
assumes the first Live source is best. Explicit source-picker intent still
requires a user choice. The action target contains no artwork/media URLs;
artwork remains in the existing channel directory.

Validation: production/type/integrity gates passed, **64 browser cases** and
**343 unit tests** passed. The complete default backend suite passed **566 tests,
zero failures, 11 ignored**. The `live-runtime` feature's Live group passed
**16 tests**, with one explicitly ignored public-playlist test. Assertions cover
saved Ask/Best policy, canonical channel identity, parental/source scope and a
URL-free M3U source response even when its directory card contains artwork.
The browser test deliberately names the second Live source as best, then proves
that manual source changes still wait for explicit selection.

Overall qualification remains open. Search geometry and per-query cancellation
are next; the current implementation uses a four-column result grid instead of
the reference's five 212×318 tiles, and superseded query failures are not yet
independently fenced. Prior performance and matched visual evidence below retain
their exact checkpoint scopes.

---

# Navigation availability follow-up — 2026-10-23

Backend producer `d1eda1d96d860a436e1d93a69cb4acbd5f9a1b01` now supplies ordered
navigation from cached profile capabilities and catalog types. The TV omits
unsupported routes, preserves focus by route ID when entries disappear, retires
an open section when the server removes it, and prevents Back from reviving a
retired catalog. Older snapshots expose only the base Home/Profile entry points.

Validation: **63 fixture browser cases**, the separate **real producer HTTPS
flow**, and **566 backend tests** pass (zero backend failures, 11 ignored in the
shared tree). The real movie-only fixture advertises neither Series nor Live.
Production/type/integrity checks pass with 178 TV modules. The design pin remains
`e61f5cb2ca39fcc1c78b1028a6cda391afdfe779`.

Three additional paired Home runs against `5613158` (unreachable; see
[Cited revisions](#cited-revisions)) pass the frame gate with
zero long tasks/frames above 50ms. Startup medians: 510.4 → 524.7ms, with ranges
508.4–544.1 and 506.2–526.1ms. Navigation work/key: 25.411 → 24.691ms. Decoded
JavaScript: 995.187 → 995.973KiB. These overlapping ranges do not establish a
startup regression. This follow-up does not claim new all-state visual parity.

---

# Producer, playback and navigation checkpoint — 2026-10-23

The rebuild remains **in progress**, with 42 tracked obligations: 18 verified
for their stated scope, 20 partial, three open, and deployment/physical
certification outside this task. All 50 included Tv3 boards remain in the audit;
two now have current matched captures and 15 exact artwork bounds. This does
not establish exhaustive visual parity.

Exact inputs: backend `8228c40d4ef6c765f58c5989bb9f252403035411`, design
`e61f5cb2ca39fcc1c78b1028a6cda391afdfe779`, video
`76c73fde22984d6d87a4848aab2fb47d563fdf46` (absent from `viptv-org/video`;
see [Cited revisions](#cited-revisions)). The server's canonical engine snapshot
is `e42a97fd9734b850b92579e2eb10d800300e39f1`. The separate React core pin is
unchanged. The design pin includes TV-web's Library filter access path; Tv3
reference HTML/artwork remains the approved revision.

This checkpoint adds server-projected player permissions and validated source
replacement, correct Live channel source changes, confirmed active caption
appearance, authentication-loss cleanup, and pending-page focus intents. Pairing
now includes Tv3SignedIn with its entrance/timer and authoritative destination.
My List consumes producer type/sort/filter/reset values, keeps drafts until
Apply, and cancels late reads on Back. Its measured geometry/focus treatment was
corrected. Hidden poster labels are no longer rasterized.

Validation on isolated `/tmp/viptv-tv-authority-20261023`:

- Production build, all TypeScript groups (including remote/server test configs),
  immutable design/core/video checks and TV boundary passed: **178 modules**,
  no local engine or client playback-policy runtime.
- Single-fork unit suite: **342 tests / 60 files passed**.
- Full single-worker deterministic browser suite: **57 passed**.
- Separate trusted-HTTPS **real producer browser flow passed**: actual device
  pairing, bootstrap/profile selection, durable reload, owned add-on catalog and
  detail provenance, library save/read and preference persistence. No API
  interception; [fixture instructions](tests/REMOTE_SERVER.md).
- Backend complete single-threaded library suite: **564 passed, zero failed**.
  The parental-certification failures are fixed. Shared core owner tests:
  **114 passed, zero failed, one existing ignored**. Native response compatibility
  is checked with the actual NativeTorrentBridge parser. External-runtime
  backend harnesses remain explicitly ignored in the default suite.
- All **12 candidate performance runs** (three alternating pairs per Home,
  210-title grid, 120-channel guide and 100-row settings workload) passed the
  17.5ms frame p95 gate, with zero long tasks and zero frames above 50ms.
  See PERFORMANCE.md for timings, heap, textures, transfer and limits.
- Tv3SignedIn/Tv3MyList matched private capture review and geometry: all 15
  artwork rectangles within 0.5px. Canvas text rasterization differs by roughly
  1–3px in the inspected sign-in ink bounds; selected-pill shadow remains a
  visible minor difference. Captures stay private, outside source/release files.

Measured and final production JavaScript bundle hashes are identical:
`397e5c7dda9a358b24270902ba71a4fcf3183b3d267f7c3a5552aeffe4d89f3f`.
Evidence/artifact checkpoint: `../.artifacts/tv-remote-authority-20261023/`.
No shared QA binary, database, served bundle or production route was replaced.
The original matched-data pre-conversion baseline, remaining visual states,
capability visibility, unique-art stress and remaining flow gaps are still
tracked in [the completion audit](tests/REMOTE_COMPLETION_AUDIT.json).

The older sections below are historical checkpoints, including failures later
resolved above.

---

# Server-authoritative TV rebuild — 2026-10-23

Current scope and per-reference limits: [tests/REMOTE_PARITY.md](tests/REMOTE_PARITY.md).
Backend producer `23b9675f4411eda9448b41177450720ad8b20fac`; design
`58245a1429cfc8c954b708b1f116e5cbb2cdaaf2`; video
`76c73fde22984d6d87a4848aab2fb47d563fdf46` (absent from `viptv-org/video`;
see [Cited revisions](#cited-revisions)).

| Gate | Result |
| --- | --- |
| All TypeScript groups | Passed |
| Immutable design/core/video checks | Passed |
| Production build, isolated `/tmp/viptv-tv-after-20261023` | Passed |
| Reachable TV bundle boundary | Passed: 175 emitted modules; no legacy core, local torrent, client playback policy, MediaBunny or Tauri runtime |
| Single-fork Vitest | 326 passed, 60 files |
| Single-worker remote Playwright | 30 passed |
| Video owner tests/typecheck/build | 173 passed, 15 files; checks/build passed |
| Backend `cargo check` | Passed, existing warnings retained |
| Backend library suite, one test thread | 554 passed, 3 failed, 10 ignored |
| Canonical design validator | Passed: 12 required docs, 1049 assets, 653 canvas references, 516 tokens |

The three backend failures were reproduced on the untouched `7275bce` baseline:

- `auth_integration_tests::kids_library_uses_trusted_ratings_approvals_and_exact_episode_membership`
- `auth_integration_tests::kids_mixed_series_details_omit_every_episode_disallowed_by_sources`
- `auth_integration_tests::kids_policy_changes_revoke_already_issued_resources`

They remain unresolved baseline failures; this is not an all-green backend claim.
New viewing intent, membership/presentation, source ranking/filter, preference
admission and optional hosting tests passed. Concurrent, uncommitted gateway
media-lab test changes were preserved and excluded from the producer commit.

Browser acceptance uses a production build on a private trusted HTTPS origin,
fixture API responses and a real HLS decoder fixture. It covers current `/api/*`
routing, refresh/session failure handling, profile isolation/revisions, exact
server-selected source/episode targets, partial discovery, source reranking,
explicit Next, foreground/expiry/release, cancelled replacement, rejected
mutations, focused long lists, keyboard symbols/case, 700ms hold, reduced motion,
normal drawer timings, season navigation and restored focus. Tests wait for
committed UI state before activating a source; request dispatch alone is not a
readiness assertion. Lease fixtures allow media preparation before intentionally
stalling/refusing renewal, while retaining independent expiration checks.

Reproduce from `tv-web/` with the owned trusted HTTPS preview on port 18562:

```sh
npm run build -- --outDir /tmp/viptv-tv-after-20261023 --emptyOutDir
npx vitest run --pool=forks --poolOptions.forks.singleFork
npx playwright test --config playwright.remote.config.ts
node --experimental-strip-types tests/preview/remote-visual.mjs
```

The visual sweep records private captures and renderer geometry; see the parity
record for compared bounds and limits. No screenshots are committed or packaged.
Performance measurements and their software-GPU limitation are in PERFORMANCE.md.
No shared QA binary, served KMP/Wasm distribution, production route or live user
data was replaced. Tizen/Vizio/webOS physical qualification and signed packaging
remain separate gates.

---

## TV My List and phone 2:3 posters — 2026-10-11

Design `8b7f85941addf5a65390fe6eca4f11aba9584a17` (TV-MYLIST-POSTER-001 and
PHONE-POSTER-001 remain current in the adopted contract; this 2026-10-11
checkpoint measured `4f3a1eae36399608f459b5973381ead969c2c2d1`). The SolidTV
My List segment draws seven 200 × 300 posters per row from the shared core
`posterImage` projection, keeping the focused row at the grid top; Continue
Watching keeps its four 360 × 202 stills. The TV Home My List shelf draws
160 × 240 posters and grows by 60 px. Responsive phone poster cards use 2:3
instead of 4:5.

Verification: typecheck, 310 unit tests in one fork (new
`tests/ui/tv-my-list-posters.test.ts`) and the production build pass. Solid
preview `TvLibrary` (Tizen) passed its existing focus/hold/source/return
assertions; the saved grid, Continue Watching grid and a scrolled Home My List
shelf were inspected locally at 1920 × 1080. The TV fixture's `poster` values
for some titles are landscape stills, so those cards show a cropped still in
the preview; real saved posters are portrait. Phone `Library` at 390 × 844
shows three 2:3 posters per row. Vizio/webOS captures, Playwright e2e and
physical TV runs were not executed for this change.

## SolidTV history-Back guard for hosted TV containers — 2026-10-08

The owner reported full black screens on the Vizio receiver when pressing
Back during playback (both from visible chrome and after entering from
Continue Watching). Diagnosis combined the real receiver's request log
(watch-web nginx: playback DELETE on exit with no further document
requests) and a harness reproduction: hosted-TV containers such as Vizio
SmartCast Conjure deliver the remote's BACK as **browser history
navigation**, and the solid renderer had no history handling at all — with
the receiver URL as the session's only history entry, an unguarded
`history.back()` lands on `about:blank` and blanks the whole app.

`src/bootstrap.ts` now installs a history sentinel for the solid renderer:
one extra same-URL history entry, a `popstate` handler that re-arms the
sentinel and re-dispatches the event as a `keydown` with `key: "GoBack"`
and `keyCode: 461` (the legacy keyCode is required: old TV Chromium
resolves key maps through it, and synthetic `KeyboardEvent` leaves it 0).
The renderer's existing Back handling then treats it exactly like a
remote BACK press: first press hides player chrome, second exits playback
to the sources screen with the video layer hidden.

Verification: the new `tests/e2e/vizio-back-black-screen.spec.ts`
(4 tests, vizio project) covers key BACK exit, chrome-auto-hide exit,
history-Back document survival and double history-Back exit — all pass.
`tsc` typecheck and the 291-test Vitest suite pass. The full vizio
Playwright run has 10 failures and 1 flake; a stashed-baseline rerun of
the same files reproduced 9 of the failures identically (the tenth,
`next-episode.spec.ts:322`, also fails on baseline), so none are
regressions from this change. Physical TV verification on the owner's
Vizio (Conjure `watch.syek.tech/?platform=vizio`) is still needed once
deployed; the bundle served there predates this fix.


Core `0f500daad567c11db9ff6608f225341a01fe4afa` supplies the revised native
cache-capacity explanation and matching WASM artifact. The isolated app source
at `319fa1e` passes all typecheck groups, 285 unit tests in one fork, pin integrity
checks and the production build. This imports shared presentation; TV-web does
not advertise native torrent delivery. No layout, Playwright, physical-device
or deployment acceptance is claimed by this snapshot check.

# Shared policy contract adoption — 2026-10-06

Android and TV-web pin core `246a26f4c3788397314ae3e9ffe4d5ffa5e1e74d`.
Canonical Rust owns the shared presentation, source/progress, lifecycle and
playback reducers; Android's migrated consumers execute their typed decisions.
TV-web imports matching generated TypeScript/WASM through its owning sync script.
The imported WASM SHA-256 matches the artifact verified by 37 identical
native/actual-WASM policy vectors and the canonical WASM suite.

The full single-fork Vitest suite passed 285 tests in 55 files. A final API rerun
passed 20 tests, including the reverse-cursor contract and generated producer
outcomes. Successful live-page fixtures explicitly include `previous_cursor`;
a response missing that contract fails without a legacy fallback. The input
poll-state adapter preserves Rust's default-empty outcome fields; returned state
retains the generated producer facts.

`npm run build` passed design/core/video integrity, all seven typecheck groups
and production compilation. Existing mixed-Tauri-import and large-chunk warnings
remain nonblocking. Root AGENTS.md records the shared decision/effect boundary.
No browser/media/device or installed-desktop qualification was performed. Local
commits only; nothing was pushed or deployed.

# Shared playback error normalization — 2026-10-06

Android and TV-web adopt core `d104fd91e96ce2bdc468c7aa702222b96f90fe7b` through
their owning core-sync scripts. Rust supplies canonical safe messages for backend
source/gateway failures through both `apiError` and failed `playbackV2` leases;
wire types, source selection and automatic retry policy are unchanged.

The actual imported TV-web WASM passed 26 canonical vectors (104 HTTP cases and
26 failed-lease cases), including precedence over upstream text and credential
redaction. Single-fork Vitest passed 43 tests across playback-v2, playback-lease,
core-session, error-detail, player-error-dismissal and solid-playback-runtime.
`npm run build` passed design/core/video integrity, all typecheck groups and Vite
production compilation. Mixed Tauri imports and large chunks remain nonblocking
build warnings. The emitted WASM matches the imported binary's SHA-256.

No browser/media/device checks were performed. HTTP-category dialog titles and
synthetic 409 statuses for failed leases remain presentation limitations; native
decoder errors still belong to their adapters. Core native/actual-WASM tests do
not establish physical TV or installed desktop playback. No push or deployment
was performed as part of this qualification.

# Native Recovery Integration - 2026-10-05

Minimum baseline is current GitHub main, retaining the deployed direct-fetch
retry policy, Vizio decoded-frame/pause/error safeguards and immutable asset
tagging. Design is `b64c98e3a97660fbee17aebb7c548f87a6494790`; Video is
`13eb9535af29023e8bb97ee444aaa18e45c40c4b`, imported with the owning sync scripts.

Managed seek regressions exercise the real session controller replacing its
decoder: rapid skips retain the latest target, while changing the selected
source cancels stale work. Native refusals are nonterminal; source diagnostics
redact unknown credentials inside JSON strings, including spaced labels.
Native buffered ranges retain starts/gaps and managed timeline offsets.

Current local evidence: 283 UI/API unit tests; 166 owning Video tests; seven
typecheck groups; snapshot integrity and production build. Trusted HTTPS
fixture acceptance covers source-filter return, titlebar fullscreen, outage
dismissal, desktop-only backdrop behavior, browser/phone layout, restoration,
and four remote-player scenarios. Screenshots at 1440x900 and 390x900 were
inspected privately; synthetic media images are not native decode proof.

The remote media fixture now reports advancing synthetic decoded frames. Its
previous zero-frame report correctly triggered the retained Vizio watchdog;
production stall detection was not disabled to make that test pass.
Native hardware, installed-app production playback, ordinary-display scrolling,
and Windows/macOS qualification were not rerun. Historical evidence follows.

# Desktop timeline, source return and fullscreen — 2026-10-03

The adopted design pin is `8b7f85941addf5a65390fe6eca4f11aba9584a17`; this
2026-10-03 checkpoint measured
`a8b5acac2f810e3d447334e64b7fc3f44c696b4d`, which later revisions superseded.
The Video revision this checkpoint recorded,
`f22a2a6672c01f55c2c777e27a1428bf5e998d88` does resolve in `viptv-org/video`
but is not the current [VIDEO_REF](VIDEO_REF) `4b52aa5b`; the tv-web checkpoint
that consumed it is unreachable (see [Cited revisions](#cited-revisions)), so
these measurements cannot be re-derived here. Selected VOD intent retains
positive native duration/buffering before the first seek, including
GStreamer live=true.
Explicit desktop source replacement retires outgoing presentation/lease and
remains empty on failure; managed seek/track/Next recovery stays separate.

Provider and quality filters survive player, titlebar and browser Back to the
same episode; another episode starts at All. Player-button/titlebar fullscreen
share native ownership, including the primary command, fallback and late
completion. Dismissing an outage hides its notice while bounded recovery probes
continue; repeated failures keep it dismissed until recovery.

Validation: 281 unit tests, all seven typecheck groups, imported-pin checks and
production build passed. Three trusted-HTTPS browser scenarios cover filter
return/reset, titlebar player fullscreen and outage dismissal/recovery. Native
qualification in the desktop owner covers real GStreamer/MPV timeline/control
facts with normal local-backend admission, plus a separate fixture-admission
run for resizing and actual HTTP 407 failures. Both engines showed bounded
redacted errors and an empty failed replacement. Private captures were inspected.
Full evidence and limitations are in the desktop branch's
[NATIVE_CONTROLS.md](https://github.com/viptv-org/desktop/blob/chore/native-final-recovery/NATIVE_CONTROLS.md).

Native tests used an isolated GTK/WebKit X11 display. Ordinary-desktop Home
smoothness, reported sidebar scrolling and exact Lanterns S1E1 reproduction
remain open. Browser and fixture-admission evidence do not certify every
provider, physical TV, codec, Windows or macOS. Core and Android pins are unchanged.

# Native initial Resume adoption — 2026-10-02

Video source `2038c0f5cd69ae60dd033a16bda2d1fc46afe7de` (reviewed PR8)
replaces `550ab350`. A newly opened GStreamer pipeline can report duration0 and
live=true before metadata settles, even after a VOD queue/request/open target30.
The adapter now takes startup VOD/live intent from the selected request, so
transient native facts cannot skip Resume. Both adapter/IPC regressions are
red before/green after; Video128 tests/typecheck/build pass. Core/design/types
and renderer paths are unchanged. Consumer build/types/integrity pass; actual
native replay and outstanding controls/sidebar flicker remain separate.

# Populated responsive source rows — 2026-10-02

The source drawer's flex scroll container shrank its existing fixed100px desktop
and108px phone rows when twelve entries arrived, clipping the Best match/body
text. Preventing responsive rows from shrinking retains the already-declared
sizes; TV row layout, data, description motion and immutable pins are unchanged.
Both 390×844 and1440×900 public UI/HTTP geometry cases failed before the CSS
correction and pass after: twelve uniform rows, no content overlap, a scrollable
list and reachable final row. The existing long-filename focus/reduced-motion
case also passes. Three cases take2.4s with one worker/no retries. Captures stay
private; this is browser layout evidence, not installed/native/hardware proof.

# Desktop restoration failure fixture — 2026-10-02

Application baseline main `0291ed5a241e3423ccbc215fa22e1b6c036bae4b`,
design `1742afa2b50d30638fa46f3abc8c1a76638a51e1`, Core `f66c87e`, Video
`550ab350`. The old DeskPlayerRestore fixture reused one viewer ID and permitted
an unstubbed MSE fallback; failed-candidate cleanup/accelerated heartbeat could
stop the outgoing fixture instead of reaching recovery. The corrected registry
uses distinct IDs and exhausts local paths. The existing application's explicit
Next failure and failed restoration now reach recovery over the bare picture.
Responsive Retry carries the drawn refresh icon through an explicit actions
view; recovery presents one dialog without a duplicate error toast underneath.
Three public UI/HTTP/adapter scenarios pass: Retry retains the outgoing source
and768-second position, Choose source discovers manually without admission,
and Back returns without a new admission. The final private 1440×900
trusted-HTTPS comparison was inspected. The Retry icon and layout match the
board; fixture still-image framing remains different. No vendor pin or TV
layout changed; installed/native recovery and physical hardware stay separate.
Review found a delayed external-video failure could republish an old dialog or
clear a newer operation's feedback/busy state after Back. The public stage
regression fails on the old source and passes with navigation/request ownership
fences; a same-navigation owned deadline still offers recovery.
All267 app tests, all TypeScript groups, design/Core/video integrity and
production build pass; the three focused Playwright cases passed in15.6s with
one worker and no retries.

# Vizio on-PC SmartCast simulation + real-stream qualification — 2026-10-06

Video pin `f9ce9d3` (adopted in this repo as `502ac32`): three consecutive
non-fatal hls.js network errors now fail the session with a classified
`connection-failed` error instead of silently draining the buffer, and the
Vizio adapter's forward HLS buffer widened from 20 s to 45 s (75 s ceiling,
30 s back) for SmartCast-class Wi-Fi.

New committed harness `tests/preview/vizio-sim.mjs`: drives the production
bundle at the local HTTPS stack with the physically qualified V655-G9 UA
(Model/V655-G9 FW/2.600.596.0-10 Conjure/MTKB-7.600.259.0-prod), CDP CPU
throttling (6x default) and network presets (fast 25 Mbps/40 ms, typical
10 Mbps/60 ms, bad 5 Mbps/150 ms/0.5% loss), capturing per-second buffered
ranges, frames, stall events and media throughput. PC simulation evidence
only, labeled as such; no physical Vizio claim.

Simulator results with real Torrentio/Pengu gateway streams (private evidence
in `.local-https/vizio-sim/`): the user-reported "play 3 s, buffer, repeat"
cycle reproduced on the old bundle (31 stalls in 60 s, median buffer-ahead
0.07 s); after the fix the same title on the *worse* `bad` preset measured
4 stalls and 2.23 s median buffer-ahead. Ranked retry across sources recovers
the intermittent gateway probe failures. Playback reaching `ready` through
`the qualification gateway` verified repeatedly for remux (copy/copy) 1080p sources.

Known environment failures (not caused by this change): the WebM
`media-decode` vizio case fails identically on `main` (blob-URL origin check
in the dev server); the qualification gateway's VAAPI encoder is broken on
the server iGPU (QSV-only), which intermittently pushes transcode starts
past the 30 s ingress window — surfaced to clients as a classified
`gateway_unavailable` error.

# Desktop parity pass (design#3) — 2026-09-30

Design pin unchanged (`4e153a7`). The preview harness compared DeskHome,
DeskTitle, DeskPlayer, DeskPlayerBuffering, DeskPlayerNext, DeskUpNext,
DeskPlayerAudio, DeskPlayerInfo, DeskPlayerLive, DeskSearchRecent,
DeskSearchMatches, DeskLive, DeskSettings and DeskProfiles at 1440x900 against
the committed design export (private captures, none committed). The one
implementation drift found was the responsive player's end label: it read
`52 min` (runtime) where components.md §10 draws both ends as clocks
(`[12:48]` / `[52:10]`). Phone/desktop/web now show `52:10`; the TV player
label is unchanged. Remaining differences are fixture content, pointer-hover
states drawn in the reference, letterboxing of the stub poster, or the
BACKEND_V2 guide rules (no counts, `All channels`, `Search channels`).

Typecheck, 242 unit tests (41 files, single fork) and the production build
passed. Single-worker Playwright: `responsive-corrections` (new end-label
assertion), `shell-chrome`, `tv-shell` (Tizen and Vizio) and `player-remote`
passed; one Tizen `tv-shell` case timed out on a cold dev-server start and
passed on rerun. Browser simulation only; no installed desktop or TV hardware.

# Consumer follow-ups and Core/video re-pin — 2026-09-30

Pins Core `1f8483e` (no-limit source quality reference; dead `maximumHeight`
session field removed) and video `514a332` (uncapped capability profiles,
typed `engine-unavailable` for an uncompiled explicit engine, disguised-HLS
segment prefix stripping). The desktop engine picker offers Auto plus only the
engines `native_diagnostics` reports and migrates a stored engine the build
lacks back to Auto. Continuation ranks the next source against the measured
`deliveryCapabilitiesFor` profile; the fixed 1920x1080 fallback is gone.

The TV shell Playwright fixtures now answer the v2 raw-live routes
(`/api/v2/iptv/live/channels`, `/api/v2/iptv/guide/<id>`), which fixes the
pre-existing `guide behavior` failure; two settings flows that still drove the
retired Maximum quality row were updated. Typecheck, 242 unit tests in 41 files
and the production build passed; single-worker Playwright `tv-shell`,
`tv-shell-media`, `next-episode`, `resilience-settings` and `shell-chrome`
passed (browser simulation only). No installed desktop, real media or TV
hardware was exercised.

# TV package artifact qualification — 2026-09-30

Existing workflow `build.yml` (ID `368648044`) was dispatched exactly once on
published `refactor/backend-v2`. [Run 36690591107](https://github.com/viptv-org/tv-web/actions/runs/36690591107)
records exact head `db9c5ab2da35867e83d970763f53a10628924501`.
Hosting job `109806614046` and webOS job `109806614353` succeeded. Hosting ran
all 234 tests in 40 files, production build and design/Core/video integrity checks.
The overall run is **failed**, not green: Tizen job `109806614238` stopped at
the Samsung certificate prerequisite because the four signing secrets are absent.
No signed WGT was produced, no secret was requested and no signing gate bypassed.

Downloaded hosting ZIP and developer-mode webOS IPK match their SHA256SUMS and
build.json source/version/target declarations:

- `viptv-tv-hosting-0.1.0-db9c5ab2.zip`:
  `bb8068dd41f994caededfefeca69d3b8fcf500c72de840c71c7fe91a24896ca9`.
- `tech.syek.viptv_0.1.0_all.ipk`:
  `2cf6e5bade08a0ab27e26c676668718c6844b738929e4ee61d7741f96bd38f0a`.

Hosting ZIP CRC/path checks passed; index/Solid/compatibility HTML references
resolve to included `/tv/assets/` entries. Packaged Core WASM is byte-identical
to the pinned Core `8ae9f81` snapshot. IPK ar/tar inventory, package/app manifests,
version `0.1.0`, `1920x1080`, Back-history declaration and credential-free HTTPS
launcher `https://viptv.syek.tech/tv/?platform=webos` passed static verification.
The build manifest declares minimum webOS 22; it is not measured device support.

Artifacts and authoritative final run/job logs remain in a new ignored local
directory `artifacts/tv-db9c5ab-uo65Xx`, not in this commit. No hosted bundle was
deployed, TV package installed, browser/native/physical media exercised or
production account accessed. This artifact gate adds no application/frozen-wire,
Android or original-checkout changes; signing and real-TV qualification remain open.

# BE-002 local-only code retirement — 2026-09-30

Core `8ae9f81bb753aaf2de53af5b594ead29845e1a8a` removes eight unused
application-facing provider exports and rebuilds native/WASM bindings. The
standalone backend provider parser remains. Core's baseline/candidate test
compares 35 frozen v2/startup operations through native and actual WASM and
verifies unchanged generated event/wire declarations.

This viewing candidate removes the dormant anonymous shell, on-device addon
registry/discovery/mode modules, executable local preview/test/env scaffolding
and unused local-only CSS. Only the corresponding obsolete tests are retired;
234 retained unit tests passed, as did application/test typechecks, production
build and design/Core/video integrity. Existing stale local records are ignored,
not read, uploaded, migrated into accounts or deleted automatically.

All 36 trusted-HTTPS browser cases passed on the candidate's own loopback
static host at port 18444, with API/art/media boundaries intercepted. New tests
prove stale local keys cannot bypass authenticated/restored boot or sign-in and
cause no retired-addon fetches. TLS was verified without bypass (`200 0`).
The simulated SolidTV Home/live/category/reverse/cancellation checks passed on
Tizen, Vizio and webOS. Desktop Home/sign-in captures were inspected privately;
no active viewing geometry was redesigned and no physical parity is claimed.

No shared HTTPS backend, real account, provider subscription, production host
or database was changed. Android and installed desktop adoption of the new Core
pin remains a coordinated next step. Real gateway/native/physical/signing and
the other BE-002 integration gates remain separately unqualified.

# BE-002 active raw guide and ordinary live playback — 2026-09-29

Design pin `4e153a7daca300389049e5fcfd5c3bc0af5edbee`; Core pin
`fba95c8f3ba00e97fbc460acc746d23a912795bc`. Imported snapshots remain verified
and were not edited by hand. Ordinary React/Solid Home, live search, guide,
category, exact-source and live-playback callers use v2. The guide retains its
geometry, time window, 700ms hold, programme details and Back meaning. No swap
control, category paging buttons, US classification or exact counts were added.

React responsive browsing retains at most three 40-channel pages (120 rows),
invisible eviction spacers and the visible scroll anchor; reverse cursors refetch
evicted pages. Remote renderers replace one 40-channel page and preserve the
programme time slot and backward edge focus. Categories replace one 200-item
page at existing scroll/D-pad boundaries, with reverse refetch and no reserved
provider IDs. Both renderers reject mixed catalog/snapshot data. EPG uses visible
rows plus bounded lookahead; React retains at most 200 guide entries, and Solid
retains only the current 40-row page, with a shared three-request admission limit
even during rapid focus changes. Old filter/profile/page work cannot publish.

Ordinary Watch resolves the exact raw channel to its opaque source, then starts,
renews and releases a v2 logical lease; Vizio requires an authorized gateway.
Cancelled delayed admission cannot stop newer live playback. Maximum-quality
settings and local-only boot/sign-in/build entry points are retired; historical
local registry/storage utilities and their tests remain archival. Shared Core
types and video/gateway wire APIs were not changed by this completion pass.

Final local evidence: 262 unit tests; application and all test TypeScript checks;
design/Core/video integrity; production build; 34 trusted-HTTPS browser scenarios.
Browser guide fixtures cross the retained-page limit, refetch backward, and cross
200 provider categories without starting another channel request. React unit
checks preserve a future programme slot across forward/reverse page crossings.
Solid fixtures cover Vizio category boundary paging, exact-source live playback,
Back focus, v2 release and 90 stable end-time frames on simulated Tizen, Vizio and
webOS; a delayed-cancel fixture checks the newer player's progressing lifecycle
and release ownership, rather than an intermittent cosmetic focus marker.
Home/Live/Playback preferences captures were inspected privately at 1920x1080.
The capture harness's obsolete sixth Maximum-quality row was updated to the
remaining fifth row; no physical or measured reference-image parity is claimed.

Reproduce browser checks with all fixture origins local:
`VIPTV_TEST_API_ORIGIN=https://viptv.local.test:8443 VIPTV_TEST_BROWSER_ORIGIN=https://viptv.local.test:8443 PREVIEW_API_ORIGIN=https://viptv.local.test:8443 npx playwright test --config playwright.https.config.ts`.
The existing shared HTTPS stack was retained, and TLS verified without `-k`
(`200 0`). API/decoder/platform boundaries are fixtures. Real providers/gateway
media, native TLS/redirect handling, physical remote/focus/4K/tracks and signed
TV packages remain unqualified. No production deploy, device install, real
account mutation or provider subscription occurred.

# BE-002 raw live API preparation — 2026-09-29 (superseded by active cutover above)

Core pin b75393e matches Android and adds bounded default/override cursor pages,
category pages without invented counts, exact-channel source resolution and v2
guide requests. The API adapter accepts only opaque IPTV source cards and retains
catalog/profile/parent failures; malformed/legacy data never falls back to old
routes. A fixture resolves the exact channel, admits its id through v2 and releases
it without a discovery job or traffic to a media origin. 2160p facts survive.

All 250 unit tests, application/test typechecks and build passed. Thirty-two
trusted-local-HTTPS browser regressions passed with all API/preview origins set
to the local host. Backend/API/decoder boundaries in those browser scenarios are
fixtures. No viewing layout changed and no physical/device parity is claimed.
Ordinary Guide/SolidTV/Home live callers still use legacy offset/count APIs;
these explicit new methods prepare, but do not complete, their cursor cutover.
No playlist swap UI or production deployment was introduced.

# BE-002 native source headers — 2026-09-29

Video pin 058bfb1 preserves required Authorization/Referer plus native Cookie/
User-Agent, with explicit refusal on unsupported transports. A v2 API fixture
passes original HTTP delivery headers through actual WASM normalization to the
adapter request; source authorization never becomes backend control auth.
244 unit tests, typechecks and build passed. The owning video passed 111 tests
and build; native plugin c7e4aa6 (unreachable; see
[Cited revisions](#cited-revisions)) passed Linux real header-required MP4 and HTTP401
fixtures. Installed desktop and Windows playback qualification remain separate.

Thirty-two trusted-HTTPS browser cases passed across two runs: the first passed
27, while five preview-fixture tests failed because PREVIEW_API_ORIGIN was not
set to the local origin. Those five passed with it set. For the full config use
PREVIEW_API_ORIGIN, VIPTV_TEST_API_ORIGIN and VIPTV_TEST_BROWSER_ORIGIN set to
https://viptv.local.test:8443. No production provider or deployment was used.

SolidTV Home playback/release/failure/retry passed for simulated Tizen/Vizio/
webOS. The required Vizio TvPlayer resume/seek capture passed and was inspected
privately: readable title/times/controls with the selected play focus ring.
No screenshot is committed and no physical TV or full visual-parity claim is made.

# BE-002 active VOD playback — 2026-09-29

Normal movie/exact-episode playback now uses v2 start/poll/renew/release through
the shared intent mapper. Both React and SolidTV report their actual platform,
monitor active lease renewal/expiry, and validate on foreground return. Refused
renewal stops the decoder; network retries cannot extend the lease. A 60-second
local ceiling bounds clock-skew effects during a control outage. Late renewals
cannot restore released cache entries; stale controller stop acknowledgements
cannot overwrite a newer session. Video pin f4218cb includes cancellable backend
admission and a single gateway-proxy fallback for failed direct media transport,
without forcing encoding for a network failure.

Live channel starts remain explicitly legacy pending raw catalog migration.
No automatic old-protocol fallback is added for VOD. Android/Roku playback
migration, installed desktop/header parity, real gateway integration, native track
qualification and the broader cutover checklist remain open.

Validation: 243 unit tests, typechecking and production build passed. Video's
106 tests/build passed; backend's 278 tests/strict Clippy passed with webOS HTML
transport restrictions. Twenty-seven trusted-local-HTTPS browser cases passed
for v2 source/playback/history, failed Next/Resume, foreground revocation, remote
seek/track/exit, queue and responsive behavior. Decoder/API boundaries were
synthetic, not real providers or physical TVs. Three initial broad cases failed
because fixtures counted idempotent cleanup as new intent or treated gateway
delivery as native direct; corrected protocol fixtures passed the full rerun.

SolidTV's Home playback/exit/failure/retry harness passed for simulated Tizen,
Vizio and webOS and asserts platform reporting plus v2 release. The required
solid-shoot TvPlayer resume/seek flow passed for simulated Vizio; its screenshot
was inspected privately, not committed and not claimed as full visual parity.
No production deployment occurred.

# BE-002 shared conversion/track mapping — 2026-09-29

Core pin 4418f1ddb3c1640276f31b130deeb2d4ffa6873d matches Android. The generated
v2 request includes conversion and bounded language/track choices. An API fixture
passes actual WASM playbackV2Intent output through the control transport and
verifies audio-only conversion, desktop identity, preferred language and unchanged
2160p facts without a quality field. All 235 tests, typechecks and production build
passed; both trusted-HTTPS discovery regressions passed. This is still explicit
v2 API preparation, not activation of ordinary player calls or hardware evidence.

# BE-002 v2 playback control transport — 2026-09-29

Explicit v2 start/status/renew/release methods use shared-core request/response
validation. Startup has a 45-second deadline; cleanup has an independent five-
second deadline. Tests cover pending-to-ready, exact control origin, cancellation
before/after admission, identical-body reconciliation after network/proxy errors,
definitive refusal, mismatched ids, malformed deliveries, expiry and safe provider
failures. These are API-boundary fixtures, not actual gateway/player acceptance.

All 234 tests and application/test typechecking passed. The production build
passed. Both existing trusted-HTTPS discovery regressions passed against the
completed build. An earlier browser run overlapped the build and timed out before
profile selection; it is not counted as passing evidence. The ordinary player
path has not yet switched to these methods; capability/track/conversion mapping,
renewal ownership/background recovery and all-platform cutover remain required.
No production changes occurred.

# BE-002 shared playback lease types — 2026-09-29

Core pin f48f983454b21ba637b4580b426ea8e1647ffbb8 matches Android and adds strict
v2 lease normalization plus canonical start/status/heartbeat/stop serialization.
The owning core passed 57 native tests, strict Clippy and actual WASM contracts.
TV-web passed 223 unit tests, production build/typechecks, and both trusted local-
HTTPS discovery regressions after the pin change. Existing playback still uses
legacy routes; client polling/renewal/cancellation and backend conversion/track
preference parity remain required before activating this new contract. This
checkpoint does not claim end-to-end v2 playback, devices or deployment.

# BE-002 independent gateway player preparation — 2026-09-29

Video pin 75d533a59a466fbe23cecc9a8883d4feece4de33 adds a delivery-kind field,
scoped cross-origin/base-path media fetching and authorized native fallback.
The owning video repo passed 103 tests, build, and real Chromium synthetic HLS
playback from a second trusted HTTPS origin with redirect/credential checks.
TV-web's 223 tests, production build, and the two local-HTTPS VOD discovery
regressions passed after importing the committed source. These browser discovery
checks do not establish full playback integration: the API client still needs
v2 start/status/renew/release and shared-core envelope normalization. No installed
Tauri or TV hardware qualification and no production deployment are claimed.

# BE-002 VOD discovery adoption — 2026-09-29

Core pin 4817b07f985d23687ca54df888222f5af96c0cb2 supplies v2 movie/exact-episode
source requests and safe producer failures. All 223 unit tests and the production
build (including application/test typechecking and pin checks) passed. Terminal
empty failed discoveries discard their cached job so retry can start a new one;
healthy sources survive another producer's failure. Authenticated HTTP rejects
redirects. Live source requests and playback remain legacy pending cutover.

Two Chromium acceptance cases passed against the built app at trusted local
HTTPS (curl reported 200 and ssl_verify_result 0), with synthetic API/artwork
boundaries and all unhandled external traffic denied. They verify visible safe
connection-limit text, fresh-job retry, healthy partial results, and no legacy
VOD requests. This exposed and fixed server errors being misclassified as a
connectivity outage then erased by a successful health probe. HTTP failures now
use the existing error surface; transport failures retain reconnect behavior.

Reproduce after starting the local HTTPS stack with a disposable database:
`VIPTV_TEST_API_ORIGIN=https://viptv.local.test:8443 VIPTV_TEST_BROWSER_ORIGIN=https://viptv.local.test:8443 npx playwright test --config playwright.https.config.ts v2-discovery.spec.ts`.
The broader browser/device matrix remains separate; no production deployment or
hardware qualification is claimed. Existing VOD browser fixtures were migrated
to the new paths; mixed live fixtures retain their explicitly temporary bridge.

# Hosted Vizio navigation aligned with Android TV — 2026-09-26

Production delivery verified: `watch.syek.tech/?platform=vizio` serves the tested
`7e0cd9775fe5d4dd12e71316e9d6af5ecad8e64d` bundle. Public HTML SHA-256 is
`737279b3004899f59b49c9d3f1d77c177149c2d0458e766ce6d45f0f314a6149`;
`app-kMJ1mBR1.js` and `design-DVm35TNK.css` plus every referenced entry script/style
matched the local artifact byte-for-byte. The API health proxy returned 200/ok.
The web host switched its static root to a versioned directory using a graceful
nginx reload; API/media routing, backend processes and database were unchanged.
Prior assets remain available to open tabs; the previous root/config is retained
for rollback. Reload an existing Vizio tab to adopt the new UI.

TV-038 (`0322985`) applies to the normal hosted `?platform=vizio` DOM entry.
The rail has explicit neighbors through Settings; focus scrolling uses nearest
edges with native browser jumps suppressed; Home scrolls hero and shelves in one
viewport and retains the full hero for its first row. Season is reachable from
all episode positions. Discover uses two outlined chip rows and four fitting
16:9 grid columns. Decorative TV legends and native scrollbars are removed.
Resume retains the selected accent, and the hero uses Android TV's 664px stage,
1120px artwork width and 72px ambient blur. Android adopts the same Resume rule.

Validation: **191 unit tests** passed; typecheck and production build passed.
Trusted local HTTPS browser acceptance passed five scenarios, including rail and
18-card scrolling at 1920×1080 and 1280×720, upward scroll direction, episode
Season restoration, empty/repeated catalog pages, selected chip borders, grid
bounds, Resume color and blur geometry. The existing Vizio browse/shell/dialog
regression selection passed **14 tests**, with eight pre-existing platform/layout
skips. Screenshots were inspected privately; no capture is a design asset.

A bounded read-only production check reproduced the reported TVDB Collections
search problem: pages 0 and 3 returned the same three items, while the second
page advertised has_more and cursor 6. The client now stops on duplicate-only,
empty or non-advancing pages, retains filter values, coalesces in-flight requests
and cancels stale work. No backend or production database change is required.

This evidence covers Chromium's Vizio browser boundary and Android's API 36 TV
emulator, not a new physical Vizio firmware/codec qualification. The separate
SolidTV canvas entry is outside this DOM navigation change.

# Shared native source contract — 2026-09-26

Adopts core `2cfd963e5cf9178d93e8bbb7462bcccb92b152f3` with stable producer keys/labels and bounded private playback headers. Android adopts the same revision. TV-web unit suite passed (187 tests), and the pinned design/core/video checks, typecheck and production build passed. This shared-contract import does not add physical Tizen/Vizio qualification.

# TV reliability corrections — 2026-09-25

Design pin `8ab5b6e95cdc9c6154efec2ff418a4ee1eecf55e`, contract
[TV-034](design-contract/TV_POLISH.md), design issue #4 / tv-web issue #2.

The SolidTV entry (`solid.html`, including the `lightning.html` compatibility
entry) now selects profiles into Home, restores Settings/sidebar navigation,
shares one collapsed rail with stable expanded icon coordinates, and uses
packaged Lucide assets. Profile badges have a 16px inset. Browse hint legends
are removed. Home action heights/widths match; long episode labels cannot cross
progress. Shelf heading pitch is 356px. Shared pixel carousel bounds expose
selected cards completely and clamp the final card to the right safe edge.
Series retain all seasons and episodes with a focusable season control.
Discover/My List share their card implementation; focus no longer shifts card
artwork or captions. Search includes the first focus ring in its clip.

Home Play/Resume opens sources; explicit hold retains source-choice intent.
Live cards open sources directly, and live playback offers audio, subtitles
and exit with no seek, duration, pause or skip controls. Exit restores the
channel/card. VOD resume/source intent and progress remain intact.

Startup publishes the saved queue before optional metadata finishes, then
publishes each hydration result. Home reuses that hero metadata, avoids the
unused history request, and loads live/catalogue shelves independently with
six catalogue workers. Search uses independent workers and concurrent live
search, preserving a focused item's identity when earlier results arrive.
Metadata and series progress start concurrently. A shared two-buffer text
primitive retains drawable glyphs until replacement textures are ready, with a
stable paint-order parent and atomic opacity changes.

Validation uses the production build at
`https://viptv.local.test:8443/tv/solid.html`, with private browser captures in
`/tmp/viptv-polish`. No screenshots are committed. Run the regressions with:

```sh
PREVIEW_API_ORIGIN=https://viptv.local.test:8443 node tests/preview/solid-regressions.mjs
PREVIEW_API_ORIGIN=https://viptv.local.test:8443 node tests/preview/solid-regressions.mjs --tizen
```

Verified before final publication: design/core/video integrity and production
build; 187 frontend unit/integration tests; backend 206 passing tests (two
existing ignores) and strict Clippy. The broad React Playwright run recorded
127 passes, 75 declared skips and two timing-sensitive Vizio player failures;
both failing cases passed when rerun together in isolation (5.5s). This is not
reported as an entirely clean first full run. Existing VOD/source/resume,
series/title, search, Home and profile-management SolidTV scenarios also passed.

Final delayed-data browser runs accepted remote input at 181ms (Vizio) and
178ms (Tizen) with queue/catalogue replies delayed 1.8s; these are fixture shell
readiness measurements, not real-device startup claims. Saved queue cards are
separately checked before delayed metadata. Both platform clock checks observed 90 animation-frame opportunities, nine
clock advances and zero frames without a drawable clock node; GPU scan-out
remains outside this test. All nine regression scenarios pass in both browser
configurations. The extended Home run traverses 20 cards and asserts the actual
final focus outline ends at x=1828; the ten-episode run checks the same boundary.
Search asserts its first outline begins at x=846 and retains the fast result
when a delayed result is inserted ahead of it.

Desktop comparison: the desktop shell pins tv-web `6f335d7631e1334be398b7aa5977ce4ce51ac50a`; its React Home already publishes catalogue shelves independently and caches Home for return navigation. Its shared queue client still awaits metadata. TV now uses the same independent-shelf approach and additionally publishes the raw queue before that shared hydration work finishes.

The reported temporary tunnel now returns HTTP 530, so the original Naruto
endpoint's cold upstream latency cannot be remeasured. Backend changes coalesce
identical in-flight addon requests, preserve unrelated cache entries during
eviction, and stop waiting for alternate metadata once episode art is complete.
They cannot guarantee the response time of an external addon on a cache miss.

Physical Tizen/Vizio hardware, TV decoder output, signing, deployment and
production served-asset verification were not performed in this change. The
ordinary React/desktop entry remains available; this work does not silently
promote the staged SolidTV entry into a physical-TV-qualified release.

---

# TV visual refinement — 2026-09-24

Design pin `8b7f85941addf5a65390fe6eca4f11aba9584a17`. This 2026-09-24
checkpoint measured `fa8b20e0e63d465498b6b2af8571a4e9cdc1015f`, which records
stable-size TV focus. The React TV entry now keeps focus in the current horizontal shelf, reveals the full trailing card, adds space between Home shelves, removes the Home key legend and focused scaling, and uses landscape detail art and a stable runtime label in the player. SolidTV preview now uses cached canvas icons for the affected Home, title, profile and player actions, shows an animated preparation spinner, avoids tile/profile scaling, reveals later queue cards, and omits empty movie episode chrome.

Evidence: design validation passed; `npm run build`, `npm test` (172 tests), TypeScript, five React preview captures (`TvHome`, `TvTitle`, `TvProfiles`, `TvPlayer`, `TvPlayerNext`), and SolidTV captures (`TvHome`, `TvProfiles`, `TvProfilesManage`, `TvTitle`, `TvPlayer`) passed in desktop Chromium at 1920×1080. The targeted Tizen browser test for trailing-card visibility, shelf-bound Right and hiding the hero artwork after moving down passed. A broader Tizen E2E run had seven passes, twelve declared skips and one search timing failure; that exact search case passed alone. Browser captures are visual evidence, not physical TV or real-media qualification.

SolidTV follow-through: Home now reveals all loaded live/catalog/My List shelves after the first queue frame, preserves each shelf's horizontal cursor, and keeps the featured artwork out of the scrolled view. Browser fixture navigation reached the final queue card, stayed there on Right, moved to the next shelf on Down, restored the saved card on Up, and returned from a lower-shelf detail page to the originating card. Profile edit uses the existing design-matched React editor as a lazy modal above the SolidTV canvas; the SolidTV remote is suspended only while that modal owns focus. Browser fixtures exercised create, rename, avatar selection, save, delete and return focus, plus profile paging to page two. Explicit series Next prepared the next episode on Tizen and Vizio browser stubs; Back cancelled a hanging Vizio replacement without stopping the outgoing session. These are browser simulations, not real media or device qualification. The staged SolidTV renderer still needs physical TV qualification before replacing the React entry.

Final validation batch: all 30 original SolidTV preview scenarios passed, along with the five editor states, twelve-profile paging, explicit Next on Tizen/Vizio, and cancellation of a hanging Vizio Next. `npm test` passed 172 tests; `npm run build` passed the design/core/video integrity checks, TypeScript and production bundling. The full Playwright run passed 129 tests with 75 declared skips. Its first run found an assertion expecting the old `2:00` duration label; the assertion now checks the intended `2 min` runtime, passed alone, and the full rerun passed. A six-trial local HTTPS Chromium performance comparison at 4× CPU recorded SolidTV median Home readiness 537.3 ms versus React 557.6 ms and main-thread work per key 5.307 ms versus 12.372 ms; all eight comparative checks passed. Browser and benchmark evidence does not certify physical Tizen/Vizio decoding or signing.

The design-wide generated-theme check reports Android and Roku as stale because those apps remain on older design pins; their generated files were left at those revisions. The tv-web design snapshot and its generated theme pass the app build checks.

---

# SolidTV performance optimization — 2026-09-24

See [PERFORMANCE.md](PERFORMANCE.md) for the reproducible React comparison,
raw-metric definitions, hardware identity and limits. At 4× CPU, six trials
per renderer measured 11% faster Home readiness and 59% less main-thread
work/key for SolidTV; all comparative speed/frame checks passed at 1× and 4×.
The 8× stress check failed first guide entry (250.5ms versus 237.2ms) while
passing the other seven checks. Post-guide JS heap is 1.113MiB higher for
SolidTV. These are hardware-enabled desktop Chromium measurements, not TV
hardware qualification or complete product-parity evidence.

172 unit/integration tests (including two new deferred-render/paint-order
regressions), all 30 TV fixture scenarios, and the production build with
integrity/type checks passed. Six changed-renderer screen captures were
pixel-identical to the pre-optimization SolidTV build. Hold timing, pinned
design, coordinates and drawing inputs were preserved. Guide entry/reveal
latency was reduced without changing the remote actions.

The full Playwright suite with four workers had 126 passes, 75 declared skips
and one React-entry Vizio managed-seek assertion failure (fixture position
0s versus 10s). The exact test passed on a single-worker rerun; no assertion
or playback logic was weakened. The aggregate run remains a recorded flake.

---

# SolidTV migration — 2026-09-24

The isolated canvas entry now uses `@solidtv/solid` 1.6.4 and
`@solidtv/renderer` 1.9.4. `solid.html` is its canonical URL;
`lightning.html` is a compatibility URL for the same SolidTV bundle. All
Blits screen templates were converted programmatically to Solid JSX, retaining
layout coordinates, assets, text, design tokens and controller methods. Solid
signals and keyed lists preserve reactive state and focus lifetimes. The
adapter retains key-release activation and the existing 700ms hold handlers.
The React `index.html` entry and platform launch selection are unchanged.

Design remains pinned to `aa2a1d69935fc07a97bd37d5fa0f78ab8d1c7b47`.
No design snapshot, generated theme, shared core or video source was edited.
This is a renderer migration, not a claim that previously incomplete screens
now meet every design acceptance criterion. Earlier Blits limitations below
remain applicable unless explicitly covered by the evidence here.

Validation:

- `npm test`: 170 passed across 28 files.
- `npm run build`: design/core/video integrity, all typecheck groups and
  production bundling passed.
- `npm run test:e2e`: 126 passed, 75 deliberately skipped, one toast-flow
  timeout in the React entry. The exact failing test passed on a focused rerun
  and against the pre-migration production bundle; no product/test assertion
  was weakened to make it pass. This run does not establish an entirely
  flake-free suite.
- SolidTV: all 30 named fixture scenarios in `solid-shoot.mjs` passed on
  Chromium at 1920×1080, using trusted local HTTPS and intercepted API/media
  boundaries. They cover pairing/loading/expiry/retry; profiles and manage
  focus; Home and rail; Discover/filter/paging; My List and title menu/Undo;
  search; live guide, future programme details and live search; settings,
  playback choices, addon management/removal cancellation and sign-out
  cancellation; title/episodes; source paging/filter/provider/details; and
  player/seek/subtitle/audio changes. Back/return focus and 700ms holds are
  exercised by the existing scenario assertions.
- Home, Live and PlayerSubs additionally passed with Vizio and webOS browser
  platform flags (six more scenario runs). These are platform simulations.
- Before/after: all 30 scenarios also passed against baseline commit
  `2ab0c80ca639d485d31a22d1193bb308f9e26f2d`. 43 corresponding captures were
  compared; normalized mean absolute RGB error had median 0.000807 and maximum
  0.003801. Measurements are in `tests/solid-tv-visual-metrics.json`. Pairing,
  Home, profiles, episode focus/return and filtered sources were inspected.
  Screen geometry and visual language are retained; text rasterization and
  some stale-label behavior differ between renderers, so captures are not
  byte-identical. These numbers measure migration drift, not conformance to
  every canonical design screen.

The screenshot harness waits 100ms after focus changes before capture so
synchronous focus debug state cannot race the WebGL frame and glyph upload.
All captures remain private temporary output, outside source and release assets.
Reproduce a scenario with the workspace's trusted local HTTPS certificate and
built `/tv/solid.html` entry:

```sh
PREVIEW_API_ORIGIN=https://viptv.local.test:8445 \
SOLID_PREVIEW_URL=https://viptv.local.test:8445/tv/solid.html \
PREVIEW_OUT=/tmp/viptv-solid-check \
node tests/preview/solid-shoot.mjs TvHome
```

The test session used a local static HTTPS server on 8445, serving `dist`;
8445 is not an automatically started project service. The standard local HTTPS
stack can serve the same built entry on 8443. No production deploy, signed
package, physical Tizen/Vizio/webOS run or new real-media qualification was
performed for this migration.

---

# Lightning TV Settings and performance checkpoint — 2026-09-24

The staged Blits rail now opens Settings. Browser fixtures reached the six root
rows, the profile tiles, Playback preferences, an API-backed choice/save, the
account addon list, addon Enable/Disable action, nested Remove confirmation,
and the sign-out confirmation. Back restores the parent row and then Home;
cancelling removal or sign-out leaves those resources intact. Settings and
Playback-choice captures were byte-equal in Tizen, Vizio and webOS browser
modes. Addon install text entry, confirmed removal, profile editing, and
parent-PIN sign-out remain unverified or incomplete in Blits; no TV launcher
was switched.

Matched 1920×1080 React-to-Blits comparisons remain open: `TvSettings`
172,804 changed pixels (8.3335%, SSIM 0.894380), `TvPlayback` 197,552
(9.5270%, SSIM 0.834234), `TvPlaybackChoice` 1,148,625 (55.3928%, SSIM
0.878242), `TvAddons` 177,432 (8.5567%, SSIM 0.852570), and `TvSignOut`
1,100,764 (53.0847%, SSIM 0.900069). `TvAddonManage` changed 1,030,417
(49.6922%, SSIM 0.891538) and `TvAddonRemove` 1,029,282 (49.6374%, SSIM
0.901659). These use the matching React PNG via
`--reference`; the comparator's default is the pinned design WebP, which is a
different comparison.

The production-bundle Chromium timing script is
`node tests/preview/perf-compare.mjs` against a local Vite preview mounted at
`/tv/` (`npx vite preview --base /tv/ --host 127.0.0.1 --port 4182`). On the
final bundle, five unthrottled runs with the same mocked Home data reached
first interactive focus at 201 ms median for React and 388 ms for Blits.
Five runs at 4× CPU throttle measured 663 ms and 1,238 ms. The
input-to-focus markers were React DOM `focusin` (0.5 ms median unthrottled)
and Blits lifecycle focus (21.8 ms), so they do not prove equal visual paint
stages; the harness explicitly focuses React's first action while Blits
focuses it automatically. Blits had 25 of 627 sampled frame intervals over 33 ms unthrottled;
React had 0 of 39, over shorter interactions. These results do **not** establish
a performance win. Chromium used a SwiftShader software GPU; these are browser
proxies, not physical-TV measurements. A separate steady-state diagnostic after
a three-second settle found only 1 of 162 slow frames unthrottled, but about
20 of 158 at 4× CPU throttle. Hidden route trees in the root Blits template
remain a likely startup cost and a candidate for further restructuring.
Playback is now loaded only when a source is chosen, and Home no longer waits
for unrelated catalog/live fallback requests when Continue Watching supplies
the hero. Reducing the Home reveal delay to one frame preserved the prior
Blits `TvHome` capture exactly (0 changed pixels); the browser player fixture
still reached playback. TV performance remains an open acceptance gate.

The artwork audit confirmed remote card and hero images already use the shared
wsrv policy. The remaining raw Home/title logos now request wsrv derivatives
at their rendered dimensions (410×118 and 310×90), and five visible title
episode stills request 360×200 rather than 544×300 derivatives. Home and title
fixture screenshots remained unchanged at the pixel level; actual network
latency and physical-TV decode cost have not been measured.

# Lightning TV Search — 2026-09-24

Search now keeps all result identities in a non-reactive navigation index but
mounts only cards intersecting its 1920×1080 viewport. A 120-result model
check showed nine mounted views and wsrv artwork URLs only for those nine;
offscreen cards retain their original positions for D-pad paging. Once an API
batch has arrived, a D-pad window move now projects at most those nine cards
instead of rebuilding every result's presentation. The existing
browser scenario still moved through offscreen results, held a result menu,
restored focus and returned to Home. Its `TvSearch` frame was pixel-identical
to the prior Blits capture. This reduces component and image work during
Search; input latency and physical-TV frame rate have not been remeasured.

The staged Blits rail now opens Search. Its 39-key TV keyboard owns D-pad
focus, accepts physical keyboard letters, and searches normalized catalogs and
Live TV after 650 ms. Browser fixtures exercised a replaced query without a
stale request, 14 grouped Naruto results, result/keyboard focus movement,
title/Back restoration, Delete/Clear, no results, and partial catalog failure
that retained the live result. Populated and blank captures were byte-identical
across Tizen, Vizio and webOS browser configurations. At 1920 × 1080 against
matched React captures, populated `TvSearch` changed 407,982 pixels (19.6751%,
SSIM 0.942227); blank Search changed 79,744 pixels (3.8457%, SSIM 0.827156).
Both remain open visual deviations. Reproduce the blank React frame with
`node tests/preview/react-search-blank.mjs`; no-result and partial-failure
states have browser captures but no matched React pixel measurement.
`npm run build`, 169 unit tests and the targeted responsive/TV browser suite
(24 passed, 10 skipped) pass. Phone `Main` and desktop `DeskHome` are exactly
equal to their pre-migration captures (0 changed pixels). No physical Blits TV
run or TV launcher switch was performed.

# Lightning TV held-card menu — 2026-09-24

The staged Blits action menu now opens from Home, Search, Discover and My List tiles
on a 700 ms OK hold; ContextMenu also opens it. Back restores the tile, and a
held release does not also activate it. Tizen, Vizio and webOS browser-mode
captures of `TvItemMenu` were byte-identical. At 1920 × 1080 against the React
TV capture it changed 1,223,606 pixels (59.0088%, MAE 4.7415, RMSE 21.5925,
SSIM 0.886041). This remains an open visual deviation. Browser fixtures
exercised Choose source, previous-episode Resume at its saved position, restart
at zero, hide/Undo requests, My List toggle and watched correction through the
shared API. The fixture records hide/Undo calls but does not mutate its queue,
so a real backend and physical-TV confirmation remain pending. The Undo view
has not been compared pixel-for-pixel.

# Lightning TV My List — 2026-09-24

The staged Blits menu now opens My List. Browser fixtures cover saved titles,
Continue Watching, focus restoration through title detail and a direct Resume
source/player path, and refetch after a saved-title toggle. Queue and saved-grid
captures were byte-identical across Tizen,
Vizio and webOS browser modes. At 1920 × 1080, `TvLibrary` queue changed
614,925 pixels against React (29.6549%, SSIM 0.953726). A matched saved-grid
capture with six fixture favorites changed 463,694 pixels (22.3618%, SSIM
0.951455). Reproduce the two states with `node tests/preview/lightning-shoot.mjs TvLibrary`
and `node tests/preview/react-library-saved.mjs`, then run the pixel comparator.
Both are open deviations. Source/media behavior used browser stubs;
physical TV navigation, decoding, hide/Undo, watched correction and previous
episode actions remain unverified on hardware. Phone `Main` and
desktop `DeskHome` remained exactly equal to their pre-migration captures
(0 changed pixels at 390×844 and 1440×900). `npm run build`, 169 unit
tests and the targeted responsive/TV browser suite (24 passed, 10 skipped)
passed. The packaged TV launchers remain on React.

# Lightning TV Discover — 2026-09-24

The staged Blits menu now opens Discover. Its grid uses shared API catalogs,
Rust-normalized cards and Blits D-pad focus; a card opens title detail and Back
restores the same card. Browser fixtures exercised Genre choice, catalog/type
switching, three-row focus window movement and return to Home. Tizen, Vizio and
webOS browser captures were byte-identical for `TvDiscover` and
`TvDiscoverFilter`. At 1920 × 1080 against matched React TV captures,
`TvDiscover` changed 725,162 pixels (34.9712%, SSIM 0.952812), and
`TvDiscoverFilter` changed 1,178,903 pixels (56.8530%, SSIM 0.940365).
These are open visual deviations. Text-only required filters, horizontal chip
overflow and longer filter lists still need implementation. No physical Blits
TV run or launcher switch was performed. Build and 169 unit tests pass; the
targeted responsive/TV Playwright suite passed 24 with 10 platform skips on
the isolated rerun. Its prior concurrent run lost one browser execution
context while a build was running.

# Lightning TV menu — 2026-09-24

The staged Lightning TV entry now has a focus-owning expanded rail. Browser
captures for Tizen, Vizio and webOS matched byte-for-byte; the `TvMenu` capture
still differs from the React TV reference by 1,625,803 pixels (78.4049%,
SSIM 0.930841). The full-frame result includes the previously measured Home
background deviation. Browser D-pad checks covered menu entry, Discover focus,
Right/Back restoration and the profile route. This was the menu-only
checkpoint; Search, Live TV and Settings were added in later staged commits.
`npm run build`, 169 unit tests
and the targeted responsive/TV Playwright suite (24 passed, 10 skipped) pass.
The public TV launcher remains on React; this is staged browser evidence only.

# Physical Vizio cast recovery — 2026-09-24

The desktop SmartCast command launched Conjure (app 17, namespace 4), but the
public watch entry returned nginx HTTP 403 because its static bundle
directory was empty. A root-path build of tv-web commit `feeffe9` was
restored to the watch host. Its running container had retained an old empty
bind mount, so restarting that container was also necessary. The public
entry and JavaScript asset then returned HTTP 200 with the correct MIME
types. After another launch, the TV loaded assets and completed device
approval, profile and catalog requests. The user confirmed it works.

This is physical-TV evidence for launch, sign-in and entry to the viewing UI
on a 65-inch Vizio SmartCast set (firmware 2.600.596.0-10, Chrome 87 user
agent). It does not qualify every screen, remote action or media decoder.
The cast dialog's launch response proves only that the TV accepted the
command; receiver loading was verified separately through public HTTP and
the TV's subsequent requests.

# VIPTV design-system overhaul — 2026-09-23

Design revision `5740c91d6e9cb7616626bdbb0f635cb62f6ec0c2` was imported
for this pass. The phone browser, desktop web/Tauri shell preview and TV canvas
use the new tokens, primitives and screen-family styles. The old TV and
responsive CSS files were removed. The account website's designed WebLinkTv
screen is owned and validated separately in `web`.

The preview harness reached 151 of 155 reference screens and generated a
reference/app comparison for each. The remaining four are the three composite
States boards (their individual states are reachable) and WebLinkTv (in the
account website). A pixel-difference sweep covered all 151 pairs; Home,
Profiles, title/sources, Discover, Search, My List, Settings, casting, local
mode, player and TV focus states were inspected at native reference sizes.
The largest remaining differences are fixture content/counts and intentional
behavior: TV Search omits the reference's microphone because voice input is
not available, TV Sources retains the provider control, and the accent-colour
row has no reference screen. The mobile web header/nav insets were tightened
after review, so these layouts deliberately sit closer to the viewport edges
than the original phone sheets. See the current parity matrix for scoped
evidence and hardware limits.

Validation: `python3 ../design/scripts/validate.py` reports 516 design tokens;
`node ../design/viptv-design-system/tools/gen-themes.mjs --check` passes;
`npx vitest run` passes 169 tests; `npm run build` passes design, core,
video and TypeScript checks. `npx playwright test --reporter=dot` passes
127 browser scenarios with 75 deliberate platform skips across Tizen,
Vizio and responsive configurations. Local HTTPS serves the rebuilt viewing
bundle with a verified JavaScript asset. No physical Samsung/Vizio or
installed Tauri run was performed, and no production deployment was
attempted.

# Loading, player and polish pass — 2026-09-23

- Home loading: Home renders once its hero catalog and recent channels
  arrive; every other catalog shelf renders at once as a skeleton with its
  real title and loads its catalog as it nears the viewport (TV: all shelves
  in the background), at most four catalog requests in flight. Catalogs that
  cannot list without input (search-only) are skipped, required extras send
  their defaults, and loaded shelves survive Home reloads. Measured against
  a mock of 80 catalogs at 150 ms each: Home visible in ~0.4 s with 2–4
  catalog requests, instead of waiting for all 80. The local Caddy log showed
  real phone boots of 6–18 s with ~80 serial /api/discover calls.
- Startup: the startup cover is replaced (responsive shell) by HomeSkeleton,
  built from Home's own classes; its hero box matches the loaded hero at 390
  and 1440 px within 0.2 px.
- Nav responsiveness: windowed rows reuse their last measured pitch and size
  their first window from the viewport; returning to a heavy Home dropped
  from ~190–250 ms to ~85–97 ms at 4× CPU throttling.
- Cards (phone): title and minimal context in a fixed 40 px caption under the
  art; live channels are logo-width tiles without names; progress 6 px with
  2 px ends. Touch: no tap highlight, callout or text selection on held
  controls and art.
- Player (web/desktop): one row of same-sized icon controls with fullscreen at
  the end, Back and title across the top, tap toggles controls, double-click
  toggles fullscreen, a buffering ring over the picture; the TV overlay is a
  separate render path and unchanged.
- Detail: clickable genres (origin catalog, then the metadata's Stremio genre
  link, then any same-type catalog offering it), a cast row with photos when
  the metadata carries app_extras.cast, equal 48/56 px action squares.
- Audit fixes across dialogs, sign-in, text entry, profile editor, Settings
  (grouped list at every width), shelves inset, search/discover status,
  sources, Live TV gutter and now line, sidebar contrast.

Evidence (browser only): unit 148/148 (new `tests/ui/home-rows.test.ts`,
`tests/ui/search-popunder.test.tsx`); build green; Playwright on both
projects with no new failures against the previous run; screenshots
inspected privately. Not run on a phone, TV or the Tauri window.


# Poster cards and desktop header search — 2026-09-23

- Card shapes: `src/ui/cardShapes.ts` sets poster or landscape art per
  responsive surface; both shapes stay implemented, so any surface flips
  back with one value. Currently: Discover and Search results are posters;
  Continue Watching, Live TV and My List stay landscape; Home catalog shelves
  cycle poster, poster, landscape on every responsive width. Poster art is the
  Rust-projected `posterImage` role through the shared wsrv pipeline, retried
  at origin once, then falling back to the landscape art. Live channels and
  the TV canvas are always landscape.
- Phone card progress is 6px (was 3px).
- Desktop: the profile avatar anchors the bottom of the sidebar in both the
  browser and Tauri layouts; the Tauri titlebar drops its My List and avatar
  buttons and centres a real search field whose popunder lists per-profile
  recent searches and quick matches (arrow keys, Enter, Escape), handing
  Enter or "See all results" to the Search route. The browser layout no longer
  reserves the Tauri titlebar's empty 30px strip.
- Fixed while verifying: windowed shelves measured their pitch from a card
  wrapper and its own inner card, so every responsive row silently kept the
  280px landscape fallback. Measuring direct children (and re-rendering on a
  new pitch) makes Back restore poster and phone shelf offsets exactly.
  Remounted hero titles now promote an already-decoded logo on first render,
  so the page is no longer briefly 35px short while the phone offset restores.

Evidence (browser only): unit 144/144 including
`tests/ui/search-popunder.test.tsx`; `responsive-layout` Discover grid now
asserts poster tracks (160px minimum, three phone columns). The titlebar only
mounts under Tauri, so its rendering was inspected through a temporary
browser harness, not the desktop app; the native window was not run.


# Phone web UI pass — 2026-09-23

Owner-directed phone (≤599px) corrections to the responsive shell; the
desktop/Tauri responsive layout and the TV canvas are unchanged apart from the
two shared fixes noted below.

- Shell: no header bar on phones (the sidebar box leaves the flow, so short
  routes no longer carry 72px of phantom scroll); icon-only bottom navigation
  with a pill on the active destination; Watch on TV moved to Settings.
- Home: hero art is the first element with all corners rounded; no eyebrow
  when the hero stacks (≤899px); Details and My List share one 48px height;
  shelf headings name the content type (`Series · AniList Trending`) instead
  of the addon; rows start on the heading edge and bleed to the screen edge;
  tighter shelf spacing; no chevron pair on touch.
- Cards (phone): title and minimal context (`S1 E2`, or the year, plus a
  short queue state) printed inside the art above a flat 3px progress bar;
  no text rows, genres or resume times under the art.
- Discover (phone): type / catalog / filter chip rows and a two-column grid.
  Every layout, including the TV, now pages automatically through the
  `AutoLoad` sentinel; there is no Load more control anywhere (local mode
  included).
- My List (phone): segmented My List / Continue Watching switch.
- Live TV (phone): searchable channel list with category chips and now/next
  rows (current programme with progress, next start time) that pages itself;
  the timeline grid remains at ≥600px.
- Settings (phone): centred grouped list with inline notes, trailing values,
  an OLED switch and Watch on TV.
- Shared fixes: the idle hidden `<video>` no longer keeps the TV's 1280px
  width in the responsive shell, and the Search field no longer inherits the
  TV-only 10px baseline nudge.

Evidence (browser simulation only; no phone, tablet or TV hardware was used):
unit 141/141; `npm run build` green with design/core/video checks; Playwright
e2e on both projects compared against a pre-change baseline with no new
failures. Updated specs: `discover-filters` (automatic paging on the TV
layout), `responsive-layout` (phone Live TV list, phone two-column Discover),
`responsive-corrections` (timeline guide measured at 768/1440), `responsive`
(nav icons are SVG, phone OLED switch, in-art logo title separation).
Private phone/desktop captures were inspected locally and are not committed.

Still failing, all of them before this pass as well: the stale `responsive`
flow tests that expect the removed `.responsive-toolbar`, header profile
control and hero More options button; `populated responsive` (expects three
shelf sections); `responsive Back restores populated shelf offsets at 390`;
`browser-navigation` live card; `resilience-settings` focus; flaky
`next-episode` retries.


# Selectable engines and the autoplay test harness — 2026-09-17

The desktop app can now choose its playback engine and be tested without
driving the UI. `createPlayer({ platform: "tauri", engine })` in
`@viptv/video` requests `mpv` or `gstreamer` through the plugin's backend
field; `auto` follows the engine preference order the plugin reports in its
diagnostics (mpv first on Linux when its runtime is compiled — the Linux
shell now compiles both). The choice persists per device
(`viptv:playback:engine`) and is editable in Settings → Playback engine;
`VIPTV_ENGINE=mpv|gstreamer|auto` overrides it for one launch without
rewriting it. The engine actually serving the session is reported in
diagnostics (`PlayerDiagnostics.backend`) and shown as `Decoder: tauri-native
(mpv)` in the playback info sheet.

The autoplay harness runs the real player end to end from stdout:

    npm run test:autoplay          # VIPTV_TEST_AUTOPLAY=1 npm run tauri dev
    VIPTV_ENGINE=mpv npm run test:autoplay

Launch it against the local HTTPS backend (see the root README), sign in
once, and watch the terminal: the app autoplays the first movie on Home and
every player change prints one line

    [test] engine=tauri-native (mpv) state=playing position=12.3s error=none

State changes and errors print immediately, position beats at most every 2 s,
and a failing source shows `error=…` — the same failure the session
controller would act on. The shell owns the `[test]` prefix (`test_log`
command in `src-tauri/src/lib.rs`), so the lines stay greppable no matter
what the webview logs. Unit tests cover the env parsing (`src-tauri`), the
engine preference storage, and the harness probes, line format and pacing
(`tests/ui/engine-preference.test.ts`, `tests/testing/autoplay-harness.test.ts`).


# Direct-URL desktop delivery — 2026-09-17

The desktop host now plays the ORIGINAL absolute source URL natively and never accepts managed delivery. `PlaybackCapabilities.directUrls` (set by the Tauri profile) rides the same generic snake_case wire path as `directFiles` through the vendored core; the response normalizer accepts an absolute credential-free http(s) URL as that original source URL and maps the session's source `authorization` {cookie, user_agent} into the view, following the omitted-absent convention of the other view types. The session controller in @viptv/video does not escalate direct-URL clients up the delivery ladder — a delivery refusal, an unsupported-format open failure, or a late decoder failure surfaces instead of falling back to transcode — and the session's authorization flows into the open request, which the Tauri adapter already forwards as native_open cookies/userAgent.

- tauri-video-plugin: both seek arms (`desktop.rs`, `desktop/windows.rs`) wait bounded (3s) for the pending pipeline state change before seek_simple, so a resume seek right after open can no longer stall a transitioning playbin3. cargo fmt clean; cargo test 4/4.
- core: fmt/clippy clean; cargo test 40/40; typegen + build-wasm + test-wasm green. The wasm suite pins directUrls through the request wire, the credential-free URL boundary, and the authorization mapping.
- video: typecheck + 87 tests + dist-js build green, with four new direct-URL no-escalation/authorization cases and the Tauri profile declaring directUrls.
- tv-web: vendored core at aebc7bf (CORE_REF + generated TypeScript + wasm); typecheck + 87 tests + production build green. The client suite now rejects only credential-bearing playback URLs and accepts an original absolute source URL with its authorization mapped — the wire-level regen evidence. Browsers never declare directUrls, so web/TV behavior is unchanged; native playback of a real source through the new path awaits the server-side direct-url rung and a desktop smoke.


# Per-platform delivery profiles — 2026-09-17

Stage 5 of the shared-platform-desktop plan. Each platform entry point now resolves its delivery profile from one canonical declaration in `@viptv/video` `src/platform-profiles.ts`: `TIZEN_DELIVERY_CAPABILITIES` (native H.264/HEVC-Main-SDR envelope to 1080p), `VIZIO_DELIVERY_CAPABILITIES` (H.264/AAC baseline only — HEVC unclaimed, original-container rung off, managed ladder for the rest), the direct-play-only Tauri profile, and `webDeliveryCapabilities` (the measured browser probe behind the managed-HLS gate, memoized). `App.tsx` dispatches through `deliveryCapabilitiesFor(platform)`; the inline Tizen literal and the Vizio probe fallthrough are gone, so no TV engine consults a browser decoder probe.

- video: 9 test files / 83 tests passed (one worker, 256 MB Node heap), including the 6 new `tests/platform-profiles.test.ts` cases — declared profiles resolve without any probe, per-platform engine construction, server-ladder envelope values, web probe memoization, managed-HLS rejection, and the Vizio path driving `VizioHtml5Adapter` through a real open with zero `MediabunnyAdapter` constructions. Typecheck and dist-js build passed.
- tv-web: typecheck, 14 unit test files / 86 tests, and `npm run build` passed; the local HTTPS stack served the fresh bundle (asset hash matched `dist/`).
- Live receiver smoke (read-only; stack never restarted): `https://viptv.local.test:8443/tv/?platform=vizio` boots the receiver bundle and reaches the device-pairing screen with a code and QR (screenshot kept local). Pairing approval was blocked by owner credentials, not by code: the dashboard sign-in form enforces a 12-character minimum, and the only account password available in the private env was rejected by `/api/auth/login` (403), so no owner session could approve the device and a real source was not played this run.
- Real decode through the production Vizio engine: the `vizio` Playwright project passed all 3 media-decode cases — real Chromium WebM decode (pause/seek/end/cleanup) and real H.264/AAC same-origin HLS through both runtime-native HLS and forced hls.js/MSE. With the dispatch test, this is the "Vizio receiver loads the HTML/HLS engine, never mediabunny/WebCodecs" evidence at both dispatch and decode level.
- Backend delivery-matrix review: `direct_files`/`direct_video_codecs`/`direct_audio_codecs` gate the original-container rung (Tizen/Vizio leave it off), the native envelope is H.264 copy plus `hevc && hevc_sdr` Main/SDR with `direct_hls`/`direct_mp4` defaults, and `VIPTV_DIRECT_PLAY` remains an env override. The profiles map onto the server rungs as intended; no backend change was needed.


# Tauri desktop shell — 2026-09-17

Stage 3 of the shared-platform-desktop plan. `src-tauri` is the Tauri v2 shell registering `tauri-plugin-video`, `tauri-plugin-http` (native TLS roots + `unsafe-headers`) and `tauri-plugin-opener`; `src/player/tauri-native.ts` implements the shared Player contract over the plugin's raw `plugin:video|native_*` IPC and `TAURI_NATIVE_DELIVERY_CAPABILITIES` declares the no-transcode direct profile. Web builds are unchanged: `createPlayer` only constructs the native adapter inside the Tauri runtime and `main.tsx` selects the `tauri` platform only under `__TAURI_INTERNALS__`.

- 162 unit tests across 21 files passed (one worker, 256 MB Node heap), including the 17 new `tests/player/tauri-native.test.ts` cases for open/play/pause/seek/tracks/volume, wire-error mapping, stats polling and ended state, live refusal of VOD seeking, supersession cleanup, layout forwarding, aperture DOM handling, the Tauri gate, and the delivery profile. Typecheck and `npm run build` (design/core checks + vite build) passed. `cargo build` in `src-tauri` passed against GStreamer 1.28 / WebKitGTK 4.1 with the org-layout path dependency.
- `tauri dev` smoke against the running local stack (read-only; `https://viptv.local.test:8443`, never restarted): the shell boots the shared responsive UI and the pairing round-trip works through `tauri-plugin-http` after two desktop-only transport facts were fixed — `rustls-tls-native-roots` (the plugin's default bundled webpki roots reject the locally-trusted VIPTV Local Dev CA) and an explicit first-party `Origin` (the plugin otherwise pins the webview origin, e.g. `http://localhost:5173`, which the backend's single-origin pin rejects with 403). Caddy's access log shows the pairing code request succeeding and device-token polls returning the documented pending status; screenshots (local only) show the sign-in screen in its normal state.
- Not exercised: native playback of a real source (pairing approval requires owner credentials this run does not have), the Windows WebView2 texture-stream path (implemented per the plugin's documented flow, untested), and macOS (rejected honestly as `engine-unavailable`). The Linux aperture is the minimal honest version: it makes the DOM stack above the anchor transparent but does not reconstruct backgrounds around the video rectangle the way the plugin's own compositor does; the native black floor shows while a session is live.


# Shared application-core integration — 2026-09-13

Core pin: dd192cd09e3aac6810ec3cdd862119fb0646c82d. Design pin: e821c297de2e81b47a6a1b22ed8aa0522cdd04e5. The actual app now drives restoration, refresh, profile acceptance and sign-out through Crux; Rust also owns normalized responses, artwork roles and source/continuation/progress/request decisions. React keeps rendering/focus and platform effect execution.

Final validation: 65 unit tests across 10 files passed with the actual WASM artifact. The complete one-worker Chromium suite passed 55 cases with 35 intentional platform exclusions (90 collected), without retries. Native HLS and forced MSE decoding, pause/seek/resume, parent-PIN/profile flows, remembered-profile reload, Home/remote hold/Next and profile geometry checks passed. Build/typecheck, core/design integrity and candidate packaging passed.

The failed first browser pass exposed an unbounded profile-confirmation loop when identity omitted the accepted profile. Core now returns a recoverable error and preserves the grant instead of repeating mutations; native/WASM regressions cover it. Seven fixture backends were corrected to return their accepted profile, matching the real backend contract. Shared hero action labels now match the Roku contract; portrait posters never fill heroImage. Episode thumbnail rendering consumes the separate episode artwork role.

No production backend or household account/history was modified. Physical Android/Tizen/Vizio, owner-provider streams and installed Tauri were not newly qualified by this browser run. Earlier measured checkpoints below remain historical evidence for their named revisions.

# Shared Roku presentation rebuild — 2026-09-13

This checkpoint supersedes older presentation evidence below. Design pin: `3ab29a63cbe6369341ee4376f69a59d4cbb38fc8`. The final implementation commit and hosted CI run are recorded in execution issue [#2](https://github.com/viptv-org/tv-web/issues/2).

The shared renderer was rebuilt across all existing screens. Tizen and Vizio use the same components, styles, packaged artwork and controller behavior. Player adapters remain AVPlay and HTML media with direct/copy/remux before transcoding. Roku and production services/data were not deployed or changed by this work.

## Completed evidence

- 43 unit tests passed, including device transport, guide paging, text retry, 700 ms hold/release suppression, player adapters/controller, server guide timezone labels, episode thumbnails and series-history transport.
- TypeScript and production build passed. Fresh unsigned Tizen launcher and Vizio static candidate paths were generated; earlier artifacts were retained.
- Full Playwright batch: 49 passed, 33 intentional skips, 82 collected, one worker, no retries. Both platform configurations passed UI routes plus 1280×720 and 1920×1080 proportional layout/focus checks and real controller episode-history merge/row navigation. The history endpoint is mocked at HTTP, not bypassed inside the app.
- Shared functional coverage includes pairing, profile CRUD/PIN, source choice/exact Resume, subtitle/quality preferences, addons, queue corrections/Undo, bounded Next/cancel, pause/seek/debounce/track-dialog Back and stop cleanup. Chromium decoded the recorded WebM fixture through the Vizio adapter. AVPlay was simulated; this is not native Samsung decoding evidence.
- Design validates 697 canonical asset files. Imported snapshot integrity and authoritative-local-checkout freshness pass. Build checks verify the snapshot and packaged asset hashes; they do not independently assess visual parity or whether an unfetched checkout matches GitHub.

## Visual evidence

Private captures only; none are committed or embedded. Frozen Roku reference: `viptv-org/roku@a047d9ca5fc80898013eefb66120d20fab5048c0` / installed 1.9.9. Each image was normalized to 1280×720 using bilinear sampling, then compared with ssim.js whole-frame default SSIM, without masks or alignment changes.

| Matched screen/state | Whole-frame SSIM | Inspected differences |
| --- | --- | --- |
| Settings, Switch profile focused | 0.955989 (95.6%) | Browser font rasterization and different selected profile avatar; rail spacing, centered actions and description geometry match source. |
| Search, blank query, first key focused | 0.923059 (92.3%) | Browser fonts/avatar, platform-specific input help and vector/native keyboard symbol rendering. |

Also inspected browser fixture captures of Home, sources, Guide, profiles and episode progress. Their fixture content differs from the physical Roku references, so no matched-content score is claimed. The guide fixture deliberately spans a very long programme duration; its remaining-minute label is fixture data, not a real broadcast schedule. Geometry/functional assertions are not substitutes for matched screenshots across every screen/state. No universal 90% or 100% qualification claim is made.

## Remaining qualification and adaptations

Physical Tizen and Vizio model/OS/remote/decoder tests, Samsung signing, hosted AVPlay bridge availability, HDR/DRM/codec coverage and every detailed failure/return state remain unverified. No emulators or local Android builds were started. This commit prepares candidates; it does not install or deploy them.

The existing source Quality control is retained in the canonical help region, as recorded in the pinned design adaptation. Global Search uses the Roku blank composition; catalog-specific searches remain in Discover. Any further departure must be documented in design before implementation. [The parity matrix](tests/PARITY_MATRIX.md) records screen IDs and remaining evidence rather than treating passing suites as complete TV certification.

## Earlier checkpoints (historical)

# TV validation checklist

This checklist is intentionally evidence-based. A Playwright pass is browser simulation, not proof of AVPlay or Vizio playback. Screenshots are for local inspection only and are not committed.

## Current evidence

| Area | Evidence | Status |
| --- | --- | --- |
| Typed API boundary | `tests/api/client.test.ts` passed with 17 tests on 2026-09-12 | Current for the typed HTTP boundary; backend integration still required |
| TypeScript | `NODE_OPTIONS=--max-old-space-size=256 npx tsc --noEmit` passed on 2026-09-12 | Current source type check |
| Browser UI | Pairing, browse, source selection, guide, search, settings, profiles, held actions, resume mismatch, stale responses and Discover request contracts | 2026-09-12 local candidate: full two-project suite passed 41 tests with 29 intentional Tizen hardware exclusions, one worker and a 256 MB Node heap. It includes eight Next/Resume/recovery scenarios, three pairing lifecycle scenarios per project, direct/managed remote controls, and chrome timeout/modal Back behavior. |
| Vizio browser media | `tests/e2e/media-decode.spec.ts` records a local canvas WebM and drives the real HTML adapter through pause, seek, end and cleanup | Passed in the Vizio browser project; it does not establish playback on a physical Vizio model |
| Backend `/tv` static routes | Rust route test added with the backend change | Not run here; Runtime tests deferred by owner |
| Tizen AVPlay | Adapter and hosted-launcher path implemented | Physical TV/emulator evidence pending |
| Vizio | HTML adapter and same-origin hosting bundle implemented | Physical TV evidence pending |

Hosted run [34717122751](https://github.com/viptv-org/tv-web/actions/runs/34717122751) passed on `0775e4d`, including build and TV packaging. All 40 unit tests across API, remote input, Guide, text entry and player adapters/controllers passed, along with TypeScript and the 40-test browser suite without retries. The initial-focus/OK race was reproduced and corrected before this run; direct/managed player controls also passed five consecutive focused runs (15/15).

The local candidate above also passed `npm test` (40 tests), `npx tsc --noEmit`, and the one-worker browser suite before publication. These browser tests run the Vizio HTML-media boundary in Chromium. Tizen cases that require AVPlay or a physical remote stay explicitly skipped; neither result proves physical device decoding or remote behavior.

No entry above establishes 100% device coverage. Remaining scenario gaps are tracked in [tests/PARITY_MATRIX.md](tests/PARITY_MATRIX.md).

## Low-memory order

Run one command at a time after confirming the server is stable. Keep browser workers at one and do not run a production build alongside Rust tests or Playwright.

```sh
# API boundary only
NODE_OPTIONS=--max-old-space-size=256 npm run test -- --run tests/api/client.test.ts

# Static type check only
NODE_OPTIONS=--max-old-space-size=256 npx tsc --noEmit

# One browser project at a time; this starts a single Vite server and one worker
NODE_OPTIONS=--max-old-space-size=256 npx playwright test --project=tizen --workers=1
NODE_OPTIONS=--max-old-space-size=256 npx playwright test --project=vizio --workers=1
```

Run the backend route tests separately in the backend checkout with the configured Rust environment:

```sh
cd ../backend/server
CARGO_BUILD_JOBS=1 cargo test --locked --test dashboard_routes tv_bundle_has_its_own_same_origin_mount_without_replacing_dashboard_or_api -- --nocapture
```

Only then run a production build or package candidate, one at a time:

```sh
NODE_OPTIONS=--max-old-space-size=256 npm run build
npm run package:tv
```

## Shared UX acceptance

Run each item on both `?platform=tizen` and `?platform=vizio` in the hosted `/tv/` application.

- Pair a fresh device. Confirm the QR/code screen expires, Retry replaces it, approval reaches profile selection, and Sign out clears the local device session.
- Select, add, edit, page, manage and delete a profile. Confirm the parent-PIN prompt appears only when the backend requires it and a cancelled PIN returns focus to the prior action.
- Navigate Home, Discover, My List, Search, Live TV and Settings using directional keys. Confirm focus is visible, restored after overlays, and Back follows the prior screen rather than losing selection.
- Verify every card’s primary action opens details, and its 700 ms hold opens management. Check Resume, Choose source, watched/unwatched, queue hide and undo against the selected profile.
- Search with the remote keyboard; change the text before a delayed response returns and confirm stale results do not replace the latest result.
- Open a series, choose an episode and select an explicit source. Verify source picking never silently substitutes another ordinary source.
- Resume an ordinary VOD item only when the server-provided source identity matches. If it no longer matches, present source choice instead of guessing.
- Check the guide’s channel action, current/future program action, hold details, paging, Now action, collection filters and focus when a page changes.
- On a completed series, verify manual Next finds the next episode and honors Roku continuation policy: same IPTV account only; add-on sources ranked by capability/audio match with stable discovery-order ties.
- Toggle Autoplay next episode and confirm only the enabled setting starts the resolved next episode only in eligible final-ten-second playback or completion. Confirm unavailable/upcoming/caught-up states keep the outgoing session and explain the choice.
- Seek a direct session and a managed session. A managed seek must replace the server playback session at the requested title position, not merely seek within the old manifest.
- Change audio and subtitle tracks on direct and managed sessions. Managed changes must replace the server session; the visible selection must reflect the new delivery.
- Verify heartbeat/progress during playback, final progress on exit, clean backend stop, overlay timeout, remote rewind/fast-forward commit delay, and Back/Exit behavior.

## Device-specific evidence

On Tizen, verify the signed launcher opens the configured HTTPS `/tv/?platform=tizen` URL, AVPlay availability, adaptive playback, Back mapping, and native audio/subtitle behavior. Record model, firmware, stream type and result.

On Vizio, deploy the bundle at the API’s same HTTPS `/tv/` origin. Verify application load, remote mapping, media capability fallback, playback of direct and managed sessions, and Back/Exit behavior. Record model, firmware, stream type and result.

For both devices, verify a bad/add-on response never exposes upstream URL, headers, cookies or tokens in UI, logs or persisted browser storage.

The subsequent acceptance pass includes parent-gated profile selection/sign-out, partial search result retention, empty source-filter focus, full source details, and add-on install/enable/remove. Sign-out denial or network failure preserves the stored device grant. Canonical Browse heading/filter/grid positions are asserted at y=54/178/248. CI now runs automatically on main pushes and pull requests; manual dispatch also runs browser acceptance by default.

The queue restart follow-up passed the full suite with retries disabled (37 passed, 25 platform exclusions). Delayed screen/modal focus could steal an OK release or select a different track. Focus now settles before paint; the three player-remote cases passed five consecutive runs (15/15), followed by the full suite without retries. Hosted run 34715561355 at a3ca33c was green but contained one retry; use the later clean evidence when evaluating this fix.

The later source-recovery pass passed 40 browser tests (28 platform exclusions) with retries disabled. It adds same-IPTV-account Next, three-distinct-source attempt bounds, and explicit Resume failure recovery through exact Retry or manual source choice at the retained position.

Hosted validation [34721070923](https://github.com/viptv-org/tv-web/actions/runs/34721070923) passed on `09de6a4ad0302246a1b6b28e290795d1821483bd` without retries. It ran 40 unit tests (6 files), TypeScript/build, TV packaging, and the complete one-worker all-platform Playwright collection: 76 cases total, 44 passed and 32 intentional platform skips. This revision adds three held-action scopes: a queue-backed non-live hero opens Manage; a resumable non-queue hero opens explicit source selection; and a held non-queue Home card follows ordinary selection. It remains browser evidence only; physical Tizen and Vizio qualification is still pending.

Hosted validation [34721285708](https://github.com/viptv-org/tv-web/actions/runs/34721285708) passed on `7c9aba69f8e752d0e748f3bc7f70c6584a546edc` without retries. It ran the same build and packaging checks with 40 unit tests and 78 all-platform browser cases: 45 passed and 33 intentional platform skips. The added regression proves a held unselected series hero opens episode detail, never a source list. Physical Tizen and Vizio qualification remains pending.

## Browser codec / proxy checkpoint — 2026-09-13

Design: `fbafe1124fc8d9c2dc8a8c2c3c321b7aa856a937` (`BROWSER_PLAYBACK.md`).

- Unit suite: 56 passed, including runtime MIME/MediaCapabilities evidence, unsupported transports, HLS resource/session isolation, cleanup, and cancellation before a backend session. API transport serialization assertion also passed in the final focused API run (20 tests).
- Typecheck, design integrity and Tizen/Vizio packaging passed. Vite reports a large bundle warning after adding hls.js; this is not a build failure.
- Final complete Chromium suite: 51 passed, 35 intentionally skipped across two platform projects (86 collected), one worker. Real synthetic H.264/AAC HLS decoded through both the browser-selected native path and forced hls.js/MSE; decoded frames, pause, seek, resume, cleanup and same-origin playlist/segment requests passed. The MSE test suppresses only that video's native HLS hint; decoding remains real.
- Synthetic UI fixtures explicitly simulate native HLS and are not codec evidence. Earlier failures were an overlapping Playwright artifact-directory race and a test assumption that Chromium lacked native HLS; the final isolated run passed.
- No emulator, real Tizen/Vizio TV, HEVC hardware matrix, production deployment, or protected provider stream was exercised. Runtime probes are bounded capability evidence, not a guarantee for every file/profile/firmware.

## Crux adoption and reported TV failures — 2026-09-13

Design pin12e2a3a2a4ac62310c0597f4e08257e7d9c87300; core adoption recorded in CORE_REF. Identity/profile/catalog/media/source/playback normalization uses the real Rust WASM artifact; domain types derive from generated wire.ts.

Final complete Chromium suite55passed/35intentional platform skips (90collected), one worker. Real nativeHLS and forcedMSE decoding/pause/seek/resume pass. New regressions confirm remembered-profile restoration without pairing flash on reload and concentric profile-image/focus-outline geometry at1280×720 and1920×1080. Avatar displacement reported by the owner was not reproduced in these measurements; no speculative CSS patch was applied.

Unit suite62passed against actualWASM; runtime TypeScript tests9passed; core Rust14contracts and3sharednative/WASM startupvectors pass. Fixed failures discovered in final validation: optional catalog errors now retain a sanitized message while other shelves continue; parent series metadata replaces outgoing episode fields on return, retaining season selection.

Playback has one bounded same-source direct-to-managed retry for preparation and later decoder rejection, with stale error checks, position/pause preservation and Stop cancellation. This is not evidence that the owner's exact live stream is qualified. Production backend and household accounts/providers/history were not modified. No emulator, realAndroid/Tizen/Vizio or installedTauri tests performed. Remaining all-platform extraction is recorded in core/README.md.

Final packaging/typecheck and immutable core/design integrity checks passed. Live LAN preview loaded WASM with HTTP200 and completed pairing initiation with HTTP200 and no page errors; no account was approved or selected by this check.

## Responsive viewing client — 2026-09-13

See RESPONSIVE_VALIDATION.md and issue #3 for current immutable pins and results. Production build, strict application/test type checks, 72-test unit batch, five-test Guide follow-up, 60-scenario browser batch and five-scenario final responsive subset passed. Platform-specific duplicate browser exclusions are recorded separately from executed tests. Default browser now uses real responsive presentation; explicit TV platforms retain their prior renderer. Native Tauri packaging/SmartCast hardware and a public Vizio receiver remain unverified/unconfigured.

## Populated responsive correction — RUI-022

DESIGN_REF now pins502dcb5. The prior sparse layout tests missed internal fixed-root overflow:24 cards produced a5952×3348 phone hero. Current checks measure the application scroller and decoded imagery with full shelves at seven widths. Build,73 unit/controller tests,14 distinct responsive scenarios and4 explicit TV geometry/profile regressions pass across final runs. See RESPONSIVE_VALIDATION.md for detailed evidence, private visual review and live preview checks.

## 2026-09-14 owner-reported responsive correction

See RESPONSIVE_VALIDATION.md for the current evidence and earlier false coverage limits. New tests cover the complete shared card projection, metadata hydration without identity mutation, exact episode artwork, live logo containment, mobile lower-shelf focus, OLED Settings and real browser history. Actual upstream live and VOD adapter playback is verified separately from fixture UI tests.

## RUI-024 mobile focus styling

Mobile retains selected navigation surfaces without white focus outlines, inverted controls or bright card/profile focus frames. Desktop keyboard and TV remote focus remain. Production build and18 responsive browser cases passed, including focused Home/Settings, cards, profiles and actions, plus desktop keyboard focus preservation.

## RUI-025 pointer-first desktop/mobile web

Supersedes desktop focus styling in RUI-024: every responsive viewport uses neutral focus appearance and selected destination surfaces. Automatic navigation/card focus and TV spatial/hold/media key handling are disabled in responsive mode. Native browser input/dialog semantics and Escape remain. Production build,22 responsive/history browser cases and4 remote-input unit tests passed, including TV700ms hold preservation.

## RUI-026 — artwork failures, dialog backdrops and source loading (2026-09-14)

Design `58cc091b797b385dd44c8586455578973577c390`; shared core `b374711cc0af768572d7065744bb609cd5a5c6a8`. Card image transport retries its original URL if the resize derivative fails, then reports failed originals to Rust `cardPresentation.failedImages`. Rust selects the next permitted role; Continue Watching never substitutes a portrait for a failed episode still. Dialog backdrop dismissal uses existing cancel paths; profile PIN work is aborted on cancellation. Source discovery now has one in-row indicator; removed the absolutely positioned empty-state duplicate that could overlap navigation.

Final browser batch: 26 responsive/history/artwork/loading scenarios, 2 responsive profile/text-backdrop scenarios and 28 TV-shell scenarios passed, with 12 existing platform-specific TV-shell skips. Phone/desktop image tests return 404 for episode stills and confirm the shared landscape loads; dialog tests cover inside/outside clicks and unsaved draft cancellation. Spinner regression failed on both widths before the fix; corrected indicator remains in its status row across animation phases. Unit suite: 87 passed, including drag-out and late parent-authorization cancellation. Core's separate native 41 tests and WASM failure-policy regression passed. Device qualification and a new authenticated Bleach-origin check are not implied by fixture acceptance. No emulator, account/provider migration or Roku runtime change.

Final production build passed: design/core snapshot integrity, grouped strict TypeScript checks and Vite bundle. These checks are browser/source evidence, not physical playback certification.


## RUI-027 — responsive playback, guide, catalog and sign-in (2026-09-14)

Design f8ca89d2c3d039fa4b6b51bd095131aa9e870374; shared core a8ece4f10576b7ea72b6f2cf6c52ae7dd13dffe7. Final app unit suite: 117 tests across 19 files passed. Production build, grouped strict TypeScript, design/core integrity passed with the build's 384 MB Node heap. The final design-only documentation-link update also passed integrity checks.

Full one-worker browser batch: 100 passed, 59 intentional platform skips, one remote-player fixture failure. That fixture claimed successful playback with zero decoded dimensions, triggering the new first-frame recovery. Correcting its mocked video dimensions made all four affected remote-player cases pass (four platform skips); no production guard was weakened. This provides passing coverage for all 101 executable scenarios across the full run and focused rerun, rather than claiming a single clean full-suite run. Responsive assertions cover fullscreen, volume/mute, truthful playback diagnostics, centered sign-in, category selection, sticky channel/time axes, horizontal/vertical guide scrolling, independent Discover loading and custom addon namespaces. Native window fullscreen and external-browser approval are tested at the Tauri API boundary.

Real media was checked separately using temporary authorized sessions, which were stopped and signed out afterward. Cartoon Network decoded through MediaBunny to a changing 1920×1080 canvas with AAC audio and advancing time. The backend independently selected video/audio encoding; the client did not force transcoding. Project Hail Mary exercised a MediaBunny decode failure and successful same-session HLS.js fallback at 1920×1080, including pause/seek/resume. A byte-range Sintel MP4 fixture decoded through MediaBunny at 854×480 with start position, pause, seek, resume and volume/unmute checks. These samples do not establish universal codec compatibility.

MediaBunny requires secure-context WebCodecs; plain LAN HTTP can use the native/HLS.js fallback and reports that fact. Physical Tizen/Vizio qualification and installed Tauri packaging remain outstanding. Android consumed the same core pin; hosted Android validation run 34805828787 succeeded. No emulator or local Gradle was started. Core's separate 43 native tests passed; the account website's 95 unit tests and production build passed.

Real LAN sign-in also passed: login HTTP200 → CSRF device approval HTTP200 → device token HTTP200 → profile picker. At 390×844 and 1440×900, form centering error was zero in both axes with no overflow; cards measured 350×609.5 and 440×644 respectively. The password was absent from durable browser storage and removed from the form after success. Both temporary cookie and bearer sessions were signed out (HTTP200); no profile was selected and no history changed.


## RUI-028 — owner-directed responsive guide and browse layout (2026-09-14)

Design `b4c20fea6e97e90c74fbf7f8e5691787b34e3a2a` (RUI-028); shared core unchanged at `a8ece4f10576b7ea72b6f2cf6c52ae7dd13dffe7`. The owner reviewed the running responsive client and directed four corrections. Data, playback, source-selection and focus semantics are unchanged.

- **Live TV is one page row.** The separate `.epg-toolbar` is gone: the eyebrow/heading, the active channel filter with its date and timezone, the Live TV search field, Earlier/Now/Later and the schedule scroll instruction share one heading row. Below it the category sidebar and the guide box form one row with `align-items: stretch` and one shared height token. Measured at 1440×900: heading band y116–210 as a single row; sidebar 216×500 at x40 and guide 1120×500 at x280 — same top edge, same height, both ending on the 1400px frame edge, with the channel paging footer spanning the frame beneath them. At 1024×900 the header wraps to two rows and the columns measure 216×500 and 704×500.
- **Browse routes no longer cross-link.** Search no longer offers Discover and Discover no longer offers Search. Discover had been hidden from the phone bottom navigation below 600px, so that switch was the only phone route to the page; Discover now remains in the phone navigation.
- **No leading Back control in the shared header.** Detail, sources and profile screens keep brand, navigation, Watch on TV and profile. Browser Back, gesture and history still return, covered by the new `page.goBack()` case.
- **One card presentation for browse results.** Fixed 256px columns that ended 258px short of the 1440px frame edge, and one full-width card per phone screen, are both replaced. Columns now resolve from the frame width: 5 columns of 252.8px at 1440 (x40→1400 exactly) and 6 columns of 250px at 2560 (x470→2090 exactly), while 390px uses Home-style 232px tiles on one horizontally scrolling row (scrollWidth 5948 against a 358px client width). Search results are per-catalog sections and keep Home's shelf presentation, ending on the frame edge at 1440.
- **Tablet sidebar/guide swap fixed.** Header-only navigation wrapping is now scoped to `.responsive-toolbar nav`. The previous unscoped `nav { order: 2 }` also matched the guide's `<nav class="epg-categories">` as a grid item and moved the sidebar into the guide's column at 900–999px; at 900px the sidebar previously rendered at x280 with a 580px width while the guide sat at x40 with 216px.

- **The guide has no channel paging controls.** `Previous channels` and `Next channels` are removed from the responsive guide; the sidebar narrows channels, and reaching the end of the loaded rows loads the next 40-channel API page inside the same scroll. The footer keeps a text status only (`40 of 88 channels`). A new case pages 88 fixture channels through 40 → 80 → 88 rows by scrolling alone. The schedule cache grew to 200 entries so an appended page cannot evict the schedules of the rows above it; TV remote paging is unchanged.
- **Route changes no longer move the frame or the header.** The application scroller keeps a permanent vertical scrollbar slot (`overflow-y: scroll`), so Home (2147px tall) and Search or Live TV (900px, exactly the viewport) cannot differ in content width; the guide timeline scroller does the same for categories whose row count crosses the guide height. Headers and content stay on identical coordinates across Home, Discover, Search, Live TV and My List at 390, 900 and 1440px, and overlay-scrollbar platforms (this suite's Chromium, phones, tablets) lose no width for the slot. The header's profile control is a fixed slot (144px at ≥900px, 48px below), removing a measured 56px reflow of the Watch-on-TV action while the profile avatar and the chosen-screen toolbar settle.

Validation: 117 unit tests across 19 files passed; the full one-worker browser batch passed 111 cases with 59 intentional platform skips, including the new `tests/e2e/responsive-layout.spec.ts` (guide row/equality at 390 and 1440, browse frame fill at 390 and 1440, and the header/detail/sources/profile control check). Hosted validation for this revision: TV candidate validation run 34820428098 passed. Production build, grouped strict TypeScript, design-snapshot and core integrity checks passed locally with the build's 384MB Node heap. These are browser and fixture measurements: physical Tizen/Vizio qualification, matched real-content comparison and installed Tauri packaging remain unverified. No backend, account, provider, history, volume or Roku runtime change was made.

## RUI-029 — timeline duration and preparation recovery (2026-09-14)

Design `8f6419fc67d50f8d46e205b1643067fdd15a946a`; shared core unchanged. The owner reported that the browser's seek bar showed a length that kept growing, "as if it's showing only the transcoding progress duration", and one source that failed with the generic *VIPTV could not complete that request*.

**Cause.** Every managed server delivery is a rolling HLS window (`-hls_list_size` plus `delete_segments`), so the media engine's duration describes only the produced part; the browser adapter published exactly that value as the title length. The Roku player never does: it keeps the session/item duration and, for direct playback only, lets the engine raise it (`MainScene.brs`: `if m.playbackMode = "direct" and m.video.duration > 0 ...`). The failing source matched the single backend warning in the same window: `Source probe failed category=InvalidJson`, i.e. a preparation refusal (the route maps preparation errors to HTTP 400, which the client renders as the generic message).

**Implementation.** `OpenPlayerRequest` gained `timelineDurationSeconds` (the server's inspected source length) and `adoptEngineDuration` (true only for original-file delivery). One shared `timelineDuration`/`growOnlyDuration` rule serves the HTML, AVPlay and MediaBunny adapters: the server total is authoritative, only a direct file may raise it, and the reported length never shrinks. Live still reports no duration. `PlaybackSessionController.start` now answers a refused preparation with the next rung of the same source (managed output, then forced transcode) and never retries authorization, expiry, cancellation, capacity or out-of-range-position refusals. Server-side, an unreadable or over-budget ffprobe response earns one reduced-entry inspection (`InvalidJson`/`OversizedOutput`) before the source is refused.

**Evidence.** New unit coverage: a managed session whose engine reports a 32s window keeps reporting the 5400s title length while the window grows to 96s; a direct file adopts a longer intrinsic length and never falls below the server total; a 400 preparation refusal escalates to `managedOnly` then `managedOnly + forceTranscode`; 401/403/404/409/429 refuse exactly once. Backend: 179 lib tests passed with the new reduced-probe case and the updated bounded-attempt table (malformed or oversized stdout now costs exactly two attempts), strict Clippy clean. Web: build, 121 unit tests and 115 browser cases passed (59 intentional platform skips). The production server still runs the pre-split monorepo image, so the inspection fallback is not live until that backend is deployed; the client rule is live wherever this bundle is served.

## Organization cleanup — 2026-09-14 (56f5294)

Whole-repository cleanup under the organization plan (`viptv-org/.github CLEANUP_PLAN.md`): zero behaviour change, pinned paths untouched, one commit.

What changed: dead code found by `noUnusedLocals`/`noUnusedParameters` (MediaBunny's unused duration helpers and field, App.tsx's unused guide state and a controller subscription whose value nothing read, three unused API type imports, an unnecessary React import); duplication merged (`boundedPosition` now exists once in the player contract module, `activeSessionOrThrow` moved onto the shared `SessionPlayer` base class, `tests/api/client.test.ts` gained one `apiFor()` builder replacing 20 hand-written constructions and one shared token fixture, removing ~50 test lines). Net source+test delta: +68/-104.

A real defect surfaced while removing the dead imports: MediaBunny still published the produced rolling window as the title duration, so the RUI-029 rule had never actually reached that adapter. It is fixed and covered by a new managed-window case.

Evidence: 122 unit tests and 115 browser cases passed with 59 intentional platform skips; production build, strict TypeScript and design/core integrity passed. No test was deleted or weakened. `design-contract/`, `vendor/core/`, packaged assets and `dist/` were not touched.



## Playback consolidation — 2026-09-17 (ADR 0003)

The whole player stack moved to the sibling `viptv-org/video` repository (design ADR 0003) and is consumed as `@viptv/video` via `file:../video` (package 0.4.0, commit `5fb3940`). `src/player/` and its 8 test files (77 tests) moved with the code; tv-web keeps the UI, API and e2e suites. `exactResumeSource` — the core-owned resume rule — now lives in `src/ui/continuation.ts` with its assertions in `tests/ui/continuation.test.ts`; the playback contract types (`DirectFileCapabilities`, `PlaybackCapabilities`, `PlaybackStart`) re-export from the package in `src/api/types.ts`. The e2e decoder specs import the real adapter from the package's dev-server module URL (`/@fs/mnt/ALPH/code/viptv-org/video/dist-js/index.js`), verified served and transformed by the dev server.

Verification: grouped strict typecheck passed (application, tests/api, tests/e2e, tests/fixtures, tests/ui); 14 test files / 86 tests passed on one worker with a 256MB heap; production build passed (`vite build`, 2.05s) with the 384MB heap. The e2e decoder spec itself was not executed this round (no browser run against the running stack); its module URL was verified transformed, and the suite's browser qualification evidence is otherwise unchanged.

## Local addon mode — 2026-09-21 (design 329d792)

Implements LOCAL_MODE.md LM-001–LM-003 (status: proposed): account-free operation from an on-device addon registry. Local mode is a boot-level branch (`src/ui/LocalApp.tsx`) offered only in builds declaring `VITE_VIPTV_LOCAL_MODE=1`; the backend-hosted bundle renders no entry point. The registry (`src/local/registry.ts`, `viptv.local.registry.v1`, stable ordinals) and discovery client (`src/local/discovery.ts`) run the same shared provider negotiation/aggregation as the backend through the vendored core wasm (core `ace630e`), including genre/search/skip semantics, the 200-item cap, request validation copy and the unsupported-media-type error.

**Implemented:** sign-in entry ("Use without an account" with the focused privacy copy, responsive and TV pairing screens), local Home shelves per enabled catalog, catalog browse with declared genre/search filters and raw-page-length pagination, addon install/remove/enable management with the design's copy, confirmation dialog and focus return, exit to account sign-in, and empty/error states.

**Explicitly not implemented in this revision:** local playback (LM-004) — no stream discovery or player wiring exists in local mode, so browse cards are non-interactive; TV spatial-remote focus for the local shell (DOM/keyboard order only); local detail screens. These are recorded gaps, not claims.

**Evidence:** 141 vitest cases passed (20 new local data-layer tests, 8 LocalApp component tests, 1 sign-in entry test) against the real vendored wasm; production build with design/core/video integrity checks passed; a headless-Chromium script (VITE flag on, manifest/catalog routes mocked, backend aborted) verified entry → empty state → install → shelves → browse + genre filter → exit with no page errors. Physical TV, Tauri packaging and real addon hosts remain unverified; browser CORS governs which addon hosts a web fat build can reach (design LM-006).
# LightningJS TV-only migration checkpoint — 2026-09-24

## Profile screen continuation

The staged Lightning entry now uses focused Blits profile-tile components
with real `/api/auth/me` data, packaged avatar images, a letter fallback,
the Manage/Done control and a 700 ms hold that suppresses release selection.
The profile fixture verified Right then Enter selects profile 2, including
the rapid key sequence before Blits paints the new focus. Down then Enter
enters Manage, and held Enter does not select a profile. A 1920×1080
`TvProfiles` capture versus the unchanged React TV baseline has 292,096
changed pixels (14.0864%), MAE 3.4131, RMSE 24.6169, SSIM 0.721367.
`TvProfilesManage` has 301,406 changed pixels (14.5354%), MAE 4.0433,
RMSE 26.802 and SSIM 0.684476. These are open visual failures against 1:1.
Profile editing, PIN, paging beyond the first five, Home interactions and downstream TV
screens remain to migrate; the current TV launcher has not switched.
The profile capture from the production `/tv/` preview matched the development
metric above. The existing React `TvPairing` and `TvProfiles` screens were
recaptured and each matched its saved baseline exactly on the final repeat.
Checkpoint checks: 169 unit tests passed; the targeted existing TV shell
Playwright suite passed 10 scenarios with 8 deliberate skips; the Lightning
pairing/profile/hold browser fixtures and production build passed.

## Home data/render continuation

After a profile is selected, the staged Lightning entry now loads its queue,
catalogs, recent live channels and hero metadata through the shared API and
Rust presentation functions. It renders the real hero image/logo, progress,
synopsis, first Continue Watching shelf and collapsed rail rather than the
previous placeholder. The `TvHome` fixture observed the profile queue request
and captured this state at 1920×1080. Compared with the saved React TV Home,
1,406,199 pixels differ (67.8144%), MAE 8.8849, RMSE 26.6207, SSIM
0.857713. The ambient backdrop, card typography/progress, and rail geometry
need further visual work. This is an incomplete screen, not a parity
pass or a launcher switch. Tizen, Vizio and webOS browser-configuration Home
captures were byte-equal under the same fixture; no physical TV run occurred.
Home now uses focused Blits components for its three hero actions and first
queue shelf. The fixture's rapid Right+Right+Enter activated the shared My
List API, Down/Right visibly moved focus to the second card, and a 750 ms
held OK suppressed release activation. Play, Details, card routes, the
remaining shelves and rail navigation are still pending.
The same rapid My List activation and directional-focus fixture passed on
the production `/tv/` preview bundle; its initial Home pixel metric was
unchanged from the dev capture.
Final checkpoint checks: 169/169 unit tests, 24 targeted responsive/TV
Playwright passes with 10 deliberate skips, and the production build passed.
The existing React `TvHome` recapture still had zero changed pixels against
its saved baseline.

## Title route continuation

The staged Lightning Home Details action and Continue Watching cards now open
title pages from the selected item through the shared detail API. Series
progress is merged through the pinned Rust core before choosing the initial
episode. The title has Blits-focused actions and episode tiles. The browser
fixture confirmed Home Details → series title, Back restoring Details focus,
and the second queue card → its movie title → Back restoring that card's
focus; the title My List action reached
the shared API. An opt-in focus marker made the D-pad/Back assertions wait for
actual Blits component focus instead of an arbitrary delay.

The 1920×1080 Lightning `TvTitle` capture against matched React content has
1,474,821 changed pixels (71.1237%), MAE 8.2731, RMSE 27.3696, SSIM
0.793883. The ambient backdrop, source pill, focus shadow, episode details
and typography remain open visual differences. Full playback controls, More info and full
episode activation still need their intended flows;
the visible staged controls do not qualify those behaviors or a TV launcher.
The production `/tv/` preview reproduced the Title capture and metric, and
the existing React `TvTitle` recapture had zero changed pixels. At
this checkpoint 169/169 unit tests passed; targeted responsive-layout and TV
shell Playwright acceptance passed 24 scenarios with 10 deliberate skips;
design/core/video checks, TypeScript and production build passed.

## Source panel continuation

The title's Play and Choose source actions now preserve distinct Resume intent
and open a Lightning source panel. Discovery uses `TvApi.sources()` plus
`pollSourcesStep()` so the pinned Rust reducer owns cursor, deduplication and
completion. Blits components own focus for quality chips, provider choices,
source rows and the source-details Close button. Browser fixtures verified
12 normalized sources, choosing source 2 with its original item ID and
position, paging to source 7, 4K empty → 1080p filtering, a LordStreams
provider filter with three rows, Back restoring the title's source focus, and
no further poll after close. Play carried `resume=true`; Choose source carried
`resume=false`. Holding OK for 750 ms opened source details and suppressed
row activation on release. Tizen, Vizio and webOS browser-configuration
`TvSources` captures were byte-equal under the same fixture.

At 1920×1080, matched-content Lightning versus React measurements remain
open failures: `TvSources` 1,525,612 changed pixels (73.5731%), MAE 5.7584,
RMSE 22.7721, SSIM 0.887465; `TvSourceProvider` 1,267,892 changed pixels
(61.1445%), MAE 6.2317, RMSE 22.8690, SSIM 0.847848;
`TvSourceDetails` 184,921 changed pixels (8.9179%), MAE 2.4859, RMSE
20.9487, SSIM 0.627974. Background ambience, text metrics, panel/footer
geometry and focus shadows need correction. Source selection now passes the
exact intent to the pinned playback controller in the staged UI. Physical TV
input/decoder behavior and the TV launcher remain unqualified.
The staged panel currently mounts five quality chips and six provider-choice
slots; additional custom qualities/providers still need navigable overflow.
The production `/tv/` preview reproduced all three source-state captures and
their pixel metrics. The unchanged React `TvSources` recapture had zero
changed pixels. Checkpoint validation passed 169/169 unit tests, 24 targeted
responsive/TV Playwright scenarios with 10 deliberate skips, and the
design/core/video integrity, TypeScript and production-build checks.

## Player transport and overlay continuation

The staged Lightning entry now gives the pinned `@viptv/video` package the
explicit selected source and resume position. Its session controller starts
the backend delivery, opens the existing platform adapter, and preserves
source addon/fingerprint fields for progress saves. Vizio and staged webOS
browser paths render the media element beneath the transparent Lightning
canvas; Tizen uses AVPlay, whose browser stub advances state but paints no
video frame. A host CSS shade uses the design tokens so the video remains
visible behind Blits controls. WebOS currently uses the shared HTML fallback
profile rather than a dedicated device-qualified adapter.

The browser fixture verified a backend playback session, Pause, a relative
seek, seek-preview Back cancellation, Enter seek commit, first Back hiding
controls, second Back stopping the session and saving progress. Play with no
saved source fingerprint did not pick a lookalike stream automatically;
manual source selection preserved its ID and Resume intent. All three browser
platform configurations passed these transport-state checks. These are
mocked media/AVPlay boundaries, not physical codec, DRM or video-layer proof.

Matched Vizio-browser captures at 1920×1080 still fail the exact visual gate:
`TvPlayer` has 94,978 changed pixels (4.5803%), MAE 3.2571, RMSE 24.6134,
SSIM 0.753696; `TvPlayerSeek` has 114,621 changed pixels (5.5276%), MAE
3.4487, RMSE 24.7832, SSIM 0.737013. Control icon/text rasterization,
seek bubble/ring and placement remain open. Full track-panel paging, Next,
player error/recovery, live and DVR behavior, and real Tizen/Vizio/webOS
decoder/layering qualification remain incomplete; the TV launchers stay on
the React path.

## Audio/subtitle track continuation

The staged player now opens a Blits right panel focused on the current audio
or subtitle track. It uses the pinned video controller's direct/native track
when available, otherwise the server session's track list and managed
`replaceTracks` path. Subtitles Off follows the same native-versus-managed
rule as React. Browser fixtures on Tizen, Vizio and staged webOS verified
current-track focus, Back returning to the originating control, an
unavailable PGS choice staying open without a playback replacement, and
managed replacements for Subtitles Off and English Stereo audio. The UI
snapshot of the Vizio subtitle panel matched the fixture content but still
had 380,929 changed pixels (18.3704%), MAE 3.7155, RMSE 21.8704 and SSIM
0.862725 against React at 1920×1080. Panel typography, ring and footer
remain open deviations. The staged panel mounts eight track rows; longer
lists still need focusable paging and real-device track qualification.
The production `/tv/` preview reproduced the subtitle-panel capture and
metric. After this change, 169/169 unit tests, 24 targeted responsive/TV
Playwright scenarios (10 deliberate skips), and the production build passed.
Phone `Main` and desktop `DeskHome` recaptures remained pixel-identical to
the isolated pre-player baseline (0 changed pixels each).

The phone `Main` (390×844) and desktop `DeskHome` (1440×900) React captures
were compared against an isolated tv-web `de6adc1` checkout from before the
player wiring. Both had zero changed pixels, MAE/RMSE 0 and SSIM 1. The
temporary checkout was removed; screenshots remain under ignored test output.
The production `/tv/` preview repeated the Vizio Player/Seek fixture and
matched the dev pixel metrics. Final checkpoint checks passed 169/169 unit
tests, 24 targeted responsive/TV Playwright scenarios (10 deliberate skips),
and design/core/video integrity, TypeScript and production build.

Design pin `aa2a1d69935fc07a97bd37d5fa0f78ab8d1c7b47`. A separate
`lightning.html` entry now builds with LightningJS Blits 2.10 and the shared
`TvApi`/Rust session driver. Its first real screen requests a device code,
renders the address/code/QR, expires the code, and retries on Enter release.
`node tests/preview/lightning-shoot.mjs TvPairing` and the Loading/Expired
variants used the same mock backend as the React TV captures at 1920×1080.
Tizen, Vizio and webOS browser-configuration pairing captures were byte-equal;
the expired run verified a second pairing request after Enter. The existing
React TV pairing capture remained pixel-identical to its saved baseline after
the separate entry and build plugin were added.

The current Lightning `TvPairing` screenshot versus that React baseline has
331,807 changed pixels (16.0015%), MAE 3.7149, RMSE 25.1868 and SSIM
0.911408. The metric is an open failure against the requested 1:1 target,
not a parity claim. Text rasterization/weight, focus shadow, QR edges and
spacing remain visibly different. The screenshots and amplified diff are in
ignored `test-results/preview/`. Profile and Home currently have staging
placeholders; no other TV screen, D-pad flow, media adapter or webOS host is
migrated. Production Tizen/Vizio launchers and responsive web/Tauri still use
their existing entry. No Lightning run has been made on physical TV hardware.
Checkpoint validation: 169/169 Vitest tests passed, 127 Playwright scenarios
passed with 75 deliberate platform skips, and the production build passed its
design/core/video integrity and TypeScript checks. These existing suites cover
the unchanged entry; the new pairing fixture checks are browser-only.
The production bundle's separate `/tv/lightning.html` entry was also served
through Vite preview with base `/tv/`; it rendered the same pixel metric as
the dev capture. This does not mean the public site or TV package uses it.
# Lightning TV Live guide — 2026-09-24

The staged Blits Live rail destination now loads shared live categories, channels,
and schedules. It renders five channel rows and guide cells using the React
guide's shared window/cell calculations, shows the selected programme and
live-preview placeholder, opens a programme-details panel on held OK, and opens
sources for a current programme while future OK opens details. Browser fixtures
checked D-pad row/filter navigation, News category requests, programme focus
restoration, the 700 ms hold, details Back/Close, and a full-screen Live search
entry whose Done action sends the trimmed query to `/api/live`. The route also
supports hour-window navigation and 40-channel page requests; long real-world
channel lists and physical remote keys remain unqualified. Current-programme
Watch goes through the staged source picker, which differs from React's direct
play action. Physical typing preserves the query, but its focused keyboard key
does not consistently retain the white focus decoration after the text redraw.

Matched 1920×1080 React comparison remains open: `TvLive` changed 561,727
pixels (27.0895%), MAE 4.3172, RMSE 23.3649, SSIM 0.908843;
`TvLiveDetails` changed 1,235,755 (59.5947%), MAE 5.0488, RMSE 21.4385,
SSIM 0.877160; `TvLiveSearch` changed 144,918 (6.9887%), MAE 1.7969,
RMSE 14.4489, SSIM 0.824780. The previous larger changed-pixel figures used
the comparator's default design WebP and were incorrectly labelled React.
These are development measurements, not parity
acceptance. All three Blits frames were byte-equal across Tizen, Vizio, and
webOS browser modes. No physical TV run or launcher switch was made.

`npm run build`, all 169 unit tests, and the responsive/TV-shell Playwright
suite (24 pass, 10 expected skips) passed. Matched phone `Main` and desktop
`DeskHome` React frames were pixel-exact against the saved pre-migration
captures after a deterministic recapture (0 changed pixels each).


---

# Preserved SolidTV completion branch evidence

# SolidTV completion work — 2026-09-24

The completion branch uses native SolidTV focus ownership and remote routing,
including release/hold cancellation on blur. The compatibility scope API now
bridges leaf callbacks to native ElementNode focus rather than maintaining a
second active-focus registry. Design is pinned to
`268e42c6a456f82a1e6f5b3c8893eccbcc7c1b2d`.

Implemented Home Play/held actions, profile editing/creation/deletion/PIN and
pagination, shared remote text entry, addon installation, required catalog
filters, fresh pairing after sign-out, Next/recovery/Up Next, and direct guide
channel playback with exact focus return. Home backdrop composition reuses
wsrv derivatives; native SVG textures now render icons and key outlines.
The active Vizio preview was refreshed from commit `1fa94d8` plus the Home/player
fixes in this working update. On the V655-G9 Vizio, the new app loaded over
SmartCast and authenticated successfully; its Home requests returned HTTP 200
for the catalog index, recent-live shelf, and catalog pages. Home now builds
Continue Watching, recent live, browsable addon catalogs (including movie and
series rows), and My List; Left/Right traverse the full carousel with a
position counter, and Up/Down move between shelves. The TV build now renders
vector SVG icons for rewind, fast-forward, next, audio, captions, exit, hero
buttons, title actions, and profile management. Mobile, desktop and the React
entry were not changed.


Follow-up closes season selection/long episode navigation, full More info and
Source details scrolling (including long Unicode URLs), >8-track pagination,
Home retry without re-pairing, seek-target pinning and replacement-session
heartbeats. Added tests cover three-platform 12-track selection, cross-season
tenth-episode/source/Resume identity, three text-panel cases, Home retry and
managed seek/replacement heartbeat, retired-session heartbeat suppression, and
late decoder-error Retry preserving exact source and captured position. Controller recovery lifecycle has five
focused unit regressions; season projection adds three.

Validation: production build and integrity/type checks pass; 189 unit tests
pass. All 30 baseline SolidTV screenshot scenarios pass. Additional sequential
browser acceptance passes cover seven account scenarios, four text-entry and
sign-out flows, eleven Next/recovery cases, three platform remote-focus modes,
and direct live/programme playback in all three platform modes plus failed
preparation Back and cancelled-start ownership. These are fixture-driven browser tests, not physical TVs.

Remaining delivery gates: complete visual parity across the full canonical
screen inventory, physical Tizen/Vizio/webOS video and remote qualification,
and launcher/consumer switch. React remains the default launch entry. No
production deployment or desktop submodule update was performed. Historical
results below describe their original checkpoints; current performance results
are in PERFORMANCE.md. The latest 4× run uses 57.0% less main-thread work/key
and passes all eight speed/frame gates; startup varies near a tie and JS heap
remains higher.

---

### Standalone checkout checks (2026-09-26)

Browser decoder tests import the pinned `vendor/video/src/index.ts`, matching
production, rather than a workstation's sibling `dist-js` build. The preview
backend uses deterministic SVG artwork when optional reference assets are absent;
set `VIPTV_PREVIEW_REFERENCE_DIR` to an empty directory to reproduce a clean CI
checkout. Reference screenshot runs still use the real design assets. The watch
URL reload check forbids playback creation while permitting the title's existing
background source summary discovery.

### TV-040 native SolidTV polish audit (2026-09-26)

The native text adapter uses SolidTV's CanvasTextRenderer layout, uploads a new
texture before replacing the visible one, and tints focus colors without
recreating glyphs. Unit coverage holds uploads, changes focus color, races two
clock updates and checks empty-text cleanup. The local HTTPS frame observation
reported **90 clock frames / zero blank frames**; the profile audit reported
**90 alternating-focus frames / zero blank captions**. These are browser GPU
observations, not physical television measurements.

`tests/preview/solid-polish.mjs` exercises both Discover header rows, twenty
catalogs at 1920×1080 and 1280×720, twenty-four guide categories, repeated guide
time-window navigation, stable sidebar icon bounds, first-shelf scroll retention,
whole shelf headings, real channel-logo loading/fallback and preparation/Back.
The native live suite covers direct channel/program playback, passive live
progress, exact guide return and cancellation on Tizen, Vizio and webOS browser
boundaries. `solid-regressions.mjs --scenario=progressive-search` verifies that a
fast catalog renders while a slow addon is pending and keeps focus when it lands.

Private captures cover Home, profiles, detail, Discover, guide, expanded sidebar,
preparation and player. Home/detail share the feathered 950px backdrop; button
ink is centered in its actual control box. Continue Watching uses the same
40-item endpoint and shared enrichment as Android; the extra hero lookup was
removed. Search rows retain addon/catalog identity and have no result counts.

Run against trusted local HTTPS, for example:

```sh
SOLID_PREVIEW_URL=https://viptv.local.test:8443/tv/solid.html \
PREVIEW_API_ORIGIN=https://viptv.local.test:8443 \
node tests/preview/solid-polish.mjs
```

No new physical Vizio/Tizen/webOS firmware, codec or remote-hardware qualification
is implied by these browser results.

Production-data follow-up: partial queue hydration now updates the visible shelf
as well as the hero. A delayed second title regression proves the first episode's
caption paints before the second metadata request completes, without a second
queue request or focus replacement.

### Live end-time follow-up (2026-09-27)

`updatePlayerSnapshot` previously assigned VOD duration/position fields before
replacing them with live program labels. A zero-duration live snapshot therefore
cleared the end-time texture on every update despite the atomic text renderer.
The new regression reproduced 22 blank frames in a 90-frame run before the fix.
Live and VOD projections are now mutually exclusive, including the LIVE status.
Afterward Tizen, Vizio and webOS each passed 90 live frames with zero blanks and
zero replacements of the unchanged end-time texture. The 90-frame VOD clock,
direct live playback, cancellation and guide-return checks also passed. These
are browser-adapter results, not new physical TV qualification.

### TV-041 — bounded Home and player controls (2026-09-27)

`HomeShelfCache` keeps catalog descriptors separate from demanded payloads. The
initial queue/next shelf are the only row demand; metadata fetches run two at a
time, distant payloads are evicted, and obsolete/route-leaving requests cancel.
Profile queue/favorites remain shared account data. The native Home tree unmounts
on departure, its offscreen hero unmounts, and only visible/prefetch shelves mount
(up to four rows × six cards). A one-row back cache caps payload retention at five
rows. Unit checks cover eviction/refetch, cancellation, empty/error/retry, profile
queue edits after eviction, and buffer timeline offsets/gaps.

`tests/preview/solid-lazy.mjs` used 100 catalog descriptors and traversed twenty
shelves then returned. Observed: zero idle catalog-content requests, two concurrent
shelf requests, at most five cached rows, four mounted rows, 24 catalog image nodes
and 329 Home scene nodes. Reported texture memory peaked at 61,454,724 bytes
(about 58.6 MiB), including the renderer's baseline accounting. The configured
64 MiB cleanup threshold is not a process-RAM or decoder-memory measurement.
Returning to cached/refetched rows retained card positions and captions; leaving
Home stopped its request stream and removed its image nodes.

Player checks continued emitting playback ticks while waiting for five-second
inactivity hiding. The first Enter revealed controls without pausing; pause and
active seeking kept controls visible. The focused VOD thumb and two actual,
disjoint buffered ranges were inspected at their new lower coordinates. The
lower control group ends at y=1004 on the 1080p canvas, inside the y=1026 safe edge.
Live progress remains passive. Live end-time stability, direct play/cancel/return,
managed seek and Home Resume/hold/return passed separately. No new physical
low-memory television qualification is claimed.

## Browser media pipeline — 2026-09-27

Design PB-001, core `9c49d064`, and the pinned video source implement optional
browser inspection and local packet copy. Both renderers expose local tracks,
quality, captions and actual buffer ranges. Track panels open before asynchronous
inspection; Back prevents late discovery from reopening a dismissed panel.

- 217 unit tests passed; production build and all source integrity checks passed.
- Trusted-HTTPS UI run: 136 passed, 83 intentionally skipped, one track-dialog
  failure. That failure exposed an inspection wait and was fixed; the full
  four-case Vizio remote contract then passed, including the failing case.
- SolidTV production-bundle screenshots reviewed for Player, Seek and Subtitles
  using the Vizio boundary. These use controlled media stubs, not TV hardware.
- Actual media: nine cases each in Chromium, Firefox and Playwright WebKit;
  continuous HTTPS MPEG-TS through WebCodecs/MSE; live HLS, upstream quality,
  backend copy/conversion and caption extraction. Physical Vizio evidence and
  its hardware-plane/frame-callback limitations are documented in
  [video qualification](https://github.com/viptv-org/video/blob/main/docs/BROWSER_PIPELINE.md).

`VITE_BROWSER_PREPARATION=1` and `VITE_LOCAL_MSE_REMUX=1` enable the two client
switches. Both default off. Original browser preparation also requires the
server switch. Binary promotion is separate; Jellyfin-FFmpeg was benchmarked
but did not pass the software startup gate. No new Roku, Tizen hardware, native
Safari/iOS, sustained HDR or universal provider qualification is claimed.

Final rollout evidence: the browser and physical Vizio 30-minute 720p30 runs
completed; Vizio reported 0/54,501 dropped frames. A real live-source GOP
regression was fixed with continuous copied fMP4 and explicit HLS refusal
handling, then checked for 45 seconds on Vizio and beyond 85 seconds on the
production viewing site. Video now has 97 passing tests. The public entry is
`app-DPY6ZflC.js`; renderer/player hashes match backend image
`sha256:6f6d34ba54ad45d9dd695e77be2e67db5fe89106c5f0d264a7c68db2586d79eb`.
Back returned to Home and the production active-session count returned to zero.
# LG webOS 22+ packaging checkpoint — 2026-09-27

Host/delivery contract: design@0430d90, BUILD_DELIVERY.md. Existing visual
DESIGN_REF is intentionally unchanged. The LG host selects the existing TV
renderer and native HTML media fallback; root Back, media keys and background
cleanup are implemented without changing browser/desktop/Tizen/Vizio visuals.

Validation: 39 unit-test files passed (219 tests before the additional media-key
case; the webOS lifecycle/key suite then passed all 3 cases), typecheck and
production build passed. A real local HTTPS origin returned device/code 200 and
rendered TV pairing. PREVIEW_API_ORIGIN=https://viptv.local.test:8443 and
SOLID_PREVIEW_URL=https://viptv.local.test:8443/tv/solid.html exercised TvPairing,
TvHome, TvSources and TvPlayer with --platform=webos in the existing preview
harness. These are Chromium/synthetic media observations, not LG hardware.

Actions run 36359987582 produced the matching hosted ZIP and webOS IPK with
checksums. Samsung signing stopped explicitly because its four signing secrets
are not configured. No unsigned installability claim and no production deploy.
Actual LG/Samsung install, codec/DRM and remote-hosted AVPlay qualification remain
unverified. Keep captures private; they are not release assets.
# REL-001 — actionable errors, layers and navigation (2026-09-28)

Design 80e1331 and core 64f986e are pinned. TV-web, TV launchers and desktop use
the shared safe API error projection; provider capacity is no longer collapsed
into generic 429 text. Native desktop Power/Mute and reported TV identity use
the SmartCast bridge. Foreground verification retains the connected layout.
Header avatars open Settings, with Switch profile kept as an explicit action.
Saved Home rows render before optional catalog/preferences/hero work; late
completion is generation-guarded so it cannot replace subsequent navigation.

The disappearing TV foreground reproduced over trusted local HTTPS with the
Vizio canvas entry. A remounted backdrop rendered above its former siblings.
Explicit background and overlay layer order fixes hero return and opaque source,
provider and details panels without disabling batching or raising texture limits.
`tests/preview/reliability-scroll.mjs` forces texture cleanup during three scroll
cycles; the hero text/control region retained 11,527 bright pixels before/after,
with no page exceptions and roughly 44 MB texture allocation. Source, provider
and details panel visibility are checked independently. Private captures are not
committed. `reliability-browser.mjs` confirms failed artwork does not block Home,
header→Settings→Switch profile works, and delayed catalogs do not steal Settings.

221 unit tests, full typechecking and the production build pass. Both new browser
checks use `PREVIEW_API_ORIGIN=https://watch.local.test:4180` and a loopback HTTPS
Vite server using the existing local CA, not production data. These are Chromium
and mocked native boundary checks, not physical TV/desktop playback acceptance.
The website has not been deployed by this work; packages are a separate build.

Existing HTTPS `solid-shoot.mjs` TvHome, TvSourceProvider and TvSourceDetails
regressions also pass with `--platform=vizio`. The local Vite host requires
`allowedHosts: ["watch.local.test"]` and matching `hmr.host`/`wss`; the initial
harness attempt reported only a dev-server WebSocket host mismatch, corrected
before the successful rerun. No production configuration was changed.

## HOME-ADDON-001: automatic Home add-on refresh, 2026-10-01

Design `8b92d90842c9307df7e2daef5eeb0d9a61bbce51` defines account add-on
revision checks while Home is visible and foregrounded. React and SolidTV
refresh changed catalogs, preserve usable rows during failure, and acknowledge
the new revision only after demanded catalog loads succeed. Polling uses a
15-second interval; unchanged revisions do not refetch catalogs. Profile and
route changes cancel stale work. Existing focus and scroll survive refresh;
removed content uses a surviving card fallback.

The full unit suite passed (250 tests), and `npm run build` passed design,
core, video and type checks before producing the production bundle. Targeted
Playwright checks `tests/e2e/home-addon-refresh.spec.ts` and
`tests/e2e/solid-home-addon-refresh.spec.ts` both passed. They cover changed
catalogs, retained focus/scroll, unchanged polls and a synthetic catalog 502
followed by automatic recovery under the same revision.

The qualified production bundle was manually activated on dev.embedez.com
with the matching backend revision endpoint. Public asset hashes matched the
qualified files; `/tv/solid.html` returned 200 and the unauthenticated revision
endpoint returned 401. Existing account/profile IDs, sessions, encrypted add-ons
and viewing records were preserved. These are Chromium fixture and dev asset
checks; physical Vizio/Tizen/webOS refresh and installed desktop acceptance
remain unverified. No new playback or decoder qualification is claimed.

## SRC-OVERFLOW-001 / CW-SOURCE-BACK-001 — 2026-10-01

Design `ce7084ff80d0541257509748ea772ef0f95d8058` is pinned in
`DESIGN_REF`. React phone/desktop/TV source rows and SolidTV source rows now
reserve a fixed two-line description window. Long unbroken filenames wrap;
overflow moves slowly only with focus or pointer hover, restarts at the top
when interaction ends or the row changes, and stays still under reduced motion.
The complete description is retained in the React button's accessible label
and Source details (including the displayed audio text). Discovery shows the
accent spinner with `Finding sources`, then `Still checking sources` as rows
arrive, and clears it when polling completes. Partial rows stay selectable.

Back from a Continue Watching episode's source picker opens its parent series
details at that episode's season. A different episode can then open its own
source picker; Back from details returns to the originating queue card. React
uses the existing browser/remote history and SolidTV retains its Home/My List
return target. Existing source choice, hold/details, and playback intent paths
remain in place.

Local validation: 251 unit tests in 43 files passed with one fork; `npm run
build` passed design/core/video integrity, strict TypeScript, and production
bundling. Targeted one-worker Chromium Playwright tests passed for a 390 px
long-token row (equal row heights, two-line clip, focus motion, reduced motion,
full accessible label), pending discovery before/after a partial result, and
the queue episode source → parent title → another episode source → Home path.
The queue fixture also injected one parent-metadata 503; Retry opened details
and Back restored focus to the originating queue card.
`solid-shoot.mjs` TvSources, TvSourceDetails, and TvLibrary scenarios passed
against updated canonical fixture endpoints. Private captures of 390 px phone
sources and 1920×1080 SolidTV sources were inspected locally; no matched
pixel metric was recorded. Physical Tizen/Vizio/webOS remote and decoder
behavior, real-provider timing, and installed desktop behavior remain
unverified by these browser fixtures.

SRC-PROVIDERS-001 (`d088071106e4d5479aea761469152e037f011a3c`):
`npx vitest run --maxWorkers=1` passed 256 tests in 44 files. `npm run build` passed design/core/video integrity, strict TypeScript and the production Vite bundle. One-worker Chromium Vizio tests passed the three-producer fixture plus seven add-ons arriving while the menu was open: Cancel retained focus, the seventh producer remained selectable, and a distinct source description appeared in the accessible row and Source details. The SolidTV Vizio browser preview reached and selected the seventh producer through six native focus nodes. Private 1920×1080 React and SolidTV captures were inspected. Real upstream add-ons and installed TV hardware were not exercised for this revision.

CW-SOURCE-BACK-001 follow-up: a Chromium Vizio phone fixture supplied a Continue Watching episode with `type: series`, `series_id`, `season`, and `episode`. Source Back opened the parent title; title Back restored the focused queue card. React and SolidTV use the same episode-cursor predicate. The production build passed after this adjustment; physical TV focus is still unverified.
# Responsive player Fit / Fill — 2026-10-02

Design pin `02fbcdd24a5a32f0ee87e97ede83c7e30345c833`, WEB-PLAYER-FIT-001. The responsive phone and desktop player adds a visible Fit/Fill control beside Fullscreen. The same presentation state sets `object-fit` on HTML video and MediaBunny canvas; it persists through fullscreen and returning to the same title from Sources, and resets on a different episode/title or leaving the player for a non-source route. It changes no playback preparation or session API.

The design snapshot check, Core/video pin checks, TypeScript checks, production build, and 256 unit tests in 44 files passed. Single-worker Chromium Playwright passed the desktop decoded HLS player and 390×844 phone player scenarios. Desktop checks covered paused source identity/time, both surfaces' CSS mode, Enter/Space focus, fullscreen retention and existing playback info. Phone checks covered actual decoded frame Fit letterboxing and Fill crop, five nonoverlapping tools within the viewport, source return retention, and exit/re-entry reset. Private phone captures were inspected: Fit shows the whole 16:9 test frame with black bars; Fill crops it centrally to cover the portrait display. The fixture is decoded browser HLS with the MediaBunny canvas style asserted while hidden; real MediaBunny decoding, installed desktop and physical TV/browser devices remain unverified.
# Bounded connectivity recovery and native picture controls — 2026-10-02

A healthy health endpoint plus a failing identity request used to repeatedly
clear/reopen the connection banner without a delay. The full React application
regression fails against the prior hook and passes with one immediate probe and
no further attempt before ten seconds, including outage/recovery remounts.
Malformed HTTP200 identity data now shows one response error without background
health polling, using immutable Core `f66c87e13a2c93b6dad3234da9694c57f8530b0a`.

Responsive picture mode also reaches the native player API through reviewed
video `0eb875b52755c4c8906e6b4b7525ac3cfa735a2a`, retaining same-item replacement
and resetting other items through the existing presentation rule. Playback info
shows GStreamer or MPV only when the adapter reports it; unreported native
backends stay Unknown. The Linux native surface/picture implementation is
qualified separately in its owning plugin and desktop records.

259 app tests, strict type checks, design/Core/video integrity and the root-base
production build pass. These checks do not substitute for actual native GTK
overlay, paused crop, seek or audio verification.
# Native close handshake — 2026-10-02

The native renderer listens for `app-shutdown-requested`, coalesces repeated
close requests and awaits the active playback controller's stop before
acknowledging `app_shutdown_ready`. Failed lease release still acknowledges
so the native host can stop decoders and exit. The host owns a bounded fallback
for an unavailable renderer. Async listener registration is retired on unmount.
Imported Video `550ab35` supports ordered app-exit cleanup. The native hook
settles lease release before calling native close, because a blocked GTK thread
can prevent queued native HTTP IPC from dispatching. Ordinary playback stops
keep concurrent cleanup; a late shutdown release cannot stop a newer player.
Two focused regressions verify acknowledgement ordering, coalescing, release
failure and late listener cleanup. Actual window-manager/custom close, native
decoder termination and backend DELETE evidence belongs to desktop's integrated
qualification at its adopted exact TV/Core/plugin pins.
# Progressive responsive Home and initial routes — 2026-10-02

An indefinitely delayed first Home catalog reproduced two rendered defects:
saved rows removed the skeleton and left a `Loading…` pill, and a Discover
reload remained on Home until optional hero work settled. Responsive startup
now restores navigation after saved rows, catalogs and preferences arrive.
Empty pending Home retains its existing skeleton; saved cards stay usable.
Browser Back retries optional Home work cancelled on leaving that snapshot.
Four full React/API regressions cover those paths, including actual history
Back and an enabled saved-card action while the catalog remains pending.

265 app tests, all type/integrity checks and a root-base production build pass.
The seven DeskStates cells were reached over trusted local HTTPS at 1440×900
with mocked API/media boundaries and compared privately to design `1742afa`.
Home and Discover now show their intended skeletons with no loading pill;
backend banner, startup error, added/error notices and preparation remain
separately captured states. This is scoped browser state inspection, not
installed Tauri/native media, uniform pixel parity or physical-device proof.
DeskPlayerRestore remains a separate incomplete preview scenario.

# Desktop native controls and stable feedback — 2026-10-03

Video `e30f6af` retains polled engine facts, publishes volume before native IPC
settles, and keeps refused control operations from terminating playback. The
React playback error region is protected from native aperture masking. Bare
picture clicks reach the player screen when the native HTML anchor is hidden.

24 focused React/controller regressions pass, including native time,
pause/resume, pending volume IPC, picture-mode commands, engine identification,
actual error-toast composition, remote navigation, engine preferences and
shutdown. Strict application/test type checks and design/Core/video integrity
are checked by the production build. These UI checks mock native IPC; actual
GTK media evidence is recorded in the owning plugin and desktop repositories.

The Linux plugin was also exercised through both actual native GTK surfaces
against an authorized real-provider VOD: decoded frames, a seek to 30 seconds,
pause/resume, paused Fit/Fill, muted volume and continued playback. Alternate
audio, rendered subtitle switching and subtitle removal use a silent generated
fixture with both engines. JPG/GIF/PNG-prefixed HLS has separate actual-engine
coverage. No Windows/macOS or physical TV qualification is claimed.

# Native error classification and dismissal — 2026-10-03

Video `bf296cfacbde25c354acb51e609787661fda2727` stops polling, layout observation and startup
watchdogs after a terminal failure. Delayed stats cannot revive that failed
session; opening a new source starts polling again. Generic pipeline failures
(including misleading legacy plugin messages) no longer claim that the source
cannot be decoded or trigger format conversion. Only explicit decoder/media
format errors use that classification. The native plugin separately classifies
video/audio output, protected media, source loading and runtime failures.

React reports an unresolved playback error once per player session, code and
message. Dismissing it therefore remains effective across repeated engine
events. A new playback attempt or a different failure can still report an error;
a disposed engine cannot publish delayed recovery failures into the current UI.

38 focused Video adapter/compositor checks pass, including the former 13-error
poll loop and late startup stats. Nine focused UI/recovery checks pass, including
dismissal replay, new-session reporting, disposal, actual error-toast composition
and native control rendering. The owning plugin has 45 ordinary passing checks;
both actual GTK engines also report a missing source accurately and subsequently
play valid silent media in the same engine. Real-provider controls on the local
desktop display pass for both engines. These native checks do not establish that
every configured provider endpoint is working or qualify Windows/macOS.

# Responsive native volume dragging — 2026-10-03

Video `9429307450cd7e7d856f57f14272acb9e4566113` publishes the requested volume immediately,
allows only one native volume command in flight, and sends the latest pending
value when that command settles. Intermediate drag samples do not accumulate
in GTK's command queue. Acknowledgements do not republish unchanged UI state
or replace current playback facts. Mute changes join the same update path;
retired-source responses cannot affect or block the current source slider.

The regression sent 100 simultaneous changes while native IPC was held. Before
the fix it queued 100 commands; afterward it sends the first and latest values
in two commands. All 41 focused adapter/compositor checks pass, including mute
and source-replacement cases. The actual React player test drags through 26
values with pending native IPC, checks the immediately rendered input/knob, and
verifies that only the first and final native commands are sent. These tests
control the native IPC boundary; they do not measure audio-device latency.

# Desktop pointer playback, sources and scroll corrections — 2026-10-03

The owner-approved pointer-only desktop contract is imported from design
`f879e1520c3e4c7574e04a7a00c6435c404b77eb`. Native desktop shortcuts, Tab, spatial
navigation, arrival focus and source keyboard legends are disabled. Clicked
text fields stay editable. Player backdrop clicks reveal controls without
hiding them; skip icons use explicit vectors and larger integer sizes.

Skip clicks accumulate from the latest requested target and coalesce pending
work. Backward targets remain pinned through the old clock and transient zero;
seek completion, duration and buffering use engine observations. New desktop
source selection stops the outgoing presentation before backend preparation,
with saved-position rollback on failure. Unknown track languages use numbered
labels; actual titles remain intact. Both add-on and IPTV producers appear in
All, including zero-result/error producers. Available configured logos are
shown, with named monograms when absent. Source rows have a smooth 16px radius
and a 3px best-match border, and are protected from native aperture masking.

Home scroll reads are bounded to animation frames. Offscreen shelves use CSS
content visibility where supported, and ambient artwork has a separate paint
layer. A trusted local HTTPS Chromium test with synthetic populated catalogs
measured 49 scroll frames, p95 16.8ms and one 50.1ms maximum frame; content
visibility was active. This is browser evidence, not a measured GTK/WebKit FPS
guarantee. A visual source-drawer check confirmed two source rows including
IPTV, loaded provider artwork, 16px corners, 3px border, no keyboard hints and
Tab remaining on BODY. Private captures stay outside Git.

77 focused Video adapter/controller/compositor checks pass. 29 targeted UI
checks pass, including accumulation during a zero clock, backward pinning,
IPTV grouping, pointer-only input and the existing native controls. Strict
application/test type checks pass. The native plugin has 45 ordinary passing
checks; real-provider seek/pause/resume and genuine buffered-time readouts pass
on both actual GTK engines. Separate silent media verifies tracks/subtitle
pixels and paused picture controls. Real-display occlusion prevented an initial
standalone MPV frame check; the isolated X11 display removes that artifact.
# Shared native protocol core adoption — 2026-10-07

Adopted core `28e114949a5bef205ca0aa125d7f6fd2851b6c25` with its matching
generated TypeScript/runtime/WASM snapshot. Android adopts the same immutable
core revision. The core design pin is `83d338b6ffc1fc5e7f14ad4059f6159b8ee84509`;
the existing TV-web visual contract remains unchanged.

Core/source snapshot integrity, design/video integrity, application/test
typechecks, all 285 tests in 55 files with one Vitest fork, and the production
build passed. Core's separate native/actual-WASM suite passed 414 native grant,
clock, capability, recovery and privacy vectors plus the existing protocol and
presentation checks. TV-web's request path continues to omit native capability.

This adoption adds no peer transport, UI controls, deployment, browser device
session or physical TV qualification. Android native artifact/control/player
integration and native capability activation remain separate tickets. Local
check logs are retained under `target/native-torrent-05/` in the core checkout.
# Source failure diagnostic core adoption — 2026-10-07

Core `ed83a0b9f24c6431f6ccca7c9426cb1da7f53ba5` adds closed native startup
stage/network explanations with visible diagnostic codes. Android and TV-web
adopt the same immutable core. An isolated checkout of tracked main plus this
core import passes typechecking, 285 tests with the required single fork, and the
production build/integrity checks. An initial parallel run timed out in a guide
test; the complete single-fork rerun passes. This record excludes unrelated local
design reorganization edits and makes no Android/public-swarm/device claim.
# Native rolling-file validation — 2026-10-07

Core `df62d8a893bbfbd8c2cd471b07c40efa6a78a4aa` validates exact file lengths
independently of rolling-cache capacity. Files above 2 GiB are eligible while
hash/index/expected-size checks and authority invalidation remain enforced.
The matching core passes 473 native/actual-WASM native-torrent vectors.

An isolated checkout with the tracked design snapshot passes typecheck,
285 single-fork tests and the production build. Canonical checkout owner edits
to design documentation remain separate. This is shared-rule/import evidence,
not browser torrent execution, physical TV or decoder qualification.
# Exact source identity deduplication core adoption — 2026-10-08

Core `af88a4895773af526661aa78356a655b94ec399a` deduplicates opaque source
handles and exact nonempty addon/fingerprint identities in linear time. First
handle/order, separate providers and unknown identities remain distinct. The
core's native and actual-WASM discovery vectors pass. This worktree passes
core integrity, nine targeted session/presentation/producer tests and the
production build including type checking. No browser/device playback or
deployment is claimed. Android adopts the same revision on its matching branch.

# Runtime v2 core adoption — 2026-10-09

Core `b6606cadeea60a19fac9c91f788acb5c12d87308` provides the private v2
holder, nullable selection, discovery hints, stable resolved media identity and
renewal/clock checks. The shared v2 retry decision never requests gateway
fallback. Android adopts the same source and generated native bindings.

All 291 tests pass with one fork, and the production build including hash and
type checks passes. Hosted clients still use gateway delivery; importing the
bridge does not activate peer networking in web/TV clients. Desktop worker
adoption, browser playback and device qualification remain separate work.

Runtime negotiation follow-up: core
`d1787f3910306822d68192a5d3c45f980a665234` requires an explicitly advertised
v2 capability; an empty support list stays unavailable. Native and actual-WASM
regressions and the complete core suite pass. The consumer's production build,
hash checks and type checks pass. Android adopts this same revision.

# Desktop shared-runtime integration — 2026-10-09

The Tauri entry injects a native runtime port; hosted web/TV entries do not.
Desktop uses separate v2 negotiation and raw bounded grant bytes, preserving
tracker hints and optional file/archive selection through the actual WASM holder.
The resulting player session contains a loopback media capability, without its
private grant or source descriptor. A 120-second native-clock budget spans worker
availability, control, acquisition and native player opening. Rendered-frame
counters acknowledge the first frame; factual stages use the existing status line.

The worker and backend authority renew during preparation. Native decoder or
archive failures preserve native delivery instead of starting gateway conversion.
Profile/principal changes retire current access; accepted sign-out clears content.
Cancellation closes a late returned handle. Repeated frame observations share one
acknowledgement. The native clock includes system suspension.

All 297 tests pass with one fork; type checking, pinned design/core/video checks
and the production build pass. Six new transport cases exercise actual WASM
validation, auto selection and large-file descriptors, archive refusal, late
cancellation, frame acknowledgement and cache clearing. Native Linux/Windows
shell packaging and decoded public-source evidence are recorded in desktop;
these browser tests do not establish hardware or production qualification.

## Torrent-runtime gateway integration, 2026-10-09

The production `Html5FallbackAdapter` was bundled from the pinned Video source
and decoded real authenticated gateway HLS over trusted local HTTPS in Chrome.
Mediabunny presented actual canvas frames and advanced the VOD clock from zero.
A gateway output replacement at 120 seconds also rendered destination frames
(absolute clock 120.114 seconds), taking 27.1 seconds for request/preparation and
player replacement in the successful observation. Native HLS/MSE decoded the
same source independently. Viewer release immediately refused the media URL.

These are direct gateway/player integration checks using a disposable key and
private test page. Backend account/discovery screens and a physical TV/Roku were
not exercised. An earlier seek creation failed and remains in the performance
ledger; one later successful trial does not qualify every swarm. Source URLs,
credentials and raw captures stay private. See the gateway's
`docs/GATEWAY_TORRENT_RUNTIME.md` and `docs/TORRENT_PERFORMANCE_FOLLOWUP.md`.

The subsequent ephemeral full-backend run includes profile/vault validation,
registered add-on source discovery, production `TvApi`/Rust-WASM normalization
and `PlaybackSessionController`. It presented real frames after measured
Finding peers → Fetching metadata → Buffering transitions; controller/backend
stop revoked the media URL immediately. Gateway stage tests cover deduplication
and keep startup/authority deadlines independent. Current web suite: 300 tests
and production build pass. The test page wrapped production API/controller code;
ordinary account/catalog screens were not driven in this media probe.

Pending cancellation was also exercised through the real backend/gateway and
production browser controller before metadata/first frame. Stop restored all
owned gateway input/output slots, and scoped cancellation tombstones prevent a
late create from starting again. This is a synthetic unavailable source fixture
for lifecycle qualification, separate from the real-media frame/seek trials.

### Decoder acknowledgement, 2026-10-09

The viewing client adopts core `0f3d9f7` and video `b391571`. Gateway starts use
the separate decoder-aware backend route; their first measured frame triggers a
coalesced, bounded control acknowledgement. Native sessions keep reporting to
their local worker. Metadata readiness cannot acknowledge a frame. Replacement
and Stop fence late acknowledgement failures, and acknowledgements never renew
leases or follow the media URL.

The complete unit suite passes 302 tests; type checking and production packaging
pass. Five trusted-HTTPS remote-player UI tests pass, including holding frame
evidence at zero after metadata readiness and then acknowledging once after it
advances. An actual backend/Go/Mediabunny browser run presented six frames,
accepted its decoder acknowledgement and revoked media with 401 on Stop.
Admission/player opening took 17.85 s in that one observation. This is browser
and controlled boundary evidence, not a physical TV or comparative-speed claim.
# Shared core and hosted-TV navigation merge — 2026-10-09

Core `aae69de27d69f87f79ce513e47a78985cede4a39` combines exact-source
deduplication, bounded request/render scheduling, preview expiry, playable-source
ranking and explicit native Retry. The regenerated WASM and TypeScript snapshot
is adopted together with design `01abe2ea695ae2041742056de756e11d7d191eb5`.
The incoming hosted-TV history-Back guard and playback acceptance updates remain.

All typecheck groups, 291 unit/integration tests with one worker, production build
and core/design/video snapshot checks pass. The trusted-HTTPS Playwright config
includes the four Vizio black-screen/Back regressions and their hosted `/tv/`
entry. Listing these alongside responsive corrections discovers 13 scenarios.
Browser execution is not qualified for this merge: the owner's private local
HTTPS tooling is absent on this checkout and its documented hostname does not
resolve. No physical-TV, installed desktop or production deployment claim follows.

# TV-only hosting distribution — 2026-11-03

Issue viptv-org/tv-web#39. The hosted `/tv/` ZIP that every Tizen, webOS and
Vizio launcher loads now carries the TV entry's reachable set instead of all of
`dist`. `dist` itself is unchanged and still serves the browser/desktop entry,
including React, MediaBunny, id3, the Core WASM and `main-lwlrW-3E.css`.

Reachability is derived from the production build's own Rollup bundle, not from a
list of chunk names. The `viptv-remote-boundary` plugin roots at
`src/bootstrap.ts` (the document `/tv/` serves) and `src/tv-solid/main.ts` (the
`solid.html`/`lightning.html` entries), follows static imports, dynamic imports
and each chunk's Vite `importedCss`/`importedAssets`, and stops only at branches
a TV cannot execute: the React entry (`/src/main.tsx`) and the Tauri bridge
(`@tauri-apps/*`). It writes `artifacts/tv-assets.json`; `scripts/package-tv.mjs`
copies exactly that set and then re-resolves every `import()`, static import,
preload array entry, HTML `src`/`href`, CSS `url()` and runtime `/tv/assets/...`
literal in the staged package.

Measured on `ca5cca1` with Node 26.11.1 and Vite 6.1.0:

| Hosting ZIP | Before | After |
| --- | --- | --- |
| Files (excluding ZIP metadata) | 948 | 42 (41 TV files + `HOSTING.txt`) |
| Uncompressed | 14,734,841 B | 1,793,160 B |
| ZIP (`viptv-tv-hosting-0.1.0-*.zip`) | 8,127,652 B | 1,000,817 B |

What still ships: `index.html`, `solid.html`, `lightning.html`; `app-CsKIUMe0.js`
(bootstrap), `main-CMyV41DE.js` (TV entry), `App-Hu8eHReS.js`,
`preload-helper-CtxONCfg.js`, `viptv-tokens.generated-BTSuEl6Y.js` (video/core
contract), `viptv-tokens-dvPV1MV5.css`, `host-C3m1tLMs.css`; the lazy
`hls-engine-Rkos_9_K.js` and `vizio-html5-vfz0k7at.js` (which contains hls.js),
the lazy `browser-BgJBWLyt.js` QR encoder; 7 WOFF2 faces; 20 entry-art images;
and `assets/photography/live-empty-wide.webp`, which the emitted TV code names at
runtime and cannot be discovered as an import. The ZIP carries the revision in
`HOSTING.txt`, so its byte count moves by a byte between commits.

Lazy-chunk proof, resolved from the staged package against
`artifacts/tv-assets.json` (`missing: 0`):

- `assets/App-Hu8eHReS.js -> ./hls-engine-Rkos_9_K.js` SHIPPED
- `assets/App-Hu8eHReS.js -> ./browser-BgJBWLyt.js` SHIPPED
- `assets/main-CMyV41DE.js -> ./App-Hu8eHReS.js` SHIPPED
- `assets/app-CsKIUMe0.js -> ./main-CMyV41DE.js` SHIPPED
- `assets/app-CsKIUMe0.js -> ./main-vXVEbQFB.js` declared non-TV (React branch,
  selected only when the platform query is not tizen/webos/vizio)
- `assets/vizio-html5-vfz0k7at.js -> ./index-Dz6ixlBL.js` declared non-TV (Tauri
  HTTP bridge, guarded by `'__TAURI_INTERNALS__' in window`)

Seven references resolve only into those two declared branches; every other
reference in the package resolves to a packaged file.

Validation: `node scripts/typecheck.mjs`, 420 unit/integration tests in 65 files
with `--pool=forks --poolOptions.forks.singleFork`, `npm run build` (design,
core and video hash checks included) and `npm run package:tv` all pass. New unit
coverage in `tests/build/remote-boundary.test.ts` and
`tests/build/tv-package-check.test.ts`. Unexecuted: no physical TV install or
playback; `ares-package` and the Tizen CLI are absent on this host, so the
launcher IPK/WGT were not rebuilt locally (their launcher-only code path is
unchanged; `.github/workflows/build.yml` builds both on main). The ZIP was not
deployed and `/tv/` was not exercised against the backend.

# SolidTV Live empty-state arrival — LIVE-EMPTY-13

`tests/remote/live-empty-arrival.spec.ts` verifies both no-source and no-channels
with initial focus on the Live navigation tab or the owner's empty-page action.
A changed server revision delivers three channels without navigation; focus lands
on channel 0 and Down reaches channel 1. With reduced motion disabled, every
observed arrival frame keeps the first channel row at x 96, y 636, opacity 1,
without a loading frame or a change of screen.

Validation: all TypeScript groups, 420 unit/integration tests in 65 files using a
single fork, `npm run build` including pinned design/core/video integrity checks,
and four targeted Chromium browser cases passed. Browser runs used an isolated
production distribution over localhost HTTPS, with Chromium trusting only the
temporary fixture certificate's SPKI. The test advances the 15-second revision
poll using the browser clock; it does not invoke application refresh functions.

No physical Tizen, Vizio or webOS device, real provider, or deployed environment
was exercised. This evidence covers the SolidTV browser renderer and mocked
backend HTTP boundary.

# SolidTV channel-page failure ownership

Live and Search keep remote focus on retained channels when a failed prefetch
would evict the page the viewer reversed into. Authentication refusals retain
their session handling. A displayed page error retries its failed direction
before channel playback; acceptance waits for that displayed action.

All TypeScript groups, pinned design/core/video integrity checks, the production
build, and 420 unit/integration tests in 65 files pass on the combined main
checkout. Thirteen scoped Chromium cases pass over isolated localhost HTTPS
with mocked backend HTTP: reverse prefetch disposal and retries on both screens,
revision refresh, four short-page timeout/retry scenarios, all 200 Live groups,
bounded guide snapshots, and the complete Search seven-page roundtrip.

Search verifies all 480 directional inputs from channel 0 to 240 and back,
fixture playback and return focus, bounded payloads and exact server requests
in 71.7 seconds. Live's seven-page roundtrip remains partially qualified on this
software WebGL host: all 240 forward inputs, fixture playback, return focus and
170 reverse inputs pass; the 180-second overall deadline ends the run after
410 of 480 verified inputs at channel 70. The final return to channel 0 and
complete request-order assertion are unverified for that Live run. The overall
allowance is a host test budget, not an input-latency requirement.

Reference-image parity is unmeasured. No physical Tizen, Vizio or webOS device,
real provider, or deployment is qualified by these browser fixtures.

# Shared Roku/browser playback and rendering sweep

Validation on `feature/roku-tv-web`: all grouped TypeScript checks, 138 unit tests
in 17 files using a single fork, pinned design/core/video integrity checks, the
production browser build and the native Roku build pass. Roku output was built
locally without console stripping, source maps or the SDK's separate typecheck.
The final package was sideloaded successfully; no hosted deployment was made.

Four controller regressions cover playing/paused seek intent, selected tracks,
direct mode, outgoing lease retention on failed replacement, fresh replacement
identity, admission cancellation and late-lease release. Chromium acceptance
covers 29 scenarios across pairing, playback authority, Search and Settings:
28 passed together, and the remaining Live explicit-selection case passed its
focused rerun after selecting the non-best row explicitly. This is combined
passing evidence, not a single clean 29-case run. Two wider Search scenarios
(pending-query navigation and channel-only pagination) failed exploration and
remain outside this passing set. The older Live empty/arrival fixtures still
use fixed navigation indices; their exploratory failures are not a clean gate.
Playback and Settings acceptance now locate navigation destinations by identity.

Browser checks include paused/playing media-key seeks with repeat suppression,
replacement failure retaining playback behind the picker, stale authorization
fences, track controls, server pause/seek refusals, Settings before loading any
sources, display preference writes, calibration, late-save focus and screen saver
wake behavior. Beta-backed Chromium smoke separately reached Home, catalogues,
Search, Live, My List, profiles, detail, sources and Settings. Real HLS decoded
at 1920×1080 with advancing media time; the traversal reported no page errors.
Calendar navigation was reached, but populated content and day-change layout
were not qualified during that smoke.

Physical Roku evidence is limited to the TCL 50S435/C157X on Roku OS 16.0.4:
beta pairing/profile selection, Home artwork and labels, source selection,
detail loading copy, Live guide rendering, Settings entry and tab changes.
Private captures verify square surfaces and restored hero artwork/gradient
visibility. Full-screen opaque page grounds are omitted from the scrim layer;
translucent fills remain above backdrop/video, and modal fills keep their layer.
Real HLS playback telemetry advanced, paused, and resumed after a paused FF seek;
a playing FF seek also completed. Gateway-window clocks are distinct from the
title clock shown by the app. Playback was stopped after the smoke.

Hardware video-plane screenshots cannot qualify the picture or scrim darkness.
Native Skip Intro/Recap, buffering-triggered auto-hide, forced error-card recovery,
idle screen saver composition, populated Calendar spacing and matched Android
background/reference-image measurements remain unverified. Browser fixture
success is not hardware qualification for Roku, Tizen, Vizio or webOS. No device
addresses, credentials or private captures are included in the repository.

# Roku performance regressions

`npm test` includes 159 application/unit cases and two native visual-ownership
cases. New regressions cover deadline pacing under injected work, pause/restart,
CSS easing, one Poster/URI per image, real versus stale image readiness, opaque
SDK handles, original-size packaged masks, dirty-subtree and shallow group
updates, relative opacity, budget continuation, proxy resizing and bounded
readiness-gated artwork swaps. Both native host typechecks/builds and the shared
production browser build pass; the demo host's 78 native tests and offline web
build pass. Final focused Chromium playback/menu/saver checks pass (five cases).

Private Roku captures were inspected after beta pairing, Home artwork loading,
row navigation and source-picker opening/cancellation. Real native dimensions
are observed explicitly because SDK node handles do not mirror assigned fields.
A final hardware trace reports render+swap p95 22.04 ms over 758 samples: the
60 Hz render-work budget remains unmet. PERFORMANCE.md records methods and
limitations. Browser and deterministic timing probes do not certify device FPS.

# Roku playback and source qualification — 2026-11-07

The final local gate passes TypeScript, 176 shared tests and 12 native-host tests,
the production browser build and the native Roku package build. Native-host
coverage includes decoder startup rejection, stale native callbacks, muted
paused startup, caption-mode restoration and short HLS time units. Downloaded
segments use the measured JS SDK `segStartTime` field in milliseconds, including
string-valued segment durations; no buffer duration is inferred from a fill
percentage. Read-only native timing statistics contain no URLs or credentials.

The shared player now exposes server-authorized audio/subtitle selection even
when the native adapter cannot switch original input tracks itself. The server
replaces the delivery, retaining the title position and paused intent. Native
WebVTT selection, caption styling and per-playback caption-mode restoration use
SceneGraph effects. The native size picker offers the three supported sizes.
Track labels identify languages before technical codec descriptions; selected
rows use the packaged check icon. Controls retain square geometry. The timeline
has distinct played/downloaded regions, a seek handle and a time-only draft
preview; no unavailable thumbnail is fabricated. Modal paint scopes keep
late-created backgrounds below their own labels and later errors above the
preceding modal. Physical captures verify restored source-picker headings and
filter text, the control layout and a visible downloaded band.

Beta gateway qualification is separate from frontend publication. The managed
beta service runs playback-gateway commit
`af98cb49cf8fe78254c1ffece5285f362a100314`. Its workspace gate passes 282 tests
(62 opt-in cases ignored), plus the explicitly executed real FFmpeg 9 fixture
for disguised fragmented MP4 and an authenticated opaque playlist URL. The beta
test account now uses the beta gateway; its old production connection remains
disabled for rollback. Beta disables original gateway passthrough so compatible
media is copied/remuxed into standard HLS, with transcoding only when needed.
An isolated actual-source test reports video/audio copy and successfully decodes
both. Production container identities, images, environment and mounts were
compared with the pre-change snapshot and remain unchanged. Deployment status,
log and beta health were checked after the managed update.

Source results are deliberately narrower than whole-title playback claims:

- Loki S1 E1: all 12 VIPTV Sources results were tried in gateway/direct modes.
  Six CineWave files returned original ranged media and valid gateway HLS.
  The image-named CineWave HLS manifests contain real fragmented MP4. The 1080p
  source intermittently returned 404 for an early segment; the 720p source
  returned 404 at segment 45 (3:00), and 40 of the first 90 segments failed a
  prefix scan. Selected failures persisted during a slower no-cache retry.
  Raw image-named HLS played video without audio on Roku and later failed.
  These results do not establish reliable continuity for those returned URLs.
- MobLand S1 E1 and Tulsa King S1 E1: both CineWave HLS qualities returned valid
  segment prefixes at indices 0, 5, 15, 45, 75 and 120, covering sampled points
  through about eight minutes for MobLand and 20 minutes for Tulsa King. Gateway output starts as standard MPEG-TS HLS. A
  CineWave original file for MobLand also passed ranged/gateway checks.
- Obsession, selected from beta's current Popular Movies catalogue: a CineWave
  file passed ranged/gateway checks; among three additional CineWave HLS results,
  one starts through the gateway and two still fail. Their source/extractor
  failure is unresolved; they are not counted as decoder or whole-title passes.
- VixSrc: fresh results start through the gateway for all three comparison
  titles. Direct requests requiring headers/audio selection also use gateway
  delivery. Earlier expired discovery IDs were re-resolved and excluded from
  playback-failure conclusions. One CineJoy result on Loki now starts through
  the protected-HLS path; another CineJoy result and FrameX remain unavailable.

Physical qualification uses the TCL 50S435/C157X on Roku OS 16.0.4. Nocturne's
CineWave HLS gateway delivery remained active for over 30 minutes with AAC audio
and observed position advancement; the
owner confirmed audible sound. Loki's CineWave AVC file was separately used for
real track tests. An audio replacement while paused now produces native Pause
with recognized H.264/AAC, rather than a closed decoder. Selecting the English
text track produces native WebVTT; paused selection and resumed playback were
observed. The final owner confirmation of subtitle visibility and audio sync
is recorded below.
Hardware video-plane screenshots cannot qualify the picture or caption text.
The SDK loader/inspector stalled during diagnostics, including with the prior
working package; a device restart recovered launch. This is recorded separately
from app regression coverage.

The six focused Chromium playback-authority cases pass for track focus/style,
Live track observations, retained replacement intent, paused/playing media seeks
and denied VOD controls. Two source-hint fixture failures reproduce at the
preceding performance commit and remain separate. This is not a clean full
Playwright run or complete device parity. Native Intro/Recap, buffering-triggered
auto-hide, populated Calendar spacing and matched Android background metrics
remain unqualified. The prior native render+swap p95 was 22.04 ms over 758
samples; sustained 60 FPS is not certified by this work.

A later owner retry exposed two further gateway issues. Healthy viewer renewals
did not prevent the old output being retired by its cache watchdog: caption
files accumulated after watched AV files were reclaimed. Caption prefix cleanup
now uses the caption playlist's own timeline and the same consumed-time grace.
A simulated 20-minute AV/VTT filesystem regression stays under the unchanged
watchdog. The owner also reported an audio delay and errors when choosing
subtitles. An API-only rapid track reproduction returned `input_capacity`
because released jobs remained reserved for the 15-second reuse window. The
gateway now reclaims fully released owned jobs under admission pressure, retaining
quota until physical teardown. Confirming an already-selected client track is
a no-op and never restarts the decoder.

An actual-source decoded-content comparison measured about 0.8 seconds of picture
shift after seeking with QSV H.264 decoding, although packet timestamps looked
aligned. Selected English audio matched within 20 ms. Software H.264 decoding
with QSV encoding removed the measured picture shift. Resumed H.264 transcodes
use that hybrid path, with additional CPU decoding work; copy/remux and initial
playback retain their paths. These API/media measurements do not establish
physical TV lip-sync or visible subtitles. The TV was left alone after the owner
requested API qualification before further hardware testing.

Two isolated candidate rounds of five immediate actual-source track changes all
return 201/ready under the original two-input quota. The final resumed SDH
output's decoded eight-second prefix matches source picture content at the
sampled frames (100 ms grid); English audio content differs by about 20 ms.

The isolated accelerated caption-cache test also passes after consuming 600.14
seconds of Loki media: 300 AV segments, 179 current-caption checks and nonempty
WebVTT cues, with the session still ready. It takes 42.84 wall seconds; this is
ten minutes of media consumption, not physical viewing time. The original cache
watchdog remains enabled. Test viewer leases and temporary keys return 204 on
cleanup.

The managed beta deployment of that qualified revision completes with `done`
status and HTTP 200 health. Its image/environment/mounts match the intended
beta-only update; production container identities, images and configuration
remain unchanged. A public beta TV-API run then passes five successive actual
track selections (202 → ready), including successful English and SDH WebVTT
cue retrieval and Off. One earlier harness request incorrectly combined a
replacement observation with a nonzero top-level position; the server correctly
rejected it. The corrected harness follows the shipped client's position=0
replacement contract. Final test leases are released.

After public API qualification, the final client package was sideloaded and
paired against beta again. Loki S1 E1's CineWave AVC file starts, and selecting
the normal English subtitle track returns to unobstructed playing state. Roku
telemetry reports H.264, AAC and WebVTT, no error and advancing position. The
owner confirms that dialogue captions are visible and audio is in sync on this
final playback. A further long physical caption run remains unqualified. The SDK's
sideload build bump is ephemeral and produces no tracked version-file change.
The isolated candidate is stopped and the temporary diagnostic key is revoked;
the account's scoped beta integration remains active.

# Browser playback and platform boundaries — 2026-11-08

The video library now owns the subtitle/AVPlay corrections, adopted through
VIDEO_REF and the immutable vendor lock. The HTML adapter applies server-selected
output subtitles, explicit Off and late native text-track discovery. It waits
until hls.js completes its default-track event before applying the selection.
A native HLS MIME hint is insufficient evidence of subtitle support: if the
requested rendition never appears, the adapter retries the same URL once with
MSE, retaining position and paused intent. A native HLS attempt that never
reaches metadata is bounded as well. No source/provider selection or network
policy is bypassed.

Samsung effects recognize `track_lang`, select native output track indices,
wait for PLAYING/PAUSED before HLS TEXT selection and avoid duplicate Play/Pause
calls after preparation. Paused intent survives buffering callbacks. The shared
host creates the AVPlay object beneath the canvas and can load the system SDK
in a packaged file context. Hosted Tizen pages retain the HTML path; Samsung
explicitly excludes Tizen APIs from hosted applications. The current HTTPS
redirect launcher is not a complete native AVPlay package. Local assets,
authenticated API transport, signing and device acceptance remain required;
see platform/tizen/README.md. Browser decoder probes do not qualify AVPlay.

The deferred browser engine now fences stopped, superseded and disposed opens
while its chunk is still loading. Tests verify that a late engine cannot start
retired media or publish into a disposed view.

The new full-app browser cases use the repository's real synthetic H.264/AAC
transport-stream fixture plus a WebVTT rendition with DEFAULT/AUTOSELECT off.
They assert decoded dimensions/frames, active visible-mode caption cues,
pause/resume and stopped media cleanup for web, webOS, Vizio and hosted-Tizen
queries. Separate injected-AVPlay cases assert its surface, output-track index,
state legality and paused subtitle replacement; those are SDK simulation, not
native Samsung video decoding. Browser controls are exercised after the source
drawer closes and the app reports ready.

Actual beta-provider checks are separate from API fixtures. Loki S1 E1's CineWave
AVC file and MobLand S1 E1's CineWave HLS gateway delivery both pass in Chromium,
Firefox and WebKit: decoded frames, nonzero decoded PCM samples, pause, a seek
inside the exposed seekable window while paused, resume and Stop. Loki also
presents English WebVTT and honors Off. The WebKit motion probe observes 14 frame
callbacks with advancing presentation time. All six test leases are released.
These short runs do not establish whole-title continuity. An original raw
MobLand Direct Play URL still times out; gateway success is not counted as an
original direct-play pass. A request carrying explicit subtitle Off uses gateway
delivery and is recorded separately from that raw direct test.

Firefox runs with an isolated software-GL display; WebKit uses isolated runtime
libraries and TLS modules. An isolated null audio sink supports PCM measurements.
No global packages, production services or browser CORS policy were changed.
Public beta media uses normal TLS verification; local fixture TLS is test-only.
A private browser capture confirms that the picture, caption and canvas controls
are composed visibly. No source URLs, tokens, device addresses or captures are
included here. The Roku package is rebuilt, without interrupting its confirmed
TV playback. Physical Vizio testing was set aside at the owner's request.
Samsung/LG emulator or simulator results, codec/DRM parity and physical TV
qualification are not claimed. The earlier native 60 FPS budget remains
unqualified; this browser work does not replace that device measurement.

A further legacy-engine regression removes Array.at and Object.fromEntries
before app startup. The previous production bundle fails that case. Lightweight
ES2017-compatible helpers now load before the renderer and app; existing host
implementations remain unchanged. Object.fromEntries defines own data properties
for untrusted keys, including __proto__, and retains symbol/duplicate-key
semantics. Dedicated checks cover the prototype boundary and array-index
semantics. This targets known API gaps, not a claim to emulate a whole firmware.
[LG documents Chromium 87 for webOS TV 22](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine);
[Samsung documents Chromium M69 for Tizen 5.5](https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html).
Full engine/firmware acceptance remains separate.

Final delivery gate: video-library typecheck/build and 183 single-fork cases
pass; tv-web typecheck, 182 shared plus 12 native-host cases, browser build and
Roku package build pass. The final immutable video source is
`f89e094ef5974a34aa803f93f96cc611607f7e1e`. The full-app matrix passes 18 cases
across Chromium, Firefox and WebKit: five real-media profiles (including the
legacy-API profile) and one injected SDK-boundary case per browser. Six existing
Chromium playback-authority checks also pass, for 24 targeted browser cases.
This is not a clean run of the entire remote suite; previously documented
source-hint baseline failures remain separate. No hosted frontend deployment,
Samsung/LG emulator execution, native Tizen release or physical TV qualification
is included in this delivery.

## TV polish implementation checkpoint (2026-11-09)

Tracked by tv-web #103 and backend #308. This checkpoint implements coordinated
hero fades, stable bounded Home rails, native clipping and logo geometry,
compact dialogs, a shared player busy indicator, welcome/profile spacing,
Specials and the compact season chooser, and physical-size image delivery.
Backend implementation 2fcdc54 adds shared persistent public Cinemeta metadata
and bounded prepared clearlogos; default/live-runtime suites pass 936/948 tests
and the engine pin check passes. Production is unchanged.

Client typecheck, 238 shared unit tests, 15 native-host tests, production browser
build and native Roku build pass. The current native payload is 711721 JS bytes.
The twelve focused browser artwork/season/motion scenarios pass, including
coordinated loads, stale refreshes, cancellation, normal/reduced static artwork,
explicit Specials and intermediate horizontal/vertical group positions. These
animation checks use controlled browser time; physical frame timing is separate.

The older viewing suite has thirteen failures reproduced against the served beta
baseline, primarily stale navigation assumptions, plus a three-second lease
fixture race. The fixture now rounds its short expiry upward so the one-second
renewal has a real scheduling margin; expiry/release assertions remain intact.
The baseline failure list remains separate from the new acceptance scenarios.
The test renderer inspection now respects ancestor opacity instead of counting
hidden prepared nodes as painted content.

Physical Roku final-package acceptance, real-beta shared-cache/clearlogo checks,
repeated frame traces and the final account handoff remain pending at this
implementation checkpoint. Normal exit/relaunch and the preceding cold update
retained sign-in. The owner confirmed audible, synchronized audio during the
preceding real playback checkpoint; final media telemetry is recorded separately.

Native follow-up: empty layout containers no longer allocate transparent painted
rectangles, and animation ticks do not queue a redundant immediate flush. Host
coverage is now 18 tests (256 unit tests total). On the same Home row state,
transparent rectangles fell from 71 to 9; posters and labels remained 33/42.
The three fixed 32-key navigation traces after this change report render+swap
p95 of 22.04/21.89/21.83 ms. The unchanged 16.67 ms qualification gate fails;
these results do not establish 60 FPS. The first trace includes more initial
work; subsequent traces are warm. Earlier system-Home and minimal native-scene
diagnostics on this device reported approximately 48 FPS as well. This is an
observed environment result, not a universal hardware limit. Compositor and SDK scheduling work remain required under the Roku-first
performance scope.


## Roku-first performance investigation

Physical Home navigation still has severe JavaScript stalls. A 16 ms timer probe
observed a maximum gap of 1,281 ms during vertical input; its overall p95 was
19.5 ms, illustrating why averages do not qualify motion. A separate Hermes CPU
profile recorded 6,227 samples, including 3,651 under the key-event callback.
Repeated ancestor-coordinate/direction reads, node construction and young-generation
collection appear in the profile. This is CPU evidence, not presented-frame data.

The native coordinate getter now walks ancestors once, including mixed inherited
RTL overrides and mounts. The regression's 12-level RTL tree previously required
10,236 width reads per lookup; the bound is now 24. Native tests cover all 27
three-level direction combinations, geometry updates, reparenting and deep LTR/RTL.
The same change and tests are applied in the SolidTV demo native host.

Validation: application typecheck, native package build, 22 VIPTV native tests and
6 SolidTV native-node tests pass. The candidate was cold-installed on the physical
Roku, starts signed in and renders Home after repeated vertical navigation.
A ten-key Down/Up comparison from relaunched Home measured timer p95/max of
70.24/693.73 ms for the preceding package and 71.49/714.36 ms for the candidate.
These single exploratory runs show no meaningful Home-scroll improvement; the
scaling fix does not establish performance acceptance. Visible intermediate-frame
cadence, blur, render-thread animation and bounded node reuse remain unqualified.
No beta server rollout or new playback qualification is included in this check.

The SDK testing library can execute TypeScript components against an in-memory
SceneGraph under Jest without a Roku. Existing native-adapter tests mock the SDK
boundary; neither approach emulates Hermes scheduling or the physical compositor.


## Bounded Home shelf reuse

Home keeps three reusable shelf slots and at most twelve card slots per shelf.
One parent owns vertical translation; recycled rows change their local position
without animating across the viewport. Derived selection, dimensions and offsets
use equality-filtered memos. The full bounded card window remains mounted so a
slot is available when its index wraps; this avoids retiring it just before reuse.
Native moving groups insert visuals in logical tree order, retaining backgrounds
below posters and overlays above them, independently of the order of adoption.

Validation: application typecheck, browser production build and native package
build pass; 242 shared unit tests and 22 native tests pass. All seven polish browser
cases pass, including intermediate scrolling, the fixed focus anchor, prepared
logos, seven-row vertical reversal and horizontal scrolling through a card-slot
cycle. The reuse test rotates artwork as identities change and asserts both the
same node IDs and the correct visible replacement image.

The physical Roku candidate renders poster images above their backgrounds after
vertical recycling. An initial shared-layer prototype exposed incorrect paint
order; that candidate was replaced and the corrected rendering inspected on the
device. The ten-key timer probe reports p95 64.29 ms, maximum 795.02 ms and seven
gaps over 100 ms. These exploratory runs do not prove improved worst-case latency
or smooth presentation. A subsequent Hermes profile still shows ancestor position
and clipping work prominently. Render-thread animation, rapid-input latency and
physical intermediate-frame cadence remain open; this is not performance acceptance.


## Render-thread motion and proxy artwork

The owner reported continued choppiness after the earlier pooling/cache builds.
Those builds do not satisfy motion acceptance. Scroll positions and hero fades
now use native SceneGraph Animation nodes through a small motion-group adapter;
JavaScript does not advance these animations frame by frame. Nested groups retain
local clipping and opacity, callbacks are fenced by run serial, and replaced runs
are disposed before their delayed acknowledgements can publish. Initial view
mounting prepares motion layers before navigation. A native fade acknowledgement
retires its outgoing artwork frame.

Physical proof deliberately blocked the Program/JavaScript thread for 1000 ms.
During that interval, native scene queries showed the three shelf layers advancing
in lockstep through y≈122,98,73. A separate opacity run continued through roughly
82%,70%,59%. Both restored their original values. This proves independence from
the blocked JavaScript thread; it does not measure presented FPS or certify all
input latency. A focus-normalized navigation probe still measured about 60.53 ms
p95 and 938.47 ms maximum timer delay. Earlier exploratory probes did not record
initial focus and are not controlled before/after comparisons. Rapid reversals
from confirmed Home hero focus settle with all native controllers stopped.
Overall responsiveness and the remaining physical playback/platform scenarios
remain open.

The owner explicitly selected proxy blur. Focused shelf backdrops request
`blur=16`; posters and logos retain their normal image requests. Existing sizing
passes preserve the effect without nesting proxy URLs. Authenticated image URLs
retain their direct transport. A live public proxy request returned HTTP 200 and
the processed image. This follows the [proxy blur API](https://wsrv.nl/docs/adjustment#blur-blur).
The physical Roku shows the softened backdrop with a sharp portrait preview.
The preview's right edge aligns with the profile avatar; its 50px top clearance
and bottom above the shelf are checked in browser geometry and inspected on Roku.

Validation: browser production build, application typecheck, native VIPTV package
build, 245 shared tests, 33 native tests and all eight polish browser cases pass.
The SolidTV demo native host has the common coordinate cache, native lifecycle
support and motion-group component mirrored locally; its build and all 93 native
host unit tests pass. The demo's own UI still needs compositor wiring and physical
qualification. No production/beta server rollout or new playback qualification is
included in this checkpoint.


## Home My List investigation

The owner clarified that the slow area is the My List row on Home. A real-device
trace of repeated Continue Watching ↔ My List navigation recorded no API requests
and no card-poster URI replacements. My List had 12 cards and Home was complete.
The work was in hero artwork: a 400ms settle delay preceded replacement image
requests, with another roughly 340ms on the first measured backdrop/logo load.
Warm replacement readiness was about 450ms after the key event.

The settle delay is now 120ms. Blurred previews request 960×540 pixels with blur=8
while their display rectangle remains 1920×1080. Explicit decode hints pass through
the native image bridge, so a later sizing pass cannot silently restore a full-size
decode. Sharp featured backdrops and foreground artwork retain their sizing.
The same five-key device workload measured first My List artwork readiness at
561ms (previously 788ms) and warm revisits at about 205ms (previously 453–458ms).
Key-handler work remained about 43–76ms. A rapid alternating-key run settled back
on the intended My List row; its only API request was the normal revision poll.
These are scoped observations, not universal latency/FPS guarantees.

Opt-in local runtime observations separate key handling, API read/parse/normalization
and image readiness. They capture no headers or response bodies and send/store
nothing themselves. The device reports Worker and SharedWorker as unavailable.
The installed SDK and [current Roku overview](https://developer.roku.com/dev/docs/rsg-sdk-standing-docs-getting-started-overview)
describe separate Program/Render contexts and future Web Workers. Existing HTTP
transport already executes in real Task threads; additional threads are not the
measured missing piece for this Home row.

The separate top-level My List tab also clears/refetches on entry. That finding is
not the user's Home-row report; its retention experiment is deferred rather than
presented as the fix. Full UI cleanup, remaining input latency, shared native-host
integration and LG/webOS/Tizen qualification remain active work.


## Home row focus isolation

Both owner-reported index defects reproduced before the fix: vertical return from
My List reset Continue Watching from card5 to card0; top navigation changed the
rail offset from -2116 to -346.4. Home now owns one row-focus store, keyed by row
and card identity. Only row interaction updates it; the renderer uses the shared
column only while that shelf has focus. Refresh/reordering resolves the saved
identity, removed cards clamp to a valid index, and profile changes clear the store.

A further fast-recycling regression showed a returning shelf sliding horizontally
through unrelated indices. Recycled rails/focus frames now reset after prop updates
before painting. The pinned Canvas patch stops a replaced property-animation
controller so an old transition cannot overwrite that reset.

All four new focus cases pass (including WebGL and Canvas recycling), along with
the existing eight polish cases. Full unit/native checks pass (251+33). On the real
Roku, row0 card5 restored at x=-2116 after visiting My List; all six top-nav moves
kept x=-2116, and returning through the hero retained card5. The final native build
was installed and that physical check passed again. Broader screen/overlay focus
isolation is included in the remaining functionality sweep.

## Browser session persistence under storage failures

Focused API regressions reproduce a successful refresh whose credential write
throws, followed by another expired access token. The active grant retains the
consumed rotation's successor, skips the obsolete durable value and retries
persistence on the next authenticated request. The browser store retains its
active value when storage access is denied, removes obsolete durable credentials
best-effort after a failed write, and keeps local sign-out effective when removal
is denied. Only the small device credential record is persisted.

`tests/remote/session-persistence.spec.ts` exercises HTTPS browser refresh without
Web Locks, a second access expiry, normal reload persistence and failed writes.
These are browser simulations, not physical PlayStation qualification. Permanently
denied storage cannot retain sign-in after the document closes. Browsers without
Web Locks still lack cross-context rotation coordination; a lost server rotation
response remains unrecoverable under the current replay-revocation contract.

## Shared TV functionality audit

Isolated HTTPS fixtures and short decoded HLS media cover catalog/Anime/Library
header isolation, reordered-card restoration, independent detail rails, season/hero
return, Calendar empty/navigation/history states and source Back cancellation.
Samsung root Return confirms with Cancel selected; drawer, pairing, player and
history behavior retain precedence. This exercises a simulated Samsung exit API.

Current Browse/Welcome/Library tests preserve card progress and server actions,
one composed welcome image, Type/Sort/default/draft controls and confirmed writes.
Reviewed captures cover welcome, profiles, detail, selector spacing, playback
settings, Intro/Recap, centered seek, recovery and the Next panel. Recovery also
has a pixel regression for late screen text leaking through its opaque surface.

Waiting images are not failures: first title text appears while prepared nodes
wait, delayed valid completion beyond 2500ms remains eligible, replacements retain
the current coherent presentation and canceled scopes retire staged nodes. Detail,
card, settings, browse and overlay presentation use focused components; policy
and effect ownership remain in the controller.

Intro/Recap shortcuts respect server marker ranges, seek capability and the profile
switch. Tests cover toolbar/standalone visibility, inclusive start/exclusive end,
invalid/credits/disabled ranges, Select-to-end and paused intent. Device Autoplay
follows Next episode button with pinned copy, separately from server Next/skip/source
preferences. Countdown, cancellation, prepared handoff, manual mode and persistent
switches are exercised. Shared units: 272 pass; production integrity/type/build
checks pass. Final combined integration checks remain a separate gate.

Exact Collision Course/provider sequences, actual provider marker availability,
long-title continuity and physical caption/input/paint acceptance remain separate.
Native performance and sign-in evidence retain their own limits. No deployment
or new physical-TV qualification is implied.

## TV composition cleanup

`App.tsx` now creates state, binds typed feature ports and sequences cross-feature
transactions. Focused modules own the screen/panel views, household settings and
forms, library/catalog controls, generation-owned collection and channel paging,
Search debounce/media fan-out, source intent/discovery/startup, prepared episode
sources, track/season pickers, revision transport and feature refreshes, menus,
remote navigation, keyboard/media input and host listener/caption effects.

Root scope reset, profile switching, Back/history, playback UI rollback and bootstrap
application keep their original statement order. Feature ports are constructed
once; input handlers add no backend or Core projections. Revision adapters commit
in the original synchronous phase, and listener/style disposers retain their root
effect owners. This is a module extraction, with no new application state model or
untyped application context. The root is about 3.4k lines, down from about 8.9k.

After rebasing onto the current hero-layer/mask and playback handoff fixes,
production integrity/type/build checks and all 336 shared units pass. The final
rebased browser gate passes 15 cases, including bright WebGL/Canvas hero layers,
slow-art recovery, source controls and one-Back replacement cancellation. Ownership
regressions cover stale page/rank replies, remembered-choice cancellation, polling
retirement and detached host listeners. Permission-sensitive settings tests retain
the exact confirmed-write/close/reload order.

Focused HTTPS browser batches cover settings/capabilities, query drafts and late
reads, source/seek/skip/Next actions, profile dialogs, paired sign-in, screen saver,
renderer recovery and window focus/visibility. Both Live and Search traverse 241
channels across seven pages and reverse with bounded payloads, exact server
requests, retained focus, retries and snapshot replacement. Source replacement
retains the parent’s one-Back cancellation contract. Navigation helpers resolve
server route IDs; playback return distinguishes hiding controls from leaving the
player, while preserving the original lease/window/card assertions.

Reviewed private captures cover episode focus, profiles, source picker, both Next
modes, bright hero/portrait layers and Cancel-default exit confirmation. This is
browser fixture and short decoded-media evidence. Combined physical-device
qualification remains a separate gate.

## Hero artwork paint order

The hero keeps dynamic backdrop frames and foreground artwork in fixed sibling
containers, with one permanent scrim between them. Flat-white artwork browser
regression coverage verifies the live backdrop/scrim/logo order, retained prepared
node identities, dark synopsis/shelf backgrounds, and undimmed green clearlogos
and portrait previews in WebGL and Canvas. The previous scene painted white (255)
at (80,550); the corrected scene paints below 65 at that point. Existing focused
browser cases cover coordinated replacement, synopsis authority, prepared logos,
first/replacement artwork after the former deadline, and abandoned callbacks.
Production integrity/type/build checks and 29 targeted unit cases pass. Native
retirement units verify both opacity completion orders and cancellation; no new
physical-device or native pixel qualification is implied.

The procedural hero mask now matches the pinned TV wide and tall contrast stops.
Regeneration uses `scripts/build-tv-artwork.py`, updating both packaged/browser
PNGs and their source/output hashes. Additional WebGL/Canvas pixels verify the
right edge of the 800px synopsis column over white artwork stays below 45 per
channel. Mask composition at (850,550) changes from approximately 170 with the
former stops to 31 with the pinned stops; (80,550) is approximately 22. Both bright
hero browser cases and the full production integrity/type/build checks pass with
the regenerated assets. Logo and portrait pixels remain undimmed in both renderers.


# HTML clock and frame qualification

The frozen hosted-source d559dbb bundle reproduces stale published clocks with
actual HLS and suppressed `timeupdate` delivery in both Canvas and WebGL:
published positions stop near0.26–0.28s while the real media continues. The
candidate passes `playback-clock-frames.spec.ts` in both renderers, asserting
independent decoded/displayed counters and compositor positions, paused clock
hold, paused explicit Skip seek, resume, controlled Next and decoder cleanup.
The fixture changes event delivery and external API/media boundaries only.

The shared adapter's210 unit/integration tests, typecheck and build pass. Six
actual HLS adapter cases pass in Chromium153,Firefox155 and Playwright WebKit26.6:
normal/sparse events, pause, manual paused seek, resume, two replacements and
retirement. This WebKit advertises silent compositor callbacks; its independent
video evidence is the playback-quality displayed counter. Native-HLS-first and
hls.js/MSE cleanup remain covered by adapter tests.

Physical PS4 is unavailable. These results reproduce timeline/control bugs and
provide separate video/media observations; they do not establish the cause or
resolution of the reported physical decoded-video freeze. No automatic decoder
restart, seek or server conversion is introduced. Browser results do not qualify
PS4 firmware, actual Safari or other physical TVs.

TV production integrity/type/build checks,341 shared and50 native tests pass.
Nineteen focused browser cases cover clocks, frame observations, subtitle output,
platform lifecycle, seek preview, paused replacement and source recovery.

A separate real-HLS case hides every frame API from the application while retaining
an independent native frame-counter observer. Clock-only startup remains usable,
while source-choice persistence and automatic Next preparation remain absent.
The legacy startup acknowledgement remains present because torrent runtime
startup deadlines remain active independently of ordinary viewer heartbeats. Real video evidence may promote that lease once; a
replacement starts with no carried video-success marker.

On-screen Play/Pause is exercised through normal remote focus in Canvas and
WebGL. Native currentTime writes are observed without changing their behavior:
Pause/Resume and canceling a timeline preview write no seek target or replacement
admission; paused media position holds. The legacy startup ACK fires once from
clock-only progress, and later actual video evidence promotes strict consumers
once without another ACK. Gateway contract review confirms torrent startup has
an independent120s deadline until that ACK, regardless of ordinary lease renewal.

Playback evidence precedence covers simultaneous decoded/all-dropped counters,
zero output totals, later non-dropped promotion, compositor precedence and an
explicit decoded-only fallback label. Transport startup acknowledgement remains
usable and fires once while strict video consumers wait for output evidence.
## Sharp Home artwork and dismissible player controls

Source: `77d6f4b544de3cd785805a49e0a67cd52791f58b`, owner-scoped TV-web
presentation contract in [#114](https://github.com/viptv-org/tv-web/issues/114).
The pinned design snapshot stays at `059b76344f4fed0639bedf8f89e0bd6e2b22cecd`;
SPEC.md records this client's deliberate presentation refinement.

Production integrity/artwork/type/build checks pass, as do 337 shared unit tests
and 51 native host tests. The final production browser batches pass 17
hero/presentation scenarios, four end/proxy/replacement scenarios, and four
source-opening/failure/cancellation scenarios after the source paint correction.
Earlier targeted cases also pass for delayed navigation, coherent prepared-node
identity, bounded shelf reversal, and late/failed artwork. Tests use one worker
and the shared validation lock. Local TLS fixtures accept their test certificate;
they do not establish production authentication or device qualification.

Private 1920×1080 WebGL and Canvas captures compare the exact `03cb663` baseline
with the implemented composition. Sharp artwork occupies (480,0,1440,810),
preview decoding remains 960×540, and proxy requests contain no blur. Flat-white
artwork leaves the synopsis edge at (850,550) below 45 per channel while the right
artwork at (1700,250) exceeds 245. Prepared foreground logos/posters remain
undimmed. The row marker is at x=1848 outside the card viewport ending at1824;
its 220px column stays above the 54px bottom inset.

Reviewed states include running/parked hero markers, the geometry-matched detail
skeleton, and centered source preparation with artwork/title and cancel copy.
Preparation suppresses the retained source drawer's visual tree, preventing text
bleed; failures restore the picker, focus and real source error. Existing guarded
presentation merging preserves artwork when a selector response is lean.
Rendered-title/tool assertions cover Escape and native Back, continued media,
managed seek/preview cancellation, persistent decoder buffering, ended controls,
and subsequent playback cleanup.

The native local release build and its type checks pass, with the generated Home
scrim packaged. This is compile/host evidence. Physical Roku, PS4, Tizen, webOS and
Vizio firmware acceptance remain pending; no device install or deployment is part
of this validation.

Clearlogo/input follow-up source: `7c8c0ecdd15ce621ad96b2dcde0a8af8e6fdcac6`.
Three focused logo-layout units, the production integrity/type/build, ten focused
browser cases and the native local release compile pass. Matched WebGL/Canvas
captures show the fixture's actual clearlogo centered above progress and cancel;
missing/failed logos show the title in the same reserved slot. A held logo response
does not delay first-frame presentation. Both native Back and Escape ignore repeat
keydowns after menu dismissal and chrome dismissal, then the next distinct press
exits normally. Preparation has no redundant opening/discovery status line.
SPEC.md references the immutable scoped design amendment
`1f50bdc2e95b73562307f49d36f61851720bf2c7`; unrelated upstream changes remain
intentionally outside the `059b763` asset snapshot. Physical-device qualification
remains pending.

Progress paint verification reuses the exact runtime artifact from
`7c8c0ecdd15ce621ad96b2dcde0a8af8e6fdcac6`; no runtime change or rebuild was
needed. Eleven focused WebGL/Canvas cases wait for painted progress, then assert
more than 80 near-exact fixture-accent pixels in each saved full-frame spinner
region. All frames contain 123–127 such pixels, including normal/reduced motion
and available/absent/failed logos. Separate region captures were inspected.

## Scoped physical Roku presentation and Back acceptance

Runtime source: `a81754d100863dbfcdce7dda68dbf2cc804a80fa`, with native paint-band
classification from `a77e2b9511f317d8874707887f02e2cfb370ba8b`. Owner-approved
candidate 1.0.11145 runs on Roku TV 50S435 / C157X, OS 16.0.4 build 853, at
1920×1080. Cold installation verifies OS Home and prior ExitComplete, uploads
without auto-launch, verifies the installed version and launches explicitly.
Existing sign-in is retained; no sign-out, pairing or reboot operation is invoked.

Home/CW backdrop and scrim roles cross the native bridge explicitly. Packaged
Home, hero and navbar masks share the scrim band above backdrop art and below
foreground. The same bright Heart of the Beast composition is inspected on
11144 with restored gradients/nav cover; 11145 Nocturne and Interstellar CW
captures retain sharp right art, readable copy, clearlogos and the gutter marker.
Running/parked hero marker captures are scoped to 11144. The detail page and
source preparation title/artwork/progress/cancel are inspected; an isolated native
detail-skeleton transition and native source-clearlogo loading state remain
unmeasured. Their browser and native-build evidence remains separate.

An idle-removal regression fails without a real SDK transaction, then all 52
native tests and the native local build pass. RokuNode destruction opens the SDK
transaction before raw removals, so a removal-only change commits while the
renderer is idle. The physical Audio & subtitles panel closes on one Back while
playback continues. After chrome is revealed, one Back clears the settled
physical image without another UI mutation. The actual OS tree exports invisible
SDK subtrees in both states, but SDK groups shrink 75→21, labels 22→13,
rectangles 16→6 and posters 41→36; matching control labels shrink 4→0. Native
node rcid values are zero, so per-ID matching is unavailable.

Native HLS remains in play without error and advances 842900→847517ms after the
first Back. The next distinct Back returns Home, native media reports close, and
exactly one playback DELETE completes with HTTP 200. Final Home is ready with no
overlay/preparation or active player; owned observers are removed. This qualifies
the stated device/UI/control flow, not audibility, caption timing, performance or
other firmware. Physical repeated-key behavior is not promoted beyond the
existing browser repeat checks.

The immutable 11145 compiled JavaScript SHA-256 is
`93ee4eb8f73d80ccbfd5fba5c3884dbe602e8331d01993ae9779f324c0b3263c`;
the manifest-only patched package tree is
`104414357e7eb29e7674db2b8a293110b1bbd571fbbfe12094217dbaa9d0d2c6`.
An independent browser artifact from a77e2b9 retains WebGL/Canvas bright-mask pixel
acceptance and App SHA-256
`668f067d1bfb897ff55b0e616f789cfad2db809add6e2eb97587e533291e72bd`.
Private captures and complete manifests stay outside the repository.

### Nullable source-memory observations

Presented source metadata may encode absent optional supplier IDs/names as JSON
null. The wire-to-device-memory adapter omits those optional values before strict
persistence validation; invalid provider/URL identities and actual storage-write
failures still reject without replacing confirmed settings.

Nine device-playback units pass, including a null-metadata regression that failed
before normalization. Production integrity/type/build and two real-media browser
cases (Canvas/WebGL with a PS4 user-agent) pass: a manually selected source with
null optional metadata persists the provider/language observation without the
save-warning toast, then releases playback. This is browser evidence, not proof
that a physical PS4 storage quota or security policy cannot reject writes.

### Provider subtitle timing prototype

Focused provider/playback/overlay tests: 46 passing, including provider-only
capability, legacy-backend/native-host exclusion, discovery after Back, manual
freeze, reset/disposal, native-track reuse and unchanged media commands. Same-source
managed seeks preserve explicit provider/manual intent without blocking video;
changed hash/audio/source and Off/newer selection reject stale reattachment.
Late request failures cannot overwrite reset/manual state, and Reset restores
original cues before a delayed worker reply. The
actual picker+overlay controller restores original player tool 4 after Back from
nonzero rows in provider and timing submenus. Full isolated production
build/typecheck, pinned video integrity and video's complete 206-test suite/build
pass. This focus evidence is controller state, not rendered-device acceptance.

`node scripts/check-subtitle-sync-browser.mjs` exercises real native TextTrack
active cues with an owned silent WAV and mocked authenticated transport.
Chromium 153.0.8010.12, Firefox 155.0 and WebKit 26.6 pass correction/manual timing,
dense-window deferral, source stability, zero extra load events and cue cleanup. The browser mechanisms
also restore manual-only timing on a replacement and verify that the previous
automatic cue slot remains empty; one native track is reused.
Existing userspace GTK/GStreamer dependencies and the bundled Firefox NSS libs
are supplied through per-browser launch overrides; WebKit uses an owned Xvfb.
No host package was installed. Optional `SUBTITLE_BROWSER_LIBRARY_PATH` and
`SUBTITLE_WEBKIT_EXECUTABLE` configure those local test dependencies.

This is browser mechanism evidence, not rendered-TV, actual gateway HLS,
Safari/native-HLS, paired startup/rebuffer or held-out subtitle accuracy
qualification. Initial bounded VTT parsing and short-cue/high-speed presentation
follow adapter snapshot cadence and need frame-time/media-timing qualification
before enabling automatic timing beyond the isolated prototype.

Optional-sync review regressions verify an old gateway 404 preserves canonical
provider/manual timing after managed seek, while known audio/hash/authority
fences are retained. Focused tests and full production type/build pass.


The pinned video projection bounds pending accepted swaps to five content
seconds when continuous/overlapping captions hide every observed gap. Ten
projection regressions cover that bound, pause/origin rebasing, seek, coalescing,
manual/disposal and malformed-record watermark protection. The combined video
head retains canonical main's PS4 clock/frame changes; 46 affected video tests,
46 TV lifecycle tests, type/build and Chromium/Firefox/WebKit native TextTrack
mechanisms pass. Browser mechanisms include a continuous-cue swap with the
media source unchanged and zero extra load events. Default automatic timing
remains off and this is not physical-device or native-HLS qualification.

## Combined subtitle, playback-observation and Search/Canvas integration

Main `e9591e1767a11a61c5fe39857c73e02777264684` is merged with the subtitle
lifecycle. Video inventory is regenerated from canonical
`aeb7b6549a7f9e0a412f7e979d2a45364e16dbc8`, present on video main `1e879410`.
The strict playback-progress/verified-video distinction and legacy transport
acknowledgement retain main's implementation. Search grouping, native paint and
disposal retain their canonical source.

The isolated dependency overlay verifies all 674 private Canvas files and 26
direct packages against the Search120 inventory. Vite/test caches are task-owned;
shared and private package trees are read-only. A temporary test config permits
those verified dependency roots, and fixtures use the existing read-only design
reference. Full shared units (376), native units (52), typecheck and production
build pass. Seven Canvas, eighteen clock/Search and five real-HLS caption cases
pass, plus Chromium/Firefox/WebKit subtitle mechanisms.

The original two-second intro test had one ambiguous timeout after seven Canvas
cases. Two instrumented replays paused at 1.630288/1.664435 seconds, retained Skip
intro, selected the intended tool and completed the expected admission. No
application regression was established. The test now supplies a three-second
intro, asserts the held position remains inside it and checks visible action and
focus before activation. Exact paused seek target, clock hold, admission count,
resume, controlled Next and cleanup assertions remain. This fixture robustness
change does not alter application playback behavior or physical qualification.

## Authored player gradients (#124)

Based on `e9591e1767a11a61c5fe39857c73e02777264684`, with DESIGN_REF retained at
`059b76344f4fed0639bedf8f89e0bd6e2b22cecd`. The packaged player mask is generated
directly from the pinned TV shade tokens and replaces the flat full-screen veil.
Production integrity/type/build checks, all 355 shared tests and all 52 native
host tests pass using an isolated cache overlay over the verified Search120
dependency graph. Shared validation/build locks serialize these checks.

Two production-browser cases pass at 1920×1080, one WebGL and one forced Canvas,
using the owned decoded HLS color-bar fixture. With controls shown, maximum RGB
channels at x1850 and y40/320/700/1030 are 91/255/54–55/28; after hiding controls,
the same paused-frame pixels are 255/255/255/255. These measurements establish
top/bottom protection and the untouched middle without double dimming. Private
full-frame captures of visible/hidden controls and playback exit are inspected.
The cases also verify one mask on reveal, zero after hide/exit, unchanged video
source/bounds, and the video layer hidden after Stop.

An initial local browser attempt used HTTP and hit the existing HTTPS image-origin
guard before startup. The successful fixture uses local TLS with its test
certificate accepted only by the test client. No production TLS setting changes.
The focused native paint-band check places the new packaged mask in the explicit
scrim band. A fresh native bundle/device run is not part of this change's evidence;
physical PS4, Roku, Tizen, webOS and Vizio appearance remains unqualified here.

# Pause controls

Full validation on the merged subtitle/source-memory baseline passes 388 shared
and 52 native-host units, all TypeScript groups and the production build.
Eleven focused input/transport cases cover hidden stale selections, visible tools,
explicit Skip, media pause keys, admission retirement, stale success/failure and
late rejection after leaving the player without explicit transport retirement.
Active current failures remain visible to the caller.

Nine owned real-HLS browser cases pass: WebGL and Canvas hold controls through
6.2-second pause/resume acknowledgements and waits beyond the five-second idle
timeout; Back hides paused chrome, MediaPause reveals it, resume restores idle
hiding, and pause writes no seek or replacement admission. Replacement retains
paused intent and then resumes normal hiding. Existing intro/recap and invalid
marker actions, plus nullable-source persistence under both renderers, pass.
These are simulated PS4/browser checks; physical PS4 and other TV firmware remain
unverified. HTTPS fixtures and private patched Canvas dependencies are isolated;
no deployment, account mutation or device operation is part of this validation.

### Combined beta qualification

The integrated product code at `46d499eac54102f9b272a417d59c01f34196903f`
passes 389 shared units, 52 native host units, the production integrity/type/build
and a fresh local native bundle build. The isolated dependency inventory verifies
674 private Canvas files, 674 unchanged shared Canvas files and 26 package manifests.

Eighty-three focused browser cases cover visible Continue selection and playback
identity, horizontal/vertical focus, top navigation, loading recovery, source
presentation, source-memory null handling, legacy session rotation, grouped
Search, authored gradients, timeline-only thumbs, Back, delayed pause/resume,
skip and Next. Five additional decoded-HLS/WebVTT cases pass for web, webOS,
legacy webOS, Vizio and Tizen host modes. These are desktop browser/platform
simulations; physical PS4 decoder behavior and vendor-firmware compatibility
are separate qualifications.

The poster-alignment test initially sampled the renderer before its prepared
poster became renderable. It now waits for both actual geometry nodes before
checking the unchanged alignment, clearance and sharp-proxy assertions. The
failed sample is retained in private evidence; the focused rerun and remaining
cases pass. No product behavior was changed to satisfy that test.

Source-preservation checks verify the deployed TV/backend revisions are ancestors
of the candidate. Gateway qualification must also include the retained deployed
HLS/cache lineage; ancestry and live binary markers are checked independently of
image labels. Runtime, served-asset and authenticated live acceptance are recorded
in the rollout issue rather than inferred from build or deployment status.

## Temporal focus paint

Production-renderer probes sample every painted frame with real Onest glyphs,
using a PS4 user-agent. Each probe covers cold text, warm focus/unfocus, rapid
reversals and disposal. Canvas runs with free and occupied artwork decode slots;
WebGL provides the comparison. The baseline records 11 zero-contrast frames out
of 22 for each Canvas case, with one replacement still pending at paint. The
corrected bundle records zero invisible frames out of 22 in every case; minimum
contrasting-pixel counts are 2536 on Canvas and 2574 on WebGL. Each probe retains
one text child, reaches zero pending replacements at paint and removes all owned
children on disposal. Private failing and corrected frame captures are inspected.

All 394 shared tests, 52 native host tests, strict type checks and production
integrity/build checks pass. The ten browser cases include the three temporal
probes and seven existing Canvas regressions covering focus under decode load,
scaled season choices, artwork gradients and buffering/timeline controls.
The committed patch reapplies through patch-package to the pinned package and
reproduces all 674 files in the isolated Canvas copy. Its source/distribution
manifest is verified by a unit; shared dependencies remain unchanged. This is
browser and native-host unit evidence, with physical TV appearance unqualified.
