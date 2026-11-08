import { test, expect, type Page } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';

async function playFirst(page:Page) {
 await page.goto('/tv/?focusdebug=1');
 await expect(page.locator('html')).toHaveAttribute('data-tv-ready','true');
 await page.keyboard.press('Enter');
 await expect(page.locator('html')).toHaveAttribute('data-tv-overlay','sources');
 await expect(page.locator('html')).toHaveAttribute('data-tv-sources','8');
 await expect(page.locator('html')).toHaveAttribute('data-tv-ready','true');
 await page.keyboard.press('Enter');
 await expect(page.locator('html')).toHaveAttribute('data-tv-player-state','playing');
 await expect(page.locator('html')).toHaveAttribute('data-tv-overlay','');
 await expect.poll(()=>page.locator('video').evaluate(v=>(v as HTMLVideoElement).videoWidth)).toBe(160);
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('viptv-device-playback:v1'))).toContain('Supplier A');
}

test('prepares the next episode without admission, Next bypasses Ask and never overwrites the manual choice',async({page,baseURL})=>{
 const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true});
 await playFirst(page);
 await expect(page.locator('html')).toHaveAttribute('data-tv-next-prepared','true');
 expect(fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST')).toHaveLength(1);
 const remembered=await page.evaluate(()=>localStorage.getItem('viptv-device-playback:v1'));
 expect(remembered).toContain('Supplier A');expect(remembered).not.toContain('stream-0');
 await page.keyboard.press('ArrowUp');
 await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
 await page.keyboard.press('Enter');
 await expect.poll(()=>fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST').length).toBe(2);
 await expect(page.locator('html')).toHaveAttribute('data-tv-overlay','');
 expect(await page.evaluate(()=>localStorage.getItem('viptv-device-playback:v1'))).toBe(remembered);
 const nextDiscovery=fixture.requests.filter(r=>r.path==='/api/streams'&&r.body.episode===2);
 expect(nextDiscovery).toHaveLength(1);
});

test('shows the ten-second end countdown, any key cancels and Back dismisses without autoplay',async({page,baseURL})=>{
 const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true});
 await playFirst(page);
 await expect(page.locator('html')).toHaveAttribute('data-tv-overlay','next',{timeout:15000});
 await expect(page.locator('html')).toHaveAttribute('data-tv-autoplay-countdown',/\d+/);
 await page.keyboard.press('ArrowRight');
 await expect(page.locator('html')).toHaveAttribute('data-tv-autoplay-countdown','');
 await page.keyboard.press('Escape');
 await expect(page.locator('html')).toHaveAttribute('data-tv-overlay','');
 await page.waitForTimeout(11000);
 expect(fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST')).toHaveLength(1);
});

test('autoplays the prepared successor after the countdown without a second picker or source discovery',async({page,baseURL})=>{
 const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true});
 await playFirst(page);
 await expect(page.locator('html')).toHaveAttribute('data-tv-overlay','next',{timeout:15000});
 await expect.poll(()=>fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST').length,{timeout:15000}).toBe(2);
 expect(fixture.requests.filter(r=>r.path==='/api/streams'&&r.body.episode===2)).toHaveLength(1);
 await expect(page.locator('html')).toHaveAttribute('data-tv-overlay','');
});

test('relaunch uses persisted series choice with fresh discovery and a hold explicitly opens the picker',async({page,baseURL})=>{
 const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true});
 await playFirst(page);
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('viptv-device-playback:v1'))).toContain('Supplier A');
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-tv-ready','true');
 await page.keyboard.press('Enter');
 await expect(page.locator('html')).toHaveAttribute('data-tv-screen','player');
 await expect(page.locator('html')).toHaveAttribute('data-tv-overlay','');
 await expect(page.locator('html')).toHaveAttribute('data-tv-player-state','playing');
 expect(fixture.requests.filter(r=>r.path==='/api/streams'&&r.body.episode===1).length).toBeGreaterThanOrEqual(2);
 await expect(page.locator('html')).toHaveAttribute('data-tv-ready','true');
 await page.keyboard.down('Enter');await page.waitForTimeout(800);await page.keyboard.up('Enter');
 await expect(page.locator('html')).toHaveAttribute('data-tv-overlay','sources');
});

test('a remembered choice with no same-language candidate opens the picker',async({page,baseURL})=>{
 const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true,reuseMatch:false});
 await playFirst(page);
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('viptv-device-playback:v1'))).toContain('Supplier A');
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-tv-ready','true');await page.keyboard.press('Enter');
 await expect(page.locator('html')).toHaveAttribute('data-tv-overlay','sources');
 expect(fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST')).toHaveLength(1);
});

test('standalone Skip intro remains available with hidden controls and preserves paused intent',async({page,baseURL})=>{
 const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true});
 await playFirst(page);
 await page.locator('video').evaluate(v=>{(v as HTMLVideoElement).loop=true;});
 await page.waitForTimeout(5300);
 await page.evaluate(()=>{for(const type of ['keydown','keyup']) window.dispatchEvent(new KeyboardEvent(type,{key:'MediaPause',keyCode:19,bubbles:true}));});
 await expect(page.locator('html')).toHaveAttribute('data-tv-player-state','paused');
 await page.locator('video').evaluate(v=>{(v as HTMLVideoElement).currentTime=0.25;});
 await expect.poll(()=>page.locator('video').evaluate(v=>(v as HTMLVideoElement).seeking)).toBe(false);
 await page.locator('video').evaluate(v=>v.dispatchEvent(new Event('timeupdate')));
 // Up focuses the marker shortcut in the toolbar; OK performs a real lease seek.
 await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');
 await expect.poll(()=>fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST').some(r=>r.body.position===2)).toBe(true);
 await expect(page.locator('html')).toHaveAttribute('data-tv-player-state','paused');
});

test('autoplay off persists across reloads and keeps the ended panel manual',async({page,baseURL})=>{
 const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true});
 await page.addInitScript(()=>localStorage.setItem('viptv-device-playback:v1',JSON.stringify({version:1,autoplay:false,across:[],entries:[]})));
 await playFirst(page);
 await expect(page.locator('html')).toHaveAttribute('data-tv-overlay','next',{timeout:15000});
 await expect(page.locator('html')).toHaveAttribute('data-tv-autoplay-countdown','');
 await page.waitForTimeout(11000);
 expect(fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST')).toHaveLength(1);
 await page.keyboard.press('Enter');
 await expect.poll(()=>fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST').length).toBe(2);
});

test('configuration changes discard prepared source grants before the handoff',async({page,baseURL})=>{
 const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true});await playFirst(page);
 await expect(page.locator('html')).toHaveAttribute('data-tv-next-prepared','true');
 fixture.setConfigurationRevision(1);
 await page.keyboard.press('ArrowUp');for(let i=0;i<3;i++)await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
 await expect.poll(()=>fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST').length).toBe(2);
 expect(fixture.requests.filter(r=>r.path==='/api/streams'&&r.body.episode===2)).toHaveLength(2);
});

test('caps automatic startup at three sources and keeps the successful manual preference intact',async({page,baseURL})=>{
 const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true});await playFirst(page);
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('viptv-device-playback:v1'))).toContain('Supplier A');
 const memory=await page.evaluate(()=>localStorage.getItem('viptv-device-playback:v1'));fixture.failNextAdmissions(3);
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-tv-ready','true');await page.keyboard.press('Enter');
 await expect(page.locator('html')).toHaveAttribute('data-tv-overlay','sources',{timeout:15000});
 const attempts=fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST').slice(1);
 expect(attempts.map(r=>r.body.stream_id)).toEqual(['stream-0','stream-2','stream-4']);
 expect(await page.evaluate(()=>localStorage.getItem('viptv-device-playback:v1'))).toBe(memory);
});

test('holding Next opens the next episode picker without starting it',async({page,baseURL})=>{
 const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true});await playFirst(page);
 await expect(page.locator('html')).toHaveAttribute('data-tv-ready','true');
 await page.evaluate(()=>{for(const type of ['keydown','keyup']) window.dispatchEvent(new KeyboardEvent(type,{key:'MediaPause',keyCode:19,bubbles:true}));});
 await expect(page.locator('html')).toHaveAttribute('data-tv-player-state','paused');
 await page.keyboard.press('ArrowUp');for(let i=0;i<3;i++)await page.keyboard.press('ArrowRight');
 await page.keyboard.down('Enter');await page.waitForTimeout(800);await page.keyboard.up('Enter');
 await expect(page.locator('html')).toHaveAttribute('data-tv-overlay','sources');
 expect(fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST')).toHaveLength(1);
 expect(fixture.requests.filter(r=>r.path.endsWith('/viewing-action')).slice(-1)[0]?.body.card.identity.episode.episode).toBe(2);
});

test('Playback switches persist locally without adding fields to profile preference requests',async({page,baseURL})=>{
 const fixture=await installRemoteBackend(page,baseURL!,{episodeFlow:true});
 await page.goto('/tv/?focusdebug=1');const state=page.locator('html');await expect(state).toHaveAttribute('data-tv-ready','true');
 await page.keyboard.press('ArrowUp');const ids=(await state.getAttribute('data-tv-navigation'))!.split(',');
 const index=Number((await state.getAttribute('data-tv-focus'))!.split(':')[1]);
 for(let i=index;i<ids.indexOf('profiles');i++)await page.keyboard.press('ArrowRight');
 await page.keyboard.press('Enter');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await expect(state).toHaveAttribute('data-tv-screen','settings');await expect(state).toHaveAttribute('data-tv-ready','true');
 await page.keyboard.press('ArrowRight');for(let i=0;i<30;i++)await page.keyboard.press('ArrowDown');
 await page.keyboard.press('Enter');await expect(state).toHaveAttribute('data-tv-ready','true');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('viptv-device-playback:v1')||'{}').across?.length)).toBe(1);
 await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');await expect(state).toHaveAttribute('data-tv-ready','true');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('viptv-device-playback:v1')||'{}').autoplay)).toBe(false);
 expect(fixture.requests.filter(r=>r.path.endsWith('/preferences')&&r.method==='PUT')).toHaveLength(0);
 await page.reload();await expect(state).toHaveAttribute('data-tv-ready','true');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('viptv-device-playback:v1')||'{}').autoplay)).toBe(false);
});

test('pending continuation metadata recovers before the end without guessing an episode',async({page,baseURL})=>{
 const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true,pendingContinuation:true});await playFirst(page);
 await expect(page.locator('html')).toHaveAttribute('data-tv-next-status','loading');
 expect(fixture.requests.filter(r=>r.path==='/api/streams'&&r.body.episode===2)).toHaveLength(0);
 fixture.completeContinuation();
 await expect(page.locator('html')).toHaveAttribute('data-tv-next-prepared','true',{timeout:10000});
 expect(fixture.requests.filter(r=>r.path==='/api/streams'&&r.body.episode===2)).toHaveLength(1);
 expect(fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST')).toHaveLength(1);
});

test('Back during next-episode admission restores the outgoing episode and its paused decoder',async({page,baseURL})=>{
 const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true});await playFirst(page);
 await page.evaluate(()=>{for(const type of ['keydown','keyup'])window.dispatchEvent(new KeyboardEvent(type,{key:'MediaPause',keyCode:19,bubbles:true}));});
 const state=page.locator('html');await expect(state).toHaveAttribute('data-tv-player-state','paused');
 await expect(state).toHaveAttribute('data-tv-next-prepared','true');
 const release=fixture.holdNextAdmission();
 await page.keyboard.press('ArrowUp');for(let i=0;i<3;i++)await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
 await expect.poll(()=>fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST').length).toBe(2);
 await expect(state).toHaveAttribute('data-tv-player-episode','2');
 await page.keyboard.press('Escape');await expect(state).toHaveAttribute('data-tv-player-episode','1');
 await expect(state).toHaveAttribute('data-tv-player-state','paused');
 expect(await page.locator('video').evaluate(v=>(v as HTMLVideoElement).paused)).toBe(true);
 expect(fixture.requests.filter(r=>r.path==='/api/playback/fixture-playback'&&r.method==='DELETE')).toHaveLength(0);
 release();
});

test('prepares the preferred source before a slow provider finishes without opening a second lease',async({page,baseURL})=>{
 const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true,finding:true});
 try {
  await playFirst(page);
  await expect(page.locator('html')).toHaveAttribute('data-tv-next-prepared','true',{timeout:3000});
  expect(fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST')).toHaveLength(1);
  expect(fixture.requests.filter(r=>r.path==='/api/streams'&&r.body.episode===2)).toHaveLength(1);
  await page.evaluate(()=>{for(const type of ['keydown','keyup'])window.dispatchEvent(new KeyboardEvent(type,{key:'MediaPause',keyCode:19,bubbles:true}));});
  await expect(page.locator('html')).toHaveAttribute('data-tv-player-state','paused');
  await page.keyboard.press('ArrowUp');for(let i=0;i<3;i++)await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
  await expect.poll(()=>fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST').length).toBe(2);
  await expect(page.locator('html')).toHaveAttribute('data-tv-overlay','');
  expect(fixture.requests.filter(r=>r.path==='/api/streams'&&r.body.episode===2)).toHaveLength(1);
 } finally { fixture.completeDiscovery(); }
});

test('remembers the selected delivery language instead of every language in a bilingual source',async({page,baseURL})=>{
 await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true,sourceAudioLanguages:['en','hi'],selectedAudioLanguage:'eng'});
 await playFirst(page);
 const entries=await page.evaluate(()=>JSON.parse(localStorage.getItem('viptv-device-playback:v1')||'{}').entries);
 expect(entries.length).toBeGreaterThan(0);
 for(const [,source] of entries)expect(source.audio_languages).toEqual(['eng']);
});

test('Back hides ended-player controls and the next Select only reveals them',async({page,baseURL})=>{
 const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true});await playFirst(page);
 const state=page.locator('html');await expect(state).toHaveAttribute('data-tv-overlay','next',{timeout:15000});
 const texts=()=>page.evaluate(()=>{const values:string[]=[];const visit=(node:any)=>{if(node.isRenderable&&node.viptvText)values.push(node.viptvText);node.children?.forEach(visit);};visit((window as any).__viptvRenderer.stage.root);return values;});
 await page.keyboard.press('Escape');await expect(state).toHaveAttribute('data-tv-overlay','');
 await expect.poll(texts).not.toContain('Play');
 await page.keyboard.press('Enter');await expect.poll(texts).toContain('Play');
 await expect(state).toHaveAttribute('data-tv-player-state','ended');
 expect(fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST')).toHaveLength(1);
});

test('Media Play after dismissing Up Next reveals controls then restarts through fresh source discovery',async({page,baseURL})=>{
 const fixture=await installRemoteBackend(page,baseURL!,{media:true,episodeFlow:true});await playFirst(page);
 const state=page.locator('html');await expect(state).toHaveAttribute('data-tv-overlay','next',{timeout:15000});await page.keyboard.press('Escape');
 const play=()=>page.evaluate(()=>{for(const type of ['keydown','keyup'])window.dispatchEvent(new KeyboardEvent(type,{key:'MediaPlay',keyCode:415,bubbles:true}));});
 await play();await expect(state).toHaveAttribute('data-tv-player-state','ended');
 expect(fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST')).toHaveLength(1);
 await play();await expect.poll(()=>fixture.requests.filter(r=>r.path==='/api/playback'&&r.method==='POST').length).toBe(2);
 expect(fixture.requests.filter(r=>r.path==='/api/streams'&&r.body.episode===1)).toHaveLength(2);
 expect(fixture.requests.filter(r=>r.path.endsWith('/viewing-action')).slice(-1)[0].body.restart).toBe(true);
});
