/** @jsxImportSource @solidtv/solid */
import { For, Show, type Accessor } from "solid-js";
import { TvView } from "../../runtime";
import { Label, palette } from "../visuals";
import { timeOfDay } from "../time";
import { liveTitle } from "./title";
import type { Channel, Program } from "../types";

interface GuideWindow { row: Accessor<number>; start: Accessor<number>; now: Accessor<number> }
interface GuideSelection { index: Accessor<number>; active: Accessor<boolean>; program: Accessor<string | undefined> }

export function LiveGuideGrid(props: { channels: readonly Channel[]; programs: Record<string, Program[]>; window: GuideWindow; selection: GuideSelection }) {
  return <>
    {/* The header belongs to the grid, not to one row: it reads the
        page's window for as long as there are channels to draw. */}
    <Show when={props.channels.length}>
      <For each={[0, 1, 2, 3]}>
        {(i) => (
          <Label
            x={420 + i * 350}
            y={592}
            size={20}
            font="Onest600"
            color={palette.muted}
            content={
              i === 0
                ? timeOfDay(props.window.start())
                : timeOfDay(props.window.start() + i * 1800000).replace(
                    /\s?(AM|PM)/i,
                    "",
                  )
            }
          />
        )}
      </For>
    </Show>
    <TvView x={96} y={636} w={1728} h={408} clipping={true}>
      <For
        each={props.channels.slice(
          Math.max(0, props.window.row()),
          props.window.row() + 5,
        )}
      >
        {(channel, i) => (
          <TvView
            y={
              (i() + Math.max(0, props.window.row()) - props.window.row()) *
              80
            }
          >
            <TvView
              w={300}
              h={72}
              color="rgba(255,255,255,.06)"
            >
              <Show when={channel.number}>
                <Label
                  x={18}
                  centerY={36}
                  size={22}
                  font="Onest600"
                  maxwidth={34}
                  maxlines={1}
                  content={channel.number ?? ""}
                  color={palette.muted}
                />
              </Show>
              <Label
                x={channel.number ? 68 : 18}
                centerY={36}
                size={30}
                font="Bricolage800"
                letterspacing={-0.6}
                maxwidth={channel.number ? 214 : 264}
                maxlines={1}
                content={liveTitle(channel.card.title)}
                color={palette.text}
              />
            </TvView>
            <TvView x={328} w={1400} h={72} clipping={true}>
              <Show
                when={props.programs[channel.id]?.length}
                fallback={
                  <TvView
                    w={1400}
                    h={72}
                    color={
                      i() + Math.max(0, props.window.row()) ===
                        props.selection.index() && props.selection.active()
                        ? palette.text
                        : palette.surface
                    }
                  >
                    <Label
                      x={20}
                      centerY={36}
                      size={24}
                      content="Programme information unavailable"
                      color={
                        i() + Math.max(0, props.window.row()) ===
                          props.selection.index() && props.selection.active()
                          ? "#111113"
                          : palette.muted
                      }
                    />
                  </TvView>
                }
              >
                <For
                  each={(props.programs[channel.id] ?? [])
                    .filter(
                      (p) =>
                        p.end_millis > props.window.start() &&
                        p.start_millis < props.window.start() + 7200000,
                    )
                    .slice(0, 12)}
                >
                  {(program) => (
                    <TvView
                      x={Math.max(
                        0,
                        ((program.start_millis - props.window.start()) /
                          7200000) *
                          1400,
                      )}
                      w={Math.max(
                        12,
                        ((Math.min(
                          props.window.start() + 7200000,
                          program.end_millis,
                        ) -
                          Math.max(
                            props.window.start(),
                            program.start_millis,
                          )) /
                          7200000) *
                          1400 -
                          8,
                      )}
                      h={72}
                      color={
                        i() + Math.max(0, props.window.row()) ===
                          props.selection.index() &&
                        program.id === props.selection.program() &&
                        props.selection.active()
                          ? palette.text
                          : "#212124"
                      }
                    >
                      <Label
                        x={20}
                        centerY={36}
                        size={24}
                        maxwidth={Math.max(
                          0,
                          ((Math.min(
                            props.window.start() + 7200000,
                            program.end_millis,
                          ) -
                            Math.max(
                              props.window.start(),
                              program.start_millis,
                            )) /
                            7200000) *
                            1400 -
                            48,
                        )}
                        maxlines={1}
                        content={program.title}
                        color={
                          i() + Math.max(0, props.window.row()) ===
                            props.selection.index() &&
                          program.id === props.selection.program() &&
                          props.selection.active()
                            ? "#111113"
                            : palette.text
                        }
                      />
                    </TvView>
                  )}
                </For>
              </Show>
            </TvView>
          </TvView>
        )}
      </For>
      <Show when={props.channels.length}>
        <TvView
          x={
            328 +
            Math.max(
              0,
              Math.min(
                1400,
                ((props.window.now() - props.window.start()) / 7200000) *
                  1400,
              ),
            )
          }
          w={2}
          h={400}
          color="#FF5A4E"
        />
      </Show>
    </TvView>
  </>;
}
