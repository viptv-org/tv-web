import type { Accessor } from "solid-js";
import type { RemoteTvApi } from "./api";
import { STREMIO_ONLY, stremioHome } from "./stremio-home";
import type { Card, Detail, Home, Management, Page } from "./types";
import type { Overlay } from "./app-types";
import type { LiveScene } from "./live-scene";
import type { NavigationScene } from "./navigation-scene";
import type { PlayerChrome } from "./player-chrome";
import type { PagingScene } from "./paging-scene";
import type { PlayIntent } from "./source-picker/intent-types";

/** The Select key: one ordered answer to "what does the viewer want here?".
 *
 * The order is the design. An open overlay consumes the press, then a page that
 * owns its own focus (calendar, pairing, profiles, player), then the navigation
 * bar, then settings, then search, then the library's own controls, and only
 * then the focused card. Each branch returns, so a press is never acted on
 * twice — and a page that adds a mode must add it before the card fallback.
 */
export function createActivateScene(options: {
  api: RemoteTvApi;
  signal: () => AbortSignal;
  screen: Accessor<string>;
  zone: Accessor<string>;
  column: Accessor<number>;
  row: Accessor<number>;
  choice: Accessor<number>;
  key: Accessor<number>;
  heroAction: Accessor<number>;
  overlay: Accessor<Overlay | undefined>;
  overlayClosing: Accessor<boolean>;
  pending: Accessor<boolean>;
  loading: Accessor<boolean>;
  error: Accessor<string>;
  setError: (value: string) => void;
  setZone: (value: string) => void;
  setColumn: (value: number) => void;
  setHome: (value: Home | undefined) => void;
  home: Accessor<Home | undefined>;
  page: Accessor<Page>;
  detail: Accessor<Detail | undefined>;
  management: Accessor<Management | undefined>;
  navs: Accessor<readonly { id: string }[]>;
  groups: Accessor<{ id: string }[]>;
  channels: Accessor<{ card: Card; id: string }[]>;
  searchChannels: Accessor<{ card: Card; id: string }[]>;
  search: Accessor<string>;
  searchChannelFocus: () => number;
  settingsItems: Accessor<{ run: () => unknown }[]>;
  libraryType: Accessor<{ id: string } | undefined>;
  librarySort: Accessor<{ id: string } | undefined>;
  calendarDayEntries: Accessor<{ card: Card }[]>;
  calendarEntry: Accessor<number>;
  detailTarget: Accessor<{ card: Card } | undefined>;
  displayHero: Accessor<Card | undefined>;
  detailHasEpisodes: Accessor<boolean>;
  detailEpisodes: Accessor<Card[]>;
  trackColumn: Accessor<number>;
  calibrationValue: Accessor<number>;
  searchLetters: readonly string[];
  countdown: { cancel: () => void };
  revealEndedControls: () => boolean;
  restartHeroCycling: () => void;
  retry: () => void;
  run: (work: () => Promise<void>) => Promise<void>;
  paging: Pick<PagingScene, "channelPending" | "channelRetry">;
  liveScene: Pick<LiveScene, "activateLiveSpread" | "loadGroup">;
  closeOverlay: () => void;
  openOverlay: (value: Overlay) => void;
  navigate: NavigationScene["navigate"];
  openDetail: NavigationScene["openDetail"];
  beginPairing: () => Promise<void>;
  finishSignIn: () => void;
  manageProfile: (index: number) => void;
  selectProfile: (index: number) => Promise<void>;
  chooseSeason: () => void;
  advanceEpisode: () => Promise<void>;
  dismissNext: () => void;
  activateSources: () => Promise<void>;
  activatePlayer: () => Promise<void>;
  playIntent: PlayIntent;
  toggleSaved: (card: Card) => Promise<void>;
  updateSearch: (value: string, immediate?: boolean) => void;
  moreChannels: (direction: "next" | "previous") => Promise<void>;
  chooseLibrary: (control: { id: string }) => void;
  applyLibrary: (query: Record<string, unknown>) => Promise<void>;
  libraryDefaultQuery: () => Record<string, unknown>;
  activateCatalog: (column: number) => void;
  keyboardActivate: (isOverlay: boolean) => void;
  nativeTextTarget: () => unknown | undefined;
  nativeTextPort: () => { ownsInput: () => boolean } | undefined;
  nativeTextEditing: () => { open: (target: unknown) => void } | undefined;
  chrome: PlayerChrome;
}) {
  async function activate(): Promise<void> {
    options.countdown.cancel();
    if (options.revealEndedControls()) return;
    options.paging.channelPending.set(undefined);
    options.restartHeroCycling();
    const canLeaveLoading =
      !options.overlay() &&
      ((options.zone() === "nav" && !["welcome", "pairing"].includes(options.screen())) ||
        (options.screen() === "search" && options.zone() === "keyboard"));
    if (options.pending() || options.overlayClosing() || (options.loading() && !canLeaveLoading)) return;
    if (options.error()) {
      options.setError("");
      options.retry();
      return;
    }
    const modal = options.overlay();
    if (modal) {
      if (modal.kind === "next") {
        if (options.choice() === 0) await options.advanceEpisode(); else options.dismissNext();
        return;
      }
      if (modal.kind === "tracks") {
        await options.run(async () => {
          await modal.columns[options.trackColumn()]?.items[options.choice()]?.run();
        });
        return;
      }
      if (modal.kind === "calibration") {
        await options.run(async () => {
          await modal.save(options.calibrationValue());
        });
        options.closeOverlay();
        return;
      }
      if (modal.kind === "text") {
        const target = options.nativeTextTarget();
        if (target && options.nativeTextPort()?.ownsInput()) options.nativeTextEditing()?.open(target);
        else options.keyboardActivate(true);
      } else if (modal.kind === "sources") await options.activateSources();
      else await options.run(async () => { await modal.items[options.choice()]?.run(); });
      return;
    }
    if (options.screen() === "calendar") {
      if (options.zone() === "calendar-list" || options.zone() === "calendar-watch") {
        const entry = options.calendarDayEntries()[options.calendarEntry()];
        if (entry) await options.openDetail(entry.card);
        return;
      }
      if (options.zone() === "calendar-days") return;
    }
    if (options.screen() === "welcome" || options.screen() === "pairing") {
      await options.beginPairing();
      return;
    }
    if (options.screen() === "signed-in") { options.finishSignIn(); return; }
    if (options.screen() === "profiles") {
      if (options.zone() === "profile-manage") {
        options.manageProfile(Math.min(options.column(), (options.management()?.profiles.length ?? 1) - 1));
        return;
      }
      await options.selectProfile(options.column());
      return;
    }
    if (options.screen() === "player") { await options.activatePlayer(); return; }
    if (options.zone() === "nav") {
      const nav = options.navs()[options.column()];
      if (!nav) return;
      if (nav.id === "profiles")
        options.openOverlay({
          kind: "choices",
          title: "Your profile",
          items: [
            {
              id: "profiles", label: "Switch profile",
              run: async () => { options.closeOverlay(); await options.navigate("profiles"); },
            },
            {
              id: "settings", label: "Settings",
              run: async () => { options.closeOverlay(); await options.navigate("settings"); },
            },
          ],
        });
      else await options.navigate(nav.id as never);
      return;
    }
    if (options.screen() === "settings") {
      if (options.zone() === "settings-nav") {
        options.setZone("settings-content");
        options.setColumn(0);
      } else {
        await options.run(async () => { await options.settingsItems()[options.column()]?.run(); });
      }
      return;
    }
    if (options.screen() === "detail" && options.zone() === "seasons") { options.chooseSeason(); return; }
    if (options.screen() === "search" && options.zone() === "keyboard") {
      const target = options.nativeTextTarget();
      if (target && options.nativeTextPort()?.ownsInput()) { options.nativeTextEditing()?.open(target); return; }
      const index = options.key();
      options.updateSearch(
        index === 0 ? options.search() + " "
          : index === 1 ? Array.from(options.search()).slice(0, -1).join("")
            : options.search() + options.searchLetters[index - 2],
      );
      return;
    }
    if (options.screen() === "search" && ["search-retry", "search-channel-retry"].includes(options.zone())) {
      const retryChannel = options.paging.channelRetry.current();
      if (options.zone() === "search-channel-retry" && retryChannel) {
        const direction = retryChannel;
        options.setZone("search-channels");
        options.setColumn(options.searchChannelFocus());
        await options.moreChannels(direction);
        return;
      }
      options.setZone("keyboard");
      options.updateSearch(options.search(), true);
      return;
    }
    if (options.screen() === "search" && options.zone() === "search-channels") {
      const channel = options.searchChannels()[options.column()];
      if (channel) await options.playIntent(channel.card, false, false, channel.id);
      return;
    }
    if (options.zone() === "library-controls") {
      if (options.column() === 0 && options.libraryType()) options.chooseLibrary(options.libraryType()!);
      else if (options.column() === 1 && options.librarySort()) options.chooseLibrary(options.librarySort()!);
      else await options.run(() => options.applyLibrary(options.libraryDefaultQuery()));
      return;
    }
    if (options.zone() === "filters") { options.activateCatalog(options.column()); return; }
    if (options.screen() === "home" && options.zone() === "rows" && options.home()?.rows[options.row()]?.state === "Failed") {
      options.setHome(stremioHome(await options.api.home(options.signal())));
      return;
    }
    if (options.zone() === "hero") {
      const card = options.screen() === "detail" ? options.detailTarget()?.card : options.displayHero();
      if (!card) {
        if (options.screen() === "home" && options.home()?.complete) await options.navigate("settings");
        return;
      }
      if (options.heroAction() === 0) await options.playIntent(card);
      else if (options.heroAction() === 1)
        await options.toggleSaved(options.screen() === "detail" ? options.detail()?.item ?? card : card);
      else if (options.heroAction() === 2) {
        if (options.screen() === "home") await options.openDetail(card);
        else { options.setZone("episodes"); options.setColumn(0); }
      } else await options.playIntent(card, true);
      return;
    }
    if (options.screen() === "live" && options.zone() === "live-empty") {
      await options.liveScene.activateLiveSpread();
      return;
    }
    if (options.screen() === "live" && options.zone() === "live-groups") {
      const group = options.column() ? options.groups()[options.column() - 1]?.id : undefined;
      await options.liveScene.loadGroup(group);
      return;
    }
    if (options.screen() === "live") {
      // A failed page fetch leaves a pending retry; Enter retries it before it
      // could be mistaken for a play intent on the focused channel.
      const retryChannel = options.paging.channelRetry.current();
      if (retryChannel) {
        const direction = retryChannel;
        options.paging.channelRetry.set(undefined);
        await options.moreChannels(direction);
        return;
      }
      const channel = options.channels()[options.column()];
      if (channel) await options.playIntent(channel.card, false, false, channel.id);
      return;
    }
    const card =
      options.screen() === "detail"
        ? options.zone() === "recommendations"
          ? options.detail()?.recommendations[options.column()]
          : options.detailHasEpisodes()
            ? options.detailEpisodes()[options.column()]
            : options.detail()?.recommendations[options.column()]
        : options.screen() === "home"
          ? options.home()?.rows[options.row()]?.cards[options.column()]
          : options.page().cards[options.column()];
    if (card) {
      if ((options.screen() === "detail" && card.identity.episode) ||
        (options.screen() === "home" && card.view?.preview?.action === "play"))
        await options.playIntent(card);
      else await options.openDetail(card);
    }
    void STREMIO_ONLY;
    void options.chrome;
  }
  return { activate };
}

export type ActivateScene = ReturnType<typeof createActivateScene>;
