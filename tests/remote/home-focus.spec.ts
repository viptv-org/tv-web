import { expect, test, type Page } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';

const state=(page:Page)=>page.locator('html');
async function press(page:Page,...keys:string[]){for(const key of keys)await page.keyboard.press(key);}
async function fixture(page:Page,baseURL:string,extraRows=0,renderer="webgl"){
  if(renderer==='canvas')await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:any[]){
      return type.includes('webgl')?null:original.apply(this,[type,...args] as any);
    } as typeof original;
  });
  const backend=await installRemoteBackend(page,baseURL,{navigation:['home','movie','library','profiles']});
  const home=backend.bootstrap().home!;
  home.rows=[{...home.rows[0],id:'continue',cards:backend.cards},
    {...home.rows[0],id:'favorites',title:'My List',cards:backend.cards},
    {...home.rows[0],id:'short-row',title:'Short row',cards:backend.cards.slice(0,2)},
    ...Array.from({length:extraRows},(_,i)=>({...home.rows[0],id:`extra-${i}`,cards:backend.cards}))];
  await page.goto('/tv/?focusdebug=1');await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  await press(page,'ArrowDown');await expect(state(page)).toHaveAttribute('data-tv-focus',/^rows:0:0:/);
}

test('vertical Home navigation restores each row and returning from the hero keeps its selection',async({page,baseURL})=>{
  await fixture(page,baseURL!);
  await press(page,...Array(5).fill('ArrowRight'));await expect(state(page)).toHaveAttribute('data-tv-focus',/^rows:5:0:/);
  await press(page,'ArrowDown',...Array(3).fill('ArrowRight'));await expect(state(page)).toHaveAttribute('data-tv-focus',/^rows:3:1:/);
  await press(page,'ArrowUp');await expect(state(page)).toHaveAttribute('data-tv-focus',/^rows:5:0:/);
  await press(page,'ArrowDown');await expect(state(page)).toHaveAttribute('data-tv-focus',/^rows:3:1:/);
  await press(page,'ArrowDown','ArrowRight');await expect(state(page)).toHaveAttribute('data-tv-focus',/^rows:1:2:/);
  await press(page,'ArrowUp');await expect(state(page)).toHaveAttribute('data-tv-focus',/^rows:3:1:/);
  await press(page,'ArrowDown');await expect(state(page)).toHaveAttribute('data-tv-focus',/^rows:1:2:/);
  await press(page,'ArrowUp','ArrowUp','ArrowUp');await expect(state(page)).toHaveAttribute('data-tv-focus',/^hero:/);
  await press(page,'ArrowDown');await expect(state(page)).toHaveAttribute('data-tv-focus',/^rows:5:0:/);
});

test('top navigation does not move Continue Watching or overwrite its selection',async({page,baseURL})=>{
  await fixture(page,baseURL!);
  await press(page,...Array(5).fill('ArrowRight'));
  const offset=()=>page.evaluate(()=>{
    let x:number|undefined;
    function walk(n:any){if(n.props.w===424&&n.props.h===238&&n.texture?.props?.src?.includes('a5729872fdf6d97950dabed6371ef4d6.jpg'))x=n.absX;n.children?.forEach(walk);}
    walk((window as any).__viptvRenderer.stage.root);return x;
  });
  const before=await offset();expect(before).toBeDefined();expect(before!).toBeLessThan(0);
  await press(page,'Escape');await expect(state(page)).toHaveAttribute('data-tv-focus',/^nav:/);
  for(const key of ['ArrowRight','ArrowRight','ArrowRight','ArrowLeft','ArrowLeft','ArrowLeft']){
    await press(page,key);expect(await offset()).toBeCloseTo(before!,2);
  }
  await press(page,'ArrowDown','ArrowDown');await expect(state(page)).toHaveAttribute('data-tv-focus',/^rows:5:0:/);
  expect(await offset()).toBeCloseTo(before!,2);
});


for(const renderer of ['webgl','canvas']) test(`${renderer}: a recycled shelf restores its horizontal position before it scrolls back into view`,async({page,baseURL})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await page.clock.install();
  await fixture(page,baseURL!,2,renderer);await page.clock.runFor(500);
  if(renderer==='canvas')await expect(state(page)).toHaveAttribute('data-renderer-backend','canvas');
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
  await press(page,...Array(5).fill('ArrowRight'));await page.clock.runFor(250);
  const position=()=>page.evaluate(()=>{
    let x:number|undefined;function walk(n:any){if(n.props.w===424&&n.props.h===238&&n.texture?.props?.src?.includes('a5729872fdf6d97950dabed6371ef4d6.jpg'))x=n.absX;n.children?.forEach(walk);}
    walk((window as any).__viptvRenderer.stage.root);return x;
  });
  const before=await position();expect(before).toBeDefined();
  for(const key of ['ArrowDown','ArrowDown','ArrowDown','ArrowUp','ArrowUp','ArrowUp']){await press(page,key);await page.clock.runFor(80);}
  await expect(state(page)).toHaveAttribute('data-tv-focus',/^rows:5:0:/);
  expect(await position()).toBeCloseTo(before!,2);
});
