import {chromium} from '@playwright/test';
import {writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {installRemoteBackend} from './remote-backend.ts';
const origin=process.env.REMOTE_PREVIEW_ORIGIN ?? 'https://viptv.local.test:18571';
const dist=process.env.PERF_DIST ?? '/tmp/viptv-tv-entry-20261023';
const runs=Number(process.env.PERF_RUNS??3);
const welcomeMs=Number(process.env.PERF_WELCOME_MS??6000);
if(!Number.isFinite(welcomeMs)||welcomeMs<1000||welcomeMs>120000)throw new Error('PERF_WELCOME_MS must be between 1000 and 120000');
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
const samples=[];const p95=a=>a.slice().sort((a,b)=>a-b)[Math.ceil(a.length*.95)-1];
try{for(let run=0;run<runs;run++){
  const context=await browser.newContext({viewport:{width:1920,height:1080},reducedMotion:'no-preference'});
  const page=await context.newPage();await installRemoteBackend(page,origin,{session:false});
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.addInitScript(()=>{
    window.__entryPerf={active:false,frames:[],tasks:[]};let previous=0;
    const frame=now=>{if(window.__entryPerf.active&&previous)window.__entryPerf.frames.push(now-previous);previous=now;requestAnimationFrame(frame);};requestAnimationFrame(frame);
    new PerformanceObserver(list=>{if(window.__entryPerf.active)window.__entryPerf.tasks.push(...list.getEntries().map(e=>e.duration));}).observe({type:'longtask'});
  });
  const response=await page.goto(origin+'/tv/?platform=vizio&perfdebug=1');
  if(await response.text()!==readFileSync(dist+'/index.html','utf8'))throw new Error('Wrong served bundle');
  await page.waitForFunction(()=>document.documentElement.dataset.tvReady==='true');
  const readyMs=await page.evaluate(()=>performance.now());
  for(const screen of ['welcome','pairing']){
    if(screen==='pairing'){await page.keyboard.press('Enter');await page.waitForFunction(()=>document.documentElement.dataset.tvScreen==='pairing'&&document.documentElement.dataset.tvReady==='true');}
    await page.waitForTimeout(1500);
    await page.evaluate(()=>{window.__entryPerf={active:true,frames:[],tasks:[]};});
    await page.waitForTimeout(screen==='welcome'?welcomeMs:6000);
    const data=await page.evaluate(()=>{window.__entryPerf.active=false;return{...window.__entryPerf,textureBytes:window.__viptvRendererMetrics().textureBytes};});
    await cdp.send('HeapProfiler.collectGarbage');const heap=await cdp.send('Runtime.getHeapUsage');
    samples.push({run,screen,readyMs,...(process.env.PERF_FRAME_SAMPLES==='1'?{rawFrames:data.frames}:{}),frameP95:p95(data.frames),framesOver50:data.frames.filter(v=>v>50.1).length,longTasks:data.tasks.length,heapMiB:heap.usedSize/1048576,textureMiB:data.textureBytes/1048576});
  }
  await context.close();
}}finally{await browser.close();}
const bundle=createHash('sha256');for(const file of ['index.html','solid.html',...readdirSync(dist+'/assets').filter(f=>f.endsWith('.js')).sort().map(f=>'assets/'+f)])bundle.update(file).update(readFileSync(dist+'/'+file));
const report={measuredBundleSha256:bundle.digest('hex'),fixtureSha256:createHash('sha256').update(readFileSync('tests/preview/remote-backend.ts')).digest('hex'),conditions:`1920×1080, SwiftShader, 4× CPU, fresh contexts, normal motion, ${welcomeMs/1000}s Welcome and 6s pairing settled measurement; no concurrent builds/tests`,samples,limits:'Steady entry animation only; startup and memory reported separately. Browser evidence, not physical-TV certification.'};
writeFileSync(process.env.PERF_OUTPUT??'/tmp/viptv-entry-motion-performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
if(samples.some(s=>s.frameP95>17.5||s.framesOver50||s.longTasks))process.exitCode=1;
