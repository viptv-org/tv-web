import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import {installRemoteBackend,referenceRoot} from './remote-backend.ts';
const origin=process.env.REMOTE_PREVIEW_ORIGIN??'https://viptv.local.test:18582';
const out=process.env.REMOTE_VISUAL_OUT??'/tmp/viptv-browse-visual';mkdirSync(out,{recursive:true});const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
 const reference=await context.newPage();await reference.route(`${origin}/reference/**`,route=>{const file=resolve(referenceRoot,new URL(route.request().url()).pathname.slice('/reference/'.length));if(!file.startsWith(referenceRoot+'/'))return route.abort();return route.fulfill({body:readFileSync(file),contentType:({'.html':'text/html','.woff2':'font/woff2','.jpg':'image/jpeg','.png':'image/png'})[extname(file)]});});
 await reference.goto(`${origin}/reference/screens/html/tv/Tv3Browse.html`);
 const fixtureData=await reference.evaluate(async()=>{
  await document.fonts.ready;
  const links=[...document.querySelectorAll('x-dc > div > a')];
  // Dynamic content follows current producer presentation: capability order and
  // resolution wording, minute-based remaining labels, no absent release badge.
  const meta=[...document.querySelectorAll('x-dc > div > div')].find(d=>d.style.top==='240px');
  const badges=[...meta.querySelectorAll('span')].filter(e=>e.style.boxShadow);['720p','5.1','TV-MA'].forEach((label,i)=>badges[i].textContent=label);
  for(const a of links){if(a.style.width==='232px')for(const e of [...a.querySelectorAll('span')])if(!e.childElementCount&&e.textContent==='New')e.remove();}
  const landscapes=links.filter(a=>a.style.width==='384px').map((a,i)=>{const labels=[...a.children[1].children];if(i===1)labels[1].textContent='S4 E16 · Chapter 16';if(i===2)labels[1].textContent='100m left';if(i===3)labels[1].textContent='72m left';const bar=[...a.querySelectorAll('span')].find(s=>s.style.height==='4px');return{src:a.querySelector('img').getAttribute('src').split('/').pop(),title:labels[0].textContent,subtitle:labels[1].textContent,progress:bar?parseFloat(bar.firstElementChild.style.width)/100:null,badge:i===1?'New episode':null};});
  const posters=links.filter(a=>a.style.width==='232px').map(a=>({src:a.querySelector('img').getAttribute('src').split('/').pop(),title:a.getAttribute('aria-label')}));
  const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};};
  const bounds=[],texts=[];
  for(const e of document.querySelectorAll('x-dc > div *')){if(e.closest('helmet'))continue;const r=box(e),s=getComputedStyle(e);if(!r.w||!r.h||r.x>=1920||r.y>=1080)continue;if(['IMG','SVG'].includes(e.tagName.toUpperCase())||e.getAttribute('style')?.includes('box-shadow: inset 0 0 0 1.5px'))bounds.push({...r,tag:e.tagName});if(e.childNodes.length===1&&e.firstChild.nodeType===Node.TEXT_NODE&&e.textContent.trim())texts.push({...r,text:e.textContent,size:s.fontSize,weight:s.fontWeight});}
  return{landscapes,posters,bounds,texts,description:document.querySelector('p').textContent};
 });
 await reference.screenshot({path:`${out}/reference.png`});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const fixture=await installRemoteBackend(page,origin);const home=fixture.bootstrap().home;
 home.rows[0].cards=fixtureData.landscapes.map((c,i)=>({...fixture.cards[i],title:c.title,subtitle:c.subtitle,progress:c.progress,description:i===0?fixtureData.description:fixture.cards[i].description,view:{...fixture.cards[i].view,hero_badges:i===0?[{label:'720p',role:'capability'},{label:'5.1',role:'capability'},{label:'TV-MA',role:'certification'}]:fixture.cards[i].view.hero_badges,tile_badge:c.badge?{label:c.badge,role:'new_episodes'}:null,preview:{background:i===0?`${origin}/fixture/7432c1f4e06fad8e590ad3646164759b.jpg`:fixture.cards[i].landscape,caption:i===0?'Resume S1 E2 · 38m left':null,progress:i===0?.3:null,action:i===0?'play':'details'}}}));
 home.rows[1].title='New this week';home.rows[1].cards=fixtureData.posters.map((c,i)=>({...fixture.card,identity:{kind:'movie',id:`new-${i}`,ids:[]},title:c.title,poster:`${origin}/fixture/${c.src}`,view:{...fixture.card.view,tile_badge:null,preview:{background:fixture.card.landscape,caption:null,progress:null,action:'details'}}}));
 await page.goto(`${origin}/tv/?platform=vizio&focusdebug=1`);await page.waitForFunction(()=>document.documentElement.dataset.tvReady==='true');await page.keyboard.press('ArrowDown');await page.waitForTimeout(650);await page.screenshot({path:`${out}/app.png`});
 const nodes=await page.evaluate(()=>{const rows=[];function v(n){if(n.isRenderable)rows.push({x:n.absX,y:n.absY,w:n.props.w,h:n.props.h,text:n.viptvText});n.children?.forEach(v);}v(window.__viptvRenderer.stage.root);return rows;});
 const bounds=fixtureData.bounds.map(expected=>({expected,matched:nodes.some(n=>['x','y','w','h'].every(k=>Math.abs(n[k]-expected[k])<=1))}));
 const a=PNG.sync.read(readFileSync(`${out}/app.png`)).data,b=PNG.sync.read(readFileSync(`${out}/reference.png`)).data;let sum=0;for(let i=0;i<a.length;i+=4)for(let c=0;c<3;c++)sum+=Math.abs(a[i+c]-b[i+c]);
 const report={board:'Tv3Browse',reference_sha256:createHash('sha256').update(readFileSync(resolve(referenceRoot,'screens/html/tv/Tv3Browse.html'))).digest('hex'),adaptations:['Current server badge ordering/720p wording and minute-based subtitles','Unsupported release New badges omitted'],bounds,referenceTexts:fixtureData.texts,nodes,errors,whole_frame_mean_absolute_channel_difference:sum/(1920*1080*3)};writeFileSync(`${out}/geometry.json`,JSON.stringify(report,null,2));
 if(errors.length)throw new Error(errors.join('\n'));
 if(bounds.length!==19||bounds.some(v=>!v.matched))throw new Error(`Browse geometry mismatch: ${bounds.filter(v=>v.matched).length}/${bounds.length}`);
 if(report.whole_frame_mean_absolute_channel_difference>3)throw new Error(`Browse pixel difference exceeds 3: ${report.whole_frame_mean_absolute_channel_difference}`);
 console.log(JSON.stringify({matched:bounds.filter(v=>v.matched).length,total:bounds.length,mean:report.whole_frame_mean_absolute_channel_difference}));
}finally{await browser.close();}
