import { test, expect } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';

test('PS4 Cross clicks activate the focused navigation item and source row',async({page,baseURL})=>{
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'userAgent',{configurable:true,get:()=> 'Mozilla/5.0 (PlayStation 4 12.00) AppleWebKit/605.1.15'});
  const getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:any[]){return type.includes('webgl')?null:getContext.apply(this,[type,...args] as any);} as typeof getContext;
 });
 const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true});await page.goto('/tv/?focusdebug=1');
 const state=page.locator('html');await expect(state).toHaveAttribute('data-tv-startup','ready');await expect(state).toHaveAttribute('data-tv-ready','true');
 await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowLeft');
 await page.mouse.click(20,20);await expect(state).toHaveAttribute('data-tv-screen','search');
 for(let i=0;i<5&&!(await state.getAttribute('data-tv-focus'))?.startsWith('nav:');i++)await page.keyboard.press('ArrowUp');
 await expect(state).toHaveAttribute('data-tv-focus',/^nav:/);await page.keyboard.press('ArrowRight');await page.mouse.click(20,20);await expect(state).toHaveAttribute('data-tv-screen','home');
 await page.mouse.click(20,20);await expect(state).toHaveAttribute('data-tv-overlay','sources');await expect(state).toHaveAttribute('data-tv-sources','8');await expect(state).toHaveAttribute('data-tv-ready','true');
 await page.keyboard.press('ArrowDown');await expect(state).toHaveAttribute('data-tv-source-choice','1');
 await page.mouse.click(20,20);await expect(state).toHaveAttribute('data-tv-player-state','playing');await expect(state).toHaveAttribute('data-tv-overlay','');
 expect(fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST')).toHaveLength(1);
});

test('signed-out Canvas startup clears recovery and Sign in opens pairing with pointer and Enter',async({page,baseURL},testInfo)=>{
 await page.setViewportSize({width:1540,height:754});await page.emulateMedia({reducedMotion:'no-preference'});
 await page.addInitScript(()=>{const getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:any[]){return type.includes('webgl')?null:getContext.apply(this,[type,...args] as any);} as typeof getContext;});
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await installRemoteBackend(page,baseURL!,{session:false});
 await page.route('**/api/auth/device/token',route=>route.fulfill({status:401,json:{error_code:'authorization_pending'}}));
 await page.goto('/tv/?focusdebug=1');
 const state=page.locator('html');await expect(state).toHaveAttribute('data-tv-screen','welcome');await expect(state).toHaveAttribute('data-tv-startup','ready');
 await expect(page.locator('#solid-startup')).toHaveCount(0);
 await expect.poll(()=>page.locator('#app canvas').evaluate(element=>{const canvas=element as HTMLCanvasElement,p=canvas.getContext('2d')!.getImageData(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1).data;return Math.max(p[0],p[1],p[2]);})).toBeLessThan(100);
 await page.screenshot({path:testInfo.outputPath('canvas-welcome.png')});
 const bounds=await page.locator('#app canvas').boundingBox();if(!bounds)throw Error('Canvas bounds absent');
 await page.mouse.click(bounds.x+bounds.width*960/1920,bounds.y+bounds.height*620/1080);
 await expect(state).toHaveAttribute('data-tv-screen','pairing');await expect(state).toHaveAttribute('data-tv-ready','true');
 await page.screenshot({path:testInfo.outputPath('canvas-pairing.png')});
 await page.keyboard.press('Escape');await expect(state).toHaveAttribute('data-tv-screen','welcome');await page.keyboard.press('Enter');
 await expect(state).toHaveAttribute('data-tv-screen','pairing');expect(errors).toEqual([]);
});

test('automatically renders the shared TV screens and prepared Next with Canvas when WebGL is absent',async({page,baseURL},testInfo)=>{
 await page.addInitScript(()=>{
  const getContext=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:any[]){
   if(type==='webgl'||type==='webgl2'||type==='experimental-webgl')return null;
   return getContext.apply(this,[type,...args] as any);
  } as typeof getContext;
 });
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
 const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true});
 await page.goto('/tv/?focusdebug=1');const state=page.locator('html');
 await expect(state).toHaveAttribute('data-renderer-backend','canvas');
 await expect(state).toHaveAttribute('data-tv-screen','home');await expect(state).toHaveAttribute('data-tv-ready','true');
 expect(requests.some(url=>url.includes('.ssdf'))).toBe(false);
 expect(await page.locator('#app canvas').evaluate(canvas=>!!(canvas as HTMLCanvasElement).getContext('2d'))).toBe(true);
 const fitted=await page.evaluate(()=>{
  const context=document.createElement('canvas').getContext('2d')!,checks:boolean[]=[];
  const walk=(node:any)=>{
   if(['Home','Series','Anime','New episode'].includes(node.viptvText)){
    const p=node.textProps;context.font=`${p.fontSize}px ${p.fontFamily}`;const width=context.measureText(p.text).width;
    checks.push(p.maxWidth+0.01>=width);
    if(node.viptvText==='New episode')checks.push(node.parent.w>=width+19);
   }
   node.children?.forEach(walk);
  };walk((window as any).__viptvRenderer.stage.root);return checks;
 });
 expect(fitted.length).toBeGreaterThan(3);expect(fitted.every(Boolean)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('canvas-home.png')});
 await page.keyboard.press('Enter');await expect(state).toHaveAttribute('data-tv-overlay','sources');
 await expect(state).toHaveAttribute('data-tv-sources','8');await expect(state).toHaveAttribute('data-tv-ready','true');await page.keyboard.press('Enter');
 await expect(state).toHaveAttribute('data-tv-player-state','playing');await expect(state).toHaveAttribute('data-tv-overlay','');
 await expect.poll(()=>page.locator('video').evaluate(v=>(v as HTMLVideoElement).videoWidth)).toBe(160);
 await page.screenshot({path:testInfo.outputPath('canvas-player.png')});
 await expect(state).toHaveAttribute('data-tv-next-prepared','true');
 expect(fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST')).toHaveLength(1);
 await page.keyboard.press('ArrowUp');for(let i=0;i<3;i++)await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
 await expect(state).toHaveAttribute('data-tv-player-episode','2');await expect(state).toHaveAttribute('data-tv-ready','true');
 await expect(state).toHaveAttribute('data-tv-player-state','playing');await expect(state).toHaveAttribute('data-tv-overlay','');
 expect(fixture.requests.filter(r=>r.path==='/api/streams'&&r.body.episode===2)).toHaveLength(1);
});

test('fits the shared TV canvas inside a console browser viewport without requesting fullscreen',async({page,baseURL},testInfo)=>{
 await page.setViewportSize({width:1540,height:754});
 await page.addInitScript(()=>{const getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:any[]){if(type.includes('webgl'))return null;return getContext.apply(this,[type,...args] as any);} as typeof getContext;});
 await installRemoteBackend(page,baseURL!);await page.goto('/tv/');
 await expect(page.locator('html')).toHaveAttribute('data-tv-ready','true');await expect(page.locator('html')).toHaveAttribute('data-renderer-backend','canvas');
 const facts=await page.locator('#app canvas').evaluate(canvas=>{const b=canvas.getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom,ratio:b.width/b.height,fullscreen:!!document.fullscreenElement};});
 expect(facts.left).toBeGreaterThanOrEqual(-0.5);expect(facts.top).toBeGreaterThanOrEqual(-0.5);expect(facts.right).toBeLessThanOrEqual(1540.5);expect(facts.bottom).toBeLessThanOrEqual(754.5);expect(facts.ratio).toBeCloseTo(16/9,2);expect(facts.fullscreen).toBe(false);
 await page.screenshot({path:testInfo.outputPath('canvas-console-window.png')});
});

test('keeps WebGL on capable browsers without loading the Canvas fallback',async({page,baseURL})=>{
 await installRemoteBackend(page,baseURL!);const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
 await page.goto('/tv/');await expect(page.locator('html')).toHaveAttribute('data-tv-ready','true');
 await expect(page.locator('html')).toHaveAttribute('data-renderer-backend','webgl');
 expect(requests.some(url=>/canvas-renderer[-.]/.test(url))).toBe(false);
});

test('retains square startup recovery and saved state when no graphics context is available',async({page,baseURL})=>{
 await installRemoteBackend(page,baseURL!);
 await page.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=(()=>null) as typeof HTMLCanvasElement.prototype.getContext;localStorage.setItem('graphics-recovery-observation','retained');});
 await page.goto('/tv/');await expect(page.locator('html')).toHaveAttribute('data-tv-startup','failed');
 const retry=page.getByRole('button',{name:'Try again'});await expect(retry).toBeVisible();
 await expect(retry).toHaveCSS('border-radius','0px');await expect(page.locator('#solid-startup-mark')).toHaveCSS('border-radius','0px');
 expect(await page.evaluate(()=>localStorage.getItem('graphics-recovery-observation'))).toBe('retained');
});
