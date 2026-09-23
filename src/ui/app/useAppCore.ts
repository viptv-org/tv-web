import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePlayerFullscreen } from "../../hooks/usePlayerFullscreen";
import { BrowserNavigation, readBrowserRoute, type BrowserRoute } from "../browserNavigation";
import { readStoredEngine, storeEngine } from "../enginePreference";
import { createAutoplayTestLogger, probeAutoplayTestMode, probeEngineOverride } from "../../testing/autoplay-harness";
import { isTauriRuntime, resolveTauriVideoInvoker, type NativeVideoEngine, type Player, type PlayerPlatform, type PlayerSnapshot, type PlaybackSessionController } from "@viptv/video";
import type { TvApi, MediaItem, MediaSource, Catalog, PlaybackSession, DevicePairing, TvProfile, PlaybackPreferences, PlaybackCapabilities } from "../../api";
import type { ErrorDetail } from "../errors";
import { captureScroll, desktopInvoker, initialPrefs, type BrowserSnapshot, type Choice, type ScrollAnchor } from "./appShared";
import type { Screen } from "../screens";
import type { HomeRow } from "./homeRows";

/**
 * The complete application state cell: every useState/useRef declaration the
 * App state machine owns, plus the trivial closures that only touch this
 * state (cast toggles, engine choice, the browser-route snapshot capture).
 * Every later stage hook destructures what it needs from the returned object,
 * so the moved bodies keep their original bare identifier names verbatim.
 */
export function useAppCore(api: TvApi, platform: PlayerPlatform, layout: "tv" | "responsive") {
  const responsive = layout === "responsive";
  const [casting, setCasting] = useState(false);
  const castFocus = useRef<HTMLElement | null>(null);
  const openCast = () => { castFocus.current = document.activeElement as HTMLElement; setCasting(true); };
  const closeCast = () => { setCasting(false); requestAnimationFrame(() => castFocus.current?.focus()); };
  const [oled, setOled] = useState(() => { try { return localStorage.getItem("viptv:appearance:oled") === "true"; } catch { return false; } });
  const toggleOled = () => setOled((previous) => { const next = !previous; try { localStorage.setItem("viptv:appearance:oled", String(next)); } catch { /* Appearance remains usable without storage. */ } return next; });

  const [engineChoice, setEngineChoice] = useState(readStoredEngine);
  const selectEngine = (engine: NativeVideoEngine) => {
    setEngineChoice(engine);
    storeEngine(engine);
  };
  const autoplayTest = useRef<{ enabled: boolean; log?: (snapshot: PlayerSnapshot) => void }>({ enabled: false });
  const [autoplayEnabled, setAutoplayEnabled] = useState(false);
  const autoplayStarted = useRef(false);
  // The desktop shell can launch as a test harness (VIPTV_TEST_AUTOPLAY) or
  // with an engine override (VIPTV_ENGINE). Both are per-launch facts read
  // once from the shell; the override never rewrites the persisted choice.
  useEffect(() => {
    if (!desktopInvoker) return;
    const shell = desktopInvoker;
    let cancelled = false;
    void probeEngineOverride(desktopInvoker).then((override) => {
      if (!cancelled && override) setEngineChoice(override);
    });
    void probeAutoplayTestMode(desktopInvoker).then((enabled) => {
      if (!cancelled) {
        setAutoplayEnabled(enabled);
        void shell.invoke("test_log", { message: `autoplay mode=${enabled ? "on" : "off"}` }).catch(() => undefined);
        if (enabled) {
          autoplayTest.current = { enabled: true, log: createAutoplayTestLogger(shell) };
        }
      }
    });
    return () => { cancelled = true; };
  }, []);
  const [compactHome, setCompactHome] = useState(false),
    [bootingHome, setBootingHome] = useState(false),
    [recentLive, setRecentLive] = useState<readonly MediaItem[]>([]),
    [homeRows, setHomeRows] = useState<readonly HomeRow[]>([]);
  const homeCache = useRef<{
    profile: string;
    queue: readonly MediaItem[];
    favorites: readonly MediaItem[];
    items: readonly MediaItem[];
    homeRows: readonly HomeRow[];
    recentLive: readonly MediaItem[];
  }>();
  const heroMetadataCache = useRef(new Map<string, MediaItem>());
  const [editingProfile, setEditingProfile] = useState<{
    profile?: TvProfile;
  }>();
  const [entry, setEntryState] = useState<{
      title: string;
      initialValue?: string;
      secret?: boolean;
      save: (value: string) => Promise<void>;
    }>(),
    [profilePage, setProfilePage] = useState(0),
    [managing, setManaging] = useState(false);
  const [startupAttempt, setStartupAttempt] = useState(0);
  const [screen, setScreen] = useState<Screen>("startup"),
    [pair, setPair] = useState<DevicePairing>(),
    [qr, setQr] = useState(""),
    [profiles, setProfiles] = useState<readonly TvProfile[]>([]),
    [profile, setProfile] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    // Preparing playback is its own state: `busy` also covers source discovery,
    // and the player screen does not exist yet while the server prepares.
    [preparing, setPreparing] = useState(false),
    [toast, setToast] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [controlActivity, setControlActivity] = useState(0);
  const lastControlActivity = useRef(0);
  const [searchPartial, setSearchPartial] = useState(false);
  const [catalogValues, setCatalogValues] = useState<Record<string, string>>(
    {},
  );
  const [items, setItems] = useState<readonly MediaItem[]>([]),
    [queue, setQueue] = useState<readonly MediaItem[]>([]),
    [favorites, setFavorites] = useState<readonly MediaItem[]>([]),
    [catalogs, setCatalogs] = useState<readonly Catalog[]>([]),
    [catalog, setCatalog] = useState<Catalog>(),
    [nextSkip, setNextSkip] = useState<number>(),
    [libraryQueue, setLibraryQueue] = useState(false),
    [selected, setSelected] = useState<MediaItem>(),
    // The catalog the selected title was opened from, when known: the detail
    // page's genre links browse that catalog first.
    [detailOrigin, setDetailOrigin] = useState<Catalog>(),
    [highlighted, setHighlighted] = useState<MediaItem>(),
    [episodes, setEpisodes] = useState<readonly MediaItem[]>([]),
    [sources, setSources] = useState<readonly MediaSource[]>([]),
    [sourceQuality, setSourceQuality] = useState("All"),
    [sourceProvider, setSourceProvider] = useState("All"),
    [season, setSeason] = useState<number>(),
    [query, setQuery] = useState(""),
    [searchScope] = useState("all"),
    [searchRows, setSearchRows] = useState<
      { name: string; items: readonly MediaItem[]; catalog?: Catalog }[]
    >([]),
    [prefs, setPrefs] = useState(initialPrefs),
    [modal, setModal] = useState<{
      title: string;
      choices: Choice[];
      body?: string;
      message?: string;

      /** Classified failure detail rendered as the dialog's details block. */
      detail?: ErrorDetail;
      /** Choice label that receives focus when the dialog opens. */
      focus?: string;
    }>(),
    [snapshot, setSnapshot] = useState<PlayerSnapshot>(),
    [session, setSession] = useState<PlaybackSession>(),
    [overlay, setOverlay] = useState(true),
    [seek, setSeek] = useState<number>(),
    [openingSource, setOpeningSource] = useState<string>();
  const [settingsSubpage, setSettingsSubpage] = useState<"Settings" | "Playback preferences" | "Addons">("Settings");
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeTrackPopup, setActiveTrackPopup] = useState<"audio" | "text" | null>(null);
  const [playerInfoOpen, setPlayerInfoOpen] = useState(false);
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const init = async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        setIsMaximized(await win.isMaximized());
        unlisten = await win.onResized(async () => {
          setIsMaximized(await win.isMaximized());
        });
      } catch {}
    };
    void init();
    return () => unlisten?.();
  }, []);
  useEffect(() => {
    if (screen !== "Settings") setSettingsSubpage("Settings");
  }, [screen]);
  const playerRoot = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null),
    player = useRef<Player>(),
    controller = useRef<PlaybackSessionController<MediaItem, MediaSource>>(),
    playbackCapabilities = useRef<() => Promise<PlaybackCapabilities>>(),
    nextScope = useRef<ReturnType<TvApi["createScope"]>>(),
    epoch = useRef(0),
    stack = useRef<
      {
        screen: Screen;
        focus: string;
        scroll?: ScrollAnchor;
        selected?: MediaItem;
        items: readonly MediaItem[];
        episodes: readonly MediaItem[];
        sources: readonly MediaSource[];
      }[]
    >([]),
    active = useRef<{
      item: MediaItem;
      source?: MediaSource;
      session: PlaybackSession;
    }>(),
    seekTimer = useRef<ReturnType<typeof setTimeout>>(),
    pairTimer = useRef<ReturnType<typeof setTimeout>>(),
    pairEpoch = useRef(0);
  const fullscreenControl = usePlayerFullscreen(screen === "player", playerRoot, video, (error) => setError(error instanceof Error ? error.message : "Unable to change fullscreen."));
  const pairingScope = useRef<ReturnType<TvApi["createScope"]>>();
  const engineError = useRef<Error>(),
    autoResume = useRef(false),
    sourceFocusPending = useRef(false),
    searchKey = useRef("key-A");
  const advancedSession = useRef(""),
    resumeRemainder = useRef(false);
  const seekRepeat = useRef({ key: "", count: 0 }),
    seekValue = useRef<number>(),
    seekTarget = useRef<number>();
  const restoredScroll = useRef<(ScrollAnchor & { focus: string }) | undefined>();
  const currentScreen = useRef(screen);
  currentScreen.current = screen;
  const modalFocus = useRef(""),
    errorFocus = useRef("");
  const homeRequestScope = useRef<ReturnType<TvApi["createScope"]>>();
  const browser = useRef<BrowserNavigation<BrowserSnapshot>>();
  const browserReady = useRef(false), browserApplying = useRef(false), browserReplace = useRef(true);
  const browserApplyGeneration = useRef(0), browserFromRoute = useRef(false);
  const browserInitial = useRef<BrowserRoute | undefined>(responsive ? readBrowserRoute() : undefined);
  const [browserRevision, setBrowserRevision] = useState(0);
  const applyBrowserRoute = useRef<(route: BrowserRoute, cached?: BrowserSnapshot, reload?: boolean) => Promise<void>>(async () => {});
  const captureBrowserSnapshot = (): BrowserSnapshot => ({ screen, subpage: screen === "Settings" ? settingsSubpage : undefined, selected, items, episodes, sources, query, season, catalog, catalogValues, nextSkip,
    focus: (document.activeElement as HTMLElement)?.dataset.focusId ?? "", scroll: captureScroll() });
  const browserCapture = useRef(captureBrowserSnapshot);
  browserCapture.current = captureBrowserSnapshot;
  useEffect(() => {
    if (!responsive) return;
    const navigation = new BrowserNavigation<BrowserSnapshot>((route, cached) => {
      if (!browserReady.current) { browserInitial.current = route; return; }
      void applyBrowserRoute.current(route, cached);
    }, () => browserCapture.current());
    browser.current = navigation;
    return () => { navigation.dispose(); browser.current = undefined; };
  }, [responsive]);
  useLayoutEffect(() => {
    if (!responsive || !browserReady.current || browserApplying.current || bootingHome || ["startup", "pairing"].includes(screen)) return;
    if (["detail", "sources", "player"].includes(screen) && !selected && !active.current?.item) return;
    const item = screen === "player" ? active.current?.item ?? selected : selected;
    const route: BrowserRoute = { screen: screen as BrowserRoute["screen"], ...(screen === "Settings" ? { subpage: settingsSubpage } : {}), ...(screen === "Search" ? { query } : {}),
      ...(["detail", "sources", "player"].includes(screen) && item ? { media: { id: item.id, type: item.type, seriesId: item.seriesId, season: item.season, episode: item.episode } } : {}) };
    // Editing the same search query updates its URL without creating a history entry per keystroke.
    const currentRoute = readBrowserRoute();
    const searchEdit = screen === "Search" && currentRoute.screen === "Search";
    const ongoingPlayback = screen === "player" && currentRoute.screen === "player";
    browser.current?.update(route, captureBrowserSnapshot(), browserReplace.current || searchEdit || ongoingPlayback);
    browserReplace.current = false;
  }, [responsive, screen, settingsSubpage, selected, items, episodes, sources, query, season, catalog, catalogValues, nextSkip, bootingHome, browserRevision]);
  const finishProfileNavigation = () => {
    if (!responsive) { setScreen("Home"); return; }
    browser.current?.clearSnapshots();
    browserReady.current = true;
    const route = browserInitial.current ?? { screen: "Home" as const };
    browserInitial.current = undefined;
    void applyBrowserRoute.current(route, undefined, true);
  };

  return {
    api, platform, layout, responsive,
    casting, setCasting, castFocus, openCast, closeCast,
    oled, setOled, toggleOled,
    engineChoice, setEngineChoice, selectEngine,
    autoplayTest, autoplayEnabled, setAutoplayEnabled, autoplayStarted,
    compactHome, setCompactHome, bootingHome, setBootingHome,
    recentLive, setRecentLive, homeRows, setHomeRows,
    homeCache, heroMetadataCache,
    editingProfile, setEditingProfile,
    entry, setEntryState, profilePage, setProfilePage, managing, setManaging,
    startupAttempt, setStartupAttempt,
    screen, setScreen, pair, setPair, qr, setQr, profiles, setProfiles,
    profile, setProfile, error, setError, busy, setBusy, preparing, setPreparing, toast, setToast,
    catalogError, setCatalogError,
    controlActivity, setControlActivity, lastControlActivity,
    searchPartial, setSearchPartial,
    catalogValues, setCatalogValues,
    items, setItems, queue, setQueue, favorites, setFavorites,
    catalogs, setCatalogs, catalog, setCatalog,
    nextSkip, setNextSkip, libraryQueue, setLibraryQueue,
    selected, setSelected, detailOrigin, setDetailOrigin, highlighted, setHighlighted,
    episodes, setEpisodes, sources, setSources,
    sourceQuality, setSourceQuality, sourceProvider, setSourceProvider,
    season, setSeason, query, setQuery, searchScope, searchRows, setSearchRows,
    prefs, setPrefs,
    modal, setModal,
    snapshot, setSnapshot, session, setSession, overlay, setOverlay, seek, setSeek, openingSource, setOpeningSource,
    settingsSubpage, setSettingsSubpage,
    isMaximized, setIsMaximized,
    activeTrackPopup, setActiveTrackPopup, playerInfoOpen, setPlayerInfoOpen,
    playerRoot, canvas, video, player, controller, playbackCapabilities, nextScope, epoch, stack, active, seekTimer, pairTimer, pairEpoch,
    fullscreenControl,
    pairingScope, engineError, autoResume, sourceFocusPending, searchKey, advancedSession, resumeRemainder, seekRepeat, seekValue, seekTarget,
    restoredScroll, currentScreen, modalFocus, errorFocus, homeRequestScope,
    browser, browserReady, browserApplying, browserReplace, browserApplyGeneration, browserFromRoute, browserInitial,
    browserRevision, setBrowserRevision,
    applyBrowserRoute, captureBrowserSnapshot, browserCapture, finishProfileNavigation,
  };
}
