#!/usr/bin/env node
/** Bake the ambient hero band's scrim: a horizontal wash that keeps the hero
 * text legible over any artwork, times a vertical fade that dissolves the
 * band's bottom into the page ground.
 *
 * The band is stretched over a rect whose height changes with the poster
 * carousel, so the ramp is baked into the bottom 35% of the texture and the
 * wash is uniform vertically. One asset serves every band height and every
 * screen resolution: the logical frame is fixed at 1920x1080.
 *
 * This runs without Pillow on purpose. The other TV textures need an image
 * library; this one is a formula, so it is written with node:zlib alone and
 * stays byte-for-byte reproducible.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WIDTH = 1920;
const HEIGHT = 256;
/** The band dissolves over its bottom 35%; the same share of the texture. */
const FADE_START = 0.65;
/** The page ground, token color.bg. */
const GROUND = [11, 11, 12];
/** The wash hides the artwork under the text column without killing it. */
const WASH_ALPHA = 0.9;
const WASH_END = 640;
const WASH_FADE = 800;

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const clamp = (value) => Math.max(0, Math.min(1, value));
const smoothstep = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);
for (let y = 0; y < HEIGHT; y++) {
  const fade = y / HEIGHT < FADE_START ? 0 : smoothstep((y / HEIGHT - FADE_START) / (1 - FADE_START));
  for (let x = 0; x < WIDTH; x++) {
    const wash = WASH_ALPHA * (1 - smoothstep((x - WASH_END) / WASH_FADE));
    const alpha = 1 - (1 - wash) * (1 - fade);
    const offset = (y * WIDTH + x) * 4;
    pixels[offset] = GROUND[0];
    pixels[offset + 1] = GROUND[1];
    pixels[offset + 2] = GROUND[2];
    pixels[offset + 3] = Math.round(alpha * 255);
  }
}

const png = encodePng(WIDTH, HEIGHT, pixels);
for (const directory of ["public/tv-artwork", "roku/pkg/assets"]) {
  const target = resolve(ROOT, directory, "band-scrim.png");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, png);
}
console.log(`band-scrim.png: ${WIDTH}x${HEIGHT}, ${png.length} bytes`);
