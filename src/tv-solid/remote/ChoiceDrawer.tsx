/** @jsxImportSource @solidtv/solid */
import { For } from "solid-js";
import { TvView } from "../runtime";
import { SlidingDrawer } from "./SlidingDrawer";
import { Label, palette } from "./visuals";
import type { Overlay } from "./app-types";

export function ChoiceDrawer(props: { dialog: Extract<Overlay, { kind: "choices" | "confirm" }>; selected: number; entered: boolean; closing: boolean }) {
  return <>
    <SlidingDrawer width={820} entered={props.entered} closing={props.closing}>
      <Label
        x={64}
        y={72}
        size={44}
        font="Onest700"
        maxwidth={692}
        maxlines={2}
        content={props.dialog.title}
      />
      <Label
        x={64}
        y={150}
        size={22}
        maxwidth={692}
        maxlines={2}
        color={palette.muted}
        content={
          props.dialog.description ?? ""
        }
      />
      <For
        each={props.dialog.items.slice(
          Math.max(0, props.selected - 5),
          Math.max(0, props.selected - 5) + 7,
        )}
      >
        {(item, i) => (
          <TvView
            x={64}
            y={230 + i() * 104}
            w={692}
            h={88}
            color={
              i() + Math.max(0, props.selected - 5) === props.selected
                ? palette.text
                : "#212124"
            }
          >
            <Label
              x={24}
              centerY={44}
              size={26}
              font="Onest600"
              maxwidth={570}
              maxlines={1}
              content={item.label}
              color={
                i() + Math.max(0, props.selected - 5) === props.selected
                  ? "#111113"
                  : palette.text
              }
            />
            <Label
              x={600}
              centerY={44}
              size={22}
              content={item.value ?? ""}
              color={
                i() + Math.max(0, props.selected - 5) === props.selected
                  ? "#111113"
                  : palette.text
              }
            />
          </TvView>
        )}
      </For>
    </SlidingDrawer>
  </>;
}
