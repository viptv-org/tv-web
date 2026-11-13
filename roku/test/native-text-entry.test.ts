import { afterEach, expect, it, vi } from "vitest";
import type { NativeTextRequest } from "../../src/tv-solid/remote/input/native-text";

const native = vi.hoisted(() => ({nodes: [] as {type: string; fields: Record<string, any>}[], removed: [] as unknown[], failProperty: ""}));
vi.mock("@roku-sdk/solid", () => ({
  createElement: (type: string) => {const node = {type, fields: {}}; native.nodes.push(node); return node;},
  setProp: (node: typeof native.nodes[number], key: string, value: unknown) => {
    if (key === native.failProperty) throw new Error("Native field rejected");
    node.fields[key] = value;
  },
  insertNode: vi.fn(),
  tmTransaction: {removeNode: (_parent: unknown, node: unknown) => {native.removed.push(node);}},
}));
import { createNativeTextEntry } from "../src/roku/native-text-entry";
afterEach(() => {native.nodes.length = 0; native.removed.length = 0; native.failProperty = "";});
const request = (extra: Partial<NativeTextRequest> = {}): NativeTextRequest => ({title: "Search", initial: "Initial", maximumLength: 2048,
  numeric: false, secret: false, confirm: "Search", change: vi.fn(), done: vi.fn(), cancel: vi.fn(), failed: vi.fn(), ...extra});

it("opens the real native dialog bridge once, forwards full text, and never echoes edited text back", () => {
  const host = createNativeTextEntry({}), input = request(); host.open(input);
  const node = native.nodes[0]; expect(node.type).toBe("ViptvTextDialogBridge");
  expect(node.fields.request).toMatchObject({initial: "Initial", maximumLength: 2048, numeric: false});
  node.fields.onEdit({text: "Pasted 👨‍👩‍👧‍👦"}); node.fields.onEdit({text: ""});
  expect(input.change).toHaveBeenNthCalledWith(1, "Pasted 👨‍👩‍👧‍👦"); expect(input.change).toHaveBeenNthCalledWith(2, "");
  expect(node.fields.request.initial).toBe("Initial"); expect(native.nodes).toHaveLength(1);
  const closed = node.fields.onResult;
  closed({action: "done", text: "Final"}); closed({action: "cancel"});
  expect(input.done).toHaveBeenCalledWith("Final"); expect(input.cancel).not.toHaveBeenCalled(); expect(node.fields.close).toBe(true);
  expect(node.fields.onEdit).toBeUndefined(); expect(native.removed).toContain(node);
});

it("uses native PIN limits and masking, rejecting stale close/edit callbacks after replacement", () => {
  const host = createNativeTextEntry({}), old = request(); host.open(old);
  const edit = native.nodes[0].fields.onEdit, closed = native.nodes[0].fields.onResult;
  const next = request({title: "Profile PIN", initial: "1234", maximumLength: 8, numeric: true, secret: true}); host.open(next);
  expect(native.nodes[1].fields.request).toMatchObject({numeric: true, secret: true, maximumLength: 8});
  edit({text: "Old"}); closed({action: "cancel"}); expect(old.change).not.toHaveBeenCalled(); expect(old.cancel).not.toHaveBeenCalled();
  native.nodes[1].fields.onResult({action: "cancel"}); expect(next.cancel).toHaveBeenCalledOnce();
});

it("keeps legacy keys intercepted after Done, but releases ownership on native failure/disposal", () => {
  const host = createNativeTextEntry({}), input = request(); host.open(input);
  expect(host.ownsInput()).toBe(true); native.nodes[0].fields.onResult({action: "done", text: ""}); expect(host.ownsInput()).toBe(true);
  host.open(input); native.nodes[1].fields.onResult({action: "failed"});
  expect(host.ownsInput()).toBe(false); expect(input.failed).toHaveBeenCalledOnce();
  host.open(input); host.dispose(); expect(host.ownsInput()).toBe(false);
});

it("rejects invalid native PIN snapshots without truncating text or submitting a stale value", () => {
  for (const text of ["123456789", "12a", "12\n"]) {
    const host = createNativeTextEntry({}), input = request({numeric: true, maximumLength: 8}); host.open(input);
    native.nodes[native.nodes.length - 1].fields.onResult({action: "done", text});
    expect(input.done).not.toHaveBeenCalled(); expect(input.failed).toHaveBeenCalledOnce(); expect(host.ownsInput()).toBe(false);
  }
});

it("attempts close and removal and reports failure once even if observer setup and cleanup throw", () => {
  const host = createNativeTextEntry({}), input = request(); native.failProperty = "onEdit";
  expect(() => host.open(input)).not.toThrow();
  expect(input.failed).toHaveBeenCalledOnce(); expect(host.ownsInput()).toBe(false);
  expect(native.nodes[0].fields.close).toBe(true); expect(native.removed).toContain(native.nodes[0]);
  expect(input.done).not.toHaveBeenCalled();
});
