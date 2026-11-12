import { afterEach, expect, it, vi } from 'vitest';
import { DevicePlayback, deviceProfileKey, deviceTitleKey, type SourceChoice } from '../../src/tv-solid/remote/device-playback';
import type { Card, Source } from '../../src/tv-solid/remote/types';
const scope=deviceProfileKey('https://api.example','one');
const card:Card={identity:{kind:'series',id:'episode-1',ids:[],episode:{order:'aired',season:1,episode:1}},parent_identity:{kind:'series',id:'series',ids:[]},provider_id:'metadata',title:'Episode',badges:[]};
const a:SourceChoice={provider_id:'addon:a',provider_name:'CineStream',audio_languages:['en']};
const b:SourceChoice={provider_id:'addon:b',provider_name:'Alternative',audio_languages:['en']};
function storage(){let value:string|null=null;return{load:vi.fn(async()=>value),save:vi.fn(async(v:string)=>{value=v;}),raw:()=>value};}
afterEach(()=>vi.useRealTimers());
it('remembers a presented source when optional wire metadata is null', async()=>{
 const port=storage(),device=new DevicePlayback(port);
 const source=JSON.parse('{"id":"ephemeral-stream","source_addon_id":"addon:a","presentation":{"source_id":null,"provider_name":null},"audio_languages":["en"]}') as Source;
 await expect(device.rememberSource(scope,'movie',source)).resolves.toBeUndefined();
 expect(port.save).toHaveBeenCalledOnce();
 const restored=new DevicePlayback(port);
 expect((await restored.context(scope,'movie')).title).toEqual({provider_id:'addon:a',audio_languages:['en']});
 expect(port.raw()).not.toContain('ephemeral-stream');
});
it('does not hide actual source-memory storage failures or accept URL identities',async()=>{
 const port=storage(),device=new DevicePlayback(port),source:Source={id:'stream',source_addon_id:'addon:a'};
 port.save.mockRejectedValueOnce(new Error('storage denied'));
 await expect(device.rememberSource(scope,'movie',source)).rejects.toThrow('storage denied');
 expect((await device.context(scope,'movie')).title).toBeUndefined();
 await expect(device.rememberSource(scope,'movie',{...source,presentation:{source_id:'https://private.invalid/token'}})).rejects.toThrow('cannot be remembered');
 expect(port.save).toHaveBeenCalledOnce();
});
it('persists a series choice across episodes, new instances and five days without saving URLs or stream IDs',async()=>{
 const port=storage(),first=new DevicePlayback(port);await first.ready;
 await first.remember(scope,deviceTitleKey(scope,card),{...a,id:'expired-stream',url:'https://media.example/private-capability'} as SourceChoice);
 vi.useFakeTimers();vi.setSystemTime(Date.now()+5*86400000);
 const restarted=new DevicePlayback(port);await restarted.ready;
 const next={...card,identity:{...card.identity,id:'episode-2',episode:{order:'aired',season:1,episode:2}}};
 expect((await restarted.context(scope,deviceTitleKey(scope,next))).title).toEqual(a);
 expect(port.raw()).not.toContain('expired-stream');expect(port.raw()).not.toContain('private-capability');
});
it('keeps profiles separate and returns independent observation objects',async()=>{
 const device=new DevicePlayback(storage());await device.ready;await device.remember(scope,deviceTitleKey(scope,card),a);
 const other=deviceProfileKey('https://api.example','two');
 expect(await device.context(other,deviceTitleKey(other,card))).toEqual({title:undefined,across:undefined});
 const read=await device.context(scope,deviceTitleKey(scope,card));read.title!.audio_languages.push('ja');
 expect((await device.context(scope,deviceTitleKey(scope,card))).title?.audio_languages).toEqual(['en']);
});
it('makes cross-title reuse opt-in, updates it on manual picks and preserves it during disabled exceptions',async()=>{
 const device=new DevicePlayback(storage());await device.ready;await device.remember(scope,'title-a',a);
 expect((await device.context(scope,'new-title')).across).toBeUndefined();
 await device.setAcross(scope,true);expect((await device.context(scope,'new-title')).across).toEqual(a);
 await device.remember(scope,'title-b',b);expect(await device.context(scope,'title-a')).toEqual({title:a,across:b});
 await device.setAcross(scope,false);await device.remember(scope,'title-c',a);
 await device.setAcross(scope,true);expect((await device.context(scope,'new-title')).across).toEqual(b);
});
it('defaults autoplay on for missing/corrupt data and persists an explicit off value',async()=>{
 const port=storage();let device=new DevicePlayback(port);await device.ready;expect(device.autoplay).toBe(true);
 await device.setAutoplay(false);device=new DevicePlayback(port);await device.ready;expect(device.autoplay).toBe(false);
 device=new DevicePlayback({load:async()=>'{bad',save:async()=>{}});await device.ready;expect(device.autoplay).toBe(true);
});
it('bounds records below the native registry budget and never evicts the latest successful choice first',async()=>{
 const port=storage(),device=new DevicePlayback(port);await device.ready;
 for(let i=0;i<250;i++)await device.remember(scope,'title-'+i+'x'.repeat(250),a);
 const raw=port.raw()!;expect(new TextEncoder().encode(raw).length).toBeLessThanOrEqual(16384);
 expect(JSON.parse(raw).entries.length).toBeLessThanOrEqual(200);
 expect((await device.context(scope,'title-249'+'x'.repeat(250))).title).toEqual(a);
});
it('retains confirmed settings if durable storage rejects a save',async()=>{
 const port=storage(),device=new DevicePlayback(port);await device.ready;
 port.save.mockRejectedValueOnce(new Error('full'));
 await expect(device.setAutoplay(false)).rejects.toThrow('full');expect(device.autoplay).toBe(true);
 await device.setAutoplay(false);expect(device.autoplay).toBe(false);
});
it('retains stable supplier identity through persistence and legacy setting toggles',async()=>{
 const port=storage(),device=new DevicePlayback(port);await device.ready;await device.remember(scope,'movie-one',{...a,source_id:'supplier-a'});await device.setAcross(scope,true);const restored=new DevicePlayback(port);await restored.ready;expect((await restored.context(scope,'movie-two')).across).toEqual({...a,source_id:'supplier-a'});await restored.setAcross(scope,false);expect((await restored.context(scope,'movie-two')).across).toBeUndefined();expect((await restored.context(scope,'movie-one')).title?.source_id).toBe('supplier-a');
});
