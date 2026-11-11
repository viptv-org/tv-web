/** @jsxImportSource @solidtv/solid */
import { For } from "solid-js";
import { TvView } from "../runtime";
import { Label, palette } from "./visuals";

export function KeyboardView(props: { numeric: boolean; modal: boolean; letters: readonly string[]; upper: boolean; symbols: boolean; selected: number }) {
  const keys = () => props.numeric
    ? ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "Done"]
    : [...props.letters, props.upper ? "aa" : "Aa", "Space", "⌫", props.symbols ? "ABC" : "#+=", props.modal ? "Done" : "Search", props.modal ? "Cancel" : "Clear"];
  return (
    <TvView
      x={props.numeric ? 744 : 96}
      y={props.numeric ? 540 : props.modal ? 350 : 280}
    >
      <For each={keys()}>
        {(letter, index) => (
          <TvView
            x={(index() % (props.numeric ? 3 : 6)) * (props.numeric ? 148 : 78)}
            y={
              Math.floor(index() / (props.numeric ? 3 : 6)) *
              (props.numeric ? 88 : 78)
            }
            w={props.numeric ? 136 : 68}
            h={props.numeric ? 76 : 68}
            color={
              props.selected === index() ? palette.text : "rgba(255,255,255,.1)"
            }
          >
            <Label
              centerY={props.numeric ? 38 : 34}
              w={props.numeric ? 136 : 68}
              align="center"
              size={letter.length > 1 ? 18 : props.numeric ? 32 : 26}
              font="Onest600"
              content={letter}
              color={props.selected === index() ? "#111113" : palette.text}
            />
          </TvView>
        )}
      </For>
    </TvView>
  );
}
