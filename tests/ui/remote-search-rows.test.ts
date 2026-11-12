import { expect, it } from 'vitest';
import { searchRowFocus } from '../../src/tv-solid/remote/search/media';
import type { SearchRow } from '../../src/tv-solid/remote/types';
const row = (id: string, titles: string[]): SearchRow => ({id, title:id, provider_id:'stremio', state:'Ready', cards:titles.map(id=>({identity:{kind:'movie',id,ids:[]},provider_id:'addon:101',title:id,badges:[]}))});
it('restores focus by catalog identity and card identity without merging equal cards across rows', () => {
  const old = row('addon:101:movie:top',['same','focused']);
  const next = [row('addon:102:movie:top',['same']),row(old.id,['new','same','focused']),row('addon:101:series:top',['same'])];
  expect(searchRowFocus(next,old,1)).toEqual({row:1,column:2});
  expect(next.map(value=>value.cards[0].identity.id)).toEqual(['same','new','same']);
});
it('clamps focus if the selected catalog or card disappears', () => {
  expect(searchRowFocus([row('replacement',['one'])],row('removed',['one','two']),1)).toEqual({row:0,column:0});
  expect(searchRowFocus([],row('removed',['one']),0)).toEqual({row:0,column:0});
});
