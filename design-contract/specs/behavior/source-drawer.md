# SRC-DRAWER-001 — Source drawer width, stacking over web Details, no best-match hint

Status: **proposed**, owner decision 2026-10-27
([app#60](https://github.com/viptv-org/app/issues/60),
[design#24](https://github.com/viptv-org/design/issues/24)). The KMP app
(phone, tablet, desktop, web and TV) already implements it; it becomes
baseline once device evidence is recorded.
Source revision: app `f80aa91`
([app#86](https://github.com/viptv-org/app/pull/86)):
`sourceDrawerWidth` and the panel layout in
`features/sources/SourcesScreen.kt`, the web layer in
`features/sources/BrowserSourceDrawer.kt`, the TV status row in
`features/sources/TvSourcesScreen.kt`, and the Details/Sources route in
`App.kt`. The owner decided while the app was being built, so this contract
records what shipped. The evidence is desktop UI tests
(`BrowserSourceDrawerTest`, `SourceDrawerLayoutTest`) and a web-build capture
at 1440×900 with preview data. No device evidence is recorded yet.

## Intent

Give source titles, quality badges and the file/description line more room on
wide desktop and web windows. Keep the title's Details visible behind the
source drawer on web, so choosing a source feels like a step inside Details
and closing it puts the viewer back where they were. Remove the hint about how
Play picks a source from every source picker: it repeats a setting and takes
space from the list.

## Drawer geometry

Platform keys follow [components.md](../../viptv-design-system/components.md)
(P phone, D desktop app and web, T TV).

| Layout | Source picker container |
|---|---|
| D (desktop app, web), window 640 wide or more | Right drawer, full height, width `min(720, 0.55 × window)`, never under 460 |
| D, window under 640 wide | The phone bottom sheet (unchanged) |
| Tablet | Right drawer, 460 (unchanged) |
| P | Bottom sheet (unchanged) |
| T | Right panel (unchanged) |

So the D drawer is 720 from a 1310-wide window up, 55 % of the window between
about 836 and 1310 (605 at 1100), and 460 from 640 to about 836. (The app's
`sourceDrawerWidth` also caps the drawer at the window width, which no drawer
layout reaches, because a window under 640 already gets the sheet.) Every
other D drawer stays 460 (`layout.desktop.drawer-width`). The scrim is the D overlay scrim (0.55). It
closes the drawer on a click and never takes keyboard focus, on any layout.

## Web: the drawer over the Details dialog

On web, a title's Details is a dialog floating above the page. Before this
change, opening the source picker from it removed the dialog. Now:

- **Entry from Details:** a source drawer opened from the dialog opens in its
  own layer **over** the dialog. Its 0.55 scrim covers the dialog and takes its pointer input. The
  dialog stays composed: same season, same scroll position, same episode list.
  Opening the drawer does not refetch the title's metadata, and episode paging
  in the dialog pauses while the drawer is open.
- **Focus:** keyboard focus starts on the drawer's × (Close). Tab keeps focus
  inside the drawer; it never reaches the dialog behind it.
- **Close:** Escape, the ×, or a click on the scrim closes only the drawer.
  Escape acts on key up, and its key down is swallowed so the dialog
  underneath does not also close. The dialog is shown unchanged and is not
  refetched. Its own Escape and dismissal work again once the drawer is
  closed, and it can open the drawer again.
- **Entry from Home** (a Continue Watching tap): the drawer opens over Home,
  as before. If the title's Details arrive while it is open, they are not
  slotted in under it. Closing the drawer opens them
  (the existing return to Details).
- **Play:** choosing a source starts playback as before. Back from the player
  returns to the drawer over the same Details dialog.

The desktop app keeps its own Details page under the drawer and is unchanged
apart from the width. Phone, tablet and TV are unchanged apart from the hint.

## No best-match hint

No layout shows a hint about how Play picks a source. The footer line
`Play always starts the best match. Change this in Settings › Playback.`
(desktop board: `Change it in`) and the TV idle line
`Play always starts the best match. Change how it’s chosen in Settings › Playback.`
are removed; the list takes their space.

TV keeps a status line under the list, with a spinner, only while it is
working:

- `Finding sources` while nothing has arrived yet;
- `Still checking sources` once sources have arrived but discovery is still
  in flight;
- `Opening stream…`, or the current opening stage, while a chosen stream
  opens.

An idle TV picker, the no-sources state and the torrent-only state have no
status line. Phone, D and TV share the discovery status
(`Finding sources` / `Still checking sources`) in
[SRC-OVERFLOW-001](../../viptv-design-system/components.md#6-cards-and-tiles);
TV adds `Opening stream…`. Source revision: app `9ddb5a0` (the merge of
[app#452](https://github.com/viptv-org/app/pull/452)),
`features/sources/TvSourcesScreen.kt`.

## Copy

Strings live in [copy.md](../../viptv-design-system/copy.md): the TV status
line above, and the retired hint. No string is added.

## Accessibility

The drawer is a pane titled `Choose a source`. The scrim is not focusable and
is not announced. On web, assistive technology and keyboard focus stay in the
drawer while it is open, and return to the Details dialog when it closes.

## Superseded

These canvas boards stay as exported until the canvas re-exports them:

- `D3Sources`, `D3SourcesEmpty`, `D3SourcesTorrent` and the desktop
  component sheet `CmpDesk3` draw the source drawer 460 wide;
- `D3Sources` also shows the footer
  `Play always starts the best match. Change it in Settings › Playback.`;
- `M3Sources` shows
  `Play always starts the best match. Change this in Settings › Playback.`
  under the list;
- `Tv3Sources` shows the idle line
  `Play always starts the best match. Change how it’s chosen in Settings › Playback.`;
- `Tv3SourcesLoading` shows `Checking add-ons · 2 of 3 done · 4 sources so far`.
  The app shows `Finding sources` / `Still checking sources` (no done count).

No board shows the drawer over the web Details dialog.

## Acceptance

1. **SRC-DRAWER-01:** on desktop and web the source drawer is 720 wide at
   1440 and 2560, 605 at 1100 and 460 at 800.
   It sits at the right edge, full height. Under 640 wide it is the phone
   bottom sheet. The tablet drawer is 460 at 1280×800; the phone sheet and TV
   panel are unchanged.
2. **SRC-DRAWER-02:** a long release line that wraps in the 460 drawer takes
   visibly fewer lines in the 720 drawer at 1440.
3. **SRC-DRAWER-03:** web, 1440×900. Open a series' Details, scroll to season
   2, and choose a source for an episode. The drawer opens over the dimmed
   dialog, focus is on the ×, and no metadata request is sent. Repeated Tab
   keeps focus inside the drawer.
4. **SRC-DRAWER-04:** from SRC-DRAWER-03, Escape closes only the drawer. The
   dialog shows season 2 at the same scroll position, no metadata request is
   sent, and the route is Details. Escape pressed straight after the drawer
   opens behaves the same.
5. **SRC-DRAWER-05:** from SRC-DRAWER-03, a click on the scrim over an episode
   row closes only the drawer. It does not activate that episode and sends no
   second source request. The × does the same, and the dialog can open the
   drawer again.
6. **SRC-DRAWER-06:** web, from Home, a Continue Watching tap opens the drawer
   over Home, with no Details dialog under it. Closing it opens the title's
   Details.
7. **SRC-DRAWER-07:** web, choose a source from the drawer over Details, then
   Back from the player. The drawer is shown over the same Details dialog.
8. **SRC-DRAWER-08 (failure):** web, over Details, discovery fails or returns
   no sources. The drawer shows its existing error or empty state over the
   dialog, and closing it returns to the unchanged dialog.
9. **SRC-DRAWER-09:** no `Play always starts the best match` text at
   390×844, 1024×768, 1440×900, tablet 1280×800 or TV 1920×1080.
10. **SRC-DRAWER-10:** TV shows `Finding sources` while nothing has arrived,
    `Still checking sources` once sources have arrived but discovery is
    still in flight, and `Opening stream…` while a stream opens. Idle, the
    status line is absent and the list fills its space.

## Unknowns

- No device evidence yet (web browsers on real hardware, desktop app windows,
  Android TV).
- SRC-DRAWER-07 and SRC-DRAWER-08 follow from the shipped route and drawer
  code; app#86's tests do not cover them.
- Canvas boards for the wider drawer, the drawer over the web Details dialog
  and the TV picker without the hint are still needed.
- The native desktop app disables Tab navigation
  ([DESK-PLAYBACK-2026-10-03](../../viptv-design-system/decisions.md#desktop-pointer-and-playback-corrections-desk-playback-2026-10-03));
  the focus rules above apply to web.
