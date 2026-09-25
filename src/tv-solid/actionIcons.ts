import { tokens } from "../theme/viptv-tokens.generated";

type ActionIcon = "play" | "pause" | "plus" | "check" | "info" | "settings" | "back10" | "forward30" | "next" | "audio" | "captions" | "exit";
const names = new Set<ActionIcon>(["play", "pause", "plus", "check", "info", "settings", "back10", "forward30", "next", "audio", "captions", "exit"]);
const cache = new Map<string, string>();

/** Cached, antialiased canvas textures for SolidTV's image loader. */
export function actionIcon(name: ActionIcon, onLight = false): string {
  const key = `${name}:${onLight}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 96;
  const c = canvas.getContext("2d")!;
  c.scale(4, 4);
  c.strokeStyle = onLight ? tokens["color.on.light"] : tokens["color.text.primary"];
  c.fillStyle = c.strokeStyle;
  c.lineWidth = 1.9;
  c.lineCap = "round";
  c.lineJoin = "round";
  const line = (...points: number[]) => {
    c.beginPath();
    c.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
    c.stroke();
  };
  const circle = (x: number, y: number, r: number) => {
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
  };
  switch (name) {
    case "play":
      c.beginPath(); c.moveTo(7, 4); c.lineTo(20, 12); c.lineTo(7, 20); c.closePath(); c.fill();
      break;
    case "pause":
      c.fillRect(6, 4, 4, 16); c.fillRect(14, 4, 4, 16);
      break;
    case "plus": line(12, 4, 12, 20); line(4, 12, 20, 12); break;
    case "check": line(4, 12, 9, 17, 20, 6); break;
    case "info":
      circle(12, 12, 9); circle(12, 7.5, .5); line(12, 11, 12, 16);
      break;
    case "settings":
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        line(12 + Math.cos(a) * 8, 12 + Math.sin(a) * 8, 12 + Math.cos(a) * 10, 12 + Math.sin(a) * 10);
      }
      circle(12, 12, 7); circle(12, 12, 2.5);
      break;
    case "back10":
    case "forward30": {
      for (const x of [3, 11]) {
        c.beginPath();
        if (name === "back10") { c.moveTo(x + 8, 4); c.lineTo(x, 12); c.lineTo(x + 8, 20); }
        else { c.moveTo(x, 4); c.lineTo(x + 8, 12); c.lineTo(x, 20); }
        c.closePath(); c.stroke();
      }
      break;
    }
    case "next":
      c.beginPath(); c.moveTo(4, 4); c.lineTo(16, 12); c.lineTo(4, 20); c.closePath(); c.stroke();
      line(20, 4, 20, 20);
      break;
    case "audio":
      for (const [x, y] of [[3, 9], [7, 6], [11, 3], [15, 7], [19, 5]]) line(x, y, x, 24 - y);
      break;
    case "captions":
      c.beginPath(); c.moveTo(4, 5); c.lineTo(20, 5); c.quadraticCurveTo(22, 5, 22, 7); c.lineTo(22, 17); c.quadraticCurveTo(22, 19, 20, 19); c.lineTo(4, 19); c.quadraticCurveTo(2, 19, 2, 17); c.lineTo(2, 7); c.quadraticCurveTo(2, 5, 4, 5); c.stroke();
      line(6, 11, 11, 11); line(6, 15, 11, 15); line(15, 11, 18, 11); line(15, 15, 18, 15);
      break;
    case "exit":
      line(10, 3, 5, 3, 3, 5, 3, 19, 5, 21, 10, 21);
      line(13, 7, 18, 12, 13, 17); line(18, 12, 8, 12);
  }
  const source = canvas.toDataURL("image/png");
  cache.set(key, source);
  return source;
}

export function actionIconFor(name: string, onLight = false): string {
  return names.has(name as ActionIcon) ? actionIcon(name as ActionIcon, onLight) : "";
}
