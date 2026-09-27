# TV downloads

`build.yml` runs on main pushes and manual dispatch. Its hosting, LG and Samsung
jobs are independent. Artifacts expire after 30 days and include SHA256SUMS and
build.json. No automatic deployment, release publication or store submission.

```sh
npm ci
npm test
npm run build
node scripts/package-tv.mjs hosting
npm install --global @webos-tools/cli@3.2.6
node scripts/package-tv.mjs webos
TIZEN_PROFILE=viptv node scripts/package-tv.mjs tizen
```

LG produces `artifacts/webos/*.ipk` for developer-mode webOS 22+ TVs. Samsung
produces `artifacts/tizen/*.wgt` only with a valid SDK certificate profile.
Configure Actions secrets TIZEN_AUTHOR_P12 and TIZEN_DISTRIBUTOR_P12 with base64
P12 files, and TIZEN_AUTHOR_PASSWORD and TIZEN_DISTRIBUTOR_PASSWORD with their
passwords. Use Samsung certificates authorizing the target TVs. No unsigned
candidate is advertised as installable.

Both are hosted launchers. The default URLs are the existing HTTPS API origin
under `/tv/?platform=tizen` or `/tv/?platform=webos`. Optional environment
variables VIPTV_TIZEN_HOSTED_URL and VIPTV_WEBOS_HOSTED_URL must preserve that
HTTPS `/tv/` shape and platform query. Manually deploy the matching hosting ZIP;
building an installer does not deploy its hosted runtime. Vizio continues to
use the same hosted bundle. Existing browser, desktop and TV styling is retained.

LG reuses shared remote focus and HTML media playback; physical device behavior,
codecs and DRM are not established by an IPK or browser test. Backgrounding
stops the playback session. Root Back delegates to platform exit.
