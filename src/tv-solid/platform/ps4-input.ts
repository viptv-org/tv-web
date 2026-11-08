/** PS4's Cross button activates a page click instead of a keyboard Enter. */
export function installPs4Input(): () => void {
  if (!/PlayStation\s*4/i.test(navigator.userAgent)) return () => {};
  let nativeEnter = -Infinity;
  const sendEnter = (type: string) => {
    const key = new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true });
    if (key.keyCode !== 13) Object.defineProperties(key, { keyCode: { value: 13 }, which: { value: 13 } });
    document.dispatchEvent(key);
  };
  const keyboard = (event: KeyboardEvent) => {
    if (!event.isTrusted || (event.key !== "Enter" && event.keyCode !== 13)) return;
    const target = event.target;
    if (target instanceof Element && target.closest("button,a,input,select,textarea,video")) return;
    nativeEnter = performance.now();
    if (event.keyCode !== 13) {
      event.preventDefault();event.stopImmediatePropagation();sendEnter(event.type);
    }
  };
  const click = (event: MouseEvent) => {
    if (event.button !== 0 || document.documentElement.dataset.tvStartup !== "ready") return;
    const target = event.target;
    if (target instanceof Element && target.closest("button,a,input,select,textarea,video")) return;
    event.preventDefault();event.stopImmediatePropagation();
    if (performance.now() - nativeEnter < 250) return;
    for (const type of ["keydown", "keyup"]) sendEnter(type);
  };
  window.addEventListener("keydown", keyboard, true);
  window.addEventListener("keyup", keyboard, true);
  window.addEventListener("click", click, true);
  return () => {
    window.removeEventListener("keydown", keyboard, true);
    window.removeEventListener("keyup", keyboard, true);
    window.removeEventListener("click", click, true);
  };
}
