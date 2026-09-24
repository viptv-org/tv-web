import { tokens } from "../theme/viptv-tokens.generated";

const cache = new Map<string, string>();

/** Canvas textures keep settings icons in the Lightning tree on TV browsers. */
export function settingsIcon(name: string, onLight = false, danger = false): string {
  const key = `${name}:${onLight}:${danger}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const c = canvas.getContext("2d")!;
  c.strokeStyle = onLight ? tokens["color.on.light"] : danger ? tokens["color.status.danger-tv"] : tokens["color.text.primary"];
  c.fillStyle = c.strokeStyle;
  c.lineWidth = 2.4; c.lineCap = "round"; c.lineJoin = "round";
  const circle = (x: number, y: number, radius: number) => { c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.stroke(); };
  c.beginPath();
  switch (name) {
    case "users":
      circle(12, 10, 4); circle(23, 12, 3);
      c.beginPath(); c.arc(12, 27, 8, Math.PI, 0); c.moveTo(23, 20); c.arc(23, 27, 6, Math.PI * 1.5, 0); c.stroke(); break;
    case "play":
      circle(16, 16, 12); c.beginPath(); c.moveTo(13, 9); c.lineTo(23, 16); c.lineTo(13, 23); c.closePath(); c.stroke(); break;
    case "user":
      circle(16, 9, 4); c.beginPath(); c.arc(16, 29, 10, Math.PI, 0); c.stroke(); break;
    case "info":
      circle(16, 16, 12); circle(16, 10, 0.7); c.beginPath(); c.moveTo(16, 15); c.lineTo(16, 23); c.stroke(); break;
    case "logout":
      c.moveTo(18, 5); c.lineTo(5, 5); c.lineTo(5, 27); c.lineTo(18, 27);
      c.moveTo(14, 16); c.lineTo(28, 16); c.moveTo(23, 11); c.lineTo(28, 16); c.lineTo(23, 21); c.stroke(); break;
    case "plus":
      c.moveTo(16, 5); c.lineTo(16, 27); c.moveTo(5, 16); c.lineTo(27, 16); c.stroke(); break;
    case "captions":
      c.rect(3, 7, 26, 18); c.stroke(); c.beginPath(); c.moveTo(8, 14); c.lineTo(13, 14); c.moveTo(19, 14); c.lineTo(24, 14); c.moveTo(8, 19); c.lineTo(13, 19); c.moveTo(19, 19); c.lineTo(24, 19); c.stroke(); break;
    case "languages":
      c.moveTo(5, 8); c.lineTo(23, 8); c.moveTo(14, 4); c.lineTo(14, 10);
      c.moveTo(8, 12); c.lineTo(18, 23); c.moveTo(20, 12); c.lineTo(9, 24);
      c.moveTo(21, 26); c.lineTo(26, 15); c.lineTo(30, 26); c.moveTo(23, 22); c.lineTo(28, 22); c.stroke(); break;
    case "type":
      c.moveTo(4, 6); c.lineTo(28, 6); c.moveTo(16, 6); c.lineTo(16, 27); c.moveTo(11, 27); c.lineTo(21, 27); c.stroke(); break;
    case "palette":
      c.arc(16, 16, 12, Math.PI * 0.1, Math.PI * 1.9); c.lineTo(22, 16); c.stroke();
      for (const [x, y] of [[10, 10], [17, 8], [24, 12], [9, 18]]) circle(x, y, 1); break;
    case "gauge":
      c.arc(16, 20, 12, Math.PI, Math.PI * 2); c.moveTo(16, 20); c.lineTo(23, 12); c.stroke(); break;
    case "puzzle":
      c.moveTo(7, 7); c.lineTo(13, 7); c.arc(16, 7, 3, Math.PI, 0); c.lineTo(25, 7); c.lineTo(25, 13);
      c.arc(25, 16, 3, Math.PI * 1.5, Math.PI * 0.5); c.lineTo(25, 25); c.lineTo(19, 25);
      c.arc(16, 25, 3, 0, Math.PI); c.lineTo(7, 25); c.lineTo(7, 19);
      c.arc(7, 16, 3, Math.PI * 0.5, Math.PI * 1.5); c.closePath(); c.stroke(); break;
    default: circle(16, 16, 10);
  }
  const data = canvas.toDataURL("image/png");
  cache.set(key, data);
  return data;
}
