/** @jsxImportSource @solidtv/solid */
import { createMemo, For, Show } from "solid-js";
import { TvView } from "../runtime";
import { Button, icon, Label, palette } from "./visuals";
import type { Control, LibraryQuery } from "./types";

export function LibraryToolbar(props: {
  types: Control["choices"];
  sort?: Control;
  filters: boolean;
  query?: LibraryQuery;
  focused: boolean;
  index: number;
}) {
  const first = () =>
    props.focused && props.index < props.types.length
      ? Math.max(0, props.index - 3)
      : 0;
  const sortValue = () =>
    props.sort?.choices.find((c) => c.value === props.query?.sort)?.label ?? "";
  const sortWidths = createMemo(() => {
    const canvas = document.createElement("canvas").getContext("2d")!;
    canvas.font = "24px Onest600";
    return [
      Math.ceil(canvas.measureText(props.sort?.label ?? "").width),
      Math.ceil(canvas.measureText(sortValue()).width),
    ];
  });
  const sortWidth = () => Math.min(600, sortWidths()[0] + sortWidths()[1] + 96);
  const sortFocused = () => props.focused && props.index === props.types.length;
  return (
    <TvView y={140}>
      <Show when={props.types.length}>
        <TvView
          x={96}
          w={Math.min(4, props.types.length) * 168 + 12}
          h={64}
          rounded={32}
          color="#2A2A2E"
        >
          <For each={props.types.slice(first(), first() + 4)}>
            {(item, i) => {
              const focused = () =>
                props.focused && props.index === i() + first();
              return (
                <TvView
                  x={6 + i() * 168}
                  y={6}
                  w={168}
                  h={52}
                  rounded={26}
                  color={
                    focused()
                      ? palette.text
                      : props.query?.type === item.value
                        ? palette.bg
                        : "rgba(0,0,0,0)"
                  }
                >
                  <Label
                    w={168}
                    centerY={26}
                    align="center"
                    size={24}
                    font="Onest700"
                    maxlines={1}
                    color={
                      focused()
                        ? "#111113"
                        : props.query?.type === item.value
                          ? palette.text
                          : palette.muted
                    }
                    content={item.label}
                  />
                </TvView>
              );
            }}
          </For>
        </TvView>
      </Show>
      <Show when={props.filters && !props.sort}>
        <Button
          x={1624}
          y={0}
          w={200}
          h={64}
          pill
          label="Filters"
          focused={props.focused && props.index === props.types.length}
        />
      </Show>
      <Show when={props.sort}>
        {(sort) => (
          <TvView
            x={1824 - sortWidth()}
            w={sortWidth()}
            h={64}
            rounded={32}
            color={sortFocused() ? palette.text : "rgba(255,255,255,.16)"}
          >
            <Label
              x={24}
              centerY={32}
              size={24}
              font="Onest600"
              content={sort().label}
              color={sortFocused() ? "#4A4945" : palette.muted}
            />
            <Label
              x={36 + sortWidths()[0]}
              centerY={32}
              size={24}
              font="Onest600"
              content={sortValue()}
              maxwidth={sortWidth() - sortWidths()[0] - 96}
              maxlines={1}
              color={sortFocused() ? "#111113" : palette.text}
            />
            <TvView
              x={sortWidth() - 48}
              y={20}
              w={24}
              h={24}
              src={icon("down", sortFocused())}
            />
          </TvView>
        )}
      </Show>
    </TvView>
  );
}
