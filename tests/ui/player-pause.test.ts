import { describe, expect, it, vi } from 'vitest';
import { createPlayerActivation } from '../../src/tv-solid/remote/activation/player';
import { createPlayerMediaKeys } from '../../src/tv-solid/remote/input/player-media';

function fixture() {
  let visible = false;
  const pause = vi.fn(async () => undefined), play = vi.fn(async () => undefined);
  const setPlaying = vi.fn(async (playing: boolean) => { visible = true; await (playing ? play() : pause()); });
  const tracks = vi.fn(), seek = vi.fn(async () => undefined), next = vi.fn(async () => undefined);
  const options = {
    player: { player: { pause, play }, seek }, snapshot: () => ({ state: 'playing', time: { positionSeconds: 1 } }),
    actions: () => ({ pause: true, seek: true }), action: () => undefined, channel: () => undefined,
    choice: () => 0, buttons: () => [{ id: 'tracks' }],
    timeline: { value: () => undefined, set: vi.fn(), seeking: vi.fn() },
    chrome: { visible: () => visible, set: vi.fn((value: boolean) => { visible = value; }), hide: vi.fn() },
    segments: { active: () => undefined, clear: vi.fn(), refresh: vi.fn(async () => undefined) },
    skipEnabled: () => true, next, tracks, play: vi.fn(), details: vi.fn(), dialogs: { open: vi.fn() }, setPlaying,
  };
  return { options, pause, play, tracks, seek, next, setPlaying, visible: () => visible };
}

describe('pause chrome intent', () => {
  it('hidden Select pauses and reveals instead of invoking a stale tools selection', async () => {
    const f = fixture();
    await createPlayerActivation(f.options as unknown as Parameters<typeof createPlayerActivation>[0])();
    expect(f.pause).toHaveBeenCalledOnce(); expect(f.visible()).toBe(true);
    expect(f.tracks).not.toHaveBeenCalled(); expect(f.seek).not.toHaveBeenCalled();
  });
  it('a visible tools selection retains its action', async () => {
    const f = fixture(); f.options.chrome.set(true);
    await createPlayerActivation(f.options as unknown as Parameters<typeof createPlayerActivation>[0])();
    expect(f.tracks).toHaveBeenCalledOnce(); expect(f.pause).not.toHaveBeenCalled();
  });
  it('the independently visible skip chip retains explicit skip intent', async () => {
    const f = fixture();
    const options = {...f.options, segments: {...f.options.segments, active: () => ({kind:'intro', start_ms:0, end_ms:2000})}};
    await createPlayerActivation(options as unknown as Parameters<typeof createPlayerActivation>[0])();
    expect(f.seek).toHaveBeenCalledWith(2); expect(f.pause).not.toHaveBeenCalled();
  });
  for (const key of ['MediaPause', 'MediaPlayPause', ' ']) it(`${key} uses the shared revealed pause command`, async () => {
    const f = fixture();
    const options = {...f.options, active: () => undefined, seeking: {current:()=>false,set:vi.fn()},
      revealEnded:()=>false, chrome:{show:f.options.chrome.set,hide:vi.fn()}, fail:vi.fn()};
    createPlayerMediaKeys(options as unknown as Parameters<typeof createPlayerMediaKeys>[0])(new KeyboardEvent('keydown',{key}));
    expect(f.setPlaying).toHaveBeenCalledWith(false); expect(f.visible()).toBe(true);
  });
});
