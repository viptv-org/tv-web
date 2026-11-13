import { readFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(root, 'roku/package.json'));
const sharp = require('sharp');
const visuals = await readFile(path.join(root, 'src/tv-solid/remote/visuals.tsx'), 'utf8');
const output = path.join(root, 'roku/pkg/assets/icons');
const rasterSize = 384;

function readString(value) {
  if (value.startsWith('"')) return JSON.parse(value);
  return value.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, '\\');
}

function readMap(name) {
  const start = visuals.indexOf(`const ${name}: Record<string, string> = {`);
  if (start < 0) throw new Error(`Could not find ${name} in visuals.tsx`);
  const end = visuals.indexOf('\n};', start);
  if (end < 0) throw new Error(`Could not find end of ${name} in visuals.tsx`);
  const block = visuals.slice(start, end);
  const properties = /^\s*(?:"([^"]+)"|([\w-]+)):\s*("(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\n\s*(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'))/gm;
  const result = new Map();
  for (const match of block.matchAll(properties)) {
    const key = match[1] ?? match[2];
    const value = match[3].trim();
    result.set(key, readString(value));
  }
  if (!result.size) throw new Error(`No icon paths found in ${name}`);
  return result;
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function render(name, svg, suffix = '') {
  const file = path.join(output, `${slug(name)}${suffix}.png`);
  await sharp(Buffer.from(svg)).png().toFile(file);
}

function iconSvg(name, d, size, strokeWidth) {
  const play = name === 'play';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${play ? '#FFFFFF' : 'none'}" stroke="${play ? 'none' : '#FFFFFF'}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

const paths = readMap('paths');
const navPaths = readMap('navIconPaths');
await mkdir(output, { recursive: true });

const slugs = new Set();
for (const name of [...paths.keys(), ...navPaths.keys()]) {
  const filename = slug(name);
  if (slugs.has(filename)) throw new Error(`Icon filename collision: ${filename}`);
  slugs.add(filename);
}
const sizes = [18, 22, 24, 28, 30, 48];
const expectedVariants = new Set();
for (const name of paths.keys()) {
  for (const size of sizes) expectedVariants.add(`${slug(name)}-${size}x${size}.png`);
  expectedVariants.add(`${slug(name)}-28x30.png`);
}
for (const name of navPaths.keys()) expectedVariants.add(`${slug(name)}-28x28.png`);

for (const file of await readdir(output)) {
  if (/^[a-z0-9-]+-\d+x\d+\.png$/.test(file) && slugs.has(file.replace(/-\d+x\d+\.png$/, '')) && !expectedVariants.has(file)) {
    await unlink(path.join(output, file));
  }
}

for (const [name, d] of paths) {
  await render(name, iconSvg(name, d, rasterSize, 2.2));
  for (const size of sizes) {
    await render(name, iconSvg(name, d, size, 2.2), `-${size}x${size}`);
  }
  await render(name, iconSvg(name, d, 28, 2.2).replace('width="28" height="28"', 'width="28" height="30"'), '-28x30');
}

for (const [name, children] of navPaths) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${rasterSize}" height="${rasterSize}" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${children}</svg>`;
  await render(name, svg);
  const sizedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${children}</svg>`;
  await render(name, sizedSvg, '-28x28');
}

console.log(`Generated ${paths.size + navPaths.size} Roku icons at ${rasterSize}×${rasterSize} plus variants for ${sizes.join(', ')} px.`);
