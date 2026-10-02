import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createPlayer, deliveryCapabilitiesFor, PlaybackSessionController } from '@viptv/video';
import { TvApi, type MediaItem, type MediaSource, type PlaybackSession } from '../../src/api';
import { useAppCore } from '../../src/ui/app/useAppCore';
import { usePlaybackSession } from '../../src/ui/app/usePlaybackSession';
import type { PlaybackEngineApi } from '../../src/ui/app/useTvApp';

const item: MediaItem = { id: 'show:1:1', type: 'series', name: 'Show', title: 'Pilot', genres: [], episodes: [], raw: {} };
const source: MediaSource = { id: 'chosen', name: 'Selected source', raw: {} };
const session: PlaybackSession = { id: 'outgoing', url: 'https://fixture.example/media', headers: {}, format: 'hls', mode: 'remux', videoMode: 'copy', audioMode: 'copy', position: 42, live: false, duration: 120, audioTracks: [], subtitleTracks: [], subtitlesSupported: false };

function fixture() {
  const api = new TvApi({ baseUrl: 'https://fixture.example', fetch: async () => new Response('{}') });
  vi.spyOn(api, 'saveProgress').mockResolvedValue(undefined);
  const player = createPlayer({ platform: 'html5', video: document.createElement('video'), canvas: document.createElement('canvas') });
  const controller = new PlaybackSessionController<MediaItem, MediaSource>({ player, backend: api, capabilities: deliveryCapabilitiesFor('html5') });
  let reject!: (error: Error) => void;
  const delayed = new Promise<void>((_, failure) => { reject = failure; });
  // Control only the external video module's public async/snapshot boundary.
  const prepare = vi.spyOn(controller, 'prepareNext').mockImplementation(() => delayed);
  vi.spyOn(controller, 'snapshot', 'get').mockReturnValue({ state: 'error', active: null, error: new Error('Restoration failed') });
  const feedback = { fail: vi.fn(), notify: vi.fn(), play: vi.fn(), retireBrowserPlayback: vi.fn(), go: vi.fn() };
  let initialized = false;
  const hook = renderHook(() => {
    const core = useAppCore(api, 'html5', 'responsive');
    if (!initialized) {
      core.active.current = { item, source, session };
      core.player.current = player;
      core.controller.current = controller;
      initialized = true;
    }
    // This exported stage uses real state cells; auth/catalog stages are unused.
    const app = { ...core, ...feedback } as unknown as PlaybackEngineApi;
    return { core, ...usePlaybackSession(app) };
  });
  return { hook, prepare, reject, player };
}

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

it('ignores delayed restoration failure after Back, preserving newer feedback and busy state', async () => {
  const { hook, prepare, reject, player } = fixture();
  try {
    let pending!: Promise<void>;
    act(() => { pending = hook.result.current.nextEpisode(item); });
    await waitFor(() => expect(prepare).toHaveBeenCalledOnce());
    await act(async () => { await hook.result.current.stop(); });
    act(() => {
      hook.result.current.core.setError('Newer operation failed');
      hook.result.current.core.setBusy(true);
    });
    await act(async () => { reject(new Error('Late old failure')); await pending; });
    expect(hook.result.current.core.modal).toBeUndefined();
    expect(hook.result.current.core.error).toBe('Newer operation failed');
    expect(hook.result.current.core.busy).toBe(true);
  } finally { hook.unmount(); await player.dispose(); }
});

it('still offers recovery when the owned Next deadline expires on the same navigation', async () => {
  const { hook, prepare, reject, player } = fixture();
  try {
    vi.useFakeTimers();
    let pending!: Promise<void>;
    await act(async () => { pending = hook.result.current.nextEpisode(item); });
    expect(prepare).toHaveBeenCalledOnce();
    const scope = hook.result.current.core.nextScope.current;
    act(() => { vi.advanceTimersByTime(180000); });
    expect(scope?.signal.aborted).toBe(true);
    await act(async () => { reject(new Error('Owned deadline failure')); await pending; });
    expect(hook.result.current.core.modal?.title).toBe('Playback could not be restored');
    expect(hook.result.current.core.busy).toBe(false);
  } finally { hook.unmount(); await player.dispose(); }
});
