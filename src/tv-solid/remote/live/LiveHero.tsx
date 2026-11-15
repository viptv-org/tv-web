/** @jsxImportSource @solidtv/solid */
import { Show } from "solid-js";
import { TvView } from "../../runtime";
import { icon, Label, livePreviewScrim, palette } from "../visuals";
import { imageSource } from "../image-source";
import { programLine } from "./program-line";
import { liveTitle } from "./title";
import type { Channel, Program } from "../types";
import { LAYOUT } from "../layout";

export function LiveHero(props: { channel?: Channel; program?: Program }) {
  return <>
    <TvView x={LAYOUT.inset} y={130} w={64} h={30} color="#FF5A4E">
      <Label
        w={64}
        centerY={15}
        align="center"
        size={20}
        font="Onest700"
        content="LIVE"
      />
    </TvView>
    <Label
      x={176}
      y={130}
      size={24}
      color={palette.muted}
      maxwidth={920}
      maxlines={1}
      content={(() => {
        const channel = props.channel;
        return [channel?.number, liveTitle(channel?.card.title)]
          .filter(Boolean)
          .join(" · ");
      })()}
    />
    <Label
      x={LAYOUT.inset}
      y={174}
      size={56}
      font="Onest700"
      maxwidth={1000}
      maxlines={1}
      content={
        liveTitle(
          props.program?.title ??
            props.channel?.card.subtitle,
        )
      }
    />
    <Show when={props.program}>
      {(p) => (
        <>
          <Label
            x={LAYOUT.inset}
            y={250}
            size={24}
            font="Onest500"
            content={programLine(p().start_millis, p().end_millis)}
          />
          <Label
            x={LAYOUT.inset}
            y={316}
            size={28}
            maxwidth={1000}
            maxlines={3}
            content={p().description ?? ""}
          />
        </>
      )}
    </Show>
    <Show
      when={
        props.program?.artwork ??
        props.channel?.card.landscape ??
        props.channel?.card.poster
      }
    >
      {(art) => (
      <TvView
        x={1184}
        y={120}
        w={640}
        h={360}
        src={imageSource(art(), 1280)}
        fit="contain"
      >
        <TvView y={270} w={640} h={90} src={livePreviewScrim()} fit="cover" />
        <TvView
          x={404}
          y={322}
          w={24}
          h={24}
          src={icon("play", false, 0, "#F4F2EE")}
        />
        <Label
          x={436}
          y={324}
          w={188}
          align="right"
          size={20}
          font="Onest600"
          content="OK to watch"
        />
      </TvView>
      )}
    </Show>
  </>;
}
