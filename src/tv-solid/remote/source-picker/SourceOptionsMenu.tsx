/** @jsxImportSource @solidtv/solid */
import { For, Show } from "solid-js";
import { TvView } from "../../runtime";
import { icon, Label, palette } from "../visuals";
import type { SourceMenuOption } from "./options";

export function SourceOptionsMenu(props: { kind: "quality" | "provider"; options: readonly SourceMenuOption[]; selected: number; matches: (option: SourceMenuOption) => boolean }) {
  return <>
    <TvView
      w={960}
      h={1080}
      color="rgba(0,0,0,.55)"
    />
    <TvView
      x={64}
      y={170}
      w={800}
      h={560}
      color={palette.surface}
    >
      <Label
        x={28}
        y={24}
        size={32}
        font="Onest700"
        content={
          props.kind === "quality" ? "Quality" : "Source"
        }
      />
      <For
        each={props.options.slice(
          Math.max(0, props.selected - 4),
          Math.max(0, props.selected - 4) + 7,
        )}
      >
        {(option, i) => {
          const start = () =>
            Math.max(0, props.selected - 4);
          const focused = () =>
            i() + start() === props.selected;
          const selected = () =>
            props.matches(option);
          return (
            <TvView
              x={24}
              y={84 + i() * 60}
              w={752}
              h={52}
              color={
                focused() ? palette.text : "#222222"
              }
            >
              <Label
                x={20}
                centerY={26}
                size={24}
                font="Onest600"
                maxwidth={520}
                maxlines={1}
                content={option.label}
                color={
                  focused() ? "#111113" : palette.text
                }
              />
              <Label
                x={580}
                w={120}
                align="right"
                centerY={26}
                size={20}
                content={String(option.count)}
                color={
                  focused() ? "#444444" : palette.muted
                }
              />
              <Show when={selected()}>
                <TvView
                  x={704}
                  y={16}
                  w={20}
                  h={20}
                  src={icon(
                    "check",
                    focused(),
                    2.4,
                    focused() ? "#111113" : "#F4F2EE",
                  )}
                />
              </Show>
            </TvView>
          );
        }}
      </For>
    </TvView>
  </>;
}
