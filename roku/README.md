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

## Device update and qualification

Wake the device, then exit the running development app before sideloading. A Home
key can be consumed only by the OS screensaver; wait until repeated active-app
queries show Roku Home and the prior app has completed its exit. An accepted key
or installer response does not establish either condition.

Sideload with `--no-launch`, launch explicitly after installation completes, and
verify the installed build number plus visible ready UI. Wait for application
readiness before inspecting JavaScript; an active development-app ID alone is not
a startup pass. Qualify normal exit/relaunch and retained sign-in separately.
Do not loop hot replacements when the native runtime stalls before JavaScript.

Release builds drop console calls by default. Use `--no-drop-console` when
reproducing qualification that retained console output, and record that flag with
the source revision and compiled-payload hash.

## Boundaries

- `src/roku/renderer.ts`, `node.ts`, `fonts.ts`, `effects.ts` — the native
  SceneGraph renderer.
- `src/roku/browser-services.ts` — window/document/location/storage/fetch
  compatibility for the shared entry.
- `src/roku/video.ts` — native Video adapter.
- `src/tv-solid/platform/roku-shims.ts` and `platform/roku-playback.ts` in the
  parent app are the shared platform boundary. Native artwork uses public proxy
  derivatives and packaged masks; the browser Canvas renderer is not shipped.

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
