import { afterEach, expect, it, vi } from 'vitest';
const fake=vi.hoisted(()=>({sections:new Map<string,Map<string,string>>(),write:true,flush:vi.fn(async()=>true)}));
vi.mock('@roku-sdk/rsg-ts/runtime',()=>({getRegistry:async()=>({
 create(name:string){if(!fake.sections.has(name))fake.sections.set(name,new Map());const values=fake.sections.get(name)!;return{
  read:(key:string)=>values.get(key)??null,exists:(key:string)=>values.has(key),delete:(key:string)=>values.delete(key),
  write:(key:string,value:string)=>{if(!fake.write)return false;values.set(key,value);return true;}
 };},flush:fake.flush,
})}));
import {deviceStorage}from'../src/roku/device-storage';
afterEach(()=>{fake.sections.clear();fake.write=true;fake.flush.mockReset().mockResolvedValue(true);});
it('flushes durable token/settings changes and reads them from a new port without relying on localStorage',async()=>{
 const first=deviceStorage('session','tokens');await first.save('opaque-session');
 expect(fake.flush).toHaveBeenCalledOnce();expect(await deviceStorage('session','tokens').load()).toBe('opaque-session');
 const settings=deviceStorage('playback','settings');await settings.save('{"autoplay":false}');
 expect(await first.load()).toBe('opaque-session');
 await first.clear();await first.clear();expect(await first.load()).toBeNull();expect(await settings.load()).toBe('{"autoplay":false}');
 expect(fake.flush).toHaveBeenCalledTimes(3);
});
it('reports rejected writes/flushes and recovers the serial queue for a later retry',async()=>{
 const port=deviceStorage('playback','settings');fake.write=false;
 await expect(port.save('one')).rejects.toThrow('could not be saved');expect(fake.flush).not.toHaveBeenCalled();
 fake.write=true;fake.flush.mockResolvedValueOnce(false);
 await expect(port.save('two')).rejects.toThrow('could not be saved');
 await port.save('three');expect(await port.load()).toBe('three');
});
