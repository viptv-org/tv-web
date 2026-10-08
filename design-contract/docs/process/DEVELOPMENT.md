# Development process

1. Search existing GitHub Issues in the owning repository and design. Specify behavior in design using DESIGN.md. Use `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix` consistently.
2. Record any platform deviation and its equivalent discoverable action. Commit design and reference its immutable SHA in the app's DESIGN_REF and implementation ticket.
3. Change the smallest relevant module. The Rust backend owns policy, each app owns rendering and its playback adapter. Keep Roku runtime unchanged for this migration.
4. Run the owning repository's CI commands and relevant acceptance scenarios. Check actual failure/cancellation/focus paths, not only successful rendering. Use simulator/emulator for iteration and report its limits.
5. Publish a reviewable commit and CI evidence. Release artifacts only from validated revisions. Production deployment must preserve current data and the established origin, environment and volume. An emulator pass is not a physical TV pass.

## Asset delivery
Keep authoritative originals and generators in design/assets. Apps keep their packaged subset to work offline and avoid fragile recursive submodules. Record asset hashes in the design catalog and reference the design commit; explicit asset sync commits make updates reviewable. A separate assets repo is unnecessary at current scale.

Android tooling and AVD commands are recorded in [ANDROID_DEVELOPMENT.md](ANDROID_DEVELOPMENT.md).
