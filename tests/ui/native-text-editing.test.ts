import { afterEach, expect, it, vi } from "vitest";
import { createEffect, createRoot, createSignal } from "solid-js";
import { createTextInput, type TvTextInputEvent } from "../../src/tv-solid/remote/input/text";
import { createNativeTextEditing, type NativeTextRequest, type NativeTextTarget } from "../../src/tv-solid/remote/input/native-text";
import { createOverlayController } from "../../src/tv-solid/remote/overlay-controller";

afterEach(() => vi.unstubAllGlobals());

it.each([
  ["Before", "Pasted several words", "Pasted several words"],
  ["AoldB", "AnewB", "AnewB"],
  ["A👨‍👩‍👧‍👦B", "AB", "AB"],
  ["é", "", ""],
])("adopts the native full edited value instead of appending to %s", (initial, edited, expected) => {
  let query = initial;
  const input = createTextInput({screen: () => "search", overlay: () => undefined, zone: () => "keyboard",
    text: vi.fn(), query: () => query, search: value => {query = value;}, done: vi.fn()});
  input({inputType: "insertReplacementText", data: edited, preventDefault: vi.fn()} as unknown as TvTextInputEvent);
  expect(query).toBe(expected);
});

function fixture(initial = "Opening value") {
  let value = initial;
  const requests: NativeTextRequest[] = [], close = vi.fn();
  const host = {open: vi.fn((request: NativeTextRequest) => {requests.push(request); return {close};}), ownsInput: () => true};
  const target: NativeTextTarget = {key: {}, title: "Search", value: initial, confirm: "Search",
    write: vi.fn(next => {value = next;}), done: vi.fn(), cancel: vi.fn(), failed: vi.fn()};
  const editor = createNativeTextEditing(host);
  editor.sync(target);
  return {host, target, requests, close, editor, value: () => value};
}

it("keeps one native field during rapid full-value edits without echoing text or cursor state", () => {
  const f = fixture();
  for (const text of ["Pasted 👨‍👩‍👧‍👦", "Replaced", "", "新しい é"]) {
    f.requests[0].change(text); f.editor.sync({...f.target, value: text}); expect(f.value()).toBe(text);
  }
  expect(f.host.open).toHaveBeenCalledOnce(); expect(f.requests[0].initial).toBe("Opening value");
  f.requests[0].done("Final paste"); f.requests[0].cancel();
  expect(f.value()).toBe("Final paste"); expect(f.target.done).toHaveBeenCalledOnce(); expect(f.target.cancel).not.toHaveBeenCalled();
});

it("restores the opening value on Back/cancel and waits for an explicit reopen", () => {
  const f = fixture(); f.requests[0].change("Draft"); f.requests[0].cancel();
  expect(f.value()).toBe("Opening value"); expect(f.target.cancel).toHaveBeenCalledOnce();
  f.editor.sync({...f.target, value: f.value()}); expect(f.host.open).toHaveBeenCalledOnce();
  f.editor.open({...f.target, value: f.value()}); expect(f.host.open).toHaveBeenCalledTimes(2);
});

it("rejects old edits, Done and wasClosed after a field switch or teardown", () => {
  const f = fixture();
  const next = {...f.target, key: {}, value: "Other field", write: vi.fn(), done: vi.fn(), cancel: vi.fn()};
  f.editor.sync(next); f.requests[0].change("Old edit"); f.requests[0].done("Old final"); f.requests[0].cancel();
  expect(next.write).not.toHaveBeenCalled(); expect(f.target.write).not.toHaveBeenCalled();
  f.requests[1].change("New edit"); expect(next.write).toHaveBeenCalledWith("New edit");
  f.editor.dispose(); f.requests[1].change("Too late"); f.requests[1].cancel();
  expect(next.write).toHaveBeenCalledOnce(); expect(next.cancel).not.toHaveBeenCalled();
});

it("does not reopen a failed native field automatically and preserves the current draft", () => {
  const f = fixture(); f.requests[0].change("Draft"); f.requests[0].failed();
  expect(f.value()).toBe("Draft"); expect(f.target.failed).toHaveBeenCalledOnce();
  f.editor.sync({...f.target, value: f.value()}); expect(f.host.open).toHaveBeenCalledOnce();
  f.requests[0].cancel(); expect(f.value()).toBe("Draft");
});

it("deduplicates repeated full snapshots and Done without losing repeated characters", () => {
  const f = fixture("");
  for (const value of ["a", "a", "aa", "aa", "aaa"]) f.requests[0].change(value);
  expect(f.value()).toBe("aaa"); expect(f.target.write).toHaveBeenCalledTimes(3);
  f.requests[0].done("aaa"); expect(f.target.write).toHaveBeenCalledTimes(3); expect(f.target.done).toHaveBeenCalledOnce();
});

it("starts a fresh native generation for an explicit external reset without echoing native edits", () => {
  const f = fixture();
  f.requests[0].change("Native draft"); f.editor.sync({...f.target, value: f.value()});
  expect(f.host.open).toHaveBeenCalledOnce();
  f.target.write("External reset"); f.editor.sync({...f.target, value: f.value()});
  expect(f.host.open).toHaveBeenCalledTimes(2); expect(f.requests[1].initial).toBe("External reset");
  f.requests[0].cancel(); expect(f.target.cancel).not.toHaveBeenCalled();
  f.requests[1].cancel(); f.editor.sync({...f.target, value: f.value()}); expect(f.host.open).toHaveBeenCalledTimes(2);
  expect(f.value()).toBe("External reset");
});

it("opens a real reactive text overlay with its initialized draft, including replacement fields", async () => {
  vi.stubGlobal("matchMedia", () => ({matches: true}));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const requests: NativeTextRequest[] = [];
  const f = createRoot(dispose => {
    const [text, setText] = createSignal("Stale previous draft");
    const overlays = createOverlayController({focus: {screen: () => "settings", capture: () => ({zone: "settings-content", column: 0, row: 0, choice: 0}),
      restore: vi.fn(), select: vi.fn(), selection: () => 0}, text: {begin: setText, clear: () => setText("")}, errors: {clear: vi.fn(), restore: vi.fn()}});
    const editor = createNativeTextEditing({ownsInput: () => true, open: request => {requests.push(request); return {close: vi.fn()};}});
    createEffect(() => {
      const modal = overlays.current();
      editor.sync(modal?.kind === "text" ? {key: modal, title: modal.title, value: text(), confirm: "Done", write: setText,
        done: vi.fn(), cancel: () => overlays.close(), failed: vi.fn()} : undefined);
    });
    return {overlays, dispose: () => {editor.dispose(); overlays.dispose(); dispose();}};
  });
  try {
    await Promise.resolve();
    f.overlays.open({kind: "text", title: "Profile name", initial: "Existing profile", submit: async () => {}});
    expect(requests).toHaveLength(1); expect(requests[0].initial).toBe("Existing profile");
    requests[0].change("A draft");
    f.overlays.open({kind: "text", title: "Other profile", initial: "Another name", submit: async () => {}});
    expect(requests).toHaveLength(2); expect(requests[1].initial).toBe("Another name");
  } finally {f.dispose();}
});
