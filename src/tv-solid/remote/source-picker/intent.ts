import type { Accessor, Setter } from "solid-js";
import type { RemoteTvApi } from "../api";
import type { Card, Source, SourcePage, TitleAction } from "../types";
import type { SourceReuseContext } from "../device-playback";
import { sourcePageReady, type PreparedEpisode } from "../episode-preparation";
import { startAutomaticSources } from "./automatic-start";

export function createSourceIntent(options: {
  api: Pick<RemoteTvApi, "titleAction" | "sources" | "preferredSourceDiscoverySupported">;
  begin: (card: Card, restart: boolean, channel: string | undefined, replacing: boolean, position: number | undefined) => {id: number; epoch: number; operation: AbortController};
  owner: {intent: Accessor<number>; epoch: Accessor<number>; operation: Accessor<AbortController | undefined>; replace: (operation: AbortController) => void; aborted: Accessor<boolean>};
  position: Accessor<number>; manual: Accessor<boolean>; playerScreen: Accessor<boolean>; memory: (card: Card) => Promise<SourceReuseContext>;
  presentation: {capture: () => void; hide: () => void; show: () => void};
  resolve: (action: TitleAction) => void; retry: (work: () => void) => void;
  page: Setter<SourcePage | undefined>; ids: Setter<string[]>; loading: Setter<boolean>; discovering: Setter<boolean>;
  failure: {current: Accessor<string>; set: Setter<string>}; rows: Accessor<Source[]>; reconcile: (rows: Source[]) => void;
  publish: (operation: AbortController, rows: Source[], page: SourcePage, ids: string[], height?: number) => void;
  play: (source: Source, direct?: boolean, manual?: boolean) => Promise<boolean>; notify: (message: string) => void; fail: (error: unknown) => void;
}) {
  const {api, page: setSourcePage, ids: setAllSourceIds, loading: setLoading, discovering: setSourceLoading, rows: sources,
    reconcile: reconcileSources, publish: publishSources, play: playSource, notify, fail} = options;
  const {current: sourceFailure, set: setSourceFailure} = options.failure;
  async function playIntent(
    card: Card,
    forcePicker = false,
    restart = false,
    channel?: string,
    replaceCurrent = false,
    position?: number,
    automaticNext = false,
    prepared?: PreparedEpisode,
  ) {
    const {id: intent, epoch, operation} = options.begin(card, restart, channel, replaceCurrent, position);
    let ownedOperation = operation;
    const initialMemory = channel || forcePicker ? {} : await options.memory(card);
    const remembered = !!(initialMemory.title || initialMemory.across);
    if (intent !== options.owner.intent() || operation.signal.aborted || epoch !== options.owner.epoch()) return;
    const hidden = !forcePicker && (automaticNext || remembered);
    if (hidden && !options.playerScreen()) options.presentation.capture();
    if (hidden) { options.presentation.hide();setLoading(true); }
    else options.presentation.show();
    options.retry(() =>
      void playIntent(
        card,
        forcePicker,
        restart,
        channel,
        replaceCurrent,
        options.position(),
      ));
    try {
      let resolved = prepared?.action ?? (channel
        ? undefined
        : await options.api.titleAction(card, restart, operation.signal));
      if (intent !== options.owner.intent() || epoch !== options.owner.epoch() || operation.signal.aborted) return;
      if (resolved) {
        options.resolve(resolved);
      }
      let finalPage = prepared?.page;
      const memory = channel || forcePicker ? {} : await options.memory(resolved?.card ?? card);
      let preferredWaitElapsed = false;
      let firstMatch!: (rows: Source[]) => void;
      const matchTimer = !options.api.preferredSourceDiscoverySupported && !forcePicker && (memory.title || memory.across) ? setTimeout(() => {
        preferredWaitElapsed = true;
        if (finalPage && sourcePageReady(finalPage, true, false)) firstMatch(finalPage.streams);
      }, 3000) : undefined;
      const firstReady = new Promise<Source[]>(resolve => { firstMatch = resolve; });
      const discovery = prepared ? Promise.resolve(prepared.page.streams) : options.api.sources(
        resolved?.card ?? card,
        (value, page, ids, height) => {
          if (options.owner.operation() !== operation || operation.signal.aborted) return;
          finalPage = page;
          const memoryMatch = !!(memory.title || memory.across);
          if (!forcePicker && (memoryMatch || automaticNext || resolved?.source_selection === "best") && sourcePageReady(page, memoryMatch, !preferredWaitElapsed)) firstMatch(value);
          if (page.action) {
            resolved = page.action;
            options.resolve(page.action);
          }
          publishSources(operation, value, page, ids, height);
        },
        operation.signal,
        channel,
        () => undefined,
        memory,
      );
      const ranked = await Promise.race([discovery, firstReady]).finally(() => clearTimeout(matchTimer));
      if (intent !== options.owner.intent() || epoch !== options.owner.epoch() || operation.signal.aborted) return;
      setLoading(false);
      if (finalPage) { setSourcePage(finalPage);reconcileSources(ranked); }
      const hasMemory = !!(memory.title || memory.across);
      const automatic = !forcePicker && !options.manual() && (automaticNext || hasMemory || resolved?.source_selection === "best");
      if (automatic && finalPage && resolved) {
        const result = await startAutomaticSources({api, page: finalPage, rows: ranked, action: () => resolved!, memory, hasMemory,
          active: () => intent === options.owner.intent() && epoch === options.owner.epoch() && !options.owner.aborted(),
          intent: () => intent === options.owner.intent() && epoch === options.owner.epoch(), owns: operation => options.owner.operation() === operation,
          fallback: operation => {options.owner.replace(operation);ownedOperation = operation;setSourceLoading(true);setLoading(true);},
          publish: (value, page, ids) => {setSourcePage(page);setAllSourceIds(ids);reconcileSources(value);}, ready: () => {setLoading(false);},
          play: source => playSource(source, false, false), notify});
        if (result === "cancelled") return;
        if (result === "started") {setSourceLoading(false);return;}

      }

      setSourceLoading(false);
      if (intent === options.owner.intent() && !options.owner.aborted() && (hidden || automatic)) {
        if (!sourceFailure()) setSourceFailure("No matching source could start. Choose a source.");
        setLoading(false);options.presentation.show();
      }
    } catch (e) {
      if (options.owner.operation() !== ownedOperation) return;
      setSourceLoading(false);setLoading(false);
      if (hidden && intent === options.owner.intent() && !ownedOperation.signal.aborted) options.presentation.show();
      if (sources().length && !(e instanceof DOMException))
        notify(
          "Some sources did not respond. You can choose an available source.",
        );
      else fail(e);
    }
  }
  return playIntent;
}
