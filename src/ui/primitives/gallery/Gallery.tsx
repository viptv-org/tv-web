/*
 * DEV-only component gallery: ?gallery=phone|desktop|tv[&sheet=CmpPhone1].
 * Rebuilds each reference component sheet's frame (header, sections, rows,
 * figure stages and captions, from sheets.json) at 1:1 and fills each stage with
 * the real vx- primitives registered in figures-*.tsx, so a screenshot can be
 * compared region by region with reference/components/<Sheet>.webp.
 *
 * The frame's inline styles are reference data (the sheet's own markup), not
 * app styling; only the stage contents use the design-system primitives.
 */
import type { CSSProperties } from "react";
import type { Root } from "react-dom/client";
import sheets from "./sheets.json";
import { figures, type SheetName } from "./registry";
import "./figures-a";
import "./figures-b";

type Figure = { caption: string; fig: string; stage: string };
type Sheet = {
  width: number;
  height: number;
  title: string;
  subtitle: string;
  frame: Record<string, string>;
  sections: { title: string; desc: string; rows: { style: string; figures: Figure[] }[] }[];
};
const data = sheets as unknown as Record<SheetName, Sheet>;

/** "a: b; c-d: e" → React style object. */
export function css(text: string): CSSProperties {
  const style: Record<string, string> = {};
  for (const part of text.split(";")) {
    const index = part.indexOf(":");
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!name) continue;
    const key = name.startsWith("--") ? name : name.replace(/^-(webkit|moz|ms)-/, (_, p: string) => `${p[0].toUpperCase()}${p.slice(1)}-`).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    style[key] = value;
  }
  return style as CSSProperties;
}

const platforms = { phone: "CmpPhone", desktop: "CmpDesk", tv: "CmpTv" } as const;

function SheetView({ name }: { name: SheetName }) {
  const sheet = data[name];
  const { frame } = sheet;
  return (
    <div
      className="vx-gallery-sheet"
      data-sheet={name}
      style={{ width: sheet.width, height: sheet.height, position: "relative", overflow: "hidden", background: "var(--viptv-color-bg)", color: "var(--viptv-color-text-primary)", fontFamily: "var(--viptv-font-family-ui)" }}
    >
      <div style={css(frame.inner)}>
        <header style={css(frame.header)}>
          <h1 style={css(frame.h1)}>{sheet.title}</h1>
          <p style={css(frame.sub)}>{sheet.subtitle}</p>
        </header>
        <div style={css(frame.sections)}>
          {sheet.sections.map((section) => (
            <section key={section.title} style={css(frame.section)}>
              <div>
                <h2 style={css(frame.h2)}>{section.title}</h2>
                {section.desc ? <p style={css(frame.desc)}>{section.desc}</p> : null}
              </div>
              <div style={css(frame.rows)}>
                {section.rows.map((row, rowIndex) => (
                  <div key={rowIndex} className="vx-gallery-row" style={css(row.style)}>
                    {row.figures.map((figure) => {
                      const render = figures.get(`${name}:${figure.caption}`);
                      return (
                        <figure key={figure.caption} style={css(figure.fig)} data-caption={figure.caption} data-missing={render ? undefined : ""}>
                          <div style={css(figure.stage)}>{render ? render() : null}</div>
                          <figcaption style={css(frame.caption)}>{figure.caption}</figcaption>
                        </figure>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function Gallery({ platform, only }: { platform: keyof typeof platforms; only: SheetName | null }) {
  const names = (Object.keys(data) as SheetName[]).filter((name) => (only ? name === only : name.startsWith(platforms[platform])));
  const content = names.map((name) => <SheetView key={name} name={name} />);
  // TV primitives are scoped under .tv-layout (the TV canvas class); responsive ones
  // under [data-layout="responsive"] with .responsive-app so legacy rules also apply.
  return platform === "tv" ? <div className="tv-layout vx-gallery">{content}</div> : <div className="responsive-app vx-gallery">{content}</div>;
}

export function mountGallery(root: Root, params: URLSearchParams) {
  const requested = params.get("gallery");
  const platform: keyof typeof platforms = requested === "tv" || requested === "phone" ? requested : "desktop";
  const sheet = params.get("sheet") as SheetName | null;
  const html = document.documentElement;
  html.setAttribute("data-layout", platform === "tv" ? "tv" : "responsive");
  html.setAttribute("data-platform", platform === "tv" ? "tizen" : "html5");
  // Legacy tv-p1 locks html/body scrolling for the fixed TV canvas; the gallery scrolls
  // (visible on both, so the viewport scrolls rather than a 390-wide body box).
  html.style.overflow = "visible";
  document.body.style.overflow = "visible";
  document.title = `Gallery · ${sheet ?? platform}`;
  root.render(<Gallery platform={platform} only={sheet && sheet in data ? sheet : null} />);
}
