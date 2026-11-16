/** @jsxImportSource @solidtv/solid */
import type { Overlay } from "./app-types";
import { runtimeObserver } from "../platform/runtime-observation";
import { exitTizen } from "../platform/tizen-host";
import { DevicePlayback, deviceProfileKey, deviceTitleKey } from "./device-playback";
import { AutoplayCountdown } from "./autoplay-countdown";
import { Show, batch, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { searchLetters } from "./SearchInput";
import { reloadImages } from "./image-source";
import { clearLogoCache } from "./visuals";
import { createCalendarScene } from "./calendar-scene";
import { createSettingsScene } from "./settings-scene";
import { LiveScreen } from "./render/live";
import { PlayerChrome } from "./render/player";
import { BrowseScreen } from "./render/browse";
import { EntryScreensView } from "./render/entry";
import { ProfilesView } from "./render/profiles";
import { CalendarView } from "./render/calendar";
import { HomeView } from "./render/home";
import { DetailView } from "./render/detail";
import { AppOverlays, IdleSaver } from "./render/overlays";
import { RowFocus } from "./row-focus";

import { SettingsView } from "./SettingsView";
import { createProgressFreshness } from "./progress-freshness";
import { createRevisionPoller } from "./session/revisions";
import { createLiveMenu } from "./menus/live";
import { createLiveScene } from "./live-scene";
import { createCardMenu } from "./menus/card";
import { createPlayerActivation } from "./activation/player";
import { createSeasonPicker } from "./activation/seasons";
import { sourceActionOptions } from "./source-picker/options";
import { TopNavigation } from "./TopNavigation";
import { availableNavigation } from "./navigation-model";

import { KeyboardView } from "./KeyboardView";
import { HeroArtwork } from "./CoherentHero";
import { presentationKey } from "./presentation-card";
import { STREMIO_ONLY, stremioHome } from "./stremio-home";
import {
  channelKey,
  edgeRequest,
} from "./channelWindow";
import { applyCaptionAppearance } from "./player/caption-appearance";
import { createKeyboardInput } from "./input/keyboard";
import { createTextInput, type TvTextInputEvent } from "./input/text";
import { createNativeTextEditing, nativeTextDialogOverlay, type NativeTextPort, type NativeTextTarget } from "./input/native-text";
import { createPlayerMediaKeys } from "./input/player-media";
import { installWindowInputs } from "./input/window-bindings";
import { createTrackPicker } from "./player/tracks";
import { skipLabel } from "./player/skip-intro";
import { createPlayerChrome } from "./player-chrome";
import { createPlaybackSegments } from "./player/segments";
import { defineScreen, TvView } from "../runtime";
import { palette } from "./visuals";
import {
  RemoteTvApi,
  lookupSelector,
  RemoteError,
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
import { createSessionScene, playbackRevisionKey } from "./session-scene";
import { publishTestSurface } from "./debug-surface";
import { createMenuScene } from "./menu-scene";
import { createActivateScene } from "./activate-scene";
import { createKeyboardScene, createMoveScene } from "./input-scene";
import { createTvState } from "./state";
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
  type Page,
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
      loading, setLoading, error, setError, playbackError, setPlaybackError, pending, setPending,
      screen, setScreen, zone, setZone, column, setColumn, row, setRow, heroAction, setHeroAction, choice, setChoice,
      page, setPage, controls, setControls, catalog, setCatalog, filters, setFilters, selected, setSelected,
      pairing, setPairing, pairingDeadline, setPairingDeadline, pairingFocused, setPairingFocused,
      signedIn, setSignedIn, qr, setQr, accountEmail, setAccountEmail, canManageAccount, setCanManageAccount,
      snapshot, setSnapshot, showControls, setShowControls, pauseRequested, setPauseRequested,
      seek, setSeek, seeking, setSeeking, trackColumn, setTrackColumn,
      activeAction, setActiveAction, activeChannel, setActiveChannel, activeSource, setActiveSource,
      openingSource, setOpeningSource, captionOverride, setCaptionOverride, saved, setSaved,
      episodeState, setEpisodeState, countdownState, setCountdownState, advancing, setAdvancing,
      playbackRevision, setPlaybackRevision, deviceRevision, setDeviceRevision,
      sourceMemoryPending, setSourceMemoryPending, notice, setNotice, calibrationValue, setCalibrationValue,
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
      api, scope: () => scope, screen, setScreen, setRow, zone, column, setZone, setColumn,
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
    async function checkPlaybackRevision() {
      const value = await call<Record<string, number | string>>(api.scoped("/revisions"));
      if (playbackRevisionKey(value) === playbackRevision()) return;
      const fresh = await api.preferences(scope.signal);
      batch(() => { setPreferences(fresh);setPlaybackRevision(playbackRevisionKey(value)); });
    }
    const [, setPresentationRevision] = createSignal(0);
    const devicePlayback = new DevicePlayback(undefined, () => setDeviceRevision(v => v + 1));
    const deviceScope = () => deviceProfileKey(api.origin, api.profile);
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
      choice, setChoice, screen, signal: () => scope.signal, fail: error => fail(error), notify: message => notify(message), setLoading,
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
    let scope = new AbortController(),
      alive = true,
      noticeTimer: ReturnType<typeof setTimeout> | undefined,
      controlsTimer: ReturnType<typeof setTimeout> | undefined;
    let retry: () => void = () => void start(),
      searchMediaFocus = 0,
      searchChannelFocus = 0,
      pageGeneration = 0;
    const revisions = createRevisionPoller({ready: () => !!api.profile && document.visibilityState === "visible" && !(screen() !== "player" && overlay()) && !pending(),
      playing: () => screen() === "player", blocked: () => !!overlay() || pending(), alive: () => alive,
      profile: () => api.profile, signal: () => scope.signal, read: signal => call<Record<string, number | string>>(api.scoped("/revisions"), "GET", undefined, signal),
      bootstrap: signal => api.bootstrap(signal), playback: checkPlaybackRevision,
      reset: () => session.resetScope(), adoptBootstrap: value => session.applyBootstrap(value),
      apply: applyRevision, fail: error => fail(error)});
    const scheduleRevisions = revisions.schedule;
    const [progressFreshness, setProgressFreshness] = createSignal(0);
    const progressRefresh = createProgressFreshness({
      owner: () => JSON.stringify([api.origin, api.profile, api.scopeEpoch]), alive: () => alive,
      changed: () => setProgressFreshness(value => value + 1),
      failure: error => { if (error instanceof RemoteError && [401, 403].includes(error.status)) fail(error); },
    });
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
      screen, zone, row, column, setColumn, parent: () => scope,
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
    const call = <T,>(
      path: string,
      method = "GET",
      body?: unknown,
      signal: AbortSignal = scope.signal,
    ) => api.call<T>(path, method, body, signal);
    const playerScene = createPlayerScene({
      api, platform, video: () => document.getElementById("tv-video") as HTMLVideoElement,
      snapshot, setSnapshot, setPauseRequested, screen, home, preferences, deviceScope, devicePlayback,
      notify: message => notify(message), fail: error => fail(error), retry: work => { retry = work; },
      openingSource: () => openingSource(), overlay: () => overlay(), setShowControls, showControls, setChoice,
      hideControls: () => hideControls(), activeAction, activeChannel, setPresentationRevision,
      sourceMemoryPending, setSourceMemoryPending, episodeKey, deviceTitleKey,
      playIntent: (...args) => playIntent(...args), checkPlaybackRevision: () => checkPlaybackRevision(),
      countdown, episodeState, setEpisodeState, advancing, setAdvancing, overlays, openOverlay,
      playbackRevision, sourceLoading, loading, error, scopeSignal: () => scope.signal, detail: () => detail(),
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
      signal: () => scope.signal,
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
    const notify = (message: string) => {
      setNotice(message);
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => setNotice(""), 3500);
    };
    const fail = (e: unknown) => {
      if (!alive || (e instanceof DOMException && e.name === "AbortError"))
        return;
      if (e instanceof RemoteError && e.status === 401) {
        revisions.stop();
        api.retireProfile();
        resetScope();
        void player.stop().catch(() => {});
        clearProfileView();
        setScreen("welcome");
        retry = () => void start();
      }
      setError(e instanceof Error ? e.message : "Couldn’t load. Try again.");
      if (
        screen() === "player" &&
        !["playing", "paused"].includes(snapshot()?.state ?? "")
      )
        setPlaybackError(error());
      setLoading(false);
    };
    const run = async (work: () => Promise<void>) => {
      if (pending() || overlayClosing()) return;
      setPending(true);
      setError("");
      retry = () => void run(work);
      try {
        await work();
      } catch (e) {
        fail(e);
      } finally {
        if (alive) setPending(false);
      }
    };
    createEffect(() => {
      const value = home(),
        active = screen() === "home",
        signal = scope.signal;
      let timer: ReturnType<typeof setTimeout> | undefined,
        cancelled = false;
      if (value && !value.complete && active) {
        const refresh = async () => {
          try {
            const next = await api.home(signal);
            if (!cancelled) replaceHome(stremioHome(next));
          } catch (error) {
            if (!cancelled && !(error instanceof DOMException)) {
              if (error instanceof RemoteError && error.status === 401)
                fail(error);
              else timer = setTimeout(refresh, 5000);
            }
          }
        };
        timer = setTimeout(refresh, 2000);
      }
      onCleanup(() => {
        cancelled = true;
        clearTimeout(timer);
      });
    });
    // The scene is created below; the progress refresh only calls this later.
    const refreshDetail = (...args: Parameters<typeof detailScene.refresh>) => detailScene.refresh(...args);
    createEffect(() => {
      progressFreshness();
      const view = screen(), signal = scope.signal, profile = api.profile;
      if (!profile || pending() || overlay()) return;
      if (view === "home") progressRefresh.refresh("home", signal, false, async current => {
        const value = await api.home(signal);
        if (!current() || scope.signal !== signal || screen() !== "home") return false;
        replaceHome(stremioHome(value));
        return true;
      });
      else if (view === "detail" && selected()) {
        const key = cardKey(selected()!) + ":" + seasonIndex();
        progressRefresh.refresh("detail:" + key, signal, true, async current => {
          let committed = false;
          await refreshDetail(signal, profile, () => { committed = true; }, current);
          return committed;
        });
      }
    });
    async function applyRevision(fresh: Bootstrap, signal: AbortSignal, profile: string, commit: () => void) {
        const focusedNav =
          zone() === "nav" ? navs()[column()]?.id : undefined;
        setNavigation(fresh.navigation);
        if (
          ["movie", "series", "anime", "search", "live", "calendar", "library"].includes(
            screen(),
          ) &&
          !navs().some((item) => item.id === screen())
        ) {
          resetScope();
          applyBootstrap(fresh);
          return;
        }
        if (focusedNav)
          setColumn(
            navIndex(
              navs().some((item) => item.id === focusedNav)
                ? focusedNav
                : "home",
            ),
          );
        restartPaging();
        invalidateHistory();
        setManagement(fresh.profile_management);
        setPreferences(fresh.preferences ?? undefined);
        replaceHome(stremioHome(fresh.home ?? undefined));
        setSaved(new Map());
        const view = screen();
        if (view === "library") replacePage(await loadLibrary("0", signal));
        else if (view === "movie" || view === "series" || view === "anime")
          replacePage(await api.discover(browseQuery(), signal));
        else if (view === "search" && search()) updateSearch(search(), true);
        else if (view === "detail" && selected()) {
          await refreshDetail(signal, profile, commit);
          return;
        } else if (view === "settings")
          await loadSettings(settingsTab(), signal);
        else if (view === "live") {
          await liveScene.refresh(signal, commit);
          return;
        }
        // Commit only after the dependent feature reads succeeded, before yielding.
        commit();
    }
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
      overlayVisible: () => !!overlay(), pending, signal: () => scope.signal, profile: () => api.profile,
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
      api, parent: () => scope, screen, zone, column, setZone, setColumn, capabilities: searchCapabilities,
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
      abortScope: () => scope.abort(), newScope: () => (scope = new AbortController()).signal,
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
    function focusIndex(
      cards: Card[],
      key: string | undefined,
      fallback: number,
    ) {
      const index =
        key === undefined
          ? -1
          : cards.findIndex((card) => cardKey(card) === key);
      return index >= 0
        ? index
        : Math.max(0, Math.min(fallback, cards.length - 1));
    }
    function replacePage(value: Page) {
      rememberContentFocus();
      const previousColumn = screen() === "search" ? column() : contentColumn();
      const focused = page().cards[previousColumn];
      const index = focusIndex(
        value.cards,
        focused ? cardKey(focused) : undefined,
        previousColumn,
      );
      batch(() => {
        setPage(value);
        contentFocus.remember(contentRow(), index);
        if (zone() === "content") setColumn(index);
      });
      const modal = overlay();
      if (modal?.kind === "tracks") setChoice(Math.max(0,modal.columns[0]?.items.findIndex(item=>item.value==="✓") ?? 0));
    }
    async function loadLibrary(
      cursor = "0",
      signal = scope.signal,
      values = library()?.query ?? {},
    ) {
      const value = await api.library(cursor, signal, values);
      setLibrary(value);
      return value;
    }
    const {type: libraryType, sort: librarySort, filters: libraryFilters, defaults: libraryDefaultQuery,
      count: libraryControlCount, applying: libraryApplying, apply: applyLibrary, choose: chooseLibrary} = createLibraryControls({
        current: library, selection: {current: choice, set: setChoice}, dialogs: {open: openOverlay, close: closeOverlay},
        apply: async values => { const value = await loadLibrary("0", restartPaging(), values); replacePage(value); },
      });
    function replaceHome(value: Home | undefined) {
      rememberHomeRow();
      const shelf = home()?.rows[row()],
        focused = shelf?.cards[column()];
      const nextRow = Math.max(
        0,
        value?.rows.findIndex((row) => row.id === shelf?.id) ?? 0,
      );
      const nextColumn = focusIndex(
        value?.rows[nextRow]?.cards ?? [],
        focused ? cardKey(focused) : undefined,
        column(),
      );
      batch(() => {
        setHome(value);
        const nextFocused = value?.rows[nextRow]?.cards[nextColumn];
        if (zone() !== "rows" || !nextFocused || !previewCard() || presentationKey(previewCard()!) !== presentationKey(nextFocused))
          setPreviewCard(undefined);
        clampCycle();
        if (screen() === "home" && zone() === "rows") {
          setRow(nextRow);
          setColumn(nextColumn);
        }
      });
      const modal = overlay();
      if (modal?.kind === "tracks") setChoice(Math.max(0,modal.columns[0]?.items.findIndex(item=>item.value==="✓") ?? 0));
    }
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
      player: { stop: () => player.stop() }, signal: () => scope.signal,
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
    const {query: browseQuery, activate: activateCatalog} = createCatalogControls({screen, stremioOnly: STREMIO_ONLY, catalog, controls, selectCatalog: setCatalog, prompt: edit,
      filters: {current: filters, set: setFilters}, page: setPage, loading: setLoading, column: setColumn, restart: restartPaging,
      discover: (values, signal) => api.discover(values, signal), dialogs: {open: openOverlay, close: closeOverlay}});
    if (new URLSearchParams(location.search).has("perfdebug")) {
      const target = window as Window & {
        __viptvRemoteMetrics?: () => Record<string, number>;
      };
      target.__viptvRemoteMetrics = () => ({
        guideSnapshots: Object.keys(programs()).length,
        guideRequestsInFlight: liveScene.guides.inFlight(),
        catalogCards: page().cards.length,
        // The payload metrics measure the bounded retained render window,
        // not the accumulated focus list, which legitimately spans every
        // traversed channel.
        livePayloadPages: livePages().length,
        livePayloadChannels: livePages().reduce(
          (sum, page) => sum + page.channels.length,
          0,
        ),
        searchPayloadPages: searchChannelPages().length,
        searchPayloadChannels: searchChannelPages().reduce(
          (sum, page) => sum + page.channels.length,
          0,
        ),
        homeCards: (home()?.rows ?? []).reduce(
          (sum, row) => sum + row.cards.length,
          0,
        ),
        historyEntries: history.length,
      });
      onCleanup(() => {
        delete target.__viptvRemoteMetrics;
      });
    }
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
      deviceScope, deviceTitleKey, sourceChannel, signal: () => scope.signal,
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
    function edit(
      title: string,
      submit: (value: string) => Promise<void>,
      initial = "",
      secret = false,
    ) {
      openOverlay(
        {
          kind: "text",
          title,
          initial,
          secret,
          numeric: secret && title.endsWith("PIN"),
          submit,
        },
        true,
      );
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
        if (alive) setLiveIdentity(value);
      });
    });
    const settings = createSettingsScene({
      api, call, run, fail, retry: work => { retry = work; }, dialogs: { open: openOverlay, close: closeOverlay, dismiss: dismissOverlay },
      prompt: edit, notify, screen, setScreen, loading: setLoading,
      preferences, adoptPreferences: setPreferences, accountEmail,
      management, setManagement, canManageAccount, setCanManageAccount,
      devicePlayback, deviceScope, scope: () => scope.signal,
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
    async function selectProfile(index: number) {
      const profile = management()?.profiles[index];
      if (!profile) {
        if (!available(management()?.capabilities.create)) {
          await run(refreshProfiles);
          return;
        }
        edit("Profile name", async (name) => {
          await call("/api/profiles", "POST", { name });
          await refreshProfiles();
          closeOverlay();
        });
        return;
      }
      if (profile.selection_requires_parent) {
        edit(
          "Parent PIN",
          async (pin) => {
            await call("/api/parent/unlock", "POST", { pin });
            await refreshProfiles();
            closeOverlay();
            await selectProfile(index);
          },
          "",
          true,
        );
        return;
      }
      await run(async () => {
        await player.stop();
        resetScope();
        history.length = 0;
        setHome(undefined);
        setPage({ cards: [], complete: true });
        setDetail(undefined);
        setPrograms({});
        applyBootstrap(await api.selectProfile(profile.id, scope.signal));
      });
    }
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
      details: card => api.detail(card, "0", scope.signal), dialogs: {open: openOverlay}});
    const chooseSeason = createSeasonPicker({current: detail, adopt: setDetail, season: {current: seasonIndex, set: setSeasonIndex},
      focus: navigationFocus, choice: setChoice, loading: setLoading, rememberedEpisode: () => detailFocus.resolve(detailRow("episodes")), restart: restartPaging,
      request: (card, cursor, signal) => api.detail(card, cursor, signal), open: openOverlay, close: closeOverlay});
    const activateScene = createActivateScene({
      api, signal: () => scope.signal, screen, zone, column, row, choice, key, heroAction,
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
      nativeTextPort: () => nativeTextPort,
      nativeTextEditing: () => nativeTextEditing ? { open: (target: unknown) => nativeTextEditing!.open(target as never) } : undefined,
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
    createEffect(() => {
      snapshot(); // Decoder lease updates trigger the appearance effect.
      const override = captionOverride();
      const appearance =
        override?.leaseId === player.leaseId
          ? override?.appearance
          : player.subtitleAppearance;
      const preferencesValue = preferences()?.preferences;
      applyCaptionAppearance(appearance, preferencesValue);
    });
    // Roku's native host mounts the shared root without running the app
    // component's onMount in some launch paths. Start boot from a one-shot
    // effect so the same component drives web and Roku.
    let bootRequested = false;
    createEffect(() => {
      if (bootRequested) return;
      bootRequested = true;
      if (options.autoStart !== false) void start();
    });
    const applyTextInput = createTextInput({screen, overlay, zone, text: setText, query: search, search: updateSearch,
      done: () => completeTextInput(overlay()?.kind === "text")});
    function textInput(event: TvTextInputEvent) {
      if (handleIdleInput()) { event.preventDefault(); return; }
      applyTextInput(event);
    }
    const nativeTextPort = (globalThis as {__viptvNativeTextEntry?: NativeTextPort}).__viptvNativeTextEntry;
    const nativeTextEditing = nativeTextPort && createNativeTextEditing(nativeTextPort);
    function nativeTextTarget(): NativeTextTarget | undefined {
      const modal = nativeTextDialogOverlay(overlay());
      if (screenSaver() || overlayClosing() || !modal) return;
      const epoch = api.scopeEpoch;
      const current = () => !screenSaver() && !overlayClosing() && overlay() === modal && api.scopeEpoch === epoch;
      return {key: modal, title: modal.title, value: text(), numeric: modal.numeric, secret: modal.secret,
        maximumLength: modal.numeric ? 8 : 2048, confirm: "Done",
        write: value => {if (current()) textInput({inputType: "insertReplacementText", data: value, preventDefault() {}});},
        done: () => {if (current()) completeTextInput(true);},
        cancel: () => {if (current()) dismissOverlay();},
        failed: () => {if (current()) notify("Native keyboard unavailable. Use the on-screen keys.");}};
    }
    createEffect(() => nativeTextEditing?.sync(nativeTextTarget()));
    onCleanup(() => nativeTextEditing?.dispose());
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
      alive = false;
      playerTransport.retire();
      heldSelect.cancel();
      playerNavigation.cancel();
      overlays.dispose();
      scope.abort();
      settingsAbort();
      picker.operation.get()?.abort();
      revisions.stop();
      clearTimeout(noticeTimer);
      clearTimeout(searchScene.requests.timer);
      clearTimeout(controlsTimer);
      void player.dispose();
    });
    function keyboard(isModal = false) {
      return <KeyboardView numeric={!!(isModal && overlay()?.kind === "text" && (overlay() as Extract<Overlay, { kind: "text" }>).numeric)}
        modal={isModal} letters={keyboardCharacters()} upper={keyboardUpper()} symbols={keyboardSymbols()} selected={key()} />;
    }
    const Root = defineScreen({
      input: {
        left() {
          countdown.cancel();
          if (handleIdleInput()) return;
          return move(-1, 0);
        },
        right() {
          countdown.cancel();
          if (handleIdleInput()) return;
          return move(1, 0);
        },
        up() {
          countdown.cancel();
          if (handleIdleInput()) return;
          move(0, -1);
        },
        down() {
          countdown.cancel();
          if (handleIdleInput()) return;
          move(0, 1);
        },
        back(event?: KeyboardEvent) {
          if (event?.repeat) return;
          countdown.cancel();
          if (handleIdleInput()) return;
          void back().catch(fail);
        },
        menu() {
          playerNavigation.cancel();
          countdown.cancel();
          if (handleIdleInput()) return;
          menu();
        },
        enter(event?: KeyboardEvent) {
          playerNavigation.cancel();
          countdown.cancel();
          if (revealEndedControls()) return undefined;
          if (handleIdleInput()) return;
          // A held Enter auto-repeats; only the first keydown arms the hold
          // timer, so repeats must not reset it or the 700ms menu never fires.
          if (event?.repeat) return undefined;
          restartHeroCycling();
          if (overlay()?.kind === "sources") picker.manual.set(true);
          return heldSelect.press();
        },
      },
      render: () => {
        return (
        <TvView
          w={1920}
          h={1080}
          color={
            ["player", "home", "detail"].includes(screen())
              ? "rgba(0,0,0,0)"
              : palette.bg
          }
        >
          <TvView w={1920} h={1080} show={!screenSaver()}>
          <TvView
            w={1920}
            h={1080}
            show={!profileEditor() && overlay()?.kind !== "text"}
          >
            {/* The player is a native SceneGraph Video plane under the app's
                native text/visual layers. Hide the page behind it so stale
                artwork cannot cover the video. */}
            <TvView w={1920} h={1080} show={screen() !== "player" && !screenSaver()}>
            <HeroArtwork presentation={heroPresentation}
              logoBox={heroLogoBox()}
              dim={screen() === "detail" && ["episodes","seasons","recommendations"].includes(zone())
                ? typeof (globalThis as any).__SolidTVRokuRenderer !== "undefined" ? .35 : .5 : 0} />
            <Show
              when={
                ![
                  "welcome",
                  "pairing",
                  "signed-in",
                  "profiles",
                  "player",
                  "settings",
                ].includes(screen()) &&
                screen() !== "detail"
              }
            >
              <TopNavigation items={navs()} screen={screen()} selected={zone() === "nav" ? column() : undefined}
                profile={management()?.profiles.find(profile => profile.id === api.profile)} fontReady={fontsReady()} />
            </Show>
            <EntryScreensView screen={screen()} entry={{ loading: loading(), focused: !loading() && !error() }}
              pairing={pairing()} pairingQr={qr()} pairingDeadline={pairingDeadline()}
              pairingFocused={pairingFocused() && !loading() && !error()}
              signedIn={signedIn()} onSignedIn={finishSignIn} />
            <ProfilesView screen={screen()} profiles={{ profiles: management()?.profiles ?? [],
              create: available(management()?.capabilities.create), manage: canManageProfiles(),
              index: column(), zone: zone(), loading: loading() }} />
            <CalendarView screen={screen()} board={{ entries: calendar()?.entries ?? [], days: calendarDaysList(),
              day: calendarDay(), active: calendarEntry(), dayFocused: zone() === "calendar-days",
              listFocused: zone() === "calendar-list", watchFocused: zone() === "calendar-watch",
              loading: loading(), error: error() }} />
            <HomeView screen={screen()} content={{ home: home(), hasHero: !!hero(),
              presentation: {card: displayHero, mode: heroPresentation.mode},
              focus: {zone, row, column, action: heroAction},
              billboard: {slide: () => Math.max(0, displayedFeatured()), started: heroCycle.started,
                active: () => heroCycle.active() && heroCycle.animated()},
              shelfTop: shelfTitleY(), columnForRow: shelf => homeRowFocus.resolve(shelf), isSaved }} />
            <DetailView screen={screen()} content={{ detail: detailForDisplay(),
              hasEpisodes: detailHasEpisodes(), episodes: detailEpisodes(), zone: zone(), column: column(),
              heroAction: heroAction(), seasonIndex: seasonIndex(), episodeColumn: detailColumn("episodes"),
              recommendationColumn: detailColumn("recommendations"), actionLabel: detailActionLabel(),
              progress: detailPlayProgress(),
              saved: !!detailForDisplay() && isSaved(detailForDisplay()!.item) }} />
            <BrowseScreen screen={screen()} zone={zone} column={column} key={key} search={search}
              searchCapabilities={searchCapabilities()} searchResults={searchResults()} searchError={searchError}
              library={library()} libraryType={libraryType()} librarySort={librarySort()} libraryFilters={libraryFilters()}
              catalog={catalog()} page={page()} loading={loading}
              grid={{start: gridStart, count: gridCount, columns: gridColumns, offset: gridOffset}}
              gridFocus={{active: () => zone() === "content", index: column}}
              gridSearch={{channels: () => searchCapabilities().channels, pending: searchMediaPending, retry: searchNeedsRetry, query: search}}
              searchRowIndex={searchRowIndex()} searchMediaFocus={searchMediaFocus} searchMediaPending={searchMediaPending}
              searchNeedsRetry={searchNeedsRetry}
              searchRemembered={id => searchRowPositions.resolve(searchResults().rows.find(shelf => shelf.id === id))}
              searchChannels={searchChannels()} hasPreviousChannelPage={!!edgeRequest(searchChannelPages(), "previous")}
              searchChannelFocus={searchChannelFocus}
              searchChannelsPending={searchChannelsPending()} searchChannelPaging={searchChannelPaging()}
              searchChannelError={searchChannelError()} />
            <Show when={screen() === "live"}>
              <LiveScreen spread={liveSpread()} viewer={liveViewer()} emptyFocus={liveEmptyFocus()}
                pages={livePages()} recovery={liveRecovery()} failure={liveFailure()}
                channels={channels()} channelIndex={liveChannelIndex()} program={currentProgram()}
                groups={groups()} group={liveGroup()} zone={zone()} column={column} programs={programs()}
                guideRowStart={guideRowStart()} guideStart={guideStart()} guideNow={guideWindow().now} />
            </Show>
            <Show when={screen() === "settings"}>
              <SettingsView tabs={settingsTabs} tab={settingsTab()} items={settingsItems()}
                zone={zone()} column={column()} loading={loading()} />
            </Show>
            </TvView>
            <PlayerChrome screen={screen()} overlay={!!overlay()} advancing={advancing()}
              openingSource={!!openingSource()} showControls={showControls()} loading={loading()}
              seeking={seeking()} buffering={snapshot()?.state === "buffering"} skipStage={skipStage()}
              segment={activeSegment()} snapshot={snapshot} action={activeAction()} canSeek={() => playerActions().seek}
              tools={playerTools} choice={choice} timelineFocused={timelineFocused} preview={seek} />
          </TvView>
          <AppOverlays screen={screen()} openingSource={!!openingSource()} overlay={overlay()}
            entered={overlayEntered()} closing={overlayClosing()} settled={reportOverlaySettled}
            sourceLoading={sourceLoading()} pickerCard={pickerCard()} sources={sources()} visibleSources={visibleSources()}
            sourcePage={sourcePage()} sourceAddonCount={sourceAddonCount()} sourceMenu={sourceMenu()}
            sourceMenuOptions={sourceMenuOptions()} sourceMenuChoice={sourceMenuChoice()} sourceHeight={picker.height()}
            sourceProviderFilter={sourceProviderFilter()} sourceActions={sourceActions()} sourceActionChoice={sourceActionChoice()}
            focusedSource={focusedSource()} sourceFilterFocus={sourceFilterFocus()} sourceFacet={sourceFacet()}
            sourceFailure={picker.failure()} sourceSpread={sourceSpread()} sourceQualityValue={sourceQualityValue()}
            sourceProviderValue={sourceProviderValue()} failedSources={failedSources()} choice={choice()}
            profileEditor={profileEditor()} management={management()} trackColumn={trackColumn()} text={text()}
            keyboard={keyboard} activeAction={activeAction()} episode={episodeState().item} countdown={countdownState()}
            calibration={calibrationValue()} error={error()} notice={notice()} pending={pending()}
            paletteBg={palette.bg} />
        </TvView>
        <IdleSaver active={screenSaver()} featured={home()?.featured} slide={heroSlide()} />
        </TvView>
        );
      },
    });
    return <Root />;
  };
}
