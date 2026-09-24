# SolidTV performance comparison — 2026-09-24

The optimized SolidTV entry is faster than this application's React TV entry
in the tested startup and sustained navigation workloads. At 4× CPU
throttling, median Home readiness improved from **511.6ms to 455.3ms (11%)**,
and main-thread work per key from **11.725ms to 4.797ms (59%)**. This is a
comparison of implemented app paths, not a universal framework claim.

| 4× CPU, hardware WebGL | React TV | SolidTV |
| --- | ---: | ---: |
| Home focus-ready, median | 511.6ms | 455.3ms |
| First guide channel focus-ready, median | 138.1ms | 126.9ms |
| Keydown listener work, p95 | 2.1ms | 1.3ms |
| Keydown to focus update, p95 | 22.7ms | 0.5ms |
| Keydown to two frame opportunities, p95 | 70.5ms | 36.8ms |
| Main-thread work per key, median | 11.725ms | 4.797ms |
| Frame interval, p95 | 16.7ms | 16.8ms |
| Frame intervals over 33.4ms / long tasks | 0 / 0 | 0 / 0 |
| Post-GC JS heap after Home and guide | 5.560MiB | 6.673MiB |
| Decoded JavaScript fetched | 1197.047KiB | 528.422KiB |

All speed/frame gates passed at 1× and 4×. At 1×, median startup was
189.4ms versus 175.3ms and main-thread work/key was 3.752ms versus 1.847ms.
At 8×, startup was 1007.9ms versus 888.2ms and work/key was 23.403ms versus
8.430ms. The 8× strict gate **failed first guide entry**: SolidTV took
250.5ms versus React's 237.2ms. The other seven 8× checks passed, with no
sampled frame stalls or long tasks. Do not omit this exception when reporting
stress results.

SolidTV retains visited screen subtrees for fast return and stable focus.
After visiting the guide it used **1.113MiB more JS heap (20%)** in this
fixture. Heap figures exclude GPU memory and external pixel buffers; they
are not total process-memory measurements. The smaller JS download does not
establish complete feature parity with the React entry. Existing product
coverage limits remain in TESTING.md and the parity matrix.

## Changes

- Defer invisible screen children until their first visit, then retain their
  state. Keep their parent nodes in the original sibling order, so a focus
  ring cannot appear above its artwork.
- Pass generated gradient pixels directly to cached renderer textures,
  eliminating synchronous PNG encoding and subsequent decoding. The drawing
  commands, dimensions and design tokens are unchanged.
- Batch outgoing/incoming focus state writes.
- Overlap module/WASM/font loading with WebGL setup.
- Remove obsolete 70ms initial-guide and 40ms guide-label waits; use the next
  task after Solid has installed refs, and avoid the duplicate guide-fetch
  batch. The 700ms hold contract is unchanged.

## Evidence and method

[Committed measurements](tests/solid-performance.json) contain the
source hash, GPU/browser identity, summaries and individual trial totals.
The benchmark emits full per-key/frame samples to `PERF_OUTPUT` when run.

Both entries used production bundles over trusted local HTTPS, identical
intercepted backend/artwork fixtures, a 1920×1080 viewport and native browser
performance clocks. They ran sequentially in fresh browser contexts, reversing
renderer order on alternating trials. Contexts are cold; this does not reset
the OS file cache or GPU driver caches. Guide fixtures fix only Date, leaving
performance.now, resource timing and requestAnimationFrame native.

The 4× comparison contains six trials per renderer and **432 keys per
renderer**, across Home hero actions, the first shelf and guide channels.
There are three trials per renderer at 1× and 8×. Keys are paced at 80ms.
Channel focus readiness measures the first actionable channel, not completion
of all programme/artwork fetching.

Hardware: Chromium 153.0.8010.12 on Linux, AMD Radeon RX 7900 XT,
ANGLE/OpenGL ES through Mesa. WebGL, GPU compositing and rasterization were
verified enabled. Default headless Chromium on this host uses SwiftShader;
that software path is explicitly separate and cannot support these hardware
claims. CPU throttling does not emulate a television GPU or certify physical
Tizen, Vizio or webOS performance.

Focus markers alone can precede rendering. The benchmark also measures
registered keydown listener work (including handlers that stop propagation),
CDP main-thread task time, two subsequent animation-frame opportunities, frame
intervals and long tasks. Two frame opportunities are not a measured physical
presentation/input-to-photon latency. Very small focus samples can round to
zero at browser clock precision. Main-thread totals include common measurement
overhead; they are not total system/GPU CPU utilization. Summaries use nearest-rank quantiles. Median/p95 values are
observations from these runs, not statistical guarantees for all devices.

## Reproduction

Build the app and serve `dist` through the workspace local HTTPS environment
(see `../.local-https/README.md`). The test run used the same trusted certificate
with a local static server on port 8445. For the standard stack on 8443:

```sh
npm run build
PERF_PREVIEW_URL=https://viptv.local.test:8443/tv \
PERF_RUNS=6 PERF_CPU_THROTTLE=4 PERF_ASSERT_BETTER=1 \
PERF_OUTPUT=/tmp/viptv-perf-4x.json npm run perf:tv
```

`PERF_ASSERT_BETTER=1` fails if SolidTV does not beat React's median startup,
first-guide entry, p95 listener work, p95 focus response and median main-thread
work/key, or has long tasks, a p95 frame interval above 17.5ms, or frames over
50.1ms. Memory is reported separately. Hardware mode fails early when WebGL
acceleration is unavailable. Set `PERF_GPU=software` explicitly to measure
software fallback; do not label it hardware evidence.

No performance captures are committed. Six representative before/after
screens (Pairing, Profiles, Home, Menu, Live, Sources) were pixel-identical to
`cbdb369` after the rendering optimization. All 30 TV fixture scenarios and
172 unit/integration tests passed; production build and integrity/type checks
passed. Physical-TV and production-deployment verification remain outside this
benchmark.

The broader Playwright suite run with four workers produced 126 passes,
75 declared skips and one Vizio managed-seek assertion failure in the React
entry (a 0s versus 10s fixture position). That exact test passed alone with
one worker. No assertion or player logic was changed; this is recorded as a
suite timing flake, not an entirely clean aggregate run.
