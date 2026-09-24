import { tokens } from "../theme/viptv-tokens.generated";

type SearchAction = "space" | "delete" | "clear";
const cache = new Map<string, string>();

/** Cached textures for the TV keyboard's three wide action keys. */
export function searchKeyIcon(action: SearchAction, onLight = false) {
  const key = `${action}:${onLight}`;
  const known = cache.get(key);
  if (known) return known;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 28;
  const context = canvas.getContext("2d")!;
  context.scale(28 / 24, 28 / 24);
  context.strokeStyle = onLight ? tokens["color.on.light"] : tokens["color.text.primary"];
  context.lineWidth = 2;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  if (action === "space") {
    context.moveTo(2, 17); context.lineTo(2, 18); context.quadraticCurveTo(2, 19, 3, 19);
    context.lineTo(21, 19); context.quadraticCurveTo(22, 19, 22, 18); context.lineTo(22, 17);
  } else if (action === "delete") {
    context.moveTo(10, 5); context.lineTo(20, 5); context.quadraticCurveTo(22, 5, 22, 7);
    context.lineTo(22, 17); context.quadraticCurveTo(22, 19, 20, 19);
    context.lineTo(10, 19); context.quadraticCurveTo(9, 19, 8, 18);
    context.lineTo(2, 12); context.lineTo(8, 6); context.quadraticCurveTo(9, 5, 10, 5);
    context.moveTo(12, 9); context.lineTo(18, 15);
    context.moveTo(18, 9); context.lineTo(12, 15);
  } else {
    context.moveTo(3, 6); context.lineTo(21, 6);
    context.moveTo(5, 6); context.lineTo(5, 20); context.quadraticCurveTo(5, 22, 7, 22);
    context.lineTo(17, 22); context.quadraticCurveTo(19, 22, 19, 20); context.lineTo(19, 6);
    context.moveTo(8, 6); context.lineTo(8, 4); context.quadraticCurveTo(8, 2, 10, 2);
    context.lineTo(14, 2); context.quadraticCurveTo(16, 2, 16, 4); context.lineTo(16, 6);
    context.moveTo(10, 10); context.lineTo(10, 18);
    context.moveTo(14, 10); context.lineTo(14, 18);
  }
  context.stroke();
  const source = canvas.toDataURL("image/png");
  cache.set(key, source);
  return source;
}
