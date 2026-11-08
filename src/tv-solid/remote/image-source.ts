import { createSignal } from "solid-js";

/** Bumped after an idle saver or a hidden tab is dismissed. The renderer may
 * have freed image textures under memory pressure while the page was covered;
 * a new URL is what makes an existing node request its artwork again. */
const [imageEpoch, setImageEpoch] = createSignal(0);
export function reloadImages() {
  setImageEpoch((value) => value + 1);
}
export const imageVersion = () => imageEpoch();

/** A fragment is not sent to the server. It changes the renderer's texture key
 * after an idle wake without touching signed query parameters or refetching
 * bytes the browser already has. */
function versioned(url: string, version: number) {
  if (!url || typeof url !== "string") return "";
  if (!version || url.startsWith("data:") || url.startsWith("blob:")) return url;
  return `${url}${url.includes("#") ? "&" : "#"}_v=${version}`;
}

/** Public artwork transports used by the Android TV client. Proxying public
 * artwork keeps canvas readback and renderer textures same-origin and bounded. */
const publicHosts = new Set([
  "images.metahub.space",
  "episodes.metahub.space",
  "live.metahub.space",
  "image.tmdb.org",
  "artworks.thetvdb.com",
  "assets.fanart.tv",
  "images.fanart.tv",
  "static.tvmaze.com",
  "i.imgur.com",
  "upload.wikimedia.org",
  "api.dicebear.com",
  "simkl.in",
]);

export function imageSource(
  url: string | null | undefined,
  width?: number,
  height?: number,
  fit: "cover" | "inside" = "cover",
): string {
  if (!url) return "";
  try {
    const source = new URL(url, location.href),
      version = imageEpoch();
    if (
      source.protocol === "https:" && source.hostname === "wsrv.nl" &&
      !source.username && !source.password && source.searchParams.has("url") &&
      (width || height)
    ) {
      if (width) source.searchParams.set("w", String(Math.max(1, Math.min(3840, Math.ceil(width)))));
      else source.searchParams.delete("w");
      if (height) source.searchParams.set("h", String(Math.max(1, Math.min(2160, Math.ceil(height)))));
      else source.searchParams.delete("h");
      source.searchParams.delete("dpr");
      source.searchParams.set("fit", fit);
      source.searchParams.set("we", "true");
      return versioned(source.toString(), version);
    }
    if (source.origin === location.origin || !publicHosts.has(source.hostname))
      return versioned(url, version);
    const proxy = new URL("https://wsrv.nl/");
    proxy.searchParams.set("url", source.toString());
    if (width) proxy.searchParams.set("w", String(Math.round(width)));
    if (height) proxy.searchParams.set("h", String(Math.round(height)));
    proxy.searchParams.set("fit", fit);
    proxy.searchParams.set("output", "webp");
    proxy.searchParams.set("q", "65");
    proxy.searchParams.set("we", "true");
    return versioned(proxy.toString(), version);
  } catch {
    return url;
  }
}
