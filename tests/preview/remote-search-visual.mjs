import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { installRemoteBackend, referenceRoot } from './remote-backend.ts';

const origin=process.env.REMOTE_PREVIEW_ORIGIN ?? 'https://viptv.local.test:18570';
const out=process.env.REMOTE_VISUAL_OUT ?? '/tmp/viptv-search-visual';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
try {
  const context=await browser.newContext({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
  const reference=await context.newPage();
  await reference.route(`${origin}/reference/**`,route=>{
    const file=resolve(referenceRoot,new URL(route.request().url()).pathname.slice('/reference/'.length));
    if(!file.startsWith(referenceRoot+'/'))return route.abort();
    return route.fulfill({body:readFileSync(file),contentType:({'.html':'text/html','.woff2':'font/woff2','.jpg':'image/jpeg','.png':'image/png'})[extname(file)]});
  });
  await reference.goto(`${origin}/reference/screens/html/tv/Tv3Search.html`);
  const source=await reference.evaluate(async()=>{
    await document.fonts.ready;
    for(const a of document.querySelectorAll('nav a'))if(a.textContent==='Calendar')a.remove();
    for(const d of document.querySelectorAll('x-dc > div > div'))if(d.style.top==='828px')d.remove();
    const channels=[...document.querySelectorAll('x-dc > div > a')].filter(a=>a.style.width==='356px');
    const names=channels.map(a=>a.firstElementChild.firstChild.textContent.trim());
    channels.forEach((a,i)=>{a.children[1].textContent=names[i];a.children[2]?.remove();});
    const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};};
    const posters=[...document.querySelectorAll('img')].slice(0,5).map(e=>({src:e.getAttribute('src').split('/').pop(),title:e.parentElement.parentElement.getAttribute('aria-label'),...box(e)}));
    const boxes=[...document.querySelectorAll('[aria-label="Keyboard"] button')].map(box);
    boxes.push(box(document.querySelector('x-dc > div > div')),...posters.map(({x,y,w,h})=>({x,y,w,h})),...channels.map(a=>box(a.firstElementChild)));
    return{posters,names,boxes};
  });
  await reference.screenshot({path:`${out}/reference.png`});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const fixture=await installRemoteBackend(page,origin,{channelSearch:true});
  await page.route('**/api/discover?**',route=>route.fulfill({json:{cards:source.posters.map((p,i)=>({...fixture.card,identity:{kind:'movie',id:`search-${i}`,ids:[]},title:p.title,poster:`${origin}/fixture/${p.src}`,view:{saved:false}})),complete:true}}));
  await page.route('**/api/profiles/*/live/channels?**',route=>route.fulfill({json:{snapshot_id:'matched-search-reference',paging:{origin:'0',limit:40,page_size:40,previous:null,next:null},channels:source.names.map((name,i)=>({id:`channel-${i}`,connection_id:'m3u:1',card:{identity:{kind:'live',id:`channel-${i}`,ids:[]},provider_id:'m3u:1',title:name,badges:[]}})),groups:[],complete:true,availability:'Available'}}));
  await page.goto(`${origin}/tv/?platform=vizio&focusdebug=1`);await page.waitForFunction(()=>document.documentElement.dataset.tvReady==='true');
  for(const key of ['ArrowUp','ArrowLeft','Enter'])await page.keyboard.press(key);
  await page.keyboard.type('the w');await page.waitForFunction(()=>document.documentElement.dataset.tvReady==='true');
  for(const key of ['ArrowDown','ArrowRight'])await page.keyboard.press(key);
  await page.waitForTimeout(350);await page.screenshot({path:`${out}/app.png`});
  const actual=await page.evaluate(()=>{const nodes=[];function visit(n){if(n.isRenderable)nodes.push({x:n.absX,y:n.absY,w:n.props.w,h:n.props.h,text:n.viptvText});n.children?.forEach(visit)}visit(window.__viptvRenderer.stage.root);return nodes;});
  const bounds=source.boxes.map(expected=>({expected,matched:actual.some(n=>['x','y','w','h'].every(k=>Math.abs(n[k]-expected[k])<.5))}));
  const report={board:'Tv3Search',design_ref:readFileSync('DESIGN_REF','utf8').trim(),reference_sha256:createHash('sha256').update(readFileSync(resolve(referenceRoot,'screens/html/tv/Tv3Search.html'))).digest('hex'),adaptations:['Calendar omitted by approved scope','No server query-suggestion projection: suggestions omitted','No channel number/current-program projection: captions omitted'],bounds,nodes:actual,errors};
  writeFileSync(`${out}/geometry.json`,JSON.stringify(report,null,2));
  if(errors.length||bounds.some(b=>!b.matched))throw new Error('Search reference comparison failed; inspect private geometry report');
  console.log(`${bounds.length} matching Search rectangles; private captures: ${out}`);
} finally {await browser.close();}
