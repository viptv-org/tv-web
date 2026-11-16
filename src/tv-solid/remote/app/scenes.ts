import type { Accessor } from "solid-js";
import { createEffect, createMemo, createSignal, onMount } from "solid-js";
import { runtimeObserver } from "../../platform/runtime-observation";
import { RemoteTvApi } from "../api";
import type { } from "../app-types";
import { cardKey, type Card, type LivePage, type Source } from "../types";
import { AutoplayCountdown } from "../autoplay-countdown";
import { createCalendarScene } from "../calendar-scene";
import { edgeRequest } from "../channelWindow";
import { deviceTitleKey } from "../device-playback";
import { episodeKey } from "../episode-preparation";
import { createHeroScene } from "../hero-scene";
import { createLibraryControls } from "../library/controls";
import { createListLifecycle } from "../list-lifecycle";
import { createChannelRefresh } from "../paging/channel-refresh";
import { createChannelMovement } from "../paging/channel-movement";
import { createChannelPager } from "../paging/channel-pages";
import { createCatalogPager } from "../paging/catalog";
import { createDetailPager } from "../paging/detail";
import { createHomePager } from "../paging/home";
import { createCatalogControls } from "../catalog-controls";
import { createPagingScene } from "../paging-scene";
import { createPlayerChrome } from "../player-chrome";
import { createPlaybackSegments } from "../player/segments";
import { createTrackPicker } from "../player/tracks";
import { createPlayerScene } from "../player-scene";
import { createSearchScene } from "../search-scene";
import { createSessionScene } from "../session-scene";
import { createDetailScene } from "../detail-scene";
import type { createOverlayController } from "../overlay-controller";
import type { PlayIntent } from "../source-picker/intent-types";
import { createShell } from "../shell";
import { createSourcePickerScene } from "../source-picker-scene";
import { createLiveScene } from "../live-scene";
import { createNavigationScene } from "../navigation-scene";
import { createSavedList } from "../saved-list";
import { presentationKey } from "../presentation-card";
import { skipLabel } from "../player/skip-intro";
import { STREMIO_ONLY } from "../stremio-home";
import type { AppModel } from "./model";
import type { TvState } from "../state";

/** The app's scenes: everything that owns a page's data or the player.
 *
 * Constructed once, in dependency order, from the network, the screen's own
 * signals (`tv`), the loaded model, the overlays and the shell. Cross-references
 * that point *forward* are lazy arrows — the same way the closure always worked —
 * so nothing here is read before the first frame.
 */
export function createAppScenes(options: {
  api: RemoteTvApi;
  platform: string;
  initialLoading: boolean | undefined;
  tv: TvState;
  model: AppModel;
  overlays: ReturnType<typeof createOverlayController>;
  screenSaver: Accessor<boolean>;
  /** The hold's cancel, wired by the input layer (which owns the hold). */
  cancelHold: () => void;
  /** The picker's answer: starting a chosen stream. */
  play: (source: Source, direct?: boolean, manual?: boolean) => Promise<boolean>;
  /** The revision that landed while a screen was open (the shell owns it). */
  applyRevision: (fresh: never, signal: AbortSignal, profile: string, commit: () => void) => Promise<void>;
  // Created later in the closure; every use is at runtime, never at setup.
  settingsTabIndex: (label: string) => number;
  loadSettings: (tab: number, signal: AbortSignal) => Promise<void>;
  hideControls: () => void;
  playIntent: PlayIntent;
  resetSettings: () => void;
  cancelPlay: () => void;
  exitApp: () => void;
  prompt: (title: string, submit: (value: string) => Promise<void>, initial?: string, secret?: boolean) => void;
  more: () => Promise<void>;
  adoptChannelWindow: (pages: LivePage[], searching?: boolean) => void;
}) {
  const {
    api, platform, tv, model, screenSaver, cancelHold, play, applyRevision, settingsTabIndex, loadSettings,
    hideControls, playIntent, resetSettings, prompt, more, adoptChannelWindow, cancelPlay, exitApp,
  } = options;
  const overlays = options.overlays;
  const overlay = overlays.current;
  const overlayClosing = overlays.closing;
  const openOverlay = overlays.open;
  const available = (value?: { availability: string }) => value?.availability === "Available";
  const isRokuUi = typeof (globalThis as any).__SolidTVRokuRenderer !== "undefined";
  const {
    loading, setLoading, error, setError, setPlaybackError, pending,
    screen, setScreen, zone, setZone, column, setColumn, row, setRow, setHeroAction, choice, setChoice,
    page, setPage, controls, setControls, catalog, setCatalog, filters, setFilters, selected, setSelected,
    setPairing, setPairingDeadline, setPairingFocused,
    signedIn, setSignedIn, setQr, setAccountEmail, setCanManageAccount,
    snapshot, setSnapshot, showControls, setShowControls, pauseRequested, setPauseRequested,
    seek, setSeek, seeking, setTrackColumn,
    activeAction, setActiveAction, activeChannel, setActiveChannel, activeSource, setActiveSource,
    openingSource, setCaptionOverride, saved, setSaved,
    episodeState, setEpisodeState, setCountdownState, advancing, setAdvancing,
    playbackRevision, setPlaybackRevision, deviceRevision,
    sourceMemoryPending, setSourceMemoryPending,
  } = tv;
  const {
    home, setHome, management, setManagement, setNavigation, library, setLibrary,
    preferences, setPreferences, navs, navIndex, canManageProfiles, searchCapabilities,
    homeRowFocus, contentFocus,
  } = model;
    const liveScene = createLiveScene({
      api, scope: () => shell.controller(), screen, setScreen, setRow, zone, column, setZone, setColumn,
      loading, setLoading, navIndex,
      call: (path, method, body, signal) => call(path, method, body, signal),
      fail: error => fail(error), notify: message => notify(message),
      settingsTabIndex: label => settingsTabIndex(label),
      loadSettings: (tab, signal) => loadSettings(tab, signal),
      remember: () => remember(), history: () => history,
      resetScope: () => resetScope(), setPage,
      adoptChannelWindow: (pages, searching) => adoptChannelWindow(pages, searching),
      restartPaging: () => restartPaging(),
      edgeRequest: (pages, direction) => edgeRequest(pages, direction),
      refreshChannelPage: (searching, signal) => refreshChannelPage(searching, signal as AbortSignal),
    });
    const { pages: livePages, channels, groups, group: liveGroup, programs, failure: liveFailure, identity: liveIdentity,
      guideInfo, spread: liveSpread, viewer: liveViewer, emptyFocus: liveEmptyFocus, recovery: liveRecovery,
      channelIndex: liveChannelIndex, rowStart: guideRowStart, currentProgram, guideWindow, guideStart } = liveScene;
    const setLivePages = liveScene.setPages, setPrograms = liveScene.setPrograms,
      setGuideInfo = liveScene.setGuideInfo, setProgramIndex = liveScene.setProgramIndex,
      setLiveIdentity = liveScene.setIdentity;
    const [, setPresentationRevision] = createSignal(0);
    const countdown = new AutoplayCountdown(setCountdownState);
    const calendarScene = createCalendarScene();
    const calendar = calendarScene.snapshot;
    const setCalendar = calendarScene.setSnapshot;
    const calendarDay = calendarScene.day;
    const setCalendarDay = calendarScene.setDay;
    const calendarEntry = calendarScene.entry;
    const setCalendarEntry = calendarScene.setEntry;
    const calendarDaysList = calendarScene.days;
    const calendarDayEntries = calendarScene.entries;
    const picker = createSourcePickerScene({
      api, overlays: { open: value => openOverlay(value), hide: () => overlays.hide(), origin: () => overlays.origin() },
      choice, setChoice, screen, signal: () => scopeSignal(), fail: error => fail(error), notify: message => notify(message), setLoading,
      prewarm: () => player.prewarm(), sourceMemory: card => playerScene.sourceMemory(card),
      play: (source, direct, manual) => play(source, direct, manual), drawerOpen: () => overlay()?.kind === "sources",
      opening: () => !!openingSource(),
    });
    const { facet: sourceFacet, setFacet: setSourceFacet, filterFocus: sourceFilterFocus,
      setFilterFocus: setSourceFilterFocus, provider: sourceProviderFilter, menu: sourceMenu, setMenu: setSourceMenu,
      menuChoice: sourceMenuChoice, setMenuChoice: setSourceMenuChoice,
      actions: sourceActions, setActions: setSourceActions, actionChoice: sourceActionChoice,
      setActionChoice: setSourceActionChoice, menuOptions: openSourceMenuOptions,
      page: sourcePage, failed: failedSources, rows: sources,
      loading: sourceLoading, setSourceLoading, pickerCard,
      channel: sourceChannel, activate: activateSources } = picker;
    const sourceMenuOptions = () => openSourceMenuOptions();
    const { providers: sourceProviders, visible: visibleSources, quality: sourceQualityValue,
      provider: sourceProviderValue, focused: focusedSource, addonCount: sourceAddonCount,
      spread: sourceSpread } = picker.presentation;
    createEffect(() => {
      if (screen() !== "profiles") return;
      const count =
        (management()?.profiles.length ?? 0) +
        (available(management()?.capabilities.create) ? 1 : 0);
      setColumn((i) => Math.max(0, Math.min(i, count - 1)));
      if (zone() === "profile-manage" && !canManageProfiles())
        setZone("profiles");
    });
    let controlsTimer: ReturnType<typeof setTimeout> | undefined;
    let retry: () => void = () => void start(),
      searchMediaFocus = 0,
      searchChannelFocus = 0,
      pageGeneration = 0;
    const shell = createShell({
      api, tv, start: () => start(), resetScope: () => session.resetScope(),
      clearProfileView: () => session.clearProfileView(), retry: work => { retry = work; },
      applyRevision: (fresh, signal, profile, commit) => applyRevision(fresh as never, signal, profile, commit),
      sessionReset: () => session.resetScope(), sessionAdopt: value => session.applyBootstrap(value as never),
      stopPlayer: () => player.stop(), overlay: () => overlay(), overlayClosing: () => overlayClosing(),
      adoptPreferences: value => setPreferences(value as never),
    });
    const scopeSignal = shell.signal, call = shell.call, notify = shell.notify, fail = shell.fail, run = shell.run,
      checkPlaybackRevision = shell.checkPlaybackRevision, devicePlayback = shell.devicePlayback,
      deviceScope = shell.deviceScope, revisions = shell.revisions;
    const savedList = createSavedList({
      api, saved, setSaved: value => setSaved(value), call, notify: message => notify(message),
      run: work => run(work), cardKey,
    });
    const isSaved = savedList.isSaved;
    const paging = createPagingScene({
      screen, zone, row, column, setColumn, parent: () => shell.controller(),
      length: () => {
        if (screen() === "search" && zone() === "search-channels") return searchChannels().length;
        if (screen() === "live") return channels().length;
        if (screen() === "detail") return detailEpisodes().length;
        const shelf = screen() === "home" ? home()?.rows[row()] : undefined;
        return shelf ? shelf.cards.length : page().cards.length;
      },
      next: () => {
        if (screen() === "search" && zone() === "search-channels") return edgeRequest(searchChannelPages(), "next")?.cursor ?? undefined;
        if (screen() === "detail") return detailCursor() ?? undefined;
        const shelf = screen() === "home" ? home()?.rows[row()] : undefined;
        return (shelf ? shelf.next_cursor : page().next_cursor) ?? undefined;
      },
      shelf: () => (screen() === "home" ? home()?.rows[row()] : undefined),
      more: () => more(), loadHomePage: () => loadHomePage(),
      rememberHomeRow: () => rememberHomeRow(), loadGuides: () => liveScene.loadVisibleGuides(),
    });
    const { pageSignal, restart: restartPaging, moveToItem, settle: settlePendingFocus } = paging;
    const playerScene = createPlayerScene({
      api, platform, video: () => document.getElementById("tv-video") as HTMLVideoElement,
      snapshot, setSnapshot, setPauseRequested, screen, home, preferences, deviceScope, devicePlayback,
      notify: message => notify(message), fail: error => fail(error), retry: work => { retry = work; },
      openingSource: () => openingSource(), overlay: () => overlay(), setShowControls, showControls, setChoice,
      hideControls: () => hideControls(), activeAction, activeChannel, setPresentationRevision,
      sourceMemoryPending, setSourceMemoryPending, episodeKey, deviceTitleKey,
      playIntent: (...args) => playIntent(...args), checkPlaybackRevision: () => checkPlaybackRevision(),
      countdown, episodeState, setEpisodeState, advancing, setAdvancing, overlays, openOverlay,
      playbackRevision, sourceLoading, loading, error, scopeSignal: () => scopeSignal(), detail: () => detail(),
      activeSource: () => activeSource(), deviceRevision: () => deviceRevision(),
    });
    const player = playerScene.player;
    const advanceEpisode = playerScene.advanceEpisode, dismissNext = playerScene.dismissNext;
    const playerActions = createMemo(() => {
      snapshot();
      return player.actions;
    });
    const segments = createPlaybackSegments({
      lease: () => player.leaseId,
      signal: () => scopeSignal(),
      snapshot,
      fetch: (lease, signal) => api.segments(lease, signal),
      skipEnabled: () => preferences()?.preferences?.skip_intros !== false,
      canSeek: () => playerActions().seek,
    });
    const activeSegment = segments.active;
    const skipEnabled = () => preferences()?.preferences?.skip_intros !== false;
    const skipStage = segments.stage;
    async function refreshPlaybackSegments() { await segments.refresh(); }
    const chrome = createPlayerChrome({
      screen, overlay: () => overlay(), choice, setChoice, seek, setSeek, setShowControls,
      canPause: () => playerActions().pause, canSeek: () => playerActions().seek,
      canEpisodes: () => playerActions().episodes,
      canTracks: () => playerActions().tracks && (player.tracks.audio.some(track => track.selectable && track.supported !== false) ||
        player.tracks.subtitlesSupported || player.providerSubtitleSupport),
      canChangeSource: () => playerActions().change_source,
      nextAvailable: () => playerActions().next_episode && episodeState().status !== "none",
      segment: activeSegment, skipEnabled, skipText: () => skipLabel(activeSegment()),
      seekBusy: seeking, pauseRequested, loading, error, playing: () => snapshot()?.state === "playing",
    });
    const { buttons: playerButtons, tools: playerTools, timelineFocused, setTimelineFocused, hideControls: hidePlayerControls } = chrome;
    const openTracks = createTrackPicker({player, roku: isRokuUi, selection: {column: setTrackColumn, row: setChoice},
      dialogs: {current: overlay, open: openOverlay, replace: overlays.replace, close: closeOverlay},
      subtitle: {enabled: () => playerActions().subtitle_style, current: preferences, adopt: setPreferences, request: call,
        path: () => api.scoped("/preferences"), override: setCaptionOverride}});
    const [fontsReady, setFontsReady] = createSignal(false);
    onMount(() => {
      void document.fonts.ready.then(() => setFontsReady(true));
    });
    // The scene is created below; the progress refresh only calls this later.
    const refreshDetail = (...args: Parameters<typeof detailScene.refresh>) => detailScene.refresh(...args);
    const focusedCard = createMemo<Card | undefined>(() => {
      if (screen() === "search" && zone() === "search-channels")
        return searchChannels()[column()]?.card;
      if (screen() === "home")
        return zone() === "rows"
          ? home()?.rows[row()]?.cards[column()]
          : undefined;
      if (screen() === "detail")
        return zone() === "recommendations"
          ? detail()?.recommendations[column()]
          : zone() === "episodes"
            ? detailHasEpisodes()
              ? detailEpisodes()[column()]
              : detail()?.recommendations[column()]
            : detail()?.item;
      return ["movie", "series", "anime", "search", "library"].includes(screen())
        ? page().cards[column()]
        : undefined;
    });
    const detailScene = createDetailScene({
      api, home, selected, screen, zone, column, setColumn,
      overlayVisible: () => !!overlay(), pending, signal: () => scopeSignal(), profile: () => api.profile,
      pageGeneration: () => pageGeneration, focusedCard,
      resolveFocus: (cards, key, fallback) => focusIndex(cards as Card[], key, fallback),
    });
    const { detail, setDetail, detailAction, setDetailAction, seasonIndex, setSeasonIndex } = detailScene;
    const { hasEpisodes: detailHasEpisodes, episodes: detailEpisodes, cursor: detailCursor, target: detailTarget,
      label: detailActionLabel, progress: detailPlayProgress } = detailScene.presentation;
    const contentRow = () => ({ id: screen(), cards: page().cards });
    const contentColumn = () => zone() === "content" ? column() : contentFocus.resolve(contentRow());
    function rememberContentFocus() {
      if (["movie", "series", "anime", "library"].includes(screen()) && zone() === "content")
        contentFocus.remember(contentRow(), column());
    }
    const detailRow = detailScene.row, detailColumn = detailScene.column,
      rememberDetailFocus = detailScene.rememberFocus, detailFocus = detailScene.focus;
    const searchScene = createSearchScene({
      api, parent: () => shell.controller(), screen, zone, column, setZone, setColumn, capabilities: searchCapabilities,
      page, setPage, setError, restartPaging, setLoading, retry: work => { retry = work; }, fail,
      mediaFocus: { current: () => searchMediaFocus, set: value => { searchMediaFocus = value; } },
      channelFocus: { current: () => searchChannelFocus, set: value => { searchChannelFocus = value; } },
      refreshChannelPage: (searching, signal) => refreshChannelPage(searching, signal as AbortSignal),
      adoptChannelWindow: (pages, searching) => adoptChannelWindow(pages, searching),
    });
    const { query: search, results: searchResults, rowIndex: searchRowIndex,
      error: searchError, channelError: searchChannelError, mediaPending: searchMediaPending,
      channelsPending: searchChannelsPending, channelPaging: searchChannelPaging, channels: searchChannels,
      channelPages: searchChannelPages, activeRow: activeSearchRow, needsRetry: searchNeedsRetry,
      rememberRow: rememberSearchRow,
      moveRow: moveSearchRow, positions: searchRowPositions, signal: searchSignal, update: updateSearch,
      setChannels: setSearchChannels, setChannelPages: setSearchChannelPages } = searchScene;
    const session = createSessionScene({
      api, initialLoading: options.initialLoading, screen, setScreen, zone, setZone, setColumn, setRow,
      loading, setLoading, error, pending, setError,
      picker, search: searchScene, live: liveScene, detail: detailScene, calendar: calendarScene,
      player: playerScene, paging,
      // Created later in this closure; the session only resets them on a
      // profile change, which cannot happen before they exist.
      hero: { reset: () => heroScene.reset() }, settings: { reset: () => resetSettings() },
      overlays: { retireAnimations: () => overlays.retireAnimations(), hide: () => overlays.hide() },
      cancelHold: () => cancelHold(),
      abortScope: () => shell.abort(), newScope: () => shell.restart(),
      clearFocus: () => { homeRowFocus.clear(); contentFocus.clear(); detailFocus.clear(); history.length = 0; },
      setCaptionOverride: value => setCaptionOverride(value as never),
      setPlaybackError, setPage: value => setPage(value as never), setFilters, setCatalog, setControls, setSelected,
      setActiveAction, setActiveChannel, setActiveSource, setManagement, setNavigation, setPreferences,
      setHome, setLibrary, setSaved, setAccountEmail, setHeroAction, setPlaybackRevision, setSignedIn, signedIn,
      setCanManageAccount, setPairing, setPairingDeadline, setPairingFocused, qr: setQr,
      revisions, scheduleRevisions: () => shell.scheduleRevisions(), fail, retry: work => { retry = work; },
    });
    const resetScope = session.resetScope, clearProfileView = session.clearProfileView,
      applyBootstrap = session.applyBootstrap, start = session.start, beginPairing = session.beginPairing,
      finishSignIn = session.finishSignIn;
    const gridColumns = () => (screen() === "search" ? 5 : 7);
    const gridStart = () => {
      const index =
        screen() === "search" && zone() !== "content"
          ? searchMediaFocus
          : screen() === "search" ? column() : contentColumn();
      return (
        Math.max(
          0,
          Math.floor(index / gridColumns()) -
            (screen() === "search" && searchCapabilities().channels ? 0 : 1),
        ) * gridColumns()
      );
    };
    const gridCount = () =>
      screen() === "search" && searchCapabilities().channels
        ? 5
        : gridColumns() * 2;
    // A LazyVerticalGrid scrolls the focused row just inside its viewport; 26px
    // is the overlap needed for the 424px row (348 poster + 76 captions) to fit
    // under the 236px page offset. The container clips the row above.
    const gridOffset = () =>
      screen() !== "search" && contentColumn() >= gridColumns() ? 26 : 0;
    const heroScene = createHeroScene({
      home, detail, screen, zone, row, column, screenSaver,
      overlayVisible: () => !!overlay(), pending, loading, error,
      deviceScope, focusedCard, detailHasEpisodes,
      rowFocus: homeRowFocus, observer: runtimeObserver() as ((event: Record<string, unknown>) => void) | undefined,
    });
    const { heroCycle, heroSlide, previewCard, setPreviewCard, shelfTitleY, hero, heroLogoBox,
      heroPresentation, displayHero, displayedFeatured, heroIntentCard, interruptHero, detailForDisplay,
      clampCycle, rememberHomeRow, restartHeroCycling, setHeroVisible } = heroScene;
    function remember() {
      rememberHomeRow();
      rememberContentFocus();
      rememberDetailFocus();
      history.push({
        screen: screen(),
        zone: zone(),
        column: column(),
        row: row(),
        selected: selected(),
        detail: detail(),
        detailAction: detailAction(),
        seasonIndex: seasonIndex(),
        page: page(),
        focusKey: focusedCard() ? cardKey(focusedCard()!) : undefined,
        rowId: home()?.rows[row()]?.id,
      });
      if (history.length > 12) history.shift();
    }
    const list = createListLifecycle({
      api, screen, zone, column, row, setColumn, setRow, page, setPage, home, setHome, library, setLibrary,
      overlay: () => overlay(), setChoice, cardKey, rememberContentFocus: () => rememberContentFocus(),
      rememberHomeRow: () => rememberHomeRow(), contentRow, contentFocus: contentFocus as never,
      previewCard, setPreviewCard: value => setPreviewCard(value),
      presentationKey, clampCycle,
      scopeSignal: () => scopeSignal(), restartPaging: () => restartPaging(),
    });
    const focusIndex = list.focusIndex, replacePage = list.replacePage, loadLibrary = list.loadLibrary,
      replaceHome = list.replaceHome;
    const {type: libraryType, sort: librarySort, filters: libraryFilters, defaults: libraryDefaultQuery,
      count: libraryControlCount, applying: libraryApplying, apply: applyLibrary, choose: chooseLibrary} = createLibraryControls({
        current: library, selection: {current: choice, set: setChoice}, dialogs: {open: openOverlay, close: closeOverlay},
        apply: async values => { const value = await loadLibrary("0", restartPaging(), values); replacePage(value); },
      });
    const navigationScene = createNavigationScene({
      api, platform, screen, setScreen, zone, setZone, column, setColumn, row, setRow, setHeroAction,
      loading, setLoading, home, setHome, page, setPage, setDetail, setSelected, setDetailAction, setSeasonIndex,
      setControls, setCatalog, setFilters, setManagement, setCalendarDay, setCalendarEntry, setCalendar,
      navs, resetScope: () => resetScope(), remember: () => remember(),
      rememberHomeRow: () => rememberHomeRow(), contentFocus,
      focusIndex: (cards, key, fallback) => focusIndex(cards as Card[], key, fallback),
      browseQuery: () => browseQuery() as unknown as Record<string, unknown>,
      loadLibraryFirst: async signal => {
        const first = await loadLibrary("0", signal);
        const sortControl = first.controls?.find(control => control.id === "sort");
        const lastWatched = sortControl?.choices.find(choice => choice.value === "last_watched");
        if (lastWatched && first.query?.sort !== "last_watched")
          return await loadLibrary("0", signal, { ...first.default_query, sort: lastWatched.value });
        return first;
      },
      libraryControlCount, search, updateSearch, searchMediaPending, searchChannelsPending,
      liveScene: { loadFirstPage: signal => liveScene.loadFirstPage(signal) },
      adoptChannelWindow: (pages, searching) => adoptChannelWindow(pages as never[], searching),
      setPrograms: (value) => setPrograms(value as never), setGuideInfo: (value) => setGuideInfo(value as never),
      loadSettings: (tab, signal) => loadSettings(tab, signal),
      player: { stop: () => player.stop() }, signal: () => scopeSignal(),
      fail: error => fail(error), retry: work => { retry = work; },
    });
    const history = navigationScene.history;
    const invalidateHistory = navigationScene.invalidate;
    const restorePrevious = navigationScene.restore;
    const navigate = navigationScene.navigate;
    const openDetail = navigationScene.openDetail;
    function closeOverlay(restoreFocus = true) {
      cancelPlay();
      picker.operation.get()?.abort();
      picker.operation.set(undefined);
      setSourceLoading(false);
      picker.setFiltering(false);
      overlays.close(restoreFocus);
    }
    function confirmExit() {
      openOverlay({
        kind: "confirm",
        title: "Exit VIPTV?",
        items: [
          { id: "cancel", label: "Cancel", run: closeOverlay },
          { id: "exit", label: "Exit", run: exitApp },
        ],
      });
    }
    function dismissOverlay() {
      if (sourceActions()) { setSourceActions(false); return; }
      if (sourceMenu()) { setSourceMenu(undefined); return; }
      if (libraryApplying()) restartPaging();
      if (!overlays.restoreParent()) closeOverlay();
    }
    const pageRequestOwner = {generation: paging.generation, busy: paging.busy, setBusy: paging.setBusy,
      signal: pageSignal, cancelFocus: paging.cancelFocus, settleFocus: settlePendingFocus, fail};
    const channelPaging = {owner: pageRequestOwner, focus: {zone, column, setZone, setColumn}, screen, overlay: () => !!overlay(),
      windows: {pages: (searching: boolean) => searching ? searchChannelPages() : livePages(), values: (searching: boolean) => searching ? searchChannels() : channels(), adopt: adoptChannelWindow},
      search: {query: search, remembered: () => searchChannelFocus, remember: (index: number) => {searchChannelFocus = index;}, signal: () => searchSignal(),
        paging: searchScene.setChannelPaging, error: searchScene.setChannelError, refresh: (value: string) => updateSearch(value)},
      live: {group: liveGroup, index: liveChannelIndex, retire: () => liveScene.retireGuides(), guides: () => liveScene.loadVisibleGuides(), reload: (group: string | undefined) => liveScene.loadGroup(group)},
      pending: paging.channelPending,
      retry: paging.channelRetry.set, retryAction: (action: () => void) => {retry = action;},
      request: (...args: Parameters<RemoteTvApi["live"]>) => api.live(...args)};
    const refreshChannelPage = createChannelRefresh(channelPaging);
    const moreChannels = createChannelPager(channelPaging);
    const moveChannel = createChannelMovement({...channelPaging, programs, guides: guideInfo, selectProgram: setProgramIndex, more: moreChannels});
    const detailPager = createDetailPager({owner: pageRequestOwner, current: detail, adopt: setDetail, selected, season: seasonIndex,
      episodeCount: () => detailEpisodes().length, request: (card, cursor, signal) => api.detail(card, cursor, signal)});
    const catalogPager = createCatalogPager({owner: pageRequestOwner, current: page, adopt: setPage, library: () => screen() === "library",
      discover: (cursor, signal) => api.discover(browseQuery(cursor), signal), readLibrary: loadLibrary});
    const loadHomePage = createHomePager({owner: pageRequestOwner, rows: () => home()?.rows ?? [], row, column, adopt: setHome,
      request: (values, signal) => api.discover(values, signal)});
    const {query: browseQuery, activate: activateCatalog} = createCatalogControls({screen, stremioOnly: STREMIO_ONLY, catalog, controls, selectCatalog: setCatalog,
      prompt: (title, submit, initial, secret) => prompt(title, submit, initial, secret),
      filters: {current: filters, set: setFilters}, page: setPage, loading: setLoading, column: setColumn, restart: restartPaging,
      discover: (values, signal) => api.discover(values, signal), dialogs: {open: openOverlay, close: closeOverlay}});
  return {
    setPage, setPreferences, setSaved, setManagement, setNavigation,
    setProgramIndex, revisions, replacePage, loadLibrary, detailFocus,
    searchFocus: {
      media: { get: () => searchMediaFocus, set: (value: number) => { searchMediaFocus = value; } },
      channel: { get: () => searchChannelFocus, set: (value: number) => { searchChannelFocus = value; } },
    },
    start,
    setLiveIdentity, setPrograms, setGuideInfo, setLivePages, setRetry: (work: () => void) => { retry = work; }, call, notify, fail, run, scopeSignal,
    checkPlaybackRevision, devicePlayback, deviceScope, closeOverlay, confirmExit, dismissOverlay, rememberDetailFocus, dismissNext, refreshPlaybackSegments, detailColumn, clearProfileView, applyBootstrap, beginPairing, finishSignIn,
    replaceHome, activateCatalog, activateSources, activeSearchRow, activeSegment, adoptChannelWindow, advanceEpisode, applyLibrary, applyRevision, browseQuery, calendar, calendarDay, calendarDayEntries, calendarDaysList,
    calendarEntry, calendarScene, catalogPager, channelPaging, channels, chooseLibrary, chrome, clampCycle, contentColumn, contentRow, controlsTimer, countdown, currentProgram, detail,
    detailAction, detailActionLabel, detailCursor, detailEpisodes, detailForDisplay, detailHasEpisodes, detailPager, detailPlayProgress, detailRow, detailScene, detailTarget, displayHero, displayedFeatured, failedSources,
    focusIndex, focusedCard, focusedSource, fontsReady, gridColumns, gridCount, gridOffset, gridStart, groups, guideInfo, guideRowStart, guideStart, guideWindow, hero,
    heroCycle, heroIntentCard, heroLogoBox, heroPresentation, heroScene, heroSlide, hidePlayerControls, history, interruptHero, invalidateHistory, isSaved, libraryApplying, libraryControlCount, libraryDefaultQuery,
    libraryFilters, librarySort, libraryType, list, liveChannelIndex, liveEmptyFocus, liveFailure, liveGroup, liveIdentity, livePages, liveRecovery, liveScene, liveSpread, liveViewer,
    loadHomePage, moreChannels, moveChannel, moveSearchRow, moveToItem, navigate, navigationScene, openDetail, openSourceMenuOptions, openTracks, pageRequestOwner, pageSignal,
    paging, picker, pickerCard, player, playerActions, playerButtons, playerScene, playerTools, playerTransport: playerScene.transport, transport: playerScene.transport,
    revealEndedControls: playerScene.revealEndedControls, scheduleRevisions: shell.scheduleRevisions, previewCard, programs, refreshChannelPage, refreshDetail, remember, rememberContentFocus, rememberHomeRow, rememberSearchRow,
    resetScope, restartHeroCycling, restartPaging, restorePrevious, retry, savedList, search, searchChannelError, searchChannelPages, searchChannelPaging, searchChannels, searchChannelsPending, searchError, searchMediaPending,
    searchNeedsRetry, searchResults, searchRowIndex, searchRowPositions, searchScene, searchSignal, seasonIndex, segments, session, setCalendar, setCalendarDay, setCalendarEntry, setDetail, setDetailAction,
    setFontsReady, setHeroVisible, setPresentationRevision, setPreviewCard, setSearchChannelPages, setSearchChannels, setSeasonIndex, setSourceActionChoice, setSourceActions, setSourceFacet, setSourceFilterFocus, setSourceLoading, setSourceMenu, setSourceMenuChoice,
    setTimelineFocused, settlePendingFocus, shelfTitleY, shell, skipEnabled, skipStage, sourceActionChoice, sourceActions, sourceAddonCount, sourceChannel, sourceFacet, sourceFilterFocus, sourceLoading, sourceMenu,
    sourceMenuChoice, sourceMenuOptions, sourcePage, sourceProviderFilter, sourceProviderValue, sourceProviders, sourceQualityValue, sourceSpread, sources, timelineFocused, updateSearch, visibleSources,
  };
}

export type AppScenes = ReturnType<typeof createAppScenes>;
