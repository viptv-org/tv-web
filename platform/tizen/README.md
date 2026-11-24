# Samsung Tizen packaging

The default Samsung package contains the shared SolidTV application, including
its local chunks, fonts and artwork. It requires a relative-base build and an
explicit HTTPS API origin. UI, navigation and playback decisions remain shared;
the package loads Samsung's system AVPlay SDK in its file context and places the
native surface below canvas controls.

Build and sign with an existing Samsung certificate profile:

```sh
npm run build -- --base=./
VIPTV_TIZEN_API_ORIGIN=https://api.example.com TIZEN_PROFILE=PROFILE node scripts/package-tv.mjs tizen
```

For unsigned staging and browser boundary checks, use an empty output directory:

```sh
node scripts/stage-tizen.mjs dist artifacts/tv-assets.json OUTPUT https://api.example.com
REMOTE_TIZEN_STAGE=OUTPUT npx playwright test --config=playwright.packaged.config.ts --workers=1
```

The browser file test permits local module reads and replaces the external
server/SDK boundaries. It does not establish Samsung firmware network policy,
real AVPlay decoding or installation. The stage is not an installable WGT.

## Signing, packaging and install

Signing remains mandatory for installation. The development package ID remains
`VPTV000001` until the release identity is provisioned. CI requires the four
Samsung signing secrets before building, uses a relative base and supplies the
explicit API origin. No signed package is claimed without those credentials.

Local flow (Samsung account required to issue certs):

1. Enable Developer Mode on the TV and set the host PC IP (the machine running
   `sdb`/`tizen`). Connect: `sdb connect <tv-ip>` (`sdb devices` shows the TV).
2. Obtain the TV DUID (`sdb shell 0 getduid`, or TV menu Support → Contact
   Samsung → Unique Device ID). A distributor certificate is bound to DUIDs.
3. Create/import a Samsung certificate profile (Tizen Studio Certificate
   Manager with the Samsung extension, or a headless tool such as `tizen-cert`
   which follows the same flow). The profile name is `TIZEN_PROFILE`; keep
   `.p12` files and passwords private (never commit). A headless sign-in that
   posts to `http://localhost:4794` can be completed via
   `ssh -L 4794:localhost:4794` from the browser machine to the host running
   the cert tool.
4. Build, stage, sign, install:

```sh
npm run build -- --base=./
node scripts/stage-tizen.mjs dist artifacts/tv-assets.json OUTPUT https://api.example.com
VIPTV_TIZEN_API_ORIGIN=https://api.example.com TIZEN_PROFILE=PROFILE node scripts/package-tv.mjs tizen
# or sign a prepared stage directly:
tizen package -t wgt -s PROFILE -- OUTPUT -o artifacts/tizen
sdb push artifacts/tizen/*.wgt /home/owner/share/tmp/sdk_tools/VIPTV.wgt
sdb shell 0 vd_appinstall VPTV000001.VIPTV /home/owner/share/tmp/sdk_tools/VIPTV.wgt
sdb shell 0 was_execute VPTV000001.VIPTV
```

`$WEBAPIS/webapis/webapis.js` is loaded from the Tizen runtime (not packaged);
the package verifier ignores `$`-prefixed platform runtime references. Public
runtime files outside `assets/` (e.g. `tv-artwork/`) must be part of the TV
package closure (`artifacts/tv-assets.json` / `scripts/remote-boundary.ts`).

Hosted `/tv/` builds use base `/tv/`; packaged Tizen builds require a
relative-base build (`--base=./`) and the staged manifest with `base: "./"`.

The manifest declares `internet`, `avplay` and `tv.inputdevice`. Dynamic HTTPS
artwork, HLS and gateway URLs require broad widget network access; CSP limits
network resources to HTTPS and keeps executable code local. Startup registers
six transport keys independently; unsupported keys do not disable the rest.
Mandatory arrows, Enter and Back remain unregistered. Home Return requires a
confirmation before `exitTizen()`; long Return/Exit stays with the system. See
Samsung's [remote input](https://developer.samsung.com/smarttv/develop/guides/user-interaction/remote-control.html)
and [Return policy](https://developer.samsung.com/smarttv/develop/guides/fundamentals/terminating-applications.html).

API transport uses the existing bearer device protocol with cookies omitted.
No backend origin or authentication check is relaxed. File-origin CORS and
actual Samsung request headers remain native-runtime qualification gates.
Samsung documents the access requirement in its
[networking FAQ](https://developer.samsung.com/smarttv/develop/faq/networking-and-connectivity.html).
A packaged app runs from `file:` and may send `Origin: null` / cross-site; if
the backend rejects that for device-auth flows, pairing/login from the native
package fails until the backend explicitly allows the packaged TV origin for
those flows (the hosted same-origin `/tv/?platform=tizen` entry avoids this).

The optional `node scripts/package-tv.mjs tizen-hosted` command packages only an
HTTPS redirect launcher. `VIPTV_TIZEN_HOSTED_URL` selects its hosted entry.
Samsung excludes Tizen APIs from hosted pages and restricts hosted submissions:
this alternative does not provide native AVPlay or ordinary store acceptance.
See its [hosted-app policy](https://developer.samsung.com/smarttv/develop/faq/hosted-applications.html).

Record actual engine/model/firmware, codec/container, first decoded frame,
audio/subtitles, paused/playing seeks, source replacement and recovery separately.
Current results and reproducible checks: [platform matrix](../QUALIFICATION.md).
