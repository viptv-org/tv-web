import { chromium } from '@playwright/test';
import QRCode from 'qrcode';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { installRemoteBackend, referenceRoot } from './remote-backend.ts';
const origin=process.env.REMOTE_PREVIEW_ORIGIN ?? 'https://viptv.local.test:18571';
const out=process.env.REMOTE_VISUAL_OUT ?? '/tmp/viptv-entry-visual';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
const evidence=[];
try {
  for(const board of ['Tv3Splash','Tv3Welcome','Tv3SignIn','Tv3Profiles']) {
    const context=await browser.newContext({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const fixture=await installRemoteBackend(page,origin,{session:board==='Tv3Splash'||board==='Tv3Profiles'});
    const management=fixture.bootstrap().profile_management;
    management.profiles[1].name='zayne';
    management.profiles.push({id:'3',name:'cedes',avatar_id:'initial-pink',locked:true,can_delete:true,selection_requires_parent:true},{id:'4',name:'Wasim',avatar_id:'initial-blue',locked:false,can_delete:true,selection_requires_parent:false});
    if(board==='Tv3Splash')await page.route('**/api/bootstrap',()=>new Promise(()=>{}));
    const qr=await QRCode.toDataURL(`${origin}/device?code=ABCD-EFGH`,{width:300,margin:2});
    const reference=await context.newPage();
    await reference.route(`${origin}/reference/**`,route=>{
      const file=resolve(referenceRoot,new URL(route.request().url()).pathname.slice('/reference/'.length));
      if(!file.startsWith(referenceRoot+'/'))return route.abort();
      return route.fulfill({body:readFileSync(file),contentType:({'.html':'text/html','.woff2':'font/woff2','.jpg':'image/jpeg','.png':'image/png'})[extname(file)]});
    });
    await reference.goto(`${origin}/reference/screens/html/tv/${board}.html`);
    const referenceData=await reference.evaluate(async({board,origin,qr})=>{
      await document.fonts.ready;
      if(board==='Tv3Welcome') {
        for(const a of document.querySelectorAll('a'))if(a.textContent==='Use without an account'){a.previousElementSibling?.remove();a.remove();}
        for(const d of document.querySelectorAll('x-dc > div > div'))if(d.style.top==='960px')d.remove();
      }
      if(board==='Tv3SignIn') {
        for(const a of document.querySelectorAll('a'))if(a.textContent.includes('Sign in with email'))a.parentElement.remove();
        for(const p of document.querySelectorAll('p'))if(p.textContent==='viptv.syek.tech/device')p.textContent=origin.replace('https://','')+'/device';
        const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
        while(node=walk.nextNode()){if(node.textContent==='[AB12CD34EF]')node.textContent='ABCD-EFGH';if(node.textContent.includes('Code expires in [14:52]'))node.textContent='Code expires in 5:00';}
        const target=document.querySelector('[aria-label="Scan to link your TV"]');
        target.replaceChildren(Object.assign(document.createElement('img'),{src:qr}));target.firstElementChild.style.cssText='width:300px;height:300px;display:block';
      }
      if(board==='Tv3Profiles')for(const a of document.querySelectorAll('a'))if(a.getAttribute('aria-label')==='[Wasim]')a.lastElementChild.textContent='Wasim';
      const boxes=[];const texts=[];
      for(const e of document.querySelectorAll('x-dc > div *')){
        if(e.closest('helmet'))continue;
        const r=e.getBoundingClientRect(),s=getComputedStyle(e);
        if(r.width&&r.height&&r.left<1920&&r.right>0&&r.top<1080&&r.bottom>0) {
          if((e.tagName==='IMG'||s.backgroundColor!=='rgba(0, 0, 0, 0)')&&r.width>35&&r.height>3)boxes.push({x:r.x,y:r.y,w:r.width,h:r.height,tag:e.tagName});
          if(e.childNodes.length===1&&e.firstChild.nodeType===Node.TEXT_NODE&&e.textContent.trim())texts.push({text:e.textContent,x:r.x,y:r.y,w:r.width,h:r.height,font:s.fontFamily,size:s.fontSize,weight:s.fontWeight,lineHeight:s.lineHeight});
        }
      }
      return{boxes,texts};
    },{board,origin,qr});
    await reference.screenshot({path:`${out}/${board}-reference.png`});
    await page.goto(`${origin}/tv/?platform=vizio&focusdebug=1`);
    await page.waitForFunction(()=>document.documentElement.dataset.tvScreen);
    if(board!=='Tv3Splash')await page.waitForFunction(()=>document.documentElement.dataset.tvReady==='true');
    if(board==='Tv3SignIn') {await page.keyboard.press('Enter');await page.waitForFunction(()=>document.documentElement.dataset.tvScreen==='pairing'&&document.documentElement.dataset.tvReady==='true');}
    if(board==='Tv3Profiles') {
      for(const key of ['ArrowUp','ArrowRight','ArrowRight','ArrowRight','ArrowRight','ArrowRight','Enter','Enter'])await page.keyboard.press(key);
      await page.waitForFunction(()=>document.documentElement.dataset.tvScreen==='profiles'&&document.documentElement.dataset.tvReady==='true');
    }
    await page.waitForTimeout(400);await page.screenshot({path:`${out}/${board}-app.png`});
    const nodes=await page.evaluate(()=>{const nodes=[];function visit(n){if(n.isRenderable)nodes.push({x:n.absX,y:n.absY,w:n.props.w,h:n.props.h,text:n.viptvText});n.children?.forEach(visit)}visit(window.__viptvRenderer.stage.root);return nodes;});
    const boxes=board==='Tv3Welcome'?referenceData.boxes.filter(box=>box.tag!=='IMG'):referenceData.boxes;
    if(board==='Tv3Welcome')boxes.push({x:0,y:0,w:1920,h:1080,tag:'composited-wall'});
    const bounds=boxes.map(expected=>({expected,matched:nodes.some(n=>['x','y','w','h'].every(k=>Math.abs(n[k]-expected[k])<=1))}));
    const actual=PNG.sync.read(readFileSync(`${out}/${board}-app.png`));
    const expected=PNG.sync.read(readFileSync(`${out}/${board}-reference.png`));
    const foreground=[...referenceData.texts,...referenceData.boxes.filter(box=>box.tag!=='IMG'&&box.tag!=='composited-wall')];
    const artwork_crops=board==='Tv3Welcome'?referenceData.boxes.filter(box=>box.tag==='IMG').map(box=>{
      let total=0,count=0;
      for(let y=Math.max(0,Math.ceil(box.y));y<Math.min(1080,box.y+box.h);y++)for(let x=Math.max(0,Math.ceil(box.x));x<Math.min(1920,box.x+box.w);x++){
        if(foreground.some(b=>x>=b.x-2&&x<b.x+b.w+2&&y>=b.y-2&&y<b.y+b.h+2))continue;
        const i=(y*1920+x)*4;for(let c=0;c<3;c++)total+=Math.abs(actual.data[i+c]-expected.data[i+c]);count+=3;
      }
      return {reference_region:box,foreground_text_and_controls_excluded:true,mean_absolute_channel_difference:total/count};
    }):[];
    let difference=0,changed=0;
    for(let i=0;i<actual.data.length;i+=4){let max=0;for(let c=0;c<3;c++){const d=Math.abs(actual.data[i+c]-expected.data[i+c]);difference+=d;max=Math.max(max,d);}if(max>12)changed++;}
    evidence.push({board,reference_sha256:createHash('sha256').update(readFileSync(resolve(referenceRoot,`screens/html/tv/${board}.html`))).digest('hex'),adaptations:['Pairing-only authentication; guest/email alternatives omitted','Server-issued URI/code/QR/expiry and synthetic profile names'],resolution:[1920,1080],geometry_tolerance_pixels:1,bounds,referenceTexts:referenceData.texts,nodes,errors,
      artwork_crops,whole_frame_mean_absolute_channel_difference:difference/(1920*1080*3),fraction_pixels_with_channel_difference_over_12:changed/(1920*1080)});
    if(errors.length)throw new Error(errors.join('\n'));
    if(bounds.some(b=>!b.matched))throw new Error(`${board}: reference geometry differs by more than 1px`);
    if(artwork_crops.some(c=>c.mean_absolute_channel_difference>2))throw new Error(`${board}: reference artwork region differs by more than 2 channel levels on average`);
    await context.close();
  }
} finally {writeFileSync(`${out}/geometry.json`,JSON.stringify(evidence,null,2));await browser.close();}
console.log(`Private entry captures: ${out}`);
