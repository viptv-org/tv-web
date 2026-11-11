import { expect, test } from "@playwright/test";
import { installRemoteBackend } from "../preview/remote-backend";

for (const phase of ["before construction", "during font upload"] as const) {
  test(`startup recovers from actual WebGL context loss ${phase}`, async ({ page, baseURL }) => {
    await page.addInitScript(
      ({ phase }) => {
        const original = HTMLCanvasElement.prototype.getContext;
        let triggered = false;
        (window as any).__originalBitmapApi = window.createImageBitmap;
        HTMLCanvasElement.prototype.getContext = function (
          this: HTMLCanvasElement,
          name: string,
          ...args: any[]
        ) {
          const context = original.apply(this, [
            name,
            ...args,
          ] as any) as WebGLRenderingContext | null;
          if (!triggered && context && (name === "webgl" || name === "experimental-webgl")) {
            const lose = () => {
              if (triggered) return;
              triggered = true;
              context.getExtension("WEBGL_lose_context")!.loseContext();
            };
            if (phase === "before construction") queueMicrotask(lose);
            else {
              const upload = context.texImage2D;
              context.texImage2D = function (this: WebGLRenderingContext, ...values: any[]) {
                const result = upload.apply(this, values as any);
                const source = values[values.length - 1];
                if (source && typeof source === "object" && source.width >= 512)
                  queueMicrotask(lose);
                return result;
              } as typeof context.texImage2D;
            }
          }
          return context;
        } as typeof original;
      },
      { phase },
    );
    await installRemoteBackend(page, baseURL!);
    await page.goto("/tv/?focusdebug=1");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-tv-startup", "ready");
    await expect(html).toHaveAttribute("data-tv-ready", "true");
    await expect(html).toHaveAttribute("data-renderer-backend", "canvas");
    await expect(page.locator("#app canvas")).toHaveCount(1);
    expect(
      await page.evaluate(() => window.createImageBitmap === (window as any).__originalBitmapApi),
    ).toBe(true);
    await expect
      .poll(() =>
        page.locator("#app canvas").evaluate((element) => {
          const canvas = element as HTMLCanvasElement;
          const pixels = canvas
            .getContext("2d")!
            .getImageData(0, 0, canvas.width, canvas.height).data;
          let painted = 0;
          for (let i = 0; i < pixels.length; i += 4)
            if (pixels[i] > 60 || pixels[i + 1] > 60 || pixels[i + 2] > 60) painted++;
          return painted;
        }),
      )
      .toBeGreaterThan(10000);
  });
}
