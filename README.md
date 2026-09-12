# VIPTV TV web

This repository contains the shared React TV application for Tizen and Vizio. It implements the Roku-derived screen, remote, focus, hold, source-selection and continuation behavior in one UI. Only the player adapter and packaging differ:

- Tizen prepares a small unsigned launcher candidate. After signing it opens the hosted `https://<VIPTV origin>/tv/?platform=tizen` application and requests AVPlay; remote-hosted bridge availability still requires TV verification.
- Vizio receives the same static React bundle at `/tv/` and uses the HTML media adapter. The backend prepares a compatible delivery before playback; transcoding is a fallback after direct play, copy or remux.

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

## Validation status

The API boundary test file previously passed with seven tests and final source TypeScript checking passes with a 256 MB heap. Runtime tests have **not** been rerun after the later client, UI, packaging and backend changes because the owner paused memory-intensive work after a server out-of-memory event. No browser suite, package build, Samsung emulator, Tizen hardware or Vizio hardware test has been claimed as complete.

Use [TESTING.md](TESTING.md) when the machine is ready. It separates mocked browser coverage, backend contract coverage, hosted smoke checks and real-device evidence.
