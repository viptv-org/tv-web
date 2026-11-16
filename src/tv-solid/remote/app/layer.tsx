/** @jsxImportSource @solidtv/solid */
import { createEffect, onCleanup, type Accessor, type Setter } from "solid-js";
import { RemoteTvApi } from "../api";
import { KeyboardView } from "../KeyboardView";
import { createBackScene } from "../back-scene";
import { createHeldSelect } from "../held-select";
import { createActivateScene } from "../activate-scene";
import { createCardMenu } from "../menus/card";
import { createLiveMenu } from "../menus/live";
import { createMenuScene } from "../menu-scene";
import { createPlayerActivation } from "../activation/player";
import { createSeasonPicker } from "../activation/seasons";
import { createProfilesNavigation } from "../navigation/profiles";
import { createCalendarNavigation } from "../navigation/calendar";
import { createDetailNavigation } from "../navigation/detail";
import { createPlayerNavigation } from "../navigation/player";
import { createHeroNavigation } from "../navigation/hero";
import { createHomeRowsNavigation } from "../navigation/home";
import { createSourceNavigation } from "../navigation/sources";
import { createOverlayNavigation } from "../navigation/overlays";
import { createSearchNavigation } from "../navigation/search";
import { createLiveNavigation } from "../navigation/live";
import { createContentNavigation } from "../navigation/content";
import { sourceActionOptions } from "../source-picker/options";
import { searchLetters } from "../SearchInput";
import { liveNoSourceActions } from "../liveEmpty";
import { createKeyboardScene, createMoveScene } from "../input-scene";
import { createSourcePlayScene } from "../source-play-scene";
import { createKeyboardInput } from "../input/keyboard";
import { createPlayerMediaKeys } from "../input/player-media";
import { installWindowInputs } from "../input/window-bindings";
import { createTextEntry } from "../text-entry";
import { publishTestSurface } from "../debug-surface";
import type { AppModel } from "./model";
import type { AppScenes } from "./scenes";
import { cardKey } from "../types";
import { deviceTitleKey } from "../device-playback";
import { applyScreenInset } from "../display";
import { createProfileEntry } from "../profile-entry";
import { createSettingsScene } from "../settings-scene";
import type { TvState } from "../state";
import type { Overlay } from "../app-types";
import type { createOverlayController } from "../overlay-controller";

/** The input layer: everything a key press can reach.
 *
 * Back, Select, the menu key, the navigation controllers, the text paths and the
 * raw window bindings are one module because they are one decision tree seen from
 * different keys: a press is routed by (screen, zone) exactly once. It is built
 * after the scenes and takes them whole, so it reads any page's state without a
 * bag of accessors.
 */
export function createScreenLayer(options: {
  api: RemoteTvApi;
  platform: string;
  tv: TvState;
  model: AppModel;
  scenes: AppScenes;
  overlays: ReturnType<typeof createOverlayController>;
  keyboardText: {
    text: Accessor<string>; setText: Setter<string>;
    key: Accessor<number>; setKey: Setter<number>;
    keyboardUpper: Accessor<boolean>; setKeyboardUpper: Setter<boolean>;
    keyboardSymbols: Accessor<boolean>; setKeyboardSymbols: Setter<boolean>;
    keyboardCharacters: Accessor<readonly string[]>;
  };
  screenSaver: Accessor<boolean>;
  handleIdleInput: () => boolean;
  reloadIdleImages: () => void;
  applyRevision: never;
  more: () => Promise<void>;
}) {
  const { api, platform, tv, model, scenes, overlays, screenSaver, handleIdleInput, reloadIdleImages, more } = options;
  const retryNow = () => scenes.retry();
  const setRetry = (work: () => void) => scenes.setRetry(work);
  const searchMediaFocus = scenes.searchFocus.media.get;
  const searchChannelFocus = scenes.searchFocus.channel.get;
  const available = (value?: { availability: string }) => value?.availability === "Available";
  const {
    text, setText, key, setKey, keyboardUpper, setKeyboardUpper, keyboardSymbols, setKeyboardSymbols, keyboardCharacters,
  } = options.keyboardText;
  const {
    loading, setLoading, error, setError, playbackError, setPlaybackError, pending, screen, setScreen, zone, setZone,
    column, setColumn, row, setRow, heroAction, setHeroAction, choice, setChoice, page, setPage, 
    catalog, selected, 
    setPairingFocused, accountEmail, canManageAccount,
    setCanManageAccount, snapshot, showControls, setShowControls, setPauseRequested, seek, setSeek,
    seeking, setSeeking, trackColumn, setTrackColumn, activeAction, setActiveAction, activeChannel, setActiveChannel,
    activeSource, setActiveSource, openingSource, setOpeningSource, 
    episodeState, countdownState, setAdvancing, 
    calibrationValue, setCalibrationValue,
  } = tv;
  const {
    home, setHome, management, setManagement, library, preferences, setPreferences, navs, navIndex,
    canManageProfiles, homeRowFocus, contentFocus,
  } = model;
  const {
    channels, groups, programs, liveSpread, liveViewer, liveRecovery, 
    picker, player, playerScene, playerTransport,
    playerActions, playerButtons, playerTools, timelineFocused, setTimelineFocused, chrome, segments, activeSegment,
    skipEnabled, refreshPlaybackSegments, activeSearchRow, search, searchResults, searchError,
    searchChannels, searchChannelsPending, searchMediaPending, searchNeedsRetry, 
    searchChannelError, detail, setPrograms, calendarDay, setCalendarDay, calendarDaysList, calendarEntry, setCalendarEntry, calendarDayEntries,
    moveToItem, moveSearchRow, rememberSearchRow, setProgramIndex, contentRow, paging, liveScene, restartHeroCycling, openTracks,
    scopeSignal, restartPaging, shell, focusedCard, calendar, setHeroVisible, revisions, controlsTimer, updateSearch, closeOverlay,
    dismissOverlay, confirmExit, finishSignIn, start, resetScope, hidePlayerControls, liveIdentity, setLiveIdentity, applyBootstrap, clearProfileView,
    beginPairing, detailEpisodes, detailHasEpisodes, detailCursor, detailTarget, detailRow, detailFocus, seasonIndex, setSeasonIndex,
    setDetail, searchScene, displayHero, heroCycle, heroIntentCard,
    isSaved, savedList, call, fail, notify, run, devicePlayback, deviceScope,
    session, history, navigate, openDetail, restorePrevious, rememberHomeRow, rememberContentFocus, rememberDetailFocus,
    libraryType, librarySort, libraryDefaultQuery, libraryApplying,
    libraryControlCount, applyLibrary, chooseLibrary, moreChannels, moveChannel, loadHomePage,
    activateCatalog, activateSources, sourceProviders, visibleSources, focusedSource, sourceSpread,
    sources, sourcePage, sourceActions, sourceMenu, sourceMenuChoice, sourceMenuOptions, sourceFilterFocus, sourceFacet, sourceProviderFilter,
    sourceLoading, sourceChannel, setSourceActionChoice, setSourceActions, setSourceFacet, setSourceFilterFocus, setSourceMenu,
    setSourceMenuChoice, countdown, dismissNext, advanceEpisode, revealEndedControls,
  } = scenes;
  const overlay = overlays.current;
  const overlayClosing = overlays.closing;
  const openOverlay = overlays.open;
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
    const sourcePlay = createSourcePlayScene({
      api, picker, player, playerScene, transport: playerTransport,
      segments: { clear: segments.clear, refresh: refreshPlaybackSegments },
      screen, setScreen, zone, setZone, column, setColumn, row, setRow,
      setPlaybackError, setError, setLoading, activeAction, setActiveAction,
      activeChannel, setActiveChannel, activeSource, setActiveSource,
      openingSource: () => openingSource(), setOpeningSource,
      overlays: { captureOrigin: () => overlays.captureOrigin(), hide: () => overlays.hide(), origin: () => overlays.origin() },
      overlay: () => overlay(), notify: message => notify(message), fail: error => fail(error),
      retry: work => { setRetry(work); },
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
      countdown, setAdvancing, progressRefresh: shell.progressRefresh,
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
    const toggleSaved = savedList.toggleSaved;
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
      api, call, run, fail, retry: work => { setRetry(work); }, dialogs: { open: openOverlay, close: closeOverlay, dismiss: dismissOverlay },
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
        remembered: searchMediaFocus, remember: rememberSearchRow, move: index => {setColumn(Math.max(0, Math.min(index, page().cards.length - 1))); rememberSearchRow(column());}},
      channels: {count: () => searchChannels().length, error: searchChannelError,
        remembered: searchChannelFocus, remember: index => {scenes.searchFocus.channel.set(index);}, move: step => moveChannel(step, true)}});
    const navigateLive = createLiveNavigation({focus: navigationFocus,
      emptyActions: () => liveSpread() === "no-source" ? liveNoSourceActions(liveViewer()).length : liveRecovery().length,
      navIndex: () => navIndex("live"), channels: () => channels().length, groups: () => groups().length,
      programs: {set: setProgramIndex, count: () => programs()[channels()[column()]?.id]?.length ?? 1}, moveChannel: step => moveChannel(step, false)});
    const navigateContent = createContentNavigation({screen, focus: navigationFocus, navIndex, libraryControls: libraryControlCount,
      catalogFilters: () => (catalog()?.controls.length ?? 0) > 0,
      content: {count: () => screen() === "detail" ? detailHasEpisodes() ? detailEpisodes().length : detail()?.recommendations.length ?? 0 : page().cards.length,
        columns: () => screen() === "live" ? 1 : screen() === "search" ? 5 : screen() === "detail" ? 4 : 7,
        cursor: () => page().next_cursor, remembered: () => contentFocus.resolve(contentRow())},
      search: {needsRetry: searchNeedsRetry, remember: index => {scenes.searchFocus.media.set(index);}},
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
      searchChannelFocus, settingsItems: () => settingsItems(),
      libraryType, librarySort, calendarDayEntries, calendarEntry, detailTarget, displayHero,
      detailHasEpisodes, detailEpisodes, trackColumn, calibrationValue, searchLetters,
      countdown, revealEndedControls: () => revealEndedControls(), restartHeroCycling: () => restartHeroCycling(),
      retry: () => retryNow(), run: work => run(work), paging, liveScene,
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

  return {
    fail, updateSearch,
    playSource, settingsTabIndex,
    cancelPlay: () => sourcePlay.intents.next(),
    activate, activatePlayer, activateScene, back, backScene, chooseSeason, edit, heldSelect, hideControls,
    inputRequested, inputScene, keyboard, keyboardScene, loadSettings, manageProfile, menu, menuScene, move,
    navigateCalendar, navigateContent, navigateDetail, navigateHero, navigateHomeRows, navigateLive, navigateOverlay, navigateProfiles, navigateSearch,
    navigateSettings, navigateSources, navigationFocus, playIntent, playerNavigation, profileEntry, refreshProfiles, settings, settingsAbort, sourcePlay,
    settingsItems, settingsTab, settingsTabs, showCardMenu, showLiveMenu, textEntry, textInput,
    toggleSaved,
  };
}

export type ScreenLayer = ReturnType<typeof createScreenLayer>;
