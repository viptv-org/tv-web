import {test,expect} from '@playwright/test';
import {installRemoteBackend} from '../preview/remote-backend';

for (const ps4 of [false,true]) test(`remembered resume clears stale buffering and auto-hides controls (${ps4?'PS4 reports':'ordinary HTML'})`,async({page,baseURL})=>{
 test.setTimeout(45000);
 await page.addInitScript((ps4)=>{
  if(ps4){
   Object.defineProperty(navigator,'userAgent',{configurable:true,get:()=> 'Mozilla/5.0 (PlayStation 4 12.00) AppleWebKit/605.1.15'});
   Object.defineProperty(HTMLVideoElement.prototype,'getVideoPlaybackQuality',{configurable:true,value:()=>({totalVideoFrames:0})});
  }
  const add=HTMLMediaElement.prototype.addEventListener;
  HTMLMediaElement.prototype.addEventListener=function(this:HTMLMediaElement,type:string,listener:any,options?:any){
   if(type==='playing')return;
   return add.call(this,type,listener,options);
  } as typeof add;
  const play=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){this.loop=true;return play.call(this);};
  const observed=new WeakSet<HTMLMediaElement>();
  document.addEventListener('timeupdate',event=>{
   const media=event.target as HTMLMediaElement;
   if(media.tagName==='VIDEO'&&!media.paused&&media.currentTime>0&&!observed.has(media)){
    observed.add(media);media.dispatchEvent(new Event('waiting'));
   }
  },true);
 },ps4);
 const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true});
 const state=page.locator('html');await page.goto('/tv/?focusdebug=1');await expect(state).toHaveAttribute('data-tv-ready','true');
 await page.keyboard.press('Enter');await expect(state).toHaveAttribute('data-tv-sources','8');await expect(state).toHaveAttribute('data-tv-ready','true');await page.keyboard.press('Enter');
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('viptv-device-playback:v1'))).toContain('Supplier A');
 fixture.bootstrap().home!.hero!.progress=.0002;
 fixture.bootstrap().home!.featured![0].progress=.0002;
 await page.reload();await expect(state).toHaveAttribute('data-tv-ready','true');await page.keyboard.press('Enter');
 await expect.poll(()=>fixture.requests.filter(r=>r.path.endsWith('/first-frame')).length).toBe(2);
 expect(fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST')[1].body.position).toBeCloseTo(1.2);
 await expect(state).toHaveAttribute('data-tv-player-busy','false');await expect(state).toHaveAttribute('data-tv-player-state','playing');
 await expect(state).toHaveAttribute('data-tv-player-controls','false',{timeout:8000});
 // Cross the previous watchdog boundary while real HLS loops and emits clocks.
 await page.waitForTimeout(4000);
 expect(fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST')).toHaveLength(2);
 await expect(state).toHaveAttribute('data-tv-overlay','');await expect(state).toHaveAttribute('data-tv-player-busy','false');
 await page.keyboard.press('ArrowDown');await expect(state).toHaveAttribute('data-tv-player-controls','true');
 await expect(state).toHaveAttribute('data-tv-player-controls','false',{timeout:8000});
});

test('filtered source focus survives a higher-ranked arrival',async({page,baseURL})=>{
 const fixture=await installRemoteBackend(page,baseURL!,{finding:true,media:true});const state=page.locator('html');
 await page.goto('/tv/?focusdebug=1');await expect(state).toHaveAttribute('data-tv-ready','true');await page.keyboard.press('Enter');await expect(state).toHaveAttribute('data-tv-sources','8');await expect(state).toHaveAttribute('data-tv-ready','true');
 await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
 await expect(state).toHaveAttribute('data-tv-source-menu','provider');await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await expect(state).toHaveAttribute('data-tv-source-filter','Supplier B');await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');
 await expect(state).toHaveAttribute('data-tv-source-identity','stream-3');fixture.addBestSource();await expect(state).toHaveAttribute('data-tv-sources','9');
 await expect(state).toHaveAttribute('data-tv-source-identity','stream-3');await expect(state).toHaveAttribute('data-tv-source-choice','1');
 await page.keyboard.press('Enter');await expect.poll(()=>fixture.requests.some(r=>r.path==='/api/playback'&&r.body.stream_id==='stream-3')).toBe(true);
});

test('an open provider filter keeps the highlighted option as providers arrive',async({page,baseURL})=>{
 const fixture=await installRemoteBackend(page,baseURL!,{finding:true});const state=page.locator('html');
 await page.goto('/tv/?focusdebug=1');await expect(state).toHaveAttribute('data-tv-ready','true');await page.keyboard.press('Enter');await expect(state).toHaveAttribute('data-tv-sources','8');await expect(state).toHaveAttribute('data-tv-ready','true');
 await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await page.keyboard.press('ArrowDown');
 fixture.addBestSource();await expect(state).toHaveAttribute('data-tv-sources','9');await page.keyboard.press('Enter');
 await expect(state).toHaveAttribute('data-tv-source-filter','Supplier A');
});

test('player vertical movement preserves the selected toolbar button and cancels seek previews',async({page,baseURL})=>{
 const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true});const state=page.locator('html');
 await page.goto('/tv/?focusdebug=1');await expect(state).toHaveAttribute('data-tv-ready','true');await page.keyboard.press('Enter');await expect(state).toHaveAttribute('data-tv-sources','8');await expect(state).toHaveAttribute('data-tv-ready','true');await page.keyboard.press('Enter');
 await expect.poll(()=>fixture.requests.some(r=>r.path.endsWith('/first-frame'))).toBe(true);await page.keyboard.press('Space');await expect(state).toHaveAttribute('data-tv-player-state','paused');
 await page.keyboard.press('ArrowUp');const first=await state.getAttribute('data-tv-source-choice');await page.keyboard.press('ArrowUp');expect(await state.getAttribute('data-tv-source-choice')).toBe(first);
 await page.keyboard.press('ArrowRight');const selected=await state.getAttribute('data-tv-source-choice');await page.keyboard.press('ArrowDown');await expect(state).toHaveAttribute('data-tv-player-timeline-focus','true');await page.keyboard.press('ArrowUp');expect(await state.getAttribute('data-tv-source-choice')).toBe(selected);
 for(let i=0;i<5;i++)await page.keyboard.press('ArrowLeft');await expect(state).toHaveAttribute('data-tv-source-choice','0');await expect(state).toHaveAttribute('data-tv-player-timeline-focus','false');
 await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');await expect(state).toHaveAttribute('data-tv-player-state','playing');
 expect(fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST')).toHaveLength(1);
});
