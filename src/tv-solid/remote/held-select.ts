import { onCleanup, type Accessor } from "solid-js";

export function createHeldSelect<T>(options: {
  target: Accessor<string>;
  layer: Accessor<T>;
  allowed: Accessor<boolean>;
  blocked: Accessor<boolean>;
  onTimer: () => void;
  hold: () => void;
  activate: () => void;
}) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => { clearTimeout(timer); };
  onCleanup(cancel);
  function press() {
    const target = options.target(), layer = options.layer();
    let held = false;
    cancel();
    if (options.allowed()) timer = setTimeout(() => {
      options.onTimer();
      if (target === options.target() && !options.blocked()) {
        held = true;
        options.hold();
      }
    }, 700);
    return () => {
      cancel();
      if (!held && layer === options.layer() && target === options.target()) options.activate();
    };
  }
  return { press, cancel };
}
