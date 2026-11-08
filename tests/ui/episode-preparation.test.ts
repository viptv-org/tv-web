import { afterEach, expect, it, vi } from 'vitest';
import { EpisodePreparation, sourceStartIds, type PreparedEpisode } from '../../src/tv-solid/remote/episode-preparation';
import type { Card } from '../../src/tv-solid/remote/types';
const card: Card = { identity: { kind: 'series', id: 'episode-1', ids: [], episode: { order: 'aired', season: 1, episode: 1 } }, parent_identity: { kind: 'series', id: 'series', ids: [] }, provider_id: 'meta', title: 'One', badges: [] };
const next: Card = { ...card, identity: { ...card.identity, id: 'episode-2', episode: { order: 'aired', season: 1, episode: 2 } } };
function setup() {
 const resolve = vi.fn(async () => ({ status: 'Next', item: next }));
 const discover = vi.fn(async (): Promise<Omit<PreparedEpisode,'created'>> => ({ card: next, action: { card: next, source_selection: 'ask' } as any, page: { quality_filters: [], total: 1, streams: [{ id: 'fresh' }], best_match_id: 'fresh', best_match_fully_matches: true, automatic_source_ids: ['fresh'] }, ids: ['fresh'], memory: false }));
 let now=1000;
 const preparation = new EpisodePreparation(resolve, discover, vi.fn(), () => now);
 const scope = new AbortController();preparation.configure('context',card,scope.signal);
 return { preparation, resolve, discover, scope, advance: (ms:number) => { now+=ms; } };
}
afterEach(() => vi.useRealTimers());
it('coalesces lookahead, prepares without playback, consumes once and respects TTL', async () => {
 const { preparation:p, resolve, discover, advance }=setup();
 await Promise.all([p.refresh(),p.refresh()]);expect(resolve).toHaveBeenCalledOnce();
 await Promise.all([p.prepare(),p.prepare()]);expect(discover).toHaveBeenCalledOnce();
 expect(p.take(next)?.ids).toEqual(['fresh']);expect(p.take(next)).toBeUndefined();
 const second=setup();await second.preparation.refresh();await second.preparation.prepare();second.advance(900001);expect(second.preparation.take(next)).toBeUndefined();
 advance(900001);expect(p.take(next)).toBeUndefined();
});
it('invalidates discovery on scope changes and fences even ports ignoring cancellation', async () => {
 const { preparation:p,discover,scope }=setup();
 let finish!:(value:any)=>void;discover.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 await p.refresh();const flight=p.prepare();await Promise.resolve();await Promise.resolve();
 scope.abort();finish({card:next,action:{card:next},page:{streams:[{id:'stale'}]},ids:['stale'],memory:false});await flight;
 expect(p.state).toEqual({status:'idle',preparing:false});expect(p.take(next)).toBeUndefined();
});
it('removes a prepared successor if fresh metadata withdraws it and never guesses finales', async () => {
 const { preparation:p,resolve }=setup();await p.refresh();await p.prepare();
 resolve.mockResolvedValueOnce({status:'CaughtUp',item:undefined as any});await p.refresh();
 expect(p.state.status).toBe('none');expect(p.state.item).toBeUndefined();expect(p.take(next)).toBeUndefined();
});
it('requires server reuse IDs for memory, never substitutes an unrelated best match', () => {
 const page={quality_filters:[],total:1,streams:[{id:'wrong-language'}],best_match_id:'wrong-language',automatic_source_ids:['wrong-language']};
 expect(sourceStartIds(page,true)).toEqual([]);
 expect(sourceStartIds({...page,source_reuse_supported:true,source_reuse_ids:[]},true)).toEqual([]);
 expect(sourceStartIds({...page,source_reuse_supported:true,source_reuse_ids:['same-language']},true)).toEqual(['same-language']);
 expect(sourceStartIds(page,false)).toEqual(['wrong-language']);
});
it('bounds ignored network requests to 45 seconds and permits normal foreground recovery', async () => {
 vi.useFakeTimers();const { preparation:p, resolve }=setup();resolve.mockImplementationOnce(()=>new Promise(()=>{}));
 const flight=p.refresh();await vi.advanceTimersByTimeAsync(45001);await flight;
 expect(p.state.status).toBe('error');await p.refresh();expect(p.state.item).toEqual(next);
});
it('keeps pending metadata retryable instead of treating it as a finale',async()=>{
 const {preparation:p,resolve}=setup();resolve.mockResolvedValueOnce({status:'Pending',item:undefined as any});
 await p.refresh();expect(p.state.status).toBe('loading');expect(p.state.item).toBeUndefined();
 await p.refresh();expect(p.state.status).toBe('ready');expect(p.state.item).toEqual(next);
});
