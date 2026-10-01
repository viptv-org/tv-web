import { describe, expect, it } from 'vitest';

import type { MediaItem, MediaSource, PlaybackCapabilities, PlaybackPreferences, TvApi } from '../../src/api';
import { exactResumeSource, resolveNext } from '../../src/ui/continuation';

const item: MediaItem = { id: 'movie-1', type: 'movie', name: 'Movie', title: 'Movie', genres: [], episodes: [], raw: {}, sourceAddonId: 'addon-a', sourceFingerprint: 'fingerprint-a' };
const source: MediaSource = { id: 'stream-a', name: 'Source A', sourceAddonId: 'addon-a', raw: { source_fingerprint: 'fingerprint-a' } };

describe('exactResumeSource', () => {
  it('finds Resume only by stable source identity', () => {
    expect(exactResumeSource(item, [source, { ...source, id: 'stream-b', sourceAddonId: 'other' }])).toEqual(source);
    expect(exactResumeSource({ ...item, sourceFingerprint: undefined }, [source])).toBeUndefined();
  });
});

describe('resolveNext', () => {
  const episode: MediaItem = { ...item, id: 'show-1:1:2', type: 'episode', sourceAddonId: 'addon:a' };
  const sources: MediaSource[] = [
    { id: 'hd', name: 'Show S01E02 1080p x264', sourceAddonId: 'addon:a', raw: {} },
    { id: 'uhd', name: 'Show S01E02 2160p x264', sourceAddonId: 'addon:a', raw: {} },
  ];
  const preferences: PlaybackPreferences = {
    audioLanguage: '', subtitleLanguage: '', subtitlesEnabled: false, subtitleSize: 'normal',
    subtitleStyle: 'system', quality: 'auto', autoplay: true,
  };
  const api = {
    nextEpisode: async () => ({ status: 'next', item: episode }),
    sources: async () => ({ id: 'discovery' }),
    pollSourcesStep: async () => ({ done: true, sources, state: { after: 0, sources, polls: 1 } }),
  } as unknown as Pick<TvApi, 'nextEpisode' | 'sources' | 'pollSourcesStep'>;
  const device = (maxHeight: number): PlaybackCapabilities => ({
    maxWidth: Math.round(maxHeight * 16 / 9), maxHeight, h264: true, hevc: true, aac: true, directPlay: true, hevcSdr: true,
  });

  it('ranks the next source against the measured device, not a fixed 1080p profile', async () => {
    const uhd = await resolveNext(api, '1', { ...item, sourceAddonId: 'addon:a' }, preferences, undefined, device(2160));
    expect(uhd?.source?.id).toBe('uhd');
    const hd = await resolveNext(api, '1', { ...item, sourceAddonId: 'addon:a' }, preferences, undefined, device(1080));
    expect(hd?.source?.id).toBe('hd');
  });
});
