# LG webOS host

LG webOS uses the shared SolidTV entry and HTML/native-HLS/hls.js player. The
package targets webOS TV22 and later. Its local `index.html` redirects to the
configured HTTPS `/tv/?platform=webos` entry at the API origin. Keeping HTTP,
storage and playback at that origin preserves the backend authentication
contract. Packaged file-scheme cookies are not supported by LG; see its
[web engine specifications](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine).

Build with `npm run build` and `node scripts/package-tv.mjs webos`, with
`ares-package` from `@webos-tools/cli` available on PATH.
`VIPTV_WEBOS_HOSTED_URL` overrides the hosted entry. The package contains the
launcher, icon and `appinfo.json`, not an offline copy of the TV application.
`disableBackHistoryAPI:true` gives the shared focus controller keycode461.
Root exit calls `webOS.platformBack()` or its `PalmSystem.platformBack()` host
boundary; ordinary navigation and player controls remain shared.
[LG's Back guide](https://webostv.developer.lge.com/develop/guides/back-button)
defines the platform exit confirmation on webOS6 and newer.

Use `stageTvLauncher` from `scripts/tv-launcher.mjs` to produce the same directory
for the official simulator. `ares-launch -s 22 -sp SIMULATOR_PATH APP_DIR` starts
it; Linux distributions requiring extra Chromium flags can launch the AppImage
directly with APP_DIR as the first argument. Keep certificates and local API
fixtures outside the repository. Record the actual simulator and engine
versions: simulator results do not establish hardware decode or firmware
behavior. LG explicitly excludes DRM and mediaOption, and gives the simulator
different audio/video support; see
[simulator limits](https://webostv.developer.lge.com/develop/tools/simulator-introduction).

Qualification results and commands are in [the platform matrix](../QUALIFICATION.md).
