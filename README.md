# VIPTV Shared Viewing Client (`tv-web`)

This repository contains the canonical shared React viewing client for VIPTV across Web (`watch.syek.tech`), Smart TVs (Tizen, Vizio), and Native Desktop ([`desktop`](../desktop)). It implements unified screen navigation, remote/keyboard/mouse interaction, focus engine, source selection, responsive layouts, and catalog viewing in one shared UI codebase. Only the player adapter and packaging differ:

- **Web (`watch.syek.tech`)**: Served via static web bundle and proxy.
- **Desktop (Linux, Windows, macOS)**: Native desktop shell lives in the dedicated [`viptv-org/desktop`](../desktop) repository, embedding this UI with native video decoding via [`tauri-video-plugin`](../tauri-video-plugin).
- **Tizen**: Prepares an unsigned launcher candidate that opens the hosted TV application with AVPlay.
- **Vizio**: Receives the static React bundle at `/tv/` with HTML media adapter.

The hosted bundle should use the VIPTV backend as its **same HTTPS origin**. The backend supports this when `VIPTV_TV_DIST` points to the built distribution. It serves the dashboard at `/` and the TV SPA at `/tv/`, including client-route fallback. This avoids credentialed wildcard CORS and keeps device Bearer requests and short-lived media capabilities same-origin.

Do not run the React bundle from a Tizen `file:` origin. The Tizen package is only a launcher; its hosted URL selects AVPlay with `?platform=tizen`. A browser bundle must never persist upstream media URLs, cookies, authorization headers, add-on URLs or playback URLs. `TvApi` removes sensitive add-on fields before UI state. Playback URLs are short-lived server capabilities and must be used immediately.

`TvApi` defaults to in-memory device tokens. `src/main.tsx` currently supplies `localStorage` for the hosted TV wrapper so a paired TV survives restart. Treat that origin as a trusted, dedicated appliance origin; platform packaging should not copy the token into its local launcher. Sign-out clears this store.

Read [AGENTS.md](AGENTS.md), [SPEC.md](SPEC.md), [DESIGN_REF](DESIGN_REF), and [src/api/CONTRACT.md](src/api/CONTRACT.md) before changing behavior. Product design and assets are owned by `viptv-org/design`; this repository does not supersede that source of truth.

## Local work

Use a recent Node.js release, then install the lockfile dependencies:

```sh
npm ci
```

`TvApi` accepts HTTPS origins only. For a local UI server, set `VITE_API_ORIGIN` to a development HTTPS VIPTV origin, or use a same-origin HTTPS proxy. Without it, a page loaded over HTTPS uses its own origin; a non-HTTPS local page falls back to the configured hosted VIPTV origin.

The deployment build uses an absolute `/tv/` asset base so assets also load after an SPA fallback such as `/tv/detail/...`. The package build may use a relative base only when its entry page is guaranteed to remain at its package root.

## Packaging and hosting

When the machine is healthy enough for a build, use the ordinary package script:

```sh
npm run package:tv
```

It produces an **unsigned** Tizen launcher candidate and a Vizio static hosting candidate under `artifacts/`. It does not create an installable Samsung release. A release still requires the Samsung signing profile and a physical-TV qualification. Do not overwrite a reviewed artifact path or include a signing key.

For the backend, build the TV distribution first, then set `VIPTV_TV_DIST` to its `dist` directory. See the backend README’s TV hosting section. Deploy the Vizio bundle under `/tv/` at that same HTTPS origin and keep the server-side SPA fallback.

## Design synchronization

The canonical UI and UX contract lives in [viptv-org/design](https://github.com/viptv-org/design). Read the pinned [sync workflow](design-contract/DESIGN_SYNC.md) and [TV rebuild contract](design-contract/TV_WEB_UI_REBUILD.md). `DESIGN_REF` identifies the immutable revision, and the build checks the imported specification and asset hashes. Update design first, then explicitly import its committed revision; visual and behavior evidence remain separate from the mechanical integrity check.

## Validation status

The 2026-09-13 shared Roku presentation rebuild replaces the older candidate layout. Current validation and remaining physical-device qualification are recorded in [TESTING.md](TESTING.md) and the [parity matrix](tests/PARITY_MATRIX.md). Browser evidence does not certify physical Samsung/Vizio decoding or signing.

## Trusted LAN preview

Run `VITE_LAN_PREVIEW=1 NODE_OPTIONS=--max-old-space-size=256 npm run dev -- --port 4173 --strictPort`, then open `http://<server-LAN-IP>:4173/?platform=vizio`. If running inside a container, expose the port on the LAN host too.

This opt-in development mode sends API and media requests to the preview origin. Vite forwards them to the verified HTTPS backend and translates only the preview's matching Origin header; unrelated origins remain rejected. The API allows HTTP only for an explicitly enabled, same-origin development preview. Production builds retain HTTPS requirements. Use this HTTP preview only on the trusted LAN. Pair this browser through the normal device flow; no credentials are embedded in the app.

Validation: real Chromium pairing through the LAN proxy returned200 with no CORS errors; unrelated Origin returned403 and an invalid media capability returned404. API tests21passed and TypeScript passed.

## Shared application core

Rust in `viptv-org/core` owns response normalization, restoration and shared presentation/source/continuation rules. This app runs its WASM build and shared effect driver; React retains rendering/focus and platform adapters execute network, storage and decoding. A hero uses the core's landscape-only artwork role, with the existing background when no suitable artwork exists.

Update the owning Rust code and generated artifacts, commit core, then run `node scripts/core-sync.mjs sync ../core`. Commit CORE_REF and its hash-checked vendor snapshot together. Android adopts the same revision through its own sync script. Do not patch generated/vendor files independently. Shared rules change once in Rust, but each deployed app still needs to adopt and rebuild from that version.

## Responsive browser and desktop layout

The ordinary browser entry now uses the responsive viewing UI backed by the same real authentication, Rust-normalized catalog, profile/history and playback flows as TV. `?platform=tizen`, `?platform=vizio` or `?layout=tv` preserve the fixed TV renderer. Responsive screens use original VIPTV colors and contained artwork, with an optional locally persisted OLED canvas.

Tauri hosts use `@tauri-apps/plugin-http` for API requests (no redirects), requiring the host's restricted HTTP capability and plugin registration. SmartCast additionally needs the exact native commands from core/adapters/tauri/smartcast.rs and `VITE_VIZIO_RECEIVER_URL` pointing at a deployed HTTPS receiver. The browser offers a truthful native-app handoff; it cannot pair a LAN TV over insecure HTTPS. Native host packaging, receiver deployment and physical decoding are not established by a browser build.

For the authorized LAN preview: `VITE_LAN_PREVIEW=1 NODE_OPTIONS=--max-old-space-size=256 npm run dev -- --port 4181 --strictPort`. Proxying remains same-origin with verified upstream TLS. Do not use this opt-in development server as a public production deployment.
