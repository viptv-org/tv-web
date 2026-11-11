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
Signing remains mandatory for installation. The development package ID remains
`VPTV000001` until the release identity is provisioned. CI requires the four
Samsung signing secrets before building, uses a relative base and supplies the
explicit API origin. No signed package is claimed without those credentials.

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

The optional `node scripts/package-tv.mjs tizen-hosted` command packages only an
HTTPS redirect launcher. `VIPTV_TIZEN_HOSTED_URL` selects its hosted entry.
Samsung excludes Tizen APIs from hosted pages and restricts hosted submissions:
this alternative does not provide native AVPlay or ordinary store acceptance.
See its [hosted-app policy](https://developer.samsung.com/smarttv/develop/faq/hosted-applications.html).

Record actual engine/model/firmware, codec/container, first decoded frame,
audio/subtitles, paused/playing seeks, source replacement and recovery separately.
Current results and reproducible checks: [platform matrix](../QUALIFICATION.md).
