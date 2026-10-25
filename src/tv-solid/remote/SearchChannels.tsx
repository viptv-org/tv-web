/** @jsxImportSource @solidtv/solid */
import { For, Show } from "solid-js";
import { TvView } from "../runtime";
import { Button, cardOutline, Label, palette } from "./visuals";
import type { Channel } from "./types";

let backdrop: ImageData | undefined;
function channelBackdrop() {
  if (!backdrop) {
    const canvas = document.createElement("canvas");
    canvas.width = 356;
    canvas.height = 200;
    const context = canvas.getContext("2d")!;
    const gradient = context.createLinearGradient(39, -39, 317, 239);
    gradient.addColorStop(0, "#1D2230");
    gradient.addColorStop(1, "#121318");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 356, 200);
    backdrop = context.getImageData(0, 0, 356, 200);
  }
  return backdrop;
}
export function SearchChannels(props: {
  channels: Channel[];
  index: number;
  focused: boolean;
  y: number;
  pending: boolean;
  error: string;
  retryFocused: boolean;
  hasPrevious?: boolean;
}) {
  const start = () =>
    props.hasPrevious ? props.index - 1 : Math.max(0, props.index - 1);
  const first = () => Math.max(0, start());
  return (
    <TvView x={700} y={props.y} w={1124} h={400}>
      <Label
        size={30}
        font="Onest600"
        letterspacing={-0.3}
        content="Channels"
      />
      <Show when={props.error}>
        <Label
          x={props.channels.length ? 170 : 0}
          y={props.channels.length ? 6 : 56}
          size={24}
          maxwidth={props.channels.length ? 700 : 800}
          maxlines={props.channels.length ? 1 : 2}
          content={props.error}
        />
        <Button
          x={924}
          y={-12}
          w={200}
          h={56}
          pill
          label="Try again"
          focused={props.retryFocused}
        />
      </Show>
      <Show when={!props.error && !props.pending && !props.channels.length}>
        <Label
          y={56}
          size={26}
          color={palette.muted}
          content="No matching channels"
        />
      </Show>
      <Show when={props.pending}>
        <For each={[0, 1, 2]}>
          {(i) => (
            <TvView
              show={start() + i < 0 || start() + i >= props.channels.length}
              x={i * 376}
              y={56}
              w={356}
              h={200}
              rounded={10}
              color="rgba(255,255,255,.06)"
            />
          )}
        </For>
      </Show>
      <For each={props.channels.slice(first(), start() + 3)}>
        {(channel, i) => (
          <TvView x={(first() - start() + i()) * 376} y={56}>
            <TvView w={356} h={200} rounded={10} src={channelBackdrop()}>
              <Show
                when={channel.card.landscape}
                fallback={
                  <Label
                    w={356}
                    centerY={100}
                    align="center"
                    size={56}
                    font="Bricolage800"
                    letterspacing={-1.12}
                    maxlines={1}
                    content={channel.card.title}
                  />
                }
              >
                <TvView
                  x={20}
                  y={20}
                  w={316}
                  h={160}
                  src={channel.card.landscape!}
                  fit="contain"
                />
              </Show>
              <TvView x={12} y={12} w={60} h={28} rounded={6} color="#E5484D">
                <Label
                  w={60}
                  centerY={14}
                  align="center"
                  size={17}
                  font="Bricolage800"
                  letterspacing={1.02}
                  content="LIVE"
                />
              </TvView>
            </TvView>
            <Show when={props.focused && props.index === first() + i()}>
              <TvView w={356} h={200} src={cardOutline(356, 200, true)} />
            </Show>
            <Label
              y={212}
              size={22}
              font="Onest600"
              maxwidth={356}
              maxlines={1}
              content={channel.card.title}
            />
            <Show when={channel.card.subtitle}>
              <Label
                y={242}
                size={20}
                color={palette.muted}
                maxwidth={356}
                maxlines={1}
                content={channel.card.subtitle}
              />
            </Show>
          </TvView>
        )}
      </For>
    </TvView>
  );
}
