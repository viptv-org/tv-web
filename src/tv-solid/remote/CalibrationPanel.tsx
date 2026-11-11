/** @jsxImportSource @solidtv/solid */
import { TvView } from "../runtime";
import { Label, outline, palette } from "./visuals";

export function CalibrationPanel(props: { title: string; value: number }) {
  return <>
    {/* No reference board exists for the calibration sheet; the
        frame marks the working safe area in the accent colour
        while the stage transform previews it live. */}
    <TvView
      x={Math.round((props.value * 1920) / 100)}
      y={Math.round((props.value * 1080) / 100)}
      w={Math.round(1920 * (1 - (2 * props.value) / 100))}
      h={Math.round(1080 * (1 - (2 * props.value) / 100))}
      src={outline(
        Math.max(
          8,
          Math.round(1920 * (1 - (2 * props.value) / 100)),
        ),
        Math.max(
          8,
          Math.round(1080 * (1 - (2 * props.value) / 100)),
        ),
        4,
        3,
        palette.accent,
      )}
    />
    <TvView
      x={610}
      y={430}
      w={700}
      h={220}
      color={palette.surface}
    >
      <Label
        x={40}
        y={36}
        size={40}
        font="Onest700"
        content={props.title}
      />
      <Label
        x={40}
        y={100}
        size={64}
        font="Onest700"
        color={palette.accent}
        content={`${props.value}%`}
      />
      <Label
        x={40}
        y={180}
        size={20}
        color={palette.muted}
        content="Left and right adjust. OK saves; Back restores."
      />
    </TvView>
  </>;
}
