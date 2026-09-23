import type { Catalog, JsonObject, JsonValue, MediaItem } from "../api";
import { catalogFilters, discoverTypeGroup } from "./catalogFilters";

export type CastMember = { name: string; character?: string; photo?: string };
export type GenreTarget = { catalog: Catalog; values: Record<string, string> };

const record = (value: JsonValue | undefined): JsonObject | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : undefined;
const text = (value: JsonValue | undefined) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

/**
 * The title's cast, best source first: TMDB-backed addons (AIOMetadata)
 * send `app_extras.cast` with face photos and characters, older metadata
 * `credits_cast` with TMDB profile paths, and Cinemeta names only.
 */
export function castMembers(item: MediaItem, limit = 24): CastMember[] {
  const extras = record(item.raw.app_extras);
  const rich = Array.isArray(extras?.cast) ? extras.cast : Array.isArray(item.raw.credits_cast) ? item.raw.credits_cast : undefined;
  if (rich?.length) {
    return rich
      .map(record)
      .flatMap((entry): CastMember[] => {
        const name = text(entry?.name);
        if (!name) return [];
        const profile = text(entry?.profile_path);
        return [{
          name,
          character: text(entry?.character),
          photo: text(entry?.photo) ?? (profile ? `https://image.tmdb.org/t/p/w185${profile}` : undefined),
        }];
      })
      .slice(0, limit);
  }
  const names = Array.isArray(item.raw.cast) ? item.raw.cast : [];
  return names.flatMap((name) => (text(name) ? [{ name: text(name)! }] : [])).slice(0, limit);
}

/** Directors as a display string; addons send a string, a list, or `app_extras.directors`. */
export function directorNames(item: MediaItem): string {
  const extras = record(item.raw.app_extras);
  const source = Array.isArray(extras?.directors) && extras.directors.length ? extras.directors : item.raw.director;
  const list = Array.isArray(source) ? source : [source];
  return list
    .map((entry) => text(entry) ?? text(record(entry)?.name))
    .filter((name): name is string => !!name)
    .join(", ");
}

/** The genre value a catalog accepts: its declared option spelling, or the text for a free-form extra. */
function acceptedGenre(catalog: Catalog, genre: string): string | undefined {
  const filter = catalogFilters(catalog).find((candidate) => candidate.name === "genre");
  if (!filter) return undefined;
  if (!filter.options.length) return genre;
  return filter.options.find((option) => option.toLowerCase() === genre.toLowerCase());
}

/**
 * The catalog the metadata's own Stremio genre link names:
 * `stremio:///discover/<manifest URL>/<type>/<catalog id>?genre=<value>`.
 * Catalog ids repeat across addons ("top"), so a tie goes to the addon whose
 * name appears in the manifest host.
 */
function linkedGenre(item: MediaItem, genre: string, catalogs: readonly Catalog[]): GenreTarget | undefined {
  const links = Array.isArray(item.raw.links) ? item.raw.links : [];
  for (const link of links.map(record)) {
    if (text(link?.category) !== "Genres" || text(link?.name)?.toLowerCase() !== genre.toLowerCase()) continue;
    const match = /^stremio:\/\/\/discover\/([^/]+)\/([^/]+)\/([^?]+)\?(.*)$/.exec(text(link?.url) ?? "");
    if (!match) continue;
    const [manifest, type, id] = match.slice(1, 4).map((part) => decodeURIComponent(part));
    const value = new URLSearchParams(match[4]).get("genre") ?? genre;
    const candidates = catalogs.filter((catalog) => catalog.type === type && catalog.id === id);
    let host = "";
    try { host = new URL(manifest).hostname.toLowerCase(); } catch { /* A malformed link still matches by id. */ }
    const catalog =
      candidates.find((candidate) => !!candidate.addonName && host.includes(candidate.addonName.toLowerCase().replace(/\s+/g, ""))) ??
      candidates[0];
    if (catalog) return { catalog, values: { genre: acceptedGenre(catalog, value) ?? value } };
  }
  return undefined;
}

/**
 * Where a genre on the detail page browses to: the catalog the title was
 * opened from when it filters by that genre, else the catalog the metadata
 * links for it, else any catalog of the same content type offering it.
 * Undefined when no catalog can list the genre.
 */
export function genreTarget(
  item: MediaItem,
  genre: string,
  catalogs: readonly Catalog[],
  origin?: Catalog,
): GenreTarget | undefined {
  const fromOrigin = origin && acceptedGenre(origin, genre);
  if (origin && fromOrigin) return { catalog: origin, values: { genre: fromOrigin } };
  const linked = linkedGenre(item, genre, catalogs);
  if (linked) return linked;
  const group = discoverTypeGroup(item.type === "episode" ? "series" : item.type);
  for (const catalog of catalogs) {
    if (catalog.type === "live" || discoverTypeGroup(catalog.type) !== group) continue;
    const value = acceptedGenre(catalog, genre);
    if (value) return { catalog, values: { genre: value } };
  }
  return undefined;
}
