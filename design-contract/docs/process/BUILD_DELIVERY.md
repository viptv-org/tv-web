# Package delivery policy — 2026-09-27

Owner-approved replacement for the previous organization CI/CD policy.
GitHub Actions builds sideloadable downloads on pushes to main and manual
dispatch. Only android, desktop, roku and tv-web own workflows. There are no
PR gates, automatic releases, container publishing, store submission or deploys.
Local checks remain available in each repository. Build steps verify their
inputs; an uploaded artifact is not evidence of physical-device qualification.

| Owner | Downloads |
| --- | --- |
| android | One development-signed phone/Android TV APK, three native ABIs |
| desktop | Windows x64 NSIS EXE; Linux x64 DEB and AppImage |
| roku | Compiled runtime ZIP, including bslib.brs |
| tv-web | Signed Samsung WGT, LG webOS 22+ IPK, matching hosted TV ZIP |

Downloads carry checksums and source revisions and expire after 30 days.
Native dependency and design pins stay immutable. A dependency change reaches
an installer only after the owning app explicitly adopts it and rebuilds.

Samsung signing requires author and distributor P12 files (base64) and their
passwords in tv-web Actions secrets: TIZEN_AUTHOR_P12, TIZEN_AUTHOR_PASSWORD,
TIZEN_DISTRIBUTOR_P12, TIZEN_DISTRIBUTOR_PASSWORD. The distributor certificate
must authorize the intended test TVs. Missing secrets fail only that job.
Certificates and passwords never enter Git or artifacts. Windows installers
are unsigned; Android preserves its deliberately public development identity.

## LG host contract

The LG IPK is a hosted launcher for the existing SolidTV renderer at
https://viptv.syek.tech/tv/?platform=webos. Minimum target: webOS 22. No visual
redesign or backend origin expansion. Native HTML media is capability-probed;
unsupported tracks/codecs follow the existing delivery contract. Back closes
the active overlay/route, then delegates root exit to LG. Media keys apply only
to the active player; live keeps its existing non-seekable policy. Backgrounding
stops playback and releases its session; returning restores navigation without
autoplay. Pairing/profile persistence stays origin-scoped. Qualify install,
startup, pairing, keys, media, suspend/resume and exit on actual LG hardware
separately from tests and packaging.

Samsung and LG installers launch hosted content. Manually deploy the matching
TV ZIP using the workspace's HTTPS process; preserve existing Host/Origin
rewrites. Do not report new runtime behavior live until its served asset hash
is verified. This policy does not authorize deleting production infrastructure.

## Verified downloads and remaining setup

| Target | Build evidence |
| --- | --- |
| Android phone + TV | [Universal APK](https://github.com/viptv-org/android/actions/runs/36364257334): downloaded checksum verified, all three native ABIs, no fixture CA. Phone remote pairing/buttons/swipe/recovery and TV navigation exercised on dedicated API 36 emulators with synthetic HTTPS fixtures. Setup Back-navigation and input retention have regression coverage. |
| Linux x64 | [DEB and AppImage](https://github.com/viptv-org/desktop/actions/runs/36360249014): both checksums verified. DEB installed and stayed running for 20 seconds in a disposable Ubuntu 24.04 container without developer SDKs; AppImage also passed an isolated host launch. Headless startup does not qualify GPU/media playback. |
| Windows x64 | [NSIS installer and current Linux packages](https://github.com/viptv-org/desktop/actions/runs/36363764259): native compilation, release tests, silent installation and eight-second installed startup passed. The launch test excludes the GStreamer SDK from PATH. Actual Windows video/TextureStream qualification remains separate. The preceding LZMA build also passed, with its downloaded checksum verified. |
| Roku | [main push](https://github.com/viptv-org/roku/actions/runs/36360098005) and [existing UI branch manual build](https://github.com/viptv-org/roku/actions/runs/36360294508) passed. Compiled ZIP checksum verified. The existing UI branch was not merged into main. |
| LG and hosted TV | [IPK and hosting ZIP](https://github.com/viptv-org/tv-web/actions/runs/36361962677) uploaded. HTTPS Chromium pairing/Home/Sources/Player fixtures and host lifecycle/key tests passed; physical LG qualification remains outstanding. |
| Samsung | Signing cannot run until the four secrets above are configured. The job fails explicitly; other TV artifacts still upload. No unsigned package is represented as installable. |

Older workflows were removed from first-party default branches; their history
remains in Git. No branch protections or rulesets required obsolete check names
when inspected. No production deployment or store publication was performed.

The desktop configuration selects zlib instead of default LZMA compression,
and the optimized installer passed the same checks. The initial Windows build spent
14 minutes 24 seconds compressing its bundled runtimes; the optimization changes
packaging, not application behavior or included runtime files.
