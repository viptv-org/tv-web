/** @jsxImportSource @solidtv/solid */
import { createMemo, Show } from "solid-js";
import { TvView } from "../runtime";
import { icon, Label, palette } from "./visuals";
import { sdfTextMetrics } from "./text-measure";
import type { Control, LibraryQuery } from "./types";

const valueLabel = (
  control: Control | undefined,
  query: LibraryQuery | undefined,
  fallback: LibraryQuery | undefined,
) => {
  const id = query?.[control?.id ?? ""] ?? fallback?.[control?.id ?? ""];
  return (
    control?.choices.find((choice) => choice.value === id)?.label ??
    control?.choices[0]?.label ??
    "All"
  );
};

const titleWidth = (title: string) =>
  Math.ceil(sdfTextMetrics("24px Onest600").measureText(`${title}: `).width);

function FilterPill(props: {
  x: number;
  title: string;
  value: string;
  focused: boolean;
  color?: string;
  chevron?: boolean;
}) {
  const width = () =>
    82 +
    titleWidth(props.title) +
    Math.ceil(sdfTextMetrics("24px Onest600").measureText(props.value).width);
  return (
    <TvView
      x={props.x}
      y={0}
      w={width()}
      h={64}
      color={props.focused ? palette.text : (props.color ?? "#2A2A2E")}
    >
      <Label
        x={24}
        centerY={32}
        size={24}
        font="Onest600"
        content={`${props.title}:`}
        color={props.focused ? "#4A4945" : palette.muted}
      />
      <Label
        x={24 + titleWidth(props.title) + 6}
        centerY={32}
        size={24}
        font="Onest600"
        maxwidth={width() - 74 - titleWidth(props.title)}
        maxlines={1}
        content={props.value}
        color={props.focused ? "#111113" : palette.text}
      />
      <Show when={props.chevron !== false}>
        <TvView
          x={width() - 44}
          y={20}
          w={24}
          h={24}
          src={icon("down", props.focused)}
        />
      </Show>
    </TvView>
  );
}

export function LibraryToolbar(props: {
  type?: Control;
  sort?: Control;
  filters: boolean;
  query?: LibraryQuery;
  defaultQuery?: LibraryQuery;
  focused: boolean;
  index: number;
}) {
  const typeValue = createMemo(() =>
    valueLabel(props.type, props.query, props.defaultQuery),
  );
  const sortValue = createMemo(() =>
    valueLabel(props.sort, props.query, props.defaultQuery),
  );
  const typeWidth = () =>
    76 +
    titleWidth(props.type?.label ?? "Type") +
    Math.ceil(sdfTextMetrics("24px Onest600").measureText(typeValue()).width);
  const sortX = () => 96 + typeWidth() + 12;
  const sortWidth = () =>
    76 +
    titleWidth(props.sort?.label ?? "Sort") +
    Math.ceil(sdfTextMetrics("24px Onest600").measureText(sortValue()).width);
  const clearX = () => sortX() + sortWidth() + 24;
  const clearVisible = () => true;
  return (
    <TvView y={140}>
      <Show when={props.type}>
        <FilterPill
          x={96}
          title="Type"
          value={typeValue()}
          focused={props.focused && props.index === 0}
        />
      </Show>
      <Show when={props.sort}>
        <FilterPill
          x={sortX()}
          title="Sort"
          value={sortValue()}
          focused={props.focused && props.index === 1}
        />
      </Show>
      <Show when={clearVisible()}>
        <TvView
          x={clearX()}
          y={0}
          w={138}
          h={64}
          color={props.focused && props.index === 2 ? palette.text : "rgba(0,0,0,0)"}
        >
          <TvView
            x={18}
            y={20}
            w={24}
            h={24}
            src={icon(
              "close",
              props.focused && props.index === 2,
            )}
          />
          <Label
            x={52}
            centerY={32}
            size={24}
            font="Onest600"
            content="Clear"
            color={
              props.focused && props.index === 2
                ? "#111113"
                : palette.muted
            }
          />
        </TvView>
      </Show>
    </TvView>
  );
}
