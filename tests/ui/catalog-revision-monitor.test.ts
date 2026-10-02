// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogRevisionMonitor } from "../../src/ui/app/catalogRevisionMonitor";

const visibility = Object.getOwnPropertyDescriptor(document, "visibilityState");
let visible = true;
beforeEach(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visible ? "visible" : "hidden" }); });
afterEach(() => {
  vi.useRealTimers(); visible = true;
  if (visibility) Object.defineProperty(document, "visibilityState", visibility);
});

describe("Home catalog revision polling", () => {
  it("checks immediately and every 15 seconds, and skips catalog loading for unchanged revisions", async () => {
    vi.useFakeTimers(); let revision = "r1";
    const read = vi.fn(async () => revision); const refresh = vi.fn(async () => {});
    const monitor = new CatalogRevisionMonitor(read, refresh, "r1"); monitor.start();
    await vi.advanceTimersByTimeAsync(0); expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000); expect(read).toHaveBeenCalledTimes(3); expect(refresh).not.toHaveBeenCalled();
    revision = "r2"; await vi.advanceTimersByTimeAsync(15_000); expect(refresh).toHaveBeenCalledTimes(1);
    const before = read.mock.calls.length;
    visible = false; document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(30_000); expect(read).toHaveBeenCalledTimes(before);
    visible = true; document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0); expect(read).toHaveBeenCalledTimes(before + 1);
    monitor.stop(); await vi.advanceTimersByTimeAsync(15_000); expect(read).toHaveBeenCalledTimes(before + 1);
  });

  it("retries failed refreshes and catches changes committed during a load", async () => {
    vi.useFakeTimers(); let revision = "r2"; let release!: () => void; let fail = true;
    const read = vi.fn(async () => revision);
    const refresh = vi.fn(async () => {
      if (fail) { fail = false; throw new Error("catalogs unavailable"); }
      if (refresh.mock.calls.length === 2) await new Promise<void>(resolve => { release = resolve; });
    });
    const monitor = new CatalogRevisionMonitor(read, refresh, "r1"); monitor.start();
    await vi.advanceTimersByTimeAsync(0); expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(15_000); expect(refresh).toHaveBeenCalledTimes(2);
    revision = "r3"; release();
    await vi.advanceTimersByTimeAsync(0); expect(refresh).toHaveBeenCalledTimes(3);
    expect(monitor.revisionToken).toBe("r3"); monitor.stop();
  });

  it("falls back quietly when an older server has no revision endpoint", async () => {
    vi.useFakeTimers(); const read = vi.fn(async () => { throw { status: 404 }; });
    const refresh = vi.fn(async () => {}); const monitor = new CatalogRevisionMonitor(read, refresh);
    monitor.start(); await vi.advanceTimersByTimeAsync(45_000);
    expect(read).toHaveBeenCalledTimes(1); expect(refresh).not.toHaveBeenCalled(); monitor.stop();
  });
  it("rejects a late non-cooperative refresh after Home leaves", async () => {
    vi.useFakeTimers(); let release!: () => void;
    const read = vi.fn(async () => "r2");
    const refresh = vi.fn(() => new Promise<void>(resolve => { release = resolve; }));
    const monitor = new CatalogRevisionMonitor(read, refresh, "r1"); monitor.start();
    await vi.advanceTimersByTimeAsync(0); expect(refresh).toHaveBeenCalledTimes(1);
    monitor.stop(); release(); await vi.advanceTimersByTimeAsync(45_000);
    expect(monitor.revisionToken).toBe("r1");
    expect(read).toHaveBeenCalledTimes(1);
  });
});
