import type { Accessor } from "solid-js";
import type { NavigationFocus, IndexedFocus } from "./focus";

export function createLiveNavigation(options: {
  focus: NavigationFocus; emptyActions: Accessor<number>; navIndex: Accessor<number>;
  channels: Accessor<number>; groups: Accessor<number>; programs: Pick<IndexedFocus, "set" | "count">;
  moveChannel: (step: number) => void;
}) {
  const {zone, setZone, setColumn} = options.focus;
  return (dx: number, dy: number) => {
    if (zone() === "live-empty") {
      // Down reaches the second action, Up returns to the navigation, and
      // Left and Right do nothing on either action.
        const count = options.emptyActions();
      if (dy < 0) {
        setZone("nav");
        setColumn(options.navIndex());
      } else if (dy > 0)
        setColumn((i) => Math.min(Math.max(0, count - 1), i + 1));
      return true;
    }
    if (zone() === "live-groups") {
      if (dy > 0) {
        // A page that is empty only because of its filter has no row for the
        // focus to land on, so the chips stay the page's own stop.
        if (!options.channels()) return true;
        setZone("content");
        setColumn(0);
      } else if (dy < 0) {
        setZone("nav");
        setColumn(options.navIndex());
      } else setColumn((i) => Math.max(0, Math.min(options.groups(), i + dx)));
      return true;
    }
    if (zone() === "content") {
      if (dx) {options.programs.set(i => Math.max(0, Math.min(options.programs.count() - 1, i + dx)));return true;}
      if (dy) options.moveChannel(dy);
      return true;
    }
    return false;
  };
}
