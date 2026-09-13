import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Keep strict checking of both application and tests within the server's heap
// budget. Separate programs release TypeScript's graph before the next group.
const root = resolve(import.meta.dirname, '..');
const groups = [
  ['application', ['src', 'vite.config.ts', 'playwright.config.ts']],
  ...readdirSync(join(root, 'tests'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => [`tests/${entry.name}`, [`tests/${entry.name}`, 'tests/setup.ts']]),
];
const directory = mkdtempSync(join(root, '.typecheck-'));
let failed = false;
try {
  for (const [name, paths] of groups) {
    const config = join(directory, 'tsconfig.json');
    writeFileSync(config, JSON.stringify({ extends: join(root, 'tsconfig.json'), include: paths.map(path => join(root, path)) }));
    console.log(`Type checking ${name}`);
    const result = spawnSync(process.execPath, ['--max-old-space-size=256', join(root, 'node_modules/typescript/bin/tsc'), '--project', config], { cwd: root, stdio: 'inherit' });
    if (result.status !== 0 || result.error) { failed = true; break; }
  }
} finally { rmSync(directory, { recursive: true, force: true }); }
if (failed) process.exit(1);
