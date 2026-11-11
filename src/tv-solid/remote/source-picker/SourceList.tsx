/** @jsxImportSource @solidtv/solid */
import { For, Show } from "solid-js";
import { TvView } from "../../runtime";
import { icon, Label, palette } from "../visuals";
import { sdfTextMetrics } from "../text-measure";
import { sourceAudioSubs, sourceFacts, sourceQuality, sourceReleaseGroup, sourceReleaseType } from "../source-presentation";
import type { Source } from "../types";

export function SourceList(props: { sources: readonly Source[]; selected: number; focused: boolean; bestMatch?: string; failed: ReadonlySet<string> }) {
  return <>
    <Label
      x={64}
      y={288}
      size={22}
      font="Onest700"
      letterspacing={1.4}
      maxwidth={800}
      maxlines={1}
      color={palette.muted}
      content="BEST MATCHES"
    />
    <For
      each={props.sources.slice(
        Math.max(0, props.selected - 4),
        Math.max(0, props.selected - 4) + 5,
      )}
    >
      {(source, i) => {
        const rowFocused = () =>
          i() + Math.max(0, props.selected - 4) === props.selected &&
          props.focused;
        const title = () => sourceReleaseGroup(source);
        const titleWidth = () =>
          Math.min(
            420,
            Math.ceil(
              sdfTextMetrics("26px Onest600").measureText(
                title(),
              ).width,
            ),
          );
        return (
          <TvView
            x={64}
            y={320 + i() * 120}
            w={800}
            h={120}
            color={rowFocused() ? palette.text : "#222222"}
          >
            <Label
              x={28}
              y={16}
              size={30}
              font="Onest700"
              maxwidth={116}
              maxlines={1}
              content={sourceQuality(source)}
              color={
                rowFocused() ? "#111113" : palette.text
              }
            />
            <Label
              x={28}
              y={54}
              size={18}
              font="Onest600"
              maxwidth={116}
              maxlines={1}
              content={sourceReleaseType(source) ?? ""}
              color={
                rowFocused() ? "#444444" : palette.muted
              }
            />
            <Label
              x={164}
              y={14}
              size={26}
              font="Onest600"
              maxwidth={420}
              maxlines={1}
              content={title()}
              color={
                rowFocused() ? "#111113" : palette.text
              }
            />
            <Show
              when={source.id === props.bestMatch}
            >
              <TvView
                x={180 + titleWidth()}
                y={14}
                w={136}
                h={30}
                color={
                  rowFocused()
                    ? "#111113"
                    : "rgba(244,242,238,.16)"
                }
              >
                <Label
                  w={136}
                  centerY={15}
                  align="center"
                  size={18}
                  font="Onest700"
                  content="Best match"
                  color={
                    rowFocused()
                      ? palette.text
                      : palette.accent
                  }
                />
              </TvView>
            </Show>
            <Show when={props.failed.has(source.id)}>
              <Label
                x={600}
                y={80}
                w={172}
                align="right"
                size={18}
                font="Onest700"
                content="Didn't start"
                color={
                  rowFocused() ? "#8F2B22" : "#FF7A6E"
                }
              />
            </Show>
            <Label
              x={164}
              y={52}
              size={18}
              font="Onest600"
              maxwidth={420}
              maxlines={1}
              content={sourceAudioSubs(source)}
              color={
                rowFocused() ? "#4A4945" : palette.muted
              }
            />
            <Label
              x={164}
              y={80}
              size={18}
              maxwidth={420}
              maxlines={1}
              content={sourceFacts(source).join(" · ")}
              color={
                rowFocused() ? "#4A4945" : palette.muted
              }
            />
            <Show when={rowFocused()}>
              <TvView
                x={744}
                y={42}
                w={28}
                h={28}
                color="#111113"
              >
                <TvView
                  x={4}
                  y={4}
                  w={20}
                  h={20}
                  src={icon(
                    "check",
                    false,
                    2.4,
                    "#F4F2EE",
                  )}
                />
              </TvView>
            </Show>
          </TvView>
        );
      }}
    </For>
  </>;
}
