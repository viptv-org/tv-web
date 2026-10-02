import { describe,it,expect,vi } from "vitest";
import type {Catalog,MediaItem,TvApi} from "../../src/api";
import {emptyHome} from "../../src/tv-solid/homeModel";
import {HomeShelfCache,homeRowWindow} from "../../src/tv-solid/homeShelfCache";
const item={id:"item",type:"movie",name:"Title",title:"Title",genres:[],episodes:[],raw:{}} as MediaItem;
const catalogs=Array.from({length:100},(_,i)=>({id:`catalog-${i}`,type:"movie",name:`Catalog ${i}`,extras:[],genres:[],raw:{}} as unknown as Catalog));
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture(discover=vi.fn(async()=>({items:[item]}))) {
 const api={discover,live:vi.fn(async()=>({channels:[{...item,type:"live"}]}))};
 const publish=vi.fn();const cache=new HomeShelfCache(api as unknown as TvApi,catalogs,{...emptyHome,queueItems:[item]},publish);
 return {cache,api,publish,keys:cache.snapshot().map(row=>row.key)};
}
describe("bounded Home demand",()=>{
 it("does not sweep 100 catalogs at startup and keeps only five row payloads after traversal",async()=>{
  const {cache,api,keys}=fixture();expect(api.discover).not.toHaveBeenCalled();
  cache.setWindow(keys.slice(0,2),keys.slice(0,2));await flush();expect(api.discover).not.toHaveBeenCalled();
  for(let row=2;row<25;row++){
   cache.setWindow(keys.slice(row-1,row+3),keys.slice(row-2,row+3));await flush();
   expect(cache.snapshot().filter(row=>row.cards.length).length).toBeLessThanOrEqual(5);
  }
  expect(cache.snapshot()[2].cards).toEqual([]);
  const before=api.discover.mock.calls.length;
  cache.setWindow(keys.slice(2,4),keys.slice(1,4));await flush();
  expect(api.discover.mock.calls.length).toBeGreaterThan(before);
  expect(api.discover.mock.calls.length).toBeLessThan(35);cache.dispose();
 });
 it("limits concurrency to two, publishes fast rows independently and cancels obsolete work",async()=>{
  const pending:{signal:AbortSignal;resolve:(result:{items:MediaItem[]})=>void}[]=[];
  const discover=vi.fn((_request:unknown,{signal}:{signal:AbortSignal})=>new Promise<{items:MediaItem[]}>((resolve,reject)=>{
   pending.push({signal,resolve});signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')));
  }));
  const {cache,keys}=fixture(discover as never);
  cache.setWindow(keys.slice(2,5),keys.slice(2,5));expect(pending).toHaveLength(2);
  pending[1].resolve({items:[item]});await flush();expect(pending).toHaveLength(3);
  expect(cache.snapshot()[3].cards).toHaveLength(1);
  cache.setWindow(keys.slice(10,12),keys.slice(10,12));await flush();
  expect(pending[0].signal.aborted).toBe(true);expect(pending[2].signal.aborted).toBe(true);
  pending[0].resolve({items:[item]});await flush();expect(cache.snapshot()[2].cards).toHaveLength(0);
  cache.dispose();expect(pending.filter((_,index)=>index!==1).every(request=>request.signal.aborted)).toBe(true);
 });
 it("stops background work on pause and suppresses late publication after disposal",async()=>{
  let finish!:(value:{items:MediaItem[]})=>void;
  const {cache,keys,publish,api}=fixture(vi.fn(()=>new Promise(resolve=>{finish=resolve;})) as never);
  cache.setWindow([keys[2]],[keys[2]]);cache.pause();cache.dispose();const count=publish.mock.calls.length;
  finish({items:[item]});await flush();expect(publish).toHaveBeenCalledTimes(count);expect(api.discover).toHaveBeenCalledTimes(1);
 });
 it("does not retry errors or sweep empty catalogs without new demand",async()=>{
  const {cache,keys,api}=fixture(vi.fn(async()=>({items:[]})));
  cache.setWindow([keys[2]],[keys[2]]);await flush();expect(api.discover).toHaveBeenCalledTimes(1);
  cache.setWindow([keys[2]],[keys[2]]);await flush();expect(api.discover).toHaveBeenCalledTimes(1);
  const failed=fixture(vi.fn(async()=>{throw new Error('Offline');}) as never);
  failed.cache.setWindow([failed.keys[2]],[failed.keys[2]]);await flush();
  failed.cache.setWindow([failed.keys[2]],[failed.keys[2]]);await flush();expect(failed.api.discover).toHaveBeenCalledTimes(1);
  failed.cache.retry(failed.keys[2]);await flush();expect(failed.api.discover).toHaveBeenCalledTimes(2);failed.cache.dispose();cache.dispose();
 });
 it("keeps queue edits after eviction and removes empty profile shelves",async()=>{
  const {cache,keys}=fixture();cache.setWindow([keys[0]],[keys[0]]);await flush();
  cache.setWindow(keys.slice(10,12),keys.slice(10,12));await flush();
  const edited={...item,id:"edited",name:"Updated"};cache.updateProfile({...emptyHome,queueItems:[edited]});
  cache.setWindow([keys[0]],[keys[0]]);await flush();expect(cache.snapshot()[0].cards[0].id).toBe("edited");
  cache.updateProfile(emptyHome);expect(cache.snapshot().some(row=>row.key==="continue")).toBe(false);cache.dispose();
 });
 it("reconciles catalog changes by key without blanking surviving loaded shelves",async()=>{
  const {cache,keys,api}=fixture();
  cache.setWindow([keys[2]],[keys[2]]);await flush();
  const loaded=cache.snapshot().find(row=>row.key===keys[2])!;
  expect(loaded.cards).toHaveLength(1);
  const added={...catalogs[3],id:"new-catalog",name:"New catalog"};
  cache.setCatalogs([catalogs[0],catalogs[2],added]);
  expect(cache.snapshot().find(row=>row.key===keys[2])?.cards).toEqual(loaded.cards);
  expect(cache.snapshot().some(row=>row.key===keys[3])).toBe(false);
  expect(cache.snapshot().some(row=>row.key.endsWith(":new-catalog"))).toBe(true);
  const before=api.discover.mock.calls.length;
  cache.setCatalogs([catalogs[0],catalogs[2],added],true);
  expect(cache.snapshot().find(row=>row.key===keys[2])?.cards).toEqual(loaded.cards);
  await flush();expect(api.discover.mock.calls.length).toBeGreaterThan(before);
  cache.setCatalogs([{...catalogs[0],name:"Changed configuration"},catalogs[2],added]);
  expect(cache.snapshot().find(row=>row.key===keys[2])?.cards).toEqual([]);
  cache.dispose();
 });
 it("drops a late old-catalog response after the same key changes configuration",async()=>{
  let finish!:(value:{items:MediaItem[]})=>void;
  const discover=vi.fn(()=>new Promise<{items:MediaItem[]}>(resolve=>{finish=resolve;}));
  const {cache,keys}=fixture(discover as never);
  cache.setWindow([keys[2]],[keys[2]]);
  const old=finish;
  cache.setCatalogs([{...catalogs[0],name:"Updated catalog"},...catalogs.slice(1)]);
  old({items:[item]});await flush();
  expect(cache.snapshot().find(row=>row.key===keys[2])?.cards).toEqual([]);
  cache.dispose();
 });
 it("waits for demanded catalog refresh and retries failed content on the next revision check",async()=>{
  let fail=true;
  const discover=vi.fn(async()=>{if(fail)throw new Error("Unavailable");return {items:[item]};});
  const {cache,keys}=fixture(discover as never);
  cache.setWindow([keys[2]],[keys[2]]);
  await expect(cache.waitForDemandedCatalogs(new AbortController().signal)).rejects.toThrow("incomplete");
  expect(cache.snapshot().find(row=>row.key===keys[2])?.error).toBeTruthy();
  fail=false;
  cache.setCatalogs(catalogs,true);
  await expect(cache.waitForDemandedCatalogs(new AbortController().signal)).resolves.toBeUndefined();
  expect(cache.snapshot().find(row=>row.key===keys[2])?.cards).toHaveLength(1);
  expect(discover).toHaveBeenCalledTimes(2);
  cache.dispose();
 });
 it("mounts two initial rows and no more than four visible/prefetch rows",()=>{
  expect(homeRowWindow(0,102)).toEqual({first:0,last:1,retainFirst:0});
  for(let row=1;row<100;row++){
   const w=homeRowWindow(700+(row-1)*364-54,102);expect(w.last-w.first+1).toBeLessThanOrEqual(4);expect(w.last-w.retainFirst+1).toBeLessThanOrEqual(5);
  }
 });
});
