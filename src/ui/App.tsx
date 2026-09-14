import { normalizeCore } from "../core";
import { Maximize, Minimize, Volume2, VolumeX, Info } from "lucide-react";
import { usePlayerFullscreen } from "./usePlayerFullscreen";
import { ResponsiveSignIn } from "./ResponsiveSignIn";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  TvApi,
  type MediaItem,
  type MediaPresentation,
  type CardPresentation,
  type MediaSource,
  type DevicePairing,
  type TvProfile,
  type Catalog,
  type PlaybackSession,
  type PlaybackPreferences,
  type PlaybackCapabilities,
} from "../api";
import {
  createPlayer,
  PlaybackSessionController,
  exactResumeSource,
  type Player,
  type PlayerPlatform,
  type PlayerSnapshot,
} from "../player";
import { probeBrowserPlaybackCapabilities } from "../player/browser-capabilities";
import { RemoteRoot, TvButton, focusElement } from "./remote";
import "./tv.css";
import "./responsive.css";
import { RokuText } from "./RokuText";
import {
  enrichDetail,
  mergeEpisodeProgress,
  initialEpisode,
} from "./detailProgress";
import {
  HeroArtwork,
  CardArtwork,
  SharedCardArtwork,
  ReadyImage,
  artworkUrl,
} from "./RokuArtwork";
import { TextEntry } from "./TextEntry";
import { ProfileEditor, avatarUrl } from "./ProfileEditor";
import { Settings } from "./Settings";
import { resolveNext } from "./continuation";
import {
  catalogFilters,
  catalogDefaults,
  catalogFilterLabel,
} from "./catalogFilters";
import { Guide as LiveGuide } from "./Guide";
import { CastController } from "./CastController";
import { DialogBackdrop } from "./DialogBackdrop";
import { BrowserNavigation, readBrowserRoute, safeRestoredRoute, type BrowserRoute } from "./browserNavigation";
type Screen =
  | "startup"
  | "pairing"
  | "profiles"
  | "Home"
  | "Discover"
  | "Live TV"
  | "My List"
  | "Search"
  | "Settings"
  | "detail"
  | "sources"
  | "player";
type Choice = { label: string; action: () => void };
type ScrollAnchor = { top: number; regions: { id: string; top: number; left: number }[] };
type BrowserSnapshot = {
  screen: Screen; selected?: MediaItem; items: readonly MediaItem[]; episodes: readonly MediaItem[]; sources: readonly MediaSource[];
  focus: string; scroll?: ScrollAnchor; query: string; season?: number; catalog?: Catalog; catalogValues: Record<string, string>; nextSkip?: number;
};
function captureScroll(): ScrollAnchor | undefined {
  const root = document.querySelector<HTMLElement>(".responsive-app");
  return root ? { top: root.scrollTop, regions: Array.from(root.querySelectorAll<HTMLElement>("[data-scroll-id]")).map(element => ({ id: element.dataset.scrollId!, top: element.scrollTop, left: element.scrollLeft })) } : undefined;
}

const initialPrefs: PlaybackPreferences = {
  audioLanguage: "",
  subtitleLanguage: "",
  subtitlesEnabled: false,
  subtitleSize: "normal",
  subtitleStyle: "system",
  quality: "auto",
  autoplay: true,
};
const time = (n: number) =>
  `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
function presentationContext(item: MediaItem) {
  const context =
    item.season !== undefined
      ? `S${item.season} · E${item.episode ?? 1}${item.episodeTitle ? ` · ${item.episodeTitle}` : ""}`
      : "";
  const status =
    item.queueStatus === "next"
      ? "Play next episode"
      : item.queueStatus === "caught_up"
        ? "You're caught up"
        : item.queueStatus === "upcoming"
          ? "Next episode coming soon"
          : item.position
            ? `Resume at ${time(item.position)}`
            : "";
  return [context, status].filter(Boolean).join(" · ");
}
function ResponsiveTitle({ title, logo }: { title: string; logo?: string | null }) {
  const [loaded, setLoaded] = useState<string>();
  return <h1 className={`responsive-title ${logo && loaded === logo ? "has-logo" : ""}`}><span>{title}</span>{logo && <img src={logo} alt="" onLoad={() => setLoaded(logo)} onError={() => setLoaded(undefined)} />}</h1>;
}

export function App({
  api,
  platform = "html5",
  layout = "tv",
}: {
  api: TvApi;
  platform?: PlayerPlatform;
  layout?: "tv" | "responsive";
}) {
  const responsive = layout === "responsive";
  const [casting, setCasting] = useState(false);
  const castFocus = useRef<HTMLElement | null>(null);
  const openCast = () => { castFocus.current = document.activeElement as HTMLElement; setCasting(true); };
  const closeCast = () => { setCasting(false); requestAnimationFrame(() => castFocus.current?.focus()); };
  const [oled, setOled] = useState(() => { try { return localStorage.getItem("viptv:appearance:oled") === "true"; } catch { return false; } });
  const toggleOled = () => setOled((previous) => { const next = !previous; try { localStorage.setItem("viptv:appearance:oled", String(next)); } catch { /* Appearance remains usable without storage. */ } return next; });
  const [compactHome, setCompactHome] = useState(false),
    [bootingHome, setBootingHome] = useState(false),
    [recentLive, setRecentLive] = useState<readonly MediaItem[]>([]),
    [homeRows, setHomeRows] = useState<
      { name: string; items: readonly MediaItem[] }[]
    >([]);
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
    [highlighted, setHighlighted] = useState<MediaItem>(),
    [episodes, setEpisodes] = useState<readonly MediaItem[]>([]),
    [sources, setSources] = useState<readonly MediaSource[]>([]),
    [sourceQuality, setSourceQuality] = useState("All"),
    [sourceProvider, setSourceProvider] = useState("All"),
    [season, setSeason] = useState<number>(),
    [query, setQuery] = useState(""),
    [searchScope] = useState("all"),
    [searchRows, setSearchRows] = useState<
      { name: string; items: readonly MediaItem[] }[]
    >([]),
    [prefs, setPrefs] = useState(initialPrefs),
    [modal, setModal] = useState<{
      title: string;
      choices: Choice[];
      body?: string;
      message?: string;
    }>(),
    [snapshot, setSnapshot] = useState<PlayerSnapshot>(),
    [session, setSession] = useState<PlaybackSession>(),
    [overlay, setOverlay] = useState(true),
    [seek, setSeek] = useState<number>();
  const playerRoot = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null),
    player = useRef<Player>(),
    controller = useRef<PlaybackSessionController>(),
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
    seekValue = useRef<number>();
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
  const captureBrowserSnapshot = (): BrowserSnapshot => ({ screen, selected, items, episodes, sources, query, season, catalog, catalogValues, nextSkip,
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
    const route: BrowserRoute = { screen: screen as BrowserRoute["screen"], ...(screen === "Search" ? { query } : {}),
      ...(["detail", "sources", "player"].includes(screen) && item ? { media: { id: item.id, type: item.type, seriesId: item.seriesId, season: item.season, episode: item.episode } } : {}) };
    // Editing the same search query updates its URL without creating a history entry per keystroke.
    const currentRoute = readBrowserRoute();
    const searchEdit = screen === "Search" && currentRoute.screen === "Search";
    const ongoingPlayback = screen === "player" && currentRoute.screen === "player";
    browser.current?.update(route, captureBrowserSnapshot(), browserReplace.current || searchEdit || ongoingPlayback);
    browserReplace.current = false;
  }, [responsive, screen, selected, items, episodes, sources, query, season, catalog, catalogValues, nextSkip, bootingHome, browserRevision]);
  const finishProfileNavigation = () => {
    if (!responsive) { setScreen("Home"); return; }
    browser.current?.clearSnapshots();
    browserReady.current = true;
    const route = browserInitial.current ?? { screen: "Home" as const };
    browserInitial.current = undefined;
    void applyBrowserRoute.current(route, undefined, true);
  };
  useLayoutEffect(() => {
    if (modal) {
      if (!modalFocus.current)
        modalFocus.current =
          (document.activeElement as HTMLElement)?.dataset.focusId ?? "";
      focusElement(modal.body ? "source-detail-body" : "modal-0");
    } else if (modalFocus.current) {
      const id = modalFocus.current;
      modalFocus.current = "";
      focusElement(id);
    }
  }, [modal]);
  const entryFocus = useRef("");
  const parentScope = useRef<ReturnType<TvApi["createScope"]>>();
  const setEntry = (value: typeof entry) => {
    if (!value) {
      parentScope.current?.abort();
      parentScope.current = undefined;
    }
    if (value && !entry)
      entryFocus.current =
        (document.activeElement as HTMLElement)?.dataset.focusId ?? "";
    setEntryState(value);
  };
  useEffect(() => {
    if (!entry && entryFocus.current) {
      const id = entryFocus.current;
      entryFocus.current = "";
      const timer = setTimeout(() => focusElement(id), 30);
      return () => clearTimeout(timer);
    }
  }, [entry]);
  useEffect(() => {
    if (error) {
      errorFocus.current =
        (document.activeElement as HTMLElement)?.dataset.focusId ?? "";
      setTimeout(() => focusElement("dismiss-error"), 30);
    } else if (errorFocus.current) {
      focusElement(errorFocus.current);
      errorFocus.current = "";
    }
  }, [error]);
  const notify = (message: string) => setToast(message);
  const fail = (e: unknown) => {
    setBootingHome(false);
    if (!(e instanceof DOMException && e.name === "AbortError"))
      setError(
        e instanceof Error ? e.message : "Unable to connect. Try again.",
      );
  };
  const go = (next: Screen) => {
    homeRequestScope.current?.abort();
    if (!browserFromRoute.current) {
      browserApplyGeneration.current++;
      browserApplying.current = false;
      browser.current?.remember(captureBrowserSnapshot());
    }
    if (!browserFromRoute.current) stack.current.push({
      screen,
      scroll: responsive ? captureScroll() : undefined,
      focus: responsive && modal ? modalFocus.current : (document.activeElement as HTMLElement)?.dataset.focusId ?? "",
      selected,
      items,
      episodes,
      sources,
    });
    setError("");
    setScreen(next);
  };
  const loadHome = async (id = profile) => {
    homeRequestScope.current?.abort();
    const scope = api.createScope();
    homeRequestScope.current = scope;
    const ticket = ++epoch.current;
    setBusy(true);
    try {
      const [home, cats, preferences] = await Promise.all([
        api.home(id, { signal: scope.signal }),
        api.catalogs().then((available) => {
          if (ticket === epoch.current) { setCatalogs(available); setCatalogError(""); }
          return available;
        }).catch((cause) => {
          if (ticket === epoch.current) setCatalogError(cause instanceof Error ? cause.message : "Unable to load catalogs.");
          return [] as readonly Catalog[];
        }),
        api.preferences(id).catch(() => initialPrefs),
      ]);
      if (ticket !== epoch.current) return;
      setQueue(home.continueWatching);
      setFavorites(home.myList);
      setCatalogs(cats);
      setPrefs(preferences);
      const first = cats.find((c) => c.type !== "live");
      const page = first
        ? await api.discover({
            type: first.type,
            catalog: first.id,
            addonId: first.addonId,
          }).catch((cause) => {
            if (ticket === epoch.current) fail(cause);
            return { items: [] };
          })
        : undefined;
      if (ticket === epoch.current) setItems(page?.items ?? home.myList);
      const [live, rows] = await Promise.all([
        api
          .live({ view: "us", collection: "recent", limit: 20 })
          .catch(() => ({ channels: [] })),
        Promise.all(
          cats
            .filter((c) => c.type !== "live" && c !== first)
            .slice(0, 2)
            .map(async (cat) => ({
              name: cat.name,
              items: (
                await api
                  .discover({
                    type: cat.type,
                    catalog: cat.id,
                    addonId: cat.addonId,
                  })
                  .catch(() => ({ items: [] }))
              ).items,
            })),
        ),
      ]);
      if (ticket === epoch.current) {
        setRecentLive(live.channels);
        setHomeRows(rows);
      }
    } catch (e) {
      if (ticket === epoch.current) fail(e);
    } finally {
      if (ticket === epoch.current) setBusy(false);
    }
  };
  const authorize = async (
    title: string,
    action: (signal?: AbortSignal) => Promise<void>,
    done: () => Promise<void> | void,
  ) => {
    try {
      await action();
      await done();
    } catch (error) {
      if ((error as { status?: number }).status !== 403) {
        fail(error);
        return;
      }
      setBootingHome(false);
      const scope = api.createScope();
      parentScope.current?.abort();
      parentScope.current = scope;
      setEntry({
        title,
        secret: true,
        save: async (pin) => {
          if (!/^\d{4,8}$/.test(pin))
            throw new Error("Enter a 4–8 digit parent PIN");
          try {
            await api.unlockParent(pin, { signal: scope.signal });
            if (scope.signal.aborted) return;
            await action(scope.signal);
            if (scope.signal.aborted) return;
            setEntry(undefined);
            await done();
          } catch (error) {
            if (scope.signal.aborted) return;
            const status = (error as { status?: number }).status;
            throw new Error(
              status === 429
                ? "Too many attempts. Wait before trying again."
                : status === 403
                  ? "Incorrect PIN. Try again."
                  : "Unable to unlock. Try again.",
            );
          }
        },
      });
    }
  };
  const chooseProfile = async (id: string) => {
    if (bootingHome) return;
    epoch.current++;
    setBootingHome(true);
    setItems([]);
    setQueue([]);
    setFavorites([]);
    setHighlighted(undefined);
    setSelected(undefined);
    await authorize(
      "Enter parent PIN",
      (signal) => api.selectProfile(id, { signal }),
      async () => {
        setBootingHome(true);
        setProfile(id);
        stack.current = [];
        await loadHome(id);
        finishProfileNavigation();
        setBootingHome(false);
      },
    );
  };
  const pairing = async () => {
    clearTimeout(pairTimer.current);
    pairingScope.current?.abort();
    const scope = api.createScope();
    pairingScope.current = scope;
    const generation = ++pairEpoch.current;
    setPair(undefined);
    setQr("");
    setError("");
    setScreen("pairing");
    try {
      const code = await api.beginPairing(`viptv ${platform}`, {
        signal: scope.signal,
      });
      if (generation !== pairEpoch.current) return;
      setPair(code);
      setQr("");
      try {
        const data = await QRCode.toDataURL(
          code.verificationUriComplete || code.verificationUri,
        );
        if (generation !== pairEpoch.current) return;
        setQr(data);
      } catch {
        /* Manual code remains usable if QR rendering is unavailable. */
      }
      if (generation !== pairEpoch.current) return;
      const expires = Date.now() + code.expiresIn * 1000;
      const poll = async () => {
        if (generation !== pairEpoch.current) return;
        if (Date.now() > expires) {
          setError("This code expired. Select Retry for a new code.");
          return;
        }
        try {
          await api.claimPairing(code.deviceCode, { signal: scope.signal });
          const identity = await api.me({ signal: scope.signal });
          if (generation !== pairEpoch.current) return;
          setProfiles(identity.profiles);
          setScreen("profiles");
        } catch (e) {
          if (generation !== pairEpoch.current || scope.signal.aborted) return;
          if (
            (e as { status?: number }).status === 400 ||
            (e as { status?: number }).status === 428
          ) {
            pairTimer.current = setTimeout(
              poll,
              Math.max(1, code.intervalSeconds) * 1000,
            );
          } else fail(e);
        }
      };
      pairTimer.current = setTimeout(
        poll,
        Math.max(1, code.intervalSeconds) * 1000,
      );
    } catch (e) {
      fail(e);
    }
  };
  useEffect(() => {
    if (responsive) return;
    const resize = () => {
      const element = document.querySelector<HTMLElement>(".tv-screen");
      if (element) {
        const scale = Math.min(innerWidth / 1280, innerHeight / 720);
        element.style.transform = `scale(${scale})`;
        element.style.left = `${(innerWidth - 1280 * scale) / 2}px`;
        element.style.top = `${(innerHeight - 720 * scale) / 2}px`;
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [responsive]);
  useEffect(() => {
    let disposed = false;
    let readyProfile = "";
    const driver = api.createSessionDriver((view) => {
      if (disposed) return;
      if (view.identity) setProfiles(view.identity.profiles);
      if (view.phase === "Pairing") { browserReady.current = false; browser.current?.clearSnapshots(); void pairing(); }
      else if (view.phase === "Profiles") { browserReady.current = false; browser.current?.clearSnapshots(); setScreen("profiles"); }
      else if (view.phase === "Error") fail(new Error(view.error ?? "Unable to connect. Try again."));
      else if (view.phase === "Ready" && view.selectedProfileId && readyProfile !== view.selectedProfileId) {
        readyProfile = view.selectedProfileId;
        setProfile(readyProfile);
        setBootingHome(true);
        stack.current = [];
        void loadHome(readyProfile).then(() => {
          if (!disposed) { finishProfileNavigation(); setBootingHome(false); }
        });
      }
    }, (message) => { if (!disposed) fail(new Error(message)); });
    void driver.dispatch({ Begin: { origin: api.serverOrigin, allowInsecurePreview: import.meta.env.DEV && api.serverOrigin === globalThis.location?.origin } });
    return () => {
      disposed = true;
      driver.dispose();
      homeRequestScope.current?.abort();
      pairEpoch.current++;
      pairingScope.current?.abort();
      clearTimeout(pairTimer.current);
      epoch.current++;
    };
  }, [api, startupAttempt]);
  useEffect(() => {
    let engine: Player;
    try {
      engine = createPlayer({ platform, video: video.current!, canvas: canvas.current! });
      engineError.current = undefined;
    } catch (error) {
      engineError.current =
        error instanceof Error
          ? error
          : new Error("TV playback engine is unavailable");
      return;
    }
    player.current = engine;
    let browserReport: ReturnType<typeof probeBrowserPlaybackCapabilities> | undefined;
    const capabilities = async (): Promise<PlaybackCapabilities> => {
      // AVPlay is a native engine; HTML decoder probes cannot qualify it.
      if (platform === "tizen") return { maxWidth: 1920, maxHeight: 1080, h264: true, hevc: true, aac: true, directPlay: true, hevcSdr: true };
      browserReport ??= probeBrowserPlaybackCapabilities(undefined, { mediabunny: platform === "html5" });
      const report = await browserReport;
      if (!report.canPlayManagedHls) throw new Error("This browser cannot play the supported H.264/AAC streaming output. Use a supported browser or TV player.");
      return report.capabilities;
    };
    playbackCapabilities.current = capabilities;
    const sessions = new PlaybackSessionController({ player: engine, backend: api, capabilities });
    controller.current = sessions;
    const off = engine.subscribe((snapshot) => {
      setSnapshot(snapshot);
      void sessions.recoverPlayback(snapshot).then((handled) => {
        if (!handled && snapshot.error && engine.snapshot.error === snapshot.error)
          setError(snapshot.error.message);
      }).catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) fail(cause);
      });
    });
    const offSessions = sessions.subscribe((state) => {
      if (state.active) {
        const { intent, session } = state.active;
        active.current = {
          item: {
            ...intent.item,
            sourceAddonId:
              intent.source?.sourceAddonId ?? intent.item.sourceAddonId,
            sourceName: intent.source?.sourceName ?? intent.item.sourceName,
            sourceFingerprint:
              typeof intent.source?.raw.source_fingerprint === "string"
                ? intent.source.raw.source_fingerprint
                : intent.item.sourceFingerprint,
          },
          source: intent.source,
          session,
        };
        setSession(session);
        setSelected(intent.item);
      } else {
        active.current = undefined;
        setSession(undefined);
      }
    });
    return () => {
      off();
      offSessions();
      void sessions
        .stop()
        .catch(() => undefined)
        .then(() => engine.dispose())
        .catch(() => undefined);
    };
  }, [platform, api]);
  useEffect(() => {
    if (screen === "profiles") setTimeout(() => focusElement("profile-0"), 30);
  }, [profilePage]);
  // Establish screen focus before paint. A deferred timer can steal focus
  // between the next remote OK down/up, silently dropping its activation.
  useLayoutEffect(() => {
    if (responsive && restoredScroll.current) return;
    focusElement(
      screen === "profiles"
        ? "profile-0"
        : screen === "pairing"
          ? "retry"
          : screen === "detail"
            ? "detail-play"
            : screen === "sources"
              ? "source-0"
              : screen === "player"
                ? selected?.type === "live"
                  ? "audio"
                  : "timeline"
                : `nav-${screen}`,
    );
  }, [screen]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (
      screen !== "player" ||
      !overlay ||
      snapshot?.state !== "playing" ||
      modal ||
      seek !== undefined
    )
      return;
    const t = setTimeout(() => setOverlay(false), 7000);
    return () => clearTimeout(t);
  }, [screen, overlay, snapshot?.state, modal, seek, controlActivity]);
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => {
      void api.heartbeat(session.id).catch(fail);
      const a = active.current,
        p = player.current?.snapshot.time;
      if (a && p && a.item.type !== "live")
        void api
          .saveProgress(
            profile,
            a.item,
            p.positionSeconds,
            p.durationSeconds ?? a.session.duration,
          )
          .catch(fail);
    }, 15000);
    return () => clearInterval(t);
  }, [session, profile]);
  const back = () => {
    if (screen === "sources" && autoResume.current) {
      autoResume.current = false;
      if (controller.current?.snapshot.state === "opening") {
        epoch.current++;
        void controller.current.stop().catch(fail);
      }
      setBusy(false);
      notify("Choose a source to continue.");
      return;
    }
    if (error) {
      setError("");
      if (screen === "startup") setStartupAttempt((attempt) => attempt + 1);
      return;
    }
    if (editingProfile) {
      setEditingProfile(undefined);
      return;
    }
    if (entry) {
      setEntry(undefined);
      return;
    }
    if (managing && screen === "profiles") {
      setManaging(false);
      return;
    }
    if (modal) {
      setModal(undefined);
      return;
    }
    if (seek !== undefined) {
      clearTimeout(seekTimer.current);
      seekValue.current = undefined;
      setSeek(undefined);
      return;
    }
    if (nextScope.current) {
      nextScope.current.abort();
      nextScope.current = undefined;
      controller.current?.cancelNext();
      setBusy(false);
      return;
    }
    if (screen === "player") {
      if (
        controller.current?.snapshot.state === "replacing" ||
        controller.current?.snapshot.state === "preparing-next"
      ) {
        controller.current.cancelNext();
        return;
      }
      // A visible player overlay is its own Back level. Keep the decoder and
      // session active; a subsequent Back from hidden chrome exits playback.
      if (overlay && !responsive) {
        setOverlay(false);
        return;
      }
      void stop();
      return;
    }
    if (responsive && browserReady.current) {
      browser.current?.remember(captureBrowserSnapshot());
      if (!browser.current?.back()) void applyBrowserRoute.current({ screen: "Home" });
      return;
    }
    epoch.current++;
    if (controller.current?.snapshot.state === "opening")
      void controller.current.stop().catch(fail);
    const previous = stack.current.pop();
    if (previous) {
      restoredScroll.current = responsive && previous.scroll ? { ...previous.scroll, focus: previous.focus } : undefined;
      setScreen(previous.screen);
      setSelected(previous.selected);
      setItems(previous.items);
      setEpisodes(previous.episodes);
      setSources(previous.sources);
      if (!restoredScroll.current) setTimeout(() => focusElement(previous.focus), 50);
    } else if (screen === "profiles" && profile) setScreen("Home");
    else if (screen !== "Home" && screen !== "pairing" && screen !== "profiles")
      setScreen("Home");
    else notify("Press Home on your TV remote to leave viptv.");
  };
  const detail = async (item: MediaItem) => {
    if (item.type === "live") { await play(item); return; }
    go("detail");
    setSelected(item);
    setEpisodes([]);
    const ticket = ++epoch.current;
    setBusy(true);
    try {
      const value = await api.detail(item);
      if (ticket !== epoch.current) return;
      let enrichedEpisodes = value.episodes;
      if (value.item.type === "series") {
        const history = await api
          .seriesProgress(profile, value.item.seriesId ?? value.item.id)
          .catch((error: unknown) => {
            if (ticket !== epoch.current) return [];
            // Keep the series usable during a history outage without inventing progress.
            notify(
              "Watch history couldn't load. Episode progress may be unavailable.",
            );
            if (error instanceof DOMException && error.name === "AbortError")
              throw error;
            return [];
          });
        if (ticket !== epoch.current) return;
        enrichedEpisodes = mergeEpisodeProgress(
          value.episodes,
          history,
          value.item.seriesId ?? value.item.id,
        );
      }
      if (ticket === epoch.current) {
        setSelected(enrichDetail(item, value.item));
        setEpisodes(enrichedEpisodes);
        const initial = initialEpisode(enrichedEpisodes, item);
        setSeason(initial?.season ?? enrichedEpisodes[0]?.season);
        if (initial)
          setTimeout(() => {
            if (ticket !== epoch.current || currentScreen.current !== "detail")
              return;
            const index = enrichedEpisodes
              .filter((episode) => episode.season === initial.season)
              .findIndex((episode) => episode.id === initial.id);
            if (index >= 0) focusElement(`episode-${index}`);
          }, 50);
      }
    } catch (e) {
      if (ticket === epoch.current) fail(e);
    } finally {
      if (ticket === epoch.current) setBusy(false);
    }
  };
  const discoverSources = async (item: MediaItem, resume = false) => {
    if (item.type === "live") { await play(item); return; }
    if (resume && item.queueStatus === "next" && item.previousEpisode) {
      await nextEpisode(item.previousEpisode);
      return;
    }
    if (item.type === "series" && !item.episode) {
      await detail(item);
      return;
    }
    if (currentScreen.current !== "sources") go("sources");
    else setError("");
    autoResume.current = resume;
    sourceFocusPending.current = true;
    setSelected(item);
    setSources([]);
    setSourceQuality("All");
    setSourceProvider("All");
    setBusy(true);
    const ticket = ++epoch.current;
    try {
      const discovery = await api.sources(item);
      let after = 0,
        all: MediaSource[] = [];
      for (let count = 0; count < 120 && ticket === epoch.current; count++) {
        const poll = await api.pollSources(discovery.id, after);
        if (ticket !== epoch.current) return;
        for (const event of poll.events) {
          after = Math.max(after, event.sequence);
          for (const source of event.sources)
            if (!all.some((s) => s.id === source.id)) all.push(source);
        }
        setSources([...all]);
        if (all.length && sourceFocusPending.current) {
          sourceFocusPending.current = false;
          setTimeout(() => {
            if (document.activeElement === document.body)
              focusElement("source-0");
          }, 30);
        }
        if (resume && item.sourceAddonId && item.sourceFingerprint) {
          const exact = exactResumeSource(item, all);
          if (exact) {
            await play(item, exact, item.position ?? 0);
            return;
          }
        }
        if (poll.done) {
          if (resume)
            notify(
              "Your previous source is unavailable. Choose a source to continue.",
            );
          break;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
      if (sourceFocusPending.current) {
        sourceFocusPending.current = false;
        setTimeout(() => focusElement("source-0"), 50);
      }
    }
  };
  const play = async (item: MediaItem, source?: MediaSource, position = 0) => {
    if (!controller.current) {
      fail(
        engineError.current ?? new Error("TV playback engine is unavailable"),
      );
      return;
    }
    resumeRemainder.current = !!(
      position &&
      item.duration &&
      position >= item.duration - 10
    );
    const ticket = ++epoch.current;
    setError("");
    setBusy(true);
    try {
      const enriched = {
        ...item,
        sourceAddonId: source?.sourceAddonId ?? item.sourceAddonId,
        sourceName: source?.sourceName ?? item.sourceName,
        sourceFingerprint:
          typeof source?.raw.source_fingerprint === "string"
            ? source.raw.source_fingerprint
            : item.sourceFingerprint,
        sourceQuality: source?.quality ?? item.sourceQuality,
        sourceAudio: source?.audio ?? item.sourceAudio,
      };
      const started = await controller.current!.start({
        item: enriched,
        source,
        position,
      });
      if (ticket !== epoch.current) {
        if (
          controller.current?.snapshot.active?.session.id === started.session.id
        )
          await controller.current.stop();
        return;
      }
      if (
        autoResume.current &&
        item.type !== "live" &&
        stack.current.at(-1)?.screen === "Home"
      ) {
        if (responsive) browser.current?.replaceRoute({ screen: "detail", media: { id: item.id, type: item.type, seriesId: item.seriesId, season: item.season, episode: item.episode } });
        stack.current.push({
          screen: "detail",
          focus: "detail-play",
          selected: item,
          items,
          episodes: [],
          sources: [],
        });
        setScreen("player");
      } else go("player");
      autoResume.current = false;
      setOverlay(true);
    } catch (e) {
      if (
        ticket !== epoch.current ||
        (e instanceof DOMException && e.name === "AbortError")
      )
        return;
      setModal({
        title: "This source could not be played",
        message:
          e instanceof Error ? e.message : "Unable to connect. Try again.",
        choices: [
          {
            label: "Retry",
            action: () => {
              setModal(undefined);
              void play(item, source, position);
            },
          },
          ...(item.type === "live" ? [] : [{
            label: "Choose another source",
            action: () => {
              setModal(undefined);
              void discoverSources({ ...item, position });
            },
          }]),
          { label: item.type === "live" ? "Cancel" : "Back", action: () => setModal(undefined) },
        ],
      });
    } finally {
      setBusy(false);
    }
  };
  const retireBrowserPlayback = async () => {
    epoch.current++;
    nextScope.current?.abort(); nextScope.current = undefined;
    autoResume.current = false;
    clearTimeout(seekTimer.current); seekValue.current = undefined; setSeek(undefined);
    const outgoing = active.current, position = player.current?.snapshot.time;
    if (outgoing && position && outgoing.item.type !== "live") {
      void api.saveProgress(profile, outgoing.item, position.positionSeconds, position.durationSeconds ?? outgoing.session.duration).catch(() => notify("Playback stopped. Progress could not be saved."));
    }
    await controller.current?.stop().catch(fail);
    active.current = undefined;
    setSession(undefined); setBusy(false);
  };
  applyBrowserRoute.current = async (input, cached, reload = false) => {
    const applyGeneration = ++browserApplyGeneration.current;
    browserApplying.current = true;
    browserReplace.current = true;
    const route = safeRestoredRoute(input, reload);
    browser.current?.replaceRoute(route);
    setError(""); setModal(undefined); setEntry(undefined); setEditingProfile(undefined); setCasting(false);
    const generation = ++epoch.current;
    homeRequestScope.current?.abort();
    if (active.current || ["opening", "replacing", "preparing-next"].includes(controller.current?.snapshot.state ?? "")) await retireBrowserPlayback();
    if (applyGeneration !== browserApplyGeneration.current) return;
    const ticket = epoch.current;
    stack.current = [];
    setBusy(false);
    try {
      if (cached && route.screen === cached.screen && route.screen !== "player" && route.screen !== "sources") {
        setScreen(cached.screen); setSelected(cached.selected); setItems(cached.items); setEpisodes(cached.episodes); setSources(cached.sources);
        setQuery(cached.query); setSeason(cached.season); setCatalog(cached.catalog); setCatalogValues(cached.catalogValues); setNextSkip(cached.nextSkip);
        restoredScroll.current = cached.scroll ? { ...cached.scroll, focus: cached.focus } : undefined;
        if (!cached.scroll) setTimeout(() => focusElement(cached.focus), 30);
      } else if (route.media) {
        const reference: MediaItem = cached?.selected?.id === route.media.id ? cached.selected : { ...route.media, name: "", title: "", genres: [], episodes: [], raw: {} };
        setSelected(reference); setEpisodes([]); setSources([]);
        if (route.screen === "sources") {
          browserFromRoute.current = true;
          const pending = discoverSources(reference);
          browserFromRoute.current = false;
          browserApplying.current = false;
          await pending;
        } else {
          setScreen("detail"); setBusy(true);
          browserApplying.current = false;
          const value = await api.detail(reference);
          if (ticket !== epoch.current) return;
          const progress = value.item.type === "series" ? await api.seriesProgress(profile, value.item.seriesId ?? value.item.id).catch(() => []) : [];
          if (ticket !== epoch.current) return;
          const episodeItems = mergeEpisodeProgress(value.episodes, progress, value.item.seriesId ?? value.item.id);
          setSelected(enrichDetail(reference, value.item)); setEpisodes(episodeItems); setSeason(initialEpisode(episodeItems, reference)?.season ?? episodeItems[0]?.season);
        }
      } else {
        setQuery(route.query ?? "");
        if (reload && route.screen === "Home") setScreen("Home");
        else {
          browserFromRoute.current = true;
          const pending = navigate(route.screen);
          browserFromRoute.current = false;
          browserApplying.current = false;
          await pending;
        }
      }
    } catch (error) { if (applyGeneration === browserApplyGeneration.current && (ticket === epoch.current || generation === epoch.current)) fail(error); }
    finally {
      if (applyGeneration === browserApplyGeneration.current) {
        browserApplying.current = false;
        setBusy(false); setBrowserRevision(value => value + 1);
      }
    }
  };
  const stop = async () => {
    if (responsive && browserReady.current) {
      await retireBrowserPlayback();
      if (!browser.current?.back()) await applyBrowserRoute.current({ screen: "Home" });
      return;
    }
    epoch.current++;
    nextScope.current?.abort();
    const a = active.current,
      p = player.current?.snapshot.time;
    if (a && p && a.item.type !== "live")
      await api
        .saveProgress(
          profile,
          a.item,
          p.positionSeconds,
          p.durationSeconds ?? a.session.duration,
        )
        .catch(fail);
    await controller.current?.stop().catch(fail);
    const old = stack.current.pop();
    restoredScroll.current = responsive && old?.scroll ? { ...old.scroll, focus: old.focus } : undefined;
    setScreen(old?.screen ?? "Home");
    if (old) {
      setSelected(old.selected);
      setItems(old.items);
      setEpisodes(old.episodes);
      setSources(old.sources);
      if (!restoredScroll.current) setTimeout(() => focusElement(old.focus), 50);
      if (old.screen === "detail" && old.selected) {
        const ticket = epoch.current;
        void api
          .detail(old.selected)
          .then((value) => {
            if (ticket === epoch.current) {
              // A Home episode Resume returns to its parent title. Optional
              // episode fields omitted by title metadata must not survive a
              // spread from the outgoing episode and turn Season into Play.
              setSelected(value.item.type === "series" && value.item.id !== old.selected!.id
                ? value.item : enrichDetail(old.selected!, value.item));
              setEpisodes(value.episodes);
              setSeason(
                value.episodes.find((e) => e.id === old.selected?.id)?.season ??
                  value.episodes[0]?.season,
              );
            }
          })
          .catch(fail);
      }
    }
  };
  const nextEpisode = async (previous = active.current?.item) => {
    if (!previous || nextScope.current) return;
    const scope = api.createScope();
    nextScope.current = scope;
    setBusy(true);
    setError("");
    const outgoing = active.current;
    const outgoingPosition =
      player.current?.snapshot.time.positionSeconds ??
      outgoing?.item.position ??
      0;
    const attempted = new Set<string>();
    const deadline = setTimeout(() => scope.abort(), 180000);
    try {
      const resolve = async () => {
        const next = await resolveNext(
          api,
          profile,
          previous,
          prefs,
          scope.signal,
          await playbackCapabilities.current!(),
          attempted,
        );
        if (next?.source) attempted.add(next.source.id);
        if (!next && !scope.signal.aborted)
          notify("No next episode is available.");
        return next;
      };
      if (outgoing) {
        const p = player.current?.snapshot.time;
        if (p)
          await api.saveProgress(
            profile,
            outgoing.item,
            p.positionSeconds,
            p.durationSeconds ?? outgoing.session.duration,
          );
        for (let attempt = 0; attempt < 3 && !scope.signal.aborted; attempt++) {
          try {
            await controller.current!.prepareNext(resolve);
            break;
          } catch (error) {
            if (attempt === 2 || !controller.current?.snapshot.active)
              throw error;
          }
        }
        if (
          controller.current?.snapshot.active?.intent.item.id !==
          outgoing.item.id
        )
          resumeRemainder.current = false;
      } else {
        const next = await resolve();
        if (next && !scope.signal.aborted)
          await play(next.item, next.source, 0);
      }
    } catch (e) {
      if (!scope.signal.aborted) fail(e);
      if (
        outgoing &&
        controller.current?.snapshot.state === "error" &&
        !controller.current.snapshot.active
      ) {
        setModal({
          title: "Playback could not be restored",
          choices: [
            {
              label: "Retry",
              action: () => {
                setModal(undefined);
                void play(outgoing.item, outgoing.source, outgoingPosition);
              },
            },
            {
              label: "Choose source",
              action: () => {
                setModal(undefined);
                void discoverSources(outgoing.item);
              },
            },
            {
              label: "Back",
              action: () => {
                setModal(undefined);
                void stop();
              },
            },
          ],
        });
      }
    } finally {
      clearTimeout(deadline);
      if (nextScope.current === scope) nextScope.current = undefined;
      setBusy(false);
    }
  };
  useEffect(() => {
    if (
      screen !== "player" ||
      !prefs.autoplay ||
      selected?.type !== "series" ||
      nextScope.current ||
      seek !== undefined ||
      !session
    )
      return;
    const position = snapshot?.time.positionSeconds ?? 0,
      duration = snapshot?.time.durationSeconds ?? session.duration;
    const eligible =
      snapshot?.state === "ended" ||
      (!resumeRemainder.current &&
        snapshot?.state === "playing" &&
        duration > 10 &&
        normalizeCore<MediaPresentation>("presentation", { ...selected, position, duration }).canAutoNext);
    if (eligible && advancedSession.current !== session.id) {
      advancedSession.current = session.id;
      void nextEpisode();
    }
  }, [
    screen,
    prefs.autoplay,
    selected?.type,
    session?.id,
    snapshot?.time.positionSeconds,
    snapshot?.state,
    seek,
  ]);
  const toggle = async (item: MediaItem) => {
    try {
      const saved = await api.toggleFavorite(profile, item);
      notify(saved ? "Added to My List" : "Removed from My List");
      const list = await api.favorites(profile);
      setFavorites(list);
      if (screen === "My List") setItems(list);
    } catch (e) {
      fail(e);
    }
  };
  const manage = (item: MediaItem) => {
    if (item.type === "live") {
      setModal({
        title: item.name,
        choices: [
          {
            label: "Watch channel",
            action: () => {
              setModal(undefined);
              void play(item);
            },
          },
          {
            label: favorites.some((f) => f.id === item.id)
              ? "Remove from My List"
              : "Add to My List",
            action: () => {
              setModal(undefined);
              void toggle(item);
            },
          },
          { label: "Cancel", action: () => setModal(undefined) },
        ],
      });
      return;
    }
    const inQueue = queue.some((q) => q.id === item.id);
    setModal({
      title: item.name,
      choices: [
        ...(item.previousEpisode
          ? [
              {
                label: "Resume previous episode",
                action: () => {
                  setModal(undefined);
                  void discoverSources(item.previousEpisode!, true);
                },
              },
            ]
          : []),
        {
          label: "Choose source",
          action: () => {
            setModal(undefined);
            void discoverSources(item);
          },
        },
        {
          label: item.watched ? "Mark unwatched" : "Mark watched",
          action: () => {
            setModal(undefined);
            void api
              .correctProgress(profile, item, !item.watched)
              .then(() => loadHome())
              .catch(fail);
          },
        },
        {
          label: "Watch from the beginning",
          action: () => {
            setModal(undefined);
            // Source choice is explicit; do not reuse the queue Resume offset.
            void discoverSources({ ...item, position: 0 });
          },
        },
        ...(inQueue
          ? [
              {
                label: "Hide from Continue Watching",
                action: () => {
                  setModal(undefined);
                  void api
                    .setQueueVisibility(profile, item, true)
                    .then(() => {
                      setQueue((q) => q.filter((i) => i.id !== item.id));
                      setModal({
                        title: "Hidden from Continue Watching",
                        choices: [
                          {
                            label: "Undo",
                            action: () => {
                              setModal(undefined);
                              void api
                                .setQueueVisibility(profile, item, false)
                                .then(() => loadHome())
                                .catch(fail);
                            },
                          },
                          { label: "Done", action: () => setModal(undefined) },
                        ],
                      });
                    })
                    .catch(fail);
                },
              },
            ]
          : []),
        {
          label: favorites.some((f) => f.id === item.id)
            ? "Remove from My List"
            : "Add to My List",
          action: () => {
            setModal(undefined);
            void toggle(item);
          },
        },
        { label: "Cancel", action: () => setModal(undefined) },
      ],
    });
  };
  const loadCatalog = async (
    cat: Catalog,
    skip = 0,
    values = skip ? catalogValues : catalogDefaults(cat),
  ) => {
    const ticket = ++epoch.current;
    setCatalog(cat);
    setCatalogValues(values);
    if (!skip) setNextSkip(undefined);
    const missing = catalogFilters(cat).find(
      (f) => f.required && !values[f.name]?.trim(),
    );
    if (missing) {
      setItems([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      const page = await api.discover({
        type: cat.type,
        catalog: cat.id,
        addonId: cat.addonId,
        search: values.search || undefined,
        genre: values.genre || undefined,
        extras: Object.fromEntries(
          Object.entries(values).filter(
            ([key, value]) =>
              key !== "search" && key !== "genre" && value !== "",
          ),
        ),
        skip,
      });
      if (ticket !== epoch.current) return;
      if (page.unsupportedCount) notify("Some catalog items use an unsupported media type.");
      setItems((old) =>
        skip
          ? [
              ...old,
              ...page.items.filter(
                (i) => !old.some((o) => o.type === i.type && o.id === i.id),
              ),
            ]
          : page.items,
      );
      setNextSkip(
        page.hasMore ? (page.nextSkip ?? skip + page.items.length) : undefined,
      );
    } catch (e) {
      fail(e);
    } finally {
      if (ticket === epoch.current) setBusy(false);
    }
  };
  const navigate = async (next: Screen) => {
    const ticket = ++epoch.current;
    setItems([]);
    go(next);
    setBusy(true);
    try {
      if (next === "Home") await loadHome();
      if (next === "My List") {
        const value = await api.favorites(profile);
        if (ticket === epoch.current) setItems(value);
      }
      if (next === "Discover") {
        try {
          const available = await api.catalogs();
          if (ticket !== epoch.current) return;
          setCatalogs(available); setCatalogError("");
          const chosen = available.find(value => value.id === catalog?.id && value.addonId === catalog?.addonId && value.type === catalog?.type) ?? available[0];
          if (chosen) await loadCatalog(chosen);
          else setCatalog(undefined);
        } catch (cause) {
          if (ticket === epoch.current) setCatalogError(cause instanceof Error ? cause.message : "Unable to load catalogs.");
        }
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (screen !== "Search") return;
    const ticket = ++epoch.current;
    const scope = api.createScope();
    setItems([]);
    setSearchRows([]);
    setSearchPartial(false);
    if (!query.trim()) {
      setBusy(false);
      return;
    }
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const results: MediaItem[] = [],
          rows: { name: string; items: readonly MediaItem[] }[] = [];
        const cats = catalogs
          .filter(
            (c) =>
              c.supportsSearch &&
              (searchScope === "all" || c.type === searchScope),
          )
          .slice(0, 128);
        for (let i = 0; i < cats.length; i += 3) {
          const pages = await Promise.all(
            cats.slice(i, i + 3).map((c) =>
              api
                .discover(
                  {
                    type: c.type,
                    catalog: c.id,
                    addonId: c.addonId,
                    search: query.trim(),
                  },
                  { signal: scope.signal },
                )
                .then((p) => ({ name: c.name, items: p.items }))
                .catch(() => {
                  if (ticket === epoch.current && !scope.signal.aborted)
                    setSearchPartial(true);
                  return { name: c.name, items: [] };
                }),
            ),
          );
          if (ticket !== epoch.current) return;
          for (const page of pages) {
            const unique = page.items
              .filter(
                (item, index, all) =>
                  all.findIndex(
                    (other) => other.type === item.type && other.id === item.id,
                  ) === index,
              )
              .slice(0, 24);
            rows.push({ name: page.name, items: unique });
            for (const item of unique)
              if (
                !results.some((r) => r.type === item.type && r.id === item.id)
              )
                results.push(item);
          }
          setItems([...results]);
          setSearchRows([...rows]);
        }
        if (searchScope === "all" || searchScope === "live") {
          const live = await api.live(
            { view: "us", search: query.trim(), limit: 80 },
            { signal: scope.signal },
          );
          if (ticket !== epoch.current) return;
          rows.push({ name: "Live TV", items: live.channels.slice(0, 24) });
          results.push(...live.channels.slice(0, 24));
          setItems([...results]);
          setSearchRows([...rows]);
        }
      } catch (e) {
        if (!scope.signal.aborted && ticket === epoch.current)
          setSearchPartial(true);
      } finally {
        if (ticket === epoch.current) setBusy(false);
      }
    }, 650);
    return () => {
      clearTimeout(t);
      scope.abort();
    };
  }, [query, screen, catalogs, searchScope]);
  useEffect(() => {
    if (screen !== "sources" || modal || !sources.length) return;
    if (
      !sources.some(
        (s) =>
          (sourceQuality === "All" ||
            (s.quality ?? "Unknown") === sourceQuality) &&
          (sourceProvider === "All" ||
            (s.sourceName ?? s.name) === sourceProvider),
      )
    ) {
      const timer = setTimeout(() => focusElement("source-provider"), 35);
      return () => clearTimeout(timer);
    }
  }, [screen, modal, sources, sourceQuality, sourceProvider]);
  const commitSeek = async (position: number) => {
    setSeek(undefined);
    if (Math.abs(position - (snapshot?.time.positionSeconds ?? 0)) < 0.5)
      return;
    try {
      await controller.current?.seek(position);
    } catch (e) {
      fail(e);
    }
  };
  const mediaKey = (key: string) => {
    if (screen !== "player" || modal || entry || editingProfile) return false;
    setOverlay(true);
    const live = selected?.type === "live";
    const focused = (document.activeElement as HTMLElement)?.dataset.focusId;
    const timeline = focused === "timeline" || !overlay;
    if (key === "Info" || key === "ContextMenu" || key === "*") {
      setTimeout(() => focusElement("audio"), 0);
      return true;
    }
    if (key === "MediaStop") {
      void stop();
      return true;
    }
    if (key === "ArrowUp" && !live) {
      focusElement("timeline");
      return true;
    }
    if (key === "ArrowDown" && timeline) {
      focusElement(live ? "audio" : "pause");
      return true;
    }
    if (
      !live &&
      (["MediaRewind", "MediaFastForward"].includes(key) ||
        (timeline && ["ArrowLeft", "ArrowRight"].includes(key)))
    ) {
      const repeat = seekRepeat.current;
      repeat.count = repeat.key === key ? repeat.count + 1 : 0;
      repeat.key = key;
      const multiplier =
        repeat.count >= 15
          ? 60
          : repeat.count >= 9
            ? 15
            : repeat.count >= 5
              ? 6
              : repeat.count >= 2
                ? 3
                : 1;
      const step = key.startsWith("Arrow") ? 10 : 60;
      const sign = key === "ArrowLeft" || key === "MediaRewind" ? -1 : 1;
      const value = Math.max(
        0,
        Math.min(
          snapshot?.time.durationSeconds ?? Infinity,
          (seekValue.current ?? snapshot?.time.positionSeconds ?? 0) +
            step * multiplier * sign,
        ),
      );
      seekValue.current = value;
      setSeek(value);
      clearTimeout(seekTimer.current);
      return true;
    }
    if (key === "Enter" && seekValue.current !== undefined) {
      clearTimeout(seekTimer.current);
      const value = seekValue.current;
      seekValue.current = undefined;
      void commitSeek(value);
      return true;
    }
    if (!live && key === "MediaTrackPrevious") {
      void commitSeek(Math.max(0, (snapshot?.time.positionSeconds ?? 0) - 10));
      return true;
    }
    if (!live && ["MediaPlayPause", "MediaPlay", "MediaPause"].includes(key)) {
      void (snapshot?.state === "paused"
        ? player.current?.play()
        : player.current?.pause());
      return true;
    }
    if (
      live &&
      [
        "MediaPlayPause",
        "MediaPlay",
        "MediaPause",
        "MediaRewind",
        "MediaFastForward",
      ].includes(key)
    )
      return true;
    if (!overlay) {
      setTimeout(() => focusElement(live ? "audio" : "timeline"), 0);
      return true;
    }
    return false;
  };
  const mediaKeyUp = (key: string) => {
    if (
      !["ArrowLeft", "ArrowRight", "MediaRewind", "MediaFastForward"].includes(
        key,
      )
    )
      return;
    seekRepeat.current = { key: "", count: 0 };
    const value = seekValue.current;
    if (value !== undefined) {
      clearTimeout(seekTimer.current);
      seekTimer.current = setTimeout(() => {
        seekValue.current = undefined;
        void commitSeek(value);
      }, 800);
    }
  };
  const editProfile = (p?: TvProfile) => setEditingProfile({ profile: p });
  const trackChoices = (kind: "audio" | "text", page = 0) => {
    const native =
      kind === "audio" ? snapshot?.tracks.audio : snapshot?.tracks.text;
    const server =
      kind === "audio" ? session?.audioTracks : session?.subtitleTracks;
    const canNative =
      session?.mode === "direct" &&
      (kind === "audio"
        ? player.current?.capabilities.canSelectAudioTrack
        : player.current?.capabilities.canSelectTextTrack);
    const choices: Choice[] = [];
    if (
      kind === "text" &&
      page === 0 &&
      (session?.subtitlesSupported ||
        (session?.mode === "direct" &&
          player.current?.capabilities.canDisableTextTrack))
    )
      choices.push({
        label: "Off",
        action: () => {
          setModal(undefined);
          void (
            canNative
              ? player.current!.selectTextTrack(null)
              : controller.current!.replaceTracks({ subtitlesOff: true })
          ).catch(fail);
        },
      });
    const tracks =
      canNative && native?.length
        ? native.map((t) => ({
            label: t.label,
            available: t.available,
            run: () =>
              kind === "audio"
                ? player.current!.selectAudioTrack(t.id)
                : player.current!.selectTextTrack(t.id),
          }))
        : (server ?? []).map((t) => ({
            label: t.title || t.language || `Track ${t.inputIndex + 1}`,
            available: t.selectable,
            run: () =>
              controller.current!.replaceTracks(
                kind === "audio"
                  ? { audioTrackIndex: t.inputIndex }
                  : { subtitleTrackIndex: t.inputIndex, subtitlesOff: false },
              ),
          }));
    for (const t of tracks.slice(page * 5, page * 5 + 5))
      choices.push({
        label: t.available ? t.label : `${t.label} · unavailable`,
        action: () => {
          if (!t.available) {
            notify("This track is not supported on this TV.");
            return;
          }
          setModal(undefined);
          void t.run().catch(fail);
        },
      });
    if (page > 0)
      choices.push({
        label: "Previous",
        action: () => trackChoices(kind, page - 1),
      });
    if ((page + 1) * 5 < tracks.length)
      choices.push({
        label: "Next",
        action: () => trackChoices(kind, page + 1),
      });
    choices.push({ label: "Close", action: () => setModal(undefined) });
    setModal({ title: kind === "audio" ? "Audio" : "Subtitles", choices });
  };
  const cards = (list: readonly MediaItem[], prefix: string) => (
    <div className="cards" data-scroll-id={`cards-${prefix}`}>
      {list.map((item, i) => {
        const inQueue = prefix === "queue" || (screen === "My List" && libraryQueue);
        const presentation = normalizeCore<CardPresentation>("cardPresentation", { item, context: inQueue ? "queue" : "catalog" });
        const activate = () => {
          switch (presentation.primaryAction) {
            case "play": return play(item);
            case "resume": case "next": return discoverSources(item, true);
            case "sources": return discoverSources(item);
            default: return detail(item);
          }
        };
        const card = <TvButton
          className={`media-card ${presentation.imageRole === "logo" ? "logo-card" : ""}`}
          aria-label={item.name}
          id={`${prefix}-${i}`}
          data-nav-left={
            i > 0
              ? `${prefix}-${i - 1}`
              : screen === "Search"
                ? searchKey.current
                : undefined
          }
          data-nav-right={
            i + 1 < list.length ? `${prefix}-${i + 1}` : `${prefix}-${i}`
          }
          key={`${item.type}-${item.id}`}
          onFocus={() => setHighlighted(item)}
          onActivate={() => void activate()}
          onHold={() => {
            // Only the first logical Home row is a queue-management context.
            // Other Home cards retain their ordinary selection on a held OK;
            // My List, search and episode-card menus remain contextual.
            if (screen === "Home") {
              if (inQueue && item.type !== "live") manage(item);
              else void activate();
            } else manage(item);
          }}
        >
          <SharedCardArtwork item={item} context={inQueue ? "queue" : "catalog"} />
          <strong>
            <RokuText>{presentation.title}</RokuText>
          </strong>
          <small>
            <RokuText speed={42}>
              {presentation.subtitle}
            </RokuText>
          </small>
          {presentation.progress != null && (
            <progress value={presentation.progress} max={1} />
          )}
        </TvButton>;
        return responsive ? <div className="responsive-card" key={`${item.type}-${item.id}`}>{card}<TvButton className="card-more" id={`${prefix}-${i}-more`} aria-label={`More options for ${item.name}`} onActivate={() => manage(item)}>•••</TvButton></div> : card;
      })}
    </div>
  );
  const heroItem = highlighted ?? queue[0] ?? recentLive[0] ?? items[0];
  const [heroMetadata, setHeroMetadata] = useState<{ key: string; item: MediaItem }>();
  const heroKey = heroItem ? `${profile}:${heroItem.type}:${heroItem.seriesId ?? heroItem.id}` : "";
  useEffect(() => {
    if (!heroItem || heroItem.type === "live") return;
    const scope = api.createScope();
    const timer = setTimeout(() => {
      void api.detail({ id: heroItem.seriesId ?? heroItem.id, type: heroItem.type }, scope.request()).then((detail) => {
        if (!scope.signal.aborted) setHeroMetadata({ key: heroKey, item: detail.item });
      }).catch(() => { /* The packaged fallback remains usable during metadata failure. */ });
    }, 150);
    return () => { clearTimeout(timer); scope.abort(); };
  }, [api, heroKey]);
  const heroPresentation = heroItem ? normalizeCore<MediaPresentation>("presentation",
    heroMetadata?.key === heroKey ? enrichDetail(heroItem, heroMetadata.item) : heroItem) : undefined;
  useLayoutEffect(() => {
    if (!responsive) return;
    const root = document.querySelector<HTMLElement>(".responsive-app");
    if (root) {
      const anchor = restoredScroll.current;
      root.style.scrollBehavior = "auto";
      root.scrollTop = anchor?.top ?? 0;
      root.scrollLeft = 0;
      for (const element of root.querySelectorAll<HTMLElement>("[data-scroll-id]")) {
        const saved = anchor?.regions.find(region => region.id === element.dataset.scrollId);
        if (!saved) continue;
        element.style.scrollBehavior = "auto";
        element.scrollTop = saved.top;
        element.scrollLeft = saved.left;
        element.style.removeProperty("scroll-behavior");
      }
      if (anchor) focusElement(anchor.focus, { preventScroll: true });
      root.style.removeProperty("scroll-behavior");
      restoredScroll.current = undefined;
    }
  }, [responsive, screen]);
  const selectedPresentation = selected ? normalizeCore<MediaPresentation>("presentation", selected) : undefined;
  const activeProfile = profiles.find((p) => p.id === profile);
  const navItems: Screen[] = [
    "profiles",
    "Home",
    "Discover",
    "Live TV",
    "My List",
    "Search",
    "Settings",
  ];
  const brand = (<div
          className={`brand ${["profiles", "pairing"].includes(screen) ? "gateway-brand" : ""}`}
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/viptv-mark.png`}
            alt="viptv"
          />
        </div>);
  const navigation = (<nav aria-label="Main navigation">
                {navItems.map((n, i) => (
                  <TvButton
                    id={`nav-${n}`}
                    aria-label={n === "profiles" ? "Profile" : n}
                    key={n}
                    className={`${n === screen ? "active" : ""} nav-${n.replace(/ /g, "-").toLowerCase()}`}
                    aria-current={n === screen ? "page" : undefined}
                    onActivate={() =>
                      n === "profiles"
                        ? setScreen("profiles")
                        : void navigate(n)
                    }
                  >
                    {i === 0 && (
                      <span className="nav-initials">
                        {activeProfile?.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <ReadyImage
                      className={`nav-icon ${i === 0 ? "nav-avatar" : ""}`}
                      src={
                        i === 0 && activeProfile
                          ? avatarUrl(activeProfile)
                          : `${import.meta.env.BASE_URL}assets/${["avatar-catalog/critters-1.png", "ui-nav-home.png", "ui-nav-discover.png", "ui-nav-tv.png", "ui-nav-list.png", "ui-nav-search.png", "ui-nav-settings.png"][i]}`
                      }
                      alt=""
                      onError={(e) => {
                        e.currentTarget.style.visibility = "hidden";
                      }}
                    />
                    <em>{n === "profiles" ? "Profile" : n}</em>
                  </TvButton>
                ))}
              </nav>);
  return (
    <RemoteRoot
      inputMode={layout}
      onBack={() => casting ? closeCast() : screen === "player" && fullscreenControl.fullscreen && !modal && !entry && !editingProfile ? void fullscreenControl.exit() : back()}
      onMediaKey={mediaKey}
      onMediaKeyUp={mediaKeyUp}
      onNavigate={() => {
        setOverlay(true);
        sourceFocusPending.current = false;
      }}
    >
      <div
        ref={playerRoot}
        onPointerMove={() => { if (responsive && screen === "player" && Date.now() - lastControlActivity.current > 1000) { lastControlActivity.current = Date.now(); setOverlay(true); setControlActivity(value => value + 1); } }}
        onPointerDownCapture={(event) => { if (responsive && screen === "player" && (event.target as HTMLElement).closest("button, input")) { setOverlay(true); setControlActivity(value => value + 1); } }}
        className={`tv-screen ${responsive ? "responsive-app" : ""} ${oled ? "oled" : ""} screen-${screen.replace(/ /g, "-").toLowerCase()} ${screen === "player" ? "playing" : ""}`}
      >
        <video ref={video} className="video" playsInline onClick={() => responsive && setOverlay((value) => !value)} />
        <canvas ref={canvas} className="video player-canvas" style={{ display: "none" }} onClick={() => responsive && setOverlay((value) => !value)} />
        {responsive && !["startup", "pairing", "player"].includes(screen) && <header className="responsive-toolbar">
          {brand}
          {screen !== "profiles" && navigation}
          <div className="toolbar-spacer" />
          <TvButton id="responsive-cast" aria-label="Watch on TV" onActivate={openCast}><img src={`${import.meta.env.BASE_URL}assets/ui-nav-tv.png`} alt="" /></TvButton>
          {!["profiles"].includes(screen) && <TvButton id="responsive-profile" aria-label="Choose profile" onActivate={() => setScreen("profiles")}><ReadyImage src={activeProfile ? avatarUrl(activeProfile) : undefined} alt="" /><span>{activeProfile?.name ?? "Profile"}</span></TvButton>}
        </header>}
        {(!responsive || ["startup", "player"].includes(screen)) && brand}

        {screen === "startup" ? null : screen === "pairing" ? (
          responsive ? <ResponsiveSignIn api={api} pair={pair} qr={qr} onRetry={() => void pairing()} /> : <section className="pairing">
            <h1>Sign in to VIPTV</h1>
            <p>Visit this address, then enter the code shown below.</p>
            <h2>{pair?.verificationUri ?? "Connecting…"}</h2>
            <div className="pair-code">{pair?.userCode ?? "••••••"}</div>
            {qr && <img className="qr" src={qr} alt="Scan to link your TV" />}
            <TvButton id="retry" onActivate={() => void pairing()}>
              Try again
            </TvButton>
          </section>
        ) : screen === "profiles" ? (
          <section className="profiles">
            <h1>{managing ? "Manage profiles" : "Who's watching?"}</h1>
            <div className="profile-row">
              {profiles
                .slice(profilePage * 5, profilePage * 5 + 5)
                .map((p, i) => (
                  <TvButton
                    id={`profile-${i}`}
                    key={p.id}
                    onActivate={() =>
                      managing ? editProfile(p) : void chooseProfile(p.id)
                    }
                    onHold={() => editProfile(p)}
                  >
                    <span className="profile-initials">
                      {p.name.slice(0, 2).toUpperCase()}
                    </span>
                    <ReadyImage src={avatarUrl(p)} alt="" />
                    <strong>
                      <RokuText>{p.name}</RokuText>
                    </strong>
                  </TvButton>
                ))}
            </div>
            <div className="profile-actions">
              <TvButton
                id="add-profile"
                disabled={profiles.length >= 12}
                onActivate={() => editProfile()}
              >
                Add profile
              </TvButton>
              <TvButton
                id="manage-profiles"
                onActivate={() => setManaging(!managing)}
              >
                {managing ? "Done" : "Manage profiles"}
              </TvButton>
            </div>
            {profiles.length > 5 && (
              <div className="profile-pager">
                <TvButton
                  id="profiles-previous"
                  disabled={profilePage === 0}
                  onActivate={() => setProfilePage((p) => p - 1)}
                >
                  Previous
                </TvButton>
                <span>
                  {profilePage + 1} / {Math.ceil(profiles.length / 5)}
                </span>
                <TvButton
                  id="profiles-next"
                  disabled={(profilePage + 1) * 5 >= profiles.length}
                  onActivate={() => setProfilePage((p) => p + 1)}
                >
                  Next
                </TvButton>
              </div>
            )}
          </section>
        ) : (
          <>
            {!responsive && !["detail", "sources", "player"].includes(screen) && navigation}
            {screen === "Home" && (
              <main className={`home ${compactHome ? "compact-home" : ""}`}>
                {!responsive && heroPresentation?.heroImage && (
                  <HeroArtwork
                    key={heroPresentation.heroImage}
                    uri={heroPresentation.heroImage}
                  />
                )}
                {responsive && <div className="responsive-hero-art"><CardArtwork src={heroPresentation?.heroImage ?? undefined} fallback="Preview unavailable" /></div>}
                <div className="hero">
                  <small>
                    {(highlighted ?? queue[0] ?? recentLive[0] ?? items[0])
                      ?.type === "live"
                      ? "LIVE NOW"
                      : (highlighted ?? queue[0])?.position
                        ? "CONTINUE WATCHING"
                        : `FEATURED ${(highlighted ?? items[0])?.type?.toUpperCase() ?? "MOVIE"}`}
                  </small>
                  {responsive ? <ResponsiveTitle title={heroItem?.name ?? "VIPTV"} logo={heroPresentation?.titleLogo} /> : <h1><RokuText>{heroItem?.name ?? "VIPTV"}</RokuText></h1>}
                  <p>
                    {(highlighted ?? queue[0] ?? recentLive[0] ?? items[0])
                      ?.description ?? ""}
                  </p>
                  <div className="hero-facts">
                    {[
                      heroItem?.year,
                      heroItem?.runtime,
                      ...(heroItem?.genres.slice(0, 2) ?? []),
                    ]
                      .filter(Boolean)
                      .join("  ·  ")}
                  </div>
                  <div className="actions">
                    <TvButton
                      id="hero-play"
                      className={
                        (highlighted ?? queue[0])?.queueStatus === "next"
                          ? "wide-action"
                          : undefined
                      }
                      onFocus={() => setCompactHome(false)}
                      onActivate={() => {
                        const item =
                          highlighted ?? queue[0] ?? recentLive[0] ?? items[0];
                        if (item)
                          void discoverSources(
                            item,
                            !!item.position || item.queueStatus === "next",
                          );
                      }}
                      onHold={() => {
                        const item =
                          highlighted ?? queue[0] ?? recentLive[0] ?? items[0];
                        if (!item) return;
                        // Queue management belongs to the hero only when its
                        // current item came from Home's first logical row.
                        // A non-queue hero keeps its normal hold action. For a
                        // series root discoverSources deliberately opens its
                        // episode detail rather than a source list.
                        if (
                          item.type !== "live" &&
                          queue.some(
                            (queued) =>
                              queued.id === item.id &&
                              queued.type === item.type,
                          )
                        )
                          manage(item);
                        else void discoverSources(item);
                      }}
                    >
                      {heroPresentation?.primaryActionLabel ?? "Play"}
                    </TvButton>
                    {responsive && <><TvButton id="hero-save" className="compact-action" aria-label="My List" aria-pressed={favorites.some((item) => item.id === heroItem?.id)} onActivate={() => { if (heroItem) void toggle(heroItem); }}>{favorites.some((item) => item.id === heroItem?.id) ? "✓" : "+"}</TvButton><TvButton id="hero-more" className="compact-action" aria-label="More options" onActivate={() => { if (heroItem) setModal({ title: heroItem.name, choices: [{ label: "Details", action: () => { setModal(undefined); void detail(heroItem); } }, { label: "More actions", action: () => manage(heroItem) }, { label: "Cancel", action: () => setModal(undefined) }] }); }}>•••</TvButton></>}
                    <TvButton
                      id="hero-details"
                      onFocus={() => setCompactHome(false)}
                      onActivate={() => {
                        const item =
                          highlighted ?? queue[0] ?? recentLive[0] ?? items[0];
                        if (item) void detail(item);
                      }}
                    >
                      Details
                    </TvButton>
                  </div>
                </div>
                <div
                  className="shelves"
                  onFocusCapture={(event) => {
                    const section = (event.target as HTMLElement).closest(
                      "section",
                    );
                    const first = event.currentTarget.querySelector("section");
                    setCompactHome(!!section && section !== first);
                  }}
                >
                  {queue.length > 0 && (
                    <section>
                      <h2>Continue Watching</h2>
                      {cards(queue, "queue")}
                    </section>
                  )}
                  {recentLive.length > 0 && (
                    <section>
                      <h2>Recently Watched Live TV</h2>
                      {cards(recentLive, "recent-live")}
                    </section>
                  )}
                  {items.length > 0 && (
                    <section>
                      <h2>
                        {catalogs.find((c) => c.type !== "live")?.name ??
                          "Discover"}
                      </h2>
                      {cards(items, "home")}
                    </section>
                  )}
                  {homeRows
                    .filter((row) => row.items.length)
                    .map((row, i) => (
                      <section key={`${row.name}-${i}`}>
                        <h2>{row.name}</h2>
                        {cards(row.items, `shelf-${i}`)}
                      </section>
                    ))}
                  {favorites.length > 0 && (
                    <section>
                      <h2>My List</h2>
                      {cards(favorites, "saved")}
                    </section>
                  )}
                </div>
              </main>
            )}
            {["Discover", "My List", "Search"].includes(screen) && (
              <main className={`browse ${screen === "Search" ? "search" : ""}`}>
                <h1>{screen}</h1>
                {screen === "Search" && (
                  <div
                    className="keyboard"
                    onFocusCapture={(event) => {
                      const id = (event.target as HTMLElement).dataset.focusId;
                      if (id?.startsWith("key-")) searchKey.current = id;
                    }}
                    onKeyDown={(event) => {
                      const id =
                        (event.target as HTMLElement).dataset.focusId ?? "";
                      const index =
                        "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890".indexOf(
                          id.replace("key-", ""),
                        );
                      if (
                        items.length &&
                        (["MediaPlay", "MediaPlayPause"].includes(event.key) ||
                          (event.key === "ArrowRight" &&
                            index >= 0 &&
                            index % 6 === 5))
                      ) {
                        event.preventDefault();
                        event.stopPropagation();
                        focusElement("result-0");
                      }
                    }}
                  >
                    <input
                      tabIndex={responsive ? 0 : -1}
                      maxLength={256}
                      aria-label="Search titles"
                      placeholder="Search movies and shows"
                      onKeyDown={(e) => {
                        if (
                          (responsive ? ["Enter"] : ["Enter", "ArrowRight", "MediaPlay"]).includes(e.key) &&
                          items.length
                        ) {
                          e.preventDefault();
                          e.stopPropagation();
                          focusElement("result-0");
                        }
                      }}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <div>
                      {"ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"
                        .split("")
                        .map((c) => (
                          <TvButton
                            id={`key-${c}`}
                            key={c}
                            onActivate={() =>
                              setQuery((q) => (q + c).slice(0, 256))
                            }
                          >
                            {c.toLowerCase()}
                          </TvButton>
                        ))}
                    </div>
                    <TvButton
                      id="space"
                      aria-label="Space"
                      onActivate={() =>
                        setQuery((q) => (q + " ").slice(0, 256))
                      }
                    >
                      <svg
                        aria-hidden="true"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M3 12v4h18v-4" />
                      </svg>
                    </TvButton>
                    <TvButton
                      id="delete"
                      aria-label="Delete"
                      onActivate={() => setQuery((q) => q.slice(0, -1))}
                    >
                      <svg
                        aria-hidden="true"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M8 6h13v12H8l-6-6zM11 9l6 6m0-6-6 6" />
                      </svg>
                    </TvButton>
                    <TvButton
                      id="clear"
                      aria-label="Clear"
                      onActivate={() => setQuery("")}
                    >
                      <svg
                        aria-hidden="true"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M5 6h14M9 6V3h6v3M7 6v15h10V6M10 9v9m4-9v9" />
                      </svg>
                    </TvButton>
                    <p className="search-help">
                      Type here or use your remote app. Play/Pause opens
                      results.
                    </p>
                  </div>
                )}
                {screen === "Discover" && <>
                  {catalogError && <div className="catalog-status" role="alert"><p>{catalogError}</p><button onClick={() => void navigate("Discover")}>Retry catalogs</button></div>}
                  {!busy && !catalogError && !catalogs.length && <p className="catalog-status">No catalogs are available. Add or enable a catalog addon in Settings.</p>}
                </>}
                {screen === "Discover" && (
                  <div className="filters">
                    <TvButton
                      id="discover-type"
                      onActivate={() =>
                        setModal({
                          title: "Content type",
                          choices: Array.from(
                            new Set(catalogs.map((c) => c.type)),
                          ).map((type) => ({
                            label: type,
                            action: () => {
                              setModal(undefined);
                              const cat = catalogs.find((c) => c.type === type);
                              if (cat) void loadCatalog(cat);
                            },
                          })),
                        })
                      }
                    >
                      {catalog?.type ?? "Content type"}
                    </TvButton>
                    <TvButton
                      id="discover-catalog"
                      onActivate={() =>
                        setModal({
                          title: "Catalog",
                          choices: catalogs
                            .filter((c) => !catalog || c.type === catalog.type)
                            .map((cat) => ({
                              label: `${cat.name}${cat.addonName ? ` · ${cat.addonName}` : ""}`,
                              action: () => {
                                setModal(undefined);
                                void loadCatalog(cat);
                              },
                            })),
                        })
                      }
                    >
                      {catalog ? `${catalog.name}${catalog.addonName ? ` · ${catalog.addonName}` : ""}` : "Catalog"}
                    </TvButton>
                    {catalog &&
                      catalogFilters(catalog).map((filter) => (
                        <TvButton
                          key={filter.name}
                          id={`discover-filter-${filter.name}`}
                          onActivate={() => {
                            const apply = (value: string) => {
                              setModal(undefined);
                              void loadCatalog(catalog, 0, {
                                ...catalogValues,
                                [filter.name]: value,
                              });
                            };
                            if (filter.options.length)
                              setModal({
                                title: catalogFilterLabel(filter.name),
                                choices: [
                                  ...(!filter.required
                                    ? [
                                        {
                                          label: "Any",
                                          action: () => apply(""),
                                        },
                                      ]
                                    : []),
                                  ...filter.options.map((value) => ({
                                    label: value,
                                    action: () => apply(value),
                                  })),
                                ],
                              });
                            else
                              setEntry({
                                title: catalogFilterLabel(filter.name),
                                initialValue: catalogValues[filter.name] ?? "",
                                save: async (value) => {
                                  if (filter.required && !value.trim())
                                    throw new Error(
                                      "Enter a value for this required filter.",
                                    );
                                  setEntry(undefined);
                                  apply(value.trim());
                                },
                              });
                          }}
                        >
                          {catalogFilterLabel(filter.name)}:{" "}
                          {catalogValues[filter.name] ||
                            (filter.required ? "Required" : "Any")}
                        </TvButton>
                      ))}
                  </div>
                )}
                {screen === "My List" && (
                  <div className="filters">
                    <TvButton
                      id="library-list"
                      onActivate={() => setLibraryQueue(false)}
                    >
                      My List
                    </TvButton>
                    <TvButton
                      id="library-queue"
                      onActivate={() => setLibraryQueue(true)}
                    >
                      Continue Watching
                    </TvButton>
                  </div>
                )}
                <div className="result-grid">
                  {screen === "Search"
                    ? searchRows
                        .filter((row) => row.items.length)
                        .map((row, i) => (
                          <section key={`${row.name}-${i}`}>
                            <h2>{row.name}</h2>
                            {cards(
                              row.items,
                              i === 0 ? "result" : `search-${i}`,
                            )}
                          </section>
                        ))
                    : cards(
                        screen === "My List" && libraryQueue ? queue : items,
                        "result",
                      )}
                  {screen === "Discover" &&
                    catalog &&
                    nextSkip !== undefined && (
                      <TvButton
                        id="discover-more"
                        onActivate={() => void loadCatalog(catalog, nextSkip)}
                      >
                        Load more
                      </TvButton>
                    )}
                  {!busy &&
                    !items.length &&
                    (screen !== "Search" || !!query.trim()) && (
                      <p>
                        {screen === "Discover" &&
                        catalog &&
                        catalogFilters(catalog).some(
                          (f) => f.required && !catalogValues[f.name]?.trim(),
                        )
                          ? "Choose the required filters to browse this catalog."
                          : query
                            ? "No matching titles"
                            : "No titles yet"}
                      </p>
                    )}
                </div>
                {screen === "Search" && (
                  <p className="search-status" role="status">
                    {busy
                      ? "Searching…"
                      : query.trim()
                        ? `${items.length} results`
                        : "Find your next favorite."}
                    {searchPartial ? " Some sources couldn't load." : ""}
                  </p>
                )}
              </main>
            )}
            {screen === "detail" && selected && (
              <main
                className={`detail ${selected.type === "series" && !selected.episode ? "series" : "movie"}`}
              >
                {!responsive && selected.background && (
                  <div className="detail-backdrop" aria-hidden="true">
                    <ReadyImage src={selected.background} alt="" />
                  </div>
                )}
                {!responsive && <ReadyImage className="poster" src={selected.poster} alt="" />}
                {responsive && <div className="responsive-detail-art"><CardArtwork src={selectedPresentation?.heroImage ?? undefined} fallback="Preview unavailable" /></div>}
                <div className="detail-copy">
                  {responsive ? <ResponsiveTitle title={selected.name} logo={selectedPresentation?.titleLogo} /> : <h1><RokuText>{selected.name}</RokuText></h1>}
                  <p className="detail-facts">
                    {[selected.year, selected.runtime, ...selected.genres]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="detail-synopsis">{selected.description}</p>
                  <div className="actions">
                    <TvButton
                      id="detail-play"
                      onActivate={() =>
                        selected.type === "series" && !selected.episode
                          ? setModal({
                              title: "Season",
                              choices: Array.from(
                                new Set(episodes.map((e) => e.season)),
                              ).map((n) => ({
                                label: `Season ${n ?? 1}`,
                                action: () => {
                                  setSeason(n);
                                  setModal(undefined);
                                },
                              })),
                            })
                          : void (selected.type === "live"
                              ? play(selected)
                              : discoverSources(selected, !!selected.position))
                      }
                      onHold={() => void discoverSources(selected)}
                    >
                      {selected.type === "series" && !selected.episode
                        ? `Season ${season ?? 1}`
                        : selected.position
                          ? `Resume at ${time(selected.position)}`
                          : "Choose source"}
                    </TvButton>
                    {!!selected.position &&
                      !(selected.type === "series" && !selected.episode) && (
                        <TvButton
                          id="detail-source"
                          onActivate={() => void discoverSources(selected)}
                        >
                          Choose source
                        </TvButton>
                      )}
                    <TvButton
                      id="detail-save"
                      aria-label={favorites.some((f) => f.id === selected.id) ? "Remove from My List" : "Add to My List"}
                      aria-pressed={favorites.some((f) => f.id === selected.id)}
                      onActivate={() => void toggle(selected)}
                    >
                      {responsive ? (favorites.some((f) => f.id === selected.id) ? "✓" : "+") : favorites.some((f) => f.id === selected.id) ? "Remove from My List" : "+ My List"}
                    </TvButton>
                    <TvButton
                      id="detail-info"
                      aria-label="More info"
                      onActivate={() =>
                        setModal({
                          title: selected.name,
                          body: [
                            selected.name,
                            [
                              selected.year,
                              selected.runtime,
                              ...selected.genres,
                            ]
                              .filter(Boolean)
                              .join(" · "),
                            selected.description,
                            typeof selected.raw.director === "string"
                              ? `Director: ${selected.raw.director}`
                              : "",
                            Array.isArray(selected.raw.cast)
                              ? `Cast: ${selected.raw.cast.filter((name) => typeof name === "string").join(", ")}`
                              : "",
                          ]
                            .filter(Boolean)
                            .join("\n\n"),
                          choices: [
                            ...(responsive ? [{ label: "Choose source", action: () => { setModal(undefined); void discoverSources(selected); } }, { label: "More actions", action: () => manage(selected) }] : []),
                            {
                              label: "Close",
                              action: () => setModal(undefined),
                            },
                          ],
                        })
                      }
                    >
                      {responsive ? "•••" : "More info"}
                    </TvButton>
                  </div>
                  <p className="detail-credits">
                    {[
                      typeof selected.raw.director === "string"
                        ? `Director: ${selected.raw.director}`
                        : "",
                      Array.isArray(selected.raw.cast)
                        ? `Cast: ${selected.raw.cast.filter((name) => typeof name === "string").join(", ")}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join("\n")}
                  </p>
                </div>
                {episodes.length > 0 && (
                  <>
                    <span className="episode-heading">Episodes</span>
                    <div className="episode-grid" data-scroll-id="episodes">
                      {episodes
                        .filter((e) => e.season === season)
                        .map((e, i) => {
                          const episodeCard = <TvButton
                            className="episode"
                            id={`episode-${i}`}
                            key={e.id}
                            onActivate={() => void discoverSources(e)}
                            onHold={() => manage(e)}
                          >
                            <CardArtwork
                              src={artworkUrl(
                                normalizeCore<MediaPresentation>("presentation", e).episodeImage ?? e.background ?? e.poster,
                                256,
                                144,
                              )}
                              fallback={
                                <>
                                  <img
                                    src={`${import.meta.env.BASE_URL}assets/viptv-mark.png`}
                                    alt=""
                                  />
                                  <span>Preview unavailable</span>
                                </>
                              }
                            />
                            {e.watched && (
                              <span className="watched-badge">WATCHED</span>
                            )}
                            {!e.watched && !!e.position && !!e.duration && (
                              <progress value={e.position} max={e.duration} />
                            )}
                            <small>EPISODE {e.episode ?? "?"}</small>
                            <h2>
                              <RokuText>{e.episodeTitle ?? e.name}</RokuText>
                            </h2>
                            <p>{e.description}</p>
                          </TvButton>;
                          return responsive ? <div className="responsive-episode" key={e.id}>{episodeCard}<TvButton className="episode-more" id={`episode-${i}-more`} aria-label={`More options for ${e.episodeTitle ?? e.name}`} onActivate={() => manage(e)}>•••</TvButton></div> : episodeCard;
                        })}
                    </div>
                  </>
                )}
              </main>
            )}
            {screen === "sources" && (
              <main className="sources">
                <h1>Sources</h1>
                <p className="source-context">
                  {selected?.name}
                  {selected ? `  ${presentationContext(selected)}` : ""}
                </p>
                <div className="source-filters">
                  <TvButton
                    id="source-quality"
                    onActivate={() =>
                      setModal({
                        title: "Quality",
                        choices: [
                          "All",
                          ...Array.from(
                            new Set(sources.map((s) => s.quality ?? "Unknown")),
                          ),
                        ].map((label) => ({
                          label,
                          action: () => {
                            setSourceQuality(label);
                            setModal(undefined);
                          },
                        })),
                      })
                    }
                  >
                    Quality: {sourceQuality}
                  </TvButton>
                  <TvButton
                    id="source-provider"
                    onActivate={() =>
                      setModal({
                        title: "Source provider",
                        choices: [
                          "All",
                          ...Array.from(
                            new Set(sources.map((s) => s.sourceName ?? s.name)),
                          ),
                        ].map((label) => ({
                          label,
                          action: () => {
                            setSourceProvider(label);
                            setModal(undefined);
                          },
                        })),
                      })
                    }
                  >
                    Provider: {sourceProvider}
                  </TvButton>
                  <span className={busy ? "finding" : undefined}>
                    {busy && (
                      <i
                        className="source-discovery-spinner"
                        aria-hidden="true"
                      />
                    )}
                    {busy ? "Finding sources…" : `${sources.length} sources`}
                  </span>
                </div>
                <div className="source-results">
                  {sources
                    .filter(
                      (s) =>
                        (sourceQuality === "All" ||
                          (s.quality ?? "Unknown") === sourceQuality) &&
                        (sourceProvider === "All" ||
                          (s.sourceName ?? s.name) === sourceProvider),
                    )
                    .map((s, i) => (
                      <TvButton
                        id={`source-${i}`}
                        key={s.id}
                        className="source"
                        onHold={() =>
                          setModal({
                            title: "Source details",
                            body: [s.name, s.title, s.filename, s.sourceName]
                              .filter(Boolean)
                              .join("\n\n"),
                            choices: [
                              {
                                label: "Close",
                                action: () => setModal(undefined),
                              },
                            ],
                          })
                        }
                        onActivate={() =>
                          selected &&
                          void play(selected, s, selected.position ?? 0)
                        }
                      >
                        <h2>{s.sourceName ?? s.name}</h2>
                        <p>
                          {[s.name, s.title ?? s.filename]
                            .filter(Boolean)
                            .join("\n")}
                        </p>
                        <small>
                          {s.quality} {s.audio} {s.sourceName}
                        </small>
                      </TvButton>
                    ))}
                  {!sources.length && (
                    <div
                      className={`source-empty ${busy ? "finding" : ""}`}
                      role="status"
                    >
                      <h2>
                        {busy ? "Finding sources" : "No sources available"}
                      </h2>
                      <p>
                        {busy
                          ? "Sources appear here as they arrive."
                          : "Check your add-ons in Settings."}
                      </p>
                    </div>
                  )}
                  {sources.length > 0 &&
                    !sources.some(
                      (s) =>
                        (sourceQuality === "All" ||
                          (s.quality ?? "Unknown") === sourceQuality) &&
                        (sourceProvider === "All" ||
                          (s.sourceName ?? s.name) === sourceProvider),
                    ) && (
                      <p>
                        No matching sources. Choose another provider or quality.
                      </p>
                    )}
                </div>
              </main>
            )}
            {screen === "Live TV" && (
              <LiveGuide
                responsive={responsive}
                api={api}
                onPlay={(item) => void play(item)}
                onError={fail}
                onDetails={(item, program) =>
                  setModal({
                    title: program
                      ? `${program.title} · ${program.description ?? ""}`
                      : "No guide information. You can still watch this channel.",
                    choices: [
                      {
                        label: "Watch channel now",
                        action: () => {
                          setModal(undefined);
                          void play(item);
                        },
                      },
                      { label: "Close", action: () => setModal(undefined) },
                    ],
                  })
                }
              />
            )}
            {screen === "Settings" && (
              <Settings
                api={api}
                serverOrigin={api.serverOrigin}
                profile={profile}
                prefs={prefs}
                appearance={responsive ? { oled, toggle: toggleOled } : undefined}
                onPrefs={setPrefs}
                onProfiles={() => {
                  setManaging(false);
                  go("profiles");
                }}
                onManageProfiles={() => {
                  setManaging(true);
                  go("profiles");
                }}
                onError={fail}
                onModal={(title, choices) =>
                  setModal(choices.length ? { title, choices } : undefined)
                }
                onSignOut={() =>
                  setModal({
                    title: "Sign out of this TV?",
                    choices: [
                      {
                        label: "Sign out",
                        action: () => {
                          setModal(undefined);
                          void authorize(
                            "Enter parent PIN to sign out",
                            (signal) => api.signOut({ signal }),
                            () => {
                              setProfile("");
                              setProfiles([]);
                              setScreen("pairing");
                              void pairing();
                            },
                          );
                        },
                      },
                      { label: "Cancel", action: () => setModal(undefined) },
                    ],
                  })
                }
              />
            )}
            {screen === "player" && overlay && (
              <div
                className={`player-overlay ${selected?.type === "live" ? "live-overlay" : ""}`}
              >
                {responsive && <TvButton id="exit" className="responsive-player-back" aria-label="Back" onActivate={() => void stop()}>←</TvButton>}
                <div
                  className={`player-identity ${selected?.type === "live" ? "channel-identity" : ""}`}
                >
                  {selected?.type === "live" ? (
                    selected.poster && (
                      <ReadyImage src={selected.poster} alt="" />
                    )
                  ) : (
                    <img
                      src={`${import.meta.env.BASE_URL}assets/viptv-mark.png`}
                      alt=""
                    />
                  )}
                  <span>{selected?.name}</span>
                </div>
                <span className="player-status">
                  {busy
                    ? "LOADING"
                    : snapshot?.state === "paused"
                      ? "PAUSED"
                      : "PLAYING"}
                </span>
                <span className="player-eyebrow">
                  {selected?.type === "live" ? "LIVE NOW" : "NOW PLAYING"}
                </span>
                <div className="player-context">
                  {selected?.season
                    ? `S${selected.season} · E${selected.episode ?? 1} · ${selected.episodeTitle ?? ""}`
                    : ""}
                </div>
                <h1>
                  <RokuText>{selected?.name ?? ""}</RokuText>
                </h1>
                <div className="playback-bottom">
                  {selected?.type !== "live" && (
                    <>
                      <p className="player-time">
                        <span>
                          {time(seek ?? snapshot?.time.positionSeconds ?? 0)}
                        </span>
                        <span>{time(snapshot?.time.durationSeconds ?? 0)}</span>
                      </p>
                      <TvButton
                        id="timeline"
                        className="timeline"
                        onActivate={() =>
                          void (snapshot?.state === "paused"
                            ? player.current?.play()
                            : player.current?.pause())
                        }
                      >
                        <progress
                          aria-label="Playback position"
                          value={seek ?? snapshot?.time.positionSeconds ?? 0}
                          max={snapshot?.time.durationSeconds ?? 1}
                        />
                      </TvButton>
                    </>
                  )}
                  <div className="controls">
                    {selected?.type !== "live" && (
                      <>
                        <TvButton
                          id="rewind"
                          aria-label="Rewind 10 seconds"
                          onActivate={() =>
                            void commitSeek(
                              Math.max(
                                0,
                                (snapshot?.time.positionSeconds ?? 0) - 10,
                              ),
                            )
                          }
                        >
                          <img
                            src={`${import.meta.env.BASE_URL}assets/ui-nav-player-rewind.png`}
                            alt=""
                          />
                        </TvButton>
                        <TvButton
                          id="pause"
                          aria-label={
                            snapshot?.state === "paused" ? "Play" : "Pause"
                          }
                          onActivate={() =>
                            void (snapshot?.state === "paused"
                              ? player.current?.play()
                              : player.current?.pause())
                          }
                        >
                          <img
                            src={`${import.meta.env.BASE_URL}assets/ui-nav-player-${snapshot?.state === "paused" ? "play" : "pause"}.png`}
                            alt=""
                          />
                        </TvButton>
                        <TvButton
                          id="forward"
                          aria-label="Forward 30 seconds"
                          onActivate={() =>
                            void commitSeek(
                              Math.min(
                                snapshot?.time.durationSeconds ?? Infinity,
                                (snapshot?.time.positionSeconds ?? 0) + 30,
                              ),
                            )
                          }
                        >
                          <img
                            src={`${import.meta.env.BASE_URL}assets/ui-nav-player-forward.png`}
                            alt=""
                          />
                        </TvButton>
                        {selected?.type === "series" && (
                          <TvButton
                            id="next"
                            onActivate={() => void nextEpisode()}
                          >
                            <img
                              src={`${import.meta.env.BASE_URL}assets/ui-nav-player-forward.png`}
                              alt="Next episode"
                            />
                          </TvButton>
                        )}
                      </>
                    )}
                    <TvButton
                      id="audio"
                      aria-label="Audio"
                      onActivate={() => trackChoices("audio")}
                    >
                      <img
                        src={`${import.meta.env.BASE_URL}assets/ui-nav-player-audio.png`}
                        alt=""
                      />
                    </TvButton>
                    <TvButton
                      id="subtitles"
                      aria-label="Subtitles"
                      onActivate={() => trackChoices("text")}
                    >
                      <img
                        src={`${import.meta.env.BASE_URL}assets/ui-nav-player-captions.png`}
                        alt=""
                      />
                    </TvButton>
                    {responsive && <div className="responsive-player-tools">
                      {player.current?.capabilities.canSetVolume && snapshot?.volume ? <div className="player-volume">
                        <button type="button" aria-label={snapshot.volume.muted ? "Unmute" : "Mute"} onClick={() => void player.current?.setMuted?.(!snapshot.volume?.muted).catch(fail)}>{snapshot.volume.muted ? <VolumeX size={22} /> : <Volume2 size={22} />}</button>
                        <input type="range" aria-label="Volume" min="0" max="1" step="0.01" value={snapshot.volume.muted ? 0 : snapshot.volume.level} onChange={(event) => { setOverlay(true); void player.current?.setVolume?.(Number(event.target.value)).catch(fail); }} />
                      </div> : <span className="system-volume">Use device volume buttons</span>}
                      <button type="button" aria-label="Playback info" title="Playback info" onClick={() => setModal({ title: "Playback info", body: [
                        `Decoder: ${snapshot?.diagnostics?.engine ?? player.current?.capabilities.engine ?? "Unknown"}`,
                        `Transport: ${snapshot?.diagnostics?.networkTransport ?? "Unknown"}`,
                        `Container: ${snapshot?.diagnostics?.transport ?? session?.format ?? "Unknown"}`,
                        `Delivery: ${session?.videoMode === "transcode" || session?.audioMode === "transcode" ? "Transcode" : session?.mode || "Unknown"}`,
                        session?.videoMode ? `Video delivery: ${session.videoMode}` : "",
                        session?.audioMode ? `Audio delivery: ${session.audioMode}` : "",
                        snapshot?.diagnostics?.videoCodec ? `Video codec: ${snapshot.diagnostics.videoCodec}` : "",
                        snapshot?.diagnostics?.audioCodec ? `Audio codec: ${snapshot.diagnostics.audioCodec}` : "",
                        snapshot?.diagnostics?.width ? `Resolution: ${snapshot.diagnostics.width} × ${snapshot.diagnostics.height}` : "",
                        snapshot?.diagnostics?.fallbackReason ? `Fallback: ${snapshot.diagnostics.fallbackReason}` : "",
                      ].filter(Boolean).join("\n"), choices: [{ label: "Close", action: () => setModal(undefined) }] })}><Info size={22} /></button>
                      <button type="button" aria-label={fullscreenControl.fullscreen ? "Exit fullscreen" : "Fullscreen"} title={fullscreenControl.fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={() => void fullscreenControl.toggle()}>{fullscreenControl.fullscreen ? <Minimize size={22} /> : <Maximize size={22} />}</button>
                    </div>}
                    {!responsive && <TvButton
                      id="exit"
                      aria-label="Exit"
                      onActivate={() => void stop()}
                    >
                      <img
                        src={`${import.meta.env.BASE_URL}assets/ui-nav-player-exit.png`}
                        alt=""
                      />
                    </TvButton>}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        {(bootingHome || screen === "startup") && (
          <div className="startup-cover" role="status">
            <img
              src={`${import.meta.env.BASE_URL}assets/viptv-mark.png`}
              alt=""
            />
            <p>Starting VIPTV…</p>
          </div>
        )}
        {busy && screen !== "sources" && (
          <div
            className={screen === "player" ? "playback-loading" : "loading"}
            role="status"
          >
            {screen === "player"
              ? "Preparing playback… Back to cancel"
              : "Loading…"}
          </div>
        )}
        {error && (
          <div className="error" role="alert" data-focus-scope="error">
            {error}
            <TvButton id="dismiss-error" onActivate={() => {
              setError("");
              if (screen === "startup") setStartupAttempt((attempt) => attempt + 1);
            }}>
              {screen === "startup" ? "Try again" : "Dismiss"}
            </TvButton>
          </div>
        )}
        {editingProfile && (
          <ProfileEditor
            api={api}
            profile={editingProfile.profile}
            primary={editingProfile.profile?.id === profiles[0]?.id}
            onCancel={() => setEditingProfile(undefined)}
            onDone={async () => {
              setProfiles(await api.profiles());
              setEditingProfile(undefined);
            }}
          />
        )}
        {entry && (
          <TextEntry
            title={entry.title}
            initialValue={entry.initialValue}
            secret={entry.secret}
            onSubmit={entry.save}
            onCancel={() => setEntry(undefined)}
          />
        )}{" "}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
        {casting && <DialogBackdrop onCancel={closeCast}><div className="modal" role="dialog" aria-modal="true" aria-label="Watch on TV" data-focus-scope="cast"><CastController receiverUrl={import.meta.env.VITE_VIZIO_RECEIVER_URL} onClose={closeCast} /></div></DialogBackdrop>}
        {modal && (
          <DialogBackdrop onCancel={() => setModal(undefined)}>
            <div
              className={modal.body ? "source-detail-panel" : "modal"}
              data-focus-scope="modal"
              role="dialog"
              aria-modal="true"
              aria-label={modal.title}
            >
              <h2>{modal.title}</h2>
              {modal.message && <p>{modal.message}</p>}
              {modal.body && (
                <div
                  className="source-detail-body"
                  tabIndex={0}
                  data-focus-id="source-detail-body"
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      event.preventDefault();
                      event.stopPropagation();
                      event.currentTarget.scrollBy({
                        top: event.key === "ArrowDown" ? 100 : -100,
                      });
                    }
                  }}
                >
                  {modal.body}
                </div>
              )}
              <div className="modal-choices">
                {modal.choices.map((choice, i) => (
                  <TvButton
                    id={`modal-${i}`}
                    key={i}
                    onActivate={choice.action}
                  >
                    {choice.label}
                  </TvButton>
                ))}
              </div>
            </div>
          </DialogBackdrop>
        )}
      </div>
    </RemoteRoot>
  );
}
