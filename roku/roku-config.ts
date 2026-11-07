import type { RokuConfig } from '@roku-sdk/rsg-ts/roku-config';
import { readFile } from 'node:fs/promises';
import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { transformAsync } from '@babel/core';
import solidPreset from 'babel-preset-solid';
import typescriptPreset from '@babel/preset-typescript';

// Roku's JS engine does not give each `for (const key of ...)` iteration its
// own binding. The framework generates every property descriptor in such a
// loop, so all of them captured the final key (`wordWrap`) and every
// width/height/x/y write landed in lng.wordWrap, collapsing layout. Rewrite
// the two descriptor loops to forEach, which restores one binding per key.
function patchSolidElementNode() {
  try {
    const dir = realpathSync(path.join(process.cwd(), 'node_modules/@solidtv/solid'));
    const file = path.join(dir, 'dist/src/core/elementNode.js');
    const source = readFileSync(file, 'utf8');
    let patched = source.replace(
      /for \(const key of (LightningRendererNumberProps|LightningRendererNonAnimatingProps)\) \{([\s\S]*?)\n\}/g,
      (_m, list, body) => `${list}.forEach((key) => {${body}\n});`,
    );
    // tv-web passes `rounded` as a number in places. The upstream effect
    // serializer assumes it is an object with `.radius`; accept both.
    patched = patched.replace(
      /if \(v\.rounded\)\s*props\.radius = v\.rounded\.radius;/g,
      'if (v.rounded != null) props.radius = typeof v.rounded === "object" ? v.rounded.radius : v.rounded;',
    );
    // tv-web's manual visualNode inserts text/native children after the
    // ElementNode parent has already rendered. The upstream insertChild only
    // records the child; render it now so the native node exists.
    patched = patched.replace(
      /(this\.children\.push\(node\);)\n    \}\n    removeChild\(node\)/,
      '$1\n        if (this.rendered && isElementNode(node) && !node.rendered) node.render();\n    }\n    removeChild(node)',
    );
    if (patched !== source) {
      writeFileSync(file, patched);
      console.log('Patched @solidtv/solid property descriptor loops for Roku');
    } else if (source.includes('for (const key of LightningRendererNumberProps)')) {
      throw new Error('Could not patch @solidtv/solid descriptor loops; layout would collapse');
    }
  } catch (error) {
    console.warn('Could not patch @solidtv/solid: ' + String((error as any)?.message || error));
  }
}
patchSolidElementNode();

// The shared runtime can carry non-function values in an onFocus/onBlur prop
// slot while a node is still being built. Optional chaining still throws when
// the value is present but not callable, so guard the focus callbacks.
function patchSolidFocusManager() {
  try {
    const dir = realpathSync(path.join(process.cwd(), 'node_modules/@solidtv/solid'));
    const file = path.join(dir, 'dist/src/core/focusManager.js');
    const source = readFileSync(file, 'utf8');
    const patched = source
      .replace(
        /current\.onFocus\?\.call\(([^;]+)\);/g,
        'if (typeof current.onFocus === "function") current.onFocus.call($1);',
      )
      .replace(
        /current\.onFocusChanged\?\.call\(([^;]+)\);/g,
        'if (typeof current.onFocusChanged === "function") current.onFocusChanged.call($1);',
      )
      .replace(
        /elm\.onBlur\?\.call\(([^;]+)\);/g,
        'if (typeof elm.onBlur === "function") elm.onBlur.call($1);',
      )
      .replace(
        /elm\.onFocusChanged\?\.call\(([^;]+)\);/g,
        'if (typeof elm.onFocusChanged === "function") elm.onFocusChanged.call($1);',
      )
      .replace(/if \(!current\.states\.has\(/g, 'if (!current.states || !current.states.has(')
      .replace(/current\.states\.add\(/g, 'current.states?.add(')
      .replace(/elm\.states\.remove\(/g, 'elm.states?.remove(')
      .replace(
        /if \(v\.rounded\)\s*props\.radius = v\.rounded\.radius;/g,
        'if (v.rounded != null) props.radius = typeof v.rounded === "object" ? v.rounded.radius : v.rounded;',
      );
    if (patched !== source) {
      writeFileSync(file, patched);
      console.log('Patched @solidtv/solid focus callbacks for Roku');
    }
  } catch (error) {
    console.warn('Could not patch @solidtv/solid focus manager: ' + String((error as any)?.message || error));
  }
}
patchSolidFocusManager();

const require = createRequire(import.meta.url);
const root = process.cwd();
const shared = path.resolve(root, '../src');
const entry = path.join(shared, 'tv-solid/roku-entry.tsx');

const plugin = {
  name: 'viptv-tv-web-roku-host',
  setup(build: any) {
    build.initialOptions.conditions = ['browser'];
    build.initialOptions.define = {
      ...build.initialOptions.define,
      'import.meta.env.DEV': 'false',
      'import.meta.env.PROD': 'true',
      'import.meta.env.BASE_URL': '"pkg:/"',
      'import.meta.env.LEGACY': 'false',
      'import.meta.env.VITE_API_ORIGIN': '"https://beta-viptv.syek.tech"',
      SOLIDTV_SHARED_ENTRY: JSON.stringify('../../../src/tv-solid/roku-entry'),
    };

    // Browser-only libraries that pull in Node builtins (qrcode -> pngjs) or
    // WebGL/decoder code. The platform media/image adapters replace them on
    // Roku; stub the browser bundles so the shared UI still builds.
    const stubs = [
      /^qrcode$/,
      /^hls\.js$/,
      /^mediabunny$/,
      /^@mediabunny\//,
      /^@tauri-apps\//,
      /^pngjs$/,
    ];
    for (const filter of stubs) {
      build.onResolve({ filter }, (args: any) => ({ path: args.path, namespace: 'tvweb-stub' }));
    }
    build.onLoad({ filter: /.*/, namespace: 'tvweb-stub' }, (args: any) => {
      if (args.path === 'qrcode') {
        return {
          contents:
            'export default { toDataURL: async (text) => "data:image/x-viptv-qr," + encodeURIComponent(String(text ?? "")) };',
          loader: 'js',
        };
      }
      if (args.path === 'hls.js') {
        return {
          contents:
            'function Hls() {} Hls.isSupported = function () { return false; }; Hls.Events = {}; Hls.prototype.on = function () {}; Hls.prototype.off = function () {}; Hls.prototype.destroy = function () {}; Hls.prototype.loadSource = function () {}; Hls.prototype.attachMedia = function () {}; Hls.prototype.startLoad = function () {}; Hls.prototype.stopLoad = function () {}; Hls.prototype.recoverMediaError = function () {}; function FetchLoader() {}; export { FetchLoader }; export default Hls;',
          loader: 'js',
        };
      }
      return { contents: 'export default {};', loader: 'js' };
    });

    // Vite's ?url imports are asset names, not JavaScript modules. The Roku
    // package resolves design assets through pkg:/ paths instead.
    build.onResolve({ filter: /\?url$/ }, (args: any) => ({
      path: args.path,
      namespace: 'tvweb-empty-url',
    }));
    build.onLoad({ filter: /.*/, namespace: 'tvweb-empty-url' }, () => ({
      contents: 'export default "";',
      loader: 'js',
    }));

    // Direct image imports resolve to the packaged fallback poster. The
    // platform image adapter maps real design assets where they are needed.
    build.onResolve({ filter: /\.(png|jpe?g|webp|gif|svg)$/ }, (args: any) => ({
      path: args.path,
      namespace: 'tvweb-empty-image',
    }));
    build.onLoad({ filter: /.*/, namespace: 'tvweb-empty-image' }, () => ({
      contents: 'export default "pkg:/assets/fallback.png";',
      loader: 'js',
    }));

    build.onLoad({ filter: /\.css$/ }, () => ({
      contents: 'export default {};',
      loader: 'js',
    }));

    build.onResolve({ filter: /^(@solidtv\/|@solidjs\/|@solid-primitives\/|solid-js)/ }, (args: any) => {
      if (args.path === 'solid-js') return { path: path.join(root, 'node_modules/solid-js/dist/solid.js') };
      if (['solid-js/store', 'solid-js/web', 'solid-js/universal'].includes(args.path)) {
        const part = args.path.split('/')[1];
        return { path: path.join(root, 'node_modules/solid-js', part, 'dist', part + '.js') };
      }
      const parts = args.path.split('/');
      const name = args.path.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
      const sub = parts.slice(name.startsWith('@') ? 2 : 1).join('/');
      let dir = path.join(root, 'node_modules', name);
      if (!existsSync(path.join(dir, 'package.json'))) {
        let scan = path.dirname(realpathSync(args.importer));
        while (scan !== '/') {
          const candidate = path.join(scan, 'node_modules', name);
          if (existsSync(path.join(candidate, 'package.json'))) {
            dir = candidate;
            break;
          }
          scan = path.dirname(scan);
        }
      }
      const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
      let entryPoint = pkg.exports?.[sub ? './' + sub : '.'] || (!sub ? pkg.exports : null) || pkg.module || pkg.main;
      while (entryPoint && typeof entryPoint === 'object') entryPoint = entryPoint.browser || entryPoint.import || entryPoint.default || entryPoint.solid;
      if (typeof entryPoint !== 'string') throw Error('Cannot resolve ' + args.path);
      return { path: path.resolve(dir, entryPoint) };
    });

    build.onLoad({ filter: /[\/]core[\/]lightningInit\.js$/ }, async (args: any) => {
      const source = await readFile(args.path, 'utf8');
      const anchor = 'new lng.RendererMain(settings, rootId)';
      const factory = source.includes('export function setRendererFactory(');
      if (!factory && !source.includes(anchor)) throw Error('SolidTV boundary changed');
      return {
        contents: factory ? source : source.replace(anchor, 'new globalThis.__SolidTVRokuRenderer(settings, rootId)'),
        loader: 'js',
      };
    });

    build.onLoad({ filter: /\.[jt]sx?$/ }, async (args: any) => {
      if (!args.path.startsWith(shared + '/') && !args.path.includes('/@solidtv/solid/')) return;
      const source = await readFile(args.path, 'utf8');
      const stripped = await transformAsync(source, {
        filename: args.path,
        babelrc: false,
        configFile: false,
        presets: [
          [solidPreset, { generate: 'universal', moduleName: '@solidtv/solid' }],
          [typescriptPreset, { allExtensions: true, isTSX: /[jt]sx$/.test(args.path), allowDeclareFields: true }],
        ],
        assumptions: { noClassCalls: true },
      });
      // TypeScript must strip parameter properties before the class transform
      // runs; doing both in one pass produced `constructor(readonly status)`.
      const result = await transformAsync(stripped?.code || source, {
        filename: args.path,
        babelrc: false,
        configFile: false,
        plugins: [
          require.resolve('@babel/plugin-transform-class-properties'),
          require.resolve('@babel/plugin-transform-classes'),
        ],
      });
      return {
        contents: result?.code || stripped?.code || source,
        loader: 'js',
        resolveDir: path.dirname(args.path),
      };
    });
  },
};

export default {
  app: {
    entryPoint: 'src/index.ts',
    staticAssetsDir: './pkg',
    manifestEntries: {
      title: 'VIPTV TV',
      major_version: 1,
      minor_version: 0,
      build_version: 1,
      ui_resolutions: 'fhd',
      rsg_version: '2.0',
      splash_color: '0x0B0B0CFF',
      splash_min_time: 1,
    },
  },
  pipeline: {
    startDev: { plugins: [{ position: { before: 'solid' }, plugin }] },
    build: { plugins: [{ position: { before: 'solid' }, plugin }] },
  },
} satisfies RokuConfig;
