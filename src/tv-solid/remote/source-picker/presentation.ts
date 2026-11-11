import { createEffect, createMemo, type Accessor } from "solid-js";
import { sourceProvider as providerLabel } from "../source-presentation";
import { pickSourceSpread } from "../sourceStatus";
import type { Source, SourcePage } from "../types";
import type { SourceMenuOption } from "./options";

export function createSourcePresentation(options: {
  sources: Accessor<Source[]>; page: Accessor<SourcePage | undefined>;
  provider: {current: Accessor<string | undefined>; clear: () => void};
  height: Accessor<number | undefined>; open: Accessor<boolean>; opening: Accessor<boolean>; loading: Accessor<boolean>;
  selection: {index: Accessor<number>; select: (index: number) => void};
}) {
  const sourceProviders = createMemo(() => {
    const counts = new Map<string, number>();
    for (const source of options.sources()) {
      const label = providerLabel(source);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts].sort(([left], [right]) => left.localeCompare(right));
  });
  const visibleSources = createMemo(() => {
    const filter = options.provider.current();
    return filter
      ? options.sources().filter((source) => providerLabel(source) === filter)
      : options.sources();
  });
  createEffect(() => {
    const filter = options.provider.current();
    if (filter && !options.sources().some((source) => providerLabel(source) === filter))
      options.provider.clear();
    if (options.open() && options.selection.index() >= visibleSources().length)
      options.selection.select(Math.max(0, visibleSources().length - 1));
  });
  const qualityMenuOptions = createMemo<SourceMenuOption[]>(() => [
    {
      id: "quality-all",
      label: "All",
      count: options.page()?.total ?? options.sources().length,
      height: undefined,
    },
    ...(options.page()?.quality_filters ?? []).map((filter) => ({
      id: `quality-${filter.height}`,
      label: filter.label,
      count: filter.count,
      height: filter.height,
    })),
  ]);
  const providerMenuOptions = createMemo<SourceMenuOption[]>(() => [
    {
      id: "provider-all",
      label: "All sources",
      count: options.sources().length,
      provider: undefined,
    },
    ...sourceProviders().map(([label, count]) => ({
      id: `provider-${label}`,
      label,
      count,
      provider: label,
    })),
  ]);
  const sourceQualityValue = () => {
    const height = options.height();
    if (height === undefined) return "All";
    return (
      options.page()?.quality_filters.find(
        (filter) => filter.height === height,
      )?.label ?? `${height}p`
    );
  };
  const sourceProviderValue = () =>
    options.provider.current() ?? "All sources";
  const focusedSource = () => visibleSources()[options.selection.index()];
  const sourceAddonCount = () =>
    new Set(
      options.sources()
        .map(
          (source) =>
            source.source_addon_id ??
            source.view?.addon_label ??
            source.source_name ??
            "",
        )
        .filter(Boolean),
    ).size;
  // The picker's own facts decide its copy (SRC-DRAWER-001): discovery is the
  // first source request, opening is real playback preparation.
  const sourceSpread = () =>
    pickSourceSpread({
      open: options.open(),
      opening: !!options.opening(),
      discovering: options.loading(),
      rows: options.sources().length,
    });
  return {providers: sourceProviders, visible: visibleSources, qualityOptions: qualityMenuOptions, providerOptions: providerMenuOptions,
    quality: sourceQualityValue, provider: sourceProviderValue, focused: focusedSource, addonCount: sourceAddonCount, spread: sourceSpread};
}
