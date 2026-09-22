# Contributing to VIPTV design

Thanks for your interest. VIPTV is a multi-repository product; this repository is the source of truth for product UI/UX specifications, interaction contracts and app assets.

## Workflow

1. Read [DESIGN.md](DESIGN.md) first; [CONTEXT.md](CONTEXT.md) defines shared product terms and [DESIGN_SYNC.md](DESIGN_SYNC.md) defines the immutable pin process every client adopts.
2. Search this repository's GitHub Issues before opening a new one; use the five triage labels from [DEVELOPMENT.md](DEVELOPMENT.md).
3. Follow the required format for new or revised features in [DESIGN.md](DESIGN.md): stable identifier, status, source revision, user intent, entry/exit, copy, layout, focus, inputs, states, cancellation/recovery, timing, accessibility, platform equivalents and acceptance scenarios.
4. Never commit screenshots, credentials, private notes (`DEV.local.md`, `.env`) or unprovenance'd assets. Keep [assets/FILES.json](assets/FILES.json) in sync with any asset change.
5. Validate before pushing: `python3 scripts/validate.py`.

## License

Contributions are licensed under the GNU General Public License v2.0 only (see [LICENSE](LICENSE)). By contributing you agree your work is licensed under it.
