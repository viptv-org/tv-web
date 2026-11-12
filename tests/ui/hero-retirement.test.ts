import { expect, it, vi } from 'vitest';
import { retireAfterHeroAnimations } from '../../src/tv-solid/remote/hero-retirement';

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
