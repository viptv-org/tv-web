import { test, expect, type Page } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';
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
  await page.route('**/api/discover?**',async route=>{
    queries.push(new URL(route.request().url()).searchParams.get('search')!);
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
  await page.route('**/api/discover?**',async route=>{
    const query=new URL(route.request().url()).searchParams.get('search');
    if(query==='a'){started=true;await held;return route.fulfill({status:503,json:{error:'Old failure'}}).catch(()=>{});}
    return route.fulfill({json:{cards:[{...fixture.card,title:'Current result'}],complete:true}});
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
  await page.route('**/api/discover?**',route=>{
    const query=new URL(route.request().url()).searchParams.get('search')!;queries.push(query);
    return query==='a'?route.fulfill({status:503,json:{error:'Search failed'}}):route.fulfill({json:{cards:fixture.cards,complete:true}});
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
  await page.keyboard.press('ArrowDown');await expect(state(page)).toHaveAttribute('data-tv-focus',/^content:5:/);
  await page.keyboard.press('ArrowLeft');await expect(state(page)).toHaveAttribute('data-tv-focus',/^keyboard:/);
});

test('channel-only Search pages server results and plays through the channel source contract',async({page,baseURL})=>{
  const fixture=await installRemoteBackend(page,baseURL!,{media:true,mediaSearch:false,channelSearch:true,searchChannelCount:70,holdNextPage:true});
  const queries:string[]=[];
  page.on('request',r=>{const u=new URL(r.url());if(u.pathname.endsWith('/live/channels'))queries.push(u.searchParams.get('search')!);});
  await search(page);await page.keyboard.press('a');
  await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  expect(fixture.requests.some(r=>r.path==='/api/discover')).toBe(false);
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
  await expect(state(page)).toHaveAttribute('data-tv-screen','search');
  await expect(state(page)).toHaveAttribute('data-tv-focus',/^search-channels:40:/);
});

test('usable channel results remain actionable when media search fails',async({page,baseURL})=>{
  const fixture=await installRemoteBackend(page,baseURL!,{channelSearch:true,searchChannelCount:3});
  await page.route('**/api/discover?**',route=>route.fulfill({status:503,json:{error:'Failed media provider'}}));
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
  await page.route('**/api/discover?**',route=>{calls++;return route.fulfill({json:{cards:fixture.cards.slice(0,calls===1?1:2),complete:calls>1}});});
  await search(page);await page.keyboard.press('a');
  await expect.poll(()=>texts(page)).toContain('Partial results');
  for(let i=0;i<6;i++)await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await expect(state(page)).toHaveAttribute('data-tv-focus',/^search-retry:/);
  await page.keyboard.press('Enter');
  await expect.poll(()=>calls).toBe(2);
  await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  await expect.poll(()=>texts(page)).not.toContain('Partial results');
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
