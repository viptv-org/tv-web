import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const target = process.argv[2] ?? 'hosting';
if (!['hosting', 'webos', 'tizen'].includes(target)) throw Error('Use hosting, webos, or tizen');
const version = JSON.parse(await readFile(join(root, 'package.json'))).version;
const revision = run('git', ['rev-parse', 'HEAD']).trim();
const output = join(root, 'artifacts', target);
const stage = await mkdtemp(join(tmpdir(), 'viptv-package-'));
await mkdir(output, { recursive: true });
try {
  if (target === 'hosting') {
    await cp(join(root, 'dist'), stage, { recursive: true });
    await writeFile(join(stage, 'HOSTING.txt'), `VIPTV ${revision}\nServe at the existing HTTPS API origin under /tv/.\nTV packages are hosted launchers; deploy this matching bundle manually.\nPreserve Host/Origin rewrites on watch.syek.tech.\n`);
    run('zip', ['-q', '-r', join(output, `viptv-tv-hosting-${version}-${revision.slice(0, 8)}.zip`), '.'], stage);
  } else {
    const url = new URL(process.env[`VIPTV_${target.toUpperCase()}_HOSTED_URL`] ?? `https://viptv.syek.tech/tv/?platform=${target}`);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || !/^\/tv\/?$/.test(url.pathname) || url.searchParams.get('platform') !== target) throw Error('Hosted URL must be credential-free HTTPS /tv/?platform=' + target);
    await cp(join(root, 'public/assets/viptv-mark.png'), join(stage, 'icon.png'));
    const literal = JSON.stringify(url.href).replaceAll('<', '\\u003c');
    await writeFile(join(stage, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><title>VIPTV</title></head><body style="background:#0b0b0c;color:#f4f2ee">Opening VIPTV…<script>location.replace(${literal})</script></body></html>`);
    if (target === 'webos') {
      await writeFile(join(stage, 'appinfo.json'), JSON.stringify({ id: 'tech.syek.viptv', version, vendor: 'VIPTV', type: 'web', main: 'index.html', title: 'VIPTV', icon: 'icon.png', resolution: '1920x1080', disableBackHistoryAPI: true }, null, 2));
      run('ares-package', [stage, '--outdir', output, '--no-minify']);
    } else {
      if (!process.env.TIZEN_PROFILE) throw Error('TIZEN_PROFILE is required; unsigned WGTs are not installable');
      let config = await readFile(join(root, 'platform/tizen/config.xml'), 'utf8');
      config = config.replace('launcher.html', 'index.html').replace('assets/viptv-mark.png', 'icon.png').replace(/version="0\.1\.0"/, `version="${version}"`);
      await writeFile(join(stage, 'config.xml'), config);
      run('tizen', ['package', '-t', 'wgt', '-s', process.env.TIZEN_PROFILE, '--', stage]);
      const packageName = (await readdir(stage)).find(name => name.endsWith('.wgt'));
      if (!packageName) throw Error('Tizen SDK did not produce a signed WGT');
      const entries = run('unzip', ['-Z1', join(stage, packageName)]);
      if (!entries.includes('author-signature.xml') || !entries.includes('signature1.xml')) throw Error('Tizen package is missing signatures');
      await cp(join(stage, packageName), join(output, `viptv-tizen-${version}-${revision.slice(0, 8)}.wgt`));
    }
  }
  const files = (await readdir(output)).filter(name => /\.(zip|ipk|wgt)$/.test(name));
  if (!files.length) throw Error('No package produced');
  const checksums = await Promise.all(files.map(async name => `${createHash('sha256').update(await readFile(join(output, name))).digest('hex')}  ${name}`));
  await writeFile(join(output, 'SHA256SUMS'), checksums.join('\n') + '\n');
  await writeFile(join(output, 'build.json'), JSON.stringify({ target, version, revision, files, hosted: target !== 'hosting', minimumWebos: target === 'webos' ? '22' : undefined }, null, 2) + '\n');
  console.log(`Built ${target}: ${output}`);
} finally { await rm(stage, { recursive: true, force: true }); }

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.error || result.status !== 0) throw Error(`${command} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`);
  return result.stdout;
}
