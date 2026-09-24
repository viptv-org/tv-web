# Android TV, Tizen, Vizio and LG webOS implementation

## Proposed TV-only LightningJS renderer migration — 2026-09-24

Status: authorized, implementation and parity review in progress. The current
React TV implementation at `viptv-org/tv-web@6f335d7631e1334be398b7aa5977ce4ce51ac50a`
is the behavioral and rendered baseline for this renderer replacement. Tizen,
Vizio and LG webOS will use one LightningJS Blits component tree with the
Lightning renderer and focus/input lifecycle. The React phone, responsive web
and Tauri desktop entry remains as it is. The new TV renderer is staged behind
a separate entry until the migration qualifies for those TV launchers. Roku and
Android TV retain their separate native implementations.

The canonical TV reference frame is **1920 × 1080** with a 96 × 54 safe area,
as specified in `viptv-design-system/`. Every TV screen and visible state keeps
the same copy, assets, color, typography, spacing, selection and focus treatment
as the current TV UI. The new renderer may not borrow the React DOM focus
registry or simulate Lightning by wrapping the existing UI. It uses the same
API, shared core and platform playback contracts so renderer replacement does
not change pairing, profiles, source identity, Resume, controlled Next or queue
semantics. The 700 ms OK hold fires once, suppresses release activation, and
retains Menu/Info equivalents. Directional, Back and media-key transitions,
focus restoration, loading, error, cancellation and return flows must match the
existing TV behavior in each platform adapter.

Acceptance is per matched-content state, not a build-wide claim. Capture the
current React TV result and new Lightning result at 1920 × 1080, device scale
1, with the same backend fixture, fonts, artwork, appearance and focus. Record
changed-pixel count, MAE, RMSE and SSIM, then inspect an amplified difference
image. The target for the renderer migration is zero changed pixels against
the current TV output; compare the same capture to the pinned design WebP as
a separate design-parity measurement. A nonzero result remains an open
deviation until corrected or explicitly approved with its measured extent.
Run input/flow acceptance for Tizen, Vizio and webOS browser configurations;
record real-device playback, latency, navigation and signing separately.
Screenshots and diff images stay in ignored test output. Do not switch packaged
TV launchers or claim hardware qualification before those checks are complete.

Historical status: implementation authorized 2026-09-12. This added platform implementations of the existing Roku baseline without changing Roku behavior. Android TV uses native Jetpack Compose. Tizen and Vizio originally used one React frontend in viptv-org/tv-web with a replaceable platform player module. The proposed TV-only renderer migration above supersedes that choice for Tizen and Vizio and adds webOS as a target.

The shared Tizen/Vizio presentation follows the design system in [viptv-design-system/](viptv-design-system/README.md) (TV reference screens, 10-foot rules). Design updates and per-platform acceptance follow [DESIGN_SYNC.md](DESIGN_SYNC.md). Historical functional checks do not qualify replacement visuals.

## Product contract

Implement the visual, interaction and server queue specifications under specs/. Use the canonical 1920×1080 TV frame uniformly scaled to viewport. Preserve pairing/profile gates, stable Home shelves/hero, Discover/search, movie and series/episode detail, manual sources, exact-source Resume, controlled Next, My List/queue/corrections, Guide, preferences, profiles and parent unlock behavior. Media loading and failure retain the same source/position/focus intent. UI assets come from design with pinned provenance; no screenshot files are committed.

Both web TV builds consume identical UI/controller code. Tizen uses AVPlay; Vizio receives device-compatible media through an HTML media adapter. Native web preview is a testing/hosted mode, not evidence about a physical TV decoder. Transcoding remains last resort after runtime-compatible direct/copy/remux paths. Android TV uses the Android-only Media3 module through its native Compose app.

## Input equivalence

D-pad maps to spatial focus. OK/Enter activates on release; a supported secondary action fires once at 700ms and suppresses the release activation. Menu/Info/right-click exposes the same secondary actions. Back/Escape/Tizen Return closes the innermost dialog or seek preview, then player chrome/player/route as specified. Android uses system Back. Platform app exit is delegated to the host; a browser preview with no exit API retains the Home screen and provides a concise Home-remote hint. Playback media keys preserve live versus VOD behavior.

The shared web on-screen keyboard replaces Roku MiniKeyboard while retaining keyboard/results regions, 650ms debounce, focus and text-entry meaning. A PIN displays bullets, keeps its draft during recoverable errors, and never logs or stores the PIN. Pairing/device tokens are scoped to one app installation; profile transitions cancel old work and clear profile-owned UI immediately.

## Test interfaces and evidence

The user authorized work without questions. Test interfaces are the public app remote/DOM/Compose UI, existing backend HTTP contract, and player adapter interface. Use the Matt TDD skill with red→green vertical slices. Mock external AVPlay/media/network boundaries, not internal application collaborators. Integration tests cover actual route transitions and source intent. Browser automation inspects render geometry/focus and runs both Tizen and Vizio configurations through the same scenarios.

Required scenario groups: pairing pending/approved/expired/error/retry; profile choose/create/edit/avatar/delete/primary protection/unlock; Home focus/hero/loading/back; Discover filters/paging; search keyboard/debounce/results/failure; movie/series/season/episode state; manual source paging/filter/explicit selection/Resume exact identity; player pause/seek/repeat/debounce/cancel/rollback/tracks/exit; Next scoped selection/last-ten eligibility/cancel/previous Resume; queue hide/undo/watched/history; live guide future OK versus Play/filters/windows/gaps; settings/source preferences/addons/signout; stale request/session cancellation; offline and partial failures.

Measure actual automated results against each group. A passing simulation is not a claim of 100% physical Tizen/Vizio/Android TV compatibility. Report untested hardware codec/DRM/signing/store constraints with the artifact. The owner deferred emulators after server OOM, then resumed testing on real hardware and bounded browser workers; keep emulator and browser-worker use bounded. Screenshots may be created under ignored test-results/artifacts for inspection, never in design or packaged application artifacts.
