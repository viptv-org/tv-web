import { createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { createSourcePublisher } from "../../src/tv-solid/remote/source-picker/publisher";
import { startSourceCandidate } from "../../src/tv-solid/remote/source-picker/start-candidate";
import type { SourcePage } from "../../src/tv-solid/remote/types";

const sourcePage = (id: string): SourcePage => ({streams: [{id, name: id}], quality_filters: [], total: 1});
it("a rank reply must still own both the source operation and filter generation", async () => {
  let current = new AbortController(), generation = 0;
  const [page, setPage] = createSignal<SourcePage>();
  const [filtering, setFiltering] = createSignal(false);
  const pending: ((page: SourcePage) => void)[] = [];
  const reconcile = vi.fn(), focusBest = vi.fn(), fail = vi.fn();
  const publish = createSourcePublisher({api: {rankSources: vi.fn(() => new Promise<SourcePage>(resolve => pending.push(resolve)))},
    owns: operation => current === operation, generation: {next: () => ++generation, current: () => generation}, height: () => 1080,
    ids: createSignal<string[]>([])[1], page: setPage, filtering: setFiltering, reconcile, focusBest, fail});
  publish(current, [], sourcePage("old"), ["old"], 2160);
  current = new AbortController();
  publish(current, [], sourcePage("new"), ["new"], 2160);
  pending[0](sourcePage("late"));
  await Promise.resolve();
  expect(page()?.streams[0].id).toBe("new");
  expect(filtering()).toBe(true);
  expect(reconcile).not.toHaveBeenCalled();
  pending[1](sourcePage("ranked"));
  await Promise.resolve();
  expect(page()?.streams[0].id).toBe("ranked");
  expect(filtering()).toBe(false);
  expect(focusBest).toHaveBeenCalledOnce();
  expect(fail).not.toHaveBeenCalled();
});

it("cancelled direct startup never stops or retries through the gateway", async () => {
  const cancelled = new DOMException("Cancelled", "AbortError");
  const player = {start: vi.fn(async () => {throw cancelled;}), stop: vi.fn(), replaceSource: vi.fn(), hasPlaybackProgress: false, leaseId: undefined};
  const notify = vi.fn();
  await expect(startSourceCandidate({player, source: {id: "fixture"}, action: {
    card: {identity: {kind: "movie", id: "fixture", ids: []}, provider_id: "fixture", title: "Fixture", badges: []}, resume: false, label: "Play", source_selection: "ask",
  }, direct: true, manual: true, replacing: false, position: () => 12, current: () => true, notify})).rejects.toBe(cancelled);
  expect(player.start).toHaveBeenCalledOnce();
  expect(player.stop).not.toHaveBeenCalled();
  expect(notify).not.toHaveBeenCalled();
});

it("accepts usable playback progress without promoting it to video evidence", async () => {
  const player={start:vi.fn(async()=>{}),stop:vi.fn(),replaceSource:vi.fn(),hasPlaybackProgress:true,hasPresentedFrame:false,leaseId:"fixture"};
  await expect(startSourceCandidate({player,source:{id:"fixture"},action:{
    card:{identity:{kind:"movie",id:"fixture",ids:[]},provider_id:"fixture",title:"Fixture",badges:[]},resume:false,label:"Play",source_selection:"ask",
  },direct:false,manual:false,replacing:false,position:()=>0,current:()=>true,notify:vi.fn()})).resolves.toBeUndefined();
  expect(player.hasPresentedFrame).toBe(false);
});
