import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createPlayer, deliveryCapabilitiesFor, PlaybackSessionController } from '@viptv/video';
import { TvApi, type MediaItem, type MediaSource } from '../../src/api';
import { useAppCore } from '../../src/ui/app/useAppCore';
import { usePlaybackControls } from '../../src/ui/app/usePlaybackControls';
import type { NavigationApi } from '../../src/ui/app/useTvApp';

it('accumulates rapid skip presses from the requested target despite a zero engine clock', async () => {
  const api = new TvApi({ baseUrl: 'https://fixture.example', fetch: async () => new Response('{}') });
  const player = createPlayer({ platform: 'html5', video: document.createElement('video'), canvas: document.createElement('canvas') });
  let facts = { ...player.snapshot, sessionId: 1, time: { positionSeconds: 60, durationSeconds: 600 } };
  vi.spyOn(player, 'snapshot', 'get').mockImplementation(() => facts);
  const controller = new PlaybackSessionController<MediaItem, MediaSource>({ player, backend: api, capabilities: deliveryCapabilitiesFor("html5") });
  const targets: number[] = [];
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  vi.spyOn(controller, 'seekFrom').mockImplementation(async resolve => {
    targets.push(resolve());
    if (targets.length === 1) await waiting;
  });
  const hook = renderHook(() => {
    const core = useAppCore(api, 'html5', 'responsive');
    core.player.current = player;
    core.controller.current = controller;
    return { core, ...usePlaybackControls({ ...core, fail: vi.fn(), notify: vi.fn() } as unknown as NavigationApi) };
  });
  try {
    let done!: Promise<void>;
    act(() => { done = hook.result.current.seekBy(30); });
    facts = { ...facts, time: { ...facts.time, positionSeconds: 0 } };
    act(() => { void hook.result.current.seekBy(30); void hook.result.current.seekBy(30); });
    expect(hook.result.current.core.seek).toBe(150);
    expect(targets).toEqual([90]);
    await act(async () => { release(); await done; });
    expect(targets).toEqual([90, 150]);
    act(() => { void hook.result.current.seekBy(-10); });
    expect(hook.result.current.core.seek).toBe(140);
  } finally { hook.unmount(); await player.dispose(); vi.restoreAllMocks(); }
});
