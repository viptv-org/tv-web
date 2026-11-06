import onest400Atlas from "./sdf/Onest400.ssdf.png?url";
import onest400Data from "./sdf/Onest400.ssdf.json?url";
import onest500Atlas from "./sdf/Onest500.ssdf.png?url";
import onest500Data from "./sdf/Onest500.ssdf.json?url";
import onest600Atlas from "./sdf/Onest600.ssdf.png?url";
import onest600Data from "./sdf/Onest600.ssdf.json?url";
import onest700Atlas from "./sdf/Onest700.ssdf.png?url";
import onest700Data from "./sdf/Onest700.ssdf.json?url";
import onest700TabularAtlas from "./sdf/Onest700Tabular.ssdf.png?url";
import onest700TabularData from "./sdf/Onest700Tabular.ssdf.json?url";
import bricolage700Atlas from "./sdf/Bricolage700.ssdf.png?url";
import bricolage700Data from "./sdf/Bricolage700.ssdf.json?url";
import bricolage800Atlas from "./sdf/Bricolage800.ssdf.png?url";
import bricolage800Data from "./sdf/Bricolage800.ssdf.json?url";
import bricolage800Optical28Atlas from "./sdf/Bricolage800Optical28.ssdf.png?url";
import bricolage800Optical28Data from "./sdf/Bricolage800Optical28.ssdf.json?url";
import bricolage800Optical56Atlas from "./sdf/Bricolage800Optical56.ssdf.png?url";
import bricolage800Optical56Data from "./sdf/Bricolage800Optical56.ssdf.json?url";
import bricolage800Optical90Atlas from "./sdf/Bricolage800Optical90.ssdf.png?url";
import bricolage800Optical90Data from "./sdf/Bricolage800Optical90.ssdf.json?url";

/** One SDF face: the atlas image and its BMFont description. */
export type SdfFontFace = {
  fontFamily: string;
  aliases?: string[];
  type: "ssdf" | "msdf";
  atlasUrl: string;
  atlasDataUrl: string;
};

/**
 * Every face the TV entry can name, generated from the same WOFF2 faces the
 * DOM uses (`solid-tv/msdf-generator`, 42px UI text / 48px display text, one
 * page each). The renderer 2.x loads one atlas per face, so the generator is
 * run with a texture size that keeps all 325 characters on one page.
 *
 * Bricolage's optical-size axis is applied through three instances and the
 * size aliases the app asks for, instead of a distinct atlas per size: the
 * SDF atlas scales the one instance to every size in its band.
 */
export const sdfFonts: SdfFontFace[] = [
  { fontFamily: "Onest", type: "ssdf", atlasUrl: onest400Atlas, atlasDataUrl: onest400Data },
  { fontFamily: "Onest500", type: "ssdf", atlasUrl: onest500Atlas, atlasDataUrl: onest500Data },
  { fontFamily: "Onest600", type: "ssdf", atlasUrl: onest600Atlas, atlasDataUrl: onest600Data },
  { fontFamily: "Onest700", type: "ssdf", atlasUrl: onest700Atlas, atlasDataUrl: onest700Data },
  { fontFamily: "Onest700Tabular", type: "ssdf", atlasUrl: onest700TabularAtlas, atlasDataUrl: onest700TabularData },
  { fontFamily: "Bricolage700", type: "ssdf", atlasUrl: bricolage700Atlas, atlasDataUrl: bricolage700Data },
  {
    fontFamily: "Bricolage800",
    type: "ssdf",
    atlasUrl: bricolage800Atlas,
    atlasDataUrl: bricolage800Data,
  },
  {
    fontFamily: "Bricolage800Optical28",
    aliases: ["Bricolage800Optical17", "Bricolage800Optical32"],
    type: "ssdf",
    atlasUrl: bricolage800Optical28Atlas,
    atlasDataUrl: bricolage800Optical28Data,
  },
  {
    fontFamily: "Bricolage800Optical56",
    aliases: ["Bricolage800Optical48", "Bricolage800Optical50", "Bricolage800Optical52", "Bricolage800Optical55"],
    type: "ssdf",
    atlasUrl: bricolage800Optical56Atlas,
    atlasDataUrl: bricolage800Optical56Data,
  },
  {
    fontFamily: "Bricolage800Optical90",
    aliases: ["Bricolage800Optical80", "Bricolage800Optical92", "Bricolage800Optical104"],
    type: "ssdf",
    atlasUrl: bricolage800Optical90Atlas,
    atlasDataUrl: bricolage800Optical90Data,
  },
];

/** The optical sizes the entry has always named on the display face. */
const Bricolage800OpticalSizes = new Set([17, 28, 32, 48, 50, 52, 55, 56, 80, 90, 92, 104]);

const ONEST = { ascender: 970, descender: -305, unitsPerEm: 1000 };
const BRICOLAGE = { ascender: 930, descender: -270, unitsPerEm: 1000 };

export function sdfFontMetrics(family: string) {
  return String(family || "").startsWith("Onest") ? ONEST : BRICOLAGE;
}

/**
 * The SDF family a design family and size resolve to. The DOM applies optical
 * sizing with `font-variation-settings`, which an atlas cannot vary per size;
 * the display face is split into three instances and each size band maps to
 * the nearest one.
 */
export function sdfFontFamily(family: string, size: number): string {
  if (family === "Bricolage650") family = "Bricolage700";
  if (family !== "Bricolage800") return family;
  // The entry registered these twelve optical sizes on 1.9.4; keep the same
  // family names and map each to the nearest of the three atlas instances.
  // Any other size uses the base face.
  return Bricolage800OpticalSizes.has(size)
    ? `Bricolage800Optical${size}`
    : "Bricolage800";
}

/** The default line height the design uses: ascender + descender at `size`. */
export function sdfLineHeight(family: string, size: number): number {
  const metrics = sdfFontMetrics(family);
  return (
    Math.round((metrics.ascender * size) / metrics.unitsPerEm) +
    Math.round((-metrics.descender * size) / metrics.unitsPerEm)
  );
}
