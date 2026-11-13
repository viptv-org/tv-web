import { createElement, insertNode, removeNode, setProp, tmTransaction } from "@roku-sdk/solid";
import type { NativeTextPort, NativeTextRequest } from "../../../src/tv-solid/remote/input/native-text";

export function createNativeTextEntry(parent: any): NativeTextPort & { dispose(): void } {
  let current: { close(): void } | undefined, fallback = false;
  function open(request: NativeTextRequest) {
    current?.close(); fallback = false;
    let node: ReturnType<typeof createElement>;
    try { node = createElement("ViptvTextDialogBridge"); }
    catch { fallback = true; request.failed(); return {close() {}}; }
    let closed = false;
    const valid = (value: unknown): value is string => typeof value === "string" &&
      !/[\u0000-\u001f\u007f-\u009f]/.test(value) && Array.from(value).length <= request.maximumLength &&
      (!request.numeric || /^\d*$/.test(value));
    const handle = { close() {
      if (closed) return;
      closed = true;
      if (current === handle) current = undefined;
      tmTransaction(() => {
        setProp(node, "onEdit", undefined, edit);
        setProp(node, "onResult", undefined, result);
        setProp(node, "close", true);
        removeNode(parent, node);
      });
    }};
    const edit = (value: { text: string }) => {
      if (closed || current !== handle) return;
      if (valid(value?.text)) request.change(value.text);
      else {fallback = true; handle.close(); request.failed();}
    };
    const result = (value: { action: string; text?: string }) => {
      if (closed || current !== handle) return;
      const done = value?.action === "done" && valid(value.text);
      if (!done && value?.action !== "cancel") fallback = true;
      handle.close();
      if (done) request.done(value.text!);
      else if (value?.action === "cancel") request.cancel();
      else request.failed();
    };
    current = handle;
    try {
      tmTransaction(() => {
        setProp(node, "onEdit", edit);
        setProp(node, "onResult", result);
        insertNode(parent, node);
        setProp(node, "request", {title: request.title, initial: request.initial, numeric: request.numeric,
          secret: request.secret, maximumLength: request.maximumLength, confirm: request.confirm});
      });
    } catch { fallback = true; handle.close(); request.failed(); }
    return handle;
  }
  return { open, ownsInput: () => !fallback, dispose() { current?.close(); fallback = true; } };
}
