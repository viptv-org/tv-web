/** @jsxImportSource @solidtv/solid */
import type { Screen, Item, Overlay } from "./app-types";
import { runtimeObserver } from "../platform/runtime-observation";
import { exitTizen } from "../platform/tizen-host";
import { DevicePlayback, deviceProfileKey, deviceTitleKey } from "./device-playback";
import { EpisodePreparation, episodeKey, type EpisodePreparationState } from "./episode-preparation";
import { AutoplayCountdown, type CountdownState } from "./autoplay-countdown";
import { Show, batch, createEffect, createMemo, createSignal, onCleanup, untrack, onMount } from "solid-js";
import {
 EntryScreen 
} from "./EntryScreens";
import {
 PairingScreen 
} from "./PairingScreen";
import {
 ProfilesScreen 
} from "./ProfilesScreen";
import {
 SignedIn 
} from "./SignedIn";
import {
 PosterWall 
} from "./PosterWall";
import {
 LibraryToolbar 
} from "./LibraryToolbar";
import { searchLetters } from "./SearchInput";
import {
 SearchChannels 
} from "./SearchChannels";
import { reloadImages } from "./image-source";
import { clearLogoCache } from "./visuals";
import { CalendarBoard, calendarDayKey, calendarDays } from "./CalendarBoard";
import { StatusDialog } from "./StatusDialog";
import { initialSeasonIndex, seasonEpisodes } from "./seasons";
import { RowFocus } from "./row-focus";
import { HomeContent } from "./HomeContent";

import { DetailContent } from "./DetailContent";
import { PlayerControlsView } from "./PlayerControlsView";
import { SettingsView } from "./SettingsView";
import { BrowseControls } from "./BrowseControls";
import { OverlayViewport } from "./OverlayViewport";
import { createLiveGuideController } from "./live/guide-controller";
import { LiveGuideGrid } from "./live/LiveGuideGrid";
import { LiveGroupSelector } from "./live/LiveGroupSelector";
import { LiveHero } from "./live/LiveHero";
import { SearchHeader } from "./SearchHeader";
import { CatalogGrid } from "./CatalogGrid";
import { SlidingDrawer } from "./SlidingDrawer";
import { SourceFooter } from "./source-picker/SourceFooter";
import { SourceActionsPanel } from "./source-picker/SourceActionsPanel";
import { SourceOptionsMenu } from "./source-picker/SourceOptionsMenu";
import { SourceHeading } from "./source-picker/SourceHeading";
import { SourceFilters } from "./source-picker/SourceFilters";
import { SourceList } from "./source-picker/SourceList";
import { createDetailRefresh } from "./detail-refresh";
import { createLiveRefresh } from "./live/revision-refresh";
import { createSearchController, type SearchRequests } from "./search/controller";
import { createPairingFlow } from "./session/pairing";
import { createRevisionPoller } from "./session/revisions";
import { createLiveMenu } from "./menus/live";
import { createCardMenu } from "./menus/card";
import { createPlayerActivation } from "./activation/player";
import { createSeasonPicker } from "./activation/seasons";
import { createSourceRows } from "./source-picker/rows";
import { createSourcePublisher } from "./source-picker/publisher";
import { createSourceActivation } from "./source-picker/activation";
import { createEpisodeDiscovery } from "./source-picker/prepare-episode";
import { createSourceIntent } from "./source-picker/intent";
import { startSourceCandidate } from "./source-picker/start-candidate";
import { sourceActionOptions, type SourceMenuOption } from "./source-picker/options";
import { TopNavigation } from "./TopNavigation";
import { ProfileEditorView } from "./ProfileEditorView";
import { availableNavigation } from "./navigation-model";

import { NextEpisodePanel } from "./NextEpisodePanel";
import { KeyboardView } from "./KeyboardView";
import { TextEntryPanel } from "./TextEntryPanel";
import { CalibrationPanel } from "./CalibrationPanel";
import { TracksDrawer } from "./TracksDrawer";
import { ChoiceDrawer } from "./ChoiceDrawer";
import { createCoherentHero, HeroArtwork } from "./CoherentHero";
import { presentationCard, presentationKey } from "./presentation-card";
import {
  channelKey,
  edgeRequest,
  type PageDirection
} from "./channelWindow";
import { applyCaptionAppearance } from "./player/caption-appearance";
import { createKeyboardInput } from "./input/keyboard";
import { createPlayerMediaKeys } from "./input/player-media";
import { installWindowInputs } from "./input/window-bindings";
import { createTrackPicker } from "./player/tracks";
import { defineScreen, TvView } from "../runtime";
import {
 exitWebos 
} from "../webos";
import { Button, Label, palette } from "./visuals";
import {
  RemoteTvApi,
  lookupSelector,
  RemoteError,
  query,
  segment,
  type AccountIdentity
} from "./api";
import {
  LIVE_EMPTY_COPY,
  LIVE_FILTERED_LINE,
  liveFailureBody,
  liveFilteredChip,
  liveKeepsToday,
  liveNoChannelsBody,
  liveNoSourceActions,
  liveRecoveryActions,
  liveViewerOf,
  pickLiveSpread,
  type LiveRecoveryAction,
} from "./liveEmpty";
import { LiveAnswer, LiveNoSource } from "./liveEmptyViews";
import { guideWindowOf } from "./guideWindow";
import {
  sourceEmptyCopy,
  sourceStatusCopy,
} from "./sourceStatus";
import {
  offersHouseholdWrite
} from "./refusals";
import {
 RemotePlayback 
} from "./playback";
import {
  applyDisplayPreferences,
  applyScreenInset,
  defaultDisplayPreferences,
  screenSaverMinutes
} from "./display";
import { createHeroCycle } from "./hero-cycle-controller";
import { createIdleScreenSaver } from "./idle-screen-saver";
import { createTextKeyboard } from "./text-keyboard";
import { createHeldSelect } from "./held-select";
import { createLibraryControls } from "./library/controls";
import { createChannelRefresh } from "./paging/channel-refresh";
import { createChannelPager } from "./paging/channel-pages";
import { createChannelMovement } from "./paging/channel-movement";
import { createDetailPager } from "./paging/detail";
import { createCatalogPager } from "./paging/catalog";
import { createHomePager } from "./paging/home";
import { createCatalogControls } from "./catalog-controls";
import { createProfileManagement } from "./profile-management";
import { createProfilePreferenceRows } from "./settings/profile-preferences";
import { createDevicePreferenceRows } from "./settings/device-preferences";
import { accountSettings } from "./settings/account";
import { createAddonSettings } from "./settings/addons";
import { createIntegrationSettings } from "./settings/integrations";
import { createParentSettings } from "./settings/parental";
import { createPreferenceControls } from "./preference-controls";
import { createOverlayController } from "./overlay-controller";
import { createDetailPresentation } from "./detail-presentation";
import { createSourcePresentation } from "./source-picker/presentation";
import { createLiveNavigation } from "./navigation/live";
import { createContentNavigation } from "./navigation/content";
import { createHeroNavigation } from "./navigation/hero";
import { createHomeRowsNavigation } from "./navigation/home";
import { createSourceNavigation } from "./navigation/sources";
import { createOverlayNavigation } from "./navigation/overlays";
import { createSearchNavigation } from "./navigation/search";
import { createSettingsNavigation } from "./navigation/settings";
import { createProfilesNavigation } from "./navigation/profiles";
import { createCalendarNavigation } from "./navigation/calendar";
import { createDetailNavigation } from "./navigation/detail";
import { createPlayerNavigation } from "./navigation/player";
import {
  cardKey,
  type Bootstrap,
  type Card,
  type Catalog,
  type Channel,
  type Controls,
  type Detail,
  type Home,
  type LibraryPage,
  type LivePage,
  type Management,
  type Page,
  type Pairing,
  type Preferences,
  type Program,
  type Guide,
  type CalendarEntry,
  type CalendarSnapshot,
  type Source,
  type SourcePage,
  type TitleAction,
  type PlaybackSegment
} from "./types";
import type { PlayerSnapshot } from "../../../vendor/video/src/types";

const available = (value?: { availability: string }) =>
  value?.availability === "Available";
const isRokuUi =
  typeof (globalThis as any).__SolidTVRokuRenderer !== "undefined";

/** Simkl is temporarily off: its search endpoint rejects this account's
 * requests. Configured Stremio providers supply catalogs and media search until the
 * Simkl integration is re-authorized. User-owned Continue/My List rows stay
 * visible because their metadata is already in the bootstrap. */
const STREMIO_ONLY = true;
const isSimklCard = (card?: Card | null) =>
  !!card &&
  (card.provider_id === "simkl" ||
    card.metadata_origin?.provider_id === "simkl");
function stremioHome(value: Home | undefined): Home | undefined {
  if (!STREMIO_ONLY || !value) return value;
  const rows = value.rows.filter((row) => !String(row.id ?? "").startsWith("simkl:"));
  const streamCards = rows
    .flatMap((row) => row.cards)
    .filter((card) => !isSimklCard(card));
  const featured = value.featured.filter((card) => !isSimklCard(card));
  const carousel = featured.length ? featured : streamCards.slice(0, 5);
  return {
    ...value,
    rows,
    featured: carousel,
    hero: isSimklCard(value.hero)
      ? (carousel[0] ?? streamCards[0] ?? null)
      : value.hero,
  };
}

export function createRemoteTvApp(
  api: RemoteTvApi,
  platform: string,
  options: { autoStart?: boolean; initialLoading?: boolean } = {},
) {
  return () => {
    const homeRowFocus = new RowFocus<Card>(cardKey);
    const contentFocus = new RowFocus<Card>(cardKey);
    const detailFocus = new RowFocus<Card>(cardKey);
    const [screen, setScreen] = createSignal<Screen>("welcome"),
      [home, setHome] = createSignal<Home>(),
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
    const [loading, setLoading] = createSignal(options.initialLoading ?? true),
      [error, setError] = createSignal(""),
      [playbackError, setPlaybackError] = createSignal(""),
      [pending, setPending] = createSignal(false);
    const [zone, setZone] = createSignal("nav"),
      [column, setColumn] = createSignal(1),
      [row, setRow] = createSignal(0),
      [heroAction, setHeroAction] = createSignal(0);
    const [detailAction, setDetailAction] = createSignal<TitleAction>();
    const [seasonIndex, setSeasonIndex] = createSignal(0);
    const [detail, setDetail] = createSignal<Detail>(),
      [selected, setSelected] = createSignal<Card>(),
      [page, setPage] = createSignal<Page>({ cards: [], complete: true }),
      [controls, setControls] = createSignal<Controls>(),
      [catalog, setCatalog] = createSignal<Catalog>(),
      [filters, setFilters] = createSignal<Record<string, string[]>>({});
    const {hasEpisodes: detailHasEpisodes, episodes: detailEpisodes, cursor: detailCursor, target: detailTarget,
      label: detailActionLabel, progress: detailPlayProgress, remaining: detailPlayRemaining} = createDetailPresentation({
        home, detail, action: detailAction, selected, season: seasonIndex,
      });
    const [, setLiveFavorites] = createSignal<Set<string>>();
    const [livePages, setLivePages] = createSignal<LivePage[]>([]),
      [channels, setChannels] = createSignal<Channel[]>([]),
      [liveSnapshot, setLiveSnapshot] = createSignal(""),
      [groups, setGroups] = createSignal<{ id: string; label: string }[]>([]),
      [liveGroup, setLiveGroup] = createSignal<string>(),
      [programs, setPrograms] = createSignal<Record<string, Program[]>>({}),
      // LIVE-EMPTY-001: the message a failed first Live request read, and who is
      // looking, which decides the action block and the who line.
      [liveFailure, setLiveFailure] = createSignal(""),
      [liveIdentity, setLiveIdentity] = createSignal<AccountIdentity>();
    /** Which form the page draws. Only the page's own facts decide. */
    const liveSpread = createMemo(() =>
      pickLiveSpread({
        channels: channels().length,
        page: livePages()[0],
        filtered: !!liveGroup(),
        pending: loading(),
        failure: liveFailure(),
      }),
    );
    const liveViewer = createMemo(() => liveViewerOf(liveIdentity()));
    /** The block's focused action, while the block owns the page. */
    const liveEmptyFocus = () =>
      zone() === "live-empty" ? column() : undefined;
    /**
     * The answered and failed blocks' recovery, in the contract's order: the
     * primary is first, so **Try again** leads whenever there is something to
     * re-request. **Source integrations** needs a proven owner: the server
     * refuses a source write from a member or a paired TV.
     */
    const liveRecovery = createMemo<{ id: LiveRecoveryAction; label: string }[]>(
      () =>
        liveRecoveryActions({
          retry: liveSpread() === "failed" || !!livePages()[0]?.reason,
          mayChangeSources: liveViewer() === "owner",
        }).map((id) => ({
          id,
          label:
            id === "retry"
              ? LIVE_EMPTY_COPY.retry
              : LIVE_EMPTY_COPY.sourceIntegrations,
        })),
    );
    const [guideInfo, setGuideInfo] = createSignal<
        Record<string, Guide["view"]>
      >({}),
      [programIndex, setProgramIndex] = createSignal(0);
    const liveChannelIndex = () => (zone() === "live-groups" ? 0 : column());
    const guideRowStart = () =>
      edgeRequest(livePages(), "previous")
        ? liveChannelIndex() - 2
        : Math.max(0, liveChannelIndex() - 2);
    const currentProgram = createMemo(
      () => programs()[channels()[liveChannelIndex()]?.id]?.[programIndex()],
    );
    /**
     * The grid's own window, shared by every row, the header and the Now marker:
     * the guides that answered decide it, never the focused row (whose own guide
     * may be pending or failed).
     */
    const guideWindow = createMemo(() =>
      guideWindowOf(Object.values(guideInfo()), Date.now()),
    );
    const guideStart = createMemo(() => {
      const base = guideWindow().start;
      const selected = currentProgram();
      return selected &&
        (selected.start_millis < base ||
          selected.start_millis >= base + 7200000)
        ? Math.floor(selected.start_millis / 1800000) * 1800000
        : base;
    });
    const [search, setSearch] = createSignal(""),
      [searchError, setSearchError] = createSignal(""),
      [searchChannelError, setSearchChannelError] = createSignal(""),
      [searchMediaPending, setSearchMediaPending] = createSignal(false),
      [searchChannelsPending, setSearchChannelsPending] = createSignal(false),
      [searchChannelPaging, setSearchChannelPaging] = createSignal(false),
      [searchChannels, setSearchChannels] = createSignal<Channel[]>([]),
      [searchChannelPages, setSearchChannelPages] = createSignal<LivePage[]>(
        [],
      ),
      [pairing, setPairing] = createSignal<Pairing>(),
      [pairingDeadline, setPairingDeadline] = createSignal(0),
      [pairingFocused, setPairingFocused] = createSignal(false),
      [signedIn, setSignedIn] = createSignal<Bootstrap>(),
      [qr, setQr] = createSignal("");
    const [trackColumn, setTrackColumn] = createSignal(0);
    const [accountEmail, setAccountEmail] = createSignal("");
    const [calibrationValue, setCalibrationValue] = createSignal(0);
    function reloadIdleImages() {
      clearLogoCache();
      reloadImages();
    }
    const { active: screenSaver, dismiss: dismissScreenSaver } = createIdleScreenSaver({
      minutes: screenSaverMinutes, playing: () => screen() === "player", onWake: reloadIdleImages,
    });
    const [choice, setChoice] = createSignal(0);
    const { text, setText, key, setKey, upper: keyboardUpper, setUpper: setKeyboardUpper,
      symbols: keyboardSymbols, setSymbols: setKeyboardSymbols, characters: keyboardCharacters } = createTextKeyboard();
    const overlays = createOverlayController({
      focus: {screen, capture: () => ({zone: zone(), column: column(), row: row(), choice: choice()}), selection: choice,
        select: index => { setChoice(index); }, restore: focus => { setZone(focus.zone); setColumn(focus.column); setRow(focus.row); setChoice(focus.choice); }},
      text: {clear: () => { setText(""); }, begin: initial => { setKeyboardUpper(false); setKeyboardSymbols(false); setText(initial); setKey(0); }},
      errors: {clear: () => { setError(""); }, restore: () => { setError(screen() === "player" ? playbackError() : ""); }},
    });
    const {current: overlay, entered: overlayEntered, closing: overlayClosing, settled: overlaySettled, open: openOverlay} = overlays;
    const [sourcePage, setSourcePage] = createSignal<SourcePage>(),
      [allSourceIds, setAllSourceIds] = createSignal<string[]>([]),
      [sourceFacet, setSourceFacet] = createSignal(0),
      [sourceFilterFocus, setSourceFilterFocus] = createSignal(false),
      [sourceProviderFilter, setSourceProviderFilter] = createSignal<string>(),
      [sourceMenu, setSourceMenu] = createSignal<"quality" | "provider">(),
      [sourceMenuChoice, setSourceMenuChoice] = createSignal(0),
      [sourceFailure, setSourceFailure] = createSignal(""),
      [sourceActions, setSourceActions] = createSignal(false),
      [sourceActionChoice, setSourceActionChoice] = createSignal(0),
      [failedSources, setFailedSources] = createSignal<Set<string>>(new Set());
    const profileEditor = createMemo(() => {
      const value = overlay();
      return value &&
        (value.kind === "choices" || value.kind === "confirm") &&
        value.profile
        ? value
        : undefined;
    });
    const [sourceHeight, setSourceHeight] = createSignal<number>(),
      [sourceFiltering, setSourceFiltering] = createSignal(false);
    let manualSourceSelection = false,
      sourceStartPosition = 0,
      sourceFilterGeneration = 0;
    const heldSelect = createHeldSelect({
      target: pressTarget, layer: overlay,
      allowed: () => !overlay() || overlay()?.kind === "sources" || overlay()?.kind === "next",
      blocked: () => pending() || loading(),
      onTimer: () => { (window as any).__holdPending = pending(); (window as any).__holdLoading = loading(); },
      hold: () => {
        if (!overlay() && zone() === "hero" && heroAction() === 0 && hero()) void playIntent(hero()!, true).catch(fail);
        else menu();
      },
      activate: () => { void activate().catch(fail); },
    });
    const [sources, setSources] = createSignal<Source[]>([]),
      [sourceLoading, setSourceLoading] = createSignal(false),
      [action, setAction] = createSignal<TitleAction>(),
      [activeAction, setActiveAction] = createSignal<TitleAction>(),
      [pickerCard, setPickerCard] = createSignal<Card>(),
      [sourceChannel, setSourceChannel] = createSignal<string>(),
      [replacingSource, setReplacingSource] = createSignal(false),
      [activeChannel, setActiveChannel] = createSignal<string>(),
      [activeSource, setActiveSource] = createSignal<Source>(),
      // The source the picker handed to playback. It stays set for exactly as
      // long as the player is preparing it, which is what the contract's
      // `Opening stream…` state reports.
      [openingSource, setOpeningSource] = createSignal<Source>();
    const [playbackRevision, setPlaybackRevision] = createSignal("");
    const playbackRevisionKey = (value: Record<string, number | string>) => JSON.stringify([value.configuration, value.addons, value.policy, value.preferences]);
    async function checkPlaybackRevision() {
      const value = await call<Record<string, number | string>>(api.scoped("/revisions"));
      if (playbackRevisionKey(value) === playbackRevision()) return;
      const fresh = await api.preferences(scope.signal);
      batch(() => { setPreferences(fresh);setPlaybackRevision(playbackRevisionKey(value)); });
    }
    const [sourceMemoryPending, setSourceMemoryPending] = createSignal(0);
    const [presentationRevision, setPresentationRevision] = createSignal(0);
    const [deviceRevision, setDeviceRevision] = createSignal(0);
    const devicePlayback = new DevicePlayback(undefined, () => setDeviceRevision(v => v + 1));
    const deviceScope = () => deviceProfileKey(api.origin, api.profile);
    const [episodeState, setEpisodeState] = createSignal<EpisodePreparationState>({ status: "idle", preparing: false });
    const [countdownState, setCountdownState] = createSignal<CountdownState>({ running: false, remaining: null, progress: 0 });
    const [advancing, setAdvancing] = createSignal(false);
    let nextIntent = 0, sourceAttempt = 0, sourceIntent = 0, dismissedEnd = "", manualPresentation: { source: string; card: string; scope: string; title: string } | undefined;
    const countdown = new AutoplayCountdown(setCountdownState);
    const [calendar, setCalendar] = createSignal<CalendarSnapshot>();
    const [calendarDay, setCalendarDay] = createSignal(0);
    const [calendarEntry, setCalendarEntry] = createSignal(0);
    const calendarDaysList = createMemo(() =>
      calendarDays(calendar()?.entries ?? []),
    );
    const calendarDayEntries = createMemo(() => {
      const day = calendarDaysList()[calendarDay()];
      if (!day) return [];
      return (calendar()?.entries ?? []).filter((entry: CalendarEntry) => {
        const date = new Date(entry.date);
        return (
          !Number.isNaN(date.getTime()) &&
          calendarDayKey(date) === day.key
        );
      });
    });
    const {providers: sourceProviders, visible: visibleSources, qualityOptions: qualityMenuOptions, providerOptions: providerMenuOptions,
      quality: sourceQualityValue, provider: sourceProviderValue, focused: focusedSource, addonCount: sourceAddonCount, spread: sourceSpread} = createSourcePresentation({
        sources, page: sourcePage, provider: {current: sourceProviderFilter, clear: () => { setSourceProviderFilter(undefined); }}, height: sourceHeight,
        open: () => overlay()?.kind === "sources", opening: () => !!openingSource(), loading: sourceLoading,
        selection: {index: choice, select: index => { setChoice(index); }},
      });
    const [openSourceMenuOptions, setOpenSourceMenuOptions] = createSignal<SourceMenuOption[]>([]);
    const sourceMenuOptions = () => openSourceMenuOptions();
    const [snapshot, setSnapshot] = createSignal<PlayerSnapshot>(),
      [showControls, setShowControls] = createSignal(true),
      [seek, setSeek] = createSignal<number>(),
      [seeking, setSeeking] = createSignal(false),
      [playbackSegments, setPlaybackSegments] = createSignal<PlaybackSegment[]>([]),
      [settingsTab, setSettingsTab] = createSignal(0),
      [settingsItems, setSettingsItems] = createSignal<Item[]>([]),
      // Household writes need an account session. `/api/bootstrap` omits the
      // capability, so it stays unknown until the server answers.
      [canManageAccount, setCanManageAccount] = createSignal<
        boolean | undefined
      >(undefined),
      [notice, setNotice] = createSignal("");
    const [captionOverride, setCaptionOverride] = createSignal<{
      leaseId: string;
      appearance: {
        font_scale: number;
        text_color: string;
        background_color: string;
      };
    }>();
    const [saved, setSaved] = createSignal<Map<string, boolean>>(new Map());
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
      settingsScope: AbortController | undefined,
      pagingScope: AbortController | undefined,
      sourceScope: AbortController | undefined,
      alive = true,
      noticeTimer: ReturnType<typeof setTimeout> | undefined,
      controlsTimer: ReturnType<typeof setTimeout> | undefined;
    const searchRequests: SearchRequests = {};
    let retry: () => void = () => void start(),
      returnScreen: Screen = "home",
      returnFocus = { zone: "hero", column: 0, row: 0 },
      searchMediaFocus = 0,
      searchChannelFocus = 0,
      pageBusy = false,
      pageGeneration = 0;
    const revisions = createRevisionPoller({ready: () => !!api.profile && document.visibilityState === "visible" && !(screen() !== "player" && overlay()) && !pending(),
      playing: () => screen() === "player", blocked: () => !!overlay() || pending(), alive: () => alive,
      profile: () => api.profile, signal: () => scope.signal, read: signal => call<Record<string, number | string>>(api.scoped("/revisions"), "GET", undefined, signal),
      bootstrap: signal => api.bootstrap(signal), playback: checkPlaybackRevision, reset: resetScope, adoptBootstrap: applyBootstrap,
      apply: applyRevision, fail: error => fail(error)});
    const scheduleRevisions = revisions.schedule;
    let channelPending: { from: string; direction: PageDirection } | undefined;
    let channelRetry: PageDirection | undefined;
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
    let pendingFocus:
      | {
          screen: Screen;
          zone: string;
          row: number;
          from: number;
          index: number;
          generation: number;
        }
      | undefined;
    function pageSignal() {
      if (!pagingScope || pagingScope.signal.aborted) {
        const owner = scope,
          request = new AbortController();
        const cancel = () => request.abort();
        owner.signal.addEventListener("abort", cancel, { once: true });
        request.signal.addEventListener(
          "abort",
          () => owner.signal.removeEventListener("abort", cancel),
          { once: true },
        );
        if (owner.signal.aborted) request.abort();
        pagingScope = request;
      }
      return pagingScope.signal;
    }
    function restartPaging() {
      pagingScope?.abort();
      pagingScope = undefined;
      pageGeneration++;
      pageBusy = false;
      pendingFocus = undefined;
      channelPending = undefined;
      channelRetry = undefined;
      return pageSignal();
    }
    function moveToItem(
      index: number,
      length: number,
      nextCursor?: string | null,
    ) {
      if (index >= length && nextCursor) {
        pendingFocus = {
          screen: screen(),
          zone: zone(),
          row: row(),
          from: column(),
          index,
          generation: pageGeneration,
        };
      } else setColumn(Math.max(0, Math.min(length - 1, index)));
    }
    function settlePendingFocus() {
      const pending = pendingFocus;
      if (
        !pending ||
        pending.generation !== pageGeneration ||
        pending.screen !== screen() ||
        pending.zone !== zone() ||
        pending.row !== row() ||
        pending.from !== column()
      )
        return;
      const shelf = screen() === "home" ? home()?.rows[row()] : undefined;
      const length =
        screen() === "search" && zone() === "search-channels"
          ? searchChannels().length
          : screen() === "live"
            ? channels().length
            : screen() === "detail"
              ? detailEpisodes().length
              : shelf
                ? shelf.cards.length
                : page().cards.length;
      const next =
        screen() === "search" && zone() === "search-channels"
          ? edgeRequest(searchChannelPages(), "next")?.cursor
          : screen() === "detail"
            ? detailCursor()
            : shelf
              ? shelf.next_cursor
              : page().next_cursor;
      if (pending.index < length || !next) {
        pendingFocus = undefined;
        setColumn(Math.max(0, Math.min(length - 1, pending.index)));
        rememberHomeRow();
        if (screen() === "live") void loadVisibleGuides();
      } else if (!pageBusy) {
        if (shelf) void loadHomePage();
        else void more();
      }
    }
    const history: {
      screen: Screen;
      zone: string;
      column: number;
      row: number;
      selected?: Card;
      detail?: Detail;
      detailAction?: TitleAction;
      seasonIndex: number;
      page?: Page;
      focusKey?: string;
      rowId?: string;
      stale?: boolean;
    }[] = [];
    const call = <T,>(
      path: string,
      method = "GET",
      body?: unknown,
      signal: AbortSignal = scope.signal,
    ) => api.call<T>(path, method, body, signal);
    const player = new RemotePlayback(
      api,
      platform,
      document.getElementById("tv-video") as HTMLVideoElement,
      setSnapshot,
      (e, position) => {
        // A failed source start belongs to the picker, which stays open and
        // marks the row. Only a player failure outside that window owns the
        // full-page recovery card.
        if (openingSource() || overlay()?.kind === "sources") return;
        fail(e);
        const current = activeAction();
        if (current) retry = () => void playIntent(current.card, true, false, activeChannel(), false, position);
        setShowControls(true);
      },
      (_lease, card, source) => {
        const observation = manualPresentation;
        const remember = observation && observation.source === source.id && observation.card === episodeKey(card) && observation.scope === deviceScope()
          && preferences()?.preferences.remembered_source_reuse !== false && source.source_addon_id;
        if (!remember) { setPresentationRevision(v => v + 1);return; }
        manualPresentation = undefined;
        batch(() => { setSourceMemoryPending(v => v + 1);setPresentationRevision(v => v + 1); });
        const language = player.tracks.audio.find(track => track.selected && track.language)?.language;
        void devicePlayback.remember(observation.scope, observation.title, {
          provider_id: source.source_addon_id!,
          source_id: source.presentation?.source_id,
          provider_name: source.presentation?.provider_name,
          audio_languages: language ? [language] : source.audio_languages?.length === 1 ? source.audio_languages : [],
        }).catch(() => notify("Couldn’t save this source choice on this device.")).finally(() => setSourceMemoryPending(v => Math.max(0, v - 1)));
      },
    );
    const discoverEpisode = createEpisodeDiscovery({api, memory: sourceMemory});
    const episodes = new EpisodePreparation(
      (card, signal) => api.next(card, signal),
      discoverEpisode,
      setEpisodeState,
    );
    async function sourceMemory(card: Card) {
      if (preferences()?.preferences.remembered_source_reuse === false) return {};
      return devicePlayback.context(deviceScope(), deviceTitleKey(deviceScope(), card));
    }
    createEffect(() => {
      const current = activeAction()?.card;
      const state = screen();
      const source = activeSource()?.id;
      const revision = preferences()?.revision;
      const device = deviceRevision();
      if (state !== "player" || activeChannel() || !current?.identity.episode || !current.parent_identity || !source) {
        episodes.clear();countdown.cancel();return;
      }
      const key = JSON.stringify([api.scopeEpoch, api.profile, episodeKey(current), source, revision, device, playbackRevision()]);
      if (episodes.configure(key, current, scope.signal)) void episodes.refresh();
    });
    createEffect(() => {
      presentationRevision();
      const time = snapshot()?.time;
      const next = episodeState();
      if (screen() === "player" && next.item && time && Number.isFinite(time.durationSeconds) && time.durationSeconds !== null && time.durationSeconds > 0 &&
          time.durationSeconds - time.positionSeconds <= 180 && player.hasPresentedFrame && !sourceMemoryPending() && !openingSource() && !advancing()) void episodes.prepare();
    });
    const endScope = () => `${api.scopeEpoch}:${player.leaseId ?? ""}`;
    function revealEndedControls(): boolean {
      if (screen() !== "player" || overlay() || showControls() || error() ||
          snapshot()?.state !== "ended" || dismissedEnd !== endScope()) return false;
      setShowControls(true);setChoice(0);
      return true;
    }
    function dismissNext() {
      nextIntent++;setAdvancing(false);
      countdown.cancel();dismissedEnd = endScope();
      overlays.hide();setShowControls(false);
    }
    createEffect(() => {
      deviceRevision();
      const next = episodeState();
      if (screen() !== "player" || snapshot()?.state !== "ended" || advancing() || openingSource() || sourceLoading() || loading() || error()) return;
      if (next.status !== "ready") countdown.cancel();
      if (!next.item) {
        if (overlay()?.kind === "next") dismissNext();
        return;
      }
      if (next.status !== "ready" || dismissedEnd === endScope() || overlay() && overlay()?.kind !== "next") return;
      if (!overlay()) openOverlay({ kind: "next", title: "Up next", items: [] });
      const target = episodeKey(next.item), ended = endScope();
      countdown.start(ended, devicePlayback.autoplay, () => screen() === "player" && snapshot()?.state === "ended" &&
        overlay()?.kind === "next" && !advancing() && episodeState().status === "ready" && !!episodeState().item && episodeKey(episodeState().item!) === target,
        () => { void advanceEpisode().catch(fail); });
    });
    const continuationPoll = setInterval(() => {
      const time = snapshot()?.time;
      const due = snapshot()?.state === "ended" || time?.durationSeconds && time.durationSeconds - time.positionSeconds <= 180;
      const retry = due && ["loading", "error"].includes(episodeState().status);
      if (screen() === "player" && !advancing() && (overlay()?.kind === "next" || retry)) void episodes.refresh();
    }, 2000);
    onCleanup(() => { clearInterval(continuationPoll);countdown.cancel();episodes.clear(); });
    async function advanceEpisode(forcePicker = false) {
      if (advancing()) return;
      const ticket = ++nextIntent;
      countdown.cancel();setAdvancing(true);
      try {
        const expected = episodeState().item;
        await checkPlaybackRevision();
        if (ticket !== nextIntent || scope.signal.aborted || screen() !== "player") return;
        const card = await episodes.refresh();
        if (ticket !== nextIntent || scope.signal.aborted || screen() !== "player") return;
        if (!card) { notify("There’s no next episode available.");return; }
        if (expected && episodeKey(expected) !== episodeKey(card)) { notify("The next episode changed. Press Next to continue.");return; }
        const prepared = forcePicker ? undefined : episodes.take(card);
        overlays.hide();
        await playIntent(card, forcePicker, true, undefined, false, 0, !forcePicker, prepared);
      } finally { if (ticket === nextIntent) setAdvancing(false); }
    }
    const playerActions = createMemo(() => {
      snapshot();
      return player.actions;
    });
    const activeSegment = createMemo(() => {
      const position = (snapshot()?.time.positionSeconds ?? 0) * 1000;
      return playbackSegments().find(
        (segment) =>
          segment.kind !== "credits" && Number.isFinite(segment.start_ms) && Number.isFinite(segment.end_ms) &&
          segment.start_ms >= 0 && segment.end_ms > segment.start_ms &&
          (!(snapshot()?.time.durationSeconds! > 0) || segment.end_ms <= (snapshot()!.time.durationSeconds ?? 0) * 1000) &&
          position >= segment.start_ms &&
          position < segment.end_ms,
      );
    });
    async function refreshPlaybackSegments() {
      const id = player.leaseId;
      if (!id) {
        setPlaybackSegments([]);
        return;
      }
      try {
        const value = await api.segments(id, scope.signal);
        if (player.leaseId === id) setPlaybackSegments(value.segments ?? []);
      } catch {
        if (player.leaseId === id) setPlaybackSegments([]);
      }
    }
    const playerButtons = createMemo(() => {
      snapshot();
      // These controls replace the server lease; native track APIs are not
      // required. Only expose tracks the current server delivery can select.
      const canTracks = player.tracks.audio.some(track => track.selectable && track.supported !== false)
        || player.tracks.subtitlesSupported;
      return [
        {
          id:
            playerActions().pause || playerActions().seek
              ? "timeline"
              : "status",
          label: "",
        },
        ...(activeSegment() && playerActions().seek && preferences()?.preferences?.skip_intros !== false
          ? [
              {
                id: "skip",
                label:
                  activeSegment()?.kind === "recap"
                    ? "Skip recap"
                    : "Skip intro",
              },
            ]
          : []),
        ...(playerActions().episodes
          ? [{ id: "episodes", label: "Episodes" }]
          : []),
        ...(playerActions().tracks && canTracks
          ? [{ id: "tracks", label: "Audio & subtitles" }]
          : []),
        ...(playerActions().change_source
          ? [{ id: "sources", label: "Source" }]
          : []),
        ...(playerActions().next_episode && episodeState().status !== "none"
          ? [{ id: "next", label: "Next episode" }]
          : []),
      ];
    }, undefined, { equals: (a, b) => a.length === b.length && a.every((button, index) => button.id === b[index].id && button.label === b[index].label) });
    const playerTools = createMemo(() => {
      let left = 280;
      return playerButtons().slice(1).map(button => {
        const width = button.id === "tracks" ? 304 : button.id === "next" ? 240 : 228;
        const x = button.id === "next" ? 1584 : left;
        if (button.id !== "next") left += width + 12;
        return { ...button, x, width, icon: button.id === "episodes" ? "episodes" : button.id === "tracks" ? "audio" : button.id === "sources" ? "settings" : "chevron" };
      });
    });
    const [timelineFocused, setTimelineFocused] = createSignal(true);
    createEffect(() => {
      const count = playerButtons().length;
      if (screen() === "player" && !overlay() && choice() >= count)
        setChoice(Math.max(0, count - 1));
      if (!playerActions().seek) setSeek(undefined);
    });
    const openTracks = createTrackPicker({player, roku: isRokuUi, selection: {column: setTrackColumn, row: setChoice},
      dialogs: {current: overlay, open: openOverlay, close: closeOverlay},
      subtitle: {enabled: () => playerActions().subtitle_style, current: preferences, adopt: setPreferences, request: call,
        path: () => api.scoped("/preferences"), override: setCaptionOverride}});
    const [fontsReady, setFontsReady] = createSignal(false);
    onMount(() => {
      void document.fonts.ready.then(() => setFontsReady(true));
    });
    const sceneWidth = createMemo(() => {
      const value = overlay();
      if (!overlaySettled() || overlayClosing() || !value) return 1920;
      if (value.kind === "sources") return 960;
      if (
        (value.kind === "choices" || value.kind === "confirm") &&
        !value.profile
      )
        return 1100;
      return 1920;
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
    function resetScope() {
      manualPresentation = undefined;
      nextIntent++;setAdvancing(false);sourceAttempt++;sourceIntent++;countdown.cancel();episodes.clear();
      setSignedIn(undefined);
      setCanManageAccount(undefined);
      overlays.retireAnimations();
      scope.abort();
      searchRequests.scope?.abort();
      setSearchChannelPaging(false);
      setSearchError("");
      settingsScope?.abort();
      pagingScope?.abort();
      pagingScope = undefined;
      pendingFocus = undefined;
      channelPending = undefined;
      channelRetry = undefined;
      scope = new AbortController();
      sourceScope?.abort();
      sourceScope = undefined;
      setLoading(false);
      setError("");
      overlays.hide();
      setText("");
      pageBusy = false;
      heldSelect.cancel();
      sourceFilterGeneration++;
      pageGeneration++;
      clearTimeout(searchRequests.timer);
      return scope.signal;
    }
    function clearProfileView() {
      homeRowFocus.clear();
      contentFocus.clear();
      detailFocus.clear();
      history.length = 0;
      batch(() => {
        setCaptionOverride(undefined);
        setPlaybackError("");
        setPage({ cards: [], complete: true });
        setSearch("");
        setSearchChannels([]);
        setSearchChannelPages([]);
        setSearchChannelError("");
        setSearchMediaPending(false);
        setSearchChannelsPending(false);
        setFilters({});
        setCatalog(undefined);
        setControls(undefined);
        setSources([]);
        setAllSourceIds([]);
        setAction(undefined);
        setActiveAction(undefined);
        setPickerCard(undefined);
        setSourceChannel(undefined);
        setActiveChannel(undefined);
        setActiveSource(undefined);
        setSelected(undefined);
        setDetail(undefined);
        setDetailAction(undefined);
        setPreviewCard(undefined);
        adoptChannelWindow([]);
        setPrograms({});
        setGuideInfo({});
        setLiveFavorites(undefined);
        setLiveIdentity(undefined);
        setManagement(undefined);
        setNavigation(undefined);
        setAccountEmail("");
        setPreferences(undefined);
        setLibrary(undefined);
        setHome(undefined);
        setGroups([]);
        setLiveGroup(undefined);
        setSettingsItems([]);
        heroCycle.clear();
        setHeroAction(0);
        setSaved(new Map());
      });
      liveGuides.dispose();
    }
    function applyBootstrap(value: Bootstrap) {
      clearProfileView();
      batch(() => {
        setManagement(value.profile_management);
        setNavigation(value.navigation);
        setAccountEmail(
          value.identity.account?.username ??
            value.identity.account?.name ??
            "",
        );
        setPreferences(value.preferences ?? undefined);
        setHome(stremioHome(value.home ?? undefined));
        setSaved(new Map());
        revisions.adopt(value.revisions ?? {});
        setPlaybackRevision(playbackRevisionKey(value.revisions ?? {}));
        setLoading(false);
        setScreen(api.profile ? "home" : "profiles");
        setZone(api.profile ? "hero" : "profiles");
        setColumn(0);
        setRow(0);
      });
      scheduleRevisions();
    }
    async function start() {
      if (options.initialLoading !== false) setLoading(true);
      setError("");
      try {
        if (await api.restore())
          applyBootstrap(await api.bootstrap(scope.signal));
        else setLoading(false);
      } catch (e) {
        fail(e);
      }
    }
    const beginPairing = createPairingFlow({api, retry: work => {retry = () => void work();}, fail,
      begin: () => {
        if (screen() !== "pairing") setPairingFocused(false);
        const signal = resetScope();
        setScreen("pairing");
        setPairing(undefined);
        setQr("");
        setLoading(true);
        return signal;
      }, issued: setPairing, deadline: setPairingDeadline, qr: setQr, ready: () => {setLoading(false);},
      complete: authenticated => {
        batch(() => {
          setSignedIn(authenticated);
          setPairing(undefined);
          setQr("");
          setScreen("signed-in");
          setZone("confirmation");
          setColumn(0);
          setRow(0);
        });
      }});
    function finishSignIn() {
      const authenticated = signedIn();
      if (!authenticated || screen() !== "signed-in") return;
      setSignedIn(undefined);
      applyBootstrap(authenticated);
    }
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
    const refreshDetail = createDetailRefresh({api, detail: {current: detail, set: setDetail, action: setDetailAction}, selected,
      focused: () => focusedCard(), season: {current: seasonIndex, set: setSeasonIndex}, generation: () => pageGeneration,
      current: (signal, profile, generation, card) => !overlay() && !pending() && !signal.aborted && scope.signal === signal && screen() === "detail" && pageGeneration === generation &&
        api.profile === profile && !!selected() && cardKey(selected()!) === cardKey(card), focus: {zone, column, setColumn}, resolve: focusIndex});
    const refreshLive = createLiveRefresh({channels, index: liveChannelIndex, read: signal => refreshChannelPage(false, signal), snapshot: adoptLiveSnapshot, window: adoptChannelWindow,
      groups: setGroups, failure: setLiveFailure, focus: {zone, column, setZone, setColumn}, clearGuides: () => {setPrograms({});setGuideInfo({});}, loadGuides: () => loadVisibleGuides()});
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
          await refreshLive(signal, commit);
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
    const contentRow = () => ({ id: screen(), cards: page().cards });
    const contentColumn = () => zone() === "content" ? column() : contentFocus.resolve(contentRow());
    function rememberContentFocus() {
      if (["movie", "series", "anime", "library"].includes(screen()) && zone() === "content")
        contentFocus.remember(contentRow(), column());
    }
    function detailRow(kind: "episodes" | "recommendations") {
      const value = detail();
      return {
        id: JSON.stringify([value && presentationKey(value.item), kind, kind === "episodes" ? seasonIndex() : undefined]),
        cards: kind === "episodes" && detailHasEpisodes() ? detailEpisodes() : value?.recommendations ?? [],
      };
    }
    const detailColumn = (kind: "episodes" | "recommendations") => zone() === kind ? column() : detailFocus.resolve(detailRow(kind));
    function rememberDetailFocus() {
      const region = zone();
      if (screen() === "detail" && (region === "episodes" || region === "recommendations"))
        detailFocus.remember(detailRow(region), column());
    }
    createEffect(() => detailFocus.retain([detailRow("episodes"), detailRow("recommendations")]));
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
    const searchNeedsRetry = () =>
      searchCapabilities().media &&
      !!search() &&
      !searchMediaPending() &&
      (!!searchError() || !page().complete);
    const heroCycle = createHeroCycle({
      count: () => home()?.featured.length ?? 0,
      enabled: () => screen() === "home" && zone() !== "rows" && !overlay() && !pending() && !loading() && !error(),
    });
    const { slide: heroSlide,
      reset: resetHeroCycle, restart: restartHeroCycling, setVisible: setHeroVisible } = heroCycle;
    const [previewCard, setPreviewCard] = createSignal<Card>();
    let previewGeneration = 0, previewScope = "";
    let previewCandidate: Card | undefined;
    createEffect(() => {
      const focused = focusedCard(), active = zone() === "rows", currentScope = deviceScope();
      runtimeObserver()?.({phase:"home-focus",at:performance.now(),row:row(),rowId:home()?.rows[row()]?.id,
        cards:home()?.rows[row()]?.cards.length,complete:home()?.complete,active});
      const previous = previewScope === currentScope ? previewCandidate ?? untrack(previewCard) : undefined;
      previewScope = currentScope;
      const card = focused && active ? presentationCard(previous, focused) : undefined;
      previewCandidate = card;
      // A stale settle can still fire if the cleanup's clearTimeout loses a
      // race against the fake clock's fast-forward; the generation guard makes
      // such a fire a no-op so a skipped-over card never flashes its preview.
      const generation = ++previewGeneration;
      const timer = setTimeout(() => {
        if (generation === previewGeneration)
          setPreviewCard(active ? card : undefined);
      }, 120);
      onCleanup(() => clearTimeout(timer));
    });
    const shelfTitleY = () => {
      const rows = home()?.rows ?? [];
      const id = rows[Math.min(row(), Math.max(0, rows.length - 1))]?.id;
      return zone() === "rows"
        ? 545.2 + (510.8 - (128 + (id === "continue" ? 237.6 : 382.8)))
        : 824;
    };
    const hero = createMemo(() => {
      const value =
        screen() === "home"
          ? zone() === "rows"
            ? (previewCard() ?? home()?.hero)
            : (home()?.featured[heroSlide()] ?? home()?.hero)
          : detail()?.item;
      if (!value || value.logo || screen() !== "home") return value;
      // The featured carousel's cards can be summary-only while the same title
      // in a row carries the logo. Borrow that artwork so Home never shows the
      // title fallback for a title that already has one.
      const identity = presentationKey(value);
      for (const row of home()?.rows ?? []) {
        const match = row.cards.find((card) => presentationKey(card) === identity);
        if (match?.logo)
          return {
            ...value,
            logo: match.logo,
            landscape: value.landscape ?? match.landscape,
            poster: value.poster ?? match.poster,
          };
      }
      const fallback = home()?.hero;
      if (fallback && presentationKey(fallback) === identity && fallback.logo)
        return { ...value, logo: fallback.logo };
      return value;
    });
    const heroLogoBox = () => screen() === "detail"
      ? detailHasEpisodes() && ["episodes","seasons","recommendations"].includes(zone())
        ? {x:96,y:54,width:220,height:68}
        : {x:96,y:detailHasEpisodes() ? 250 : 220,width:640,height:detailHasEpisodes() ? 134 : 190}
      : zone() === "rows" ? {x:96,y:Math.max(96,132+Math.max(0,shelfTitleY()-40-132-310)/2),width:640,height:120}
      : {x:96,y:330,width:640,height:160};
    const heroPresentation = createCoherentHero(
      () => screen() === "home" || screen() === "detail" ? hero() ?? undefined : undefined,
      () => `${deviceScope()}:${screen()}`,
      () => screen() === "detail" ? "detail" : zone() !== "rows" ? "hero"
        : home()?.rows[row()]?.id === "continue" ? "landscape" : "portrait",
      heroLogoBox,
      () => screen() !== "home" || zone() !== "rows" || !!previewCard() && !!focusedCard() &&
        presentationKey(previewCard()!) === presentationKey(focusedCard()!),
    );
    const displayHero = heroPresentation.card;
    const detailForDisplay = createMemo(() => detail() && displayHero() && presentationKey(detail()!.item) === presentationKey(displayHero()!)
      ? { ...detail()!, item: displayHero()! } : undefined);
    const billboardKey = createMemo(() =>
      screen() === "home" && zone() !== "rows" && hero()
        ? cardKey(hero()!)
        : undefined,
    );
    createEffect(() => {
      billboardKey();
      resetHeroCycle();
    });
    let heroOrder = "";
    createEffect(() => {
      // A new featured order is new presentation: present it as a fresh pass. A
      // server refresh that repeats the same order must not restart anything.
      const order = (home()?.featured ?? []).map(cardKey).join("|");
      if (!order || order === heroOrder) return;
      heroOrder = order;
      restartHeroCycling();
    });
    function rememberHomeRow() {
      if (screen() === "home" && zone() === "rows") homeRowFocus.remember(home()?.rows[row()], column());
    }
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
        heroCycle.clamp(value?.featured.length ?? 0);
        if (screen() === "home" && zone() === "rows") {
          setRow(nextRow);
          setColumn(nextColumn);
        }
      });
      const modal = overlay();
      if (modal?.kind === "tracks") setChoice(Math.max(0,modal.columns[0]?.items.findIndex(item=>item.value==="✓") ?? 0));
    }
    function invalidateHistory() {
      for (const entry of history) {
        entry.stale = true;
        entry.page = undefined;
        entry.detail = undefined;
        entry.detailAction = undefined;
        if (entry.selected) entry.selected = lookupSelector(entry.selected);
      }
    }
    async function restorePrevious(previous: (typeof history)[number]) {
      if (
        ["movie", "series", "anime", "search", "live", "calendar", "library"].includes(
          previous.screen,
        ) &&
        !navs().some((item) => item.id === previous.screen)
      ) {
        history.length = 0;
        await navigate("home");
        return;
      }
      const signal = resetScope();
      batch(() => {
        setScreen(previous.screen);
        setZone(previous.zone);
        setColumn(previous.column);
        setRow(previous.row);
        setSelected(previous.selected);
        setDetail(previous.detail);
        setDetailAction(previous.detailAction);
        setSeasonIndex(previous.seasonIndex);
        setPage(previous.page ?? { cards: [], complete: true });
        setLoading(!!previous.stale);
      });
      if (previous.screen === "search") {
        if (previous.stale || searchMediaPending() || searchChannelsPending())
          updateSearch(search(), true);
        return;
      }
      if (!previous.stale) return;
      retry = () => void restorePrevious(previous);
      try {
        if (previous.screen === "home") {
          const rows = home()?.rows ?? [];
          const nextRow = Math.max(
            0,
            rows.findIndex((row) => row.id === previous.rowId),
          );
          setRow(nextRow);
          if (previous.zone === "rows")
            setColumn(
              focusIndex(
                rows[nextRow]?.cards ?? [],
                previous.focusKey,
                previous.column,
              ),
            );
        } else if (previous.screen === "detail" && previous.selected) {
          let [value, intent] = await Promise.all([
            api.detail(previous.selected, "0", signal),
            api.titleAction(previous.selected, false, signal),
          ]);
          const index = previous.seasonIndex < value.seasons.length ? previous.seasonIndex : initialSeasonIndex(value, previous.selected, intent);
          const season = value.seasons[index];
          if (season && season.offset !== 0 && !value.episodes.some(card => card.identity.episode?.season === season.season))
            value = await api.detail(previous.selected, String(season.offset), signal);
          if (signal.aborted) return;
          batch(() => {
            setDetail(value);
            setDetailAction(intent);
            setSeasonIndex(index);
            if (
              previous.zone === "episodes" ||
              previous.zone === "recommendations"
            )
              setColumn(
                focusIndex(
                  previous.zone === "recommendations" || !(value.seasons.length || value.episodes.length)
                    ? value.recommendations
                    : seasonEpisodes(value, index),
                  previous.focusKey,
                  previous.column,
                ),
              );
          });
        } else if (previous.screen === "live") {
          await loadLiveFirstPage(signal);
        } else if (["movie", "series", "anime", "library"].includes(previous.screen)) {
          const value =
            previous.screen === "library"
              ? await loadLibrary("0", signal)
              : await api.discover(browseQuery(), signal);
          batch(() => {
            setPage(value);
            if (previous.zone === "content")
              setColumn(
                focusIndex(value.cards, previous.focusKey, previous.column),
              );
          });
        }
      } catch (error) {
        fail(error);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }
    /**
     * LIVE-EMPTY-001: the Live page's first request. A failure with no page in
     * hand is the contract's failed form (**Could not load Live TV.** with its
     * own recovery), not the app's generic overlay, because nothing on the page
     * has proved a source is configured yet.
     */
    async function loadLiveFirstPage(signal: AbortSignal) {
      setLoading(true);
      setLiveFailure("");
      // Bound the visible loading state so the page offers retry instead of
      // sitting on a permanent "Loading Live TV…" when discovery stalls.
      const liveRequest = new AbortController();
      const cancel = () => liveRequest.abort();
      signal.addEventListener("abort", cancel, { once: true });
      const liveTimer = setTimeout(() => liveRequest.abort(), 12000);
      try {
        const result = await api.live("0", undefined, liveRequest.signal);
        adoptLiveSnapshot(result.snapshot_id);
        adoptChannelWindow([result]);
        void call<{ channel_ids: string[] }>(
          api.scoped("/live/favorites"),
          "GET",
          undefined,
          signal,
        )
          .then((value) => setLiveFavorites(new Set(value.channel_ids)))
          .catch(() => {});
        setGroups(result.groups);
        setLiveGroup(undefined);
        setPrograms({});
        void loadVisibleGuides();
      } catch (e) {
        if (signal.aborted) return;
        if (liveRequest.signal.aborted) {
          setLiveFailure("Live TV took too long. Try again.");
          return;
        }
        // A 401 retires the session; it is not this page's empty state.
        if (e instanceof RemoteError && e.status === 401) {
          fail(e);
          return;
        }
        setLiveFailure(e instanceof Error ? e.message : "");
      } finally {
        clearTimeout(liveTimer);
        signal.removeEventListener("abort", cancel);
        if (!signal.aborted) setLoading(false);
      }
      focusLiveSpread();
    }
    /**
     * Entering Live keeps the row focus a page with channels has today. An empty
     * or failed page focuses the navigation's own Live tab instead, so the first
     * Down enters the page on the primary (contract § Focus, input and timing).
     * A page that is empty only because of its filter keeps the chips, on the
     * chosen one, because it has no row to hold the focus (LIVE-EMPTY-11).
     */
    function focusLiveSpread() {
      if (screen() !== "live") return;
      if (liveSpread() === "filtered") {
        setZone("live-groups");
        setColumn(liveFilteredChip(groups(), liveGroup()));
        return;
      }
      if (liveKeepsToday(liveSpread())) {
        setZone("content");
        setColumn(0);
        return;
      }
      setZone("nav");
      setColumn(navIndex("live"));
    }
    /**
     * **Try again**: the same query with the same filters, on the loading form.
     * A failure that leaves no page lands back on the failed form.
     */
    function retryLive() {
      setLiveFailure("");
      void loadLiveGroup(liveGroup()).catch((e) => {
        if (
          e instanceof DOMException ||
          (e instanceof Error && e.name === "AbortError")
        )
          return;
        if (e instanceof RemoteError && e.status === 401) fail(e);
        else setLiveFailure(e instanceof Error ? e.message : "");
      });
    }
    /**
     * Settings on a named section, the existing destinations both empty states
     * route to. The remembered Live entry is marked stale so Back re-requests
     * the page and the primary takes focus again (LIVE-EMPTY-02).
     */
    async function openLiveSettings(tab: number) {
      remember();
      const entry = history[history.length - 1];
      if (entry) entry.stale = true;
      const signal = resetScope();
      setLoading(true);
      setZone("settings-nav");
      setColumn(0);
      setRow(0);
      try {
        await loadSettings(tab, signal);
      } catch (e) {
        fail(e);
      }
      setScreen("settings");
      if (!signal.aborted) setLoading(false);
    }
    /** The focused action of whichever empty or failed block owns the page. */
    async function activateLiveSpread() {
      if (liveSpread() === "no-source") {
        const action = liveNoSourceActions(liveViewer())[column()];
        if (action === "setup")
          await openLiveSettings(settingsTabIndex("Source integrations"));
        else if (action === "add-ons")
          await openLiveSettings(settingsTabIndex("Add-ons"));
        return;
      }
      const action = liveRecovery()[column()]?.id;
      if (action === "retry") retryLive();
      else if (action === "source-integrations")
        await openLiveSettings(settingsTabIndex("Source integrations"));
    }
    async function navigate(target: Screen) {
      contentFocus.clear();
      if (screen() === "player") await player.stop();
      const signal = resetScope();
      if (target === "settings") {
        // Load the first settings group before the screen reports itself so a
        // caller that waits for the screen sees ready content, not an empty
        // column that swallows the first confirm.
        setLoading(true);
        setZone("settings-nav");
        setColumn(0);
        setRow(0);
        try {
          await loadSettings(2, signal);
        } catch (e) {
          fail(e);
        }
        setScreen(target);
        setLoading(false);
        return;
      }
      setScreen(target);
      if (["movie", "series", "anime", "calendar", "library", "search", "live"].includes(target))
        setPage({ cards: [], complete: true });
      if (target === "live") {
        adoptChannelWindow([]);
        setPrograms({});
        setGuideInfo({});
      }
      setColumn(0);
      setRow(0);
      setZone(
        target === "home" ? "hero" : target === "profiles" ? "profiles" : "content",
      );
      setHeroAction(0);
      retry = () => void navigate(target);
      try {
        if (target === "home") {
          if (!home()) setLoading(true);
          setHome(stremioHome(await api.home(signal)));
        } else if (target === "profiles") {
          setManagement(await api.profiles(signal));
        } else if (target === "movie" || target === "series" || target === "anime") {
          setLoading(true);
          setPage({ cards: [], complete: true });
          const anime = STREMIO_ONLY && target === "anime";
          const requestType = anime ? "series" : target;
          const result = await api.controls(requestType, signal);
          setControls(result);
          const catalogs = STREMIO_ONLY
            ? result.catalogs.filter((catalog) => catalog.addon_id != null)
            : result.catalogs;
          const first = catalogs[0] ?? result.catalogs[0];
          setCatalog(first);
          setFilters(anime ? { genre: ["Animation"] } : {});
          setPage(
            await api.discover(
              {
                type: requestType,
                ...(first
                  ? { catalog: first.id, addon_id: first.addon_id }
                  : {}),
                ...(anime ? { genre: "Animation" } : {}),
              },
              signal,
            ),
          );
          setZone("filters");
        } else if (target === "library") {
          setLoading(true);
          const firstLibrary = await loadLibrary("0", signal);
          setPage(firstLibrary);
          const sortControl = firstLibrary.controls?.find(
            (control) => control.id === "sort",
          );
          const lastWatched = sortControl?.choices.find(
            (choice) => choice.value === "last_watched",
          );
          if (lastWatched && firstLibrary.query?.sort !== "last_watched") {
            setPage(
              await loadLibrary("0", signal, {
                ...firstLibrary.default_query,
                sort: lastWatched.value,
              }),
            );
          }
          if (libraryControlCount()) setZone("library-controls");
        } else if (target === "calendar") {
          setLoading(true);
          setCalendarDay(0);
          setCalendarEntry(0);
          setZone("calendar-days");
          try {
            setCalendar(await api.calendar(signal));
          } finally {
            setLoading(false);
          }
        } else if (target === "search") {
          setPage({ cards: [], complete: true });
          setZone("keyboard");
          setKey(2);
          if (search()) {
            updateSearch(search());
            return;
          }
        } else if (target === "live") {
          await loadLiveFirstPage(signal);
        }
        setLoading(false);
      } catch (e) {
        fail(e);
      }
    }
    async function openDetail(card: Card) {
      remember();
      const signal = resetScope();
      setSelected(card);
      setScreen("detail");
      setZone("hero");
      setHeroAction(0);
      setLoading(true);
      setDetail(undefined);
      setDetailAction(undefined);
      setSeasonIndex(0);
      retry = () => void openDetail(card);
      try {
        let [value, intent] = await Promise.all([
          api.detail(card, "0", signal),
          api.titleAction(card, false, signal),
        ]);
        if (signal.aborted) return;
        const index = initialSeasonIndex(value, card, intent);
        const season = value.seasons[index];
        if (season && season.offset !== 0 && !value.episodes.some(episode => episode.identity.episode?.season === season.season))
          value = await api.detail(card, String(season.offset), signal);
        if (signal.aborted) return;
        batch(() => { setDetail(value);setDetailAction(intent);setSeasonIndex(index);setLoading(false); });
      } catch (e) {
        fail(e);
      }
    }
    function closeOverlay(restoreFocus = true) {
      sourceIntent++;
      sourceScope?.abort();
      sourceScope = undefined;
      setSourceLoading(false);
      setSourceFiltering(false);
      overlays.close(restoreFocus);
    }
    function dismissOverlay() {
      if (sourceActions()) { setSourceActions(false); return; }
      if (sourceMenu()) { setSourceMenu(undefined); return; }
      if (libraryApplying()) restartPaging();
      if (!overlays.restoreParent()) closeOverlay();
    }
    async function leavePlayer() {
      clearTimeout(controlsTimer);
      resetScope();
      setSeek(undefined);
      setSeeking(false);
      setPlaybackSegments([]);
      setShowControls(false);
      await player.stop();
      setPlaybackError("");
      batch(() => {
        setLoading(false);
        setScreen(returnScreen);
        setZone(returnFocus.zone);
        setColumn(returnFocus.column);
        setRow(returnFocus.row);
        setError("");
      });
      if (
        returnScreen === "search" &&
        (searchMediaPending() || searchChannelsPending())
      )
        updateSearch(search(), true);
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
    async function back() {
      rememberHomeRow();
      rememberContentFocus();
      rememberDetailFocus();
      nextIntent++;setAdvancing(false);
      countdown.cancel();
      if (error()) { setError("");return; }
      if (overlay()?.kind === "next") { dismissNext();return; }
      if (sourceLoading() && !overlay() || openingSource()) {
        const cancelInPlace = screen() !== "player" && !openingSource();
        sourceAttempt++;sourceIntent++;sourceScope?.abort();setSourceLoading(false);setLoading(false);
        if (player.cancelPendingStart()) {
          setOpeningSource(undefined);
          if (!player.leaseId && screen() === "player") {
            closeOverlay(false);
            await leavePlayer();
          }
          return;
        }
        if (cancelInPlace) return;
      }
      if (sourceActions()) {
        setSourceActions(false);
        return;
      }
      if (sourceMenu()) {
        setSourceMenu(undefined);
        return;
      }
      if (screen() === "signed-in") {
        finishSignIn();
        return;
      }
      // A stream the drawer is opening is cancelled the way it always was:
      // Back leaves the player and returns to the page that asked for it.
      if (openingSource()) {
        setOpeningSource(undefined);
        await leavePlayer();
        return;
      }
      if (
        !overlay() &&
        (screen() === "welcome" || (screen() === "profiles" && !api.profile))
      ) {
        if (platform === "webos") exitWebos();
        else if (platform === "tizen") confirmExit();
        return;
      }
      if (overlay()) {
        const current = overlay()!;
        if (current.kind === "calibration") {
          // Cancel restores the server-saved inset opened with the overlay.
          applyScreenInset(current.value);
          closeOverlay();
          return;
        }
        dismissOverlay();
        return;
      }
      if (screen() === "player") {
        if (seeking()) return;
        if (seek() !== undefined) {
          setSeek(undefined);
          return;
        }
        if (showControls()) {
          setShowControls(false);
          return;
        }
        await leavePlayer();
        return;
      }
      if (screen() === "pairing") {
        resetScope();
        setScreen("welcome");
        return;
      }
      if (screen() === "settings") {
        if (zone() !== "settings-nav") {
          setZone("settings-nav");
          return;
        }
        if (!history.length) {
          await navigate("home");
          return;
        }
      }
      const previous = history.pop();
      if (previous) {
        await restorePrevious(previous);
      } else if (platform === "tizen" && screen() === "home") {
        confirmExit();
      } else if (
        zone() !== "nav" &&
        !["welcome", "profiles"].includes(screen())
      ) {
        setZone("nav");
        setColumn(
          Math.max(
            0,
            navs().findIndex((n) => n.id === screen()),
          ),
        );
      } else if (platform === "webos" && screen() === "profiles") exitWebos();
      else if (platform === "webos" && screen() === "home")
        await navigate("profiles");
      else await navigate("home");
    }
    const pageRequestOwner = {generation: () => pageGeneration, busy: () => pageBusy, setBusy: (value: boolean) => {pageBusy = value;},
      signal: pageSignal, cancelFocus: () => {pendingFocus = undefined;}, settleFocus: settlePendingFocus, fail};
    const channelPaging = {owner: pageRequestOwner, focus: {zone, column, setZone, setColumn}, screen, overlay: () => !!overlay(),
      windows: {pages: (searching: boolean) => searching ? searchChannelPages() : livePages(), values: (searching: boolean) => searching ? searchChannels() : channels(), adopt: adoptChannelWindow},
      search: {query: search, remembered: () => searchChannelFocus, remember: (index: number) => {searchChannelFocus = index;}, signal: () => searchSignal(),
        paging: setSearchChannelPaging, error: setSearchChannelError, refresh: (value: string) => updateSearch(value)},
      live: {group: liveGroup, index: liveChannelIndex, retire: () => retireLiveGuides(), guides: () => loadVisibleGuides(), reload: loadLiveGroup},
      pending: {current: () => channelPending, set: (value: typeof channelPending) => {channelPending = value;}},
      retry: (value: PageDirection | undefined) => {channelRetry = value;}, retryAction: (action: () => void) => {retry = action;},
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
    const liveGuides = createLiveGuideController({scope: () => scope, channels, channelIndex: liveChannelIndex,
      rowStart: guideRowStart, programs: {current: programs, set: setPrograms}, info: {set: setGuideInfo},
      selection: {current: currentProgram, set: setProgramIndex}, notify,
      request: (id, signal) => call<Guide>(api.scoped(`/live/${segment(id)}/guide`), "GET", undefined, signal)});
    const {retire: retireLiveGuides, load: loadGuide, loadVisible: loadVisibleGuides} = liveGuides;
    function adoptLiveSnapshot(id: string) {
      if (id !== liveSnapshot()) retireLiveGuides();
      setLiveSnapshot(id);
    }
    onMount(() => {
      const timer = setInterval(() => {
        if (
          screen() === "live" &&
          !loading() &&
          !overlay() &&
          document.visibilityState === "visible"
        )
          void loadVisibleGuides(true);
      }, 30_000);
      onCleanup(() => clearInterval(timer));
    });
    if (new URLSearchParams(location.search).has("perfdebug")) {
      const target = window as Window & {
        __viptvRemoteMetrics?: () => Record<string, number>;
      };
      target.__viptvRemoteMetrics = () => ({
        guideSnapshots: Object.keys(programs()).length,
        guideRequestsInFlight: liveGuides.inFlight(),
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
    async function loadLiveGroup(group: string | undefined) {
      const signal = restartPaging();
      retireLiveGuides();
      setLiveGroup(group);
      setLoading(true);
      adoptChannelWindow([]);
      setPrograms({});
      setGuideInfo({});
      setPage({ cards: [], complete: true });
      retry = () => void loadLiveGroup(group).catch(fail);
      try {
        const value = await api.live("0", group, signal);
        batch(() => {
          adoptLiveSnapshot(value.snapshot_id);
          adoptChannelWindow([value]);
          setGroups(value.groups);
          setLiveFailure("");
          setColumn(0);
          setZone("content");
        });
        // Nothing to focus in the list: the page's own state holds the focus.
        if (!value.channels.length) focusLiveSpread();
        void loadVisibleGuides();
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }
    const {signal: searchSignal, update: updateSearch} = createSearchController({requests: searchRequests, parent: () => scope, screen,
      focus: {zone, column, setZone, setColumn}, query: {current: search, set: setSearch}, capabilities: searchCapabilities,
      media: {page, set: setPage, replace: replacePage, error: setSearchError, pending: {current: searchMediaPending, set: setSearchMediaPending}, remember: index => {searchMediaFocus = index;}},
      channels: {current: searchChannels, set: setSearchChannels, pages: setSearchChannelPages, error: setSearchChannelError, paging: setSearchChannelPaging,
        pending: {current: searchChannelsPending, set: setSearchChannelsPending}, remembered: () => searchChannelFocus, remember: index => {searchChannelFocus = index;},
        read: signal => refreshChannelPage(true, signal), adopt: page => adoptChannelWindow([page], true)},
      discover: (query, signal) => api.discover(query, signal), restart: restartPaging, loading: setLoading, error: setError, retry: work => {retry = work;}, fail});
    const {reconcile: reconcileSources, focusBest: focusBestMatch} = createSourceRows({rows: sources, adopt: setSources,
      visible: visibleSources, focused: focusedSource, manual: () => manualSourceSelection, selection: {current: choice, set: setChoice}});
    const publishSources = createSourcePublisher({api, owns: operation => sourceScope === operation,
      generation: {next: () => ++sourceFilterGeneration, current: () => sourceFilterGeneration}, height: sourceHeight,
      ids: setAllSourceIds, page: setSourcePage, filtering: setSourceFiltering, reconcile: reconcileSources, focusBest: focusBestMatch, fail});
    /** The app resumes from the card's own progress, and the server may key
     * that progress to a different metadata provider than the stream. Sending
     * the position explicitly makes the button and the decoder agree. */
    function cardResumePosition(card: Card) {
      const progress = card.progress ?? card.view?.progress ?? 0;
      if (progress <= 0 || progress >= 1) return 0;
      const runtime = card.metadata?.runtime_minutes ?? 0;
      return runtime > 0 ? progress * runtime * 60 : 0;
    }
    const playIntent = createSourceIntent({api,
      begin: (card, restart, channel, replaceCurrent, position) => {
        const id = ++sourceIntent, epoch = api.scopeEpoch;
        manualPresentation = undefined;
        countdown.cancel();
        sourceStartPosition = restart
          ? 0
          : Math.max(0, position ?? cardResumePosition(card));
        sourceScope?.abort();
        const operation = new AbortController();
        sourceScope = operation;
        setPickerCard(card);
        setSourceChannel(channel);
        setReplacingSource(replaceCurrent);
        setAction(undefined);
        setSources([]);
        setAllSourceIds([]);
        setSourcePage(undefined);
        setSourceFacet(0);
        setSourceHeight(undefined);
        setSourceFiltering(false);
        setSourceProviderFilter(undefined);
        setSourceMenu(undefined);
        setSourceActions(false);
        setSourceFailure("");
        setFailedSources(new Set<string>());
        manualSourceSelection = false;
        sourceFilterGeneration++;
        setSourceFilterFocus(false);
        setSourceLoading(true);
        return {id, epoch, operation};
      }, owner: {intent: () => sourceIntent, epoch: () => api.scopeEpoch, operation: () => sourceScope,
        replace: operation => {sourceScope = operation;}, aborted: () => scope.signal.aborted},
      position: () => sourceStartPosition, manual: () => manualSourceSelection, playerScreen: () => screen() === "player", memory: sourceMemory,
      presentation: {capture: overlays.captureOrigin, hide: overlays.hide, show: () => openOverlay({kind: "sources", title: "Choose a source"})},
      resolve: action => {setAction(action);setPickerCard(action.card);}, retry: work => {retry = work;},
      page: setSourcePage, ids: setAllSourceIds, loading: setLoading, discovering: setSourceLoading,
      failure: {current: sourceFailure, set: setSourceFailure}, rows: sources, reconcile: reconcileSources, publish: publishSources,
      play: playSource, notify, fail});
    async function playSource(source: Source, direct = false, manual = true): Promise<boolean> {
      const current = action();
      if (!current) return false;
      const attempt = ++sourceAttempt;
      if (manual) sourceIntent++;
      const outgoing = { lease: player.leaseId, action: activeAction(), source: activeSource(), channel: activeChannel() };
      manualPresentation = manual ? { source: source.id, card: episodeKey(current.card), scope: deviceScope(), title: deviceTitleKey(deviceScope(), current.card) } : undefined;
      const channel = sourceChannel();
      retry = () =>
        void playIntent(
          current.card,
          true,
          false,
          channel,
          player.canReplaceSource,
        );
      if (screen() !== "player") {
        returnScreen = screen();
        returnFocus = {
          zone: overlays.origin().zone,
          column: overlays.origin().column,
          row: overlays.origin().row,
        };
      }
      sourceScope?.abort();
      if (screen() === "search") {
        searchRequests.scope?.abort();
        clearTimeout(searchRequests.timer);
      }
      setScreen("player");
      setError("");
      setPlaybackError("");
      setTimelineFocused(true);
      playerNavigation.reset();
      setActiveSource(source);
      setActiveAction(current);
      setActiveChannel(sourceChannel());
      setShowControls(true);
      setChoice(0);
      setSourceFailure("");
      setPlaybackSegments([]);
      // The drawer stays up while the chosen stream opens, so its status line
      // reports the contract's `Opening stream…` from the player's real
      // preparation instead of a timer, and a second press cannot start a
      // duplicate stream.
      setOpeningSource(source);
      setLoading(true);
      document.getElementById("video-layer")!.style.display = "block";
      let started = false;
      try {
        await startSourceCandidate({player, source, action: current, direct, manual, replacing: replacingSource(), position: () => sourceStartPosition,
          current: () => attempt === sourceAttempt, notify});
        started = true;
        setLoading(false);
        void refreshPlaybackSegments();
        hideControls();
      } catch (error) {
        // Cancellation can leave the outgoing lease alive too. Restore its UI
        // only while this attempt still owns it; never rewind a newer attempt.
        const retained = outgoing.lease && player.leaseId === outgoing.lease;
        if (retained && activeAction() === current && activeSource() === source) {
          setActiveAction(outgoing.action);setActiveSource(outgoing.source);setActiveChannel(outgoing.channel);
        }
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        // A replacement admission failure leaves the outgoing lease alive.
        // Keep it (and sourceRetry) so the open picker can try another source.
        if (attempt === sourceAttempt) manualPresentation = undefined;
        if (!retained && (!replacingSource() || !player.leaseId))
          await player.stop().catch(() => {});
        setLoading(false);
        setError("");
        setPlaybackError("");
        setFailedSources((previous) => new Set(previous).add(source.id));
        // Keep the picker over the page that requested the stream, exactly as
        // the TV drawer does, and mark the row instead of dead-ending in the
        // player's full-screen failure card.
        if (returnScreen && !player.leaseId) {
          setScreen(returnScreen);
          setZone(returnFocus.zone);
          setColumn(returnFocus.column);
          setRow(returnFocus.row);
        }
        setSourceFailure(
          "This source couldn't start. Choose another source.",
        );
      } finally {
        if (attempt === sourceAttempt) setOpeningSource(undefined);
        // Only the drawer this stream was successfully chosen from. A failed
        // start stays open so the next source is one press away.
        if (started && overlay()?.kind === "sources") overlays.hide();
      }
      return started;
    }
    let controlsHideAt = 0;
    function hideControls(activity = true) {
      if (activity || !controlsHideAt) controlsHideAt = Date.now() + 5000;
      clearTimeout(controlsTimer);
      controlsTimer = setTimeout(() => {
        if (
          !error() && !overlay() &&
          !seeking() &&
          !loading() &&
          snapshot()?.state === "playing"
        )
          setShowControls(false);
      }, Math.max(0, controlsHideAt - Date.now()));
    }
    // A timer armed during buffering used to give up and never re-arm. Re-arm
    // on every transition back to playing so chrome always clears itself.
    const controlsCanAutoHide = createMemo(() =>
      screen() === "player" && !overlay() && snapshot()?.state === "playing" &&
      !seeking() && !loading() && !error(),
    );
    createEffect(() => {
      // Memo equality keeps position/buffer snapshots from rearming this timer.
      if (controlsCanAutoHide()) hideControls(false);
      else clearTimeout(controlsTimer);
    });
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
    // The settings boards' canonical order; sign-out lives under Account.
    const settingsTabs = [
      "Account",
      "Profiles",
      "Playback",
      "Subtitles & audio",
      "Add-ons",
      "Source integrations",
      "Display",
      "Parental controls",
      "About",
    ];
    /** The existing Settings section by name, so a copy change moves no code. */
    const settingsTabIndex = (label: string) =>
      Math.max(0, settingsTabs.indexOf(label));
    const {choice: preferenceChoice, displayItem} = createPreferenceControls({current: preferences, adopt: setPreferences,
      request: call, path: () => api.scoped("/preferences"), reload: () => loadSettings(settingsTab(), scope.signal),
      dialogs: {open: openOverlay, close: closeOverlay}, calibrate: setCalibrationValue});
    /** Household writes (add-ons, source integrations, the parent PIN, kids
     * limits) are refused to a paired device session by the server's owner
     * guard. `/api/bootstrap` does not project that capability, so it is asked
     * for once per session; an unknown answer keeps the control and lets the
     * refusal explain itself. */
    async function mayWriteHousehold() {
      if (canManageAccount() === undefined)
        setCanManageAccount(await api.canManageAccount());
      return offersHouseholdWrite(canManageAccount());
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
    const profilePreferenceRows = createProfilePreferenceRows({current: preferences, adopt: setPreferences, request: call,
      path: () => api.scoped("/preferences"), reload: () => loadSettings(settingsTab(), scope.signal), choose: preferenceChoice});
    const devicePreferenceRows = createDevicePreferenceRows({device: devicePlayback, scope: deviceScope,
      reload: () => loadSettings(settingsTabIndex("Playback"), scope.signal)});
    const householdSettings = {request: call, path: (path: string) => api.scoped(path), mayWrite: mayWriteHousehold,
      dialogs: {open: openOverlay, close: closeOverlay, dismiss: dismissOverlay}, prompt: edit, notify};
    const addonSettings = createAddonSettings({...householdSettings, reload: () => loadSettings(settingsTabIndex("Add-ons"), scope.signal)});
    const integrationSettings = createIntegrationSettings({...householdSettings, reload: () => loadSettings(settingsTabIndex("Source integrations"), scope.signal)});
    const parentSettings = createParentSettings({...householdSettings, profiles: management, refreshProfiles,
      reload: () => loadSettings(settingsTabIndex("Parental controls"), scope.signal)});
    async function loadSettings(tab: number, signal: AbortSignal) {
      if (signal.aborted) return;
      retry = () => void loadSettings(tab, scope.signal).catch(fail);
      settingsScope?.abort();
      settingsScope = new AbortController();
      signal = settingsScope.signal;
      setSettingsTab(tab);
      setSettingsItems([]);
      setLoading(true);
      if (tab === 0) {
        // Account: server identity facts plus this device's sign-out. The
        // boards' Devices row needs account-wide revocation, which the
        // producer deliberately does not offer — the row stays absent.
        setSettingsItems(accountSettings({email: accountEmail, dialogs: {open: openOverlay, close: closeOverlay}, signOut: async () => {
          await player.stop();
          await api.signOut();
          resetScope();
          clearProfileView();
          setScreen("welcome");
          setLoading(false);
        }}));

        setLoading(false);
        return;
      }
      if (tab === 1) {
        const value = await api.profiles(signal);
        setManagement(value);
        setSettingsItems(
          value.profiles.map((profile, index) => ({
            id: profile.id,
            label: profile.name,
            value: profile.id === api.profile ? "Watching" : "",
            run: () => manageProfile(index),
          })),
        );
        setLoading(false);
        return;
      }
      const pref = await api.preferences(signal);
      setPreferences(pref);
      if (tab === 2 || tab === 3) setSettingsItems(profilePreferenceRows(pref, tab));
      if (tab === 2) setSettingsItems(await devicePreferenceRows());
      if (tab === 6)
        setSettingsItems(
          (pref.controls ?? [])
            .filter((control) => control.group === "display")
            .map((control) => displayItem(control)),
        );
      if (tab === 4) setSettingsItems(await addonSettings(signal));
      if (tab === 5) setSettingsItems(await integrationSettings(signal));
      if (tab === 7) setSettingsItems(await parentSettings(signal));
      if (tab === 8)
        setSettingsItems([
          {
            id: "about",
            label: "VIPTV",
            value: "TV app",
            description: api.origin,
            run: () => {},
          },
        ]);
      setLoading(false);
    }
    async function refreshProfiles() {
      const value = await api.profiles(scope.signal);
      setManagement(value);
      if (
        screen() === "settings" &&
        (settingsTab() === 0 || settingsTab() === 1)
      )
        setSettingsItems(
          value.profiles.map((profile, index) => ({
            id: profile.id,
            label: profile.name,
            value: profile.id === api.profile ? "Watching" : "",
            run: () => manageProfile(index),
          })),
        );
    }
    const manageProfile = createProfileManagement({current: management, request: call, refresh: refreshProfiles,
      dialogs: {open: openOverlay, close: closeOverlay, dismiss: dismissOverlay}, prompt: edit});
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
    const navigateSettings = createSettingsNavigation({ focus: navigationFocus, tab: settingsTab,
      tabCount: settingsTabs.length, items: settingsItems, load: tab => { void loadSettings(tab, scope.signal).catch(fail); }, fail });
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
      selection: {index: choice, set: setChoice, timeline: timelineFocused, setTimeline: setTimelineFocused},
      timeline: {seeking, allowed: () => playerActions().seek, duration: () => snapshot()?.time.durationSeconds,
        position: () => snapshot()?.time.positionSeconds ?? 0, preview: seek, setPreview: setSeek},
      controls: {count: () => playerButtons().length, show: () => { setShowControls(true); }, activity: hideControls} });
    const navigateHero = createHeroNavigation({focus: navigationFocus, action: setHeroAction, row: setRow, homeNavIndex: () => navIndex("home"),
      home: {rows: () => home()?.rows ?? [], resolve: index => homeRowFocus.resolve(home()?.rows[index]), remember: rememberHomeRow},
      detail: {hasEpisodes: detailHasEpisodes, recommendations: () => detail()?.recommendations.length ?? 0, seasons: () => detail()?.seasons.length ?? 0}});
    const navigateHomeRows = createHomeRowsNavigation({focus: navigationFocus, row: {index: row, set: setRow},
      rows: () => home()?.rows ?? [], resolve: shelf => homeRowFocus.resolve(shelf), remember: rememberHomeRow, load: loadHomePage, move: moveToItem});
    const navigateSources = createSourceNavigation({manual: () => { manualSourceSelection = true; },
      actions: {open: () => !!sourceActions(), set: setSourceActionChoice, count: () => sourceActionOptions.length},
      menu: {open: () => !!sourceMenu(), set: setSourceMenuChoice, count: () => sourceMenuOptions().length},
      filters: {focused: sourceFilterFocus, focus: setSourceFilterFocus, facet: setSourceFacet},
      rows: {index: choice, set: setChoice, count: () => visibleSources().length}});
    const navigateOverlay = createOverlayNavigation({selection: {index: choice, set: setChoice}, tracks: {index: trackColumn, set: setTrackColumn},
      calibration: {value: calibrationValue, set: setCalibrationValue, preview: applyScreenInset}, keyboard: setKey, sources: navigateSources});
    const navigateSearch = createSearchNavigation({focus: navigationFocus, keyboard: {index: key, set: setKey}, navIndex: () => navIndex("search"),
      media: {count: () => page().cards.length, error: searchError, needsRetry: searchNeedsRetry,
        remembered: () => searchMediaFocus, remember: index => {searchMediaFocus = index;}, move: index => moveToItem(index, page().cards.length)},
      channels: {count: () => searchChannels().length, error: searchChannelError, enabled: () => searchCapabilities().channels,
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
      paging: {move: moveToItem, more: () => {void more();}}, loadGuide: index => {void loadGuide(index);}});
    function move(dx: number, dy: number) {
      rememberContentFocus();
      rememberDetailFocus();
      countdown.cancel();
      channelPending = undefined;
      if (screen() === "pairing") {
        setPairingFocused(true);
        return;
      }
      if (screen() === "signed-in") {
        // The confirmation exposes a single focusable acknowledgement; Left and
        // Right still move the reported focus for remote-parity without acting.
        if (dx) setColumn((i) => Math.max(0, Math.min(1, i + dx)));
        return;
      }
      if (overlayClosing() || error()) return;
      // The picker is terminal while the chosen stream opens.
      if (openingSource()) return;
      if (revealEndedControls()) return;
      pendingFocus = undefined;
      restartHeroCycling();
      if (loading() && screen() === "welcome") return;
      if (overlay()) { navigateOverlay(overlay()!, dx, dy); return; }
      if (screen() === "player") { playerNavigation.move(dx, dy); return; }
      if (screen() === "profiles") { navigateProfiles(dx, dy); return; }
      if (zone() === "nav") {
        setColumn((i) => Math.max(0, Math.min(navs().length - 1, i + dx)));
        if (dy > 0) {
          // The empty and failed Live forms own the whole page: Down enters them
          // only when there is an action to land on (LIVE-EMPTY-01, -05, -14).
          if (screen() === "live" && !liveKeepsToday(liveSpread())) {
            const actions =
              liveSpread() === "no-source"
                ? liveNoSourceActions(liveViewer())
                : liveRecovery();
            if (actions.length) {
              setZone("live-empty");
              setColumn(0);
            }
            return;
          }
          if (screen() === "live") {
            focusLiveSpread();
            return;
          }
          setColumn(["movie", "series", "anime"].includes(screen()) ? contentFocus.resolve(contentRow()) : 0);
          setZone(
            screen() === "home" || screen() === "detail"
              ? "hero"
              : screen() === "settings"
                ? "settings-nav"
                : screen() === "calendar"
                  ? "calendar-days"
                  : screen() === "search"
                  ? "keyboard"
                  : screen() === "library" && libraryControlCount()
                    ? "library-controls"
                    : "content",
          );
        }
        return;
      }
      if (screen() === "settings") { navigateSettings(dx, dy); return; }
      if (screen() === "detail" && navigateDetail(dx, dy)) return;
      if (screen() === "calendar") { navigateCalendar(dx, dy); return; }
      if (zone() === "hero") { navigateHero(dx, dy, screen()); return; }
      if (screen() === "home" && zone() === "rows") { navigateHomeRows(dx, dy); return; }
      if (screen() === "search" && navigateSearch(dx, dy)) return;
      if (screen() === "live" && navigateLive(dx, dy)) return;
      navigateContent(dx, dy);
    }
    function keyboardActivate(isOverlay: boolean) {
      const index = key();
      const modal = overlay();
      if (isOverlay && modal?.kind === "text" && modal.numeric) {
        if (index === 11) void run(() => modal.submit(text()));
        else if (index === 9) setText((value) => value.slice(0, -1));
        else
          setText((value) =>
            (value + (index === 10 ? "0" : String(index + 1))).slice(0, 8),
          );
        return;
      }
      if (index === 42) {
        setKeyboardUpper((value) => !value);
        return;
      }
      if (index === 45) {
        setKeyboardSymbols((value) => !value);
        return;
      }
      if (index === 46) {
        if (isOverlay && modal?.kind === "text")
          void run(() => modal.submit(text()));
        else {
          setZone("content");
          setColumn(0);
        }
        return;
      }
      if (index === 47) {
        if (isOverlay) dismissOverlay();
        else updateSearch("");
        return;
      }
      const value = isOverlay ? text() : search();
      const next =
        index < 42
          ? value + keyboardCharacters()[index]
          : index === 43
            ? value + " "
            : index === 44
              ? Array.from(value).slice(0, -1).join("")
              : value;
      if (isOverlay) setText(next.slice(0, 2048));
      else updateSearch(next);
    }
    const activateSources = createSourceActivation({rows: {all: sources, visible: visibleSources, set: setSources, ids: allSourceIds, page: setSourcePage},
      selection: {value: choice, set: setChoice}, actions: {open: sourceActions, set: setSourceActions, choice: sourceActionChoice},
      menu: {kind: sourceMenu, set: setSourceMenu, choices: sourceMenuOptions, remember: setOpenSourceMenuOptions, choice: sourceMenuChoice, select: setSourceMenuChoice},
      filters: {focused: sourceFilterFocus, facet: sourceFacet, quality: {value: sourceHeight, set: setSourceHeight, choices: qualityMenuOptions},
        provider: {value: sourceProviderFilter, set: setSourceProviderFilter, choices: providerMenuOptions}}, loading: sourceLoading,
      filtering: {value: sourceFiltering, set: setSourceFiltering}, manual: () => {manualSourceSelection = true;},
      generation: {next: () => ++sourceFilterGeneration, current: () => sourceFilterGeneration}, operation: () => sourceScope,
      signal: () => sourceScope?.signal ?? scope.signal, rank: (ids, height, signal, reuse) => api.rankSources(ids, height, signal, reuse), play: playSource});
    const activatePlayer = createPlayerActivation({player, snapshot, actions: playerActions, action: activeAction, channel: activeChannel, choice, buttons: playerButtons,
      timeline: {value: seek, set: setSeek, seeking: setSeeking}, chrome: {visible: showControls, set: setShowControls, hide: hideControls},
      segments: {active: activeSegment, clear: () => {setPlaybackSegments([]);}, refresh: refreshPlaybackSegments},
      skipEnabled: () => preferences()?.preferences.skip_intros !== false, next: advanceEpisode, tracks: openTracks, play: playIntent,
      details: card => api.detail(card, "0", scope.signal), dialogs: {open: openOverlay}});
    const chooseSeason = createSeasonPicker({current: detail, adopt: setDetail, season: {current: seasonIndex, set: setSeasonIndex},
      focus: navigationFocus, choice: setChoice, loading: setLoading, rememberedEpisode: () => detailFocus.resolve(detailRow("episodes")), restart: restartPaging,
      request: (card, cursor, signal) => api.detail(card, cursor, signal), open: openOverlay, close: closeOverlay});
    async function activate() {
      countdown.cancel();
      if (revealEndedControls()) return;
      channelPending = undefined;
      restartHeroCycling();
      const canLeaveLoading =
        !overlay() &&
        ((zone() === "nav" && !["welcome", "pairing"].includes(screen())) ||
          (screen() === "search" && zone() === "keyboard"));
      if (pending() || overlayClosing() || (loading() && !canLeaveLoading))
        return;
      if (error()) {
        setError("");
        retry();
        return;
      }
      const modal = overlay();
      if (modal) {
        if (modal.kind === "next") {
          if (choice() === 0) await advanceEpisode();else dismissNext();
          return;
        }
        if (modal.kind === "tracks") {
          await run(async () => {
            await modal.columns[trackColumn()]?.items[choice()]?.run();
          });
          return;
        }
        if (modal.kind === "calibration") {
          await run(async () => {
            await modal.save(calibrationValue());
          });
          closeOverlay();
          return;
        }
        if (modal.kind === "text") keyboardActivate(true);
        else if (modal.kind === "sources") await activateSources();
        else
          await run(async () => {
            await modal.items[choice()]?.run();
          });
        return;
      }
      if (screen() === "calendar") {
        if (zone() === "calendar-list" || zone() === "calendar-watch") {
          const entry = calendarDayEntries()[calendarEntry()];
          if (entry) await openDetail(entry.card);
          return;
        }
        if (zone() === "calendar-days") return;
      }
      if (screen() === "welcome" || screen() === "pairing") {
        await beginPairing();
        return;
      }
      if (screen() === "signed-in") {
        finishSignIn();
        return;
      }
      if (screen() === "profiles") {
        if (zone() === "profile-manage") {
          manageProfile(
            Math.min(column(), (management()?.profiles.length ?? 1) - 1),
          );
          return;
        }
        await selectProfile(column());
        return;
      }
      if (screen() === "player") { await activatePlayer(); return; }
      if (zone() === "nav") {
        const nav = navs()[column()];
        if (!nav) return;
        if (nav.id === "profiles")
          openOverlay({
            kind: "choices",
            title: "Your profile",
            items: [
              {
                id: "profiles",
                label: "Switch profile",
                run: async () => {
                  closeOverlay();
                  await navigate("profiles");
                },
              },
              {
                id: "settings",
                label: "Settings",
                run: async () => {
                  closeOverlay();
                  await navigate("settings");
                },
              },
            ],
          });
        else await navigate(nav.id);
        return;
      }
      if (screen() === "settings") {
        if (zone() === "settings-nav") {
          setZone("settings-content");
          setColumn(0);
        } else
          await run(async () => {
            await settingsItems()[column()]?.run();
          });
        return;
      }
      if (screen() === "detail" && zone() === "seasons") { chooseSeason(); return; }
      if (screen() === "search" && zone() === "keyboard") {
        const index = key();
        updateSearch(
          index === 0
            ? search() + " "
            : index === 1
              ? Array.from(search()).slice(0, -1).join("")
              : search() + searchLetters[index - 2],
        );
        return;
      }
      if (
        screen() === "search" &&
        ["search-retry", "search-channel-retry"].includes(zone())
      ) {
        if (zone() === "search-channel-retry" && channelRetry) {
          const direction = channelRetry;
          setZone("search-channels");
          setColumn(searchChannelFocus);
          await moreChannels(direction);
          return;
        }
        setZone("keyboard");
        updateSearch(search(), true);
        return;
      }
      if (screen() === "search" && zone() === "search-channels") {
        const channel = searchChannels()[column()];
        if (channel) await playIntent(channel.card, false, false, channel.id);
        return;
      }
      if (zone() === "library-controls") {
        if (column() === 0 && libraryType()) chooseLibrary(libraryType()!);
        else if (column() === 1 && librarySort())
          chooseLibrary(librarySort()!);
        else
          await run(() => applyLibrary(libraryDefaultQuery()));
        return;
      }
      if (zone() === "filters") { activateCatalog(column()); return; }
      if (
        screen() === "home" &&
        zone() === "rows" &&
        home()?.rows[row()]?.state === "Failed"
      ) {
        setHome(stremioHome(await api.home(scope.signal)));
        return;
      }
      if (zone() === "hero") {
        const card =
          screen() === "detail" ? detailTarget()?.card : hero();
        if (!card) {
          if (screen() === "home" && home()?.complete)
            await navigate("settings");
          return;
        }
        if (heroAction() === 0) await playIntent(card);
        else if (heroAction() === 1)
          await toggleSaved(screen() === "detail" ? detail()?.item ?? card : card);
        else if (heroAction() === 2) {
          if (screen() === "home") await openDetail(card);
          else {
            setZone("episodes");
            setColumn(0);
          }
        } else await playIntent(card, true);
        return;
      }
      if (screen() === "live" && zone() === "live-empty") {
        await activateLiveSpread();
        return;
      }
      if (screen() === "live" && zone() === "live-groups") {
        const group = column() ? groups()[column() - 1]?.id : undefined;
        await loadLiveGroup(group);
        return;
      }
      if (screen() === "live") {
        // A failed page fetch leaves a pending retry; Enter retries it before
        // it could be mistaken for a play intent on the focused channel.
        if (channelRetry) {
          const direction = channelRetry;
          channelRetry = undefined;
          await moreChannels(direction);
          return;
        }
        const channel = channels()[column()];
        if (channel) await playIntent(channel.card, false, false, channel.id);
        return;
      }
      const card =
        screen() === "detail"
          ? zone() === "recommendations"
            ? detail()?.recommendations[column()]
            : detailHasEpisodes()
              ? detailEpisodes()[column()]
              : detail()?.recommendations[column()]
          : screen() === "home"
            ? home()?.rows[row()]?.cards[column()]
            : page().cards[column()];
      if (card) {
        if (
          (screen() === "detail" && card.identity.episode) ||
          (screen() === "home" && card.view?.preview?.action === "play")
        )
          await playIntent(card);
        else await openDetail(card);
      }
    }
    function pressTarget(){
      const modal=overlay();
      if(modal?.kind==='sources')return JSON.stringify(['sources',sourceFilterFocus()?['filter',sourcePage()?.quality_filters?.[sourceFacet()-1]?.height]:['source',focusedSource()?.id],selected()?cardKey(selected()!):null]);
      if(modal)return JSON.stringify([modal.kind,modal.kind==='text'?key():choice()]);
      // The hero term identifies the billboard only while the billboard is the
      // focused element. On a rows card the hero is the delayed preview, which
      // changes 400ms into a hold and would otherwise defeat the 700ms timer.
      return JSON.stringify([screen(),screen() === "player" ? choice() : null,zone(),column(),row(),heroAction(),zone()==="hero"?(hero()?cardKey(hero()!):null):null,focusedCard()?cardKey(focusedCard()!):null,heroAction()===1&&hero()?isSaved(hero()!):null]);
    }
    const showLiveMenu = createLiveMenu({request: call, path: path => api.scoped(path), favorites: setLiveFavorites,
      dialogs: {open: openOverlay, close: closeOverlay}, play: playIntent, fail});
    const showCardMenu = createCardMenu({dialogs: {open: openOverlay, close: closeOverlay}, details: openDetail,
      play: playIntent, saved: isSaved, toggleSaved});
    function menu() {
      countdown.cancel();
      if (revealEndedControls()) return;
      if (overlay()?.kind === "next") { if (choice() === 0) void advanceEpisode(true).catch(fail);return; }
      if (screen() === "player" && !overlay()) {
        if (playerButtons()[choice()]?.id === "next") void advanceEpisode(true).catch(fail);
        else if (activeAction()) void playIntent(activeAction()!.card, true, false, activeChannel(), player.canReplaceSource).catch(fail);
        return;
      }
      if (sourceActions()) return;
      if (
        overlay()?.kind === "sources" &&
        !sourceFilterFocus() &&
        !sourceMenu() &&
        visibleSources().length
      ) {
        setSourceActionChoice(0);
        setSourceActions(true);
        return;
      }
      if (overlay()) {
        if (overlay()?.kind === "sources") manualSourceSelection = true;
        return;
      }
      if (screen() === "settings") {
        if (zone() === "settings-content")
          void Promise.resolve(settingsItems()[column()]?.run()).catch(fail);
        return;
      }
      const channel =
        screen() === "live" && zone() === "content"
          ? channels()[column()]
          : screen() === "search" && zone() === "search-channels"
            ? searchChannels()[column()]
            : undefined;
      if (channel) {
        showLiveMenu(channel);
        return;
      }
      if (screen() === "profiles") {
        if (canManageProfiles()) manageProfile(column());
        return;
      }
      if (["nav", "filters", "keyboard", "seasons"].includes(zone())) return;
      const card = zone() === "hero" ? hero() : focusedCard();
      if (card) showCardMenu(card);
    }
    createEffect(() => {
      const state = screen();
      document.documentElement.dataset.tvScreen = state;
      document.documentElement.dataset.tvNavigation = navs()
        .map((item) => item.id)
        .join(",");
      document.documentElement.dataset.tvOverlay = overlay()?.kind ?? "";
      document.documentElement.dataset.tvSources = String(sources().length);
      document.documentElement.dataset.tvSourceProviders = sourceProviders()
        .map(([label]) => label)
        .join(",");
      document.documentElement.dataset.tvSourceChoice = String(choice());
      document.documentElement.dataset.tvPlayerState = String(
        snapshot()?.state ?? "",
      );
      document.documentElement.dataset.tvPlaybackError = playbackError();
      document.documentElement.dataset.tvPlayerControls = String(showControls());
      document.documentElement.dataset.tvPlayerSeeking = String(seeking());
      document.documentElement.dataset.tvPlayerPosition = String(snapshot()?.time.positionSeconds ?? "");
      document.documentElement.dataset.tvPlayerDuration = String(snapshot()?.time.durationSeconds ?? "");
      document.documentElement.dataset.tvPlayerTimelineFocus = String(timelineFocused());
      document.documentElement.dataset.tvSourcePhase = sourcePage()?.discovery_phase ?? "";
      document.documentElement.dataset.tvSourcePreparing = String(sourceLoading() && !overlay());
      document.documentElement.dataset.tvPlayerBusy = String(loading() || seeking() || snapshot()?.state === "buffering");
      document.documentElement.dataset.tvSourceIdentity = focusedSource()?.id ?? "";
      document.documentElement.dataset.tvPlayerEpisode = String(activeAction()?.card.identity.episode?.episode ?? "");
      document.documentElement.dataset.tvNextStatus = episodeState().status;
      document.documentElement.dataset.tvNextPrepared = String(!!episodeState().prepared);
      document.documentElement.dataset.tvAutoplayCountdown = String(countdownState().remaining ?? "");
      document.documentElement.dataset.tvSourceMenu = sourceMenu() ?? "";
      document.documentElement.dataset.tvSourceFilterFocus = String(
        sourceFilterFocus(),
      );
      document.documentElement.dataset.tvSourceFacet = String(sourceFacet());
      document.documentElement.dataset.tvSourceMenuChoice = String(
        sourceMenuChoice(),
      );
      document.documentElement.dataset.tvSourceFilter =
        sourceProviderFilter() ?? "";
      document.documentElement.dataset.tvSourceFailure = sourceFailure();
      document.documentElement.dataset.tvLibrarySort = String(
        library()?.query?.sort ?? "",
      );
      document.documentElement.dataset.tvCalendarEntries = String(
        calendar()?.entries.length ?? 0,
      );
      // The picker's own state, so a session can be checked without reading the
      // canvas: the status line and the empty state are drawn, not queried.
      document.documentElement.dataset.tvSourceStatus = String(sourceSpread());
      document.documentElement.dataset.tvReady = String(
        !loading() && !pending(),
      );
      document.documentElement.dataset.tvChannelId =
        (state === "live" && zone() === "content"
          ? channels()[column()]
          : state === "search" && zone() === "search-channels"
            ? searchChannels()[column()]
            : undefined
        )?.id ?? "";
      document.documentElement.dataset.tvFocus =
        zone() === "confirmation"
          ? `confirmation:${row()}:${column()}`
          : `${zone()}:${column()}:${row()}:${heroAction()}:${choice()}`;
      document.documentElement.dataset.tvSaver = String(screenSaver());
      // The Live page's own state, so a session can be checked without reading
      // the canvas: the empty, loading and failed forms are not all visible as
      // copy on screen.
      document.documentElement.dataset.tvLiveSpread = String(
        screen() === "live" ? liveSpread() : "",
      );
      if (state !== "player")
        document.getElementById("video-layer")!.style.display = "none";
    });
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
    let inputRequested = false;
    createEffect(() => {
      if (inputRequested) return;
      inputRequested = true;
      const input = createKeyboardInput({screen, overlay, zone, cancelCountdown: () => countdown.cancel(), hideControls,
        pair: beginPairing, stop: leavePlayer, text: setText, query: search, search: updateSearch, fail,
        media: createPlayerMediaKeys({player, snapshot, actions: playerActions, active: activeAction, seeking: {current: seeking, set: setSeeking},
          revealEnded: revealEndedControls, play: playIntent, chrome: {show: setShowControls, hide: hideControls},
          segments: {clear: () => {setPlaybackSegments([]);}, refresh: refreshPlaybackSegments}, fail})});
      onCleanup(installWindowInputs({keyboard: input, screen, overlay, loading, error, pair: beginPairing, stop: leavePlayer,
        next: {advance: advanceEpisode, dismiss: dismissNext}, cancelHold: () => heldSelect.cancel(), cancelCountdown: () => countdown.cancel(),
        visible: setHeroVisible, wake: reloadIdleImages, fail}));
    });
    onCleanup(() => {
      alive = false;
      heldSelect.cancel();
      overlays.dispose();
      scope.abort();
      settingsScope?.abort();
      sourceScope?.abort();
      revisions.stop();
      clearTimeout(noticeTimer);
      clearTimeout(searchRequests.timer);
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
          if (dismissScreenSaver()) return;
          move(-1, 0);
        },
        right() {
          countdown.cancel();
          if (dismissScreenSaver()) return;
          move(1, 0);
        },
        up() {
          countdown.cancel();
          if (dismissScreenSaver()) return;
          move(0, -1);
        },
        down() {
          countdown.cancel();
          if (dismissScreenSaver()) return;
          move(0, 1);
        },
        back() {
          countdown.cancel();
          if (dismissScreenSaver()) return;
          void back().catch(fail);
        },
        menu() {
          countdown.cancel();
          if (dismissScreenSaver()) return;
          menu();
        },
        enter(event?: KeyboardEvent) {
          countdown.cancel();
          if (revealEndedControls()) return undefined;
          if (dismissScreenSaver()) return;
          // A held Enter auto-repeats; only the first keydown arms the hold
          // timer, so repeats must not reset it or the 700ms menu never fires.
          if (event?.repeat) return undefined;
          restartHeroCycling();
          if (overlay()?.kind === "sources") manualSourceSelection = true;
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
          <TvView
            w={sceneWidth()}
            h={1080}
            clipping={sceneWidth() < 1920}
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
            <Show when={screen() === "welcome"}>
              <EntryScreen
                loading={loading()}
                focused={!loading() && !error()}
              />
            </Show>
            <Show when={screen() === "pairing"}>
              <PairingScreen
                pairing={pairing()}
                qr={qr()}
                deadline={pairingDeadline()}
                focused={pairingFocused() && !loading() && !error()}
              />
            </Show>
            <Show when={screen() === "signed-in" && signedIn()}>
              {(value) => (
                <SignedIn bootstrap={value()} onComplete={finishSignIn} />
              )}
            </Show>
            <Show when={screen() === "profiles"}>
              <ProfilesScreen
                profiles={management()?.profiles ?? []}
                create={available(management()?.capabilities.create)}
                manage={canManageProfiles()}
                index={column()}
                zone={zone()}
                loading={loading()}
              />
            </Show>
            <Show when={screen() === "calendar"}>
              <CalendarBoard
                entries={calendar()?.entries ?? []}
                days={calendarDaysList()}
                day={calendarDay()}
                active={calendarEntry()}
                dayFocused={zone() === "calendar-days"}
                listFocused={zone() === "calendar-list"}
                watchFocused={zone() === "calendar-watch"}
                loading={loading()}
                error={error()}
              />
            </Show>
            <Show when={screen() === "home"}>
              <HomeContent home={home()} hasHero={!!hero()} presentation={{card: displayHero, mode: heroPresentation.mode}}
                focus={{zone, row, column, action: heroAction}} billboard={heroCycle}
                shelfTop={shelfTitleY()} columnForRow={shelf => homeRowFocus.resolve(shelf)} isSaved={isSaved} />
            </Show>
            <Show when={screen() === "detail"}>
              <DetailContent detail={detailForDisplay()} selectedTitle={selected()?.title}
                hasEpisodes={detailHasEpisodes()} episodes={detailEpisodes()} zone={zone()} column={column()}
                heroAction={heroAction()} seasonIndex={seasonIndex()} episodeColumn={detailColumn("episodes")}
                recommendationColumn={detailColumn("recommendations")} actionLabel={detailActionLabel()}
                progress={detailPlayProgress()} remaining={detailPlayRemaining()}
                saved={!!detailForDisplay() && isSaved(detailForDisplay()!.item)} />
            </Show>
            <Show
              when={["movie", "series", "anime", "library", "search"].includes(screen())}
            >
              <Show when={screen() === "library"}>
                <LibraryToolbar
                  type={libraryType()}
                  sort={librarySort()}
                  filters={libraryFilters().length > 0}
                  query={library()?.query}
                  defaultQuery={library()?.default_query}
                  focused={zone() === "library-controls"}
                  index={column()}
                />
              </Show>
              <Show when={screen() === "movie" || screen() === "series" || screen() === "anime"}>
                <BrowseControls catalog={catalog()?.name ?? "Choose a catalog"} filters={(catalog()?.controls.length ?? 0) > 0}
                  focused={zone() === "filters"} index={column()} />
              </Show>
              <Show when={screen() === "search"}>
                <SearchHeader query={search()} selected={key()} keyboardFocused={zone() === "keyboard"} media={searchCapabilities().media}
                  retry={searchNeedsRetry()} resultCount={page().cards.length} error={searchError()} retryFocused={zone() === "search-retry"} />
              </Show>
              <Show
                when={
                  ["movie", "series", "anime", "library", "search"].includes(
                    screen(),
                  ) &&
                  (screen() !== "search" || searchCapabilities().media)
                }
              >
                <CatalogGrid screen={screen()} cards={page().cards} window={{start: gridStart, count: gridCount, columns: gridColumns, offset: gridOffset}}
                  focus={{active: () => zone() === "content", index: column}} loading={loading()}
                  search={{channels: () => searchCapabilities().channels, pending: searchMediaPending, retry: searchNeedsRetry, query: search}} />
              </Show>
              <Show
                when={
                  screen() === "search" &&
                  searchCapabilities().channels &&
                  search()
                }
              >
                <SearchChannels
                  channels={searchChannels()}
                  hasPrevious={!!edgeRequest(searchChannelPages(), "previous")}
                  index={
                    zone() === "search-channels" ? column() : searchChannelFocus
                  }
                  focused={zone() === "search-channels"}
                  y={searchCapabilities().media ? 650 : 140}
                  pending={searchChannelsPending() || searchChannelPaging()}
                  error={searchChannelError()}
                  retryFocused={zone() === "search-channel-retry"}
                />
              </Show>
            </Show>
            <Show when={screen() === "live"}>
              {/* LIVE-EMPTY-001A: one broadcast frame, no chips, no preview, no
                  rows. The crop and its scrim are the contract's own. */}
              <Label
                x={96}
                y={180}
                size={26}
                color={palette.muted}
                content={
                  liveSpread() === "loading" ? "Loading Live TV…" : ""
                }
              />
              <Show when={liveSpread() === "no-source"}>
                <LiveNoSource
                  viewer={liveViewer()}
                  focused={liveEmptyFocus()}
                />
              </Show>
              {/* LIVE-EMPTY-001B: the loading form has no copy at all, the
                  answered form carries the server's reason, and a first request
                  that failed says so instead of claiming a source is set up. */}
              <Show
                when={
                  liveSpread() === "loading" ||
                  liveSpread() === "no-channels" ||
                  liveSpread() === "failed"
                }
              >
                <Show when={liveSpread() === "no-channels"}>
                  <LiveAnswer
                    headline={LIVE_EMPTY_COPY.noChannelsHeadline}
                    body={liveNoChannelsBody(livePages()[0])}
                    actions={liveRecovery()}
                    focused={liveEmptyFocus()}
                  />
                </Show>
                <Show when={liveSpread() === "failed"}>
                  <LiveAnswer
                    headline={LIVE_EMPTY_COPY.failedHeadline}
                    body={liveFailureBody(liveFailure())}
                    actions={liveRecovery()}
                    focused={liveEmptyFocus()}
                  />
                </Show>
              </Show>
              <Show when={liveKeepsToday(liveSpread())}>
              <LiveHero channel={channels()[liveChannelIndex()]} program={currentProgram()} />
              <Show when={groups().length}><LiveGroupSelector groups={groups()} group={liveGroup()} focused={zone() === "live-groups"} selected={column()} /></Show>
              <LiveGuideGrid channels={channels()} programs={programs()} window={{row: guideRowStart, start: guideStart, now: () => guideWindow().now}}
                selection={{index: column, active: () => zone() === "content", program: () => currentProgram()?.id}} />
              {/* LIVE-EMPTY-11: a page that is empty because of its filter
                  says so, under the chips that are its focus stop, instead of
                  reading as a missing source. */}
              <Show when={liveSpread() === "filtered"}>
                <Label x={96} y={640} size={28} content={LIVE_FILTERED_LINE} />
              </Show>
              </Show>
            </Show>
            <Show when={screen() === "settings"}>
              <SettingsView tabs={settingsTabs} tab={settingsTab()} items={settingsItems()}
                zone={zone()} column={column()} loading={loading()} />
            </Show>
            </TvView>
            <Show when={screen() === "player" && !overlay() && advancing()}>
              <Label x={96} y={790} size={26} content="Preparing next episode…" />
            </Show>
            <Show when={screen() === "player" && !overlay() && !showControls() && !loading() && !seeking() && !error() && activeSegment() && playerActions().seek && preferences()?.preferences.skip_intros !== false}>
              <Button x={1596} y={746} w={228} h={56} label={activeSegment()?.kind === "recap" ? "Skip recap" : "Skip intro"} focused={false} />
            </Show>
            <Show
              when={
                screen() === "player" &&
                !overlay() &&
                (showControls() ||
                  seeking() ||
                  loading() ||
                  snapshot()?.state === "buffering" ||
                  (snapshot()?.state === "ended" && dismissedEnd !== endScope()) ||
                  error())
              }
            >
              <PlayerControlsView playback={{snapshot, card: () => activeAction()?.card, canSeek: () => playerActions().seek, tools: playerTools}}
                focus={{selected: choice, timeline: timelineFocused, preview: seek}} activity={{loading, seeking}} />
            </Show>
          </TvView>
          <Show when={overlay()}>
            {(modal) => (
              <OverlayViewport order={10} shade={modal().kind !== "next" ? "rgba(0,0,0,.6)" : undefined} shadeWidth={sceneWidth()}>
                <Show when={modal().kind === "next"}>
                  <NextEpisodePanel currentTitle={activeAction()?.card.title ?? "Episode"} episode={episodeState().item}
                    countdown={countdownState()} selected={choice()} entered={overlayEntered()} />
                </Show>
                <Show when={modal().kind === "calibration"}>
                  <CalibrationPanel title={modal().title} value={calibrationValue()} />
                </Show>
                <Show when={modal().kind === "sources"}>
                  <SlidingDrawer width={960} entered={overlayEntered()} closing={overlayClosing()}>
                    <SourceHeading title={pickerCard()?.title ?? ""} checking={sourceLoading() && !sources().length}
                      count={sourcePage()?.total ?? sources().length} addons={sourceAddonCount()} />
                    <Show when={!sourceMenu() && !sourceActions()}>
                    <SourceFilters quality={sourceQualityValue()} provider={sourceProviderValue()} focused={sourceFilterFocus() ? sourceFacet() : undefined} />
                    <SourceList sources={visibleSources()} selected={choice()} focused={!sourceFilterFocus()}
                      bestMatch={sourcePage()?.best_match_id ?? undefined} failed={failedSources()} />
                    </Show>
                    <Show when={sourceMenu()}>
                      <SourceOptionsMenu kind={sourceMenu()!} options={sourceMenuOptions()} selected={sourceMenuChoice()}
                        matches={option => sourceMenu() === "quality" ? option.height === sourceHeight() : option.provider === sourceProviderFilter()} />
                    </Show>
                    <Show when={sourceActions()}><SourceActionsPanel source={focusedSource()} selected={sourceActionChoice()} /></Show>
                    <SourceFooter empty={sourceEmptyCopy(sourceSpread())} status={sourceStatusCopy(sourceSpread())} failure={sourceFailure()}
                      filtered={!sourceEmptyCopy(sourceSpread()) && sources().length > 0 && visibleSources().length === 0} />
                  </SlidingDrawer>
                </Show>
                <Show
                  when={
                    (modal().kind === "choices" ||
                      modal().kind === "confirm") &&
                    !profileEditor()
                  }
                >
                  <ChoiceDrawer dialog={modal() as Extract<Overlay, { kind: "choices" | "confirm" }>} selected={choice()} entered={overlayEntered()} closing={overlayClosing()} />
                </Show>
                <Show when={profileEditor()}>
                  {editor => <ProfileEditorView profile={management()?.profiles.find(profile => profile.id === editor().profile!.id) ?? editor().profile!}
                    items={editor().items} selected={choice()} />}
                </Show>
                <Show when={modal().kind === "tracks"}>
                  <TracksDrawer columns={(modal() as Extract<Overlay, { kind: "tracks" }>).columns} column={trackColumn()} selected={choice()} />
                </Show>
                <Show when={modal().kind === "text"}>
                  <TextEntryPanel title={modal().title} numeric={!!(modal() as Extract<Overlay, { kind: "text" }>).numeric} secret={!!(modal() as Extract<Overlay, { kind: "text" }>).secret} text={text()}>{keyboard(true)}</TextEntryPanel>
                </Show>
              </OverlayViewport>
            )}
          </Show>
          <Show when={sourceLoading() && !overlay() && screen() !== "player" && !error()}>
            <OverlayViewport order={15}>
              <TvView x={480} y={864} w={960} h={144} zIndex={1} color={palette.surface}>
                <Label x={32} y={24} size={28} font="Onest700" content="Finding a matching source…" />
                <Label x={32} y={76} size={22} color={palette.muted} content="Press Back to cancel" />
              </TvView>
            </OverlayViewport>
          </Show>
          <Show when={error()}>
            <OverlayViewport order={20} shade="rgba(0,0,0,.55)">
            <StatusDialog
              title="Couldn’t continue"
              message={error()}
              action={screen() === "player" ? "Choose a source" : "Try again"}
            />
            </OverlayViewport>
          </Show>
          <Show when={notice() || pending()}>
            <TvView
              x={560}
              y={960}
              w={800}
              h={72}
              color={palette.surface}
            >
              <Label
                w={800}
                centerY={36}
                align="center"
                size={24}
                content={pending() ? (screen() === "settings" || profileEditor() ? "Saving…" : "Loading…") : notice()}
              />
            </TvView>
          </Show>
          <Show when={screenSaver()}>
            <OverlayViewport order={40}>
              <TvView w={1920} h={1080} zIndex={-1} color="#0B0B0C">
                <PosterWall />
              </TvView>
              <TvView w={1920} h={1080} color="rgba(11,11,12,.72)" />
            </OverlayViewport>
          </Show>
        </TvView>
        );
      },
    });
    return <Root />;
  };
}
