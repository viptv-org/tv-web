import { expect, it } from 'vitest';
import { motionGroupGeometry } from '../../src/tv-solid/platform/native-motion-geometry';

it('keeps nested motion relative to its moving parent and applies ancestor opacity once',()=>{
  const outer={absX:100,absY:200,alpha:0.5};
  const viewport={absX:120,absY:250,w:500,h:400,clipping:true,alpha:0.8,parentNode:outer};
  const inner={absX:130,absY:260,alpha:0.4,parentNode:viewport};
  const before=motionGroupGeometry(inner,outer);
  expect(before).toMatchObject({x:10,y:10,clipX:20,clipY:50,viewport:[0,0,500,400],localClip:false});
  expect(before.alpha).toBeCloseTo(0.32);
  outer.absX+=100;outer.absY+=100;viewport.absX+=100;viewport.absY+=100;inner.absX+=100;inner.absY+=100;
  expect(motionGroupGeometry(inner,outer)).toEqual(before);
  expect(motionGroupGeometry(inner).alpha).toBeCloseTo(0.16);
});
it('leaves an unclipped nested group unconstrained by an invented screen viewport',()=>{
  const parent={absX:0,absY:-2000,alpha:1};
  const child={absX:20,absY:0,alpha:0.5,parentNode:parent};
  expect(motionGroupGeometry(child,parent)).toMatchObject({x:20,y:2000,clipX:0,clipY:0,viewport:false,alpha:0.5});
});
