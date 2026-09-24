#!/usr/bin/env node
import { chromium, expect } from '@playwright/test';
import { installBackend, installMediaStubs } from './backend.ts';
const url=process.env.SOLID_PREVIEW_URL;
if(!url?.startsWith('https://'))throw new Error('SOLID_PREVIEW_URL must be HTTPS');
const browser=await chromium.launch();
try {
  for(const platform of ['tizen','vizio','webos']) {
    const page=await browser.newPage({viewport:{width:1920,height:1080}});
    const backend=await installBackend(page,{family:'tv',session:'ready'});
    await installMediaStubs(page,{frame:'63e024'});
    const focused=(view,index)=>page.waitForFunction(({view,index})=>window.__viptvFocus?.view===view&&window.__viptvFocus?.index===index,{view,index},{timeout:10000}).catch(async cause=>{
      console.error(await page.evaluate(()=>({focus:window.__viptvFocus,player:window.__viptvPlayer})));
      console.error(backend.requests.filter(r=>r.path.startsWith('/api/playback')).map(r=>({path:r.path,body:r.body})));
      await page.screenshot({path:`/tmp/solid-home-play-${platform}-failed.png`});
      throw cause;
    });
    await page.goto(`${url}?platform=${platform}&focusdebug=1`);
    await focused('home-action',0);
    await page.keyboard.down('Enter');await page.waitForTimeout(760);
    await focused('title-menu-option',0);
    await page.keyboard.up('Enter');
    expect(backend.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST')).toHaveLength(0);
    await page.keyboard.press('Escape');await focused('home-action',0);
    await page.keyboard.press('Enter');await focused('source-row',0);
    await page.keyboard.press('Enter');await focused('player-control',1);
    expect(backend.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST')).toHaveLength(1);
    await page.keyboard.press('Escape');await page.keyboard.press('Escape');
    await focused('source-row',0);
    await page.keyboard.press('Escape');
    await focused('home-action',0);
    expect(backend.errors).toEqual([]);
    console.log(`${platform}: Home Resume, hero hold menu and return focus passed`);
    await page.close();
  }
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  const backend=await installBackend(page,{family:'tv',session:'ready',playbackFailAfter:0});
  await installMediaStubs(page,{frame:'63e024'});
  await page.goto(`${url}?platform=vizio&focusdebug=1`);
  await page.waitForFunction(()=>window.__viptvFocus?.view==='home-action');
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.__viptvFocus?.view==='source-row',null,{timeout:10000});
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  await page.waitForFunction(()=>window.__viptvFocus?.view==='source-row',null,{timeout:10000});
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>window.__viptvFocus?.view==='home-action'&&window.__viptvFocus?.index===0);
  expect(backend.errors).toEqual([]);
  console.log('Home playback failure: source recovery and return focus passed');
  await page.close();
  {
    const retry=await browser.newPage({viewport:{width:1920,height:1080}});
    const backend=await installBackend(retry,{family:'tv',session:'ready'});
    let fail=true;
    await retry.route('**/api/profiles/*/continue/page**',route=>fail
      ? route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary catalog outage'})})
      : route.fallback());
    await retry.goto(`${url}?platform=vizio&focusdebug=1`);
    await retry.waitForFunction(()=>window.__viptvFocus?.view==='error',null,{timeout:10000});
    fail=false;await retry.keyboard.press('Enter');
    await retry.waitForFunction(()=>window.__viptvFocus?.view==='home-action',null,{timeout:10000});
    expect(backend.requests.filter(request=>request.path.includes('/device/code'))).toHaveLength(0);
    expect(backend.errors).toEqual([]);
    console.log('Home request retry preserves the signed-in session and does not start pairing');
    await retry.close();
  }
} finally {await browser.close();}
