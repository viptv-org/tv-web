import { describe, expect, it } from 'vitest';

import type { MediaItem } from '../../src/api';
import {
  phoneEpisodeHeading,
  phoneEpisodeMeta,
  titleBadgeLabels,
  titleCertification,
  titleCreditLines,
  titleKind,
  titleRuntime,
} from '../../src/screens/titleText';

const base: MediaItem = { id: 'item', type: 'movie', name: 'The End of Oak Street', title: 'The End of Oak Street', genres: [], episodes: [], raw: {} };

describe('title page text (M3Title / M3Movie)', () => {
  it('prefixes the fact line with the media kind the board draws', () => {
    expect(titleKind({ ...base, type: 'series' })).toBe('Series');
    expect(titleKind(base)).toBe('Movie');
    // An episode page and a channel carry no kind prefix on the boards.
    expect(titleKind({ ...base, type: 'episode', season: 1, episode: 1 })).toBe('');
    expect(titleKind({ ...base, type: 'live' })).toBe('');
  });

  it('draws the runtime the way the title boards do, and nothing when unknown', () => {
    expect(titleRuntime('52 min')).toBe('52m');
    expect(titleRuntime('100 min')).toBe('1h 40m');
    expect(titleRuntime('120')).toBe('2h');
    expect(titleRuntime('120 minutes')).toBe('2h');
    expect(titleRuntime('0')).toBe('');
    expect(titleRuntime(undefined)).toBe('');
    // A provider runtime that is not a minute count is already drawn text.
    expect(titleRuntime('2h 3m')).toBe('2h 3m');
    // An episode record carries a playback duration, not a catalog runtime.
    expect(titleRuntime(undefined, 3120)).toBe('52m');
    expect(titleRuntime(undefined, 38)).toBe('1m');
  });

  it('reads the declared certification from the keys the shared engine reads', () => {
    expect(titleCertification({ ...base, raw: { contentRating: 'TV-MA' } })).toBe('TV-MA');
    expect(titleCertification({ ...base, raw: { certification: 'PG-13' } })).toBe('PG-13');
    expect(titleCertification({ ...base, raw: { ageRating: 'R' } })).toBe('R');
    expect(titleCertification({ ...base, raw: { mpaaRating: ' PG ' } })).toBe('PG');
    // Declared order wins, and anything that is not declared text draws nothing.
    expect(titleCertification({ ...base, raw: { certification: 'R', contentRating: 'TV-MA' } })).toBe('TV-MA');
    expect(titleCertification({ ...base, raw: { contentRating: '  ', certification: 'PG' } })).toBe('PG');
    expect(titleCertification({ ...base, raw: { certification: { label: 'R' } } })).toBeUndefined();
    expect(titleCertification(base)).toBeUndefined();
  });

  it('puts only declared facts in the badge row', () => {
    expect(titleBadgeLabels({ ...base, raw: { certification: 'PG-13' } })).toEqual(['PG-13']);
    // "HD", "5.1", "4K" and "HDR" are server capability badges, not metadata.
    expect(titleBadgeLabels(base)).toEqual([]);
    expect(titleBadgeLabels({ ...base, sourceQuality: '1080p', sourceAudio: '5.1' })).toEqual([]);
  });

  it('captions an episode row as "1. Episode One"', () => {
    expect(phoneEpisodeHeading({ ...base, type: 'episode', season: 1, episode: 1, episodeTitle: 'Episode One' }, 0)).toBe('1. Episode One');
    expect(phoneEpisodeHeading({ ...base, type: 'episode', season: 1, episode: 3, name: 'Doin’ A Dahmer' }, 2)).toBe('3. Doin’ A Dahmer');
    // A record without an episode number falls back to its place in the season.
    expect(phoneEpisodeHeading({ ...base, type: 'episode', name: 'Pilot' }, 1)).toBe('2. Pilot');
  });

  it('captions an episode row with its runtime and its progress state', () => {
    const episode: MediaItem = { ...base, type: 'episode', season: 1, episode: 2, episodeTitle: 'Please Don’t Go' };
    expect(phoneEpisodeMeta({ ...episode, runtime: '52 min' })).toBe('52m');
    expect(phoneEpisodeMeta({ ...episode, duration: 3120 })).toBe('52m');
    expect(phoneEpisodeMeta({ ...episode, duration: 3120, position: 840, resumeActive: true })).toBe('52m · 38m left');
    expect(phoneEpisodeMeta({ ...episode, duration: 3120, position: 3120, watched: true })).toBe('52m · Watched');
    // A finished episode the profile is not resuming reads Watched, not a resume point.
    expect(phoneEpisodeMeta({ ...episode, runtime: '52 min', position: 3120, watched: true, resumeActive: false })).toBe('52m · Watched');
    // Nothing known, nothing drawn (the dictionary's "missing values draw nothing").
    expect(phoneEpisodeMeta(episode)).toBe('');
  });

  it('writes the credit line the boards write, never a Cast label', () => {
    expect(titleCreditLines({ ...base, credits: 'Starring Evan Peters, Richard Jenkins, Niecy Nash' }, [], '')).toEqual([
      'Starring Evan Peters, Richard Jenkins, Niecy Nash',
    ]);
    expect(titleCreditLines({ ...base, credits: 'Directed by Ryan Murphy\nStarring Evan Peters' }, [], '')).toEqual([
      'Directed by Ryan Murphy',
      'Starring Evan Peters',
    ]);
    expect(titleCreditLines(base, [{ name: 'Evan Peters' }, { name: 'Niecy Nash' }], '')).toEqual(['Starring Evan Peters, Niecy Nash']);
    expect(titleCreditLines(base, [{ name: 'Evan Peters' }], 'Ryan Murphy')).toEqual(['Directed by Ryan Murphy', 'Starring Evan Peters']);
    expect(titleCreditLines(base, [], '')).toEqual([]);
  });
});