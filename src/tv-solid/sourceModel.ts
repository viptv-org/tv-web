import type { MediaItem, MediaSource } from "../api";
import { sourceDescription, sourceProviderKey, type SourceProducer } from "../screens/sourceProducers";
import {
  episodeCode,
  matchesFilters,
  providerOf,
  qualityChoices,
  qualityLabel,
  qualityOf,
} from "../screens/titleSources";

export interface SourceChipView {
  quality: string;
  label: string;
  count: number;
  selected: boolean;
}

export interface SourceRowView {
  source: MediaSource | null;
  id: string;
  provider: string;
  quality: string;
  file: string;
  best: boolean;
}

export interface SourcesView {
  item: MediaItem | null;
  sources: readonly MediaSource[];
  quality: string;
  provider: string;
  busy: boolean;
  done: boolean;
  status: string;
  chips: SourceChipView[];
  rows: SourceRowView[];
}

export const emptySourceRow: SourceRowView = {
  source: null,
  id: "",
  provider: "",
  quality: "",
  file: "",
  best: false,
};

export const emptySources: SourcesView = {
  item: null,
  sources: [],
  quality: "All",
  provider: "All",
  busy: false,
  done: false,
  status: "",
  chips: [],
  rows: [],
};

/** A fixed set of native focus nodes can reach every observed producer. */
export function providerChoiceWindow<T>(choices: readonly T[], start: number, index: number, size = 6) {
  let first = Math.min(start, Math.max(0, choices.length - size));
  if (index < first) first = index;
  if (index >= first + size) first = index - size + 1;
  return { start: first, visible: choices.slice(first, first + size) };
}

/** React TV source copy/filter order, projected from the same normalized DTOs. */
export function projectSources(
  item: MediaItem,
  sources: readonly MediaSource[],
  busy: boolean,
  done: boolean,
  quality = "All",
  provider = "All",
  producers: readonly SourceProducer[] = [],
): SourcesView {
  const qualities = qualityChoices(sources);
  const chips = [
    {
      quality: "All",
      label: "All",
      count: sources.length,
      selected: quality === "All",
    },
    ...qualities.map((choice) => ({
      quality: choice.quality,
      label: qualityLabel(choice.quality),
      count: choice.count,
      selected: quality === choice.quality,
    })),
  ];
  const context = [item.name, episodeCode(item)].filter(Boolean).join(" · ");
  const state = busy
    ? sources.length ? "Still checking sources" : "Finding sources"
    : item.position
      ? `Resume at ${Math.floor(item.position / 60)}:${String(Math.floor(item.position % 60)).padStart(2, "0")}`
      : `${sources.length} found`;
  const status = [context, state].filter(Boolean).join(" · ");
  return {
    item,
    sources,
    quality,
    provider,
    busy,
    done,
    status,
    chips,
    rows: sources
      .filter((source) => matchesFilters(source, quality, provider))
      .map((source) => ({
        source,
        id: source.id,
        provider: producers.find((producer) => producer.key === sourceProviderKey(source))?.label ?? providerOf(source),
        quality:
          qualityOf(source) === "Unknown" ? "—" : (source.quality ?? "—"),
        file: sourceDescription(source),
        best: source === sources[0],
      })),
  };
}
