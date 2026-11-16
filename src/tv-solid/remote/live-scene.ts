import { batch, createMemo, createSignal, onCleanup, onMount, type Accessor, type Setter } from "solid-js";
import type { RemoteTvApi, RemoteError } from "./api";
import { segment } from "./api";
import { createLiveGuideController } from "./live/guide-controller";
import { createLiveRefresh } from "./live/revision-refresh";
import {
  LIVE_EMPTY_COPY, liveFilteredChip, liveKeepsToday, liveNoSourceActions, liveRecoveryActions, liveViewerOf, pickLiveSpread,
  type LiveRecoveryAction,
} from "./liveEmpty";
import { guideWindowOf } from "./guideWindow";
import type { AccountIdentity } from "./api";
import type { Channel, Guide, LivePage, Program } from "./types";
import type { Screen } from "./app-types";

/** The Live page, from the first request to the guide window.
 *
 * One state machine draws four things: on-air now, the group chips, the guide,
 * and three empty forms (no source, no channels, failed). Which one appears is
 * decided only by the page's own facts — never by which control happens to have
 * focus — because a page that invents its state is a page the viewer cannot
 * reason about.
 */
export function createLiveScene(options: {
  api: RemoteTvApi;
  call: <T>(path: string, method?: string, body?: unknown, signal?: AbortSignal) => Promise<T>;
  /** The screen's abort controller, readable at call time. */
  scope: Accessor<AbortController>;
  screen: Accessor<Screen>;
  setScreen: Setter<Screen>;
  setRow: Setter<number>;
  zone: Accessor<string>;
  column: Accessor<number>;
  setZone: Setter<string>;
  setColumn: Setter<number>;
  loading: Accessor<boolean>;
  setLoading: Setter<boolean>;
  fail: (error: unknown) => void;
  notify: (message: string) => void;
  navIndex: (id: string) => number;
  settingsTabIndex: (label: string) => number;
  loadSettings: (tab: number, signal: AbortSignal) => Promise<void>;
  remember: () => void;
  history: Accessor<{ stale?: boolean }[]>;
  resetScope: () => AbortSignal;
  setPage: (page: { cards: never[]; complete: boolean }) => void;
  adoptChannelWindow: (pages: LivePage[], searching?: boolean) => void;
  restartPaging: () => AbortSignal;
  /** Whether the list has a page before the first one. */
  edgeRequest: (pages: LivePage[], direction: "previous" | "next") => unknown;
  /** Re-request the open list window (created by the channel pager). */
  refreshChannelPage: (searching: boolean, signal?: AbortSignal) => Promise<LivePage>;
}) {
  const [livePages, setLivePages] = createSignal<LivePage[]>([]);
  const [channels, setChannels] = createSignal<Channel[]>([]);
  const [liveSnapshot, setLiveSnapshot] = createSignal("");
  const [groups, setGroups] = createSignal<{ id: string; label: string }[]>([]);
  const [liveGroup, setLiveGroup] = createSignal<string>();
  const [programs, setPrograms] = createSignal<Record<string, Program[]>>({});
  const [liveFailure, setLiveFailure] = createSignal("");
  const [liveIdentity, setLiveIdentity] = createSignal<AccountIdentity>();
  const [guideInfo, setGuideInfo] = createSignal<Record<string, Guide["view"]>>({});
  const [programIndex, setProgramIndex] = createSignal(0);

  /** Which form the page draws. Only the page's own facts decide. */
  const spread = createMemo(() =>
    pickLiveSpread({
      channels: channels().length,
      page: livePages()[0],
      filtered: !!liveGroup(),
      pending: options.loading(),
      failure: liveFailure(),
    }));
  const viewer = createMemo(() => liveViewerOf(liveIdentity()));
  /** The block's focused action, while the block owns the page. */
  const emptyFocus = () => (options.zone() === "live-empty" ? options.column() : undefined);
  /**
   * The answered and failed blocks' recovery, in the contract's order: the
   * primary is first, so **Try again** leads whenever there is something to
   * re-request. **Source integrations** needs a proven owner: the server refuses
   * a source write from a member or a paired TV.
   */
  const recovery = createMemo<{ id: LiveRecoveryAction; label: string }[]>(() =>
    liveRecoveryActions({
      retry: spread() === "failed" || !!livePages()[0]?.reason,
      mayChangeSources: viewer() === "owner",
    }).map(id => ({
      id,
      label: id === "retry" ? LIVE_EMPTY_COPY.retry : LIVE_EMPTY_COPY.sourceIntegrations,
    })));
  const channelIndex = () => (options.zone() === "live-groups" ? 0 : options.column());
  const rowStart = () => (options.edgeRequest(livePages(), "previous") ? channelIndex() - 2 : Math.max(0, channelIndex() - 2));
  const currentProgram = createMemo(() => programs()[channels()[channelIndex()]?.id]?.[programIndex()]);
  /**
   * The grid's own window, shared by every row, the header and the Now marker:
   * the guides that answered decide it, never the focused row (whose own guide
   * may be pending or failed).
   */
  const guideWindow = createMemo(() => guideWindowOf(Object.values(guideInfo()), Date.now()));
  const guideStart = createMemo(() => {
    const base = guideWindow().start;
    const selected = currentProgram();
    return selected && (selected.start_millis < base || selected.start_millis >= base + 7200000)
      ? Math.floor(selected.start_millis / 1800000) * 1800000
      : base;
  });

  const guides = createLiveGuideController({
    scope: () => options.scope(), channels, channelIndex, rowStart, programs: { current: programs, set: setPrograms },
    info: { set: setGuideInfo }, selection: { current: currentProgram, set: setProgramIndex }, notify: options.notify,
    request: (id, signal) => options.call<Guide>(options.api.scoped(`/live/${segment(id)}/guide`), "GET", undefined, signal),
  });
  const { retire, loadVisible } = guides;
  function adoptSnapshot(id: string) {
    if (id !== liveSnapshot()) retire();
    setLiveSnapshot(id);
  }
  const refresh = createLiveRefresh({
    channels, index: channelIndex, read: signal => options.refreshChannelPage(false, signal), snapshot: adoptSnapshot,
    window: options.adoptChannelWindow, groups: setGroups, failure: setLiveFailure,
    focus: { zone: options.zone, column: options.column, setZone: options.setZone, setColumn: options.setColumn },
    clearGuides: () => { setPrograms({}); setGuideInfo({}); }, loadGuides: () => loadVisible(),
  });
  onMount(() => {
    const timer = setInterval(() => {
      if (options.screen() === "live" && !options.loading() && document.visibilityState === "visible")
        void loadVisible(true);
    }, 30_000);
    onCleanup(() => clearInterval(timer));
  });

  /**
   * Entering Live keeps the row focus a page with channels has today. An empty
   * or failed page focuses the navigation's own Live tab instead, so the first
   * Down enters the page on the primary (contract § Focus, input and timing).
   * A page that is empty only because of its filter keeps the chips, on the
   * chosen one, because it has no row to hold the focus (LIVE-EMPTY-11).
   */
  function focusSpread() {
    if (options.screen() !== "live") return;
    if (spread() === "filtered") {
      options.setZone("live-groups");
      options.setColumn(liveFilteredChip(groups(), liveGroup()));
      return;
    }
    if (liveKeepsToday(spread())) {
      options.setZone("content");
      options.setColumn(0);
      return;
    }
    options.setZone("nav");
    options.setColumn(options.navIndex("live"));
  }

  /**
   * LIVE-EMPTY-001: the Live page's first request. A failure with no page in
   * hand is the contract's failed form (**Could not load Live TV.** with its own
   * recovery), not the app's generic overlay, because nothing on the page has
   * proved a source is configured yet.
   */
  async function loadFirstPage(signal: AbortSignal): Promise<void> {
    options.setLoading(true);
    setLiveFailure("");
    // Bound the visible loading state so the page offers retry instead of
    // sitting on a permanent "Loading Live TV…" when discovery stalls.
    const request = new AbortController();
    const cancel = () => request.abort();
    signal.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(() => request.abort(), 12000);
    try {
      const result = await options.api.live("0", undefined, request.signal);
      adoptSnapshot(result.snapshot_id);
      options.adoptChannelWindow([result]);
      setGroups(result.groups);
      setLiveGroup(undefined);
      setPrograms({});
      void loadVisible();
    } catch (e) {
      if (signal.aborted) return;
      if (request.signal.aborted) {
        setLiveFailure("Live TV took too long. Try again.");
        return;
      }
      // A 401 retires the session; it is not this page's empty state.
      if (isUnauthorized(e)) {
        options.fail(e);
        return;
      }
      setLiveFailure(e instanceof Error ? e.message : "");
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      if (!signal.aborted) options.setLoading(false);
    }
    focusSpread();
  }

  /** **Try again**: the same query with the same filters, on the loading form. */
  function retry() {
    setLiveFailure("");
    void loadGroup(liveGroup()).catch(e => {
      if (e instanceof DOMException || (e instanceof Error && e.name === "AbortError")) return;
      if (isUnauthorized(e)) options.fail(e);
      else setLiveFailure(e instanceof Error ? e.message : "");
    });
  }

  /**
   * Settings on a named section, the existing destinations both empty states
   * route to. The remembered Live entry is marked stale so Back re-requests the
   * page and the primary takes focus again (LIVE-EMPTY-02).
   */
  async function openSettings(tab: number) {
    options.remember();
    const entries = options.history();
    const entry = entries[entries.length - 1];
    if (entry) entry.stale = true;
    const signal = options.resetScope();
    options.setLoading(true);
    options.setZone("settings-nav");
    options.setColumn(0);
    options.setRow(0);
    try {
      await options.loadSettings(tab, signal);
    } catch (e) {
      options.fail(e);
    }
    options.setScreen("settings");
    if (!signal.aborted) options.setLoading(false);
  }

  /** The focused action of whichever empty or failed block owns the page. */
  async function activateSpread() {
    if (spread() === "no-source") {
      const action = liveNoSourceActions(viewer())[options.column()];
      if (action === "setup") await openSettings(options.settingsTabIndex("Source integrations"));
      else if (action === "add-ons") await openSettings(options.settingsTabIndex("Add-ons"));
      return;
    }
    const action = recovery()[options.column()]?.id;
    if (action === "retry") retry();
    else if (action === "source-integrations") await openSettings(options.settingsTabIndex("Source integrations"));
  }

  async function loadGroup(group: string | undefined): Promise<void> {
    const signal = options.restartPaging();
    retire();
    setLiveGroup(group);
    options.setLoading(true);
    options.adoptChannelWindow([]);
    setPrograms({});
    setGuideInfo({});
    options.setPage({ cards: [], complete: true });
    try {
      const value = await options.api.live("0", group, signal);
      batch(() => {
        adoptSnapshot(value.snapshot_id);
        options.adoptChannelWindow([value]);
        setGroups(value.groups);
        setLiveFailure("");
        options.setColumn(0);
        options.setZone("content");
      });
      // Nothing to focus in the list: the page's own state holds the focus.
      if (!value.channels.length) focusSpread();
      void loadVisible();
    } finally {
      if (!signal.aborted) options.setLoading(false);
    }
  }

  return {
    pages: livePages, setPages: setLivePages, channels, setChannels, snapshot: liveSnapshot, groups, setGroups,
    group: liveGroup, setGroup: setLiveGroup, programs, setPrograms, failure: liveFailure, setFailure: setLiveFailure,
    identity: liveIdentity, setIdentity: setLiveIdentity, guideInfo, setGuideInfo, programIndex, setProgramIndex,
    spread, viewer, emptyFocus, recovery, channelIndex, rowStart, currentProgram, guideWindow, guideStart,
    guides, retireGuides: retire, loadVisibleGuides: loadVisible, adoptSnapshot, refresh, focusSpread,
    loadFirstPage, retryLive: retry, openLiveSettings: openSettings, activateLiveSpread: activateSpread, loadGroup,
  };
}

function isUnauthorized(error: unknown): error is RemoteError {
  return typeof error === "object" && error !== null && "status" in error && (error as { status?: number }).status === 401;
}

