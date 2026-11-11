/** @jsxImportSource @solidtv/solid */
import { For } from "solid-js";
import { TvView } from "../runtime";
import { Label, palette } from "./visuals";

export function BrowseControls(props: { catalog: string; filters: boolean; focused: boolean; index: number }) {
  return <>
    <For
      each={[
        {
          id: "catalog",
          label: props.catalog,
        },
        ...(props.filters
          ? [{ id: "filters", label: "Filters" }]
          : []),
      ]}
    >
      {(control, index) => (
        <TvView
          x={index() === 0 ? 96 : 480 + (index() - 1) * 224}
          y={140}
          w={index() === 0 ? 360 : 200}
          h={64}
          color={
            props.focused && props.index === index()
              ? palette.text
              : "rgba(255,255,255,.12)"
          }
        >
          <Label
            x={22}
            centerY={32}
            size={23}
            maxwidth={index() === 0 ? 316 : 156}
            maxlines={1}
            content={control.label}
            color={
              props.focused && props.index === index()
                ? "#111113"
                : palette.text
            }
          />
        </TvView>
      )}
    </For>
  </>;
}
