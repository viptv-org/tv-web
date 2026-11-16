import { createSignal, type Accessor, type Setter } from "solid-js";
import type { RemoteTvApi } from "./api";
import { createSourcePresentation } from "./source-picker/presentation";
import { createSourceRows } from "./source-picker/rows";
import { createSourcePublisher } from "./source-picker/publisher";
import { createSourceActivation } from "./source-picker/activation";
import { createSourceStartPosition } from "./resume-position";
import type { SourceMenuOption } from "./source-picker/options";
import type { Card, Source, SourcePage, TitleAction } from "./types";
import type { Overlay } from "./app-types";

/** The source picker: the list, its filters, and the intent that chose it.
 *
 * Every value a traversal needs is here — the operation that owns the request,
 * the generation that retires it, the height filter, the facet and the menu — so
 * a late answer can be recognised instead of being shown over a newer query. The
 * picker is also where the engine is prewarmed: the moment the viewer is browsing
 * sources is the first moment they could plausibly press Play.
 */
export function createSourcePickerScene(options: {
  api: RemoteTvApi;
  overlays: {
    open: (value: Overlay) => void;
    hide: () => void;
    origin: () => { zone: string; column: number; row: number };
  };
  choice: Accessor<number>;
  setChoice: Setter<number>;
  screen: Accessor<string>;
  signal: () => AbortSignal;
  fail: (error: unknown) => void;
  notify: (message: string) => void;
  setLoading: Setter<boolean>;
  prewarm: () => void;
  sourceMemory: (card: Card) => Promise<unknown>;
  play: (source: Source, direct?: boolean) => Promise<boolean>;
  drawerOpen: () => boolean;
  opening: () => boolean;
}) {
  const [page, setPage] = createSignal<SourcePage>();
  const [ids, setIds] = createSignal<string[]>([]);
  const [facet, setFacet] = createSignal(0);
  const [filterFocus, setFilterFocus] = createSignal(false);
  const [provider, setProvider] = createSignal<string>();
  const [menu, setMenu] = createSignal<"quality" | "provider">();
  const [menuChoice, setMenuChoice] = createSignal(0);
  const [menuOptions, setMenuOptions] = createSignal<SourceMenuOption[]>([]);
  const [failure, setFailure] = createSignal("");
  const [actions, setActions] = createSignal(false);
  const [actionChoice, setActionChoice] = createSignal(0);
  const [failed, setFailed] = createSignal<Set<string>>(new Set());
  const [height, setHeight] = createSignal<number>();
  const [filtering, setFiltering] = createSignal(false);
  const [rows, setRows] = createSignal<Source[]>([]);
  const [loading, setSourceLoading] = createSignal(false);
  const [action, setAction] = createSignal<TitleAction>();
  const [pickerCard, setPickerCard] = createSignal<Card>();
  const [channel, setChannel] = createSignal<string>();
  const [replacing, setReplacing] = createSignal(false);
  const startPosition = createSourceStartPosition();
  let manual = false;
  let generation = 0;
  let operation: AbortController | undefined;

  const presentation = createSourcePresentation({
    sources: rows, page, provider: { current: provider, clear: () => { setProvider(undefined); } }, height,
    open: options.drawerOpen, opening: options.opening, loading,
    selection: { index: options.choice, select: (index: number) => { options.setChoice(index); } },
  });
  const sourceRows = createSourceRows({
    rows, adopt: setRows, visible: presentation.visible, focused: presentation.focused,
    manual: () => manual, selection: { current: options.choice, set: options.setChoice },
  });
  const publish = createSourcePublisher({
    api: options.api, owns: candidate => operation === candidate,
    generation: { next: () => ++generation, current: () => generation }, height,
    ids: setIds, page: setPage, filtering: setFiltering,
    reconcile: sourceRows.reconcile, focusBest: sourceRows.focusBest, fail: options.fail,
  });
  const activate = createSourceActivation({
    rows: { all: rows, visible: presentation.visible, set: setRows, ids, page: setPage },
    selection: { value: options.choice, set: options.setChoice },
    actions: { open: actions, set: setActions, choice: actionChoice },
    menu: { kind: menu, set: setMenu, choices: menuOptions, remember: setMenuOptions, choice: menuChoice, select: setMenuChoice },
    filters: {
      focused: filterFocus, facet,
      quality: { value: height, set: setHeight, choices: presentation.qualityOptions },
      provider: { value: provider, set: setProvider, choices: presentation.providerOptions },
    },
    loading,
    filtering: { value: filtering, set: setFiltering }, manual: () => { manual = true; },
    generation: { next: () => ++generation, current: () => generation },
    operation: () => operation, signal: () => operation?.signal ?? options.signal(),
    rank: (ids, height, signal, reuse) => options.api.rankSources(ids, height, signal, reuse),
    play: options.play,
  });
  /** Start a picker session: everything a new intent owns, reset in one place. */
  function beginSession(card: Card, nextChannel: string | undefined, replaceCurrent: boolean, intentOperation: AbortController) {
    operation = intentOperation;
    setPickerCard(card);
    setChannel(nextChannel);
    setReplacing(replaceCurrent);
    setAction(undefined);
    setRows([]);
    setIds([]);
    setPage(undefined);
    setFacet(0);
    setHeight(undefined);
    setFiltering(false);
    setProvider(undefined);
    setMenu(undefined);
    setActions(false);
    setFailure("");
    setFailed(new Set<string>());
    manual = false;
    generation++;
    setFilterFocus(false);
    setSourceLoading(true);
  }
  return {
    page, setPage, ids, setIds, facet, setFacet, filterFocus, setFilterFocus, provider, setProvider,
    menu, setMenu, menuChoice, setMenuChoice, menuOptions, setMenuOptions, failure, setFailure,
    actions, setActions, actionChoice, setActionChoice, failed, setFailed, height, setHeight,
    filtering, setFiltering, rows, setRows, loading, setSourceLoading, action, setAction,
    pickerCard, setPickerCard, channel, setChannel, replacing, setReplacing,
    startPosition, presentation, sourceRows, publish, activate, beginSession,
    manual: { get: () => manual, set: (value: boolean) => { manual = value; } },
    generation: { next: () => ++generation, current: () => generation },
    operation: { get: () => operation, set: (value: AbortController | undefined) => { operation = value; } },
    /** Opening the drawer prewarms the engine: browsing is the first moment the
     * viewer could plausibly press Play. */
    open() {
      options.prewarm();
      options.overlays.open({ kind: "sources", title: "Choose a source" });
    },
  };
}
