/** @jsxImportSource @solidtv/solid */
import { Show, type Accessor } from "solid-js";
import { TvView } from "../../runtime";
import { Label } from "../visuals";
import { LAYOUT } from "../layout";
import { BusySurface } from "../BusySurface";
import { PlayerControlsView, SkipIntroButton } from "../PlayerControlsView";
import { SKIP_FADE, skipLabel, type SkipOffer } from "../player/skip-intro";
import type { PlaybackSegment, TitleAction } from "../types";
import type { PlayerSnapshot } from "../../../../vendor/video/src/types";

type PlayerTool = { id: string; label: string; x: number; width: number; icon: string };

/** Everything the player draws over the video, in the order it stacks.
 *
 * The three layers never really coexist: the skip offer belongs to the moment
 * before the controls are touched, the busy surface to loading and seeking, and
 * the controls to the rest. The skip button is the same component at the same
 * rect as the one in the control row, so it never moves between the two.
 */
export function PlayerChrome(props: {
  screen: string;
  overlay: boolean;
  advancing: boolean;
  openingSource: boolean;
  showControls: boolean;
  loading: boolean;
  seeking: boolean;
  buffering: boolean;
  skipStage: SkipOffer;
  segment: PlaybackSegment | undefined;
  snapshot: Accessor<PlayerSnapshot | undefined>;
  action: TitleAction | undefined;
  canSeek: Accessor<boolean>;
  tools: Accessor<readonly PlayerTool[]>;
  choice: Accessor<number>;
  timelineFocused: Accessor<boolean>;
  preview: Accessor<number | undefined>;
}) {
  const player = () => props.screen === "player" && !props.overlay;
  return <>
    <Show when={player() && props.advancing}>
      <Label x={LAYOUT.inset} y={790} size={26} content="Preparing next episode…" />
    </Show>
    <Show when={player() && !props.showControls && !props.loading && !props.seeking && props.skipStage !== "none"}>
      <TvView alpha={props.skipStage === "button" ? 1 : 0} transition={SKIP_FADE}>
        <SkipIntroButton label={skipLabel(props.segment)} focused={false} />
      </TvView>
    </Show>
    <Show when={player() && !props.openingSource && (props.loading || props.seeking || props.buffering)}>
      <BusySurface label={props.seeking ? "Seeking…" : "Buffering…"} />
    </Show>
    <Show when={player() && props.showControls && !props.openingSource}>
      <PlayerControlsView
        playback={{ snapshot: props.snapshot, card: () => props.action?.card, canSeek: props.canSeek, tools: props.tools }}
        focus={{ selected: props.choice, timeline: props.timelineFocused, preview: props.preview }} />
    </Show>
  </>;
}
