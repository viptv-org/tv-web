/** @jsxImportSource @solidtv/solid */
import { For, Show } from "solid-js";
import { TvView } from "../runtime";
import { icon, Label, palette } from "./visuals";
import type { Overlay } from "./app-types";

export function TracksDrawer(props: { columns: Extract<Overlay, { kind: "tracks" }>["columns"]; column: number; selected: number }) {
  return <>
    <TvView
      y={540}
      w={1920}
      h={540}
      color={palette.surface}
    >
      <For
        each={
          props.columns
        }
      >
        {(column, c) => (
          <TvView x={96 + c() * 600}>
            <Label
              y={48}
              size={24}
              font="Onest600"
              color={palette.muted}
              content={column.title}
            />
            <For
              each={column.items.slice(
                c() === props.column
                  ? Math.max(0, props.selected - 4)
                  : 0,
                (c() === props.column
                  ? Math.max(0, props.selected - 4)
                  : 0) + 5,
              )}
            >
              {(item, i) => (
                <TvView
                  x={-20}
                  y={92 + i() * 70}
                  w={520}
                  h={64}
                  color={
                    c() === props.column &&
                    i() + Math.max(0, props.selected - 4) === props.selected
                      ? palette.text
                      : "rgba(0,0,0,0)"
                  }
                >
                  <Show when={item.value === "✓"} fallback={<Label x={20} centerY={32} size={24} content={item.value ?? ""} />}>
                    <TvView x={20} y={20} w={24} h={24} src={icon("check", c() === props.column && i() + Math.max(0, props.selected - 4) === props.selected)} />
                  </Show>
                  <Label
                    x={60}
                    centerY={32}
                    size={26}
                    maxwidth={440}
                    maxlines={1}
                    content={item.label}
                    color={
                      c() === props.column &&
                      i() + Math.max(0, props.selected - 4) === props.selected
                        ? "#111113"
                        : palette.text
                    }
                  />
                </TvView>
              )}
            </For>
          </TvView>
        )}
      </For>
    </TvView>
  </>;
}
