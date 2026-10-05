import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createPlayer, deliveryCapabilitiesFor, PlaybackSessionController } from '@viptv/video';
import { TvApi, type MediaItem, type MediaSource, type PlaybackSession } from '../../src/api';
import { useAppCore } from '../../src/ui/app/useAppCore';
import { usePlaybackControls } from '../../src/ui/app/usePlaybackControls';
import type { NavigationApi } from '../../src/ui/app/useTvApp';

it.each([false, true])('accumulates skips despite zero clocks and decoder replacement=%s', async (replacement) => {
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
    await act(async () => {
      if (replacement) facts = { ...facts, sessionId: facts.sessionId + 1 };
      release(); await done;
    });
    expect(targets).toEqual([90, 150]);
    act(() => { void hook.result.current.seekBy(-10); });
    expect(hook.result.current.core.seek).toBe(140);
  } finally { hook.unmount(); await player.dispose(); vi.restoreAllMocks(); }
});

it('keeps the latest skip across real managed controller replacement and cancels on source change', async () => {
  const api = new TvApi({ baseUrl: 'https://fixture.example', fetch: async () => new Response('{}') });
  const player = createPlayer({ platform: 'html5', video: document.createElement('video'), canvas: document.createElement('canvas') });
  let facts = { ...player.snapshot, sessionId: 1, time: { positionSeconds: 60, durationSeconds: 600 } };
  vi.spyOn(player, 'snapshot', 'get').mockImplementation(() => facts);
  vi.spyOn(player, 'open').mockImplementation(async request => {
    facts = { ...facts, sessionId: facts.sessionId + 1, state: 'playing', time: { positionSeconds: (request.startAtSeconds ?? 0) + (request.timelineOffsetSeconds ?? 0), durationSeconds: 600 } };
  });
  vi.spyOn(api, 'stopPlayback').mockResolvedValue(undefined);
  const positions: number[] = [];
  let release!: () => void;
  let waiting: Promise<void> | undefined;
  vi.spyOn(api, 'startPlayback').mockImplementation(async request => {
    const position = request.position ?? 0;
    positions.push(position);
    const id = `managed-${positions.length}`;
    if (waiting) { const pending = waiting; waiting = undefined; await pending; }
    return { id, url: 'https://fixture.example/movie.m3u8', headers: {}, format: 'hls', mode: 'remux', videoMode: 'copy', audioMode: 'copy', position, live: false, duration: 600, audioTracks: [], subtitleTracks: [], subtitlesSupported: false } satisfies PlaybackSession;
  });
  const controller = new PlaybackSessionController<MediaItem, MediaSource>({ player, backend: api, capabilities: { maxWidth: 1920, maxHeight: 1080, h264: true, hevc: false, aac: true, directPlay: true, hevcSdr: false } });
  const item: MediaItem = { id: 'movie', type: 'movie', name: 'Movie', title: 'Movie', genres: [], episodes: [], raw: {} };
  const source: MediaSource = { id: 'chosen', name: 'Chosen source', raw: {} };
  await controller.start({ item, source, position: 60 });
  const hook = renderHook(() => {
    const core = useAppCore(api, 'html5', 'responsive');
    core.player.current = player;
    core.controller.current = controller;
    return { core, ...usePlaybackControls({ ...core, fail: vi.fn(), notify: vi.fn() } as unknown as NavigationApi) };
  });
  try {
    waiting = new Promise<void>(resolve => { release = resolve; });
    let done!: Promise<void>;
    act(() => { done = hook.result.current.seekBy(30); });
    await vi.waitFor(() => expect(positions).toEqual([60, 90]));
    facts = { ...facts, time: { ...facts.time, positionSeconds: 0 } };
    act(() => { void hook.result.current.seekBy(30); void hook.result.current.seekBy(30); });
    await act(async () => { release(); await done; });
    expect(positions).toEqual([60, 90, 150]);
    expect(player.snapshot.sessionId).toBe(4);
    expect(hook.result.current.core.seek).toBe(150);

    waiting = new Promise<void>(resolve => { release = resolve; });
    act(() => { done = hook.result.current.seekBy(30); void hook.result.current.seekBy(30); });
    await vi.waitFor(() => expect(positions).toEqual([60, 90, 150, 180]));
    await act(async () => { await controller.start({ item, source: { ...source, id: 'different' } }); });
    await act(async () => { release(); await done; });
    expect(positions).toEqual([60, 90, 150, 180, 0]);
  } finally { hook.unmount(); await controller.stop(); await player.dispose(); vi.restoreAllMocks(); }
});
