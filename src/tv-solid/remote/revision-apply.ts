import type { Accessor, Setter } from "solid-js";
import type { RemoteTvApi } from "./api";
import { stremioHome } from "./stremio-home";
import type { Bootstrap, Card, Page } from "./types";

/** A server revision landed while a screen was open.
 *
 * The order is the design: navigation is adopted first, because the screen may
 * have *stopped existing* and everything below would then be re-requesting a
 * route that cannot be reached; then the focused route is re-found by identity;
 * then the open view re-reads its own data. `commit` fires only after those
 * reads succeed, so a failed refresh never marks the revision applied.
 */
export function createRevisionApply(options: {
  api: RemoteTvApi;
  screen: Accessor<string>;
  zone: Accessor<string>;
  column: Accessor<number>;
  setColumn: Setter<number>;
  navs: Accessor<readonly { id: string }[]>;
  navIndex: (id: string) => number;
  setNavigation: (value: Bootstrap["navigation"]) => void;
  selected: Accessor<Card | undefined>;
  search: Accessor<string>;
  updateSearch: (value: string, immediate?: boolean) => void;
  resetScope: () => AbortSignal;
  applyBootstrap: (value: Bootstrap) => void;
  restartPaging: () => AbortSignal;
  invalidateHistory: () => void;
  setManagement: (value: Bootstrap["profile_management"]) => void;
  setPreferences: (value: Bootstrap["preferences"] | null | undefined) => void;
  setSaved: (value: Map<string, boolean>) => void;
  replaceHome: (value: Bootstrap["home"] | null | undefined) => void;
  replacePage: (value: Page) => void;
  browseQuery: () => unknown;
  loadLibrary: (cursor: string, signal: AbortSignal) => Promise<Page>;
  loadSettings: (tab: number, signal: AbortSignal) => Promise<void>;
  settingsTab: Accessor<number>;
  refreshDetail: (signal: AbortSignal, profile: string, commit: () => void) => Promise<unknown>;
  refreshLive: (signal: AbortSignal, commit: () => void) => Promise<unknown>;
  fail: (error: unknown) => void;
}) {
  async function applyRevision(
    fresh: Bootstrap,
    signal: AbortSignal,
    profile: string,
    commit: () => void,
  ): Promise<void> {
    const focusedNav = options.zone() === "nav" ? options.navs()[options.column()]?.id : undefined;
    options.setNavigation(fresh.navigation);
    // The screen itself may be gone from the new navigation: adopt the
    // bootstrap (which picks a reachable screen) instead of refreshing a route
    // the viewer can no longer reach.
    if (
      ["movie", "series", "anime", "search", "live", "calendar", "library"].includes(options.screen()) &&
      !options.navs().some(item => item.id === options.screen())
    ) {
      options.resetScope();
      options.applyBootstrap(fresh);
      return;
    }
    if (focusedNav)
      options.setColumn(options.navIndex(options.navs().some(item => item.id === focusedNav) ? focusedNav : "home"));
    options.restartPaging();
    options.invalidateHistory();
    options.setManagement(fresh.profile_management);
    options.setPreferences(fresh.preferences ?? undefined);
    options.replaceHome(stremioHome(fresh.home ?? undefined));
    options.setSaved(new Map());
    const view = options.screen();
    if (view === "library") options.replacePage(await options.loadLibrary("0", signal));
    else if (view === "movie" || view === "series" || view === "anime")
      options.replacePage(await options.api.discover(options.browseQuery() as never, signal));
    else if (view === "search" && options.search()) options.updateSearch(options.search(), true);
    else if (view === "detail" && options.selected()) {
      await options.refreshDetail(signal, profile, commit);
      return;
    } else if (view === "settings") await options.loadSettings(options.settingsTab(), signal);
    else if (view === "live") {
      await options.refreshLive(signal, commit);
      return;
    }
    // Commit only after the dependent feature reads succeeded, before yielding.
    commit();
  }
  return { applyRevision };
}
