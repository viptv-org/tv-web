# VIPTV desktop app

The Tauri v2 shell for the shared tv-web viewing UI. The frontend is the
regular tv-web bundle: `tauri.conf.json` points `devUrl` at the Vite dev
server and `frontendDist` at `../dist`, so no separate desktop build of the UI
exists. Under `__TAURI_INTERNALS__` the app selects the `tauri` player
platform (`src/player/tauri-native.ts`), which drives the native playback
engine from `tauri-video-plugin` and declares a no-transcode delivery profile.

## Prerequisites

- Rust 1.85+ and the Tauri v2 CLI (`npm i -D @tauri-apps/cli` in the tv-web
  root).
- Linux: `webkit2gtk-4.1`, `gtk3`, `libayatana-appindicator` (Tauri deps) plus
  GStreamer 1.24+ with the `gstreamer-runtime` plugin feature. On Debian/Ubuntu:
  `libwebkit2gtk-4.1-dev libgtk-3-dev gstreamer1.0-dev gstreamer1.0-plugins-{base,good,bad,ugly}`.
- Windows: WebView2 and GStreamer runtime (see
  `../../tauri-video-plugin/docs/windows.md`).
- The `tauri-plugin-video` dependency is a **path** dependency
  (`../../tauri-video-plugin`), so this crate builds only inside a checkout of
  the whole `viptv-org` workspace with that repository present.

## Commands

Run from the tv-web repository root (the CLI resolves `src-tauri/tauri.conf.json`):

```sh
npm run tauri dev     # vite dev server + debug build, hot reload
npm run tauri build   # runs npm run build, then bundles the desktop app
cargo build           # plain Rust build inside src-tauri (no frontend needed)
```

## Backend origin

The API origin follows `src/main.tsx`:

1. `VITE_API_ORIGIN` if set at build time (e.g. `.env`, never committed),
2. `https://viptv.local.test:8443` for Tauri **dev** builds,
3. `https://viptv.syek.tech` otherwise (release default).

API requests are routed through `@tauri-apps/plugin-http`. Two desktop-only
details make that transport work against the backend's single-origin pin:

- The app pins `Origin` to its API origin in `src/main.tsx`; the plugin would
  otherwise pin it to this window's origin, which the backend rejects. This is
  why `unsafe-headers` is enabled on the plugin in `Cargo.toml`.
- `rustls-tls-native-roots` makes the transport honor the platform trust
  store; the plugin's default bundled roots reject locally-signed dev
  backends even after `trust-ca.sh` installs the CA system-wide.

## HTTP fetch scope

`capabilities/default.json` allows plugin-http fetches to the production and
local HTTPS origins only. When pointing a desktop build at another backend,
add that origin to the `http:default` `allow` list (and set
`VITE_API_ORIGIN`).
