# Real producer acceptance

`tests/remote-server/server.spec.ts` uses the actual Rust routes for device
pairing, profile selection, bootstrap, catalog/detail provenance, library
membership and preference persistence. It never intercepts `/api` responses.
The test account and external Stremio add-on are disposable fixtures. This is
separate from the deterministic `tests/remote` transport/lifecycle suite and
from real HLS decoder tests with mocked playback admission.

Use the existing trusted local certificate. No TLS-verification bypass is used.
All listeners bind loopback: HTTPS 18565, external add-on 18566, backend 18567.
The backend fixture uses an in-memory database. These commands do not replace
the shared QA candidate, database, static files or production routing.

From `tv-web`, start the owned ingress/add-on process:

```sh
node tests/preview/remote-server.mjs
```

Write `/tmp/viptv-remote-server-fixture.json` with the current isolated bundle:

```json
{"bind":"127.0.0.1:18567","addon_manifest":"http://127.0.0.1:18566/manifest.json","dist":"/tmp/viptv-tv-authority-20261023"}
```

From the workspace root, start the explicitly opted-in backend test harness:

```sh
SIMKL_CLIENT_ID= SIMKL_CLIENT_SECRET= \
VIPTV_AUTH_ORIGIN=https://viptv.local.test:18565 \
VIPTV_REMOTE_TV_FIXTURE=/tmp/viptv-remote-server-fixture.json \
cargo test --manifest-path backend/server/Cargo.toml --lib -j 2 \
  engine_v3::remote_tv_acceptance::remote_tv_backend \
  -- --ignored --nocapture --test-threads=1
```

Wait for `REMOTE_TV_BACKEND_READY`, then run from `tv-web`:

```sh
NODE_EXTRA_CA_CERTS=/mnt/ALPH/code/viptv-org/.local-https/certs/ca.crt \
npx playwright test --config playwright.server.config.ts
```

The fixture pins discovery to its owned add-on. The browser test resets only
synthetic saved titles in this in-memory account, so repeat runs are independent
of the previous run's membership. Stop only the two processes started for this
fixture when finished. The long-running Rust harness is a server process, not a
test that naturally returns a passing exit status.

This gate does not establish real gateway transcoding, server torrent delivery,
physical-TV decoder behavior or all-screen visual parity.
