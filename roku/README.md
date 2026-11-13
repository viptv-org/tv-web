# VIPTV tv-web — Roku host

Native SceneGraph host for the shared SolidTV entry in `../src/tv-solid`.
The browser entry remains `../src/tv-solid/main.ts`; this package only replaces
the renderer and browser services on Roku.

## Build

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm run build -- --local --release --no-source-map --out-dir dist-roku
```

The Roku build regenerates the monochrome native icon assets from the shared
SVG path definitions before packaging them. It includes 384×384 textures plus
18×18, 22×22, 24×24, 28×28, 30×30 and 48×48 variants, plus the 28×30 play
variant that Roku can draw at their native display sizes.
Browser and webOS builds continue to render the SVGs directly.

Install this package independently; do not share another app's `node_modules`.
The pinned Git dependency needs its `prepare` build, allowed explicitly in
`pnpm-workspace.yaml`; do not skip install scripts for a fresh checkout.

Set `ROKU_DEV_CONFIG_PATH` to the local device store for `rk dev`. The host
requires Roku OS 16.0 or later.

The manual **Build beta Roku ZIP** Actions workflow builds main on a hosted
runner and retains the developer ZIP, source/file-hash provenance and checksums
for30days. It runs native tests and integrity checks without installing on a
device. The ZIP contains the channel manifest and runtime directories at its
root, targets the existing beta API and requires normal device pairing.
Its manifest-only build number is20000 plus the workflow run number, above the
retained11145 build. Hosted checks do not establish physical-TV qualification.

## Device update and qualification

Wake the device, then exit the running development app before sideloading. A Home
key can be consumed only by the OS screensaver; wait until repeated active-app
queries show Roku Home and the prior app has completed its exit. An accepted key
or installer response does not establish either condition.

Sideload with `--no-launch`, launch explicitly after installation completes, and
verify the installed build number plus visible ready UI. Wait for application
readiness before inspecting JavaScript; an active development-app ID alone is not
a startup pass. Qualify normal exit/relaunch and OS reboot persistence separately.
For reboot checks, confirm an uptime reset and inspect stored credentials before
launch can read, clear or replace them. Verify refresh, sign-out and fresh login
with playback settings; a successful Write/Flush acknowledgement alone is insufficient.
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

The manual Roku artifact workflow can validate an issue branch without device
access. Branch artifacts are validation inputs only. Deliver a ZIP built from
the final merged `main` revision, with its provenance and checksum verified.

Search and text modals open a native StandardKeyboardDialog or masked
StandardPinPadDialog. The native TextEditBox owns phone cursor/selection editing;
the shared app adopts whole values without writing them back on every edit.
Done commits; Cancel/Back restores the opening value. Native failure releases
input to the existing keyboard. Phone editing still requires physical acceptance.
