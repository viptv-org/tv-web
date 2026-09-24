import { tokens } from "../theme/viptv-tokens.generated";
import type { TitleMenuAction } from "./titleMenuModel";

const cache = new Map<string, string>();

/** Cached 28 px line-icon textures for the TV action menu. */
export function menuIcon(action: TitleMenuAction, onLight = false): string {
  if (action === "cancel" || action === "done") return "";
  const key = `${action}:${onLight}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 28;
  const context = canvas.getContext("2d")!;
  context.scale(28 / 24, 28 / 24);
  context.strokeStyle = onLight ? tokens["color.on.light"] : tokens["color.text.primary"];
  context.lineWidth = 2;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  switch (action) {
    case "previous":
      context.moveTo(19, 4); context.lineTo(9, 12); context.lineTo(19, 20); context.closePath();
      context.moveTo(5, 5); context.lineTo(5, 19);
      break;
    case "source":
      for (const y of [6, 12, 18]) {
        context.moveTo(3, y); context.lineTo(3.1, y);
        context.moveTo(8, y); context.lineTo(21, y);
      }
      break;
    case "watched":
      context.arc(12, 12, 10, 0, Math.PI * 2);
      context.moveTo(9, 12); context.lineTo(11, 14); context.lineTo(15, 10);
      break;
    case "restart": case "undo":
      context.arc(12, 12, 9, -2.45, Math.PI * 1.45, false);
      context.moveTo(3, 3); context.lineTo(3, 8); context.lineTo(8, 8);
      break;
    case "hide":
      context.ellipse(12, 12, 10, 6, 0, 0, Math.PI * 2);
      context.moveTo(2, 2); context.lineTo(22, 22);
      break;
    case "favorite":
      context.moveTo(7, 3); context.lineTo(17, 3); context.quadraticCurveTo(19, 3, 19, 5);
      context.lineTo(19, 21); context.lineTo(12, 17); context.lineTo(5, 21);
      context.lineTo(5, 5); context.quadraticCurveTo(5, 3, 7, 3);
      context.moveTo(12, 7); context.lineTo(12, 13);
      context.moveTo(9, 10); context.lineTo(15, 10);
      break;
  }
  context.stroke();
  const source = canvas.toDataURL("image/png");
  cache.set(key, source);
  return source;
}
