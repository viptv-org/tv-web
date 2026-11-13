import { createElement, insertNode, setProp, tmTransaction } from "@roku-sdk/solid";
import type { NativeTextPort, NativeTextRequest } from "./native-text-types";

export function createNativeTextEntry(parent: any): NativeTextPort & { dispose(): void } {
  let current: { close(): void } | undefined, fallback = false;
  function open(request: NativeTextRequest) {
    current?.close(); fallback = false;
    let node: ReturnType<typeof createElement>;
    try { node = createElement("ViptvTextDialogBridge"); }
    catch { fallback = true; request.failed(); return {close() {}}; }
    let closed = false, failed = false;
    const fail = () => {fallback = true; if (!failed) {failed = true; request.failed();}};
    const valid = (value: unknown): value is string => typeof value === "string" &&
      !/[\u0000-\u001f\u007f-\u009f]/.test(value) && Array.from(value).length <= request.maximumLength &&
      (!request.numeric || /^\d*$/.test(value));
    const handle = { close() {
      if (closed) return;
      closed = true;
      if (current === handle) current = undefined;
      let incomplete = false;
      const cleanup = (action: () => void) => {try {action();} catch {incomplete = true;}};
      cleanup(() => setProp(node, "onEdit", undefined, edit));
      cleanup(() => setProp(node, "onResult", undefined, result));
      cleanup(() => setProp(node, "close", true));
      cleanup(() => tmTransaction.removeNode(parent, node));
      if (incomplete) fail();
    }};
    const edit = (value: { text: string }) => {
      if (closed || current !== handle) return;
      if (valid(value?.text)) request.change(value.text);
      else {fallback = true; handle.close(); fail();}
    };
    const result = (value: { action: string; text?: string }) => {
      if (closed || current !== handle) return;
      const done = value?.action === "done" && valid(value.text);
      if (!done && value?.action !== "cancel") fallback = true;
      handle.close();
      if (failed) return;
      if (done) request.done(value.text!);
      else if (value?.action === "cancel") request.cancel();
      else fail();
    };
    current = handle;
    try {
      setProp(node, "onEdit", edit);
      setProp(node, "onResult", result);
      insertNode(parent, node);
      setProp(node, "request", {title: request.title, initial: request.initial, numeric: request.numeric,
        secret: request.secret, maximumLength: request.maximumLength, confirm: request.confirm});
    } catch { fallback = true; handle.close(); fail(); }
    return handle;
  }
  return { open, ownsInput: () => !fallback, dispose() { current?.close(); fallback = true; } };
}
