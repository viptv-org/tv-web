# VIPTV visual specification

This directory is the visual source of truth for every VIPTV client. It records the shipped Roku presentation at baseline `7d6b4131a44d87b58edcf12709af5851da387176` (2026-09-12), including the polish through `768137a` and `f5a6052`.

Read [VISUAL_SYSTEM.md](VISUAL_SYSTEM.md) first, then [SCREENS.md](SCREENS.md) for exact screen construction and [STATES_AND_MOTION.md](STATES_AND_MOTION.md) for transitions, loading, focus, and failure treatment. The behavioral contract lives beside this document set; this directory deliberately covers visual expression and observable visual states.

The baseline coordinate space is **1280 × 720 landscape**. Values are logical pixels. A 1920 × 1080 display is 1.5× logical scale; preserve proportions and minimum target sizes rather than treating 1280 × 720 as a raster screenshot.

No screenshots are design assets. Reconstruct screens from these specifications and the checked-in source assets only.

## Exact declarative reference

[declarative-layout.json](declarative-layout.json) records every component’s initial node types, properties, child hierarchy and exposed fields from the pinned baseline. Use it for exact values beyond the prose tables. Runtime layout overrides in SCREENS.md and STATES_AND_MOTION.md take precedence; XML initialization alone is not the final layout.
