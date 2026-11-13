import { expect, it, vi } from "vitest";
import { createTextInput, type TvTextInputEvent } from "../../src/tv-solid/remote/input/text";
import { createNativeTextEditing, type NativeTextRequest, type NativeTextTarget } from "../../src/tv-solid/remote/input/native-text";

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
