import {chromium} from '@playwright/test';
import {installBackend} from './backend.ts';
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await installBackend(page,{family:'phone',session:'ready',favorites:true});
  await page.route('https://watch.local.test:4180/**', route=>/^\/(api|media)\//.test(new URL(route.request().url()).pathname)?route.fallback():route.continue());
  // No artwork succeeds; content and navigation must still work.
  await page.route('https://art.example/**', route=>route.abort());
  await page.route('**/api/catalogs', async route=>{await new Promise(resolve=>setTimeout(resolve,3000));await route.fallback();});
  await page.goto('https://watch.local.test:4180/');
  await page.locator('.vx-home__avatar').waitFor();
  await page.locator('.vx-home__avatar').click();
  await page.locator('.screen-settings').waitFor();
  await page.waitForTimeout(3200);
  if(!await page.locator('.screen-settings').isVisible())throw Error('Late Home loading replaced Settings');
  await page.getByRole('button',{name:'Switch profile',exact:true}).click();
  await page.locator('.screen-profiles').waitFor();
  console.log('PASS: failed artwork does not block Home; header opens Settings; Switch profile remains explicit');
} finally {await browser.close();}
