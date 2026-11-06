import type { Source } from "./types";

/** The small slice of the Android TV source-row vocabulary this client can
 * derive from the server's SourceCandidate mirror. */
export const sourceProvider = (source: Source): string =>
  source.presentation?.provider_name?.trim() ||
  source.source_name?.trim() ||
  source.view?.provider_label?.trim() ||
  source.view?.addon_label?.trim() ||
  "Other";

export const sourceQuality = (source: Source): string =>
  source.quality_height
    ? source.quality_height === 2160
      ? "4K"
      : `${source.quality_height}p`
    : (source.view?.quality_label ??
      source.presentation?.quality ??
      "—");

const releaseTypes: Record<string, string> = {
  web_dl: "WEB-DL",
  webrip: "WEBRip",
  bluray: "BluRay",
  remux: "Remux",
  hdtv: "HDTV",
  dvd: "DVD",
  other_rip: "Rip",
  cam: "CAM",
};

export const sourceReleaseType = (source: Source): string | null =>
  releaseTypes[source.release_type ?? ""] ??
  source.view?.format_label?.trim() ??
  source.presentation?.container?.toUpperCase() ??
  null;

export const sourceFormat = (source: Source): string | null =>
  source.presentation?.container?.toUpperCase() ??
  (source.presentation?.delivery_format?.toLowerCase() === "hls"
    ? "HLS"
    : null) ??
  source.view?.format_label?.trim() ??
  null;

const LEADING_GROUP = /^\[\s*([^\[\]]+?)\s*]/;
const TRAILING_EXTENSION = /\.\w{2,5}$/;
const TRAILING_GROUP = /-([A-Za-z][A-Za-z0-9._-]*)$/;

export function sourceReleaseGroup(source: Source): string {
  const text = source.detail ?? source.filename ?? "";
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    const leading = LEADING_GROUP.exec(line);
    if (leading) return leading[1].trim();
  }
  const last = lines.at(-1);
  if (last) {
    const trailing = TRAILING_GROUP.exec(last.replace(TRAILING_EXTENSION, ""));
    if (trailing) return trailing[1].trim();
  }
  return sourceProvider(source);
}

const sizeLabel = (source: Source): string | null =>
  source.presentation?.size_label?.trim() ||
  (source.presentation?.size_bytes
    ? source.presentation.size_bytes >= 1_073_741_824
      ? `${(source.presentation.size_bytes / 1_073_741_824).toFixed(1)} GB`
      : `${Math.round(source.presentation.size_bytes / 1_048_576)} MB`
    : null);

const trackerLabel = (source: Source): string | null => {
  const line = source.detail
    ?.split("\n")
    .find((value) => value.includes("⚙"));
  if (!line) return null;
  const words = line.split(/[ |\t]/).filter(Boolean);
  return words.at(-1)?.replace("⚙", "") ?? null;
};

export function sourceFacts(source: Source): string[] {
  return [
    sizeLabel(source),
    source.presentation?.video_codec?.toUpperCase() ?? source.video_codec?.toUpperCase(),
    source.seeders ? `↑${source.seeders}` : null,
    trackerLabel(source),
    sourceProvider(source),
  ].filter((value): value is string => !!value?.trim());
}

export function sourceAudioSubs(source: Source): string {
  const audio = (source.audio_languages ?? [])
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const subs = (source.subtitle_languages ?? [])
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const audioText = audio.length
    ? `Audio ${audio.slice(0, 3).join("/")}`
    : "Audio not listed";
  const subsText = subs.length
    ? `Subs ${subs.slice(0, 3).join("/")}`
    : source.subbed
      ? "Subs"
      : "Subs not listed";
  return `${audioText} · ${subsText}`;
}
