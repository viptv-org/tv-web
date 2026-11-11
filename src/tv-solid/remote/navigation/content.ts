import type { Accessor } from "solid-js";
import type { Screen } from "../app-types";
import type { NavigationFocus, PagingNavigation } from "./focus";

export function createContentNavigation(options: {
  screen: Accessor<Screen>; focus: NavigationFocus; navIndex: (screen: Screen) => number;
  libraryControls: Accessor<number>; catalogFilters: Accessor<boolean>;
  content: {count: Accessor<number>; columns: Accessor<number>; cursor: Accessor<string | null | undefined>; remembered: Accessor<number>};
  search: {needsRetry: Accessor<boolean>; remember: (index: number) => void};
  paging: PagingNavigation; loadGuide: (index: number) => void;
}) {
  const {screen} = options;
  const {zone, column, setZone, setColumn} = options.focus;
  return (dx: number, dy: number) => {
    if (zone() === "library-controls") {
      if (dy < 0) {
        setZone("nav");
        setColumn(options.navIndex("library"));
      } else if (dy > 0) {
        setZone("content");
        setColumn(options.content.remembered());
      } else
        setColumn((i) =>
          Math.max(0, Math.min(options.libraryControls() - 1, i + dx)),
        );
      return;
    }
    if (zone() === "filters") {
      if (dy < 0) {
        setZone("nav");
        setColumn(options.navIndex(screen()));
      } else if (dy > 0) {
        setZone("content");
        setColumn(options.content.remembered());
      } else
        setColumn((i) =>
          Math.max(
            0,
            Math.min(options.catalogFilters() ? 1 : 0, i + dx),
          ),
        );
      return;
    }
    const count = options.content.count();
    const columns = options.content.columns();
    if (dy < 0 && column() < columns) {
      if (screen() === "search") options.search.remember(column());
      const targetZone =
        screen() === "detail"
          ? "hero"
          : screen() === "movie" || screen() === "series" || screen() === "anime"
            ? "filters"
            : screen() === "library" && options.libraryControls()
              ? "library-controls"
              : screen() === "search" && options.search.needsRetry()
                ? "search-retry"
                : "nav";
      setZone(targetZone);
      setColumn(targetZone === "nav" ? options.navIndex(screen()) : 0);
      return;
    }
    if (screen() === "search" && dx < 0 && column() % 5 === 0) {
      options.search.remember(column());
      setZone("keyboard");
      return;
    }
    options.paging.move(
      column() + dx + dy * columns,
      count,
      options.content.cursor(),
    );
    if (screen() === "live") options.loadGuide(column());
    if (column() >= count - columns * 2) options.paging.more();
  };
}
