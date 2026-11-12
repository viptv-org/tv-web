import { createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { createSourceIntent } from "../../src/tv-solid/remote/source-picker/intent";
import type { SourceReuseContext } from "../../src/tv-solid/remote/device-playback";
import type { SourcePage, TitleAction } from "../../src/tv-solid/remote/types";

it("a cancelled intent waiting for remembered choices cannot reopen the picker or discover", async () => {
  const card = {identity: {kind: "movie", id: "fixture", ids: []}, provider_id: "fixture", title: "Fixture", badges: []};
  let intent = 1;
  const operation = new AbortController();
  let resolve!: (value: SourceReuseContext) => void;
  const memory = new Promise<SourceReuseContext>(done => {resolve = done;});
  const presentation = {capture: vi.fn(), hide: vi.fn(), show: vi.fn()};
  const sources = vi.fn(async () => []);
  const action: TitleAction = {card, label: "Play", resume: false, source_selection: "ask"};
  const play = createSourceIntent({api: {titleAction: async () => action, sources, preferredSourceDiscoverySupported: false},
    begin: () => ({id: intent, epoch: 1, operation}),
    owner: {intent: () => intent, epoch: () => 1, operation: () => operation, replace: vi.fn(), aborted: () => operation.signal.aborted},
    position: () => 0, manual: () => false, playerScreen: () => false, memory: () => memory, presentation,
    resolve: vi.fn(), retry: vi.fn(), page: createSignal<SourcePage>()[1], ids: createSignal<string[]>([])[1],
    loading: createSignal(false)[1], discovering: createSignal(false)[1], failure: {current: () => "", set: createSignal("")[1]},
    rows: () => [], reconcile: vi.fn(), publish: vi.fn(), play: async () => false, notify: vi.fn(), fail: vi.fn()});
  const pending = play(card);
  intent++;
  operation.abort();
  resolve({});
  await pending;
  expect(sources).not.toHaveBeenCalled();
  expect(presentation.show).not.toHaveBeenCalled();
  expect(presentation.hide).not.toHaveBeenCalled();
});

it.each(['intent', 'profile'])('a late title action cannot publish an obsolete resume clock after %s changes', async changed => {
  const card = {identity: {kind: 'movie', id: 'fixture', ids: []}, provider_id: 'fixture', title: 'Fixture', badges: []};
  let intent = 1, epoch = 1;
  let finish!: (value: TitleAction) => void;
  const action = new Promise<TitleAction>(resolve => { finish = resolve; });
  const operation = new AbortController(), resolve = vi.fn(), sources = vi.fn(async () => []);
  const titleAction = vi.fn(() => action);
  const play = createSourceIntent({api: {titleAction, sources, preferredSourceDiscoverySupported: false},
    begin: () => ({id: intent, epoch, operation}),
    owner: {intent: () => intent, epoch: () => epoch, operation: () => operation, replace: vi.fn(), aborted: () => false},
    position: () => 0, manual: () => false, playerScreen: () => false, memory: async () => ({}),
    presentation: {capture: vi.fn(), hide: vi.fn(), show: vi.fn()}, resolve, retry: vi.fn(),
    page: createSignal<SourcePage>()[1], ids: createSignal<string[]>([])[1], loading: createSignal(false)[1], discovering: createSignal(false)[1],
    failure: {current: () => '', set: createSignal('')[1]}, rows: () => [], reconcile: vi.fn(), publish: vi.fn(), play: async () => false, notify: vi.fn(), fail: vi.fn()});
  const pending = play(card);
  await Promise.resolve(); expect(titleAction).toHaveBeenCalledOnce();
  if (changed === 'intent') intent++; else epoch++;
  finish({card, label: 'Resume at 0:30', resume: true, resume_position_millis: 30_000, source_selection: 'ask'});
  await pending;
  expect(resolve).not.toHaveBeenCalled(); expect(sources).not.toHaveBeenCalled();
});
