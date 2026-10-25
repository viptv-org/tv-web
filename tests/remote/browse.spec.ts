import {test,expect,type Page} from '@playwright/test';
import {installRemoteBackend,referenceRoot} from '../preview/remote-backend';
const state=(page:Page)=>page.locator('html');
async function nodes(page:Page){return page.evaluate(()=>{const a:any[]=[];function v(n:any){if(n.isRenderable)a.push({x:n.absX,y:n.absY,w:n.props.w,h:n.props.h,text:n.viptvText,shader:n.shader?.shaderKey,progress:n.shader?.uniforms?.single?.u_progress?.value,src:n.texture?.props?.src});n.children?.forEach(v);}v((window as any).__viptvRenderer.stage.root);return a;});}
async function open(page:Page){await page.goto('/tv/?platform=vizio&focusdebug=1');await expect(state(page)).toHaveAttribute('data-tv-ready','true');await page.keyboard.press('ArrowDown');}
for(const action of ['play','details'] as const)test(`Browse consumes the server ${action} action and hint without deriving an episode`,async({page,baseURL})=>{
 const fixture=await installRemoteBackend(page,baseURL!);const card=fixture.bootstrap().home!.rows[0].cards[0];
 card.progress=.9;card.subtitle='Unrelated tile subtitle';card.view!.preview={background:`${baseURL}/fixture/7432c1f4e06fad8e590ad3646164759b.jpg`,caption:'Server-selected hint S99 E99',progress:.11,action};
 await open(page);
 await expect.poll(async()=>(await nodes(page)).some(n=>n.text==='Server-selected hint S99 E99'&&Math.abs(n.y-420)<=1)).toBe(true);
 expect((await nodes(page)).find(n=>n.shader==='tvHomeProgress'&&n.w===160)?.progress).toBe(.11);
 expect(fixture.requests.some(r=>r.path.startsWith('/api/meta/')||r.path.endsWith('/viewing-action')||r.path==='/api/streams')).toBe(false);
 await page.keyboard.press('Enter');
 if(action==='play'){
  await expect(state(page)).toHaveAttribute('data-tv-overlay','sources');
  await expect.poll(()=>fixture.requests.some(r=>r.path==='/api/streams'&&r.body.id==='episode-1')).toBe(true);
  expect(fixture.requests.some(r=>r.path==='/api/streams'&&r.body.id==='episode-99')).toBe(false);
  await page.keyboard.press('Escape');await expect(state(page)).toHaveAttribute('data-tv-focus',/^rows:0:0:/);
 }else{
  await expect(state(page)).toHaveAttribute('data-tv-screen','detail');
  expect(fixture.requests.some(r=>r.path==='/api/streams')).toBe(false);
 }
});

test('missing preview presentation does not become a local resume decision',async({page,baseURL})=>{
 const fixture=await installRemoteBackend(page,baseURL!);const card=fixture.bootstrap().home!.rows[0].cards[0];delete card.view!.preview;card.progress=.6;card.subtitle='Resume S7 E8';
 await open(page);await page.waitForTimeout(450);
 expect((await nodes(page)).some(n=>Math.abs(n.y-420)<=1&&n.text)).toBe(false);
 expect((await nodes(page)).some(n=>n.shader==='tvHomeProgress'&&n.w===160)).toBe(false);
 await page.keyboard.press('Enter');await expect(state(page)).toHaveAttribute('data-tv-screen','detail');expect(fixture.requests.some(r=>r.path==='/api/streams')).toBe(false);
});

test('rapid focus cancels obsolete preview settling and late artwork',async({page,baseURL})=>{
 await page.clock.install();const fixture=await installRemoteBackend(page,baseURL!);const cards=fixture.bootstrap().home!.rows[0].cards;
 for(let i=0;i<3;i++)cards[i].view!.preview={background:`${baseURL}/preview/${i}`,caption:`Preview ${i}`,progress:null,action:'details'};
 let release!:()=>void;const held=new Promise<void>(r=>release=r);const requested:string[]=[];
 await page.route('**/preview/*',async route=>{const path=new URL(route.request().url()).pathname;requested.push(path);if(path==='/preview/0')await held;await route.fulfill({contentType:'image/jpeg',path:referenceRoot+'/assets/7432c1f4e06fad8e590ad3646164759b.jpg'}).catch(()=>{});});
 await open(page);await expect.poll(()=>requested).toContain('/preview/0');
 await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.clock.fastForward(450);
 await expect.poll(()=>requested).toContain('/preview/2');expect(requested).not.toContain('/preview/1');
 await expect.poll(async()=>(await nodes(page)).some(n=>n.text==='Preview 2'&&Math.abs(n.y-420)<=1)).toBe(true);
 release();await page.clock.runFor(50);
 await expect.poll(async()=>{await page.clock.runFor(32);return(await nodes(page)).filter(n=>n.shader==='tvBrowsePreview').map(n=>n.src);}).toEqual([`${baseURL}/preview/2`]);
 expect(fixture.requests.some(r=>r.path.startsWith('/api/meta/')||r.path.endsWith('/viewing-action'))).toBe(false);
});

test('returning tile focus reuses its bounded blur pixels',async({page,baseURL})=>{
 await page.addInitScript(()=>{
  (window as any).__tileReadbacks=0;
  const read=CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData=function(...args:Parameters<typeof read>){
   if(args[2]===72&&args[3]===72)(window as any).__tileReadbacks++;
   return read.apply(this,args);
  };
 });
 const fixture=await installRemoteBackend(page,baseURL!);
 for(const card of fixture.bootstrap().home!.rows[0].cards.slice(0,2))card.view!.preview!.action='play';
 await open(page);
 const reads=()=>page.evaluate(()=>(window as any).__tileReadbacks);
 await expect.poll(reads).toBe(1);
 await page.keyboard.press('ArrowRight');await expect.poll(reads).toBe(2);
 for(let i=0;i<5;i++){await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowRight');}
 await page.waitForTimeout(100);
 expect(await reads()).toBe(2);
 expect(fixture.requests.some(r=>r.path.endsWith('/viewing-action')||r.path==='/api/streams')).toBe(false);
});
