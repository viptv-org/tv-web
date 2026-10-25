import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import {installRemoteBackend,referenceRoot} from './remote-backend.ts';
const origin=process.env.REMOTE_PREVIEW_ORIGIN??'https://viptv.local.test:18574';
const out=process.env.REMOTE_VISUAL_OUT??'/tmp/viptv-home-visual';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
 const reference=await context.newPage();await reference.route(`${origin}/reference/**`,route=>{
  const file=resolve(referenceRoot,new URL(route.request().url()).pathname.slice('/reference/'.length));if(!file.startsWith(referenceRoot+'/'))return route.abort();return route.fulfill({body:readFileSync(file),contentType:({'.html':'text/html','.woff2':'font/woff2','.jpg':'image/jpeg','.png':'image/png'})[extname(file)]});
 });
 await reference.goto(`${origin}/reference/screens/html/tv/Tv3Home.html`);
 const expected=await reference.evaluate(async()=>{
  await document.fonts.ready;for(const a of document.querySelectorAll('nav a'))if(a.textContent==='Calendar')a.remove();
  const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};};
  const bounds=[],texts=[];
  for(const e of document.querySelectorAll('x-dc > div *')){
   const r=box(e),s=getComputedStyle(e);if(e.closest('helmet')||!r.w||!r.h||r.y>=1080)continue;
   if(['IMG','SVG','A','BUTTON'].includes(e.tagName.toUpperCase())||e.getAttribute('style')?.includes('box-shadow: inset'))bounds.push({...r,tag:e.tagName,src:e.getAttribute('src')?.split('/').pop(),label:e.getAttribute('aria-label')});
   if(e.childNodes.length===1&&e.firstChild.nodeType===Node.TEXT_NODE&&e.textContent.trim())texts.push({...r,text:e.textContent,font:s.fontFamily,size:s.fontSize,weight:s.fontWeight,lineHeight:s.lineHeight});
  }
  return{bounds,texts,description:document.querySelector('p').textContent};
 });
 await reference.screenshot({path:`${out}/Tv3Home-reference.png`});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const fixture=await installRemoteBackend(page,origin);
 fixture.card.description=expected.description;
 await page.goto(`${origin}/tv/?platform=vizio&focusdebug=1`);await page.waitForFunction(()=>document.documentElement.dataset.tvScreen==='home'&&document.documentElement.dataset.tvReady==='true');await page.waitForTimeout(500);
 await page.screenshot({path:`${out}/Tv3Home-app.png`});
 const nodes=await page.evaluate(()=>{const a=[];function visit(n){if(n.isRenderable)a.push({x:n.absX,y:n.absY,w:n.props.w,h:n.props.h,text:n.viptvText,color:n.props.color});n.children?.forEach(visit);}visit(window.__viptvRenderer.stage.root);return a;});
 const bounds=expected.bounds.map(expected=>({expected,matched:nodes.some(n=>['x','y','w','h'].every(k=>Math.abs(n[k]-expected[k])<=1))}));
 const actualPixels=PNG.sync.read(readFileSync(`${out}/Tv3Home-app.png`)).data,referencePixels=PNG.sync.read(readFileSync(`${out}/Tv3Home-reference.png`)).data;
 const compare=box=>{let sum=0,count=0;for(let y=Math.max(0,Math.ceil(box.y));y<Math.min(1080,box.y+box.h);y++)for(let x=Math.max(0,Math.ceil(box.x));x<Math.min(1920,box.x+box.w);x++){const i=(y*1920+x)*4;for(let c=0;c<3;c++)sum+=Math.abs(actualPixels[i+c]-referencePixels[i+c]);count+=3;}return sum/count;};
 const artworkRegions=expected.bounds.filter(b=>['IMG','SVG'].includes(b.tag.toUpperCase())).map(box=>({box,mean_absolute_channel_difference:compare(box)}));
 const mean=compare({x:0,y:0,w:1920,h:1080});
 writeFileSync(`${out}/geometry.json`,JSON.stringify({board:'Tv3Home',reference_sha256:createHash('sha256').update(readFileSync(resolve(referenceRoot,'screens/html/tv/Tv3Home.html'))).digest('hex'),adaptations:['Calendar omitted by approved scope'],bounds,referenceTexts:expected.texts,nodes,errors,artworkRegions,whole_frame_mean_absolute_channel_difference:mean},null,2));
 if(errors.length)throw new Error(errors.join('\n'));if(bounds.some(b=>!b.matched))throw new Error('Home reference geometry differs by more than one pixel');
 if(mean>3||artworkRegions.some(r=>r.mean_absolute_channel_difference>5))throw new Error('Home artwork/foreground comparison failed; inspect the private capture');
 console.log(JSON.stringify({matched:bounds.filter(b=>b.matched).length,total:bounds.length,mean}));
}finally{await browser.close();}
