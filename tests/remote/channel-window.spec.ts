import {test,expect,type Page} from '@playwright/test';
import {installRemoteBackend} from '../preview/remote-backend';
const state=(page:Page)=>page.locator('html');
const metrics=(page:Page)=>page.evaluate(()=>(window as any).__viptvRemoteMetrics());
async function open(page:Page,searching:boolean){
 await page.goto('/tv/?platform=vizio&focusdebug=1&perfdebug=1');await expect(state(page)).toHaveAttribute('data-tv-ready','true');
 await page.keyboard.press('ArrowUp');
 if(searching)await page.keyboard.press('ArrowLeft');else for(let i=0;i<3;i++)await page.keyboard.press('ArrowRight');
 await page.keyboard.press('Enter');
 if(searching){await page.keyboard.press('a');await expect(state(page)).toHaveAttribute('data-tv-ready','true');for(let i=0;i<6;i++)await page.keyboard.press('ArrowRight');}
 await expect(state(page)).toHaveAttribute('data-tv-channel-id','channel-0');
}
async function walk(page:Page,searching:boolean,from:number,to:number){
 const step=to>from?1:-1,key=searching?(step>0?'ArrowRight':'ArrowLeft'):(step>0?'ArrowDown':'ArrowUp');
 for(let i=from+step;step>0?i<=to:i>=to;i+=step){await page.keyboard.press(key);await expect(state(page)).toHaveAttribute('data-tv-channel-id',`channel-${i}`);}
}
for(const searching of [false,true]){
 test(`${searching?'Search':'Live'} crosses seven pages and reverses with bounded payloads and exact server requests`,async({page,baseURL})=>{
  test.setTimeout(60000);
  const fixture=await installRemoteBackend(page,baseURL!,{media:true,liveChannels:241,mediaSearch:false,channelSearch:true,searchChannelCount:241,misleadingLiveCursor:true});
  const requests:Record<string,string>[]=[];page.on('request',r=>{const u=new URL(r.url());if(u.pathname.endsWith('/live/channels'))requests.push(Object.fromEntries(u.searchParams));});
  await open(page,searching);
  let peak=0;
  for(let i=1;i<=240;i++){
   await walk(page,searching,i-1,i);const m=await metrics(page);peak=Math.max(peak,m[searching?'searchPayloadChannels':'livePayloadChannels']);
   expect(m[searching?'searchPayloadPages':'livePayloadPages']).toBeLessThanOrEqual(2);expect(peak).toBeLessThanOrEqual(80);
  }
  await page.keyboard.press('Enter');await expect(state(page)).toHaveAttribute('data-tv-overlay','sources');
  expect(fixture.requests.some(r=>r.path.endsWith('/live/channel-240/sources'))).toBe(true);
  await page.keyboard.press('Enter');await expect(state(page)).toHaveAttribute('data-tv-screen','player');
  await expect.poll(()=>page.locator('video').evaluate(v=>(v as HTMLVideoElement).currentTime)).toBeGreaterThan(.2);
  await page.keyboard.press('Escape');await expect(state(page)).toHaveAttribute('data-tv-channel-id','channel-240');
  await walk(page,searching,240,0);
  expect(requests.map(r=>r.offset)).toEqual(['0','40','80','120','160','200','240','160','120','80','40','0']);
  expect(requests.slice(1).every(r=>r.limit==='40'&&r.page_size==='40')).toBe(true);
  if(searching)expect(requests.every(r=>r.search==='a')).toBe(true);
  expect(peak).toBe(80);
 });

 test(`${searching?'Search':'Live'} discards a delayed prefetch that would evict reversed focus`,async({page,baseURL})=>{
  await installRemoteBackend(page,baseURL!,{liveChannels:120,mediaSearch:false,channelSearch:true,searchChannelCount:120});
  let release!:()=>void,count=0;const gate=new Promise<void>(r=>release=r);
  await page.route('**/api/profiles/1/live/channels?**',async route=>{if(new URL(route.request().url()).searchParams.get('offset')==='80'){count++;if(count===1)await gate;}await route.fallback();});
  await open(page,searching);await walk(page,searching,0,74);await expect.poll(()=>count).toBe(1);
  await walk(page,searching,74,0);release();await page.waitForTimeout(100);
  await expect(state(page)).toHaveAttribute('data-tv-channel-id','channel-0');
  expect((await metrics(page))[searching?'searchPayloadChannels':'livePayloadChannels']).toBe(80);
  await walk(page,searching,0,80);expect(count).toBe(2);
 });

 test(`${searching?'Search':'Live'} retries a failed reverse request without losing channel focus`,async({page,baseURL})=>{
  await installRemoteBackend(page,baseURL!,{liveChannels:120,mediaSearch:false,channelSearch:true,searchChannelCount:120});
  let zeroRequests=0;
  await page.route('**/api/profiles/1/live/channels?**',async route=>{if(new URL(route.request().url()).searchParams.get('offset')==='0'&&++zeroRequests===2)return route.fulfill({status:503,json:{error:'Synthetic reverse failure'}});await route.fallback();});
  await open(page,searching);await walk(page,searching,0,119);await walk(page,searching,119,45);
  await expect.poll(()=>zeroRequests).toBe(2);
  if(searching){await page.waitForTimeout(100);await page.keyboard.press('ArrowUp');await expect(state(page)).toHaveAttribute('data-tv-focus',/^search-channel-retry:/);}
  await page.keyboard.press('Enter');await expect.poll(()=>zeroRequests).toBe(3);
  await expect(state(page)).toHaveAttribute('data-tv-channel-id','channel-45');await walk(page,searching,45,0);
 });

 test(`${searching?'Search':'Live'} refreshes the focused retained page after a revision`,async({page,baseURL})=>{
  await page.clock.install();const fixture=await installRemoteBackend(page,baseURL!,{liveChannels:120,mediaSearch:false,channelSearch:true,searchChannelCount:120});
  const offsets:string[]=[];page.on('request',r=>{const u=new URL(r.url());if(u.pathname.endsWith('/live/channels'))offsets.push(u.searchParams.get('offset')!);});
  await open(page,searching);await walk(page,searching,0,119);fixture.reviseCatalog([0]);await page.clock.fastForward(15001);
  await expect.poll(()=>offsets.at(-1)).toBe('80');await expect.poll(()=>offsets.length).toBe(4);
  await expect(state(page)).toHaveAttribute('data-tv-channel-id','channel-119');
  expect((await metrics(page))[searching?'searchPayloadPages':'livePayloadPages']).toBe(1);
 });
}
