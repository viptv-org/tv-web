/** @jsxImportSource @solidtv/solid */
import { createMemo, For } from "solid-js";
import { TvView } from "../runtime";
import { Label, outline, palette } from "./visuals";
import type { Card } from "./types";

/** Lay out the producer's ordered display parts; no metadata/quality policy. */
export function TitleMetadata(props: {
  card: Card;
  y: number;
  detail?: boolean;
}) {
  const layout = createMemo(() => {
    const context = document.createElement("canvas").getContext("2d")!;
    context.font = "24px Onest500";
    const parts = props.detail
      ? props.card.view?.metadata_parts
      : props.card.view?.hero_metadata_parts;
    let x = 0;
    const text: { value: string; x: number; separator: boolean }[] = [];
    for (const [i, value] of (parts ?? []).entries()) {
      if (i) {
        text.push({ value: "·", x, separator: true });
        x += context.measureText("·").width + 12;
      }
      text.push({ value, x, separator: false });
      x += context.measureText(value).width + 12;
    }
    if (text.length) x += 18; // 6px spacer and the second flex gap before badges.
    context.font = "18px Onest700";
    const native = "letterSpacing" in context;
    if (native)
      (
        context as CanvasRenderingContext2D & { letterSpacing: string }
      ).letterSpacing = ".36px";
    const badges = (props.card.view?.hero_badges ?? []).map((badge) => {
      const width =
        context.measureText(badge.label).width +
        (native ? 0 : Array.from(badge.label).length * 0.36) +
        16;
      const value = { ...badge, x, width };
      x += width + 12;
      return value;
    });
    return { text, badges };
  });
  return (
    <TvView y={props.y} w={1100} h={30}>
      <For each={layout().text}>
        {(part) => (
          <Label
            x={part.x}
            centerY={15}
            size={24}
            font="Onest500"
            color={part.separator ? "#8F8D89" : palette.body}
            content={part.value}
          />
        )}
      </For>
      <For each={layout().badges}>
        {(badge) => (
          <TvView x={badge.x} w={badge.width} h={30}>
            <TvView
              w={badge.width}
              h={30}
              src={outline(badge.width, 30, 5, 1.5, "#F4F2EE", 0.55)}
            />
            <Label
              x={8}
              centerY={15}
              size={18}
              font="Onest700"
              letterspacing={0.36}
              color={palette.body}
              content={badge.label}
            />
          </TvView>
        )}
      </For>
    </TvView>
  );
}
