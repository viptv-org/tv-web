import type {
  MediaItem,
  MediaSource,
  PlaybackCapabilities,
  PlaybackPreferences,
  TvApi,
} from "../api";
import type { SessionStartIntent } from "../player";

/**
 * The continuation selector is deliberately separate from exact resume.
 *
 * Roku's `BestContinuationSource` keeps an IPTV episode inside the account
 * which supplied the current episode. Add-on episodes are instead selected by
 * the same source-match ranking used in the source picker. This protects a
 * user from silently crossing IPTV accounts, while still allowing ordinary
 * add-ons to supply the best available next episode.
 */
export async function resolveNext(
  api: Pick<TvApi, "nextEpisode" | "sources" | "pollSources">,
  profileId: string,
  current: MediaItem,
  preferences: PlaybackPreferences,
  signal?: AbortSignal,
  capabilities: PlaybackCapabilities = DEFAULT_CONTINUATION_CAPABILITIES,
  excludedSourceIds: ReadonlySet<string> = new Set(),
): Promise<SessionStartIntent | null> {
  const next = await api.nextEpisode(profileId, current, { signal });
  if (next.status !== "next" || !next.item) return null;

  const discovery = await api.sources(next.item, { signal });
  const sources = await collectSources(api, discovery.id, signal);
  const source = bestContinuationSource(
    sources.filter((source) => !excludedSourceIds.has(source.id)),
    current,
    preferences,
    capabilities,
  );
  return source ? { item: next.item, source, position: 0 } : null;
}

/** Matches Roku's default SourceMatch capability envelope. */
export const DEFAULT_CONTINUATION_CAPABILITIES: PlaybackCapabilities = {
  maxWidth: 1920,
  maxHeight: 1080,
  h264: true,
  hevc: false,
  aac: true,
  directPlay: true,
  hevcSdr: false,
};

/**
 * Port of Roku `BestContinuationSource`: IPTV stays with its source account;
 * add-on candidates are ranked and discovery order resolves equal ranks.
 */
export function bestContinuationSource(
  sources: readonly MediaSource[],
  current: Pick<MediaItem, "sourceAddonId">,
  preferences: PlaybackPreferences,
  capabilities: PlaybackCapabilities = DEFAULT_CONTINUATION_CAPABILITIES,
): MediaSource | undefined {
  const provider = current.sourceAddonId ?? "";
  if (provider.startsWith("iptv:"))
    return sources.find((source) => source.sourceAddonId === provider);

  let winner: MediaSource | undefined;
  let best = Number.POSITIVE_INFINITY;
  for (const source of sources) {
    if (!source.sourceAddonId?.startsWith("addon:")) continue;
    const rank = sourceMatch(source, capabilities, preferences).rank;
    // Deliberately do not replace an equal-rank source: add-on discovery order
    // is the stable final tie-breaker in Roku's policy.
    if (rank < best) {
      winner = source;
      best = rank;
    }
  }
  return winner;
}

export interface SourceMatch {
  readonly rank: number;
  readonly likely: boolean;
  readonly best: boolean;
}

/**
 * A direct TypeScript port of the ranking portion of Roku `SourceMatch`.
 * It is recommendation only: backend inspection, not a release filename,
 * decides whether direct play is actually safe.
 */
export function sourceMatch(
  source: MediaSource,
  capabilities: PlaybackCapabilities,
  preferences: PlaybackPreferences,
): SourceMatch {
  let height = capabilities.maxHeight || 1080;
  if (preferences.quality === "720p") height = Math.min(height, 720);
  if (preferences.quality === "1080p") height = Math.min(height, 1080);
  if (preferences.quality === "480p") height = Math.min(height, 480);

  const text = sourceText(source).toLowerCase();
  const audioScore = sourceLanguageScore(
    source,
    preferences.audioLanguage || "en",
  );
  const resolution = resolutionOf(text);
  const h264 = /(^|[^a-z0-9])(?:h\.?264|x264|avc)([^a-z0-9]|$)/.test(text);
  const h265 = /(^|[^a-z0-9])(?:h\.?265|x265|hevc)([^a-z0-9]|$)/.test(text);
  const heavy =
    /(^|[^a-z0-9])(?:hdr|hdr10|dv|10bit|10-bit|hi10p|av1)([^a-z0-9]|$)/.test(
      text,
    );
  const likely =
    resolution > 0 &&
    resolution <= height &&
    (h264 || (h265 && capabilities.hevcSdr)) &&
    !heavy;
  const rank =
    (9 - audioScore) * 10 +
    (likely && resolution === height ? 0 : likely ? 1 : 5);
  return {
    rank,
    likely,
    best: likely && audioScore >= 4 && resolution === height,
  };
}

async function collectSources(
  api: Pick<TvApi, "pollSources">,
  id: string,
  signal?: AbortSignal,
): Promise<readonly MediaSource[]> {
  const result: MediaSource[] = [];
  const seen = new Set<string>();
  let after = 0;
  // Roku keeps a three-minute discovery budget. This is the same 120 polls at
  // 1.5 seconds, with cancellation observed before every request and delay.
  for (let attempts = 0; attempts < 120; attempts += 1) {
    throwIfAborted(signal);
    const poll = await api.pollSources(id, after, { signal });
    for (const event of poll.events) {
      after = Math.max(after, event.sequence);
      for (const source of event.sources) {
        if (!seen.has(source.id)) {
          seen.add(source.id);
          result.push(source);
        }
      }
    }
    if (poll.done) return result;
    await delay(1_500, signal);
  }
  return result;
}

function sourceText(source: MediaSource): string {
  return [
    source.name,
    source.title,
    source.filename,
    source.audio,
    stringRaw(source, "description"),
  ]
    .filter(Boolean)
    .join("\n");
}

function sourceLanguageScore(source: MediaSource, requested: string): number {
  const language = languageCode(requested);
  // Roku trusts the server's precomputed English evidence when it is present.
  // Preserve that fast path rather than trying to recover it from a label.
  const evidence = source.raw.audioEvidenceScore;
  if (
    language === "en" &&
    typeof evidence === "number" &&
    Number.isFinite(evidence)
  )
    return Math.max(0, Math.min(9, evidence));
  const aliases = LANGUAGE_ALIASES[language] ?? LANGUAGE_ALIASES.en;
  const pattern = aliases.join("|");
  const exact = new RegExp(`^(?:${pattern})(?:[-_].*)?$`, "i");
  const word = new RegExp(`(^|[^a-z])(?:${pattern})([^a-z]|$)`, "i");
  const explicitAudio = new RegExp(
    `(^|[^a-z])(?:(?:${pattern})[ ._:-]+(?:audio|dubbed|dub)|(?:audio|dubbed|dub)[ ._:-]+(?:${pattern}))([^a-z]|$)`,
    "i",
  );
  const reported = rawStrings(source, "reported_languages").some((value) =>
    exact.test(value),
  );
  const lines = sourceText(source).replace(/[|;]/g, "\n").split("\n");
  let mentioned = false;
  let explicit = false;
  let dubbed = false;
  let multi = false;
  for (let line of lines) {
    const subtitles =
      /(^|[^a-z])(?:subtitles?|subs?|captions?)([^a-z]|$)/i.test(line);
    const audio = /(^|[^a-z])(?:audio|dubbed|dub)([^a-z]|$)/i.test(line);
    if (subtitles && !audio) continue;
    if (subtitles)
      line = line.replace(
        new RegExp(
          `(?:${pattern})[ ._:-]+(?:subtitles?|subs?|captions?)`,
          "ig",
        ),
        "",
      );
    if (word.test(line)) mentioned = true;
    if (explicitAudio.test(line)) explicit = true;
    if (language === "en") {
      if (/(^|[^a-z])(?:dubbed|dub)([^a-z]|$)/i.test(line)) dubbed = true;
      if (
        /(^|[^a-z])(?:dual[ ._-]?audio|multi[ ._-]?audio)([^a-z]|$)/i.test(line)
      )
        multi = true;
    }
  }
  return Math.min(
    9,
    Number(reported) +
      Number(mentioned) +
      Number(multi) * 2 +
      Number(dubbed) * 3 +
      Number(explicit) * 4,
  );
}

function resolutionOf(text: string): number {
  let result = 0;
  for (const value of [480, 720, 1080, 2160])
    if (text.includes(`${value}p`)) result = value;
  return text.includes("4k") ? 2160 : result;
}

function rawStrings(source: MediaSource, key: string): readonly string[] {
  const value = source.raw[key];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}
function stringRaw(source: MediaSource, key: string): string | undefined {
  const value = source.raw[key];
  return typeof value === "string" ? value : undefined;
}
function languageCode(value: string): string {
  return (
    (
      {
        eng: "en",
        spa: "es",
        fra: "fr",
        fre: "fr",
        deu: "de",
        ger: "de",
        jpn: "ja",
        por: "pt",
      } as Record<string, string>
    )[value.toLowerCase()] ?? value.toLowerCase()
  );
}
function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted)
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException("Aborted", "AbortError");
}
function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(done, milliseconds);
    function done() {
      signal?.removeEventListener("abort", abort);
      resolve();
    }
    function abort() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    }
    signal?.addEventListener("abort", abort, { once: true });
  });
}

const LANGUAGE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  en: ["english", "eng", "en"],
  es: ["spanish", "spa", "es"],
  fr: ["french", "fre", "fra", "fr"],
  de: ["german", "ger", "deu", "de"],
  it: ["italian", "ita", "it"],
  pt: ["portuguese", "por", "pt"],
  ja: ["japanese", "jpn", "ja"],
  ko: ["korean", "kor", "ko"],
  zh: ["chinese", "zho", "chi", "zh"],
  hi: ["hindi", "hin", "hi"],
  ar: ["arabic", "ara", "ar"],
};
