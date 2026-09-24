/*
 * DEV gallery helper for agent B's overlay figures: the app screen behind each overlay
 * (backdrops.json, extracted from the reference component sheets with the overlay removed and
 * [data-overlay-host] marking the element the overlay mounts in), so a screenshot compares
 * only the overlay primitives. Reference art is served by Vite from the design checkout.
 */
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import backdrops from "./backdrops.json";

const assets = import.meta.glob("../../../../../design/viptv-design-system/reference/assets/*", { query: "?url", import: "default", eager: true }) as Record<string, string>;
const byName = new Map(Object.entries(assets).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1), url]));

/** URL of a reference asset by file name (empty when the design checkout is missing). */
export const refAsset = (name: string) => byName.get(name) ?? "";

/* The reference pages' own base rules, re-asserted over the legacy global button skin. */
const BASE = `.responsive-app .vx-gallery-backdrop button:not([class*="vx-"]),.tv-layout .vx-gallery-backdrop button:not([class*="vx-"]){font:inherit;color:inherit;background:transparent;border:0;min-height:0;min-width:0;margin:0;text-align:inherit;box-shadow:none;outline:none;transform:none}
.responsive-app .vx-gallery-backdrop a:not([class*="vx-"]),.tv-layout .vx-gallery-backdrop a:not([class*="vx-"]){color:inherit;text-decoration:none}`;

const data = backdrops as { backdrops: Record<string, string>; figures: Record<string, string> };

/** The reference screen for `figure` ("<Sheet>:<caption>") with `children` mounted over it. */
export function Backdrop({ figure, children, region }: { figure: string; children: ReactNode; region?: CSSProperties }) {
  const root = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<Element | null>(null);
  const html = useMemo(() => (data.backdrops[data.figures[figure]] ?? "").replace(/\{\{A\}\}([\w.-]+)/g, (_, name: string) => refAsset(name)), [figure]);
  useLayoutEffect(() => setHost(root.current?.querySelector("[data-overlay-host]") ?? null), [html]);
  const overlay = region ? <div style={{ position: "absolute", ...region }}>{children}</div> : children;
  return (
    <>
      <style>{BASE}</style>
      <div ref={root} className="vx-gallery-backdrop" style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: html }} />
      {host ? createPortal(overlay, host) : null}
    </>
  );
}
