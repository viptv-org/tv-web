import { tokens } from "../theme/viptv-tokens.generated";

type Icon = "search" | "home" | "discover" | "live" | "list" | "settings";
const cache = new Map<string, string>();

/** Small, cached canvas textures for the collapsed TV rail's line icons. */
export function railIcon(icon: Icon, selected = false): string {
  const key = `${icon}:${selected}`;
  const known = cache.get(key);
  if (known) return known;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const context = canvas.getContext("2d")!;
  context.strokeStyle = selected ? tokens["color.text.primary"] : tokens["color.text.secondary"];
  context.lineWidth = 2.2;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  switch (icon) {
    case "search":
      context.arc(14, 14, 9, 0, Math.PI * 2);
      context.moveTo(21, 21); context.lineTo(29, 29);
      break;
    case "home":
      context.moveTo(4, 14); context.lineTo(16, 4); context.lineTo(28, 14);
      context.moveTo(7, 12); context.lineTo(7, 28); context.lineTo(25, 28); context.lineTo(25, 12);
      context.moveTo(13, 28); context.lineTo(13, 19); context.lineTo(19, 19); context.lineTo(19, 28);
      break;
    case "discover":
      context.arc(16, 16, 12, 0, Math.PI * 2);
      context.moveTo(20, 11); context.lineTo(18, 18); context.lineTo(11, 21); context.lineTo(14, 14); context.closePath();
      break;
    case "live":
      context.rect(4, 10, 24, 18);
      context.moveTo(12, 10); context.lineTo(8, 5);
      context.moveTo(20, 10); context.lineTo(24, 5);
      break;
    case "list":
      context.moveTo(7, 4); context.lineTo(25, 4); context.lineTo(25, 29);
      context.lineTo(16, 23); context.lineTo(7, 29); context.closePath();
      break;
    case "settings":
      context.arc(16, 16, 10, 0, Math.PI * 2);
      context.moveTo(16, 3); context.lineTo(16, 7);
      context.moveTo(16, 25); context.lineTo(16, 29);
      context.moveTo(3, 16); context.lineTo(7, 16);
      context.moveTo(25, 16); context.lineTo(29, 16);
      context.moveTo(7, 7); context.lineTo(10, 10);
      context.moveTo(22, 22); context.lineTo(25, 25);
      context.moveTo(25, 7); context.lineTo(22, 10);
      context.moveTo(10, 22); context.lineTo(7, 25);
      break;
  }
  context.stroke();
  if (icon === "settings") {
    context.beginPath(); context.arc(16, 16, 3, 0, Math.PI * 2); context.stroke();
  }
  const source = canvas.toDataURL("image/png");
  cache.set(key, source);
  return source;
}
