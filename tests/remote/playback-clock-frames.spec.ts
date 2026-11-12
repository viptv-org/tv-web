import { test, expect, type Page } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';

async function mediaKey(page: Page, key: 'MediaPause' | 'MediaPlay' | 'MediaStop') {
  await page.evaluate(key => {
    const keyCode={MediaPause:19,MediaPlay:415,MediaStop:413}[key];
    for(const type of ['keydown','keyup'])window.dispatchEvent(new KeyboardEvent(type,{key,keyCode,bubbles:true,cancelable:true}));
  },key);
}
const clocks=(page: Page)=>page.evaluate(()=>{
  const video=document.querySelector('video')!;
  const data=document.documentElement.dataset;
  return {position:video.currentTime,snapshot:Number(data.tvPlayerPosition),presented:Number(data.tvPlayerPresentedPosition),
    frames:video.getVideoPlaybackQuality().totalVideoFrames,paused:video.paused};
});
for(const canvas of [false,true])test(`sparse PS4 media clocks stay authoritative through pause, manual skip and Next (${canvas?'Canvas':'WebGL'})`,async({page,baseURL},info)=>{
  await page.addInitScript(canvas=>{
    Object.defineProperty(navigator,'userAgent',{configurable:true,get:()=> 'Mozilla/5.0 (PlayStation 4 12.00) AppleWebKit/605.1.15'});
    document.addEventListener('timeupdate',event=>{if(event.target instanceof HTMLVideoElement)event.stopImmediatePropagation();},true);
    if(canvas){
      const getContext=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:any[]){return type.includes('webgl')?null:getContext.apply(this,[type,...args] as any);} as typeof getContext;
    }
  },canvas);
  const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true});
  const introEnd=3;
  await page.route('**/api/playback/*/segments',route=>route.fulfill({json:{segments:[{kind:'intro',start_ms:0,end_ms:introEnd*1000}]}}));
  const state=page.locator('html');await page.goto('/tv/?platform=web&focusdebug=1');
  await expect(state).toHaveAttribute('data-renderer-backend',canvas?'canvas':'webgl');
  await expect(state).toHaveAttribute('data-tv-ready','true');await page.keyboard.press('Enter');
  await expect(state).toHaveAttribute('data-tv-sources','8');await expect(state).toHaveAttribute('data-tv-ready','true');await page.keyboard.press('Enter');
  try { await expect.poll(async()=>(await clocks(page)).snapshot).toBeGreaterThan(1.4); }
  finally { await info.attach('initial-media-clocks',{body:JSON.stringify(await clocks(page)),contentType:'application/json'}); }
  const before=await clocks(page);expect(before.frames).toBeGreaterThan(10);expect(before.presented).toBeGreaterThan(1);
  expect(Math.abs(before.position-before.snapshot)).toBeLessThan(.4);
  await mediaKey(page,'MediaPause');await expect(state).toHaveAttribute('data-tv-player-state','paused');
  const paused=await clocks(page);await page.waitForTimeout(350);const held=await clocks(page);
  expect(held.paused).toBe(true);expect(Math.abs(held.position-paused.position)).toBeLessThan(.08);
  expect(Math.abs(held.snapshot-held.position)).toBeLessThan(.08);
  expect(held.position,'owned intro must remain actionable after pause').toBeLessThan(introEnd);
  await expect.poll(()=>page.evaluate(()=>{const labels:string[]=[];function walk(node:any){if(node.isRenderable&&node.viptvText)labels.push(node.viptvText);node.children?.forEach(walk);}walk((window as any).__viptvRenderer.stage.root);return labels;})).toContain('Skip intro');
  await page.keyboard.press('ArrowUp');await expect(state).toHaveAttribute('data-tv-player-timeline-focus','false');await expect(state).toHaveAttribute('data-tv-source-choice','1');await page.keyboard.press('Enter');
  await expect.poll(()=>fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST').some(r=>r.body.position===introEnd)).toBe(true);
  await expect(state).toHaveAttribute('data-tv-player-state','paused');
  await expect.poll(async()=>(await clocks(page)).position).toBeCloseTo(introEnd,1);
  await mediaKey(page,'MediaPlay');await expect.poll(async()=>(await clocks(page)).presented).toBeGreaterThan(2.3);
  await expect(state).toHaveAttribute('data-tv-next-prepared','true');
  await page.keyboard.press('ArrowUp');for(let i=0;i<8;i++)await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
  await expect(state).toHaveAttribute('data-tv-player-episode','2');await expect(state).toHaveAttribute('data-tv-player-state','playing');
  await expect.poll(async()=>(await clocks(page)).snapshot).toBeGreaterThan(1.2);
  const next=await clocks(page);expect(next.frames).toBeGreaterThan(10);expect(next.presented).toBeGreaterThan(1);
  expect(Math.abs(next.position-next.snapshot)).toBeLessThan(.4);
  await mediaKey(page,'MediaPause');await expect(state).toHaveAttribute('data-tv-player-state','paused');
  const nextPaused=await clocks(page);expect(Math.abs(nextPaused.snapshot-nextPaused.position)).toBeLessThan(.08);
  expect(fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST')).toHaveLength(3);
  await mediaKey(page,'MediaStop');await expect(state).toHaveAttribute('data-tv-screen','home');
});

test('clock-only console startup acknowledges transport without persisting video evidence',async({page,baseURL})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'userAgent',{configurable:true,get:()=> 'Mozilla/5.0 (PlayStation 4 12.00) AppleWebKit/605.1.15'});
    const quality=HTMLVideoElement.prototype.getVideoPlaybackQuality;
    (window as any).__actualVideoFrames=(video:HTMLVideoElement)=>quality.call(video).totalVideoFrames;
    Object.defineProperty(HTMLVideoElement.prototype,'getVideoPlaybackQuality',{configurable:true,value:()=>({totalVideoFrames:0,droppedVideoFrames:0})});
    for(const property of ['webkitDecodedFrameCount','mozDecodedFrames'])Object.defineProperty(HTMLVideoElement.prototype,property,{configurable:true,get:()=>0});
    Object.defineProperty(HTMLVideoElement.prototype,'requestVideoFrameCallback',{configurable:true,value:undefined});
  });
  const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true});
  const state=page.locator('html');await page.goto('/tv/?platform=web&focusdebug=1');
  await expect(state).toHaveAttribute('data-tv-ready','true');await page.keyboard.press('Enter');
  await expect(state).toHaveAttribute('data-tv-sources','8');await expect(state).toHaveAttribute('data-tv-ready','true');await page.keyboard.press('Enter');
  await expect.poll(async()=>Number(await state.getAttribute('data-tv-player-position'))).toBeGreaterThan(1.2);
  await expect.poll(()=>page.locator('video').evaluate(video=>(window as any).__actualVideoFrames(video))).toBeGreaterThan(10);
  await expect(state).toHaveAttribute('data-tv-player-state','playing');await expect(state).toHaveAttribute('data-tv-player-busy','false');
  expect(fixture.requests.filter(request=>request.path.endsWith('/first-frame'))).toHaveLength(1);
  expect(await page.evaluate(()=>localStorage.getItem('viptv-device-playback:v1')??'')).not.toContain('Supplier A');
  await expect(state).toHaveAttribute('data-tv-next-prepared','false');
  await mediaKey(page,'MediaStop');await expect(state).toHaveAttribute('data-tv-screen','home');
});

for(const canvas of [false,true])test(`on-screen Play/Pause never writes a seek target (${canvas?'Canvas':'WebGL'})`,async({page,baseURL})=>{
  await page.addInitScript(canvas=>{
    Object.defineProperty(navigator,'userAgent',{configurable:true,get:()=> 'Mozilla/5.0 (PlayStation 4 12.00) AppleWebKit/605.1.15'});
    const time=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'currentTime')!;
    (window as any).__seekWrites=[];
    Object.defineProperty(HTMLMediaElement.prototype,'currentTime',{configurable:true,get:time.get,set(value:number){(window as any).__seekWrites.push(value);time.set!.call(this,value);}});
    if(canvas){const getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:any[]){return type.includes('webgl')?null:getContext.apply(this,[type,...args] as any);} as typeof getContext;}
  },canvas);
  const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true});const state=page.locator('html');
  await page.goto('/tv/?platform=web&focusdebug=1');await expect(state).toHaveAttribute('data-tv-ready','true');await page.keyboard.press('Enter');
  await expect(state).toHaveAttribute('data-tv-sources','8');await expect(state).toHaveAttribute('data-tv-ready','true');await page.keyboard.press('Enter');
  await expect.poll(async()=>(await clocks(page)).presented).toBeGreaterThan(.5);
  await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowLeft');
  await expect(state).toHaveAttribute('data-tv-player-timeline-focus','false');await expect(state).toHaveAttribute('data-tv-source-choice','0');
  await page.evaluate(()=>(window as any).__seekWrites=[]);
  const before=await clocks(page);await page.keyboard.press('Enter');await expect(state).toHaveAttribute('data-tv-player-state','paused');
  const paused=await clocks(page);expect(Math.abs(paused.position-before.position)).toBeLessThan(.2);
  await page.waitForTimeout(250);expect(Math.abs((await clocks(page)).position-paused.position)).toBeLessThan(.08);
  expect(await page.evaluate(()=>(window as any).__seekWrites)).toEqual([]);
  await page.keyboard.press('Enter');await expect(state).toHaveAttribute('data-tv-player-state','playing');
  await expect.poll(async()=>(await clocks(page)).presented).toBeGreaterThan(paused.position+.2);
  await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');await expect(state).toHaveAttribute('data-tv-player-state','paused');
  expect(await page.evaluate(()=>(window as any).__seekWrites)).toEqual([]);
  expect(fixture.requests.filter(request=>request.path==='/api/playback'&&request.method==='POST')).toHaveLength(1);
  await mediaKey(page,'MediaStop');await expect(state).toHaveAttribute('data-tv-screen','home');
});
