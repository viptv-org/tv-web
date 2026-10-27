import {chromium} from '@playwright/test';
import {installRemoteBackend} from './remote-backend.ts';
import {mkdirSync,writeFileSync} from 'node:fs';
const origin=process.env.REMOTE_PREVIEW_ORIGIN??'https://viptv.local.test:18562';
const out=process.env.REMOTE_PREVIEW_OUT??'/tmp/viptv-tv-remote';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const fixtures=await installRemoteBackend(page,origin);
try{
 await page.goto(origin+'/tv/?platform=vizio&focusdebug=1&perfdebug=1');
 await page.waitForFunction(()=>document.documentElement.dataset.tvScreen==='home');await page.waitForTimeout(1200);
 await page.screenshot({path:out+'/home.png'});
 await page.keyboard.press('ArrowDown');await page.waitForTimeout(500);await page.screenshot({path:out+'/browse.png'});
 await page.keyboard.press('Enter');await page.waitForTimeout(500);await page.screenshot({path:out+'/detail.png'});
 await page.keyboard.press('Enter');await page.waitForTimeout(500);await page.screenshot({path:out+'/sources.png'});
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await page.waitForTimeout(500);await page.screenshot({path:out+'/movies.png'});
 writeFileSync(out+'/result.json',JSON.stringify({errors,requests:fixtures.requests.map(r=>({method:r.method,path:r.path})),screen:await page.evaluate(()=>document.documentElement.dataset.tvScreen)},null,2));
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('Captures: '+out);
}finally{await browser.close();}
