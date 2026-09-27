# Mainline consolidation — 2026-09-26

The previous `refactor/solid-tv` and `finish/solid-tv-goal` heads were both
preserved before merging. The native SolidTV focus/account/continuation runtime
from the completion branch is the common implementation. Later shared-core
headers/provider identity, stable focus bounds, carousel visibility, progressive
Home loading, live routing and TV-038 presentation were carried forward.

The public bootstrap selects SolidTV for Vizio, Tizen, webOS and layout=tv;
regular web and Tauri keep React. The old React TV entry is an explicit
`renderer=react` diagnostic path, never the implicit TV default. Direct
solid.html remains supported and keeps the same origin-scoped pairing storage.
The old React profile-editor bridge is removed from the SolidTV runtime.

All old branch heads are retained in remote `archive/2026-09-26/*` tags and
private Git bundles. The two old design study branches are recorded as
historical ancestry without restoring superseded prototypes and specifications.

Validation separates native-canvas account/focus/source/player scenarios from
React responsive/legacy regression tests. The public launcher test asserts the
SolidTV canvas and absence of the React TV tree for all three TV platform URLs.
Preview fixture discovery now tolerates absence of the private design checkout
in hosted CI; local visual review still uses the actual design reference assets.

Consumers must pin this reconciled TV-web commit, not whichever branch happens
to be checked out. Desktop pins core and the video plugin as well as the UI;
backend pins both dashboard and TV UI. Rebuild consumers and verify served bytes
before retiring old branch names. No branch merge itself qualifies physical TV
firmware/codec/DRM support.
