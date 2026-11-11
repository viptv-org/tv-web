/** @jsxImportSource @solidtv/solid */
import { Show } from "solid-js";
import { Label, palette } from "../visuals";
import { BusySpinner } from "../BusyIndicator";
import { SOURCE_SPINNER_SIZE } from "../sourceStatus";

export function SourceFooter(props: { empty?: string; status?: string; failure: string; filtered: boolean }) {
  return <>
    <Show when={props.empty}>
      <Label
        x={64}
        y={340}
        size={28}
        maxwidth={800}
        content={props.empty}
      />
    </Show>
    <Show
      when={
        props.filtered
      }
    >
      <Label
        x={64}
        y={340}
        size={26}
        maxwidth={800}
        color={palette.muted}
        content="No sources match these filters."
      />
    </Show>
    <Show when={props.failure}>
      <Label
        x={64}
        y={932}
        size={20}
        font="Onest600"
        maxwidth={800}
        maxlines={1}
        color="#FF7A6E"
        content={props.failure}
      />
    </Show>
    {/* SRC-DRAWER-10: the status line sits under the list and
        is absent while the picker is idle. */}
    <Show when={props.status}>
      <BusySpinner x={64} y={964} size={SOURCE_SPINNER_SIZE} />
      <Label
        x={64 + SOURCE_SPINNER_SIZE + 12}
        y={960}
        size={22}
        maxwidth={800}
        maxlines={1}
        color={palette.muted}
        content={props.status}
      />
    </Show>
  </>;
}
