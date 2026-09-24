import type { MediaItem, TvApi } from "../api";
import { artworkUrl, presentation } from "../core/presentations";
import { enrichDetail, initialEpisode, mergeEpisodeProgress } from "../ui/detailProgress";
import { formatRuntime } from "../screens/titleSources";

export interface DetailEpisodeView {
  item: MediaItem | null;
  image: string;
  number: string;
  title: string;
  synopsis: string;
  watching: boolean;
  progress: number;
}

export const emptyDetailEpisode: DetailEpisodeView = {
  item: null, image: "", number: "", title: "",
  synopsis: "", watching: false, progress: 0,
};

export interface DetailView {
  item: MediaItem | null;
  target: MediaItem | null;
  title: string;
  titleLogo: string;
  heroImage: string;
  facts: string;
  synopsis: string;
  playLabel: string;
  sourceLabel: string;
  saved: boolean;
  season: number;
  episodeCount: number;
  episodes: DetailEpisodeView[];
}

export const emptyDetail: DetailView = {
  item: null, target: null, title: "", titleLogo: "", heroImage: "",
  facts: "", synopsis: "", playLabel: "Play", sourceLabel: "Choose source",
  saved: false, season: 1, episodeCount: 0, episodes: [],
};

/** Preserve the React title page's enriched episode and initial-target rules. */
export async function loadDetailView(
  api: TvApi,
  original: MediaItem,
  profileId: string,
  favorites: readonly MediaItem[],
  signal: AbortSignal,
): Promise<DetailView> {
  const value = await api.detail(original, { signal });
  let episodes = value.episodes;
  if (value.item.type === "series") {
    const seriesId = value.item.seriesId ?? value.item.id;
    const history = await api.seriesProgress(profileId, seriesId, { signal }).catch(() => []);
    episodes = mergeEpisodeProgress(episodes, history, seriesId);
  }
  const selected = enrichDetail(original, value.item);
  const first = initialEpisode(episodes, original);
  const season = first?.season ?? episodes[0]?.season ?? 1;
  const shown = episodes.filter(episode => episode.season === season);
  const target = first ?? (selected.type === "series" && selected.episode === undefined ? null : selected);
  const resume = !!target?.position && !target.watched;
  const playLabel = target?.season !== undefined && target.episode !== undefined
    ? `${resume ? "Resume" : "Play"} S${target.season} E${target.episode}`
    : resume ? "Resume" : "Play";
  const present = presentation(selected);
  const art = present.heroImage ?? selected.background ?? selected.poster;
  const facts = [
    episodes.length ? "Series" : selected.type === "movie" ? "Movie" : "",
    selected.year ? String(selected.year) : "",
    selected.imdbRating ? `IMDb ${selected.imdbRating}` : "",
    formatRuntime(selected.runtime),
    ...selected.genres,
  ].filter(Boolean).join(" · ");
  return {
    item: selected,
    target,
    title: selected.name,
    titleLogo: present.titleLogo ?? "",
    heroImage: artworkUrl(art ?? undefined, 1280, 720, true) ?? art ?? "",
    facts,
    synopsis: selected.description ?? "",
    playLabel,
    sourceLabel: "Choose source",
    saved: favorites.some(favorite => favorite.id === selected.id && favorite.type === selected.type),
    season,
    episodeCount: shown.length,
    episodes: shown.map((episode, index) => {
      const still = presentation(episode).episodeImage ?? episode.background ?? episode.poster;
      return {
        item: episode,
        image: artworkUrl(still ?? undefined, 544, 300) ?? still ?? "",
        number: `EPISODE ${episode.episode ?? index + 1}`,
        title: episode.episodeTitle ?? episode.name,
        synopsis: episode.description ?? "",
        watching: !episode.watched && !!episode.position,
        progress: episode.watched ? 1 : episode.position && episode.duration ? episode.position / episode.duration : 0,
      };
    }),
  };
}
