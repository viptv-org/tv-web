import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderSubtitles } from '../../src/tv-solid/remote/player/provider-subtitles';
class Cue { constructor(public startTime: number, public endTime: number, public text: string) {} }
const hash = 'a'.repeat(64);
const candidate = { id: 'subtitle', label: 'English', language: 'en' };
const correction = { version: 1, playback_generation: 'generation', subtitle_hash: hash, media_identity: 'session', audio_identity: 'audio', algorithm_version: 'activity-offset-affine-v1', revision: 2, state: 'accepted', manual: false, correction: { anchorUs: 600e6, offsetUs: 2e6, scale: 1.001 } };
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
function fixture() {
  vi.stubGlobal('VTTCue', Cue);
  const track = { mode: 'disabled', addCue: vi.fn(), removeCue: vi.fn() };
  const video = { currentTime: 590, addTextTrack: vi.fn(() => track), load: vi.fn(), play: vi.fn(), pause: vi.fn() } as unknown as HTMLVideoElement;
  const request = vi.fn(async (path: string, method?: string) => path.endsWith('/subtitles') ? { canonical_vtt: 'WEBVTT\n\n00:10:50.000 --> 00:10:51.000\nDialogue\n', subtitle_hash: hash } : method === 'PUT' ? { ...correction, manual: true, revision: 3 } : correction);
  const captions = new ProviderSubtitles(video, request as any, '/api/playback/lease', candidate);
  return { captions, video, track, request };
}
describe('provider subtitle playback adapter', () => {
  it('applies a live affine update through one text cue without touching playback', async () => {
    const { captions, video, track } = fixture();
    await captions.attach(); await Promise.resolve();
    captions.tick(640);
    video.currentTime = 592.05; captions.tick(652.05);
    expect(track.addCue).toHaveBeenCalledTimes(1);
    expect(track.addCue.mock.calls[0][0].text).toBe('Dialogue');
    expect(track.addCue.mock.calls[0][0].startTime).toBe(592.05);
    expect(video.load).not.toHaveBeenCalled(); expect(video.play).not.toHaveBeenCalled();
    expect(video.pause).not.toHaveBeenCalled();
    await captions.manual(1);
    video.currentTime = 593.05; captions.tick(653.05);
    expect(captions.state).toBe('Manual timing');
    captions.dispose(); expect(track.mode).toBe('disabled');
  });
  it('rejects callbacks after disposal and reuses one native track for repeated selections', async () => {
    const { captions, video, request, track } = fixture();
    await captions.attach(); await Promise.resolve(); captions.dispose();
    const next = new ProviderSubtitles(video, request as any, '/api/playback/lease', candidate);
    await next.attach(); await Promise.resolve();
    expect(video.addTextTrack).toHaveBeenCalledTimes(1);
    next.dispose(); expect(track.mode).toBe('disabled');
  });
  it('keeps canonical timing when gateway automatic analysis is unavailable', async () => {
    const { captions, request, video, track } = fixture();
    request.mockImplementation(async (path: string) => path.endsWith('/subtitles') ? { canonical_vtt: 'WEBVTT\n\n00:10:50.000 --> 00:10:51.000\nDialogue\n', subtitle_hash: hash } : { ...correction, state: 'unavailable', correction: null } as any);
    await captions.attach(); await Promise.resolve();
    video.currentTime = 590.5; captions.tick(650.5);
    expect(track.addCue.mock.calls.at(-1)?.[0].text).toBe('Dialogue');
    expect(captions.state).toBe('Automatic timing unavailable'); captions.dispose();
  });
});
