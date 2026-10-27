import { test, expect, type Page } from '@playwright/test';
import { lookupSelector } from '../../src/tv-solid/remote/api';
import { validateChannelPage } from '../../src/tv-solid/remote/channelWindow';

async function navigate(page: Page, target: string) {
  const state = page.locator('html');
  for(let attempt=0;attempt<3 && !(await state.getAttribute('data-tv-focus'))?.startsWith('nav:');attempt++) await page.keyboard.press('ArrowUp');
  const ids=(await state.getAttribute('data-tv-navigation'))!.split(',');
  const index=ids.indexOf(target);
  expect(index).toBeGreaterThanOrEqual(0);
  const current=Number((await state.getAttribute('data-tv-focus'))!.split(':')[1]);
  for(let step=0;step<Math.abs(index-current);step++) await page.keyboard.press(index>current?'ArrowRight':'ArrowLeft');
  await page.keyboard.press('Enter');
}

test('real producer pairing, profile selection, durable reload and profile preferences', async ({ page, request, baseURL }) => {
  const seeded=await request.get('/api/profiles/1/library',{headers:{authorization:'Bearer member-token-1'}});
  for(const card of (await seeded.json()).cards) {
    // This test's in-memory account owns only synthetic add-on titles.
    expect(card.identity.id).toMatch(/^tt(?:1234567|2345678|3456789)$/);
    const removed=await request.delete(`/api/profiles/1/library/movie/${encodeURIComponent(card.identity.id)}`,{
      headers:{authorization:'Bearer member-token-1'},
      params:{metadata_origin:JSON.stringify(card.metadata_origin),card:JSON.stringify(lookupSelector(card))},
    });
    expect(removed.status()).toBe(200);
  }
  const errors: string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/tv/?platform=vizio&focusdebug=1');
  const state=page.locator('html');
  await expect(state).toHaveAttribute('data-tv-screen','welcome');
  await expect(state).toHaveAttribute('data-tv-ready','true');
  const codeResponse=page.waitForResponse(r=>r.url().endsWith('/api/auth/device/code') && r.request().method()==='POST');
  await page.keyboard.press('Enter');
  const code=await (await codeResponse).json();
  expect(new URL(code.verification_uri).origin).toBe(baseURL);
  const approval=await request.post('/api/auth/device/approve',{headers:{authorization:'Bearer member-token-1',origin:baseURL!},data:{user_code:code.user_code}});
  expect(approval.status()).toBe(200);
  await expect(state).toHaveAttribute('data-tv-screen','signed-in',{timeout:15000});
  await page.keyboard.press('Enter');
  await expect(state).toHaveAttribute('data-tv-screen','profiles');
  await page.keyboard.press('Enter');
  await expect(state).toHaveAttribute('data-tv-screen','home');
  await expect(state).toHaveAttribute('data-tv-ready','true');
  await expect(state).toHaveAttribute('data-tv-navigation','search,home,movie,library,profiles');
  const reloadedBootstrap=page.waitForResponse(r=>r.url().endsWith('/api/bootstrap'));
  await page.reload();
  await expect(state).toHaveAttribute('data-tv-screen','home');
  await expect(state).toHaveAttribute('data-tv-ready','true');
  const homeCards=(await(await reloadedBootstrap).json()).home.rows.flatMap((row:any)=>row.cards);
  expect(homeCards.length).toBeGreaterThan(0);
  for(const card of homeCards)expect(card.view.preview).toEqual({background:card.landscape,caption:null,progress:null,action:'details'});
  // Catalog/detail provenance and saved membership cross the actual API boundary.
  await navigate(page,'movie');
  await expect(state).toHaveAttribute('data-tv-screen','movie');
  await expect(state).toHaveAttribute('data-tv-ready','true');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(state).toHaveAttribute('data-tv-screen','detail');
  await expect(state).toHaveAttribute('data-tv-ready','true');
  const saved=page.waitForResponse(r=>r.url().endsWith('/library') && r.request().method()==='PUT');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  expect((await saved).status()).toBe(200);
  const collection=await request.get('/api/profiles/1/library',{headers:{authorization:'Bearer member-token-1'}});
  expect((await collection.json()).cards.map((card: any)=>card.identity.id)).toContain('tt1234567');
  await page.keyboard.press('Escape');
  await expect(state).toHaveAttribute('data-tv-screen','movie');
  await navigate(page,'search');
  await expect(state).toHaveAttribute('data-tv-screen','search');
  const searched=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/discover' && new URL(r.url()).searchParams.get('search')==='fixture');
  await page.keyboard.type('fixture');
  const results=await searched;
  expect(results.status()).toBe(200);
  expect((await results.json()).cards).toHaveLength(3);
  await expect(state).toHaveAttribute('data-tv-ready','true');
  // The UI uses the producer's controls and optimistic revision, with real persistence.
  await navigate(page,'profiles');
  for(const key of ['ArrowDown','Enter'])await page.keyboard.press(key);
  await expect(state).toHaveAttribute('data-tv-screen','settings');
  await expect(state).toHaveAttribute('data-tv-ready','true');
  const before=await request.get('/api/profiles/1/preferences',{headers:{authorization:'Bearer member-token-1'}});
  const old=await before.json();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(state).toHaveAttribute('data-tv-overlay','choices');
  const mutation=page.waitForResponse(r=>r.url().endsWith('/preferences') && r.request().method()==='PUT');
  await page.keyboard.press('Enter');
  expect((await mutation).status()).toBe(200);
  const after=await request.get('/api/profiles/1/preferences',{headers:{authorization:'Bearer member-token-1'}});
  expect((await after.json()).revision).toBe(old.revision+1);
  // The same producer contract applies to unavailable Live directories. This
  // proves the real wire envelope; configured traversal is a separate fixture.
  const live=await request.get('/api/profiles/1/live/channels',{
    headers:{authorization:'Bearer member-token-1'},params:{offset:'4294967295',limit:'2',page_size:'40'},
  });
  expect(live.status()).toBe(200);
  const directory=validateChannelPage(await live.json(),{cursor:'4294967295',limit:2,page_size:40});
  expect(directory.paging.previous).toBeNull();expect(directory.paging.next).toBeNull();
  expect(errors).toEqual([]);
});
