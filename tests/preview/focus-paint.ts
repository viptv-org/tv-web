import type { Page } from '@playwright/test';

export async function temporalFocusPaint(page: Page, occupied: boolean) {
  if (occupied) await page.waitForFunction(() => {
    const exposed = (window as any).__viptvRenderer;
    return (exposed?.rawRenderer ?? exposed)?.stage.txManager.decodeGate != null;
  });
  return page.evaluate(async occupied => {
    const exposed = (window as any).__viptvRenderer;
    const renderer = exposed.rawRenderer ?? exposed;
    const canvasMode = document.documentElement.dataset.rendererBackend === 'canvas';
    const canvas = document.querySelector('#app canvas') as HTMLCanvasElement;
    const scale = canvas.width / 1920;
    const context = canvasMode ? canvas.getContext('2d')! : canvas.getContext('webgl')!;
    const pixels = (x: number, y: number, width: number, height: number) => {
      x = Math.round(x * scale); y = Math.round(y * scale);
      width = Math.max(1, Math.round(width * scale)); height = Math.max(1, Math.round(height * scale));
      if (canvasMode) return (context as CanvasRenderingContext2D).getImageData(x, y, width, height).data;
      const data = new Uint8Array(width * height * 4), gl = context as WebGLRenderingContext;
      gl.readPixels(x, canvas.height - y - height, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
      return data;
    };
    const frame = () => new Promise<void>(resolve => {
      renderer.once('frameTick', () => { void Promise.resolve().then(resolve); });
      renderer.requestRender();
    });
    const plate = renderer.createNode({ parent: renderer.root, x: 1480, y: 430, w: 400, h: 150, width: 400, height: 150, color: 0x111113ff, zIndex: 100000 });
    const label = renderer.createTextNode({ parent: plate, x: 24, y: 30, text: 'Focus', fontFamily: 'Onest700', fontSize: 48, maxWidth: 350, maxLines: 1, color: 0xffffffff, zIndex: 100001 });
    const samples: {phase: string; contrastPixels: number; background: number; pending: number}[] = [];
    let phase = '', active = false, maxChildren = 0, disposed = false;
    let badFramePng: string | undefined, lastFramePng: string | undefined;
    const capture = () => {
      if (!active) return;
      const background = pixels(1490, 440, 1, 1)[0];
      const data = pixels(1504, 460, 340, 78);
      let contrasting = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (background > 200 ? Math.max(data[i], data[i + 1], data[i + 2]) < 80
          : Math.min(data[i], data[i + 1], data[i + 2]) > 200) contrasting++;
      }
      maxChildren = Math.max(maxChildren, plate.children.length);
      samples.push({ phase, contrastPixels: contrasting / (scale * scale), background,
        pending: Number(!!label.pendingCanvas) });
      if (contrasting < 250 * scale * scale && !badFramePng) badFramePng = canvas.toDataURL('image/png');
      if (phase === 'reverse 7') lastFramePng = canvas.toDataURL('image/png');
    };
    const owner = canvasMode ? renderer.stage : renderer;
    const method = canvasMode ? 'drawFrame' : 'frame';
    const original = owner[method];
    owner[method] = function(this: any, ...args: any[]) {
      if (canvasMode) { const result = original.apply(this, args); capture(); return result; }
      let drawn = false;
      const backend = renderer.backend, draw = backend.draw;
      backend.draw = function(this: any, ...values: any[]) { drawn = true; return draw.apply(this, values); };
      try { return original.apply(this, args); }
      finally { backend.draw = draw; if (drawn) capture(); }
    };
    const release: (() => void)[] = [];
    try {
      let warmPixels = 0;
      for (let i = 0; i < 30; i++) {
        await frame();
        const data = pixels(1504, 460, 340, 78);
        let white = 0;
        for (let j = 0; j < data.length; j += 4) if (Math.min(data[j], data[j + 1], data[j + 2]) > 200) white++;
        warmPixels = white;
        if (white > 250 * scale * scale) break;
      }
      if (warmPixels <= 250 * scale * scale) throw Error('Probe glyphs did not reach the painted frame');
      if (occupied) {
        const gate = renderer.stage.txManager.decodeGate;
        for (let i = 0; i < renderer.stage.txManager.imageDecodeConcurrency; i++) {
          await gate.acquire(); release.push(() => gate.release());
        }
      }
      active = true;
      const change = async (focused: boolean, name: string, cold = false) => {
        phase = name;
        plate.color = focused ? 0xffffffff : 0x111113ff;
        label.color = focused ? 0x111113ff : 0xffffffff;
        if (cold) label.text = name;
        await frame(); await frame();
      };
      await change(true, 'cold focus', true);
      await change(false, 'warm blur');
      await change(true, 'warm focus');
      for (let i = 0; i < 8; i++) await change(i % 2 === 1, 'reverse ' + i, i % 3 === 0);
      const finalBackground = pixels(1490, 440, 1, 1)[0];
      active = false;
      label.color = 0xffffffff; label.text = 'retired text'; renderer.requestRender();
      label.destroy(); plate.destroy();
      disposed = true;
      await frame(); await frame();
      return { canvasMode, occupied, samples, finalBackground, maxChildren,
        pendingAfterDestroy: Number(!!label.pendingCanvas), remainingChildren: plate.children.length,
        pendingLoads: canvasMode ? renderer.stage.txManager.pendingLoads : 0,
        badFramePng, lastFramePng };
    } finally {
      active = false; owner[method] = original;
      release.forEach(work => work());
      if (!disposed) { label.destroy(); plate.destroy(); }
    }
  }, occupied);
}
