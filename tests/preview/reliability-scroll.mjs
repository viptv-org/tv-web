import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { installBackend } from './backend.ts';

const root = process.env.RELIABILITY_CAPTURE_DIR ?? '/tmp/viptv-reliability-scroll';
async function brightPixels(page, clip) {
  const data = await page.screenshot({clip});
  return page.evaluate(async base64 => {
    const img=new Image(); img.src='data:image/png;base64,'+base64; await img.decode();
    const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
    const pixels=ctx.getImageData(0,0,img.width,img.height).data;
    let bright=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>150&&pixels[i+1]>150&&pixels[i+2]>150)bright++;
    return bright;
  },data.toString('base64'));
}
mkdirSync(root, {recursive:true});
const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage({viewport:{width:1920,height:1080}});
  const errors=[];
  page.on('pageerror', error=>errors.push(error.message));
  await installBackend(page,{family:'tv',session:'ready',favorites:true});
  await page.route('https://watch.local.test:4180/**', route => {
    const path = new URL(route.request().url()).pathname;
    return /^\/(api|media)\//.test(path) ? route.fallback() : route.continue();
  });
  await page.goto('https://watch.local.test:4180/solid.html?platform=vizio&focusdebug=1&perfdebug=1');
  await page.waitForFunction(()=>window.__viptvFocus?.view==='home-action');
  await page.waitForTimeout(1200);
  await page.screenshot({path:root+'/before.png'});
  const heroClip={x:180,y:330,width:780,height:310};
  const before=await brightPixels(page,heroClip);
  for(let cycle=0;cycle<3;cycle++) {
    for(let row=0;row<7;row++){await page.keyboard.press('ArrowDown');await page.waitForTimeout(160);}
    // Exercise offscreen texture cleanup before returning to the hero.
    await page.evaluate(()=>window.__viptvRenderer.stage.txMemManager.cleanup(true));
    await page.waitForTimeout(2200);
    for(let row=0;row<9;row++){await page.keyboard.press('ArrowUp');await page.waitForTimeout(160);}
    await page.waitForTimeout(800);
  }
  await page.screenshot({path:root+'/after.png'});
  const after=await brightPixels(page,heroClip);
  if(before<1000 || after<before*.9)throw Error(`Hero foreground vanished after scroll: ${before} -> ${after}`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  await page.screenshot({path:root+'/sources.png'});
  if(await brightPixels(page,{x:1150,y:60,width:650,height:440})<3000)throw Error('Source panel content is obscured');
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(()=>window.__viptvFocus?.view==='source-provider');
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.__viptvFocus?.view==='provider-option');
  await page.waitForTimeout(150);
  await page.screenshot({path:root+'/providers.png'});
  if(await brightPixels(page,{x:1150,y:60,width:650,height:440})<3000)throw Error('Provider panel content is obscured');
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>window.__viptvFocus?.view==='source-provider');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(()=>window.__viptvFocus?.view==='source-row');
  await page.keyboard.down('Enter');await page.waitForTimeout(750);await page.keyboard.up('Enter');
  await page.waitForFunction(()=>window.__viptvEntryFocus?.id==='source-details-body');
  await page.waitForTimeout(150);
  await page.screenshot({path:root+'/details.png'});
  if(await brightPixels(page,{x:180,y:75,width:800,height:300})<3000)throw Error('Source details is behind the source panel');
  console.log(JSON.stringify({errors,heroPixels:{before,after},focus:await page.evaluate(()=>window.__viptvFocus),textureBytes:await page.evaluate(()=>window.__viptvRendererMetrics?.()),captures:root}));
  if(errors.length)throw Error('Renderer errors during scroll recovery');
} finally {await browser.close();}
