# TV-web server wrapper — TV-REMOTE-001

Status: approved implementation scope, rendered acceptance pending.
Source: owner-approved TV-web rebuild, 2026-10-23; Tv3 reference boards at
07c76e0858ea62896aba88002cee2483d5d4796f.

SolidTV implements the 1920×1080 Tv3 boards, including their top navigation,
Onest typography, billboard, browsing transition, source panel and focus states.
The older rail/component sheets do not override these boards. Responsive React
browser/desktop layouts are outside this adoption.

Accounts are required. Omit guest/local sign-in, device-local providers and
torrents, downloads, casting, unsupported sign-in methods and episode annotations
without server support. Calendar is explicitly deferred because there is no TV
Calendar reference board; remove its navigation item and close the gap using the
board's existing spacing. Do not show dead controls for omitted features.

The server owns catalog and source order, availability, profile preferences,
history, resume, next-episode and playback authorization. The TV renders those
facts and submits intent. Focus, text input, scroll windows, animation, decoding,
request cancellation and lease execution remain platform effects. Credentials
may persist; there is no offline library or local execution fallback.

Use existing server capabilities to omit unavailable settings/actions. Parent
authorization is the account PIN, not a fabricated per-profile PIN. A failed
mutation leaves the confirmed value intact and offers retry. Back cancels the
current operation or overlay and restores its invoking focus. Source selection
is explicit; decoder errors cannot trigger locally chosen fallback. Next episode
requires activation. Existing 700 ms hold actions remain available through
visible menus, without adding remote-key hints to the new boards.

Acceptance: compare each applicable Tv3 state with matched content, recording
geometry and privately inspected image differences. Exercise entry, loading,
success, empty/error, cancellation and return focus; test profile isolation and
late responses. Record browser, real media and physical TV results separately.
No app captures belong in this repository. Server changes must remain additive
and compatible with the concurrent Roku implementation.

## My List query controls

Keep the Tv3MyList header geometry: server-returned type choices in the left
segmented control and the server sort label/current value in the right pill.
The shared Library API may advertise additional filters absent from the board.
Expose those through a Filters entry in the Sort menu, using the existing TV
choice panel, rather than adding another header pill. If the server advertises
filters without sort, the same right pill is labelled Filters. Omit controls
that the server does not advertise. Values, ordering and reset defaults come
from the Library snapshot; the board's Last watched value is fixture content,
not a client default. Filter edits are a draft: Clear previews `default_query`,
Apply reads the server result, and Back discards the draft. Failed Apply keeps
the confirmed list and the draft available for retry. This is TV-web's access
path for the existing shared query contract, not a change to Roku's KMP layout.

## Search inputs and returned content

Use Tv3Search's 520×72 input at (96,140), the two wide Space/Delete keys followed
by six columns of alphanumeric keys at (96,236), and 212×318 result posters
starting at (700,196), with 16px horizontal gaps. The credentials/name editor
keeps its separate punctuation/case keyboard. Query changes retire the previous
request and its selectable results immediately; typing and navigation remain
available while a response is pending. Search errors offer retry without
disabling the keyboard. Preserve the server's result order.

Channel search uses the existing scoped Live query when advertised. Do not
construct query suggestions from title strings or invent channel numbers or
current-program captions absent from the response. Those reference elements
remain omitted until their server projections exist. This does not remove the
supported channel-search feature or its reference geometry.

## Device entry and profile selection

Follow Tv3Splash, Tv3Welcome, Tv3SignIn and Tv3Profiles geometry and motion.
Welcome has the supported Sign in action only. Keep its poster wall opacity
and radial vignette separate; inherited opacity must be applied once, including
rounded artwork. Splash remains indeterminate. Reduced motion freezes the wall,
indicator and pairing pulse, and shows the final profile entrance positions.

Pairing opens in the board's passive waiting state. Any directional press focuses
New code; OK also activates it directly. Its URI, QR, code and expiry come from
the server. Display the expiry as a decreasing duration from a monotonic clock.
New code immediately clears the abandoned code and QR while the request is
pending. Back cancels the request and polling and returns to Welcome's Sign in;
a late reply must not reopen pairing. Failure offers retry; expiry never implies
successful authentication. Keep the QR at 300×300 inside the 340×340 white tile.
The longer server URI may wrap to two lines, moving the following step/code down.

Profiles use full 200×200 artwork clipped to the 28px radius. The selected tile
has an inset 4px white focus ring; locked labels use the inline lock. Keep the
450ms entrance and 60ms per-tile stagger. Add and Manage appear only when the
server advertises their corresponding capabilities. Down reaches Manage only
when present, Up returns to the selected profile, and horizontal movement stays
inside the returned profiles/Add sequence. Existing hold/menu access also obeys
the server's management capabilities. Empty and failed states retain the shared
retry and Back handling; no local profile is invented.

Acceptance includes matched private captures, rounded-opacity pixel checks,
normal/reduced motion, countdown and cancelled refresh, and a profile set with
all management capabilities unavailable. Browser geometry permits up to one
physical pixel of DOM/canvas rounding at 1920×1080; record larger differences
rather than widening that tolerance. These are web-TV states, not Roku redesigns.

## Home billboard motion

Use Tv3Home's nine-second featured indicator and fourteen-second ease-out
artwork zoom from 100% to 106%, centered on the displayed image. The image uses
cover sizing at center/30%; the fixed left, bottom and navigation masks do not
zoom. Round secondary controls retain the reference 24px backdrop blur and
30px glyphs; the primary filled Play glyph is 24px. Foreground controls and copy
remain above asynchronously loaded artwork.

The client advances only through the server's featured order. Remote activity
restarts the nine-second presentation cycle; rows, menus, pending/error states
and hidden-page lifecycle pause it. Returning to an active billboard starts a
fresh cycle. A new featured identity restarts the artwork effect, even if its
image URL is shared; unrelated metadata changes do not reload artwork. Reduced
motion keeps artwork at 100%, disables automatic cycling and shows a static
indicator. Auto-cycling must never request viewing intent, sources or playback.

Retire the image animation clock after fourteen seconds and cancel obsolete
image loads/timers on navigation or profile retirement. Use bounded renderer
state for animation; do not accumulate a shader-cache entry per frame. Verify
visible zoom, the nine-second boundary, interaction/menu/visibility pause,
reduced motion, foreground layering and sustained frame timing. These controls
are presentation of server data and do not decide resume, playback or episode
continuation policy.

## Focused-title Browse presentation

Use Tv3Browse's preview artwork at (760,0), 1160×620, with cover positioning at
60%/25%, its 560px left fade and bottom fade from y380 to y621. The title/logo
starts at (96,96), with the logo constrained to 420px width and 144px height;
metadata begins at y240, the three-line description at y290 and the optional
status row at y420. Continue Watching starts at y512 with 384×216 tiles at y564;
the next row starts at y896. Captions use the reference 24px/20px hierarchy,
inset focus ring, clipped four-pixel progress and focused play treatment.

The Home producer owns `view.preview.background`, caption, progress and action.
Keep episode artwork on the tile and consume the separate preview background.
Do not derive Resume/Next from percentages, timestamps or subtitle text. Only a
server-projected Play action gets the play affordance and activates viewing;
Details remains available through the existing context menu. Play still makes
a fresh server viewing-action/source request; the preview is never a playback
grant. Back from source selection restores the originating row/card focus.

Preserve the 400ms focus-settling delay and cancel superseded artwork. Late
backgrounds must remain behind rows and captions. Empty/absent preview facts
omit the hint rather than creating a local default. Current producer capability
labels/order and minute-based subtitles replace the reference's illustrative
data in matched fixtures. Release-age “New” badges remain omitted when the
producer has not projected them. Home-to-rows transition choreography remains
a distinct acceptance state; a static Browse capture does not qualify it.

## Bounded Live and channel Search traversal (proposed adoption)

TV Live and the channel row in Tv3Search retain at most two producer payload
pages and their `paging` descriptors. Geometry, copy and input mappings stay
unchanged. Forward/reverse requests copy the server cursor, row limit and
navigation page size; the UI never calculates a catalog cursor or retains a
history of evicted pages. Crossing a retained window preserves the channel
identity and visible focus position. Reverse traversal remains available through
the producer's previous descriptor, including short pages near the beginning.

D-pad movement within retained data stays immediate. At a pending page boundary,
focus stays on the current channel; the next deliberate movement is applied when
the page arrives if its origin focus, query, route and scope are still current.
Opposite movement cancels that pending focus intent. Prefetch follows actual
movement direction, so short reverse pages cannot create a request oscillation.
Back, profile/sign-out, query/category changes and source actions retire obsolete
outcomes. Playback returns to the same retained channel identity.

A changed snapshot retires pages and guides and reloads the first server page.
A failed request shows the existing retry state, preserving confirmed usable
rows when they remain in the same snapshot. Missing/invalid paging metadata is
an incompatible current server, never an excuse for cursor arithmetic or an
unbounded fallback. Revision refresh requests the focused retained page; if its
snapshot remains compatible, focus survives even far beyond the first page.

Acceptance: traverse forward/reverse beyond two pages; retain at most two pages
and constant descriptor count; verify exact request descriptors, short reverse
slices, delayed/rejected/retired replies, changed snapshot, profile isolation,
return from playback, and the existing guide/render/frame budgets. These are
browser requirements; physical-TV qualification remains separate.
