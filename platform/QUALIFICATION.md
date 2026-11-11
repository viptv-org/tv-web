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
The webOS26 simulator1.5.0 shell/RCU starts under isolated Xvfb, but its guest
initially stays white and app-target CDP times out. The browser endpoint reports
Chrome120/Electron28.3.3. This is a failed app qualification attempt, not a
startup or media pass. The webOS22 simulator1.4.1 runs Chrome87.0.4280.141;
it reaches the shared WebGL startup, then fails to become ready before the
watchdog, with no API fixture calls observed. All font resources complete in
under120ms and the page is visible. Forcing the existing Canvas fallback in
that simulator reaches Home and decodes the HLS fixture (160px, nine decoded
frames, advancing clock and an active WebVTT cue). A settled private Canvas
Home capture shows the hero, copy, controls, avatar and cards painted. Disabling createImageBitmap
also unblocks WebGL application state and decoding, but leaves a failed black
guest presentation in the inspected capture. These are diagnostic changes in
the test harness, not product defaults or a general LG pass. The ordinary
WebGL startup and simulator visual gate remain failed. Codec, audio, DRM,
installed-state persistence, firmware lifecycle, performance and physical
remote behavior remain device gates.

The existing Live-empty/source-hint follow-up remains failed in this worktree:
four Live-empty cases stop on Anime because their fixed three-Right navigation
sequence no longer reaches Live; two source-hint cases open the drawer but do
not observe the injected source label, so hint absence is not reached. Their
assertions remain unchanged. These results are not counted as platform passes.
