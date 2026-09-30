# BE-002 / ADM-002 implementation ledger

This is an execution checklist, not a completion claim. User decisions are in
[BACKEND_V2.md](BACKEND_V2.md) and [ADMIN_V2.md](ADMIN_V2.md).

- [x] Approved decisions captured; production mutation excluded.
- [ ] Versioned public contracts and migration fixtures executable.
- [x] VOD 10k/100k baseline captured and bounded query implemented.
- [x] Independent engine extraction and container build.
- [ ] Gateway key scopes, jobs, viewer leases and safe media ingress.
- [ ] Backend HTTP gateway selection/affinity and encrypted secrets.
- [ ] Account-owned Xtream, default playlist and catalog paging.
- [ ] Advanced configuration export and reviewed migration tool.
- [ ] Local-only and embedded engine paths removed after cutover tests.
- [ ] Maximum-quality feature removed; actual device limits retained.
- [ ] Admin website rebuilt; VOD matching stays available and bounded.
- [ ] All client logic/contracts updated with unchanged viewing layouts.
- [ ] Cross-repository integration, browser/native checks and packages.
- [ ] Reviewed rollback/cutover instructions ready (no production execution).

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
