import { expect, it } from 'vitest';
import { createSourceStartPosition, savedPosition } from '../../src/tv-solid/remote/resume-position';
import type { Card, TitleAction } from '../../src/tv-solid/remote/types';

const card: Card = { identity: { kind: 'movie', id: 'movie', ids: [] }, provider_id: 'fixture', title: 'Movie', badges: [],
  progress: .3, metadata: { runtime_minutes: 2, genres: [] },
  view: { saved: false, preview: { background: null, caption: null, progress: .3, action: 'play', resume_position_millis: 20_000 } } };
const action: TitleAction = { card, label: 'Resume at 0:30', resume: true, source_selection: 'ask', resume_position_millis: 30_000 };

it('replaces cached Home time with the fresh saved position, not metadata runtime', () => {
  const position = createSourceStartPosition(); position.begin(card, false);
  expect(position.current()).toBe(20);
  position.adopt(action); expect(position.current()).toBe(30);
  expect(position.authoritative()).toBe(true);
});
it('keeps explicit seeks and restart at their requested positions', () => {
  const position = createSourceStartPosition(); position.begin(card, false, 12.75);
  position.adopt(action); expect(position.current()).toBe(12.75);
  position.begin(card, true); position.adopt(action); expect(position.current()).toBe(0);
  expect(position.authoritative()).toBe(true);
  position.begin(card, false, 0); position.adopt(action);
  expect(position.current()).toBe(0); expect(position.authoritative()).toBe(true);
});
it('clears cached resume when the fresh server action is Play or has no position', () => {
  const position = createSourceStartPosition(); position.begin(card, false);
  position.adopt({ ...action, resume: false }); expect(position.current()).toBe(0);
  position.begin(card, false); position.adopt({ ...action, resume_position_millis: null }); expect(position.current()).toBe(0);
  expect(position.authoritative()).toBe(true);
});
it('keeps the old admission fallback only when the server lacks the new clock field', () => {
  const position = createSourceStartPosition(); position.begin({ ...card, view: undefined }, false);
  expect(position.current()).toBe(36);
  position.adopt({ ...action, resume_position_millis: undefined }); expect(position.current()).toBe(36);
  expect(position.authoritative()).toBe(false);
});
it.each([null, undefined, -1, NaN, Infinity, 1.5, 9007199254740992])('rejects an invalid saved millisecond clock (%s)', value => {
  expect(savedPosition(value)).toBeUndefined();
});
it('retains subsecond saved position for admission', () => {
  expect(savedPosition(1250)).toBe(1.25);
});
