import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  TvApi,
  TvApiError,
  type MediaItem,
  type MediaPresentation,
  type MediaSource,
  type DevicePairing,
  type TvProfile,
  type Catalog,
  type PlaybackSession,
  type PlaybackPreferences,
  type PlaybackCapabilities,
} from "../../api";
import {
  createPlayer,
  deliveryCapabilitiesFor,
  PlaybackSessionController,
  isTauriRuntime,
  resolveTauriVideoInvoker,
  type NativeVideoEngine,
  type Player,
  type PlayerPlatform,
  type PlayerSnapshot,
} from "@viptv/video";
import { exactResumeSource, resolveNext } from "../continuation";
import {
  connectionSummary,
  describeApiError,
  nextConnectionFailure,
  type ConnectionIssue,
  type ErrorDetail,
} from "../errors";
import { focusElement } from "../remote";
import { enrichDetail, mergeEpisodeProgress, initialEpisode } from "../detailProgress";
import { readStoredEngine, storeEngine } from "../enginePreference";
import { createAutoplayTestLogger, probeAutoplayTestMode, probeEngineOverride } from "../../testing/autoplay-harness";
import { catalogFilters, catalogDefaults } from "../catalogFilters";
import { BrowserNavigation, readBrowserRoute, safeRestoredRoute, type BrowserRoute, type SettingsSubpage } from "../browserNavigation";
import { seekPinReleased, type BufferedRange } from "../SeekBar";
import type { Screen } from "../screens";
import { normalizeCore } from "../../core";
import { captureScroll, desktopInvoker, initialPrefs, type BrowserSnapshot, type Choice, type ScrollAnchor } from "./appShared";
import type { AppApi, CoreApi, DialogsApi, AuthApi, PlaybackEngineApi, PlaybackSessionApi, CatalogApi, NavigationApi } from "./useTvApp";

export function useAuth(app: DialogsApi) {
  const { api, bootingHome, browser, browserApplyGeneration, browserApplying, browserFromRoute, browserReady, captureBrowserSnapshot, catalog, catalogs, episodes, epoch, error, fail, favorites, finishProfileNavigation, heroMetadataCache, homeCache, homeRequestScope, homeRows, items, modal, modalFocus, pairEpoch, pairingScope, pairTimer, parentScope, pendingSessionRetry, platform, profile, profiles, queue, recentLive, responsive, screen, selected, setBootingHome, setBusy, setCatalogError, setCatalogs, setEntry, setError, setFavorites, setHighlighted, setHomeRows, setItems, setPair, setPrefs, setProfile, setProfiles, setQr, setQueue, setRecentLive, setScreen, setSelected, sources, stack, startupAttempt } = app;

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
            .map(async (cat) => ({
              name: cat.addonName ? `${cat.addonName} · ${cat.name}` : cat.name,
              catalog: cat,
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
        const homeItems = page?.items ?? home.myList;
        homeCache.current = {
          profile: id,
          queue: home.continueWatching,
          favorites: home.myList,
          items: homeItems,
          homeRows: rows,
          recentLive: live.channels,
        };
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
        void loadHome(readyProfile).then(() => {
          if (!disposed) { finishProfileNavigation(); setBootingHome(false); }
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

  return { go, loadHome, authorize, chooseProfile, pairing };
}
