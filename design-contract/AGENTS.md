# Design development

Read DESIGN.md before changing specifications. For a feature, read viptv-design-system/ (visual design: tokens, components, copy, decisions, reference screens) and specs/behavior together; they form one contract. Platform themes are generated from viptv-design-system/tokens/tokens.json by viptv-design-system/tools/gen-themes.mjs. Before UI changes, design pin updates, asset imports or parity claims on any platform, read DESIGN_SYNC.md. CONTEXT.md owns product terms. assets/ owns app asset sources and provenance.

Preserve the baseline/proposed distinction and cite the actual source revision when documenting implemented behavior. For any UI change, update copy, geometry, state transitions, every tap/hold/repeat action, focus restoration and acceptance scenarios together. Describe screenshots in text after private inspection; commit app assets only, never screenshots.

Search this repository's GitHub Issues before opening a spec or ticket. Use the five triage labels in DEVELOPMENT.md. An implementation ticket must link the design commit and impacted platform scenarios. Run python3 scripts/validate.py before publishing. Completion requires link/asset validation and coverage of the affected entry, success, failure and return flows; report remaining unknowns explicitly.
