import type { MediaItem, TvApi } from "../api";
import {
  artworkUrl,
  cardPresentation,
  presentation,
} from "../core/presentations";
import { enrichDetail } from "../ui/detailProgress";
import { browseRequest } from "../ui/app/homeRows";

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

/** Each completed shelf is usable immediately; one slow addon cannot hold its peers. */
export async function loadHomeShelves(api: TvApi, signal: AbortSignal, onShelf: (shelf: HomeShelfView, order: number) => void): Promise<void> {
  const live = api.live({ view: "us", collection: "recent", limit: 20 }, { signal }).then(page => {
    if (!signal.aborted && page.channels.length) onShelf({ key: "recent-live", title: "Recently watched live TV", items: page.channels, cards: homeShelfCards(page.channels, "catalog") }, 0);
  }).catch(() => undefined);
  const catalogues = api.catalogs({ signal }).then(async catalogs => {
    const browsable = catalogs.filter(catalog => catalog.type !== "live" && !!browseRequest(catalog));
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(6, browsable.length) }, async () => {
      while (next < browsable.length && !signal.aborted) {
        const order = next++;
        const catalog = browsable[order];
        const page = await api.discover(browseRequest(catalog)!, { signal }).catch(() => undefined);
        if (!signal.aborted && page?.items.length) onShelf({
          key: `catalog:${catalog.addonId ?? ""}:${catalog.type}:${catalog.id}`,
          title: catalog.addonName ? `${catalog.addonName} · ${catalog.name}` : catalog.name,
          items: page.items,
          cards: homeShelfCards(page.items, "catalog"),
        }, order + 1);
      }
    }));
  }).catch(() => undefined);
  await Promise.all([live, catalogues]);
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
  if (!heroItem || !item) return { ...emptyHome, queueItems: queue, favoriteItems: favorites };
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
  onChange?: (view: HomeView) => void,
): Promise<HomeView> {
  let queue: readonly MediaItem[] = [];
  let favorites: readonly MediaItem[] = [];
  const view = () => projectHome(queue[0] ?? favorites[0], queue, undefined, favorites);
  const publish = () => { if (!signal.aborted) onChange?.(view()); };
  await Promise.all([
    api.queue(profileId, undefined, { signal, onPage: page => { queue = page.items; publish(); } }).then(page => { queue = page.items; publish(); }),
    api.favorites(profileId, { signal }).then(items => { favorites = items; publish(); }),
  ]);
  return view();
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
