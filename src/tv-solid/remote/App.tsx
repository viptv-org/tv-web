/** @jsxImportSource @solidtv/solid */
import type { Overlay } from "./app-types";
import { runtimeObserver } from "../platform/runtime-observation";
import { exitTizen } from "../platform/tizen-host";
import { deviceTitleKey } from "./device-playback";
import { AutoplayCountdown } from "./autoplay-countdown";
import { createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { searchLetters } from "./SearchInput";
import { reloadImages } from "./image-source";
import { clearLogoCache, palette } from "./visuals";
import { createCalendarScene } from "./calendar-scene";
import { createSettingsScene } from "./settings-scene";
import { RowFocus } from "./row-focus";

import { createLiveMenu } from "./menus/live";
import { createLiveScene } from "./live-scene";
import { createCardMenu } from "./menus/card";
import { createPlayerActivation } from "./activation/player";
import { createSeasonPicker } from "./activation/seasons";
import { sourceActionOptions } from "./source-picker/options";
import { availableNavigation } from "./navigation-model";

import { KeyboardView } from "./KeyboardView";
import { presentationKey } from "./presentation-card";
import { STREMIO_ONLY } from "./stremio-home";
import {
  channelKey,
  edgeRequest,
} from "./channelWindow";
import { createKeyboardInput } from "./input/keyboard";
import { createPlayerMediaKeys } from "./input/player-media";
import { installWindowInputs } from "./input/window-bindings";
import { createTrackPicker } from "./player/tracks";
import { skipLabel } from "./player/skip-intro";
import { createPlayerChrome } from "./player-chrome";
import { createPlaybackSegments } from "./player/segments";
import { defineScreen } from "../runtime";
import {
  RemoteTvApi,
  lookupSelector,
  query,
  segment,
} from "./api";
import {
  liveNoSourceActions,
} from "./liveEmpty";
import {
} from "./sourceStatus";
import {
  applyDisplayPreferences,
  applyScreenInset,
  defaultDisplayPreferences,
  screenSaverMinutes
} from "./display";
import { createHeroScene } from "./hero-scene";
import { createIdleScreenSaver } from "./idle-screen-saver";
import { createTextKeyboard } from "./text-keyboard";
import { createHeldSelect } from "./held-select";
import { createLibraryControls } from "./library/controls";
import { createChannelRefresh } from "./paging/channel-refresh";
import { createSearchScene } from "./search-scene";
import { createSourcePickerScene } from "./source-picker-scene";
import { createSourcePlayScene } from "./source-play-scene";
import { createNavigationScene } from "./navigation-scene";
import { createBackScene } from "./back-scene";
import { createSessionScene } from "./session-scene";
import { publishTestSurface } from "./debug-surface";
import { createMenuScene } from "./menu-scene";
import { createActivateScene } from "./activate-scene";
import { createKeyboardScene, createMoveScene, createRootInput } from "./input-scene";
import { RootScreen } from "./render/root";
import { createTvState } from "./state";
import { createAppEffects } from "./app-effects";
import { createShell } from "./shell";
import { createRevisionApply } from "./revision-apply";
import { createTextEntry } from "./text-entry";
import { createProfileEntry } from "./profile-entry";
import { createListLifecycle } from "./list-lifecycle";
import { installPerfDebug } from "./perf-debug";
import { createPlayerScene } from "./player-scene";
import { episodeKey } from "./episode-preparation";
import { createPagingScene } from "./paging-scene";
import { createChannelPager } from "./paging/channel-pages";
import { createChannelMovement } from "./paging/channel-movement";
import { createDetailPager } from "./paging/detail";
import { createCatalogPager } from "./paging/catalog";
import { createHomePager } from "./paging/home";
import { createCatalogControls } from "./catalog-controls";
import { createOverlayController } from "./overlay-controller";
import { createDetailScene } from "./detail-scene";
import { createLiveNavigation } from "./navigation/live";
import { createContentNavigation } from "./navigation/content";
import { createHeroNavigation } from "./navigation/hero";
import { createHomeRowsNavigation } from "./navigation/home";
import { createSourceNavigation } from "./navigation/sources";
import { createOverlayNavigation } from "./navigation/overlays";
import { createSearchNavigation } from "./navigation/search";
import { createProfilesNavigation } from "./navigation/profiles";
import { createCalendarNavigation } from "./navigation/calendar";
import { createDetailNavigation } from "./navigation/detail";
import { createPlayerNavigation } from "./navigation/player";
import {
  cardKey,
  type Bootstrap,
  type Card,
  type Home,
  type LibraryPage,
  type LivePage,
  type Management,
  type Preferences,
} from "./types";

const available = (value?: { availability: string }) =>
  value?.availability === "Available";
const isRokuUi =
  typeof (globalThis as any).__SolidTVRokuRenderer !== "undefined";

export function createRemoteTvApp(
  api: RemoteTvApi,
  platform: string,
  options: { autoStart?: boolean; initialLoading?: boolean } = {},
) {
  return () => {
    const tv = createTvState({ initialLoading: options.initialLoading });
    const {
      loading, setLoading, error, setError, playbackError, setPlaybackError, pending,
      screen, setScreen, zone, setZone, column, setColumn, row, setRow, heroAction, setHeroAction, choice, setChoice,
      page, setPage, controls, setControls, catalog, setCatalog, filters, setFilters, selected, setSelected,
      pairing, setPairing, pairingDeadline, setPairingDeadline, pairingFocused, setPairingFocused,
      signedIn, setSignedIn, qr, setQr, accountEmail, setAccountEmail, canManageAccount, setCanManageAccount,
      snapshot, setSnapshot, showControls, setShowControls, pauseRequested, setPauseRequested,
      seek, setSeek, seeking, setSeeking, trackColumn, setTrackColumn,
      activeAction, setActiveAction, activeChannel, setActiveChannel, activeSource, setActiveSource,
      openingSource, setOpeningSource, captionOverride, setCaptionOverride, saved, setSaved,
      episodeState, setEpisodeState, countdownState, setCountdownState, advancing, setAdvancing,
      playbackRevision, setPlaybackRevision, deviceRevision,
      sourceMemoryPending, setSourceMemoryPending, notice, calibrationValue, setCalibrationValue,
    } = tv;
    const homeRowFocus = new RowFocus<Card>(cardKey);
    const contentFocus = new RowFocus<Card>(cardKey);
    const [home, setHome] = createSignal<Home>(),
      [management, setManagement] = createSignal<Management>(),
      [navigation, setNavigation] = createSignal<Bootstrap["navigation"]>(),
      [library, setLibrary] = createSignal<LibraryPage>(),
      [preferencesSignal, setPreferencesSignal] = createSignal<Preferences>();
    createEffect(() => homeRowFocus.retain(home()?.rows ?? []));
    /** Server preference snapshots drive the display settings immediately;
     * clearing the profile restores the designed defaults. */
    const adoptPreferences = (value: Preferences | undefined) => {
      setPreferencesSignal(value);
      applyDisplayPreferences(value?.display ?? defaultDisplayPreferences);
    };
    const preferences = preferencesSignal;
    const setPreferences = adoptPreferences;
    const navs = createMemo(() => availableNavigation(navigation()));
    const navIndex = (id: string) =>
      Math.max(
        0,
        navs().findIndex((item) => item.id === id),
      );
    const canManageProfiles = () =>
      !!management()?.profiles.length &&
      ["rename", "avatar", "delete"].some((key) =>
        available(management()?.capabilities[key]),
      );
    const searchCapabilities = createMemo(() => {
      const entry = navs().find((item) => item.id === "search");
      return {
        media: !!entry && entry.media_search !== false,
        channels: entry?.channel_search === true,
      };
    });
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
    const setLivePages = liveScene.setPages, setChannels = liveScene.setChannels,
      setPrograms = liveScene.setPrograms, setGuideInfo = liveScene.setGuideInfo,
      setLiveIdentity = liveScene.setIdentity, setProgramIndex = liveScene.setProgramIndex;
    function reloadIdleImages() {
      clearLogoCache();
      reloadImages();
    }
    const { active: screenSaver, dismiss: dismissIdleSaver } = createIdleScreenSaver({
      minutes: screenSaverMinutes, playing: () => screen() === "player", onWake: reloadIdleImages,
    });
    function handleIdleInput() {
      interruptHero();
      return dismissIdleSaver();
    }
    const { text, setText, key, setKey, upper: keyboardUpper, setUpper: setKeyboardUpper,
      symbols: keyboardSymbols, setSymbols: setKeyboardSymbols, characters: keyboardCharacters } = createTextKeyboard();
    const overlays = createOverlayController({
      focus: {screen, capture: () => ({zone: zone(), column: column(), row: row(), choice: choice()}), selection: choice,
        select: index => { setChoice(index); }, restore: focus => { setZone(focus.zone); setColumn(focus.column); setRow(focus.row); setChoice(focus.choice); }},
      text: {clear: () => { setText(""); }, begin: initial => { setKeyboardUpper(false); setKeyboardSymbols(false); setText(initial); setKey(0); }},
      errors: {clear: () => { setError(""); }, restore: () => { setError(screen() === "player" ? playbackError() : ""); }},
    });
    const {current: overlay, entered: overlayEntered, closing: overlayClosing, open: openOverlay, reportSettled: reportOverlaySettled} = overlays;
    const profileEditor = createMemo(() => {
      const value = overlay();
      return value &&
        (value.kind === "choices" || value.kind === "confirm") &&
        value.profile
        ? value
        : undefined;
    });
    const heldSelect = createHeldSelect({
      target: () => menuScene.pressTarget(), layer: overlay,
      allowed: () => !overlay() || overlay()?.kind === "sources" || overlay()?.kind === "next",
      blocked: () => pending() || loading(),
      onTimer: () => { (window as any).__holdPending = pending(); (window as any).__holdLoading = loading(); },
      hold: () => {
        if (!overlay() && zone() === "hero" && heroAction() === 0 && heroIntentCard()) void playIntent(heroIntentCard()!, true).catch(fail);
        else menu();
      },
      activate: () => { void activate().catch(fail); },
    });
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
      play: (source, direct, manual) => playSource(source, direct, manual), drawerOpen: () => overlay()?.kind === "sources",
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
    const isSaved = (card: Card) =>
      saved().get(cardKey(card)) ?? card.view?.saved ?? false;
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
      deviceScope = shell.deviceScope, progressRefresh = shell.progressRefresh,
      progressFreshness = shell.progressFreshness, revisions = shell.revisions,
      scheduleRevisions = shell.scheduleRevisions;
    function adoptChannelWindow(pages: LivePage[], searching = false) {
      const values = pages.flatMap((page) => page.channels);
      if (searching) {
        setSearchChannelPages(pages);
        setSearchChannels(values);
        return;
      }
      setLivePages(pages);
      // Channels accumulate across the traversed range so the global focus
      // index stays stable as the bounded render window slides underneath. A
      // reset clears them; a reload adopts revised server data for ids already
      // present and appends genuinely new channels.
      setChannels((current) => {
        if (!pages.length) return [];
        const byId = new Map(values.map((channel) => [channelKey(channel), channel]));
        const seen = new Set(current.map(channelKey));
        const merged = current.map((channel) => byId.get(channelKey(channel)) ?? channel);
        const fresh = values.filter((channel) => !seen.has(channelKey(channel)));
        return [...merged, ...fresh];
      });
      setPage({
        cards: channels().map((channel) => channel.card),
        complete: pages.at(-1)?.complete ?? true,
      });
    }
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
    const player = playerScene.player, playerTransport = playerScene.transport;
    const advanceEpisode = playerScene.advanceEpisode, revealEndedControls = playerScene.revealEndedControls,
      dismissNext = playerScene.dismissNext;
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
    // Created near the end of the closure, where the things a revision
    // re-requests all exist; the shell only holds a reference to it.
    let revisionApply: ReturnType<typeof createRevisionApply> | undefined;
    const applyRevision = (fresh: Bootstrap, signal: AbortSignal, profile: string, commit: () => void) =>
      revisionApply!.applyRevision(fresh, signal, profile, commit);
    const focusedCard = createMemo(() => {
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
      hero: { reset: () => heroScene.reset() }, settings: { reset: () => settings.reset() },
      overlays: { retireAnimations: () => overlays.retireAnimations(), hide: () => overlays.hide() },
      cancelHold: () => heldSelect.cancel(),
      abortScope: () => shell.abort(), newScope: () => shell.restart(),
      clearFocus: () => { homeRowFocus.clear(); contentFocus.clear(); detailFocus.clear(); history.length = 0; },
      setCaptionOverride: value => setCaptionOverride(value as never),
      setPlaybackError, setPage: value => setPage(value as never), setFilters, setCatalog, setControls, setSelected,
      setActiveAction, setActiveChannel, setActiveSource, setManagement, setNavigation, setPreferences,
      setHome, setLibrary, setSaved, setAccountEmail, setHeroAction, setPlaybackRevision, setSignedIn, signedIn,
      setCanManageAccount, setPairing, setPairingDeadline, setPairingFocused, qr: setQr,
      revisions, scheduleRevisions: () => scheduleRevisions(), fail, retry: work => { retry = work; },
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
      sourcePlay.intents.next();
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
          { id: "exit", label: "Exit", run: exitTizen },
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
    async function more() {
      if (
        screen() === "live" ||
        (screen() === "search" && zone() === "search-channels")
      ) {
        await moreChannels("next");
        return;
      }
      if (screen() === "detail") { await detailPager(); return; }
      await catalogPager();
    }
    const {query: browseQuery, activate: activateCatalog} = createCatalogControls({screen, stremioOnly: STREMIO_ONLY, catalog, controls, selectCatalog: setCatalog,
      prompt: (title, submit, initial, secret) => edit(title, submit, initial, secret),
      filters: {current: filters, set: setFilters}, page: setPage, loading: setLoading, column: setColumn, restart: restartPaging,
      discover: (values, signal) => api.discover(values, signal), dialogs: {open: openOverlay, close: closeOverlay}});
    if (new URLSearchParams(location.search).has("perfdebug"))
      installPerfDebug({
        programs, guideRequestsInFlight: () => liveScene.guides.inFlight(), page, livePages,
        searchChannelPages, home, historyEntries: history.length,
      });
    const sourcePlay = createSourcePlayScene({
      api, picker, player, playerScene, transport: playerTransport,
      segments: { clear: segments.clear, refresh: refreshPlaybackSegments },
      screen, setScreen, zone, setZone, column, setColumn, row, setRow,
      setPlaybackError, setError, setLoading, activeAction, setActiveAction,
      activeChannel, setActiveChannel, activeSource, setActiveSource,
      openingSource: () => openingSource(), setOpeningSource,
      overlays: { captureOrigin: () => overlays.captureOrigin(), hide: () => overlays.hide(), origin: () => overlays.origin() },
      overlay: () => overlay(), notify: message => notify(message), fail: error => fail(error),
      retry: work => { retry = work; },
      searchRequests: searchScene.requests,
      playerNavigation: { reset: () => playerNavigation.reset() }, setTimelineFocused, setShowControls, setChoice,
      hideControls: () => hideControls(), chrome, countdown, snapshot,
      deviceScope, deviceTitleKey, sourceChannel, signal: () => scopeSignal(),
    });
    const playIntent = sourcePlay.playIntent, playSource = sourcePlay.playSource;
    const backScene = createBackScene({
      platform, screen, zone, setZone, setColumn, history,
      restorePrevious, navigate, navs, error, setError, loading, setLoading,
      overlay: () => overlay(),
      overlays: { close: focus => overlays.close(focus), restoreParent: () => overlays.restoreParent() },
      picker, sourceLoading, sourceActions, setSourceActions, sourceMenu, setSourceMenu,
      openingSource: () => openingSource(), setOpeningSource: value => setOpeningSource(value), sourcePlay,
      libraryApplying, restartPaging: () => restartPaging(),
      player: { stop: () => player.stop(), cancelPendingStart: () => player.cancelPendingStart(),
        get leaseId() { return player.leaseId; }, flushProgress: () => player.flushProgress() },
      transport: { retire: () => playerTransport.retire() },
      playerScene, playerNavigation: { cancel: () => playerNavigation.cancel() },
      segments: { clear: segments.clear },
      seeking, setSeeking, seek, setSeek, showControls, setShowControls, snapshot,
      countdown, setAdvancing, progressRefresh,
      setPlaybackError, setScreen, setRow,
      rememberHomeRow: () => rememberHomeRow(), rememberContentFocus: () => rememberContentFocus(),
      rememberDetailFocus: () => rememberDetailFocus(),
      search, updateSearch, searchMediaPending, searchChannelsPending,
      closeOverlay: () => closeOverlay(), dismissOverlay: () => dismissOverlay(),
      confirmExit: () => confirmExit(),
      finishSignIn: () => finishSignIn(), start: () => start(),
      startupAuthorityKnown: session.authorityKnown,
      applyScreenInset: value => applyScreenInset(value),
      resetScope: () => resetScope(), navIndex, hasProfile: () => !!api.profile,
    });
    const back = backScene.back, leavePlayer = backScene.leavePlayer;
    createEffect(() => {
      if (screen() !== "player" || ["paused", "ended", "error"].includes(snapshot()?.state ?? "")) setPauseRequested(false);
    });
    const hideControls = hidePlayerControls;
    async function toggleSaved(card: Card) {
      await run(async () => {
        const key = cardKey(card);
        const receipt = isSaved(card)
          ? await call<{ saved: boolean }>(
              api.scoped(
                `/library/${segment(card.identity.kind)}/${segment(card.identity.id)}?${query(card.metadata_origin ? { metadata_origin: card.metadata_origin, card: lookupSelector(card) } : {})}`,
              ),
              "DELETE",
            )
          : await call<{ saved: boolean }>(api.scoped("/library"), "PUT", {
              card,
            });
        setSaved((old) => new Map(old).set(key, receipt.saved));
        notify(receipt.saved ? "Added to My List" : "Removed from My List");
      });
    }
    /**
     * LIVE-EMPTY-001 reads the account identity only when its empty or failed
     * form appears, so a working Live page never pays for it. Until it answers
     * the block holds its height and draws neither actions nor a who line.
     */
    createEffect(() => {
      const spread = liveSpread();
      if (
        screen() !== "live" ||
        !["no-source", "no-channels", "failed"].includes(spread) ||
        liveIdentity() !== undefined
      )
        return;
      void api.accountIdentity().then((value) => {
        setLiveIdentity(value);
      });
    });
    const profileEntry = createProfileEntry({
      api, call, signal: () => scopeSignal(), management, available, run, refreshProfiles: () => refreshProfiles(),
      closeOverlay: () => closeOverlay(), openOverlay: value => openOverlay(value),
      clear: {
        stopPlayer: () => player.stop(), resetScope: () => resetScope(), history,
        setHome: value => setHome(value), setPage: value => setPage(value), setDetail: value => setDetail(value),
        setPrograms: value => setPrograms(value),
      },
      applyBootstrap: value => applyBootstrap(value as never),
    });
    const edit = profileEntry.edit, selectProfile = profileEntry.selectProfile;
    const settings = createSettingsScene({
      api, call, run, fail, retry: work => { retry = work; }, dialogs: { open: openOverlay, close: closeOverlay, dismiss: dismissOverlay },
      prompt: edit, notify, screen, setScreen, loading: setLoading,
      preferences, adoptPreferences: setPreferences, accountEmail,
      management, setManagement, canManageAccount, setCanManageAccount,
      devicePlayback, deviceScope, scope: () => scopeSignal(),
      stopPlayer: () => player.stop(), resetScope, clearProfileView, calibrate: setCalibrationValue,
      navigation: { zone, column, setZone, setColumn },
      manageProfile: index => settings.manageProfile(index),
    });
    const settingsTabs = settings.tabs;
    const settingsTab = settings.tab;
    const settingsItems = settings.items;
    const settingsTabIndex = settings.tabIndex;
    const loadSettings = settings.load;
    const refreshProfiles = settings.refreshProfiles;
    const manageProfile = settings.manageProfile;
    const navigateSettings = settings.navigate;
    const settingsAbort = settings.abort;
    const navigationFocus = { zone, column, setZone, setColumn };
    const navigateProfiles = createProfilesNavigation({ focus: navigationFocus,
      count: () => management()?.profiles.length ?? 0, canCreate: () => available(management()?.capabilities.create), canManage: canManageProfiles });
    const navigateCalendar = createCalendarNavigation({ focus: navigationFocus,
      days: {index: calendarDay, set: setCalendarDay, count: () => calendarDaysList().length},
      entries: {index: calendarEntry, set: setCalendarEntry, count: () => calendarDayEntries().length}, navIndex: () => navIndex("calendar") });
    const navigateDetail = createDetailNavigation({ focus: navigationFocus,
      season: {index: seasonIndex, count: () => detail()?.seasons.length ?? 0},
      episodes: {enabled: detailHasEpisodes, count: () => detailEpisodes().length, cursor: detailCursor},
      recommendations: () => detail()?.recommendations.length ?? 0, remembered: region => detailFocus.resolve(detailRow(region)),
      paging: {move: moveToItem, more: () => { void more(); }} });
    const playerNavigation = createPlayerNavigation({
      scope: () => screen() === "player" && !overlay() && !loading() && !error() &&
        ["ready", "playing", "paused"].includes(snapshot()?.state ?? "") ? snapshot()?.sessionId : undefined,
      selection: {index: choice, set: setChoice, timeline: timelineFocused, setTimeline: setTimelineFocused},
      timeline: {seeking, allowed: () => playerActions().seek, duration: () => snapshot()?.time.durationSeconds,
        position: () => snapshot()?.time.positionSeconds ?? 0, preview: seek, setPreview: setSeek},
      controls: {count: () => playerButtons().length, show: () => { setShowControls(true); }, activity: hideControls} });
    createEffect(() => {
      if (screen() !== "player" || overlay() || loading() || error() || seeking() || !timelineFocused()) playerNavigation.cancel();
    });
    const navigateHero = createHeroNavigation({focus: navigationFocus, action: setHeroAction, row: setRow, homeNavIndex: () => navIndex("home"),
      home: {rows: () => home()?.rows ?? [], resolve: index => homeRowFocus.resolve(home()?.rows[index]), remember: rememberHomeRow},
      detail: {hasEpisodes: detailHasEpisodes, recommendations: () => detail()?.recommendations.length ?? 0, seasons: () => detail()?.seasons.length ?? 0}});
    const navigateHomeRows = createHomeRowsNavigation({focus: navigationFocus, row: {index: row, set: setRow},
      rows: () => home()?.rows ?? [], resolve: shelf => homeRowFocus.resolve(shelf), remember: rememberHomeRow, load: loadHomePage, move: moveToItem});
    const navigateSources = createSourceNavigation({manual: () => { picker.manual.set(true); },
      actions: {open: () => !!sourceActions(), set: setSourceActionChoice, count: () => sourceActionOptions.length},
      menu: {open: () => !!sourceMenu(), set: setSourceMenuChoice, count: () => sourceMenuOptions().length},
      filters: {focused: sourceFilterFocus, focus: setSourceFilterFocus, facet: setSourceFacet},
      rows: {index: choice, set: setChoice, count: () => visibleSources().length}});
    const navigateOverlay = createOverlayNavigation({selection: {index: choice, set: setChoice}, tracks: {index: trackColumn, set: setTrackColumn},
      calibration: {value: calibrationValue, set: setCalibrationValue, preview: applyScreenInset}, keyboard: setKey, sources: navigateSources});
    const navigateSearch = createSearchNavigation({focus: navigationFocus, keyboard: {index: key, set: setKey}, navIndex: () => navIndex("search"),
      media: {count: () => page().cards.length, available: () => searchResults().rows.length > 0, moveRow: moveSearchRow, error: () => searchError() || activeSearchRow()?.message || (activeSearchRow()?.state === "Failed" ? "This search provider could not respond. Try again." : ""), needsRetry: searchNeedsRetry,
        remembered: () => searchMediaFocus, remember: rememberSearchRow, move: index => {setColumn(Math.max(0, Math.min(index, page().cards.length - 1))); rememberSearchRow(column());}},
      channels: {count: () => searchChannels().length, error: searchChannelError,
        remembered: () => searchChannelFocus, remember: index => {searchChannelFocus = index;}, move: step => moveChannel(step, true)}});
    const navigateLive = createLiveNavigation({focus: navigationFocus,
      emptyActions: () => liveSpread() === "no-source" ? liveNoSourceActions(liveViewer()).length : liveRecovery().length,
      navIndex: () => navIndex("live"), channels: () => channels().length, groups: () => groups().length,
      programs: {set: setProgramIndex, count: () => programs()[channels()[column()]?.id]?.length ?? 1}, moveChannel: step => moveChannel(step, false)});
    const navigateContent = createContentNavigation({screen, focus: navigationFocus, navIndex, libraryControls: libraryControlCount,
      catalogFilters: () => (catalog()?.controls.length ?? 0) > 0,
      content: {count: () => screen() === "detail" ? detailHasEpisodes() ? detailEpisodes().length : detail()?.recommendations.length ?? 0 : page().cards.length,
        columns: () => screen() === "live" ? 1 : screen() === "search" ? 5 : screen() === "detail" ? 4 : 7,
        cursor: () => page().next_cursor, remembered: () => contentFocus.resolve(contentRow())},
      search: {needsRetry: searchNeedsRetry, remember: index => {searchMediaFocus = index;}},
      paging: {move: moveToItem, more: () => {void more();}}, loadGuide: index => {void liveScene.guides.load(index);}});
    const inputScene = createMoveScene({
      screen, zone, setZone, setColumn, overlay: () => overlay(), overlayClosing, openingSource: () => openingSource(),
      error, loading, countdown, paging, liveScene, restartHeroCycling: () => restartHeroCycling(),
      revealEndedControls: () => revealEndedControls(),
      rememberContentFocus: () => rememberContentFocus(), rememberDetailFocus: () => rememberDetailFocus(),
      setPairingFocused: value => setPairingFocused(value), navs,
      contentFocus: { resolve: row => contentFocus.resolve(row as never) }, contentRow: () => contentRow() as never,
      libraryControlCount, navigateOverlay: (modal, dx, dy) => navigateOverlay(modal, dx, dy),
      playerNavigation: { move: (dx, dy) => playerNavigation.move(dx, dy) },
      navigateProfiles: (dx, dy) => navigateProfiles(dx, dy),
      navigateSettings: (dx, dy) => navigateSettings(dx, dy),
      navigateDetail: (dx, dy) => navigateDetail(dx, dy),
      navigateCalendar: (dx, dy) => navigateCalendar(dx, dy),
      navigateHero: (dx, dy, at) => navigateHero(dx, dy, at as never),
      navigateHomeRows: (dx, dy) => navigateHomeRows(dx, dy),
      navigateSearch: (dx, dy) => navigateSearch(dx, dy),
      navigateLive: (dx, dy) => navigateLive(dx, dy),
      navigateContent: (dx, dy) => navigateContent(dx, dy),
    });
    const keyboardScene = createKeyboardScene({
      overlay: () => overlay(), text, setText: value => setText(value as never), key, search, updateSearch,
      keyboardCharacters, setKeyboardUpper: value => setKeyboardUpper(value), setKeyboardSymbols: value => setKeyboardSymbols(value),
      setZone: value => setZone(value), setColumn: value => setColumn(value), run: work => run(work),
      dismissOverlay: () => dismissOverlay(),
    });
    const move = inputScene.move, completeTextInput = keyboardScene.completeTextInput,
      keyboardActivate = keyboardScene.keyboardActivate;
    const activatePlayer = createPlayerActivation({player, snapshot, setPlaying: playerTransport.setPlaying, actions: playerActions, action: activeAction, channel: activeChannel, choice, buttons: playerButtons,
      timeline: {value: seek, set: setSeek, seeking: setSeeking}, chrome: {visible: showControls, set: setShowControls, hide: hideControls},
      segments: {active: activeSegment, clear: segments.clear, refresh: refreshPlaybackSegments},
      skipEnabled: () => preferences()?.preferences.skip_intros !== false, next: advanceEpisode, tracks: openTracks, play: playIntent,
      details: card => api.detail(card, "0", scopeSignal()), dialogs: {open: openOverlay}});
    const chooseSeason = createSeasonPicker({current: detail, adopt: setDetail, season: {current: seasonIndex, set: setSeasonIndex},
      focus: navigationFocus, choice: setChoice, loading: setLoading, rememberedEpisode: () => detailFocus.resolve(detailRow("episodes")), restart: restartPaging,
      request: (card, cursor, signal) => api.detail(card, cursor, signal), open: openOverlay, close: closeOverlay});
    const activateScene = createActivateScene({
      api, signal: () => scopeSignal(), screen, zone, column, row, choice, key, heroAction,
      overlay: () => overlay(), overlayClosing, pending, loading, error, setError: value => setError(value),
      setZone: value => setZone(value), setColumn: value => setColumn(value), setHome: value => setHome(value),
      home, page, detail, management, navs, groups, channels, searchChannels, search,
      searchChannelFocus: () => searchChannelFocus, settingsItems: () => settingsItems(),
      libraryType, librarySort, calendarDayEntries, calendarEntry, detailTarget, displayHero,
      detailHasEpisodes, detailEpisodes, trackColumn, calibrationValue, searchLetters,
      countdown, revealEndedControls: () => revealEndedControls(), restartHeroCycling: () => restartHeroCycling(),
      retry: () => retry(), run: work => run(work), paging, liveScene,
      closeOverlay: () => closeOverlay(), openOverlay: value => openOverlay(value),
      navigate: target => navigate(target), openDetail: card => openDetail(card),
      beginPairing: () => beginPairing(), finishSignIn: () => finishSignIn(),
      manageProfile: index => manageProfile(index), selectProfile: index => selectProfile(index),
      chooseSeason: () => chooseSeason(), advanceEpisode: () => advanceEpisode(),
      dismissNext: () => dismissNext(), activateSources: () => activateSources(),
      activatePlayer: () => activatePlayer(), playIntent, toggleSaved: card => toggleSaved(card),
      updateSearch: (value, immediate) => updateSearch(value, immediate),
      moreChannels: direction => moreChannels(direction),
      chooseLibrary: control => chooseLibrary(control as never),
      applyLibrary: query => applyLibrary(query as never),
      libraryDefaultQuery: () => libraryDefaultQuery() as unknown as Record<string, unknown>,
      activateCatalog: index => activateCatalog(index),
      keyboardActivate: overlay => keyboardActivate(overlay),
      nativeTextTarget: () => nativeTextTarget() as unknown,
      nativeTextPort: () => textEntry.editing ? (globalThis as { __viptvNativeTextEntry?: { ownsInput: () => boolean } }).__viptvNativeTextEntry : undefined,
      nativeTextEditing: () => textEntry.editing ? { open: (target: unknown) => textEntry.editing!.open(target as never) } : undefined,
      chrome,
    });
    const activate = activateScene.activate;
    const showLiveMenu = createLiveMenu({request: call, path: path => api.scoped(path),
      dialogs: {open: openOverlay, close: closeOverlay}, play: playIntent, fail});
    const showCardMenu = createCardMenu({dialogs: {open: openOverlay, close: closeOverlay}, details: openDetail,
      play: playIntent, saved: isSaved, toggleSaved});
    const menuScene = createMenuScene({
      screen, zone, column, row, choice, key, heroAction, overlay: () => overlay(), focusedSource,
      sourceFilterFocus, sourceFacet, sourcePage, selected, focusedCard, heroIntentCard, isSaved, cardKey,
      channels, searchChannels, settingsItems: () => settingsItems(), visibleSources, sourceActions, sourceMenu,
      setSourceActions: value => setSourceActions(value), setSourceActionChoice: value => setSourceActionChoice(value),
      picker, player, playerScene, chrome, activeAction, activeChannel, playIntent, advanceEpisode, countdown,
      showLiveMenu: channel => showLiveMenu(channel), showCardMenu: card => showCardMenu(card),
      manageProfile: index => manageProfile(index), canManageProfiles: () => canManageProfiles(),
      fail: error => fail(error),
    });
    const menu = menuScene.menu;
    createEffect(() => publishTestSurface(() => {
      const state = screen();
      return {
        screen: state, zone: zone(), column: column(), row: row(), heroAction: heroAction(), choice: choice(),
        navs: navs(), overlayKind: overlay()?.kind, sources: sources().length,
        sourceProviders: sourceProviders().map(([label]) => label).join(","),
        playerState: String(snapshot()?.state ?? ""), playbackError: playbackError(),
        showControls: showControls(), heroStarted: heroCycle.active() ? heroCycle.started() : undefined,
        seeking: seeking(), snapshot: snapshot(), timelineFocused: timelineFocused(),
        playerTools: playerTools().map(tool => tool.id).join(","),
        sourcePhase: sourcePage()?.discovery_phase ?? "",
        sourcePreparing: sourceLoading() && !overlay(),
        busy: loading() || seeking() || snapshot()?.state === "buffering",
        sourceIdentity: focusedSource()?.id ?? "",
        episode: activeAction()?.card.identity.episode?.episode,
        nextStatus: episodeState().status, nextPrepared: !!episodeState().prepared,
        countdownRemaining: countdownState().remaining,
        sourceMenu: sourceMenu(), sourceFilterFocus: sourceFilterFocus(), sourceFacet: sourceFacet(),
        sourceMenuChoice: sourceMenuChoice(), sourceFilter: sourceProviderFilter(), sourceFailure: picker.failure(),
        librarySort: String(library()?.query?.sort ?? ""), calendarEntries: calendar()?.entries.length ?? 0,
        sourceStatus: String(sourceSpread()), ready: !loading() && !pending(),
        channelId: (state === "live" && zone() === "content" ? channels()[column()]
          : state === "search" && zone() === "search-channels" ? searchChannels()[column()] : undefined)?.id ?? "",
        searchRow: state === "search" ? activeSearchRow()?.id ?? "" : "",
        searchRows: state === "search" ? searchResults().rows.length : 0,
        saver: screenSaver(), liveSpread: String(state === "live" ? liveSpread() : ""),
      };
    }));
    const textEntry = createTextEntry({
      api, screen, overlay: () => overlay(), overlayClosing, screenSaver, zone,
      text, setText: value => setText(value), search, updateSearch,
      complete: isOverlay => completeTextInput(isOverlay), dismissOverlay: () => dismissOverlay(),
      handleIdleInput: () => handleIdleInput(), notify: message => notify(message),
    });
    const textInput = textEntry.textInput, nativeTextTarget = textEntry.nativeTarget;
    let inputRequested = false;
    createEffect(() => {
      if (inputRequested) return;
      inputRequested = true;
      const input = createKeyboardInput({screen, overlay, zone, cancelCountdown: () => countdown.cancel(), hideControls,
        pair: beginPairing, stop: leavePlayer, text: setText, query: search, search: updateSearch, fail,
        media: createPlayerMediaKeys({player, snapshot, setPlaying: playerTransport.setPlaying, actions: playerActions, active: activeAction, seeking: {current: seeking, set: setSeeking},
          revealEnded: revealEndedControls, play: playIntent, chrome: {show: setShowControls, hide: hideControls},
          segments: {clear: segments.clear, refresh: refreshPlaybackSegments,
            active: activeSegment, skipEnabled: skipEnabled}, fail})});
      onCleanup(installWindowInputs({keyboard: event => {
        if (event.key.length === 1 && handleIdleInput()) { event.preventDefault(); return; }
        input(event);
      }, screen, overlay, loading, error, pair: beginPairing, stop: leavePlayer,
        textInput,
        next: {advance: advanceEpisode, dismiss: dismissNext}, cancelHold: () => {heldSelect.cancel(); playerNavigation.cancel();}, cancelCountdown: () => countdown.cancel(),
        visible: setHeroVisible, wake: reloadIdleImages, fail}));
    });
    onCleanup(() => {
      shell.dispose();
      playerTransport.retire();
      heldSelect.cancel();
      playerNavigation.cancel();
      overlays.dispose();
      shell.abort();
      settingsAbort();
      picker.operation.get()?.abort();
      revisions.stop();
      clearTimeout(searchScene.requests.timer);
      clearTimeout(controlsTimer);
      void player.dispose();
    });
    function keyboard(isModal = false) {
      return <KeyboardView numeric={!!(isModal && overlay()?.kind === "text" && (overlay() as Extract<Overlay, { kind: "text" }>).numeric)}
        modal={isModal} letters={keyboardCharacters()} upper={keyboardUpper()} symbols={keyboardSymbols()} selected={key()} />;
    }
    createAppEffects({
      api, signal: () => scopeSignal(), screen, home, pending, overlay: () => overlay(), selected, seasonIndex,
      preferences, snapshot, captionOverride, replaceHome: value => replaceHome(value), fail: error => fail(error),
      progressFreshness, progressRefresh, refreshDetail, player, cardKey,
      start: () => start(), autoStart: options.autoStart !== false,
    });
    revisionApply = createRevisionApply({
      api, screen, zone, column, setColumn, navs, navIndex, setNavigation, selected, search, updateSearch,
      resetScope: () => resetScope(), applyBootstrap: value => applyBootstrap(value),
      restartPaging: () => restartPaging(), invalidateHistory, setManagement,
      setPreferences: value => setPreferences(value ?? undefined),
      setSaved: value => setSaved(value), replaceHome: value => replaceHome(value ?? undefined),
      replacePage: value => replacePage(value), browseQuery: () => browseQuery(),
      loadLibrary: (cursor, signal) => loadLibrary(cursor, signal),
      loadSettings: (tab, signal) => loadSettings(tab, signal), settingsTab,
      refreshDetail: (signal, profile, cb) => refreshDetail(signal, profile, cb, () => true),
      refreshLive: (signal, cb) => liveScene.refresh(signal, cb),
      fail: error => fail(error),
    });
    const Root = defineScreen({
      input: createRootInput({
        countdown, handleIdleInput: () => handleIdleInput(), move: (dx, dy) => move(dx, dy),
        back: () => back(), menu: () => menu(), fail: error => fail(error),
        revealEndedControls: () => revealEndedControls(), restartHeroCycling: () => restartHeroCycling(),
        playerNavigation: { cancel: () => playerNavigation.cancel() }, overlay: () => overlay(),
        manualSourceSelection: () => picker.manual.set(true), press: () => heldSelect.press(),
      }),
      render: () => <RootScreen view={{
        screen, screenSaver, profileEditor, overlay, zone, heroPresentation, heroLogoBox, navs, column,
      management, api, fontsReady, loading, error, pairing, qr, pairingDeadline, pairingFocused, signedIn,
      finishSignIn, available, canManageProfiles, calendar, calendarDaysList, calendarDay, calendarEntry,
      home, hero, displayHero, row, heroAction, displayedFeatured, heroCycle, shelfTitleY, homeRowFocus,
      isSaved, heroSlide, palette, detailForDisplay, detailHasEpisodes, detailEpisodes, seasonIndex,
      detailColumn, detailActionLabel, detailPlayProgress, key, search, searchCapabilities, searchResults,
      searchError, library, libraryType, librarySort, libraryFilters, catalog, page, gridStart, gridCount,
      gridColumns, gridOffset, searchMediaPending, searchNeedsRetry, searchRowIndex, searchMediaFocus,
      searchRowPositions, searchChannels, edgeRequest, searchChannelPages, searchChannelFocus,
      searchChannelsPending, searchChannelPaging, searchChannelError, liveSpread, liveViewer, liveEmptyFocus,
      livePages, liveRecovery, liveFailure, channels, liveChannelIndex, currentProgram, groups, liveGroup,
      programs, guideRowStart, guideStart, guideWindow, settingsTabs, settingsTab, settingsItems, advancing,
      openingSource, showControls, seeking, snapshot, skipStage, activeSegment, activeAction, playerActions,
      playerTools, choice, timelineFocused, seek, overlayEntered, overlayClosing, reportOverlaySettled,
      sourceLoading, pickerCard, sources, visibleSources, sourcePage, sourceAddonCount, sourceMenu,
      sourceMenuOptions, sourceMenuChoice, picker, sourceProviderFilter, sourceActions, sourceActionChoice,
      focusedSource, sourceFilterFocus, sourceFacet, sourceSpread, sourceQualityValue, sourceProviderValue,
      failedSources, trackColumn, text, keyboard, episodeState, countdownState, calibrationValue, notice,
      pending,
      }} />,
    });
    return <Root />;
  };
}
