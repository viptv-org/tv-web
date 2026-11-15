/** @jsxImportSource @solidtv/solid */
import { Show, type Accessor } from "solid-js";
import { Label, palette } from "../visuals";
import { LAYOUT } from "../layout";
import { LIVE_EMPTY_COPY, LIVE_FILTERED_LINE, liveKeepsToday, liveNoChannelsBody, type LiveSpread } from "../liveEmpty";
import { LiveAnswer, LiveNoSource } from "../liveEmptyViews";
import { LiveGroupSelector } from "../live/LiveGroupSelector";
import { LiveGuideGrid } from "../live/LiveGuideGrid";
import { LiveHero } from "../live/LiveHero";
import type { Channel, LivePage, Program } from "../types";
import type { LiveViewer } from "../liveEmpty";

/** The Live screen: on now, the group chips and the guide.
 *
 * Three empty forms share the frame — no source at all, a source with no
 * channels, and a request that failed — and each says what actually happened
 * instead of claiming a source is missing. A page that is empty only because of
 * its filter says so under the chips that are its focus stop.
 */
export function LiveScreen(props: {
  spread: LiveSpread;
  viewer: LiveViewer | undefined;
  emptyFocus: number | undefined;
  pages: LivePage[];
  recovery: Parameters<typeof LiveAnswer>[0]["actions"];
  failure: string;
  channels: Channel[];
  channelIndex: number;
  program: Program | undefined;
  groups: LivePage["groups"];
  group: string | undefined;
  zone: string;
  column: Accessor<number>;
  programs: Record<string, Program[]>;
  guideRowStart: number;
  guideStart: number;
  guideNow: number;
}) {
  return <>
    <Label
      x={LAYOUT.inset}
      y={180}
      size={26}
      color={palette.muted}
      content={props.spread === "loading" ? "Loading Live TV…" : ""}
    />
    <Show when={props.spread === "no-source"}>
      <LiveNoSource viewer={props.viewer} focused={props.emptyFocus} />
    </Show>
    <Show when={props.spread === "loading" || props.spread === "no-channels" || props.spread === "failed"}>
      <Show when={props.spread === "no-channels"}>
        <LiveAnswer
          headline={LIVE_EMPTY_COPY.noChannelsHeadline}
          body={liveNoChannelsBody(props.pages[0])}
          actions={props.recovery}
          focused={props.emptyFocus}
        />
      </Show>
      <Show when={props.spread === "failed"}>
        <LiveAnswer
          headline={LIVE_EMPTY_COPY.failedHeadline}
          body={props.failure || LIVE_EMPTY_COPY.failedBody}
          actions={props.recovery}
          focused={props.emptyFocus}
        />
      </Show>
    </Show>
    <Show when={liveKeepsToday(props.spread)}>
      <LiveHero channel={props.channels[props.channelIndex]} program={props.program} />
      <Show when={props.groups.length}>
        <LiveGroupSelector groups={props.groups} group={props.group} focused={props.zone === "live-groups"} selected={props.column()} />
      </Show>
      <LiveGuideGrid channels={props.channels} programs={props.programs}
        window={{ row: () => props.guideRowStart, start: () => props.guideStart, now: () => props.guideNow }}
        selection={{ index: props.column, active: () => props.zone === "content", program: () => props.program?.id }} />
      <Show when={props.spread === "filtered"}>
        <Label x={LAYOUT.inset} y={640} size={28} content={LIVE_FILTERED_LINE} />
      </Show>
    </Show>
  </>;
}
