import { createEffect, createMemo, createSignal, onCleanup, type Accessor } from "solid-js";
import type { PlayerSnapshot } from "../../../../vendor/video/src/types";
import type { PlaybackSegment } from "../types";
import { SKIP_OFFER_MS, skipOffer, type SkipOffer } from "./skip-intro";

/** The server's skip markers for the current lease, and the six-second offer
 * that decides where the skip action lives.
 *
 * The offer clock only restarts when a *different* segment becomes current:
 * the player's action object changes identity on every tick, and re-arming
 * from it kept the button on screen for the whole cold open.
 */
export function createPlaybackSegments(options: {
  lease: Accessor<string | undefined>;
  /** The screen's abort signal, so a retired request cannot land. */
  signal: Accessor<AbortSignal>;
  snapshot: Accessor<PlayerSnapshot | undefined>;
  fetch: (lease: string, signal: AbortSignal) => Promise<{ segments?: PlaybackSegment[] }>;
  skipEnabled: Accessor<boolean>;
  canSeek: Accessor<boolean>;
}) {
  const [segments, setSegments] = createSignal<PlaybackSegment[]>([]);
  const active = createMemo(() => {
    const position = (options.snapshot()?.time.positionSeconds ?? 0) * 1000;
    const duration = options.snapshot()?.time.durationSeconds ?? 0;
    return segments().find(
      (segment) =>
        segment.kind !== "credits" && Number.isFinite(segment.start_ms) && Number.isFinite(segment.end_ms) &&
        segment.start_ms >= 0 && segment.end_ms > segment.start_ms &&
        (!(duration > 0) || segment.end_ms <= duration * 1000) &&
        position >= segment.start_ms &&
        position < segment.end_ms,
    );
  });
  async function refresh(): Promise<void> {
    const lease = options.lease();
    if (!lease) {
      setSegments([]);
      return;
    }
    try {
      const value = await options.fetch(lease, options.signal());
      if (options.lease() === lease) setSegments(value.segments ?? []);
    } catch {
      if (options.lease() === lease) setSegments([]);
    }
  }
  const clear = () => setSegments([]);
  const [offered, setOffered] = createSignal(false);
  let offeredSegment: PlaybackSegment | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  createEffect(() => {
    const segment = active();
    if (segment === offeredSegment) return;
    offeredSegment = segment;
    clearTimeout(timer);
    const wanted = !!segment && options.skipEnabled() && options.canSeek();
    setOffered(wanted);
    if (wanted) timer = setTimeout(() => setOffered(false), SKIP_OFFER_MS);
  });
  onCleanup(() => clearTimeout(timer));
  /** Where the skip action lives right now. */
  const stage = (): SkipOffer =>
    skipOffer(active(), options.skipEnabled(), options.canSeek(), offered() ? 0 : SKIP_OFFER_MS);
  return { active, stage, refresh, clear, segments };
}
