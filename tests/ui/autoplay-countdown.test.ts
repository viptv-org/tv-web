import { expect, it, vi } from 'vitest';
import { AutoplayCountdown } from '../../src/tv-solid/remote/autoplay-countdown';
function setup(){
 let now=0,id=0;const frames=new Map<number,()=>void>();
 const countdown=new AutoplayCountdown(vi.fn(),{now:()=>now,frame:callback=>{frames.set(++id,callback);return id;},cancel:key=>{frames.delete(key);}});
 return {countdown,step:(time:number)=>{now=time;const pending=[...frames.values()];frames.clear();pending.forEach(callback=>callback());}};
}
it('waits ten seconds and one final input frame, then hands off exactly once',()=>{
 const {countdown:c,step}=setup(),play=vi.fn();c.start('episode',true,()=>true,play);
 step(9999);expect(play).not.toHaveBeenCalled();expect(c.state.remaining).toBe(1);
 step(10000);expect(play).not.toHaveBeenCalled();step(10016);expect(play).toHaveBeenCalledOnce();
 c.start('episode',true,()=>true,play);step(30000);expect(play).toHaveBeenCalledOnce();
});
it('lets Back in the deadline frame win and never rearms for that end',()=>{
 const {countdown:c,step}=setup(),play=vi.fn();c.start('episode',true,()=>true,play);step(10000);c.cancel();step(10016);
 c.start('episode',true,()=>true,play);step(30000);expect(play).not.toHaveBeenCalled();expect(c.state.running).toBe(false);
});
it('cancels if a successor disappears and honors device autoplay off',()=>{
 const {countdown:c,step}=setup(),play=vi.fn();let valid=true;c.start('one',true,()=>valid,play);step(10000);valid=false;step(10016);
 expect(play).not.toHaveBeenCalled();expect(c.state.running).toBe(false);
 c.start('two',false,()=>true,play);step(30000);expect(play).not.toHaveBeenCalled();
});
