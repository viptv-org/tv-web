import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { installRemoteBackend } from '../preview/remote-backend';
import type { Card } from '../../src/tv-solid/remote/types';

const {PNG} = createRequire(import.meta.url)('pngjs');
const colors = [[180,40,50],[50,160,60],[40,70,180],[160,90,20],[130,50,170]];
function png(rgb: number[], width=192, height=108) {
  const value = new PNG({width,height});
  for (let i=0;i<value.data.length;i+=4) value.data.set([...rgb,255],i);
  return PNG.sync.write(value);
}
async function logoBounds(page: Page) {
  const image = PNG.sync.read(await page.locator('#app canvas').screenshot());
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(let y=250;y<550;y++) for(let x=0;x<420;x++) {
    const offset=(y*image.width+x)*4;
    if(image.data[offset]>220&&image.data[offset+1]<80&&image.data[offset+2]>220) {
      left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
    }
  }
  return Number.isFinite(left)?{left,top,right,bottom}:undefined;
}
const html = (page: Page) => page.locator('html');
const scene = (page: Page) => page.evaluate(() => {
  const images: {id:number;index:number;x:number;y:number;alpha:number}[] = [], titles: string[] = [], copy: string[] = [];
  const tiles: {index:number;x:number;y:number;w:number;h:number}[] = [];
  const walls: {x:number;y:number;w:number;h:number}[] = [];
  function walk(node: any) {
    const src = node.texture?.props?.src;
    if (typeof src === 'string' && /\/carousel\/\d+\.png/.test(src) && node.props.w===1920 && node.props.h===1080)
      images.push({id:node.id,index:Number(/\/carousel\/(\d+)\.png/.exec(src)![1]),x:node.absX,y:node.absY,alpha:node.worldAlpha});
    if (typeof src === 'string' && /\/carousel\/\d+\.png/.test(src) && node.props.w===181 && node.props.h===271)
      tiles.push({index:Number(/\/carousel\/(\d+)\.png/.exec(src)![1]),x:node.absX,y:node.absY,w:node.props.w,h:node.props.h});
    if (typeof src === 'string' && src.includes('/tv-artwork/') && node.props.w===1920 && node.props.h===1080 && node.worldAlpha>.5)
      walls.push({x:node.absX,y:node.absY,w:node.props.w,h:node.props.h});
    const text = node.viptvText ?? node.props?.text;
    if (node.worldAlpha>.99 && /^Featured \d$/.test(text??'')) titles.push(text);
    if (node.worldAlpha>.99 && /^Description \d$/.test(text??'')) copy.push(text);
    node.children?.forEach(walk);
  }
  walk((window as any).__viptvRenderer.stage.root);
  return {images,tiles,walls,titles,copy,started:document.documentElement.dataset.tvHeroCycle,now:performance.now(),saver:document.documentElement.dataset.tvSaver};
});
async function setup(page: Page, origin: string, canvas: boolean, saver=false, reduced=false, logos=false) {
  await page.emulateMedia({reducedMotion:'no-preference'}); await page.clock.install();
  if (canvas) await page.addInitScript(() => {
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(this: HTMLCanvasElement,type:string,...args:any[]){return type.includes('webgl')?null:original.apply(this,[type,...args] as any);} as typeof original;
  });
  const fixture=await installRemoteBackend(page,origin);
  await page.route('**/fixture/*',route=>route.fulfill({body:png([20,30,50]),contentType:'image/png'}));
  const bootstrap=fixture.bootstrap();
  const cards:Card[]=colors.map((_,index)=>({...fixture.card,identity:{kind:'movie',id:`carousel-${index}`,ids:[]},
    title:`Featured ${index}`,description:logos?`Description ${index}`:fixture.card.description,logo:logos?`${origin}/fixture/logo/${index}.png`:null,poster:null,landscape:`${origin}/carousel/${index}.png`,progress:null,
    view:{saved:false,progress:null},badges:[]}));
  bootstrap.home!.hero=cards[0];bootstrap.home!.featured=cards;bootstrap.home!.rows=[];
  bootstrap.preferences!.display!.screen_saver_minutes=saver?1:0;
  bootstrap.preferences!.display!.reduce_motion=reduced?'on':'follow';
  const logoRequests:string[]=[];
  const artworkRequests:string[]=[];
  await page.route('**/api/bootstrap',route=>route.fulfill({json:bootstrap}));
  await page.route('**/fixture/logo/*.png',route=>{
    logoRequests.push(route.request().url());
    return route.fulfill({body:png([255,0,255],192,108),contentType:'image/png'});
  });
  const gates=new Map<number,{promise:Promise<void>;release:()=>void}>(),waiting=new Set<number>();
  await page.route('**/carousel/*.png',async route=>{
    const index=Number(/\/carousel\/(\d+)\.png/.exec(route.request().url())![1]);
    artworkRequests.push(route.request().url());
    const gate=gates.get(index);if(gate){waiting.add(index);await gate.promise;}
    await route.fulfill({body:png(colors[index]),contentType:'image/png'}).catch(()=>{});
  });
  const actions:{id:string;restart:boolean}[]=[],details:string[]=[],saved:string[]=[];
  await page.route('**/api/profiles/*/viewing-action',route=>{
    const body=route.request().postDataJSON(),card=body.card as Card;actions.push({id:card.identity.id,restart:body.restart});
    return route.fulfill({json:{card,label:'Play',resume:false,source_selection:'ask'}});
  });
  await page.route('**/api/meta/**',route=>{
    const id=decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!);details.push(id);
    return route.fulfill({json:{item:cards.find(card=>card.identity.id===id)??cards[0],episodes:[],seasons:[],recommendations:[]}});
  });
  await page.route('**/api/profiles/*/library',route=>{
    if(route.request().method()==='PUT')saved.push(route.request().postDataJSON().card.identity.id);
    return route.fulfill({json:{saved:true,cards:[],complete:true}});
  });
  await page.route('**/api/streams',route=>route.fulfill({json:{streams:[]}}));
  await page.goto('/tv/?focusdebug=1');
  await expect(html(page)).toHaveAttribute('data-tv-ready','true');
  await expect(html(page)).toHaveAttribute('data-renderer-backend',canvas?'canvas':'webgl');
  if(logos) await expect.poll(async()=>(await logoBounds(page))!==undefined).toBe(true);
  else await expect.poll(async()=>(await scene(page)).titles).toContain('Featured 0');
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));await page.clock.runFor(400);
  return {cards,actions,details,saved,waiting,logoRequests,artworkRequests,requests:fixture.requests,
    hold(index:number){let release!:()=>void;const promise=new Promise<void>(resolve=>{release=resolve;});gates.set(index,{promise,release});return release;},
    release(){gates.forEach(gate=>gate.release());}};
}
async function tick(page: Page) {
  await expect.poll(async()=>{await page.clock.runFor(16);return (await scene(page)).started;}).not.toBe('');
  const state=await scene(page);expect(state.started).not.toBe('');
  await page.clock.fastForward(Math.max(1,Math.ceil(9000-(state.now-Number(state.started)))+1));
}
async function title(page: Page,index: number) {
  await expect.poll(async()=>{await page.clock.runFor(16);return (await scene(page)).titles;}).toContain(`Featured ${index}`);
}
for(const canvas of [false,true]) {
  const mode=canvas?'Canvas':'WebGL';
  test(`featured wraps without moving hero artwork (${mode})`,async({page,baseURL},info)=>{
    const f=await setup(page,baseURL!,canvas);
    try {
      await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
      const frames:unknown[]=[];
      for(let index=1;index<=5;index++) {
        await tick(page);await title(page,index%5);await page.clock.runFor(60);
        const moving=await scene(page),incoming=moving.images.find(image=>image.index===index%5&&image.alpha>0)!;
        frames.push(moving);writeFileSync(info.outputPath('scroll-frames.json'),JSON.stringify(frames,null,2));
        expect(incoming).toBeTruthy();expect(incoming.x).toBeCloseTo(240,0);
        expect(moving.images).toHaveLength(2);
        if(index===1){await page.keyboard.press('ArrowRight');await page.clock.runFor(16);expect((await scene(page)).images.find(image=>image.index===1&&image.alpha>.05)?.x).toBeCloseTo(240,0);}
        await page.clock.runFor(450);expect((await scene(page)).images).toHaveLength(1);
        await expect(html(page)).toHaveAttribute('data-tv-focus',/^hero:0:0:2:/);
      }
      await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
      expect((await scene(page)).started).toBe('');await page.clock.fastForward(60000);expect((await scene(page)).titles).toContain('Featured 0');
      await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});
      await title(page,0);await page.clock.runFor(450);await page.keyboard.press('ContextMenu');
      await expect(html(page)).not.toHaveAttribute('data-tv-overlay','');await page.clock.fastForward(30000);
      expect((await scene(page)).started).toBe('');expect((await scene(page)).titles).toContain('Featured 0');
      expect(f.actions).toEqual([]);writeFileSync(info.outputPath('scroll-frames.json'),JSON.stringify(frames,null,2));
      await page.screenshot({path:info.outputPath('wrapped-hero.png')});
    }finally{f.release();}
  });
  test(`Home clearlogo stays anchored while its featured image changes (${mode})`,async({page,baseURL},info)=>{
    const f=await setup(page,baseURL!,canvas,false,false,true);
    try {
      await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
      const before=await logoBounds(page);expect(before).toBeDefined();
      const initial=(await scene(page)).started;
      await tick(page);
      console.log('incoming clearlogo artwork requests',JSON.stringify({initial,started:(await scene(page)).started,logos:f.logoRequests,artwork:f.artworkRequests}));
      await expect.poll(async()=>(await scene(page)).started).not.toBe(initial);
      await expect.poll(async()=>(await scene(page)).copy).toContain('Description 1');
      await page.clock.runFor(200);
      await expect.poll(async()=>await logoBounds(page)).toBeDefined();
      const after=await logoBounds(page);expect(after).toBeDefined();
      writeFileSync(info.outputPath('clearlogo-bounds.json'),JSON.stringify({before,after},null,2));
      for(const key of ['left','top','right','bottom'] as const) expect(Math.abs(after![key]-before![key])).toBeLessThanOrEqual(3);
    }finally{f.release();}
  });
  for(const action of ['play','save','info','hold','menu']) test(`pending incoming title cannot steal ${action} from the shown hero (${mode})`,async({page,baseURL})=>{
    const f=await setup(page,baseURL!,canvas),release=f.hold(1);
    try {
      await tick(page);await expect.poll(async()=>{await page.clock.runFor(16);return f.waiting.has(1);}).toBe(true);expect((await scene(page)).titles).toContain('Featured 0');
      if(action==='save')await page.keyboard.press('ArrowRight');
      if(action==='info'){await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');}
      if(action==='menu')await page.keyboard.press('ContextMenu');
      else if(action==='hold'){await page.keyboard.down('Enter');await page.clock.runFor(701);await page.keyboard.up('Enter');}
      else await page.keyboard.press('Enter');
      await page.clock.runFor(50);
      if(action==='save')await expect.poll(()=>f.saved).toEqual(['carousel-0']);
      else if(action==='info')await expect.poll(()=>f.details).toContain('carousel-0');
      else if(action==='menu'){await expect(html(page)).not.toHaveAttribute('data-tv-overlay','');expect((await scene(page)).titles).toContain('Featured 0');}
      else await expect.poll(()=>f.actions[0]?.id).toBe('carousel-0');
      release();await page.clock.runFor(500);expect(f.actions.some(value=>value.id==='carousel-1')).toBe(false);expect(f.details).not.toContain('carousel-1');expect(f.saved).not.toContain('carousel-1');
    }finally{f.release();}
  });
  for(const reduced of [false,true]) test(`poster-wall saver rotates images in fixed cells and consumes wake input, reduced=${reduced} (${mode})`,async({page,baseURL},info)=>{
    const f=await setup(page,baseURL!,canvas,true,reduced);
    try {
      await page.clock.fastForward(60000);await expect(html(page)).toHaveAttribute('data-tv-saver','true');
      await expect.poll(async()=>{await page.clock.runFor(32);return (await scene(page)).started;}).not.toBe('');
      await expect.poll(async()=>(await scene(page)).tiles.length).toBe(5);
      const before=await scene(page),positions=before.tiles.map(({x,y,w,h})=>({x,y,w,h}));
      expect(before.walls).toHaveLength(1);expect(before.images).toHaveLength(0);expect(before.titles).toHaveLength(0);
      await tick(page);await page.clock.runFor(60);
      const after=await scene(page);
      expect(after.walls).toHaveLength(1);expect(after.titles).toHaveLength(0);
      expect(after.tiles.map(({x,y,w,h})=>({x,y,w,h}))).toEqual(positions);
      expect(after.tiles.map(({index})=>index)).not.toEqual(before.tiles.map(({index})=>index));
      await page.clock.runFor(450);await page.screenshot({path:info.outputPath('idle-poster-wall.png')});
      if(reduced)expect(await page.evaluate(()=>{
        const event=Object.assign(new Event('viptvtextinput',{cancelable:true}),{inputType:'insertText',data:'q'});
        window.dispatchEvent(event);return event.defaultPrevented;
      })).toBe(true);
      else await page.keyboard.press('Enter');
      await expect(html(page)).toHaveAttribute('data-tv-saver','false');await page.clock.runFor(100);
      expect(f.actions).toEqual([]);expect(f.details).toEqual([]);
    }finally{f.release();}
  });
}
