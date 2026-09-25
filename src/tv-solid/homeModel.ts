import type { MediaItem, TvApi } from "../api";
import {
  artworkUrl,
  cardPresentation,
  presentation,
} from "../core/presentations";
import { enrichDetail } from "../ui/detailProgress";
import { browseRequest, firstHomeCatalog } from "../ui/app/homeRows";

export interface HomeCardView {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  progress: number;
}

export interface HomeShelfView {
  key: string;
  title: string;
  items: readonly MediaItem[];
  cards: HomeCardView[];
}

export const emptyHomeCard: HomeCardView = {
  id: "",
  title: "",
  subtitle: "",
  image: "",
  progress: 0,
};

export interface HomeView {
  heroItem: MediaItem | null;
  queueItems: readonly MediaItem[];
  favoriteItems: readonly MediaItem[];
  heroImage: string;
  titleLogo: string;
  title: string;
  eyebrow: string;
  episodeLabel: string;
  progress: number;
  progressText: string;
  meta: string;
  synopsis: string;
  playLabel: string;
  saved: boolean;
  cards: HomeCardView[];
}

export const emptyHome: HomeView = {
  heroItem: null,
  queueItems: [],
  favoriteItems: [],
  heroImage: "",
  titleLogo: "",
  title: "",
  eyebrow: "",
  episodeLabel: "",
  progress: 0,
  progressText: "",
  meta: "",
  synopsis: "",
  playLabel: "Play",
  saved: false,
  cards: [],
};

export function homeShelfCards(items: readonly MediaItem[], context: "queue" | "catalog"): HomeCardView[] {
  return items.map((candidate) => {
    const card = cardPresentation(candidate, context);
    return {
      id: candidate.id,
      title: card.title,
      subtitle: card.subtitle,
      image:
        artworkUrl(
          card.image ?? undefined,
          320,
          180,
          false,
          card.imageRole === "logo",
        ) ??
        card.image ??
        "",
      progress: card.progress ?? 0,
    };
  });
}

export const queueHomeCards = (queue: readonly MediaItem[]) => homeShelfCards(queue, "queue");

export function initialHomeShelves(view: HomeView): HomeShelfView[] {
  return [
    ...(view.queueItems.length ? [{ key: "queue", title: "Continue watching", items: view.queueItems, cards: queueHomeCards(view.queueItems) }] : []),
    ...(view.favoriteItems.length ? [{ key: "favorites", title: "My List", items: view.favoriteItems, cards: homeShelfCards(view.favoriteItems, "catalog") }] : []),
  ];
}

/** Load the remaining Home shelves after the first usable queue frame. */
export async function loadHomeShelves(api: TvApi, view: HomeView, signal: AbortSignal): Promise<HomeShelfView[]> {
  const [live, catalogs] = await Promise.all([
    api.live({ view: "us", collection: "recent", limit: 20 }, { signal }).catch(() => ({ channels: [] as readonly MediaItem[] })),
    api.catalogs({ signal }).catch(() => []),
  ]);
  if (signal.aborted) return [];
  const browsable = catalogs.filter((catalog) => catalog.type !== "live" && !!browseRequest(catalog));
  const pages = await Promise.all(browsable.map(async (catalog) => {
    const request = browseRequest(catalog)!;
    const page = await api.discover(request, { signal }).catch(() => ({ items: [] as readonly MediaItem[] }));
    return { catalog, items: page.items };
  }));
  if (signal.aborted) return [];
  return [
    ...initialHomeShelves(view).filter((shelf) => shelf.key === "queue"),
    ...(live.channels.length ? [{ key: "recent-live", title: "Recently watched live TV", items: live.channels, cards: homeShelfCards(live.channels, "catalog") }] : []),
    ...pages.filter(({ items }) => items.length > 0).map(({ catalog, items }) => ({
      key: `catalog:${catalog.addonId ?? ""}:${catalog.id}`,
      title: catalog.addonName ? `${catalog.addonName} · ${catalog.name}` : catalog.name,
      items,
      cards: homeShelfCards(items, "catalog"),
    })),
    ...initialHomeShelves(view).filter((shelf) => shelf.key === "favorites"),
  ];
}

const clock = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/** Same hero priority and Rust presentation projections as the React TV Home. */
export function projectHome(
  heroItem: MediaItem | undefined,
  queue: readonly MediaItem[],
  details?: MediaItem,
  favorites: readonly MediaItem[] = [],
): HomeView {
  const item = details ?? heroItem;
  if (!heroItem || !item) return emptyHome;
  const hero = presentation(item);
  const hasProgress = heroItem.position && heroItem.position > 0;
  const eyebrow =
    heroItem.type === "live"
      ? "Live now"
      : hasProgress
        ? "Continue watching"
        : `Featured ${heroItem.type}`;
  const meta = [
    item.year,
    item.imdbRating && `IMDb ${item.imdbRating}`,
    ...item.genres.slice(0, 3),
  ]
    .filter(Boolean)
    .join(" · ");
  const cards = queueHomeCards(queue);
  return {
    heroItem,
    queueItems: queue,
    favoriteItems: favorites,
    heroImage:
      artworkUrl(hero.heroImage ?? undefined, 1280, 720, true) ??
      hero.heroImage ??
      "",
    titleLogo:
      artworkUrl(hero.titleLogo ?? undefined, 410, 118, false, true) ??
      hero.titleLogo ??
      "",
    title: item.name || hero.title,
    eyebrow: eyebrow.toUpperCase(),
    episodeLabel: hero.episodeLabel,
    progress: hero.progress,
    progressText:
      hasProgress && heroItem.duration
        ? `${clock(heroItem.position!)} of ${Math.round(heroItem.duration / 60)} min`
        : "",
    meta,
    synopsis: item.description ?? "",
    playLabel: hero.primaryActionLabel,
    saved: favorites.some(
      (favorite) =>
        favorite.id === heroItem.id && favorite.type === heroItem.type,
    ),
    cards,
  };
}

export async function loadHomeView(
  api: TvApi,
  profileId: string,
  signal: AbortSignal,
): Promise<HomeView> {
  const home = await api.home(profileId, { signal });
  // Continue Watching already determines both hero and first shelf. Do not
  // hold the first interactive Home frame on unrelated catalog/live requests.
  if (home.continueWatching[0])
    return projectHome(
      home.continueWatching[0],
      home.continueWatching,
      undefined,
      home.myList,
    );
  const live = await api
    .live({ view: "us", collection: "recent", limit: 20 }, { signal })
    .catch(() => ({ channels: [] as readonly MediaItem[] }));
  if (live.channels[0])
    return projectHome(
      live.channels[0],
      home.continueWatching,
      undefined,
      home.myList,
    );
  const catalogs = await api.catalogs({ signal }).catch(() => []);
  const first = firstHomeCatalog(catalogs);
  const request = first && browseRequest(first);
  const page = request
    ? await api
        .discover(request, { signal })
        .catch(() => ({ items: [] as readonly MediaItem[] }))
    : undefined;
  return projectHome(
    page?.items[0] ?? home.myList[0],
    home.continueWatching,
    undefined,
    home.myList,
  );
}

export async function enrichHomeHero(
  api: TvApi,
  view: HomeView,
  signal: AbortSignal,
): Promise<HomeView> {
  const item = view.heroItem;
  if (!item || item.type === "live") return view;
  const detail = await api.detail(
    { id: item.seriesId ?? item.id, type: item.type },
    { signal },
  );
  return {
    ...projectHome(item, [], enrichDetail(item, detail.item)),
    queueItems: view.queueItems,
    favoriteItems: view.favoriteItems,
    cards: view.cards,
    saved: view.saved,
  };
}
