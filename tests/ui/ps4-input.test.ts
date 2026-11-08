import {afterEach,expect,it,vi} from 'vitest';
import {installPs4Input} from '../../src/tv-solid/platform/ps4-input';
afterEach(()=>{vi.restoreAllMocks();delete document.documentElement.dataset.tvStartup;});
it('cancels delivered PS4 Back defaults while preserving application propagation',()=>{
 vi.spyOn(navigator,'userAgent','get').mockReturnValue('Mozilla/5.0 (PlayStation 4 12.00)');document.documentElement.dataset.tvStartup='ready';
 const remove=installPs4Input(),seen=vi.fn();document.addEventListener('keydown',seen);
 try{const event=new KeyboardEvent('keydown',{key:'Escape',keyCode:27,bubbles:true,cancelable:true});document.dispatchEvent(event);expect(event.defaultPrevented).toBe(true);expect(seen).toHaveBeenCalledOnce();
 const video=document.createElement('video');document.body.append(video);const back=new KeyboardEvent('keydown',{key:'Escape',keyCode:27,bubbles:true,cancelable:true});video.dispatchEvent(back);expect(back.defaultPrevented).toBe(true);video.remove();
 const input=document.createElement('input');document.body.append(input);const edit=new KeyboardEvent('keydown',{key:'Backspace',keyCode:8,bubbles:true,cancelable:true});input.dispatchEvent(edit);expect(edit.defaultPrevented).toBe(false);input.remove();}
 finally{remove();document.removeEventListener('keydown',seen);}
});
it('leaves Back defaults alone on other browsers',()=>{
 vi.spyOn(navigator,'userAgent','get').mockReturnValue('Desktop browser');document.documentElement.dataset.tvStartup='ready';const remove=installPs4Input();try{const event=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});document.dispatchEvent(event);expect(event.defaultPrevented).toBe(false);}finally{remove();}
});
