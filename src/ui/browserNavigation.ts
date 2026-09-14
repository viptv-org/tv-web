/** Browser URLs contain stable identifiers only; catalog data and credentials stay out of history. */
export type BrowserDestination = "Home" | "Discover" | "Live TV" | "My List" | "Search" | "Settings" | "profiles" | "detail" | "sources" | "player";
export interface BrowserRoute {
  screen: BrowserDestination;
  media?: { id: string; type: "movie" | "series" | "episode" | "live"; seriesId?: string; season?: number; episode?: number };
  query?: string;
}
const paths: Partial<Record<BrowserDestination, string>> = { Home: "home", Discover: "discover", "Live TV": "live", "My List": "my-list", Search: "search", Settings: "settings", profiles: "profiles" };
export function readBrowserRoute(url = new URL(location.href)): BrowserRoute {
  const parts = url.pathname.replace(/^\/tv(?:\/|$)/, "").split("/").filter(Boolean);
  if (parts[0] === "title" && parts[1] && parts[2] && ["movie", "series", "episode", "live"].includes(parts[1])) {
    try {
      const integer = (key: string) => { const value = url.searchParams.get(key); return value !== null && /^\d+$/.test(value) ? Number(value) : undefined; };
      return { screen: parts[3] === "sources" ? "sources" : parts[3] === "watch" ? "player" : "detail", media: {
        type: parts[1] as NonNullable<BrowserRoute["media"]>["type"], id: decodeURIComponent(parts[2]),
        seriesId: url.searchParams.get("series") || undefined, season: integer("season"), episode: integer("episode"),
      } };
    } catch { return { screen: "Home" }; }
  }
  const screen = Object.entries(paths).find(([, path]) => path === parts[0])?.[0] as BrowserDestination | undefined;
  return { screen: screen ?? "Home", ...(screen === "Search" ? { query: url.searchParams.get("q") ?? "" } : {}) };
}
export function browserRouteUrl(route: BrowserRoute, current = new URL(location.href)): string {
  const params = new URLSearchParams();
  // Platform/layout select the real runtime. Appearance is a device preference, never a URL mode.
  for (const name of ["platform", "layout"]) { const value = current.searchParams.get(name); if (value !== null) params.set(name, value); }
  let path = paths[route.screen] ?? "home";
  if (route.media && ["detail", "sources", "player"].includes(route.screen)) {
    const item = route.media;
    path = `title/${item.type}/${encodeURIComponent(item.id)}${route.screen === "sources" ? "/sources" : route.screen === "player" ? "/watch" : ""}`;
    if (item.seriesId) params.set("series", item.seriesId);
    if (item.season !== undefined) params.set("season", String(item.season));
    if (item.episode !== undefined) params.set("episode", String(item.episode));
  }
  if (route.screen === "Search" && route.query) params.set("q", route.query);
  const query = params.toString();
  return `/tv/${path}${query ? `?${query}` : ""}`;
}
export function safeRestoredRoute(route: BrowserRoute, reload = false): BrowserRoute {
  if (route.media?.type === "live") return { screen: "Live TV" };
  if (route.screen === "player") return { ...route, screen: reload ? "detail" : "sources" };
  return route;
}
interface Entry { key: number; position: number }
export class BrowserNavigation<T> {
  private sequence = 0;
  private entry: Entry;
  private snapshots = new Map<number, T>();
  private route: BrowserRoute;
  private previousScrollRestoration: ScrollRestoration;
  constructor(private onPop: (route: BrowserRoute, snapshot: T | undefined) => void, private capture?: () => T) {
    const stored = history.state?.viptvNavigation as Entry | undefined;
    this.entry = stored && Number.isSafeInteger(stored.key) && Number.isSafeInteger(stored.position) ? stored : { key: Date.now(), position: 0 };
    this.sequence = this.entry.key;
    this.route = readBrowserRoute();
    history.replaceState({ viptvNavigation: this.entry }, "", browserRouteUrl(this.route));
    this.previousScrollRestoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    window.addEventListener("popstate", this.pop);
  }
  private pop = () => {
    if (this.capture) this.snapshots.set(this.entry.key, this.capture());
    const stored = history.state?.viptvNavigation as Entry | undefined;
    this.entry = stored && Number.isSafeInteger(stored.key) && Number.isSafeInteger(stored.position) ? stored : { key: ++this.sequence, position: 0 };
    this.sequence = Math.max(this.sequence, this.entry.key);
    this.route = readBrowserRoute();
    this.onPop(this.route, this.snapshots.get(this.entry.key));
  };
  update(route: BrowserRoute, snapshot: T, replace = false) {
    const url = browserRouteUrl(route);
    const sameItem = route.screen === this.route.screen && route.media?.id === this.route.media?.id && route.media?.type === this.route.media?.type;
    if (url !== browserRouteUrl(this.route) && !replace && !sameItem) {
      this.entry = { key: ++this.sequence, position: this.entry.position + 1 };
      history.pushState({ viptvNavigation: this.entry }, "", url);
    } else history.replaceState({ viptvNavigation: this.entry }, "", url);
    this.route = route;
    this.snapshots.set(this.entry.key, snapshot);
    // A long-lived browser tab retains a bounded presentation cache, not an unbounded catalog history.
    if (this.snapshots.size > 64) this.snapshots.delete(this.snapshots.keys().next().value!);
  }
  replaceRoute(route: BrowserRoute) { this.route = route; history.replaceState({ viptvNavigation: this.entry }, "", browserRouteUrl(route)); }
  remember(snapshot: T) { this.snapshots.set(this.entry.key, snapshot); }
  back(): boolean { if (this.entry.position <= 0) return false; history.back(); return true; }
  clearSnapshots() { this.snapshots.clear(); }
  dispose() { window.removeEventListener("popstate", this.pop); history.scrollRestoration = this.previousScrollRestoration; }
}
