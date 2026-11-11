/** @jsxImportSource @solidtv/solid */
import { Label, palette } from "../visuals";

export function SourceHeading(props: { title: string; checking: boolean; count: number; addons: number }) {
  return <>
    <Label
      x={64}
      y={72}
      size={44}
      font="Onest700"
      content="Choose a source"
    />
    <Label
      x={64}
      y={138}
      size={24}
      color={palette.muted}
      maxwidth={800}
      maxlines={1}
      content={
        props.checking
          ? `${props.title} · finding sources`
          : `${props.title} · ${
              props.count
            } sources${
              props.addons
                ? ` from ${props.addons} ${
                    props.addons === 1
                      ? "add-on"
                      : "add-ons"
                  }`
                : ""
            }`
      }
    />
  </>;
}
