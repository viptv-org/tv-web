# Matched-fixture audit checkpoint — 2026-10-23

Five fresh-context runs compare the previous `c9c1aae` remote wrapper with the
current audit candidate. Both consume the exact same `remote-backend.ts`
fixtures (SHA-256 `381a25cfe66c8013126e507833d5c66905e704e946db91fd60ef8d32d85c3534`), at 1920×1080,
4× CPU throttle and software WebGL. The script now verifies the served entry
against `PERF_DIST` and can hash source from an explicit `PERF_SOURCE_REF`.

| Median measurement | c9c1aae checkpoint | Audit candidate |
| --- | ---: | ---: |
| Cold Home readiness (ms) | 689.800 | 591.900 |
| Main-thread work/key (ms) | 38.367 | 36.718 |
| Handler p95 (ms) | 1.700 | 1.700 |
| Frame p95 (ms) | 16.800 | 16.800 |
| Heap after GC (MiB) | 4.253 | 4.269 |
| Renderer textures (MiB) | 30.209 | 30.209 |
| Decoded JavaScript (KiB) | 976.680 | 982.541 |

All five candidate runs had frame p95 16.8ms, zero long tasks and zero intervals
above 50ms. This satisfies the existing **17.5ms** frame gate for this workload.
Startup ranges were 673.1–727.5ms before and 576.9–715.4ms after. Main-thread
work/key ranges were 37.516–38.797ms before and 35.223–38.978ms after. These are
observations on a shared host, not a claim that every added guard improves speed.

The correctness fixes add 5.861 KiB of decoded JavaScript and 0.016 MiB of post-GC
heap; measured texture allocation is unchanged. Memory is reported separately
from speed. The 48-key Home workload still does not cover long guide/grid/settings
navigation, unique-art texture churn or physical TV performance. The initial
pre-conversion comparison below also used different fixture data; its large
percentage improvements are not an identical-data causal comparison.

Audit candidate bundle hash: `551671eb199c8ffb585fd57c5d3411e313b901721cfd1ea3b36f9512b5138f51`.
Remote source hash: `18c445c6e3e6de6bf59b9fed07350931fce9f9e777c5504c1072458c6fe175cc`.
Raw before/after samples are retained with the audit evidence. Completion remains
open until the broader workload and visual obligations in
`tests/REMOTE_COMPLETION_AUDIT.json` are satisfied.

---

# Matched-fixture audit checkpoint — 2026-10-23

Five fresh-context runs compare the previous `c9c1aae` remote wrapper with the
current audit candidate. Both consume the exact same `remote-backend.ts`
fixtures (SHA-256 `381a25cfe66c8013126e507833d5c66905e704e946db91fd60ef8d32d85c3534`), at 1920×1080,
4× CPU throttle and software WebGL. The script now verifies the served entry
against `PERF_DIST` and can hash source from an explicit `PERF_SOURCE_REF`.

| Median measurement | c9c1aae checkpoint | Audit candidate |
| --- | ---: | ---: |
| Cold Home readiness (ms) | 689.800 | 591.900 |
| Main-thread work/key (ms) | 38.367 | 36.718 |
| Handler p95 (ms) | 1.700 | 1.700 |
| Frame p95 (ms) | 16.800 | 16.800 |
| Heap after GC (MiB) | 4.253 | 4.269 |
| Renderer textures (MiB) | 30.209 | 30.209 |
| Decoded JavaScript (KiB) | 976.680 | 982.541 |

All five candidate runs had frame p95 16.8ms, zero long tasks and zero intervals
above 50ms. This satisfies the existing **17.5ms** frame gate for this workload.
Startup ranges were 673.1–727.5ms before and 576.9–715.4ms after. Main-thread
work/key ranges were 37.516–38.797ms before and 35.223–38.978ms after. These are
observations on a shared host, not a claim that every added guard improves speed.

The correctness fixes add 5.861 KiB of decoded JavaScript and 0.016 MiB of post-GC
heap; measured texture allocation is unchanged. Memory is reported separately
from speed. The 48-key Home workload still does not cover long guide/grid/settings
navigation, unique-art texture churn or physical TV performance. The initial
pre-conversion comparison below also used different fixture data; its large
percentage improvements are not an identical-data causal comparison.

Audit candidate bundle hash: `551671eb199c8ffb585fd57c5d3411e313b901721cfd1ea3b36f9512b5138f51`.
Remote source hash: `18c445c6e3e6de6bf59b9fed07350931fce9f9e777c5504c1072458c6fe175cc`.
Raw before/after samples are retained with the audit evidence. Completion remains
open until the broader workload and visual obligations in
`tests/REMOTE_COMPLETION_AUDIT.json` are satisfied.

---

# Focused Browse — 2026-10-24

Source `ee23cf6` versus `291a061`, three runs per build using identical snapshots
with server-projected Play previews. Conditions: trusted HTTPS, 1920×1080,
4× CPU throttle, software WebGL, 48 hero/row inputs per run; builds, tests and
benchmarks run separately. All runs have frame p95 ≤16.8ms, zero long tasks
and zero intervals above 50ms.

Median startup is 501.6 → 515.8ms; ranges overlap (471.3–570.3 versus
474.6–540.4ms). Main-thread work/key is 25.088 → 26.972ms and handler p95
1.8 → 2.2ms. The new preview, focus/caption treatment and Play artwork add
rendering work. Post-GC heap is 4.451 → 4.655MiB; textures 30.687 → 31.691MiB;
decoded JavaScript 1030.882 → 1037.894KiB. These costs are reported separately
from frame timing and do not claim universal hardware equivalence.

The initial implementation regenerated blurred Play artwork on every focus
return and used 43.917ms/key. Each mounted tile now retains one 72×72 pixel
result (20,736 bytes) for its current artwork, released with the row window.
The browser regression verifies two initial readbacks and no additional readback
after ten return-focus movements. Inactive Play layers remain unmounted.

Three 30-second normal-motion Home runs also pass: p95 16.8ms, zero long tasks,
zero >50ms intervals and zero viewing/source/playback requests. Median readiness
is 386.9ms, artwork readiness 742.2ms, heap 4.829MiB and textures 32.490MiB.
Shader-cache entries remain 17 → 17 in each run.

Raw measurements: `../.artifacts/tv-remote-browse-20261024/performance-comparison.json`
and `normal-motion-performance.json`; the discarded uncached result is retained
under `diagnostics/`. Home-to-rows choreography, unique-art stress, the original
pre-conversion equivalent fixture and physical-TV qualification remain separate.

---

# Home billboard motion — 2026-10-24

Accepted source `291a061` against prior Home `3af20b8`; 1920×1080, software WebGL,
4× CPU throttle, identical fixtures and sequential runs. Three navigation pairs
all pass frame p95 ≤16.8ms, with zero long tasks or intervals above 50ms.

Median startup is 517.5 → 524.5ms (ranges 516.0–540.6 → 523.8–557.5ms).
Work/key is 24.646 → 24.390ms. Handler p95 is 1.1 → 1.7ms: the richer controls
add small synchronous focus work, while total work/key stays comparable.
Post-GC heap is 4.345 → 4.448MiB; textures 30.141 → 30.687MiB. Decoded JavaScript
is 1019.556 → 1030.882KiB. Memory is reported separately from frame timing.

Three 30-second normal-motion runs, each spanning automatic featured changes,
have p95 16.8ms, zero long tasks/>50ms frames and zero viewing/source/playback
requests. Median actionable readiness is 378.8ms; full artwork readiness is
727.0ms. Heap is 4.717MiB and textures 31.788MiB after the workload. Shader-value
cache size stays 18 → 18. These are absolute animation checks, not a comparison
against the older build's missing zoom/glass behavior.

The first per-pixel blur missed the frame budget. Bounded pre-rendered glass
textures and vertex UV/zoom calculation brought it within budget. Retaining
extra glass-control layers improved key-handler timing but reproducibly caused
33ms motion p95; it was discarded. The accepted version keeps lazy inactive
progress shaders. Both discarded and passing observations retain bundle hashes.

Raw accepted report: `../.artifacts/tv-remote-billboard-20261024/performance-comparison.json`.
Hardware, original pre-conversion equivalent fixtures, unique-art stress and
other unqualified screen workloads remain separate obligations.

---

# Home metadata geometry checkpoint — 2026-10-23

Three alternating pairs compare `d3ab4d9` with `3af20b8` under the same current
fixtures, 1920×1080, 4× CPU throttle and software WebGL. Every run has frame p95
≤16.8ms, zero long tasks and zero frame intervals above 50ms.

Median startup is 515.5 → 524.2ms; ranges overlap (500.2–525.1 → 509.5–524.9ms).
Work/key is 26.752 → 25.690ms and handler p95 1.4 → 1.2ms. Post-GC heap is
4.301 → 4.345MiB; textures 30.077 → 30.141MiB. Separate metadata labels and
outlined badge textures account for the small memory increase. Decoded JS is
1019.203 → 1019.556KiB. These measurements qualify this geometry change; they do
not qualify the still-missing Home zoom/carousel/glass behavior.

Raw report: `../.artifacts/tv-remote-home-20261023/performance-comparison.json`.
Previous workload and motion evidence below retains its exact checkpoint scope.
No physical-TV or production claim follows from these browser measurements.

---

# Entry animation and Live guide checkpoint — 2026-10-23

Source `d3ab4d9`, producer `e8e7b5f`, design `bf5d1e1`. Three alternating pairs
compare the current build with validated Search checkpoint `57f6ec2`, using the
same fixtures, 1920×1080, 4× CPU throttle and software WebGL. Builds, tests and
benchmarks ran separately. All final navigation samples have frame p95 ≤16.8ms,
zero long tasks and zero intervals above 50ms.

| Workload | Work/key before → after (ms) | Handler p95 before → after (ms) | Heap before → after (MiB) | Textures before → after (MiB) |
| --- | ---: | ---: | ---: | ---: |
| Home, 48 keys | 24.364 → 24.433 | 1.1 → 1.1 | 4.283 → 4.301 | 30.071 → 30.077 |
| Live, 238 keys / 120 channels | 42.160 → 41.528 | 5.0 → 4.6 | 5.957 → 5.964 | 42.937 → 42.386 |
| Final Search follow-up, 258 keys | — → 35.059 | — → 3.4 | — → 6.159 | — → 41.626 |

Home startup median is 507.7 → 513.9ms; ranges overlap (501.8–511.5 versus
492.3–542.4ms). Decoded JavaScript increases 1007.552 → 1019.203KiB. These are
fixture measurements, not an assertion about every TV CPU/GPU. The earlier
three-pair Search comparison retains its own source/bundle identity.

The first Welcome implementation missed the frame budget; simply batching its
artwork did not reliably fix it. A shader-property animation retained one
uniform-cache entry per frame. A reproduced two-second probe grew 58 → 177
entries; the renderer-clock implementation stays at 2 → 2. The regression test
checks visible movement/reduced motion and stable shader-cache size.

The final three normal-motion Welcome runs and three pairing runs all have
frame p95 ≤16.8ms, zero long tasks and zero frames above 50ms. Welcome startup
median is 332.5ms, post-GC heap 3.185MiB and textures 31.845MiB. Pairing heap is
3.823MiB and textures 33.670MiB. A continuous 60-second Welcome run also passes
(3,512 measured frame intervals, p95 16.8ms, zero long tasks/>50ms intervals).
The cached atlas remains 1440×1074; artwork display geometry stays 236×354.

An initial Live comparison showed inconsistent higher main-thread work. CPU
profiles showed identical request counts (229 guides, 3 directory pages) and
identified repeated locale-formatter creation as a JavaScript hot spot. After
reusing that formatter, every final Live pair uses less work/key than baseline.
Profiler runs are diagnostic only and retain their own overhead; they are not
substituted for acceptance samples.

Raw final report: `../.artifacts/tv-remote-entry-20261023/performance-comparison.json`.
Memory figures are post-GC JS heap and renderer texture allocation, not total
process memory. Original matched pre-conversion fixtures, unique-art stress,
remaining screen workloads and physical-TV qualification remain separate work.

---

# Search and typography checkpoint — 2026-10-23

Three alternating pairs compare `2fafc08` with the Search/typography candidate
for Home, grid, Live and settings. Three additional runs exercise the new Search
workload: ten typed characters, ten deletions, then 120 channel results out and
back (258 measured inputs/run). All **15 candidate runs** pass the 17.5ms frame
p95 gate, with zero long tasks and zero intervals above 50ms.

| Workload | Work/key before → after (ms) | Handler p95 before → after (ms) | Heap before → after (MiB) | Textures before → after (MiB) |
| --- | ---: | ---: | ---: | ---: |
| Home | 24.660 → 24.615 | 1.0 → 1.1 | 4.233 → 4.284 | 30.077 → 30.071 |
| 210-title grid | 47.158 → 47.362 | 7.2 → 7.0 | 5.363 → 5.403 | 32.174 → 32.251 |
| 120-channel guide | 43.151 → 43.321 | 5.6 → 5.0 | 5.894 → 5.956 | 42.525 → 42.933 |
| 100-row settings | 33.647 → 33.798 | 2.8 → 2.8 | 4.889 → 4.941 | 35.652 → 35.835 |
| New Search workload | — → 35.552 | — → 3.5 | — → 6.135 | — → 41.599 |

These are medians, measured in fresh contexts at 1920×1080, 4× CPU throttle and
software WebGL. Home startup median is 511.8 → 499.6ms. Decoded JavaScript grows
996.202 → 1007.515KiB. Search has no old-build channel-search equivalent and is
an absolute frame-budget check, not a fabricated before/after comparison.

The final channel-paging authentication guard affects an error branch absent
from these successful workloads. Final-build Home and Search runs also pass:
frame p95 16.8ms, zero long tasks/frames above 50ms. Final Home readiness is
493.9ms; Search work/key is 35.445ms over 258 inputs. Final decoded JS is
1007.552KiB. Earlier four-workload reports retain their exact source/bundle
hashes. Memory is post-GC JS heap plus renderer texture allocation, not total
process memory. Unique-art stress and the original matched-data pre-conversion
comparison remain open. No physical-TV qualification is implied.

---

# Navigation projection follow-up — 2026-10-23

Three alternating Home pairs compare the validated `5613158` checkpoint with
the navigation candidate. All six runs have zero long tasks and zero frames
above 50ms; candidate frame p95 is at most 16.8ms. Startup median is
510.4 → 524.7ms; ranges overlap (508.4–544.1 → 506.2–526.1ms). Work/key is
25.411 → 24.691ms, handler p95 stays 1.2ms, textures stay 30.077MiB, and
post-GC heap is 4.234 → 4.232MiB. Decoded JS grows by 0.786KiB to 995.973KiB.

Conditions and limits match the expanded checkpoint below. The new data cover
Home for this small navigation change; the four-workload results below remain
at their exact measured checkpoint. Bundle SHA-256:
`0cc5cb013b3b81a21dd67de55f906e254a5ee3eeddd38d0e534cf4e7020fe549`.

---

# Expanded navigation checkpoint — 2026-10-23

Three alternating pairs per workload compare `8a1fd02` with the current
candidate, using identical current fixtures and verified served bundle hashes.
Conditions: fresh browser contexts, 1920×1080, software WebGL, 4× CPU throttle,
one benchmark at a time. All **12 candidate runs** meet the existing **17.5 ms
frame p95** limit, with **zero long tasks and zero frames above 50 ms**.

| Workload | Keys/run | Work/key before → after (ms) | Handler p95 before → after (ms) | Heap before → after (MiB) | Textures before → after (MiB) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Home hero/row | 48 | 24.661 → 24.236 | 1.2 → 1.1 | 4.273 → 4.233 | 30.209 → 30.077 |
| Grid, 210 titles, 28 rows down/back | 56 | 51.481 → 47.723 | 11.8 → 8.2 | 6.177 → 5.359 | 41.274 → 32.174 |
| Guide, all 120 channels down/back | 238 | 43.143 → 44.401 | 6.1 → 5.8 | 5.878 → 5.895 | 42.672 → 42.524 |
| Settings, 100 add-on rows down/back | 200 | 34.254 → 33.534 | 3.0 → 3.0 | 4.873 → 4.886 | 35.784 → 35.652 |

Values are medians of three runs, not worst cases. Frame p95 was 16.7–16.8 ms
in every candidate run. Cold Home readiness in the Home workload was
514.9 → 517.1 ms; decoded JavaScript grew 982.541 → 995.187 KiB. The small
Live work/key increase is accompanied by lower handler p95 and no missed frame
budget; run ranges remain in the raw report. Do not interpret all variation on
a shared host as a code effect.

The grid now creates title/metadata labels only for the focused poster. Its
rendered window and server ordering remain unchanged. This removes hidden
rasterization and reduces measured texture retention by about 9.1 MiB.
Memory is reported separately from speed; post-GC JavaScript heap is not total
process/GPU memory. The grid reuses five artwork images, so this is not yet a
unique-art texture-churn qualification.

Exploratory trials during concurrent 4K encoding/browser work exceeded the
frame budget. Those logs remain separate from the alternating comparison;
the first grid trial also exposed a benchmark paging parameter error and was
rejected by its traversal assertion. Each accepted grid run reaches index 196,
Live reaches 119, and settings reaches 100 before returning.

Raw comparison: `../.artifacts/tv-remote-authority-20261023/performance-comparison.json`.
The original pre-conversion comparison still used different fixture data. This
checkpoint closes the broader remote-wrapper workload measurement gap, not
that original matched-data obligation or physical-TV qualification.

---

# Matched-fixture audit checkpoint — 2026-10-23

Five fresh-context runs compare the previous `c9c1aae` remote wrapper with the
current audit candidate. Both consume the exact same `remote-backend.ts`
fixtures (SHA-256 `381a25cfe66c8013126e507833d5c66905e704e946db91fd60ef8d32d85c3534`), at 1920×1080,
4× CPU throttle and software WebGL. The script now verifies the served entry
against `PERF_DIST` and can hash source from an explicit `PERF_SOURCE_REF`.

| Median measurement | c9c1aae checkpoint | Audit candidate |
| --- | ---: | ---: |
| Cold Home readiness (ms) | 689.800 | 591.900 |
| Main-thread work/key (ms) | 38.367 | 36.718 |
| Handler p95 (ms) | 1.700 | 1.700 |
| Frame p95 (ms) | 16.800 | 16.800 |
| Heap after GC (MiB) | 4.253 | 4.269 |
| Renderer textures (MiB) | 30.209 | 30.209 |
| Decoded JavaScript (KiB) | 976.680 | 982.541 |

All five candidate runs had frame p95 16.8ms, zero long tasks and zero intervals
above 50ms. This satisfies the existing **17.5ms** frame gate for this workload.
Startup ranges were 673.1–727.5ms before and 576.9–715.4ms after. Main-thread
work/key ranges were 37.516–38.797ms before and 35.223–38.978ms after. These are
observations on a shared host, not a claim that every added guard improves speed.

The correctness fixes add 5.861 KiB of decoded JavaScript and 0.016 MiB of post-GC
heap; measured texture allocation is unchanged. Memory is reported separately
from speed. The 48-key Home workload still does not cover long guide/grid/settings
navigation, unique-art texture churn or physical TV performance. The initial
pre-conversion comparison below also used different fixture data; its large
percentage improvements are not an identical-data causal comparison.

Audit candidate bundle hash: `551671eb199c8ffb585fd57c5d3411e313b901721cfd1ea3b36f9512b5138f51`.
Remote source hash: `18c445c6e3e6de6bf59b9fed07350931fce9f9e777c5504c1072458c6fe175cc`.
Raw before/after samples are retained with the audit evidence. Completion remains
open until the broader workload and visual obligations in
`tests/REMOTE_COMPLETION_AUDIT.json` are satisfied.

---

# Server-authoritative TV performance — 2026-10-23

The remote wrapper improved median cold Home readiness by **44.4%**,
reduced measured main-thread navigation work by **12.6%** and fetched
**23.4% less decoded JavaScript** than the captured pre-conversion production bundle.
All three final navigation runs had zero long tasks and zero frame intervals over
50ms; each run's p95 frame interval was 16.8ms. Handler timing was unchanged at
1.7ms for the median run (individual runs varied up to 2.1ms).

| HTTPS Chromium, 1920×1080, 4× CPU, software WebGL | Before | Remote wrapper |
| --- | ---: | ---: |
| Cold Home focus-ready, median (ms) | 1236.100 | 686.800 |
| Main-thread work per key, median (ms) | 42.710 | 37.320 |
| Key handler p95, median run (ms) | 1.700 | 1.700 |
| Frame interval p95, median run (ms) | 16.800 | 16.800 |
| Frames over 50ms | 0.000 | 0.000 |
| Sustained-navigation long tasks | 0.000 | 0.000 |
| Post-GC JavaScript heap (MiB) | 5.654 | 4.252 |
| Renderer texture allocation (MiB) | 36.390 | 30.209 |
| Decoded JavaScript fetched (KiB) | 1275.562 | 976.680 |

These are three sequential runs per version, with fresh browser contexts, the
same 48-key Home hero/row sequence and settling windows. Each version uses its
matching API fixtures/design; these are not byte-identical payloads or a pure
renderer comparison. The fixture and design difference limits attribution of
performance improvements. A hardware-WebGL attempt was unavailable in this
session. **SwiftShader/CPU throttling is not physical-TV GPU evidence.**

The before artifact was captured from TV-web `f109eb3` before conversion.
After bundle SHA-256 (ordered HTML/JavaScript set):
`f6b8bbef33602516dfeb706387dbde561276708847ef281b2b28c49f5b2fcf88`.
Remote source SHA-256 (ordered `src/tv-solid/remote` files):
`dd64618d9bdaa892689873c288e233d835e12bfc3afd06b2888c01308dfa9113`.
Raw per-run reports are delivered with the hosting artifact.

Startup and navigation gates pass against that captured baseline. Memory is
reported separately: heap excludes GPU/external allocations, and renderer texture
accounting excludes driver overhead. Neither figure is total process memory.
The TV graph excludes the local engine, client business-policy runtime and remux
stack. Responsive React assets remain packaged but are not reachable from the TV
entry. Backdrop blending uses a bounded cached mask and retains a previous image
only during an actual transition; preview settling keeps image changes off rapid
focus movement. Rows, grids, guides and settings lists use bounded render windows.

Reproduction (run after builds/browser tests finish):

```sh
PERF_LEGACY=1 REMOTE_PREVIEW_ORIGIN=https://viptv.local.test:18561 PERF_OUTPUT=/tmp/before.json node --experimental-strip-types tests/preview/remote-perf.mjs
PERF_OUTPUT=/tmp/after.json node --experimental-strip-types tests/preview/remote-perf.mjs
```

Historical framework comparisons below refer to the retired TV implementation.

---

# SolidTV performance comparison — 2026-09-25

The optimized SolidTV entry is faster than this application's React TV entry
in the tested startup and sustained navigation workloads. At 4× CPU
throttling, median Home readiness improved from **557.6ms to 537.3ms (4%)**,
and main-thread work per key from **12.372ms to 5.307ms (57%)**. This is a
comparison of implemented app paths, not a universal framework claim.

| 4× CPU, hardware WebGL | React TV | SolidTV |
| --- | ---: | ---: |
| Home focus-ready, median | 557.6ms | 537.3ms |
| First guide channel focus-ready, median | 140.6ms | 130.3ms |
| Keydown listener work, p95 | 2.3ms | 1.6ms |
| Keydown to focus update, p95 | 22.7ms | 0.8ms |
| Keydown to two frame opportunities, p95 | 70.5ms | 36.9ms |
| Main-thread work per key, median | 12.372ms | 5.307ms |
| Frame interval, p95 | 16.8ms | 16.8ms |
| Frame intervals over 33.4ms / long tasks | 0 / 0 | 0 / 0 |
| Post-GC JS heap after Home and guide | 5.594MiB | 6.774MiB |
| Decoded JavaScript fetched | 1196.189KiB | 540.859KiB |

All speed/frame gates passed in the current 4× run. Earlier optimization runs
at 1× and 4× also passed. At 1×, median startup was
189.4ms versus 175.3ms and main-thread work/key was 3.752ms versus 1.847ms.
At 8×, startup was 1007.9ms versus 888.2ms and work/key was 23.403ms versus
8.430ms. The 8× strict gate **failed first guide entry**: SolidTV took
250.5ms versus React's 237.2ms. The other seven 8× checks passed, with no
sampled frame stalls or long tasks. Do not omit this exception when reporting
stress results.

SolidTV retains visited screen subtrees for fast return and stable focus.
After visiting the guide it used **1.180MiB more JS heap (21%)** in the current
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

No performance captures are committed. All 30 original SolidTV fixtures and
the added profile, shelf and Next scenarios passed; 172 unit/integration tests,
the production build and integrity/type checks passed. The complete Playwright
suite passed 129 tests with 75 declared skips. Physical-TV and production
deployment verification remain outside this benchmark.


---

# Preserved SolidTV completion branch evidence

# SolidTV title/player completion — 2026-09-24

The latest implementation adds reachable seasons/long episode lists, native
scrolling information panels, long track lists, committed seek presentation and
controller recovery/session synchronization. [Current raw measurements](tests/solid-completion2-performance.json)
include all source hashes, trials and per-key samples.

Three sequential trials per renderer at 4× CPU throttling measured:

| Metric | React TV | SolidTV |
| --- | ---: | ---: |
| Home focus-ready median | 513.5 ms | 507.4 ms |
| Slowest Home startup | 559.0 ms | 595.6 ms |
| First guide focus-ready median | 139.0 ms | 131.5 ms |
| Main-thread work/key median | 11.891 ms | 5.110 ms |
| Focus-update p95 | 22.9 ms | 0.7 ms |
| Handler p95 | 1.9 ms | 0.5 ms |
| Two frame opportunities p95 | 70.7 ms | 36.7 ms |
| Frame interval p95 | 16.7 ms | 16.8 ms |
| Long tasks / frames over 33.4 ms | 0 / 0 | 0 / 0 |
| Post-GC JS heap | 5.562 MiB | 6.967 MiB |
| Renderer texture allocation | Not measured | 49.542 MiB |
| Decoded JavaScript fetched | 1197.337 KiB | 624.158 KiB |

All eight configured speed/frame checks pass in this run; main-thread work/key
is **57.0% lower**. Startup is a small median difference and has varied around
a tie across preceding versions/runs; the slowest Solid startup is worse.
Do not infer a robust universal startup advantage from three trials. Solid
uses **1.405 MiB more JS heap**, and texture memory has no measured React
counterpart. These desktop GPU/fixture results do not certify TV hardware.
Method and reproduction are documented below. Earlier sections and files are
historical evidence for earlier source hashes, not current claims.

---

# SolidTV completion checkpoint — 2026-09-24

Native-focus and feature-completion changes retain substantially lower
navigation CPU work than React. The latest **three trials per renderer at
4× CPU throttling** measured **55.5% less main-thread work per key**. The
strict all-metrics gate does **not** pass: Home startup is 2.1% slower and
JS heap remains higher. Do not describe this as faster on every measure.

| Production app, hardware WebGL | React TV | SolidTV |
| --- | ---: | ---: |
| Home focus-ready, median | 504.6 ms | 515.3 ms |
| First guide focus-ready, median | 138.8 ms | 127.1 ms |
| Keydown listener work, p95 | 2.1 ms | 0.5 ms |
| Keydown to focus update, p95 | 22.5 ms | 0.7 ms |
| Keydown to two frame opportunities, p95 | 70.3 ms | 36.4 ms |
| Main-thread work per key, median | 11.987 ms | 5.331 ms |
| Frame interval, p95 | 16.8 ms | 16.8 ms |
| Frames over 33.4 ms / long tasks | 0 / 0 | 0 / 0 |
| Post-GC JS heap after Home/guide | 5.563 MiB | 6.968 MiB |
| Renderer-reported texture allocation | Not measured | 49.584 MiB |
| Decoded JavaScript fetched | 1197.298 KiB | 613.292 KiB |

[Full current measurements](tests/solid-completion-performance.json) include
all trials, 216 remote keys per renderer, frames, GPU identity and the hash of
all SolidTV source files plus benchmark configuration. Tests ran sequentially
in fresh contexts with alternating renderer order, identical fixtures, native
clocks and trusted HTTPS. No other browser tests or build ran concurrently.
The Solid texture figure has no comparable React GPU figure and excludes
other driver allocations. JS heap is not total process memory; key task time
is not total CPU utilization. Focus markers/two RAFs are not input-to-photon
measurements. This desktop GPU test does not certify physical TV behavior.

Home uses wsrv-sized artwork derivatives and composes the pinned backdrop once
per artwork change, retaining its texture through focus moves. Guide requests
now overlap first-screen setup and apply their data in a batch. SVG data URIs
use explicit SVG textures; the previous URL detector silently omitted icons.

The initial completion measurement found guide entry slower (153.2 versus
127.5 ms). After the guide fix, two runs measured Solid guide entry at 134.3
versus 138.2 ms and 127.1 versus 138.8 ms. Startup varied near a tie; the latest
run above is the reported result, including its failing startup gate.

Reproduce after `npm run build` with the trusted local HTTPS static server:

```sh
PERF_PREVIEW_URL=https://viptv.local.test:8446/tv \
PERF_RUNS=3 PERF_CPU_THROTTLE=4 PERF_ASSERT_BETTER=1 \
PERF_OUTPUT=/tmp/solid-completion-performance.json npm run perf:tv
```

The historical optimization evidence below belongs to the earlier checkpoint
and must not be used as the current startup or memory claim.

---

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
