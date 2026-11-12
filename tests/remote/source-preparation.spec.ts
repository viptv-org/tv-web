import { expect, test, type Page } from '@playwright/test';
import { paintedProgress, progressClip, progressPaint } from '../preview/progress-paint';
import { installRemoteBackend, referenceRoot } from '../preview/remote-backend';

const preparation = (page: Page) => page.evaluate(() => {
  const texts: string[] = [], logos: {x:number;y:number;w:number;h:number}[] = [];
  const spinners: {x:number;y:number}[] = [];
  function walk(node: any) {
    if (node.isRenderable) {
      if (node.viptvText) texts.push(node.viptvText);
      const {w,h} = node.props, x=node.absX, y=node.absY;
      if (node.texture && !node.viptvText && w>80 && h>80 && x>=559 && y>=249 && x+w<=1361 && y+h<=431)
        logos.push({x,y,w,h});
      if (w===56 && h===56 && x===932 && y===512) spinners.push({x,y});
    }
    node.children?.forEach(walk);
  }
  walk((window as any).__viptvRenderer.stage.root);
  return {texts,logos,spinners};
});

for (const canvas of [false,true]) for (const logo of ['available','absent','failed'] as const)
  for (const reduced of logo==='absent'?[true]:[true,false])
  test(`source preparation prefers ${logo} clearlogo (${canvas?'Canvas':'WebGL'}, ${reduced?'reduced':'normal'} motion)`,async({page,baseURL},testInfo)=>{
    if (canvas) await page.addInitScript(()=>{
      const original=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:any[]){
        return type.includes('webgl')?null:original.apply(this,[type,...args] as any);
      } as typeof original;
    });
    await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
    const fixture=await installRemoteBackend(page,baseURL!,{media:true});
    if (logo==='absent') fixture.card.logo=null;
    if (logo==='failed') {
      fixture.card.logo=`${baseURL}/failed-preparation-logo.png`;
      await page.route('**/failed-preparation-logo.png',route=>route.fulfill({status:503,body:'Unavailable'}));
    }
    let release!:()=>void;
    const held=new Promise<void>(resolve=>release=resolve);
    await page.route('**/api/playback',async route=>{
      if(route.request().method()!=='POST')return route.fallback();
      await held;await route.fallback().catch(()=>{});
    });
    const state=page.locator('html');
    await page.goto('/tv/?focusdebug=1');await expect(state).toHaveAttribute('data-tv-ready','true');
    await page.keyboard.press('Enter');await expect(state).toHaveAttribute('data-tv-sources','8');
    await expect(state).toHaveAttribute('data-tv-ready','true');await page.keyboard.press('Enter');
    await expect.poll(async()=>(await preparation(page)).spinners.length).toBe(1);
    if (logo==='available') {
      await expect.poll(async()=>(await preparation(page)).logos.length).toBe(1);
      await expect.poll(async()=>(await preparation(page)).texts).not.toContain(fixture.card.title);
      const box=(await preparation(page)).logos[0];
      expect(Math.abs(box.x+box.w/2-960)).toBeLessThan(1);
    } else {
      await expect.poll(async()=>(await preparation(page)).texts).toContain(fixture.card.title);
      expect((await preparation(page)).logos).toHaveLength(0);
    }
    const view=await preparation(page);
    expect(view.texts).toContain('Press Back to cancel');
    expect(view.texts).not.toContain('Opening stream…');
    expect(view.texts).not.toContain('Choose a source');
    await expect.poll(async()=>(await paintedProgress(page)).brightPixels).toBeGreaterThan(80);
    const frame=await page.screenshot({path:testInfo.outputPath(`source-${logo}.png`)});
    const paint=progressPaint(frame,true);
    expect(paint.brightPixels).toBeGreaterThan(80);
    await page.screenshot({clip:progressClip,path:testInfo.outputPath('progress-region.png')});
    await testInfo.attach('progress-pixels',{body:JSON.stringify({...paint,clip:progressClip,canvas,reduced,logo}),contentType:'application/json'});
    await page.keyboard.press('Escape');release();
    await expect(state).toHaveAttribute('data-tv-screen','home');
    expect(fixture.requests.some(request=>request.path.endsWith('/first-frame'))).toBe(false);
  });

test('slow clearlogo never holds first-frame presentation',async({page,baseURL})=>{
  const fixture=await installRemoteBackend(page,baseURL!,{media:true});
  let release!:()=>void;
  const held=new Promise<void>(resolve=>release=resolve);
  await page.route('**/fixture/274e704ffc2eeb3e73918396e294edb0.png',async route=>{
    await held;await route.fulfill({path:`${referenceRoot}/assets/274e704ffc2eeb3e73918396e294edb0.png`,contentType:'image/png'}).catch(()=>{});
  });
  const state=page.locator('html');
  await page.goto('/tv/?focusdebug=1');await expect(state).toHaveAttribute('data-tv-ready','true');
  await page.keyboard.press('Enter');await expect(state).toHaveAttribute('data-tv-sources','8');
  await expect(state).toHaveAttribute('data-tv-ready','true');await page.keyboard.press('Enter');
  await expect.poll(()=>fixture.requests.some(request=>request.path.endsWith('/first-frame'))).toBe(true);
  await expect(state).toHaveAttribute('data-tv-overlay','');
  release();await expect(state).toHaveAttribute('data-tv-screen','player');
  expect((await preparation(page)).texts).not.toContain('Press Back to cancel');
});
