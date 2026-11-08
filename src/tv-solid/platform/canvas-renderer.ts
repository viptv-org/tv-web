import { RendererMain, type RendererMainSettings } from "@solidtv/renderer-canvas";
import { CanvasRenderer, CanvasTextRenderer } from "@solidtv/renderer-canvas/canvas";
import * as shaders from "@solidtv/renderer-canvas/canvas/shaders";
import { mapTextLayout, normalizeFontMetrics } from "../../../node_modules/@solidtv/renderer-canvas/dist/src/core/text-rendering/TextLayoutEngine.js";
import onest400 from "@fontsource/onest/files/onest-latin-400-normal.woff?url";
import onest500 from "@fontsource/onest/files/onest-latin-500-normal.woff?url";
import onest600 from "@fontsource/onest/files/onest-latin-600-normal.woff?url";
import onest700 from "@fontsource/onest/files/onest-latin-700-normal.woff?url";
import bricolage700 from "@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-700-normal.woff?url";
import bricolage800 from "@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff?url";
import { sdfFontMetrics } from "../fonts";
import { canvasTextWidth } from "../remote/text-measure";

type TextSpec = { text?: string; fontFamily?: string; fontSize?: number; letterSpacing?: number; lineHeight?: number; maxWidth?: number; maxHeight?: number; maxLines?: number; wordBreak?: string; overflowSuffix?: string; textAlign?: string };
const shaderTypes: Record<string, unknown> = {
  rounded: shaders.Rounded, shadow: shaders.Shadow,
  roundedWithBorder: shaders.RoundedWithBorder,
  roundedWithShadow: shaders.RoundedWithShadow,
  roundedWithBorderWithShadow: shaders.RoundedWithBorderAndShadow,
  holePunch: shaders.HolePunch, radialGradient: shaders.RadialGradient, linearGradient: shaders.LinearGradient,
};

export function createCanvasRenderer(settings: object, root: string | HTMLElement) {
  const renderer = new RendererMain({ ...settings, renderEngine: CanvasRenderer, fontEngines: [CanvasTextRenderer] } as Partial<RendererMainSettings>, root);
  const adapter = renderer as RendererMain & {
    registerShaderType(name: string, type: unknown): void;
    requestRender(): void;
    memoryInfo(): ReturnType<typeof renderer.stage.txMemManager.getMemoryInfo>;
    measureText(spec: TextSpec): { w: number; h: number };
  };
  adapter.registerShaderType = (name, type) => renderer.stage.shManager.registerShaderType(name, (shaderTypes[name] ?? type) as never);
  adapter.requestRender = () => renderer.stage.requestRender();
  adapter.memoryInfo = () => renderer.stage.txMemManager.getMemoryInfo();
  adapter.measureText = spec => {
    const family = spec.fontFamily ?? "Onest", size = spec.fontSize ?? 32;
    const measure = (text: string, _family: string, spacing: number) => canvasTextWidth(`${size}px ${family}`, text, spacing);
    const metrics = normalizeFontMetrics({ ...sdfFontMetrics(family), lineGap: 0 }, size);
    const layout = mapTextLayout(measure, metrics, spec.text ?? "", spec.textAlign ?? "left", family, spec.lineHeight ?? 1.2, spec.overflowSuffix ?? "…", spec.wordBreak ?? "break-word", spec.letterSpacing ?? 0, spec.maxLines ?? 0, spec.maxWidth ?? 0, spec.maxHeight ?? 0);
    return { w: layout[5], h: layout[6] };
  };
  return adapter;
}

export function loadCanvasFonts(renderer: unknown) {
  const stage = (renderer as RendererMain).stage;
  const optical = [17, 28, 32, 48, 50, 52, 55, 56, 80, 90, 92, 104].map(size => `Bricolage800Optical${size}`);
  const faces: [string[], string][] = [
    [["Onest"], onest400], [["Onest500"], onest500], [["Onest600"], onest600],
    [["Onest700", "Onest700Tabular"], onest700], [["Bricolage700"], bricolage700],
    [["Bricolage800", ...optical], bricolage800],
  ];
  return Promise.all(faces.map(([families, fontUrl]) => stage.loadFont("canvas", { fontFamily: families, fontUrl, metrics: { ...sdfFontMetrics(families[0]), lineGap: 0 } })));
}
