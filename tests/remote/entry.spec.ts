import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { installRemoteBackend } from '../preview/remote-backend';
const { PNG } = createRequire(import.meta.url)('pngjs');
const state=(page:Page)=>page.locator('html');
const nodes=(page:Page)=>page.evaluate(()=>{
  const result:{x:number;y:number;w:number;h:number;text?:string;color:number;alpha:number}[]=[];
  function visit(n:any){if(n.isRenderable)result.push({x:n.absX,y:n.absY,w:n.props.w,h:n.props.h,text:n.viptvText,color:n.props.color,alpha:n.worldAlpha});n.children?.forEach(visit);}
  visit((window as any).__viptvRenderer.stage.root);return result;
});

test('pairing countdown is server bounded; refresh clears the abandoned code and Back rejects its late reply',async({page,baseURL})=>{
  await page.clock.install();
  const fixture=await installRemoteBackend(page,baseURL!,{session:false});
  await page.goto('/tv/?platform=vizio&focusdebug=1');
  await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  await page.keyboard.press('Enter');
  await expect(state(page)).toHaveAttribute('data-tv-screen','pairing');
  await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  await expect.poll(async()=> (await nodes(page)).some(n=>n.text==='Code expires in 5:00')).toBe(true);
  expect((await nodes(page)).find(n=>n.h===48&&n.w===175)?.color).toBe(0xffffff29);
  await page.clock.fastForward(2000);
  await expect.poll(async()=> (await nodes(page)).some(n=>n.text==='Code expires in 4:58')).toBe(true);
  await page.keyboard.press('ArrowRight');
  expect((await nodes(page)).find(n=>n.h===48&&n.w===175)?.color).toBe(0xf4f2eeff);
  let release!:()=>void;let requested=false;
  const held=new Promise<void>(resolve=>release=resolve);
  await page.route('**/api/auth/device/code',async route=>{requested=true;await held;await route.fulfill({json:{device_code:'replacement',user_code:'LATE-CODE',verification_uri:`${baseURL}/device`,expires_in:300,interval:1}}).catch(()=>{});});
  await page.keyboard.press('Enter');
  await expect.poll(()=>requested).toBe(true);
  expect((await nodes(page)).some(n=>n.text==='ABCD-EFGH')).toBe(false);
  await page.keyboard.press('Escape');release();
  await expect(state(page)).toHaveAttribute('data-tv-screen','welcome');
  const polls=fixture.requests.filter(r=>r.path==='/api/auth/device/token').length;
  await page.clock.fastForward(10000);
  await expect(state(page)).toHaveAttribute('data-tv-screen','welcome');
  expect(fixture.requests.filter(r=>r.path==='/api/auth/device/token')).toHaveLength(polls);
  expect((await nodes(page)).some(n=>n.text==='LATE-CODE')).toBe(false);
});

test('rounded opacity is applied once to rendered pixels',async({page,baseURL})=>{
  await installRemoteBackend(page,baseURL!,{session:false});
  await page.goto('/tv/?platform=vizio&focusdebug=1');
  await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  await page.keyboard.press('Enter');
  await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  await page.evaluate(()=>{
    function visit(n:any){if(n.props.w===12&&n.props.h===12&&n.absX===96){n.alpha=.5;}n.children?.forEach(visit);}
    visit((window as any).__viptvRenderer.stage.root);
  });
  await page.waitForTimeout(50);
  const png=PNG.sync.read(await page.screenshot());
  const i=(915*png.width+102)*4;
  expect(Array.from(png.data.subarray(i,i+3))).toEqual([128,104,39]);
});

test('profile controls follow server management capabilities and maintain remote focus',async({page,baseURL})=>{
  const fixture=await installRemoteBackend(page,baseURL!,{session:false,pairingApproved:true,pairingProfile:false});
  const management=fixture.bootstrap().profile_management!;
  for(const name of ['create','rename','avatar','delete'])management.capabilities[name]={availability:'Unavailable'} as any;
  await page.goto('/tv/?platform=vizio&focusdebug=1');
  await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  await page.keyboard.press('Enter');
  await expect(state(page)).toHaveAttribute('data-tv-screen','signed-in');
  await page.keyboard.press('Enter');
  await expect(state(page)).toHaveAttribute('data-tv-screen','profiles');
  expect((await nodes(page)).some(n=>n.text==='Add profile'||n.text==='Manage profiles')).toBe(false);
  const focus=await state(page).getAttribute('data-tv-focus');
  await page.keyboard.press('ArrowDown');
  await expect(state(page)).toHaveAttribute('data-tv-focus',focus!);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(state(page)).toHaveAttribute('data-tv-screen','home');
  expect(fixture.requests.filter(r=>r.path==='/api/auth/profile').at(-1)?.body).toEqual({profile_id:'2'});
});

for(const reduced of [true,false])test(`entry motion ${reduced?'stays still for reduced motion':'drifts and pulses at the reference cadence'}`,async({page,baseURL})=>{
  await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
  await installRemoteBackend(page,baseURL!,{session:false});
  await page.goto('/tv/?platform=vizio&focusdebug=1');
  await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  const wall=()=>page.evaluate(()=>{let x:number|undefined;function visit(n:any){if(n.isRenderable&&n.texture?.state==='loaded'&&n.shader?.shaderKey?.startsWith('tvWelcome')){const start=n.shader.uniforms.single.u_startedAt.value;x=-60-500*(1-Math.abs(((n.time-start)/60000)%2-1));}n.children?.forEach(visit);}visit((window as any).__viptvRenderer.stage.root);return x;});
  await expect.poll(wall).toBeDefined();const start=(await wall())!;
  const shaderCache=()=>page.evaluate(()=>(window as any).__viptvRenderer.stage.shManager.valuesCache.size as number);
  const cached=await shaderCache();
  const before=PNG.sync.read(await page.screenshot({clip:{x:0,y:0,width:500,height:200}})).data;
  await page.waitForTimeout(300);
  if(reduced)expect(await wall()).toBe(start);else expect((await wall())!).toBeLessThan(start-1.5);
  const after=PNG.sync.read(await page.screenshot({clip:{x:0,y:0,width:500,height:200}})).data;
  expect(before.equals(after)).toBe(reduced);
  expect(await shaderCache()).toBe(cached);
  await page.keyboard.press('Enter');
  await expect(state(page)).toHaveAttribute('data-tv-screen','pairing');
  await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  await page.waitForTimeout(700);
  const dot=(await nodes(page)).find(n=>n.w===12&&n.h===12)!;
  if(reduced)expect(dot.alpha).toBe(1);else expect(dot.alpha).toBeLessThan(.6);
});

test('an empty profile list offers retry without inventing an Add action',async({page,baseURL})=>{
  const fixture=await installRemoteBackend(page,baseURL!,{session:false,pairingApproved:true,pairingProfile:false});
  const management=fixture.bootstrap().profile_management!;
  management.profiles=[];
  for(const name of ['create','rename','avatar','delete'])management.capabilities[name]={availability:'Unavailable'} as any;
  await page.goto('/tv/?platform=vizio&focusdebug=1');
  await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  await page.keyboard.press('Enter');
  await expect(state(page)).toHaveAttribute('data-tv-screen','signed-in');
  await page.keyboard.press('Enter');
  await expect(state(page)).toHaveAttribute('data-tv-screen','profiles');
  await expect.poll(async()=> (await nodes(page)).some(n=>n.text==='No profiles available')).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(()=>fixture.requests.filter(r=>r.path==='/api/profiles'&&r.method==='GET').length).toBe(1);
  await expect(state(page)).toHaveAttribute('data-tv-overlay','');
  expect(fixture.requests.some(r=>r.path==='/api/profiles'&&r.method==='POST')).toBe(false);
});
