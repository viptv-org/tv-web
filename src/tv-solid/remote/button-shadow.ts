/** Reference 0 18px 50px rgba(0,0,0,.45), cached by static button geometry. */
const masks = new Map<string, ImageData>();
export function buttonShadow(width: number, height: number, radius: number) {
  const key = `${width}:${height}:${radius}`;
  const cached = masks.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil((width + 200) / 2);
  canvas.height = Math.ceil((height + 200) / 2);
  const ctx = canvas.getContext("2d")!;
  const x = 50,
    y = 50,
    w = width / 2,
    h = height / 2,
    r = radius / 2;
  ctx.shadowColor = "rgba(0,0,0,.45)";
  ctx.shadowBlur = 25;
  ctx.shadowOffsetY = 9;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.fill();
  const result = ctx.getImageData(0, 0, canvas.width, canvas.height);
  masks.set(key, result);
  return result;
}
