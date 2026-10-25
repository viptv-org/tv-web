import {test,expect} from '@playwright/test';
import {installRemoteBackend} from '../preview/remote-backend';

for(const searching of [false,true])test(`${searching?'Search':'Live'} discards incompatible pages and reloads the server snapshot`,async({page,baseURL})=>{
  const fixture=await installRemoteBackend(page,baseURL!,{liveChannels:80,mediaSearch:false,channelSearch:true,searchChannelCount:80,holdNextPage:true});
  const offsets:string[]=[];
  page.on('request',request=>{const u=new URL(request.url());if(u.pathname.endsWith('/live/channels'))offsets.push(u.searchParams.get('offset')!);});
  const state=page.locator('html');await page.goto('/tv/?platform=vizio&focusdebug=1');
  await expect(state).toHaveAttribute('data-tv-ready','true');await page.keyboard.press('ArrowUp');
  if(searching)await page.keyboard.press('ArrowLeft');else for(let i=0;i<3;i++)await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  if(searching){await page.keyboard.press('a');await expect(state).toHaveAttribute('data-tv-ready','true');for(let i=0;i<6;i++)await page.keyboard.press('ArrowRight');}
  else await expect(state).toHaveAttribute('data-tv-ready','true');
  for(let i=0;i<39;i++)await page.keyboard.press(searching?'ArrowRight':'ArrowDown');
  await expect(state).toHaveAttribute('data-tv-focus',new RegExp(`^${searching?'search-channels':'content'}:39:`));
  await expect.poll(()=>offsets).toEqual(['0','40']);
  fixture.reviseLive();fixture.releasePages();
  await expect.poll(()=>offsets).toEqual(['0','40','0']);
  await expect(state).toHaveAttribute('data-tv-ready','true');
  await expect(state).toHaveAttribute('data-tv-focus',new RegExp(`^${searching?'search-channels':'content'}:0:`));
  await expect.poll(()=>page.evaluate(()=>{const text:string[]=[];function visit(n:any){if(n.isRenderable&&n.viptvText)text.push(n.viptvText);n.children?.forEach(visit);}visit((window as any).__viptvRenderer.stage.root);return text.some(t=>t.includes('Updated channel'));})).toBe(true);
  // Traverse into the fresh second page: its first result is index 40, rather
  // than a duplicated or omitted window spliced onto the abandoned page.
  for(let i=0;i<40;i++)await page.keyboard.press(searching?'ArrowRight':'ArrowDown');
  await expect(state).toHaveAttribute('data-tv-focus',new RegExp(`^${searching?'search-channels':'content'}:40:`));
  expect(offsets).toEqual(['0','40','0','40']);
});
