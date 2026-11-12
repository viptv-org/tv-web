/** @jsxImportSource @solidtv/solid */
import { Show } from "solid-js";
import { SearchInput } from "./SearchInput";
import { Button, Label } from "./visuals";

export function SearchHeader(props: { query: string; selected: number; keyboardFocused: boolean; media: boolean; retry: boolean; resultCount: number; error: string; retryFocused: boolean }) {
  return <>
    <SearchInput
      value={props.query}
      index={props.selected}
      focused={props.keyboardFocused}
    />
    <Show when={props.media}>
      <Label
        x={700}
        y={140}
        size={30}
        font="Onest600"
        letterspacing={-0.3}
        content="Search results"
      />
    </Show>
    <Show when={props.retry}>
      <Label
        x={props.resultCount ? 880 : 700}
        y={props.resultCount ? 146 : 220}
        size={props.resultCount ? 20 : 28}
        maxwidth={props.resultCount ? 700 : 1100}
        maxlines={props.resultCount ? 1 : 2}
        content={
          props.error ||
          (props.resultCount
            ? "Partial results"
            : "Some search results are unavailable.")
        }
      />
      <Button
        x={props.resultCount ? 1624 : 700}
        y={props.resultCount ? 128 : 320}
        w={props.resultCount ? 200 : 260}
        h={props.resultCount ? 56 : 72}
        label="Try again"
        focused={props.retryFocused}
      />
    </Show>
  </>;
}
