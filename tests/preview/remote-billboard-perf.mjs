import {chromium} from '@playwright/test';
import {writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {installRemoteBackend} from './remote-backend.ts';
const origin=process.env.REMOTE_PREVIEW_ORIGIN??'https://viptv.local.test:18576';
const dist=process.env.PERF_DIST??'/tmp/viptv-tv-billboard-20261023';
const runs=Number(process.env.PERF_RUNS??3),duration=Number(process.env.PERF_DURATION_MS??30000);
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});const samples=[];
try{for(let run=0;run<runs;run++){
 const context=await browser.newContext({viewport:{width:1920,height:1080},reducedMotion:'no-preference'});const page=await context.newPage();
 const fixture=await installRemoteBackend(page,origin);const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.addInitScript(()=>{window.__heroPerf={active:false,frames:[],tasks:[]};let previous=0;const tick=now=>{if(window.__heroPerf.active&&previous)window.__heroPerf.frames.push(now-previous);previous=now;requestAnimationFrame(tick);};requestAnimationFrame(tick);new PerformanceObserver(list=>{if(window.__heroPerf.active)window.__heroPerf.tasks.push(...list.getEntries().map(e=>e.duration));}).observe({type:'longtask'});});
 const response=await page.goto(origin+'/tv/?platform=vizio&perfdebug=1&focusdebug=1');if(await response.text()!==readFileSync(dist+'/index.html','utf8'))throw new Error('Wrong bundle');
 await page.waitForFunction(()=>document.documentElement.dataset.tvScreen==='home'&&document.documentElement.dataset.tvReady==='true');const readyMs=await page.evaluate(()=>performance.now());
 await page.waitForFunction(()=>{let ready=false;function visit(n){if(n.isRenderable&&n.props.w===1920&&n.props.h===1080&&n.texture?.state==='loaded'&&typeof n.texture.props.src==='string'&&n.worldAlpha>=.999)ready=true;n.children?.forEach(visit);}visit(window.__viptvRenderer.stage.root);return ready;});const artworkReadyMs=await page.evaluate(()=>performance.now());await page.waitForTimeout(1500);
 const cacheBefore=await page.evaluate(()=>window.__viptvRenderer.stage.shManager.valuesCache.size);
 await page.evaluate(()=>{window.__heroPerf.active=true;});await page.waitForTimeout(duration);
 const data=await page.evaluate(()=>{window.__heroPerf.active=false;return{...window.__heroPerf,textureBytes:window.__viptvRendererMetrics().textureBytes,shaderEntries:window.__viptvRenderer.stage.shManager.valuesCache.size};});
 await cdp.send('HeapProfiler.collectGarbage');const heap=await cdp.send('Runtime.getHeapUsage');
 const sorted=data.frames.slice().sort((a,b)=>a-b);samples.push({run,readyMs,artworkReadyMs,frameP95:sorted[Math.ceil(sorted.length*.95)-1],framesOver50:data.frames.filter(n=>n>50.1).length,longTasks:data.tasks.length,heapMiB:heap.usedSize/1048576,textureMiB:data.textureBytes/1048576,shaderCacheBefore:cacheBefore,shaderCacheAfter:data.shaderEntries,viewingRequests:fixture.requests.filter(r=>r.path.includes('/viewing-action')||r.path==='/api/streams'||r.path==='/api/playback').length});
 await context.close();
}}finally{await browser.close();}
const bundle=createHash('sha256');for(const f of ['index.html','solid.html',...readdirSync(dist+'/assets').filter(f=>f.endsWith('.js')).sort().map(f=>'assets/'+f)])bundle.update(f).update(readFileSync(dist+'/'+f));
const report={measuredBundleSha256:bundle.digest('hex'),fixtureSha256:createHash('sha256').update(readFileSync('tests/preview/remote-backend.ts')).digest('hex'),durationMs:duration,conditions:'1920×1080, 4× CPU, software WebGL, normal Home motion and automatic featured changes; no concurrent tests/builds',samples};writeFileSync(process.env.PERF_OUTPUT??'/tmp/viptv-billboard-performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
if(samples.some(s=>s.frameP95>17.5||s.framesOver50||s.longTasks||s.viewingRequests))process.exitCode=1;
