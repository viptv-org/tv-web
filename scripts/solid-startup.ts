import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { selectRenderer } from '../src/rendererSelection';

export function solidStartup(): Plugin {
  const shell = readFileSync(new URL('../src/tv-solid/startup.html', import.meta.url), 'utf8');
  return {
    name: 'solid-startup',
    transformIndexHtml(html, context) {
      const direct = /\/(?:solid|lightning)\.html$/.test(context.filename);
      const selection = direct ? 'true' : `(${selectRenderer.toString()})(location.search, '__TAURI_INTERNALS__' in window) === 'solid'`;
      if (direct) html = html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/g, tag => tag.replace(/>$/, ` media="print" onload="this.media='all'">`));
      return html.replace('<body>', '<body>' + shell.replace('__SOLID_STARTUP_SELECTED__', selection));
    },
  };
}
