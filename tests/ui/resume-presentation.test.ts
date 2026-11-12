import { createRoot } from 'solid-js';
import { expect, it } from 'vitest';
import { createDetailPresentation } from '../../src/tv-solid/remote/detail-presentation';
import type { Card, Detail, Home, TitleAction } from '../../src/tv-solid/remote/types';

const movie: Card = { identity: { kind: 'movie', id: 'movie', ids: [] }, provider_id: 'fixture', title: 'Movie', badges: [],
  metadata: { runtime_minutes: 120, genres: [] }, progress: .5 };
function saved(card: Card, position: number | null | undefined): Card {
  return { ...card, view: { saved: false, preview: { background: null, caption: null, progress: card.progress ?? null,
    action: 'play', resume_position_millis: position } } as Card['view'] };
}
function presentation(action?: TitleAction, continuing?: Card, item = movie) {
  return createRoot(dispose => {
    const home: Home = { rows: continuing ? [{ id: 'continue', title: 'Continue Watching', state: 'Ready', cards: [continuing] }] : [], complete: true, revision: 1, featured: [] };
    const detail: Detail = { item, episodes: action?.card.identity.episode ? [action.card] : [], recommendations: [], seasons: [] };
    const value = createDetailPresentation({ home: () => home, detail: () => detail, action: () => action, selected: () => item, season: () => 0 });
    const result = { label: value.label(), card: value.target()?.card, progress: value.progress() };
    dispose(); return result;
  });
}

it('uses the fresh server resume target and label instead of stale Home progress', () => {
  const current = { ...movie, progress: .1 };
  const action: TitleAction = { card: current, label: 'Resume at 0:45', resume: true, source_selection: 'ask', progress: .1, remaining_label: '99m left' };
  const result = presentation(action, saved(movie, 600_000));
  expect(result).toEqual({ label: 'Resume at 0:45', card: current, progress: .1 });
});
it('does not let cached Continue state override a fresh Play decision', () => {
  expect(presentation({ card: movie, label: 'Play', resume: false, source_selection: 'ask' }, saved(movie, 600_000)).label).toBe('Play');
});
it('retains the server-selected episode rather than an older cached episode', () => {
  const series = { ...movie, identity: { kind: 'series', id: 'series', ids: [] } };
  const episode = (season: number, number: number): Card => ({ ...series, parent_identity: series.identity,
    identity: { kind: 'series', id: `episode-${season}-${number}`, ids: [], episode: { order: 'aired', season, episode: number } } });
  const current = episode(2, 3);
  const result = presentation({ card: current, label: 'Resume at 1:02:03', resume: true, source_selection: 'ask', progress: .3 }, saved(episode(1, 1), 50_000), series);
  expect(result.card).toBe(current); expect(result.label).toBe('Resume at 1:02:03');
});
it.each([[125_000, 'Resume at 2:05'], [3_723_999, 'Resume at 1:02:03'], [500, 'Resume at 0:00']])('uses exact saved milliseconds for a pending action (%s)', (position, label) => {
  const result = presentation(undefined, saved(movie, position as number));
  expect(result.label).toBe(label);
});
it('does not need an estimated runtime to display a known saved position', () => {
  expect(presentation(undefined, saved({ ...movie, metadata: undefined, progress: null }, 60_000)).label).toBe('Resume at 1:00');
});
it.each([null, 0])('keeps Play when the server explicitly has no saved position (%s)', position => {
  expect(presentation(undefined, saved(movie, position)).label).toBe('Play');
});
it('keeps an honest legacy Resume fallback without inventing time or remaining copy', () => {
  const result = presentation(undefined, movie);
  expect(result.label).toBe('Resume');
});
