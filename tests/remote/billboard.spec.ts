import {test,expect,type Page} from '@playwright/test';
import {createRequire} from 'node:module';
import {installRemoteBackend} from '../preview/remote-backend';
const {PNG}=createRequire(import.meta.url)('pngjs');
const state=(page:Page)=>page.locator('html');
const inspect=(page:Page)=>page.evaluate(()=>{
 const photos:{key:string;zoom:number;src:string;alpha:number}[]=[],texts:string[]=[];let cycle:number|undefined;
 function visit(n:any){
  if(n.isRenderable){
   if(n.viptvText)texts.push(n.viptvText);
   const key=n.shader?.shaderKey;
   if(key?.startsWith('tvBillboard')&&n.props.w===1920&&n.texture?.state==='loaded')photos.push({key,zoom:n.shader.uniforms.single.u_zoom.value,src:n.texture.props.src,alpha:n.worldAlpha});
   if(key==='tvHeroProgress')cycle=n.shader.uniforms.single.u_startedAt.value+(window as any).__viptvRenderer.stage.startTime;
  }
  n.children?.forEach(visit);
 }
 visit((window as any).__viptvRenderer.stage.root);
 return{photos,texts,cycle,now:performance.now(),cache:(window as any).__viptvRenderer.stage.shManager.valuesCache.size};
});
async function open(page:Page,baseURL:string,reduced:boolean,count=2){
 await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});await page.clock.install();
 const fixture=await installRemoteBackend(page,baseURL);
 const home=fixture.bootstrap().home!;
 home.featured=[{...fixture.card,title:'First server choice',logo:null},{...fixture.cards[2],title:'Second server choice',logo:null}].slice(0,count);home.hero=home.featured[0];
 await page.goto('/tv/?platform=vizio&focusdebug=1');await expect(state(page)).toHaveAttribute('data-tv-ready','true');
 await expect.poll(async()=>(await inspect(page)).photos.length).toBe(1);
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
 return fixture;
}
async function beforeCycle(page:Page){const view=await inspect(page);expect(view.cycle).toBeDefined();await page.clock.fastForward(Math.max(1,Math.floor(9000-(view.now-view.cycle!)-20)));}

test('Home cycles server order after nine seconds and pauses for interaction and menus',async({page,baseURL})=>{
 const fixture=await open(page,baseURL!,false);
 await beforeCycle(page);expect((await inspect(page)).texts).toContain('First server choice');
 await page.clock.fastForward(40);await expect.poll(async()=>(await inspect(page)).texts).toContain('Second server choice');
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
 await page.clock.fastForward(30000);expect((await inspect(page)).texts).toContain('Second server choice');
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});
 await page.clock.runFor(32);await beforeCycle(page);expect((await inspect(page)).texts).toContain('Second server choice');
 await page.clock.fastForward(40);await expect.poll(async()=>(await inspect(page)).texts).toContain('First server choice');
 await page.keyboard.press('ArrowRight');
 await beforeCycle(page);expect((await inspect(page)).texts).toContain('First server choice');
 await page.clock.fastForward(40);await expect.poll(async()=>(await inspect(page)).texts).toContain('Second server choice');
 await page.keyboard.press('ContextMenu');await expect(state(page)).not.toHaveAttribute('data-tv-overlay','');
 await page.clock.fastForward(30000);expect((await inspect(page)).texts).toContain('Second server choice');
 await page.keyboard.press('Escape');await page.clock.runFor(400);await expect(state(page)).toHaveAttribute('data-tv-overlay','');
 await beforeCycle(page);expect((await inspect(page)).texts).toContain('Second server choice');
 await page.clock.fastForward(40);await expect.poll(async()=>(await inspect(page)).texts).toContain('First server choice');
 expect(fixture.requests.some(r=>r.path.includes('/viewing-action')||r.path==='/api/playback'||r.path==='/api/streams')).toBe(false);
});

for(const reduced of [false,true])test(`Home ${reduced?'keeps reduced motion still':'zooms to 106 percent then retires its animation clock'}`,async({page,baseURL})=>{
 await open(page,baseURL!,reduced,1);
 const first=await inspect(page);const clip={x:1100,y:200,width:500,height:300};
 const pixels=PNG.sync.read(await page.screenshot({clip})).data;
 await page.clock.fastForward(7000);await page.clock.runFor(32);
 const later=PNG.sync.read(await page.screenshot({clip})).data;
 expect(pixels.equals(later)).toBe(reduced);
 expect((await inspect(page)).cache).toBeLessThanOrEqual(first.cache);
 await page.clock.fastForward(7500);await page.clock.runFor(32);
 const settled=await inspect(page);expect(settled.photos).toHaveLength(1);
 expect(settled.photos[0].key).toBe('tvBillboard');expect(settled.photos[0].zoom).toBe(reduced?1:1.06);
 expect(settled.texts).toContain('First server choice');expect(settled.cycle).toBeUndefined();
 expect(settled.cache).toBeLessThanOrEqual(first.cache);
});

test('late billboard artwork cannot cover another screen after navigation',async({page,baseURL})=>{
 await installRemoteBackend(page,baseURL!);
 let release!:()=>void,requested=false;const held=new Promise<void>(resolve=>release=resolve);
 await page.route('**/fixture/a5729872fdf6d97950dabed6371ef4d6.jpg',async route=>{requested=true;await held;await route.fallback().catch(()=>{});});
 await page.goto('/tv/?platform=vizio&focusdebug=1');await expect(state(page)).toHaveAttribute('data-tv-ready','true');await expect.poll(()=>requested).toBe(true);
 for(const key of ['ArrowUp','ArrowRight','Enter'])await page.keyboard.press(key);
 await expect(state(page)).toHaveAttribute('data-tv-screen','movie');release();await page.waitForTimeout(200);
 expect((await inspect(page)).photos).toEqual([]);await expect(state(page)).toHaveAttribute('data-tv-screen','movie');
});

test('failed billboard artwork keeps title actions usable',async({page,baseURL})=>{
 await installRemoteBackend(page,baseURL!);
 await page.route('**/fixture/a5729872fdf6d97950dabed6371ef4d6.jpg',route=>route.fulfill({status:503,body:'Unavailable'}));
 await page.goto('/tv/?platform=vizio&focusdebug=1');await expect(state(page)).toHaveAttribute('data-tv-ready','true');
 for(const key of ['ArrowRight','ArrowRight','Enter'])await page.keyboard.press(key);
 await expect(state(page)).toHaveAttribute('data-tv-screen','detail');await expect(state(page)).toHaveAttribute('data-tv-ready','true');
});

test('zero-size artwork cannot create invalid billboard coordinates',async({page,baseURL})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await installRemoteBackend(page,baseURL!);
 await page.route('**/fixture/a5729872fdf6d97950dabed6371ef4d6.jpg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"/>'}));
 await page.goto('/tv/?platform=vizio&focusdebug=1');await expect(state(page)).toHaveAttribute('data-tv-ready','true');
 await page.waitForTimeout(150);expect((await inspect(page)).photos).toEqual([]);expect(errors).toEqual([]);
 expect(await page.evaluate(()=>{let count=0;function visit(n:any){if(n.shader?.shaderKey?.startsWith('tvBillboard'))count++;n.children?.forEach(visit);}visit((window as any).__viptvRenderer.stage.root);return count;})).toBe(0);
 await page.keyboard.press('ArrowRight');await expect(state(page)).toHaveAttribute('data-tv-focus',/^hero:0:0:1:/);
});
