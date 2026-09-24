#!/usr/bin/env node
import {chromium,expect} from '@playwright/test';
import {installBackend,installMediaStubs} from './backend.ts';
const url=process.env.SOLID_PREVIEW_URL;
if(!url?.startsWith('https://'))throw new Error('HTTPS required');
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1920,height:1080}});page.setDefaultTimeout(10000);
 const backend=await installBackend(page,{family:'tv',session:'ready',sourcesDone:true,queuePosition:42,playbackPositionFromRequest:true,playbackUniqueIds:true});
 await installMediaStubs(page,{duration:3600,position:42,frame:'63e024'});
 let release,starts=0;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/api/playback',async route=>{
   if(route.request().method()!=='POST')return route.fallback();
   if(++starts===2)await gate;
   await route.fallback();
 });
 const focus=(view,index)=>page.waitForFunction(({view,index})=>window.__viptvFocus?.view===view&&window.__viptvFocus.index===index,{view,index});
 try {
  await page.goto(`${url}?platform=vizio&focusdebug=1`);await focus('home-action',0);
  await page.keyboard.press('Enter');await focus('source-row',0);await page.keyboard.press('Enter');await focus('player-control',1);
  await page.keyboard.press('ArrowRight');await focus('player-control',2);await page.keyboard.press('Enter');
  await expect.poll(()=>starts).toBe(2);
  await page.waitForFunction(()=>window.__viptvSeek?.pending===1);
  const target=await page.evaluate(()=>window.__viptvSeek.target);expect(target).toBe(72);
  await page.evaluate(()=>{document.querySelector('video').currentTime=43;});
  expect(await page.evaluate(()=>window.__viptvSeek.displayed)).toBe(72);
  release();await page.waitForFunction(()=>window.__viptvSeek?.pending===0&&window.__viptvSeek?.target===null);
  expect(await page.evaluate(()=>window.__viptvSeek.displayed)).toBe(72);
  await expect.poll(()=>backend.requests.filter(request=>request.path.endsWith('/heartbeat')).at(-1)?.path === `/api/playback/preview-playback-${starts}/heartbeat`,{timeout:17000}).toBe(true);
  expect(backend.errors).toEqual([]);
  console.log('PASS managed +30 seek holds target until landing and heartbeats the replacement session');
 } finally {release();await page.close();}
} finally {await browser.close();}
