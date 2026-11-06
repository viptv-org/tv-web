# TV preview and measurement harnesses

Development tools for the SolidTV TV entry. They drive a fixture backend
(`remote-backend.ts`) and the built TV client; nothing here is a pixel
assertion suite.

- `remote-shoot.mjs`, `remote-visual.mjs`, `remote-*-visual.mjs` — matched TV
  screenshots against the design references.
- `remote-perf.mjs`, `remote-entry-perf.mjs`, `remote-billboard-perf.mjs` —
  frame/handler/main-thread measurements for the TV workload.
- `solid-*.mjs` — focused SolidTV flows (entry, home, live, title, search,
  account, focus, polish).
- `vizio-sim.mjs` — the Vizio SmartCast profile (UA, CPU and network shaping)
  for playback checks.
- `remote-server.mjs`, `https-static.mjs` — local fixture/static servers.

The React preview screenshots and their `shoot.mjs`/`screens.mjs` tooling were
removed with the React client in issue #100.
