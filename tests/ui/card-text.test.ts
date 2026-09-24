import { describe, expect, it } from 'vitest';

import type { CardPresentation, MediaItem } from '../../src/api';
import { cardMeta, channelMonogram, continueMeta, formatClock, formatMinutes, formatRuntime, liveSubtitle, phoneContinueMeta } from '../../src/components/cards/cardText';

const base: MediaItem = { id: 'item', type: 'movie', name: 'One Night Only', title: 'One Night Only', genres: [], episodes: [], raw: {} };
const presentation: CardPresentation = { image: null, imageRole: 'none', title: 'One Night Only', subtitle: '2026 · 100 min · Action', progress: null, primaryAction: 'details', primaryActionLabel: 'Details' };

describe('card text (Home reference captions)', () => {
  it('formats resume points, minutes and catalog runtimes as drawn', () => {
    expect(formatClock(4426)).toBe('73:46');
    expect(formatClock(4)).toBe('0:04');
    expect(formatMinutes(42)).toBe('42 min');
    expect(formatMinutes(65)).toBe('1 h 05 min');
    expect(formatRuntime('100 min')).toBe('1 h 40 min');
    expect(formatRuntime('52 min')).toBe('52 min');
    expect(formatRuntime('2h 3m')).toBe('2h 3m');
    expect(formatRuntime(undefined)).toBe('');
  });

  it('captions continue-watching cards for titles, episodes and queue states', () => {
    expect(continueMeta({ ...base, position: 4426, duration: 6000 }, presentation)).toBe('Resume from 73:46');
    const episode: MediaItem = { ...base, type: 'episode', name: 'Lanterns', season: 1, episode: 1, episodeTitle: 'Pilot', position: 343 };
    expect(continueMeta(episode, presentation)).toBe('S1 E1 · Pilot · 5:43');
    expect(continueMeta({ ...episode, queueStatus: 'next', position: 0 }, presentation)).toBe('S1 E1 · Pilot · Up next');
    expect(continueMeta({ ...base, position: 0 }, presentation)).toBe('2026 · 100 min · Action');
    expect(phoneContinueMeta({ ...base, year: 2026, position: 3000, duration: 5520 })).toBe('2026 · 42 min left');
    expect(phoneContinueMeta({ ...base, year: 2026, position: 60, duration: 3960 })).toBe('2026 · 1 h 05 min left');
  });

  it('keeps catalog meta to the year or the episode', () => {
    expect(cardMeta({ ...base, year: 2026 })).toBe('2026');
    expect(cardMeta({ ...base, type: 'episode', season: 4, episode: 15 })).toBe('S4 E15');
    expect(cardMeta({ ...base, type: 'live' })).toBe('');
  });

  it('draws channel monograms and live subtitles from the channel data', () => {
    expect(channelMonogram('Cartoon Network')).toBe('CN');
    expect(channelMonogram('Comedy Central')).toBe('CC');
    expect(channelMonogram('SYFY')).toBe('SYFY');
    expect(channelMonogram('CNBC')).toBe('CNBC');
    expect(channelMonogram('ABC News Live')).toBe('ABC');
    expect(channelMonogram('The Weather Channel')).toBe('WC');
    expect(channelMonogram('')).toBe('');
    const live: MediaItem = { ...base, type: 'live', name: 'Cartoon Network' };
    expect(liveSubtitle({ ...live, description: 'West' })).toBe('West');
    expect(liveSubtitle({ ...live, raw: { section: 'entertainment' } })).toBe('Entertainment');
    expect(liveSubtitle({ ...(live as MediaItem & { category: string }), category: 'news' })).toBe('News');
  });
});
