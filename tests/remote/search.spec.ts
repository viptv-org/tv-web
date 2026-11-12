import { test, expect, type Page } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';
const media = (cards: any[], complete = true) => ({rows:[{id:'addon:1:movie:popular',title:'Popular Movies',provider_id:'stremio',addon_id:1,state:'Ready',cards,message:complete?null:'Some search results are unavailable. Try again.'}],complete});
const state = (page: Page) => page.locator('html');
async function search(page: Page) {
  await page.goto('/tv/?platform=vizio&focusdebug=1');
  await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  for(const key of ['ArrowUp','ArrowLeft','Enter'])await page.keyboard.press(key);
  await expect(state(page)).toHaveAttribute('data-tv-screen','search');
}
async function texts(page: Page) {
  return page.evaluate(()=>{
    const values:string[]=[];
    const visit=(node:any)=>{if(node.isRenderable && node.viptvText)values.push(node.viptvText);node.children?.forEach(visit);};
    visit((window as any).__viptvRenderer.stage.root);return values;
  });
}

test('Search typing and navigation stay available while a query is pending',async({page,baseURL})=>{
  await installRemoteBackend(page,baseURL!);
  const queries:string[]=[];
  let release!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/search?**',async route=>{
    const parameters=new URL(route.request().url()).searchParams;
    queries.push(parameters.get('query')!);
    await held;await route.fulfill({status:503,json:{error:'Retired search failure'}}).catch(()=>{});
  });
  await search(page);
  await page.keyboard.press('Enter');
  await expect.poll(()=>queries).toEqual(['a']);
  await expect(state(page)).toHaveAttribute('data-tv-ready','false');
  await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
  await expect.poll(()=>queries).toEqual(['a','ab']);
  for(const key of ['ArrowUp','ArrowUp','ArrowRight','Enter'])await page.keyboard.press(key);
  await expect(state(page)).toHaveAttribute('data-tv-screen','home');
  await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  release();await page.waitForTimeout(100);
  await expect(state(page)).toHaveAttribute('data-tv-screen','home');
  expect(await texts(page)).not.toContain('Retired search failure');
});

test('a late failed query cannot replace or block the current Search results',async({page,baseURL})=>{
  const fixture=await installRemoteBackend(page,baseURL!);
  let release!:()=>void;let started=false;
  const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/search?**',async route=>{
    const query=new URL(route.request().url()).searchParams.get('query');
    if(query==='a'){started=true;await held;return route.fulfill({status:503,json:{error:'Old failure'}}).catch(()=>{});}
    return route.fulfill({json:media([{...fixture.card,title:'Current result'}])});
  });
  await search(page);await page.keyboard.press('a');await expect.poll(()=>started).toBe(true);
  await page.keyboard.press('b');await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  release();await page.waitForTimeout(100);
  for(let i=0;i<6;i++)await page.keyboard.press('ArrowRight');
  await expect(state(page)).toHaveAttribute('data-tv-focus',/^content:0:/);
  await expect.poll(()=>texts(page)).toContain('Current result');
  expect(await texts(page)).not.toContain('Old failure');
});

test('Search errors remain editable and the query limit cannot strand loading',async({page,baseURL})=>{
  const fixture=await installRemoteBackend(page,baseURL!);
  const queries:string[]=[];
  await page.route('**/api/search?**',route=>{
    const query=new URL(route.request().url()).searchParams.get('query')!;queries.push(query);
    return query==='a'?route.fulfill({status:503,json:{error:'Search failed'}}):route.fulfill({json:media(fixture.cards)});
  });
  await search(page);await page.keyboard.press('Enter');
  await expect.poll(()=>texts(page)).toContain('Couldn’t connect. Try again.');
  await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
  await expect.poll(()=>queries.at(-1)).toBe('ab');
  await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  await page.keyboard.type('x'.repeat(260));
  await expect.poll(()=>queries.at(-1)?.length).toBe(256);
  await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  expect(await texts(page)).not.toContain('Couldn’t connect. Try again.');
});

test('Search uses reference keyboard and five-column artwork bounds with one focus',async({page,baseURL})=>{
  await installRemoteBackend(page,baseURL!);await search(page);
  await page.keyboard.type('the w');await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  const bounds=()=>page.evaluate(()=>{
    const boxes:{x:number;y:number;w:number;h:number}[]=[];
    const visit=(n:any)=>{if(n.isRenderable)boxes.push({x:n.absX,y:n.absY,w:n.props.w,h:n.props.h});n.children?.forEach(visit);};
    visit((window as any).__viptvRenderer.stage.root);return boxes;
  });
  for(const expected of [{x:96,y:140,w:520,h:72},{x:96,y:236,w:254,h:68},{x:360,y:236,w:254,h:68},{x:96,y:312,w:80,h:68},...Array.from({length:5},(_,i)=>({x:700+i*228,y:196,w:212,h:318}))])
    await expect.poll(async()=> (await bounds()).some(actual=>Object.keys(expected).every(key=>Math.abs(actual[key as keyof typeof actual]-expected[key as keyof typeof expected])<.5)),{message:JSON.stringify(expected)}).toBe(true);
  for(let i=0;i<6;i++)await page.keyboard.press('ArrowRight');
  await expect(state(page)).toHaveAttribute('data-tv-focus',/^content:0:/);
  for(let i=0;i<5;i++)await page.keyboard.press('ArrowRight');await expect(state(page)).toHaveAttribute('data-tv-focus',/^content:5:/);
  for(let i=0;i<6;i++)await page.keyboard.press('ArrowLeft');await expect(state(page)).toHaveAttribute('data-tv-focus',/^keyboard:/);
});

test('channel-only Search pages server results and plays through the channel source contract',async({page,baseURL})=>{
  const fixture=await installRemoteBackend(page,baseURL!,{media:true,mediaSearch:false,channelSearch:true,searchChannelCount:70,holdNextPage:true});
  const queries:string[]=[];
  page.on('request',r=>{const u=new URL(r.url());if(u.pathname.endsWith('/live/channels'))queries.push(u.searchParams.get('search')!);});
  await search(page);await page.keyboard.press('a');
  await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  expect(fixture.requests.some(r=>r.path==='/api/search')).toBe(false);
  expect(await texts(page)).not.toContain('Top results');
  for(let i=0;i<6;i++)await page.keyboard.press('ArrowRight');
  await expect(state(page)).toHaveAttribute('data-tv-focus',/^search-channels:0:/);
  for(let i=0;i<40;i++)await page.keyboard.press('ArrowRight');
  await expect(state(page)).toHaveAttribute('data-tv-focus',/^search-channels:39:/);
  fixture.releasePages();
  await expect(state(page)).toHaveAttribute('data-tv-focus',/^search-channels:40:/);
  expect(queries).toEqual(['a','a']);
  await page.keyboard.press('Enter');
  await expect(state(page)).toHaveAttribute('data-tv-sources','2');
  expect(fixture.requests.some(r=>r.path.endsWith('/live/channel-40/sources'))).toBe(true);
  expect(fixture.requests.some(r=>r.path==='/api/streams'||r.path.startsWith('/api/meta/'))).toBe(false);
  await page.keyboard.press('Enter');
  await expect.poll(()=>page.locator('video').evaluate(v=>(v as HTMLVideoElement).currentTime)).toBeGreaterThan(.2);
  await page.keyboard.press('Escape');
  await expect(state(page)).toHaveAttribute('data-tv-player-controls','false');
  await page.keyboard.press('Escape');
  await expect(state(page)).toHaveAttribute('data-tv-screen','search');
  await expect(state(page)).toHaveAttribute('data-tv-focus',/^search-channels:40:/);
});

test('usable channel results remain actionable when media search fails',async({page,baseURL})=>{
  const fixture=await installRemoteBackend(page,baseURL!,{channelSearch:true,searchChannelCount:3});
  await page.route('**/api/search?**',route=>route.fulfill({status:503,json:{error:'Failed media provider'}}));
  await search(page);await page.keyboard.press('a');
  await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  await expect.poll(()=>texts(page)).toContain('Couldn’t connect. Try again.');
  for(let i=0;i<6;i++)await page.keyboard.press('ArrowRight');
  await expect(state(page)).toHaveAttribute('data-tv-focus',/^search-channels:0:/);
  await page.keyboard.press('ArrowUp');
  await expect(state(page)).toHaveAttribute('data-tv-focus',/^search-retry:/);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(state(page)).toHaveAttribute('data-tv-overlay','sources');
  expect(fixture.requests.some(r=>r.path.endsWith('/live/channel-0/sources'))).toBe(true);
});

test('channel search is not inferred from the Live navigation entry',async({page,baseURL})=>{
  const fixture=await installRemoteBackend(page,baseURL!,{channelSearch:false});
  await search(page);await page.keyboard.press('a');
  await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  expect(fixture.requests.some(r=>r.path.endsWith('/live/channels'))).toBe(false);
  expect(await texts(page)).not.toContain('Channels');
});

test('partial media results retain a reachable retry and adopt the confirmed replacement',async({page,baseURL})=>{
  const fixture=await installRemoteBackend(page,baseURL!);let calls=0;
  await page.route('**/api/search?**',route=>{calls++;return route.fulfill({json:media(fixture.cards.slice(0,calls===1?1:2),calls>1)});});
  await search(page);await page.keyboard.press('a');
  await expect.poll(()=>texts(page)).toContain('Some search results are unavailable. Try again.');
  for(let i=0;i<6;i++)await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await expect(state(page)).toHaveAttribute('data-tv-focus',/^search-retry:/);
  await page.keyboard.press('Enter');
  await expect.poll(()=>calls).toBe(2);
  await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  await expect.poll(()=>texts(page)).not.toContain('Some search results are unavailable. Try again.');
});

test('Search remains usable when the platform lacks native canvas letter spacing',async({page,baseURL})=>{
  await page.addInitScript(()=>{Reflect.deleteProperty(CanvasRenderingContext2D.prototype,'letterSpacing');});
  await installRemoteBackend(page,baseURL!,{channelSearch:true});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await search(page);await page.keyboard.press('a');
  await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  expect(await page.evaluate(()=> 'letterSpacing' in document.createElement('canvas').getContext('2d')!)).toBe(false);
  await expect.poll(()=>texts(page)).toContain('Fixture channel 0');
  expect(errors).toEqual([]);
});

test('authentication loss during channel paging retires the Search profile',async({page,baseURL})=>{
  await installRemoteBackend(page,baseURL!,{mediaSearch:false,channelSearch:true,searchChannelCount:70});
  await page.route('**/api/profiles/1/live/channels?**',route=>new URL(route.request().url()).searchParams.get('offset')==='40'
    ? route.fulfill({status:401,json:{error:'unauthorized'}}) : route.fallback());
  await page.route('**/api/auth/device/refresh',route=>route.fulfill({status:401,json:{error:'unauthorized'}}));
  await search(page);await page.keyboard.press('a');
  await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  for(let i=0;i<6;i++)await page.keyboard.press('ArrowRight');
  await expect(state(page)).toHaveAttribute('data-tv-focus',/^search-channels:0:/);
  for(let i=0;i<35;i++)await page.keyboard.press('ArrowRight');
  await expect(state(page)).toHaveAttribute('data-tv-screen','welcome');
});

for(const canvas of [false,true]) test(`server catalog/provider/type rows keep duplicate titles, order, failure isolation and per-row return focus (${canvas?'Canvas':'WebGL'})`,async({page,baseURL},testInfo)=>{
  if(canvas)await page.addInitScript(()=>{Object.defineProperty(window,'Worker',{configurable:true,value:undefined});const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:any[]){return type.includes('webgl')?null:original.apply(this,[type,...args] as any);} as typeof original;});
  const fixture=await installRemoteBackend(page,baseURL!);
  const card=(kind:string,provider:string,id:string,title:string)=>({...fixture.card,provider_id:provider,identity:{kind,id,ids:[]},title});
  const rows=[
    {id:'simkl:movie',title:'Movies · Simkl',provider_id:'simkl',state:'Failed',cards:[],message:'Some search results are unavailable. Try again.'},
    {id:'addon:101:movie:top',title:'Popular Movies · Fixture 101',provider_id:'stremio',addon_id:101,state:'Ready',cards:Array.from({length:9},(_,i)=>card('movie','addon:101',`same-${i}`,`Shared title ${i}`))},
    {id:'addon:101:series:top',title:'Popular Series · Fixture 101',provider_id:'stremio',addon_id:101,state:'Ready',cards:[card('series','addon:101','same-0','Shared title 0')]},
    {id:'addon:101:movie:year',title:'New Movies',provider_id:'stremio',addon_id:101,state:'Empty',cards:[]},
    {id:'addon:102:movie:top',title:'Popular Movies · Fixture 102',provider_id:'stremio',addon_id:102,state:'Ready',cards:[card('movie','addon:102','same-0','Shared title 0')]},
  ];
  let calls=0;
  await page.route('**/api/search?**',route=>{calls++;return route.fulfill({json:{rows,complete:false}});});
  await search(page);await page.keyboard.press('a');
  await expect.poll(()=>texts(page)).toContain('Popular Movies · Fixture 101');
  await expect(state(page)).toHaveAttribute('data-tv-search-rows','5');
  await page.screenshot({path:testInfo.outputPath('grouped-search-failed-provider.png')});
  await expect(state(page)).toHaveAttribute('data-tv-search-row','simkl:movie');
  for(let i=0;i<6;i++)await page.keyboard.press('ArrowRight');
  await expect(state(page)).toHaveAttribute('data-tv-focus',/^search-retry:/);
  await page.keyboard.press('ArrowDown');
  await expect(state(page)).toHaveAttribute('data-tv-search-row','addon:101:movie:top');
  for(let i=0;i<7;i++)await page.keyboard.press('ArrowRight');
  await expect(state(page)).toHaveAttribute('data-tv-focus',/^content:7:/);
  if(canvas) {
    await expect(state(page)).toHaveAttribute('data-renderer-backend','canvas');
    const paint=()=>page.evaluate(()=>{
      const canvas=document.querySelector('#app canvas') as HTMLCanvasElement;
      const context=canvas.getContext('2d')!,scale=canvas.width/1920;
      const bright=(x:number,y:number,w:number,h:number)=>{
        const data=context.getImageData(Math.round(x*scale),Math.round(y*scale),Math.round(w*scale),Math.round(h*scale)).data;
        let count=0;for(let i=0;i<data.length;i+=4)if(data[i]>220&&data[i+1]>220&&data[i+2]>220)count++;
        return count/(scale*scale);
      };
      const edge=(x:number)=>bright(x,196,212,3)+bright(x,196,3,318);
      return {captions:Array.from({length:5},(_,i)=>bright(700+i*228,528,212,34)),focus:edge(1612)-edge(1384)};
    });
    await expect.poll(async()=>{const facts=await paint();return facts.captions.every(count=>count>40)&&facts.focus>500;}).toBe(true);
    await testInfo.attach('grouped-search-pixels',{body:JSON.stringify(await paint()),contentType:'application/json'});
  }
  await page.screenshot({path:testInfo.outputPath('grouped-search-movies-and-series.png')});
  await page.keyboard.press('ArrowDown');
  await expect(state(page)).toHaveAttribute('data-tv-search-row','addon:101:series:top');
  await expect.poll(()=>texts(page)).toContain('Shared title 0');
  await page.keyboard.press('ArrowUp');
  await expect(state(page)).toHaveAttribute('data-tv-focus',/^content:7:/);
  for(let i=0;i<3;i++)await page.keyboard.press('ArrowDown');
  await expect(state(page)).toHaveAttribute('data-tv-search-row','addon:102:movie:top');
  const detailRequest=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/meta/movie/same-0');
  await page.keyboard.press('Enter');
  const detailParameters=new URL((await detailRequest).url()).searchParams;
  expect(detailParameters.get('provider_id')).toBe('stremio');
  expect(detailParameters.get('addon_id')).toBe('102');
  await expect(state(page)).toHaveAttribute('data-tv-screen','detail');
  const metadata=fixture.requests.find(r=>r.path==='/api/meta/movie/same-0');
  expect(metadata).toBeTruthy();
  await page.keyboard.press('Escape');
  await expect(state(page)).toHaveAttribute('data-tv-search-row','addon:102:movie:top');
  await expect(state(page)).toHaveAttribute('data-tv-focus',/^content:0:/);
  expect(calls).toBe(1);
});

test('a failed retry retains the current catalog and reports the failure beneath its heading',async({page,baseURL})=>{
  const fixture=await installRemoteBackend(page,baseURL!);let calls=0;
  await page.route('**/api/search?**',route=>++calls===1
    ?route.fulfill({json:media([{...fixture.card,title:'Retained catalog result'}],false)})
    :route.fulfill({status:503,json:{error:'unavailable'}}));
  await search(page);await page.keyboard.press('a');
  await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  for(let i=0;i<6;i++)await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');
  await expect.poll(()=>calls).toBe(2);
  await expect.poll(()=>texts(page)).toContain('Couldn’t connect. Try again.');
  await expect.poll(()=>texts(page)).toContain('Retained catalog result');
  await expect(state(page)).toHaveAttribute('data-tv-search-row','addon:1:movie:popular');
  for(let i=0;i<6;i++)await page.keyboard.press('ArrowRight');
  await expect(state(page)).toHaveAttribute('data-tv-focus',/^content:0:/);
});
