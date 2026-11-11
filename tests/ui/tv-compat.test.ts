import { afterEach, expect, it } from 'vitest';
import { installTvCompatibility } from '../../src/tv-solid/platform/tv-compat';
const at = Object.getOwnPropertyDescriptor(Array.prototype, 'at')!;
const fromEntries = Object.getOwnPropertyDescriptor(Object, 'fromEntries')!;
const allSettled = Object.getOwnPropertyDescriptor(Promise, 'allSettled')!;
afterEach(() => {
  Object.defineProperty(Array.prototype, 'at', at);
  Object.defineProperty(Object, 'fromEntries', fromEntries);
  Object.defineProperty(Promise, 'allSettled', allSettled);
});
it('supports old-engine negative/fractional indices and rejects null receivers', () => {
  Object.defineProperty(Array.prototype, 'at', { ...at, value: undefined });
  installTvCompatibility();
  expect([1, 2, 3].at(-1)).toBe(3);
  expect([1, 2, 3].at(1.9)).toBe(2);
  expect([1].at(Infinity)).toBeUndefined();
  expect(() => Array.prototype.at.call(null, 0)).toThrow(TypeError);
  expect(Object.keys(Array.prototype)).not.toContain('at');
});
it('creates safe data properties for untrusted keys while retaining symbols and duplicate-key semantics', () => {
  Object.defineProperty(Object, 'fromEntries', { ...fromEntries, value: undefined });
  installTvCompatibility();
  const key = Symbol('track');
  const value = Object.fromEntries([['__proto__', { injected: true }], [key, 7], ['name', 1], ['name', 2]]);
  expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
  expect(Object.getOwnPropertyDescriptor(value, '__proto__')?.value).toEqual({ injected: true });
  expect(Reflect.get(value, key)).toBe(7);
  expect(value.name).toBe(2);
});
it('preserves the host implementations when those APIs already exist', () => {
  installTvCompatibility();
  expect(Array.prototype.at).toBe(at.value);
  expect(Object.fromEntries).toBe(fromEntries.value);
  expect(Promise.allSettled).toBe(allSettled.value);
});
it('settles mixed search providers in input order on engines without Promise.allSettled', async () => {
  Object.defineProperty(Promise, 'allSettled', { ...allSettled, value: undefined });
  installTvCompatibility();
  let complete!: (value: string) => void;
  const pending = new Promise<string>(resolve => { complete = resolve; });
  const result = Promise.allSettled([pending, Promise.reject('offline'), 7]);
  complete('catalog');
  expect(await result).toEqual([
    { status: 'fulfilled', value: 'catalog' },
    { status: 'rejected', reason: 'offline' },
    { status: 'fulfilled', value: 7 },
  ]);
  expect(await Promise.allSettled([])).toEqual([]);
  await expect(Promise.allSettled(null as never)).rejects.toBeInstanceOf(TypeError);
  expect(Object.keys(Promise)).not.toContain('allSettled');
});
