import type { JsonDeviceStorage } from './device-storage';

export function createRokuSessionStore<T>(storage: JsonDeviceStorage<T>) {
  return {
    async load() {
      return await storage.load();
    },
    async save(tokens: T) { await storage.save(tokens); },
    async clear() { await storage.clear(); },
    withLock<Result>(work: () => Promise<Result>): Promise<Result> { return work(); },
  };
}
