import { batch, type Accessor, type Setter } from "solid-js";
import type { Row } from "../types";
import type { NavigationFocus, PagingNavigation } from "./focus";

export function createHomeRowsNavigation(options: {
  focus: NavigationFocus;
  row: {index: Accessor<number>; set: Setter<number>};
  rows: Accessor<Row[]>;
  resolve: (row: Row) => number;
  remember: () => void;
  load: () => Promise<void>;
  move: PagingNavigation["move"];
}) {
  const {column, setZone, setColumn} = options.focus;
  const {index: row, set: setRow} = options.row;
  return (dx: number, dy: number) => {
    options.remember();
    if (dy < 0 && row() === 0) {
      setZone("hero");
      return;
    }
    if (dy) {
      const rows = options.rows();
      let next = row() + dy;
      while (
        next >= 0 &&
        next < rows.length &&
        !rows[next].cards.length &&
        rows[next].state !== "Failed"
      )
        next += dy;
      if (next < 0) {
        setZone("hero");
        return;
      }
      if (next >= rows.length) return;
      batch(() => { setRow(next);setColumn(options.resolve(rows[next])); });
    }
    const cards = options.rows()[row()]?.cards ?? [];
    if (dx) options.move(
      column() + dx,
      cards.length,
      options.rows()[row()]?.next_cursor,
    );
    options.remember();
    void options.load();
  };
}
