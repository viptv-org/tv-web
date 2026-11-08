import { describe, expect, it, vi } from 'vitest';
import { DeferredPlayer } from '../../src/tv-solid/remote/deferred-player';
import {
  IDLE_SNAPSHOT,
  type OpenPlayerRequest,
  type Player,
  type PlayerListener,
  type PlayerSnapshot,
} from '../../vendor/video/src/types';

/** A stand-in engine that records what reached it. */
function engine() {
  const listeners = new Set<PlayerListener>();
  const snapshot: PlayerSnapshot = { ...IDLE_SNAPSHOT, state: 'ready' };
  const calls: string[] = [];
  const player = {
    calls,
    capabilities: {
      platform: 'vizio',
      engine: 'HTMLMediaElement',
      directNative: 'probe-required',
      adaptiveStreaming: 'probe-required',
      drm: 'probe-required',
      canPause: true,
      canSeek: true,
      canSelectAudioTrack: false,
      canSelectTextTrack: true,
      canDisableTextTrack: true,
      canUseCookies: false,
      canUseUserAgent: false,
      limitations: [],
    },
    snapshot,
    emit(next: PlayerSnapshot) {
      for (const listener of listeners) listener(next);
    },
    open: vi.fn(async (_request: OpenPlayerRequest) => { calls.push('open'); }),
    play: vi.fn(async () => { calls.push('play'); }),
    pause: vi.fn(async () => { calls.push('pause'); }),
    seek: vi.fn(async () => { calls.push('seek'); }),
    stop: vi.fn(async () => { calls.push('stop'); }),
    dispose: vi.fn(async () => { calls.push('dispose'); }),
    selectAudioTrack: vi.fn(async () => { calls.push('audio'); }),
    selectTextTrack: vi.fn(async () => { calls.push('text'); }),
    subscribe(listener: PlayerListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return player as Player & typeof player;
}

const request: OpenPlayerRequest = { url: '/media/playlist.m3u8', kind: 'vod' };

describe('DeferredPlayer', () => {
  it('does not open an engine that finishes loading after Stop', async () => {
    const inner = engine();
    let loaded!: (value: Player) => void;
    const player = new DeferredPlayer(() => new Promise(resolve => { loaded = resolve; }));
    const opening = player.open(request);
    await player.stop();
    loaded(inner);
    await opening;
    expect(inner.open).not.toHaveBeenCalled();
    await player.open(request);
    expect(inner.open).toHaveBeenCalledOnce();
  });

  it('opens only the newest request when sessions race the initial chunk load', async () => {
    const inner = engine();
    let loaded!: (value: Player) => void;
    const player = new DeferredPlayer(() => new Promise(resolve => { loaded = resolve; }));
    const first = player.open(request);
    const second = player.open({ ...request, url: '/media/newest.m3u8' });
    loaded(inner);
    await Promise.all([first, second]);
    expect(inner.open).toHaveBeenCalledOnce();
    expect(inner.open).toHaveBeenCalledWith(expect.objectContaining({ url: '/media/newest.m3u8' }));
  });

  it('disposes a late engine without subscribing or reviving a disposed player', async () => {
    const inner = engine();
    let loaded!: (value: Player) => void;
    const player = new DeferredPlayer(() => new Promise(resolve => { loaded = resolve; }));
    const seen = vi.fn(); player.subscribe(seen);
    const opening = player.open(request);
    const cancelled = expect(opening).rejects.toMatchObject({ name: 'AbortError' });
    await player.dispose();
    loaded(inner);
    await cancelled;
    inner.emit({ ...IDLE_SNAPSHOT, state: 'playing' });
    expect(inner.dispose).toHaveBeenCalledOnce();
    expect(inner.open).not.toHaveBeenCalled();
    expect(seen).not.toHaveBeenCalled();
  });
  it('does not fetch an engine until a session opens', async () => {
    const create = vi.fn(async () => engine());
    const player = new DeferredPlayer(create);

    await player.play();
    await player.pause();
    await player.seek(12);
    await player.stop();
    await player.selectAudioTrack('a1');
    await player.selectTextTrack(null);
    await player.setVolume?.(0.5);

    expect(create).not.toHaveBeenCalled();
    expect(player.snapshot).toEqual(IDLE_SNAPSHOT);
  });

  it('loads the engine once and forwards every command after open', async () => {
    const inner = engine();
    const create = vi.fn(async () => inner);
    const player = new DeferredPlayer(create);

    await player.open(request);
    await player.play();
    await player.pause();
    await player.seek(30);
    await player.selectAudioTrack('a1');
    await player.selectTextTrack('s1');
    await player.stop();
    await player.dispose();

    expect(create).toHaveBeenCalledTimes(1);
    expect(inner.calls).toEqual(['open', 'play', 'pause', 'seek', 'audio', 'text', 'stop', 'dispose']);
  });

  it('keeps subscribers registered before the engine exists', async () => {
    const inner = engine();
    const player = new DeferredPlayer(async () => inner);
    const seen: PlayerSnapshot[] = [];
    player.subscribe(snapshot => seen.push(snapshot));

    await player.open(request);
    const playing: PlayerSnapshot = { ...IDLE_SNAPSHOT, state: 'playing' };
    inner.emit(playing);

    expect(seen).toEqual([playing]);
  });

  it('reports capabilities only once the engine exists', async () => {
    const inner = engine();
    const player = new DeferredPlayer(async () => inner);

    expect(() => player.capabilities).toThrow(/capabilities are unknown/);
    await player.open(request);
    expect(player.capabilities.engine).toBe('HTMLMediaElement');
  });

  it('retries a failed load instead of caching the failure', async () => {
    const inner = engine();
    const create = vi
      .fn<() => Promise<Player>>()
      .mockRejectedValueOnce(new Error('chunk offline'))
      .mockResolvedValueOnce(inner);
    const player = new DeferredPlayer(create);

    await expect(player.open(request)).rejects.toThrow('chunk offline');
    await player.open(request);

    expect(create).toHaveBeenCalledTimes(2);
    expect(inner.calls).toEqual(['open']);
  });
});
