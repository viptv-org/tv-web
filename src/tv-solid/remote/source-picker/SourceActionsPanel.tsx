/** @jsxImportSource @solidtv/solid */
import { For, Show } from "solid-js";
import { TvView } from "../../runtime";
import { Label, palette } from "../visuals";
import { sourceQuality, sourceReleaseGroup } from "../source-presentation";
import { sourceActionOptions } from "./options";
import type { Source } from "../types";

export function SourceActionsPanel(props: { source?: Source; selected: number }) {
  return <>
    <TvView w={960} h={1080} color="rgba(0,0,0,.55)" />
    <TvView
      x={64}
      y={250}
      w={800}
      h={430}
      color={palette.surface}
    >
      <Label
        x={28}
        y={24}
        size={32}
        font="Onest700"
        content="Play source"
      />
      <Show when={props.source}>
        {(source) => (
          <Label
            x={28}
            y={70}
            size={22}
            color={palette.muted}
            maxwidth={744}
            maxlines={2}
            content={`${sourceQuality(source())} · ${sourceReleaseGroup(source())}`}
          />
        )}
      </Show>
      <For each={sourceActionOptions}>
        {(option, index) => {
          const focused = () =>
            props.selected === index();
          return (
            <TvView
              x={24}
              y={128 + index() * 76}
              w={752}
              h={64}
              color={focused() ? palette.text : "#222222"}
            >
              <Label
                x={20}
                y={10}
                size={24}
                font="Onest600"
                maxwidth={700}
                maxlines={1}
                content={option.label}
                color={focused() ? "#111113" : palette.text}
              />
              <Show when={option.detail}>
                <Label
                  x={20}
                  y={39}
                  size={16}
                  maxwidth={700}
                  maxlines={1}
                  content={option.detail}
                  color={
                    focused() ? "#4A4945" : palette.muted
                  }
                />
              </Show>
            </TvView>
          );
        }}
      </For>
      <Label
        x={24}
        y={370}
        size={17}
        color={palette.muted}
        maxwidth={752}
        maxlines={2}
        content="Direct play requires a compatible source. Choose Play with gateway if this device cannot play it."
      />
    </TvView>
  </>;
}
