import { afterEach, expect, it, vi } from "vitest";
import { createRevisionPoller } from "../../src/tv-solid/remote/session/revisions";
import type { Bootstrap } from "../../src/tv-solid/remote/types";
afterEach(() => vi.useRealTimers());

it("retiring the root during a revision read cannot arm another polling timer", async () => {
  vi.useFakeTimers();
  let alive = true;
  let resolve!: (value: Record<string, number>) => void;
  const request = new Promise<Record<string, number>>(done => {resolve = done;});
  const fresh: Bootstrap = {contract_version: 1, identity: {profile_id: "fixture"}, revisions: {home: 1}, integrations: [],
    profile_management: {profiles: [], avatar_ids: [], capabilities: {}, parent: {pin_configured: false, unlocked: false, restricted: false}}};
  const bootstrap = vi.fn(async () => fresh);
  const apply = vi.fn(async (_value, _signal, _profile, commit: () => void) => {commit();});
  const fail = vi.fn();
  const poller = createRevisionPoller({ready: () => true, playing: () => false, blocked: () => false, alive: () => alive,
    profile: () => "fixture", signal: () => new AbortController().signal, read: () => request, bootstrap,
    playback: async () => {}, reset: vi.fn(), adoptBootstrap: vi.fn(), apply, fail});
  poller.schedule();
  await vi.advanceTimersByTimeAsync(15000);
  alive = false;
  poller.stop();
  resolve({home: 1});
  await vi.advanceTimersByTimeAsync(0);
  expect(apply).toHaveBeenCalledOnce();
  expect(fail).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
