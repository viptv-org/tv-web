import { expect, test } from '@playwright/test';
import { apiOrigin, installBackend, sessionKey } from './helpers/responsiveBackend';

test('stale local addon state cannot select anonymous boot or make addon requests', async ({ page }) => {
  const fixture = await installBackend(page);
  let addonRequests = 0;
  await page.route('https://retired-addon.invalid/**', route => { addonRequests++; return route.abort(); });
  await page.addInitScript(() => {
    localStorage.setItem('viptv.local.mode.v1','1');
    localStorage.setItem('viptv.local.registry.v1',JSON.stringify({version:1,nextOrdinal:2,addons:[{ordinal:1,id:'retired',manifestUrl:'https://retired-addon.invalid/manifest.json',manifest:{catalogs:[{id:'top',type:'movie'}]},enabled:true}]}));
  });
  await page.goto('/tv/?renderer=react&local=1');
  await page.locator('[data-focus-id="profile-0"]').click();
  await expect(page.locator('.home')).toBeVisible();
  await expect(page.getByRole('button',{name:'Use without an account'})).toHaveCount(0);
  expect(addonRequests).toBe(0);
  expect(fixture.requests.some(request=>request.path==='/api/auth/me')).toBe(true);
  expect(await page.evaluate(()=>localStorage.getItem('viptv.local.mode.v1'))).toBe('1');
  expect(await page.evaluate(()=>localStorage.getItem('viptv.local.registry.v1'))).toContain('retired-addon.invalid');
});

test('stale local mode cannot bypass sign-in when no account grant exists', async ({ page }) => {
  await installBackend(page);
  let addonRequests = 0;
  await page.route('https://retired-addon.invalid/**', route => { addonRequests++; return route.abort(); });
  await page.addInitScript(key => {
    localStorage.removeItem(key);
    localStorage.setItem('viptv.local.mode.v1','1');
    localStorage.setItem('viptv.local.registry.v1','{"version":1,"addons":[]}');
  }, sessionKey);
  await page.route(`${apiOrigin}/api/auth/device/**`, route => {
    if (route.request().url().endsWith('/code')) return route.fulfill({json:{device_code:'fixture',user_code:'ABCDEF',verification_uri:apiOrigin,verification_uri_complete:`${apiOrigin}/?code=ABCDEF`,qr_uri:`${apiOrigin}/api/auth/device/qr?code=ABCDEF`,expires_in:600,interval:1}});
    return route.fulfill({status:400,json:{error:'authorization_pending'}});
  });
  await page.goto('/tv/?renderer=react&local=1');
  await expect(page.getByRole('heading',{name:'Sign in to viptv'})).toBeVisible();
  await expect(page.locator('.home')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Use without an account'})).toHaveCount(0);
  expect(addonRequests).toBe(0);
  expect(await page.evaluate(()=>localStorage.getItem('viptv.local.mode.v1'))).toBe('1');
});
