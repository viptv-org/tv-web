function distance(seconds: number) {
  const ramp = Math.min(4, Math.max(0, seconds));
  return 20 * ramp + 7.5 * ramp * ramp + 80 * Math.max(0, seconds - 4);
}

export function createHeldSeek(options: {
  scope: () => unknown | undefined;
  step: (seconds: number) => void;
}) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  const cancel = () => { generation++; clearTimeout(timer); timer = undefined; };
  function press(direction: number) {
    cancel();
    const scope = options.scope();
    if (scope === undefined) return;
    const intent = generation, start = performance.now() + 400;
    let previous = start;
    options.step(direction * 10);
    const tick = () => {
      if (intent !== generation) return;
      if (options.scope() !== scope) { cancel(); return; }
      const now = performance.now(), elapsed = now - previous;
      if (elapsed < 0 || elapsed > 250) { cancel(); return; }
      const delta = distance((now - start) / 1000) - distance((previous - start) / 1000);
      previous = now;
      if (delta > 0) options.step(direction * delta);
      timer = setTimeout(tick, 50);
    };
    timer = setTimeout(tick, 400);
    return () => { if (intent === generation) cancel(); };
  }
  return { press, cancel };
}
