#!/usr/bin/env node
import { chromium, expect } from '@playwright/test';
import { installBackend } from './backend.ts';

const url = process.env.SOLID_PREVIEW_URL;
if (!url?.startsWith('https://')) throw new Error('SOLID_PREVIEW_URL must be the trusted HTTPS SolidTV entry');
const browser = await chromium.launch();
try {
  for (const platform of ['tizen', 'vizio', 'webos']) {
    const page = await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
    const backend = await installBackend(page,{family:'tv',session:'ready'});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const focused = (view,index) => page.waitForFunction(({view,index}) =>
      window.__viptvFocus?.view===view && window.__viptvFocus?.index===index && window.__viptvFocus?.nativeFocus===true,
      {view,index},{timeout:7000}).catch(async cause=>{
        const state=await page.evaluate(()=>({focus:window.__viptvFocus,menu:window.__viptvTitleMenu}));
        throw new Error(`${platform} expected ${view}:${index}; actual ${JSON.stringify(state)}; ${cause.message}`);
      });
    await page.goto(`${url}?platform=${platform}&focusdebug=1`);
    await focused('home-action',0);
    await page.keyboard.press('ArrowDown');
    await focused('home-card',0);
    // Losing application focus must cancel an in-progress OK gesture. The next
    // hold still has to work; clearing only its timer leaves `pressed` stuck.
    await page.keyboard.down('Enter');
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.keyboard.up('Enter');
    await focused('home-card',0);
    await page.waitForTimeout(100);
    expect(backend.requests.filter(r=>r.path.includes('/playback/'))).toHaveLength(0);
    await page.keyboard.down('Enter');
    await page.waitForTimeout(760);
    await focused('title-menu-option',0);
    await page.keyboard.up('Enter');
    await focused('title-menu-option',0);
    await page.keyboard.press('Escape');
    await focused('home-card',0);
    // Embedded engines may send no useful `key`, only their platform keyCode.
    const code = async keyCode => page.evaluate(keyCode=>{
      for(const type of ['keydown','keyup'])document.dispatchEvent(new KeyboardEvent(type,{key:'Unidentified',keyCode,bubbles:true,cancelable:true}));
    },keyCode);
    await code(39); await focused('home-card',1);
    await code(37); await focused('home-card',0);
    await code(457); await focused('title-menu-option',0);
    await code(platform==='tizen'?10009:461); await focused('home-card',0);
    expect(errors).toEqual([]);
    expect(backend.errors).toEqual([]);
    console.log(`${platform}: native focus, blur cancellation, hold/release and remote key aliases passed`);
    await page.close();
  }
} finally { await browser.close(); }
