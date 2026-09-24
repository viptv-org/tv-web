# Local addon mode (proposed)

Status: **proposed**. Source revision: design `627201e898c7fa1af7deea638f201344a8862bf7` (2026-09-21). This document defines account-free operation of the shared viewing client from an on-device addon registry. It does not change the backend-hosted (thin) client, the Roku baseline, or any signed-in flow. Implementation issues must reference this document's immutable adoption commit. Identifiers below are stable (`LM-###`); acceptance scenarios are `LM-A#`.

## LM-001 — Concept and availability

**User intent.** A household can run the shared viewing client without a VIPTV backend or account: they install catalog addons by URL on the device, browse them, and play streams directly.

**Availability.** Local mode is a build-time declaration of the same frontend, not a UI fork. Builds packaged for standalone use — the native desktop shell and standalone/packaged TV bundles — declare the local capability. The backend-hosted web flavor does not offer local mode and its screens are unchanged. Native hosts (desktop, Android) may additionally support direct media providers whose endpoints cannot be reached from a browser; that capability is defined per platform and is out of scope for the shared web bundle.

**Entry/exit points.**
- Entry: the sign-in screen of a local-capable build shows a visible secondary action `Use without an account` below the primary sign-in form. Activating it enters local mode with an empty or previously saved registry.
- Exit: `Settings → Sign in to an account` opens the standard sign-in flow. Signing in leaves local mode; the local registry is preserved (not deleted) and re-enters unchanged via the sign-in screen action.
- Back from the local-mode home returns to normal app exit behavior (same as signed-in home on that platform).

**Data.** Local mode has no profiles, no parental controls, no queue/history synchronization and no cross-device state. Anything not listed in LM-005 is not created. The sign-in screen copy when the action is focused: `Your addons and playback stay on this device. No account, profiles, or sync.`

## LM-002 — Local addon registry

**Data.** A versioned, on-device registry of installed addons:

```json
{
  "version": 1,
  "nextOrdinal": 3,
  "addons": [
    {
      "ordinal": 1,
      "id": "string",
      "manifestUrl": "https://example.test/manifest.json",
      "manifest": {},
      "installedAt": 1234567890,
      "enabled": true
    }
  ]
}
```

`id` is the addon manifest `id` when present, otherwise the normalized manifest URL. `manifest` is the parsed manifest document at install time. `ordinal` is a monotonically increasing install counter that is never reused, so a catalog selected as "addon N" keeps pointing at the same addon across restarts and removals. The registry is the only local-mode persistent state in this revision.

**Management surface.** `Settings → Addons` lists installed addons as rows: addon name, short id, and an enabled/disabled control; a remove affordance per row; an `Add addon` action opens a URL field using the platform's existing text entry. Visible copy: empty state `No addons installed yet.`; row disabled state dims the row and its catalogs disappear from browsing.

**States and errors.**
- Add `loading` disables the field and the confirm action and shows `Installing…`.
- Invalid URL: inline error `That does not look like an addon URL.`; the field retains the entered text; focus stays on the field.
- Fetch/parse failure or a manifest without catalogs: inline error `Could not install this addon.` with a `Retry` action; the addon list is unchanged.
- Duplicate manifest URL: inline error `This addon is already installed.`; the existing row takes focus.
- Remove: confirmation dialog `Remove <name>? Its catalogs leave this device.` with `Remove` and `Cancel`; `Cancel` restores focus to the row's remove affordance; `Remove` returns focus to the next row or the `Add addon` action when the list becomes empty.

**Input behavior.** Standard press/release; no hold or repeat actions are introduced. Keyboard/remote focus order: list rows top-to-bottom, then `Add addon`. Focus restoration follows the existing Settings contract.

## LM-003 — Local discover browsing

Local mode reuses the signed-in Home/Discover hierarchy (RUI-030, formerly in RESPONSIVE_PRODUCTION.md): content-type group → catalog → declared filters, derived only from **enabled local addons**. Catalog rows disambiguate by addon name (`addon · catalog`). No filter appears that the selected catalog does not declare.

Discovery negotiation, aggregation, pagination and error copy are byte-identical to the backend contract because they run the same shared provider logic in the client: 32-catalog aggregation cap for search, 200-item page cap, `has_more`/`next_skip` derived from raw page length, genre validation errors, and addon order by installation. Deviations are defects, not platform exceptions.

Loading, empty (no enabled addons: `Install an addon to start browsing.` with a direct route to `Settings → Addons`), and recoverable error states match the signed-in Discover behavior; errors never replace already-loaded catalog data.

## LM-004 — Local playback

Streams discovered from local addons play with the direct-first ladder minus server preparation: direct/copy/remux and segmented playback through the platform's existing adapters. No VIPTV server session, transcode or source ranking exists in local mode. Playback failure shows the existing error surface with `Retry` and `Next source` actions limited to sources from the same local discovery response.

Watch-state (resume positions, continue-watching rows) is **not included** in this revision; no local history surface may be invented by an implementation. This is an explicit, recorded gap for a future revision.

## LM-005 — Persistence and privacy

The registry is stored in the host's durable storage under a single namespaced key. It is never synced, uploaded, or included in diagnostics. Addon manifest URLs may embed access tokens; they are treated as credentials: never logged, never rendered in full after entry (the management list shows the addon name and id), and never sent anywhere except the addon's own host. Clearing host storage (or the platform's app-data reset) deletes the registry — the only supported uninstall-everything path in this revision.

## LM-006 — Platform equivalents

| Platform | Local mode availability | Notes |
| --- | --- | --- |
| Backend-hosted web (thin) | Not offered | Screens unchanged; no entry point rendered |
| Standalone/packaged web and TV bundles | Offered | Addon fetching is subject to browser CORS; only CORS-capable addon hosts are reachable |
| Native desktop shell | Offered | Host may fetch addons and media natively; the registry stays in webview/host storage per the desktop adapter contract |
| Android | Follow-up | Defined with the Android rebuild contract, not here |
| Roku | Not offered | Roku baseline is frozen |

## Acceptance scenarios

- **LM-A1 Onboarding**: in a local-capable build with no stored session, `Use without an account` enters local mode; in the backend-hosted build the action does not exist.
- **LM-A2 Install success/failure**: adding a valid manifest URL appends a row and its catalogs appear in Discover; an unreachable URL shows the inline error, leaves the list unchanged, and `Retry` reattempts.
- **LM-A3 Remove**: remove confirmation, cancel restores focus; removing the last addon shows the empty state and focus lands on `Add addon`.
- **LM-A4 Hierarchy**: two enabled addons with movie, series and custom-type catalogs (including duplicate catalog names) produce exactly the RUI-030 groups, `addon · catalog` disambiguation and declared filters.
- **LM-A5 Genre error**: requesting a genre a catalog does not advertise shows the shared genre error copy.
- **LM-A6 Pagination**: a single pageable catalog advances by raw page length with `has_more` until an empty page; search aggregation does not paginate.
- **LM-A7 Local playback**: a playable stream starts direct-first with no server session; failure surfaces `Retry`/`Next source` over local sources only.
- **LM-A8 Persistence**: restarting the host preserves installed addons and enabled flags; nothing else is created.
- **LM-A9 Exit**: `Sign in to an account` completes account sign-in; the local registry survives and local mode can be re-entered from the sign-in screen.

Unknown measurements: none claimed; all copy above is normative. Visual geometry, focus detail and motion reuse the existing responsive/TV contracts — no new measurements are introduced by this document.
