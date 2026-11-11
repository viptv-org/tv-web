/** @jsxImportSource @solidtv/solid */
import { Show } from "solid-js";
import { TvView } from "../runtime";
import { Label, Logo, palette } from "./visuals";
import { TitleMetadata } from "./TitleMetadata";
import { sdfTextMetrics } from "./text-measure";
import type { Card } from "./types";

export function BrowsePreview(props: { card: Card; summaryBottom?: number; externalLogo?: boolean }) {
  /** The summary sits in the space between the navigation and the focused
   * row's shelf, not pinned to the top of a full-screen backdrop. */
  const summaryY = () => {
    const bottom = props.summaryBottom ?? 690,
      body = 310;
    return Math.max(96, 132 + Math.max(0, bottom - 40 - 132 - body) / 2);
  };
  const titleY = () => {
    const width = sdfTextMetrics("48px Onest700").measureText(
      props.card.title ?? "",
    ).width;
    const lines = Math.min(2, Math.max(1, Math.ceil(width / 1000)));
    return 120 - lines * 57.6;
  };
  return (
    <TvView x={96} y={summaryY()}>
      <Show
        when={props.card.logo}
        fallback={
          <Label
            y={titleY()}
            size={48}
            font="Onest700"
            lineheight={1.2}
            maxwidth={1000}
            maxlines={2}
            content={props.card.title}
          />
        }
      >
        <Show when={!props.externalLogo}><Logo
          src={props.card.logo!}
          w={640}
          h={120}
          title={props.card.title}
          size={44}
          boxH={120}
        /></Show>
      </Show>
      <TitleMetadata card={props.card} y={144} detail />
      <Label
        y={194}
        size={26}
        lineheight={1.45}
        maxwidth={700}
        maxlines={2}
        color={palette.body}
        content={props.card.description ?? ""}
      />
    </TvView>
  );
}
