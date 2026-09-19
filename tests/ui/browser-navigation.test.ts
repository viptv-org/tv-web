import { describe, expect, it, afterEach } from "vitest";
import { BrowserNavigation, browserRouteUrl, readBrowserRoute, safeRestoredRoute } from "../../src/ui/browserNavigation";

afterEach(() => history.replaceState(null, "", "/"));
describe("responsive browser navigation", () => {
  it("round-trips stable title and episode identifiers without appearance query modes", () => {
    const route = { screen: "sources" as const, media: { type: "series" as const, id: "addon:item/3", seriesId: "show:1", season: 2, episode: 3 } };
    const url = browserRouteUrl(route, new URL("https://example.test/tv/?platform=vizio&layout=responsive&dark=1&theme=dark&oled=true"));
    expect(url).toBe("/tv/title/series/addon%3Aitem%2F3/sources?platform=vizio&layout=responsive&series=show%3A1&season=2&episode=3");
    expect(readBrowserRoute(new URL(url, "https://example.test"))).toEqual(route);
  });
  it("supports top-level and search reloads and tolerates malformed title URLs", () => {
    expect(readBrowserRoute(new URL("https://example.test/tv/search?q=night+sky"))).toEqual({ screen: "Search", query: "night sky" });
    expect(readBrowserRoute(new URL("https://example.test/tv/my-list"))).toEqual({ screen: "My List" });
    expect(readBrowserRoute(new URL("https://example.test/tv/title/movie/%ZZ"))).toEqual({ screen: "Home" });
  });
  it("never replays an old player entry or invents a live source page", () => {
    const route = { screen: "player" as const, media: { type: "movie" as const, id: "movie:1" } };
    expect(safeRestoredRoute(route).screen).toBe("sources");
    expect(safeRestoredRoute(route, true).screen).toBe("detail");
    expect(safeRestoredRoute({ screen: "player", media: { type: "live", id: "channel:1" } })).toEqual({ screen: "Live TV" });
  });
  it("keeps data in a bounded memory cache, not browser history state", () => {
    history.replaceState(null, "", "/tv/home?dark=1");
    const nav = new BrowserNavigation<{ title: string; secret: string }>(() => {});
    try {
      nav.update({ screen: "Home" }, { title: "Home", secret: "private" }, true);
      nav.update({ screen: "Settings" }, { title: "Settings", secret: "private" });
      expect(location.pathname).toBe("/tv/settings");
      expect(location.search).toBe("");
      expect(JSON.stringify(history.state)).not.toContain("private");
      expect(Object.keys(history.state.viptvNavigation).sort()).toEqual(["key", "position"]);
      const position = history.state.viptvNavigation.position;
      nav.update({ screen: "Settings" }, { title: "Updated", secret: "private" });
      expect(history.state.viptvNavigation.position).toBe(position);
    } finally { nav.dispose(); }
  });
  it("round-trips settings subpages and pushes history entries for subpage navigation", () => {
    expect(readBrowserRoute(new URL("https://example.test/tv/settings/playback"))).toEqual({ screen: "Settings", subpage: "Playback preferences" });
    expect(readBrowserRoute(new URL("https://example.test/tv/settings/addons"))).toEqual({ screen: "Settings", subpage: "Addons" });
    expect(browserRouteUrl({ screen: "Settings", subpage: "Playback preferences" })).toBe("/tv/settings/playback");
    expect(browserRouteUrl({ screen: "Settings", subpage: "Addons" })).toBe("/tv/settings/addons");

    history.replaceState(null, "", "/tv/settings");
    const nav = new BrowserNavigation<{ title: string }>(() => {});
    try {
      const initialPos = history.state.viptvNavigation.position;
      nav.update({ screen: "Settings", subpage: "Playback preferences" }, { title: "Playback" });
      expect(location.pathname).toBe("/tv/settings/playback");
      expect(history.state.viptvNavigation.position).toBe(initialPos + 1);
    } finally { nav.dispose(); }
  });
});
