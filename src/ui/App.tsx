import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  TvApi,
  type MediaItem,
  type MediaSource,
  type DevicePairing,
  type TvProfile,
  type Catalog,
  type Guide,
  type PlaybackSession,
  type PlaybackPreferences,
} from "../api";
import {
  createPlayer,
  PlaybackSessionController,
  type PlaybackControllerSnapshot,
  type Player,
  type PlayerPlatform,
  type PlayerSnapshot,
} from "../player";
import { RemoteRoot, TvButton, focusElement } from "./remote";
import "./tv.css";
import { TextEntry } from "./TextEntry";
import { ProfileEditor, avatarUrl } from "./ProfileEditor";
import { Settings } from "./Settings";
import { resolveNext } from "./continuation";
import { Guide as LiveGuide } from "./Guide";
type Screen =
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
export function App({
  api,
  platform = "html5",
}: {
  api: TvApi;
  platform?: PlayerPlatform;
}) {
  const [editingProfile, setEditingProfile] = useState<{
    profile?: TvProfile;
  }>();
  const [entry, setEntry] = useState<{
      title: string;
      initialValue?: string;
      secret?: boolean;
      save: (value: string) => Promise<void>;
    }>(),
    [profilePage, setProfilePage] = useState(0),
    [managing, setManaging] = useState(false);
  const [screen, setScreen] = useState<Screen>("pairing"),
    [pair, setPair] = useState<DevicePairing>(),
    [qr, setQr] = useState(""),
    [profiles, setProfiles] = useState<readonly TvProfile[]>([]),
    [profile, setProfile] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState("");
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
    [searchScope, setSearchScope] = useState("all"),
    [searchRows, setSearchRows] = useState<
      { name: string; items: readonly MediaItem[] }[]
    >([]),
    [guides, setGuides] = useState<Record<string, Guide>>({}),
    [prefs, setPrefs] = useState(initialPrefs),
    [modal, setModal] = useState<{ title: string; choices: Choice[] }>(),
    [snapshot, setSnapshot] = useState<PlayerSnapshot>(),
    [session, setSession] = useState<PlaybackSession>(),
    [playbackState, setPlaybackState] = useState<PlaybackControllerSnapshot>(),
    [overlay, setOverlay] = useState(true),
    [seek, setSeek] = useState<number>();
  const video = useRef<HTMLVideoElement>(null),
    player = useRef<Player>(),
    controller = useRef<PlaybackSessionController>(),
    nextScope = useRef<ReturnType<TvApi["createScope"]>>(),
    epoch = useRef(0),
    stack = useRef<
      {
        screen: Screen;
        focus: string;
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
  const advancedSession = useRef(""),
    resumeRemainder = useRef(false);
  const seekRepeat = useRef({ key: "", count: 0 }),
    seekValue = useRef<number>();
  const modalFocus = useRef(""),
    errorFocus = useRef("");
  useEffect(() => {
    if (modal) {
      modalFocus.current =
        (document.activeElement as HTMLElement)?.dataset.focusId ?? "";
    } else if (modalFocus.current) {
      const id = modalFocus.current;
      modalFocus.current = "";
      setTimeout(() => focusElement(id), 30);
    }
  }, [modal]);
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
    if (!(e instanceof DOMException && e.name === "AbortError"))
      setError(
        e instanceof Error ? e.message : "Unable to connect. Try again.",
      );
  };
  const go = (next: Screen) => {
    stack.current.push({
      screen,
      focus: (document.activeElement as HTMLElement)?.dataset.focusId ?? "",
      selected,
      items,
      episodes,
      sources,
    });
    setError("");
    setScreen(next);
  };
  const loadHome = async (id = profile) => {
    const ticket = ++epoch.current;
    setBusy(true);
    try {
      const [home, cats, preferences] = await Promise.all([
        api.home(id),
        api.catalogs(),
        api.preferences(id),
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
          })
        : undefined;
      if (ticket === epoch.current) setItems(page?.items ?? home.myList);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const chooseProfile = async (id: string) => {
    epoch.current++;
    setItems([]);
    setQueue([]);
    setFavorites([]);
    setHighlighted(undefined);
    setSelected(undefined);
    try {
      await api.selectProfile(id);
      setProfile(id);
      stack.current = [];
      setScreen("Home");
      await loadHome(id);
    } catch (e) {
      fail(e);
    }
  };
  const pairing = async () => {
    clearTimeout(pairTimer.current);
    const generation = ++pairEpoch.current;
    setError("");
    try {
      const code = await api.beginPairing(`viptv ${platform}`);
      if (generation !== pairEpoch.current) return;
      setPair(code);
      setQr(
        await QRCode.toDataURL(
          code.verificationUriComplete || code.verificationUri,
        ),
      );
      const expires = Date.now() + code.expiresIn * 1000;
      const poll = async () => {
        if (generation !== pairEpoch.current) return;
        if (Date.now() > expires) {
          setError("This code expired. Select Retry for a new code.");
          return;
        }
        try {
          await api.claimPairing(code.deviceCode);
          const identity = await api.me();
          if (generation !== pairEpoch.current) return;
          setProfiles(identity.profiles);
          setScreen("profiles");
        } catch (e) {
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
  }, []);
  useEffect(() => {
    let disposed = false;
    api.restoreSession().then(async (tokens) => {
      if (disposed) return;
      if (tokens) {
        try {
          const me = await api.me();
          if (!disposed) {
            setProfiles(me.profiles);
            setScreen("profiles");
          }
        } catch {
          await pairing();
        }
      } else await pairing();
    });
    return () => {
      disposed = true;
      pairEpoch.current++;
      clearTimeout(pairTimer.current);
      epoch.current++;
      void player.current?.dispose();
    };
  }, [api]);
  useEffect(() => {
    const engine = createPlayer({ platform, video: video.current! });
    player.current = engine;
    const sessions = new PlaybackSessionController({
      player: engine,
      backend: api,
      capabilities: {
        maxWidth: 1920,
        maxHeight: 1080,
        h264: true,
        hevc: platform === "tizen",
        aac: true,
        directPlay: true,
        hevcSdr: platform === "tizen",
      },
    });
    controller.current = sessions;
    const off = engine.subscribe(setSnapshot);
    const offSessions = sessions.subscribe((state) => {
      setPlaybackState(state);
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
      void sessions.stop().finally(() => engine.dispose());
    };
  }, [platform, api]);
  useEffect(() => {
    if (screen === "profiles") setTimeout(() => focusElement("profile-0"), 30);
  }, [profilePage]);
  useEffect(() => {
    const timer = setTimeout(
      () =>
        focusElement(
          modal
            ? "modal-0"
            : screen === "profiles"
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
        ),
      30,
    );
    return () => clearTimeout(timer);
  }, [screen, modal]);
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
  }, [screen, overlay, snapshot?.state, modal, seek]);
  useEffect(() => {
    if (snapshot?.error) setError(snapshot.error.message);
  }, [snapshot?.error]);
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
    if (error) {
      setError("");
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
      void stop();
      return;
    }
    epoch.current++;
    if (controller.current?.snapshot.state === "opening")
      void controller.current.stop().catch(fail);
    const previous = stack.current.pop();
    if (previous) {
      setScreen(previous.screen);
      setSelected(previous.selected);
      setItems(previous.items);
      setEpisodes(previous.episodes);
      setSources(previous.sources);
      setTimeout(() => focusElement(previous.focus), 50);
    } else if (screen === "profiles" && profile) setScreen("Home");
    else if (screen !== "Home" && screen !== "pairing" && screen !== "profiles")
      setScreen("Home");
    else notify("Press Home on your TV remote to leave viptv.");
  };
  const detail = async (item: MediaItem) => {
    go("detail");
    setSelected(item);
    setEpisodes([]);
    if (item.type === "live") return;
    const ticket = ++epoch.current;
    setBusy(true);
    try {
      const value = await api.detail(item);
      if (ticket === epoch.current) {
        setSelected({ ...item, ...value.item });
        setEpisodes(value.episodes);
        setSeason(value.episodes[0]?.season);
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const discoverSources = async (item: MediaItem, resume = false) => {
    if (resume && item.queueStatus === "next" && item.previousEpisode) {
      await nextEpisode(item.previousEpisode);
      return;
    }
    if (item.type === "series" && !item.episode) {
      await detail(item);
      return;
    }
    go("sources");
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
        if (resume && item.sourceAddonId && item.sourceFingerprint) {
          const exact = all.find(
            (s) =>
              s.sourceAddonId === item.sourceAddonId &&
              s.raw.source_fingerprint === item.sourceFingerprint,
          );
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
      setTimeout(() => focusElement("source-0"), 50);
    }
  };
  const play = async (item: MediaItem, source?: MediaSource, position = 0) => {
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
      go("player");
      setOverlay(true);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const stop = async () => {
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
    setScreen(old?.screen ?? "Home");
    if (old) {
      setSelected(old.selected);
      setItems(old.items);
      setEpisodes(old.episodes);
      setSources(old.sources);
      setTimeout(() => focusElement(old.focus), 50);
    }
  };
  const nextEpisode = async (previous = active.current?.item) => {
    if (!previous || nextScope.current) return;
    const scope = api.createScope();
    nextScope.current = scope;
    setBusy(true);
    setError("");
    const outgoing = active.current;
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
          {
            maxWidth: 1920,
            maxHeight: 1080,
            h264: true,
            hevc: platform === "tizen",
            aac: true,
            directPlay: true,
            hevcSdr: platform === "tizen",
          },
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
        position >= duration - 10);
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
      setFavorites(await api.favorites(profile));
    } catch (e) {
      fail(e);
    }
  };
  const manage = (item: MediaItem) =>
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
        { label: "Cancel", action: () => setModal(undefined) },
      ],
    });
  const loadCatalog = async (cat: Catalog, skip = 0) => {
    const ticket = ++epoch.current;
    setCatalog(cat);
    setBusy(true);
    try {
      const page = await api.discover({
        type: cat.type,
        catalog: cat.id,
        addonId: cat.addonId,
        skip,
      });
      if (ticket !== epoch.current) return;
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
        const cat = catalogs[0];
        if (cat) await loadCatalog(cat);
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
    if (!query.trim()) return;
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
                .catch(() => ({ name: c.name, items: [] })),
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
        if (!scope.signal.aborted) fail(e);
      } finally {
        if (ticket === epoch.current) setBusy(false);
      }
    }, 650);
    return () => {
      clearTimeout(t);
      scope.abort();
    };
  }, [query, screen, catalogs, searchScope]);
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
    if (kind === "text" && page === 0)
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
    <div className="cards">
      {list.map((item, i) => (
        <TvButton
          className="media-card"
          aria-label={item.name}
          id={`${prefix}-${i}`}
          data-nav-left={
            screen === "Search" && i === 0 ? "search-field" : undefined
          }
          key={`${item.type}-${item.id}`}
          onFocus={() => setHighlighted(item)}
          onActivate={() => void detail(item)}
          onHold={() => manage(item)}
        >
          <img src={item.background ?? item.poster} alt="" />
          <strong>{item.name}</strong>
          <small>
            {item.season ? `S${item.season} · E${item.episode} · ` : ""}
            {item.year ?? item.type}
          </small>
          {!!item.position && (
            <progress value={item.position} max={item.duration ?? 1} />
          )}
        </TvButton>
      ))}
    </div>
  );
  const navItems: Screen[] = [
    "profiles",
    "Home",
    "Discover",
    "Live TV",
    "My List",
    "Search",
    "Settings",
  ];
  return (
    <RemoteRoot
      onBack={back}
      onMediaKey={mediaKey}
      onMediaKeyUp={mediaKeyUp}
      onNavigate={() => setOverlay(true)}
    >
      <div className={`tv-screen ${screen === "player" ? "playing" : ""}`}>
        <video ref={video} className="video" playsInline />
        <div className="brand">
          V<span>viptv</span>
        </div>
        {screen === "pairing" ? (
          <section className="pairing">
            <h1>Link your TV</h1>
            <p>
              Open the address below on your phone or computer.
              <br />
              Sign in and enter this code.
            </p>
            <h2>{pair?.verificationUri ?? "Connecting…"}</h2>
            <div className="pair-code">{pair?.userCode ?? "••••••"}</div>
            {qr && <img className="qr" src={qr} alt="Scan to link your TV" />}
            <TvButton id="retry" onActivate={() => void pairing()}>
              Retry
            </TvButton>
          </section>
        ) : screen === "profiles" ? (
          <section className="profiles">
            <h1>Who's watching?</h1>
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
                    <img src={avatarUrl(p)} alt="" />
                    <strong>{p.name}</strong>
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
                {managing ? "Done" : "Manage"}
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
            {!["detail", "sources", "player"].includes(screen) && (
              <nav>
                {navItems.map((n, i) => (
                  <TvButton
                    id={`nav-${n}`}
                    key={n}
                    className={n === screen ? "active" : ""}
                    onActivate={() =>
                      n === "profiles"
                        ? setScreen("profiles")
                        : void navigate(n)
                    }
                  >
                    <img
                      className="nav-icon"
                      src={`${import.meta.env.BASE_URL}assets/${["avatar-catalog/critters-1.png", "nav-home.png", "ui-nav-discover.png", "nav-live.png", "nav-list.png", "nav-search.png", "nav-settings.png"][i]}`}
                      alt=""
                    />
                    <em>{n === "profiles" ? "Profile" : n}</em>
                  </TvButton>
                ))}
              </nav>
            )}
            {screen === "Home" && (
              <main className="home">
                <div className="hero">
                  <small>WELCOME TO VIPTV</small>
                  <h1>
                    {(highlighted ?? queue[0] ?? items[0])?.name ??
                      "Your next favorite is here"}
                  </h1>
                  <p>
                    {(highlighted ?? queue[0] ?? items[0])?.description ??
                      "Browse your movies, series and live television."}
                  </p>
                  <div className="actions">
                    <TvButton
                      id="hero-play"
                      onActivate={() => {
                        const item = highlighted ?? queue[0] ?? items[0];
                        if (item)
                          void discoverSources(
                            item,
                            !!item.position || item.queueStatus === "next",
                          );
                      }}
                      onHold={() => {
                        const item = highlighted ?? queue[0] ?? items[0];
                        if (item) void discoverSources(item);
                      }}
                    >
                      {(highlighted ?? queue[0])?.queueStatus === "next"
                        ? "Play next episode"
                        : (highlighted ?? queue[0])?.position
                          ? "Resume"
                          : "Play"}
                    </TvButton>
                    <TvButton
                      id="hero-details"
                      onActivate={() => {
                        const item = highlighted ?? queue[0] ?? items[0];
                        if (item) void detail(item);
                      }}
                    >
                      Details
                    </TvButton>
                  </div>
                </div>
                <div className="shelves">
                  {queue.length > 0 && (
                    <section>
                      <h2>Continue Watching</h2>
                      {cards(queue, "queue")}
                    </section>
                  )}
                  <section>
                    <h2>Discover</h2>
                    {cards(items, "home")}
                  </section>
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
                  <div className="keyboard">
                    <TvButton
                      id="search-scope"
                      onActivate={() =>
                        setModal({
                          title: "Search in",
                          choices: ["all", "movie", "series", "live"].map(
                            (label) => ({
                              label,
                              action: () => {
                                setSearchScope(label);
                                setModal(undefined);
                              },
                            }),
                          ),
                        })
                      }
                    >
                      Search: {searchScope}
                    </TvButton>
                    <input
                      data-focus-id="search-field"
                      aria-label="Search titles"
                      onKeyDown={(e) => {
                        if (
                          ["Enter", "ArrowRight", "MediaPlay"].includes(
                            e.key,
                          ) &&
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
                      {"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                        .split("")
                        .map((c) => (
                          <TvButton
                            id={`key-${c}`}
                            key={c}
                            onActivate={() => setQuery((q) => q + c)}
                          >
                            {c}
                          </TvButton>
                        ))}
                    </div>
                    <TvButton
                      id="space"
                      onActivate={() => setQuery((q) => q + " ")}
                    >
                      Space
                    </TvButton>
                    <TvButton
                      id="delete"
                      onActivate={() => setQuery((q) => q.slice(0, -1))}
                    >
                      Delete
                    </TvButton>
                    <TvButton id="clear" onActivate={() => setQuery("")}>
                      Clear
                    </TvButton>
                  </div>
                )}
                {screen === "Discover" && (
                  <div className="filters">
                    {catalogs.map((cat, i) => (
                      <TvButton
                        key={`${cat.addonId}-${cat.id}`}
                        id={`catalog-${i}`}
                        onActivate={() => void loadCatalog(cat)}
                      >
                        {cat.name}
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
                  {!busy && !items.length && (
                    <p>{query ? "No matching titles" : "No titles yet"}</p>
                  )}
                </div>
              </main>
            )}
            {screen === "detail" && selected && (
              <main
                className={`detail ${selected.type === "series" ? "series" : ""}`}
              >
                <img className="poster" src={selected.poster} alt="" />
                <div className="detail-copy">
                  <h1>{selected.name}</h1>
                  <p className="muted">
                    {selected.year} · {selected.runtime} ·{" "}
                    {selected.genres.join(" · ")}
                  </p>
                  <p>{selected.description}</p>
                  <div className="actions">
                    <TvButton
                      id="detail-play"
                      onActivate={() =>
                        void (selected.type === "live"
                          ? play(selected)
                          : discoverSources(selected, !!selected.position))
                      }
                      onHold={() => void discoverSources(selected)}
                    >
                      {selected.position ? "Resume" : "Play"}
                    </TvButton>
                    <TvButton
                      id="detail-save"
                      onActivate={() => void toggle(selected)}
                    >
                      My List
                    </TvButton>
                    <TvButton
                      id="detail-info"
                      onActivate={() =>
                        setModal({
                          title: selected.description ?? selected.name,
                          choices: [
                            {
                              label: "Close",
                              action: () => setModal(undefined),
                            },
                          ],
                        })
                      }
                    >
                      More info
                    </TvButton>
                  </div>
                </div>
                {episodes.length > 0 && (
                  <>
                    <div className="season-filter">
                      {Array.from(new Set(episodes.map((e) => e.season))).map(
                        (n) => (
                          <TvButton
                            id={`season-${n}`}
                            key={n}
                            onActivate={() => setSeason(n)}
                          >
                            Season {n ?? 1}
                          </TvButton>
                        ),
                      )}
                    </div>
                    <div className="episode-grid">
                      {episodes
                        .filter((e) => e.season === season)
                        .map((e, i) => (
                          <TvButton
                            className="episode"
                            id={`episode-${i}`}
                            key={e.id}
                            onActivate={() => void discoverSources(e)}
                            onHold={() => manage(e)}
                          >
                            <img src={e.poster ?? selected.background} alt="" />
                            <small>
                              S{e.season} · E{e.episode}
                            </small>
                            <h2>{e.name}</h2>
                            <p>{e.description}</p>
                          </TvButton>
                        ))}
                    </div>
                  </>
                )}
              </main>
            )}
            {screen === "sources" && (
              <main className="sources">
                <h1>{selected?.name}</h1>
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
                  <span>
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
                        onActivate={() =>
                          selected &&
                          void play(selected, s, selected.position ?? 0)
                        }
                      >
                        <h2>{s.name}</h2>
                        <p>{s.title ?? s.filename}</p>
                        <small>
                          {s.quality} {s.audio} {s.sourceName}
                        </small>
                      </TvButton>
                    ))}
                  {!busy && !sources.length && (
                    <p>No sources available. Check your add-ons in Settings.</p>
                  )}
                </div>
              </main>
            )}
            {screen === "Live TV" && (
              <LiveGuide
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
                profile={profile}
                prefs={prefs}
                onPrefs={setPrefs}
                onProfiles={() => go("profiles")}
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
                          void api
                            .signOut()
                            .then(() => {
                              setScreen("pairing");
                              void pairing();
                            })
                            .catch(fail);
                        },
                      },
                      { label: "Cancel", action: () => setModal(undefined) },
                    ],
                  })
                }
              />
            )}
            {screen === "player" && overlay && (
              <div className="player-overlay">
                <h1>{selected?.name}</h1>
                <div className="playback-bottom">
                  {selected?.type !== "live" && (
                    <>
                      <p>
                        {time(seek ?? snapshot?.time.positionSeconds ?? 0)} /{" "}
                        {time(snapshot?.time.durationSeconds ?? 0)}
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
                          onActivate={() =>
                            void commitSeek(
                              Math.max(
                                0,
                                (snapshot?.time.positionSeconds ?? 0) - 10,
                              ),
                            )
                          }
                        >
                          ↶
                        </TvButton>
                        <TvButton
                          id="pause"
                          onActivate={() =>
                            void (snapshot?.state === "paused"
                              ? player.current?.play()
                              : player.current?.pause())
                          }
                        >
                          {snapshot?.state === "paused" ? "Play" : "Pause"}
                        </TvButton>
                        <TvButton
                          id="forward"
                          onActivate={() =>
                            void commitSeek(
                              Math.min(
                                snapshot?.time.durationSeconds ?? Infinity,
                                (snapshot?.time.positionSeconds ?? 0) + 30,
                              ),
                            )
                          }
                        >
                          ↷
                        </TvButton>
                        {selected?.type === "series" && (
                          <TvButton
                            id="next"
                            onActivate={() => void nextEpisode()}
                          >
                            Next episode
                          </TvButton>
                        )}
                      </>
                    )}
                    <TvButton
                      id="audio"
                      onActivate={() => trackChoices("audio")}
                    >
                      Audio
                    </TvButton>
                    <TvButton
                      id="subtitles"
                      onActivate={() => trackChoices("text")}
                    >
                      Subtitles
                    </TvButton>
                    <TvButton id="exit" onActivate={() => void stop()}>
                      Exit
                    </TvButton>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        {busy && (
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
            <TvButton id="dismiss-error" onActivate={() => setError("")}>
              Dismiss
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
        {modal && (
          <div className="scrim">
            <div className="modal" data-focus-scope="modal">
              <h2>{modal.title}</h2>
              {modal.choices.map((choice, i) => (
                <TvButton id={`modal-${i}`} key={i} onActivate={choice.action}>
                  {choice.label}
                </TvButton>
              ))}
            </div>
          </div>
        )}
      </div>
    </RemoteRoot>
  );
}
