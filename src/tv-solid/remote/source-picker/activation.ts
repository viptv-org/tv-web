import type { Accessor, Setter } from "solid-js";
import type { Source, SourcePage } from "../types";
import type { RemoteTvApi } from "../api";
import type { SourceMenuOption } from "./options";

interface SourceFacet<T> {value: Accessor<T | undefined>; set: Setter<T | undefined>; choices: Accessor<SourceMenuOption[]>}
export function createSourceActivation(options: {
  rows: {all: Accessor<Source[]>; visible: Accessor<Source[]>; set: Setter<Source[]>; ids: Accessor<string[]>; page: Setter<SourcePage | undefined>};
  selection: {value: Accessor<number>; set: Setter<number>};
  actions: {open: Accessor<boolean>; set: Setter<boolean>; choice: Accessor<number>};
  menu: {kind: Accessor<"quality" | "provider" | undefined>; set: Setter<"quality" | "provider" | undefined>;
    choices: Accessor<SourceMenuOption[]>; remember: Setter<SourceMenuOption[]>; choice: Accessor<number>; select: Setter<number>};
  filters: {focused: Accessor<boolean>; facet: Accessor<number>; quality: SourceFacet<number>; provider: SourceFacet<string>};
  loading: Accessor<boolean>; filtering: {value: Accessor<boolean>; set: Setter<boolean>};
  manual: () => void; generation: {next: () => number; current: Accessor<number>};
  operation: Accessor<AbortController | undefined>; signal: () => AbortSignal;
  rank: RemoteTvApi["rankSources"]; play: (source: Source, direct?: boolean) => Promise<boolean>;
}) {
  const {all: sources, visible: visibleSources, set: setSources, ids: allSourceIds, page: setSourcePage} = options.rows;
  const {value: choice, set: setChoice} = options.selection;
  const {open: sourceActions, set: setSourceActions, choice: sourceActionChoice} = options.actions;
  const {kind: sourceMenu, set: setSourceMenu, choices: sourceMenuOptions, remember: setOpenSourceMenuOptions, choice: sourceMenuChoice, select: setSourceMenuChoice} = options.menu;
  const {focused: sourceFilterFocus, facet: sourceFacet} = options.filters;
  const {value: sourceHeight, set: setSourceHeight, choices: qualityMenuOptions} = options.filters.quality;
  const {value: sourceProviderFilter, set: setSourceProviderFilter, choices: providerMenuOptions} = options.filters.provider;
  const {loading: sourceLoading, play: playSource} = options;
  const {value: sourceFiltering, set: setSourceFiltering} = options.filtering;
  return async () => {
    if (sourceActions()) {
      const action = sourceActionChoice(),
        source = visibleSources()[choice()];
      setSourceActions(false);
      if (!source) return;
      if (action === 0) await playSource(source, true);
      else if (action === 1) await playSource(source, false);
      return;
    }
    // The overlay opens the instant the user asks for sources; the ranked
    // list lands a beat later. A select that lands during that first load
    // waits for it rather than falling through to an empty list.
    if (!sourceFilterFocus() && !sources().length && (sourceLoading() || sourceFiltering())) {
      const operation = options.operation();
      const deadline = Date.now() + 10000;
      while (
        !sources().length &&
        (sourceLoading() || sourceFiltering()) &&
        options.operation() === operation &&
        Date.now() < deadline
      )
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
    if (sourceMenu()) {
      const kind = sourceMenu();
      const option = sourceMenuOptions()[sourceMenuChoice()];
      setSourceMenu(undefined);
      if (!option) return;
      if (kind === "quality") {
        const height = option.height;
        setSourceHeight(height);
        options.manual();
        setSourceFiltering(true);
        const ticket = options.generation.next(),
          signal = options.signal();
        try {
          const result = await options.rank(
            allSourceIds(),
            height,
            signal,
          );
          if (ticket === options.generation.current() && !signal.aborted) {
            setSourcePage(result);
            setSources(result.streams);
            setChoice(0);
          }
        } finally {
          if (ticket === options.generation.current())
            setSourceFiltering(false);
        }
      } else {
        setSourceProviderFilter(option.provider);
        options.manual();
        setChoice(0);
      }
      return;
    }
    if (sourceFilterFocus()) {
      const kind = sourceFacet() === 0 ? "quality" : "provider";
      const choices =
        kind === "quality" ? qualityMenuOptions() : providerMenuOptions();
      setOpenSourceMenuOptions(choices);
      setSourceMenu(kind);
      const selected =
        kind === "quality"
          ? choices.findIndex(
              (option) => option.height === sourceHeight(),
            )
          : choices.findIndex(
              (option) => option.provider === sourceProviderFilter(),
            );
      setSourceMenuChoice(Math.max(0, selected));
      return;
    }
    if (sourceFiltering()) return;
    const source = visibleSources()[choice()];
    if (source) await playSource(source);
  };
}
