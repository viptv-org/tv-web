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
