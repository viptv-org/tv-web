export interface LiveSearchKeyView {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  action: "character" | "case" | "space" | "delete" | "done" | "cancel";
}

const characters = "abcdefghijklmnopqrstuvwxyz1234567890:/.-_@";

export const liveSearchKeys: LiveSearchKeyView[] = [
  ...Array.from(characters, (label, index) => ({
    id: `character-${index}`,
    label,
    x: 1184 + (index % 6) * 108,
    y: 96 + Math.floor(index / 6) * 74,
    width: 98,
    action: "character" as const,
  })),
  { id: "case", label: "Aa", x: 1184, y: 614, width: 98, action: "case" },
  { id: "space", label: "▁", x: 1292, y: 614, width: 314, action: "space" },
  { id: "delete", label: "⌫", x: 1616, y: 614, width: 208, action: "delete" },
  { id: "done", label: "Done", x: 1184, y: 692, width: 312, action: "done" },
  {
    id: "cancel",
    label: "Cancel",
    x: 1512,
    y: 692,
    width: 312,
    action: "cancel",
  },
];
