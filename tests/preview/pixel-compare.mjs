#!/usr/bin/env node
/*
 * Compare a TV screenshot to the pinned design image at native resolution.
 * Writes numeric evidence and a 4×-amplified RGB difference image under the
 * ignored preview output directory. Exact pixel equality is the final gate;
 * MAE/RMSE/SSIM help locate progress while that gate is still red.
 *
 *   node tests/preview/pixel-compare.mjs TvHome [candidate.png] [--reference baseline.png] [--require-exact]
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { referenceDir } from './backend.ts';
import { outDir, reference } from './shoot.mjs';

const [name, ...argumentsAfterName] = process.argv.slice(2);
const referenceOption = argumentsAfterName.indexOf('--reference');
const referenceOverride = referenceOption >= 0 ? argumentsAfterName[referenceOption + 1] : undefined;
const optionalPath = argumentsAfterName.find((arg, index) => !arg.startsWith('--') && (referenceOption < 0 || index !== referenceOption + 1));
const entry = name && reference(name);
if (!entry || entry.platform !== 'tv') {
  console.error('Usage: node tests/preview/pixel-compare.mjs <TV reference name> [candidate.png] [--reference baseline.png] [--require-exact]');
  process.exit(2);
}
const candidate = optionalPath ? resolve(optionalPath) : join(outDir, `${name}.png`);
const referenceImage = referenceOverride ? resolve(referenceOverride) : join(referenceDir, 'screens/img/tv', `${name}.webp`);
if (!existsSync(candidate) || !existsSync(referenceImage)) {
  console.error(`Missing screenshot or reference: ${candidate}`);
  process.exit(2);
}
const dataUrl = (path, type) => `data:${type};base64,${readFileSync(path).toString('base64')}`;
const browser = await chromium.launch();
let result;
try {
  const page = await browser.newPage({ viewport: { width: 1, height: 1 }, deviceScaleFactor: 1 });
  result = await page.evaluate(async ({ referenceUrl, candidateUrl }) => {
    const decode = async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      return image;
    };
    const [aImage, bImage] = await Promise.all([decode(referenceUrl), decode(candidateUrl)]);
    if (aImage.width !== bImage.width || aImage.height !== bImage.height)
      throw new Error(`Image dimensions differ: ${aImage.width}×${aImage.height} vs ${bImage.width}×${bImage.height}`);
    const width = aImage.width;
    const height = aImage.height;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas2D is unavailable');
    context.drawImage(aImage, 0, 0);
    const a = context.getImageData(0, 0, width, height).data;
    context.clearRect(0, 0, width, height);
    context.drawImage(bImage, 0, 0);
    const b = context.getImageData(0, 0, width, height).data;
    const diff = context.createImageData(width, height);
    let absolute = 0;
    let squared = 0;
    let changed = 0;
    let meanA = 0;
    let meanB = 0;
    let meanA2 = 0;
    let meanB2 = 0;
    let meanAB = 0;
    const pixels = width * height;
    for (let offset = 0; offset < a.length; offset += 4) {
      let different = false;
      for (let channel = 0; channel < 3; channel++) {
        const distance = Math.abs(a[offset + channel] - b[offset + channel]);
        absolute += distance;
        squared += distance * distance;
        different ||= distance > 0;
        diff.data[offset + channel] = Math.min(255, distance * 4);
      }
      if (different) changed++;
      diff.data[offset + 3] = 255;
      const grayA = (a[offset] * 299 + a[offset + 1] * 587 + a[offset + 2] * 114) / 1000;
      const grayB = (b[offset] * 299 + b[offset + 1] * 587 + b[offset + 2] * 114) / 1000;
      meanA += grayA;
      meanB += grayB;
      meanA2 += grayA * grayA;
      meanB2 += grayB * grayB;
      meanAB += grayA * grayB;
    }
    meanA /= pixels;
    meanB /= pixels;
    const varianceA = meanA2 / pixels - meanA * meanA;
    const varianceB = meanB2 / pixels - meanB * meanB;
    const covariance = meanAB / pixels - meanA * meanB;
    const c1 = (0.01 * 255) ** 2;
    const c2 = (0.03 * 255) ** 2;
    const ssim = ((2 * meanA * meanB + c1) * (2 * covariance + c2)) /
      ((meanA * meanA + meanB * meanB + c1) * (varianceA + varianceB + c2));
    context.putImageData(diff, 0, 0);
    return {
      width,
      height,
      changedPixels: changed,
      changedPercent: Number((changed / pixels * 100).toFixed(4)),
      mae: Number((absolute / (pixels * 3)).toFixed(4)),
      rmse: Number(Math.sqrt(squared / (pixels * 3)).toFixed(4)),
      ssim: Number(ssim.toFixed(6)),
      diffUrl: canvas.toDataURL('image/png'),
    };
  }, { referenceUrl: dataUrl(referenceImage, referenceImage.endsWith('.png') ? 'image/png' : 'image/webp'), candidateUrl: dataUrl(candidate, 'image/png') });
} finally {
  await browser.close();
}
mkdirSync(outDir, { recursive: true });
const diffPath = join(outDir, `${name}.pixel-diff.png`);
writeFileSync(diffPath, Buffer.from(result.diffUrl.split(',')[1], 'base64'));
delete result.diffUrl;
writeFileSync(join(outDir, `${name}.pixel-metrics.json`), JSON.stringify({ reference: referenceImage, candidate, ...result }, null, 2) + '\n');
console.log(JSON.stringify(result));
if (argumentsAfterName.includes('--require-exact') && result.changedPixels > 0) process.exitCode = 1;
