import type { Accessor, Setter } from "solid-js";
import type { IndexedFocus } from "./focus";

export function createSourceNavigation(options: {
  manual: () => void;
  actions: Pick<IndexedFocus, "set" | "count"> & {open: Accessor<boolean>};
  menu: Pick<IndexedFocus, "set" | "count"> & {open: Accessor<boolean>};
  filters: {focused: Accessor<boolean>; focus: Setter<boolean>; facet: Setter<number>};
  rows: IndexedFocus;
}) {
  const {open: sourceActions, set: setSourceActionChoice} = options.actions;
  const {open: sourceMenu, set: setSourceMenuChoice} = options.menu;
  const {focused: sourceFilterFocus, focus: setSourceFilterFocus, facet: setSourceFacet} = options.filters;
  const {index: choice, set: setChoice} = options.rows;
  return (dx: number, dy: number) => {
    options.manual();
    if (sourceActions()) {
      if (dy)
        setSourceActionChoice((i) =>
          Math.max(
            0,
            Math.min(options.actions.count() - 1, i + dy),
          ),
        );
      return;
    }
    if (sourceMenu()) {
      const count = options.menu.count();
      if (dy)
        setSourceMenuChoice((i) =>
          Math.max(0, Math.min(count - 1, i + dy)),
        );
      return;
    }
    if (sourceFilterFocus()) {
      if (dy > 0) setSourceFilterFocus(false);
      else if (dx)
        setSourceFacet((i) => Math.max(0, Math.min(1, i + dx)));
    } else if (dy < 0 && choice() === 0) {
      setSourceFilterFocus(true);
      setSourceFacet(0);
    } else
      setChoice((i) =>
        Math.max(0, Math.min(options.rows.count() - 1, i + dy)),
      );
  };
}
