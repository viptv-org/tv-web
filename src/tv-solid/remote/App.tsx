/** @jsxImportSource @solidtv/solid */
import type { Overlay } from "./app-types";
import { deviceTitleKey } from "./device-playback";
import { createEffect, createMemo, onCleanup } from "solid-js";
import { searchLetters } from "./SearchInput";
import { reloadImages } from "./image-source";
import { clearLogoCache, palette } from "./visuals";
import { createSettingsScene } from "./settings-scene";

import { createLiveMenu } from "./menus/live";
import { createCardMenu } from "./menus/card";
import { createPlayerActivation } from "./activation/player";
import { createSeasonPicker } from "./activation/seasons";
import { sourceActionOptions } from "./source-picker/options";

import { KeyboardView } from "./KeyboardView";
import {
  edgeRequest,
} from "./channelWindow";
import { createKeyboardInput } from "./input/keyboard";
import { createPlayerMediaKeys } from "./input/player-media";
import { installWindowInputs } from "./input/window-bindings";
import { defineScreen } from "../runtime";
import {
  RemoteTvApi,
} from "./api";
import {
  liveNoSourceActions,
} from "./liveEmpty";
import {
  applyScreenInset,
  screenSaverMinutes
} from "./display";
import { createIdleScreenSaver } from "./idle-screen-saver";
import { createTextKeyboard } from "./text-keyboard";
import { createHeldSelect } from "./held-select";
import { createSourcePlayScene } from "./source-play-scene";
import { createBackScene } from "./back-scene";
import { publishTestSurface } from "./debug-surface";
import { createMenuScene } from "./menu-scene";
import { createActivateScene } from "./activate-scene";
import { createKeyboardScene, createMoveScene, createRootInput } from "./input-scene";
import { RootScreen } from "./render/root";
import { createTvState } from "./state";
import { createAppEffects } from "./app-effects";
import { createRevisionApply } from "./revision-apply";
import { createTextEntry } from "./text-entry";
import { createProfileEntry } from "./profile-entry";
import { createAppModel } from "./app/model";
import { createAppScenes } from "./app/scenes";
import { exitTizen } from "../platform/tizen-host";
import { channelKey } from "./channelWindow";
import { createOverlayController } from "./overlay-controller";
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
  type LivePage,
} from "./types";

const available = (value?: { availability: string }) =>
  value?.availability === "Available";

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
      page, setPage,   catalog,    selected, 
      pairing,  pairingDeadline,  pairingFocused, setPairingFocused,
      signedIn,  qr,  accountEmail,  canManageAccount, setCanManageAccount,
      snapshot,  showControls, setShowControls,  setPauseRequested,
      seek, setSeek, seeking, setSeeking, trackColumn, setTrackColumn,
      activeAction, setActiveAction, activeChannel, setActiveChannel, activeSource, setActiveSource,
      openingSource, setOpeningSource, captionOverride,   setSaved,
      episodeState,  countdownState,  advancing, setAdvancing,
      notice, calibrationValue, setCalibrationValue,
    } = tv;
    const model = createAppModel();
    const {
      home, setHome, management, setManagement, setNavigation, library, 
      preferences, setPreferences, navs, navIndex, canManageProfiles, searchCapabilities,
      homeRowFocus, contentFocus,
    } = model;
    const { text, setText, key, setKey, upper: keyboardUpper, setUpper: setKeyboardUpper,
      symbols: keyboardSymbols, setSymbols: setKeyboardSymbols, characters: keyboardCharacters } = createTextKeyboard();
    const overlays = createOverlayController({
      focus: {screen, capture: () => ({zone: zone(), column: column(), row: row(), choice: choice()}), selection: choice,
        select: index => { setChoice(index); }, restore: focus => { setZone(focus.zone); setColumn(focus.column); setRow(focus.row); setChoice(focus.choice); }},
      text: {clear: () => { setText(""); }, begin: initial => { setKeyboardUpper(false); setKeyboardSymbols(false); setText(initial); setKey(0); }},
      errors: {clear: () => { setError(""); }, restore: () => { setError(screen() === "player" ? playbackError() : ""); }},
    });
    const {current: overlay, entered: overlayEntered, closing: overlayClosing, open: openOverlay, reportSettled: reportOverlaySettled} = overlays;
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
    // Created near the end of the closure, where the things a revision
    // re-requests all exist; the shell only holds a reference to it.
    let revisionApply: ReturnType<typeof createRevisionApply> | undefined;
    const applyRevision = (fresh: Bootstrap, signal: AbortSignal, profile: string, commit: () => void) =>
      revisionApply!.applyRevision(fresh, signal, profile, commit);
    // The input layer owns the hold; the scenes only need to cancel it.
    let cancelHold: () => void = () => {};
    const scenes = createAppScenes({
      api, platform, initialLoading: options.initialLoading, tv, model, overlays, screenSaver,
      cancelHold: () => cancelHold(), play: (source, direct, manual) => playSource(source, direct, manual),
      applyRevision: (fresh, signal, profile, commit) => applyRevision(fresh as never, signal, profile, commit),
      settingsTabIndex: label => settingsTabIndex(label),
      loadSettings: (tab, signal) => loadSettings(tab, signal),
      hideControls: () => hideControls(), playIntent: (...args) => playIntent(...args),
      resetSettings: () => settings.reset(), prompt: (...args) => edit(...args),
      more: () => more(), adoptChannelWindow: (pages, searching) => adoptChannelWindow(pages, searching),
      cancelPlay: () => sourcePlay.intents.next(), exitApp: () => exitTizen(),
    });
    const {
      activateCatalog, activateSources, activeSearchRow, activeSegment, advanceEpisode, applyBootstrap, applyLibrary, beginPairing,
      browseQuery, calendar, calendarDay, calendarDayEntries, calendarDaysList, calendarEntry, channels, chooseLibrary,
      chrome, clearProfileView, contentRow, controlsTimer, countdown, currentProgram, detail, detailActionLabel,
      detailColumn, detailCursor, detailEpisodes, detailForDisplay, detailHasEpisodes, detailPlayProgress, detailRow, detailTarget,
      dismissNext, displayHero, displayedFeatured, failedSources, finishSignIn, focusedCard, focusedSource, fontsReady,
      gridColumns, gridCount, gridOffset, gridStart, groups, guideRowStart, guideStart, guideWindow,
      hero, heroCycle, heroIntentCard, heroLogoBox, heroPresentation, heroSlide, hidePlayerControls, history,
      interruptHero, invalidateHistory, isSaved, libraryApplying, libraryControlCount, libraryDefaultQuery, libraryFilters, librarySort,
      libraryType, liveChannelIndex, liveEmptyFocus, liveFailure, liveGroup, liveIdentity, livePages, liveRecovery,
      liveScene, liveSpread, liveViewer, loadHomePage, moreChannels, moveChannel, moveSearchRow, moveToItem,
      navigate, openDetail, openTracks, paging, picker, pickerCard, player, playerActions,
      playerButtons, playerScene, playerTools, programs, refreshDetail, refreshPlaybackSegments,  rememberContentFocus,
      rememberHomeRow, rememberSearchRow, replaceHome, resetScope, restartHeroCycling, restartPaging, restorePrevious, retry,
      revealEndedControls, savedList, scopeSignal, search, searchChannelError, searchChannelPages, searchChannelPaging,
      searchChannels, searchChannelsPending, searchError, searchMediaPending, searchNeedsRetry, searchResults, searchRowIndex, searchRowPositions,
      searchScene, seasonIndex, segments, session, setCalendarDay, setCalendarEntry, setDetail, setHeroVisible,
      setSeasonIndex, setProgramIndex, setSourceActionChoice, setSourceActions, setSourceFacet, setSourceFilterFocus, setSourceMenu, setSourceMenuChoice, setTimelineFocused,
      shelfTitleY, shell, skipEnabled, skipStage, sourceActionChoice, sourceActions, sourceAddonCount, sourceChannel,
      sourceFacet, sourceFilterFocus, sourceLoading, sourceMenu, sourceMenuChoice, sourceMenuOptions, sourcePage, sourceProviderFilter,
      sourceProviderValue, sourceProviders, sourceQualityValue, sourceSpread, sources, timelineFocused,  updateSearch,
      visibleSources, detailPager, catalogPager, fail, notify, call, run, deviceScope, setRetry,
      rememberDetailFocus, closeOverlay, dismissOverlay, confirmExit, start, setLiveIdentity,
      setPrograms, devicePlayback, detailFocus, searchFocus, revisions, replacePage, loadLibrary,
    } = scenes;
    const searchMediaFocus = searchFocus.media.get;
    const searchChannelFocus = searchFocus.channel.get;
    const playerTransport = playerScene.transport;

    function adoptChannelWindow(pages: LivePage[], searching = false) {
      const values = pages.flatMap((page) => page.channels);
      if (searching) {
        searchScene.setChannelPages(pages);
        searchScene.setChannels(values);
        return;
      }
      liveScene.setPages(pages);
      // Channels accumulate across the traversed range so the global focus
      // index stays stable as the bounded render window slides underneath. A
      // reset clears them; a reload adopts revised server data for ids already
      // present and appends genuinely new channels.
      liveScene.setChannels((current) => {
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
        remembered: searchChannelFocus, remember: index => {searchFocus.channel.set(index);}, move: step => moveChannel(step, true)}});
    const navigateLive = createLiveNavigation({focus: navigationFocus,
      emptyActions: () => liveSpread() === "no-source" ? liveNoSourceActions(liveViewer()).length : liveRecovery().length,
      navIndex: () => navIndex("live"), channels: () => channels().length, groups: () => groups().length,
      programs: {set: setProgramIndex, count: () => programs()[channels()[column()]?.id]?.length ?? 1}, moveChannel: step => moveChannel(step, false)});
    const navigateContent = createContentNavigation({screen, focus: navigationFocus, navIndex, libraryControls: libraryControlCount,
      catalogFilters: () => (catalog()?.controls.length ?? 0) > 0,
      content: {count: () => screen() === "detail" ? detailHasEpisodes() ? detailEpisodes().length : detail()?.recommendations.length ?? 0 : page().cards.length,
        columns: () => screen() === "live" ? 1 : screen() === "search" ? 5 : screen() === "detail" ? 4 : 7,
        cursor: () => page().next_cursor, remembered: () => contentFocus.resolve(contentRow())},
      search: {needsRetry: searchNeedsRetry, remember: index => {searchFocus.media.set(index);}},
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
      progressFreshness: shell.progressFreshness, progressRefresh: shell.progressRefresh, refreshDetail, player, cardKey,
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
