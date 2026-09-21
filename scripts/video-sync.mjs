import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const destination = join(root, 'vendor/video');
const hash = (data) => createHash('sha256').update(data).digest('hex');
const git = (repo, args) => execFileSync('git', ['-C', repo, ...args], { maxBuffer: 32 * 1024 * 1024 });
const mode = process.argv[2] ?? 'check';
if (mode === 'sync') {
  const source = resolve(process.argv[3] ?? '../video');
  if (git(source, ['status', '--porcelain']).toString().trim()) throw new Error('Commit the video source before adoption');
  const revision = git(source, ['rev-parse', 'HEAD']).toString().trim();
  // The player contract is the source tree; tests and tooling stay in the
  // owning repository. Runtime dependencies resolve from this package's own
  // node_modules and must stay version-compatible with the pinned revision.
  const names = git(source, ['ls-tree', '-r', '--name-only', revision]).toString().trim().split('\n')
    .filter((path) => path.startsWith('src/') && path.endsWith('.ts'));
  const files = {};
  for (const path of names) {
    files[`vendor/video/${path}`] = hash(git(source, ['show', `${revision}:${path}`]));
  }
  const previous = existsSync(join(destination, 'lock.json'))
    ? JSON.parse(readFileSync(join(destination, 'lock.json'), 'utf8')).files : {};
  for (const path of Object.keys(previous)) {
    const file = resolve(root, path);
    if (!file.startsWith(destination + '/')) throw new Error('Invalid preceding vendor path');
    if (!files[path]) rmSync(file, { force: true });
  }
  for (const path of names) {
    const target = join(root, 'vendor/video', path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, git(source, ['show', `${revision}:${path}`]));
  }
  writeFileSync(join(destination, 'lock.json'), JSON.stringify({ repository: 'viptv-org/video', revision, files }, null, 2) + '\n');
  writeFileSync(join(root, 'VIDEO_REF'), revision + '\n');
  console.log(`Imported video ${revision} (${names.length} modules)`);
} else if (mode === 'check') {
  const lock = JSON.parse(readFileSync(join(destination, 'lock.json'), 'utf8'));
  if (lock.repository !== 'viptv-org/video' || !/^[a-f0-9]{40}$/.test(lock.revision) || readFileSync(join(root, 'VIDEO_REF'), 'utf8').trim() !== lock.revision) throw new Error('Video pin mismatch');
  for (const [path, expected] of Object.entries(lock.files)) {
    const file = resolve(root, path);
    if (!file.startsWith(destination + '/') || !existsSync(file) || hash(readFileSync(file)) !== expected) throw new Error(`Video artifact mismatch: ${path}`);
  }
  const inspect = (dir) => { for (const entry of readdirSync(dir, { withFileTypes: true })) { const file = join(dir, entry.name); if (entry.isDirectory()) inspect(file); else if (entry.name !== 'lock.json' && !lock.files[relative(root, file)]) throw new Error(`Unpinned video source: ${relative(root, file)}`); } };
  inspect(destination);
  console.log(`Video integrity passed: ${lock.revision}`);
} else throw new Error('Use sync <video-checkout> or check');
