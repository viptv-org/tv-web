import { deliveryCapabilitiesFor, type PlaybackControllerActive, type SessionStartIntent } from "@viptv/video";
import type { MediaItem, MediaSource, PlaybackPreferences, TvApi } from "../api";
import { resolveNext } from "../ui/continuation";
import type { SolidTVPlaybackRuntime, TvPlatform } from "./playbackRuntime";

type Active = PlaybackControllerActive<MediaItem, MediaSource>;
export type SolidTVContinuationIntent = SessionStartIntent<MediaItem, MediaSource> & { readonly source: MediaSource };
export type SolidTVContinuationResult =
  | { readonly kind: "started"; readonly active: Active }
  | { readonly kind: "ready"; readonly intent: SolidTVContinuationIntent }
  | { readonly kind: "missing"; readonly status: string }
  | { readonly kind: "cancelled" }
  | { readonly kind: "failed"; readonly error: Error; readonly active: Active | null; readonly outgoing: Active | null; readonly outgoingPosition: number; readonly rollbackFailed: boolean };

export interface SolidTVContinuationOptions {
  readonly api: Pick<TvApi, "nextEpisode" | "sources" | "pollSourcesStep" | "saveProgress">;
  readonly platform: TvPlatform;
  readonly getRuntime: () => SolidTVPlaybackRuntime | undefined;
  readonly profileId: () => string;
  readonly preferences: () => PlaybackPreferences;
}

/** Progress/Resume identity must describe the selected source, including after Next. */
export function enrichContinuationItem(item: MediaItem, source: MediaSource): MediaItem {
  return {
    ...item,
    sourceAddonId: source.sourceAddonId ?? item.sourceAddonId,
    sourceName: source.sourceName ?? item.sourceName,
    sourceFingerprint: typeof source.raw.source_fingerprint === "string"
      ? source.raw.source_fingerprint : item.sourceFingerprint,
    sourceQuality: source.quality ?? item.sourceQuality,
    sourceAudio: source.audio ?? item.sourceAudio,
  };
}

/** Explicit continuation only; the view owns autoplay eligibility and presentation. */
export function createSolidTVContinuation(options: SolidTVContinuationOptions) {
  let generation = 0;
  let pending: { scope: AbortController; runtime: SolidTVPlaybackRuntime | undefined } | undefined;

  function cancel() {
    generation++;
    const current = pending;
    current?.scope.abort();
    current?.runtime?.controller.cancelNext();
  }

  async function advance(previous: MediaItem, position = 0): Promise<SolidTVContinuationResult> {
    if (pending) return { kind: "cancelled" };
    const ticket = ++generation;
    const runtime = options.getRuntime();
    const scope = new AbortController();
    const operation = { scope, runtime };
    pending = operation;
    const outgoing = runtime?.controller.snapshot.active ?? null;
    const outgoingPosition = runtime?.player.snapshot.time.positionSeconds ?? position;
    const profileId = options.profileId();
    const preferences = options.preferences();
    let timedOut = false;
    let missingStatus = "unavailable";
    const deadline = setTimeout(() => {
      if (ticket !== generation) return;
      timedOut = true;
      scope.abort();
      runtime?.controller.cancelNext();
    }, 180_000);
    const cancelled = () => ticket !== generation || scope.signal.aborted;
    const attempted = new Set<string>();
    let resolvedIntent: SolidTVContinuationIntent | undefined;
    try {
      const capabilities = await deliveryCapabilitiesFor(options.platform === "webos" ? "html5" : options.platform)();
      if (timedOut) throw new Error("Next episode preparation timed out.");
      if (cancelled()) return { kind: "cancelled" };
      const resolve = async (): Promise<SolidTVContinuationIntent | null> => {
        if (cancelled()) return null;
        const intent = await resolveNext({
          nextEpisode: async (...args) => {
            const result = await options.api.nextEpisode(...args);
            missingStatus = result.status;
            return result;
          },
          sources: (...args) => options.api.sources(...args),
          pollSourcesStep: (...args) => options.api.pollSourcesStep(...args),
        }, profileId, previous, preferences, scope.signal, capabilities, attempted);
        if (cancelled() || !intent?.source) {
          if (missingStatus === "next") missingStatus = "sources-unavailable";
          return null;
        }
        attempted.add(intent.source.id);
        resolvedIntent = { ...intent, source: intent.source, item: enrichContinuationItem(intent.item, intent.source), position: 0 };
        return resolvedIntent;
      };
      if (!outgoing || !runtime) {
        const intent = await resolve();
        if (timedOut) throw new Error("Next episode preparation timed out.");
        if (cancelled()) return { kind: "cancelled" };
        return intent ? { kind: "ready", intent } : { kind: "missing", status: missingStatus };
      }
      const time = runtime.player.snapshot.time;
      await options.api.saveProgress(profileId, outgoing.intent.item, outgoingPosition,
        time.durationSeconds ?? outgoing.session.duration, { signal: scope.signal });
      for (let attempt = 0; attempt < 3 && !cancelled(); attempt++) {
        try {
          await runtime.controller.prepareNext(resolve);
          break;
        } catch (error) {
          if (cancelled() || attempt === 2 || !runtime.controller.snapshot.active) throw error;
        }
      }
      if (timedOut) throw new Error("Next episode preparation timed out.");
      if (cancelled()) return { kind: "cancelled" };
      const active = runtime.controller.snapshot.active;
      return active && resolvedIntent && active.intent === resolvedIntent
        ? { kind: "started", active }
        : { kind: "missing", status: missingStatus };
    } catch (cause) {
      if (cancelled() && !timedOut) return { kind: "cancelled" };
      const active = runtime?.controller.snapshot.active ?? null;
      return {
        kind: "failed", error: timedOut ? new Error("Next episode preparation timed out.")
          : cause instanceof Error ? cause : new Error(String(cause)),
        active, outgoing, outgoingPosition, rollbackFailed: !!outgoing && !active,
      };
    } finally {
      clearTimeout(deadline);
      if (pending === operation) pending = undefined;
    }
  }

  return { advance, cancel, get busy() { return pending !== undefined; } };
}
