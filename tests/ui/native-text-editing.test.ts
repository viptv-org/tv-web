import { expect, it, vi } from "vitest";
import { createTextInput, type TvTextInputEvent } from "../../src/tv-solid/remote/input/text";

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
