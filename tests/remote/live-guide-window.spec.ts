import {test,expect,type Page} from '@playwright/test';
import {installRemoteBackend} from '../preview/remote-backend';
import {openNavigation} from './navigation-helpers';

const texts=(page:Page)=>page.evaluate(()=>{
  const found:string[]=[];
  const visit=(node:any)=>{if(node.viptvText)found.push(node.viptvText);node.children?.forEach(visit);};
  visit((window as any).__viptvRenderer.stage.root);
  return found;
});
const shown=(page:Page,value:string)=>texts(page).then(found=>found.some(text=>text.includes(value)));
/** The grid's time header, drawn four half hours from the page's window. */
const headerLabels=(page:Page)=>page.evaluate(()=>{
 const labels:string[]=[];function walk(node:any){if(node.isRenderable&&node.absY===592&&/^\d{1,2}:\d{2}/.test(node.viptvText??''))labels.push(node.viptvText);node.children?.forEach(walk);}
 walk((window as any).__viptvRenderer.stage.root);return labels;
});

async function openLive(page:Page){
  await page.goto('/tv/?platform=vizio&focusdebug=1');
  await expect(page.locator('html')).toHaveAttribute('data-tv-ready','true');
  await openNavigation(page,'live');
  await expect(page.locator('html')).toHaveAttribute('data-tv-channel-id','channel-0');
}

test('a channel whose guide failed leaves the header and the other rows drawn',async({page,baseURL})=>{
  await installRemoteBackend(page,baseURL!,{liveChannels:5,liveGuideWindows:true,liveGuideFailures:['channel-0']});
  await openLive(page);
  await expect.poll(()=>shown(page,'channel-1 now')).toBe(true);
  expect(await headerLabels(page)).toHaveLength(4);
  // The four rows that answered keep their programmes ...
  for(const id of ['channel-1','channel-2','channel-3','channel-4'])
    expect(await shown(page,`${id} now`)).toBe(true);
  // ... and the row whose own guide failed says so, alone.
  expect(await shown(page,'Programme information unavailable')).toBe(true);
});

test('a channel whose guide is still loading does not blank the rows that answered',async({page,baseURL})=>{
  const fixture=await installRemoteBackend(page,baseURL!,{liveChannels:5,liveGuideWindows:true,holdGuides:['channel-0']});
  await openLive(page);
  await expect.poll(()=>shown(page,'channel-1 now')).toBe(true);
  await expect.poll(()=>shown(page,'channel-2 now')).toBe(true);
  expect(await headerLabels(page)).toHaveLength(4);
  fixture.releaseGuides();
  await expect.poll(()=>shown(page,'channel-0 now')).toBe(true);
  // Every row, including the one that arrived last, then draws its programmes.
  await expect.poll(()=>shown(page,'channel-4 now')).toBe(true);
  expect(await shown(page,'Programme information unavailable')).toBe(false);
});
