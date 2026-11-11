import type { Accessor, Setter } from "solid-js";
import type { RemoteTvApi } from "../api";
import type { Source, SourcePage } from "../types";

export function createSourcePublisher(options: {
  api: Pick<RemoteTvApi, "rankSources">;
  owns: (operation: AbortController) => boolean;
  generation: {next: () => number; current: Accessor<number>};
  height: Accessor<number | undefined>;
  ids: Setter<string[]>; page: Setter<SourcePage | undefined>; filtering: Setter<boolean>;
  reconcile: (rows: Source[]) => void; focusBest: (page: SourcePage) => void; fail: (error: unknown) => void;
}) {
  const {ids: setAllSourceIds, page: setSourcePage, filtering: setSourceFiltering, reconcile: reconcileSources, focusBest: focusBestMatch, fail} = options;
  return (operation: AbortController, value: Source[], page: SourcePage, ids: string[], height?: number) => {
    const ticket = options.generation.next();
    setAllSourceIds(ids);
    setSourcePage(page);
    if (height === options.height()) {
      reconcileSources(value);
      focusBestMatch(page);
      setSourceFiltering(false);
    } else {
      const wanted = options.height();
      setSourceFiltering(true);
      void options.api
        .rankSources(ids, wanted, operation.signal)
        .then((result) => {
          if (
            ticket === options.generation.current() &&
            options.owns(operation) &&
            !operation.signal.aborted
          ) {
            setSourcePage(result);
            reconcileSources(result.streams);
            focusBestMatch(result);
            setSourceFiltering(false);
          }
        })
        .catch((error) => {
          if (
            ticket === options.generation.current() &&
            options.owns(operation)
          ) {
            setSourceFiltering(false);
            fail(error);
          }
        });
    }
  };
}
