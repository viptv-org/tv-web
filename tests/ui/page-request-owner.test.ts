import { createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { createCatalogPager } from "../../src/tv-solid/remote/paging/catalog";
import type { Page } from "../../src/tv-solid/remote/types";

it("a late page cannot append, unlock or settle a newer request generation", async () => {
  let generation = 1, busy = false;
  const controller = new AbortController();
  const settle = vi.fn(), fail = vi.fn(), cancel = vi.fn();
  const initial: Page = {cards: [], complete: false, next_cursor: "next"};
  const [page, adopt] = createSignal(initial);
  let resolve!: (page: Page) => void;
  const pending = new Promise<Page>(done => {resolve = done;});
  const request = vi.fn(() => pending);
  const more = createCatalogPager({current: page, adopt, library: () => false, discover: request,
    readLibrary: async () => {throw new Error("Wrong collection reader");},
    owner: {generation: () => generation, busy: () => busy, setBusy: value => {busy = value;}, signal: () => controller.signal,
      cancelFocus: cancel, settleFocus: settle, fail}});
  const operation = more();
  expect(request).toHaveBeenCalledWith("next", controller.signal);
  expect(busy).toBe(true);
  generation++;
  controller.abort();
  resolve({cards: [], complete: true});
  await operation;
  expect(page()).toBe(initial);
  expect(busy).toBe(true);
  expect(settle).not.toHaveBeenCalled();
  expect(cancel).not.toHaveBeenCalled();
  expect(fail).not.toHaveBeenCalled();
});
