# TV platform qualification

The application, focus manager and server-owned playback decisions are shared.
An explicit `platform=web|webos|tizen|vizio` takes precedence; direct hosted URLs
recognize LG Web0S/webOS and Samsung SMART-TV/Tizen user agents. Browser and PS4
entries retain the existing renderer capability check and Canvas fallback.

The ES2017 build target transforms syntax. The startup compatibility module also
supplies Array.at, Object.fromEntries and Promise.allSettled when absent. The
last helper is needed by independent movie/series Search requests on Samsung's
Chromium69 baseline. This is an API-gap regression, not full firmware emulation.

| Boundary | LG webOS | Samsung Tizen |
|---|---|---|
| Declared target | webOS TV22+, Chromium87 baseline | Tizen5.5+, Chromium69 baseline |
| Shipping package | HTTPS redirect IPK; created and inspected with official CLI3.2.6 | Local TV closure staged/verified; signing unavailable |
| Playback in hosted entry | HTML native HLS or hls.js/MSE | HTML native HLS or hls.js/MSE (explicit hosted alternative) |
| Native SDK | platform Back when exposed | Optional AVPlay in packaged file context; transport keys registered when tvinputdevice exists |
| Physical devices | Unavailable, unqualified | Unavailable, unqualified |
| Store acceptance | Unqualified | Local package needs signing/native-runtime acceptance; hosted alternative needs separate approval |

[Tizen engine versions](https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html)
and [LG engine versions](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine)
define the baseline. Samsung excludes Tizen APIs from hosted pages and restricts
hosted-app submissions; a signed redirect does not provide native AVPlay or an
approved store release. See its
[hosted application policy](https://developer.samsung.com/smarttv/develop/faq/hosted-applications.html).

Samsung's optional transport keys require `tv.inputdevice` privilege. Arrow,
Enter and Back are mandatory keys and are not registered. Long Return/Exit
remains under system control. Home Return must show a confirmation before
calling `exitTizen`; see Samsung's
[remote input](https://developer.samsung.com/smarttv/develop/guides/user-interaction/remote-control.html)
and [Return policy](https://developer.samsung.com/smarttv/develop/guides/fundamentals/terminating-applications.html).

Run focused validation with one worker and a trusted HTTPS preview serving the
current worktree's production dist:

```sh
npx vitest run tests/ui/packaged-host.test.ts tests/build/tv-application.test.ts tests/ui/tizen-host.test.ts tests/ui/webos.test.ts tests/ui/tv-platform.test.ts tests/ui/tv-compat.test.ts tests/build/tv-launcher.test.ts --pool=forks --poolOptions.forks.singleFork
npm run build
npx playwright test --config=playwright.remote.config.ts platform-host.spec.ts platform-playback.spec.ts --workers=1
REMOTE_TV_PLATFORM=webos npx playwright test --config=playwright.remote.config.ts playback-authority.spec.ts playback-recovery.spec.ts --workers=1
REMOTE_TV_PLATFORM=tizen npx playwright test --config=playwright.remote.config.ts playback-authority.spec.ts playback-recovery.spec.ts --workers=1
```

API fixtures replace only server/platform boundaries. HLS tests decode the owned
H.264/AAC fixture, require decoded dimensions/frames and active WebVTT cues, and
exercise pause/resume/Stop. Injected AVPlay tests establish SDK state/track
contracts and native-surface layering, not decoded Samsung media or audio.
Authority/recovery scenarios cover explicit source selection/replacement, tracks,
paused and playing seeks, canceled work, server action limits and expired auth.

Samsung's simulator does not support hosted apps and substitutes dummy videos
for some streaming paths. Its full emulator is not installed on this host;
there is no available KVM device. No Samsung emulator outcome is claimed. See
[simulator limits](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-simulator.html)
and [emulator limits](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-emulator/emulator-limitations.html).

The local Samsung closure is 8.6MiB. Two Chromium file-entry cases pass: local
startup/asset closure/API-origin binding/numeric Back, and injected AVPlay
surface/transport registration/subtitle index/paused track replacement. The
file test enables local module access; it does not bypass server security or
prove file-origin Samsung API transport. No real Samsung media is decoded in
those cases. The default signing command consumes this local closure; the
redirect launcher requires the explicit `tizen-hosted` target.

The final hosted build passes eleven host/media/SDK/lifecycle cases in each of
Chromium, Firefox and WebKit (33 executions). Chromium also passes seventeen
authority/recovery cases for each webOS and hosted-Tizen query. WebKit uses
isolated GTK, GSettings, Mesa/EGL and TLS dependencies on the server; initial
runtime-launch failures did not require product changes.

LG official simulator execution is separate from desktop browser evidence.
The current owned webOS22 simulator 1.4.1 / Chromium 87 player run keeps WebGL and
native createImageBitmap intact. The existing five-second 160×90 H.264/AAC HLS
fixture advances 3.085 seconds / 77 decoded frames with zero reported drops; its AAC
byte counter reaches 14480. Pause holds 1.027559 seconds unchanged for 700 ms. A
paused managed rewind reaches 0 and holds it for 500 ms, then resumes. English WebVTT
selection/Off changes real showing-track and active-cue state while preserving
pause through replacements. Numeric LG Back 461 and MediaStop 413 each return to
Home, restore focus and reset the decoder: paused, time 0, dimensions/frame/audio
counters 0, NETWORK_EMPTY, HAVE_NOTHING, no source attribute/buffers and hidden
video layer. All six admitted leases are released; no JavaScript errors occur.
The read-only currentSrc getter retains its last blob string after that reset;
no product override conceals it.

The runner uses owned Xvfb, --disable-gpu and --disable-dev-shm-usage, a
self-signed-localhost certificate exception, disabled core dumps and a bounded
preflight for 1.5 GiB headroom beyond cgroup anon/kernel/shmem usage. This container
has a 5 GiB memory limit and 64 MiB /dev/shm. A prior Mojo resource-exhaustion crash
was an invalid harness run; no controlled A/B isolates its trigger. These flags
are not app defaults, and the fixture's reload clock is not a cold-launch or
hardware performance benchmark. This short clip does not qualify multi-audio
switching, long-run stability or higher-resolution/HDR/DRM sources.

Earlier constrained ordinary runs had a lost WebGL context, a stopped frame
loop and valid decoded font atlases awaiting upload: decoding had completed.
The startup guard retires the lost renderer/canvas and retries once with the
existing Canvas host before mounting the application. That automatic recovery
painted Home in both guest and simulator-window captures and decoded HLS with an
active caption. Nine ownership units and two browser cases using the actual
WEBGL_lose_context extension cover loss before construction and during font
upload. No bitmap API disable or UA-specific renderer selection ships.

Private proof artifacts: lg-native-context-confirm.log,
lg-startup-probe.log, lg-player-report.json and lg-player-final.log, with actual
simulator-window captures. Both video and controls are visibly painted; the
Canvas caption is visible in its capture. Healthy-WebGL subtitle assertions
verify track modes and active cue contents, and its reviewed paused window shows
the active English cue. This is not a complete caption-style pixel sweep. Earlier LG26's white
guest/CDP timeout and bitmap-disable black presentation remain historical failed
diagnostics, not current LG22 outcomes. Physical LG/Samsung codecs, audible
output, DRM, mediaOption, installed-state persistence, firmware lifecycle,
performance and real remote input remain unqualified.

The shared UI audit corrected Live-empty route navigation and source-hint fixture
provider fields. Their focused cases pass with the original behavior assertions;
they are separate from the platform media results above.
