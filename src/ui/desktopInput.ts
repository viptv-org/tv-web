/** Native desktop controls are pointer driven; ordinary text editing stays native. */
export function installDesktopPointerInput(): () => void {
  const root = document.documentElement;
  const previous = root.dataset.desktopInput;
  root.dataset.desktopInput = 'pointer';
  const editable = (target: EventTarget | null) => target instanceof HTMLElement &&
    target.matches('textarea, [contenteditable="true"], input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"])');
  const keys = (event: KeyboardEvent) => {
    event.stopImmediatePropagation();
    if (event.key === 'Tab' || !editable(event.target)) event.preventDefault();
  };
  const focus = (event: FocusEvent) => {
    if (event.target instanceof HTMLElement && !editable(event.target)) {
      event.stopImmediatePropagation();
      event.target.blur();
    }
  };
  const untab = (node: ParentNode) => node.querySelectorAll<HTMLElement>('a[href], button, input, textarea, select, [tabindex], [contenteditable]').forEach(element => {
    if (element.tabIndex !== -1) element.tabIndex = -1;
  });
  untab(root);
  const observer = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node instanceof HTMLElement) {
        if (node.matches('a[href], button, input, textarea, select, [tabindex], [contenteditable]')) node.tabIndex = -1;
        untab(node);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  window.addEventListener('keydown', keys, true);
  window.addEventListener('keyup', keys, true);
  document.addEventListener('focusin', focus, true);
  return () => {
    observer.disconnect();
    window.removeEventListener('keydown', keys, true);
    window.removeEventListener('keyup', keys, true);
    document.removeEventListener('focusin', focus, true);
    if (previous === undefined) delete root.dataset.desktopInput;
    else root.dataset.desktopInput = previous;
  };
}
