import { sdfTextMetrics } from "./text-measure";

export const bottomTitleY = (title: string, size: number, width: number, box: number) => {
  const measured = sdfTextMetrics(`${size}px Onest700`).measureText(title).width;
  const lines = Math.min(2, Math.max(1, Math.ceil(measured / width)));
  return box - lines * size * 1.2;
};
