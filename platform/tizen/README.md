# Tizen packaging and device qualification

This directory describes a thin Samsung launcher for the shared hosted React UI and its `TizenAvplayAdapter`. `config.xml` requests Internet and Samsung AVPlay privileges. The launcher opens `https://<VIPTV-origin>/tv/?platform=tizen`, so the app/API/playback capability URLs remain same-origin. It intentionally uses the development package ID `VPTV000001`; replace it only when a production Samsung certificate/profile is provisioned.

`npm run package:tv` creates an **unsigned launcher WGT candidate** under `artifacts/tizen-candidate/` and a Vizio static hosting ZIP under `artifacts/vizio-hosting/`. Set `VIPTV_TIZEN_HOSTED_URL` when the production VIPTV origin differs from the default. The WGT is a reviewable ZIP-shaped candidate with a manifest stating that it is unsigned. It cannot be installed or presented as a Samsung release. A signed WGT needs a verified Samsung certificate/profile and a physical-TV smoke/fixture qualification.

The TV evidence matrix is in the design repository’s `PLAYBACK_CAPABILITIES.md`. For each target model and firmware, record the source fixture, engine version, direct/remux/audio-conversion/full-transcode result, startup/first-frame time, seek result, audio/subtitle result, recovery result, and whether the final-ten-second/Back transition retained the outgoing playback session. Simulator runs do not substitute for this evidence.

The adapter detects the global Samsung `webapis.avplay` runtime and sets its display rectangle to the hosted viewport before preparing media. The shared UI must subscribe to `PlayerSnapshot` and keep player controls/focus local while AVPlay buffers, seeks, errors, or changes tracks.
