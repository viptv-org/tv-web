import { createElement } from "react";
import { createRoot } from "react-dom/client";
import type { TvApi, TvProfile } from "../api";
import { ProfileEditor } from "../ui/ProfileEditor";
import { RemoteRoot } from "../ui/remote";
import { suspendRemoteInput } from "./runtime";
import "../styles/index.css";
import "../styles/design.css";

/** The existing design-matched editor is loaded only when SolidTV opens it. */
export function openProfileEditor(
  api: TvApi,
  profile: TvProfile | undefined,
  primary: boolean,
  onSaved: () => Promise<void>,
  onClosed: () => void,
): () => void {
  const previousLayout = document.documentElement.dataset.layout;
  document.documentElement.dataset.layout = "tv";
  const host = document.createElement("div");
  host.className = "tv-layout";
  host.style.cssText = "position:fixed;inset:0;z-index:40;overflow:hidden;";
  const canvas = document.createElement("div");
  canvas.className = "tv-screen";
  canvas.style.cssText = "position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0;";
  host.appendChild(canvas);
  document.body.appendChild(host);
  const resize = () => { canvas.style.transform = `scale(${window.innerWidth / 1920})`; };
  resize();
  window.addEventListener("resize", resize);
  suspendRemoteInput(true);
  const root = createRoot(canvas);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    root.unmount();
    host.remove();
    window.removeEventListener("resize", resize);
    if (previousLayout === undefined) delete document.documentElement.dataset.layout;
    else document.documentElement.dataset.layout = previousLayout;
    suspendRemoteInput(false);
    onClosed();
  };
  root.render(createElement(RemoteRoot, { inputMode: "tv", onBack: close,
    children: createElement(ProfileEditor, {
      api,
      profile,
      primary,
      onCancel: close,
      onDone: async () => { await onSaved(); close(); },
    }),
  }));
  return close;
}
