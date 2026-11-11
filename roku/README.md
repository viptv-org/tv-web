# VIPTV tv-web — Roku host

Native SceneGraph host for the shared SolidTV entry in `../src/tv-solid`.
The browser entry remains `../src/tv-solid/main.ts`; this package only replaces
the renderer and browser services on Roku.

## Build

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm exec rk build --local --release --no-source-map --out-dir dist-roku
```

Install this package independently; do not share another app's `node_modules`.
The pinned Git dependency needs its `prepare` build, allowed explicitly in
`pnpm-workspace.yaml`; do not skip install scripts for a fresh checkout.

Set `ROKU_DEV_CONFIG_PATH` to the local device store for `rk dev`. The host
requires Roku OS 16.0 or later.

## Boundaries

- `src/roku/renderer.ts`, `node.ts`, `fonts.ts`, `effects.ts` — the native
  SceneGraph renderer.
- `src/roku/browser-services.ts` — window/document/location/storage/fetch
  compatibility for the shared entry.
- `src/roku/video.ts` — native Video adapter.
- `src/tv-solid/platform/roku-shims.ts` and `platform/roku-playback.ts` in the
  parent app are the shared platform boundary. Canvas image effects are being
  migrated to native/pre-rendered implementations there.

## Dependency and execution boundaries

The browser and native host pin the same SolidTV fork commit and Solid 1.9.17.
RSG SDK 2.19.0's Solid adapter requires Solid `^1.9.17`; the native resolver aliases
all Solid imports to the host runtime. The host installs the public renderer
factory after browser services and before importing the shared application.
Builds do not rewrite installed framework files.

Solid computations, input callbacks, JSON parsing and JavaScript animation
fallbacks execute on the Program thread. Promise/async scheduling does not move
CPU work to another thread. `WorkerTask` handles the host's explicit HTTP/task
operations; SceneGraph animation components run in the Render context. These
boundaries do not imply browser `Worker` or `SharedWorker` support or establish
frame-rate/input-latency guarantees.
