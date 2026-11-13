import { expect, it, vi } from "vitest";
import { createProgressFreshness } from "../../src/tv-solid/remote/progress-freshness";

it("invalidates returned server views only after the captured final progress write settles", async () => {
  let finish!: () => void;
  const settled = new Promise<void>(resolve => { finish = resolve; });
  const changed = vi.fn();
  const freshness = createProgressFreshness({ owner: () => "account:profile:epoch", alive: () => true, changed });
  freshness.afterPlayback(settled);
  await Promise.resolve();
  expect(changed).not.toHaveBeenCalled();
  finish();
  await vi.waitFor(() => expect(changed).toHaveBeenCalledOnce());
});

it("still invalidates once when final persistence rejects", async () => {
  const changed = vi.fn();
  const freshness = createProgressFreshness({ owner: () => "owner", alive: () => true, changed });
  freshness.afterPlayback(Promise.reject(new Error("write failed")));
  await vi.waitFor(() => expect(changed).toHaveBeenCalledOnce());
});

it("discards settled writes after a profile switch or unmount", async () => {
  let owner = "first", alive = true;
  let finish!: () => void;
  const changed = vi.fn(), freshness = createProgressFreshness({ owner: () => owner, alive: () => alive, changed });
  freshness.afterPlayback(new Promise<void>(resolve => { finish = resolve; }));
  owner = "second"; finish(); await Promise.resolve(); await Promise.resolve();
  expect(changed).not.toHaveBeenCalled();
  freshness.afterPlayback(Promise.resolve()); alive = false;
  await Promise.resolve(); await Promise.resolve();
  expect(changed).not.toHaveBeenCalled();
});

it("coalesces resource reads and refreshes cached detail on a new returning view", async () => {
  const freshness = createProgressFreshness({ owner: () => "owner", alive: () => true, changed: vi.fn() });
  freshness.afterPlayback(Promise.resolve());
  await new Promise(resolve => setTimeout(resolve, 0));
  const first = new AbortController(), second = new AbortController();
  const home = vi.fn(async () => true), detail = vi.fn(async () => true);
  freshness.refresh("home", first.signal, false, home);
  freshness.refresh("home", first.signal, false, home);
  freshness.refresh("detail:movie", first.signal, true, detail);
  await vi.waitFor(() => expect(home).toHaveBeenCalledOnce());
  await new Promise(resolve => setTimeout(resolve, 0));
  freshness.refresh("home", second.signal, false, home);
  freshness.refresh("detail:movie", second.signal, true, detail);
  await vi.waitFor(() => expect(detail).toHaveBeenCalledTimes(2));
  expect(home).toHaveBeenCalledOnce();
});

it("fences old reads and catches up once after a newer playback settlement", async () => {
  const changed = vi.fn(), freshness = createProgressFreshness({ owner: () => "owner", alive: () => true, changed });
  freshness.afterPlayback(Promise.resolve()); await new Promise(resolve => setTimeout(resolve, 0));
  const scope = new AbortController(), adopted = vi.fn();
  let finish!: () => void;
  const old = vi.fn(async (current: () => boolean) => {
    await new Promise<void>(resolve => { finish = resolve; });
    if (!current()) return false;
    adopted(); return true;
  });
  freshness.refresh("home", scope.signal, false, old);
  await vi.waitFor(() => expect(finish).toBeDefined());
  freshness.afterPlayback(Promise.resolve()); await new Promise(resolve => setTimeout(resolve, 0));
  freshness.refresh("home", scope.signal, false, old);
  expect(old).toHaveBeenCalledOnce();
  finish(); await new Promise(resolve => setTimeout(resolve, 0));
  expect(adopted).not.toHaveBeenCalled();
  const fresh = vi.fn(async (current: () => boolean) => { if (current()) adopted(); return true; });
  freshness.refresh("home", scope.signal, false, fresh);
  await vi.waitFor(() => expect(fresh).toHaveBeenCalledOnce());
  expect(adopted).toHaveBeenCalledOnce();
});

it("never commits an aborted read or storms after a failed read", async () => {
  const failure = vi.fn(), freshness = createProgressFreshness({ owner: () => "owner", alive: () => true, changed: vi.fn(), failure });
  freshness.afterPlayback(Promise.resolve()); await new Promise(resolve => setTimeout(resolve, 0));
  const scope = new AbortController(), adopted = vi.fn(); let finish!: () => void;
  freshness.refresh("home", scope.signal, false, async current => {
    await new Promise<void>(resolve => { finish = resolve; }); if (current()) adopted(); return current();
  });
  await vi.waitFor(() => expect(finish).toBeDefined());scope.abort();finish();
  await new Promise(resolve => setTimeout(resolve, 0));expect(adopted).not.toHaveBeenCalled();
  const next = new AbortController(), failed = vi.fn(async () => { throw new Error("offline"); });
  freshness.refresh("home", next.signal, false, failed);
  await vi.waitFor(() => expect(failure).toHaveBeenCalledOnce());
  freshness.refresh("home", next.signal, false, failed);
  await new Promise(resolve => setTimeout(resolve, 0));expect(failed).toHaveBeenCalledOnce();
});
