#!/usr/bin/env node
/** Full-text title panel acceptance through real D-pad events and fixture HTTP only. */
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from '@playwright/test';
import {installBackend} from './backend.ts';
const url=process.env.SOLID_PREVIEW_URL;
if(!url?.startsWith('https://'))throw new Error('SOLID_PREVIEW_URL must be HTTPS');
const output=process.env.PREVIEW_OUT??'/tmp/viptv-title-info';mkdirSync(output,{recursive:true});
const browser=await chromium.launch();
try {
  for(const long of [false,true,'unbroken']){
    const unbroken=long==='unbroken';
    const page=await browser.newPage({viewport:{width:1920,height:1080}});
    const backend=await installBackend(page,{family:'tv',session:'ready'});
    if(long)await page.route('**/api/meta/**',route=>{
      const parts=new URL(route.request().url()).pathname.split('/');
      return route.fulfill({contentType:'application/json',body:JSON.stringify({meta:{id:decodeURIComponent(parts.at(-1)),type:parts.at(-2),name:'Long title information fixture',year:'2022',runtime:'52 min',genres:['Drama'],description:unbroken ? 'https://fixture.invalid/'+ 'file-🍿'.repeat(1000)+'.mkv' : Array.from({length:24},(_,i)=>`Paragraph ${i+1}. This long fixture exercises remote scrolling through complete title information without discarding the synopsis. Details remain readable as the text viewport moves down and back up.`).join('\n\n'),director:['Fixture Director'],cast:['First Performer','Last Performer']}})});
    });
    const focused=(view,index)=>page.waitForFunction(({view,index})=>window.__viptvFocus?.view===view&&window.__viptvFocus?.index===index&&!window.__viptvEntryFocus,{view,index},{timeout:7000});
    const entry=id=>page.waitForFunction(id=>window.__viptvEntryFocus?.id===id,id,{timeout:7000});
    try {
      await page.goto(`${url}?platform=tizen&focusdebug=1`);await focused('home-action',0);
      await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await focused('title-action',0);
      for(let i=0;i<3;i++)await page.keyboard.press('ArrowRight');await focused('title-action',3);
      await page.keyboard.press('Enter');await entry('title-info-body');
      let state=await page.evaluate(()=>window.__viptvTextPanel);
      assert.ok(state.paragraphs>=(long?3:2),'available synopsis and credits paragraphs must be present');
      if(long){
        assert.ok(state.maxOffset>0,'long synopsis must create a scroll range');
        if(unbroken)assert.ok(state.maxOffset>1000,'unbroken Unicode filename must wrap into reachable lines, not truncate');
        await page.keyboard.press('ArrowDown');await entry('title-info-body');
        const next=await page.evaluate(()=>window.__viptvTextPanel);assert.ok(next.offset>0&&next.offset<=next.maxOffset);
        await page.keyboard.press('ArrowUp');await page.waitForFunction(()=>window.__viptvTextPanel?.offset===0);
        for(let count=0;count<100;count++){
          state=await page.evaluate(()=>window.__viptvTextPanel);
          if(state.offset>=state.maxOffset)break;
          await page.keyboard.press('ArrowDown');
        }
        state=await page.evaluate(()=>window.__viptvTextPanel);assert.equal(state.offset,state.maxOffset,'all text must be reachable');
      }
      await page.waitForTimeout(150);await page.screenshot({path:`${output}/${unbroken?'TvMoreInfo.unbroken-end':long?'TvMoreInfo.long-end':'TvMoreInfo'}.solid.png`});
      await page.keyboard.press('ArrowDown');await entry('title-info-close');
      await page.keyboard.press('ArrowUp');await entry('title-info-body');
      await page.keyboard.press('Escape');await focused('title-action',3);
      assert.equal(await page.evaluate(()=>window.__viptvTextPanel),undefined);
      await page.keyboard.press('Enter');await entry('title-info-body');
      await page.keyboard.press('ArrowRight');await entry('title-info-close');await page.keyboard.press('Enter');await focused('title-action',3);
      assert.deepEqual(backend.errors,[]);
      console.log(`PASS title-info ${unbroken?'unbroken Unicode URL scrolling':long?'long scrolling + credits':'reference content'} / Close / Back / focus restoration`);
    }catch(error){await page.screenshot({path:`${output}/failed-${long?'long':'short'}.png`}).catch(()=>{});throw error;}
    finally{await page.close();}
  }
}finally{await browser.close();}
