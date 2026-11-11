import {test,expect} from '@playwright/test';
import {installRemoteBackend} from '../preview/remote-backend';
import {openNavigation} from './navigation-helpers';

const shown=async(page:import('@playwright/test').Page,needle:string)=>
  page.evaluate(value=>{const text:string[]=[];function visit(node:any){if(node.isRenderable&&node.viptvText)text.push(node.viptvText);node.children?.forEach(visit);}visit((window as any).__viptvRenderer.stage.root);return text.some(entry=>entry.includes(value));},needle);

test('Live names an empty category instead of a missing source and keeps the chips focused',async({page,baseURL})=>{
  await installRemoteBackend(page,baseURL!,{liveChannels:3,liveGroups:2,liveEmptyGroups:['group-2']});
  const state=page.locator('html');
  await page.goto('/tv/?platform=vizio&focusdebug=1');
  await expect(state).toHaveAttribute('data-tv-ready','true');
  const liveIndex=await openNavigation(page,'live');
  await expect(state).toHaveAttribute('data-tv-live-spread','today');
  await expect(state).toHaveAttribute('data-tv-focus',/^content:0:/);
  // Up from the first channel row is the chip row; Group 2 is the empty one.
  await page.keyboard.press('ArrowUp');
  await expect(state).toHaveAttribute('data-tv-focus',/^live-groups:0:/);
  for(let i=0;i<2;i++)await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(state).toHaveAttribute('data-tv-live-spread','filtered');
  await expect.poll(()=>shown(page,'No channels here yet. Choose another filter.')).toBe(true);
  expect(await shown(page,'No live channels. Configure a source in Settings.')).toBe(false);
  expect(await shown(page,'No channels came back.')).toBe(false);
  // The chosen chip holds the focus, and Down has no row to leave it for.
  await expect(state).toHaveAttribute('data-tv-focus',/^live-groups:2:/);
  await page.keyboard.press('ArrowDown');
  await expect(state).toHaveAttribute('data-tv-focus',/^live-groups:2:/);
  // And the navigation returns to that same chip rather than to a missing row.
  await page.keyboard.press('ArrowUp');
  await expect(state).toHaveAttribute('data-tv-focus',new RegExp(`^nav:${liveIndex}:`));
  await page.keyboard.press('ArrowDown');
  await expect(state).toHaveAttribute('data-tv-focus',/^live-groups:2:/);
  // Choosing a category that has channels returns the page and its row focus.
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await expect(state).toHaveAttribute('data-tv-live-spread','today');
  await expect(state).toHaveAttribute('data-tv-focus',/^content:0:/);
  await expect(state).toHaveAttribute('data-tv-channel-id','channel-0');
});
