import type { SessionStore } from '../../../src/tv-solid/remote/api';
import type { Tokens } from '../../../src/tv-solid/remote/types';
import type { JsonDeviceStorage } from './device-storage';

export function createRokuSessionStore(storage: JsonDeviceStorage<Tokens>): SessionStore {
  return {
    async load() {
      try {
        return await storage.load();
      } catch {
        return null;
      }
    },
    async save(tokens) { await storage.save(tokens); },
    async clear() { await storage.clear(); },
    withLock(work) { return work(); },
  };
}
