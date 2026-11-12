import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

test('installed Canvas source and distribution match the reproducible pinned patch', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
  const manifest = JSON.parse(read('patches/canvas-manifest.json'));
  const hash = (path: string) => createHash('sha256').update(read(path).replace(/\r\n/g, '\n')).digest('hex');
  const lock = JSON.parse(read('package-lock.json'));
  expect(lock.packages['node_modules/@solidtv/renderer-canvas'].integrity).toBe(manifest.upstream_integrity);
  expect(hash(manifest.patch_file)).toBe(manifest.patch_sha256);
  for (const [name, expected] of Object.entries(manifest.patched_files))
    expect(hash('node_modules/@solidtv/renderer-canvas/' + name), name).toBe(expected);
});
