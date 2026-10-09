# Migration validation and limits

## Baseline preservation
Source snapshot: vynxc/viptv@7d6b4131a44d87b58edcf12709af5851da387176. Original branch, worktree and untracked owner files are retained. Production configuration, data and Roku installation are untouched. Each extracted repository records original paths and checksums in MIGRATION.json. Packaging/documentation changes are called out separately; runtime code remains unchanged.

## Checks performed
- Web: npm clean install, 95 tests and production build passed locally; GitHub Actions initial extraction run 34704298024 passed.
- Backend: cargo fmt, strict all-target Clippy, non-media library/integration tests passed locally; 9 host-check tests passed. The real FFmpeg backend job passed in GitHub Actions run 34704517397; Docker image build and isolated container acceptance also passed there because this local container has no FFmpeg or Docker daemon.
- Roku: original static contracts passed; 19 runtime harnesses passed after fixing one stale test fixture to include its existing ContinuationPolicy dependency. Production source remains unchanged. BrightScript staged compilation and a 749-member runtime ZIP (including generated bslib.brs) passed. GitHub CI verifies the same contracts and packages the staged output.
- Design: required documents, local links, private-file exclusions and per-asset checksum inventory are validated by scripts/validate.py. Current behavior and planned platform work are distinguished.

## Delivery constraints confirmed at the authoritative source
GitHub reports the organization plan as Free. The branch-protection API rejected private-repository protection with HTTP 403 (upgrade or public repository required). Repositories remain private; branch protection is not claimed enabled. CI still validates PRs/main and gates release jobs through job dependencies. Delete-branch-on-merge and squash-only merge settings are configured.

GitHub rejected a web deploy key with HTTP 422: deploy keys are disabled for this repository. No private key or account-wide token was stored. Backend uses a checksummed compiled web bundle, pinned to an exact source gitlink, with explicit promotion and verification scripts.

The production health endpoint was unreachable from this environment; current live health is not verified. Artifact delivery workflows do not constitute production rollout or physical Roku testing. The named volume is explicitly retained as viptv_viptv_data in the extracted backend Compose file.

## Published source provenance

The original snapshot 7d6b413 was local and unavailable through the original GitHub commit endpoint. Source citations therefore resolve to the independently published Roku extraction at a047d9ca5fc80898013eefb66120d20fab5048c0, whose MIGRATION.json proves the runtime bytes match that snapshot. No unreviewed original-history branch was published solely to repair links.

## Imported libraries and Android tooling


Temurin JDK 17, Android SDK/build tools/emulator and phone API 35 / TV API 36 AVDs are installed under /home/node/viptv-org/.tooling. No /dev/kvm is exposed, so accelerated emulator execution and physical Android TV acceptance are not available in this container. No emulator was booted.
