#!/usr/bin/env node
/** SolidTV account acceptance: real keyboard gestures, fixture-only API writes. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { installBackend } from './backend.ts';

const url = process.env.SOLID_PREVIEW_URL ?? 'https://viptv.local.test:8446/tv/solid.html';
const out = process.env.ACCOUNT_PREVIEW_DIR ?? '/tmp/viptv-account';
mkdirSync(out, { recursive: true });
const results = [];
const browser = await chromium.launch();
const entry = (page,id) => page.waitForFunction(id => window.__viptvEntryFocus?.id === id,id,{timeout:7000});
const oldFocus = (page,view,index) => page.waitForFunction(({view,index}) => window.__viptvFocus?.view===view && window.__viptvFocus?.index===index && !window.__viptvEntryFocus,{view,index},{timeout:7000});
const press = async(page,key) => { await page.keyboard.press(key); await page.waitForTimeout(35); };
const screenshot = async(page,name) => { await page.waitForTimeout(150); await page.screenshot({path:`${out}/${name}.png`}); };
const hold = async page => { await page.keyboard.down('Enter'); await page.waitForTimeout(760); await page.keyboard.up('Enter'); await entry(page,'profile-name'); };
const done = async(page,secret=false) => { for(let i=0;i<(secret?4:8);i++) await press(page,'ArrowDown'); await entry(page,'save'); await press(page,'Enter'); };
async function scenario(name, options, run) {
  if(process.argv.length>2 && !process.argv.slice(2).includes(name)) return;
  const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  const page=await context.newPage();
  try {
    const backend=await installBackend(page,{family:'tv',session:'profiles',...options});
    await page.goto(`${url}?platform=tizen&focusdebug=1`);
    await oldFocus(page,'profile-tile',0);
    await run(page,backend);
    assert.deepEqual(backend.errors,[]);
    results.push({name,passed:true});
    console.log(`PASS ${name}`);
  } catch(error) {
    const focus=await page.evaluate(()=>({entry:window.__viptvEntryFocus,scope:window.__viptvFocus})).catch(()=>null);
    await screenshot(page,`${name}-failed`).catch(()=>{});
    results.push({name,passed:false,error:error.message,focus});
    console.error(`FAIL ${name}: ${error.message}; focus=${JSON.stringify(focus)}`);
  } finally {await context.close();}
}
try {
  await scenario('profile-paging',{manyProfiles:true},async(page,backend)=>{
    await press(page,'ArrowDown');await oldFocus(page,'profile-page',1);
    await press(page,'Enter');await oldFocus(page,'profile-tile',0);
    await press(page,'ArrowDown');await oldFocus(page,'profile-page',1);
    await press(page,'Enter');await oldFocus(page,'profile-tile',0);
    await press(page,'ArrowDown');await oldFocus(page,'profile-page',0);
    await press(page,'Enter');await oldFocus(page,'profile-tile',0);
    await press(page,'ArrowDown');await oldFocus(page,'profile-page',1);
    await press(page,'Enter');await oldFocus(page,'profile-tile',0);
    await press(page,'ArrowRight');await oldFocus(page,'profile-tile',1);
    await press(page,'ArrowRight');await oldFocus(page,'profile-tile',1);
    await screenshot(page,'TvProfilesPaged');
    await press(page,'Enter');await page.waitForTimeout(200);
    assert.equal(backend.requests.find(r=>r.path==='/api/auth/profile')?.body.profile_id,'12');
    await oldFocus(page,'home-action',0);
  });
  await scenario('profile-second-matched',{},async(page)=>{
    await press(page,'ArrowRight'); await oldFocus(page,'profile-tile',1);
    await hold(page); await screenshot(page,'TvProfileEdit.matched');
    await press(page,'Enter'); await entry(page,'key-0');
    await screenshot(page,'TvProfileName.matched');
    await press(page,'Escape'); await entry(page,'profile-name');
    await press(page,'Escape'); await oldFocus(page,'profile-tile',1);
  });
  await scenario('profile-unlock',{profilePin:true},async(page,backend)=>{
    await press(page,'ArrowRight'); await oldFocus(page,'profile-tile',1);
    await press(page,'ArrowRight'); await oldFocus(page,'profile-tile',2);
    await press(page,'Enter'); await entry(page,'key-0');
    await page.keyboard.type('1234'); await done(page,true);
    await oldFocus(page,'home-action',0);
    const selections=backend.requests.filter(r=>r.path==='/api/auth/profile');
    assert.equal(selections.length,2,'protected selection must retry once after unlocking');
    assert.ok(selections.every(request=>request.body.profile_id==='3'));
  });
  await scenario('profile-edit-pin-avatar',{profilePin:true},async(page,backend)=>{
    await hold(page);
    assert.equal(backend.requests.filter(r=>r.path==='/api/auth/profile').length,0,'hold must not select on release');
    await screenshot(page,'TvProfileEdit');
    await press(page,'ArrowDown'); await entry(page,'profile-save');
    await press(page,'ArrowRight'); await entry(page,'profile-cancel');
    await press(page,'ArrowRight'); await entry(page,'profile-cancel'); // Primary cannot reach delete.
    await press(page,'ArrowUp'); await entry(page,'profile-name');
    await press(page,'Enter'); await entry(page,'key-0');
    for(let i=0;i<5;i++) await press(page,'Backspace'); // fixture vynxc
    await page.keyboard.type('Account test');
    await screenshot(page,'TvProfileName');
    await done(page); await entry(page,'profile-name');
    await press(page,'ArrowDown'); await entry(page,'profile-save'); await press(page,'Enter');
    await entry(page,'key-0');
    await screenshot(page,'TvPin');
    await done(page,true); // Empty PIN rejected before any unlock request.
    assert.equal(backend.requests.filter(r=>r.path==='/api/parent/unlock').length,0);
    await page.keyboard.type('1234'); await press(page,'Enter');
    await oldFocus(page,'profile-tile',0);
    const patches=backend.requests.filter(r=>r.path==='/api/profiles/1' && r.method==='PATCH');
    assert.equal(patches.length,2,'403 must retry original save exactly once');
    assert.equal(patches.at(-1).body.name,'Account test');
    await hold(page); await press(page,'ArrowLeft'); await entry(page,'profile-avatar');
    await press(page,'Enter'); await entry(page,'world-10');
    for(let i=9;i>=0;i--){await press(page,'ArrowLeft');await entry(page,`world-${i}`);}
    for(let i=1;i<12;i++){await press(page,'ArrowRight');await entry(page,`world-${i}`);}
    await press(page,'ArrowDown'); await entry(page,'avatar-0');
    for(const id of ['avatar-6','avatar-12','avatar-next']){await press(page,'ArrowDown');await entry(page,id);}
    await press(page,'Enter'); await entry(page,'avatar-0');
    await screenshot(page,'TvAvatars');
    await press(page,'Enter'); await entry(page,'profile-avatar');
    await press(page,'ArrowRight'); await entry(page,'profile-name');
    await press(page,'ArrowDown'); await entry(page,'profile-save'); await press(page,'Enter');
    await oldFocus(page,'profile-tile',0);
    const update=backend.requests.filter(r=>r.path==='/api/profiles/1' && r.method==='PATCH').at(-1);
    assert.equal(update.body.avatar_style,'notionists'); assert.equal(update.body.avatar_choice,19);
    assert.equal(backend.requests.filter(r=>r.method==='DELETE').length,0);
  });
  await scenario('profile-create-delete',{},async(page,backend)=>{
    for(let i=1;i<=3;i++){await press(page,'ArrowRight');await oldFocus(page,'profile-tile',i);}
    await press(page,'Enter');await entry(page,'profile-name');
    await press(page,'Enter');await entry(page,'key-0');await page.keyboard.type('Fixture profile');
    await done(page);await entry(page,'profile-name');await press(page,'ArrowDown');await entry(page,'profile-save');await press(page,'Enter');
    await oldFocus(page,'profile-tile',3);
    assert.equal(backend.requests.filter(r=>r.path==='/api/profiles' && r.method==='POST').at(-1).body.name,'Fixture profile');
    await hold(page);await press(page,'ArrowDown');await entry(page,'profile-save');
    await press(page,'ArrowRight');await press(page,'ArrowRight');await entry(page,'profile-delete');await press(page,'Enter');await entry(page,'delete-cancel');
    await press(page,'ArrowDown');await entry(page,'delete-confirm');await press(page,'Enter');await oldFocus(page,'profile-tile',3);
    assert.equal(backend.requests.filter(r=>r.path==='/api/profiles/4' && r.method==='DELETE').length,1);
  });
  await scenario('wrong-pin-cancel',{profilePin:true,wrongPin:true},async(page,backend)=>{
    await hold(page);await press(page,'ArrowDown');await entry(page,'profile-save');await press(page,'Enter');await entry(page,'key-0');
    await page.keyboard.type('0000');await done(page,true);await entry(page,'save');
    await page.waitForTimeout(150);await screenshot(page,'TvPinError');
    assert.equal(backend.requests.filter(r=>r.path==='/api/parent/unlock').length,1);
    assert.equal(backend.requests.filter(r=>r.path==='/api/profiles/1' && r.method==='PATCH').length,1,'rejected PIN cannot retry save');
    await press(page,'Escape');await entry(page,'profile-save');await press(page,'Escape');await oldFocus(page,'profile-tile',0);
    await press(page,'ArrowRight');await oldFocus(page,'profile-tile',1);
  });
  await scenario('saving-cancel-focus',{profileSaveHang:true},async(page,backend)=>{
    await hold(page);await press(page,'ArrowDown');await entry(page,'profile-save');await press(page,'Enter');
    await page.waitForTimeout(100);assert.equal(backend.requests.filter(r=>r.path==='/api/profiles/1' && r.method==='PATCH').length,1);
    await press(page,'Escape');await oldFocus(page,'profile-tile',0);await press(page,'ArrowRight');await oldFocus(page,'profile-tile',1);
  });
} finally {
  await browser.close();
  writeFileSync(`${out}/results.json`,JSON.stringify({scope:'browser fixture account behavior; not physical-TV or visual-parity qualification',results},null,2));
}
if(results.some(result=>!result.passed)) process.exitCode=1;
