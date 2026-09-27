/** LG host behavior only; the TV renderer, focus system and player stay shared. */
export function exitWebos() {
  const host = window as Window & { webOS?: { platformBack(): void }; PalmSystem?: { platformBack(): void } };
  if (host.webOS?.platformBack) host.webOS.platformBack();
  else if (host.PalmSystem?.platformBack) host.PalmSystem.platformBack();
  else window.close();
}

export type WebosMediaAction = 'play' | 'pause' | 'toggle' | 'stop' | 'rewind' | 'forward';
export function installWebosLifecycle(suspend: () => void, resume: () => void, media: (action: WebosMediaAction) => void = () => {}) {
  const visibility = () => document.hidden ? suspend() : resume();
  const relaunch = () => { window.focus(); resume(); };
  const key = (event: KeyboardEvent) => {
    const action: WebosMediaAction | undefined = ({ 415: 'play', 19: 'pause', 10252: 'toggle', 413: 'stop', 412: 'rewind', 417: 'forward' } as Record<number, WebosMediaAction>)[event.keyCode];
    if (!action) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (!event.repeat) media(action);
  };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', suspend);
  document.addEventListener('webOSRelaunch', relaunch);
  window.addEventListener('keydown', key, true);
  return () => {
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pagehide', suspend);
    document.removeEventListener('webOSRelaunch', relaunch);
    window.removeEventListener('keydown', key, true);
  };
}
