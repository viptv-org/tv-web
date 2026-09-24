import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';
import { apiOrigin, capture, corsHeaders, enterHome, episode, expectBox, fixtureImage, installBackend, installPlatformRuntime, json, movie, profile, channel, type ProfileFixture } from './helpers/tvShellRuntime';


test('restores a remembered profile without flashing pairing and retains Home after reload', async ({ page }) => {
  await installBackend(page);
  await page.addInitScript(({ origin }) => {
    if (!localStorage.getItem(`viptv-device:${origin}`)) localStorage.setItem(`viptv-device:${origin}`, JSON.stringify({ sessionId:'fixture',accountId:'7',profileId:'1',accessToken:'access',refreshToken:'refresh',expiresIn:900 }));
    (window as unknown as { pairingFlashed:boolean }).pairingFlashed=false;
    new MutationObserver(() => {
      if(document.body?.textContent?.includes('Sign in to VIPTV')) (window as unknown as { pairingFlashed:boolean }).pairingFlashed=true;
    }).observe(document,{childList:true,subtree:true});
  }, { origin:apiOrigin });
  await page.goto('/?platform=vizio');
  await expect(page.locator('.media-card').first()).toBeVisible();
  await expect(page.locator('.vx-profiles')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.media-card').first()).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as {pairingFlashed:boolean}).pairingFlashed)).toBe(false);
});

test('profile artwork remains concentric with its focus outline at TV and desktop sizes', async ({ page }) => {
  await installBackend(page);
  await page.addInitScript(({ origin }) => localStorage.setItem(`viptv-device:${origin}`,JSON.stringify({sessionId:'fixture',accountId:'7',profileId:null,accessToken:'access',refreshToken:'refresh',expiresIn:900})),{origin:apiOrigin});
  await page.goto('/?platform=vizio');
  const card=page.locator('[data-focus-id="profile-0"]');
  await expect(card).toBeVisible();
  for (const viewport of [{width:1280,height:720},{width:1920,height:1080}]) {
    await page.setViewportSize(viewport);
    await card.focus();
    // The focus ring is the avatar box's own box-shadow (ring + 1.06 scale), so the artwork
    // must fill that box exactly, whatever the canvas scale.
    await expect(async()=> {
      const delta=await card.evaluate(element=>{
        const box=element.querySelector('.vx-profile__avatar')!;
        const b=box.getBoundingClientRect(); const img=box.querySelector('img')!.getBoundingClientRect();
        return {x:img.x+img.width/2-(b.x+b.width/2),y:img.y+img.height/2-(b.y+b.height/2),ring:getComputedStyle(box).boxShadow};
      });
      expect(Math.abs(delta.x)).toBeLessThan(1);expect(Math.abs(delta.y)).toBeLessThan(1);
      expect(delta.ring).toContain('rgb(255, 255, 255) 0px 0px 0px 4px');
    }).toPass();
  }
});

test('reported TV web regressions keep episode details, loading feedback and row focus stable', async ({ page }) => {
  const bleach = {
    id: 'bleach:1:3', type: 'episode', series_id: 'bleach', name: 'Bleach', title: 'Episode 3',
    season: 1, episode: 3, position: 42, duration: 120, poster: '/poster.jpg', background: '/background.jpg',
  };
  await installPlatformRuntime(page);
  await installBackend(page);
  await page.route(`${apiOrigin}/api/profiles/1/continue/page**`, route => json(route, { items: [bleach], offset: 0, total: 1, next_offset: null }));
  await page.route(`${apiOrigin}/api/meta/series/bleach`, route => json(route, { meta: {
    id: 'bleach', type: 'series', name: 'Bleach', poster: '/poster.jpg', background: '/background.jpg',
    description: 'A Soul Reaper protects the living.', genres: ['Anime', 'Action'],
    videos: [{ id: 'bleach:1:3', title: 'Episode 3', season: 1, episode: 3, description: 'The story continues.' }],
  } }));
  await page.route(`${apiOrigin}/api/streams`, route => json(route, { id: 'bleach-job' }));
  await page.route(`${apiOrigin}/api/streams/bleach-job**`, async route => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return json(route, { events: [{ seq: 1, source: 'addon:2', streams: [{ id: 'bleach-stream', name: 'Bleach 1080p', source_addon_id: 'addon:2' }] }], done: true });
  });
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), { key: `viptv-device:${apiOrigin}`, token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } });
  await page.goto('/?platform=vizio');

  const profileCard = page.locator('[data-focus-id="profile-0"]');
  await expect(profileCard).toHaveCSS('box-sizing', 'border-box');
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  await page.getByRole('button', { name: 'Bleach' }).focus();
  // Queue OK is Resume; the explicit Details action opens episode information.
  await page.locator('[data-focus-id="hero-details"]').press('Enter');
  await expect(page.locator('.vx-title__synopsis')).toContainText('Soul Reaper');
  await expect(page.locator('[data-focus-id="episode-0"]')).toContainText('Episode 3');
  await page.locator('[data-focus-id="episode-0"]').press('Enter');
  await expect(page.locator('.vx-sources__status .vx-spinner')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bleach 1080p' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
