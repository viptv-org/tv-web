/** @jsxImportSource @solidtv/solid */
import { For, Show, type JSX } from "solid-js";
import { TvView } from "../runtime";
import { icon, Label, palette } from "./visuals";

export function TextEntryPanel(props: { title: string; numeric: boolean; secret: boolean; text: string; children: JSX.Element }) {
  return <>
    <TvView w={1920} h={1080} color={palette.bg}>
      <Show
        when={
          props.numeric
        }
      >
        <TvView
          x={900}
          y={150}
          w={120}
          h={120}
          color={palette.surface}
        >
          <TvView
            x={32}
            y={32}
            w={56}
            h={56}
            src={icon("lock")}
          />
        </TvView>
        <For
          each={Array.from(
            { length: Math.max(4, Math.min(8, props.text.length)) },
            (_, i) => i,
          )}
        >
          {(i) => (
            <TvView
              x={
                (1920 -
                  Math.max(4, Math.min(8, props.text.length)) * 106 +
                  18) /
                  2 +
                i * 106
              }
              y={380}
              w={88}
              h={104}
              color={
                i === props.text.length ? palette.text : "#3B3B3A"
              }
            >
              <TvView
                x={2}
                y={2}
                w={84}
                h={100}
                color="#202020"
              />
              <Show when={i < props.text.length}>
                <TvView
                  x={33}
                  y={41}
                  w={22}
                  h={22}
                  color={palette.text}
                />
              </Show>
            </TvView>
          )}
        </For>
      </Show>
      <Label
        x={
          props.numeric
            ? 0
            : 96
        }
        w={
          props.numeric
            ? 1920
            : 1728
        }
        align={
          props.numeric
            ? "center"
            : "left"
        }
        y={
          props.numeric
            ? 300
            : 80
        }
        size={44}
        font="Onest700"
        content={props.title}
      />
      <TvView
        show={
          !props.numeric
        }
        x={96}
        y={195}
        w={1728}
        h={88}
        color={palette.surface}
      >
        <Label
          x={24}
          centerY={44}
          size={32}
          maxwidth={1680}
          maxlines={1}
          content={
            props.secret
              ? "•".repeat(props.text.length)
              : props.text
          }
        />
      </TvView>
      {props.children}
    </TvView>
  </>;
}
