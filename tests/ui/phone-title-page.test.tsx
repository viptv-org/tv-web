import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { MediaItem } from '../../src/api';
import { DetailScreen } from '../../src/screens/DetailScreen';

const series: MediaItem = {
  id: 'series-1',
  type: 'series',
  name: 'Monster',
  title: 'Monster',
  description: 'A true-crime anthology series.',
  year: 2022,
  genres: ['Crime', 'Drama'],
  credits: 'Starring Evan Peters, Richard Jenkins, Niecy Nash',
  episodes: [],
  raw: { certification: 'TV-MA' },
};

const episodes: readonly MediaItem[] = [
  { id: 'series-1:1:1', type: 'episode', name: 'Episode One', title: 'Episode One', season: 1, episode: 1, episodeTitle: 'Episode One', runtime: '52 min', watched: true, genres: [], episodes: [], raw: {} },
  { id: 'series-1:1:2', type: 'episode', name: 'Please Don’t Go', title: "Please Don't Go", season: 1, episode: 2, episodeTitle: 'Please Don’t Go', duration: 3120, position: 840, resumeActive: true, genres: [], episodes: [], raw: {} },
];

function renderPhoneTitle(item: MediaItem = series) {
  render(
    <DetailScreen
      responsive
      phone
      selected={item}
      presentation={undefined}
      episodes={episodes}
      season={1}
      setSeason={() => undefined}
      favorites={[]}
      play={vi.fn()}
      discoverSources={vi.fn()}
      manage={vi.fn()}
      toggle={vi.fn()}
      setModal={vi.fn()}
      onBack={() => undefined}
    />,
  );
}

describe('phone title page (M3Title)', () => {
  it('draws the board fact line with its outlined badges', () => {
    renderPhoneTitle();
    const facts = document.querySelector('.vx-title__facts')!;
    // "Series · 2022 · Crime, Drama" + the declared certification as a chip.
    expect(facts.textContent).toBe('Series·2022·Crime, DramaTV-MA');
    const badge = document.querySelector('.vx-title__badge')!;
    expect(badge.textContent).toBe('TV-MA');
    // A series carries no single runtime in the fact line; its episodes do.
    expect(facts.textContent).not.toContain('min');
  });

  it('draws a declared movie runtime in the fact line instead of a series kind', () => {
    renderPhoneTitle({ ...series, type: 'movie', episode: undefined, year: 2026, runtime: '100 min', genres: ['Action'], credits: undefined, raw: {} });
    expect(document.querySelector('.vx-title__facts')!.textContent).toBe('Movie·2026·Action·1h 40m');
    // The dictionary draws nothing for a value the metadata does not declare.
    expect(document.querySelector('.vx-title__badge')).toBeNull();
  });

  it('writes the credit line as the boards write it, without a Cast label', () => {
    renderPhoneTitle();
    expect(document.querySelector('.vx-title__credits')!.textContent).toBe('Starring Evan Peters, Richard Jenkins, Niecy Nash');
    expect(screen.queryByText('Cast')).toBeNull();
    expect(screen.queryByText('Director')).toBeNull();
  });

  it('stacks the dock as the board does: primary, then the source row, then the actions', () => {
    renderPhoneTitle();
    const dock = document.querySelector('.vx-title__dock')!;
    const order = Array.from(dock.children).map((child) => child.getAttribute('data-focus-id') ?? child.className);
    expect(order[0]).toBe('detail-play');
    expect(order[1]).toBe('detail-source');
    expect(order[2]).toBe('vx-title__actions');
  });

  it('draws the secondary actions as labelled discs', () => {
    renderPhoneTitle();
    const actions = document.querySelector('.vx-title__actions')!;
    expect(Array.from(actions.children).map((child) => child.getAttribute('data-focus-id'))).toEqual(['detail-save', 'detail-info']);
    expect(actions.textContent).toBe('My ListMore');
    expect(screen.getByRole('button', { name: 'Add to My List' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'More options' })).toBeTruthy();
    // Each action is the board's disc + label, not a bare round button.
    expect(actions.querySelectorAll('.vx-title__action-disc')).toHaveLength(2);
  });

  it('captions an episode row "1. Episode One" over its runtime and state', () => {
    renderPhoneTitle();
    const rows = document.querySelectorAll('.vx-title__episode');
    expect(rows[0]!.textContent).toContain('1. Episode One');
    expect(rows[0]!.querySelector('.vx-card__meta')!.textContent).toBe('52m · Watched');
    expect(rows[1]!.textContent).toContain('2. Please Don’t Go');
    expect(rows[1]!.querySelector('.vx-card__meta')!.textContent).toBe('52m · 38m left');
  });
});