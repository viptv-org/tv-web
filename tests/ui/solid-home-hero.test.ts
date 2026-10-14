import { afterEach, expect, it, vi } from 'vitest';
import { createRoot, createSignal } from 'solid-js';
import { HomeHeroIndicators } from '../../src/tv-solid/HomeHeroIndicators';
import { projectFeatured, featuredKey, nextFeatured } from '../../src/tv-solid/homeFeatured';
import { projectHome, type HomeView } from '../../src/tv-solid/homeModel';
import type { MediaItem } from '../../src/api';

// The reactive timer is real; this test does not claim canvas visual coverage.
vi.mock('../../src/tv-solid/runtime', () => ({ TvView: () => undefined }));
const item = (id: string) => ({ id, type: 'movie', name: id, title: id, genres: [], episodes: [], raw: {} }) as MediaItem;
let dispose: (() => void) | undefined;
afterEach(() => { dispose?.(); dispose = undefined; vi.useRealTimers(); });

it('waits for decoded art, pauses offscreen and starts a full next-title interval', () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
  const titles = [item('one'), item('two'), item('three'), item('four'), item('five')];
  const [home, setHome] = createSignal<HomeView>({ ...projectHome(titles[0], []), featured: titles });
  const [ready, setReady] = createSignal(false), [running, setRunning] = createSignal(true);
  const advance = vi.fn((value: MediaItem) => setHome(before => projectFeatured(before, value)));
  createRoot(stop => {
    dispose = stop;
    HomeHeroIndicators({ get home() { return home(); }, get running() { return running(); }, get ready() { return ready(); }, advance });
  });
  vi.advanceTimersByTime(10_000); expect(advance).not.toHaveBeenCalled();
  setReady(true); vi.advanceTimersByTime(4000); setRunning(false);
  vi.advanceTimersByTime(10_000); expect(advance).not.toHaveBeenCalled();
  setRunning(true); vi.advanceTimersByTime(3999); expect(advance).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1); expect(advance).toHaveBeenCalledExactlyOnceWith(titles[1]);
  vi.advanceTimersByTime(4000); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  vi.advanceTimersByTime(7999); expect(advance).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1); expect(advance).toHaveBeenCalledTimes(2);
  dispose!(); dispose = undefined;
  vi.advanceTimersByTime(16_000); expect(advance).toHaveBeenCalledTimes(2);
});

it('rotates supplied projections and keeps complete saved membership and continuation data', () => {
  const titles = [item('one'), item('two')], continuation = [{ ...item('episode'), position: 40, duration: 100 }];
  const original = { ...projectHome(titles[0], continuation), featured: titles, savedFeatured: [featuredKey(titles[1])] };
  const next = projectFeatured(original, nextFeatured(original)!);
  expect(next.heroItem).toBe(titles[1]); expect(next.saved).toBe(true);
  expect(next.queueItems).toBe(continuation); expect(next.cards).toHaveLength(1);
  expect(nextFeatured(next)).toBe(titles[0]); expect(nextFeatured(projectHome(titles[0], []))).toBeUndefined();
});
