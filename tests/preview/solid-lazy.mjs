import {chromium,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {installBackend,installMediaStubs} from './backend.ts';
const url=process.env.SOLID_PREVIEW_URL,origin=process.env.PREVIEW_API_ORIGIN;
if(!url?.startsWith('https://')||!origin?.startsWith('https://'))throw new Error('Use the local HTTPS preview');
const out=process.env.PREVIEW_OUT??'/tmp/solid-lazy';mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
const focus=(page,view,index)=>page.waitForFunction(({view,index})=>window.__viptvFocus?.view===view&&(index===undefined||window.__viptvFocus.index===index),{view,index},{timeout:10000}).catch(async error=>{await page.screenshot({path:`${out}/failure.png`});throw new Error(`${view}:${index} actual ${JSON.stringify(await page.evaluate(()=>({focus:window.__viptvFocus,cache:window.__viptvHomeCache})))}; ${error.message}`);});
try {
 const page=await browser.newPage({viewport:{width:1920,height:1080}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const backend=await installBackend(page,{family:'tv',session:'ready',sourcesDone:true});
 const pngs=await page.evaluate(()=>Object.fromEntries([[320,180],[1280,720],[256,144],[410,118]].map(([w,h])=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#283746';x.fillRect(0,0,w,h);return [`${w}x${h}`,c.toDataURL().split(',')[1]];})));
 await page.route('https://wsrv.nl/**',route=>{const u=new URL(route.request().url());const png=pngs[`${u.searchParams.get('w')}x${u.searchParams.get('h')}`]??pngs['320x180'];return route.fulfill({body:Buffer.from(png,'base64'),contentType:'image/png',headers:{'access-control-allow-origin':'*'}});});
 await page.route(`${origin}/api/catalogs`,route=>route.fulfill({json:Array.from({length:100},(_,i)=>({id:`stress-${i}`,type:'movie',name:`Stress shelf ${i}`,addon_id:1,extra:[]}))}));
 let active=0,peak=0;const requests=[];
 await page.route(`${origin}/api/discover**`,async route=>{
  const id=new URL(route.request().url()).searchParams.get('catalog');requests.push(id);peak=Math.max(peak,++active);
  await new Promise(resolve=>setTimeout(resolve,70));
  try{await route.fulfill({json:{metas:Array.from({length:24},(_,i)=>({id:`${id}-${i}`,type:'movie',name:`${id} title ${i}`,background:`https://art.example/${id}-${i}.jpg`})),has_more:false}});}catch{}finally{active--;}
 });
 await page.goto(`${url}?platform=vizio&focusdebug=1&perfdebug=1`);await focus(page,'home-action',0);
 await page.waitForFunction(()=>window.__viptvHomeCache?.rows>=100);
 await page.waitForTimeout(700);expect(requests).toHaveLength(0);
 const samples=[];
 const sample=()=>page.evaluate(()=>{
  let images=0,nodes=0;const walk=n=>{nodes++;if(typeof n.texture?.props?.src==='string'&&n.texture.props.src.includes('stress-'))images++;for(const child of n.children??[])walk(child);};walk(window.__viptvRenderer.stage.root);
  return {...window.__viptvHomeCache,images,nodes,bytes:window.__viptvRendererMetrics().textureBytes};
 });
 await page.keyboard.press('ArrowDown');await focus(page,'home-card',0);
 for(let row=1;row<=20;row++){
  await page.keyboard.press('ArrowDown');await focus(page,'home-card',1000+row*100);
  await page.waitForTimeout(180);
  const value=await sample();samples.push(value);expect(value.cached).toBeGreaterThan(0);expect(value.cached).toBeLessThanOrEqual(5);expect(value.mounted.length).toBeLessThanOrEqual(4);expect(value.images).toBeLessThanOrEqual(24);
 }
 expect(peak).toBeLessThanOrEqual(2);expect(requests.length).toBeLessThan(30);
 for(let i=0;i<5;i++)await page.keyboard.press('ArrowRight');await focus(page,'home-card',3005);
 await page.keyboard.press('ArrowDown');await focus(page,'home-card',3105);await page.waitForTimeout(180);
 await page.keyboard.press('ArrowUp');await focus(page,'home-card',3005);
 await page.waitForTimeout(120);
 const captions=await page.evaluate(()=>{let count=0;const walk=n=>{if(n.viptvText?.startsWith('stress-')&&n.globalTransform.ty<1026&&n.worldAlpha>.5&&n.isRenderable)count++;for(const child of n.children??[])walk(child);};walk(window.__viptvRenderer.stage.root);return count;});expect(captions).toBeGreaterThanOrEqual(8);
 await page.screenshot({path:`${out}/deep-shelf.png`});
 for(let row=19;row>=0;row--){await page.keyboard.press('ArrowUp');await focus(page,'home-card',row===0?0:1000+row*100);await page.waitForTimeout(100);}
 await page.waitForFunction(()=>{let found=false;const walk=n=>{if(n.viptvText==='Resume'&&n.worldAlpha>.5&&n.isRenderable)found=true;for(const child of n.children??[])walk(child);};walk(window.__viptvRenderer.stage.root);return found;});
 await page.keyboard.press('ArrowUp');await focus(page,'home-action',0);
 await page.keyboard.press('ArrowLeft');await focus(page,'rail-item',2);await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await focus(page,'discover-card',0);
 const requestCount=requests.length;await page.waitForTimeout(600);expect(requests).toHaveLength(requestCount);
 const away=await sample();expect(away.images).toBeLessThanOrEqual(12);
 expect(errors).toEqual([]);console.log(JSON.stringify({initialCatalogRequests:0,peakConcurrent:peak,requests:requests.length,maxCached:Math.max(...samples.map(s=>s.cached)),maxMounted:Math.max(...samples.map(s=>s.mounted.length)),maxImages:Math.max(...samples.map(s=>s.images)),maxNodes:Math.max(...samples.map(s=>s.nodes)),maxTextureBytes:Math.max(...samples.map(s=>s.bytes)),awayNodes:away.nodes},null,2));await page.close();

 const player=await browser.newPage({viewport:{width:1920,height:1080}});
 await installBackend(player,{family:'tv',session:'ready',sourcesDone:true});await installMediaStubs(player,{position:200});
 await player.goto(`${url}?platform=vizio&focusdebug=1`);await focus(player,'home-action',0);
 await player.keyboard.press('Enter');await focus(player,'source-row',0);await player.keyboard.press('Enter');await focus(player,'player-control',1);
 await player.evaluate(()=>{const v=document.getElementById('tv-video');window.__tick=setInterval(()=>{if(!v.paused){v.currentTime+=.25;v.dispatchEvent(new Event('timeupdate'));}},200);});
 await player.waitForFunction(()=>document.getElementById('player-shade').style.display==='none',null,{timeout:7500});
 await player.keyboard.press('Enter');await focus(player,'player-control',1);expect(await player.evaluate(()=>window.__viptvPlayer.state)).toBe('playing');
 await player.keyboard.press('Enter');await player.waitForFunction(()=>window.__viptvPlayer.state==='paused');
 await player.waitForTimeout(5400);expect(await player.locator('#player-shade').evaluate(e=>e.style.display)).toBe('block');
 await player.keyboard.press('Enter');await player.waitForFunction(()=>window.__viptvPlayer.state==='playing');
 await player.evaluate(()=>{Object.defineProperty(HTMLMediaElement.prototype,'buffered',{configurable:true,get:()=>({length:2,start:i=>[0,600][i],end:i=>[400,900][i]})});document.getElementById('tv-video').dispatchEvent(new Event('timeupdate'));});
 await player.keyboard.press('ArrowUp');await focus(player,'player-timeline',0);await player.waitForTimeout(100);
 const geometry=await player.evaluate(()=>{let thumb,buffer=[];const walk=n=>{if(n.worldAlpha>.5){if(n.width===40&&n.height===40&&n.props.color===0xffffffff)thumb={y:n.globalTransform.ty,h:n.height};if(n.props.color===0xffffff4d&&n.height===6)buffer.push({x:n.globalTransform.tx,w:n.width,y:n.globalTransform.ty});}for(const child of n.children??[])walk(child);};walk(window.__viptvRenderer.stage.root);return {thumb,buffer};});
 expect(geometry.thumb).toEqual({y:826,h:40});expect(geometry.buffer).toHaveLength(2);expect(geometry.buffer[1].x).toBeGreaterThan(geometry.buffer[0].x+geometry.buffer[0].w);expect(geometry.buffer.every(b=>b.y===843)).toBe(true);
 await player.screenshot({path:`${out}/player-buffer-focus.png`});
 await player.keyboard.press('ArrowRight');await player.waitForTimeout(5400);expect(await player.locator('#player-shade').evaluate(e=>e.style.display)).toBe('block');
 await player.keyboard.press('Escape');await player.keyboard.press('ArrowDown');await focus(player,'player-control',1);
 await player.waitForFunction(()=>document.getElementById('player-shade').style.display==='none',null,{timeout:7500});
 await player.evaluate(()=>clearInterval(window.__tick));console.log('Player: continuous ticks do not postpone hide; reveal-only Enter, pause/seek guards, focused handle, real disjoint buffer and bottom placement passed');
 await player.close();
}finally{await browser.close();}
