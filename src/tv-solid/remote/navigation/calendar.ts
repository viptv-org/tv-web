import type { Accessor } from "solid-js";
import type { IndexedFocus, NavigationFocus } from "./focus";

export function createCalendarNavigation(options: {
  focus: NavigationFocus;
  days: IndexedFocus;
  entries: IndexedFocus;
  navIndex: Accessor<number>;
}) {
  const { focus, days, entries } = options;
  return (dx: number, dy: number) => {
    if (focus.zone() === "calendar-days") {
      if (dx) { days.set(index => Math.max(0, Math.min(days.count() - 1, index + dx))); entries.set(0); }
      if (dy > 0 && entries.count()) { focus.setZone("calendar-list"); entries.set(0); }
      if (dy < 0) { focus.setZone("nav"); focus.setColumn(options.navIndex()); }
    } else if (focus.zone() === "calendar-list") {
      if (dy < 0 && entries.index() === 0) focus.setZone("calendar-days");
      else if (dy) entries.set(index => Math.max(0, Math.min(entries.count() - 1, index + dy)));
      else if (dx > 0) focus.setZone("calendar-watch");
    } else if (focus.zone() === "calendar-watch" && (dx < 0 || dy < 0)) focus.setZone("calendar-list");
  };
}
