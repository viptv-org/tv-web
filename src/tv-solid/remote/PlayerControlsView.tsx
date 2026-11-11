/** @jsxImportSource @solidtv/solid */
import { For, Show, type Accessor } from "solid-js";
import { TvView } from "../runtime";
import { Button, Label, palette } from "./visuals";
import { BusyIndicator } from "./BusyIndicator";
import { bufferedSegments } from "./playerTimeline";
import { clockTime as clock } from "./time";
import type { Card } from "./types";
import type { PlayerSnapshot } from "../../../vendor/video/src/types";

interface PlayerTool { id: string; label: string; x: number; width: number; icon: string }
interface PlaybackChrome {
  snapshot: Accessor<PlayerSnapshot | undefined>;
  card: Accessor<Card | undefined>;
  canSeek: Accessor<boolean>;
  tools: Accessor<readonly PlayerTool[]>;
}
interface PlayerFocus { selected: Accessor<number>; timeline: Accessor<boolean>; preview: Accessor<number | undefined> }
interface PlayerActivity { loading: Accessor<boolean>; seeking: Accessor<boolean> }

export function PlayerControlsView(props: { playback: PlaybackChrome; focus: PlayerFocus; activity: PlayerActivity }) {
  const timelineFraction = () => Math.max(0, Math.min(1,
    (props.focus.preview() ?? props.playback.snapshot()?.time.positionSeconds ?? 0) / (props.playback.snapshot()?.time.durationSeconds || 1)));
  return <>
    <TvView w={1920} h={1080} color="rgba(0,0,0,.35)" />
    <Show when={props.activity.seeking() || props.activity.loading() || props.playback.snapshot()?.state === "buffering"}>
      <TvView w={1920} h={1080} color="rgba(0,0,0,.55)" />
      <BusyIndicator label={props.activity.seeking() ? "Seeking…" : "Buffering…"} />
    </Show>
    <Label
      x={96}
      y={64}
      size={30}
      font="Onest700"
      content={props.playback.card()?.title ?? ""}
    />
    <Label
      x={96}
      y={110}
      size={24}
      content={props.playback.card()?.subtitle ?? ""}
      color={palette.body}
    />
    <Show when={props.playback.canSeek()}>
      <TvView
        x={96}
        y={936}
        w={1728}
        h={8}
        color="rgba(255,255,255,.14)"
      />
      {/* The buffer needs its own node: a For created after the played
          fill would append its quads over it. */}
      <TvView x={96} y={936} w={1728} h={8}>
        <For
          each={bufferedSegments(
            props.playback.snapshot()?.time.bufferedRanges,
            props.playback.snapshot()?.time.durationSeconds,
          )}
        >
          {(segment) => (
            <TvView
              x={1728 * segment.left}
              y={0}
              w={1728 * segment.width}
              h={8}
              color="rgba(255,255,255,.42)"
            />
          )}
        </For>
      </TvView>
      <TvView
        x={96}
        y={936}
        w={
          1728 *
          Math.min(
            1,
            (props.playback.snapshot()?.time.positionSeconds ?? 0) /
              (props.playback.snapshot()?.time.durationSeconds || 1),
          )
        }
        h={8}
        color={palette.accent}
      />
      <TvView x={96 + 1728 * timelineFraction() - 6} y={930} w={12} h={20} color={palette.text} />
      <Show when={props.focus.preview() !== undefined}>
        <TvView x={Math.max(96, Math.min(1704, 96 + 1728 * timelineFraction() - 60))} y={878} w={120} h={44} color={palette.surface}>
          <Label centerY={22} w={120} align="center" size={22} font="Onest700" content={clock(props.focus.preview() ?? 0)} />
        </TvView>
      </Show>
      <Label
        x={96}
        y={970}
        size={22}
        content={clock(props.playback.snapshot()?.time.positionSeconds ?? 0)}
      />
      <Label
        x={1660}
        y={970}
        w={164}
        align="right"
        size={22}
        content={`−${clock(Math.max(0, (props.playback.snapshot()?.time.durationSeconds ?? 0) - (props.playback.snapshot()?.time.positionSeconds ?? 0)))}`}
      />
    </Show>
    <Show when={props.focus.preview() === undefined}>
    <Button
      x={96}
      y={846}
      w={160}
      h={56}
      icon={props.playback.snapshot()?.state === "playing" ? "pause" : "play"}
      label={props.playback.snapshot()?.state === "playing" ? "Pause" : "Play"}
      focused={props.focus.selected() === 0 && !props.focus.timeline()}
    />
    <For each={props.playback.tools()}>
      {(button, index) => (
        <Button
          x={button.x}
          y={846}
          w={button.width}
          h={56}
          label={button.label}
          icon={button.icon}
          iconSize={22}
          focused={props.focus.selected() === index() + 1}
        />
      )}
    </For>
    </Show>

  </>;
}
