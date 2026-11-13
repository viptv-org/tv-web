import { createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { createDetailRefresh } from "../../src/tv-solid/remote/detail-refresh";
import { createProgressFreshness } from "../../src/tv-solid/remote/progress-freshness";
import { cardKey, type Card, type Detail, type Home, type TitleAction } from "../../src/tv-solid/remote/types";

const card = (id: string): Card => ({ identity: {kind: "movie", id, ids: []}, provider_id: "catalog", title: id, badges: [] });
const title = card("Spider-Man"), other = card("Other");
const initial: Detail = {item: title, episodes: [], recommendations: [other, title],
  seasons: [{season: 1, episode_count: 2, offset: 0}, {season: 2, episode_count: 2, offset: 20}]};
const resumed: Card = {...title, progress: 0.25, view: {saved: false, progress: 0.25}};
const action: TitleAction = {card: resumed, label: "Resume at 2:03", resume: true, resume_position_millis: 123000,
  source_selection: "ask", progress: 0.25};

function detailState() {
  const [detail, setDetail] = createSignal<Detail | undefined>(initial);
  const [intent, setIntent] = createSignal<TitleAction>();
  const [season, setSeason] = createSignal(1), [column, setColumn] = createSignal(1);
  let finish!: (value: Detail) => void;
  const api = {detail: vi.fn(() => new Promise<Detail>(resolve => {finish = resolve;})), titleAction: vi.fn(async () => action)};
  const refresh = createDetailRefresh({api, detail: {current: detail, set: setDetail, action: setIntent},
    selected: () => title, focused: () => title, season: {current: season, set: setSeason}, generation: () => 1,
    current: signal => !signal.aborted, focus: {zone: () => "recommendations", column, setColumn},
    resolve: (cards, key, fallback) => {
      const found = cards.findIndex(item => cardKey(item) === key);
      return found >= 0 ? found : Math.max(0, Math.min(fallback, cards.length - 1));
    }});
  return {api, detail, intent, season, column, refresh, finish: () => finish({...initial, item: resumed,
    recommendations: [resumed, other], seasons: [initial.seasons[1], initial.seasons[0]]})};
}

it("adopts actual returned Home progress and server Detail Resume only after final persistence settles", async () => {
  let finishWrite!: () => void;
  const changed = vi.fn(), freshness = createProgressFreshness({owner: () => "profile:epoch", alive: () => true, changed});
  const barrier = new Promise<void>(resolve => {finishWrite = resolve;});
  const signal = new AbortController().signal, state = detailState();
  let home: Home = {featured: [], complete: true, revision: 1, rows: []};
  const readHome = vi.fn(async () => ({...home, revision: 2, rows: [{id: "continue", title: "Continue Watching",
    state: "Ready" as const, cards: [resumed]}]}));
  const homeWork = async (current: () => boolean) => {const value = await readHome(); if (!current()) return false; home = value; return true;};
  const detailWork = async (current: () => boolean) => {let committed = false;
    await state.refresh(signal, "profile", () => {committed = true;}, current); return committed;};
  freshness.afterPlayback(barrier);
  freshness.refresh("home", signal, false, homeWork);
  freshness.refresh("detail:Spider-Man", signal, true, detailWork);
  expect(readHome).not.toHaveBeenCalled(); expect(state.api.detail).not.toHaveBeenCalled();
  expect(home.rows).toEqual([]); expect(state.intent()).toBeUndefined();
  finishWrite(); await vi.waitFor(() => expect(changed).toHaveBeenCalledOnce());
  freshness.refresh("home", signal, false, homeWork);
  freshness.refresh("detail:Spider-Man", signal, true, detailWork);
  await vi.waitFor(() => expect(state.api.detail).toHaveBeenCalledWith(title, "20", signal));
  state.finish();
  await vi.waitFor(() => expect(state.intent()).toEqual(action));
  expect(home.rows[0].cards[0].progress).toBe(0.25);
  expect(state.detail()?.item.progress).toBe(0.25);
  expect(state.intent()?.resume_position_millis).toBe(123000);
  expect(state.detail()?.seasons[state.season()].season).toBe(2);
  expect(state.detail()?.recommendations[state.column()].identity.id).toBe(title.identity.id);
  expect(state.column()).toBe(0);
});

it.each(["newer playback", "aborted view"])("discards pending Detail progress and Resume after %s", async reason => {
  const state = detailState(), controller = new AbortController(), committed = vi.fn();
  let current = true;
  const reading = state.refresh(controller.signal, "profile", committed, () => current);
  if (reason === "aborted view") controller.abort(); else current = false;
  state.finish(); await reading;
  expect(state.detail()).toBe(initial); expect(state.intent()).toBeUndefined();
  expect(state.season()).toBe(1); expect(state.column()).toBe(1); expect(committed).not.toHaveBeenCalled();
});
