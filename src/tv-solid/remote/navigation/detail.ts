import type { Accessor } from "solid-js";
import type { NavigationFocus, PagingNavigation } from "./focus";

export function createDetailNavigation(options: {
  focus: NavigationFocus;
  season: { index: Accessor<number>; count: Accessor<number> };
  episodes: { enabled: Accessor<boolean>; count: Accessor<number>; cursor: Accessor<string | null | undefined> };
  recommendations: Accessor<number>;
  remembered: (region: "episodes" | "recommendations") => number;
  paging: PagingNavigation;
}) {
  const { focus, season, episodes, paging } = options;
  return (dx: number, dy: number): boolean => {
    if (focus.zone() === "seasons") {
      focus.setColumn(season.index());
      if (dy < 0) { focus.setZone("hero"); focus.setColumn(0); }
      if (dy > 0) { focus.setZone("episodes"); focus.setColumn(options.remembered("episodes")); }
      return true;
    }
    if (focus.zone() === "episodes") {
      if (dy < 0) { focus.setZone(season.count() ? "seasons" : "hero"); focus.setColumn(season.index()); return true; }
      if (dy > 0 && episodes.enabled() && options.recommendations()) {
        focus.setZone("recommendations"); focus.setColumn(options.remembered("recommendations")); return true;
      }
      const count = episodes.enabled() ? episodes.count() : options.recommendations();
      paging.move(focus.column() + dx, count, episodes.enabled() ? episodes.cursor() : undefined);
      if (focus.column() >= count - 4) paging.more();
      return true;
    }
    if (focus.zone() === "recommendations") {
      if (dy < 0) { focus.setZone("episodes"); focus.setColumn(options.remembered("episodes")); return true; }
      focus.setColumn(index => Math.max(0, Math.min(options.recommendations() - 1, index + dx)));
      return true;
    }
    return false;
  };
}
