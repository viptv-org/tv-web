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

export function useNavigation(app: CatalogApi) {
  const { active, api, applyBrowserRoute, autoResume, browser, browserReady, captureBrowserSnapshot, catalog, catalogs, controller, detail, editingProfile, entry, episodes, epoch, error, fail, favorites, go, homeCache, homeRows, items, loadCatalog, loadHome, managing, modal, nextScope, notify, overlay, pairing, play, player, preparing, profile, profilePage, profiles, queue, recentLive, responsive, restoredScroll, screen, seek, seekTimer, seekValue, selected, session, setBusy, setCatalog, setCatalogError, setCatalogs, setEditingProfile, setEntry, setEpisodes, setError, setFavorites, setHomeRows, setItems, setManaging, setModal, setOverlay, setQueue, setRecentLive, setScreen, setSeek, setSelected, setSettingsSubpage, setSources, setStartupAttempt, settingsSubpage, setToast, snapshot, sources, stack, stop, toast } = app;

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
  const back = () => {
    if (!responsive && screen === "Settings" && settingsSubpage !== "Settings") {
      setSettingsSubpage("Settings");
      return;
    }
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
    // The Up Next card: BACK is its Cancel (TvUpNext legend).
    if (screen === "player" && app.upNext) {
      app.cancelUpNext();
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
      if (!browser.current?.back()) {
        if (screen === "Settings" && settingsSubpage !== "Settings") {
          void applyBrowserRoute.current({ screen: "Settings", subpage: "Settings" });
        } else if (screen !== "Home") {
          void applyBrowserRoute.current({ screen: "Home" });
        }
      }
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
    } else if (screen === "Settings" && settingsSubpage !== "Settings") {
      setSettingsSubpage("Settings");
    } else if (screen === "profiles" && profile) setScreen("Home");
    else if (screen !== "Home" && screen !== "pairing" && screen !== "profiles")
      setScreen("Home");
    else notify("Press Home on your TV remote to leave viptv.");
  };
  useEffect(() => {
    if (!responsive) return;
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault();
        e.stopPropagation();
        back();
      }
    };
    const handleAuxClick = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault();
      }
    };
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("auxclick", handleAuxClick);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("auxclick", handleAuxClick);
    };
  }, [responsive, back]);
  const navigate = async (next: Screen, catalogHint?: Catalog, initialValues?: Record<string, string>) => {
    const ticket = ++epoch.current;
    if (next === "Home" && homeCache.current && homeCache.current.profile === profile) {
      setQueue(homeCache.current.queue);
      setFavorites(homeCache.current.favorites);
      setItems(homeCache.current.items);
      setHomeRows([...homeCache.current.homeRows]);
      setRecentLive(homeCache.current.recentLive);
    } else if (next !== "Home") {
      setItems([]);
    }
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
          const chosen = catalogHint
            ? available.find(value => value.id === catalogHint.id && value.addonId === catalogHint.addonId && value.type === catalogHint.type) ?? catalogHint
            : available.find(value => value.id === catalog?.id && value.addonId === catalog?.addonId && value.type === catalog?.type) ?? available.find(value => value.type !== "live") ?? available[0];
          // Initial filter values (a genre link) apply over the catalog's defaults.
          if (chosen) await loadCatalog(chosen, 0, initialValues ? { ...catalogDefaults(chosen), ...initialValues } : undefined);
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
  useLayoutEffect(() => {
    if (!responsive) return;
    const root = document.querySelector<HTMLElement>(".responsive-app");
    if (root) {
      if (screen === "player") {
        root.scrollTop = 0;
        root.scrollLeft = 0;
        return;
      }
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
      // Windowed rows mount their cards only after the restored scroll lands,
      // so the focus target is addressed after the window has committed.
      if (anchor)
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            focusElement(anchor.focus, { preventScroll: true }),
          ),
        );
      root.style.removeProperty("scroll-behavior");
      restoredScroll.current = undefined;
    }
  }, [responsive, screen]);

  return { back, navigate };
}
