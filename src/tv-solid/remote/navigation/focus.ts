import type { Accessor, Setter } from "solid-js";

export interface NavigationFocus {
  zone: Accessor<string>;
  column: Accessor<number>;
  setZone: Setter<string>;
  setColumn: Setter<number>;
}
export interface IndexedFocus {
  index: Accessor<number>;
  set: Setter<number>;
  count: Accessor<number>;
}
export interface PagingNavigation {
  move: (index: number, count: number, cursor?: string | null) => void;
  more: () => void;
}
