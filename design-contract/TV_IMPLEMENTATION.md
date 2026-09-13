# Android TV, Tizen and Vizio implementation

Status: implementation authorized 2026-09-12. This adds platform implementations of the existing Roku baseline; it does not change Roku behavior. Android TV uses native Jetpack Compose. Tizen and Vizio use one React frontend in viptv-org/tv-web with a replaceable platform player module. React is selected here to share the existing TypeScript controller ecosystem and permit automated DOM/remote acceptance; SolidTV/LightningJS is not required for the shared-frontend contract.

The shared Tizen/Vizio presentation replacement is governed by [TV_WEB_UI_REBUILD.md](TV_WEB_UI_REBUILD.md). Design updates and per-platform acceptance follow [DESIGN_SYNC.md](DESIGN_SYNC.md). Historical functional checks do not qualify replacement visuals.

## Product contract

Implement the visual, interaction and server queue specifications under specs/. Use the canonical 1280×720 TV frame uniformly scaled to viewport. Preserve pairing/profile gates, stable Home shelves/hero, Discover/search, movie and series/episode detail, manual sources, exact-source Resume, controlled Next, My List/queue/corrections, Guide, preferences, profiles and parent unlock behavior. Media loading and failure retain the same source/position/focus intent. UI assets come from design with pinned provenance; no screenshot files are committed.

Both web TV builds consume identical UI/controller code. Tizen uses AVPlay; Vizio receives device-compatible media through an HTML media adapter. Native web preview is a testing/hosted mode, not evidence about a physical TV decoder. Transcoding remains last resort after runtime-compatible direct/copy/remux paths. Android TV uses the Android-only Media3 module through its native Compose app.

## Input equivalence

D-pad maps to spatial focus. OK/Enter activates on release; a supported secondary action fires once at 700ms and suppresses the release activation. Menu/Info/right-click exposes the same secondary actions. Back/Escape/Tizen Return closes the innermost dialog or seek preview, then player chrome/player/route as specified. Android uses system Back. Platform app exit is delegated to the host; a browser preview with no exit API retains the Home screen and provides a concise Home-remote hint. Playback media keys preserve live versus VOD behavior.

The shared web on-screen keyboard replaces Roku MiniKeyboard while retaining keyboard/results regions, 650ms debounce, focus and text-entry meaning. A PIN displays bullets, keeps its draft during recoverable errors, and never logs or stores the PIN. Pairing/device tokens are scoped to one app installation; profile transitions cancel old work and clear profile-owned UI immediately.

## Test interfaces and evidence

The user authorized work without questions. Test interfaces are the public app remote/DOM/Compose UI, existing backend HTTP contract, and player adapter interface. Use the Matt TDD skill with red→green vertical slices. Mock external AVPlay/media/network boundaries, not internal application collaborators. Integration tests cover actual route transitions and source intent. Browser automation inspects render geometry/focus and runs both Tizen and Vizio configurations through the same scenarios.

Required scenario groups: pairing pending/approved/expired/error/retry; profile choose/create/edit/avatar/delete/primary protection/unlock; Home focus/hero/loading/back; Discover filters/paging; search keyboard/debounce/results/failure; movie/series/season/episode state; manual source paging/filter/explicit selection/Resume exact identity; player pause/seek/repeat/debounce/cancel/rollback/tracks/exit; Next scoped selection/last-ten eligibility/cancel/previous Resume; queue hide/undo/watched/history; live guide future OK versus Play/filters/windows/gaps; settings/source preferences/addons/signout; stale request/session cancellation; offline and partial failures.

Measure actual automated results against each group. A passing simulation is not a claim of 100% physical Tizen/Vizio/Android TV compatibility. Report untested hardware codec/DRM/signing/store constraints with the artifact. The owner deferred emulators after server OOM, then resumed testing on real hardware and bounded browser workers; follow TV_CANDIDATE_2026_09_12.md for current resource constraints. Screenshots may be created under ignored test-results/artifacts for inspection, never in design or packaged application artifacts.

Current implementation and joint-testing checkpoint: [TV_CANDIDATE_2026_09_12.md](TV_CANDIDATE_2026_09_12.md).
