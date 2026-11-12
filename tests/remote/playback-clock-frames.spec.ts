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
  await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');
  await expect.poll(()=>fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST').some(r=>r.body.position===2)).toBe(true);
  await expect(state).toHaveAttribute('data-tv-player-state','paused');
  await expect.poll(async()=>(await clocks(page)).position).toBeCloseTo(2,1);
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
