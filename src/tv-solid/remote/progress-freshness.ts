type Attempt = { owner: string; revision: number; signal: AbortSignal };
export function createProgressFreshness(options: {
  owner: () => string; alive: () => boolean; changed: () => void;
  failure?: (error: unknown) => void;
}) {
  let owner = "", revision = 0, issued = 0, settled = 0;
  const attempts = new Map<string, Attempt>();
  const flights = new Map<string, Attempt & { again: boolean }>();
  function scope() {
    const next = options.owner();
    if (next !== owner) { owner = next; revision = 0; attempts.clear(); }
    return next;
  }
  return {
    afterPlayback(barrier: Promise<unknown>) {
      const captured = scope(), ticket = ++issued;
      void barrier.catch(() => {}).then(() => {
        if (!options.alive() || options.owner() !== captured || ticket < settled) return;
        scope(); settled = ticket; revision++; options.changed();
      });
    },
    refresh(resource: string, signal: AbortSignal, perView: boolean,
      work: (current: () => boolean) => Promise<boolean>) {
      const captured = scope(), version = revision;
      if (!version || signal.aborted || !options.alive()) return;
      const key = captured + ":" + resource, previous = attempts.get(key);
      if (previous?.revision === version && (!perView || previous.signal === signal)) return;
      const pending = flights.get(key);
      if (pending) { pending.again = true; return; }
      const attempt = { owner: captured, revision: version, signal, again: false };
      attempts.set(key, attempt); flights.set(key, attempt);
      const current = () => options.alive() && !signal.aborted && options.owner() === captured && revision === version;
      let committed = false, failed = false;
      void Promise.resolve().then(() => current() ? work(current) : false)
        .then(value => { committed = value; })
        .catch(error => { failed = true; if (current()) options.failure?.(error); })
        .finally(() => {
          if (flights.get(key) === attempt) flights.delete(key);
          if ((!committed && !failed || signal.aborted || revision !== version) && attempts.get(key) === attempt) attempts.delete(key);
          if (attempt.again && options.alive() && options.owner() === captured) options.changed();
        });
    },
  };
}
