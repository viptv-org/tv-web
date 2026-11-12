import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { paintedProgress, progressPaint } from '../preview/progress-paint';
import { installRemoteBackend } from '../preview/remote-backend';
const { PNG } = createRequire(import.meta.url)('pngjs');
const rendered = (page: Page) => page.evaluate(() => {
  const texts: string[] = [], boxes: {x:number;y:number;w:number;h:number}[] = [];
  function walk(node: any) {
    if (node.isRenderable) {
      if (node.viptvText) texts.push(node.viptvText);
      boxes.push({x:node.absX,y:node.absY,w:node.props.w,h:node.props.h});
    }
    node.children?.forEach(walk);
  }
  walk((window as any).__viptvRenderer.stage.root);
  return {texts,boxes};
});

for (const canvas of [false,true]) test(`sharp right artwork, selected indicator and shelf gutter (${canvas ? 'Canvas' : 'WebGL'})`, async ({page,baseURL},testInfo) => {
  if (canvas) await page.addInitScript(() => {
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:any[]) {
      return type.includes('webgl') ? null : original.apply(this,[type,...args] as any);
    } as typeof original;
  });
  await page.emulateMedia({reducedMotion:'no-preference'});
  const fixture=await installRemoteBackend(page,baseURL!);
  const home=fixture.bootstrap().home!;
  home.featured=[{...fixture.card,logo:null},{...fixture.cards[2],logo:null}];
  home.hero=home.featured[0];
  await page.goto('/tv/?focusdebug=1');
  await expect(page.locator('html')).toHaveAttribute('data-tv-ready','true');
  await expect.poll(async() => (await rendered(page)).boxes.some(box=>box.x===480 && box.w===1440 && box.h===810)).toBe(true);
  const pixels=PNG.sync.read(await page.screenshot({clip:{x:96,y:780,width:6,height:4}})).data;
  expect(Math.max(...pixels.filter((_:number,index:number)=>index%4!==3))).toBeGreaterThan(220);
  const homeMarker=(await rendered(page)).boxes.filter(box=>box.x===1848 && box.w===4);
  expect(homeMarker.length).toBeGreaterThan(0);
  expect(homeMarker.every(box=>box.y>=54 && box.y+box.h<=1026)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('home-running.png')});
  await page.keyboard.press('ArrowDown');
  await expect.poll(async() => (await rendered(page)).boxes.some(box=>box.x===1848 && box.w===4 && box.h<=220)).toBe(true);
  await page.waitForTimeout(300);
  await page.screenshot({path:testInfo.outputPath('continue-sharp.png')});
});

test('delayed detail uses layout skeleton and source opening uses centered title progress', async({page,baseURL},testInfo) => {
  const fixture=await installRemoteBackend(page,baseURL!,{media:true});
  fixture.card.logo=null;
  let releaseDetail!:()=>void;
  const heldDetail=new Promise<void>(resolve=>releaseDetail=resolve);
  await page.route('**/api/meta/**',async route=>{await heldDetail;await route.fallback().catch(()=>{});});
  await page.goto('/tv/?focusdebug=1');
  const state=page.locator('html');
  await expect(state).toHaveAttribute('data-tv-ready','true');
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  await expect(state).toHaveAttribute('data-tv-screen','detail');
  await expect.poll(async()=>(await rendered(page)).boxes.some(box=>box.x===96 && box.y===(fixture.bootstrap().home!.rows[0].cards[0].identity.kind==='series'?648:668) && box.w===260 && box.h===72)).toBe(true);
  expect((await rendered(page)).texts).not.toContain('Loading title…');
  await page.screenshot({path:testInfo.outputPath('detail-skeleton.png')});
  await page.keyboard.press('Escape');releaseDetail();
  await expect(state).toHaveAttribute('data-tv-screen','home');
  await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');
  await expect(state).toHaveAttribute('data-tv-overlay','sources');
  await expect(state).toHaveAttribute('data-tv-ready','true');
  let releasePlayback!:()=>void;
  const heldPlayback=new Promise<void>(resolve=>releasePlayback=resolve);
  await page.route('**/api/playback',async route=>{if(route.request().method()!=='POST')return route.fallback();await heldPlayback;await route.fallback().catch(()=>{});});
  await page.keyboard.press('Enter');
  await expect.poll(async()=>(await rendered(page)).texts).toContain('Press Back to cancel');
  expect((await rendered(page)).texts).not.toContain('Opening stream…');
  expect((await rendered(page)).texts).toContain(fixture.card.title);
  expect((await rendered(page)).texts).not.toContain('Choose a source');
  await expect.poll(async()=>(await rendered(page)).boxes.some(box=>box.x===480 && box.w===1440 && box.h===810)).toBe(true);
  await page.waitForTimeout(100);
  await expect.poll(async()=>(await rendered(page)).boxes.some(box=>box.x===932 && box.y===512 && box.w===56 && box.h===56)).toBe(true);
  await expect.poll(async()=>(await paintedProgress(page)).brightPixels).toBeGreaterThan(80);
  const openingFrame=await page.screenshot({path:testInfo.outputPath('source-opening.png')});
  expect(progressPaint(openingFrame,true).brightPixels).toBeGreaterThan(80);
  await page.keyboard.press('Escape');releasePlayback();
  await expect(state).toHaveAttribute('data-tv-screen','home');
  expect(fixture.requests.some(request=>request.path.endsWith('/first-frame'))).toBe(false);
});

for (const key of ['Escape','Back']) test(`${key} dismisses player menu, hides controls, then releases playback`,async({page,baseURL})=>{
  await page.addInitScript(()=>{const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){this.loop=true;return play.call(this);};});
  const fixture=await installRemoteBackend(page,baseURL!,{media:true,captionTracks:true});
  const state=page.locator('html');
  const back=async()=> key==='Escape' ? page.keyboard.press('Escape') : page.evaluate(()=>{
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Back',bubbles:true,cancelable:true}));
    document.dispatchEvent(new KeyboardEvent('keyup',{key:'Back',bubbles:true,cancelable:true}));
  });
  await page.goto('/tv/?focusdebug=1');await expect(state).toHaveAttribute('data-tv-ready','true');
  await page.keyboard.press('Enter');await expect(state).toHaveAttribute('data-tv-sources','8');await expect(state).toHaveAttribute('data-tv-ready','true');await page.keyboard.press('Enter');
  await expect.poll(()=>fixture.requests.some(request=>request.path.endsWith('/first-frame'))).toBe(true);
  await expect(state).toHaveAttribute('data-tv-overlay','');
  await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');
  await expect(state).toHaveAttribute('data-tv-overlay','tracks');
  await back();await expect(state).toHaveAttribute('data-tv-overlay','');await expect(state).toHaveAttribute('data-tv-screen','player');
  await page.evaluate(key=>document.dispatchEvent(new KeyboardEvent('keydown',{key,keyCode:key==='Back'?8:27,repeat:true,bubbles:true,cancelable:true})),key);
  await expect(state).toHaveAttribute('data-tv-player-controls','true');
  await page.keyboard.press('ArrowUp');await expect(state).toHaveAttribute('data-tv-player-controls','true');
  await back();await expect(state).toHaveAttribute('data-tv-player-controls','false');await expect(state).toHaveAttribute('data-tv-screen','player');
  expect((await rendered(page)).texts).not.toContain('Audio & subtitles');
  expect(await page.locator('video').evaluate(video=>(video as HTMLVideoElement).paused)).toBe(false);
  await page.evaluate(key=>document.dispatchEvent(new KeyboardEvent('keydown',{key,keyCode:key==='Back'?8:27,repeat:true,bubbles:true,cancelable:true})),key);
  await expect(state).toHaveAttribute('data-tv-screen','player');
  await back();await expect(state).not.toHaveAttribute('data-tv-screen','player');
  await expect.poll(()=>page.locator('video').evaluate(video=>(video as HTMLVideoElement).paused)).toBe(true);
});

test('Back hides rendered controls while a managed seek is still preparing',async({page,baseURL})=>{
  const fixture=await installRemoteBackend(page,baseURL!,{media:true,captionTracks:true});
  const state=page.locator('html');
  await page.goto('/tv/?focusdebug=1');await expect(state).toHaveAttribute('data-tv-ready','true');
  await page.keyboard.press('Enter');await expect(state).toHaveAttribute('data-tv-sources','8');await expect(state).toHaveAttribute('data-tv-ready','true');await page.keyboard.press('Enter');
  await expect.poll(()=>fixture.requests.some(request=>request.path.endsWith('/first-frame'))).toBe(true);
  await page.keyboard.press('Space');await expect(state).toHaveAttribute('data-tv-player-state','paused');
  let release!:()=>void;
  const held=new Promise<void>(resolve=>release=resolve);
  await page.route('**/api/playback',async route=>{if(route.request().method()!=='POST')return route.fallback();await held;await route.fallback().catch(()=>{});});
  await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
  await expect(state).toHaveAttribute('data-tv-player-seeking','true');
  expect((await rendered(page)).texts).toContain(fixture.card.title);
  await page.keyboard.press('Escape');
  await expect(state).toHaveAttribute('data-tv-player-controls','false');
  expect((await rendered(page)).texts).not.toContain(fixture.card.title);
  expect((await rendered(page)).texts).not.toContain('Audio & subtitles');
  await expect(state).toHaveAttribute('data-tv-screen','player');
  release();
  await expect(state).toHaveAttribute('data-tv-player-seeking','false');
  await expect(state).toHaveAttribute('data-tv-player-state','paused');
  await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await expect(state).toHaveAttribute('data-tv-player-controls','false');
  expect((await rendered(page)).texts).not.toContain(fixture.card.title);
});

test('decoder buffering can remain visible after Back dismisses player chrome',async({page,baseURL})=>{
  const fixture=await installRemoteBackend(page,baseURL!,{media:true,captionTracks:true});
  const state=page.locator('html');
  await page.goto('/tv/?focusdebug=1');await expect(state).toHaveAttribute('data-tv-ready','true');
  await page.keyboard.press('Enter');await expect(state).toHaveAttribute('data-tv-sources','8');await expect(state).toHaveAttribute('data-tv-ready','true');await page.keyboard.press('Enter');
  await expect.poll(()=>fixture.requests.some(request=>request.path.endsWith('/first-frame'))).toBe(true);
  await page.keyboard.press('ArrowUp');
  await page.locator('video').evaluate(video=>{
    video.addEventListener('pause',()=>video.dispatchEvent(new Event('waiting')),{once:true});
    (video as HTMLVideoElement).pause();
  });
  await expect(state).toHaveAttribute('data-tv-player-state','buffering');
  expect((await rendered(page)).texts).toContain(fixture.card.title);
  await page.keyboard.press('Escape');
  await expect(state).toHaveAttribute('data-tv-player-controls','false');
  await expect(state).toHaveAttribute('data-tv-player-busy','true');
  expect((await rendered(page)).texts).not.toContain(fixture.card.title);
  expect((await rendered(page)).texts).toContain('Buffering…');
  await expect(state).toHaveAttribute('data-tv-screen','player');
  await page.keyboard.press('Escape');await expect(state).not.toHaveAttribute('data-tv-screen','player');
});
