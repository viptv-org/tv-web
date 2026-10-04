import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export interface NativeFullscreenWindow {
  isFullscreen(): Promise<boolean>;
  setFullscreen(value: boolean): Promise<void>;
}
/** Tracks ownership so leaving playback does not un-fullscreen somebody else's window. */
export class PlayerFullscreen {
  private entered = false;
  constructor(private readonly host: NativeFullscreenWindow, private readonly toggleHost?: (current: boolean) => Promise<boolean>) {}
  async toggle(own = true) {
    const current = await this.host.isFullscreen();
    const next = this.toggleHost ? await this.toggleHost(current) : (await this.host.setFullscreen(!current), !current);
    this.entered = own && next;
    return next;
  }
  async exit() {
    this.entered = false;
    if (await this.host.isFullscreen()) await this.host.setFullscreen(false);
  }
  async release() {
    if (!this.entered) return;
    this.entered = false;
    if (await this.host.isFullscreen()) await this.host.setFullscreen(false);
  }
}
type LegacyVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};
export function usePlayerFullscreen(active: boolean, root: RefObject<HTMLElement>, video: RefObject<HTMLVideoElement>, onError: (error: unknown) => void, allowWindowFullscreen = true) {
  const [fullscreen, setFullscreen] = useState(false);
  const owner = useRef(false);
  const native = useRef<PlayerFullscreen>();
  const pending = useRef(false);
  const mounted = useRef(true);
  const activeRef = useRef(active);
  activeRef.current = active;
  const isNative = '__TAURI_INTERNALS__' in window;
  const read = useCallback(async () => {
    if (isNative) {
      setFullscreen(await getCurrentWindow().isFullscreen());
    } else setFullscreen(!!document.fullscreenElement || !!(video.current as LegacyVideo | null)?.webkitDisplayingFullscreen);
  }, [isNative, video]);
  useEffect(() => {
    const changed = () => { void read().catch(() => {}); };
    document.addEventListener('fullscreenchange', changed);
    window.addEventListener('resize', changed);
    const element = video.current;
    element?.addEventListener('webkitbeginfullscreen', changed);
    element?.addEventListener('webkitendfullscreen', changed);
    if (active) changed();
    return () => {
      document.removeEventListener('fullscreenchange', changed);
      window.removeEventListener('resize', changed);
      element?.removeEventListener('webkitbeginfullscreen', changed);
      element?.removeEventListener('webkitendfullscreen', changed);
    };
  }, [active, read, video]);
  const release = useCallback(async () => {
    if (isNative) await native.current?.release();
    else if (owner.current) {
      owner.current = false;
      if (document.fullscreenElement) await document.exitFullscreen();
      else (video.current as LegacyVideo | null)?.webkitExitFullscreen?.();
    }
    await read();
  }, [isNative, read, video]);
  useEffect(() => {
    if (!active) void release().catch(onError);
  }, [active, release]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; void release().catch(() => {}); };
  }, [release]);
  const toggle = async () => {
    if (pending.current) return;
    pending.current = true;
    const playerToggle = activeRef.current;
    try {
      if (isNative) {
          const host = getCurrentWindow();
        native.current ??= new PlayerFullscreen(host, async current => {
          try {
            return await invoke<boolean>('app_window_toggle_fullscreen');
          } catch {
            await host.setFullscreen(!current);
            return !current;
          }
        });
        setFullscreen(await native.current.toggle(playerToggle));
      } else if (document.fullscreenElement) {
        await document.exitFullscreen(); owner.current = false;
      } else if (root.current?.requestFullscreen) {
        // Invoke directly in the click gesture, before any asynchronous work.
        await root.current.requestFullscreen(); owner.current = true;
      } else {
        const element = video.current as LegacyVideo | null;
        if (!element?.webkitEnterFullscreen || !element.currentSrc) throw new Error('Fullscreen is not available in this browser.');
        element.webkitEnterFullscreen(); owner.current = true;
      }
      if ((!mounted.current || !activeRef.current) && (playerToggle || !allowWindowFullscreen)) await release();
      else await read();
    } catch (error) { onError(error); }
    finally { pending.current = false; }
  };
  const exit = async () => {
    try {
      if (isNative) {
          native.current ??= new PlayerFullscreen(getCurrentWindow());
        await native.current.exit();
      } else {
        owner.current = false;
        if (document.fullscreenElement) await document.exitFullscreen();
        else (video.current as LegacyVideo | null)?.webkitExitFullscreen?.();
      }
      await read();
    } catch (error) { onError(error); }
  };
  return { fullscreen, toggle, exit };
}
