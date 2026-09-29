import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFor, response, scripted } from './client-helpers';
import type { PlaybackV2Request } from '../../vendor/core/typescript/wire';
import { normalizeCore } from '../../src/api/client-shared';

const request: PlaybackV2Request = {
  conversion: 'auto', audioLanguage: null, preferredAudioLanguage: null,
  preferredSubtitleLanguage: null, subtitlesOff: false,
  requestId: 'request_1', streamId: 'source_1', position: 12, forceGateway: false,
  audioTrack: null, subtitleTrack: null,
  client: { platform: 'web', canPlayDirect: true, maxWidth: 3840, maxHeight: 2160, videoCodecs: ['h264'], audioCodecs: ['aac'] },
};
function lease(status = 'starting', id = 'pb2_one') {
  return { id, status, expires_at: Math.floor(Date.now() / 1000) + 60, renew_after_seconds: 20,
    delivery: status === 'ready' ? { kind: 'gateway', url: 'https://gateway.example/base/media/viewer/cap/index.m3u8', format: 'hls', mode: 'remux', video_mode: 'copy', audio_mode: 'copy', position: 12, duration: 120, live: false, audio_tracks: [], subtitle_tracks: [], subtitles_supported: false } : null,
  };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('v2 backend playback control', () => {
  it('rejects unsolicited direct delivery when the request requires a gateway', async () => {
    const direct = { ...lease('ready'), delivery: { kind: 'direct', url: 'http://provider.invalid/movie.mp4', headers: {}, format: 'original', position: 0, live: false } };
    for (const input of [
      { ...request, client: { ...request.client, canPlayDirect: false } },
      { ...request, forceGateway: true },
      { ...request, conversion: 'audio' as const },
    ]) {
      const fake = scripted(response(direct), response({}));
      await expect(apiFor(fake.fetcher).startPlaybackV2(input)).rejects.toMatchObject({ code: 'invalid_playback_response' });
      expect(fake.calls.at(-1)?.init?.method).toBe('DELETE');
    }
  });
  it('does not resurrect a stopped lease when an earlier heartbeat finishes late', async () => {
    let finish!: (value: Response) => void;
    const calls: string[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push(`${init?.method} ${input}`);
      if (String(input).endsWith('/heartbeat')) return new Promise(resolve => { finish = resolve; });
      return response(init?.method === 'DELETE' ? {} : lease('ready'));
    };
    const api = apiFor(fetcher);
    await api.startPlaybackV2(request);
    const renewal = api.renewPlaybackV2('pb2_one');
    await vi.advanceTimersByTimeAsync(0);
    await api.stopPlayback('pb2_one');
    finish(response(lease('ready')));
    await renewal;
    expect(api.playbackLease('pb2_one')).toBeUndefined();
    await api.stopPlayback('pb2_one');
    expect(calls.at(-1)).toBe('DELETE https://viptv.example/api/v2/playback/pb2_one');
  });
  it('sends shared mapped conversion and preferences without a profile quality cap', async () => {
    const mapped = normalizeCore<PlaybackV2Request>('playbackV2Intent', {
      requestId: 'mapped', platform: 'tauri', preferences: { audioLanguage: 'en', quality: '1080p' },
      playback: { streamId: 'source', capabilities: { maxWidth: 3840, maxHeight: 2160, h264: true, aac: true, directUrls: true }, forceTranscode: true, conversionReason: 'audio-codec' },
    });
    const fake = scripted(response(lease('ready')));
    await apiFor(fake.fetcher).startPlaybackV2(mapped);
    const body = JSON.parse(fake.calls[0].init!.body as string);
    expect(body).toMatchObject({ conversion: 'audio', force_gateway: true, preferred_audio_language: 'en', client: { platform: 'desktop', max_height: 2160 } });
    expect(body).not.toHaveProperty('quality');
  });
  it('polls a pending lease and never sends control traffic to the media origin', async () => {
    const fake = scripted(response(lease(), 202), response(lease('ready')), response(lease('ready')), response({}));
    const api = apiFor(fake.fetcher);
    const pending = api.startPlaybackV2(request);
    await vi.advanceTimersByTimeAsync(500);
    const ready = await pending;
    expect(ready.session?.deliveryKind).toBe('gateway');
    expect(ready.session?.url).toContain('https://gateway.example/base/');
    await api.renewPlaybackV2(ready.id);
    await api.stopPlaybackV2(ready.id);
    expect(fake.calls.map(call => call.input)).toEqual([
      'https://viptv.example/api/v2/playback',
      'https://viptv.example/api/v2/playback/pb2_one',
      'https://viptv.example/api/v2/playback/pb2_one/heartbeat',
      'https://viptv.example/api/v2/playback/pb2_one',
    ]);
    expect(JSON.parse(fake.calls[0].init!.body as string)).toMatchObject({ request_id: 'request_1', stream_id: 'source_1', client: { max_height: 2160 } });
    expect(fake.calls.at(-1)?.init?.method).toBe('DELETE');
    expect(fake.calls.every(call => call.init?.redirect === 'error')).toBe(true);
  });

  it('releases a known pending lease when the caller cancels', async () => {
    const fake = scripted(response(lease(), 202), response({}));
    const abort = new AbortController();
    const pending = apiFor(fake.fetcher).startPlaybackV2(request, { signal: abort.signal });
    const failed = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(0);
    abort.abort();
    await failed;
    expect(fake.calls).toHaveLength(2);
    expect(fake.calls[1].init?.method).toBe('DELETE');
    expect(fake.calls[1].init?.signal?.aborted).toBe(false);
  });

  it.each([0, 502])('reconciles an ambiguous POST (%s) using the identical request before release', async status => {
    const calls: Array<{ path: string; body?: BodyInit | null; method?: string }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push({ path: String(input), body: init?.body, method: init?.method });
      if (calls.length === 1) {
        if (status === 0) throw new TypeError('Network failure');
        return response({ error: 'Proxy failed after upstream admission' }, status);
      }
      return response(calls.length === 2 ? lease() : {});
    };
    await expect(apiFor(fetcher).startPlaybackV2(request)).rejects.toMatchObject({ status });
    expect(calls).toHaveLength(3);
    expect(calls[1].body).toBe(calls[0].body);
    expect(calls[2].method).toBe('DELETE');
  });

  it('does not repeat a definitively refused start or dispatch malformed input', async () => {
    const fake = scripted(response({ error_code: 'gateway_required' }, 409));
    const api = apiFor(fake.fetcher);
    await expect(api.startPlaybackV2(request)).rejects.toMatchObject({ code: 'gateway_required' });
    await expect(api.startPlaybackV2({ ...request, requestId: '../invalid' })).rejects.toMatchObject({ code: 'invalid_response' });
    expect(fake.calls).toHaveLength(1);
  });

  it('reconciles cancellation before the admission response without using the cancelled signal', async () => {
    const calls: RequestInit[] = [];
    const fetcher: typeof fetch = async (_input, init) => {
      calls.push(init!);
      if (calls.length === 1) return new Promise((_resolve, reject) => {
        init!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      });
      return response(calls.length === 2 ? lease() : {});
    };
    const abort = new AbortController();
    const pending = apiFor(fetcher).startPlaybackV2(request, { signal: abort.signal });
    const failed = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(0);
    abort.abort();
    await failed;
    expect(calls).toHaveLength(3);
    expect(calls[1].body).toBe(calls[0].body);
    expect(calls[1].signal?.aborted).toBe(false);
    expect(calls[2].method).toBe('DELETE');
  });

  it('bounds ambiguous admission cleanup when the control connection remains unavailable', async () => {
    let count = 0;
    const fetcher: typeof fetch = async (_input, init) => {
      if (++count === 1) throw new TypeError('Offline');
      return new Promise((_resolve, reject) => {
        init!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      });
    };
    const failed = expect(apiFor(fetcher).startPlaybackV2(request)).rejects.toMatchObject({ code: 'network' });
    await vi.advanceTimersByTimeAsync(5_000);
    await failed;
    expect(count).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects a changed playback identity and releases only the originally owned id', async () => {
    const fake = scripted(response(lease()), response(lease('ready', 'pb2_other')), response({}));
    const pending = apiFor(fake.fetcher).startPlaybackV2(request);
    const failed = expect(pending).rejects.toMatchObject({ code: 'invalid_playback_response' });
    await vi.advanceTimersByTimeAsync(500);
    await failed;
    expect(fake.calls.at(-1)?.input).toBe('https://viptv.example/api/v2/playback/pb2_one');
    expect(fake.calls.at(-1)?.init?.method).toBe('DELETE');
  });

  it('rejects expired and terminal renewals rather than trusting a cached URL', async () => {
    const fake = scripted(response({ ...lease('ready'), expires_at: Math.floor(Date.now() / 1000) - 1 }), response({ ...lease('failed'), error_code: 'provider_connection_limit', error: 'https://provider.invalid/password' }));
    const api = apiFor(fake.fetcher);
    await expect(api.renewPlaybackV2('pb2_one')).rejects.toMatchObject({ code: 'playback_expired' });
    await expect(api.renewPlaybackV2('pb2_one')).rejects.toMatchObject({ code: 'provider_connection_limit', message: expect.stringContaining('Stop another stream') });
  });

  it('releases an admitted id even if its delivery envelope is invalid', async () => {
    const fake = scripted(response({ ...lease('ready'), delivery: { kind: 'gateway', url: 'http://insecure.invalid/private' } }), response({}));
    await expect(apiFor(fake.fetcher).startPlaybackV2(request)).rejects.toMatchObject({ code: 'invalid_response' });
    expect(fake.calls).toHaveLength(2);
    expect(fake.calls[1].init?.method).toBe('DELETE');
    expect(fake.calls[1].input).toBe('https://viptv.example/api/v2/playback/pb2_one');
  });

  it('bounds startup and releases the pending lease at the deadline', async () => {
    const calls: string[] = [];
    const fetcher: typeof fetch = async (_input, init) => { calls.push(init?.method ?? 'GET'); return response(init?.method === 'DELETE' ? {} : lease()); };
    const pending = apiFor(fetcher).startPlaybackV2(request);
    const failed = expect(pending).rejects.toMatchObject({ code: 'playback_start_timeout' });
    await vi.advanceTimersByTimeAsync(45_000);
    await failed;
    expect(calls.at(-1)).toBe('DELETE');
    expect(calls.filter(method => method === 'POST')).toHaveLength(1);
    expect(calls.length).toBeLessThanOrEqual(92);
  });
});
