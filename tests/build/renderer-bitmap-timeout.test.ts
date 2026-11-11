import { afterEach, describe, expect, test, vi } from 'vitest';
import * as sourceProbe from '../../node_modules/@solidtv/renderer/src/core/textures/probes';
import * as sourceDecoder from '../../node_modules/@solidtv/renderer/src/core/textures/ImageWorker';
import * as sourceSvg from '../../node_modules/@solidtv/renderer/src/core/textures/svg';
import * as distSvg from '../../node_modules/@solidtv/renderer/dist/src/core/textures/svg';
import * as sourceImages from '../../node_modules/@solidtv/renderer/src/core/textures/sources';
import * as distProbe from '../../node_modules/@solidtv/renderer/dist/src/core/textures/probes';
import * as distDecoder from '../../node_modules/@solidtv/renderer/dist/src/core/textures/ImageWorker';
import * as distImages from '../../node_modules/@solidtv/renderer/dist/src/core/textures/sources';

const bitmap = () => ({ width: 1, height: 1, close: vi.fn() });
const pending = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

for (const [name, probe, decoder, images, svg] of [
  ['source', sourceProbe, sourceDecoder, sourceImages, sourceSvg],
  ['dist', distProbe, distDecoder, distImages, distSvg],
] as const)
  describe(name, () => {
    test('healthy capability forms close their probes and leave no decode timers', async () => {
      vi.useFakeTimers();
      const bitmaps = [bitmap(), bitmap(), bitmap()];
      const createImageBitmap = vi.fn();
      bitmaps.forEach((b) => createImageBitmap.mockResolvedValueOnce(b));
      const result = await probe.validateCreateImageBitmap({
        createImageBitmap,
      } as any);
      expect(result).toMatchObject({ basic: true, options: true, full: true });
      expect(createImageBitmap.mock.calls.map((c) => c.length)).toEqual([
        1, 2, 6,
      ]);
      bitmaps.forEach((b) => expect(b.close).toHaveBeenCalledTimes(1));
      expect(vi.getTimerCount()).toBe(0);
    });

    test('a pending basic probe rejects within its deadline and closes a late bitmap', async () => {
      vi.useFakeTimers();
      const native = pending<any>();
      const result = probe.validateCreateImageBitmap({
        createImageBitmap: () => native.promise,
      } as any);
      const failed = expect(result).rejects.toThrow('decoding timed out');
      await vi.advanceTimersByTimeAsync(2000);
      await failed;
      const late = bitmap();
      native.resolve(late);
      await Promise.resolve();
      await Promise.resolve();
      expect(late.close).toHaveBeenCalledTimes(1);
    });

    test('stalled option/crop probes settle and a stalled premultiply probe stays unknown', async () => {
      vi.useFakeTimers();
      const createImageBitmap = vi
        .fn()
        .mockResolvedValueOnce(bitmap())
        .mockImplementation(() => new Promise(() => {}));
      const result = probe.validateCreateImageBitmap({
        createImageBitmap,
      } as any);
      await vi.advanceTimersByTimeAsync(4000);
      expect(await result).toMatchObject({
        basic: true,
        options: false,
        full: false,
      });
      const alpha = probe.detectPremultiplyAlphaHonored({
        createImageBitmap,
      } as any);
      await vi.advanceTimersByTimeAsync(2000);
      expect(await alpha).toBe(null);
    });

    test('decoder preserves alpha/crop and transfers ownership only before its deadline', async () => {
      vi.useFakeTimers();
      const b = bitmap();
      const receiver = {};
      const create = vi.fn().mockResolvedValue(b);
      const result = await decoder.decodeImageBlob(
        create as any,
        receiver,
        new Blob(),
        true,
        2,
        3,
        4,
        5,
        true,
        true,
        false,
      );
      expect(create.mock.instances[0]).toBe(receiver);
      expect(create.mock.calls[0].slice(1, 5)).toEqual([2, 3, 4, 5]);
      expect(create.mock.calls[0][5]).toMatchObject({
        premultiplyAlpha: 'none',
      });
      expect(result).toEqual({ data: b, premultiplyAlpha: true });
      expect(b.close).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    test('native throws and late rejections are handled without leaked timers', async () => {
      vi.useFakeTimers();
      const decode = (create: any) =>
        decoder.decodeImageBlob(
          create,
          null,
          new Blob(),
          false,
          null,
          null,
          null,
          null,
          false,
          false,
          null,
        );
      await expect(
        decode(() => {
          throw Error('unsupported');
        }),
      ).rejects.toThrow('unsupported');
      expect(vi.getTimerCount()).toBe(0);
      const native = pending<any>();
      const result = decode(() => native.promise);
      const failed = expect(result).rejects.toThrow('decoding timed out');
      await vi.advanceTimersByTimeAsync(2000);
      await failed;
      native.reject(Error('late failure'));
      await Promise.resolve();
      expect(vi.getTimerCount()).toBe(0);
    });

    test('a stalled blob decoder falls back to an image element and revokes its object URL', async () => {
      vi.useFakeTimers();
      const native = pending<any>();
      const revokeObjectURL = vi.fn();
      vi.stubGlobal('URL', {
        createObjectURL: () => 'blob:test',
        revokeObjectURL,
      });
      const img: any = { width: 12, height: 15, onload: null, onerror: null };
      Object.defineProperty(img, 'src', {
        set() {
          Promise.resolve().then(() => img.onload?.());
        },
      });
      const platform = {
        createImageBitmap: () => native.promise,
        createImage: () => img,
        setTimeout,
      };
      const result = images.loadImage(
        {
          platform,
          support: { basic: true, options: false, full: false },
          worker: null,
          pixelRatio: 1,
        } as any,
        { src: new Blob(), premultiplyAlpha: true } as any,
      );
      await vi.advanceTimersByTimeAsync(2000);
      expect(await result).toEqual({
        data: img,
        w: 12,
        h: 15,
        premultiply: true,
      });
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
      const late = bitmap();
      native.resolve(late);
      await Promise.resolve();
      expect(late.close).toHaveBeenCalledTimes(1);
    });

    test('local image fallback also has a deadline and releases its object URL', async () => {
      vi.useFakeTimers();
      const revokeObjectURL = vi.fn();
      vi.stubGlobal('URL', {
        createObjectURL: () => 'blob:test',
        revokeObjectURL,
      });
      const img: any = { src: '', onload: null, onerror: null };
      const result = images.loadImage(
        {
          platform: { createImage: () => img, setTimeout },
          support: null,
          worker: null,
          pixelRatio: 1,
        } as any,
        { src: new Blob() } as any,
      );
      const failed = expect(result).rejects.toThrow('Image loading timed out');
      await vi.advanceTimersByTimeAsync(30000);
      await failed;
      expect(img.src).toBe('');
      expect(img.onload).toBe(null);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
    });

    test('worker decode timeouts preserve their type and use the image-element fallback directly', async () => {
      vi.useFakeTimers();
      const worker: any = { postMessage: vi.fn(), terminate: vi.fn() };
      const img: any = { width: 4, height: 5, onload: null, onerror: null };
      Object.defineProperty(img, 'src', {
        set() {
          Promise.resolve().then(() => img.onload?.());
        },
      });
      const createImageBitmap = vi.fn();
      const platform: any = {
        createWorker: () => worker,
        createImage: () => img,
        createImageBitmap,
        setTimeout,
      };
      const support = {
        basic: true,
        options: false,
        full: false,
        premultiplyHonored: null,
      };
      const manager = new decoder.ImageWorkerManager(platform, support);
      const result = images.loadImage(
        { platform, support, worker: manager, pixelRatio: 1 } as any,
        { src: 'poster.png' },
      );
      const request = worker.postMessage.mock.calls[1][0];
      worker.onmessage({
        data: {
          id: request.id,
          error: 'Image bitmap decoding timed out',
          errorName: 'ImageBitmapTimeoutError',
        },
      });
      expect(await result).toEqual({
        data: img,
        w: 4,
        h: 5,
        premultiply: true,
      });
      expect(createImageBitmap).not.toHaveBeenCalled();
      expect(manager.inFlight).toBe(0);
      manager.destroy();
    });

    test('a stalled SVG bitmap conversion falls back to pixels and closes its late bitmap', async () => {
      vi.useFakeTimers();
      const native = pending<any>();
      const img: any = {
        naturalWidth: 2,
        naturalHeight: 3,
        onload: null,
        onerror: null,
      };
      Object.defineProperty(img, 'src', {
        set() {
          Promise.resolve().then(() => img.onload?.());
        },
      });
      const data = { width: 2, height: 3 };
      const drawImage = vi.fn();
      const canvas: any = {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage, getImageData: () => data }),
      };
      const platform = {
        createImage: () => img,
        createCanvas: () => canvas,
        createImageBitmap: () => native.promise,
        setTimeout,
      };
      const result = svg.loadSvg(
        { platform, support: {}, pixelRatio: 1 } as any,
        'data:image/svg+xml,test',
        null,
        null,
        null,
        null,
        null,
        null,
      );
      await vi.advanceTimersByTimeAsync(2000);
      expect(await result).toEqual({ data, w: 2, h: 3, premultiply: true });
      expect(drawImage).toHaveBeenCalledTimes(1);
      expect(canvas.width).toBe(0);
      expect(canvas.height).toBe(0);
      const late = bitmap();
      native.resolve(late);
      await Promise.resolve();
      expect(late.close).toHaveBeenCalledTimes(1);
    });

    test('a stalled local SVG load also releases its image after the deadline', async () => {
      vi.useFakeTimers();
      const img: any = { src: '', onload: null, onerror: null };
      const result = svg.loadSvg(
        {
          platform: { createImage: () => img, setTimeout },
          support: null,
          pixelRatio: 1,
        } as any,
        'data:image/svg+xml,test',
        null,
        null,
        null,
        null,
        null,
        null,
      );
      const failed = expect(result).rejects.toThrow('SVG loading timed out');
      await vi.advanceTimersByTimeAsync(30000);
      await failed;
      expect(img.src).toBe('');
      expect(img.onload).toBe(null);
    });

    test('serialized worker decoder runs without an imported helper', async () => {
      vi.useFakeTimers();
      const posts: any[] = [];
      const native = pending<any>();
      const scope: any = { postMessage: (message: any) => posts.push(message) };
      class Xhr {
        status = 200;
        response = new Blob();
        onload: any;
        open() {}
        send() {
          this.onload();
        }
      }
      new Function(
        'self',
        'XMLHttpRequest',
        'createImageBitmap',
        decoder.imageWorkerSource(),
      )(scope, Xhr, () => native.promise);
      scope.onmessage({
        data: {
          init: true,
          timeout: 30000,
          supportsOptions: false,
          supportsFull: false,
        },
      });
      scope.onmessage({
        data: {
          id: 7,
          src: 'poster.png',
          premultiplyAlpha: true,
          sx: null,
          sy: null,
          sw: null,
          sh: null,
        },
      });
      await vi.advanceTimersByTimeAsync(2000);
      expect(posts).toEqual([
        {
          id: 7,
          error: 'Image bitmap decoding timed out',
          errorName: 'ImageBitmapTimeoutError',
        },
      ]);
      const late = bitmap();
      native.resolve(late);
      await Promise.resolve();
      expect(late.close).toHaveBeenCalledTimes(1);
    });
  });
