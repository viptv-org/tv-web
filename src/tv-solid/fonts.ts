import displayUrl from "@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2?url";

// The DOM uses optical sizing at the CSS font size. CanvasTextRenderer loads
// faces without weight descriptors, so register aliases with explicit axes.
const variable = typeof FontFace !== "undefined" && "variationSettings" in FontFace.prototype;
const sizes: Record<number, readonly number[]> = {
  650: [32],
  700: [30, 32, 38, 42, 44, 48, 52, 56, 64],
  800: [17, 28, 32, 36, 40, 48, 50, 52, 55, 56, 64, 80, 90, 92, 104],
};
const axes = new Map<string, string>();
// hhea/OS/2 metrics from the shipped Onest and Bricolage WOFF2 faces.
export function canvasFontMetrics(family: string) {
  return family.startsWith("Onest")
    ? { ascender: 970, descender: -305, lineGap: 0, unitsPerEm: 1000 }
    : { ascender: 930, descender: -270, lineGap: 0, unitsPerEm: 1000 };
}
export const displayFonts = variable ? Object.entries(sizes).flatMap(([weight, sizes]) => sizes.map(size => {
  const fontFamily = `Bricolage${weight}Optical${size}`;
  axes.set(fontFamily, `"wght" ${weight}, "opsz" ${size}`);
  return {fontFamily, fontUrl:displayUrl};
})) : [];

export function configureDisplayFonts() {
  for (const face of document.fonts) {
    if(face.family.replace(/["']/g, "") === "Onest700Tabular") face.featureSettings='"tnum"';
    const settings = axes.get(face.family.replace(/["']/g, ""));
    if (settings) (face as FontFace & {variationSettings:string}).variationSettings = settings;
  }
}

export function canvasFont(family: string, size: number) {
  const alias = `${family}Optical${size}`;
  return axes.has(alias) ? alias : family === "Bricolage650" ? "Bricolage700" : family;
}
