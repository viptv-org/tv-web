import { createRequire } from 'node:module';
import type { Page } from '@playwright/test';
import { tokens } from '../../src/theme/viptv-tokens.generated';
const { PNG } = createRequire(import.meta.url)('pngjs');
export const progressClip = {x:928,y:508,width:64,height:64};
const accent = [1,3,5].map(offset=>parseInt(tokens['color.accent.default'].slice(offset,offset+2),16));

export function progressPaint(bytes: Buffer, fullFrame=false) {
  const image=PNG.sync.read(bytes), x=fullFrame?progressClip.x:0, y=fullFrame?progressClip.y:0;
  let brightPixels=0;
  for(let row=y;row<y+64;row++)for(let column=x;column<x+64;column++) {
    const i=(row*image.width+column)*4;
    if(image.data[i+3]>240 && accent.every((value,index)=>Math.abs(image.data[i+index]-value)<=20)) brightPixels++;
  }
  return {brightPixels,accent};
}

export async function paintedProgress(page: Page) {
  return progressPaint(await page.screenshot({clip:progressClip}));
}
