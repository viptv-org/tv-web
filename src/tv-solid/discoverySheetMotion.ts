import { onCleanup, onMount } from 'solid-js';
import { activeElement, type ElementNode } from '@solidtv/solid';
import { restoreEntryFocus } from './EntryButton';

const settings = (duration: number) => ({ duration, adaptiveDuration: false, delay: 0,
  easing: 'ease-out', loop: false, repeat: 0, stopMethod: false as const });
/** Animate one panel transform through the renderer; checkbox changes do not animate the screen. */
export function discoverySheetMotion(focus: () => void) {
  const opener = activeElement();
  let root: ElementNode | undefined, panel: ElementNode | undefined, alive = true, closing = false;
  let animation: ReturnType<ElementNode['animate']> | undefined;
  onMount(() => {
    if (panel?.rendered) animation = panel.animate({ x: 1100 }, settings(300)).start();
    else if (panel) panel.x = 1100;
    queueMicrotask(() => { if (alive) focus(); });
  });
  onCleanup(() => { alive = false; animation?.stop(); restoreEntryFocus(root, opener); });
  return {
    root: (node: ElementNode) => { root = node; }, panel: (node: ElementNode) => { panel = node; },
    closing: () => closing,
    close: (complete: () => void) => {
      if (closing) return;
      closing = true; animation?.pause();
      if (!panel?.rendered) { complete(); return; }
      animation = panel.animate({ x: 1920 }, settings(200)).start();
      void animation.waitUntilStopped().then(() => { if (alive) complete(); });
    },
  };
}
