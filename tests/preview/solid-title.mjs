#!/usr/bin/env node
import {chromium,expect} from '@playwright/test';
import {installBackend,installMediaStubs} from './backend.ts';
const url=process.env.SOLID_PREVIEW_URL;
if(!url?.startsWith('https://'))throw new Error('HTTPS required');
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1920,height:1080}});
 page.setDefaultTimeout(7000);
 const backend=await installBackend(page,{family:'tv',session:'ready',sourcesDone:true});
 await installMediaStubs(page,{frame:'63e024'});
 const entry=id=>page.waitForFunction(id=>window.__viptvEntryFocus?.id===id,id);
 const focus=(view,index)=>page.waitForFunction(({view,index})=>window.__viptvFocus?.view===view&&window.__viptvFocus?.index===index&&!window.__viptvEntryFocus,{view,index}).catch(async error=>{throw new Error(`${view}:${index} ${JSON.stringify(await page.evaluate(()=>({focus:window.__viptvFocus,entry:window.__viptvEntryFocus})))} ${error.message}`)});
 await page.goto(`${url}?platform=vizio&focusdebug=1`);await focus('home-action',0);
 await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await focus('title-action',0);
 await page.keyboard.press('ArrowDown');await entry('title-season');await page.keyboard.press('Enter');await entry('player-dialog-season-1');
 await page.keyboard.press('ArrowDown');await entry('player-dialog-season-2');await page.keyboard.press('Enter');await entry('title-season');
 await page.keyboard.press('ArrowDown');await focus('title-episode',0);
 for(let i=1;i<=9;i++){await page.keyboard.press('ArrowRight');await focus('title-episode',i);}
 await page.keyboard.press('Enter');await focus('source-row',0);
 const discovery=backend.requests.filter(r=>r.path==='/api/streams'&&r.method==='POST').at(-1);
 expect(JSON.stringify(discovery.body)).toContain('tt-monster:2:10');
 await page.keyboard.press('Escape');await focus('title-episode',9);
 await page.keyboard.press('ArrowUp');await entry('title-season');await page.keyboard.press('Enter');await entry('player-dialog-season-2');
 await page.keyboard.press('Escape');await entry('title-season');
 await page.keyboard.press('ArrowUp');await focus('title-action',0);
 await page.keyboard.press('Enter');await focus('source-row',0);
 expect(JSON.stringify(backend.requests.filter(r=>r.path==='/api/streams'&&r.method==='POST').at(-1).body)).toContain('tt-monster:1:1');
 expect(backend.errors).toEqual([]);
 console.log('PASS season selection, tenth-episode navigation, exact source identity, Back and original Resume target');
} finally {await browser.close();}
