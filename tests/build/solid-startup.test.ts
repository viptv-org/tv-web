// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, transformWithEsbuild } from 'vite';
import { expect, it } from 'vitest';
import { solidStartup } from '../../scripts/solid-startup';

it('emits every TV startup script without syntax requiring post-ES2017 transforms', async () => {
  const root = await mkdtemp(join(tmpdir(), 'viptv-startup-'));
  const entries = ['index.html', 'solid.html', 'lightning.html'];
  try {
    await Promise.all(entries.map(entry => writeFile(join(root, entry), '<!doctype html><html><head></head><body></body></html>')));
    const result = await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [solidStartup()],
      build: { write: false, rollupOptions: { input: entries.map(entry => join(root, entry)) } },
    });
    if (Array.isArray(result) || !('output' in result)) throw new Error('Expected one HTML build');
    const html = result.output.filter(file => file.type === 'asset' && file.fileName.endsWith('.html'));
    expect(html.map(file => file.fileName).sort()).toEqual(entries.sort());
    for (const file of html) {
      if (file.type !== 'asset') throw new Error('Expected HTML asset');
      const scripts = [...String(file.source).matchAll(/<script>([\s\S]*?)<\/script>/g)];
      expect(scripts).toHaveLength(1);
      for (const [, script] of scripts) {
        const [modern, tv] = await Promise.all(['esnext', 'es2017'].map(target =>
          transformWithEsbuild(script, file.fileName + '.js', { target }),
        ));
        expect(tv.code, file.fileName).toBe(modern.code);
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
