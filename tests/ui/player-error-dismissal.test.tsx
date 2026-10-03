import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PlayerSnapshot } from '@viptv/video';
import { TvApi } from '../../src/api';
import { useAppCore } from '../../src/ui/app/useAppCore';
import { usePlaybackEngine } from '../../src/ui/app/usePlaybackEngine';
import type { AuthApi } from '../../src/ui/app/useTvApp';

const native = vi.hoisted(() => ({
  player: { snapshot: {} as PlayerSnapshot, subscribe: vi.fn(), dispose: vi.fn(async () => {}) },
  sessions: { snapshot: { error: null }, subscribe: vi.fn(), recoverPlayback: vi.fn(), stop: vi.fn(async () => {}) },
}));
vi.mock('@viptv/video', async importOriginal => ({
  ...await importOriginal<typeof import('@viptv/video')>(),
  createPlayer: () => native.player,
  deliveryCapabilitiesFor: () => async () => ({}),
  PlaybackSessionController: class { constructor() { return native.sessions; } },
}));

let listener: (snapshot: PlayerSnapshot) => void;
beforeEach(() => {
  vi.clearAllMocks();
  native.sessions.recoverPlayback.mockResolvedValue(false);
  native.sessions.subscribe.mockReturnValue(vi.fn());
  native.player.subscribe.mockImplementation(callback => { listener = callback; return vi.fn(); });
});
afterEach(() => vi.restoreAllMocks());

function fixture() {
  const api = new TvApi({ baseUrl: 'https://fixture.example', fetch: async () => new Response('{}') });
  const feedback = { fail: vi.fn(), notify: vi.fn(), go: vi.fn() };
  return renderHook(() => {
    const core = useAppCore(api, 'html5', 'responsive');
    usePlaybackEngine({ ...core, ...feedback } as unknown as AuthApi);
    return core;
  });
}

async function emit(sessionId: number, message = 'Native playback stopped.') {
  const snapshot = {
    sessionId, state: 'error', kind: 'vod',
    time: { positionSeconds: 0, durationSeconds: null },
    tracks: { audio: [], text: [], selectedAudioId: null, selectedTextId: null },
    error: { code: 'prepare-failed', message },
  } as PlayerSnapshot;
  native.player.snapshot = snapshot;
  await act(async () => { listener(snapshot); });
}

it('keeps a dismissed failure dismissed even when the native engine repeats it', async () => {
  const hook = fixture();
  try {
    await emit(1);
    expect(hook.result.current.error).toBe('Native playback stopped.');
    act(() => hook.result.current.setError(''));
    await emit(1);
    await emit(1);
    expect(hook.result.current.error).toBe('');
    await emit(2);
    expect(hook.result.current.error).toBe('Native playback stopped.');
    act(() => hook.result.current.setError(''));
    await emit(2, 'The media source refused authorization.');
    expect(hook.result.current.error).toBe('The media source refused authorization.');
  } finally { hook.unmount(); }
});

it('ignores a delayed failure after the playback owner is unmounted', async () => {
  let resolve!: (handled: boolean) => void;
  native.sessions.recoverPlayback.mockReturnValue(new Promise<boolean>(yes => { resolve = yes; }));
  const hook = fixture();
  await emit(1);
  hook.unmount();
  await act(async () => { resolve(false); });
  expect(hook.result.current.error).toBe('');
});
