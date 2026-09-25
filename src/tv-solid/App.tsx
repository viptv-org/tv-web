/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText, KeyedFor } from "./runtime";
import QRCode from "qrcode";
import { carouselWindow } from "./carousel";
import type {
  TvApi,
  DevicePairing,
  TvProfile,
  MediaItem,
  MediaSource,
  Catalog,
  Guide,
  LiveCategory,
  JsonObject,
  PlaybackPreferences,
} from "../api";
import packageInfo from "../../package.json";
import { tokens } from "../theme/viptv-tokens.generated";
import {
  ProfileTile,
  ManageProfilesButton,
  ProfilePagerButton,
  addProfileTile,
  emptyProfileTile,
  profileTileData,
} from "./ProfileTile";
import {
  emptyHome,
  projectHome,
  enrichHomeHero,
  initialHomeShelves,
  loadHomeView,
  loadHomeShelves,
  queueHomeCards,
  type HomeShelfView,
  type HomeView,
} from "./homeModel";
import { railIcon } from "./railIcons";
import { RailItem, CollapsedRail, railItems } from "./RailFocus";
import { DiscoverFilterOption } from "./DiscoverFocus";
import { DiscoverScreen } from "./DiscoverScreen";
import { LibraryScreen } from "./LibraryScreen";
import { libraryCard } from "./libraryModel";
import { TitleMenuScreen } from "./TitleMenuScreen";
import {
  emptyTitleMenuChoice,
  titleMenuChoice,
  titleMenuChoices,
  type TitleMenuChoiceView,
} from "./titleMenuModel";
import { SearchScreen } from "./SearchScreen";
import {
  projectSearch,
  projectSearchWindow,
  searchKeys,
  type SearchCardView,
  type SearchHeadingView,
  type SearchRow,
} from "./searchModel";
import { LiveScreen } from "./LiveScreen";
import { LiveSearchScreen } from "./LiveSearchScreen";
import { liveSearchKeys } from "./liveSearchModel";
import { LiveDetailsScreen } from "./LiveDetailsScreen";
import {
  SettingsScreen,
  type SettingsScreenView,
  type SettingsPanelView,
} from "./SettingsScreen";
import type { SettingsDialogView } from "./SettingsDialogScreen";
import {
  defaultSettingsPreferences,
  emptySettingsChoice,
  emptySettingsProfile,
  emptySettingsRow,
  settingsChoices,
  settingsProfiles,
  settingsRows,
  type SettingsChoiceView,
  type SettingsPage,
  type SettingsRowView,
} from "./settingsModel";
import {
  emptyLiveHero,
  liveFilters,
  projectLiveGuide,
  type LiveChannelView,
  type LiveFilterView,
  type LiveHeroView,
  type LiveProgramView,
} from "./liveModel";
import {
  DAY_SECONDS,
  HOUR_SECONDS,
  PAGE_SIZE,
  WINDOW_SECONDS,
  guideZone,
  halfHour,
  timeRange,
} from "../ui/guide-core";
import { cardPresentation } from "../core/presentations";
import {
  catalogDefaults,
  catalogFilters,
  catalogForGroup,
  catalogsForGroup,
  discoverCard,
  discoverChips,
  discoverTypeGroup,
  emptyDiscoverCard,
  emptyDiscoverChip,
  initialCatalog,
  requestForCatalog,
  sameCatalog,
  type DiscoverCardView,
  type DiscoverChipView,
} from "./discoverModel";
import { HomeAction, HomeCard, HomePreviewCard } from "./HomeFocus";
import { emptyHomeCard } from "./homeModel";
import {
  emptyDetail,
  emptyDetailEpisode,
  loadDetailView,
  type DetailView,
} from "./detailModel";
import { TitleAction, EpisodeTile, SeasonControl } from "./TitleFocus";
import {
  emptySources,
  emptySourceRow,
  projectSources,
  type SourcesView,
} from "./sourceModel";
import {
  SourceChip,
  SourceProvider,
  SourceRow,
  ProviderOption,
  SourceDetailsClose,
  emptySourceChip,
  emptyProviderChoice,
} from "./SourceFocus";
import {
  noteDiscoverFilter,
  noteDiscoverWindow,
  noteFocus,
  noteHomeShelf,
  noteLibraryState,
  noteLiveState,
  notePlayerState,
  noteSearchState,
  noteSourceFilter,
  noteSourceIntent,
  noteSourceWindow,
  noteTitleMenu,
  noteTrackPanel,
  noteTrackSelection,
} from "./focusDebug";
import type { SolidTVPlaybackRuntime } from "./playbackRuntime";
import {
  PlayerControl,
  PlayerTimeline,
  PlayerTrackOption,
} from "./PlayerFocus";
import type { PlayerSnapshot } from "@viptv/video";
import {
  emptyTrackChoice,
  trackChoicesFor,
  type TrackChoiceView,
} from "./trackModel";
import { exactResumeSource, resolveNext } from "../ui/continuation";

type TvPlatform = "tizen" | "vizio" | "webos";
const px = (name: keyof typeof tokens) =>
  Number.parseFloat(String(tokens[name]));
// SolidTV's web-font texture is wider than the DOM glyph run at the same
// nominal size. This measured renderer adjustment keeps the code inside the
// current TV card while the full pixel-parity pass remains open.
const pairCodeSize =
  Number.parseFloat(tokens["type.tv.pair-code"].fontSize) * (80 / 88);

function gatewayGlow(height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  // CSS reference: radial-gradient(closest-side, wash, transparent) on the
  // gateway pseudo-element (800 high pairing, 700 high profiles).
  context.translate(700, height / 2);
  context.scale(700, height / 2);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, tokens["color.fill.wash"]);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(-1, -1, 2, 2);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function homeScrim() {
  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 1080;
  const context = canvas.getContext("2d")!;
  // The React TV Home masks the sharp art in from the left and fades it
  // beneath the shelf. This texture is rendered by SolidTV over that art.
  const ground = tokens["color.bg"];
  const transparentGround = `rgba(${Number.parseInt(ground.slice(1, 3), 16)},${Number.parseInt(ground.slice(3, 5), 16)},${Number.parseInt(ground.slice(5, 7), 16)},0)`;
  const left = context.createLinearGradient(1120, 0, 1500, 0);
  left.addColorStop(0, ground);
  left.addColorStop(1, transparentGround);
  context.fillStyle = left;
  context.fillRect(1120, 0, 380, 720);
  const bottom = context.createLinearGradient(0, 550, 0, 950);
  bottom.addColorStop(0, transparentGround);
  bottom.addColorStop(1, ground);
  context.fillStyle = bottom;
  context.fillRect(0, 550, 1920, 530);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function menuGradient() {
  const canvas = document.createElement("canvas");
  canvas.width = 520;
  canvas.height = 1;
  const context = canvas.getContext("2d")!;
  const gradient = context.createLinearGradient(0, 0, 520, 0);
  gradient.addColorStop(0, tokens["color.bg"]);
  gradient.addColorStop(0.62, tokens["color.bg"]);
  gradient.addColorStop(1, "rgba(11,11,12,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 520, 1);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

const searchMeasure = document.createElement("canvas").getContext("2d")!;
function searchCaretPosition(query: string) {
  searchMeasure.font = "600 34px Onest600";
  return Math.min(
    718,
    218 + Math.ceil(searchMeasure.measureText(query).width) + 4,
  );
}

const playerClock = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const clock = `${minutes}:${String(total % 60).padStart(2, "0")}`;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}` : clock;
};

const playerRuntime = (seconds: number) => {
  const minutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
};

function showPreparingSpinner(visible: boolean) {
  const spinner = document.getElementById("solid-preparing-spinner");
  if (spinner) spinner.style.display = visible ? "block" : "none";
}

/** Native 1920×1080 positions from the pinned TvPairing reference. */
const pairingFrame = {
  brandX: px("layout.tv.safe-x"),
  brandY: px("layout.tv.safe-y"),
  bodyX: px("layout.tv.safe-x") * 2,
  bodyY: 250,
  qrX: 1368,
  qrY: 270,
  qrSize: 360,
  codeY: 470,
  actionY: 641,
} as const;

/**
 * Staged SolidTV renderer for the first TV sign-in slice. The existing TV
 * launcher remains on React until every screen and interaction is qualified.
 * The API and Rust session driver are shared; only rendering/input differ.
 */
export function createSolidTvApp(api: TvApi, platform: TvPlatform) {
  let pairingGeneration = 0;
  let pairingTimer: ReturnType<typeof setTimeout> | undefined;
  let pairingScope: ReturnType<TvApi["createScope"]> | undefined;
  let homeGeneration = 0;
  let homeScope: ReturnType<TvApi["createScope"]> | undefined;
  let detailGeneration = 0;
  let detailScope: ReturnType<TvApi["createScope"]> | undefined;
  let discoverGeneration = 0;
  let discoverScope: ReturnType<TvApi["createScope"]> | undefined;
  let discoverRequestedPage = "";
  let libraryGeneration = 0;
  let libraryScope: ReturnType<TvApi["createScope"]> | undefined;
  let libraryRequestedPage = "";
  let searchGeneration = 0;
  let searchScope: ReturnType<TvApi["createScope"]> | undefined;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let searchCanonicalCards: SearchCardView[] = [];
  let searchCanonicalHeadings: SearchHeadingView[] = [];
  let searchCanonicalSections = new Map<string, SearchCardView[]>();
  let liveGeneration = 0;
  let liveScope: ReturnType<TvApi["createScope"]> | undefined;
  let liveClockTimer: ReturnType<typeof setInterval> | undefined;
  let liveCanonicalChannels: MediaItem[] = [];
  let liveCanonicalRows: LiveChannelView[] = [];
  let liveCanonicalPrograms: LiveProgramView[] = [];
  let liveCanonicalFilters: LiveFilterView[] = [];
  let liveFocusGeneration = 0;
  let liveSearchCanonicalQuery = "";
  let liveSearchPhysicalListener: ((event: KeyboardEvent) => void) | null =
    null;
  let settingsCanonicalRows: SettingsRowView[] = [];
  let settingsCanonicalChoices: SettingsChoiceView[] = [];
  let settingsGeneration = 0;
  let settingsScope: ReturnType<TvApi["createScope"]> | undefined;
  let sourceGeneration = 0;
  let sourceScope: ReturnType<TvApi["createScope"]> | undefined;
  let sourceTimer: ReturnType<typeof setTimeout> | undefined;
  let playback: SolidTVPlaybackRuntime | undefined;
  let playbackGeneration = 0;
  let nextScope: ReturnType<TvApi["createScope"]> | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let chromeTimer: ReturnType<typeof setTimeout> | undefined;
  let disposeSession: (() => void) | undefined;
  let disposeProfileEditor: (() => void) | undefined;
  return defineScreen({
    components: {
      ProfileTile,
      ManageProfilesButton,
      ProfilePagerButton,
      HomeAction,
      HomeCard,
      RailItem,
      DiscoverScreen,
      LibraryScreen,
      SearchScreen,
      LiveScreen,
      LiveSearchScreen,
      LiveDetailsScreen,
      SettingsScreen,
      TitleMenuScreen,
      DiscoverFilterOption,
      TitleAction,
      EpisodeTile,
      SourceChip,
      SourceProvider,
      SourceRow,
      ProviderOption,
      SourceDetailsClose,
      PlayerControl,
      PlayerTimeline,
      PlayerTrackOption,
    },

    state() {
      return {
        ...pairingFrame,
        background: tokens["color.bg"],
        accent: tokens["color.accent.default"],
        primary: tokens["color.text.primary"],
        body: tokens["color.text.body"],
        tertiary: tokens["color.text.tertiary"],
        onLight: tokens["color.on.light"],
        onAccent: tokens["color.on.accent"],
        field: tokens["color.fill.tv-field"],
        white: tokens["color.fill.white"],
        keyBorder: tokens["color.line.keycap-tv"],
        get pairingGlow() {
          return gatewayGlow(800);
        },
        get profilesGlow() {
          return gatewayGlow(700);
        },
        get homeScrim() {
          return homeScrim();
        },
        selectingProfile: false,
        homeScrollOffset: 0,
        homeWindowX: 0,
        detailScrollOffset: 0,
        detailWindowStart: 0,
        detailWindowX: 0,
        home: emptyHome as HomeView,
        detail: emptyDetail as DetailView,
        source: emptySources as SourcesView,
        sourceChips: Array.from({ length: 5 }, () => ({ ...emptySourceChip })),
        sourceRows: Array.from({ length: 6 }, () => ({ ...emptySourceRow })),
        sourcePanelTitle: "",
        sourceOkLabel: "",
        sourcePlayLabel: "",
        sourceArrowLabel: "",
        sourceQualityLabel: "",
        sourceBackLabel: "",
        sourceCloseLabel: "",
        providerPanelTitle: "",
        providerChoices: Array.from({ length: 6 }, () => ({
          ...emptyProviderChoice,
        })),
        providerChoiceIndex: 0,
        sourceProviderLabel: "",
        sourceNotice: "",
        sourceSelectedId: "",
        sourceFocusZone: "chip" as "chip" | "provider" | "row",
        sourceChipIndex: 0,
        sourceRowIndex: 0,
        sourceWindowStart: 0,
        sourceReturnZone: "action" as
          | "action"
          | "card"
          | "episode"
          | "season"
          | "channel"
          | "program",
        sourceReturnIndex: 0,
        sourceReturnOrigin: "detail" as
          | "detail"
          | "library"
          | "home"
          | "discover"
          | "search"
          | "live",
        sourceResume: false,
        sourceScrim: tokens["color.scrim.tv-panel"],
        sourcePanelGround: tokens["color.surface.1"],
        sourceDetailsScrim: tokens["color.scrim.tv-fullscreen"],
        sourceDetailsHeading: "",
        sourceDetailsBody: "",
        sourceDetailsReturnIndex: 0,
        scrollbar: tokens["color.fill.scrollbar"],
        preparingText: "",
        playerSnapshot: null as PlayerSnapshot | null,
        playerOverlay: true,
        playerTitle: "",
        playerEpisodeLine: "",
        nowPlayingLabel: "",
        playerStatus: "",
        playerPositionText: "",
        playerDurationText: "",
        playerProgress: 0,
        playerToggleIcon: "Ⅱ",
        playerLegend: "",
        playerNotice: "",
        playerFocusIndex: 1,
        playerSeekPreview: null as number | null,
        playerSeekLabel: "",
        playerItem: null as MediaItem | null,
        playerPreparingNext: false,
        playerSessionId: "",
        playerSessionDuration: 0,
        trackPanelOpen: false,
        trackPanelKind: "text" as "audio" | "text",
        trackPanelTitle: "",
        trackChoices: [] as TrackChoiceView[],
        trackSlots: Array.from({ length: 8 }, () => ({ ...emptyTrackChoice })),
        trackFocusIndex: 0,
        trackReturnControlIndex: 5,
        trackLegend: "",
        trackNotice: "",
        detailEpisodes: Array.from({ length: 5 }, () => ({
          ...emptyDetailEpisode,
        })),
        detailSaveIcon: "",
        detailSeasonLabel: "",
        detailCountLabel: "",
        detailNotice: "",
        detailFocusZone: "action" as "action" | "season" | "episode",
        detailActionIndex: 0,
        detailEpisodeIndex: 0,
        detailReturnZone: "action" as "action" | "card",
        detailReturnIndex: 0,
        detailReturnShelfIndex: 0,
        homeCards: Array.from({ length: 6 }, () => ({ ...emptyHomeCard })),
        homeShelves: [] as HomeShelfView[],
        homeShelfIndex: 0,
        homeShelfPositions: {} as Record<string, number>,
        homeNextCards: Array.from({ length: 5 }, () => ({ ...emptyHomeCard })),
        homeNextShelfLabel: "",
        homeFocusZone: "action" as "action" | "card",
        homeActionIndex: 0,
        homeCardIndex: 0,
        homeCardWindowStart: 0,
        railExpanded: false,
        railFocusIndex: 2,
        railReturnZone: "action" as
          | "action"
          | "card"
          | "chip"
          | "segment"
          | "result"
          | "key"
          | "channel"
          | "program"
          | "filter"
          | "episode"
          | "season"
          | "row"
          | "profile",
        railReturnIndex: 0,
        railProfileName: "",
        railNotice: "",
        railCurrent: "home" as
          | "home"
          | "discover"
          | "library"
          | "search"
          | "live"
          | "settings",
        menuScrim: tokens["color.scrim.tv-menu"],
        menuGradient: menuGradient(),
        discoverHeading: "",
        discoverOkLabel: "",
        discoverSelectLabel: "",
        discoverOptionsIcon: "",
        discoverOptionsLabel: "",
        discoverBackLabel: "",
        discoverCancelLabel: "",
        discoverFilterOkLabel: "",
        discoverFilterSelectLabel: "",
        discoverCatalogs: [] as Catalog[],
        discoverCatalog: null as Catalog | null,
        discoverValues: {} as Record<string, string>,
        discoverItems: [] as MediaItem[],
        discoverNextSkip: null as number | null,
        discoverBusy: false,
        discoverError: "",
        discoverChips: Array.from({ length: 12 }, () => ({
          ...emptyDiscoverChip,
        })) as DiscoverChipView[],
        discoverCards: Array.from({ length: 12 }, () => ({
          ...emptyDiscoverCard,
        })) as DiscoverCardView[],
        discoverFocusZone: "card" as "card" | "chip",
        discoverChipIndex: 0,
        discoverCardIndex: 0,
        discoverWindowStart: 0,
        discoverFilterOpen: false,
        discoverFilterName: "",
        discoverFilterTitle: "",
        discoverFilterValue: "",
        discoverOptionLabels: Array.from({ length: 8 }, () => ""),
        discoverOptionIndex: 0,
        discoverFilterReturnChip: 0,
        discoverReturnPhase: "home" as "home" | "library" | "search",
        discoverReturnZone: "action" as
          | "action"
          | "card"
          | "segment"
          | "result"
          | "key",
        discoverReturnIndex: 0,
        detailReturnPhase: "home" as "home" | "discover" | "library" | "search",
        libraryHeading: "",
        libraryMode: "favorites" as "favorites" | "queue",
        libraryFavorites: [] as MediaItem[],
        libraryQueueItems: [] as MediaItem[],
        libraryItems: [] as MediaItem[],
        libraryNextOffset: null as number | null,
        libraryCards: Array.from({ length: 12 }, () => ({
          ...emptyDiscoverCard,
        })) as DiscoverCardView[],
        libraryWindowStart: 0,
        libraryCardIndex: 0,
        librarySegmentIndex: 0,
        libraryFocusZone: "segment" as "segment" | "card",
        libraryReturnPhase: "home" as "home" | "discover" | "search",
        libraryReturnZone: "action" as
          | "action"
          | "card"
          | "chip"
          | "result"
          | "key",
        libraryReturnIndex: 0,
        libraryBusy: false,
        libraryError: "",
        libraryOkLabel: "",
        librarySelectLabel: "",
        libraryOptionsIcon: "",
        libraryOptionsLabel: "",
        searchHeading: "",
        searchPlaceholder: "",
        searchQuery: "",
        searchCaretX: 218,
        searchKeys,
        searchCatalogs: [] as Catalog[],
        searchRows: [] as SearchRow[],
        searchHeadings: [] as SearchHeadingView[],
        searchVisibleCards: [] as SearchCardView[],
        searchStatus: "",
        searchBusy: false,
        searchPartial: false,
        searchKeyIndex: 0,
        searchLastKeyIndex: 0,
        searchResultIndex: 0,
        searchFocusZone: "key" as "key" | "result",
        searchSectionOffsets: {} as Record<string, number>,
        searchVerticalOffset: 0,
        searchReturnPhase: "home" as "home" | "discover" | "library",
        searchReturnZone: "action" as "action" | "card" | "chip" | "segment",
        searchReturnIndex: 0,
        searchOkLabel: "",
        searchTypeLabel: "",
        searchJumpIcon: "",
        searchJumpLabel: "",
        searchBackLabel: "",
        searchDeleteLabel: "",
        liveNow: Date.now() / 1000,
        liveWindowStart: halfHour(),
        liveFollowing: true,
        liveTotal: 0,
        liveOffset: 0,
        liveCategories: [] as LiveCategory[],
        liveFilterId: "all",
        liveFilters: liveFilters([], "all") as LiveFilterView[],
        liveGuides: {} as Record<string, Guide>,
        liveSelectedRow: 0,
        liveSelectedCellIndex: null as number | null,
        liveFocusZone: "channel" as "channel" | "program" | "filter",
        liveFilterIndex: 1,
        liveProgramPosition: 0,
        liveRows: [] as LiveChannelView[],
        livePrograms: [] as LiveProgramView[],
        liveTimeline: [] as { x: number; label: string }[],
        liveHero: emptyLiveHero as LiveHeroView,
        liveNowX: -1,
        liveNowLabel: "",
        liveStatus: "",
        liveChrome: {
          homeProfileAvatar: "",
          railSearch: railIcon("search"),
          railHomeUnselected: railIcon("home"),
          railDiscover: railIcon("discover"),
          railLiveSelected: railIcon("live", true),
          railList: railIcon("list"),
          railSettings: railIcon("settings"),
          surface: tokens["color.surface.2"],
          background: tokens["color.bg"],
          primary: tokens["color.text.primary"],
          body: tokens["color.text.body"],
          keyBorder: tokens["color.line.outline"],
          liveLabel: "LIVE",
          previewLabel: "Live preview",
          okLabel: "OK",
          watchLabel: "Watch",
          optionsIcon: "≡",
          detailsLabel: "Details",
          channelIcon: "▲ ▼",
          channelsLabel: "Channels",
          timeIcon: "◀ ▶",
          timeLabel: "Time",
        },
        liveSearchOpen: false,
        liveSearchUppercase: false,
        liveSearchKeyIndex: 0,
        liveSearchView: { keys: liveSearchKeys.map((key) => ({ ...key })) },
        liveLabel: "",
        livePreviewLabel: "",
        liveOkLabel: "",
        liveWatchLabel: "",
        liveOptionsIcon: "",
        liveDetailsLabel: "",
        liveChannelIcon: "",
        liveChannelsLabel: "",
        liveTimeIcon: "",
        liveTimeLabel: "",
        liveReturnPhase: "home" as "home" | "discover" | "library" | "search",
        liveReturnZone: "action" as
          | "action"
          | "card"
          | "chip"
          | "segment"
          | "key"
          | "result",
        liveReturnIndex: 0,
        liveDetailsOpen: false,
        settingsPage: "Settings" as SettingsPage,
        settingsSelectedIndex: 0,
        settingsFocusZone: "row" as "row" | "profile",
        settingsProfileIndex: 0,
        settingsRowsCount: 6,
        settingsPrefs: defaultSettingsPreferences as PlaybackPreferences,
        settingsAddons: [] as JsonObject[],
        settingsView: {
          page: "",
          rows: Array.from({ length: 6 }, () => ({ ...emptySettingsRow })),
          profiles: Array.from({ length: 4 }, () => ({
            ...emptySettingsProfile,
          })),
          showProfiles: false,
          avatar: "",
          railSearch: "",
          railHome: "",
          railDiscover: "",
          railLive: "",
          railList: "",
          railSettings: "",
          version: "",
        } as SettingsScreenView,
        settingsPanel: {
          title: "",
          description: "",
          caption: "",
        } as SettingsPanelView,
        settingsDialogOpen: false,
        settingsDialogKind: "choice" as
          | "choice"
          | "signout"
          | "addonManage"
          | "addonRemove",
        settingsDialogKey: "quality" as keyof PlaybackPreferences,
        settingsDialogAddon: null as JsonObject | null,
        settingsChoiceIndex: 0,
        settingsDialogView: {
          title: "",
          choices: Array.from({ length: 8 }, () => ({
            ...emptySettingsChoice,
          })),
          start: 0,
          signout: false,
        } as SettingsDialogView,
        settingsReturnPhase: "home" as
          | "home"
          | "discover"
          | "library"
          | "search"
          | "live",
        settingsReturnZone: "action" as
          | "action"
          | "card"
          | "chip"
          | "segment"
          | "key"
          | "result"
          | "filter"
          | "channel"
          | "program",
        settingsReturnIndex: 0,
        liveDetailsTitle: "",
        liveDetailsChannel: "",
        liveDetailsRange: "",
        liveDetailsDescription: "",
        liveDetailsWatchLabel: "",
        liveDetailsCloseLabel: "",
        liveDetailsOkLabel: "",
        liveDetailsSelectLabel: "",
        liveDetailsBackLabel: "",
        liveDetailsOptionIndex: 0,
        liveDetailsReturnZone: "program" as "program" | "channel",
        liveDetailsReturnIndex: 0,
        liveDetailsChannelItem: null as MediaItem | null,
        titleMenuOpen: false,
        titleMenuKind: "actions" as "actions" | "undo",
        titleMenuHeading: "",
        titleMenuNotice: "",
        titleMenuChoices: [] as TitleMenuChoiceView[],
        titleMenuSlots: Array.from({ length: 7 }, () => ({
          ...emptyTitleMenuChoice,
        })) as TitleMenuChoiceView[],
        titleMenuFocusIndex: 0,
        titleMenuItem: null as MediaItem | null,
        titleMenuOrigin: "home" as "home" | "library" | "discover" | "search",
        titleMenuReturnIndex: 0,
        titleMenuBusy: false,
        titleMenuOkLabel: "",
        titleMenuSelectLabel: "",
        titleMenuBackLabel: "",
        titleMenuCancelLabel: "",
        currentProfileId: "",
        homeNotice: "",
        homeAddLabel: "",
        homeShelfLabel: "",
        surface: tokens["color.surface.3"],
        secondary: tokens["color.text.secondary"],
        noticeGlass: tokens["color.fill.notice-glass-tv"],
        railSearch: railIcon("search"),
        railSearchSelected: railIcon("search", true),
        railSearchFocus: railIcon("search", false, true),
        railHome: railIcon("home", true),
        railHomeUnselected: railIcon("home"),
        railHomeFocus: railIcon("home", false, true),
        railDiscover: railIcon("discover"),
        railDiscoverSelected: railIcon("discover", true),
        railDiscoverFocus: railIcon("discover", false, true),
        railLive: railIcon("live"),
        railLiveSelected: railIcon("live", true),
        railLiveFocus: railIcon("live", false, true),
        railList: railIcon("list"),
        railListSelected: railIcon("list", true),
        railListFocus: railIcon("list", false, true),
        railSettings: railIcon("settings"),
        railSettingsFocus: railIcon("settings", false, true),
        homeProfileAvatar: "",
        optionsIcon: "",
        optionsLabel: "",
        danger: tokens["color.status.danger-tv"],
        codeSize: pairCodeSize,
        codeLetterSpacing: pairCodeSize * 0.08,
        phase: "starting" as
          | "starting"
          | "pairing"
          | "expired"
          | "error"
          | "profiles"
          | "ready"
          | "home"
          | "discover"
          | "library"
          | "search"
          | "live"
          | "settings"
          | "detail"
          | "sources"
          | "provider"
          | "sourceDetails"
          | "preparing"
          | "player"
          | "playerTracks",
        address: "Connecting…",
        code: "••••••",
        qr: "",
        error: "",
        markLabel: "",
        brandLabel: "",
        titleLabel: "",
        introLabel: "",
        expiredLabel: "",
        retryLabel: "",
        retryIcon: "",
        startingLabel: "",
        profilesLabel: "",
        profilesWordmark: "",
        profiles: [] as TvProfile[],
        profileSlots: Array.from({ length: 6 }, () => ({
          ...emptyProfileTile,
        })),
        profilePage: 0,
        profileFocus: 0,
        profileFocusTarget: "tile" as "tile" | "manage" | "pager",
        profilePagerFocus: 1,
        profileStartX: 424,
        managing: false,
        profileError: "",
        okLabel: "",
        selectLabel: "",
        moveIcon: "",
        moveLabel: "",
      };
    },
    hooks: {
      ready() {
        if (new URLSearchParams(location.search).has("perfdebug"))
          performance.mark("viptv:app-ready");
        const session = api.createSessionDriver(
          (view) => {
            if (new URLSearchParams(location.search).has("perfdebug"))
              performance.mark(`viptv:session-${view.phase}`);
            if (view.identity) this.profiles = [...view.identity.profiles];
            if (view.phase === "Pairing") void this.beginPairing();
            else if (view.phase === "Profiles") {
              if (view.identity) this.showProfiles(view.identity.profiles);
              else
                void api.me().then(
                  (identity) => this.showProfiles(identity.profiles),
                  (cause) => {
                    this.error =
                      cause instanceof Error
                        ? cause.message
                        : "Could not load profiles.";
                    this.phase = "error";
                  },
                );
            } else if (view.phase === "Ready" && view.selectedProfileId)
              void this.loadHome(view.selectedProfileId);
            else if (view.phase === "Error") {
              this.error =
                view.error ?? "The TV could not complete this request.";
              this.phase = "error";
            }
          },
          (message) => {
            this.error = message;
            this.phase = "error";
          },
        );
        disposeSession = () => session.dispose();
        this.$listen("profile-focus", (slot: number) => {
          this.profileFocus = Number(slot);
          this.profileFocusTarget = "tile";
        });
        this.$listen(
          "profile-move",
          ({ slot, delta }: { slot: number; delta: number }) =>
            this.moveProfile(Number(slot), delta),
        );
        this.$listen("profile-manage-focus", () => {
          this.profileFocusTarget = "manage";
          this.$select("manageProfiles")?.$focus();
        });
        this.$listen("profile-restore-focus", () => {
          this.profileFocusTarget = "tile";
          this.$select(`profile${this.profileFocus}`)?.$focus();
        });
        this.$listen("profile-pager-focus", () => {
          if (this.profiles.length <= 5) return;
          this.profileFocusTarget = "pager";
          this.profilePagerFocus = this.profilePage === 0 ? 1 : 0;
          this.$select(`profilePager${this.profilePagerFocus}`)?.$focus();
        });
        this.$listen("profile-pager-move", (delta: number) => {
          const next = Math.max(0, Math.min(1, this.profilePagerFocus + Number(delta)));
          this.profilePagerFocus = next;
          this.$select(`profilePager${next}`)?.$focus();
        });
        this.$listen("profile-page-change", (delta: number) => {
          this.profilePage = Math.max(0, Math.min(Math.ceil(this.profiles.length / 5) - 1, this.profilePage + Number(delta)));
          this.refreshProfileSlots();
          this.profileFocus = 0;
          this.profileFocusTarget = "tile";
          setTimeout(() => { this.revealProfileTiles(); this.$select("profile0")?.$focus(); }, 0);
        });
        this.$listen("profile-manage-toggle", () =>
          this.toggleManageProfiles(),
        );
        this.$listen("profile-hold", (slot: number) => {
          this.managing = true;
          this.profilesLabel = "Manage profiles";
          this.profileFocus = Number(slot);
          setTimeout(() => this.revealProfileTiles(), 0);
        });
        this.$listen(
          "profile-activate",
          (slot: number) => void this.activateProfile(Number(slot)),
        );
        this.$listen("home-action-focused", (position: number) => {
          if (
            this.homeFocusZone === "action" &&
            Number(position) === this.homeActionIndex
          )
            this.homeActionIndex = Number(position);
        });
        this.$listen(
          "home-action-move",
          ({ position, delta }: { position: number; delta: number }) =>
            this.moveHomeAction(Number(position), delta),
        );
        this.$listen("home-cards-enter", () => this.focusHomeCard(0));
        this.$listen("home-action-return", () =>
          this.focusHomeAction(this.homeActionIndex),
        );
        this.$listen("home-card-up", () => this.moveHomeShelf(-1));
        this.$listen("home-card-down", () => this.moveHomeShelf(1));
        this.$listen("home-card-focused", (position: number) => {
          if (
            this.homeFocusZone === "card" &&
            Number(position) === this.homeCardIndex
          )
            this.homeCardIndex = Number(position);
        });
        this.$listen(
          "home-card-move",
          ({ position, delta }: { position: number; delta: number }) =>
            this.moveHomeCard(Number(position), delta),
        );
        this.$listen(
          "home-action-activate",
          () => void this.activateHomeAction(),
        );
        this.$listen("home-action-hold", () => {
          if (this.home.heroItem) void this.openSources(this.home.heroItem, false);
        });
        this.$listen("home-card-activate", () => void this.openDetailByCard());
        this.$listen("home-card-hold", (position: number) => {
          const shelf = this.homeShelves[this.homeShelfIndex];
          const item = shelf?.items[Number(position)];
          if (item && shelf.key === "queue") this.openTitleMenu(item, "home", Number(position));
          else if (item) void this.openDetail(item);
        });
        this.$listen("rail-focused", (position: number) => {
          this.railFocusIndex = Number(position);
        });
        this.$listen("rail-move", (delta: number) =>
          this.moveRail(Number(delta)),
        );
        this.$listen("rail-exit", () => this.closeRail());
        this.$listen("rail-activate", () => this.activateRail());
        this.$listen("discover-chip-focused", (position: number) => {
          this.discoverChipIndex = Number(position);
        });
        this.$listen("discover-chip-move", (delta: number) =>
          this.moveDiscoverChip(Number(delta)),
        );
        this.$listen(
          "discover-chip-activate",
          () => void this.activateDiscoverChip(),
        );
        this.$listen("discover-card-enter", () =>
          this.focusDiscoverCard(this.discoverCardIndex),
        );
        this.$listen("discover-card-focused", (position: number) => {
          this.discoverCardIndex = Number(position);
        });
        this.$listen("discover-card-move", (direction: string) =>
          this.moveDiscoverCard(direction),
        );
        this.$listen("discover-card-activate", () =>
          this.activateDiscoverCard(),
        );
        this.$listen("discover-card-hold", (position: number) => {
          const item = this.discoverItems[Number(position)];
          if (item) this.openTitleMenu(item, "discover", Number(position));
        });
        this.$listen("discover-option-focused", (position: number) => {
          this.discoverOptionIndex = Number(position);
        });
        this.$listen("discover-option-move", (delta: number) =>
          this.moveDiscoverOption(Number(delta)),
        );
        this.$listen(
          "discover-option-activate",
          () => void this.selectDiscoverOption(),
        );
        this.$listen("discover-option-close", () => this.closeDiscoverFilter());
        this.$listen("library-segment-focused", (position: number) => {
          this.librarySegmentIndex = Number(position);
        });
        this.$listen("library-segment-move", (delta: number) =>
          this.moveLibrarySegment(Number(delta)),
        );
        this.$listen(
          "library-segment-activate",
          () => void this.activateLibrarySegment(),
        );
        this.$listen("library-card-enter", () =>
          this.focusLibraryCard(this.libraryCardIndex),
        );
        this.$listen("library-card-focused", (position: number) => {
          this.libraryCardIndex = Number(position);
        });
        this.$listen("library-card-move", (direction: string) =>
          this.moveLibraryCard(direction),
        );
        this.$listen("library-card-activate", () => this.activateLibraryCard());
        this.$listen("library-card-hold", (position: number) => {
          const item = this.libraryItems[Number(position)];
          if (item) this.openTitleMenu(item, "library", Number(position));
        });
        this.$listen("search-key-focused", (position: number) => {
          this.searchKeyIndex = Number(position);
          this.searchLastKeyIndex = Number(position);
        });
        this.$listen("search-key-move", (direction: string) =>
          this.moveSearchKey(direction),
        );
        this.$listen("search-key-activate", () => this.activateSearchKey());
        this.$listen("search-key-back", () => this.backFromSearch());
        this.$listen("search-physical-character", (value: string) =>
          this.setSearchQuery((this.searchQuery + value).slice(0, 256)),
        );
        this.$listen("search-jump-results", () => this.focusSearchResult(0));
        this.$listen("search-card-focused", (position: number) => {
          this.searchResultIndex = Number(position);
        });
        this.$listen("search-card-move", (direction: string) =>
          this.moveSearchResult(direction),
        );
        this.$listen("search-card-activate", () => this.activateSearchResult());
        this.$listen("search-card-hold", (position: number) => {
          const card = searchCanonicalCards[Number(position)];
          if (card) this.openTitleMenu(card.item, "search", Number(position));
        });
        this.$listen("search-card-back", () => this.returnFromSearch());
        this.$listen("live-filter-focused", (position: number) => {
          this.liveFilterIndex = Number(position);
          this.liveFocusZone = "filter";
        });
        this.$listen("live-filter-move", (delta: number) =>
          this.moveLiveFilter(Number(delta)),
        );
        this.$listen(
          "live-filter-activate",
          () => void this.activateLiveFilter(),
        );
        this.$listen("live-enter-channels", () =>
          this.focusLiveChannel(this.liveSelectedRow),
        );
        this.$listen("live-search-key-focused", (position: number) => {
          this.liveSearchKeyIndex = Number(position);
        });
        this.$listen("live-search-key-move", (direction: string) =>
          this.moveLiveSearchKey(direction),
        );
        this.$listen("live-search-key-activate", () =>
          this.activateLiveSearchKey(),
        );
        this.$listen("live-search-close", () => this.closeLiveSearch());
        this.$listen("guide-channel-focused", (row: number) => {
          const selected = Number(row);
          const changed =
            this.liveSelectedRow !== selected ||
            this.liveSelectedCellIndex !== null ||
            this.liveFocusZone !== "channel";
          this.liveSelectedRow = selected;
          this.liveSelectedCellIndex = null;
          this.liveFocusZone = "channel";
          if (changed) this.refreshLiveView();
        });
        this.$listen("guide-channel-move", (delta: number) =>
          this.moveLiveChannel(Number(delta)),
        );
        this.$listen("guide-channel-left", () => this.openRail());
        this.$listen("guide-program-enter", (row: number) =>
          this.enterLiveProgram(Number(row)),
        );
        this.$listen("guide-channel-activate", (row: number) =>
          this.watchLiveChannel(Number(row)),
        );
        this.$listen("guide-channel-hold", (row: number) =>
          this.openLiveDetailsForChannel(Number(row)),
        );
        this.$listen(
          "guide-program-focused",
          ({
            row,
            index,
          }: {
            row: number;
            index: number;
            position: number;
          }) => {
            // A reprojected For child can emit focus after the remote has moved
            // into the filter row. Keep the newer focus destination authoritative.
            if (this.liveFocusZone === "filter") {
              setTimeout(() => {
                if (this.phase === "live" && this.liveFocusZone === "filter")
                  this.focusLiveFilter(this.liveFilterIndex);
              }, 0);
              return;
            }
            const changed =
              this.liveSelectedRow !== row ||
              this.liveSelectedCellIndex !== index ||
              this.liveFocusZone !== "program";
            this.liveSelectedRow = row;
            this.liveSelectedCellIndex = index;
            this.liveProgramPosition = liveCanonicalPrograms.findIndex(
              (block) => block.row === row && block.index === index,
            );
            this.liveFocusZone = "program";
            if (changed) this.refreshLiveView();
          },
        );
        this.$listen(
          "guide-program-move",
          ({ position, direction }: { position: number; direction: string }) =>
            this.moveLiveProgram(position, direction),
        );
        this.$listen("guide-program-activate", () =>
          this.activateLiveProgram(this.focusedLiveProgramPosition()),
        );
        this.$listen("guide-program-hold", () =>
          this.openLiveDetailsForProgram(this.focusedLiveProgramPosition()),
        );
        this.$listen("live-details-focused", (position: number) => {
          this.liveDetailsOptionIndex = Number(position);
        });
        this.$listen("live-details-move", (delta: number) =>
          this.focusLiveDetailsOption(
            Math.max(
              0,
              Math.min(1, this.liveDetailsOptionIndex + Number(delta)),
            ),
          ),
        );
        this.$listen("live-details-activate", () => this.activateLiveDetails());
        this.$listen("live-details-back", () => this.closeLiveDetails());
        this.$listen("settings-row-focused", (position: number) => {
          this.settingsSelectedIndex = Number(position);
          this.settingsFocusZone = "row";
          this.refreshSettingsPanel();
        });
        this.$listen("settings-row-move", (delta: number) =>
          this.moveSettingsRow(Number(delta)),
        );
        this.$listen("settings-row-left", () => this.openRail());
        this.$listen("settings-row-right", () => {
          if (
            this.settingsPage === "Settings" &&
            this.settingsSelectedIndex === 0
          )
            this.focusSettingsProfile(0);
        });
        this.$listen(
          "settings-row-activate",
          () => void this.activateSettingsRow(),
        );
        this.$listen("settings-profile-focused", (position: number) => {
          this.settingsProfileIndex = Number(position);
          this.settingsFocusZone = "profile";
        });
        this.$listen("settings-profile-move", (delta: number) =>
          this.moveSettingsProfile(Number(delta)),
        );
        this.$listen("settings-profile-exit", () => this.focusSettingsRow(0));
        this.$listen(
          "settings-profile-activate",
          () => void this.activateSettingsProfile(),
        );
        this.$listen("settings-choice-focused", (position: number) => {
          this.settingsChoiceIndex =
            this.settingsDialogView.start + Number(position);
        });
        this.$listen("settings-choice-move", (delta: number) =>
          this.moveSettingsChoice(Number(delta)),
        );
        this.$listen(
          "settings-choice-activate",
          () => void this.activateSettingsChoice(),
        );
        this.$listen("settings-dialog-back", () => this.closeSettingsDialog());
        this.$listen("settings-back", () => this.backFromSettings());
        this.$listen("title-menu-focused", (position: number) => {
          this.titleMenuFocusIndex = Number(position);
        });
        this.$listen("title-menu-move", (delta: number) =>
          this.moveTitleMenu(Number(delta)),
        );
        this.$listen(
          "title-menu-activate",
          () => void this.activateTitleMenu(),
        );
        this.$listen("title-menu-back", () => this.closeTitleMenu());
        this.$listen("title-action-move", (delta: number) =>
          Number(delta) < 0 && this.detailActionIndex === 0
            ? this.openRail()
            : this.focusTitleAction(
                Math.max(
                  0,
                  Math.min(3, this.detailActionIndex + Number(delta)),
                ),
              ),
        );
        this.$listen("title-episodes-enter", () => {
          if (this.detailFocusZone === "action") this.focusTitleSeason();
          else if (this.detail.episodes.length) this.focusTitleEpisode(this.detailEpisodeIndex);
        });
        this.$listen("title-season-focus", () => this.focusTitleSeason());
        this.$listen("title-season-change", (delta: number) => this.changeTitleSeason(Number(delta)));
        this.$listen("title-actions-return", () =>
          this.focusTitleAction(this.detailActionIndex),
        );
        this.$listen("title-episode-move", (delta: number) => {
          const count = this.detail.episodes.length;
          if (count)
            this.focusTitleEpisode(
              Math.max(
                0,
                Math.min(count - 1, this.detailEpisodeIndex + Number(delta)),
              ),
            );
        });
        this.$listen(
          "title-action-activate",
          () => void this.activateTitleAction(),
        );
        this.$listen("title-action-hold", () => {
          if (this.phase === "detail" && this.detail.target)
            void this.openSources(this.detail.target, false);
        });
        this.$listen("title-episode-activate", () => {
          const episode = this.detail.episodes[this.detailEpisodeIndex]?.item;
          if (this.phase === "detail" && episode)
            void this.openSources(episode, false);
        });
        this.$listen("source-chip-move", (delta: number) =>
          this.focusSourceChip(
            Math.max(0, Math.min(4, this.sourceChipIndex + Number(delta))),
          ),
        );
        this.$listen("source-chip-activate", (position: number) =>
          this.chooseSourceQuality(Number(position)),
        );
        this.$listen("source-provider-focus", () => this.focusSourceProvider());
        this.$listen("source-chip-restore", () =>
          this.focusSourceChip(this.sourceChipIndex),
        );
        this.$listen("source-rows-enter", () => this.focusSourceRow(0));
        this.$listen("source-provider-activate", () =>
          this.openProviderPicker(),
        );
        this.$listen("provider-option-move", (delta: number) =>
          this.moveProviderOption(Number(delta)),
        );
        this.$listen("provider-option-activate", () =>
          this.selectProviderOption(),
        );
        this.$listen("source-row-move", (delta: number) =>
          this.moveSourceRow(Number(delta)),
        );
        this.$listen("source-quality-step", (delta: number) =>
          this.stepSourceQuality(Number(delta)),
        );
        this.$listen("source-row-activate", () => this.selectSourceRow());
        this.$listen("source-row-hold", () => this.openSourceDetails());
        this.$listen("source-detail-close", () => this.closeSourceDetails());
        this.$listen("player-control-move", (delta: number) =>
          this.focusPlayerControl(
            Math.max(0, Math.min(6, this.playerFocusIndex + Number(delta) + (this.playerItem?.season === undefined && this.playerFocusIndex + Number(delta) === 3 ? Number(delta) : 0))),
          ),
        );
        this.$listen("player-timeline-focus", () => this.focusPlayerTimeline());
        this.$listen("player-controls-return", () =>
          this.focusPlayerControl(this.playerFocusIndex),
        );
        this.$listen(
          "player-control-activate",
          () => void this.activatePlayerControl(),
        );
        this.$listen("player-seek-preview", (delta: number) =>
          this.previewPlayerSeek(Number(delta)),
        );
        this.$listen("player-seek-commit", () => void this.commitPlayerSeek());
        this.$listen("player-track-move", (delta: number) =>
          this.moveTrackFocus(Number(delta)),
        );
        this.$listen(
          "player-track-activate",
          () => void this.selectTrackChoice(),
        );
        void session.dispatch({
          Begin: {
            origin: api.serverOrigin,
            allowInsecurePreview:
              import.meta.env.DEV && api.serverOrigin === location.origin,
          },
        });
      },
      destroy() {
        disposeProfileEditor?.();
        ++pairingGeneration;
        pairingScope?.abort();
        homeScope?.abort();
        ++homeGeneration;
        detailScope?.abort();
        ++detailGeneration;
        discoverScope?.abort();
        ++discoverGeneration;
        libraryScope?.abort();
        ++libraryGeneration;
        searchScope?.abort();
        ++searchGeneration;
        clearTimeout(searchTimer);
        liveScope?.abort();
        ++liveGeneration;
        clearInterval(liveClockTimer);
        sourceScope?.abort();
        ++sourceGeneration;
        clearTimeout(sourceTimer);
        clearInterval(heartbeatTimer);
        clearTimeout(chromeTimer);
        ++playbackGeneration;
        nextScope?.abort();
        void playback?.dispose().catch(() => undefined);
        document
          .getElementById("player-shade")
          ?.style.setProperty("display", "none");
        clearTimeout(pairingTimer);
        disposeSession?.();
      },
    },
    methods: {
      async loadHome(profileId: string) {
        const generation = ++homeGeneration;
        homeScope?.abort();
        const scope = api.createScope();
        homeScope = scope;
        const current = () => generation === homeGeneration && !scope.signal.aborted;
        const selected = this.profiles.find(profile => profile.id === profileId);
        this.homeProfileAvatar = selected ? profileTileData(selected).image : "";
        this.railProfileName = selected?.name ?? "Profile";
        this.railCurrent = "home";
        this.railExpanded = false;
        this.currentProfileId = profileId;
        this.homeFocusZone = "action";
        this.home = { ...emptyHome };
        this.homeShelves = [];
        this.homeShelfIndex = 0;
        this.homeShelfPositions = {};
        this.homeCardIndex = 0;
        this.homeCardWindowStart = 0;
        this.homeScrollOffset = 0;
        this.homeWindowX = 0;
        this.homeNotice = "";
        this.phase = "home";
        this.refreshHomeShelf();
        if (new URLSearchParams(location.search).has("perfdebug")) performance.mark("viptv:home-shell");
        setTimeout(() => {
          if (!current() || this.phase !== "home") return;
          this.revealHomeControls();
          this.focusHomeAction(0);
        }, 0);
        let enrichedId = "";
        let primaryLoaded = false;
        const enrich = () => {
          const view = this.home;
          const id = view.heroItem?.id;
          if (!id || enrichedId === id) return;
          // Queue already hydrates this exact item and publishes each completion.
          if (view.queueItems.some(item => item.id === id)) return;
          enrichedId = id;
          void enrichHomeHero(api, view, scope.signal).then(enriched => {
            if (current() && this.home.heroItem?.id === id) {
              this.home = { ...enriched, queueItems: this.home.queueItems, favoriteItems: this.home.favoriteItems, cards: this.home.cards, saved: this.home.saved };
              this.revealHomeControls();
            }
          }).catch(() => undefined);
        };
        const loaded = new Map<number, HomeShelfView>();
        const fallbackHero = () => {
          const item = this.homeShelves.find(shelf => shelf.items.length)?.items[0];
          if (current() && primaryLoaded && !this.home.heroItem && item) {
            this.home = projectHome(item, this.home.queueItems, undefined, this.home.favoriteItems);
            this.revealHomeControls();
            enrich();
          }
        };
        void loadHomeShelves(api, scope.signal, (shelf, order) => {
          if (!current()) return;
          const key = this.homeFocusZone === "card" ? this.homeShelves[this.homeShelfIndex]?.key : undefined;
          loaded.set(order, shelf);
          this.homeShelves = [...loaded.entries()].sort(([a], [b]) => a - b).map(([, row]) => row);
          this.syncHomeLists(key);
          fallbackHero();
        });
        try {
          await loadHomeView(api, profileId, scope.signal, view => {
            if (!current()) return;
            this.home = view.heroItem ? view : { ...this.home, queueItems: view.queueItems, favoriteItems: view.favoriteItems };
            this.homeAddLabel = this.home.saved ? "✓" : "+";
            this.syncHomeLists();
            this.revealHomeControls();
            enrich();
            if (new URLSearchParams(location.search).has("perfdebug")) performance.mark("viptv:home-data");
          });
          primaryLoaded = true;
          fallbackHero();
        } catch (cause) {
          primaryLoaded = true;
          fallbackHero();
          if (current()) this.homeNotice = cause instanceof Error ? cause.message : "Could not load Home. Open Settings to reconnect.";
        }
      },
      revealHomeControls() {
        for (let index = 0; index < 3; index++)
          (
            this.$select(`heroAction${index}`) as unknown as {
              reveal?: () => void;
            }
          )?.reveal?.();
        for (let index = 0; index < 6; index++)
          (
            this.$select(`homeCard${index}`) as unknown as {
              reveal?: () => void;
            }
          )?.reveal?.();
      },
      focusHomeAction(index: number) {
        this.homeFocusZone = "action";
        this.homeActionIndex = index;
        this.$select(`heroAction${index}`)?.$focus();
      },
      moveHomeAction(position: number, delta: number) {
        if (delta < 0 && this.homeActionIndex === 0) {
          this.openRail();
          return;
        }
        this.focusHomeAction(
          Math.max(0, Math.min(2, this.homeActionIndex + delta)),
        );
      },
      focusHomeCard(index: number) {
        const shelf = this.homeShelves[this.homeShelfIndex];
        if (!shelf?.cards.length) return;
        index = Math.max(0, Math.min(shelf.cards.length - 1, index));
        this.homeFocusZone = "card";
        this.homeCardIndex = index;
        this.homeShelfPositions = { ...this.homeShelfPositions, [shelf.key]: index };
        const window = carouselWindow(index, shelf.cards.length, 320, 1632, this.homeScrollOffset);
        this.homeScrollOffset = window.offset;
        this.homeCardWindowStart = window.start;
        this.homeWindowX = window.x;
        this.refreshHomeShelf();
        this.$select(`homeCard${index - this.homeCardWindowStart}`)?.$focus();
      },
      moveHomeCard(position: number, delta: number) {
        const count = this.homeShelves[this.homeShelfIndex]?.cards.length ?? 0;
        if (!count) return;
        if (delta < 0 && this.homeCardIndex === 0) {
          this.openRail();
          return;
        }
        this.focusHomeCard(
          Math.max(0, Math.min(count - 1, this.homeCardIndex + delta)),
        );
      },
      refreshHomeShelf() {
        const shelf = this.homeShelves[this.homeShelfIndex];
        noteHomeShelf(this.homeShelfIndex, this.homeCardIndex, shelf?.cards.length ?? 0, this.homeCardWindowStart, this.homeShelves.length);
        this.homeShelfLabel = shelf?.title ?? "";
        this.homeCards = Array.from({ length: 6 }, (_, slot) => shelf?.cards[this.homeCardWindowStart + slot] ?? { ...emptyHomeCard });
        const next = this.homeShelves[this.homeShelfIndex + 1];
        this.homeNextShelfLabel = next?.title ?? "";
        this.homeNextCards = Array.from({ length: 5 }, (_, slot) => next?.cards[slot] ?? { ...emptyHomeCard });
      },
      syncHomeLists(currentKey?: string) {
        currentKey ??= this.homeFocusZone === "card" ? this.homeShelves[this.homeShelfIndex]?.key : undefined;
        const own = initialHomeShelves(this.home);
        const others = this.homeShelves.filter((shelf) => shelf.key !== "queue" && shelf.key !== "favorites");
        this.homeShelves = [...own.filter((shelf) => shelf.key === "queue"), ...others, ...own.filter((shelf) => shelf.key === "favorites")];
        const matching = this.homeShelves.findIndex((shelf) => shelf.key === currentKey);
        this.homeShelfIndex = matching >= 0 ? matching : 0;
        this.homeCardIndex = Math.min(this.homeCardIndex, Math.max(0, (this.homeShelves[this.homeShelfIndex]?.cards.length ?? 1) - 1));
        this.homeCardWindowStart = Math.min(this.homeCardWindowStart, Math.max(0, (this.homeShelves[this.homeShelfIndex]?.cards.length ?? 0) - 4));
        this.refreshHomeShelf();
      },
      moveHomeShelf(delta: number) {
        const target = this.homeShelfIndex + delta;
        if (target < 0) { this.focusHomeAction(this.homeActionIndex); return; }
        if (target >= this.homeShelves.length) return;
        this.homeShelfIndex = target;
        this.homeScrollOffset = 0;
        this.homeCardWindowStart = 0;
        this.focusHomeCard(this.homeShelfPositions[this.homeShelves[target].key] ?? 0);
      },
      openRail() {
        if (
          this.phase !== "home" &&
          this.phase !== "detail" &&
          this.phase !== "discover" &&
          this.phase !== "library" &&
          this.phase !== "search" &&
          this.phase !== "live" &&
          this.phase !== "settings"
        )
          return;
        this.railReturnZone =
          this.phase === "home"
            ? this.homeFocusZone
            : this.phase === "discover"
              ? this.discoverFocusZone
              : this.phase === "library"
                ? this.libraryFocusZone
                : this.phase === "search"
                  ? this.searchFocusZone === "key"
                    ? "key"
                    : "result"
                  : this.phase === "live"
                    ? this.liveFocusZone
                    : this.phase === "settings"
                      ? this.settingsFocusZone
                      : this.detailFocusZone;
        this.railReturnIndex =
          this.phase === "home"
            ? this.homeFocusZone === "card"
              ? this.homeCardIndex
              : this.homeActionIndex
            : this.phase === "discover"
              ? this.discoverFocusZone === "card"
                ? this.discoverCardIndex
                : this.discoverChipIndex
              : this.phase === "library"
                ? this.libraryFocusZone === "card"
                  ? this.libraryCardIndex
                  : this.librarySegmentIndex
                : this.phase === "search"
                  ? this.searchFocusZone === "key"
                    ? this.searchKeyIndex
                    : this.searchResultIndex
                  : this.phase === "live"
                    ? this.liveFocusZone === "filter"
                      ? this.liveFilterIndex
                      : this.liveFocusZone === "program"
                        ? this.liveProgramPosition
                        : this.liveSelectedRow
                    : this.phase === "settings"
                      ? this.settingsFocusZone === "profile"
                        ? this.settingsProfileIndex
                        : this.settingsSelectedIndex
                      : this.detailFocusZone === "episode"
                        ? this.detailEpisodeIndex
                        : this.detailActionIndex;
        this.railExpanded = true;
        this.railNotice = "";
        this.focusRail(
          this.railCurrent === "search"
            ? 1
            : this.railCurrent === "discover"
              ? 3
              : this.railCurrent === "live"
                ? 4
                : this.railCurrent === "library"
                  ? 5
                  : this.railCurrent === "settings"
                    ? 6
                    : 2,
        );
        setTimeout(() => {
          if (!this.railExpanded) return;
          for (let index = 0; index < 7; index++)
            (
              this.$select(`rail${index}`) as unknown as { reveal?: () => void }
            )?.reveal?.();
        }, 0);
      },
      focusRail(index: number) {
        this.railFocusIndex = index;
        this.$select(`rail${index}`)?.$focus();
      },
      moveRail(delta: number) {
        this.focusRail(Math.max(0, Math.min(6, this.railFocusIndex + delta)));
      },
      closeRail() {
        if (!this.railExpanded) return;
        this.railExpanded = false;
        this.railNotice = "";
        if (this.phase === "home") {
          if (this.railReturnZone === "card")
            this.focusHomeCard(this.railReturnIndex);
          else this.focusHomeAction(this.railReturnIndex);
        } else if (this.phase === "detail") {
          if (this.railReturnZone === "episode")
            this.focusTitleEpisode(this.railReturnIndex);
          else if (this.railReturnZone === "season") this.focusTitleSeason();
          else this.focusTitleAction(this.railReturnIndex);
        } else if (this.phase === "discover") {
          if (this.railReturnZone === "chip")
            this.focusDiscoverChip(this.railReturnIndex);
          else this.focusDiscoverCard(this.railReturnIndex);
        } else if (this.phase === "library") {
          if (this.railReturnZone === "segment")
            this.focusLibrarySegment(this.railReturnIndex);
          else this.focusLibraryCard(this.railReturnIndex);
        } else if (this.phase === "search") {
          if (this.railReturnZone === "result")
            this.focusSearchResult(this.railReturnIndex);
          else this.focusSearchKey(this.railReturnIndex);
        } else if (this.phase === "live") {
          if (this.railReturnZone === "filter")
            this.focusLiveFilter(this.railReturnIndex);
          else if (this.railReturnZone === "program")
            this.focusLiveProgram(this.railReturnIndex);
          else this.focusLiveChannel(this.railReturnIndex);
        } else if (this.phase === "settings") {
          if (this.railReturnZone === "profile")
            this.focusSettingsProfile(this.railReturnIndex);
          else this.focusSettingsRow(this.railReturnIndex);
        }
      },
      activateRail() {
        if (!this.railExpanded) return;
        if (this.railFocusIndex === 0) {
          this.railExpanded = false;
          this.showProfiles(this.profiles);
        } else if (this.railFocusIndex === 2) {
          if (this.phase === "home") this.closeRail();
          else this.goHomeFromRail();
        } else if (this.railFocusIndex === 1) {
          if (this.phase === "search") this.closeRail();
          else {
            this.searchReturnPhase =
              this.phase === "discover"
                ? "discover"
                : this.phase === "library"
                  ? "library"
                  : "home";
            this.searchReturnZone =
              this.railReturnZone === "chip"
                ? "chip"
                : this.railReturnZone === "segment"
                  ? "segment"
                  : this.railReturnZone === "card"
                    ? "card"
                    : "action";
            this.searchReturnIndex = this.railReturnIndex;
            void this.openSearch();
          }
        } else if (this.railFocusIndex === 3) {
          if (this.phase === "discover") this.closeRail();
          else {
            if (this.phase === "home") {
              this.discoverReturnPhase = "home";
              this.discoverReturnZone =
                this.railReturnZone === "card" ? "card" : "action";
              this.discoverReturnIndex = this.railReturnIndex;
            } else if (this.phase === "library") {
              this.discoverReturnPhase = "library";
              this.discoverReturnZone =
                this.railReturnZone === "segment" ? "segment" : "card";
              this.discoverReturnIndex = this.railReturnIndex;
            } else if (this.phase === "search") {
              this.discoverReturnPhase = "search";
              this.discoverReturnZone =
                this.railReturnZone === "result" ? "result" : "key";
              this.discoverReturnIndex = this.railReturnIndex;
            }
            void this.openDiscover();
          }
        } else if (this.railFocusIndex === 5) {
          if (this.phase === "library") this.closeRail();
          else {
            this.libraryReturnPhase =
              this.phase === "search"
                ? "search"
                : this.phase === "discover"
                  ? "discover"
                  : "home";
            this.libraryReturnZone =
              this.railReturnZone === "result"
                ? "result"
                : this.railReturnZone === "key"
                  ? "key"
                  : this.railReturnZone === "chip"
                    ? "chip"
                    : this.railReturnZone === "card"
                      ? "card"
                      : "action";
            this.libraryReturnIndex = this.railReturnIndex;
            void this.openLibrary();
          }
        } else if (this.railFocusIndex === 4) {
          if (this.phase === "live") this.closeRail();
          else {
            this.liveReturnPhase =
              this.phase === "search"
                ? "search"
                : this.phase === "discover"
                  ? "discover"
                  : this.phase === "library"
                    ? "library"
                    : "home";
            this.liveReturnZone =
              this.railReturnZone === "result"
                ? "result"
                : this.railReturnZone === "key"
                  ? "key"
                  : this.railReturnZone === "chip"
                    ? "chip"
                    : this.railReturnZone === "segment"
                      ? "segment"
                      : this.railReturnZone === "card"
                        ? "card"
                        : "action";
            this.liveReturnIndex = this.railReturnIndex;
            void this.openLive();
          }
        } else if (this.railFocusIndex === 6) {
          if (this.phase === "settings") this.closeRail();
          else {
            this.settingsReturnPhase =
              this.phase === "search"
                ? "search"
                : this.phase === "discover"
                  ? "discover"
                  : this.phase === "library"
                    ? "library"
                    : this.phase === "live"
                      ? "live"
                      : "home";
            this.settingsReturnZone =
              this.railReturnZone === "result"
                ? "result"
                : this.railReturnZone === "key"
                  ? "key"
                  : this.railReturnZone === "filter"
                    ? "filter"
                    : this.railReturnZone === "program"
                      ? "program"
                      : this.railReturnZone === "channel"
                        ? "channel"
                        : this.railReturnZone === "chip"
                          ? "chip"
                          : this.railReturnZone === "segment"
                            ? "segment"
                            : this.railReturnZone === "card"
                              ? "card"
                              : "action";
            this.settingsReturnIndex = this.railReturnIndex;
            void this.openSettings();
          }
        }
      },
      goHomeFromRail() {
        discoverScope?.abort();
        ++discoverGeneration;
        libraryScope?.abort();
        ++libraryGeneration;
        searchScope?.abort();
        ++searchGeneration;
        clearTimeout(searchTimer);
        liveScope?.abort();
        ++liveGeneration;
        clearInterval(liveClockTimer);
        settingsScope?.abort();
        ++settingsGeneration;
        detailScope?.abort();
        ++detailGeneration;
        this.railExpanded = false;
        this.railCurrent = "home";
        this.phase = "home";
        setTimeout(() => {
          this.revealHomeControls();
          if (this.homeFocusZone === "card")
            this.focusHomeCard(this.homeCardIndex);
          else this.focusHomeAction(this.homeActionIndex);
        }, 0);
      },
      async openDiscover() {
        if (this.phase === "library") {
          libraryScope?.abort();
          ++libraryGeneration;
        }
        if (this.phase === "search") {
          searchScope?.abort();
          ++searchGeneration;
          clearTimeout(searchTimer);
        }
        const generation = ++discoverGeneration;
        discoverScope?.abort();
        const scope = api.createScope();
        discoverScope = scope;
        this.railExpanded = false;
        this.railCurrent = "discover";
        this.phase = "discover";
        this.discoverError = "";
        this.discoverBusy = true;
        setTimeout(() => {
          if (this.phase !== "discover") return;
          this.discoverHeading = "Discover";
          this.discoverOkLabel = "OK";
          this.discoverSelectLabel = "Select";
          this.discoverOptionsIcon = "≡";
          this.discoverOptionsLabel = "Options";
        }, 0);
        try {
          const available = await api.catalogs({ signal: scope.signal });
          if (generation !== discoverGeneration || scope.signal.aborted) return;
          this.discoverCatalogs = available;
          const previous = this.discoverCatalog;
          const selected =
            available.find(
              (candidate) =>
                candidate.id === previous?.id &&
                candidate.type === previous.type &&
                candidate.addonId === previous.addonId,
            ) ?? initialCatalog(available);
          if (selected) void this.loadDiscoverCatalog(selected);
          else {
            this.discoverBusy = false;
            this.discoverError =
              "No catalogs are available. Add or enable a catalog addon in Settings.";
          }
        } catch (cause) {
          if (generation !== discoverGeneration || scope.signal.aborted) return;
          this.discoverBusy = false;
          this.discoverError =
            cause instanceof Error ? cause.message : "Unable to load catalogs.";
        }
      },
      async loadDiscoverCatalog(
        catalog: Catalog,
        values: Record<string, string> = catalogDefaults(catalog),
        skip = 0,
        focusCard = true,
      ) {
        if (skip) {
          const pageKey = `${catalog.addonId ?? ""}:${catalog.type}:${catalog.id}:${JSON.stringify(values)}@${skip}`;
          if (pageKey === discoverRequestedPage) return;
          discoverRequestedPage = pageKey;
        } else discoverRequestedPage = "";
        const generation = ++discoverGeneration;
        discoverScope?.abort();
        const scope = api.createScope();
        discoverScope = scope;
        this.discoverCatalog = catalog;
        this.discoverValues = values;
        const chips = discoverChips(this.discoverCatalogs, catalog, values);
        this.discoverChips = Array.from(
          { length: 12 },
          (_, index) => chips[index] ?? { ...emptyDiscoverChip },
        );
        if (!skip) {
          this.discoverItems = [];
          this.discoverWindowStart = 0;
          this.discoverCardIndex = 0;
          this.refreshDiscoverCards();
        }
        this.discoverError = "";
        const request = requestForCatalog(catalog, values, skip);
        if (!request) {
          this.discoverBusy = false;
          this.discoverError =
            "Choose the required filters to browse this catalog.";
          this.revealDiscoverChips();
          return;
        }
        this.discoverBusy = true;
        try {
          const page = await api.discover(request, { signal: scope.signal });
          if (generation !== discoverGeneration || scope.signal.aborted) return;
          this.discoverItems = skip
            ? [
                ...this.discoverItems,
                ...page.items.filter(
                  (item) =>
                    !this.discoverItems.some(
                      (old) => old.type === item.type && old.id === item.id,
                    ),
                ),
              ]
            : [...page.items];
          this.discoverNextSkip = page.hasMore
            ? (page.nextSkip ?? skip + page.items.length)
            : null;
          this.discoverBusy = false;
          this.discoverError = this.discoverItems.length ? "" : "No titles yet";
          this.refreshDiscoverCards();
          this.revealDiscoverChips();
          if (!skip && focusCard)
            setTimeout(() => {
              if (
                generation === discoverGeneration &&
                this.phase === "discover" &&
                !this.discoverFilterOpen &&
                !this.railExpanded
              )
                this.focusDiscoverCard(0);
            }, 60);
        } catch (cause) {
          if (generation !== discoverGeneration || scope.signal.aborted) return;
          this.discoverBusy = false;
          this.discoverError =
            cause instanceof Error ? cause.message : "Unable to load titles.";
          this.revealDiscoverChips();
        }
      },
      refreshDiscoverCards() {
        const visible = this.discoverItems.slice(
          this.discoverWindowStart,
          this.discoverWindowStart + 12,
        );
        this.discoverCards = Array.from({ length: 12 }, (_, index) =>
          visible[index]
            ? discoverCard(visible[index])
            : { ...emptyDiscoverCard },
        );
        setTimeout(() => {
          if (this.phase !== "discover") return;
          for (let index = 0; index < 12; index++)
            (
              this.$select("discoverScreen")?.$select(
                `discoverCard${index}`,
              ) as unknown as { reveal?: () => void }
            )?.reveal?.();
        }, 0);
      },
      revealDiscoverChips() {
        setTimeout(() => {
          if (this.phase !== "discover") return;
          for (let index = 0; index < 12; index++)
            (
              this.$select("discoverScreen")?.$select(
                `discoverChip${index}`,
              ) as unknown as { reveal?: () => void }
            )?.reveal?.();
        }, 0);
      },
      focusDiscoverChip(index: number) {
        this.discoverFocusZone = "chip";
        this.discoverChipIndex = index;
        this.$select("discoverScreen")
          ?.$select(`discoverChip${index}`)
          ?.$focus();
      },
      moveDiscoverChip(delta: number) {
        if (delta < 0 && this.discoverChipIndex === 0) {
          this.openRail();
          return;
        }
        const last = Math.max(
          0,
          this.discoverChips.filter((chip) => chip.visible).length - 1,
        );
        this.focusDiscoverChip(
          Math.max(0, Math.min(last, this.discoverChipIndex + delta)),
        );
      },
      focusDiscoverCard(index: number) {
        if (!this.discoverItems[index]) return;
        this.discoverFocusZone = "card";
        this.discoverCardIndex = index;
        const previousWindow = this.discoverWindowStart;
        if (index < this.discoverWindowStart)
          this.discoverWindowStart = Math.floor(index / 4) * 4;
        else if (index >= this.discoverWindowStart + 12)
          this.discoverWindowStart = (Math.floor(index / 4) - 2) * 4;
        noteDiscoverWindow(
          index,
          this.discoverWindowStart,
          this.discoverItems.length,
        );
        if (this.discoverWindowStart !== previousWindow)
          this.refreshDiscoverCards();
        const local = index - this.discoverWindowStart;
        if (this.discoverWindowStart !== previousWindow)
          setTimeout(() => {
            this.$select("discoverScreen")
              ?.$select(`discoverCard${local}`)
              ?.$focus();
            noteFocus("discover-card", index);
          }, 0);
        else
          this.$select("discoverScreen")
            ?.$select(`discoverCard${local}`)
            ?.$focus();
      },
      moveDiscoverCard(direction: string) {
        const index = this.discoverCardIndex;
        if (direction === "left" && index % 4 === 0) {
          this.openRail();
          return;
        }
        if (direction === "up" && index < 4) {
          this.focusDiscoverChip(
            Math.min(
              this.discoverChipIndex,
              Math.max(
                0,
                this.discoverChips.filter((chip) => chip.visible).length - 1,
              ),
            ),
          );
          return;
        }
        const delta =
          direction === "left"
            ? -1
            : direction === "right"
              ? 1
              : direction === "up"
                ? -4
                : 4;
        const next = index + delta;
        if (
          next >= 0 &&
          next < this.discoverItems.length &&
          (direction !== "right" || index % 4 !== 3)
        )
          this.focusDiscoverCard(next);
        if (
          direction === "down" &&
          this.discoverNextSkip !== null &&
          this.discoverItems.length - next < 8 &&
          !this.discoverBusy &&
          this.discoverCatalog
        )
          void this.loadDiscoverCatalog(
            this.discoverCatalog,
            this.discoverValues,
            this.discoverNextSkip,
          );
      },
      activateDiscoverCard() {
        const item = this.discoverItems[this.discoverCardIndex];
        if (item) void this.openDetail(item);
      },
      async activateDiscoverChip() {
        const chip = this.discoverChips[this.discoverChipIndex];
        if (!chip?.visible) return;
        if (chip.kind === "group") {
          const first = catalogForGroup(
            this.discoverCatalogs,
            chip.value as ReturnType<typeof discoverTypeGroup>,
          );
          if (
            first &&
            chip.value !== discoverTypeGroup(this.discoverCatalog?.type ?? "")
          )
            void this.loadDiscoverCatalog(
              first,
              catalogDefaults(first),
              0,
              false,
            );
        } else if (chip.kind === "catalog") {
          const current = this.discoverCatalog;
          if (!current) return;
          const next = catalogsForGroup(
            this.discoverCatalogs,
            discoverTypeGroup(current.type),
          )[Number(chip.value)];
          if (next && !sameCatalog(next, current))
            void this.loadDiscoverCatalog(
              next,
              catalogDefaults(next),
              0,
              false,
            );
        } else this.openDiscoverFilter(chip.value);
      },
      openDiscoverFilter(name: string) {
        const filter =
          this.discoverCatalog &&
          catalogFilters(this.discoverCatalog).find(
            (candidate) => candidate.name === name,
          );
        if (!filter) return;
        if (!filter.options.length) {
          this.discoverError = "Text filters are not available yet.";
          return;
        }
        this.discoverFilterName = name;
        this.discoverFilterTitle = "";
        this.discoverFilterOkLabel = "";
        this.discoverFilterSelectLabel = "";
        this.discoverBackLabel = "";
        this.discoverCancelLabel = "";
        this.discoverFilterValue = this.discoverValues[name] || "Any";
        this.discoverFilterReturnChip = this.discoverChipIndex;
        this.discoverOptionLabels = Array.from(
          { length: 8 },
          (_, index) =>
            (filter.required
              ? [...filter.options, "Cancel"]
              : ["Any", ...filter.options, "Cancel"])[index] ?? "",
        );
        this.discoverFilterOpen = true;
        noteDiscoverFilter(true);
        setTimeout(() => {
          if (!this.discoverFilterOpen) return;
          this.discoverFilterTitle =
            name === "genre"
              ? "Genre"
              : name.charAt(0).toUpperCase() + name.slice(1);
          this.discoverFilterOkLabel = "OK";
          this.discoverFilterSelectLabel = "Select";
          this.discoverBackLabel = "BACK";
          this.discoverCancelLabel = "Cancel";
          for (let index = 0; index < 8; index++)
            (
              this.$select(`discoverOption${index}`) as unknown as {
                reveal?: () => void;
              }
            )?.reveal?.();
          this.focusDiscoverOption(
            Math.max(
              0,
              this.discoverOptionLabels.indexOf(this.discoverFilterValue),
            ),
          );
        }, 0);
      },
      focusDiscoverOption(index: number) {
        this.discoverOptionIndex = index;
        this.$select(`discoverOption${index}`)?.$focus();
      },
      moveDiscoverOption(delta: number) {
        const last = Math.max(
          0,
          this.discoverOptionLabels.filter(Boolean).length - 1,
        );
        this.focusDiscoverOption(
          Math.max(0, Math.min(last, this.discoverOptionIndex + delta)),
        );
      },
      closeDiscoverFilter() {
        if (!this.discoverFilterOpen) return;
        this.discoverFilterOpen = false;
        noteDiscoverFilter(false);
        this.focusDiscoverChip(this.discoverFilterReturnChip);
      },
      async selectDiscoverOption() {
        const value = this.discoverOptionLabels[this.discoverOptionIndex];
        const catalog = this.discoverCatalog;
        if (!catalog || !value) return;
        if (value === "Cancel") {
          this.closeDiscoverFilter();
          return;
        }
        const name = this.discoverFilterName;
        this.closeDiscoverFilter();
        void this.loadDiscoverCatalog(
          catalog,
          { ...this.discoverValues, [name]: value === "Any" ? "" : value },
          0,
          false,
        );
      },
      returnFromDiscover() {
        discoverScope?.abort();
        ++discoverGeneration;
        this.discoverFilterOpen = false;
        this.railExpanded = false;
        this.railCurrent = this.discoverReturnPhase;
        this.phase = this.discoverReturnPhase;
        setTimeout(() => {
          if (this.phase === "library") {
            this.revealLibrarySegments();
            this.refreshLibraryCards();
            if (this.discoverReturnZone === "segment")
              this.focusLibrarySegment(this.discoverReturnIndex);
            else this.focusLibraryCard(this.discoverReturnIndex);
          } else if (this.phase === "search") {
            this.refreshSearchWindow();
            if (this.discoverReturnZone === "result")
              this.focusSearchResult(this.discoverReturnIndex);
            else this.focusSearchKey(this.discoverReturnIndex);
          } else {
            this.revealHomeControls();
            if (this.discoverReturnZone === "card")
              this.focusHomeCard(this.discoverReturnIndex);
            else this.focusHomeAction(this.discoverReturnIndex);
          }
        }, 0);
      },
      async openLibrary() {
        if (this.phase === "discover") {
          discoverScope?.abort();
          ++discoverGeneration;
        }
        if (this.phase === "search") {
          searchScope?.abort();
          ++searchGeneration;
          clearTimeout(searchTimer);
        }
        const generation = ++libraryGeneration;
        libraryScope?.abort();
        const scope = api.createScope();
        libraryScope = scope;
        this.railExpanded = false;
        this.railCurrent = "library";
        this.phase = "library";
        this.libraryMode = "favorites";
        this.librarySegmentIndex = 0;
        this.libraryCardIndex = 0;
        this.libraryWindowStart = 0;
        this.libraryError = "";
        this.libraryBusy = true;
        this.libraryItems = [...this.home.favoriteItems];
        this.refreshLibraryCards();
        setTimeout(() => {
          if (this.phase !== "library") return;
          this.libraryHeading = "My List";
          this.libraryOkLabel = "OK";
          this.librarySelectLabel = "Select";
          this.libraryOptionsIcon = "≡";
          this.libraryOptionsLabel = "Options";
          this.revealLibrarySegments();
        }, 0);
        try {
          const favorites = await api.favorites(this.currentProfileId, {
            signal: scope.signal,
          });
          if (generation !== libraryGeneration || scope.signal.aborted) return;
          this.libraryFavorites = favorites;
          this.libraryItems = favorites;
          noteLibraryState("favorites", favorites.length);
          this.libraryBusy = false;
          this.libraryError = favorites.length
            ? ""
            : "Your list is empty. Add titles with the + button.";
          this.refreshLibraryCards();
          setTimeout(() => {
            if (
              generation === libraryGeneration &&
              this.phase === "library" &&
              !this.railExpanded
            )
              if (favorites.length) this.focusLibraryCard(0);
              else this.focusLibrarySegment(0);
          }, 60);
        } catch (cause) {
          if (generation !== libraryGeneration || scope.signal.aborted) return;
          this.libraryBusy = false;
          this.libraryError =
            cause instanceof Error ? cause.message : "Unable to load My List.";
          this.focusLibrarySegment(0);
        }
      },
      async loadLibraryQueue(offset = 0) {
        if (offset) {
          const pageKey = `${this.currentProfileId}@${offset}`;
          if (pageKey === libraryRequestedPage) return;
          libraryRequestedPage = pageKey;
        } else libraryRequestedPage = "";
        const generation = ++libraryGeneration;
        libraryScope?.abort();
        const scope = api.createScope();
        libraryScope = scope;
        this.libraryMode = "queue";
        this.libraryBusy = true;
        this.libraryError = "";
        if (!offset) {
          this.libraryWindowStart = 0;
          this.libraryCardIndex = 0;
          this.libraryItems = this.libraryQueueItems.length
            ? [...this.libraryQueueItems]
            : [...this.home.queueItems];
          this.refreshLibraryCards();
        }
        try {
          const page = await api.queue(this.currentProfileId, offset, {
            signal: scope.signal,
          });
          if (generation !== libraryGeneration || scope.signal.aborted) return;
          this.libraryQueueItems = offset
            ? [
                ...this.libraryQueueItems,
                ...page.items.filter(
                  (item) =>
                    !this.libraryQueueItems.some(
                      (old) => old.type === item.type && old.id === item.id,
                    ),
                ),
              ]
            : [...page.items];
          this.libraryItems = [...this.libraryQueueItems];
          noteLibraryState("queue", this.libraryItems.length);
          this.libraryNextOffset = page.nextOffset;
          this.libraryBusy = false;
          this.libraryError = this.libraryItems.length
            ? ""
            : "Nothing in progress. Titles you start watching appear here.";
          this.refreshLibraryCards();
        } catch (cause) {
          if (generation !== libraryGeneration || scope.signal.aborted) return;
          this.libraryBusy = false;
          this.libraryError =
            cause instanceof Error
              ? cause.message
              : "Unable to load Continue Watching.";
        }
      },
      async reloadLibraryFavorites(index: number) {
        const generation = ++libraryGeneration;
        libraryScope?.abort();
        const scope = api.createScope();
        libraryScope = scope;
        try {
          const favorites = await api.favorites(this.currentProfileId, {
            signal: scope.signal,
          });
          if (
            generation !== libraryGeneration ||
            scope.signal.aborted ||
            this.phase !== "library"
          )
            return;
          this.libraryFavorites = favorites;
          this.libraryItems = [...favorites];
          this.libraryWindowStart = 0;
          this.libraryCardIndex = Math.min(
            index,
            Math.max(0, favorites.length - 1),
          );
          this.libraryError = favorites.length
            ? ""
            : "Your list is empty. Add titles with the + button.";
          noteLibraryState("favorites", favorites.length);
          this.refreshLibraryCards();
          setTimeout(() => {
            if (generation !== libraryGeneration || this.phase !== "library")
              return;
            if (favorites.length) this.focusLibraryCard(this.libraryCardIndex);
            else this.focusLibrarySegment(0);
          }, 40);
        } catch {
          if (generation !== libraryGeneration || scope.signal.aborted) return;
          this.focusLibraryCard(
            Math.min(index, Math.max(0, this.libraryItems.length - 1)),
          );
        }
      },
      revealLibrarySegments() {
        for (let index = 0; index < 2; index++)
          (
            this.$select("libraryScreen")?.$select(
              `librarySegment${index}`,
            ) as unknown as { reveal?: () => void }
          )?.reveal?.();
      },
      refreshLibraryCards() {
        const visible = this.libraryItems.slice(
          this.libraryWindowStart,
          this.libraryWindowStart + 12,
        );
        this.libraryCards = Array.from({ length: 12 }, (_, index) =>
          visible[index]
            ? libraryCard(visible[index], this.libraryMode === "queue")
            : { ...emptyDiscoverCard },
        );
        setTimeout(() => {
          if (this.phase !== "library" && this.sourceReturnOrigin !== "library")
            return;
          for (let index = 0; index < 12; index++)
            (
              this.$select("libraryScreen")?.$select(
                `libraryCard${index}`,
              ) as unknown as { reveal?: () => void }
            )?.reveal?.();
        }, 0);
      },
      focusLibrarySegment(index: number) {
        this.libraryFocusZone = "segment";
        this.librarySegmentIndex = index;
        this.$select("libraryScreen")
          ?.$select(`librarySegment${index}`)
          ?.$focus();
      },
      moveLibrarySegment(delta: number) {
        if (delta < 0 && this.librarySegmentIndex === 0) {
          this.openRail();
          return;
        }
        this.focusLibrarySegment(
          Math.max(0, Math.min(1, this.librarySegmentIndex + delta)),
        );
      },
      async activateLibrarySegment() {
        if (this.librarySegmentIndex === 1) void this.loadLibraryQueue();
        else {
          libraryScope?.abort();
          ++libraryGeneration;
          this.libraryMode = "favorites";
          this.libraryItems = [...this.libraryFavorites];
          noteLibraryState("favorites", this.libraryItems.length);
          this.libraryWindowStart = 0;
          this.libraryCardIndex = 0;
          this.libraryNextOffset = null;
          this.libraryError = this.libraryItems.length
            ? ""
            : "Your list is empty. Add titles with the + button.";
          this.refreshLibraryCards();
        }
      },
      focusLibraryCard(index: number) {
        if (!this.libraryItems[index]) return;
        this.libraryFocusZone = "card";
        this.libraryCardIndex = index;
        const previousWindow = this.libraryWindowStart;
        if (index < this.libraryWindowStart)
          this.libraryWindowStart = Math.floor(index / 4) * 4;
        else if (index >= this.libraryWindowStart + 12)
          this.libraryWindowStart = (Math.floor(index / 4) - 2) * 4;
        if (this.libraryWindowStart !== previousWindow)
          this.refreshLibraryCards();
        const local = index - this.libraryWindowStart;
        if (this.libraryWindowStart !== previousWindow)
          setTimeout(() => {
            this.$select("libraryScreen")
              ?.$select(`libraryCard${local}`)
              ?.$focus();
            noteFocus("library-card", index);
          }, 0);
        else
          this.$select("libraryScreen")
            ?.$select(`libraryCard${local}`)
            ?.$focus();
      },
      moveLibraryCard(direction: string) {
        const index = this.libraryCardIndex;
        if (direction === "left" && index % 4 === 0) {
          this.openRail();
          return;
        }
        if (direction === "up" && index < 4) {
          this.focusLibrarySegment(this.librarySegmentIndex);
          return;
        }
        const delta =
          direction === "left"
            ? -1
            : direction === "right"
              ? 1
              : direction === "up"
                ? -4
                : 4;
        const next = index + delta;
        if (
          next >= 0 &&
          next < this.libraryItems.length &&
          (direction !== "right" || index % 4 !== 3)
        )
          this.focusLibraryCard(next);
        if (
          direction === "down" &&
          this.libraryMode === "queue" &&
          this.libraryNextOffset !== null &&
          this.libraryItems.length - next < 8 &&
          !this.libraryBusy
        )
          void this.loadLibraryQueue(this.libraryNextOffset);
      },
      activateLibraryCard() {
        const item = this.libraryItems[this.libraryCardIndex];
        if (!item) return;
        const action = cardPresentation(
          item,
          this.libraryMode === "queue" ? "queue" : "catalog",
        ).primaryAction;
        if (action === "resume" || action === "next")
          void this.openSources(item, true);
        else if (action === "sources" || action === "play")
          void this.openSources(item, false);
        else void this.openDetail(item);
      },
      returnFromLibrary() {
        libraryScope?.abort();
        ++libraryGeneration;
        this.railExpanded = false;
        this.phase = this.libraryReturnPhase;
        this.railCurrent = this.libraryReturnPhase;
        setTimeout(() => {
          if (this.phase === "discover") {
            this.revealDiscoverChips();
            this.refreshDiscoverCards();
            if (this.libraryReturnZone === "chip")
              this.focusDiscoverChip(this.libraryReturnIndex);
            else this.focusDiscoverCard(this.libraryReturnIndex);
          } else if (this.phase === "search") {
            this.refreshSearchWindow();
            if (this.libraryReturnZone === "result")
              this.focusSearchResult(this.libraryReturnIndex);
            else this.focusSearchKey(this.libraryReturnIndex);
          } else {
            this.revealHomeControls();
            if (this.libraryReturnZone === "card")
              this.focusHomeCard(this.libraryReturnIndex);
            else this.focusHomeAction(this.libraryReturnIndex);
          }
        }, 0);
      },
      async openSearch() {
        if (this.phase === "discover") {
          discoverScope?.abort();
          ++discoverGeneration;
        }
        if (this.phase === "library") {
          libraryScope?.abort();
          ++libraryGeneration;
        }
        const generation = ++searchGeneration;
        searchScope?.abort();
        clearTimeout(searchTimer);
        const scope = api.createScope();
        searchScope = scope;
        this.railExpanded = false;
        this.railCurrent = "search";
        this.phase = "search";
        this.searchPlaceholder = "";
        this.searchQuery = "";
        this.searchCaretX = 218;
        this.searchRows = [];
        this.searchHeadings = [];
        searchCanonicalCards = [];
        searchCanonicalHeadings = [];
        searchCanonicalSections.clear();
        this.searchVisibleCards = [];
        this.searchSectionOffsets = {};
        this.searchVerticalOffset = 0;
        this.searchStatus = "";
        this.searchBusy = false;
        this.searchPartial = false;
        noteSearchState("", 0, false, false);
        this.searchKeyIndex = 0;
        this.searchResultIndex = 0;
        setTimeout(() => {
          if (this.phase !== "search") return;
          this.searchHeading = "Search";
          this.searchPlaceholder = "Search movies and series";
          this.searchCaretX = searchCaretPosition(this.searchPlaceholder);
          this.searchStatus = "Find your next favorite.";
          this.searchOkLabel = "OK";
          this.searchTypeLabel = "Type";
          this.searchJumpIcon = "▶▶";
          this.searchJumpLabel = "Jump to results";
          this.searchBackLabel = "BACK";
          this.searchDeleteLabel = "Delete";
          this.revealSearchKeys();
          this.focusSearchKey(0);
        }, 60);
        try {
          const catalogs = await api.catalogs({ signal: scope.signal });
          if (generation === searchGeneration && !scope.signal.aborted)
            this.searchCatalogs = catalogs;
        } catch (cause) {
          if (generation === searchGeneration && !scope.signal.aborted)
            this.searchStatus =
              cause instanceof Error
                ? cause.message
                : "Unable to load searchable catalogs.";
        }
      },
      revealSearchKeys() {
        for (let index = 0; index < searchKeys.length; index++)
          (
            this.$select("searchScreen")?.$select(
              `searchKey${index}`,
            ) as unknown as { reveal?: () => void }
          )?.reveal?.();
      },
      setSearchQuery(value: string) {
        const next = value.slice(0, 256);
        this.searchQuery = next;
        this.searchCaretX = searchCaretPosition(next || this.searchPlaceholder);
        const generation = ++searchGeneration;
        searchScope?.abort();
        clearTimeout(searchTimer);
        this.searchRows = [];
        this.searchHeadings = [];
        searchCanonicalCards = [];
        searchCanonicalHeadings = [];
        searchCanonicalSections.clear();
        this.searchVisibleCards = [];
        this.searchSectionOffsets = {};
        this.searchVerticalOffset = 0;
        this.searchPartial = false;
        this.searchBusy = false;
        this.searchStatus = next.trim() ? "" : "Find your next favorite.";
        noteSearchState(next, 0, false, false);
        if (next.trim())
          searchTimer = setTimeout(
            () => void this.runSearch(next.trim(), generation),
            650,
          );
      },
      async runSearch(query: string, generation: number) {
        const scope = api.createScope();
        searchScope = scope;
        this.searchBusy = true;
        this.searchStatus = "Searching…";
        noteSearchState(query, 0, true, false);
        const rows: SearchRow[] = [];
        let partial = false;
        try {
          const catalogs = this.searchCatalogs.length
            ? this.searchCatalogs
            : await api.catalogs({ signal: scope.signal });
          if (generation !== searchGeneration || scope.signal.aborted) return;
          this.searchCatalogs = catalogs;
          const searchable = catalogs
            .filter((catalog) => catalog.supportsSearch)
            .slice(0, 128);
          const completed = new Map<number, SearchRow>();
          const publish = (order: number, row: SearchRow) => {
            if (generation !== searchGeneration || scope.signal.aborted) return;
            completed.set(order, row);
            this.searchRows = [...completed.entries()].sort(([a], [b]) => a - b).map(([, result]) => result);
            this.refreshSearchLayout();
          };
          const live = api.live({ view: "us", search: query, limit: 80 }, { signal: scope.signal })
            .then(page => publish(searchable.length, { name: "Live TV", items: page.channels.slice(0, 24) }))
            .catch(() => { partial = true; });
          let next = 0;
          await Promise.all([live, ...Array.from({ length: Math.min(6, searchable.length) }, async () => {
            while (next < searchable.length && !scope.signal.aborted) {
              const order = next++;
              const catalog = searchable[order];
              try {
                const page = await api.discover({ type: catalog.type, catalog: catalog.id, addonId: catalog.addonId, search: query }, { signal: scope.signal });
                publish(order, { name: catalog.name, items: page.items.slice(0, 24), catalog });
              } catch { partial = true; }
            }
          })]);
          rows.push(...[...completed.entries()].sort(([a], [b]) => a - b).map(([, row]) => row));
          if (generation !== searchGeneration || scope.signal.aborted) return;
          this.searchRows = [...rows];
          this.searchPartial = partial;
          this.searchBusy = false;
          this.refreshSearchLayout();
          noteSearchState(
            query,
            searchCanonicalCards.length,
            false,
            partial,
            true,
          );
          this.searchStatus = this.searchHeadings.length
            ? partial
              ? "Some sources couldn't load."
              : ""
            : partial
              ? "No matching titles. Some sources couldn't load."
              : "No matching titles";
        } catch (cause) {
          if (generation !== searchGeneration || scope.signal.aborted) return;
          this.searchBusy = false;
          this.searchPartial = true;
          this.searchStatus =
            cause instanceof Error ? cause.message : "Search could not finish.";
          noteSearchState(
            query,
            searchCanonicalCards.length,
            false,
            true,
            true,
          );
        }
      },
      refreshSearchLayout() {
        const focusedId = this.searchFocusZone === "result" ? searchCanonicalCards[this.searchResultIndex]?.id : undefined;
        const view = projectSearch(
          this.searchRows,
          this.searchSectionOffsets,
          this.searchVerticalOffset,
        );
        searchCanonicalCards = view.cards;
        searchCanonicalHeadings = view.headings;
        searchCanonicalSections = new Map();
        for (const card of searchCanonicalCards) {
          const section = searchCanonicalSections.get(card.section) ?? [];
          section.push(card);
          searchCanonicalSections.set(card.section, section);
        }
        this.refreshSearchWindow();
        if (focusedId) {
          const index = searchCanonicalCards.findIndex(card => card.id === focusedId);
          if (index >= 0) this.focusSearchResult(index);
        }
      },
      refreshSearchWindow() {
        const view = projectSearchWindow(
          searchCanonicalHeadings,
          searchCanonicalSections,
          this.searchSectionOffsets,
          this.searchVerticalOffset,
        );
        this.searchHeadings = view.headings;
        this.searchVisibleCards = view.cards.map((card) => ({
          ...card,
          item: { ...card.item },
        }));
        setTimeout(() => {
          if (this.phase !== "search") return;
          for (const card of this.searchVisibleCards)
            (
              this.$select("searchScreen")?.$select(
                `searchCard${card.position}`,
              ) as unknown as { reveal?: () => void }
            )?.reveal?.();
        }, 40);
      },
      focusSearchKey(index: number) {
        this.searchFocusZone = "key";
        this.searchKeyIndex = index;
        this.searchLastKeyIndex = index;
        this.$select("searchScreen")?.$select(`searchKey${index}`)?.$focus();
      },
      moveSearchKey(direction: string) {
        const index = this.searchKeyIndex;
        if (
          direction === "right" &&
          ((index < 36 && index % 6 === 5) || index === 38) &&
          searchCanonicalCards.length
        ) {
          this.focusSearchResult(0);
          return;
        }
        if (
          direction === "left" &&
          ((index < 36 && index % 6 === 0) || index === 36)
        ) {
          this.openRail();
          return;
        }
        let next = index;
        if (index < 36) {
          if (direction === "left") next = Math.max(0, index - 1);
          else if (direction === "right") next = Math.min(35, index + 1);
          else if (direction === "up") next = Math.max(0, index - 6);
          else if (direction === "down")
            next = index >= 30 ? 36 + Math.floor((index % 6) / 2) : index + 6;
        } else {
          if (direction === "left") next = Math.max(36, index - 1);
          else if (direction === "right") next = Math.min(38, index + 1);
          else if (direction === "up") next = 30 + (index - 36) * 2;
        }
        this.focusSearchKey(next);
      },
      activateSearchKey() {
        const key = searchKeys[this.searchKeyIndex];
        if (!key) return;
        if (key.action === "character")
          this.setSearchQuery(this.searchQuery + key.label);
        else if (key.action === "space")
          this.setSearchQuery(this.searchQuery + " ");
        else if (key.action === "delete")
          this.setSearchQuery(this.searchQuery.slice(0, -1));
        else this.setSearchQuery("");
      },
      focusSearchResult(index: number) {
        const card = searchCanonicalCards[index];
        if (!card) return;
        this.searchFocusZone = "result";
        this.searchResultIndex = index;
        const start = this.searchSectionOffsets[card.section] ?? 0;
        let nextStart = start;
        if (card.localIndex < start) nextStart = card.localIndex;
        else if (card.localIndex >= start + 3) nextStart = card.localIndex - 2;
        const vertical =
          card.sectionIndex > 1 ? (card.sectionIndex - 1) * 360 : 0;
        const changed =
          nextStart !== start || vertical !== this.searchVerticalOffset;
        if (changed) {
          this.searchSectionOffsets = {
            ...this.searchSectionOffsets,
            [card.section]: nextStart,
          };
          this.searchVerticalOffset = vertical;
          this.refreshSearchWindow();
        }
        const focusWhenReady = (attempt: number) => {
          if (
            this.phase !== "search" ||
            this.titleMenuOpen ||
            this.searchFocusZone !== "result" ||
            this.searchResultIndex !== index
          )
            return;
          const target = this.$select("searchScreen")?.$select(
            `searchCard${index}`,
          ) as unknown as
            | { $focus?: () => void; focused?: boolean }
            | undefined;
          target?.$focus?.();
          if (attempt >= 18) return;
          setTimeout(() => {
            const current = this.$select("searchScreen")?.$select(
              `searchCard${index}`,
            ) as unknown as { focused?: boolean } | undefined;
            if (!current?.focused) focusWhenReady(attempt + 1);
          }, 50);
        };
        if (changed) setTimeout(() => focusWhenReady(0), 40);
        else focusWhenReady(0);
      },
      moveSearchResult(direction: string) {
        const current = searchCanonicalCards[this.searchResultIndex];
        if (!current) return;
        if (direction === "left" && current.localIndex === 0) {
          this.focusSearchKey(this.searchLastKeyIndex);
          return;
        }
        let next = -1;
        if (direction === "left" || direction === "right")
          next = searchCanonicalCards.findIndex(
            (card) =>
              card.section === current.section &&
              card.localIndex ===
                current.localIndex + (direction === "left" ? -1 : 1),
          );
        else {
          const targetSection =
            current.sectionIndex + (direction === "up" ? -1 : 1);
          const candidates = searchCanonicalCards
            .map((card, index) => ({ card, index }))
            .filter((entry) => entry.card.sectionIndex === targetSection);
          next =
            candidates[Math.min(current.localIndex, candidates.length - 1)]
              ?.index ?? -1;
        }
        if (next >= 0) this.focusSearchResult(next);
      },
      activateSearchResult() {
        const card = searchCanonicalCards[this.searchResultIndex];
        if (!card) return;
        if (card.item.type === "live") void this.openSources(card.item, false);
        else void this.openDetail(card.item);
      },
      backFromSearch() {
        if (this.searchFocusZone === "key" && this.searchQuery)
          this.setSearchQuery(this.searchQuery.slice(0, -1));
        else this.returnFromSearch();
      },
      returnFromSearch() {
        searchScope?.abort();
        ++searchGeneration;
        clearTimeout(searchTimer);
        liveScope?.abort();
        ++liveGeneration;
        clearInterval(liveClockTimer);
        settingsScope?.abort();
        ++settingsGeneration;
        this.railExpanded = false;
        this.phase = this.searchReturnPhase;
        this.railCurrent = this.searchReturnPhase;
        setTimeout(() => {
          if (this.phase === "discover") {
            this.revealDiscoverChips();
            this.refreshDiscoverCards();
            if (this.searchReturnZone === "chip")
              this.focusDiscoverChip(this.searchReturnIndex);
            else this.focusDiscoverCard(this.searchReturnIndex);
          } else if (this.phase === "library") {
            this.revealLibrarySegments();
            this.refreshLibraryCards();
            if (this.searchReturnZone === "segment")
              this.focusLibrarySegment(this.searchReturnIndex);
            else this.focusLibraryCard(this.searchReturnIndex);
          } else {
            this.revealHomeControls();
            if (this.searchReturnZone === "card")
              this.focusHomeCard(this.searchReturnIndex);
            else this.focusHomeAction(this.searchReturnIndex);
          }
        }, 0);
      },
      async openLive() {
        if (this.phase === "discover") {
          discoverScope?.abort();
          ++discoverGeneration;
        }
        if (this.phase === "library") {
          libraryScope?.abort();
          ++libraryGeneration;
        }
        if (this.phase === "search") {
          searchScope?.abort();
          ++searchGeneration;
          clearTimeout(searchTimer);
        }
        const generation = ++liveGeneration;
        liveScope?.abort();
        clearInterval(liveClockTimer);
        const scope = api.createScope();
        liveScope = scope;
        this.railExpanded = false;
        this.railCurrent = "live";
        this.phase = "live";
        this.liveChrome = {
          ...this.liveChrome,
          homeProfileAvatar: this.homeProfileAvatar,
        };
        this.liveDetailsOpen = false;
        this.liveSearchOpen = false;
        liveSearchCanonicalQuery = "";
        this.liveSearchUppercase = false;
        this.liveNow = Date.now() / 1000;
        this.liveWindowStart = halfHour();
        this.liveFollowing = true;
        this.liveSelectedRow = 0;
        this.liveSelectedCellIndex = null;
        this.liveFocusZone = "channel";
        this.liveFilterId = "all";
        this.liveFilterIndex = 1;
        this.liveOffset = 0;
        liveCanonicalChannels = [];
        this.liveGuides = {};
        this.liveStatus = "Loading channels…";
        this.refreshLiveView();
        setTimeout(() => {
          if (this.phase !== "live") return;
          this.liveLabel = "LIVE";
          this.livePreviewLabel = "Live preview";
          this.liveOkLabel = "OK";
          this.liveWatchLabel = "Watch";
          this.liveOptionsIcon = "≡";
          this.liveDetailsLabel = "Details";
          this.liveChannelIcon = "▲ ▼";
          this.liveChannelsLabel = "Channels";
          this.liveTimeIcon = "◀ ▶";
          this.liveTimeLabel = "Time";
          this.revealLiveControls();
        }, 40);
        const [categoriesResult, channelsResult] = await Promise.allSettled([
          api.liveCategories("us", { signal: scope.signal }),
          api.live(
            { view: "us", offset: 0, limit: 40 },
            { signal: scope.signal },
          ),
        ]);
        if (generation !== liveGeneration || scope.signal.aborted) return;
        if (categoriesResult.status === "fulfilled")
          this.liveCategories = [...categoriesResult.value.categories];
        liveCanonicalFilters = liveFilters(this.liveCategories, "all");
        this.liveFilters = liveCanonicalFilters.map((filter) => ({
          ...filter,
        }));
        if (channelsResult.status === "fulfilled") {
          liveCanonicalChannels = channelsResult.value.channels.map(
            (channel) => ({ ...channel }),
          );
          this.liveTotal = channelsResult.value.total;
          this.liveStatus = liveCanonicalChannels.length
            ? ""
            : "No channels here yet. Choose another filter.";
          this.refreshLiveView();
          setTimeout(() => {
            if (
              generation === liveGeneration &&
              this.phase === "live" &&
              liveCanonicalChannels.length
            )
              this.focusLiveChannel(0);
          }, 0);
          // focusLiveChannel starts guide fetching. Do not start a duplicate
          // batch here when focus is now available on the next task.
        } else {
          this.liveStatus =
            channelsResult.reason instanceof Error
              ? channelsResult.reason.message
              : "Unable to load channels.";
          this.refreshLiveView();
        }
        liveClockTimer = setInterval(() => {
          if (this.phase !== "live") return;
          this.liveNow = Date.now() / 1000;
          if (this.liveFollowing) this.liveWindowStart = halfHour();
          this.refreshLiveView();
        }, 30_000);
      },
      async loadLiveGuides(
        generation: number,
        scope: ReturnType<TvApi["createScope"]>,
      ) {
        const first = Math.max(0, this.liveSelectedRow - 3);
        const needed = liveCanonicalChannels
          .slice(first, first + 7)
          .filter((channel) => !this.liveGuides[channel.id]);
        const gathered: Record<string, Guide> = {};
        let cursor = 0;
        const worker = async () => {
          while (cursor < needed.length && !scope.signal.aborted) {
            const channel = needed[cursor++];
            try {
              const guide = await api.guide(channel.id, {
                signal: scope.signal,
              });
              if (generation !== liveGeneration || scope.signal.aborted) return;
              gathered[channel.id] = guide;
            } catch {
              /* A channel still has an actionable no-guide block. */
            }
          }
        };
        await Promise.all(
          Array.from({ length: Math.min(3, needed.length) }, worker),
        );
        if (
          generation === liveGeneration &&
          !scope.signal.aborted &&
          Object.keys(gathered).length
        ) {
          this.liveGuides = { ...this.liveGuides, ...gathered };
          this.refreshLiveView();
        }
      },
      refreshLiveView() {
        const view = projectLiveGuide(
          liveCanonicalChannels,
          this.liveGuides,
          this.liveNow,
          this.liveWindowStart,
          this.liveSelectedRow,
          this.liveSelectedCellIndex,
          this.liveOffset,
        );
        liveCanonicalRows = view.channels;
        liveCanonicalPrograms = view.programs;
        this.liveRows = view.channels.map((row) => ({
          ...row,
          channel: { ...row.channel },
        }));
        this.livePrograms = view.programs.map((block) => ({
          ...block,
          channel: { ...block.channel },
        }));
        this.liveTimeline = view.timeline;
        this.liveHero = view.hero;
        this.liveNowX = view.nowX;
        this.liveNowLabel = view.nowLabel;
        liveCanonicalFilters = liveFilters(
          this.liveCategories,
          this.liveFilterId,
        );
        this.liveFilters = liveCanonicalFilters.map((filter) => ({
          ...filter,
        }));
        noteLiveState(
          this.liveSelectedRow,
          this.liveSelectedCellIndex,
          liveCanonicalChannels.length,
          liveCanonicalPrograms.length,
          this.liveFilterId,
          this.liveWindowStart,
          this.liveNowX,
        );
        setTimeout(() => {
          if (this.phase === "live") this.revealLiveControls();
        }, 0);
      },
      revealLiveControls() {
        const screen = this.$select("liveScreen");
        for (let index = 0; index < liveCanonicalFilters.length; index++)
          (
            screen?.$select(
              `liveFilter${liveCanonicalFilters[index].id}`,
            ) as unknown as { reveal?: () => void }
          )?.reveal?.();
        for (let index = 0; index < liveCanonicalRows.length; index++)
          (
            screen?.$select(
              `liveChannel${liveCanonicalRows[index].channel.id}`,
            ) as unknown as { reveal?: () => void }
          )?.reveal?.();
        for (let index = 0; index < liveCanonicalPrograms.length; index++)
          (
            screen?.$select(
              `liveProgram${liveCanonicalPrograms[index].id}`,
            ) as unknown as { reveal?: () => void }
          )?.reveal?.();
      },
      focusLiveFilter(index: number) {
        ++liveFocusGeneration;
        this.liveFocusZone = "filter";
        this.liveFilterIndex = index;
        const filter = liveCanonicalFilters[index];
        if (!filter) return;
        const focusWhenReady = (attempt: number) => {
          if (
            this.phase !== "live" ||
            this.liveDetailsOpen ||
            this.liveFocusZone !== "filter" ||
            this.liveFilterIndex !== index
          )
            return;
          const target = this.$select("liveScreen")?.$select(
            `liveFilter${filter.id}`,
          ) as unknown as { $focus?: () => void } | undefined;
          if (target) {
            target.$focus?.();
            return;
          }
          if (attempt < 12) setTimeout(() => focusWhenReady(attempt + 1), 50);
        };
        focusWhenReady(0);
      },
      moveLiveFilter(delta: number) {
        if (delta < 0 && this.liveFilterIndex === 0) {
          this.openRail();
          return;
        }
        this.focusLiveFilter(
          Math.max(
            0,
            Math.min(
              liveCanonicalFilters.length - 1,
              this.liveFilterIndex + delta,
            ),
          ),
        );
      },
      async activateLiveFilter() {
        const filter = liveCanonicalFilters[this.liveFilterIndex];
        if (!filter) return;
        if (filter.id === "search") {
          this.openLiveSearch();
          return;
        }
        if (filter.id === this.liveFilterId) return;
        void this.loadLiveFilter(filter.id);
      },
      openLiveSearch() {
        this.liveSearchOpen = true;
        this.liveSearchKeyIndex = 0;
        if (liveSearchPhysicalListener)
          window.removeEventListener(
            "keydown",
            liveSearchPhysicalListener,
            true,
          );
        liveSearchPhysicalListener = (event: KeyboardEvent) => {
          if (!this.liveSearchOpen) return;
          if (event.key.length === 1 && /^[a-z0-9 :/._@-]$/i.test(event.key))
            this.setLiveSearchQuery(liveSearchCanonicalQuery + event.key);
          else if (event.key === "Backspace")
            this.setLiveSearchQuery(liveSearchCanonicalQuery.slice(0, -1));
          else return;
          event.preventDefault();
          event.stopImmediatePropagation();
        };
        window.addEventListener("keydown", liveSearchPhysicalListener, true);
        setTimeout(() => {
          if (!this.liveSearchOpen) return;
          const screen = this.$select("liveSearchScreen") as unknown as
            | { reveal?: () => void; setQuery?: (query: string) => void }
            | undefined;
          screen?.reveal?.();
          screen?.setQuery?.(liveSearchCanonicalQuery);
          for (const key of liveSearchKeys)
            (
              this.$select("liveSearchScreen")?.$select(
                `liveSearchKey${key.id}`,
              ) as unknown as { reveal?: () => void }
            )?.reveal?.();
          this.focusLiveSearchKey(0);
        }, 60);
      },
      closeLiveSearch() {
        if (!this.liveSearchOpen) return;
        this.stopLiveSearchInput();
        this.liveSearchOpen = false;
        setTimeout(() => {
          if (this.phase === "live" && !this.liveSearchOpen)
            this.focusLiveFilter(0);
        }, 40);
      },
      stopLiveSearchInput() {
        if (liveSearchPhysicalListener)
          window.removeEventListener(
            "keydown",
            liveSearchPhysicalListener,
            true,
          );
        liveSearchPhysicalListener = null;
      },
      setLiveSearchQuery(value: string) {
        liveSearchCanonicalQuery = value.slice(0, 128);
        (
          this.$select("liveSearchScreen") as unknown as {
            setQuery?: (query: string) => void;
          }
        )?.setQuery?.(liveSearchCanonicalQuery);
        setTimeout(() => {
          if (this.liveSearchOpen)
            this.focusLiveSearchKey(this.liveSearchKeyIndex);
        }, 0);
      },
      focusLiveSearchKey(index: number) {
        const key = liveSearchKeys[index];
        if (!key) return;
        this.liveSearchKeyIndex = index;
        const target = this.$select("liveSearchScreen")?.$select(
          `liveSearchKey${key.id}`,
        ) as unknown as
          | { $focus?: () => void; restoreFocus?: () => void }
          | undefined;
        target?.$focus?.();
        target?.restoreFocus?.();
      },
      moveLiveSearchKey(direction: string) {
        const key = liveSearchKeys[this.liveSearchKeyIndex];
        if (!key) return;
        const row = liveSearchKeys.filter((candidate) => candidate.y === key.y);
        const local = row.findIndex((candidate) => candidate.id === key.id);
        if (direction === "left" || direction === "right") {
          const target =
            row[
              Math.max(
                0,
                Math.min(
                  row.length - 1,
                  local + (direction === "left" ? -1 : 1),
                ),
              )
            ];
          this.focusLiveSearchKey(
            liveSearchKeys.findIndex((candidate) => candidate.id === target.id),
          );
        } else {
          const y = [...new Set(liveSearchKeys.map((candidate) => candidate.y))]
            .filter((candidate) =>
              direction === "up" ? candidate < key.y : candidate > key.y,
            )
            .sort((a, b) => Math.abs(a - key.y) - Math.abs(b - key.y))[0];
          const other = liveSearchKeys.filter((candidate) => candidate.y === y);
          if (!other.length) return;
          const center = key.x + key.width / 2;
          const target = other.reduce((best, candidate) =>
            Math.abs(candidate.x + candidate.width / 2 - center) <
            Math.abs(best.x + best.width / 2 - center)
              ? candidate
              : best,
          );
          this.focusLiveSearchKey(
            liveSearchKeys.findIndex((candidate) => candidate.id === target.id),
          );
        }
      },
      activateLiveSearchKey() {
        const key = liveSearchKeys[this.liveSearchKeyIndex];
        if (!key) return;
        if (key.action === "cancel") {
          this.closeLiveSearch();
          return;
        }
        if (key.action === "done") {
          this.stopLiveSearchInput();
          this.liveSearchOpen = false;
          void this.loadLiveFilter(this.liveFilterId, 0, 0);
          return;
        }
        if (key.action === "delete") {
          this.setLiveSearchQuery(liveSearchCanonicalQuery.slice(0, -1));
          return;
        }
        if (key.action === "space") {
          this.setLiveSearchQuery(liveSearchCanonicalQuery + " ");
          return;
        }
        if (key.action === "case") {
          this.liveSearchUppercase = !this.liveSearchUppercase;
          this.liveSearchView = {
            keys: liveSearchKeys.map((entry) => ({
              ...entry,
              label:
                this.liveSearchUppercase && entry.action === "character"
                  ? entry.label.toUpperCase()
                  : entry.label,
            })),
          };
          setTimeout(() => {
            for (const entry of liveSearchKeys)
              (
                this.$select("liveSearchScreen")?.$select(
                  `liveSearchKey${entry.id}`,
                ) as unknown as { reveal?: () => void }
              )?.reveal?.();
            this.focusLiveSearchKey(this.liveSearchKeyIndex);
          }, 30);
          return;
        }
        this.setLiveSearchQuery(
          liveSearchCanonicalQuery +
            (this.liveSearchUppercase ? key.label.toUpperCase() : key.label),
        );
      },
      async loadLiveFilter(filterId: string, offset = 0, focusRow = 0) {
        const generation = ++liveGeneration;
        liveScope?.abort();
        const scope = api.createScope();
        liveScope = scope;
        this.liveFilterId = filterId;
        this.liveSelectedRow = focusRow;
        this.liveSelectedCellIndex = null;
        this.liveOffset = offset;
        liveCanonicalChannels = [];
        this.liveGuides = {};
        this.liveStatus = "Loading channels…";
        this.refreshLiveView();
        const collection =
          filterId === "favorites" || filterId === "recent"
            ? filterId
            : undefined;
        const category = filterId.startsWith("category:")
          ? filterId.slice(9)
          : undefined;
        try {
          const page = await api.live(
            {
              view: "us",
              collection,
              category,
              search: liveSearchCanonicalQuery.trim() || undefined,
              offset,
              limit: PAGE_SIZE,
            },
            { signal: scope.signal },
          );
          if (generation !== liveGeneration || scope.signal.aborted) return;
          liveCanonicalChannels = page.channels.map((channel) => ({
            ...channel,
          }));
          this.liveSelectedRow = Math.max(
            0,
            Math.min(focusRow, liveCanonicalChannels.length - 1),
          );
          this.liveTotal = page.total;
          this.liveStatus = page.channels.length
            ? ""
            : "No channels here yet. Choose another filter.";
          this.refreshLiveView();
          setTimeout(() => {
            if (generation !== liveGeneration || this.phase !== "live") return;
            if (liveCanonicalChannels.length)
              this.focusLiveChannel(this.liveSelectedRow);
            else this.focusLiveFilter(this.liveFilterIndex);
          }, 60);
          void this.loadLiveGuides(generation, scope);
        } catch (cause) {
          if (generation !== liveGeneration || scope.signal.aborted) return;
          this.liveStatus =
            cause instanceof Error ? cause.message : "Unable to load channels.";
          this.refreshLiveView();
        }
      },
      focusLiveChannel(row: number) {
        if (!liveCanonicalChannels[row]) return;
        ++liveFocusGeneration;
        const previous = liveCanonicalRows.findIndex(
          (value) => value.row === row,
        );
        this.liveSelectedRow = row;
        this.liveSelectedCellIndex = null;
        this.liveFocusZone = "channel";
        if (previous < 0) this.refreshLiveView();
        const visible = liveCanonicalRows.find((value) => value.row === row);
        if (!visible) return;
        const focus = () =>
          this.$select("liveScreen")
            ?.$select(`liveChannel${visible.channel.id}`)
            ?.$focus();
        if (previous < 0) setTimeout(focus, 50);
        else focus();
        void this.loadLiveGuides(liveGeneration, liveScope!);
      },
      moveLiveChannel(delta: number) {
        const next = this.liveSelectedRow + delta;
        if (next < 0) {
          if (this.liveOffset > 0)
            void this.loadLiveFilter(
              this.liveFilterId,
              Math.max(0, this.liveOffset - PAGE_SIZE),
              PAGE_SIZE - 1,
            );
          else this.focusLiveFilter(this.liveFilterIndex);
          return;
        }
        if (next < liveCanonicalChannels.length) this.focusLiveChannel(next);
        else if (
          this.liveOffset + liveCanonicalChannels.length <
          this.liveTotal
        )
          void this.loadLiveFilter(
            this.liveFilterId,
            this.liveOffset + PAGE_SIZE,
            0,
          );
      },
      enterLiveProgram(row: number) {
        const current = liveCanonicalPrograms.findIndex(
          (block) =>
            block.row === row &&
            block.cell.start <= this.liveNow &&
            block.cell.end > this.liveNow,
        );
        const index =
          current >= 0
            ? current
            : liveCanonicalPrograms.findIndex((block) => block.row === row);
        if (index >= 0) this.focusLiveProgram(index);
      },
      focusLiveProgram(position: number) {
        const block = liveCanonicalPrograms[position];
        if (!block) return;
        ++liveFocusGeneration;
        this.liveFocusZone = "program";
        this.liveProgramPosition = position;
        this.$select("liveScreen")?.$select(`liveProgram${block.id}`)?.$focus();
      },
      focusedLiveProgramPosition() {
        return liveCanonicalPrograms.findIndex(
          (block) =>
            block.row === this.liveSelectedRow &&
            block.index === this.liveSelectedCellIndex,
        );
      },
      moveLiveProgram(_position: number, direction: string) {
        // SolidTV may reuse a focused For child after its row reprojects, leaving
        // its positional prop stale. The focused row/cell identity is current.
        const block = liveCanonicalPrograms[this.focusedLiveProgramPosition()];
        if (!block) return;
        if (direction === "left" && block.index === 0) {
          if (!this.moveLiveWindow(-1, block.row, this.liveWindowStart - 1))
            this.focusLiveChannel(block.row);
          return;
        }
        if (direction === "left" || direction === "right") {
          const next = liveCanonicalPrograms.findIndex(
            (candidate) =>
              candidate.row === block.row &&
              candidate.index === block.index + (direction === "left" ? -1 : 1),
          );
          if (next >= 0) this.focusLiveProgram(next);
          else if (direction === "right")
            this.moveLiveWindow(
              1,
              block.row,
              Math.min(
                halfHour() + DAY_SECONDS + WINDOW_SECONDS - 1,
                this.liveWindowStart + HOUR_SECONDS,
              ),
            );
          return;
        }
        const row = block.row + (direction === "up" ? -1 : 1);
        if (row < 0) {
          if (this.liveOffset > 0)
            void this.loadLiveFilter(
              this.liveFilterId,
              Math.max(0, this.liveOffset - PAGE_SIZE),
              PAGE_SIZE - 1,
            );
          else this.focusLiveFilter(this.liveFilterIndex);
          return;
        }
        if (!liveCanonicalChannels[row]) {
          if (
            direction === "down" &&
            this.liveOffset + liveCanonicalChannels.length < this.liveTotal
          )
            void this.loadLiveFilter(
              this.liveFilterId,
              this.liveOffset + PAGE_SIZE,
              0,
            );
          return;
        }
        const at = Math.max(this.liveNow, block.cell.start);
        this.liveSelectedRow = row;
        this.refreshLiveView();
        const transition = ++liveFocusGeneration;
        setTimeout(() => {
          if (
            transition !== liveFocusGeneration ||
            this.liveFocusZone !== "program"
          )
            return;
          const next = liveCanonicalPrograms.findIndex(
            (candidate) =>
              candidate.row === row &&
              candidate.cell.start <= at &&
              candidate.cell.end > at,
          );
          if (next >= 0) this.focusLiveProgram(next);
          else this.focusLiveChannel(row);
        }, 40);
        void this.loadLiveGuides(liveGeneration, liveScope!);
      },
      moveLiveWindow(direction: -1 | 1, row: number, focusAt: number) {
        const minimum = halfHour();
        const next = Math.max(
          minimum,
          Math.min(
            minimum + DAY_SECONDS,
            this.liveWindowStart + direction * HOUR_SECONDS,
          ),
        );
        if (next === this.liveWindowStart) return false;
        this.liveFollowing = false;
        this.liveWindowStart = next;
        this.refreshLiveView();
        const transition = ++liveFocusGeneration;
        setTimeout(() => {
          if (
            this.phase !== "live" ||
            transition !== liveFocusGeneration ||
            this.liveFocusZone !== "program"
          )
            return;
          const target = liveCanonicalPrograms.findIndex(
            (candidate) =>
              candidate.row === row &&
              candidate.cell.start <= focusAt &&
              candidate.cell.end > focusAt,
          );
          if (target >= 0) this.focusLiveProgram(target);
          else this.focusLiveChannel(row);
        }, 50);
        return true;
      },
      activateLiveProgram(position: number) {
        const block = liveCanonicalPrograms[position];
        if (!block) return;
        if (block.cell.start > this.liveNow)
          this.openLiveDetailsForProgram(position);
        else this.watchLiveChannel(block.row);
      },
      watchLiveChannel(row: number) {
        const channel = liveCanonicalChannels[row];
        if (channel) void this.openSources(channel, false);
      },
      openLiveDetailsForChannel(row: number) {
        const block = liveCanonicalPrograms.findIndex(
          (candidate) => candidate.row === row && candidate.airing,
        );
        if (block >= 0) this.openLiveDetailsForProgram(block);
        else if (liveCanonicalChannels[row])
          this.openLiveDetails(
            liveCanonicalChannels[row],
            undefined,
            "channel",
            row,
          );
      },
      openLiveDetailsForProgram(position: number) {
        const block = liveCanonicalPrograms[position];
        if (block)
          this.openLiveDetails(
            block.channel,
            block.program,
            "program",
            position,
          );
      },
      openLiveDetails(
        channel: MediaItem,
        program: Guide["programs"][number] | undefined,
        returnZone: "program" | "channel",
        index: number,
      ) {
        if (this.phase !== "live") return;
        const zone = guideZone(this.liveGuides[channel.id]?.timezone);
        this.liveDetailsChannelItem = channel;
        this.liveDetailsReturnZone = returnZone;
        this.liveDetailsReturnIndex = index;
        this.liveDetailsTitle = "";
        this.liveDetailsChannel = "";
        this.liveDetailsRange = "";
        this.liveDetailsDescription = "";
        this.liveDetailsOpen = true;
        setTimeout(() => {
          if (!this.liveDetailsOpen) return;
          this.liveDetailsTitle = program?.title || "Programme details";
          this.liveDetailsChannel = channel.name;
          this.liveDetailsRange = program
            ? `·  ${timeRange(program.start, program.end, zone)}`
            : "";
          this.liveDetailsDescription =
            program?.description ||
            "No guide information. You can still watch this channel.";
          this.liveDetailsWatchLabel = "Watch channel now";
          this.liveDetailsCloseLabel = "Close";
          this.liveDetailsOkLabel = "OK";
          this.liveDetailsSelectLabel = "Select";
          this.liveDetailsBackLabel = "BACK";
          for (let slot = 0; slot < 2; slot++)
            (
              this.$select("liveDetailsScreen")?.$select(
                `liveDetailsOption${slot}`,
              ) as unknown as { reveal?: () => void }
            )?.reveal?.();
          this.focusLiveDetailsOption(0);
        }, 50);
      },
      focusLiveDetailsOption(index: number) {
        this.liveDetailsOptionIndex = index;
        this.$select("liveDetailsScreen")
          ?.$select(`liveDetailsOption${index}`)
          ?.$focus();
      },
      closeLiveDetails(restore = true) {
        if (!this.liveDetailsOpen) return;
        this.liveDetailsOpen = false;
        if (!restore) return;
        const index = this.liveDetailsReturnIndex;
        const zone = this.liveDetailsReturnZone;
        setTimeout(() => {
          if (this.phase !== "live" || this.liveDetailsOpen) return;
          if (zone === "program") this.focusLiveProgram(index);
          else this.focusLiveChannel(index);
        }, 40);
      },
      activateLiveDetails() {
        if (!this.liveDetailsOpen) return;
        if (this.liveDetailsOptionIndex === 1) {
          this.closeLiveDetails();
          return;
        }
        const row =
          this.liveDetailsReturnZone === "program"
            ? (liveCanonicalPrograms[this.liveDetailsReturnIndex]?.row ??
              this.liveSelectedRow)
            : this.liveDetailsReturnIndex;
        this.closeLiveDetails(false);
        this.watchLiveChannel(row);
      },
      returnFromLive() {
        liveScope?.abort();
        ++liveGeneration;
        clearInterval(liveClockTimer);
        this.stopLiveSearchInput();
        this.liveDetailsOpen = false;
        this.liveSearchOpen = false;
        this.railExpanded = false;
        this.phase = this.liveReturnPhase;
        this.railCurrent = this.liveReturnPhase;
        setTimeout(() => {
          if (this.phase === "discover") {
            this.revealDiscoverChips();
            this.refreshDiscoverCards();
            if (this.liveReturnZone === "chip")
              this.focusDiscoverChip(this.liveReturnIndex);
            else this.focusDiscoverCard(this.liveReturnIndex);
          } else if (this.phase === "library") {
            this.revealLibrarySegments();
            this.refreshLibraryCards();
            if (this.liveReturnZone === "segment")
              this.focusLibrarySegment(this.liveReturnIndex);
            else this.focusLibraryCard(this.liveReturnIndex);
          } else if (this.phase === "search") {
            this.refreshSearchWindow();
            if (this.liveReturnZone === "result")
              this.focusSearchResult(this.liveReturnIndex);
            else this.focusSearchKey(this.liveReturnIndex);
          } else {
            this.revealHomeControls();
            if (this.liveReturnZone === "card")
              this.focusHomeCard(this.liveReturnIndex);
            else this.focusHomeAction(this.liveReturnIndex);
          }
        }, 0);
      },
      async openSettings() {
        const generation = ++settingsGeneration;
        settingsScope?.abort();
        const scope = api.createScope();
        settingsScope = scope;
        this.railExpanded = false;
        this.railCurrent = "settings";
        this.phase = "settings";
        this.settingsPage = "Settings";
        this.settingsSelectedIndex = 0;
        this.settingsFocusZone = "row";
        this.settingsDialogOpen = false;
        this.settingsPrefs = defaultSettingsPreferences;
        this.settingsAddons = [];
        this.refreshSettingsView();
        setTimeout(() => {
          if (this.phase !== "settings" || generation !== settingsGeneration)
            return;
          this.refreshSettingsView();
          this.revealSettingsControls();
          this.focusSettingsRow(0);
        }, 70);
        const [preferences, addons] = await Promise.allSettled([
          api.preferences(this.currentProfileId, { signal: scope.signal }),
          api.addons({ signal: scope.signal }),
        ]);
        if (
          generation !== settingsGeneration ||
          scope.signal.aborted ||
          this.phase !== "settings"
        )
          return;
        if (preferences.status === "fulfilled")
          this.settingsPrefs = preferences.value;
        if (addons.status === "fulfilled")
          this.settingsAddons = [...addons.value];
        this.refreshSettingsView();
      },
      refreshSettingsView() {
        settingsCanonicalRows = settingsRows(
          this.settingsPage,
          this.settingsPrefs,
          this.settingsAddons,
          api.serverOrigin,
          packageInfo.version,
        );
        const rows = Array.from({ length: 6 }, (_, index) =>
          settingsCanonicalRows[index]
            ? { ...settingsCanonicalRows[index] }
            : { ...emptySettingsRow },
        );
        const profiles = settingsProfiles(this.profiles, this.currentProfileId);
        this.settingsRowsCount = Math.min(6, settingsCanonicalRows.length);
        this.settingsView = {
          page: this.settingsPage,
          rows,
          profiles: Array.from({ length: 4 }, (_, index) =>
            profiles[index]
              ? { ...profiles[index] }
              : { ...emptySettingsProfile },
          ),
          showProfiles:
            this.settingsPage === "Settings" &&
            this.settingsSelectedIndex === 0,
          avatar: this.homeProfileAvatar,
          railSearch: this.railSearch,
          railHome: this.railHomeUnselected,
          railDiscover: this.railDiscover,
          railLive: this.railLive,
          railList: this.railList,
          railSettings: railIcon("settings", true),
          version: `VIPTV ${packageInfo.version}`,
        };
        this.refreshSettingsPanel();
        setTimeout(() => {
          if (this.phase === "settings") this.revealSettingsControls();
        }, 50);
      },
      refreshSettingsPanel() {
        const row = settingsCanonicalRows[this.settingsSelectedIndex];
        if (!row) return;
        this.settingsPanel = {
          title: row.title,
          description: row.description,
          caption:
            this.settingsPage === "Playback preferences"
              ? "Applies to your next playback. Manual track choices take priority."
              : this.settingsPage === "Addons"
                ? "Shared by all profiles and devices on your account."
                : "",
        };
        const showProfiles =
          this.settingsPage === "Settings" && this.settingsSelectedIndex === 0;
        if (this.settingsView.showProfiles !== showProfiles)
          this.settingsView = { ...this.settingsView, showProfiles };
      },
      revealSettingsControls() {
        const screen = this.$select("settingsScreen");
        (screen as unknown as { reveal?: () => void })?.reveal?.();
        for (let index = 0; index < this.settingsRowsCount; index++)
          (
            screen?.$select(`settingsRow${index}`) as unknown as {
              reveal?: () => void;
            }
          )?.reveal?.();
        for (let index = 0; index < Math.min(4, this.profiles.length); index++)
          (
            screen?.$select(`settingsProfile${index}`) as unknown as {
              reveal?: () => void;
            }
          )?.reveal?.();
      },
      focusSettingsRow(index: number) {
        if (!settingsCanonicalRows[index]) return;
        this.settingsSelectedIndex = index;
        this.settingsFocusZone = "row";
        this.refreshSettingsPanel();
        this.$select("settingsScreen")
          ?.$select(`settingsRow${index}`)
          ?.$focus();
      },
      moveSettingsRow(delta: number) {
        const next = Math.max(
          0,
          Math.min(
            this.settingsRowsCount - 1,
            this.settingsSelectedIndex + delta,
          ),
        );
        this.focusSettingsRow(next);
      },
      focusSettingsProfile(index: number) {
        if (!this.profiles[index]) return;
        this.settingsProfileIndex = index;
        this.settingsFocusZone = "profile";
        this.$select("settingsScreen")
          ?.$select(`settingsProfile${index}`)
          ?.$focus();
      },
      moveSettingsProfile(delta: number) {
        const next = this.settingsProfileIndex + delta;
        if (next < 0) this.focusSettingsRow(0);
        else if (next < Math.min(4, this.profiles.length))
          this.focusSettingsProfile(next);
      },
      async activateSettingsProfile() {
        const profile = this.profiles[this.settingsProfileIndex];
        if (!profile) return;
        try {
          await api.selectProfile(profile.id);
          void this.loadHome(profile.id);
        } catch (cause) {
          this.settingsPanel = {
            ...this.settingsPanel,
            description:
              cause instanceof Error
                ? cause.message
                : "Could not open this profile.",
          };
        }
      },
      async activateSettingsRow() {
        const row = settingsCanonicalRows[this.settingsSelectedIndex];
        if (!row) return;
        if (this.settingsPage === "Settings") {
          if (row.id === "settings-profiles") {
            this.showProfiles(this.profiles);
            return;
          }
          if (row.id === "settings-manage") {
            this.showProfiles(this.profiles);
            this.toggleManageProfiles();
            return;
          }
          if (row.id === "settings-playback" || row.id === "settings-addons") {
            this.settingsPage =
              row.id === "settings-playback"
                ? "Playback preferences"
                : "Addons";
            this.settingsSelectedIndex = 0;
            this.refreshSettingsView();
            setTimeout(() => this.focusSettingsRow(0), 60);
            return;
          }
          if (row.id === "signout") this.openSettingsSignOut();
          return;
        }
        if (this.settingsPage === "Playback preferences") {
          const choice = settingsChoices(row.id, this.settingsPrefs);
          if (choice)
            this.openSettingsChoice(row.title, choice.key, choice.options);
        } else if (row.id === "addon-add") {
          this.settingsPanel = {
            ...this.settingsPanel,
            description:
              "Install addon text entry is not available in this preview yet.",
          };
        } else {
          const addon = this.settingsAddons[this.settingsSelectedIndex - 1];
          if (addon) this.openSettingsAddonManage(addon);
        }
      },
      openSettingsAddonManage(addon: JsonObject) {
        this.settingsDialogAddon = addon;
        this.settingsDialogKind = "addonManage";
        settingsCanonicalChoices = [
          {
            label: addon.enabled === false ? "Enable" : "Disable",
            value: "toggle",
            current: false,
            visible: true,
          },
          {
            label: "Remove addon",
            value: "remove-addon",
            current: false,
            visible: true,
          },
          {
            label: "Cancel",
            value: "__cancel__",
            current: false,
            visible: true,
          },
        ];
        this.settingsChoiceIndex = 0;
        this.settingsDialogOpen = true;
        this.refreshSettingsDialog(`Manage ${String(addon.name ?? "Addon")}`);
        setTimeout(() => this.focusSettingsChoice(0), 60);
      },
      openSettingsAddonRemove() {
        const addon = this.settingsDialogAddon;
        if (!addon) return;
        this.settingsDialogKind = "addonRemove";
        settingsCanonicalChoices = [
          {
            label: "Cancel",
            value: "__cancel__",
            current: false,
            visible: true,
          },
          { label: "Remove", value: "remove", current: false, visible: true },
        ];
        this.settingsChoiceIndex = 0;
        this.refreshSettingsDialog(`Remove ${String(addon.name ?? "Addon")}?`);
        setTimeout(() => this.focusSettingsChoice(0), 60);
      },
      openSettingsChoice(
        title: string,
        key: keyof PlaybackPreferences,
        choices: SettingsChoiceView[],
      ) {
        this.settingsDialogKind = "choice";
        this.settingsDialogKey = key;
        settingsCanonicalChoices = [
          ...choices,
          {
            label: "Cancel",
            value: "__cancel__",
            current: false,
            visible: true,
          },
        ];
        this.settingsChoiceIndex = Math.max(
          0,
          choices.findIndex((choice) => choice.current),
        );
        this.settingsDialogOpen = true;
        this.refreshSettingsDialog(title);
        setTimeout(
          () => this.focusSettingsChoice(this.settingsChoiceIndex),
          60,
        );
      },
      openSettingsSignOut() {
        this.settingsDialogKind = "signout";
        settingsCanonicalChoices = [
          {
            label: "Sign out",
            value: "signout",
            current: false,
            visible: true,
          },
          {
            label: "Cancel",
            value: "__cancel__",
            current: false,
            visible: true,
          },
        ];
        this.settingsChoiceIndex = 1;
        this.settingsDialogOpen = true;
        this.refreshSettingsDialog("Sign out of this TV?");
        setTimeout(() => this.focusSettingsChoice(1), 60);
      },
      refreshSettingsDialog(title: string) {
        const start = Math.max(
          0,
          Math.min(
            this.settingsChoiceIndex - 3,
            settingsCanonicalChoices.length - 8,
          ),
        );
        this.settingsDialogView = {
          title,
          choices: Array.from({ length: 8 }, (_, index) =>
            settingsCanonicalChoices[start + index]
              ? { ...settingsCanonicalChoices[start + index] }
              : { ...emptySettingsChoice },
          ),
          start,
          signout: this.settingsDialogKind === "signout",
        };
        setTimeout(() => {
          if (!this.settingsDialogOpen) return;
          (
            this.$select("settingsScreen")?.$select(
              "settingsDialogScreen",
            ) as unknown as { reveal?: () => void }
          )?.reveal?.();
          for (
            let index = 0;
            index < Math.min(8, settingsCanonicalChoices.length - start);
            index++
          )
            (
              this.$select("settingsScreen")
                ?.$select("settingsDialogScreen")
                ?.$select(`settingsChoice${index}`) as unknown as {
                reveal?: () => void;
              }
            )?.reveal?.();
        }, 40);
      },
      focusSettingsChoice(index: number) {
        if (!settingsCanonicalChoices[index]) return;
        this.settingsChoiceIndex = index;
        const start = this.settingsDialogView.start;
        if (index < start || index >= start + 8) {
          this.refreshSettingsDialog(this.settingsDialogView.title);
          setTimeout(
            () =>
              this.$select("settingsScreen")
                ?.$select("settingsDialogScreen")
                ?.$select(
                  `settingsChoice${index - this.settingsDialogView.start}`,
                )
                ?.$focus(),
            60,
          );
        } else
          this.$select("settingsScreen")
            ?.$select("settingsDialogScreen")
            ?.$select(`settingsChoice${index - start}`)
            ?.$focus();
      },
      moveSettingsChoice(delta: number) {
        this.focusSettingsChoice(
          Math.max(
            0,
            Math.min(
              settingsCanonicalChoices.length - 1,
              this.settingsChoiceIndex + delta,
            ),
          ),
        );
      },
      closeSettingsDialog() {
        if (!this.settingsDialogOpen) return;
        if (
          this.settingsDialogKind === "addonRemove" &&
          this.settingsDialogAddon
        ) {
          this.openSettingsAddonManage(this.settingsDialogAddon);
          return;
        }
        this.settingsDialogOpen = false;
        setTimeout(() => {
          if (this.phase === "settings")
            this.focusSettingsRow(this.settingsSelectedIndex);
        }, 40);
      },
      async activateSettingsChoice() {
        const choice = settingsCanonicalChoices[this.settingsChoiceIndex];
        if (!choice) return;
        if (this.settingsDialogKind === "addonManage") {
          if (choice.value === "__cancel__") {
            this.closeSettingsDialog();
            return;
          }
          if (choice.value === "remove-addon") {
            this.openSettingsAddonRemove();
            return;
          }
          const addon = this.settingsDialogAddon;
          if (!addon) return;
          this.settingsDialogOpen = false;
          try {
            await api.updateAddon(String(addon.id ?? ""), {
              enabled: addon.enabled === false,
            });
            this.settingsAddons = [...(await api.addons())];
            if (this.phase === "settings") {
              this.refreshSettingsView();
              this.focusSettingsRow(this.settingsSelectedIndex);
            }
          } catch (cause) {
            this.settingsPanel = {
              ...this.settingsPanel,
              description:
                cause instanceof Error
                  ? cause.message
                  : "Could not update addon.",
            };
            this.focusSettingsRow(this.settingsSelectedIndex);
          }
          return;
        }
        if (this.settingsDialogKind === "addonRemove") {
          if (choice.value === "__cancel__") {
            this.closeSettingsDialog();
            return;
          }
          const addon = this.settingsDialogAddon;
          if (!addon) return;
          this.settingsDialogOpen = false;
          try {
            await api.deleteAddon(String(addon.id ?? ""));
            this.settingsAddons = [...(await api.addons())];
            if (this.phase === "settings") {
              this.settingsSelectedIndex = Math.min(
                this.settingsSelectedIndex,
                this.settingsAddons.length,
              );
              this.refreshSettingsView();
              this.focusSettingsRow(this.settingsSelectedIndex);
            }
          } catch (cause) {
            this.settingsPanel = {
              ...this.settingsPanel,
              description:
                cause instanceof Error
                  ? cause.message
                  : "Could not remove addon.",
            };
            this.focusSettingsRow(this.settingsSelectedIndex);
          }
          return;
        }
        if (choice.value === "__cancel__") {
          this.closeSettingsDialog();
          return;
        }
        if (this.settingsDialogKind === "signout") {
          this.settingsDialogOpen = false;
          try {
            await api.signOut();
          } catch (cause) {
            this.settingsPanel = {
              ...this.settingsPanel,
              description:
                cause instanceof Error ? cause.message : "Could not sign out.",
            };
            this.focusSettingsRow(this.settingsSelectedIndex);
          }
          return;
        }
        const patch = {
          [this.settingsDialogKey]: choice.value,
        } as Partial<PlaybackPreferences>;
        this.closeSettingsDialog();
        try {
          this.settingsPrefs = await api.savePreferences(
            this.currentProfileId,
            patch,
          );
          if (this.phase === "settings") this.refreshSettingsView();
        } catch (cause) {
          this.settingsPanel = {
            ...this.settingsPanel,
            description:
              cause instanceof Error
                ? cause.message
                : "Could not save preference.",
          };
        }
      },
      backFromSettings() {
        if (this.settingsDialogOpen) {
          this.closeSettingsDialog();
          return;
        }
        if (this.settingsFocusZone === "profile") {
          this.focusSettingsRow(0);
          return;
        }
        if (this.settingsPage !== "Settings") {
          const restore = this.settingsPage === "Playback preferences" ? 1 : 3;
          this.settingsPage = "Settings";
          this.settingsSelectedIndex = restore;
          this.refreshSettingsView();
          setTimeout(() => this.focusSettingsRow(restore), 60);
          return;
        }
        this.returnFromSettings();
      },
      returnFromSettings() {
        settingsScope?.abort();
        ++settingsGeneration;
        this.railExpanded = false;
        this.phase = this.settingsReturnPhase;
        this.railCurrent = this.settingsReturnPhase;
        setTimeout(() => {
          if (this.phase === "discover") {
            this.revealDiscoverChips();
            this.refreshDiscoverCards();
            if (this.settingsReturnZone === "chip")
              this.focusDiscoverChip(this.settingsReturnIndex);
            else this.focusDiscoverCard(this.settingsReturnIndex);
          } else if (this.phase === "library") {
            this.revealLibrarySegments();
            this.refreshLibraryCards();
            if (this.settingsReturnZone === "segment")
              this.focusLibrarySegment(this.settingsReturnIndex);
            else this.focusLibraryCard(this.settingsReturnIndex);
          } else if (this.phase === "search") {
            this.refreshSearchWindow();
            if (this.settingsReturnZone === "result")
              this.focusSearchResult(this.settingsReturnIndex);
            else this.focusSearchKey(this.settingsReturnIndex);
          } else if (this.phase === "live") {
            this.refreshLiveView();
            if (this.settingsReturnZone === "filter")
              this.focusLiveFilter(this.settingsReturnIndex);
            else if (this.settingsReturnZone === "program")
              this.focusLiveProgram(this.settingsReturnIndex);
            else this.focusLiveChannel(this.settingsReturnIndex);
          } else {
            this.revealHomeControls();
            if (this.settingsReturnZone === "card")
              this.focusHomeCard(this.settingsReturnIndex);
            else this.focusHomeAction(this.settingsReturnIndex);
          }
        }, 40);
      },
      openTitleMenu(
        item: MediaItem,
        origin: "home" | "library" | "discover" | "search",
        index: number,
      ) {
        const inQueue = [
          ...this.home.queueItems,
          ...this.libraryQueueItems,
        ].some(
          (candidate) =>
            candidate.type === item.type && candidate.id === item.id,
        );
        const saved = [
          ...this.home.favoriteItems,
          ...this.libraryFavorites,
        ].some(
          (candidate) =>
            candidate.type === item.type && candidate.id === item.id,
        );
        this.titleMenuItem = item;
        this.titleMenuOrigin = origin;
        this.titleMenuReturnIndex = index;
        this.titleMenuKind = "actions";
        this.titleMenuChoices = titleMenuChoices(item, inQueue, saved);
        this.titleMenuSlots = Array.from(
          { length: 7 },
          (_, slot) =>
            this.titleMenuChoices[slot] ?? { ...emptyTitleMenuChoice },
        );
        this.titleMenuFocusIndex = 0;
        this.titleMenuHeading = "";
        this.titleMenuNotice = "";
        this.titleMenuBusy = false;
        this.titleMenuOpen = true;
        noteTitleMenu(true, "actions");
        setTimeout(() => {
          if (!this.titleMenuOpen || this.titleMenuKind !== "actions") return;
          this.titleMenuHeading = item.name;
          this.titleMenuOkLabel = "OK";
          this.titleMenuSelectLabel = "Select";
          this.titleMenuBackLabel = "BACK";
          this.titleMenuCancelLabel = "Cancel";
          this.revealTitleMenu();
          this.focusTitleMenu(0);
        }, 40);
      },
      revealTitleMenu() {
        for (let index = 0; index < 7; index++)
          (
            this.$select("titleMenuScreen")?.$select(
              `titleMenuOption${index}`,
            ) as unknown as { reveal?: () => void }
          )?.reveal?.();
      },
      focusTitleMenu(index: number) {
        this.titleMenuFocusIndex = index;
        this.$select("titleMenuScreen")
          ?.$select(`titleMenuOption${index}`)
          ?.$focus();
      },
      moveTitleMenu(delta: number) {
        const last = Math.max(0, this.titleMenuChoices.length - 1);
        this.focusTitleMenu(
          Math.max(0, Math.min(last, this.titleMenuFocusIndex + delta)),
        );
      },
      closeTitleMenu(restore = true) {
        if (!this.titleMenuOpen) return;
        this.titleMenuOpen = false;
        this.titleMenuBusy = false;
        noteTitleMenu(false, this.titleMenuKind);
        if (!restore) return;
        if (this.titleMenuOrigin === "home") {
          const last = this.home.queueItems.length - 1;
          if (last >= 0)
            this.focusHomeCard(Math.min(this.titleMenuReturnIndex, last));
          else this.focusHomeAction(0);
        } else if (this.titleMenuOrigin === "library") {
          const last = this.libraryItems.length - 1;
          if (last >= 0)
            this.focusLibraryCard(Math.min(this.titleMenuReturnIndex, last));
          else this.focusLibrarySegment(this.libraryMode === "queue" ? 1 : 0);
        } else if (this.titleMenuOrigin === "discover")
          this.focusDiscoverCard(this.titleMenuReturnIndex);
        else {
          const index = this.titleMenuReturnIndex;
          setTimeout(() => {
            if (this.phase === "search" && !this.titleMenuOpen)
              this.focusSearchResult(index);
          }, 40);
          // The result row is a clipped SolidTV for-loop. Under a busy renderer
          // its focus node can be ready one frame after the menu disappears.
          setTimeout(() => {
            if (
              this.phase !== "search" ||
              this.titleMenuOpen ||
              this.searchFocusZone !== "result" ||
              this.searchResultIndex !== index
            )
              return;
            const result = this.$select("searchScreen")?.$select(
              `searchCard${index}`,
            ) as unknown as { focused?: boolean } | undefined;
            if (!result?.focused) this.focusSearchResult(index);
          }, 140);
        }
      },
      updateQueueLists(items: readonly MediaItem[]) {
        const cards = queueHomeCards(items);
        this.home = { ...this.home, queueItems: items, cards };
        this.syncHomeLists();
        this.libraryQueueItems = [...items];
        if (this.libraryMode === "queue") {
          this.libraryItems = [...items];
          this.libraryCardIndex = Math.min(
            this.libraryCardIndex,
            Math.max(0, items.length - 1),
          );
          this.refreshLibraryCards();
          noteLibraryState("queue", items.length);
        }
        this.revealHomeControls();
      },
      async refreshQueueAfterMenu() {
        const page = await api.queue(this.currentProfileId, 0);
        this.updateQueueLists(page.items);
        this.libraryNextOffset = page.nextOffset;
      },
      showUndoMenu(item: MediaItem) {
        this.titleMenuKind = "undo";
        this.titleMenuChoices = [
          titleMenuChoice("undo", "Undo"),
          titleMenuChoice("done", "Done"),
        ];
        this.titleMenuSlots = Array.from(
          { length: 7 },
          (_, index) =>
            this.titleMenuChoices[index] ?? { ...emptyTitleMenuChoice },
        );
        this.titleMenuHeading = "";
        this.titleMenuNotice = "";
        this.titleMenuBusy = false;
        noteTitleMenu(true, "undo");
        setTimeout(() => {
          if (!this.titleMenuOpen || this.titleMenuKind !== "undo") return;
          this.titleMenuHeading = "Removed from Continue Watching";
          this.revealTitleMenu();
          this.focusTitleMenu(0);
        }, 40);
      },
      async activateTitleMenu() {
        if (!this.titleMenuOpen || this.titleMenuBusy) return;
        const choice = this.titleMenuChoices[this.titleMenuFocusIndex];
        const item = this.titleMenuItem;
        if (!choice || !item) return;
        if (choice.key === "cancel" || choice.key === "done") {
          this.closeTitleMenu();
          return;
        }
        if (
          choice.key === "previous" ||
          choice.key === "source" ||
          choice.key === "restart" ||
          choice.key === "watchLive"
        ) {
          const target =
            choice.key === "previous"
              ? item.previousEpisode
              : choice.key === "restart"
                ? { ...item, position: 0 }
                : item;
          if (!target) return;
          this.closeTitleMenu(false);
          void this.openSources(target, choice.key === "previous");
          return;
        }
        this.titleMenuBusy = true;
        try {
          if (choice.key === "watched") {
            await api.correctProgress(
              this.currentProfileId,
              item,
              !item.watched,
            );
            await this.refreshQueueAfterMenu();
            this.closeTitleMenu();
          } else if (choice.key === "hide") {
            await api.setQueueVisibility(this.currentProfileId, item, true);
            this.updateQueueLists(
              this.home.queueItems.filter(
                (candidate) =>
                  candidate.type !== item.type || candidate.id !== item.id,
              ),
            );
            this.showUndoMenu(item);
          } else if (choice.key === "undo") {
            await api.setQueueVisibility(this.currentProfileId, item, false);
            await this.refreshQueueAfterMenu();
            this.closeTitleMenu();
          } else if (choice.key === "favorite") {
            await api.toggleFavorite(this.currentProfileId, item);
            const favorites = await api.favorites(this.currentProfileId);
            this.home = { ...this.home, favoriteItems: favorites };
            this.syncHomeLists();
            this.libraryFavorites = favorites;
            if (this.libraryMode === "favorites") {
              this.libraryItems = [...favorites];
              this.refreshLibraryCards();
              noteLibraryState("favorites", favorites.length);
            }
            this.closeTitleMenu();
          }
        } catch (cause) {
          this.titleMenuNotice =
            cause instanceof Error
              ? cause.message
              : "This action could not finish.";
          this.titleMenuBusy = false;
        }
      },
      async activateHomeAction() {
        if (this.phase !== "home" || this.homeFocusZone !== "action") return;
        const action = ["play", "details", "save"][this.homeActionIndex];
        if (action === "save" && this.home.heroItem && this.currentProfileId) {
          try {
            const saved = await api.toggleFavorite(
              this.currentProfileId,
              this.home.heroItem,
            );
            const favoriteItems = saved
              ? [...this.home.favoriteItems, this.home.heroItem]
              : this.home.favoriteItems.filter(
                  (favorite) => favorite.id !== this.home.heroItem?.id,
                );
            this.home = { ...this.home, saved, favoriteItems };
            this.syncHomeLists();
            this.homeAddLabel = saved ? "✓" : "+";
            (
              this.$select("heroAction2") as unknown as { reveal?: () => void }
            )?.reveal?.();
            this.homeNotice = saved
              ? "Added to My List"
              : "Removed from My List";
          } catch (cause) {
            this.homeNotice =
              cause instanceof Error
                ? cause.message
                : "Could not update My List.";
          }
          return;
        }
        if (action === "play" && this.home.heroItem) {
          void this.openSources(this.home.heroItem, !!this.home.heroItem.position);
          return;
        }
        if (action === "details" && this.home.heroItem) {
          void this.openDetail(this.home.heroItem);
          return;
        }
        this.homeNotice = "Playback is unavailable.";
      },
      openDetailByCard() {
        const item = this.homeShelves[this.homeShelfIndex]?.items[this.homeCardIndex];
        if (item) void this.openDetail(item);
      },
      async openDetail(item: MediaItem) {
        if (item.type === "live") { await this.openSources(item, false); return; }
        if (
          this.phase !== "home" &&
          this.phase !== "discover" &&
          this.phase !== "library" &&
          this.phase !== "search"
        )
          return;
        const generation = ++detailGeneration;
        detailScope?.abort();
        detailScope = api.createScope();
        this.detailReturnPhase = this.phase;
        if (this.phase === "home") {
          this.detailReturnZone = this.homeFocusZone;
          this.detailReturnShelfIndex = this.homeShelfIndex;
          this.detailReturnIndex =
            this.homeFocusZone === "card"
              ? this.homeCardIndex
              : this.homeActionIndex;
        } else if (this.phase === "discover") {
          this.detailReturnZone = "card";
          this.detailReturnIndex = this.discoverCardIndex;
        } else if (this.phase === "search") {
          this.detailReturnZone = "card";
          this.detailReturnIndex = this.searchResultIndex;
          searchScope?.abort();
          ++searchGeneration;
          clearTimeout(searchTimer);
        } else {
          this.detailReturnZone = "card";
          this.detailReturnIndex = this.libraryCardIndex;
        }
        this.homeNotice = "";
        try {
          const view = await loadDetailView(
            api,
            item,
            this.currentProfileId,
            this.home.favoriteItems,
            detailScope.signal,
          );
          if (generation !== detailGeneration || detailScope.signal.aborted)
            return;
          this.phase = "detail";
          setTimeout(() => {
            if (generation !== detailGeneration) return;
            this.detail = view;
            this.detailEpisodeIndex = 0;
            this.detailWindowStart = 0;
            this.detailWindowX = 0;
            this.detailScrollOffset = 0;
            this.detailEpisodes = Array.from(
              { length: 5 },
              (_, index) => view.episodes[index] ?? { ...emptyDetailEpisode },
            );
            this.detailSaveIcon = view.saved ? "✓" : "+";
            this.detailSeasonLabel = `Season ${view.season}`;
            this.detailCountLabel = `${view.episodeCount} ${view.episodeCount === 1 ? "episode" : "episodes"}`;
            this.detailNotice = "";
            this.revealTitleControls();
            this.focusTitleAction(0);
          }, 50);
        } catch (cause) {
          if (generation !== detailGeneration || detailScope.signal.aborted)
            return;
          this.homeNotice =
            cause instanceof Error ? cause.message : "Could not open title.";
        }
      },
      revealTitleControls() {
        for (let index = 0; index < 4; index++)
          (
            this.$select(`titleAction${index}`) as unknown as {
              reveal?: () => void;
            }
          )?.reveal?.();
        for (let index = 0; index < 5; index++)
          (
            this.$select(`titleEpisode${index}`) as unknown as {
              reveal?: () => void;
            }
          )?.reveal?.();
      },
      focusTitleAction(index: number) {
        this.detailFocusZone = "action";
        this.detailActionIndex = index;
        this.$select(`titleAction${index}`)?.$focus();
      },
      focusTitleEpisode(index: number) {
        if (!this.detail.episodes.length) return;
        index = Math.max(0, Math.min(this.detail.episodes.length - 1, index));
        this.detailFocusZone = "episode";
        this.detailEpisodeIndex = index;
        const window = carouselWindow(index, this.detail.episodes.length, 360, 1632, this.detailScrollOffset);
        this.detailScrollOffset = window.offset;
        this.detailWindowStart = window.start;
        this.detailWindowX = window.x;
        this.detailEpisodes = Array.from({ length: 5 }, (_, slot) => this.detail.episodes[window.start + slot] ?? { ...emptyDetailEpisode });
        this.revealTitleControls();
        this.$select(`titleEpisode${index - window.start}`)?.$focus();
      },
      focusTitleSeason() {
        if (!this.detail.allEpisodes.length) return;
        this.detailFocusZone = "season";
        this.$select("titleSeason")?.$focus();
      },
      changeTitleSeason(delta: number) {
        const seasons = [...new Set(this.detail.allEpisodes.map(episode => episode.item?.season ?? 1))].sort((a, b) => a - b);
        if (!seasons.length) return;
        const season = seasons[(seasons.indexOf(this.detail.season) + delta + seasons.length) % seasons.length];
        const episodes = this.detail.allEpisodes.filter(episode => (episode.item?.season ?? 1) === season);
        this.detail = { ...this.detail, season, episodes, episodeCount: episodes.length };
        this.detailEpisodeIndex = 0;
        this.detailScrollOffset = 0;
        this.detailWindowStart = 0;
        this.detailWindowX = 0;
        this.detailEpisodes = Array.from({ length: 5 }, (_, slot) => episodes[slot] ?? { ...emptyDetailEpisode });
        this.detailSeasonLabel = `Season ${season}`;
        this.detailCountLabel = `${episodes.length} ${episodes.length === 1 ? "episode" : "episodes"}`;
        this.revealTitleControls();
      },
      async activateTitleAction() {
        if (this.phase !== "detail" || this.detailFocusZone !== "action")
          return;
        const action = ["play", "source", "save", "info"][
          this.detailActionIndex
        ];
        if (action === "save" && this.detail.item && this.currentProfileId) {
          try {
            const saved = await api.toggleFavorite(
              this.currentProfileId,
              this.detail.item,
            );
            this.detail = { ...this.detail, saved };
            this.detailSaveIcon = saved ? "✓" : "+";
            setTimeout(
              () =>
                (
                  this.$select("titleAction2") as unknown as {
                    reveal?: () => void;
                  }
                )?.reveal?.(),
              0,
            );
            this.detailNotice = saved
              ? "Added to My List"
              : "Removed from My List";
          } catch (cause) {
            this.detailNotice =
              cause instanceof Error
                ? cause.message
                : "Could not update My List.";
          }
          return;
        }
        if ((action === "play" || action === "source") && this.detail.target) {
          void this.openSources(
            this.detail.target,
            action === "play" && !!this.detail.target.position,
          );
          return;
        }
        this.detailNotice =
          action === "info"
            ? this.detail.synopsis
            : "Choose source is not available yet.";
      },
      async openSources(item: MediaItem, resume: boolean) {
        if (
          this.phase !== "detail" &&
          this.phase !== "library" &&
          this.phase !== "home" &&
          this.phase !== "discover" &&
          this.phase !== "search" &&
          this.phase !== "live"
        )
          return;
        const generation = ++sourceGeneration;
        sourceScope?.abort();
        clearTimeout(sourceTimer);
        const scope = api.createScope();
        sourceScope = scope;
        this.sourceReturnOrigin = this.phase;
        if (this.phase === "library")
          this.sourceReturnIndex = this.libraryCardIndex;
        else if (this.phase === "home") {
          this.sourceReturnZone = this.homeFocusZone;
          this.sourceReturnIndex = this.homeFocusZone === "card" ? this.homeCardIndex : this.homeActionIndex;
        }
        else if (this.phase === "discover")
          this.sourceReturnIndex = this.discoverCardIndex;
        else if (this.phase === "search")
          this.sourceReturnIndex = this.searchResultIndex;
        else if (this.phase === "live") {
          this.sourceReturnZone =
            this.liveFocusZone === "program" ? "program" : "channel";
          this.sourceReturnIndex =
            this.liveFocusZone === "program"
              ? this.liveProgramPosition
              : this.liveSelectedRow;
        } else {
          this.sourceReturnZone = this.detailFocusZone;
          this.sourceReturnIndex =
            this.detailFocusZone === "episode"
              ? this.detailEpisodeIndex
              : this.detailActionIndex;
        }
        this.sourceResume = resume;
        this.sourceRowIndex = 0;
        this.sourceWindowStart = 0;
        this.sourceNotice = "";
        this.source = projectSources(item, [], true, false);
        this.sourceChips = Array.from(
          { length: 5 },
          (_, index) => this.source.chips[index] ?? { ...emptySourceChip },
        );
        this.sourceRows = Array.from({ length: 6 }, () => ({
          ...emptySourceRow,
        }));
        this.phase = "sources";
        setTimeout(() => {
          if (generation !== sourceGeneration) return;
          this.sourcePanelTitle = "Choose a source";
          this.sourceProviderLabel = "All providers";
          this.sourceOkLabel = "OK";
          this.sourcePlayLabel = "Play";
          this.sourceArrowLabel = "◀ ▶";
          this.sourceQualityLabel = "Quality";
          this.sourceBackLabel = "BACK";
          this.sourceCloseLabel = "Close";
          this.revealSourceControls();
          this.focusSourceChip(0);
        }, 50);
        try {
          const discovery = await api.sources(item, { signal: scope.signal });
          let state = {
            after: 0,
            sources: [] as readonly MediaSource[],
            polls: 0,
          };
          while (generation === sourceGeneration && !scope.signal.aborted) {
            const step = await api.pollSourcesStep(discovery.id, state, {
              signal: scope.signal,
            });
            if (generation !== sourceGeneration || scope.signal.aborted) return;
            state = step.state;
            const hadRows = this.source.sources.length > 0;
            this.updateSources(state.sources, !step.done, step.done);
            if (!hadRows && state.sources.length)
              setTimeout(() => {
                if (generation === sourceGeneration && this.phase === "sources")
                  this.focusSourceRow(0);
              }, 50);
            if (resume && item.sourceAddonId && item.sourceFingerprint) {
              const exact = exactResumeSource(item, state.sources);
              if (exact) {
                this.sourceSelectedId = exact.id;
                noteSourceIntent(item.id, exact.id, item.position ?? 0, true);
                void this.playSource(item, exact, item.position ?? 0);
                return;
              }
            }
            if (step.done) {
              if (resume)
                this.sourceNotice =
                  "Your previous source is unavailable. Choose a source to continue.";
              break;
            }
            await new Promise<void>((resolve) => {
              const finish = () => {
                clearTimeout(sourceTimer);
                scope.signal.removeEventListener("abort", finish);
                resolve();
              };
              sourceTimer = setTimeout(finish, 1500);
              scope.signal.addEventListener("abort", finish, { once: true });
            });
          }
        } catch (cause) {
          if (generation !== sourceGeneration || scope.signal.aborted) return;
          this.sourceNotice =
            cause instanceof Error ? cause.message : "Could not find sources.";
          this.updateSources(this.source.sources, false, true);
        }
      },
      updateSources(
        sources: readonly MediaSource[],
        busy: boolean,
        done: boolean,
      ) {
        const item = this.source.item;
        if (!item) return;
        this.source = projectSources(
          item,
          sources,
          busy,
          done,
          this.source.quality,
          this.source.provider,
        );
        noteSourceFilter(
          this.source.quality,
          this.source.provider,
          this.source.rows.length,
        );
        this.sourceChips = Array.from(
          { length: 5 },
          (_, index) => this.source.chips[index] ?? { ...emptySourceChip },
        );
        this.sourceWindowStart = Math.min(
          this.sourceWindowStart,
          Math.max(0, this.source.rows.length - 6),
        );
        this.sourceRowIndex = Math.min(
          this.sourceRowIndex,
          Math.max(0, this.source.rows.length - 1),
        );
        this.sourceRows = Array.from(
          { length: 6 },
          (_, index) =>
            this.source.rows[this.sourceWindowStart + index] ?? {
              ...emptySourceRow,
            },
        );
        setTimeout(() => {
          if (this.phase === "sources") this.revealSourceControls();
        }, 60);
      },
      revealSourceControls() {
        for (let index = 0; index < 5; index++)
          (
            this.$select(`sourceChip${index}`) as unknown as {
              reveal?: () => void;
            }
          )?.reveal?.();
        (
          this.$select("sourceProvider") as unknown as { reveal?: () => void }
        )?.reveal?.();
        for (let index = 0; index < 6; index++)
          (
            this.$select(`sourceRow${index}`) as unknown as {
              reveal?: () => void;
            }
          )?.reveal?.();
      },
      focusSourceChip(index: number) {
        if (this.phase !== "sources") return;
        this.sourceFocusZone = "chip";
        this.sourceChipIndex = index;
        this.$select(`sourceChip${index}`)?.$focus();
      },
      focusSourceProvider() {
        if (this.phase !== "sources") return;
        this.sourceFocusZone = "provider";
        this.$select("sourceProvider")?.$focus();
      },
      focusSourceRow(index: number) {
        if (this.phase !== "sources" || !this.source.rows.length) return;
        this.sourceFocusZone = "row";
        this.sourceRowIndex = Math.max(
          0,
          Math.min(this.source.rows.length - 1, index),
        );
        const previousStart = this.sourceWindowStart;
        if (this.sourceRowIndex < this.sourceWindowStart)
          this.sourceWindowStart = this.sourceRowIndex;
        else if (this.sourceRowIndex >= this.sourceWindowStart + 6)
          this.sourceWindowStart = this.sourceRowIndex - 5;
        noteSourceWindow(this.sourceRowIndex, this.sourceWindowStart);
        if (this.sourceWindowStart !== previousStart) {
          this.sourceRows = Array.from(
            { length: 6 },
            (_, slot) =>
              this.source.rows[this.sourceWindowStart + slot] ?? {
                ...emptySourceRow,
              },
          );
          setTimeout(() => {
            if (this.phase === "sources") this.revealSourceControls();
          }, 60);
        }
        const slot = this.sourceRowIndex - this.sourceWindowStart;
        this.$select(`sourceRow${slot}`)?.$focus();
        setTimeout(() => {
          if (this.phase === "sources")
            (
              this.$select(
                `sourceRow${this.sourceRowIndex - this.sourceWindowStart}`,
              ) as unknown as { reveal?: () => void }
            )?.reveal?.();
        }, 60);
      },
      moveSourceRow(delta: number) {
        if (this.phase !== "sources") return;
        if (this.sourceRowIndex === 0 && delta < 0) this.focusSourceProvider();
        else this.focusSourceRow(this.sourceRowIndex + delta);
      },
      selectSourceRow() {
        if (this.phase !== "sources") return;
        const row = this.source.rows[this.sourceRowIndex];
        const item = this.source.item;
        if (!row?.source || !item) return;
        this.sourceSelectedId = row.source.id;
        noteSourceIntent(
          item.id,
          row.source.id,
          item.position ?? 0,
          this.sourceResume,
        );
        void this.playSource(item, row.source, item.position ?? 0);
      },
      async ensurePlaybackRuntime() {
        if (playback) return playback;
        const video = document.getElementById(
          "tv-video",
        ) as HTMLVideoElement | null;
        if (!video) throw new Error("TV video surface is unavailable.");
        const { createSolidTVPlaybackRuntime } = await import(
          "./playbackRuntime"
        );
        if (playback) return playback;
        playback = createSolidTVPlaybackRuntime(
          api,
          platform,
          video,
          (snapshot) => this.updatePlayerSnapshot(snapshot),
        );
        return playback;
      },
      async playSource(item: MediaItem, source: MediaSource, position: number) {
        if (this.phase !== "sources") return;
        const generation = ++playbackGeneration;
        sourceScope?.abort();
        ++sourceGeneration;
        clearTimeout(sourceTimer);
        this.playerItem = item;
        const title = item.name;
        const episodeLine =
          item.season !== undefined
            ? `S${item.season} · E${item.episode ?? 1} · ${item.episodeTitle ?? item.name}`
            : "";
        this.playerTitle = "";
        this.playerEpisodeLine = "";
        this.preparingText = "Preparing playback…";
        this.playerNotice = "";
        this.phase = "preparing";
        showPreparingSpinner(true);
        const layer = document.getElementById("video-layer")!;
        this.setPlayerShade(false);
        if (platform === "tizen")
          document.body.style.background = "transparent";
        else layer.style.display = "block";
        try {
          const runtime = await this.ensurePlaybackRuntime();
          if (generation !== playbackGeneration || this.phase !== "preparing")
            return;
          const started = await runtime.start(item, source, position);
          if (generation !== playbackGeneration) {
            if (
              runtime.controller.snapshot.active?.session.id ===
              started.session.id
            )
              await runtime.stop();
            return;
          }
          // Persist the controller's enriched item so progress retains the
          // selected source's addon/fingerprint identity on exit and heartbeat.
          this.playerItem = started.intent.item;
          this.playerSessionId = started.session.id;
          this.playerSessionDuration = started.session.duration;
          this.phase = "player";
          showPreparingSpinner(false);
          this.playerOverlay = true;
          this.setPlayerShade(true);
          this.nowPlayingLabel = "NOW PLAYING";
          this.playerLegend =
            "OK  Select     ◀ ▶  Move     BACK  Hide controls";
          this.updatePlayerSnapshot(runtime.player.snapshot);
          setTimeout(() => {
            if (generation !== playbackGeneration || this.phase !== "player")
              return;
            this.playerTitle = title;
            this.playerEpisodeLine = episodeLine;
            this.revealPlayerControls();
            this.focusPlayerControl(1);
          }, 50);
          clearInterval(heartbeatTimer);
          heartbeatTimer = setInterval(() => {
            if (
              this.phase !== "player" ||
              !this.playerSessionId ||
              !this.playerItem
            )
              return;
            void api.heartbeat(this.playerSessionId).catch(() => undefined);
            if (this.playerItem.type !== "live") {
              const time = runtime.player.snapshot.time;
              void api
                .saveProgress(
                  this.currentProfileId,
                  this.playerItem,
                  time.positionSeconds,
                  time.durationSeconds ?? this.playerSessionDuration,
                )
                .catch(() => undefined);
            }
          }, 15000);
        } catch (cause) {
          if (generation !== playbackGeneration) return;
          layer.style.display = "none";
          this.setPlayerShade(false);
          document.body.style.background = "";
          this.phase = "sources";
          showPreparingSpinner(false);
          this.sourceNotice =
            cause instanceof Error
              ? cause.message
              : "This source could not be played.";
          setTimeout(() => this.focusSourceRow(this.sourceRowIndex), 0);
        }
      },
      updatePlayerSnapshot(snapshot: PlayerSnapshot) {
        this.playerSnapshot = snapshot;
        notePlayerState(snapshot.state, snapshot.time.positionSeconds);
        this.playerStatus = this.playerItem?.type === "live" ? "LIVE" : snapshot.state.toUpperCase();
        this.playerToggleIcon = snapshot.state === "paused" ? "▶" : "Ⅱ";
        const position = snapshot.time.positionSeconds;
        const duration =
          snapshot.time.durationSeconds ?? this.playerSessionDuration;
        if (this.playerSeekPreview === null) {
          this.playerPositionText = playerClock(position);
          this.playerProgress =
            duration > 0 ? Math.min(1, position / duration) : 0;
        }
        const stableDuration = this.playerSessionDuration > 0 ? this.playerSessionDuration : duration;
        this.playerDurationText = stableDuration > 0 ? playerRuntime(stableDuration) : "";
        if (snapshot.error && this.phase === "player")
          this.playerNotice = snapshot.error.message;
        if (snapshot.state === "playing" && this.phase === "player" && !chromeTimer)
          this.schedulePlayerChromeHide();
      },
      setPlayerShade(visible: boolean) {
        const shade = document.getElementById("player-shade");
        if (shade) shade.style.display = visible ? "block" : "none";
      },
      schedulePlayerChromeHide() {
        clearTimeout(chromeTimer);
        chromeTimer = undefined;
        if (
          !this.playerOverlay ||
          this.trackPanelOpen ||
          this.playerSnapshot?.state !== "playing"
        )
          return;
        chromeTimer = setTimeout(() => {
          chromeTimer = undefined;
          if (
            this.phase === "player" &&
            this.playerSnapshot?.state === "playing"
          ) {
            this.playerOverlay = false;
            this.setPlayerShade(false);
            this.$focus();
          }
        }, 7000);
      },
      revealPlayerControls() {
        for (let index = 0; index < 7; index++)
          (
            this.$select(`playerControl${index}`) as unknown as {
              reveal?: () => void;
            }
          )?.reveal?.();
      },
      focusPlayerControl(index: number) {
        if (this.phase !== "player") return;
        if (this.playerItem?.type === "live") index = Math.max(4, index);
        this.playerOverlay = true;
        this.setPlayerShade(true);
        this.playerFocusIndex = index;
        this.$select(`playerControl${index}`)?.$focus();
        this.schedulePlayerChromeHide();
      },
      focusPlayerTimeline() {
        if (this.phase !== "player" || this.playerItem?.type === "live") return;
        this.playerOverlay = true;
        this.setPlayerShade(true);
        this.$select("playerTimeline")?.$focus();
        this.schedulePlayerChromeHide();
      },
      async activatePlayerControl() {
        if (this.phase !== "player") return;
        const runtime = playback;
        if (!runtime) return;
        const action = [
          "back10",
          "toggle",
          "forward30",
          "next",
          "audio",
          "subtitles",
          "exit",
        ][this.playerFocusIndex];
        if (this.playerItem?.type === "live" && this.playerFocusIndex < 4) return;
        try {
          if (action === "toggle") {
            if (runtime.player.snapshot.state === "paused")
              await runtime.player.play();
            else await runtime.player.pause();
          } else if (action === "back10" || action === "forward30") {
            const current = runtime.player.snapshot.time.positionSeconds;
            const duration =
              runtime.player.snapshot.time.durationSeconds ??
              this.playerSessionDuration;
            const target = Math.max(
              0,
              Math.min(
                duration || Infinity,
                current + (action === "back10" ? -10 : 30),
              ),
            );
            await runtime.controller.seekFrom(
              () => target,
              () => current,
            );
          } else if (action === "exit") {
            await this.exitPlayer();
            return;
          } else if (action === "audio" || action === "subtitles") {
            this.openTrackPanel(action === "audio" ? "audio" : "text");
            return;
          } else if (action === "next") {
            void this.prepareNextEpisode();
            return;
          } else this.playerNotice = `${action} is unavailable.`;
        } catch (cause) {
          this.playerNotice =
            cause instanceof Error
              ? cause.message
              : "The TV could not complete this request.";
        }
        this.schedulePlayerChromeHide();
      },
      async prepareNextEpisode() {
        const runtime = playback;
        const current = this.playerItem;
        if (this.phase !== "player" || !runtime || !current || current.season === undefined || nextScope) return;
        const scope = api.createScope();
        nextScope = scope;
        this.playerPreparingNext = true;
        this.preparingText = "Preparing playback…";
        showPreparingSpinner(true);
        clearTimeout(chromeTimer);
        let candidate: Awaited<ReturnType<typeof resolveNext>> = null;
        try {
          const time = runtime.player.snapshot.time;
          await api.saveProgress(this.currentProfileId, current, time.positionSeconds, time.durationSeconds ?? this.playerSessionDuration);
          const preferences = await api.preferences(this.currentProfileId, { signal: scope.signal }).catch(() => this.settingsPrefs);
          await runtime.controller.prepareNext(async () => {
            candidate = await resolveNext(api, this.currentProfileId, current, preferences, scope.signal);
            return candidate;
          });
          if (scope.signal.aborted || nextScope !== scope) return;
          const active = runtime.controller.snapshot.active;
          if (!candidate || !active || active.intent.item.id === current.id) {
            this.playerNotice = "No next episode is available.";
            return;
          }
          this.playerItem = active.intent.item;
          this.playerSessionId = active.session.id;
          this.playerSessionDuration = active.session.duration;
          this.playerTitle = active.intent.item.name;
          this.playerEpisodeLine = `S${active.intent.item.season} · E${active.intent.item.episode ?? 1} · ${active.intent.item.episodeTitle ?? active.intent.item.name}`;
          this.updatePlayerSnapshot(runtime.player.snapshot);
          this.focusPlayerControl(1);
        } catch (cause) {
          if (!scope.signal.aborted) this.playerNotice = cause instanceof Error ? cause.message : "The next episode could not be played.";
        } finally {
          if (nextScope === scope) {
            nextScope = undefined;
            this.playerPreparingNext = false;
            showPreparingSpinner(false);
          }
        }
      },
      openTrackPanel(kind: "audio" | "text") {
        if (this.phase !== "player" || !playback) return;
        const session = playback.controller.snapshot.active?.session;
        if (!session) return;
        const choices = trackChoicesFor(kind, playback.player, session);
        if (!choices.length) {
          this.playerNotice =
            kind === "audio"
              ? "No audio tracks are available."
              : "No subtitles are available.";
          return;
        }
        this.trackPanelKind = kind;
        this.trackReturnControlIndex = this.playerFocusIndex;
        this.trackChoices = choices;
        this.trackSlots = Array.from(
          { length: 8 },
          (_, index) => choices[index] ?? { ...emptyTrackChoice },
        );
        this.trackFocusIndex = Math.max(
          0,
          choices.findIndex((choice) => choice.current),
        );
        this.trackNotice = "";
        this.trackPanelOpen = true;
        this.phase = "playerTracks";
        noteTrackPanel(true, kind);
        this.playerOverlay = true;
        this.setPlayerShade(true);
        clearTimeout(chromeTimer);
        setTimeout(() => {
          if (!this.trackPanelOpen || this.phase !== "playerTracks") return;
          this.trackPanelTitle =
            kind === "audio" ? "Audio Tracks" : "Subtitles";
          this.trackLegend = "▲ ▼  Move     OK  Select     BACK  Close";
          for (let index = 0; index < 8; index++)
            (
              this.$select(`playerTrack${index}`) as unknown as {
                reveal?: () => void;
              }
            )?.reveal?.();
          this.focusTrackChoice(this.trackFocusIndex);
        }, 50);
      },
      focusTrackChoice(index: number) {
        if (this.phase !== "playerTracks" || !this.trackPanelOpen) return;
        this.trackFocusIndex = index;
        this.$select(`playerTrack${index}`)?.$focus();
      },
      moveTrackFocus(delta: number) {
        if (this.phase !== "playerTracks" || !this.trackPanelOpen) return;
        this.focusTrackChoice(
          Math.max(
            0,
            Math.min(
              this.trackChoices.length - 1,
              this.trackFocusIndex + delta,
            ),
          ),
        );
      },
      async selectTrackChoice() {
        if (this.phase !== "playerTracks" || !this.trackPanelOpen || !playback)
          return;
        const choice = this.trackChoices[this.trackFocusIndex];
        if (!choice) return;
        noteTrackSelection(this.trackPanelKind, choice.id, choice.available);
        if (!choice.available) {
          this.trackNotice = "This track is not supported on this TV.";
          return;
        }
        this.closeTrackPanel();
        try {
          if (choice.mode === "off") {
            const session = playback.controller.snapshot.active?.session;
            if (
              session?.mode === "direct" &&
              playback.player.capabilities.canDisableTextTrack
            )
              await playback.player.selectTextTrack(null);
            else
              await playback.controller.replaceTracks({ subtitlesOff: true });
          } else if (choice.mode === "native") {
            if (this.trackPanelKind === "audio")
              await playback.player.selectAudioTrack(choice.id);
            else await playback.player.selectTextTrack(choice.id);
          } else if (this.trackPanelKind === "audio") {
            await playback.controller.replaceTracks({
              audioTrackIndex: choice.inputIndex,
            });
          } else {
            await playback.controller.replaceTracks({
              subtitleTrackIndex: choice.inputIndex,
              subtitlesOff: false,
            });
          }
          const active = playback.controller.snapshot.active;
          if (active) {
            this.playerSessionId = active.session.id;
            this.playerSessionDuration = active.session.duration;
          }
        } catch (cause) {
          this.playerNotice =
            cause instanceof Error
              ? cause.message
              : "Could not change this track.";
        }
      },
      closeTrackPanel() {
        if (!this.trackPanelOpen) return;
        this.trackPanelOpen = false;
        this.phase = "player";
        noteTrackPanel(false, this.trackPanelKind);
        this.trackNotice = "";
        setTimeout(() => {
          if (this.phase === "player")
            this.focusPlayerControl(this.trackReturnControlIndex);
        }, 0);
      },
      previewPlayerSeek(delta: number) {
        if (this.playerItem?.type === "live") return;
        if (this.phase !== "player" || !playback) return;
        const current =
          this.playerSeekPreview ??
          playback.player.snapshot.time.positionSeconds;
        const duration =
          playback.player.snapshot.time.durationSeconds ??
          this.playerSessionDuration;
        this.playerSeekPreview = Math.max(
          0,
          Math.min(duration || Infinity, current + delta),
        );
        this.playerSeekLabel = playerClock(this.playerSeekPreview);
        this.playerProgress =
          duration > 0 ? Math.min(1, this.playerSeekPreview / duration) : 0;
        this.playerLegend = "◀ ▶  Seek     OK  Jump     BACK  Cancel";
        clearTimeout(chromeTimer);
      },
      async commitPlayerSeek() {
        if (this.playerItem?.type === "live") return;
        if (
          this.phase !== "player" ||
          !playback ||
          this.playerSeekPreview === null
        )
          return;
        const target = this.playerSeekPreview;
        const current = playback.player.snapshot.time.positionSeconds;
        try {
          await playback.controller.seekFrom(
            () => target,
            () => current,
          );
        } catch (cause) {
          this.playerNotice =
            cause instanceof Error
              ? cause.message
              : "The stream could not seek there.";
        } finally {
          this.playerSeekPreview = null;
          this.playerSeekLabel = "";
          this.playerLegend =
            "OK  Select     ◀ ▶  Move     BACK  Hide controls";
          this.updatePlayerSnapshot(playback.player.snapshot);
        }
      },
      async exitPlayer() {
        if (
          this.phase !== "player" &&
          this.phase !== "playerTracks" &&
          this.phase !== "preparing"
        )
          return;
        ++playbackGeneration;
        nextScope?.abort();
        nextScope = undefined;
        playback?.controller.cancelNext();
        this.playerPreparingNext = false;
        showPreparingSpinner(false);
        clearInterval(heartbeatTimer);
        clearTimeout(chromeTimer);
        const runtime = playback;
        const snapshot = runtime?.player.snapshot;
        if (
          runtime &&
          this.playerItem &&
          snapshot &&
          this.playerItem.type !== "live"
        )
          await api
            .saveProgress(
              this.currentProfileId,
              this.playerItem,
              snapshot.time.positionSeconds,
              snapshot.time.durationSeconds ?? this.playerSessionDuration,
            )
            .catch(() => undefined);
        await runtime?.stop().catch(() => undefined);
        document.getElementById("video-layer")!.style.display = "none";
        this.setPlayerShade(false);
        document.body.style.background = "";
        this.phase = "sources";
        this.playerOverlay = true;
        this.trackPanelOpen = false;
        this.playerSeekPreview = null;
        this.playerSeekLabel = "";
        if (this.playerItem?.type === "live") { this.closeSources(); return; }
        this.updateSources(this.source.sources, false, true);
        setTimeout(() => this.focusSourceRow(this.sourceRowIndex), 0);
      },
      openSourceDetails() {
        if (this.phase !== "sources") return;
        const source = this.source.rows[this.sourceRowIndex]?.source;
        if (!source) return;
        this.sourceDetailsReturnIndex = this.sourceRowIndex;
        this.phase = "sourceDetails";
        setTimeout(() => {
          if (this.phase !== "sourceDetails") return;
          this.sourceDetailsHeading = "Source details";
          this.sourceDetailsBody = [
            source.name,
            source.title,
            source.filename,
            source.sourceName,
          ]
            .filter(Boolean)
            .join("\n");
          this.$select("sourceDetailsClose")?.$focus();
        }, 50);
      },
      closeSourceDetails() {
        if (this.phase !== "sourceDetails") return;
        this.phase = "sources";
        setTimeout(() => {
          if (this.phase !== "sources") return;
          this.revealSourceControls();
          this.focusSourceRow(this.sourceDetailsReturnIndex);
        }, 0);
      },
      chooseSourceQuality(index: number) {
        const quality = this.source.chips[index]?.quality;
        if (this.phase !== "sources" || !quality || !this.source.item) return;
        this.source = projectSources(
          this.source.item,
          this.source.sources,
          this.source.busy,
          this.source.done,
          quality,
          this.source.provider,
        );
        noteSourceFilter(
          this.source.quality,
          this.source.provider,
          this.source.rows.length,
        );
        this.sourceRowIndex = 0;
        this.sourceWindowStart = 0;
        this.sourceChips = Array.from(
          { length: 5 },
          (_, slot) => this.source.chips[slot] ?? { ...emptySourceChip },
        );
        this.sourceRows = Array.from(
          { length: 6 },
          (_, slot) => this.source.rows[slot] ?? { ...emptySourceRow },
        );
        this.sourceChipIndex = index;
        setTimeout(() => {
          if (this.phase !== "sources") return;
          this.revealSourceControls();
          // Do not steal focus if the user already moved into the rows.
          if (this.sourceFocusZone === "chip" && this.sourceChipIndex === index)
            this.focusSourceChip(index);
        }, 60);
      },
      stepSourceQuality(delta: number) {
        const count = this.source.chips.length;
        if (this.phase !== "sources" || !count) return;
        const index = this.source.chips.findIndex(
          (chip) => chip.quality === this.source.quality,
        );
        const next = (index + delta + count) % count;
        this.chooseSourceQuality(next);
        if (this.source.rows.length)
          setTimeout(() => this.focusSourceRow(0), 0);
        else this.focusSourceChip(next);
      },
      closeSources() {
        if (this.phase !== "sources") return;
        sourceScope?.abort();
        ++sourceGeneration;
        clearTimeout(sourceTimer);
        this.phase = this.sourceReturnOrigin;
        this.sourceNotice = "";
        setTimeout(() => {
          if (this.phase === "library") {
            this.revealLibrarySegments();
            this.refreshLibraryCards();
            this.focusLibraryCard(this.sourceReturnIndex);
          } else if (this.phase === "home") {
            this.revealHomeControls();
            if (this.sourceReturnZone === "action") this.focusHomeAction(this.sourceReturnIndex);
            else this.focusHomeCard(this.sourceReturnIndex);
          } else if (this.phase === "discover") {
            this.revealDiscoverChips();
            this.refreshDiscoverCards();
            this.focusDiscoverCard(this.sourceReturnIndex);
          } else if (this.phase === "search") {
            this.refreshSearchWindow();
            this.focusSearchResult(this.sourceReturnIndex);
          } else if (this.phase === "live") {
            this.refreshLiveView();
            if (this.sourceReturnZone === "program")
              this.focusLiveProgram(this.sourceReturnIndex);
            else this.focusLiveChannel(this.sourceReturnIndex);
          } else if (this.sourceReturnZone === "episode")
            this.focusTitleEpisode(this.sourceReturnIndex);
          else this.focusTitleAction(this.sourceReturnIndex);
        }, 0);
      },
      openProviderPicker() {
        if (this.phase !== "sources") return;
        const labels = [
          "All",
          ...new Set(
            this.source.sources.map(
              (source) => source.sourceName ?? source.name,
            ),
          ),
          "Cancel",
        ];
        this.providerChoices = Array.from({ length: 6 }, (_, index) => ({
          label: labels[index] ?? "",
          current: labels[index] === this.source.provider,
          visible: index < labels.length,
        }));
        this.providerChoiceIndex = Math.max(
          0,
          Math.min(5, labels.indexOf(this.source.provider)),
        );
        this.phase = "provider";
        setTimeout(() => {
          if (this.phase !== "provider") return;
          this.providerPanelTitle = "Source provider";
          for (let index = 0; index < 6; index++)
            (
              this.$select(`providerOption${index}`) as unknown as {
                reveal?: () => void;
              }
            )?.reveal?.();
          this.focusProviderOption(this.providerChoiceIndex);
        }, 50);
      },
      focusProviderOption(index: number) {
        if (this.phase !== "provider") return;
        this.providerChoiceIndex = index;
        this.$select(`providerOption${index}`)?.$focus();
      },
      moveProviderOption(delta: number) {
        const count = this.providerChoices.filter(
          (choice) => choice.visible,
        ).length;
        if (this.phase !== "provider" || !count) return;
        this.focusProviderOption(
          Math.max(0, Math.min(count - 1, this.providerChoiceIndex + delta)),
        );
      },
      selectProviderOption() {
        if (this.phase !== "provider") return;
        const choice = this.providerChoices[this.providerChoiceIndex];
        if (!choice?.visible || choice.label === "Cancel") {
          this.closeProviderPicker();
          return;
        }
        const item = this.source.item;
        if (!item) {
          this.closeProviderPicker();
          return;
        }
        this.source = projectSources(
          item,
          this.source.sources,
          this.source.busy,
          this.source.done,
          this.source.quality,
          choice.label,
        );
        noteSourceFilter(
          this.source.quality,
          this.source.provider,
          this.source.rows.length,
        );
        this.sourceRowIndex = 0;
        this.sourceWindowStart = 0;
        this.sourceChips = Array.from(
          { length: 5 },
          (_, index) => this.source.chips[index] ?? { ...emptySourceChip },
        );
        this.sourceRows = Array.from(
          { length: 6 },
          (_, index) => this.source.rows[index] ?? { ...emptySourceRow },
        );
        this.sourceProviderLabel =
          choice.label === "All" ? "All providers" : choice.label;
        this.phase = "sources";
        setTimeout(() => {
          if (this.phase !== "sources") return;
          this.revealSourceControls();
          this.focusSourceProvider();
        }, 60);
      },
      closeProviderPicker() {
        if (this.phase !== "provider") return;
        this.phase = "sources";
        setTimeout(() => {
          if (this.phase !== "sources") return;
          this.revealSourceControls();
          this.focusSourceProvider();
        }, 0);
      },
      returnFromDetail() {
        detailScope?.abort();
        ++detailGeneration;
        this.phase = this.detailReturnPhase;
        this.detailNotice = "";
        setTimeout(() => {
          if (this.phase === "discover") {
            this.revealDiscoverChips();
            this.refreshDiscoverCards();
            this.focusDiscoverCard(this.detailReturnIndex);
          } else if (this.phase === "library") {
            this.revealLibrarySegments();
            if (this.libraryMode === "favorites")
              void this.reloadLibraryFavorites(this.detailReturnIndex);
            else {
              this.refreshLibraryCards();
              this.focusLibraryCard(this.detailReturnIndex);
            }
          } else if (this.phase === "search") {
            this.refreshSearchWindow();
            this.focusSearchResult(this.detailReturnIndex);
          } else {
            this.revealHomeControls();
            if (this.detailReturnZone === "card") {
              this.homeShelfIndex = Math.min(this.detailReturnShelfIndex, Math.max(0, this.homeShelves.length - 1));
              this.homeCardWindowStart = 0;
              this.focusHomeCard(this.detailReturnIndex);
            } else this.focusHomeAction(this.detailReturnIndex);
          }
        }, 0);
      },
      showProfiles(profiles: readonly TvProfile[]) {
        homeScope?.abort();
        ++homeGeneration;
        detailScope?.abort();
        ++detailGeneration;
        settingsScope?.abort();
        ++settingsGeneration;
        discoverScope?.abort();
        ++discoverGeneration;
        libraryScope?.abort();
        ++libraryGeneration;
        searchScope?.abort();
        ++searchGeneration;
        clearTimeout(searchTimer);
        liveScope?.abort();
        ++liveGeneration;
        clearInterval(liveClockTimer);
        this.liveDetailsOpen = false;
        this.profiles = [...profiles];
        this.railExpanded = false;
        this.phase = "profiles";
        this.profilePage = 0;
        this.profileFocus = 0;
        this.profileFocusTarget = "tile";
        this.managing = false;
        this.profileError = "";
        this.refreshProfileSlots();
        setTimeout(() => {
          this.profilesWordmark = "VIPTV";
          this.profilesLabel = "Who's watching?";
          this.okLabel = "OK";
          this.selectLabel = "Select";
          this.moveIcon = "◀ ▶";
          this.moveLabel = "Move";
          this.revealProfileTiles();
          this.$select("profile0")?.$focus();
        }, 50);
      },
      revealProfileTiles() {
        for (let index = 0; index < 6; index++)
          (
            this.$select(`profile${index}`) as unknown as {
              reveal?: () => void;
            }
          )?.reveal?.();
        (
          this.$select("manageProfiles") as unknown as { reveal?: () => void }
        )?.reveal?.();
      },
      refreshProfileSlots() {
        const visible = this.profiles
          .slice(this.profilePage * 5, this.profilePage * 5 + 5)
          .map(profileTileData);
        if (this.profiles.length < 12) visible.push(addProfileTile);
        this.profileSlots = Array.from(
          { length: 6 },
          (_, index) => visible[index] ?? { ...emptyProfileTile },
        );
        this.profileStartX =
          (1920 - (visible.length * 220 + (visible.length - 1) * 64)) / 2;
      },
      moveProfile(slot: number, delta: number) {
        const count = this.profileSlots.filter((tile) => tile.visible).length;
        const next = Math.max(0, Math.min(count - 1, slot + delta));
        // Record intent before SolidTV applies focus on its next frame. A fast
        // Right+Enter must activate the newly intended tile, not the old one.
        this.profileFocus = next;
        this.profileFocusTarget = "tile";
        this.$select(`profile${next}`)?.$focus();
      },
      toggleManageProfiles() {
        this.managing = !this.managing;
        this.profilesLabel = this.managing
          ? "Manage profiles"
          : "Who's watching?";
        this.selectLabel = this.managing ? "Edit" : "Select";
        this.profileFocusTarget = "tile";
        this.profileFocus = 0;
        (
          this.$select("manageProfiles") as unknown as { reveal?: () => void }
        )?.reveal?.();
        setTimeout(() => {
          this.revealProfileTiles();
          this.$select("profile0")?.$focus();
        }, 0);
      },
      async activateProfile(_slot: number) {
        if (this.selectingProfile) return;
        if (this.profileFocusTarget === "manage") {
          this.toggleManageProfiles();
          return;
        }
        const tile = this.profileSlots[this.profileFocus];
        if (!tile?.visible) return;
        if (tile.add || this.managing) {
          void this.editProfile(tile.add ? undefined : tile.id);
          return;
        }
        this.profileError = "";
        this.selectingProfile = true;
        try {
          await api.selectProfile(tile.id);
          void this.loadHome(tile.id);
        } catch (cause) {
          this.profileError =
            cause instanceof Error
              ? cause.message
              : "Could not open this profile.";
        } finally { this.selectingProfile = false; }
      },
      async editProfile(id?: string) {
        if (this.phase !== "profiles" || disposeProfileEditor) return;
        const profile = id ? this.profiles.find((candidate) => candidate.id === id) : undefined;
        const focus = this.profileFocus;
        this.profileError = "";
        try {
          const { openProfileEditor } = await import("./profileEditorBridge");
          if (this.phase !== "profiles") return;
          disposeProfileEditor = openProfileEditor(api, profile, profile?.id === this.profiles[0]?.id,
            async () => {
              this.profiles = [...await api.profiles()];
              this.profilePage = Math.min(this.profilePage, Math.max(0, Math.ceil(this.profiles.length / 5) - 1));
              this.refreshProfileSlots();
            },
            () => {
              disposeProfileEditor = undefined;
              this.profileFocus = Math.min(focus, this.profileSlots.filter((slot) => slot.visible).length - 1);
              setTimeout(() => {
                this.revealProfileTiles();
                this.$select(`profile${this.profileFocus}`)?.$focus();
              }, 0);
            },
          );
        } catch (cause) {
          this.profileError = cause instanceof Error ? cause.message : "Could not open profile editor.";
        }
      },
      async beginPairing() {
        const generation = ++pairingGeneration;
        pairingScope?.abort();
        clearTimeout(pairingTimer);
        pairingScope = api.createScope();
        this.phase = "pairing";
        // Initially hidden text nodes are not rasterized by the current
        // WebGL web-font path. Populate labels after the pairing tree shows.
        setTimeout(() => {
          if (generation !== pairingGeneration) return;
          this.markLabel = "V";
          this.brandLabel = "VIPTV";
          this.titleLabel = "Sign in to VIPTV";
          this.introLabel =
            "Visit this address, then enter the code shown below.";
          this.expiredLabel = "This code expired.";
          this.retryLabel = "Try again";
          this.retryIcon = "⟳";
          this.okLabel = "OK";
          this.selectLabel = "Select";
          this.moveIcon = "◀ ▶";
          this.moveLabel = "Move";
        }, 50);
        this.address = "Connecting…";
        this.code = "••••••";
        this.qr = "";
        this.error = "";
        try {
          const code = await api.beginPairing(`viptv ${platform}`, {
            signal: pairingScope.signal,
          });
          if (generation !== pairingGeneration) return;
          this.address = code.verificationUri.replace(/^https?:\/\//i, "");
          this.code = code.userCode;
          this.qr = await QRCode.toDataURL(
            code.verificationUriComplete || code.verificationUri,
          );
          if (generation !== pairingGeneration) return;
          const expiresAt = Date.now() + code.expiresIn * 1000;
          const poll = async (pair: DevicePairing) => {
            if (generation !== pairingGeneration) return;
            if (Date.now() > expiresAt) {
              this.phase = "expired";
              this.expiredLabel = "";
              setTimeout(() => {
                if (generation === pairingGeneration)
                  this.expiredLabel = "This code expired.";
              }, 50);
              return;
            }
            try {
              await api.claimPairing(pair.deviceCode, {
                signal: pairingScope?.signal,
              });
              if (generation !== pairingGeneration) return;
              const identity = await api.me({ signal: pairingScope?.signal });
              if (generation === pairingGeneration)
                this.showProfiles(identity.profiles);
            } catch (cause) {
              if (
                generation !== pairingGeneration ||
                pairingScope?.signal.aborted
              )
                return;
              const status = (cause as { status?: number }).status;
              if (status === 400 || status === 428) {
                pairingTimer = setTimeout(
                  () => void poll(pair),
                  Math.max(1, pair.intervalSeconds) * 1000,
                );
              } else {
                this.error =
                  cause instanceof Error
                    ? cause.message
                    : "The TV could not complete this request.";
                this.phase = "error";
              }
            }
          };
          pairingTimer = setTimeout(
            () => void poll(code),
            Math.max(1, code.intervalSeconds) * 1000,
          );
        } catch (cause) {
          if (generation !== pairingGeneration || pairingScope?.signal.aborted)
            return;
          this.error =
            cause instanceof Error
              ? cause.message
              : "The TV could not complete this request.";
          this.phase = "error";
        }
      },
    },
    input: {
      // SolidTV dispatches key-down and invokes a returned callback on key-up.
      // This keeps the existing release-to-activate semantics on this screen.
      enter() {
        if (
          this.phase !== "expired" &&
          this.phase !== "error" &&
          this.phase !== "pairing"
        )
          return;
        return () => void this.beginPairing();
      },
      back() {
        if (this.liveDetailsOpen) this.closeLiveDetails();
        else if (this.titleMenuOpen) this.closeTitleMenu();
        else if (this.railExpanded) this.closeRail();
        else if (this.discoverFilterOpen) this.closeDiscoverFilter();
        else if (this.phase === "profiles" && this.managing)
          this.toggleManageProfiles();
        else if (this.phase === "playerTracks") this.closeTrackPanel();
        else if (this.phase === "player") {
          if (this.playerPreparingNext) {
            nextScope?.abort();
            nextScope = undefined;
            playback?.controller.cancelNext();
            this.playerPreparingNext = false;
            showPreparingSpinner(false);
          } else if (this.trackPanelOpen) this.closeTrackPanel();
          else if (this.playerSeekPreview !== null) {
            this.playerSeekPreview = null;
            this.playerSeekLabel = "";
            this.playerLegend =
              "OK  Select     ◀ ▶  Move     BACK  Hide controls";
            if (this.playerSnapshot)
              this.updatePlayerSnapshot(this.playerSnapshot);
          } else if (this.playerOverlay) {
            this.playerOverlay = false;
            this.setPlayerShade(false);
            clearTimeout(chromeTimer);
            this.$focus();
          } else void this.exitPlayer();
        } else if (this.phase === "preparing") void this.exitPlayer();
        else if (this.phase === "sourceDetails") this.closeSourceDetails();
        else if (this.phase === "provider") this.closeProviderPicker();
        else if (this.phase === "sources") this.closeSources();
        else if (this.phase === "detail") this.returnFromDetail();
        else if (this.phase === "discover") this.returnFromDiscover();
        else if (this.phase === "library") this.returnFromLibrary();
        else if (this.phase === "search") this.backFromSearch();
        else if (this.phase === "settings") this.backFromSettings();
        else if (this.phase === "live") {
          if (this.liveSearchOpen) this.closeLiveSearch();
          else this.returnFromLive();
        } else if (this.phase === "home" && this.profiles.length)
          this.showProfiles(this.profiles);
      },
      any() {
        if (this.phase === "player" && !this.playerOverlay)
          this.focusPlayerControl(1);
      },
    },

    render: (s) => (
      <TvView
        w={1920}
        h={1080}
        color={
          s.phase === "player" ||
          s.phase === "playerTracks" ||
          s.phase === "preparing"
            ? "rgba(0,0,0,0)"
            : s.background
        }
      >
        <TvView
          x={260}
          y={86}
          w={1400}
          h={800}
          src={s.pairingGlow}
          show={
            s.phase === "pairing" ||
            s.phase === "expired" ||
            s.phase === "error"
          }
        />
        <TvView
          x={260}
          y={82}
          w={1400}
          h={700}
          src={s.profilesGlow}
          show={s.phase === "profiles"}
        />
        <TvView
          show={
            s.phase === "pairing" ||
            s.phase === "expired" ||
            s.phase === "error"
          }
        >
          <TvView
            x={s.brandX}
            y={s.brandY}
            w={52}
            h={52}
            rounded={12}
            color={s.accent}
          />
          <TvText
            x={107}
            y={59}
            content={s.markLabel}
            font={"Bricolage800"}
            size={36}
            color={s.onAccent}
          />
          <TvText
            x={166}
            y={56}
            content={s.brandLabel}
            font={"Bricolage800"}
            size={40}
            color={s.primary}
          />
          <TvText
            x={s.bodyX}
            y={s.bodyY}
            content={s.titleLabel}
            font={"Bricolage700"}
            size={56}
            color={s.primary}
          />
          <TvText
            x={s.bodyX}
            y={342}
            content={s.introLabel}
            font={"Onest"}
            size={26}
            color={s.body}
          />
          <TvText
            x={s.bodyX}
            y={402}
            content={s.address}
            font={"Onest600"}
            size={32}
            color={s.primary}
          />
          <TvView
            x={s.bodyX}
            y={s.codeY}
            w={636}
            h={124}
            rounded={24}
            color={s.field}
          />
          <TvText
            x={226}
            y={487}
            content={s.code}
            font={"Bricolage800"}
            size={s.codeSize}
            letterspacing={s.codeLetterSpacing}
            color={s.phase === "expired" ? s.tertiary : s.primary}
          />
          <TvView
            x={226}
            y={537}
            w={560}
            h={2}
            show={s.phase === "expired"}
            color={s.tertiary}
          />
          <TvText
            x={s.bodyX}
            y={658}
            show={s.phase === "expired"}
            content={s.expiredLabel}
            font={"Onest"}
            size={26}
            color={s.primary}
          />
          <TvText
            x={s.bodyX}
            y={658}
            show={s.phase === "error"}
            content={s.error}
            font={"Onest"}
            size={26}
            color={s.primary}
            maxwidth={900}
          />
          <TvView
            x={182}
            y={
              s.phase === "expired" || s.phase === "error"
                ? s.actionY + 110
                : s.actionY
            }
            w={248}
            h={84}
            rounded={42}
            color={s.white}
          />
          <TvView
            x={186}
            y={s.phase === "expired" || s.phase === "error" ? 755 : 645}
            w={240}
            h={76}
            rounded={38}
            color={s.primary}
          />
          <TvText
            x={224}
            y={s.phase === "expired" || s.phase === "error" ? 770 : 660}
            content={s.retryIcon}
            font={"Onest"}
            size={28}
            color={s.onLight}
          />
          <TvText
            x={263}
            y={s.phase === "expired" || s.phase === "error" ? 771 : 661}
            content={s.retryLabel}
            font={"Onest700"}
            size={26}
            color={s.onLight}
          />
          <TvView
            x={s.qrX}
            y={s.qrY}
            w={s.qrSize}
            h={s.qrSize}
            rounded={28}
            color={s.qr ? s.white : s.field}
            alpha={s.phase === "expired" ? 0.18 : 1}
          />
          <TvView
            x={1392}
            y={294}
            w={312}
            h={312}
            show={s.qr !== ""}
            src={s.qr}
            alpha={s.phase === "expired" ? 0.18 : 1}
          />
        </TvView>
        <TvText
          x={96}
          y={54}
          show={s.phase === "starting"}
          content={s.startingLabel}
          font={"Onest"}
          size={28}
          color={s.primary}
        />
        <TvView show={s.phase === "profiles"}>
          <TvText
            x={96}
            y={56}
            content={s.profilesWordmark}
            font={"Bricolage800"}
            size={40}
            color={s.primary}
          />
          <TvText
            x={0}
            y={230}
            maxwidth={1920}
            align={"center"}
            content={s.profilesLabel}
            font={"Bricolage700"}
            size={64}
            color={s.primary}
          />
          <ProfileTile
            screenRef={"profile0"}
            position={0}
            tile={s.profileSlots[0]}
            x={s.profileStartX}
            managing={s.managing}
          />
          <ProfileTile
            screenRef={"profile1"}
            position={1}
            tile={s.profileSlots[1]}
            x={s.profileStartX + 284}
            managing={s.managing}
          />
          <ProfileTile
            screenRef={"profile2"}
            position={2}
            tile={s.profileSlots[2]}
            x={s.profileStartX + 568}
            managing={s.managing}
          />
          <ProfileTile
            screenRef={"profile3"}
            position={3}
            tile={s.profileSlots[3]}
            x={s.profileStartX + 852}
            managing={s.managing}
          />
          <ProfileTile
            screenRef={"profile4"}
            position={4}
            tile={s.profileSlots[4]}
            x={s.profileStartX + 1136}
            managing={s.managing}
          />
          <ProfileTile
            screenRef={"profile5"}
            position={5}
            tile={s.profileSlots[5]}
            x={s.profileStartX + 1420}
            managing={s.managing}
          />
          <ManageProfilesButton
            screenRef={"manageProfiles"}
            managing={s.managing}
          />
          <ProfilePagerButton screenRef={"profilePager0"} position={0} label={"Previous"} disabled={s.profilePage === 0} x={710} y={852} show={s.profiles.length > 5} />
          <TvText x={930} y={866} maxwidth={60} align={"center"} content={`${s.profilePage + 1} / ${Math.ceil(s.profiles.length / 5)}`} font={"Onest600"} size={22} color={s.secondary} show={s.profiles.length > 5} />
          <ProfilePagerButton screenRef={"profilePager1"} position={1} label={"Next"} disabled={s.profilePage + 1 >= Math.ceil(s.profiles.length / 5)} x={1000} y={852} show={s.profiles.length > 5} />
          <TvText
            x={600}
            y={s.profiles.length > 5 ? 940 : 852}
            maxwidth={720}
            align={"center"}
            content={s.profileError}
            font={"Onest"}
            size={22}
            color={s.danger}
          />
        </TvView>
        <TvView
          show={
            s.phase === "home" ||
            (s.sourceReturnOrigin === "home" &&
              (s.phase === "sources" ||
                s.phase === "provider" ||
                s.phase === "sourceDetails"))
          }
        >
          <TvView
            x={1120}
            y={0}
            w={800}
            h={720}
            src={s.home.heroImage}
            fit={"cover"}
            show={s.home.heroImage !== "" && s.homeShelfIndex === 0}
          />
          <TvView w={1920} h={1080} src={s.homeScrim} />
          <TvView show={s.homeShelfIndex === 0}>
          <TvText
            x={192}
            y={150}
            content={s.home.eyebrow}
            font={"Onest700"}
            size={20}
            color={s.secondary}
          />
          <TvView
            x={192}
            y={196}
            w={410}
            h={118}
            fit={"contain"}
            src={s.home.titleLogo}
            show={s.home.titleLogo !== ""}
          />
          <TvText
            x={192}
            y={196}
            maxwidth={760}
            content={s.home.title}
            font={"Bricolage700"}
            size={56}
            color={s.primary}
            show={s.home.titleLogo === ""}
          />
          <TvText
            x={192}
            y={340}
            maxwidth={420}
            maxlines={1}
            content={s.home.episodeLabel}
            font={"Onest600"}
            size={24}
            color={s.primary}
          />
          <TvView
            x={636}
            y={349}
            w={180}
            h={6}
            color={s.secondary}
            show={s.home.progress > 0}
          />
          <TvView
            x={636}
            y={349}
            w={Math.max(0, Math.min(180, s.home.progress * 180))}
            h={6}
            color={s.accent}
            show={s.home.progress > 0}
          />
          <TvText
            x={836}
            y={339}
            content={s.home.progressText}
            font={"Onest"}
            size={24}
            color={s.secondary}
          />
          <TvText
            x={192}
            y={390}
            content={s.home.meta}
            font={"Onest"}
            size={22}
            color={s.secondary}
          />
          <TvText
            x={192}
            y={448}
            maxwidth={760}
            maxlines={2}
            content={s.home.synopsis}
            font={"Onest"}
            size={26}
            color={s.body}
          />
          <HomeAction
            screenRef={"heroAction0"}
            position={0}
            action={"play"}
            label={s.home.playLabel}
            icon={"▶"}
            x={192}
            y={550}
            buttonWidth={228}
            buttonHeight={72}
            round={false}
            holdable={true}
          />
          <HomeAction
            screenRef={"heroAction1"}
            position={1}
            action={"details"}
            label={"Details"}
            icon={""}
            x={438}
            y={550}
            buttonWidth={228}
            buttonHeight={72}
            round={false}
            holdable={false}
          />
          <HomeAction
            screenRef={"heroAction2"}
            position={2}
            action={"save"}
            label={s.homeAddLabel}
            icon={s.homeAddLabel}
            x={684}
            y={550}
            buttonWidth={72}
            buttonHeight={72}
            round={true}
            holdable={false}
          />
          </TvView>
          <TvText
            x={192}
            y={s.homeShelfIndex === 0 ? 700 : 160}
            content={s.homeShelfLabel}
            font={"Bricolage700"}
            size={32}
            color={s.primary}
          />
          <TvView x={188} y={s.homeShelfIndex === 0 ? 753 : 214} w={1640} h={278} clipping={true}>
            <KeyedFor each={s.homeCards.map((card, slot) => ({ card, slot }))} keyOf={entry => entry.slot}>
              {(entry) => <HomeCard screenRef={`homeCard${entry().slot}`} position={s.homeCardWindowStart + entry().slot} card={entry().card} x={4 + s.homeWindowX + entry().slot * 356} y={4} />}
            </KeyedFor>
          </TvView>
          <TvView show={s.homeShelfIndex > 0 && s.homeNextShelfLabel !== ""}>
            <TvText x={192} y={516} content={s.homeNextShelfLabel} font={"Bricolage700"} size={32} color={s.primary} />
            <HomePreviewCard card={s.homeNextCards[0]} x={192} />
            <HomePreviewCard card={s.homeNextCards[1]} x={548} />
            <HomePreviewCard card={s.homeNextCards[2]} x={904} />
            <HomePreviewCard card={s.homeNextCards[3]} x={1260} />
            <HomePreviewCard card={s.homeNextCards[4]} x={1616} />
          </TvView>
          <TvText
            x={700}
            y={110}
            maxwidth={520}
            align={"center"}
            content={s.homeNotice}
            font={"Onest"}
            size={22}
            color={s.primary}
          />
        </TvView>
        <DiscoverScreen
          screenRef={"discoverScreen"}
          show={
            s.phase === "discover" ||
            (s.sourceReturnOrigin === "discover" &&
              (s.phase === "sources" ||
                s.phase === "provider" ||
                s.phase === "sourceDetails"))
          }
          homeProfileAvatar={s.homeProfileAvatar}
          railSearch={s.railSearch}
          railHome={s.railHome}
          railDiscoverSelected={s.railDiscoverSelected}
          railLive={s.railLive}
          railList={s.railList}
          railSettings={s.railSettings}
          surface={s.surface}
          discoverHeading={s.discoverHeading}
          discoverChips={s.discoverChips}
          discoverCards={s.discoverCards}
          discoverWindowStart={s.discoverWindowStart}
          discoverError={s.discoverError}
          discoverOkLabel={s.discoverOkLabel}
          discoverSelectLabel={s.discoverSelectLabel}
          discoverOptionsIcon={s.discoverOptionsIcon}
          discoverOptionsLabel={s.discoverOptionsLabel}
          background={s.background}
          primary={s.primary}
          body={s.body}
          keyBorder={s.keyBorder}
        />
        <LibraryScreen
          screenRef={"libraryScreen"}
          show={
            s.phase === "library" ||
            (s.sourceReturnOrigin === "library" &&
              (s.phase === "sources" ||
                s.phase === "provider" ||
                s.phase === "sourceDetails"))
          }
          homeProfileAvatar={s.homeProfileAvatar}
          railSearch={s.railSearch}
          railHomeUnselected={s.railHomeUnselected}
          railDiscover={s.railDiscover}
          railLive={s.railLive}
          railListSelected={s.railListSelected}
          railSettings={s.railSettings}
          surface={s.surface}
          libraryHeading={s.libraryHeading}
          libraryMode={s.libraryMode}
          libraryCards={s.libraryCards}
          libraryWindowStart={s.libraryWindowStart}
          libraryError={s.libraryError}
          libraryOkLabel={s.libraryOkLabel}
          librarySelectLabel={s.librarySelectLabel}
          libraryOptionsIcon={s.libraryOptionsIcon}
          libraryOptionsLabel={s.libraryOptionsLabel}
          background={s.background}
          primary={s.primary}
          body={s.body}
          keyBorder={s.keyBorder}
        />
        <SearchScreen
          screenRef={"searchScreen"}
          show={
            s.phase === "search" ||
            (s.sourceReturnOrigin === "search" &&
              (s.phase === "sources" ||
                s.phase === "provider" ||
                s.phase === "sourceDetails"))
          }
          homeProfileAvatar={s.homeProfileAvatar}
          railSearchSelected={s.railSearchSelected}
          railHomeUnselected={s.railHomeUnselected}
          railDiscover={s.railDiscover}
          railLive={s.railLive}
          railList={s.railList}
          railSettings={s.railSettings}
          surface={s.surface}
          background={s.background}
          primary={s.primary}
          body={s.body}
          keyBorder={s.keyBorder}
          heading={s.searchHeading}
          query={s.searchQuery}
          placeholder={s.searchPlaceholder}
          caretX={s.searchCaretX}
          keys={s.searchKeys}
          headings={s.searchHeadings}
          cards={s.searchVisibleCards}
          status={s.searchStatus}
          okLabel={s.searchOkLabel}
          typeLabel={s.searchTypeLabel}
          jumpIcon={s.searchJumpIcon}
          jumpLabel={s.searchJumpLabel}
          backLabel={s.searchBackLabel}
          deleteLabel={s.searchDeleteLabel}
        />
        <LiveScreen
          screenRef={"liveScreen"}
          show={
            (s.phase === "live" && s.liveSearchOpen === false) ||
            (s.sourceReturnOrigin === "live" &&
              (s.phase === "sources" ||
                s.phase === "provider" ||
                s.phase === "sourceDetails"))
          }
          chrome={s.liveChrome}
          hero={s.liveHero}
          filters={s.liveFilters}
          channels={s.liveRows}
          programs={s.livePrograms}
          timeline={s.liveTimeline}
          nowX={s.liveNowX}
          nowLabel={s.liveNowLabel}
          status={s.liveStatus}
        />
        <LiveSearchScreen
          screenRef={"liveSearchScreen"}
          show={s.liveSearchOpen}
          view={s.liveSearchView}
        />
        <SettingsScreen
          screenRef={"settingsScreen"}
          show={s.phase === "settings"}
          view={s.settingsView}
          panel={s.settingsPanel}
          dialogOpen={s.settingsDialogOpen}
          dialog={s.settingsDialogView}
        />
        <TvView
          show={
            s.phase === "detail" ||
            (s.sourceReturnOrigin === "detail" &&
              (s.phase === "sources" ||
                s.phase === "provider" ||
                s.phase === "sourceDetails"))
          }
        >
          <TvView
            x={1120}
            y={0}
            w={800}
            h={720}
            src={s.detail.heroImage}
            fit={"cover"}
            show={s.detail.heroImage !== ""}
          />
          <TvView w={1920} h={1080} src={s.homeScrim} />
          <TvView
            x={192}
            y={96}
            w={310}
            h={90}
            fit={"contain"}
            src={s.detail.titleLogo}
            show={s.detail.titleLogo !== ""}
          />
          <TvText
            x={192}
            y={96}
            maxwidth={850}
            content={s.detail.title}
            font={"Bricolage700"}
            size={56}
            color={s.primary}
            show={s.detail.titleLogo === ""}
          />
          <TvText
            x={192}
            y={211}
            maxwidth={1300}
            maxlines={1}
            content={s.detail.facts}
            font={"Onest"}
            size={22}
            color={s.secondary}
          />
          <TvText
            x={192}
            y={268}
            maxwidth={780}
            maxlines={2}
            content={s.detail.synopsis}
            font={"Onest"}
            size={26}
            color={s.body}
          />
          <TitleAction
            screenRef={"titleAction0"}
            position={0}
            action={"play"}
            label={s.detail.playLabel}
            icon={"▶"}
            buttonWidth={298}
            holdable={true}
            x={192}
            y={369}
          />
          <TitleAction
            screenRef={"titleAction1"}
            position={1}
            action={"source"}
            label={s.detail.sourceLabel}
            icon={""}
            buttonWidth={292}
            holdable={false}
            x={510}
            y={369}
          />
          <TitleAction
            screenRef={"titleAction2"}
            position={2}
            action={"save"}
            label={"My List"}
            icon={s.detailSaveIcon}
            buttonWidth={200}
            holdable={false}
            x={822}
            y={369}
          />
          <TitleAction
            screenRef={"titleAction3"}
            position={3}
            action={"info"}
            label={"More info"}
            icon={"ⓘ"}
            buttonWidth={230}
            holdable={false}
            x={1042}
            y={369}
          />
          <SeasonControl screenRef={"titleSeason"} label={s.detailSeasonLabel} x={192} y={570} show={s.detail.allEpisodes.length > 0} />
          <TvText x={416} y={582} content={s.detailCountLabel} font={"Onest"} size={22} color={s.tertiary} show={s.detail.allEpisodes.length > 0} />
          <TvView x={188} y={642} w={1640} h={388} clipping={true}>
            <KeyedFor each={s.detailEpisodes.map((episode, slot) => ({ episode, slot }))} keyOf={entry => entry.slot}>
              {(entry) => <EpisodeTile screenRef={`titleEpisode${entry().slot}`} position={s.detailWindowStart + entry().slot} episode={entry().episode} x={4 + s.detailWindowX + entry().slot * 396} y={4} />}
            </KeyedFor>
          </TvView>
          <TvText
            x={700}
            y={54}
            maxwidth={600}
            align={"center"}
            content={s.detailNotice}
            font={"Onest"}
            size={22}
            color={s.primary}
          />
        </TvView>
        <CollapsedRail avatar={s.homeProfileAvatar} current={s.railCurrent} show={!s.railExpanded && ["home", "detail", "discover", "library", "search", "live", "settings", "sources", "provider", "sourceDetails"].includes(s.phase)} />
        <TvView show={s.phase === "sources" || s.phase === "sourceDetails"}>
          <TvView w={1920} h={1080} color={s.sourceScrim} />
          <TvView x={1100} y={0} w={820} h={1080} color={s.sourcePanelGround} />
          <TvText
            x={1164}
            y={64}
            content={s.sourcePanelTitle}
            font={"Bricolage700"}
            size={44}
            color={s.primary}
          />
          <TvText
            x={1164}
            y={132}
            maxwidth={660}
            maxlines={1}
            content={s.source.status}
            font={"Onest"}
            size={22}
            color={s.secondary}
          />
          <SourceChip
            screenRef={"sourceChip0"}
            position={0}
            chip={s.sourceChips[0]}
            chipWidth={104}
            x={1164}
            y={188}
          />
          <SourceChip
            screenRef={"sourceChip1"}
            position={1}
            chip={s.sourceChips[1]}
            chipWidth={80}
            x={1280}
            y={188}
          />
          <SourceChip
            screenRef={"sourceChip2"}
            position={2}
            chip={s.sourceChips[2]}
            chipWidth={145}
            x={1372}
            y={188}
          />
          <SourceChip
            screenRef={"sourceChip3"}
            position={3}
            chip={s.sourceChips[3]}
            chipWidth={125}
            x={1529}
            y={188}
          />
          <SourceChip
            screenRef={"sourceChip4"}
            position={4}
            chip={s.sourceChips[4]}
            chipWidth={95}
            x={1666}
            y={188}
          />
          <SourceProvider
            screenRef={"sourceProvider"}
            label={s.sourceProviderLabel}
            x={1164}
            y={255}
          />
          <SourceRow
            screenRef={"sourceRow0"}
            position={0}
            row={s.sourceRows[0]}
            x={1164}
            y={326}
          />
          <SourceRow
            screenRef={"sourceRow1"}
            position={1}
            row={s.sourceRows[1]}
            x={1164}
            y={444}
          />
          <SourceRow
            screenRef={"sourceRow2"}
            position={2}
            row={s.sourceRows[2]}
            x={1164}
            y={562}
          />
          <SourceRow
            screenRef={"sourceRow3"}
            position={3}
            row={s.sourceRows[3]}
            x={1164}
            y={680}
          />
          <SourceRow
            screenRef={"sourceRow4"}
            position={4}
            row={s.sourceRows[4]}
            x={1164}
            y={798}
          />
          <SourceRow
            screenRef={"sourceRow5"}
            position={5}
            row={s.sourceRows[5]}
            x={1164}
            y={916}
          />
          <TvText
            x={1164}
            y={1034}
            maxwidth={640}
            content={s.sourceNotice}
            font={"Onest"}
            size={20}
            color={s.secondary}
          />
          <TvView
            x={1392}
            y={993}
            w={45}
            h={33}
            rounded={8}
            color={s.keyBorder}
          />
          <TvView
            x={1394}
            y={995}
            w={41}
            h={29}
            rounded={6}
            color={s.sourcePanelGround}
          />
          <TvText
            x={1403}
            y={999}
            content={s.sourceOkLabel}
            font={"Onest700"}
            size={16}
            color={s.primary}
          />
          <TvText
            x={1448}
            y={998}
            content={s.sourcePlayLabel}
            font={"Onest"}
            size={20}
            color={s.secondary}
          />
          <TvView
            x={1526}
            y={993}
            w={60}
            h={33}
            rounded={8}
            color={s.keyBorder}
          />
          <TvView
            x={1528}
            y={995}
            w={56}
            h={29}
            rounded={6}
            color={s.sourcePanelGround}
          />
          <TvText
            x={1534}
            y={999}
            content={s.sourceArrowLabel}
            font={"Onest"}
            size={16}
            color={s.primary}
          />
          <TvText
            x={1592}
            y={998}
            content={s.sourceQualityLabel}
            font={"Onest"}
            size={20}
            color={s.secondary}
          />
          <TvView
            x={1693}
            y={993}
            w={66}
            h={33}
            rounded={8}
            color={s.keyBorder}
          />
          <TvView
            x={1695}
            y={995}
            w={62}
            h={29}
            rounded={6}
            color={s.sourcePanelGround}
          />
          <TvText
            x={1702}
            y={999}
            content={s.sourceBackLabel}
            font={"Onest700"}
            size={16}
            color={s.primary}
          />
          <TvText
            x={1768}
            y={998}
            content={s.sourceCloseLabel}
            font={"Onest"}
            size={20}
            color={s.secondary}
          />
        </TvView>
        <TvView show={s.phase === "provider"}>
          <TvView w={1920} h={1080} color={s.sourceScrim} />
          <TvView x={1100} y={0} w={820} h={1080} color={s.sourcePanelGround} />
          <TvText
            x={1164}
            y={64}
            content={s.providerPanelTitle}
            font={"Bricolage700"}
            size={44}
            color={s.primary}
          />
          <ProviderOption
            screenRef={"providerOption0"}
            position={0}
            choice={s.providerChoices[0]}
            x={1164}
            y={126}
          />
          <ProviderOption
            screenRef={"providerOption1"}
            position={1}
            choice={s.providerChoices[1]}
            x={1164}
            y={220}
          />
          <ProviderOption
            screenRef={"providerOption2"}
            position={2}
            choice={s.providerChoices[2]}
            x={1164}
            y={314}
          />
          <ProviderOption
            screenRef={"providerOption3"}
            position={3}
            choice={s.providerChoices[3]}
            x={1164}
            y={408}
          />
          <ProviderOption
            screenRef={"providerOption4"}
            position={4}
            choice={s.providerChoices[4]}
            x={1164}
            y={502}
          />
          <ProviderOption
            screenRef={"providerOption5"}
            position={5}
            choice={s.providerChoices[5]}
            x={1164}
            y={596}
          />
        </TvView>
        <TvView show={s.phase === "sourceDetails"}>
          <TvView w={1920} h={1080} color={s.sourceDetailsScrim} />
          <TvText
            x={192}
            y={95}
            content={s.sourceDetailsHeading}
            font={"Bricolage700"}
            size={56}
            color={s.primary}
          />
          <TvView
            x={192}
            y={173}
            w={1536}
            h={759}
            rounded={24}
            color={s.sourcePanelGround}
          />
          <TvText
            x={226}
            y={210}
            maxwidth={1440}
            maxheight={690}
            lineheight={65}
            content={s.sourceDetailsBody}
            font={"Onest"}
            size={28}
            color={s.body}
          />
          <TvView
            x={1704}
            y={204}
            w={6}
            h={222}
            rounded={3}
            color={s.scrollbar}
          />
          <SourceDetailsClose
            screenRef={"sourceDetailsClose"}
            x={185}
            y={949}
          />
        </TvView>
        <TvView show={s.phase === "preparing" || s.playerPreparingNext}>
          <TvView
            x={682}
            y={430}
            w={556}
            h={220}
            rounded={28}
            color={s.sourcePanelGround}
          />
          <TvText
            x={682}
            y={560}
            maxwidth={556}
            align={"center"}
            content={s.preparingText}
            font={"Onest700"}
            size={32}
            color={s.primary}
          />
        </TvView>
        <TvView
          show={
            (s.phase === "player" || s.phase === "playerTracks") &&
            s.playerOverlay
          }
        >
          <TvText
            x={96}
            y={76}
            content={s.playerTitle}
            font={"Onest700"}
            size={24}
            color={s.primary}
          />
          <TvText
            x={1680}
            y={76}
            maxwidth={144}
            align={"right"}
            content={s.playerStatus}
            font={"Onest700"}
            size={20}
            color={s.primary}
          />
          <TvText
            x={96}
            y={s.playerSeekPreview !== null ? 560 : 610}
            content={s.nowPlayingLabel}
            font={"Onest700"}
            size={20}
            color={s.secondary}
          />
          <TvText
            x={96}
            y={s.playerSeekPreview !== null ? 597 : 647}
            content={s.playerEpisodeLine}
            font={"Onest600"}
            size={26}
            color={s.primary}
            show={s.playerEpisodeLine !== ""}
          />
          <TvText
            x={96}
            y={s.playerSeekPreview !== null ? (s.playerEpisodeLine ? 640 : 597) : (s.playerEpisodeLine ? 690 : 647)}
            maxwidth={1300}
            maxlines={1}
            content={s.playerTitle}
            font={"Bricolage700"}
            size={56}
            color={s.primary}
          />
          <PlayerTimeline
            screenRef={"playerTimeline"}
            show={s.playerItem?.type !== "live"}
            progress={s.playerProgress}
            seeking={s.playerSeekPreview !== null}
            previewText={s.playerSeekLabel}
            x={96}
            y={780}
          />
          <TvText
            x={96}
            y={826}
            content={s.playerPositionText}
            show={s.playerItem?.type !== "live"}
            font={"Onest700"}
            size={22}
            color={s.primary}
          />
          <TvText
            x={1640}
            y={826}
            maxwidth={184}
            align={"right"}
            content={s.playerDurationText}
            show={s.playerItem?.type !== "live"}
            font={"Onest"}
            size={22}
            color={s.secondary}
          />
          <PlayerControl
            screenRef={"playerControl0"}
            show={s.playerItem?.type !== "live"}
            position={0}
            action={"back10"}
            icon={"≪"}
            diameter={72}
            x={96}
            y={878}
          />
          <PlayerControl
            screenRef={"playerControl1"}
            show={s.playerItem?.type !== "live"}
            position={1}
            action={"toggle"}
            icon={s.playerToggleIcon}
            diameter={84}
            x={181}
            y={872}
          />
          <PlayerControl
            screenRef={"playerControl2"}
            show={s.playerItem?.type !== "live"}
            position={2}
            action={"forward30"}
            icon={"≫"}
            diameter={72}
            x={276}
            y={878}
          />
          <PlayerControl
            screenRef={"playerControl3"}
            position={3}
            action={"next"}
            icon={"▶|"}
            diameter={72}
            x={366}
            y={878}
            show={s.playerItem?.type !== "live" && s.playerItem?.season !== undefined}
          />
          <PlayerControl
            screenRef={"playerControl4"}
            position={4}
            action={"audio"}
            icon={"≋"}
            diameter={72}
            x={1572}
            y={878}
          />
          <PlayerControl
            screenRef={"playerControl5"}
            position={5}
            action={"subtitles"}
            icon={"▤"}
            diameter={72}
            x={1662}
            y={878}
          />
          <PlayerControl
            screenRef={"playerControl6"}
            position={6}
            action={"exit"}
            icon={"↪"}
            diameter={72}
            x={1752}
            y={878}
          />
          <TvText
            x={1390}
            y={1000}
            content={s.playerLegend}
            font={"Onest"}
            size={20}
            color={s.secondary}
          />
        </TvView>
        <TvText
          x={700}
          y={190}
          maxwidth={520}
          align={"center"}
          content={s.playerNotice}
          font={"Onest"}
          size={24}
          color={s.primary}
          show={s.phase === "player" || s.phase === "playerTracks"}
        />
        <TvView show={s.phase === "playerTracks"}>
          <TvView w={1920} h={1080} color={s.sourceScrim} />
          <TvView x={1100} y={0} w={820} h={1080} color={s.sourcePanelGround} />
          <TvText
            x={1164}
            y={64}
            content={s.trackPanelTitle}
            font={"Bricolage700"}
            size={44}
            color={s.primary}
          />
          <PlayerTrackOption
            screenRef={"playerTrack0"}
            position={0}
            choice={s.trackSlots[0]}
            x={1164}
            y={126}
          />
          <PlayerTrackOption
            screenRef={"playerTrack1"}
            position={1}
            choice={s.trackSlots[1]}
            x={1164}
            y={220}
          />
          <PlayerTrackOption
            screenRef={"playerTrack2"}
            position={2}
            choice={s.trackSlots[2]}
            x={1164}
            y={314}
          />
          <PlayerTrackOption
            screenRef={"playerTrack3"}
            position={3}
            choice={s.trackSlots[3]}
            x={1164}
            y={408}
          />
          <PlayerTrackOption
            screenRef={"playerTrack4"}
            position={4}
            choice={s.trackSlots[4]}
            x={1164}
            y={502}
          />
          <PlayerTrackOption
            screenRef={"playerTrack5"}
            position={5}
            choice={s.trackSlots[5]}
            x={1164}
            y={596}
          />
          <PlayerTrackOption
            screenRef={"playerTrack6"}
            position={6}
            choice={s.trackSlots[6]}
            x={1164}
            y={690}
          />
          <PlayerTrackOption
            screenRef={"playerTrack7"}
            position={7}
            choice={s.trackSlots[7]}
            x={1164}
            y={784}
          />
          <TvText
            x={1164}
            y={902}
            maxwidth={660}
            content={s.trackNotice}
            font={"Onest"}
            size={22}
            color={s.secondary}
          />
          <TvText
            x={1382}
            y={998}
            content={s.trackLegend}
            font={"Onest"}
            size={20}
            color={s.secondary}
          />
        </TvView>
        <TvView zIndex={10} show={s.discoverFilterOpen}>
          <TvView w={1920} h={1080} color={s.sourceScrim} />
          <TvView x={1100} y={0} w={820} h={1080} color={s.sourcePanelGround} />
          <TvText
            x={1164}
            y={64}
            content={s.discoverFilterTitle}
            font={"Bricolage700"}
            size={44}
            color={s.primary}
          />
          <DiscoverFilterOption
            screenRef={"discoverOption0"}
            position={0}
            label={s.discoverOptionLabels[0]}
            selected={s.discoverOptionLabels[0] === s.discoverFilterValue}
            visible={s.discoverOptionLabels[0] !== ""}
            x={1158}
            y={130}
          />
          <DiscoverFilterOption
            screenRef={"discoverOption1"}
            position={1}
            label={s.discoverOptionLabels[1]}
            selected={s.discoverOptionLabels[1] === s.discoverFilterValue}
            visible={s.discoverOptionLabels[1] !== ""}
            x={1158}
            y={224}
          />
          <DiscoverFilterOption
            screenRef={"discoverOption2"}
            position={2}
            label={s.discoverOptionLabels[2]}
            selected={s.discoverOptionLabels[2] === s.discoverFilterValue}
            visible={s.discoverOptionLabels[2] !== ""}
            x={1158}
            y={318}
          />
          <DiscoverFilterOption
            screenRef={"discoverOption3"}
            position={3}
            label={s.discoverOptionLabels[3]}
            selected={s.discoverOptionLabels[3] === s.discoverFilterValue}
            visible={s.discoverOptionLabels[3] !== ""}
            x={1158}
            y={412}
          />
          <DiscoverFilterOption
            screenRef={"discoverOption4"}
            position={4}
            label={s.discoverOptionLabels[4]}
            selected={s.discoverOptionLabels[4] === s.discoverFilterValue}
            visible={s.discoverOptionLabels[4] !== ""}
            x={1158}
            y={506}
          />
          <DiscoverFilterOption
            screenRef={"discoverOption5"}
            position={5}
            label={s.discoverOptionLabels[5]}
            selected={s.discoverOptionLabels[5] === s.discoverFilterValue}
            visible={s.discoverOptionLabels[5] !== ""}
            x={1158}
            y={600}
          />
          <DiscoverFilterOption
            screenRef={"discoverOption6"}
            position={6}
            label={s.discoverOptionLabels[6]}
            selected={s.discoverOptionLabels[6] === s.discoverFilterValue}
            visible={s.discoverOptionLabels[6] !== ""}
            x={1158}
            y={694}
          />
          <DiscoverFilterOption
            screenRef={"discoverOption7"}
            position={7}
            label={s.discoverOptionLabels[7]}
            selected={s.discoverOptionLabels[7] === s.discoverFilterValue}
            visible={s.discoverOptionLabels[7] !== ""}
            x={1158}
            y={788}
          />
          <TvView
            x={1100}
            y={976}
            w={820}
            h={104}
            color={s.sourcePanelGround}
          />
          <TvView
            x={1530}
            y={994}
            w={45}
            h={31}
            rounded={8}
            color={s.keyBorder}
          />
          <TvView
            x={1532}
            y={996}
            w={41}
            h={27}
            rounded={6}
            color={s.sourcePanelGround}
          />
          <TvText
            x={1538}
            y={1000}
            content={s.discoverFilterOkLabel}
            font={"Onest700"}
            size={16}
            color={s.primary}
          />
          <TvText
            x={1588}
            y={999}
            content={s.discoverFilterSelectLabel}
            font={"Onest"}
            size={20}
            color={s.body}
          />
          <TvView
            x={1682}
            y={994}
            w={66}
            h={31}
            rounded={8}
            color={s.keyBorder}
          />
          <TvView
            x={1684}
            y={996}
            w={62}
            h={27}
            rounded={6}
            color={s.sourcePanelGround}
          />
          <TvText
            x={1693}
            y={1000}
            content={s.discoverBackLabel}
            font={"Onest700"}
            size={16}
            color={s.primary}
          />
          <TvText
            x={1760}
            y={999}
            content={s.discoverCancelLabel}
            font={"Onest"}
            size={20}
            color={s.body}
          />
        </TvView>
        <LiveDetailsScreen
          screenRef={"liveDetailsScreen"}
          show={s.liveDetailsOpen}
          title={s.liveDetailsTitle}
          channel={s.liveDetailsChannel}
          range={s.liveDetailsRange}
          description={s.liveDetailsDescription}
          watchLabel={s.liveDetailsWatchLabel}
          closeLabel={s.liveDetailsCloseLabel}
          okLabel={s.liveDetailsOkLabel}
          selectLabel={s.liveDetailsSelectLabel}
          backLabel={s.liveDetailsBackLabel}
        />
        <TitleMenuScreen
          screenRef={"titleMenuScreen"}
          show={s.titleMenuOpen}
          heading={s.titleMenuHeading}
          choices={s.titleMenuSlots}
          notice={s.titleMenuNotice}
          okLabel={s.titleMenuOkLabel}
          selectLabel={s.titleMenuSelectLabel}
          backLabel={s.titleMenuBackLabel}
          cancelLabel={s.titleMenuCancelLabel}
        />
        <TvView
          zIndex={20}
          show={
            s.railExpanded &&
            (s.phase === "home" ||
              s.phase === "detail" ||
              s.phase === "discover" ||
              s.phase === "library" ||
              s.phase === "search" ||
              s.phase === "live" || s.phase === "settings")
          }
        >
          <TvView w={1920} h={1080} color={s.menuScrim} />
          <TvView w={520} h={1080} src={s.menuGradient} />
          <RailItem
            screenRef={"rail0"}
            position={0}
            label={"Profile"}
            icon={""}
            focusedIcon={""}
            avatar={s.homeProfileAvatar}
            profileName={s.railProfileName}
            current={false}
            x={48}
            y={48}
          />
          <KeyedFor each={[...railItems]} keyOf={item => item.index}>
            {item => <RailItem screenRef={`rail${item().index}`} position={item().index} label={item().label} icon={railIcon(item().icon, s.railCurrent === item().route)} focusedIcon={railIcon(item().icon, false, true)} avatar={""} profileName={""} current={s.railCurrent === item().route} x={48} y={item().y - 22} />}
          </KeyedFor>
          <TvText
            x={48}
            y={864}
            maxwidth={400}
            content={s.railNotice}
            font={"Onest"}
            size={20}
            color={s.secondary}
          />
        </TvView>
        <TvText
          x={96}
          y={54}
          show={s.phase === "ready"}
          content={s.startingLabel}
          font={"Onest"}
          size={28}
          color={s.primary}
        />
      </TvView>
    ),
  });
}
