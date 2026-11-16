import type { Card, Catalog, Home } from "./types";

/** Simkl is temporarily off: its search endpoint rejects this account's
 * requests. Configured Stremio providers supply catalogs and media search until
 * the Simkl integration is re-authorized. User-owned Continue/My List rows stay
 * visible because their metadata is already in the bootstrap. */
export const STREMIO_ONLY = true;

const isSimklCard = (card?: Card | null) =>
  !!card && (card.provider_id === "simkl" || card.metadata_origin?.provider_id === "simkl");

/** Drop Simkl's rows and artwork while its integration is off, and keep the
 * featured carousel from going empty when only Simkl supplied featured cards. */
export function stremioHome(value: Home | undefined): Home | undefined {
  if (!STREMIO_ONLY || !value) return value;
  const rows = value.rows.filter(row => !String(row.id ?? "").startsWith("simkl:"));
  const streamCards = rows.flatMap(row => row.cards).filter(card => !isSimklCard(card));
  const featured = value.featured.filter(card => !isSimklCard(card));
  const carousel = featured.length ? featured : streamCards.slice(0, 5);
  return {
    ...value,
    rows,
    featured: carousel,
    hero: isSimklCard(value.hero) ? (carousel[0] ?? streamCards[0] ?? null) : value.hero,
  };
}

/** Simkl-only catalogs are hidden while the integration is off. */
export function stremioCatalogs(catalogs: readonly Catalog[]): readonly Catalog[] {
  return STREMIO_ONLY ? catalogs.filter(catalog => catalog.addon_id != null) : catalogs;
}
