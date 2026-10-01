import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (name: string) => readFileSync(resolve(root, name), 'utf8');

describe('TV HTML entries', () => {
  // The legacy lightning.html URL loads the SolidTV entry; Vite needs a real
  // file per input, so it is a byte-identical copy of solid.html.
  it('keeps lightning.html identical to solid.html', () => {
    expect(read('lightning.html')).toBe(read('solid.html'));
  });

  it('includes the preparing spinner the SolidTV runtime toggles', () => {
    expect(read('solid.html')).toContain('id="solid-preparing-spinner"');
  });
});
