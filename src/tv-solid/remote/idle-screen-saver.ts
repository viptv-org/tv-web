import { createSignal, onCleanup, type Accessor } from "solid-js";

export function createIdleScreenSaver(options: {
  minutes: Accessor<number>;
  playing: Accessor<boolean>;
  onWake: () => void;
}) {
  const [active, setActive] = createSignal(false);
  let lastActivity = Date.now();
  const timer = setInterval(() => {
    const minutes = options.minutes();
    if (!minutes || active() || options.playing()) return;
    if (Date.now() - lastActivity >= minutes * 60_000) setActive(true);
  }, 15_000);
  onCleanup(() => clearInterval(timer));
  function dismiss(): boolean {
    if (active()) {
      setActive(false);
      lastActivity = Date.now();
      options.onWake();
      return true;
    }
    lastActivity = Date.now();
    return false;
  }
  return { active, dismiss };
}
