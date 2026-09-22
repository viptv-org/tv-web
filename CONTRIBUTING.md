# Contributing to VIPTV tv-web

Thanks for your interest. VIPTV is a multi-repository product; this repository owns the shared React viewing client for web, Smart TVs (Tizen/Vizio) and the desktop webview.

## Workflow

1. Read the pinned `DESIGN_REF` commit, [SPEC.md](SPEC.md) and the referenced design contracts before changing product behavior; record proposed UX changes in design first. Local addon mode is specified in the design repository's LOCAL_MODE.md.
2. Search this repository's GitHub Issues (start with issue #4) before opening a new one.
3. The shared core and player stack are vendored under `vendor/` with hash pins; change Rust in [viptv-org/core](https://github.com/viptv-org/core) or [viptv-org/video](https://github.com/viptv-org/video), commit there, then re-run `scripts/core-sync.mjs` / `scripts/video-sync.mjs`. Never hand-edit vendored trees.
4. Never commit credentials, tokens, provider URLs or screenshots. Report browser, real-media and physical-TV evidence separately.
5. Validate before pushing: `npm run test`, `npm run build` (design/core/video integrity checks, strict typecheck, production build), and `npm run test:e2e` for the Playwright acceptance suite.

## License

Contributions are licensed under the GNU General Public License v2.0 only (see [LICENSE](LICENSE)). By contributing you agree your work is licensed under it.
