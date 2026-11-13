import { expect, it, vi } from 'vitest';
import { afterPreparedFrame, retireAfterHeroAnimations } from '../../src/tv-solid/remote/hero-retirement';

it('gives cached prepared nodes a render turn and cancels obsolete adoption', () => {
  let id = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++id, callback); return id; });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
  const step = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(0)); };
  try {
    const commit = vi.fn(); afterPreparedFrame(commit);
    step(); expect(commit).not.toHaveBeenCalled(); step(); expect(commit).toHaveBeenCalledOnce();
    const obsolete = vi.fn(), cancel = afterPreparedFrame(obsolete);
    step(); cancel(); step(); expect(obsolete).not.toHaveBeenCalled(); expect(frames.size).toBe(0);
  } finally { vi.unstubAllGlobals(); }
});

const run = () => {
  let stop!: () => void;
  const stopped = new Promise<void>(resolve => { stop = resolve; });
  const animation = vi.fn(() => ({ waitUntilStopped: () => stopped }));
  return { node: { lng: { animation } }, stop, animation };
};

it.each([false, true])('waits for both native opacity halves, foreground stops first: %s', async foregroundFirst => {
  vi.useFakeTimers();
  try {
    const background = run(), foreground = run(), retire = vi.fn();
    retireAfterHeroAnimations([background.node, foreground.node], retire);
    expect(background.animation).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(background.animation).toHaveBeenCalledWith('alpha');
    (foregroundFirst ? foreground : background).stop();
    await Promise.resolve(); await Promise.resolve();
    expect(retire).not.toHaveBeenCalled();
    (foregroundFirst ? background : foreground).stop();
    await Promise.resolve(); await Promise.resolve();
    expect(retire).toHaveBeenCalledOnce();
  } finally { vi.useRealTimers(); }
});

it('fences an obsolete completion and cancels a timer before native runs are read', async () => {
  vi.useFakeTimers();
  try {
    const background = run(), foreground = run(), retire = vi.fn();
    const cancel = retireAfterHeroAnimations([background.node, foreground.node], retire);
    await vi.runAllTimersAsync(); cancel(); background.stop(); foreground.stop();
    await Promise.resolve(); await Promise.resolve();
    expect(retire).not.toHaveBeenCalled();
    const cancelBeforeStart = retireAfterHeroAnimations([background.node], retire);
    background.animation.mockClear(); cancelBeforeStart(); await vi.runAllTimersAsync();
    expect(background.animation).not.toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
});

it('retains retiring branding until background, poster and logo opacity runs all stop', async () => {
  vi.useFakeTimers();
  try {
    const background = run(), poster = run(), branding = run(), retire = vi.fn();
    retireAfterHeroAnimations([background.node, poster.node, branding.node], retire);
    await vi.runAllTimersAsync(); background.stop(); poster.stop();
    await Promise.resolve(); await Promise.resolve();
    expect(retire).not.toHaveBeenCalled(); branding.stop();
    await Promise.resolve(); await Promise.resolve(); expect(retire).toHaveBeenCalledOnce();
  } finally { vi.useRealTimers(); }
});

it('retires on the native scheduling turn when no opacity run exists', async () => {
  vi.useFakeTimers();
  try {
    const retire = vi.fn(); retireAfterHeroAnimations([{}, {}], retire);
    expect(retire).not.toHaveBeenCalled(); await vi.runAllTimersAsync(); expect(retire).toHaveBeenCalledOnce();
  } finally { vi.useRealTimers(); }
});

it('retains the outgoing frame until its native horizontal run also stops', async () => {
  vi.useFakeTimers();
  try {
    let finish!: () => void;
    const moving = new Promise<void>(resolve => { finish = resolve; }), retire = vi.fn();
    const node = {lng: {animation: (property: string) => ({waitUntilStopped: () => property === 'x' ? moving : Promise.resolve()})}};
    retireAfterHeroAnimations([node], retire); await vi.runAllTimersAsync();
    expect(retire).not.toHaveBeenCalled(); finish();
    await Promise.resolve(); await Promise.resolve(); expect(retire).toHaveBeenCalledOnce();
  } finally { vi.useRealTimers(); }
});
