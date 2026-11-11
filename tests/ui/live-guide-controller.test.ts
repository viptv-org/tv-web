import { createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { createLiveGuideController } from "../../src/tv-solid/remote/live/guide-controller";
import type { Channel, Guide, Program } from "../../src/tv-solid/remote/types";

function setup() {
  let scope = new AbortController();
  const channels: Channel[] = Array.from({length: 40}, (_, i) => ({id: String(i), connection_id: "fixture",
    card: {identity: {kind: "channel", id: String(i), ids: []}, provider_id: "fixture", title: String(i), badges: []}}));
  const [programs, setPrograms] = createSignal<Record<string, Program[]>>({});
  const [info, setInfo] = createSignal<Record<string, Guide["view"]>>({});
  const [index, setIndex] = createSignal(0), [selection, setSelection] = createSignal(0);
  const pending: {id: string; signal: AbortSignal; resolve: (guide: Guide) => void}[] = [];
  const request = vi.fn((id: string, signal: AbortSignal) => new Promise<Guide>(resolve => pending.push({id, signal, resolve})));
  const notify = vi.fn();
  const controller = createLiveGuideController({scope: () => scope, channels: () => channels, channelIndex: index,
    rowStart: index, programs: {current: programs, set: setPrograms}, info: {set: setInfo},
    selection: {current: () => programs()[String(index())]?.[selection()], set: setSelection}, request, notify});
  return {controller, pending, programs, info, setIndex, selection, notify,
    changeScope() {scope.abort();scope = new AbortController();}};
}
const guide = (id: string): Guide => ({programs: [{id, title: id, start_millis: 1, end_millis: 2}],
  view: {current_program_id: id, now_millis: 1, window_start_millis: 0, window_end_millis: 10}});

it("a retired scope cannot adopt a late guide or overwrite a new request", async () => {
  const fixture = setup();
  const old = fixture.controller.load(0);
  fixture.changeScope();
  expect(fixture.pending[0].signal.aborted).toBe(true);
  const next = fixture.controller.load(0);
  expect(fixture.controller.inFlight()).toBe(1);
  fixture.pending[0].resolve(guide("old"));
  await old;
  expect(fixture.programs()).toEqual({});
  expect(fixture.controller.inFlight()).toBe(1);
  fixture.pending[1].resolve(guide("new"));
  await next;
  expect(fixture.programs()["0"][0].id).toBe("new");
  expect(fixture.notify).not.toHaveBeenCalled();
  fixture.controller.dispose();
});

it("moving the guide window cancels obsolete work and keeps bounded cache facts", async () => {
  const fixture = setup();
  const first = fixture.controller.load(0);
  fixture.pending[0].resolve(guide("first"));
  await first;
  const old = fixture.controller.load(1);
  fixture.setIndex(30);
  const visible = fixture.controller.loadVisible();
  expect(fixture.pending[1].signal.aborted).toBe(true);
  expect(fixture.programs()).toEqual({});
  expect(fixture.info()).toEqual({});
  fixture.controller.retire();
  expect(fixture.controller.inFlight()).toBe(0);
  for (const request of fixture.pending.slice(1)) request.resolve(guide(request.id));
  await Promise.all([old, visible]);
  expect(fixture.programs()).toEqual({});
  expect(fixture.selection()).toBe(0);
  fixture.controller.dispose();
});
