/** Native letter spacing preserves CSS kerning/shaping where the host supports
 * it. Older TV engines keep the renderer's existing spaced-text fallback. */
let canvas: HTMLCanvasElement | undefined;
let context: (CanvasRenderingContext2D & { letterSpacing: string }) | null | undefined;
export function nativeSpacedLine(props: {
  text: string; fontFamily: string; fontSize: number; letterSpacing: number;
  lineHeight: number; maxWidth: number; maxHeight: number;
}, normalLineHeight: boolean) {
  if (!props.letterSpacing || props.text.includes("\n")) return;
  if (!canvas) {
    canvas = document.createElement("canvas");
    const value = canvas.getContext("2d", { willReadFrequently: true });
    context = value && "letterSpacing" in value ? value as typeof context : null;
  }
  if (!context) return;
  const configure = () => {
    context!.font = `${props.fontSize}px ${props.fontFamily}`;
    context!.letterSpacing = `${props.letterSpacing}px`;
    context!.textBaseline = "alphabetic";
  };
  configure();
  const metrics = context.measureText(props.text);
  const width = metrics.width;
  if (!width || width > 4096 || (props.maxWidth && width > props.maxWidth)) return;
  const ascent = metrics.fontBoundingBoxAscent, descent = metrics.fontBoundingBoxDescent;
  if (!Number.isFinite(ascent) || !Number.isFinite(descent)) return;
  const height = normalLineHeight ? ascent + descent : props.lineHeight;
  if (!height || (props.maxHeight && height > props.maxHeight)) return;
  canvas.width = Math.ceil(width); canvas.height = Math.ceil(height);
  configure();
  context.fillStyle = "#FFFFFF";
  context.fillText(props.text, 0, (height - ascent - descent) / 2 + ascent);
  return { imageData: context.getImageData(0,0,canvas.width,canvas.height), width, height };
}
