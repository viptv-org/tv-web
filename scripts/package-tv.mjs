import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { verifyTvPackage } from './tv-package-check.mjs';
import { stageTvLauncher } from './tv-launcher.mjs';

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
    // The hosting ZIP is what every Tizen/webOS/Vizio launcher loads, so it
    // carries the TV entry's reachable set only. `dist` still contains the full
    // browser/desktop build; `tv-assets.json` is emitted from that same build's
    // import graph, never from a hand-maintained list of hashed chunk names.
    const manifest = JSON.parse(await readFile(join(root, 'artifacts', 'tv-assets.json'), 'utf8'));
    for (const file of manifest.files) {
      const destination = join(stage, file);
      await mkdir(dirname(destination), { recursive: true });
      await cp(join(root, 'dist', file), destination);
    }
    const report = await verifyTvPackage(stage, manifest);
    if (report.problems.length) throw Error(`TV package is incomplete:\n${report.problems.join('\n')}`);
    const bytes = (await Promise.all(report.files.map(async file => (await stat(join(stage, file))).size))).reduce((total, size) => total + size, 0);
    console.log(`TV package: ${report.files.length} files, ${(bytes / 1024 / 1024).toFixed(2)} MiB; ${report.allowed.length} references resolve only into declared non-TV branches.`);
    await writeFile(join(stage, 'HOSTING.txt'), `VIPTV ${revision}\nServe at the existing HTTPS API origin under /tv/.\nTV packages are hosted launchers; deploy this matching bundle manually.\nPreserve Host/Origin rewrites on watch.syek.tech.\n`);
    const archive = join(output, `viptv-tv-hosting-${version}-${revision.slice(0, 8)}.zip`);
    // `zip` updates an existing archive instead of replacing it, so a local
    // re-package would otherwise keep shipping files the TV set no longer names.
    await rm(archive, { force: true });
    run('zip', ['-q', '-r', archive, '.'], stage);
  } else {
    await stageTvLauncher({ root, stage, target, version, hostedUrl: process.env[`VIPTV_${target.toUpperCase()}_HOSTED_URL`] });
    if (target === 'webos') {
      run('ares-package', [stage, '--outdir', output, '--no-minify']);
    } else {
      if (!process.env.TIZEN_PROFILE) throw Error('TIZEN_PROFILE is required; unsigned WGTs are not installable');
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
