/** @jsxImportSource @solidtv/solid */
import { Show } from "solid-js";
import { CalendarBoard } from "../CalendarBoard";
import type { Screen } from "../app-types";

type CalendarProps = Parameters<typeof CalendarBoard>[0];

/** What is coming up: days on the left, that day's entries beside them. */
export function CalendarView(props: { screen: Screen; board: CalendarProps }) {
  return (
    <Show when={props.screen === "calendar"}>
      <CalendarBoard
        entries={props.board.entries}
        days={props.board.days}
        day={props.board.day}
        active={props.board.active}
        dayFocused={props.board.dayFocused}
        listFocused={props.board.listFocused}
        watchFocused={props.board.watchFocused}
        loading={props.board.loading}
        error={props.board.error}
      />
    </Show>
  );
}
