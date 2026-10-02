import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  TvApiError,
  type MediaItem,
  type Catalog,
} from "../../api";
import { TV_CANVAS_HEIGHT, TV_CANVAS_WIDTH } from "../tvCanvas";
import { describeApiError } from "../errors";
import { browseRequest, firstHomeCatalog, homeRowsFor, type HomeRow } from "./homeRows";
import { sameCatalog } from "../catalogFilters";
import { CatalogRevisionMonitor } from "./catalogRevisionMonitor";
import type { Screen } from "../screens";
import { captureScroll, initialPrefs } from "./appShared";
import type { DialogsApi } from "./useTvApp";

export function useAuth(app: DialogsApi) {
  const { api, bootingHome, browser, browserApplyGeneration, browserApplying, browserFromRoute, browserReady, captureBrowserSnapshot, currentScreen, episodes, epoch, fail, finishProfileNavigation, heroMetadataCache, homeCache, homeRequestScope, items, modal, modalFocus, pairEpoch, pairingScope, pairTimer, parentScope, pendingSessionRetry, platform, profile, responsive, screen, selected, setBootingHome, setBusy, setCatalogError, setCatalogs, setEntry, setError, setFavorites, setHighlighted, setHomeRows, setItems, setPair, setPrefs, setProfile, setProfiles, setQr, setQueue, setRecentLive, setScreen, setSelected, sources, stack, startupAttempt } = app;

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
  // Home shelf loading: a small queue (at most four catalogs in flight) for
  // the current Home generation; a profile switch starts a new generation
  // and drops late results from the previous one.
  const homeGeneration = useRef(0);
  const revisionMonitor = useRef<CatalogRevisionMonitor>();
  const homeLoading = useRef(false);
  const homeRevision = useRef<{ profile: string; token?: string }>();
  const [homeReadyTick, setHomeReadyTick] = useState(0);
  const currentHome = useRef({ catalogs: app.catalogs, rows: app.homeRows, items: app.items });
  currentHome.current = { catalogs: app.catalogs, rows: app.homeRows, items: app.items };
  const rowQueue = useRef<HomeRow[]>([]);
  const rowsRequested = useRef(new Set<Catalog>());
  const rowsInFlight = useRef(0);
  const pumpHomeRows = () => {
    while (rowsInFlight.current < 4 && rowQueue.current.length) {
      const row = rowQueue.current.shift()!;
      const generation = homeGeneration.current;
      const request = browseRequest(row.catalog);
      if (!request) continue;
      rowsInFlight.current += 1;
      void api
        .discover(request)
        .then((page) => page.items, () => [] as readonly MediaItem[])
        .then((items) => {
          rowsInFlight.current -= 1;
          if (generation === homeGeneration.current) {
            const fill = (rows: readonly HomeRow[]) =>
              rows.map((candidate) => (candidate.catalog === row.catalog ? { ...candidate, items, loaded: true } : candidate));
            setHomeRows(fill);
            if (homeCache.current) homeCache.current = { ...homeCache.current, homeRows: fill(homeCache.current.homeRows) };
          }
          pumpHomeRows();
        });
    }
  };
  const requestHomeRows = (rows: readonly HomeRow[]) => {
    for (const row of rows) {
      if (row.loaded || rowsRequested.current.has(row.catalog)) continue;
      rowsRequested.current.add(row.catalog);
      rowQueue.current.push(row);
    }
    pumpHomeRows();
  };
  const loadHome = async (id = profile, ready?: () => void) => {
    revisionMonitor.current?.stop(); revisionMonitor.current = undefined;
    homeLoading.current = true;
    homeRequestScope.current?.abort();
    const scope = api.createScope();
    homeRequestScope.current = scope;
    const ticket = ++epoch.current;
    app.setHomeCatalogPending(true);
    setBusy(true);
    try {
      const token = await api.catalogRevision({ signal: scope.signal }).catch(() => undefined);
      if (ticket !== epoch.current || scope.signal.aborted) return;
      homeRevision.current = { profile: id, token };
      const catalogRequest = api.catalogs().then((available) => {
          if (ticket === epoch.current) { setCatalogs(available); setCatalogError(""); }
          return available;
        }).catch((cause) => {
          if (ticket === epoch.current) setCatalogError(cause instanceof Error ? cause.message : "Unable to load catalogs.");
          return [] as readonly Catalog[];
        });
      const preferencesRequest = api.preferences(id).catch(() => initialPrefs);
      const home = await api.home(id, { signal: scope.signal });
      if (ticket !== epoch.current) return;
      setQueue(home.continueWatching);
      setFavorites(home.myList);
      // Saved rows are already usable. Optional hero/live work must not keep a cover up.
      setBootingHome(false);
      if (screen === "startup" || screen === "profiles") setScreen("Home");
      const [cats, preferences] = await Promise.all([catalogRequest, preferencesRequest]);
      if (ticket !== epoch.current) return;
      setCatalogs(cats);
      setPrefs(preferences);
      // Saved rows, catalog navigation and preferences are sufficient to
      // restore the responsive route. Optional hero/live requests may stall.
      if (responsive) ready?.();
      if (ticket !== epoch.current || scope.signal.aborted) return;
      // Home shows as soon as its hero catalog and recent channels arrive;
      // every other shelf renders pending and loads its own catalog
      // (requestHomeRows), so the page never waits for its slowest addon.
      const first = firstHomeCatalog(cats);
      const firstRequest = first && browseRequest(first);
      const [page, live] = await Promise.all([
        firstRequest
          ? api.discover(firstRequest, { signal: scope.signal }).catch((cause) => {
              if (ticket === epoch.current) fail(cause);
              return { items: [] };
            })
          : undefined,
        api
          .liveV2({ collection: "recent", limit: 20 })
          .catch(() => ({ items: [] })),
      ]);
      if (ticket !== epoch.current) return;
      const homeItems = page?.items ?? home.myList;
      const rows = homeRowsFor(cats, first, responsive, homeCache.current?.profile === id ? homeCache.current.homeRows : []);
      homeGeneration.current += 1;
      rowQueue.current = [];
      rowsRequested.current = new Set();
      setItems(homeItems);
      setRecentLive(live.items);
      setHomeRows(rows);
      homeCache.current = {
        profile: id,
        queue: home.continueWatching,
        favorites: home.myList,
        items: homeItems,
        homeRows: rows,
        recentLive: live.items,
      };
      // The TV's spatial rows all load in the background; the responsive
      // shelves load as they near the viewport.
      if (!responsive) requestHomeRows(rows);
    } catch (e) {
      if (ticket === epoch.current) fail(e);
    } finally {
      if (homeRequestScope.current === scope) {
        homeLoading.current = false;
        setHomeReadyTick(value => value + 1);
      }
      if (ticket === epoch.current) { app.setHomeCatalogPending(false); setBusy(false); }
    }
  };
  useEffect(() => {
    if (screen !== "Home" || !profile || homeLoading.current) return;
    if (responsive && app.homeCatalogPending && homeRequestScope.current?.signal.aborted) {
      void loadHome(profile);
      return;
    }
    if (homeCache.current?.profile !== profile) return;
    const monitor = new CatalogRevisionMonitor(
      signal => api.catalogRevision({ signal }),
      async signal => {
        const next = await api.catalogs({ signal });
        const cache = homeCache.current;
        if (signal.aborted || currentScreen.current !== "Home" || cache?.profile !== profile) return;
        const old = currentHome.current;
        const oldFirst = firstHomeCatalog(old.catalogs);
        const requestedFirst = firstHomeCatalog(next);
        let firstFailed = false;
        let firstItems: readonly MediaItem[] = [];
        if (requestedFirst) {
          try { firstItems = (await api.discover(browseRequest(requestedFirst)!, { signal })).items; }
          catch (error) { if (signal.aborted) return; firstFailed = true; firstItems = old.items; }
        }
        const effective = firstFailed && oldFirst
          ? [oldFirst, ...next.filter(cat => !sameCatalog(cat, oldFirst))] : next;
        const first = firstHomeCatalog(effective);
        const previous = old.rows.filter(row => effective.some(cat => sameCatalog(row.catalog, cat)));
        if (oldFirst && old.items.length) previous.push({ name: oldFirst.name, catalog: oldFirst, items: old.items, loaded: true });
        const latestCache = homeCache.current;
        if (signal.aborted || currentScreen.current !== "Home" || latestCache?.profile !== profile) return;
        const rows = homeRowsFor(effective, first, responsive, previous);
        homeGeneration.current++;
        rowQueue.current = [];
        rowsRequested.current = new Set();
        setCatalogs(effective); setCatalogError(""); setItems(firstItems); setHomeRows(rows);
        homeCache.current = { ...latestCache, items: firstItems, homeRows: rows };
        currentHome.current = { catalogs: effective, rows, items: firstItems };
        // TV already requests every row. Responsive Home remains lazy for
        // unchanged, offscreen shelves, but a newly added shelf must settle
        // before this revision can be acknowledged, including when visible.
        const loaded = rows.filter(row => (!responsive || row.loaded || !old.rows.some(previous => sameCatalog(previous.catalog, row.catalog))) && !!browseRequest(row.catalog));
        let rowFailed = false;
        for (let offset = 0; offset < loaded.length; offset += 4) {
          const batch = await Promise.allSettled(loaded.slice(offset, offset + 4).map(row => api.discover(browseRequest(row.catalog)!, { signal })));
          if (signal.aborted || currentScreen.current !== "Home" || homeCache.current?.profile !== profile) return;
          const updates = new Map<Catalog, readonly MediaItem[]>();
          batch.forEach((result, index) => {
            if (result.status === "fulfilled") updates.set(loaded[offset + index].catalog, result.value.items);
            else rowFailed = true;
          });
          if (updates.size) {
            const fill = (values: readonly HomeRow[]) => values.map(row => updates.has(row.catalog) ? { ...row, items: updates.get(row.catalog)!, loaded: true } : row);
            setHomeRows(fill);
            if (homeCache.current) homeCache.current = { ...homeCache.current, homeRows: fill(homeCache.current.homeRows) };
          }
        }
        if (firstFailed || rowFailed) throw new Error("Catalog content refresh incomplete");
      },
      homeRevision.current?.profile === profile ? homeRevision.current.token : undefined,
    );
    revisionMonitor.current = monitor;
    monitor.start();
    return () => {
      if (homeRevision.current?.profile === profile) homeRevision.current.token = monitor.revisionToken;
      monitor.stop(); if (revisionMonitor.current === monitor) revisionMonitor.current = undefined;
    };
  }, [api, profile, screen, homeReadyTick, responsive]);
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
    homeCache.current = undefined;
    heroMetadataCache.current.clear();
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
        let navigationFinished = false;
        const loading = loadHome(id, () => {
          if (navigationTicket !== epoch.current) return;
          navigationFinished = true;
          finishProfileNavigation(true);
        });
        const navigationTicket = epoch.current;
        await loading;
        if (!navigationFinished && navigationTicket === epoch.current) { finishProfileNavigation(); setBootingHome(false); }
      },
    );
  };
  // TV pairing / sign-in: the code expired (a persistent state until Try again /
  // Reconnect requests a new one: decisions.md 3).
  const [pairExpired, setPairExpired] = useState(false);
  const pairing = async () => {
    clearTimeout(pairTimer.current);
    pairingScope.current?.abort();
    const scope = api.createScope();
    pairingScope.current = scope;
    const generation = ++pairEpoch.current;
    setPair(undefined);
    setPairExpired(false);
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
          setPairExpired(true);
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
        // The TV canvas is authored at 1920 x 1080 and letterboxed to the device.
        const scale = Math.min(innerWidth / TV_CANVAS_WIDTH, innerHeight / TV_CANVAS_HEIGHT);
        element.style.transform = `scale(${scale})`;
        element.style.left = `${(innerWidth - TV_CANVAS_WIDTH * scale) / 2}px`;
        element.style.top = `${(innerHeight - TV_CANVAS_HEIGHT * scale) / 2}px`;
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
      else if (view.phase === "Error") {
        const error = new TvApiError(view.errorStatus ?? 0, view.error ?? "Unable to connect. Try again.");
        const kind = describeApiError(error).kind;
        if (kind === "network" || kind === "server") pendingSessionRetry.current = true;
        fail(error);
      }
      else if (view.phase === "Ready" && view.selectedProfileId && readyProfile !== view.selectedProfileId) {
        readyProfile = view.selectedProfileId;
        setProfile(readyProfile);
        setBootingHome(true);
        stack.current = [];
        let navigationFinished = false;
        const loading = loadHome(readyProfile, () => {
          if (disposed || navigationTicket !== epoch.current) return;
          navigationFinished = true;
          finishProfileNavigation(true);
        });
        const navigationTicket = epoch.current;
        void loading.then(() => {
          if (!navigationFinished && !disposed && navigationTicket === epoch.current) { finishProfileNavigation(); setBootingHome(false); }
        });
      }
    }, (message) => {
      if (disposed) return;
      pendingSessionRetry.current = true;
      fail(new TvApiError(0, message, "network"));
    });
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

  return { go, loadHome, requestHomeRows, authorize, chooseProfile, pairing, pairExpired };
}
