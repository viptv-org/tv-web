import { chromium, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { installBackend, installMediaStubs } from './backend.ts';
const url=process.env.SOLID_PREVIEW_URL, origin=process.env.PREVIEW_API_ORIGIN;
if(!url?.startsWith('https://')||!origin?.startsWith('https://'))throw new Error('Use local HTTPS for the SolidTV polish audit');
const out=process.env.PREVIEW_OUT??'/tmp/tv-polish-audit';mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
const focus=(page,view,index)=>page.waitForFunction(({view,index})=>window.__viptvFocus?.view===view&&(index===undefined||window.__viptvFocus.index===index),{view,index},{timeout:7000}).catch(async error=>{await page.screenshot({path:`${out}/failure.png`});throw new Error(`${view}:${index} actual ${JSON.stringify(await page.evaluate(()=>window.__viptvFocus))}: ${error.message}`);});
async function fixture(width=1920,options={},setup) {
 const page=await browser.newPage({viewport:{width,height:width*9/16}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const backend=await installBackend(page,{family:'tv',session:'ready',sourcesDone:true,...options});
 await setup?.(page);
 await page.goto(`${url}?platform=vizio&focusdebug=1`);
 return {page,backend,errors};
}
async function rail(page,index) {
 await page.keyboard.press('ArrowLeft');await focus(page,'rail-item',2);
 for(let i=2;i<index;i++)await page.keyboard.press('ArrowDown');
 await page.keyboard.press('Enter');
}
async function focusedBounds(page,height) {
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 return page.evaluate(height=>{
  const list=[];const walk=n=>{
   if(n.worldAlpha>.5&&n.props.color===0xffffffff&&n.height===height)list.push({x:n.globalTransform.tx,y:n.globalTransform.ty,right:n.globalTransform.tx+n.width});
   for(const child of n.children??[])walk(child);
  };walk(window.__viptvRenderer.stage.root);return list;
 },height);
}
try {
 {
  let slowDone=false;
  const {page,errors}=await fixture(1920,{},async page=>{
   await page.route(`${origin}/api/profiles/*/continue/page*`,route=>route.fulfill({json:{items:[{id:'tt-monster:1:1',type:'series',series_id:'tt-monster',name:'Monster',season:1,episode:1,position:4,duration:3120,queue_status:'resume'},{id:'tt-obsession',type:'movie',name:'Obsession',position:16,duration:6540,queue_status:'resume'}],offset:0,total:2,next_offset:null}}));
   await page.route(`${origin}/api/meta/movie/tt-obsession`,async route=>{await new Promise(resolve=>setTimeout(resolve,2500));slowDone=true;await route.fallback();});
  });
  await focus(page,'home-action',0);
  await page.waitForFunction(()=>{let found=false;const walk=n=>{if(n.viptvText?.includes('Episode One')&&n.globalTransform.ty>900&&n.worldAlpha>.5&&n.isRenderable)found=true;for(const child of n.children??[])walk(child);};walk(window.__viptvRenderer.stage.root);return found;},null,{timeout:1500});
  expect(slowDone).toBe(false);expect(errors).toEqual([]);await page.close();console.log('Continue Watching metadata paints per card before the slowest queue item completes');
 }
 {
  const {page,errors}=await fixture();await focus(page,'home-action',0);
  await page.waitForFunction(()=>{let found=false;const walk=n=>{if(n.viptvText==='Recently watched live TV')found=true;for(const child of n.children??[])walk(child);};walk(window.__viptvRenderer.stage.root);return found;});
  const headingY=()=>page.evaluate(()=>{let y;const walk=n=>{if(n.viptvText==='Continue watching'&&n.worldAlpha>.5)y=n.globalTransform.ty;for(const child of n.children??[])walk(child);};walk(window.__viptvRenderer.stage.root);return y;});
  expect(await headingY()).toBe(700);
  await page.keyboard.press('ArrowDown');await focus(page,'home-card',0);expect(await headingY()).toBe(700);
  await page.keyboard.press('ArrowDown');await focus(page,'home-card',1100);await focusedBounds(page,188);expect(await headingY()).toBe(54);
  await page.screenshot({path:`${out}/home-lower-shelf.png`});
  await page.keyboard.press('ArrowUp');await focus(page,'home-card',0);await focusedBounds(page,188);expect(await headingY()).toBe(700);
  const icons=()=>page.evaluate(()=>{const ys=new Set();const walk=n=>{if(n.worldAlpha>.5&&n.width===28&&n.height===28&&n.globalTransform.tx===58)ys.add(n.globalTransform.ty);for(const child of n.children??[])walk(child);};walk(window.__viptvRenderer.stage.root);return [...ys].sort((a,b)=>a-b);});
  const collapsed=await icons();await page.keyboard.press('ArrowLeft');await focus(page,'rail-item',2);await focusedBounds(page,76);
  expect(await icons()).toEqual(collapsed);expect(collapsed).toEqual([202,280,358,436,514,976]);
  expect(errors).toEqual([]);await page.close();console.log('Continue Watching stays at top; lower rows retain full headings; rail icon geometry is invariant');
 }
 for(const width of [1920,1280]) {
  const {page,backend,errors}=await fixture(width,{},async page=>{
   await page.route(`${origin}/api/catalogs`,route=>route.fulfill({json:[...Array.from({length:20},(_,i)=>({id:`catalog-${i}`,name:`Catalog ${i}`,addon_name:`Provider ${i}`,addon_id:i+1,type:'movie',extra:[]})),{id:'series',type:'series',name:'Series',addon_id:1,extra:[]}]}));
  });
  await focus(page,'home-action',0);await rail(page,3);await focus(page,'discover-card',0);
  await page.keyboard.press('ArrowUp');await focus(page,'discover-chip',2);
  await page.keyboard.press('ArrowUp');await focus(page,'discover-chip',0);
  await page.keyboard.press('ArrowDown');await focus(page,'discover-chip',2);
  for(let index=3;index<22;index++){
   await page.keyboard.press('ArrowRight');await focus(page,'discover-chip',index);
   const bounds=await focusedBounds(page,64);expect(bounds).toHaveLength(1);expect(bounds[0].x).toBeGreaterThanOrEqual(188);expect(bounds[0].right).toBeLessThanOrEqual(1828);
  }
  await page.keyboard.press('Enter');await page.waitForTimeout(100);
  expect(backend.requests.some(r=>r.path==='/api/discover'&&r.query.includes('catalog=catalog-19'))).toBe(true);
  await page.keyboard.press('ArrowDown');await focus(page,'discover-card',0);
  await page.keyboard.press('ArrowUp');await focus(page,'discover-chip',21);
  await page.screenshot({path:`${out}/discover-${width}.png`});expect(errors).toEqual([]);await page.close();
  console.log(`${width}: all 20 catalog chips, both rows, selection and result return passed`);
 }
 {
  const {page,errors}=await fixture(1920,{},async page=>{
   await page.route(u=>u.origin===origin&&u.pathname==='/api/live',route=>route.fulfill({json:{channels:[{id:'abc-news-live',type:'live',name:'ABC News Live',logo:'https://art.example/station.svg'}],total:1,offset:0}}));
   await page.route('https://art.example/station.svg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80"><rect width="400" height="80" fill="#f5c542"/><text x="10" y="58" font-size="50">ABC NEWS</text></svg>'}));
   await page.clock.setFixedTime(new Date('2026-09-23T10:55:00-04:00'));
   await page.route(`${origin}/api/live/categories**`,route=>route.fulfill({json:{categories:Array.from({length:24},(_,i)=>({id:`category-${i}`,name:`Channel category ${i}`,count:1})),total:24}}));
  });
  await focus(page,'home-action',0);await rail(page,4);await focus(page,'guide-channel',0);
  await page.waitForFunction(()=>{let count=0;const walk=n=>{if(n.worldAlpha>.5&&n.texture?.props?.src?.includes?.('station.svg')&&n.isRenderable)count++;for(const child of n.children??[])walk(child);};walk(window.__viptvRenderer.stage.root);return count>=2;});
  await page.keyboard.press('ArrowUp');await focus(page,'live-filter',1);
  for(let index=2;index<28;index++){
   await page.keyboard.press('ArrowRight');await focus(page,'live-filter',index);
   const bounds=await focusedBounds(page,64);expect(bounds).toHaveLength(1);expect(bounds[0].x).toBeGreaterThanOrEqual(188);expect(bounds[0].right).toBeLessThanOrEqual(1828);
  }
  await page.screenshot({path:`${out}/guide-categories.png`});
  await page.keyboard.press('ArrowDown');await focus(page,'guide-channel',0);
  await page.keyboard.press('ArrowRight');await focus(page,'guide-program');
  for(let step=0;step<12;step++){
   await page.keyboard.press('ArrowRight');await focus(page,'guide-program');
   await expect.poll(async()=> (await focusedBounds(page,96)).length).toBe(1).catch(async error=>{await page.screenshot({path:`${out}/guide-failure.png`});throw new Error(`Guide step ${step}, state ${JSON.stringify(await page.evaluate(()=>({focus:window.__viptvFocus,guide:window.__viptvLive})))}: ${error.message}`);});
   const bounds=await focusedBounds(page,96);expect(bounds).toHaveLength(1);expect(bounds[0].x).toBeGreaterThanOrEqual(488);expect(bounds[0].right).toBeLessThanOrEqual(1828);
  }
  expect(errors).toEqual([]);await page.close();console.log('24 guide categories and repeated future program navigation remain onscreen');
 }
 {
  const {page,errors}=await fixture(1920,{session:'profiles'});await focus(page,'profile-tile',0);await page.waitForTimeout(100);
  const result=await page.evaluate(async()=>{
   let blanks=0;const ids=new Map();
   for(let frame=0;frame<90;frame++){
    if(frame%10===0){const key=frame%20===0?'ArrowRight':'ArrowLeft';document.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));document.dispatchEvent(new KeyboardEvent('keyup',{key,bubbles:true}));}
    await new Promise(requestAnimationFrame);
    const visible=new Set();const walk=n=>{if(['vynxc','zayne'].includes(n.viptvText)&&n.worldAlpha>.5){if(n.isRenderable)visible.add(n.viptvText);const previous=ids.get(n.viptvText);if(previous&&previous!==n.id)throw new Error('Caption node replaced');ids.set(n.viptvText,n.id);}for(const child of n.children??[])walk(child);};walk(window.__viptvRenderer.stage.root);
    if(visible.size!==2)blanks++;
   }return {frames:90,blanks};
  });expect(result.blanks).toBe(0);console.log('Profile captions:',result);expect(errors).toEqual([]);await page.close();
 }
 {
  const {page,errors}=await fixture(1920,{playbackHang:true},page=>installMediaStubs(page));await focus(page,'home-action',0);
  await page.keyboard.press('Enter');await focus(page,'source-row',0);await page.keyboard.press('Enter');
  await expect(page.locator('#solid-preparing-spinner')).toBeVisible();
  await page.screenshot({path:`${out}/preparing.png`});await page.keyboard.press('Escape');await expect(page.locator('#solid-preparing-spinner')).toBeHidden();
  expect(errors).toEqual([]);await page.close();console.log('Preparing spinner and cancellation passed');
 }
} finally {await browser.close();}
