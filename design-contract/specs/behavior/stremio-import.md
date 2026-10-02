# IMP-001 — Stremio import in account web

Status: owner-approved dev-only implementation, requested on 2026-10-01.
This records the development import contract and its validation scope. It does
not claim adoption by every platform. Existing ADM-002 assets/tokens/pins remain
unchanged.
The implementation is in the backend and account dashboard, not Android or /tv.

## Intent and entry

Account settings contains an "Import from Stremio" card beneath account/profile
settings. It names the currently selected destination profile. Members can use
it for their own profile; paired-device sessions cannot. Initially, restricted
profiles cannot import, including after parent unlock. The user can switch to an
unrestricted profile using existing profile management. No implicit destination.

Reuse ADM-002 card, field, button, feedback and responsive layout primitives.
No new canvas geometry, palette, assets or pixel-parity claim is introduced.
At 390px forms and actions wrap without horizontal scrolling. Labels and long
profile names wrap. Desktop and mobile share the same meanings and action order.
TV viewing clients have no credential/import UI; they read the resulting profile.

## Flow, copy and state

1. Explain: "Preview first. Nothing is saved until you confirm the import."
   Show "Import into: <profile>". Fields are "Stremio email" and "Stremio
   password"; password is concealed with the existing accessible reveal control.
   Options are "My List" and "Watch history and resume", both initially enabled.
   Explain: "The first version imports saved IMDb titles, movie history and
   resume, and exact episode resume. Full episode watched history and unsupported
   IDs are left for review. Likes/loves are not imported."
2. "Preview import" fetches a bounded read-only source snapshot. Disable duplicate
   submits; show a labelled busy status. "Cancel" aborts this request. Clear the
   password when the request starts, on error, cancellation, profile/account
   replacement, parent blocking, navigation away and disposal. Never persist it
   in browser storage, analytics, URLs, logs or the app bundle.
3. Preview names the same profile and shows aggregate additions/updates,
   existing rows preserved, already-imported entries, skipped entries and entries
   needing review. It explains newer/equal VIPTV history is preserved. No raw
   export, tokens, source URLs or credentials are displayed. No history is written.
   Confirmation starts unchecked: "I confirm this import is for <profile>."
   Actions: "Cancel" and "Confirm import". Confirmation is disabled unless checked
   and the preview is current/unexpired. A profile change discards the preview.
4. Confirm applies the preview in one guarded backend transaction with a private
   consistent backup. During apply, no duplicate submit or false rollback promise.
   Completion shows actual counts and "Import complete". "Start another preview"
   returns to empty credential entry. Repeated imports cannot resurrect imported
   favorites the user subsequently removed; newer/equal progress is retained.
5. Expired/stale preview: "This preview is no longer current. Preview again."
   Sign-in failure: "Stremio sign-in failed. Check your details."
   Source/network failure: "Could not read Stremio. Try again."
   Other failures use safe fixed copy, never raw upstream diagnostics.
   Interrupted apply may have committed; retry/preview must use replay protection,
   not imply cancellation necessarily reversed a transaction.

## Input, focus and accessibility

Ordinary click/tap, Enter/Space activation and Tab navigation use the existing
native controls; no hold/repeat behavior. Field labels remain programmatic labels.
Preview and completion headings receive focus after a successful phase change;
errors announce role=alert and busy/completion announce role=status. Cancel/reset
restores the email field. Screen replacement cannot focus an old profile's element.
No new overlay or Back trap: existing account navigation remains available and
unmount aborts requests. Hidden/parent-blocked presentation clears import secrets
and aborts pending work, rather than retaining a usable confirmation.

## Owner-approved extension — addon-assisted named review

Requested and approved for dev implementation on 2026-10-01. The flow is now
Stremio sign-in → review optional add-ons → verify metadata → inspect named
items → explicit confirmation. Existing owned metadata add-ons may also assist.
Preview and metadata verification remain read-only. Selected new add-ons are
account-wide configuration, clearly acknowledged, and are only registered at
final confirmation using the existing encrypted account-owned storage.

The review shows bounded, searchable/paged title and episode rows with clear
ready/preserved/needs-review status, planned My List/history changes, and fixed
reasons. No source URLs, credentials, raw IDs or opaque context are displayed.
Use neutral type icons instead of fetching unverified artwork. Checkboxes can
exclude selectable rows; search/filter, include/exclude matching, and restoring
excluded rows do not alter source data. Counts update to the chosen scope.
Changing any selection clears confirmation. Excluded rows receive no data or
import-receipt writes; retry must use the same committed selection.

Episode watched flags require verified ordered metadata and a valid anchor;
missing metadata and missing per-episode watch dates are shown honestly. Never
fabricate episode dates or let undated completion obscure a newer resume. If a
safe persistence contract is unavailable, show the matched flags as review-only
rather than silently importing them with a made-up date. Source ID matching is
verified, not a provider alias guessed by the web adapter.

## Owner-approved extension — guided optional import stages

Requested for development on 2026-10-01. Use one focused stage at a time:
Connect Stremio → Choose add-ons → Review items → Confirm import. Show the
current step and its name, with a short explanation and a consistent Back/Next
action row. Reuse the existing account design primitives; this is a guided
flow, not a new external form service. The final confirmation remains explicit.

Compatible add-ons are selected by default. Explain "Do you want to bring these
add-ons into VIPTV? Uncheck any you do not want." Provide Select all, Clear all
and Continue without add-ons. Unavailable add-ons stay disabled with a reason;
existing add-ons are identified. New add-ons are only saved at final confirmation
and are account-wide. Skipping add-ons never removes existing configuration.

Supported title/history rows start selected. Search, status filters and individual
checkboxes expose the actual names, type, episode, planned changes and resume
details. Needs-review entries show their reason and remain unselected. Next leads
to a separate final recap of the chosen scope and destination, with the destination
confirmation initially unchecked. Empty import scopes cannot be confirmed.

Back from confirmation restores the exact item choices. Back from item review
restores the add-on choices. Revisiting unchanged add-on choices reuses the current
review; changing them regenerates the review from the retained read-only source
snapshot without retaining or requesting the password. Existing exclusion choices
are retained for stable review-item handles; newly eligible items start selected.
Any scope change clears final confirmation. Back to Connect retains the preview
and choices, showing the connected account and source scope without retaining
the password. Next resumes that draft. Changing the connection discards it and
requires a new preview when the account or source options change.
Expiry, account/profile replacement and cancellation discard the usable preview.
Once apply starts, Back and selection changes stay disabled until its outcome is
known; an uncertain outcome retries the same confirmed selection.

Stage headings receive focus after navigation. Back/Next remain available by
keyboard and touch, wrap at 390px without horizontal overflow, and retain truthful
busy/error copy. Verify forward/back navigation, optional add-on skipping, exact
selection preservation, changed add-on re-review, stale responses, expiry, unknown
apply outcomes and a final confirmation with no earlier writes.

## Acceptance

- Member can preview for the selected own unrestricted profile; no writes before
  explicit confirmation. Device, foreign, replaced or restricted scopes refuse.
- Preview includes profile name, truthful initial-version limitations and counts;
  the confirm checkbox is unchecked. Password is blank after submit.
- Cancel, profile/account switch, sign-out and parent blocking discard presentation;
  delayed old responses cannot enable confirmation for a replacement profile.
- Invalid login, timeout, expiry and stale target give safe actionable recovery.
- Apply is atomic/backup-first; failure leaves rows/receipts unchanged. Replays,
  source duplicates, newer progress, manual corrections and local favorite removal
  are covered independently by backend tests. Queue hiding remains intact.
- Render credentials/preview/completion/error at desktop and 390px widths; inspect
  clipping, wrapping, focus and accessible labels. No actual personal import is
  claimed until the owner selects a destination and confirms the preview.
