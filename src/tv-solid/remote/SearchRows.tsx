/** @jsxImportSource @solidtv/solid */
import { For, Show } from "solid-js";
import { TvView } from "../runtime";
import { MediaTile } from "./MediaTile";
import { Button, Label, palette } from "./visuals";
import type { SearchRow } from "./types";

export function SearchRows(props: {
  rows: SearchRow[]; row: number; column: number; focused: boolean; retryFocused: boolean;
  pending: boolean; error: string; query: string; channels: boolean; remembered: (id: string) => number;
}) {
  const visible = () => props.rows.slice(props.row, props.row + (props.channels ? 1 : 2));
  return <TvView x={700} y={128} w={1128} h={props.channels ? 514 : 940} clipping>
    <Show when={!props.rows.length && !props.error}>
      <Label y={110} size={28} color={palette.muted}
        content={props.pending ? "Searching…" : props.query ? "No matching titles" : "Find something to watch"} />
    </Show>
    <For each={visible()}>{(shelf, index) => {
      const selected = () => index() === 0 ? props.column : props.remembered(shelf.id);
      const start = () => Math.max(0, selected() - 4);
      const retry = () => shelf.state === "Failed" || !!shelf.message;
      return <TvView y={index() ? (props.rows[props.row]?.cards.length ? 500 : 180) : 0} w={1128} h={shelf.cards.length ? 500 : 180}>
        <Label y={12} size={30} font="Onest600" maxwidth={retry() ? 900 : 1124} maxlines={1} content={shelf.title} />
        <Show when={retry()}>
          <Button x={924} y={0} w={200} h={56} label="Try again" focused={index() === 0 && props.retryFocused} />
          <Label y={shelf.cards.length ? 470 : 86} size={22} maxwidth={1100} maxlines={1}
            content={shelf.message ?? "This search provider could not respond. Try again."} />
        </Show>
        <Show when={!shelf.cards.length && !retry()}>
          <Label y={86} size={26} color={palette.muted}
            content={shelf.state === "Loading" || shelf.state === "Pending" ? "Searching…" : "No matching titles"} />
        </Show>
        <For each={shelf.cards.slice(start(), start() + 5)}>{(card, cardIndex) =>
          <MediaTile card={card} x={cardIndex() * 228} y={68} w={212} h={318}
            focused={props.focused && index() === 0 && cardIndex() + start() === props.column} poster focusedCaptions />
        }</For>
      </TvView>;
    }}</For>
  </TvView>;
}
