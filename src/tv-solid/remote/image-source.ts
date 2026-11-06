/** Public artwork transports used by the Android TV client. Proxying public
 * artwork keeps canvas readback and renderer textures same-origin and bounded. */
const publicHosts = new Set([
  "images.metahub.space",
  "live.metahub.space",
  "image.tmdb.org",
  "artworks.thetvdb.com",
  "assets.fanart.tv",
  "images.fanart.tv",
  "static.tvmaze.com",
  "i.imgur.com",
  "upload.wikimedia.org",
]);

export function imageSource(
  url: string | null | undefined,
  width?: number,
  height?: number,
  fit: "cover" | "inside" = "cover",
): string {
  if (!url) return "";
  try {
    const source = new URL(url, location.href);
    if (source.origin === location.origin || !publicHosts.has(source.hostname))
      return url;
    const proxy = new URL("https://wsrv.nl/");
    proxy.searchParams.set("url", source.toString());
    if (width) proxy.searchParams.set("w", String(Math.round(width)));
    if (height) proxy.searchParams.set("h", String(Math.round(height)));
    proxy.searchParams.set("fit", fit);
    proxy.searchParams.set("output", "webp");
    proxy.searchParams.set("q", "65");
    proxy.searchParams.set("we", "true");
    return proxy.toString();
  } catch {
    return url;
  }
}
