/**
 * Artwork shape of the responsive shell's media cards, per surface. Every
 * surface renders both shapes; flip a value here to change a surface back.
 * The TV canvas keeps its fixed landscape cards whatever is set here, and
 * live channels always keep their landscape logo cards.
 */
export type CardShape = "poster" | "landscape";

export const CARD_SHAPES: {
  readonly continueWatching: CardShape;
  readonly recentLive: CardShape;
  readonly myList: CardShape;
  /** Home catalog shelves cycle through this pattern, top to bottom. */
  readonly homeCatalogs: readonly CardShape[];
  readonly discover: { readonly phone: CardShape; readonly desktop: CardShape };
  readonly search: { readonly phone: CardShape; readonly desktop: CardShape };
} = {
  continueWatching: "landscape",
  recentLive: "landscape",
  myList: "landscape",
  homeCatalogs: ["poster", "poster", "landscape"],
  discover: { phone: "poster", desktop: "poster" },
  search: { phone: "poster", desktop: "poster" },
};

/** Shape of the `index`th catalog shelf on Home. */
export const homeCatalogShape = (index: number): CardShape =>
  CARD_SHAPES.homeCatalogs[index % CARD_SHAPES.homeCatalogs.length] ?? "landscape";
