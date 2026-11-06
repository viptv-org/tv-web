import { readFileSync } from 'node:fs';
import { transformWithEsbuild, type Plugin } from 'vite';

export function solidStartup(): Plugin {
  const shell = readFileSync(new URL('../src/tv-solid/startup.html', import.meta.url), 'utf8');
  return {
    name: 'solid-startup',
    async transformIndexHtml(html, context) {
      // Every entry is the SolidTV TV app now; the cover always applies and
      // stylesheets load without blocking the first frame.
      html = html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/g, tag => tag.replace(/>$/, ` media="print" onload="this.media='all'">`));
      const startup = shell.replace('__SOLID_STARTUP_SELECTED__', 'true');
      const script = /<script>([\s\S]*?)<\/script>/.exec(startup);
      if (!script) throw new Error('The SolidTV startup script is missing');
      const { code } = await transformWithEsbuild(script[1], context.filename + '.startup.js', {
        loader: 'js',
        target: 'es2017',
      });
      return html.replace('<body>', '<body>' + startup.replace(script[1], code));
    },
  };
}
