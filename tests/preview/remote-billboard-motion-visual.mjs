import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {PNG} from 'pngjs';
import {installRemoteBackend,referenceRoot} from './remote-backend.ts';
const origin=process.env.REMOTE_PREVIEW_ORIGIN??'https://viptv.local.test:18578';
const out=process.env.REMOTE_VISUAL_OUT??'/tmp/viptv-billboard-motion-visual';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});const results=[];
try{
 const context=await browser.newContext({viewport:{width:1920,height:1080},reducedMotion:'no-preference'});
 const reference=await context.newPage();await reference.route(`${origin}/reference/**`,route=>{const file=resolve(referenceRoot,new URL(route.request().url()).pathname.slice('/reference/'.length));if(!file.startsWith(referenceRoot+'/'))return route.abort();return route.fulfill({body:readFileSync(file),contentType:({'.html':'text/html','.woff2':'font/woff2','.jpg':'image/jpeg','.png':'image/png'})[extname(file)]});});
 await reference.goto(`${origin}/reference/screens/html/tv/Tv3Home.html`);
 const description=await reference.evaluate(async()=>{await document.fonts.ready;for(const a of document.querySelectorAll('nav a'))if(a.textContent==='Calendar')a.remove();const indicators=document.querySelector('[aria-label="Featured 1 of 5"]');while(indicators.children.length>1)indicators.lastElementChild.remove();indicators.firstElementChild.firstElementChild.style.cssText='display:block;height:100%;background:#F4F2EE;width:100%;';return document.querySelector('p').textContent;});
 const page=await context.newPage();await page.clock.install();const fixture=await installRemoteBackend(page,origin);fixture.card.description=description;fixture.bootstrap().home.featured=[fixture.card];
 await page.goto(`${origin}/tv/?platform=vizio&focusdebug=1`);await page.waitForFunction(()=>{let ready=false;function visit(n){if(n.isRenderable&&n.props.w===1920&&n.shader?.shaderKey==='tvBillboardMotion'&&n.texture?.state==='loaded')ready=true;n.children?.forEach(visit);}visit(window.__viptvRenderer.stage.root);return ready;});
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
 const elapsed=()=>page.evaluate(()=>{let result;function visit(n){if(n.isRenderable&&n.props.w===1920&&n.shader?.shaderKey?.startsWith('tvBillboard'))result=n.shader.shaderKey.endsWith('Motion')?n.time-n.shader.uniforms.single.u_startedAt.value:14000;n.children?.forEach(visit);}visit(window.__viptvRenderer.stage.root);return result;});
 for(const target of [7000,14000]){
  await page.clock.fastForward(Math.max(1,Math.ceil(target-(await elapsed()))));await page.clock.runFor(32);
  const time=await elapsed();await reference.evaluate(time=>{for(const a of document.getAnimations())if(a.effect?.target?.tagName==='IMG'){a.pause();a.currentTime=time;}},time);
  await page.screenshot({path:`${out}/app-${target}.png`});await reference.screenshot({path:`${out}/reference-${target}.png`});
  const app=PNG.sync.read(readFileSync(`${out}/app-${target}.png`)).data,ref=PNG.sync.read(readFileSync(`${out}/reference-${target}.png`)).data;
  const regions=[{name:'artwork',x:1000,y:160,w:800,h:650},{name:'add-control',x:336,y:648,w:72,h:72},{name:'info-control',x:428,y:648,w:72,h:72}].map(region=>{let sum=0;for(let y=region.y;y<region.y+region.h;y++)for(let x=region.x;x<region.x+region.w;x++)for(let c=0;c<3;c++)sum+=Math.abs(app[(y*1920+x)*4+c]-ref[(y*1920+x)*4+c]);return{...region,mean_absolute_channel_difference:sum/(region.w*region.h*3)};});
  results.push({target_ms:target,actual_ms:time,regions});
 }
}finally{writeFileSync(`${out}/measurements.json`,JSON.stringify(results,null,2));await browser.close();}
console.log(JSON.stringify(results));if(results.some(r=>r.regions.some(p=>p.mean_absolute_channel_difference>3)))process.exitCode=1;
