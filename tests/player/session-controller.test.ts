import { describe, expect, it, vi } from 'vitest';

import { PlaybackSessionController, exactResumeSource } from '../../src/player/session';
import type { MediaItem, MediaSource, PlaybackCapabilities, PlaybackSession } from '../../src/api';
import type { OpenPlayerRequest, Player, PlayerCapabilities, PlayerListener, PlayerSnapshot } from '../../src/player';

const capabilities: PlaybackCapabilities = { maxWidth: 1920, maxHeight: 1080, h264: true, hevc: false, aac: true, directPlay: true, hevcSdr: false };
const playerCapabilities: PlayerCapabilities = { platform: 'html5', engine: 'fake', directNative: 'supported', adaptiveStreaming: 'probe-required', drm: 'unsupported', canPause: true, canSeek: true, canSelectAudioTrack: false, canSelectTextTrack: false, canDisableTextTrack: false, canUseCookies: false, canUseUserAgent: false, limitations: [] };
const item: MediaItem = { id: 'movie-1', type: 'movie', name: 'Movie', title: 'Movie', genres: [], raw: {}, sourceAddonId: 'addon-a', sourceFingerprint: 'fingerprint-a' };
const source: MediaSource = { id: 'stream-a', name: 'Source A', sourceAddonId: 'addon-a', raw: { source_fingerprint: 'fingerprint-a' } };

class FakePlayer implements Player {
  readonly capabilities = playerCapabilities;
  snapshot: PlayerSnapshot = { sessionId: 0, state: 'idle', kind: null, time: { positionSeconds: 0, durationSeconds: 100 }, tracks: { audio: [], text: [], selectedAudioId: null, selectedTextId: null }, error: null };
  readonly opened: OpenPlayerRequest[] = [];
  failUrl: string | undefined;
  private listeners = new Set<PlayerListener>();
  async open(request: OpenPlayerRequest) {
    this.opened.push(request);
    if (request.url === this.failUrl) throw new Error('candidate cannot play');
    this.snapshot = { ...this.snapshot, sessionId: this.snapshot.sessionId + 1, state: request.paused ? 'paused' : 'playing', kind: request.kind, time: { positionSeconds: request.timelineOffsetSeconds ?? request.startAtSeconds ?? 0, durationSeconds: 100 } };
    this.listeners.forEach((listener) => listener(this.snapshot));
  }
  async play() { this.snapshot = { ...this.snapshot, state: 'playing' }; }
  async pause() { this.snapshot = { ...this.snapshot, state: 'paused' }; }
  async seek(position: number) { this.snapshot = { ...this.snapshot, time: { ...this.snapshot.time, positionSeconds: position } }; }
  async stop() { this.snapshot = { ...this.snapshot, state: 'stopped' }; }
  async dispose() { await this.stop(); }
  async selectAudioTrack() { throw new Error('unsupported'); }
  async selectTextTrack() { throw new Error('unsupported'); }
  subscribe(listener: PlayerListener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}

function session(id: string, url: string, mode = 'managed', position = 0): PlaybackSession {
  return { id, url, format: 'mp4', mode, videoMode: 'copy', audioMode: 'copy', position, live: false, duration: 100, audioTracks: [], subtitleTracks: [], subtitlesSupported: false };
}

describe('PlaybackSessionController', () => {
  it('requires an explicit VOD source and finds Resume only by stable source identity', async () => {
    const player = new FakePlayer();
    const backend = { startPlayback: vi.fn(), stopPlayback: vi.fn() };
    const controller = new PlaybackSessionController({ player, backend, capabilities });

    await expect(controller.start({ item })).rejects.toThrow('explicit source');
    expect(backend.startPlayback).not.toHaveBeenCalled();
    expect(exactResumeSource(item, [source, { ...source, id: 'stream-b', sourceAddonId: 'other' }])).toBe(source);
    expect(exactResumeSource({ ...item, sourceFingerprint: undefined }, [source])).toBeUndefined();
  });

  it('keeps the old backend session until a managed seek replacement opens, then restores it after a candidate failure', async () => {
    const player = new FakePlayer();
    const backend = {
      startPlayback: vi.fn()
        .mockResolvedValueOnce(session('old', 'https://media/old', 'managed', 25))
        .mockResolvedValueOnce(session('candidate', 'https://media/candidate', 'managed', 55)),
      stopPlayback: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new PlaybackSessionController({ player, backend, capabilities });
    await controller.start({ item, source, position: 25 });
    player.failUrl = 'https://media/candidate';

    await expect(controller.seek(55)).rejects.toThrow('candidate cannot play');
    expect(backend.stopPlayback).toHaveBeenCalledWith('candidate');
    expect(backend.stopPlayback).not.toHaveBeenCalledWith('old');
    expect(player.opened.map((request) => request.url)).toEqual(['https://media/old', 'https://media/candidate', 'https://media/old']);
    expect(player.opened[2]).toMatchObject({ paused: false, startAtSeconds: 0, timelineOffsetSeconds: 25 });
  });

  it('cancels a next resolver without touching the outgoing session', async () => {
    const player = new FakePlayer();
    const backend = { startPlayback: vi.fn().mockResolvedValue(session('old', 'https://media/old')), stopPlayback: vi.fn().mockResolvedValue(undefined) };
    const controller = new PlaybackSessionController({ player, backend, capabilities });
    await controller.start({ item, source });
    let resolveNext!: (value: { item: MediaItem; source: MediaSource } | null) => void;
    const pending = controller.prepareNext(() => new Promise((resolve) => { resolveNext = resolve; }));
    controller.cancelNext();
    resolveNext({ item: { ...item, id: 'episode-2', type: 'series' }, source });
    await pending;

    expect(backend.startPlayback).toHaveBeenCalledTimes(1);
    expect(player.opened).toHaveLength(1);
    expect(controller.snapshot.state).toBe('playing');
  });

  it('does not reopen the outgoing session after stop invalidates an opened next candidate', async () => {
    const player = new FakePlayer();
    const backend = {
      startPlayback: vi.fn()
        .mockResolvedValueOnce(session('old', 'https://media/old'))
        .mockResolvedValueOnce(session('next', 'https://media/next')),
      stopPlayback: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new PlaybackSessionController({ player, backend, capabilities });
    await controller.start({ item, source });

    let releaseCandidate!: () => void;
    let markCandidateOpened!: () => void;
    const candidateOpened = new Promise<void>((resolve) => { releaseCandidate = resolve; });
    const candidateWasOpened = new Promise<void>((resolve) => { markCandidateOpened = resolve; });
    vi.spyOn(player, 'open').mockImplementation(async (request) => {
      player.opened.push(request);
      if (request.url === 'https://media/next') {
        markCandidateOpened();
        await candidateOpened;
      }
    });

    const pending = controller.prepareNext(async () => ({ item: { ...item, id: 'episode-2', type: 'series' }, source }));
    await candidateWasOpened;
    const stopping = controller.stop();
    releaseCandidate();
    await Promise.all([pending, stopping]);

    expect(player.opened.map((request) => request.url)).toEqual(['https://media/old', 'https://media/next']);
    expect(controller.snapshot).toMatchObject({ state: 'stopped', active: null });
  });
});
