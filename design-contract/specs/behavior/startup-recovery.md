# STARTUP-RECOVERY-001 — Startup session-restore recovery

Status: **proposed**, to be implemented by
[viptv-org/app#563](https://github.com/viptv-org/app/pull/563)
(app issue [app#557](https://github.com/viptv-org/app/issues/557)), targeting
app `edge`. Source revision: the PR head branch `fix/557-post-update-launch-hang`
— `state/ControllerSession.kt` (restore and `retryStartup`), `state/
ApplicationController.kt` (run gate and `startupRetryable` flag), `state/
ApplicationState.kt`, `state/ControllerFreshness.kt` (foreground return),
`features/entry/ConnectScreen.kt`, `features/entry/MobileSignIn.kt`,
`features/entry/DesktopSignIn.kt`, `features/entry/TvSignIn.kt`, `features/entry/
TvWelcome.kt`. No canvas board defines these states; the geometry below is the
implementation's, and the copy is normative.

## Intent

The launch after an update restores the saved session exactly once, and one
network failure was final. A launch can also come before the device's network
is back, which strands the viewer on the sign-in screen with no way back but an
app restart. Restoring the saved session must not be the one thing that cannot
recover: a server or network outage is retried quietly while the app is still
starting, and when that also fails the entry screen says why and offers a
**Try again** that restores without a sign-in and without a new process.

## The recovery state

- **Entry:** a cold launch restores the saved remote connection by refreshing
  its session (`restore()`). The app is on the loading/startup screen; nothing
  about the failure is shown yet.
- **Quiet retries:** when that refresh fails with a transport error (the
  network or the server is unreachable) or a **5xx** server response, the failed
  connection is released and the refresh is retried after **1 s, 2 s and 4 s**,
  still on the loading screen — four attempts in all. Every attempt builds a
  fresh connection, so no failed client is reused.
- **Settle with a reason:** if every attempt fails, the loading screen gives way
  to the entry screen, which shows the reason and keeps the saved session
  retriable (`startupRetryable`), so **Try again** appears.
  - Transport failure shows **"Could not reach your server. Check the
    connection and try again."**
  - A 5xx shows the server's own message (for example **"The server could not
    complete this request."**).
- **Expired session:** a 401 whose session has expired makes exactly one attempt
  and goes straight to sign-in with **"Session expired. Sign in again."**, never
  retried, with no **Try again**.
- **Other non-5xx server response** (for example a rate limit): not auto-retried;
  the entry screen shows the server's message at once and keeps the saved
  session retriable, so **Try again** is still offered.
- **Unparseable answer** (a proxy or captive portal answering something that is
  not VIPTV's JSON): treated like a transport failure — quiet retries, then the
  reason with **Try again**; the saved session is never cleared.

## Try again

- Present only when a failed launch left the saved session retriable — a
  transport, 5xx or other non-expired server failure that showed the reason —
  and no viewer action has retired it. **`Try again`** re-runs `restore()`
  through the same generation gate, returning the app to the loading screen; a
  success reaches Home without a sign-in and the action retires.
- **`Try again`** is disabled while a restore runs; a press during a running
  retry dispatches nothing.
- **Any viewer action** (sign-in, local mode, choosing a connection) through the
  controller's run gate clears the flag, retiring **Try again**. One action
  never retries the saved session behind another.
- **Foreground return:** when the app comes back after a stop while the saved
  session is in the retriable state, the launch's own start is not a return and
  retries nothing, but a genuine return to the app retries the saved
  connection by itself.

## Copy and placement

The reason is the existing entry error line, and **Try again** hangs off it. The
expired-session line replaces the reason and offers no action.

| Layout | Reason | **Try again** placement |
|---|---|---|
| TV welcome (`TvWelcome`) | Centered at y = 720 × scale (96 × scale horizontal padding, danger, 26 × scale / 36 × scale, up to 3 centred lines) | A 360 × 72 × scale primary `TvAction` centred at y = 852 × scale, bold 26 × scale. It takes focus; **Sign in** (and **Use without an account** on local builds) stay in the y = 584 × scale row. |
| Desktop choice (`DesktopSignIn`) | Danger 14 sp / 20 sp, 12 dp below the heading | Full-width text button directly below the reason, 16 dp above the method list. |
| Phone / tablet choice (`MobileSignIn`) | Danger 15 sp / 20 sp, 12 dp below the subtitle | Full-width text button 4 dp below the reason, 18 dp above the method list. |
| Browser (`ConnectScreen`) | The sign-in form's own error line | Full-width text button below the form, above **Create account** / **Use recovery code**. |

`scale` = viewport width ÷ 1920 on TV; phones, tablets, desktop and web use the
density-pixel figures. The button reads **Try again** on every layout and is
**enabled only while the app is not busy**.

## Focus, inputs and cancellation

- **TV:** while a retry is offered, **Try again** is the initial focus target
  (the **Sign in** action yields this focus); D-pad OK activates it. While a
  restore runs the action is not focusable-as-enabled.
- **Phone / tablet / desktop / web:** **Try again** is a normal tap, disabled
  while busy. Back from the entry screen keeps its existing behaviour; it does
  not retry the saved session.
- No long-press, repeat or hold does anything new here.

## Platform scope

Every platform that shares the entry screen: TV welcome, phone choice, tablet
choice, desktop choice and the browser sign-in form.

## Acceptance

1. **STARTUP-RECOVERY-01:** a saved session that fails the first refresh with a
   transport error retries after 1 s, 2 s and 4 s and reaches Home on a later
   attempt with no error shown.
2. **STARTUP-RECOVERY-02:** if every attempt fails, the entry screen shows
   **"Could not reach your server. Check the connection and try again."** on a
   transport failure, or the server's own message on a 5xx, and offers **Try
   again**; on TV it sits centred below the reason with focus, and on phone,
   desktop and the browser it is a full-width button under the reason/form.
3. **STARTUP-RECOVERY-03:** choosing **Try again** returns to the loading screen
   and restores the saved session without a sign-in and without restarting the
   app; a success reaches Home and the action retires.
4. **STARTUP-RECOVERY-04:** an expired session makes one attempt and goes to
   sign-in with **"Session expired. Sign in again."**; no **Try again** is
   offered and no retry runs.
5. **STARTUP-RECOVERY-05:** returning to the app while the session is in the
   retriable state retries it by itself; the first launch's own start retries
   nothing.
6. **STARTUP-RECOVERY-06:** a viewer action (sign-in, local mode, choosing a
   connection) retires **Try again**, and repeated presses while a retry runs
   dispatch one restore.
7. **STARTUP-RECOVERY-07:** an unparseable answer (a non-JSON 200 from a proxy or
   captive portal) retries quietly like a transport failure, then shows the
   reason with **Try again**, and never clears the saved session.