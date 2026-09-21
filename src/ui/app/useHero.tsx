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
import { presentation } from "../../core/presentations";
import { captureScroll, desktopInvoker, initialPrefs, type BrowserSnapshot, type Choice, type ScrollAnchor } from "./appShared";
import type { AppApi, CoreApi, DialogsApi, AuthApi, PlaybackEngineApi, PlaybackSessionApi, CatalogApi, NavigationApi, PlaybackControlsApi } from "./useTvApp";
import { Cards, type CardActions } from "../../components/cards/Cards";
import { ShelfCarousel } from "../../components/cards/ShelfCarousel";

export function useHero(app: PlaybackControlsApi) {
  const { api, catalogs, detail, discoverSources, heroMetadataCache, highlighted, items, libraryQueue, manage, play, profile, queue, recentLive, responsive, screen, searchKey, selected, setHighlighted } = app;

  const cardActions = useRef<CardActions>({ play, discoverSources, detail, manage });
  cardActions.current = { play, discoverSources, detail, manage };
  const cards = (list: readonly MediaItem[], prefix: string, windowed = false) => (
    <Cards
      list={list}
      prefix={prefix}
      screen={screen}
      responsive={responsive}
      libraryQueue={libraryQueue}
      actions={cardActions}
      searchKey={searchKey}
      setHighlighted={setHighlighted}
      windowed={windowed}
    />
  );
  const shelfCards = (list: readonly MediaItem[], prefix: string) =>
    responsive ? <ShelfCarousel>{cards(list, prefix, true)}</ShelfCarousel> : cards(list, prefix);
  const firstHomeCatalog = catalogs.find((c) => c.type !== "live");
  const catalogHeroItem = items.find((i) => i.type !== "live") ?? items[0];
  const heroItem = responsive ? catalogHeroItem : (highlighted ?? queue[0] ?? recentLive[0] ?? items[0]);
  const [heroMetadata, setHeroMetadata] = useState<{ key: string; item: MediaItem }>();
  const heroKey = heroItem ? `${profile}:${heroItem.type}:${heroItem.seriesId ?? heroItem.id}` : "";
  useEffect(() => {
    if (!heroItem || heroItem.type === "live") return;
    if (heroMetadataCache.current.has(heroKey)) {
      setHeroMetadata({ key: heroKey, item: heroMetadataCache.current.get(heroKey)! });
      return;
    }
    const scope = api.createScope();
    const timer = setTimeout(() => {
      void api.detail({ id: heroItem.seriesId ?? heroItem.id, type: heroItem.type }, scope.request()).then((detail) => {
        if (!scope.signal.aborted) {
          // Bounded FIFO: long browsing sessions must not accumulate one
          // metadata entry per visited hero.
          const cache = heroMetadataCache.current;
          if (cache.size >= 64 && !cache.has(heroKey)) {
            const oldest = cache.keys().next().value;
            if (oldest !== undefined) cache.delete(oldest);
          }
          cache.set(heroKey, detail.item);
          setHeroMetadata({ key: heroKey, item: detail.item });
        }
      }).catch(() => { /* The packaged fallback remains usable during metadata failure. */ });
    }, 150);
    return () => { clearTimeout(timer); scope.abort(); };
  }, [api, heroKey]);
  // The hero item is an enriched derivative whose identity changes per
  // render, so it stays a direct normalization; the selected item is stable
  // and takes the cached projection path.
  const heroPresentation = heroItem ? normalizeCore<MediaPresentation>("presentation",
    heroMetadata?.key === heroKey ? enrichDetail(heroItem, heroMetadata.item) : heroItem) : undefined;
  const selectedPresentation = selected ? presentation(selected) : undefined;

  return { cards, shelfCards, heroPresentation, heroItem, selectedPresentation, firstHomeCatalog, catalogHeroItem };
}
