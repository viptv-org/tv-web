/** @jsxImportSource @solidtv/solid */
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { TvView } from "../runtime";
import { icon, Label, palette } from "./visuals";

export const searchLetters = "abcdefghijklmnopqrstuvwxyz1234567890".split("");

export function SearchInput(props: {
  value: string;
  index: number;
  focused: boolean;
}) {
  const [pulse, setPulse] = createSignal(false);
  createEffect(() => {
    if (
      !props.focused ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setPulse(false);
      return;
    }
    const timer = setInterval(() => setPulse((value) => !value), 500);
    onCleanup(() => clearInterval(timer));
  });
  // Only the visible tail needs a glyph texture. The submitted query is intact.
  const tail = () => Array.from(props.value).slice(-48).join("");
  const width = createMemo(() => {
    const context = document.createElement("canvas").getContext("2d")!;
    context.font = "32px Onest500";
    return context.measureText(tail()).width;
  });
  return (
    <>
      <TvView
        x={96}
        y={140}
        w={520}
        h={72}
        rounded={12}
        color="rgba(255,255,255,.08)"
      >
        <TvView x={20} y={22} w={28} h={28} src={icon("search", false, 2.2)} />
        <TvView x={62} w={438} h={72} clipping>
          <Label
            x={Math.min(0, 430 - width())}
            centerY={36}
            size={32}
            font="Onest500"
            content={props.value ? tail() : "Search…"}
            color={props.value ? palette.text : palette.muted}
          />
          <Show when={props.focused}>
            <TvView
              x={props.value ? Math.min(432, width() + 4) : 0}
              y={17}
              w={3}
              h={38}
              alpha={pulse() ? 0.35 : 1}
              scale={pulse() ? 0.8 : 1}
              color={palette.accent}
            />
          </Show>
        </TvView>
      </TvView>
      <TvView x={96} y={236}>
        <For each={["space", "delete", ...searchLetters]}>
          {(value, index) => {
            const selected = () => props.focused && props.index === index();
            return (
              <TvView
                x={index() < 2 ? index() * 264 : ((index() - 2) % 6) * 88}
                y={index() < 2 ? 0 : (1 + Math.floor((index() - 2) / 6)) * 76}
                w={index() < 2 ? 254 : 80}
                h={68}
                rounded={10}
                color={selected() ? palette.text : "rgba(255,255,255,.09)"}
              >
                <Show
                  when={index() < 2}
                  fallback={
                    <Label
                      w={80}
                      centerY={34}
                      align="center"
                      size={28}
                      font="Onest600"
                      content={value}
                      color={selected() ? "#111113" : palette.text}
                    />
                  }
                >
                  <TvView
                    x={113}
                    y={20}
                    w={28}
                    h={28}
                    src={icon(value, selected(), 2.2)}
                  />
                </Show>
              </TvView>
            );
          }}
        </For>
      </TvView>
    </>
  );
}
