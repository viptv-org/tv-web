export type TimelineSegment = { left: number; width: number };

/** Engine-reported buffered ranges as timeline fractions.
 *
 * Ranges arrive in title-timeline seconds, so they are clamped to it and gaps
 * between them stay gaps. An engine that reports no buffer (Tizen AVPlay) draws
 * nothing: buffering is never inferred from the play clock.
 */
export function bufferedSegments(
  ranges: readonly { start: number; end: number }[] | null | undefined,
  duration: number | null | undefined,
): TimelineSegment[] {
  const total = duration ?? 0;
  if (!ranges || !(total > 0)) return [];
  const segments: TimelineSegment[] = [];
  for (const range of ranges) {
    const start = Math.max(0, Math.min(total, range.start));
    const end = Math.max(0, Math.min(total, range.end));
    if (end > start)
      segments.push({ left: start / total, width: (end - start) / total });
  }
  return segments;
}
