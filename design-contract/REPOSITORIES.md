# Repository ownership

All repositories are independent copies, not GitHub forks. Product/source repositories retain private visibility; only the organization profile is public. Local checkouts live under `/home/node/viptv-org/`.

| Repository | Owns | Spec |
|---|---|---|
| [design](https://github.com/viptv-org/design) | UI/UX specifications, app assets, parity and design-first workflow | [SPEC.md](https://github.com/viptv-org/design/blob/main/SPEC.md) |
| [roku](https://github.com/viptv-org/roku) | Unchanged native Roku application | [SPEC.md](https://github.com/viptv-org/roku/blob/main/SPEC.md) |
| [backend](https://github.com/viptv-org/backend) | Rust backend, pinned web delivery bundle and deployment packaging | [SPEC.md](https://github.com/viptv-org/backend/blob/main/SPEC.md) |
| [web](https://github.com/viptv-org/web) | React account/admin web application | [SPEC.md](https://github.com/viptv-org/web/blob/main/SPEC.md) |
| [tv-web](https://github.com/viptv-org/tv-web) | Shared React viewing client for web, Smart TVs (Tizen/Vizio), and desktop | [SPEC.md](https://github.com/viptv-org/tv-web/blob/main/SPEC.md) |
| [desktop](https://github.com/viptv-org/desktop) | Native Tauri v2 desktop application for Linux, Windows, macOS | [README.md](https://github.com/viptv-org/desktop/blob/main/README.md) |
| [android](https://github.com/viptv-org/android) | Android / Android TV Media3 playback library imported from air-tv/video; future app workspace | [SPEC.md](https://github.com/viptv-org/android/blob/main/SPEC.md) |
| [tauri-video-plugin](https://github.com/viptv-org/tauri-video-plugin) | Desktop playback plugin copied from get-air/tauri-video-plugin | [SPEC.md](https://github.com/viptv-org/tauri-video-plugin/blob/main/SPEC.md) |
| [video](https://github.com/viptv-org/video) | Web playback library copied from get-air/video | [SPEC.md](https://github.com/viptv-org/video/blob/main/SPEC.md) |
| [.github](https://github.com/viptv-org/.github) | Public viptv organization profile | [SPEC.md](https://github.com/viptv-org/.github/blob/main/SPEC.md) |

Roku/server/web extraction uses the actual local source at vynxc/viptv@7d6b413, including polish commits newer than original main. The monorepo retains history and the original checkout, configuration and untracked owner files are preserved. MIGRATION.json in each extracted app maps its original files and hashes; packaging/doc/test changes are separately identified.

Backend's dashboard gitlink pins independent web source. Its checksummed compiled bundle permits CI without cross-repository credentials because repository policy disables deploy keys. Web promotion is explicit; see backend/DELIVERY.md.

Desktop and TV-web app implementations are future work specified in PLATFORM_PLAN.md and design tickets. There is no claim that those apps exist merely because player libraries were copied. Imported library/application repositories have their upstream CI/CD removed as requested; replacement CI is deferred for those imports. Roku/backend/web and design have scoped validation and delivery.
