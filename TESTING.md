# TV validation checklist

This checklist is intentionally evidence-based. A Playwright pass is browser simulation, not proof of AVPlay or Vizio playback. Screenshots are for local inspection only and are not committed.

## Current evidence

| Area | Evidence | Status |
| --- | --- | --- |
| Typed API boundary | `tests/api/client.test.ts` passed with 16 tests on 2026-09-12 | Current for the typed HTTP boundary; backend integration still required |
| TypeScript | `NODE_OPTIONS=--max-old-space-size=256 npx tsc --noEmit` passed on 2026-09-12 | Current source type check |
| Browser UI | Pairing, browse, source selection, guide, search, settings, profiles, held actions, resume mismatch, stale responses and Discover request contracts | 2026-09-12: full two-project suite passed 27 tests with 15 intentional platform exclusions, one worker and 256 MB Node heap; includes five Next/Resume scenarios and three pairing lifecycle scenarios per project |
| Vizio browser media | `tests/e2e/media-decode.spec.ts` records a local canvas WebM and drives the real HTML adapter through pause, seek, end and cleanup | Passed in the Vizio browser project; it does not establish playback on a physical Vizio model |
| Backend `/tv` static routes | Rust route test added with the backend change | Not run here; Runtime tests deferred by owner |
| Tizen AVPlay | Adapter and hosted-launcher path implemented | Physical TV/emulator evidence pending |
| Vizio | HTML adapter and same-origin hosting bundle implemented | Physical TV evidence pending |

All 39 unit tests across API, remote input, Guide, text entry and player adapters/controllers passed, along with TypeScript and diff checks. The intermittent initial-focus/OK race was reproduced in the full suite; its fix passed three successive runs of all five Next scenarios (15/15) and the final complete browser suite.

No entry above establishes 100% device coverage. Remaining scenario gaps are tracked in [tests/PARITY_MATRIX.md](tests/PARITY_MATRIX.md).

## Low-memory order

Run one command at a time after confirming the server is stable. Keep browser workers at one and do not run a production build alongside Rust tests or Playwright.

```sh
# API boundary only
NODE_OPTIONS=--max-old-space-size=512 npm run test -- --run tests/api/client.test.ts

# Static type check only
NODE_OPTIONS=--max-old-space-size=512 npx tsc --noEmit

# One browser project at a time; this starts a single Vite server and one worker
NODE_OPTIONS=--max-old-space-size=768 npx playwright test --project=tizen --workers=1
NODE_OPTIONS=--max-old-space-size=768 npx playwright test --project=vizio --workers=1
```

Run the backend route tests separately in the backend checkout with the configured Rust environment:

```sh
cd ../backend/server
CARGO_BUILD_JOBS=1 cargo test --locked --test dashboard_routes tv_bundle_has_its_own_same_origin_mount_without_replacing_dashboard_or_api -- --nocapture
```

Only then run a production build or package candidate, one at a time:

```sh
NODE_OPTIONS=--max-old-space-size=768 npm run build
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
