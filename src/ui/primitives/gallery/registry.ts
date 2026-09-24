/*
 * DEV-only component gallery registry. Each figures-*.tsx module registers the
 * stage content of reference-sheet figures, keyed "<Sheet>:<caption>" exactly as
 * the caption reads in sheets.json (e.g. "CmpPhone1:Primary · default").
 *
 * Forced states for the screenshot script (scripts/gallery.mjs): put
 * data-force="hover|active|focus|focus-visible|focus-within" (space-separated)
 * on an element and the script forces those pseudo-classes through CDP, so the
 * real :hover / :active / :focus CSS is what gets drawn.
 */
import type { ReactNode } from "react";

export type SheetName =
  | "CmpPhone1" | "CmpPhone2" | "CmpPhone3"
  | "CmpDesk1" | "CmpDesk2" | "CmpDesk3"
  | "CmpTv1" | "CmpTv2" | "CmpTv3";

export type FigureRender = () => ReactNode;

export const figures = new Map<string, FigureRender>();

export function register(sheet: SheetName, entries: Record<string, FigureRender>) {
  for (const [caption, render] of Object.entries(entries)) figures.set(`${sheet}:${caption}`, render);
}
