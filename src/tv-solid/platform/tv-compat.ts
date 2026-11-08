/** ES2017 TV engines predate these APIs used by the shared UI and renderer. */
export function installTvCompatibility(): void {
  if (typeof Array.prototype.at !== 'function') Object.defineProperty(Array.prototype, 'at', {
    configurable: true, writable: true,
    value: function (this: ArrayLike<unknown> | null, index: number) {
      if (this == null) throw new TypeError('Array.at requires an object.');
      const value = Object(this) as ArrayLike<unknown>;
      const length = Math.min(Math.max(Math.trunc(+value.length) || 0, 0), Number.MAX_SAFE_INTEGER);
      const integer = Math.trunc(+index) || 0;
      const at = integer < 0 ? length + integer : integer;
      return at >= 0 && at < length ? value[at] : undefined;
    },
  });
  if (typeof Object.fromEntries !== 'function') Object.defineProperty(Object, 'fromEntries', {
    configurable: true, writable: true,
    value: function (entries: Iterable<unknown>) {
      const result = {};
      for (const entry of entries) {
        if (entry === null || !['object', 'function'].includes(typeof entry))
          throw new TypeError('Object.fromEntries requires entry objects.');
        const pair = entry as { 0: PropertyKey; 1: unknown };
        // Define data properties so an untrusted __proto__ key stays data.
        Object.defineProperty(result, pair[0], {
          value: pair[1], configurable: true, writable: true, enumerable: true,
        });
      }
      return result;
    },
  });
}

installTvCompatibility();
