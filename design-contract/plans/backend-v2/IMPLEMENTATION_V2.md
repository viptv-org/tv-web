# BE-002 / ADM-002 implementation ledger

This is an execution checklist, not a completion claim. User decisions are in
[BACKEND_V2.md](BACKEND_V2.md) and [ADMIN_V2.md](ADMIN_V2.md).

## Native torrent default availability — 2026-10-07

The owner explicitly approved default native torrent playback for every
authorized account on supported Android/Android TV runtimes, without a
configurable enable setting, operator allowlist or qualification receipt.
[SRC-TORRENT-NATIVE-001](../../specs/behavior/torrent-native-android.md) records that
decision. Android runtime defaults and backend admission adoption are in
progress; runtime/media evidence and actual development activation will be
recorded by their owning repositories. No production deployment or universal
hardware qualification follows from this approval.

- [x] Approved decisions captured; production mutation excluded.
- [x] Versioned public contracts and migration fixtures executable (source/fixture acceptance).
- [x] VOD 10k/100k baseline captured and bounded query implemented.
- [x] Independent engine extraction and container build.
- [ ] Gateway key scopes, jobs, viewer leases and safe media ingress.
- [x] Backend HTTP gateway selection/affinity and encrypted secrets (development fixtures).
- [x] Account-owned Xtream, default playlist and catalog paging (backend fixtures).
- [x] Advanced configuration export and reviewed offline migration tool.
- [x] Local-only and embedded engine implementation paths removed after source cutover tests.
- [x] Maximum-quality feature removed; actual device limits retained.
- [ ] Admin website rebuilt; VOD matching stays available and bounded.
- [ ] All client logic/contracts updated; UI changes follow the design-first scope.
- [ ] Cross-repository integration, browser/native checks and packages.
- [ ] Reviewed rollback/cutover instructions ready (no production execution).

## Current coordinated source checkpoint — 2026-09-30

Latest owner scope update: UI changes are now allowed across affected clients,
including Android, superseding the earlier backend/logic-only restriction.
Use the [GitHub handoff map](https://github.com/viptv-org/workspace/issues/2)
and design-first synchronization for affected screens/states. This is permission,
not new implementation or parity evidence; merge/deployment approval is separate.
The owner made no independent Android UI edits. All eight dirty files in the
original checkout exactly match Android `02b70ae`, already included on the
published cutover branch; the previous concurrent-UI-work assumption was incorrect.

Urgent handoff after the user's request to finish rather than extend qualification:
backend `b78aab2` publishes populated real-image/browser evidence and a tightened
current-data engine-free image rollback fixture. Both exact rollback images
retain newer history, precise preferences, encrypted configuration and non-null
resume metadata without restoring an older DB. Gateway `fb15c39` is published on
main: MPEG2 and verified FFV1/FLAC AV share bounded private replay, with actual
late-join/eviction/audio-index/timestamp/ENOSPC/crash/restart evidence (104 tests).
Android's separate published native-stress branch `85adc70` adds 169 host tests
and three actual x86_64 Android JNI/MainLooper cases; the original UI checkout
and normal `14bc969` handoff APK remain unchanged.

The earlier populated admin scenarios confirmed two logic gaps: VOD retained
data grew beyond its twenty-row DOM window, and the provider dropdown omitted
owned connections beyond its first 200. The separately reviewed bounded-VOD
slice below now fixes and qualifies these against synthetic data.
The qualified Linux/SubRip sharing and narrow Android foreground/media slices
are recorded below; other subtitle, progressive and unlisted gateway sharing,
broader native stress, physical/signing acceptance and
production cutover are not complete. App PiP is not implemented; its current
background-stop contract is not a PiP claim. No new scope or production action
was started to conceal these gaps. All owned QA resources are stopped; fixture
APKs must not be substituted for the signed system-trust-only normal APK.

The following supersedes historical statements below that ordinary live callers
or admin management still use the legacy contracts. These are development
branches, not production rollout evidence. Unchecked end-to-end gates remain
unchecked deliberately.

| Repository / reviewed revision | Implemented and checked | Still incomplete |
|---|---|---|
| Backend `27a0296` (docs `8eafe14`) | Retired engine/advanced runtime and packaging removed; strict encrypted reads/private headers; 213 tests/Clippy, executable migration/retirement and post-commit WAL-cleanup recovery; live/VOD encoders never emit over-bound tokens and preserve raw IDs; full image `5b5900c8` passed seven HTTP + sixteen trusted-browser groups and gateway212af real-media lifecycle | Coordinated rollback-image rehearsal and final populated browser/provider/native integration; production migration/deployment excluded |
| Core `8ae9f81` (docs `a611d56`) | Retired application provider/add-on bridge and feature removed; standalone parser retained; 64 tests, generated native/WASM, 35 baseline/candidate parity cases; frozen v2 JSON/events byte-identical | Physical-device/native stress and remaining consumer integration evidence |
| Android handoff `14bc969` | Core8/raw guide/v2 leases; 166 host tests, three ABIs, normal signed system-trust-only APK; category screen callbacks and quality-row removal; phone/TV 400-category forward/reverse, actual201/200 focus, Search/Back, full All/Search return and long-drag one-request/anchor fixtures passed | Original UI checkout deliberately untouched; handoff must be reviewed/merged separately; actual backend/gateway native media, physical/native stress/PiP remain separate gates. Hosted `36691357270` qualified earlier75bb source, not this screen slice |
| Roku `ace7ab1` (test/docs `75176bc`) | Raw bounded guide and mandatory gateway leases; quality feature removed; live cursor4096 and exact native Integer/LongInteger metadata, floating identity refusal; 32 runtime/6 contracts/compiler/local ZIPs. Hosted `36674162488` qualified earlierd46 source | Actual firmware JSON decoding, backend/gateway/SceneGraph device, TLS, foreground, 4K/tracks remain unqualified; typed >2^53 fixtures are not universal JSON precision proof |
| TV-web `db9c5ab` (docs `aef29cf`) | Dormant local-only code removed and Core8 adopted; 234 retained unit tests/36 HTTPS cases; hosted bundle/webOS IPK `36690591107` checksum/static checks | Overall hosted run failed only at missing Samsung signing secrets; signed Tizen, real gateway/physical TV and installed media remain unqualified |
| Admin web `93c9316` | ADM-002 owned management/lazy VOD, page identity guards and same-scope in-memory parent drafts; 88 unit tests; twelve mocked owner routes/both viewports/20-row DOM bound; actual backend trusted-HTTPS member/auth/recovery/parent-draft revocation/device approval+revoke fixture passed at both viewports | Populated real-provider/operator integration, migrated accounts with >200 provider choices, long-traversal metadata bounds and complete auth matrix |
| Desktop `54854cf` (docs `faf43cf`) | Core8/TVdb9 pins, retired feature removed; native/frontend checks, Linux DEB/AppImage and Windows NSIS; hosted Windows/Linux run `36690568896` passed including installed Windows eight-second loader smoke | Loader smoke is non-hermetic and may attempt unauthenticated default-origin pairing; no account/media/hardware proof; portable installed/native playback still open |
| Gateway `c4e692d` | Independent compatible live ingest, truthful quotas, bounded tmpfs/replay, crash/slow-reader hardening; 99 tests and actual ENOSPC/restart/envelope fixtures; FFmpeg9 private-playlist reload fixed; configured 4K/5fps/40Mbps copy retained >64MiB, output advanced, two viewers/one upstream and full release/reclaim | This does not qualify default budgets, arbitrary bitrate, motion/30fps/HDR/hardware; unsupported/progressive sharing, public ingress and stalled I/O cleanup remain separate gates |

Android's isolated handoff branch is `refactor/android-backend-cutover`.
Preserve its reviewed work and frozen v2 contract while reconciling the older
original checkout; UI implementation is permitted under the updated scope.
Other source checkpoints are published review branches, not a claim that every
repository's main branch has been promoted. Private QA artifacts and credentials
are not committed here.

Gateway hard allocated-media storage bounds now have actual kernel ENOSPC and
release/reclaim evidence in the supplied Compose envelope; native/custom layouts
do not inherit that mount automatically. Compatible shared inputs, crash/slow
readers and the rebuilt container have separate checked fixtures. This is not
universal format, bitrate, filesystem/RSS or hardware qualification. Sustained
copy now passes in its explicit operator-budget envelope; exact source/image,
packet/allocation/progress facts and boundaries are recorded in the gateway's
`docs/CBR4K_QUALIFICATION.md`, not an inferred universal 4K claim.

Backend retirement now has backup-first/private export, encryption/ownership,
incoming-FK and active-routing refusal checks plus genuine executable acceptance.
The test runtime never auto-migrates a production database. Current artifact
builds and development branches do not authorize production mutation or deploy
the public website. The large unchecked end-to-end items above intentionally
remain open; historical sections below are not the current source state.

The source/fixture checkbox milestones do not close the broader goal. Universal
format/input-sharing and ingress/hardware tests, populated operator/provider
flows, installed/native stress and coordinated rollback still require their own
evidence. Tizen signing needs privately configured certificate secrets. The
Android owner's original checkout is not switched, reset or merged automatically.

## Bounded admin VOD slice — 2026-09-30

Owning acceptance: [web issue 5](https://github.com/viptv-org/web/issues/5).
Design-first contract is `1dc92f7b4a571df00f89cc3915aaf1165a42bf94`,
ADM-002-VOD-WINDOW / VOD-WINDOW-01 through 04. Web source
`048651e941b4aad15cea69294419600bfb8612af` adopts that exact snapshot; backend
Rust source `8b257f91b6beb8d8aa06749099e697fb454c79c5` adds scoped reverse VOD
cursors and transactional catalog revisions. Backend packaging `8eec3da` pins
the same web commit. These are review branches, not merged or deployed versions.

- Backend full Rust tests, strict all-target Clippy and formatting passed;
  admin 97 tests and production build passed. Deployment configuration and nine
  host-check tests passed. Independent Standards and Spec review found no
  remaining code findings after geometry, refill and bounded-save fixes.
- Actual shipped CLI/Vault sealed provider and addon configuration for a fresh
  synthetic 100k-title catalog. Title columns and the SQLite database itself are
  not encrypted by this evidence. Trusted HTTPS API traversed all 99,999 initial
  unmatched titles forward and backward in 2,000 pages per direction, with no
  omitted/duplicate identities; all 208 owned providers were available.
- Chrome at 1440x900 and 390x844 traversed the entire unmatched catalog forward
  and back while checking every incoming page identity. Desktop visited 99,999
  titles; phone visited 99,998 after the desktop's selected-row save. Maximum
  retained state was 150 rows / three pages / nine cursor slots, and DOM stayed
  at 20 rows. Travelled extent is scalar, not a retained historical page map.
- Phone Chrome trusted simulated touch events opened/dismissed a match dialog
  and swiped the list by 439px. Native gesture settling was explicitly awaited
  before the later exact modal return checks; these passed in the combined run.
  This is input emulation, not a physical-device claim.
- Real-backend browser checks passed provider-page retry, delayed/failed evicted
  forward refill without a blank window or extent growth, keyboard scrolling,
  Cancel/Escape/browser Back with exact scroll/opener focus, failed/retried save
  and Edit match, stale-revision refresh, filter cancellation and account signout
  during a pending read. Transport faults changed no response data. Unit tests
  additionally cover pending-save account cancellation and the 30-second save
  deadline/late completion; these are separate from browser evidence.
- Private populated-list and dialog captures were inspected at both sizes:
  desktop 540px list / 112px rows; phone 506.390625px list / 184px rows, 56px header,
  16px gutters, readable wrapped labels and bottom-sheet controls. No horizontal
  overflow. This is affected-state visual QA, not measured pixel parity or a
  physical phone qualification.

The tested binary SHA256 is
`2f4899274ec3964c248aa42de81a9ae67215eb9167a6f2f620c37b8bfb8635a5`;
served admin asset was `index-Df4Sh2lc.js`. Backend's reproducible harness and
`docs/BOUNDED_VOD_ACCEPTANCE.md` own the final detailed evidence. Existing shared
local runtime and production data were untouched. The broader admin/cutover,
provider/operator, gateway, native and deployment gates remain open.

## Shared SubRip replay slice — 2026-09-30

[Gateway issue 2](https://github.com/viptv-org/playback-gateway/issues/2) is closed
for its qualified generic source/image scope. Published branch
`fix/shared-subtitle-replay` at `92b8ed55b779ee0a34b97f3cb9d31359554bb50d`,
[review PR 3](https://github.com/viptv-org/playback-gateway/pull/3), preserves
source/private/public track identities and carries bounded active overlapping
cues across original-segment eviction. Compatible caption-off and late
caption-enabled outputs use one upstream. Actual WebVTT rendition index is zero.

Exact runtime source `f056a0dd31d6443c45706ac35dc08406d28a710b`, image
`5efbd97e78573879a696f4bd3c4c22165c3a65e500bf5695e1cb4881ca95eed8`, passed actual
HTTP and verified HTTPS source/control/media tests: decoded caption intervals,
sparse audio content, late activation, retained seek, independent release/60s
expiry, cache overflow, process/upstream teardown and reservation reclamation.
The same image passed real 2-MiB tmpfs ENOSPC/readiness/reclaim/persistent-key
restart checks. Subsequent runtime source changes are mechanical formatting only;
the report retains the exact tested image/source identities.

Default suite: 104 passed, 36 explicit opt-in fixtures separate; strict Clippy
passed. Independent Standards and Spec review: zero outstanding findings. Scoped
formatting passes changed Rust files; five unchanged baseline formatting failures
remain documented. Qualified eligibility is Linux/SubRip with tested H264/AAC;
other text/bitmap codecs/platforms retain independent fallback. No universal
format, native caption renderer, merge, deployment or public ingress claim.
Detailed reproduction and limits:
[SHARED_SUBTITLES.md](https://github.com/viptv-org/playback-gateway/blob/92b8ed55b779ee0a34b97f3cb9d31359554bb50d/docs/SHARED_SUBTITLES.md).

Broader gateway/cutover gates and progressive issue 1 remain open. Android's
narrow AND-041 qualification is recorded independently below.

## Android foreground/media slice — 2026-09-30

[Android issue 4](https://github.com/viptv-org/android/issues/4) is qualified for
its narrow source/emulator deliverable in
[Android PR7](https://github.com/viptv-org/android/pull/7), branch
`fix/android-foreground-lifecycle` at
`3a9c57e78083936b75d475c70ccdf24feeb6a8e7` (runtime source `ce0f33b`).
Design-first AND-041 pin is `9bb130ae80af18d41c411c137c6a515b175a5991`;
Core8 remains unchanged. AND-036 background-stop, absolute exact-source Resume
and no silent native gateway/transcode policies remain; no PiP was added.

- Actual backend token rotation reproduced canceled foreground validation losing
  an accepted grant. Session-owned bounded single-flight refresh fixes the same
  phone/TV native loop: confirmed profile/Home/Resume retained, one rotation and
  no new pairing. Rejected refresh clears protected presentation to sign-in.
- API36 x86_64 phone/TV decoded actual required-header gateway-produced finite
  H264/AAC provider bytes from Resume20. Source26.280/app26 and source24.480/app24
  agree on the absolute120second timeline. Actual heartbeat/progress passed;
  HOME/STOPPED released each exact backend lease (DELETE200), left no app codec
  clients and retained matching-source progress. This is a normal direct backend
  descriptor, not native-managed gateway control or a finite gateway contract.
- The dispatch-proven held-refresh profile-choice failure was fixture connection
  framing, not lost intent. After removing all QA-only client-header/debug
  changes, the ordinary shell passed against explicit-close helper `7ea0c60`:
  actual profile4 POST200/Home followed by profile2 POST200/Home, exactly one
  rotation and no extra pairing. Private visual captures were inspected; no
  pixel-parity or physical-device proof is implied.
- 174 host tests, Core host/three ABI builds, Core/design integrity, normal APK
  assembly and lint passed (existing baseline retained). Independent Standards
  and Spec review found zero outstanding findings. Normal development-signed APK
  SHA256 `44e2e436494f92003b973ef6f492f3b55801900718b3809f4fdf6efecd41056e`
  has system-only trust and no fixture CA; QA artifacts are not deliverables.

All dedicated emulators/backend fixtures are stopped. The separate gateway's
old viewer lookup was404, idempotent DELETE204, reservations2/2/2 available,
no FFmpeg child and no media-cache files before exact test-container removal.
Private evidence remains outside Git; the original eight Android changes and
shared HTTPS runtime are untouched. Detailed limits/reproduction are in
Android's `qualification/FOREGROUND_ACCEPTANCE.md` and
[backend PR6](https://github.com/viptv-org/backend/pull/6).

Broader Android/native stress, ARM/physical, HDR/DRM, native opening-cancel and
decoder-failure device stress, Tizen signing/hardware, integration/rollback and
production rollout gates remain open. No broad checkbox, merge or deployment
completion follows from this narrow qualification.

## Foundation checkpoint — 2026-09-29

- `playback-gateway` exists locally with extracted engine, independent Rust
  contracts, hashed scoped credentials, logical viewer/job lifecycle and an
  isolated egress proxy. Network and lifecycle components pass unit fixtures;
  the public media service and backend integration are not implemented yet.
- Backend branch `refactor/backend-v2` contains tested account ownership/default
  and bounded VOD storage functions, not activated against a real database.
- Synthetic 100k-title VOD comparison: legacy materializes 100k rows / ~4 MB
  response; v2 materializes 51 rows / 50 returned items. Warm first-page median
  was 0.12 ms versus 145.66 ms in the local Python/SQLite harness. This is not
  a production end-to-end measurement. Backend docs record reproduction.

## Credential boundary checkpoint — 2026-09-29

- Gateway control has bootstrap-authenticated HTTP key issuance/list/revocation
  routes and per-viewer media capability validation. Rotation, lease expiry and
  key revocation deny subsequent authorization without waiting for cleanup.
- Shared-job failure transitions use safe public codes and retain quota
  reservations until worker teardown. Control tests: 15 passing; extracted
  engine default suite: 64 passing, 16 opt-in tests excluded from that count.
- Media routing and workers are still not connected; these checks do not prove
  end-to-end playback, shared upstream counts or readiness for deployment.
- Two opt-in tests additionally passed with installed FFmpeg/ffprobe: real
  remux/transcode/cleanup and rejection of nested local segments/AES keys. This
  is engine evidence only, not verification of the new gateway media routes.

## Engine boundary checkpoint — 2026-09-29

- Extracted gateway engine no longer hands upstream URLs/credentials to native
  clients; backend direct playback remains the product-owned decision.
- Removed remaining original-delivery dimension clamps, with declared-envelope
  4K/8K tests. Existing codec/decoder checks remain in place.
- Media subprocesses clear inherited proxy variables. A real FFmpeg/ffprobe
  fixture verifies explicit proxy use for root/redirect/segment/key requests and
  rejects raw TCP/TLS segment bypasses. Real remux/transcode/cleanup passes too.
- Default workspace suite: 65 engine tests and 15 control tests passing;
  17 opt-in tests are excluded from that default count. Certificate/hostname
  validation, media routing and actual worker sharing are still acceptance gaps.

## Worker integration checkpoint — 2026-09-29

- Engine preparation now returns its own normalized output plan before worker
  startup, with independent inspection/output capacity and drop-safe admission.
- The control worker bridge uses that plan directly, shares compatible workers,
  checks independent viewer credentials for media, and retains quota until
  cancellation/stop cleanup finishes. Reaping is serialized and bounded.
- Five-viewer/single-worker and cancelled-start fixtures pass with scripted
  processes. Default suite: 66 engine tests plus 17 control tests; 17 opt-in
  engine tests excluded. The real FFmpeg remux/transcode fixture also passes and
  verifies prepared-plan versus actual response mode/format consistency.
- Real single-upstream sharing, public session/media routes, service packaging,
  TLS acceptance and the remaining cross-repository cutover are still pending.

## Standalone service checkpoint — 2026-09-29

- Generic session/media HTTP API and standalone executable are implemented;
  control credentials and viewer media capabilities remain independent. Stable
  idempotent URLs, scoped reads, renewal/release and non-cacheable media pass
  route tests. Default suite: 86 tests passing; 20 opt-in fixtures excluded.
- Real plain-HTTP live source: five compatible viewers keep one active upstream
  connection; a separate namespace gets a distinct input. Viewer release does
  not stop the other viewers. This also passes with the container's FFmpeg.
- TLS fixtures accept trusted matching HTTPS media and reject untrusted/wrong-
  hostname certificates and untrusted HTTPS children of HTTP playlists. Native
  and container media binaries pass. HTTP provider inputs remain supported.
- Docker image built and reported healthy under UID 10001, read-only root,
  dropped capabilities and no-new-privileges. Native service TCP readiness,
  exclusive storage locking and graceful shutdown were checked.
- This does not complete gateway acceptance: pending inspection admission,
  detailed upstream errors, all-format network enforcement, multi-output input
  sharing and crash containment remain. Backend/client integration and the
  other unchecked items are still open. No production deployment occurred.

## Backend account-query and migration checkpoint — 2026-09-29

- Startup initializes additive v2 ownership/default/index tables without
  assigning legacy providers. Account-scoped matches GET/PUT and live-default
  GET/PUT routes are compiled into the backend. The existing web/viewing
  consumers have not yet cut over to these endpoints.
- Router tests verify bounded pages, account-bound cursors, protected edits,
  default persistence/fallback, no operator-role ownership bypass, and denial of
  management operations to paired devices or locked kids profiles.
- A separate provider-owners executable inspects read-only and requires explicit
  confirmation plus a complete owner map. SQLite online backup and a versioned,
  streamed private advanced-config export precede transactional assignment.
  WAL, identity/history/match preservation, rollback on invalid maps, duplicate
  owner rejection, non-overwrite and no credential output have fixture coverage.
- Full backend suite: 219 passed, two existing real-media fixtures ignored;
  strict all-target Clippy passed. Three stale assertions from the earlier
  playback-error change now check the existing human messages and stable codes.
- The migration tool currently handles export/ownership, not the entire future
  encrypted-credential and catalog cutover. Legacy routes/modules, source CRUD/
  discovery isolation, client adoption, gateway integration and final rollback
  qualification remain. No production migration, read or deployment occurred.

## Encrypted gateway configuration checkpoint — 2026-09-29

- Backend gateway configuration is account-owned, with explicit additional
  grants and no implicit public/family default. Recipient and operator roles
  cannot edit another account's private connection.
- Integration keys are saved in authenticated encryption envelopes bound to
  owner/purpose/record/key ID. An operator-supplied keyring is required; missing,
  incorrect and retired keys fail closed rather than falling back to plaintext.
- HTTPS endpoint/key/scope checks precede persistence. DNS destinations are
  validated and pinned; redirects, inherited proxies and oversized responses
  are rejected. Concurrent checks are bounded and API responses are no-store.
- Backend default suite: 224 passed, three opt-in fixtures skipped; strict Clippy
  passed. The new executable interoperability fixture separately passed against
  the independent gateway. Its capability API now reports operation scopes;
  the gateway default suite remains at 86 passing tests.
- This does not complete gateway playback selection/affinity/session forwarding,
  provider/addon credential migration, private-network operator policy, bulk
  re-encryption or legacy playback removal. No production secrets were provisioned
  and no deployment occurred.

## Backend playback forwarding checkpoint — 2026-09-29

- /api/v2/playback now owns scoped asynchronous startup, status, heartbeat and
  release. It consumes only backend-issued source IDs, rechecks source ownership/
  configuration and returns direct or gateway delivery without backend media relay.
- Roku/Vizio cannot bypass required gateway delivery. Other eligible native
  clients can use direct delivery. Account-authorized active affinity precedes
  healthy priority/capacity selection; the gateway reports per-key capacity hints.
- Tests cover source changes, no private/family fallback, explicit grant
  revocation, independent viewer release, stale/foreign media URL rejection,
  actionable failures, idempotency and release of a late viewer after cancellation.
- Backend default suite: 230 passed, four opt-in fixtures skipped; strict Clippy
  passed. Gateway default suite remains 86 passing. An isolated network-none
  container fixture passed real FFmpeg HLS playback, renewal and revocation via
  the backend and independent gateway while the backend engine stayed idle.
- A fresh gateway image f215fa924b8f was built for that fixture. It is not deployed.
  Clients still use legacy paths; account-owned discovery/catalogs, provider/addon
  encryption, preference/transport parity, restart/stress qualification, gateway
  multi-output accounting and removal of legacy modules remain unfinished.

## Account live-catalog paging checkpoint — 2026-09-29

- Backend `e4cae75` adds account-scoped v2 live channel/category pages, using the
  persisted default or an explicit per-request catalog override. Unowned,
  disabled and absent catalogs do not fall back to another account's provider.
- Additive snapshot storage preserves provider stream/category order and logos,
  including HTTP logos. Catalog replacement and generation changes are atomic;
  failed refreshes retain the previous snapshot. Historical rows use insertion
  order until refresh because their original category order was not stored.
- Pages return at most 200 items (default 50), without a full count. Tokens bind
  account, filters, route, resolved catalog and generation; refresh/default
  changes require a restart instead of silently mixing snapshots.
- Full backend suite: 235 passed, four opt-in fixtures skipped; strict all-target
  Clippy passed. Fixtures cover complete 235-channel traversal, tenant isolation,
  defaults/overrides, original logos, bounds, snapshot invalidation and rollback.
- Paired devices can browse with a selected profile; restricted profiles still
  require parent unlock for raw catalogs. Child-policy migration, source/guide
  integration, owned connection CRUD/encryption, multi-provider VOD discovery and
  client adoption remain open. This does not complete the Xtream checklist item.
  No production database, provider subscription or deployment was used.

## Owned IPTV discovery checkpoint — 2026-09-29

- Backend `228b244` adds v2 incremental source-discovery start/poll routes and
  owned raw-channel Xtream guide reads. Candidate SQL filters account ownership;
  all enabled owned providers participate independently of the live default.
- Ownership and credential freshness are checked before queued detail requests,
  with ownership checks on cache access, enrichment and late publication. Polls
  redact a revoked provider's cached event without changing sequence positions.
  Raw scoped live reads bypass retired family-lineup mappings.
- Full backend suite: 239 passed, four opt-in fixtures skipped; strict all-target
  Clippy passed. The live-source fixture was additionally expanded and passed.
  Synthetic HTTP fixtures verify three-provider movie/exact-episode resolution,
  no requests to foreign/unassigned providers, cross-account job denial, sparse
  limits, revocation during fetch, cached-result redaction and owned guide reads.
- Source cards contain opaque backend IDs rather than provider credentials;
  internal HTTP live/episode URLs are preserved. No production provider was used.
  V2 currently uses polling, and restricted profiles require parent unlock.
- Connection CRUD/encryption, child-policy migration, detailed upstream errors,
  client cutover and legacy route removal are still incomplete. Existing legacy
  global discovery is not claimed to have the v2 isolation guarantees. No deploy
  or production migration occurred; the full Xtream checklist remains open.

## Provider credential migration checkpoint — 2026-09-29

- Backend `423484d` adds an encrypted Xtream tuple reader and an explicit offline
  `provider-owners encrypt` command. The operator keyring seals URL/username/
  password with account/provider/purpose binding. An explicit format marker
  prevents a missing ciphertext record from becoming a plaintext fallback.
- Private SQLite backup and advanced export are durable before transactional
  encryption. Source identities/history/manual matches remain; credential-bearing
  detail caches are invalidated. WAL checkpoint/compaction runs after commit;
  cleanup failure explicitly reports that encryption has already committed.
- Full backend suite: 242 passed, four opt-in fixtures skipped; strict Clippy
  passed. Final focused encryption fixtures also passed. Evidence covers rollback
  after a later invalid provider, preserved backups/history, no fixture plaintext
  in compacted DB/WAL, key/owner failures, restart schema/reader behavior, HTTP
  identity preservation, direct admission and CLI confirmation/keyring gates.
- Legacy connection mutation/pool paths reject migrated providers. Migrated
  native admission no longer uses cross-provider pool policy. Legacy family
  matcher snapshot schema was updated to avoid regressing unmigrated providers.
- This is not production-approved: backups/exports still contain plaintext;
  external copies and storage remnants are not securely erased. New connection
  CRUD, addon encryption, bulk rotation, child policy, client adoption and retired
  module removal remain open. No production data was read, migrated or deployed.

## Xtream connection management checkpoint — 2026-09-29

- Backend `7ccfbde` adds account-owned connection create/list/patch/delete and
  password renewal. Login validation precedes encrypted persistence; password
  renewal compares the prior ciphertext and preserves catalog identity. Server/
  login identity changes require a separate connection rather than guessed remaps.
- Connection pages are bounded and account-cursor scoped. Default assignment and
  fallback are transactional, and duplicate detection is account-local. Legacy
  plaintext rows require reviewed migration before v2 mutation. New registration
  is capped at 64 owned connections; larger existing sets remain readable.
- Scoped/encrypted Xtream fetches support HTTP and HTTPS with public destination
  validation, fresh DNS pinning, bounded responses/timeouts and no redirects or
  inherited proxies. Explicit test-only loopback access is not a production
  private-network policy. Reported native connection limits do not manufacture
  a one-stream allowance when the provider omits that information.
- Encrypted connections also seal cached Xtream detail/EPG payloads, which can
  contain upstream credentials. Missing or invalid encrypted cache entries do
  not become plaintext fallbacks. Deletion removes idle admission bookkeeping
  while existing permits retain their lifetime until playback cleanup.
- Full backend suite: 247 passed, four opt-in fixtures skipped; strict Clippy
  passed. Final management fixtures also passed, covering defaults, duplicates,
  account/device isolation, secret redaction, rejected login/redirect/rate/size
  responses, in-flight account revocation, encrypted offline cache reads and
  deletion while a native permit exists. Fixtures use synthetic HTTP providers.
- Account-scoped background refresh/initial indexing, addon encryption, private
  network operator policy, child policy, detailed playback error parity and all
  client/admin cutover remain open. The Xtream checklist item is not complete.
  No production migration or deployment occurred.

## Background catalog refresh checkpoint — 2026-09-29

- Backend `8ec2a6c` queues initial encrypted-connection imports transactionally
  and exposes account-owned refresh status/retry/cancel controls. Connection
  records include refresh state. Successful runs repeat after six hours; failures
  retry after five minutes while the prior snapshot remains available.
- Durable claims are bounded to two running catalogs and favor another waiting
  account. Runs are configuration-owned rather than browser-session-owned, with
  account/ownership/configuration revalidation, unique run tokens, 120-second
  deadlines and stale-claim recovery after 125 seconds. Missing keyrings fail
  explicitly instead of leaving indefinitely queued work.
- Protected login and sequential bounded index fetches precede atomic catalog,
  generation and success-status publication. Valid authenticated empty catalogs
  remain valid raw replacements. Cancellation/configuration changes and dropped
  workers invalidate late publication. Legacy refresh rejects encrypted sources.
- Full backend suite: 252 passed, four opt-in fixtures skipped; strict Clippy
  passed. Final focused refresh fixtures passed too. Synthetic HTTP tests cover
  initial import, failed refresh retaining the previous snapshot, successful empty
  replacement preserving favorites, in-flight cancellation, expired-token recovery,
  changed configuration, claim bounds/account fairness and missing keyrings.
- This is backend fixture evidence, not deployed/browser/native validation.
  Addon encryption, child-policy migration, detailed playback error parity,
  admin/client adoption, legacy removal and remaining gateway/cutover gates are
  still unfinished. No production provider, migration or deployment was used.

## Discovery error contract checkpoint — 2026-09-29

- Backend `2762f08` gives v2 producer failures readable `error` and stable
  `error_code` fields while retaining healthy sources. Guides preserve known
  provider/storage/key classifications, and discovery JSON/query/job rejections
  have structured responses. Unknown diagnostics are replaced with closed copy.
- Provider classification is shared by registration, refresh and discovery.
  Addon access/rate/timeout/protocol failures remain addon-specific; malformed
  successful addon payloads no longer silently become empty source lists.
  API 429 is not guessed to mean an IPTV stream connection limit.
- Request/body timeout predicates avoid formatting credential-bearing HTTP
  client errors. Interrupted bodies remain distinct from timeouts. Unsupported
  source registration has its own code, including when other sources are usable.
- Full backend suite: 257 passed, four opt-in fixtures skipped; strict Clippy
  passed. Synthetic fixtures cover 401/429/503, invalid JSON/success shapes,
  healthy-provider preservation, guide parity, addon failures, malformed discovery
  requests/queries, missing jobs, secret-redaction fallbacks and socket deadlines.
- This does not prove client presentation, native decoder errors, gateway media
  error classification or consistency of every remaining endpoint/extractor.
  Those and the other unchecked migration/cutover items remain open. No production
  migration, device playback or deployment occurred.

## Addon secret storage checkpoint — 2026-09-29

- Backend `ae2ce5b` encrypts addon URLs and complete manifests with account/ID/
  purpose binding. Configured-key installations and encrypted reinstalls use the
  protected store; settings redact URLs. Legacy conversion requires the separate
  backup-first operation, and protected accounts cannot downgrade new writes by
  removing keys or deleting every addon. New encrypted IDs are not reused.
- Small configuration revisions avoid hashing large encrypted manifests on
  playback checks. Addons use a separately bounded document envelope without
  widening normal gateway/provider secret limits. V2 source
  publication and polling recheck addon ownership/enabled state after revocation.
- Offline inspect/apply/encrypt-addon commands preserve IDs and require complete
  reviewed maps for unassigned records; initialization no longer assigns secrets
  to the first owner-role account. Private backup/export precede mutation, and
  compaction now also rebuilds the derived VOD FTS index to protect rowid-based
  search consistency. Backups/exports intentionally remain sensitive.
- Full backend suite: 265 passed, four opt-in fixtures skipped; strict Clippy
  passed. Final addon-focused fixtures passed too. Evidence covers large manifests,
  identity/redaction, key/owner/ciphertext failures, no downgrade, network install,
  late/cached revocation, explicit ownership, rollback, executable gates, private
  artifacts, preserved history and post-compaction search rebuild.
- This does not finish protected addon transport, guarded v2 management/client
  adoption, bulk rotation or legacy removal. Unmigrated compatibility writes still
  exist until cutover. No production database or deployment was touched; encrypted
  storage is not a claim of whole-database encryption or complete platform parity.

## Guarded addon management and egress checkpoint — 2026-09-29

- Backend `c16cdb3` adds v2 account addon create/list/enable/delete APIs, with
  bounded account-cursor pages, redacted manifest URLs and logo metadata. Writes
  revalidate authorization after network preparation and compare configuration
  snapshots, preventing stale reinstalls from resurrecting deleted sources.
- Paired devices can read redacted metadata with a selected authorized profile;
  mutations still require account sessions, and parent restrictions remain.
  Protected cache/flight namespaces cannot reuse legacy or other-account results.
- Shared JSON egress validates/pins every destination and rejects private/reserved
  addresses, userinfo and HTTPS downgrades. Addons support up to ten validated
  public redirects without ambient cookies, Authorization, Referer or automatic
  original-query copying. Xtream retains its no-redirect policy; HTTP remains
  supported. Separate install/check and viewing slots protect browsing capacity.
- Legacy unkeyed saves recheck encryption state transactionally after download.
  The document limit is stated as a serialized-payload bound, not a guarantee
  that every wire-size-bounded document has the same serialized size.
- Full backend suite: 275 passed, four opt-in fixtures skipped; strict Clippy
  passed. Final focused management fixtures passed. Evidence includes cross-origin
  redirects, loops/private targets/downgrades, account/device/parent rules, cursor
  isolation, stale/deleted configs, revoked sessions, cache trust separation,
  independent browsing slots and late legacy downgrade prevention.
- These are synthetic backend fixtures, not visual/device acceptance. Client/admin
  adoption, operator-managed private-network exceptions, child-policy migration,
  legacy removal and remaining gateway/cutover requirements stay open. No
  production migration or deployment occurred.

## Viewing-client VOD discovery checkpoint — 2026-09-29

- Core `4817b07` adds explicit v2 discovery request operations and generated
  Kotlin/TypeScript poll state retaining bounded, safe producer errors. Native
  bindings and WASM were regenerated; 52 workspace tests, strict Clippy and the
  actual WASM contract suite passed.
- TV-web `c431051` and Android `ad8c94d` pin that same revision and use v2 for
  movies/exact episodes. Empty failed jobs report actionable messages; partial
  success retains healthy sources. TV-web retries discard failed discovery jobs
  and HTTP failures no longer masquerade as backend connectivity outages.
- Backend `abc0de2` preserves approved children's VOD policy on v2 endpoints,
  sanitizes untrusted discovery hints and rejects invalidated policy scopes.
  Raw live/guide still require parent authorization. Backend suite: 276 passed,
  four opt-in fixtures ignored, strict Clippy passed.
- TV-web: 223 unit tests and production build passed. Two trusted local-HTTPS
  Chromium fixtures prove visible safe connection-limit errors, fresh retry and
  healthy partial results. API/artwork were synthetic, external traffic blocked;
  this is not real-provider, decoder or hardware acceptance.
- Android: JDK 17 host native preparation, both unit suites, all three Android
  ABIs and debug APK assembly passed. Native HTTP fixtures include safe empty
  failure and healthy partial results. No emulator or physical-device claim.
- Work remains on v2 playback lifecycles/gateway URLs, raw live paging and child
  live policy, admin/client management, quality/local-only removal and the
  remaining gateway/network/cutover gates. Legacy live/playback routes are
  explicitly temporary. No production migration or deployment occurred.

## Independent-gateway player preparation — 2026-09-29

- Video `75d533a`, adopted by TV-web `a701fe5`, separates delivery kind from
  processing mode and permits backend-authorized gateway fallback for native
  direct-capable clients. Gateway processing `direct` no longer implies an
  original-file timeline. Native HTTP direct inputs remain supported.
- Fetch-managed media/HLS supports a selected independent HTTPS origin/base path,
  fences dependent resources to its session directory, rejects redirects, and
  omits Authorization/cookies/Referer. Native HTML HLS remains browser-owned;
  gateway-side URL validation/rewriting and physical TV qualification are still
  required. This is not a claim of JS interception of native-HLS resources.
- Video: 103 tests, typecheck and build passed. Real Chromium decoded generated
  640x360 HLS across two trusted loopback HTTPS origins, including child playlist
  and segments. Seven observed requests were credential-free; Range survived,
  and a refused redirect never reached its target. No provider was contacted.
- TV-web: 223 tests, build and two HTTPS discovery regressions passed after pin
  adoption. Full v2 playback envelope/start/status/renew/release adoption is still
  pending, as are the remaining live/admin/gateway/cutover checklist requirements.

## Shared v2 playback lease contract — 2026-09-29

- Core `f48f983` adds generated lease/request/client types and closed platform,
  delivery-kind and lifecycle-status enums. Pending/terminal states never expose
  a session URL; ready gateway delivery requires HTTPS and excludes credential
  headers. Native direct HTTP delivery preserves validated source headers.
- Canonical v2 start/status/heartbeat/stop serialization preserves real 4K
  capability facts. Unknown legacy options are rejected rather than silently
  dropped. Expiry is normalized to Unix milliseconds; renewal remains seconds.
- Core: 57 native tests, strict Clippy, generated native/WASM builds and actual
  WASM contracts passed. Android `773a820` and TV-web `03435ee` pin the same core.
  Android host/unit/three-ABI/APK checks passed, with a JNI/generated-Kotlin lease
  decoding fixture. TV-web passed 223 tests, build and two HTTPS discovery checks.
- This is protocol adoption, not activated v2 playback. The start/poll/renew/
  release client loops, conversion and track-preference parity, raw live migration
  and all other remaining checklist gates stay open. No production work occurred.

## V2 playback client transport — 2026-09-29

- TV-web `0893c84` adds explicit canonical v2 start/status/renew/release methods.
  Startup polling checks identity/expiry under a 45-second deadline. Cancellation
  releases known admissions; ambiguous network/proxy admissions are reconciled
  with the identical request id/body then released under a separate five-second
  cleanup bound. Control traffic never follows the delivery URL.
- Eleven API-boundary fixtures cover pending/ready, cancellation before/after
  admission, ambiguous POSTs, definitive refusal, malformed/mismatched responses,
  expired/failed renewal and startup/cleanup deadlines. Full TV-web suite: 234
  passed; typechecks/build passed. Two existing HTTPS discovery regressions
  passed after the build completed; an overlapping pre-completion run failed and
  is not counted as evidence.
- The ordinary player path remains unconverted. Capability/track/conversion
  mapping, active renewal/background recovery and Android/Roku adoption still
  need implementation and integration evidence. All other open checklist gates
  remain open. No real provider, production migration or deployment was involved.

## Gateway conversion and track options — 2026-09-29

- Gateway `dc70c7f` exposes generic auto/audio/video/audio_video conversion plus
  explicit track and bounded language-preference controls. Its existing inspected
  planner receives these values; no VIPTV identity or arbitrary execution args
  enter the gateway contract. Subtitle-off conflicts are rejected explicitly.
- Backend `58b462f` validates/forwards the choices and requires an authorized
  gateway for explicit conversion/server-side track changes even on native clients.
  Native direct preference metadata is separate; 4K decoder dimensions survive.
  Changed choices conflict with an existing idempotency request as intended.
- Gateway: 87 tests passed, 20 opt-in fixtures ignored, strict Clippy passed.
  Backend: 277 tests passed, four opt-in fixtures ignored, strict Clippy passed.
  Router fixtures prove no-gateway refusal and exact authorized output forwarding.
- This is schema/forwarding evidence, not new real-codec or hardware acceptance.
  Shared-core option mapping, profile-preference integration, ordinary player
  activation, fresh gateway packaging and the rest of the checklist remain open.
  No production or provider traffic was involved.

## Shared player-option mapping — 2026-09-29

- Core `4418f1d` generates conversion/track preference fields and implements
  playbackV2Intent, mapping measured player facts and options into the canonical
  request. It preserves 4K dimensions, omits profile quality caps, maps scoped
  audio/video conversion, and resolves explicit subtitle-off without contradictory
  track preferences. Direct response language metadata remains bounded.
- Core: 59 tests, strict Clippy, native/WASM builds and WASM contracts passed.
  TV-web `36b6278` and Android `08c9eea` pin the same core. TV-web passed 235 tests,
  build/typechecks and two HTTPS discovery regressions. Android passed host/unit,
  three-ABI and APK checks with an actual JNI/generated-type mapping fixture.
- These API/native bridge checks are not ordinary player activation, real gateway
  decoding or device acceptance. Backend profile preference resolution, active
  client lifecycle ownership and the remaining original checklist stay open.

## Backend profile defaults for v2 playback — 2026-09-29

- Backend `e6b12df` snapshots the authenticated selected profile's audio and
  enabled subtitle languages for new admissions, with explicit overrides and
  subtitle-off/track precedence. Reads revalidate the lease off the async runtime.
- Idempotency remains based on the caller's body: changing saved preferences
  does not alter an existing playback or break its retry; a new request uses
  updated defaults. The legacy profile quality cap is not applied to v2.
- Full backend suite: 278 passed, four opt-in fixtures ignored; strict Clippy
  passed. The new fixture covers native metadata, managed output defaults,
  overrides, subtitle-off, stable retries and unchanged 2160p decoder facts.
- Ordinary player activation, active renewal/background recovery, other clients,
  raw live migration and all remaining original checklist gates are still open.
  No production migration, deployment or hardware qualification occurred.

## Active viewing-client VOD cutover — 2026-09-29

- TV-web `64e8b9f` activates normal movie/exact-episode playback through v2 in
  both React and SolidTV. Platform facts, conversion and track options use the
  shared mapper; active leases renew, expire, and revalidate on foreground return.
  Refusal stops media; retries cannot reset expiry, and late renewals cannot
  restore a released cache entry. Old VOD responses fail instead of bypassing v2.
- Video `f4218cb` adds operation-scoped admission cancellation, generation-safe
  stop acknowledgements and one authorized proxy attempt for failed direct media
  transport without forcing encoding. Backend `0969694` applies browser HTTP/
  header restrictions to webOS HTML delivery as well as ordinary web playback.
- TV-web: 243 tests/build/typechecks passed. Video: 106 tests/build passed.
  Backend: 278 tests/strict Clippy passed. Twenty-seven trusted HTTPS app cases
  passed using synthetic API/decoder boundaries, including failed Next/Resume,
  foreground revocation, Back/Forward, remote controls and queue behavior.
- SolidTV Home playback/release/failure/retry passed in browser simulations for
  Tizen, Vizio and webOS, with platform and v2 release assertions. The required
  canvas TvPlayer resume/seek capture passed and was inspected privately. No
  physical-TV, full visual-parity or production qualification is claimed.
- Live still uses the explicitly tracked legacy path. Android/Roku playback,
  installed desktop/custom-header and track parity, raw catalogs, quality/local-
  only control removal, admin work and remaining gateway/cutover gates stay open.
  In particular, the native desktop adapter still needs auditing beyond its
  Cookie/User-Agent forwarding; this checkpoint does not certify arbitrary source
  headers on installed desktop players. No production changes occurred.

## Active Android VOD cutover — 2026-09-29

- Android `2806204` activates v2 movie/exact-episode playback through native core,
  with phone/TV facts, bounded startup and independent cancellation cleanup.
  Lease renewal/expiry now retires playback instead of swallowing every failure;
  foreground validation respects newer pause intent, preserves title position
  for recovery and stops stale progress writes. Safe HTTP error codes survive.
- Gateway delivery no longer trips the old direct-only rejection. Managed output
  starts at native zero with its title offset even when processing mode is direct;
  original HTTP URLs keep required headers. Server language/track metadata feeds
  native options. Copy URL rejects gateway capabilities and releases its lease.
- JDK 17 host/native preparation, 123 library/app tests (no failures or skips),
  three Android ABIs and debug APK assembly passed. Eleven new coroutine/JNI
  cases exercise admission, cancellation, deadlines, renewal, safe failures and
  managed timeline semantics. Wire fixtures cover platform/header/progress/copy
  behavior. The APK was not installed or deployed in this pass.
- Live playback, Android same-source gateway fallback after decoder refusal,
  emulator/codec/PiP qualification, Roku, raw catalogs and all other remaining
  original gates stay open. This host evidence is not device acceptance.

## Native direct headers and desktop promotion — 2026-09-29

- Video `058bfb1` preserves all required original-source headers through Tauri,
  rejects invalid/conflicting credentials before replacing active native media,
  and explicitly refuses unsupported header transports. Direct transport/header
  refusal may request gateway proxy output once, without forcing encoding.
- Native plugin `c7e4aa6` validates requests and emits safe typed authorization,
  connection and missing-source errors rather than raw engine/debug strings.
  Linux real header-required HTTP MP4 decode/seek and HTTP401 refusal passed;
  all 13 native tests/strict Clippy and 31 JS tests/build passed. Windows mirrors
  the classification but was not built/run on Windows.
- TV-web `6ede3ca` pins the player and passes 244 tests/typechecks/build, 32
  trusted-HTTPS browser cases and SolidTV Home/player simulations. Five initial
  preview-fixture cases used the wrong API origin; the corrected local-origin
  rerun passed. Capture inspected privately; no screenshot/physical parity claim.
- Desktop `5812aad` pins that UI plus matching core/native revisions. Linux
  cargo check and five shell tests passed; one existing real-device test ignored.
  Installed surface, Windows installers, 4K/track/device evidence and remaining
  original gates are open. No production work occurred.

## Android same-source delivery recovery — 2026-09-29

- Android `0da5c80` applies the authorized same-source direct/gateway/conversion
  ladder to initial open and active decoder refusal. Conversion only follows
  decoder failure; control refusals and HTTP access/limit/missing-source causes
  do not trigger it. Source/position/tracks stay fixed; successful delivery intent
  survives seek/pause/track replacements and resets for a new source.
- Failed admitted media releases before retry under a separate five-second bound.
  Cancellation/stale generations cannot advance the ladder. Nine new pure,
  coroutine and native-core/HTTP fixtures passed; full host suites: 132 passed,
  no failures/skips. Three ABIs, debug APK and lint passed with existing warnings/
  baseline findings. The APK was not installed, published or deployed.
- Live, Roku, raw catalogs, emulator/codec/PiP and real managed native playback,
  quality/local-only cleanup, admin and all other original gates remain open.

## Roku VOD leases and managed timeline — 2026-09-29

- Roku `3438995` migrates movie/exact-episode discovery and playback to v2.
  Device facts retain 2160p declarations; gateway delivery is mandatory, with
  no native original-URL attempt if authorization is absent. Startup/polling,
  cancellation and identical-body reconciliation have independent bounds.
- V2 controls stay on the configured HTTPS backend. Active/paused/seek/Next
  admissions retain individual logical leases. Definite refusal/expiry stops
  media; network retries cannot extend the deadline, and late heartbeats cannot
  recreate released entries. Gateway processing direct stays a managed timeline.
- Managed Pause freezes title time; Resume replaces at that anchor rather than
  continuing a stale HLS window. Partial discovery retains healthy sources and
  safe causes. Viewing geometry/account/profile/history semantics are unchanged.
- All 31 runtime harnesses, seven static scripts, standalone v2 contract,
  BrighterScript 0.73.1 compile/staging and design/migration integrity passed.
  Two ZIP candidates were built, not installed. HTTP/device/SceneGraph boundaries
  are fixtures; the older broad schema simulator could not run with missing
  native registry/filesystem types and is not counted as passing evidence.
- Four existing extraction-inventory mismatches were traced to committed
  `8e24931` font/artwork/error changes and documented without changing those
  runtime bytes. Original extraction hashes remain. No production work occurred.
- Raw live catalogs/playback, real backend/gateway/device media, background/TLS/
  redirect/4K/tracks, legacy cleanup, admin and all other original gates remain
  open. This does not complete the all-client or integration checklist items.

## Exact live source and shared cursor preparation — 2026-09-29

- Backend `4d7fadb` adds exact selected-channel source resolution without addon
  fan-out or a discovery job. Opaque cards expose no media authority. Ownership,
  enabled live scope, parent policy and credential proof are rechecked; old URLs
  cannot acquire a newer credential fingerprint. Native direct v2 admission/
  release from that exact source passed with synthetic HTTP input.
- Raw catalog pages now support profile-owned favorites/recent subsets of the
  selected/default provider, retaining provider order. Personal cursors bind the
  authenticated selected profile; foreign/default/override/composite isolation,
  no caller profile override, bounds and no total counter pass route fixtures.
  Backend: 281 tests passed/four opt-in ignored; strict Clippy passed.
- Core `b75393e` generates raw live/category pages and canonical cursor/source/
  guide requests without legacy offset/US/family filters or fabricated totals.
  Provider order/HTTP logos survive. Opaque source parsing rejects URL/header
  authority. All 63 native tests, strict Clippy, generated Kotlin/native/WASM and
  actual WASM contracts passed. No production state was accessed or changed.
- TV-web `bf92331` and Android `7f2652a` pin that same core and expose tested
  explicit transports. TV-web: 250 tests/typechecks/build plus 32 trusted-HTTPS
  browser regressions passed. Android: 137 tests, a fresh 108-app-test rerun,
  three ABIs, APK and lint passed. Bodyless native POST support was fixed.
- The first Android JVM run aborted with native RustBuffer assertions/SIGSEGV.
  The same library's C ABI check and later JVM runs did not reproduce it; its
  cause is unresolved and its crash record stays private. Passing reruns do not
  close native stress/device qualification. No installation or deploy occurred.
- Ordinary Guide/Home/SolidTV live callers still use legacy paging/playback.
  This is transport preparation, not a completed cursor/lease cutover. Default
  playlist swap UI stays deferred. Roku, quality/local-only/embedded-engine and
  advanced-policy removal, admin, integration and all original gates remain open.

Initial audit: playback engine is a local crate; managed job sharing and provider
reservations still cross the backend boundary. Providers are server-wide while
add-ons already have account ownership. The VOD matches endpoint materializes
the candidate set before filtering; native direct playback bypasses sharing.

## Android Title and desktop qualification checkpoint — 2026-10-02

- AND-043 is specified at design `85a20e9`, published in design PR14/main
  `450e788`. Android PR13/main `3f21e41` adopts that immutable contract: bounded
  settled source summaries shared with the manual picker, Core ranking, phone
  300dp hero/58dp controls, TV WATCHING state and original source-control focus
  after Back. Exact-source Resume and TV geometry are preserved.
- Android reviewed source `fa4925b` integrates the concurrent delayed-episode and
  pointer-return fixes. Host tests: 237 pass. Actual API36 Compose tests: 20 pass,
  including source→picker→Back, subsequent Play return, delayed episode metadata
  and pointer hero return. Three Core ABIs, APK/test APK, integrity and lint pass
  with existing warnings/baseline findings. This does not establish full Title
  discovery/picker flow or physical-device parity.
- Android PR14/main `02f33b5`, reviewed qualification source `199eb34`, fixes the
  local fixture's flat playback/renewal adapter drift and verifies a 240-second
  Media3 stream with two audio/two subtitle tracks. Actual TV Back and English
  selection return to Subtitles; immediate OK reopens that panel with the native
  selected-track marker. The English cue was privately inspected. App source,
  design pin and TV layout are unchanged. Managed replacements, alternate audio
  and physical TVs remain unqualified.
- The fresh pinned TvLive/TvLiveDetails/TvLiveSearch audit records Guide summary,
  filter/grid dimensions, logo/programme details, progress/key hints and panel
  differences. BACKEND_V2 supersedes old US classification/count copy. The
  no-TV-layout-change constraint leaves presentation gaps explicit; complete
  Guide details/search/remote acceptance remains open under design#6.
- Desktop PR8/main `a8abcf2`, reviewed source `5fcc6c7`, fixes packaged entry
  assets served at the wrong `/tv/` base and Core WASM CSP compilation/fetch
  failures. Desktop-owned root-base/preflight/CSP changes preserve the pinned
  TV-web/native dependencies. Native checks/tests, frontend checks and fresh
  AppImage packaging pass. Native accessibility startup, authentication, retained
  session and profile selection pass against a fresh local real backend/DB.
- Desktop board inspection now covers 45/47 states; DeskPlayerRestore timed out
  and DeskStates is composite. Rendered pixels/input, installed window controls
  and authenticated native playback remain unqualified. Source artwork framing
  and the profile-lock backend-field gap remain open. See desktop RELIABILITY.md;
  no complete parity or physical/native matrix claim follows from browser or
  accessibility inspection.

These are scoped source/function/qualification checkpoints. Broad design#3,
design#6 and desktop#4 acceptance, physical/signing gates, design review and the
coordinated backend rollback/cutover remain open. Private captures and fixture
credentials are excluded from Git; owned test resources were stopped. No
deployment, production data access or migration occurred.

## Integrated consumer qualification — 2026-10-02

These reviewed source and local-runtime checkpoints supersede only the matching
unqualified slices above. They do not complete broad platform, pixel, hardware,
signing or production acceptance.

- Design PR16, normative `1742afa2b50d30638fa46f3abc8c1a76638a51e1`, defines
  private approved addon torrent inputs and authenticated gateway HLS for web,
  desktop and Android. Backend PR7 adopts capability/scope/source fingerprint
  checks; Core PR5, TV-web PR8 and Android PR15 adopt its source copy and pins.
  Manual torrent entry and the in-process native facade remain deferred.
- Gateway PR16 qualifies the actual service/API, selected file, authenticated
  two-viewer playback, seek and renewal/release. PR17 qualifies previously-ready
  cache ENOSPC recovery and active process crash/restart separately from
  preparation ENOSPC. PR18 qualifies trusted-HTTPS WebCodecs decoded seek,
  UID10001/zero-capability/NoNewPrivs service, prompt default cache/peer teardown.
  Backend PR9 removes the account/catalog/playback projection from the browser
  path: actual fresh account/profile/vault/addon/source/gateway APIs pass.
- Gateway PR21 and backend PR12 add controlled DHT/BEP9 metadata bootstrap,
  one/three-peer and repeated fresh-process cases. Final tested driver
  `fbaac48c4628c918e4788250055d4562fd3b1270`, TV-web `ea173349`, Core `f66c87e`
  and Video `550ab350` pass a 70.09-second case with three payload contributors,
  decoded three-second seek, two renewals/releases, all input/output/viewer
  capacity reclaimed, cache removal and peer retirement. This is bounded
  generated-media qualification, not public/hostile swarm or long-duration proof.
- Android PR18 adopts Core `f66c87e` with fresh 237 host tests, three native ABI
  builds and system-trust normal APK/lint checks. PR19 qualifies the actual
  Guide/controller HTTPS filter/Search/future-programme/native-Back chain with
  identical returned node/bounds/focus and no new playback. Key/text/IME actions
  use Compose semantics; OS keyboard UI and app-shell rail remain separate.
- Android PR20, tested source `1007787461d6d6c088d35717cbea45d0f07f0e27`, and
  backend observer PR11 qualify actual ApplicationShell/backend/gateway/Media3
  HLS input replacement, immediate Audio Back/reopen, decoded managed seek and
  four lease DELETE200 responses. Actual served TS bytes match one observed
  FFmpeg `0:2` input map. Input descriptor spa and encoded output AAC/und are
  distinct; identical silent samples do not establish audible Spanish. All
  2/2/4 gateway capacity, cache and peer resources reclaim; the owned runner
  exits zero. Synthetic session provisioning excludes login/pairing acceptance.
- Core PR6 and TV-web PR9 preserve received-invalid HTTP status and bound
  connectivity retries to ten seconds, avoiding the observed rapid banner loop.
  Video PR5/6/7 qualify asynchronous native seek acknowledgement and cleanup
  ordering. Plugin PR5/6 repairs GTK allocation/centered aspect-preserving Fill
  and retires native engines/proxy capabilities during host shutdown. Plugin
  PR7 `d80d0715` replaces malformed MPV header lists with a caller-owned atomic
  node array; a real complete load/replacement regression verifies authorization,
  commas/backslashes and prior-header retirement.
- Desktop PR11, source `825e5c4`, pins TV-web `ea173349`, Core `f66c87e` and
  plugin `d80d0715`. Actual authenticated GStreamer and MPV decode, +30-second
  GStreamer seek without false failure, actual Engine Info and genuine KWin
  Close/DELETE200/exit0/audio0 are recorded. A real blocked-GTK close releases
  its lease at 0.183 seconds and exits at 20.104 seconds through the independent
  watchdog. These are clean custom-protocol debug-native results; fresh Linux
  package/HLS, playing overlay/Fit/resize input/pixels and full matrix remain
  separate. Stale/black/wrong-window captures were excluded.
- TV-web PR10 `ea173349` qualifies responsive pending Home skeletons, usable
  saved cards, early cold-route restoration and cancelled Home reload on browser
  Back through four full React/API regressions. 265 app tests/type/integrity/build
  pass; all seven intended DeskStates were privately inspected over trusted local
  HTTPS with API/media mocks. This adds a scoped composite-state inspection,
  not installed decoding or uniform pixel parity; DeskPlayerRestore remains
  incomplete. Backend PR10 and desktop PR11 adopt the reviewed UI source.

Remaining safe work is tracked in the owning issues: installed Linux package
and native gateway playback, actual shell/OS-IME Guide and phone text/inset
qualification, and remaining per-state runtime/visual evidence. Android TV Guide
presentation gaps remain measured under the standing layout scope. Profile
target-PIN drawings conflict with the current session-dependent switch-away
policy; that security-policy choice remains unresolved. Physical devices,
clean-machine Windows/macOS/signing, private branch-protection governance/plan
and rollback/cutover require separate evidence and authority. Original Android
work is preserved. No production access, migration or deployment occurred.
