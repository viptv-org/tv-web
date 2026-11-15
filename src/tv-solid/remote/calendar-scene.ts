import { createMemo, createSignal } from "solid-js";
import { calendarDayKey, calendarDays } from "./CalendarBoard";
import type { CalendarEntry, CalendarSnapshot } from "./types";

/** The calendar's own state: the snapshot, the focused day and the focused
 * entry on that day. The board renders it; navigation and the server feed it. */
export function createCalendarScene() {
  const [snapshot, setSnapshot] = createSignal<CalendarSnapshot>();
  const [day, setDay] = createSignal(0);
  const [entry, setEntry] = createSignal(0);
  const days = createMemo(() => calendarDays(snapshot()?.entries ?? []));
  const entries = createMemo(() => {
    const current = days()[day()];
    if (!current) return [];
    return (snapshot()?.entries ?? []).filter((value: CalendarEntry) => {
      const date = new Date(value.date);
      return !Number.isNaN(date.getTime()) && calendarDayKey(date) === current.key;
    });
  });
  return { snapshot, setSnapshot, day, setDay, entry, setEntry, days, entries };
}
