import type { NativeTextPort } from "../../../../roku/src/roku/native-text-types";
export type { NativeTextPort, NativeTextRequest } from "../../../../roku/src/roku/native-text-types";

export interface NativeTextTarget {
  key: unknown;
  title: string;
  value: string;
  numeric?: boolean;
  secret?: boolean;
  maximumLength?: number;
  confirm: string;
  write: (value: string) => void;
  done: () => void;
  cancel: () => void;
  failed: () => void;
}

export function createNativeTextEditing(host: NativeTextPort) {
  let key: unknown, draft: string | undefined, generation = 0, close: (() => void) | undefined;
  const retire = () => {
    generation++;
    const previous = close; close = undefined; previous?.();
  };
  function open(target: NativeTextTarget) {
    retire(); key = target.key;
    const intent = generation;
    const current = () => generation === intent;
    draft = target.value;
    const write = (value: string) => {if (value !== draft) {draft = value; target.write(value);}};
    const finish = (action: "done" | "cancel" | "failed", value?: string) => {
      if (!current()) return;
      retire();
      if (action === "failed") { target.failed(); return; }
      write(action === "cancel" ? target.value : value!);
      if (action === "done") target.done(); else target.cancel();
    };
    try {
      const handle = host.open({title: target.title, initial: target.value, numeric: !!target.numeric,
        secret: !!target.secret, maximumLength: target.maximumLength ?? (target.numeric ? 8 : 2048), confirm: target.confirm,
        change: value => {if (current()) write(value);}, done: value => finish("done", value),
        cancel: () => finish("cancel"), failed: () => finish("failed")});
      if (current()) close = () => handle.close(); else handle.close();
    } catch { finish("failed"); }
  }
  return {
    open,
    sync(target: NativeTextTarget | undefined) {
      if (target?.key === key) {
        if (close && target && target.value !== draft) open(target);
        return;
      }
      retire(); key = target?.key;
      if (target) open(target);
    },
    dispose() { retire(); key = undefined; },
  };
}
