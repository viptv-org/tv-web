# PLAY-NEXT-AUTOPLAY-001 — Next-episode end panel and autoplay countdown

Status: **proposed**, owner decision 2026-10-27
([app#65](https://github.com/viptv-org/app/issues/65)). The KMP app (phone,
desktop, web and TV) already implements it; it becomes baseline once device
evidence is recorded.
Source revisions: the end panel is app `c4d6696`
([app#48](https://github.com/viptv-org/app/pull/48)), and the countdown and
setting are app `f3bd256` ([app#77](https://github.com/viptv-org/app/pull/77)).
The start of the next episode is app `f19e0dc6`
([app#417](https://github.com/viptv-org/app/issues/417)), its last-three-minutes
preparation app `9e236f52`
([app#420](https://github.com/viptv-org/app/issues/420)) and the remembered
source choice app `5e4ebbc7` ([app#419](https://github.com/viptv-org/app/issues/419),
on the app's `edge` branch).
The owner decided after implementation, so this contract records what
shipped rather than leading it. The evidence is desktop UI tests that
drive the countdown with a test clock. No device evidence is recorded yet.
Roku and other clients follow through their own pins.

This contract resolves an old conflict. The [Roku baseline](roku-ux-contract.md#next-episode-behavior),
[AND-037 Up Next](../../docs/platforms/ANDROID_DESIGN.md#up-next) and
[`decisions.md` #1](../../viptv-design-system/decisions.md#settled-with-the-product-owner)
asked for an auto-advancing countdown. The TV, phone and desktop boards and
research notes said "Nothing plays on its own." For the KMP app this contract
replaces both: the end panel counts down 10 seconds and then plays the next
episode, unless the viewer turned **Autoplay next episode** off or did
anything at all.

## Intent

When a series episode ends, offer the next one over the last frame. If the
viewer does nothing, play it after 10 seconds. Any sign that the viewer is
there and doing something else stops the countdown for that end. A viewer who
never wants this turns it off once, on that device.

## Next episode during playback

The player's **Next episode** control (phone and desktop transport, the TV
Next pill) plays the next episode at once. It goes through the same path as
the panel's play action and does not open the panel. The panel belongs to the
end of the media only.

## How the next episode starts

Next, the TV pill, the panel's primary action and the countdown start the next
episode through one path, whatever the profile's **Default source** says
(app `f19e0dc6`). A profile on **Always ask** does not stop at the Sources
picker on a successor. Only the successor takes this path; every other episode
keeps the ordinary source flow (see [Picking an episode](#picking-an-episode)).

The start, in order:

1. **The prepared source**, when the last three minutes prepared one (see
   [Preparation](#preparation)): playback opens on it, with the rows and groups
   the preparation ranked. No picker, no second discovery.
2. **The series' remembered source**, when one is stored and nothing was
   prepared (see [Remembered
   source](source-best-match.md#remembered-source)): a fresh discovery starts
   the first row in the remembered audio. A discovery with no row in that
   audio opens the Sources picker and plays nothing.
3. **The best match**, otherwise, as [SRC-BEST-MATCH-001](source-best-match.md#start)
   defines it: the target starts as soon as a ranking reports that it fully
   meets every preference, and at the end of discovery otherwise. The picker
   plays nothing when no row is left after the hard filters, when the ranking
   request fails, and after three failed starts.

A start that fails falls back like any Best match start: the notice with the
next ranked row, at most three attempts, then the picker with the `Didn’t
start` labels ([Fallback](source-best-match.md#fallback)). A prepared handoff
walks the rows the preparation ranked.

### Preparation

The app prepares the next episode's source during the episode's last three
minutes and opens no stream: no lease, no player and no interruption of the
episode playing (app `9e236f52`).

It starts on a progress tick when all of these hold:

- the player is on screen and an episode is playing under the current
  profile;
- the media is not live and the card is a series episode with a parent title;
- the next episode is already resolved from the server's continuation;
- the duration is known and 3:00 or less is left. Seeking into the last three
  minutes starts it; an unknown duration, a movie, a live channel and a finale
  never prepare.

The prepared target is the first of:

- **the series' remembered source**, matched against a fresh discovery: a row
  from the remembered add-on in the remembered audio, then any row in that
  audio (see [Remembered source](source-best-match.md#remembered-source));
- **the best match**, and only when a ranking reports that it fully meets every
  preference.

Neither leaves a prepared target; Next then takes the second or third start
above.

One preparation runs per next episode, profile, preference revision, source
selection and connection, with 45 s to finish. A ready source is used for 15
minutes; after that it is prepared again while the episode is still in its last
three minutes. Using it consumes it. Leaving the player, changing the profile,
card, preferences or connection, or a next episode that is withdrawn releases
the preparation and its request.

### Picking an episode

The player's Episodes list asks for every episode that is not the resolved
successor, whether the profile is on **Best match** or **Always ask**: the best
match starts on its own on **Best match**, the picker opens on **Always ask**.
The episode lists in Details, and **Choose source** in a title menu, always ask.

## When the end panel opens

The panel opens when the player reports that the media has **ended**
(Media3 `STATE_ENDED`, mpv `eof-reached`, `<video>` `ended`). All of the
following must hold:

- the media is on demand, not live;
- a next episode is known (the server's continuation, never guessed). Only
  series episodes have one. Phone, desktop and web also check that the title
  is a series episode; TV relies on the next episode alone;
- playback has not failed and, on TV, is not the undecodable state;
- the viewer has not dismissed the panel for this end.

A next episode that resolves only after the end still opens the panel. If the
next episode is withdrawn while the panel is open, the panel closes and
nothing plays. A finale (no next episode), a movie or a live channel never
opens it. In a finale, phone disables its Next control and TV omits the Next
pill.

The controller has already saved the episode as watched (position = duration)
when the panel opens. Closing the player afterwards does not save a partial
position.

## Panel layout and copy

The video keeps its full frame. The last frame stays visible under the panel:
Media3 `PlayerView` keeps it, mpv runs with `keep-open=yes`, and `<video>`
keeps it after `ended`. No app background is drawn behind the panel.

### TV (1920×1080 reference)

- Scrim: a horizontal gradient over the frame, black at 35 % (left edge),
  55 % (45 % across) and 82 % (right edge).
- Caption `[Title] · Credits` at (96, 616), 22/32, secondary text. The title
  is the series name once its details have loaded, otherwise the episode
  title.
- Panel column at (1040, 120), 784 wide, 18 gap:
  - eyebrow `Next episode`, 24/35 semibold, secondary;
  - heading `[N]. [Episode title]`, 52/59.8 bold, −1.04 tracking;
  - metadata `S[s] E[e]` · subtitle facts, 30 line height;
  - description, 26/37.7 body text, at most 3 lines;
  - a 2 px spacer, then an action row with 16 gap:
    - primary action, 72 high, 28 side padding: the play glyph and the label
      (26/37.7 bold);
    - glass action `Keep watching credits`, 340×72;
  - footnote at 6 px top padding, 22/32, `color.text.tertiary` (see [Copy](#copy)).
- Arrival: the caption and column fade in and rise 16 px over 450 ms after a
  350 ms delay, standard easing `cubic-bezier(.2, 0, 0, 1)`. With reduced
  motion they appear in place.
- Initial focus: the primary action. Left/Right moves between the two actions.

### Phone, desktop and web

Desktop and web use the phone panel. This is a provisional platform exception:
the `D3PlayerNext` card (`Play next episode` / `Back to the series`) is not
built yet. The same actions stay available, and the desktop parity test is
`NextEpisodeEndPanelUiTest`. Measurements are in dp (phone) and px (desktop
and web window).

- Scrim: black at 35 % over the whole frame. The content sits inside the system
  and cutout insets.
- Content sits at the bottom, with 26 vertical padding. Side padding is 56 when
  the window is at least 800 wide and 24 otherwise. Below 640 wide the
  information stacks above the actions with 16 gap. At 640 and wider they sit
  in one row with 20 gap, information first.
- Information (at most 360 wide, 12 gap): a 128×72 thumbnail (landscape art,
  else poster; radius 8; surface colour when there is no art), then `Up next`
  12 semibold secondary, `[N]. [Episode title]` 15 bold at most 2 lines, and
  `[runtime]m` 12 secondary.
- Actions (10 gap, 44 high, radius 12, 16 side padding, 14 bold):
  `Watch credits` (raised fill) then the primary action (off-white fill, dark
  ink) with the skip-forward glyph and its label.
- Initial focus: `Watch credits`. Escape on desktop and web dismisses the
  panel instead of closing the player.

Dismissing the panel shows the player controls again. On phone, focus returns
to the Next episode control. On TV the panel closes with the controls hidden,
and the next key reveals them.

## Countdown

The countdown runs when the panel opens and all of these hold:

- **Autoplay next episode** is on for this device;
- the media is still ended;
- the title is a series episode: not a movie, and not a live channel (card
  kind `channel` or `tv`).

Each opened panel gets one countdown:

1. It lasts **10 s**, timed from the frame clock.
2. The primary action reads `Next episode in [N]`, where N counts down
   10, 9 … 1 (whole seconds left, rounded up).
3. A ring around the glyph empties continuously as the time runs out. The
   full track is drawn in the label colour at 28 % opacity, and the remaining
   arc starts at 12 o'clock with round caps. The glyph shrinks while the ring
   shows. On TV the ring is 40 with a 3 stroke and the glyph shrinks from 24
   to 18. On phone the ring is 26 with a 2.5 stroke and the glyph shrinks from
   18 to 12. With the setting off the ring is never drawn, so the panel keeps
   its earlier layout. When a countdown stops, the ring goes and the glyph
   returns to full size.
4. **Reduced motion:** the number still counts down, but no ring is drawn and
   the glyph keeps its full size. The TV panel also skips its fade-up. Every
   platform reads the device's Display **Reduce motion** record when the
   player opens: On and Off apply as chosen, and Follow TV (the default, and
   the only value off TV, where the setting has no row) uses the platform
   setting: Android animator scale 0, iOS Reduce Motion, browser
   `prefers-reduced-motion`. The desktop app has no portable query, so it
   counts as motion allowed.
5. At 0 the next episode plays through the same path as the primary action:
   its best match whatever **Default source** says, from the prepared source
   when the last three minutes prepared one, otherwise by closing the player
   and starting the best match over a fresh discovery (see [How the next
   episode starts](#how-the-next-episode-starts)). That start owns its loading
   and failure states, and Back from it follows its own rules. It plays only
   if the panel is still open. A tick that lands in the same frame that closed
   the panel plays nothing.
6. Activating the primary action during the countdown plays at once.

Once cancelled or expired, a countdown never runs again for that panel. The
panel stays, its primary action reads `Play next episode` (TV) or
`Next episode` (phone), and the TV footnote changes to the cancelled copy.

### What cancels it

Any viewer action cancels the countdown for this end:

- `Watch credits` / `Keep watching credits`, which also dismiss the panel;
- Back, and Escape on desktop and web, which dismiss the panel;
- any key going down, including D-pad moves and the TV's play/pause key, which
  the player handles itself but still counts. The first key-down cancels, so
  repeat and hold add nothing;
- any pointer or touch press over the panel;
- seeking away from the end (the media is no longer ended).

Opening another panel takes a key or pointer press, so it cancels too.
Hover and the initial focus placement do not cancel. A dismissed panel stays
closed until the media ends again. Seeking back and reaching the end again
opens a new panel, with a new countdown if the setting is on.

## Setting: Autoplay next episode

- Label `Autoplay next episode`, description
  `Plays the next episode after a 10-second countdown. Applies to this device.`
- A switch, **on by default**. A change applies and saves at once, with no
  Save step.
- **Per device:** it is a device-local record next to the TV Display record.
  It is not stored with the profile, because the profile preference API
  (`/api/profiles/:id/preferences`) rejects unknown fields and the old
  `viewing_settings.autoplay` endpoint is not routed. Two devices on one
  account keep their own value. A profile-level field needs a backend contract
  change first. A missing or unreadable record reads as on.
- Settings › Playback placement:
  - **TV:** a switch row in the Playback list, after the `Next episode button`
    row. That row and `Skip intros and recaps` are preview placeholders and
    are hidden on a real connection, so the autoplay row comes first there and
    takes the page's initial focus. The page heading
    `These apply to [name]’s profile.` is unchanged. The row's description
    says it applies to this device.
  - **Phone:** a group headed `Next episode` at the top of Playback, holding
    only this switch. It shows even while the profile's preferences fail to
    load.
  - **Desktop and web:** a switch row with label and description on the
    preferences page. The Playback and Subtitles & audio sections share that
    page, so the switch shows on both.
- With the setting off, the end panel opens as before with no countdown, and
  the TV footnote reads `Nothing plays on its own.`

The `Next episode button` row's description is `Shows during the credits`.
Its old suffix, "Nothing ever plays on its own" (Tv3SetPlayback,
D3SetPlayback; the phone and tablet boards' "During the credits — nothing
plays on its own"), is retired.

## Copy

| Where | Copy |
|---|---|
| TV eyebrow | `Next episode` |
| TV primary, counting | `Next episode in [N]` |
| TV primary, not counting | `Play next episode` |
| TV secondary | `Keep watching credits` |
| TV footnote, counting | `Starts automatically. Press any button to cancel.` |
| TV footnote, setting off or cancelled | `Nothing plays on its own.` |
| TV caption | `[Series] · Credits` |
| Phone/desktop eyebrow | `Up next` |
| Phone/desktop primary, counting | `Next episode in [N]` |
| Phone/desktop primary, not counting | `Next episode` |
| Phone/desktop secondary | `Watch credits` |
| Setting | `Autoplay next episode` |
| Setting description | `Plays the next episode after a 10-second countdown. Applies to this device.` |
| Phone settings group | `Next episode` |

The phone panel has no footnote.

## Accessibility

While the ring shows, the primary action exposes a progress value (the share
of whole seconds gone) that changes once a second, not every frame. With
reduced motion the visible number is the only progress.

## Superseded

- **Boards.** These boards are superseded until the canvas re-exports them:
  - `Tv3PlayerNext`: the footnote "Nothing plays on its own — the credits keep
    running until you choose", and the 880×495 shrunk frame on the app
    background;
  - `Tv3Motion` **Play next**: "Credits shrink to the corner… Nothing plays
    until you press OK";
  - the `Next episode button` descriptions on `Tv3SetPlayback`,
    `M3SetPlayback` and `D3SetPlayback`;
  - the same description on the tablet `T3Settings` board;
  - `M3PlayerNext` and `D3PlayerNext`, which have no countdown state;
  - every Playback board, which lacks the autoplay row.

  The `size.player.up-next-*` tokens describe the retired card and do not size
  the end panel.
- **AND-037 Up Next** (old Android client): the countdown starts at the end of
  the media, not in the final ten seconds. It sits on the end panel's primary
  action, not a separate `Starts in` card with Play now / Cancel. It cannot
  pause or buffer, because the media has ended.
- **`decisions.md` #1 and the components Up Next card**: same as AND-037. The
  countdown is 10 s, not the placeholder `[8]`.
- **Roku baseline:** the [Roku contract](roku-ux-contract.md#next-episode-behavior)
  still records the frozen Roku `7d6b413` behaviour (auto-start in the last
  ten seconds). Roku, including the ROK-REMOTE-001 rebuild, adopts this
  contract only through its own pin.

## Acceptance

1. **PLAY-NEXT-AUTOPLAY-01:** on phone, desktop and TV, a series episode
   reaches its end with a known next episode and the setting on. The panel
   opens over the last frame, the primary action counts 10 down to 1, and at 0
   the next episode plays exactly once. The TV footnote reads
   `Starts automatically. Press any button to cancel.`
2. **PLAY-NEXT-AUTOPLAY-02:** activating the primary action mid-countdown plays
   at once, exactly once.
3. **PLAY-NEXT-AUTOPLAY-03:** each of these stops the countdown and nothing
   plays at 0:
   - phone: Watch credits, a pointer press, Escape, Back, a seek away from the
     end;
   - TV: a D-pad move, play/pause, Back, Keep watching credits, a seek, a
     pointer press.

   Where the panel stays open, it reads `Play next episode` / `Next episode`
   and the TV footnote reads `Nothing plays on its own.`
4. **PLAY-NEXT-AUTOPLAY-04:** Back closes the panel in the same frame as the
   last tick. Nothing plays.
5. **PLAY-NEXT-AUTOPLAY-05:** with the setting off, the panel opens with no
   ring and no countdown, and nothing plays until the viewer chooses.
6. **PLAY-NEXT-AUTOPLAY-06:** a finale, a movie or a live channel reaches its
   end. No panel opens and nothing counts down.
7. **PLAY-NEXT-AUTOPLAY-07:** with reduced motion, the number counts down but
   no ring is drawn, and the TV panel appears without a fade-up.
8. **PLAY-NEXT-AUTOPLAY-08:** dismiss the panel, seek back and reach the end
   again. A new panel opens with a new countdown. A next episode that resolves
   after the end still opens the panel. A withdrawn next episode closes it
   without playing.
9. **PLAY-NEXT-AUTOPLAY-09:** the setting is on for a fresh install and for an
   unreadable record. Turning it off on one device persists across restarts
   and leaves another device on the same account unchanged. On TV, on a real
   connection, it is the first Playback row and takes focus. On phone it shows
   while profile preferences fail to load.
10. **PLAY-NEXT-AUTOPLAY-10:** during playback, the Next control plays the next
    episode at once, with no panel.
11. **PLAY-NEXT-AUTOPLAY-11:** a profile whose **Default source** is **Always
    ask** plays a series episode. The Next control, the TV Next pill, the
    panel's primary action and a countdown that reaches 0 each start the next
    episode's best match without the picker, and the outgoing episode keeps
    its saved position. Any other episode picked from the player's list opens
    the picker.
12. **PLAY-NEXT-AUTOPLAY-12:** with 3:00 or less left the app prepares once,
    opens no stream, holds no extra lease and does not interrupt the episode
    playing; Next hands off to that source with a single open and no picker.
    Seeking into the last three minutes prepares. An unknown duration, a
    movie, a live channel and a finale prepare nothing. Leaving the player, a
    preference change or a withdrawn next episode releases the preparation,
    and an expired one is prepared again.
13. **PLAY-NEXT-AUTOPLAY-13:** with nothing prepared, a series whose remembered
    source has no row in its audio in a fresh discovery opens the picker. A
    discovery with no row left after the hard filters, or a ranking request
    that fails, leaves the picker open and plays nothing.
14. **PLAY-NEXT-AUTOPLAY-14:** the prepared source and the best-match target
    fail to start. The fallback notice and the next ranked row appear as in
    any Best match start, and the third failure returns to the picker with the
    `Didn’t start` labels.

## Unknowns

- No device evidence yet (Android TV, phone, web browsers). Physical TV
  key handling of the play/pause cancel is unverified.
- Web: a gateway VOD playlist that arrives without `ENDLIST` may be treated
  as live by hls.js. Then `ended` never fires and the panel does not open.
- iOS reduced-motion and storage code has not been compiled on the Linux host.
- No device evidence for the controlled start, the preparation or the
  remembered source; desktop tests are the evidence.
- A prepared successor can hand off a source outside the remembered audio,
  while the same next episode taken without a preparation opens the picker
  ([app#475](https://github.com/viptv-org/app/issues/475)).
- Canvas boards for the countdown state, the cancelled state and the
  Settings › Playback row are still needed.
