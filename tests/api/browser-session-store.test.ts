import { describe, expect, it, vi } from "vitest";
import { createBrowserSessionStore } from "../../src/tv-solid/platform/browser-session-store";
import type { Tokens } from "../../src/tv-solid/remote/types";

const old: Tokens = { accessToken: "old-access", refreshToken: "old-refresh" };
const next: Tokens = { accessToken: "next-access", refreshToken: "next-refresh" };
function storage() {
  let value: string | null = JSON.stringify(old);
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, data: string) => { value = data; }),
    removeItem: vi.fn(() => { value = null; }),
  };
}

describe("browser session persistence", () => {
  it("restores the rotated grant across store instances", async () => {
    const disk = storage();
    await createBrowserSessionStore("device", () => disk).save(next);
    expect(await createBrowserSessionStore("device", () => disk).load()).toEqual(next);
  });

  it("keeps the current grant if storage access becomes unavailable", async () => {
    const disk = storage();
    let denied = false;
    const session = createBrowserSessionStore("device", () => {
      if (denied) throw new DOMException("Denied", "SecurityError");
      return disk;
    });
    expect(await session.load()).toEqual(old);
    denied = true;
    expect(await session.load()).toEqual(old);
    await expect(session.save(next)).rejects.toMatchObject({ name: "SecurityError" });
    expect(await session.load()).toEqual(next);
    await session.clear();
    expect(await session.load()).toBeNull();
  });

  it("removes consumed durable credentials after a quota failure", async () => {
    const disk = storage();
    const session = createBrowserSessionStore("device", () => disk);
    const write = disk.setItem.getMockImplementation()!;
    disk.setItem.mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    await expect(session.save(next)).rejects.toMatchObject({ name: "QuotaExceededError" });
    expect(await session.load()).toEqual(next);
    expect(await createBrowserSessionStore("device", () => disk).load()).toBeNull();
    disk.setItem.mockImplementation(write);
    await session.save(next);
    expect(await createBrowserSessionStore("device", () => disk).load()).toEqual(next);
  });

  it("keeps sign-out local even if removing durable data is denied", async () => {
    const disk = storage();
    const session = createBrowserSessionStore("device", () => disk);
    expect(await session.load()).toEqual(old);
    disk.removeItem.mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
    await session.clear();
    expect(await session.load()).toBeNull();
  });

  it("uses Web Locks when supplied and does not claim a cross-context fallback", async () => {
    const request = vi.fn(async (_key: string, work: () => Promise<unknown>) => work());
    const session = createBrowserSessionStore("device", storage, { request } as unknown as LockManager);
    await expect(session.withLock!(async () => "rotated")).resolves.toBe("rotated");
    expect(request).toHaveBeenCalledWith("device", expect.any(Function));
    expect(createBrowserSessionStore("device", storage).withLock).toBeUndefined();
  });
});
