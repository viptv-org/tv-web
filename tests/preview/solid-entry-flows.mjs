#!/usr/bin/env node
import {chromium,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {installBackend} from './backend.ts';
const url=process.env.SOLID_PREVIEW_URL;
if(!url?.startsWith('https://'))throw new Error('SOLID_PREVIEW_URL must be HTTPS');
const output=process.env.PREVIEW_OUT??'/tmp/viptv-entry-flows';mkdirSync(output,{recursive:true});
const browser=await chromium.launch();
const setup=async options=>{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  const backend=await installBackend(page,{family:'tv',session:'ready',...options});
  const focused=(view,index)=>page.waitForFunction(({view,index})=>window.__viptvFocus?.view===view&&window.__viptvFocus?.index===index,{view,index},{timeout:10000});
  const entry=id=>page.waitForFunction(id=>window.__viptvEntryFocus?.id===id,id,{timeout:10000});
  const submit=()=>page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'MediaFastForward',keyCode:417,bubbles:true,cancelable:true})));
  await page.goto(`${url}?platform=tizen&focusdebug=1`);await focused('home-action',0);
  return {page,backend,focused,entry,submit};
};
try {
  {
    const {page,backend,focused,entry,submit}=await setup({});
    await page.keyboard.press('ArrowLeft');await focused('rail-item',2);
    for(let i=0;i<4;i++)await page.keyboard.press('ArrowDown');
    await focused('rail-item',6);await page.keyboard.press('Enter');await focused('settings-row',0);
    for(let i=0;i<3;i++)await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');await focused('settings-row',0);
    await page.keyboard.press('Enter');await entry('key-0');
    for(let i=0;i<8;i++)await page.keyboard.press('Backspace');
    await page.keyboard.type('http://invalid.example/manifest.json');await submit();await page.waitForTimeout(150);
    expect(backend.requests.filter(r=>r.path==='/api/addons'&&r.method==='POST')).toHaveLength(0);
    await page.screenshot({path:`${output}/TvAddonInstall.invalid.solid.png`});
    // Navigate to the spanning Delete key and use its 700ms clear action.
    for(let i=0;i<7;i++)await page.keyboard.press('ArrowDown');
    await entry('key-42');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await entry('key-44');
    await page.keyboard.down('Enter');await page.waitForTimeout(760);await page.keyboard.up('Enter');
    await page.keyboard.type('https://example.test/manifest.json');await submit();
    await page.waitForFunction(()=>!window.__viptvEntryFocus);await focused('settings-row',0);
    const post=backend.requests.find(r=>r.path==='/api/addons'&&r.method==='POST');
    expect(post?.body?.manifest_url).toBe('https://example.test/manifest.json');
    expect(backend.errors).toEqual([]);await page.close();
    console.log('Addon entry: HTTPS validation, physical typing, held Delete, install and return focus passed');
  }
  {
    const {page,backend,focused,entry,submit}=await setup({});
    await page.keyboard.press('ArrowLeft');await focused('rail-item',2);await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await focused('discover-card',0);
    await page.keyboard.press('ArrowUp');await focused('discover-chip',0);
    for(let i=0;i<7;i++)await page.keyboard.press('ArrowRight');
    await focused('discover-chip',7);await page.keyboard.press('Enter');await page.waitForTimeout(200);
    await page.keyboard.press('ArrowRight');await focused('discover-chip',8);await page.keyboard.press('Enter');await entry('key-0');
    await submit();await page.waitForTimeout(150);await entry('key-0');
    await page.screenshot({path:`${output}/TvFilterText.required.solid.png`});
    await page.keyboard.type('drama');await submit();await page.waitForFunction(()=>!window.__viptvEntryFocus);
    expect(backend.requests.some(r=>r.query.includes('drama'))).toBe(true);
    expect(backend.errors).toEqual([]);await page.close();
    console.log('Catalog text filter: required validation, typed value, request and return passed');
  }
  {
    const {page,backend,focused,entry,submit}=await setup({signOutPin:true,wrongPin:true});
    await page.keyboard.press('ArrowLeft');await focused('rail-item',2);
    for(let i=0;i<4;i++)await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await focused('settings-row',0);
    for(let i=0;i<5;i++)await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await focused('settings-choice',1);
    await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');await entry('key-0');
    await submit();expect(backend.requests.filter(r=>r.path==='/api/parent/unlock')).toHaveLength(0);
    await page.keyboard.type('1234');await submit();await page.waitForTimeout(200);await entry('key-0');
    expect(backend.requests.filter(r=>r.path==='/api/parent/unlock')).toHaveLength(1);
    await page.screenshot({path:`${output}/TvPinError.solid.png`});
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!window.__viptvEntryFocus);
    expect(backend.errors).toEqual([]);await page.close();
    console.log('Signout PIN: empty validation, wrong PIN and cancellation passed');
  }
  {
    const {page,backend,focused,entry,submit}=await setup({signOutPin:true});
    await page.keyboard.press('ArrowLeft');await focused('rail-item',2);
    for(let i=0;i<4;i++)await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await focused('settings-row',0);
    for(let i=0;i<5;i++)await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await focused('settings-choice',1);
    await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');await entry('key-0');
    await page.keyboard.type('1234');await submit();
    await expect.poll(()=>backend.requests.filter(r=>r.path==='/api/auth/device/code').length).toBe(1);
    await page.waitForFunction(()=>!window.__viptvEntryFocus);
    expect(await page.evaluate(origin=>localStorage.getItem(`viptv-device:${origin}`)===null,new URL(url).origin)).toBe(true);
    await page.screenshot({path:`${output}/TvPairing.after-signout.solid.png`});
    expect(backend.errors).toEqual([]);await page.close();
    console.log('Signout PIN success: revoked grant, fresh pairing and no stale overlay focus passed');
  }
}finally{await browser.close();}
