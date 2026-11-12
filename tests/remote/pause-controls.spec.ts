import { expect, test, type Page } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';

async function mediaKey(page: Page, key: 'MediaPause' | 'MediaPlay' | 'MediaStop') {
  await page.evaluate(key => {
    for (const type of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(type, {key, keyCode:{MediaPause:19,MediaPlay:415,MediaStop:413}[key], bubbles:true,cancelable:true}));
  }, key);
}
for (const canvas of [false, true]) test(`hidden Select and MediaPause reveal retained paused controls (${canvas?'Canvas':'WebGL'})`, async ({page,baseURL}) => {
  test.setTimeout(60000);
  await page.addInitScript(canvas => {
    Object.defineProperty(navigator,'userAgent',{configurable:true,get:()=> 'Mozilla/5.0 (PlayStation 4 12.00) AppleWebKit/605.1.15'});
    const time = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'currentTime')!;
    (window as any).__seekWrites=[];
    Object.defineProperty(HTMLMediaElement.prototype,'currentTime',{configurable:true,get:time.get,set(value:number){(window as any).__seekWrites.push(value);time.set!.call(this,value);}});
    const pause = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.pause=function(){
      const delay = (window as any).__pauseDelay ?? 0; (window as any).__pauseDelay=0;
      if (delay) { setTimeout(()=>pause.call(this),delay); return; }
      pause.call(this);
    };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){
      const delay = (window as any).__playDelay ?? 0; (window as any).__playDelay=0;
      return delay ? new Promise<void>(resolve=>setTimeout(resolve,delay)).then(()=>play.call(this)) : play.call(this);
    };
    if(canvas){const context=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:any[]){return type.includes('webgl')?null:context.apply(this,[type,...args] as any);} as typeof context;}
  }, canvas);
  const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true});
  await page.route('**/api/playback/*/segments',route=>route.fulfill({contentType:'application/json',body:'{"segments":[]}'}));
  const state=page.locator('html');
  await page.goto('/tv/?platform=web&focusdebug=1'); await expect(state).toHaveAttribute('data-tv-ready','true'); await page.keyboard.press('Enter');
  await expect(state).toHaveAttribute('data-tv-sources','8'); await expect(state).toHaveAttribute('data-tv-ready','true'); await page.keyboard.press('Enter');
  await expect(state).toHaveAttribute('data-tv-player-state','playing',{timeout:15000});
  await page.locator('video').evaluate(video=>{(video as HTMLVideoElement).loop=true; (window as any).__seekWrites=[];});
  await page.keyboard.press('ArrowUp'); for(let i=0;i<3;i++) await page.keyboard.press('ArrowRight');
  await expect(state).toHaveAttribute('data-tv-player-timeline-focus','false');
  await page.keyboard.press('Escape'); await expect(state).toHaveAttribute('data-tv-player-controls','false');
  await page.evaluate(()=>(window as any).__pauseDelay=6200);
  await page.keyboard.press('Enter'); await expect(state).toHaveAttribute('data-tv-player-controls','true');
  await page.waitForTimeout(5300); await expect(state).toHaveAttribute('data-tv-player-controls','true');
  await expect(state).toHaveAttribute('data-tv-player-state','paused');
  await page.waitForTimeout(5300); await expect(state).toHaveAttribute('data-tv-player-controls','true');
  expect(await page.evaluate(()=>(window as any).__seekWrites)).toEqual([]);
  expect(fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST')).toHaveLength(1);
  await page.keyboard.press('Escape'); await expect(state).toHaveAttribute('data-tv-player-controls','false'); await expect(state).toHaveAttribute('data-tv-screen','player');
  await mediaKey(page,'MediaPause'); await expect(state).toHaveAttribute('data-tv-player-controls','true');
  await page.waitForTimeout(5300); await expect(state).toHaveAttribute('data-tv-player-controls','true');
  await page.evaluate(()=>(window as any).__playDelay=6200);
  await mediaKey(page,'MediaPlay');
  await page.waitForTimeout(5300); await expect(state).toHaveAttribute('data-tv-player-state','paused'); await expect(state).toHaveAttribute('data-tv-player-controls','true');
  await expect(state).toHaveAttribute('data-tv-player-state','playing');
  await expect(state).toHaveAttribute('data-tv-player-controls','false',{timeout:7000});
  await mediaKey(page,'MediaPause'); await expect(state).toHaveAttribute('data-tv-player-state','paused'); await expect(state).toHaveAttribute('data-tv-player-controls','true');
  expect(await page.evaluate(()=>(window as any).__seekWrites)).toEqual([]);
  expect(fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST')).toHaveLength(1);
  await mediaKey(page,'MediaStop'); await expect(state).toHaveAttribute('data-tv-screen','home');
});

test('source admission retires pending pause chrome and ignores the old acknowledgement', async ({page,baseURL}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator,'userAgent',{configurable:true,get:()=> 'Mozilla/5.0 (PlayStation 4 12.00) AppleWebKit/605.1.15'});
    const pause=HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.pause=function(){
      const delay=(window as any).__pauseDelay??0; (window as any).__pauseDelay=0; const source=this.currentSrc;
      if(delay){setTimeout(()=>{if(this.currentSrc===source)pause.call(this);},delay);return;}
      pause.call(this);
    };
  });
  const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true});
  await page.route('**/api/playback/*/segments',route=>route.fulfill({json:{segments:[]}}));
  const state=page.locator('html'); await page.goto('/tv/?platform=web&focusdebug=1');
  await expect(state).toHaveAttribute('data-tv-ready','true'); await page.keyboard.press('Enter');
  await expect(state).toHaveAttribute('data-tv-sources','8'); await expect(state).toHaveAttribute('data-tv-ready','true'); await page.keyboard.press('Enter');
  await expect(state).toHaveAttribute('data-tv-player-state','playing',{timeout:15000});
  await page.locator('video').evaluate(video=>(video as HTMLVideoElement).loop=true);
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('Escape');
  await page.evaluate(()=>(window as any).__pauseDelay=20000);
  await page.keyboard.press('Enter'); await expect(state).toHaveAttribute('data-tv-player-controls','true');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  await expect(state).toHaveAttribute('data-tv-source-choice','2'); await page.keyboard.press('Enter');
  await expect(state).toHaveAttribute('data-tv-overlay','sources'); await expect(state).toHaveAttribute('data-tv-ready','true');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect.poll(()=>fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST').length).toBe(2);
  await expect(state).toHaveAttribute('data-tv-overlay',''); await expect(state).toHaveAttribute('data-tv-player-state','playing',{timeout:15000});
  await page.locator('video').evaluate(video=>(video as HTMLVideoElement).loop=true);
  await expect(state).toHaveAttribute('data-tv-player-controls','false',{timeout:7000});
  await mediaKey(page,'MediaStop'); await expect(state).toHaveAttribute('data-tv-screen','home');
});
