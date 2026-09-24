#!/usr/bin/env node
import {chromium,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {installBackend,installMediaStubs} from './backend.ts';
const url=process.env.SOLID_PREVIEW_URL;
if(!url?.startsWith('https://'))throw new Error('SOLID_PREVIEW_URL must be HTTPS');
const out=process.env.PREVIEW_OUT??'/tmp/viptv-solid-next';mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
let failures=0;
const names=process.argv.slice(2);
async function run(name,options,callback){
  if(names.length&&!names.includes(name))return;
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  const backend=await installBackend(page,{family:'tv',session:'ready',sourcesDone:true,media:{duration:120,position:0},queuePosition:0,queueDuration:120,playbackPositionFromRequest:true,...options});
  await installMediaStubs(page,{duration:120,position:0,frame:'63e024',...(options.mediaStub??{})});
  const focused=(view,index)=>page.waitForFunction(({view,index})=>window.__viptvFocus?.view===view&&window.__viptvFocus?.index===index,{view,index},{timeout:10000});
  const entry=id=>page.waitForFunction(id=>window.__viptvEntryFocus?.id===id,id,{timeout:10000});
  const posts=()=>backend.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST');
  const play=async()=>{await page.keyboard.press('Enter');await focused('source-row',0);await page.keyboard.press('Enter');await focused('player-control',1);};
  const next=async()=>{await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await focused('player-control',3);await page.keyboard.press('Enter');};
  try{
    await page.goto(`${url}?platform=${options.platform??'vizio'}&focusdebug=1`);await focused('home-action',0);
    await callback({page,backend,focused,entry,posts,play,next});
    expect(backend.errors).toEqual([]);console.log(`PASS ${name}`);
  }catch(error){failures++;console.error(`FAIL ${name}: ${error.message}`);console.error(await page.evaluate(()=>({focus:window.__viptvFocus,entry:window.__viptvEntryFocus,player:window.__viptvPlayer,upNext:window.__viptvUpNext})).catch(()=>null));await page.screenshot({path:`${out}/${name}.failed.png`}).catch(()=>{});}
  finally{await page.close();}
}
try{
  await run('explicit-next',{},async({page,backend,focused,posts,play,next})=>{
    await play();await next();await expect.poll(()=>posts().length).toBe(2);await focused('player-control',1);
    expect(posts()[1].body.position).toBe(0);
    expect(backend.requests.some(r=>r.path.includes('/progress')&&r.method!=='GET')).toBe(true);
    expect(await page.evaluate(()=>window.__viptvSourceIntent?.itemId)).toBe('tt-monster:1:2');
  });
  await run('cancel-next',{playbackHangAfter:1},async({page,backend,posts,play,next})=>{
    await play();await next();await expect.poll(()=>posts().length).toBe(2);await page.keyboard.press('Escape');
    expect(await page.evaluate(()=>window.__viptvPlayer?.state)).toBe('playing');
    expect(backend.requests.filter(r=>r.path.includes('/playback/')&&r.path.endsWith('/stop'))).toHaveLength(0);
  });
  await run('three-distinct-attempts',{playbackFailAfter:1},async({page,entry,posts,play,next})=>{
    await play();await next();await entry('player-dialog-retry');
    expect(posts()).toHaveLength(4);
    expect(new Set(posts().slice(1).map(r=>r.body.stream_id)).size).toBe(3);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(()=>window.__viptvPlayer?.state)).toBe('playing');
  });
  await run('up-next-pause-cancel',{},async({page,entry,posts,play})=>{
    await play();await page.evaluate(()=>{const v=document.querySelector('video');v.pause();v.currentTime=116;});await page.waitForTimeout(400);
    expect(await page.evaluate(()=>window.__viptvUpNext?.open??false)).toBe(false);
    await page.evaluate(()=>document.querySelector('video').play());await entry('up-next-play');
    await page.evaluate(()=>document.querySelector('video').pause());await page.waitForTimeout(50);
    const left=await page.evaluate(()=>window.__viptvUpNext.left);await page.waitForTimeout(550);
    expect(await page.evaluate(()=>window.__viptvUpNext.left)).toBe(left);
    await page.screenshot({path:`${out}/TvUpNext.solid.png`});
    await page.keyboard.press('ArrowRight');await entry('up-next-cancel');await page.keyboard.press('Enter');
    await page.evaluate(()=>{const v=document.querySelector('video');Object.defineProperty(v,'ended',{configurable:true,get:()=>true});v.dispatchEvent(new Event('ended'));});await page.waitForTimeout(250);
    expect(posts()).toHaveLength(1);expect(await page.evaluate(()=>window.__viptvUpNext.open)).toBe(false);
  });
  await run('failed-rollback-exact-retry',{mediaStub:{failAfter:1}},async({page,entry,posts,play,next})=>{
    await play();const original=posts()[0].body.stream_id;
    await page.evaluate(()=>{document.querySelector('video').currentTime=42;});await page.waitForTimeout(50);
    await next();await entry('player-dialog-retry');
    await page.screenshot({path:`${out}/TvPlayerRestore.solid.png`});
    const before=posts().length;await page.keyboard.press('Enter');await expect.poll(()=>posts().length).toBe(before+1);
    expect(posts().at(-1).body.stream_id).toBe(original);expect(posts().at(-1).body.position).toBe(42);
  });
  await run('last-ten-resume',{queuePosition:116},async({page,posts,play})=>{
    await play();await page.waitForTimeout(400);expect(await page.evaluate(()=>window.__viptvUpNext?.open??false)).toBe(false);expect(posts()).toHaveLength(1);
    await page.evaluate(()=>{const v=document.querySelector('video');Object.defineProperty(v,'ended',{configurable:true,get:()=>true});v.dispatchEvent(new Event('ended'));});
    await expect.poll(()=>posts().length).toBe(2);
  });
  await run('failed-rollback-no-stale-heartbeat',{mediaStub:{failAfter:1}},async({page,backend,entry,play,next})=>{
    await play();await next();await entry('player-dialog-retry');
    await page.waitForTimeout(15500);
    expect(backend.requests.filter(request=>request.path.endsWith('/heartbeat'))).toHaveLength(0);
  });
  await run('late-player-error-exact-retry',{playbackFailAfter:1},async({page,posts,entry,play})=>{
    await play();const original=posts()[0].body.stream_id;
    await page.evaluate(()=>{document.querySelector('video').currentTime=42;});
    await page.waitForFunction(()=>window.__viptvPlayer?.position===42);
    await page.evaluate(()=>{
      const video=document.querySelector('video');
      Object.defineProperty(video,'error',{configurable:true,get:()=>({code:3,message:'Fixture decoder failure'})});
      video.dispatchEvent(new Event('error'));
    });
    await entry('player-dialog-retry');
    const before=posts().length;await page.keyboard.press('Enter');
    await expect.poll(()=>posts().length).toBeGreaterThan(before);
    expect(posts().at(-1).body.stream_id).toBe(original);
    expect(posts().at(-1).body.position).toBe(42);
  });
  await run('queued-next-source-previous',{queueNext:true,queuePosition:42},async({page,focused,backend,play})=>{
    await page.keyboard.down('Enter');await page.waitForTimeout(760);await page.keyboard.up('Enter');await focused('title-menu-option',0);
    await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await focused('source-row',0);
    const discovery=backend.requests.find(r=>r.path==='/api/streams'&&r.method==='POST');
    expect(JSON.stringify(discovery?.body)).toContain('tt-monster:1:1');
    await page.keyboard.press('Enter');await focused('player-control',1);
    expect(await page.evaluate(()=>window.__viptvSourceIntent?.position)).toBe(42);
  });
  await run('queued-next-primary',{queueNext:true,queuePosition:42},async({page,focused,posts})=>{
    await page.keyboard.press('Enter');await focused('player-control',1);
    expect(posts()).toHaveLength(1);expect(posts()[0].body.position).toBe(0);
    expect(await page.evaluate(()=>window.__viptvSourceIntent?.itemId)).toBe('tt-monster:1:2');
  });
  await run('queued-next-navigate-away',{queueNext:true},async({page,focused,posts})=>{
    let release;
    const held=new Promise(resolve=>{release=resolve;});
    let intercepted=0;
    await page.route('**/api/profiles/*/continue/next',async route=>{
      if(route.request().method()==='OPTIONS')return route.fallback();
      intercepted++;await held;
      await route.fallback().catch(()=>{});
    });
    try {
      await page.keyboard.press('Enter');await expect.poll(()=>intercepted).toBe(1);
      // Leave Home while its Next request is held. Changing phase must cancel
      // continuation rather than letting its eventual result hijack the guide.
      await page.keyboard.press('ArrowLeft');await focused('rail-item',2);
      await page.keyboard.press('ArrowDown');await focused('rail-item',3);
      await page.keyboard.press('ArrowDown');await focused('rail-item',4);
      await page.keyboard.press('Enter');await focused('guide-channel',0);
      release();await page.waitForTimeout(500);
      await focused('guide-channel',0);expect(posts()).toHaveLength(0);
    } finally {release();}
  });
}finally{await browser.close();}
if(failures)process.exitCode=1;
