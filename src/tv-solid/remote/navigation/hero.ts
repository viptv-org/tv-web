import { batch, type Accessor, type Setter } from "solid-js";
import type { Screen } from "../app-types";
import type { Row } from "../types";
import type { NavigationFocus } from "./focus";

export function createHeroNavigation(options: {
  focus: NavigationFocus;
  action: Setter<number>;
  row: Setter<number>;
  homeNavIndex: Accessor<number>;
  home: {rows: Accessor<Row[]>; resolve: (index: number) => number; remember: () => void};
  detail: {hasEpisodes: Accessor<boolean>; recommendations: Accessor<number>; seasons: Accessor<number>};
}) {
  const {setZone, setColumn} = options.focus;
  const {action: setHeroAction, row: setRow} = options;
  return (dx: number, dy: number, screen: Screen) => {
    const isHome = screen === "home";
    setHeroAction((i) =>
      Math.max(0, Math.min(isHome ? 2 : 1, i + dx)),
    );
    if (dy < 0 && screen !== "detail") {
      setZone("nav");
      setColumn(options.homeNavIndex());
    }
    if (dy > 0) {
      if (isHome) {
        const first =
          options.home.rows().findIndex(
            (shelf) => shelf.cards.length > 0 || shelf.state === "Failed",
          ) ?? -1;
        if (first < 0) return;
        batch(() => {
          setRow(first);
          setColumn(options.home.resolve(first));
          setZone("rows");
        });
        options.home.remember();
        return;
      } else {
        if (!options.detail.hasEpisodes() && !options.detail.recommendations())
          return;
        setZone(options.detail.seasons() ? "seasons" : "episodes");
        setRow(0);
      }
      setColumn(0);
    }
  };
}
