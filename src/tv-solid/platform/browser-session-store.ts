import type { SessionStore } from "../remote/api";
import type { Tokens } from "../remote/types";

type TokenStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createBrowserSessionStore(
  key: string,
  storage: () => TokenStorage = () => localStorage,
  locks?: Pick<LockManager, "request">,
): SessionStore {
  let current: Tokens | null = null;
  let volatile = false;
  const remove = () => {
    try {
      storage().removeItem(key);
    } catch {}
  };
  return {
    withLock: locks ? (work) => locks.request(key, work) : undefined,
    async load() {
      if (volatile) return current;
      try {
        current = JSON.parse(storage().getItem(key) || "null") as Tokens | null;
      } catch {}
      return current;
    },
    async save(tokens) {
      current = tokens;
      volatile = true;
      try {
        storage().setItem(key, JSON.stringify(tokens));
        volatile = false;
      } catch (error) {
        // Persisted predecessors become replay credentials after rotation.
        remove();
        throw error;
      }
    },
    async clear() {
      current = null;
      volatile = true;
      remove();
    },
  };
}
