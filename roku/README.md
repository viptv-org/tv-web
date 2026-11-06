# VIPTV tv-web — Roku host

Native SceneGraph host for the shared SolidTV entry in `../src/tv-solid`.
The browser entry remains `../src/tv-solid/main.ts`; this package only replaces
the renderer and browser services on Roku.

## Build

```sh
npm install
npx rk build --local --release --no-source-map --out-dir dist-roku
```

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
