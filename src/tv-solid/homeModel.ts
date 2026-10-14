import type { Catalog, MediaItem, TvApi } from "../api";
import { EngineTvApi } from '../api/engine-client';
import {
  artworkUrl,
  cardPresentation,
  presentation,
} from "../core/presentations";
import { continueMeta } from "../components/cards/cardText";

export interface HomeCardView {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  progress: number;
  item?: MediaItem;
}

export interface HomeShelfView {
  key: string;
  title: string;
  cards: HomeCardView[];
  catalog?: Catalog;
  kind: "queue" | "live" | "catalog" | "favorites";
  loaded: boolean;
  loading?: boolean;
  error?: string;
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
  ambientImage: string;
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
  ambientImage: "",
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

export function queueHomeCards(queue: readonly MediaItem[]): HomeCardView[] {
  return queue.map((candidate) => {
    const card = cardPresentation(candidate, "queue");
    return {
      id: candidate.id,
      title: card.title,
      subtitle: continueMeta(candidate, card),
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
      item: candidate,
    };
  });
}

/**
 * Home shelf card geometry. The My List shelf draws 160 × 240 posters
 * (TV-MYLIST-POSTER-001), 60 px taller than the 320 × 180 stills.
 */
export function homeShelfGeometry(kind: HomeShelfView["kind"]) {
  return kind === "favorites"
    ? { poster: true, width: 160, stride: 196, visible: 10, extra: 60 }
    : { poster: false, width: 320, stride: 356, visible: 6, extra: 0 };
}

/** Heading y of a Home shelf in the scrolling frame. */
export function homeRowTop(shelves: readonly HomeShelfView[], row: number) {
  let top = 700 + row * 364;
  for (let index = 0; index < row && index < shelves.length; index++)
    top += homeShelfGeometry(shelves[index].kind).extra;
  return top;
}

/** My List shelf: saved posters at 2:3; live channels keep their contained logo. */
export function posterHomeCards(items: readonly MediaItem[]): HomeCardView[] {
  return catalogHomeCards(items).map((card) => {
    if (card.item?.type === "live") return card;
    const poster = presentation(card.item!).posterImage ?? undefined;
    return { ...card, image: artworkUrl(poster, 160, 240) ?? poster ?? "" };
  });
}

export function catalogHomeCards(items: readonly MediaItem[]): HomeCardView[] {
  return items.map((candidate) => {
    const card = cardPresentation(candidate, "catalog");
    const subtitle = [candidate.year, candidate.type === "live" ? "Live TV" : candidate.type === "series" ? "Series" : "Movie"].filter(Boolean).join(" · ");
    return {
      id: candidate.id,
      title: card.title,
      subtitle,
      image: artworkUrl(card.image ?? undefined, 320, 180, false, card.imageRole === "logo") ?? card.image ?? "",
      progress: card.progress ?? 0,
      item: candidate,
    };
  });
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
    ambientImage: artworkUrl(hero.heroImage ?? undefined, 256, 144) ?? "",
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
  if (api instanceof EngineTvApi) {
    const value = await api.homeProjection(profileId, { signal });
    const view = projectHome(value.hero ?? value.featured[0], value.queue, undefined, value.favorites);
    if (!signal.aborted) onChange?.(view);
    return view;
  }
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
