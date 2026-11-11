import { expect, it } from 'vitest';
import { imageDecodeSize } from '../../src/tv-solid/platform/image-decode-size';

it('accepts a smaller decode while retaining the caller’s display rectangle',()=>{
  expect(imageDecodeSize(1920,1080,960,540)).toEqual({width:960,height:540});
  expect(imageDecodeSize(240,360)).toEqual({width:240,height:360});
});
it('bounds invalid and oversized hints',()=>{
  expect(imageDecodeSize(240,360,NaN,-1)).toEqual({width:240,height:360});
  expect(imageDecodeSize(1920,1080,99999,99999)).toEqual({width:3840,height:2160});
});
