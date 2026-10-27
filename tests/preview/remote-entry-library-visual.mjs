import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { installRemoteBackend, referenceRoot } from './remote-backend.ts';

const origin = process.env.REMOTE_PREVIEW_ORIGIN ?? 'https://viptv.local.test:18564';
const out = process.env.REMOTE_VISUAL_OUT ?? '/tmp/viptv-entry-library-visual';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const evidence = [];
const rect = (element) => {
  const r = element.getBoundingClientRect();
  return { x:r.x, y:r.y, w:r.width, h:r.height };
};
try {
  for (const board of ['Tv3SignedIn', 'Tv3MyList']) {
    const context = await browser.newContext({ viewport: { width:1920, height:1080 }, reducedMotion:'reduce' });
    const reference = await context.newPage();
    await reference.route(`${origin}/reference/**`, route => {
      const file = resolve(referenceRoot, new URL(route.request().url()).pathname.slice('/reference/'.length));
      if (!file.startsWith(referenceRoot + '/')) return route.abort();
      return route.fulfill({ body:readFileSync(file), contentType: ({ '.html':'text/html', '.woff2':'font/woff2', '.png':'image/png', '.jpg':'image/jpeg' })[extname(file)] });
    });
    const html = readFileSync(resolve(referenceRoot, `screens/html/tv/${board}.html`));
    await reference.goto(`${origin}/reference/screens/html/tv/${board}.html`);
    await reference.evaluate(async () => {
      await document.fonts.ready;
      for (const a of document.querySelectorAll('a')) if (a.textContent === 'Calendar') a.remove();
      for (const p of document.querySelectorAll('p')) if (p.textContent === 'Signed in as [name@email.com]') p.textContent = 'Signed in as viewer@example.test';
    });
    await reference.screenshot({ path:`${out}/${board}-reference.png` });
    const geometry = await reference.evaluate(`(${rect.toString()}) && [...document.querySelectorAll('img')].map(e=>({src:e.getAttribute('src').split('/').pop(),title:e.parentElement.parentElement.getAttribute('aria-label'),...(${rect.toString()})(e)}))`);
    const page = await context.newPage();
    const fixture = await installRemoteBackend(page, origin, board === 'Tv3SignedIn' ? { session:false, pairingApproved:true } : {});
    if (board === 'Tv3MyList') await page.route('**/api/profiles/*/library?**', route => route.fulfill({ json: {
      cards:geometry.slice(0,14).map((item,i)=>({ ...fixture.card, identity:{kind:'movie',id:`library-${i}`,ids:[]}, title:item.title, poster:`${origin}/fixture/${item.src}`, view:{ saved:true, compact_metadata_parts:['2026','Action'], ...(i===1?{tile_badge:{label:'New episode',role:'new_episodes'}}:{}) } })),
      complete:true, query:{type:'all',sort:'last_watched'}, controls:[
        {id:'type',label:'Type',kind:'SingleChoice',choices:[{value:'all',label:'All'},{value:'movie',label:'Movies'},{value:'series',label:'Series'}]},
        {id:'sort',label:'Sort',kind:'SingleChoice',choices:[{value:'last_watched',label:'Last watched'}]},
      ],
    } }));
    await page.goto(`${origin}/tv/?platform=vizio&focusdebug=1`);
    await page.waitForFunction(()=>document.documentElement.dataset.tvReady==='true');
    const keys = board==='Tv3SignedIn' ? ['Enter'] : ['ArrowUp','ArrowRight','ArrowRight','ArrowRight','ArrowRight','Enter'];
    for (const key of keys) await page.keyboard.press(key);
    await page.waitForFunction(screen=>document.documentElement.dataset.tvScreen===screen && document.documentElement.dataset.tvReady==='true', board==='Tv3SignedIn'?'signed-in':'library');
    await page.waitForTimeout(300);
    await page.screenshot({ path:`${out}/${board}-app.png` });
    const nodes = await page.evaluate(()=>{
      const nodes=[];
      function visit(n){if(n.isRenderable) nodes.push({x:n.absX,y:n.absY,w:n.props.w,h:n.props.h,text:n.viptvText});n.children?.forEach(visit)}
      visit(window.__viptvRenderer.stage.root);return nodes;
    });
    const expectedImages = board==='Tv3SignedIn'?geometry:geometry.slice(0,14);
    const imageBounds = expectedImages.map(expected=>({expected, matched:nodes.some(actual=>['x','y','w','h'].every(k=>Math.abs(actual[k]-expected[k])<.5))}));
    evidence.push({ board, reference_sha256:createHash('sha256').update(html).digest('hex'), adaptations:['Calendar omitted per approved scope',...(board==='Tv3SignedIn'?['Synthetic authenticated username']:[])], imageBounds, nodes });
    if(imageBounds.some(b=>!b.matched)) throw new Error(`${board}: reference artwork bounds differ`);
    await context.close();
  }
} finally {
  writeFileSync(`${out}/geometry.json`, JSON.stringify(evidence,null,2));
  await browser.close();
}
console.log(`Private matched captures and geometry: ${out}`);
