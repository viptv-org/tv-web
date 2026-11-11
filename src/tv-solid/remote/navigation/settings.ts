import type { Accessor } from "solid-js";
import type { Item } from "../app-types";
import type { NavigationFocus } from "./focus";

export function createSettingsNavigation(options: {
  focus: NavigationFocus;
  tab: Accessor<number>;
  tabCount: number;
  items: Accessor<readonly Item[]>;
  load: (tab: number) => void;
  fail: (error: unknown) => void;
}) {
  const focus = options.focus;
  return (dx: number, dy: number) => {
    if (focus.zone() === "settings-nav") {
      if (dy < 0 && options.tab() === 0) return;
      if (dy) options.load(Math.max(0, Math.min(options.tabCount - 1, options.tab() + dy)));
      if (dx > 0) { focus.setZone("settings-content"); focus.setColumn(0); }
    } else {
      const item = options.items()[focus.column()];
      if (dx && item?.cycle) { void Promise.resolve(item.cycle(dx)).catch(options.fail); return; }
      if (dx < 0) focus.setZone("settings-nav");
      focus.setColumn(index => Math.max(0, Math.min(options.items().length - 1, index + dy)));
    }
  };
}
