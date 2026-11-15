import { createRoot, createSignal } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlaybackSegments } from '../../src/tv-solid/remote/player/segments';
import { SKIP_OFFER_MS } from '../../src/tv-solid/remote/player/skip-intro';
import type { PlaybackSegment } from '../../src/tv-solid/remote/types';

const snapshot = (positionSeconds: number, durationSeconds = 100) =>
  ({ time: { positionSeconds, durationSeconds } }) as any;

function harness(initial: PlaybackSegment[] = []) {
  return createRoot(dispose => {
    const [position, setPosition] = createSignal(0);
    const [lease, setLease] = createSignal<string | undefined>('lease-1');
    const [enabled, setEnabled] = createSignal(true);
    const [canSeek, setCanSeek] = createSignal(true);
    const fetches: { lease: string; signal: AbortSignal }[] = [];
    const segments = createPlaybackSegments({
      lease, signal: () => new AbortController().signal, snapshot: () => snapshot(position()),
      fetch: async (value, signal) => { fetches.push({ lease: value, signal }); return { segments: initial }; },
      skipEnabled: enabled, canSeek,
    });
    return { dispose, segments, setPosition, setLease, setEnabled, setCanSeek, fetches };
  });
}

afterEach(() => vi.useRealTimers());

describe('playback skip markers', () => {
  it('selects the segment the position is inside and ignores credits', async () => {
    const h = harness([
      { kind: 'credits', start_ms: 0, end_ms: 2000 },
      { kind: 'intro', start_ms: 1000, end_ms: 3000 },
      { kind: 'recap', start_ms: 4000, end_ms: 5000 },
    ]);
    await h.segments.refresh();
    expect(h.fetches).toHaveLength(1);
    h.setPosition(1.5);
    expect(h.segments.active()?.kind).toBe('intro');
    h.setPosition(3.2);
    expect(h.segments.active()).toBeUndefined();
    h.setPosition(4.5);
    expect(h.segments.active()?.kind).toBe('recap');
    h.dispose();
  });

  it('drops markers that leave the title or make no sense', async () => {
    const h = harness([
      { kind: 'intro', start_ms: -100, end_ms: 2000 },
      { kind: 'intro', start_ms: 1000, end_ms: 1000 },
      { kind: 'intro', start_ms: 9000, end_ms: 120000 },
    ]);
    await h.segments.refresh();
    h.setPosition(1);
    expect(h.segments.active()).toBeUndefined();
    h.setPosition(9.5);
    expect(h.segments.active()).toBeUndefined();
    h.dispose();
  });

  it('ignores an answer from a retired lease', async () => {
    const h = harness([{ kind: 'intro', start_ms: 0, end_ms: 2000 }]);
    const pending = h.segments.refresh();
    h.setLease('lease-2');
    await pending;
    expect(h.segments.segments()).toEqual([]);
    await h.segments.refresh();
    expect(h.segments.segments()).toHaveLength(1);
    h.dispose();
  });

  it('offers the button for six seconds, then withdraws it to the controls', async () => {
    vi.useFakeTimers();
    const h = harness([{ kind: 'intro', start_ms: 0, end_ms: 5000 }]);
    await h.segments.refresh();
    h.setPosition(1);
    expect(h.segments.stage()).toBe('button');
    vi.advanceTimersByTime(SKIP_OFFER_MS);
    expect(h.segments.stage()).toBe('controls');
    h.setPosition(6);
    expect(h.segments.stage()).toBe('none');
    h.dispose();
  });

  it('never offers anything without the profile setting, the seek or the segment', async () => {
    vi.useFakeTimers();
    const h = harness([{ kind: 'intro', start_ms: 0, end_ms: 5000 }]);
    await h.segments.refresh();
    h.setPosition(1);
    h.setEnabled(false);
    expect(h.segments.stage()).toBe('none');
    h.setEnabled(true);
    h.setCanSeek(false);
    expect(h.segments.stage()).toBe('none');
    h.setCanSeek(true);
    expect(h.segments.stage()).toBe('button');
    h.dispose();
  });
});
