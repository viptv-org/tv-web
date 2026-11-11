/** @jsxImportSource @solidtv/solid */
import { createMemo } from "solid-js";
import { TvView } from "../runtime";
import { sdfTextMetrics } from "./text-measure";
import { Button, Label, palette } from "./visuals";

/** Keep short recovery messages compact; reserve more space only for real copy. */
export function StatusDialog(props: { title: string; message: string; action: string }) {
  const lines = createMemo(() => {
    const measure = sdfTextMetrics("26px Onest");
    let line = "", count = 1;
    for (const word of props.message.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure.measureText(next).width > 536) { count++;line = word; }
      else line = next;
    }
    return Math.min(4, count);
  });
  const actionY = () => 96 + lines() * 38 + 28;
  const height = () => actionY() + 64 + 40;
  return (
    <TvView x={640} y={(1080 - height()) / 2} w={640} h={height()} color={palette.surface}>
      <Label x={40} y={40} size={32} lineheight={1.25} font="Onest700" maxwidth={560} maxlines={1} content={props.title} />
      <Label x={40} y={96} size={26} lineheight={38 / 26} maxwidth={560} maxlines={4} content={props.message} color={palette.body} />
      <Button x={40} y={actionY()} w={280} h={64} label={props.action} focused />
    </TvView>
  );
}
