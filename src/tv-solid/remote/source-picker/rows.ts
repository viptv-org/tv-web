import { batch, type Accessor, type Setter } from "solid-js";
import type { Source, SourcePage } from "../types";

export function createSourceRows(options: {
  rows: Accessor<Source[]>; adopt: Setter<Source[]>; visible: Accessor<Source[]>;
  focused: Accessor<Source | undefined>; manual: Accessor<boolean>;
  selection: {current: Accessor<number>; set: Setter<number>};
}) {
  const {rows: sources, adopt: setSources, visible: visibleSources, focused: focusedSource} = options;
  const {current: choice, set: setChoice} = options.selection;
  function reconcileSources(value: Source[]) {
    const focused = focusedSource()?.id;
    // Once the viewer interacts, late discovery must not move rows under
    // focus. Ranking still chooses automatic candidates from the server page.
    if (options.manual()) {
      const incoming = new Map(value.map(source => [source.id, source]));
      value = [
        ...sources().flatMap(source => {
          const next = incoming.get(source.id);
          incoming.delete(source.id);
          return next ? [next] : [];
        }),
        ...incoming.values(),
      ];
    }
    // Reuse the previous object reference for any source whose rendered data
    // is unchanged, so a discovery re-rank repositions rows without
    // re-rendering (flashing) the ones that did not actually change.
    const previous = new Map(sources().map((source) => [source.id, source]));
    const stable = value.map((source) => {
      const before = previous.get(source.id);
      if (!before) return source;
      const bv = before.view, sv = source.view;
      return before.source_addon_id === source.source_addon_id &&
        before.reuse_audio_language === source.reuse_audio_language &&
        before.presentation?.source_id === source.presentation?.source_id &&
        before.presentation?.provider_name === source.presentation?.provider_name &&
        JSON.stringify(before.audio_languages) === JSON.stringify(source.audio_languages) &&
        before.name === source.name &&
        before.title === source.title &&
        before.detail === source.detail &&
        before.quality_height === source.quality_height &&
        (before as Source & { best?: unknown }).best === (source as Source & { best?: unknown }).best &&
        bv?.title === sv?.title &&
        bv?.body === sv?.body &&
        bv?.quality_label === sv?.quality_label &&
        bv?.format_label === sv?.format_label &&
        bv?.addon_label === sv?.addon_label
        ? before
        : source;
    });
    batch(() => {
      setSources(stable);
      const visible = visibleSources();
      const index = visible.findIndex(source => source.id === focused);
      setChoice(index >= 0 ? index : Math.max(0, Math.min(choice(), visible.length - 1)));
    });
  }
  /** Until the viewer moves, the focused row follows the server's best match
   * as discovery grows instead of staying on whatever stream arrived first. */
  function focusBestMatch(page: SourcePage) {
    if (options.manual() || !page.best_match_id) return;
    const index = visibleSources().findIndex(
      (source) => source.id === page.best_match_id,
    );
    if (index >= 0) setChoice(index);
  }
  return {reconcile: reconcileSources, focusBest: focusBestMatch};
}
