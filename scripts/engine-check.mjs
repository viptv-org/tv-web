import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const directory = new URL('../vendor/engine/', import.meta.url);
const pin = JSON.parse(readFileSync(new URL('SOURCE.json', directory), 'utf8'));
const bytes = readFileSync(new URL('wire.ts', directory), 'utf8').replace(/\r\n/g, '\n');
if (!/^[a-f0-9]{40}$/.test(pin.revision) || pin.source !== 'generated/engine/wire.ts'
  || createHash('sha256').update(bytes).digest('hex') !== pin.sha256)
  throw new Error('Engine contract provenance mismatch');
console.log(`Engine contract integrity passed: ${pin.revision}`);
