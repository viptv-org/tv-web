import { afterEach, expect, it, vi } from 'vitest';
import { Animator } from '../src/roku/animation';
import { CompositorAnimation, compositorEasing, type MotionFeedback, type MotionSink } from '../src/roku/compositor-animation';

afterEach(() => vi.unstubAllGlobals());
function setup() {
  const commands: { action: string; serial: number; target: number; duration: number; reply: (value: MotionFeedback) => void }[] = [];
  const sink: MotionSink = { prepare:vi.fn(), send(action,serial,target,duration,_ease,reply) {commands.push({action,serial,target,duration,reply});}, dispose:vi.fn() };
  const publish=vi.fn(), track=new CompositorAnimation(5,105,200,'outQuad',publish,sink);
  const respond=(index:number,state:string,value:number)=>commands[index].reply({serial:commands[index].serial,state,value});
  return {track,commands,respond,publish,sink};
}
it('waits for native completion even when the JavaScript clock advances past the duration',async()=>{
  const s=setup(),animator=new Animator(),node={y:5,requestRender(){}};
  vi.stubGlobal('__viptvCreateNativeAnimation',()=>s.track);
  const controller=animator.create(node,{y:105},{duration:200},vi.fn()).start();
  const stopped=vi.fn();void controller.waitUntilStopped().then(stopped);
  animator.tick(5000);await Promise.resolve();
  expect(controller.state).toBe('running');expect(animator.running).toBe(false);expect(stopped).not.toHaveBeenCalled();
  s.respond(0,'stopped',105);await Promise.resolve();
  expect(stopped).toHaveBeenCalledOnce();expect(controller.state).toBe('stopped');
});
it('retargets without accepting a retired native run and resumes after a pause',()=>{
  const s=setup();s.track.start();s.track.retarget(205);
  s.respond(0,'stopped',105);expect(s.track.done).toBe(false);expect(s.publish).toHaveBeenLastCalledWith(205);
  s.track.pause();s.respond(2,'paused',70);expect(s.publish).toHaveBeenLastCalledWith(70);
  s.track.resume();expect(s.commands[3].action).toBe('resume');expect(s.publish).toHaveBeenLastCalledWith(205);
  s.respond(3,'stopped',205);expect(s.track.done).toBe(true);
});
it('freezes on native stop acknowledgement and fences callbacks after destruction',()=>{
  const s=setup();s.track.start();s.track.stop();s.respond(1,'stopped',35);
  expect(s.track.value).toBe(35);expect(s.track.done).toBe(true);
  s.track.retarget(85);s.track.remove();s.respond(2,'stopped',85);
  expect(s.sink.dispose).toHaveBeenCalledOnce();expect(s.publish).toHaveBeenLastCalledWith(85);
  expect(s.track.done).toBe(true);
});
it('restores the original value with a native snap',()=>{
  const s=setup();s.track.start();s.track.restore();
  expect(s.commands[1]).toMatchObject({target:5,duration:0});s.respond(1,'stopped',5);expect(s.track.done).toBe(true);
});
it('keeps unsupported lifecycle and easing requests on the JavaScript driver',()=>{
  expect(compositorEasing({duration:200,easing:'ease-out'})).toBe('outQuad');
  for(const settings of [{loop:true},{repeat:2},{delay:10},{remove:true},{stopMethod:'reverse' as const},{easing:()=>0.5},{easing:'cubic-bezier(.2,0,0,1)'}])
    expect(compositorEasing(settings)).toBeUndefined();
});

it('pauses native work with the renderer and disposes it on scene cleanup',()=>{
  const s=setup(),animator=new Animator(),node={y:5,requestRender(){}};
  vi.stubGlobal('__viptvCreateNativeAnimation',()=>s.track);
  animator.create(node,{y:105},{duration:200},vi.fn()).start();
  animator.paused=true;expect(s.commands.at(-1)?.action).toBe('pause');
  s.respond(1,'paused',35);animator.paused=false;expect(s.commands.at(-1)?.action).toBe('resume');
  animator.clear();expect(s.sink.dispose).toHaveBeenCalledOnce();expect(s.track.done).toBe(true);
});

it('holds native work created while the renderer is already paused',()=>{
  const s=setup(),animator=new Animator();animator.paused=true;
  vi.stubGlobal('__viptvCreateNativeAnimation',()=>s.track);
  animator.create({y:5,requestRender(){}},{y:105},{duration:200},vi.fn()).start();
  expect(s.commands.map(c=>c.action)).toEqual(['start','pause']);
  s.respond(1,'paused',5);animator.paused=false;expect(s.commands.at(-1)?.action).toBe('resume');
});

it('retires a replaced native track before its delayed stop callback can publish',()=>{
  const old=setup(),next=setup(),animator=new Animator();let replacement=false;
  vi.stubGlobal('__viptvCreateNativeAnimation',()=>replacement?next.track:old.track);
  const node={y:5,requestRender(){}};
  animator.create(node,{y:105},{duration:200},vi.fn()).start();replacement=true;
  animator.create(node,{y:205},{duration:300},vi.fn()).start();
  const before=old.publish.mock.calls.length;
  old.respond(1,'stopped',35);
  expect(old.publish).toHaveBeenCalledTimes(before);expect(old.sink.dispose).toHaveBeenCalledOnce();
});
