import { afterEach, expect, test, vi } from 'vitest';
const sourcePath = '../../node_modules/@solidtv/renderer-canvas/src/core/CoreTextureManager.ts';
const distPath = '../../node_modules/@solidtv/renderer-canvas/dist/src/core/CoreTextureManager.js';
const texturePath = '../../node_modules/@solidtv/renderer-canvas/dist/src/core/textures/Texture.js';
const [{ CoreTextureManager: SourceManager }, { CoreTextureManager: DistManager }, { TextureType }] = await Promise.all([import(sourcePath), import(distPath), import(texturePath)]);

afterEach(() => vi.unstubAllGlobals());

for (const [name, Manager] of [['source', SourceManager], ['dist', DistManager]] as const) {
  test(`${name}: decoded Canvas pixels reach the current paint before the load promise returns`, async () => {
    class Pixels {}
    vi.stubGlobal('ImageData', Pixels);
    const manager = Object.create(Manager.prototype) as any;
    Object.assign(manager, {initialized: false, pendingLoads: 0, renderer: {mode: 'canvas'},
      decodeGate: {acquire: vi.fn(), release: vi.fn()}, uploadTexture: vi.fn(), enqueueUploadTexture: vi.fn()});
    const data = new Pixels();
    const texture: any = {type: TextureType.image, state: 'initial', props: {src: data, premultiplyAlpha: false},
      textureData: null, setState: vi.fn()};
    texture.getTextureData = vi.fn(async () => texture.textureData = {data, premultiplyAlpha: false});
    const loading = manager.loadTexture(texture);
    const uploadedBeforeYield = manager.uploadTexture.mock.calls.length;
    await loading;
    expect(uploadedBeforeYield).toBe(1);
    expect(texture.textureData).toEqual({data, premultiplyAlpha: false});
    expect(manager.pendingLoads).toBe(0);
  });

  test(`${name}: local Canvas pixels bypass occupied decode slots and the upload queue`, async () => {
    class Pixels {}
    vi.stubGlobal('ImageData', Pixels);
    const manager = Object.create(Manager.prototype) as any;
    Object.assign(manager, { initialized: false, pendingLoads: 0, renderer: { mode: 'canvas' }, decodeGate: { acquire: vi.fn(() => new Promise(() => {})), release: vi.fn() }, uploadTextureQueue: { add: vi.fn() }, uploadTexture: vi.fn(), enqueueUploadTexture: vi.fn() });
    const texture = { type: TextureType.image, state: 'initial', props: { src: new Pixels() }, setState: vi.fn(), getTextureData: vi.fn(async () => ({ data: new Pixels() })) };
    await manager.loadTexture(texture);
    expect(manager.decodeGate.acquire).not.toHaveBeenCalled();
    expect(manager.uploadTextureQueue.add).not.toHaveBeenCalled();
    expect(manager.enqueueUploadTexture).not.toHaveBeenCalled();
    expect(manager.uploadTexture).toHaveBeenCalledWith(texture);
    expect(manager.pendingLoads).toBe(0);
  });

  test(`${name}: URL textures still await the initialized decode pipeline`, async () => {
    const manager = Object.create(Manager.prototype) as any;
    Object.assign(manager, { initialized: false, uploadTextureQueue: { add: vi.fn() }, uploadTexture: vi.fn() });
    const texture = { type: TextureType.image, state: 'initial', props: { src: '/artwork.png' }, getTextureData: vi.fn() };
    await manager.loadTexture(texture);
    expect(manager.uploadTextureQueue.add).toHaveBeenCalledWith(texture);
    expect(texture.getTextureData).not.toHaveBeenCalled();
    expect(manager.uploadTexture).not.toHaveBeenCalled();
  });

  test(`${name}: same-frame Canvas uploads retain the critical-memory guard`, async () => {
    class Pixels {}
    vi.stubGlobal('ImageData', Pixels);
    const manager = Object.create(Manager.prototype) as any;
    Object.assign(manager, {initialized: false, pendingLoads: 0, renderer: {mode: 'canvas'},
      stage: {txMemManager: {doNotExceedCriticalThreshold: true, criticalCleanupRequested: true}}});
    const texture: any = {type: TextureType.image, state: 'initial', props: {src: new Pixels()},
      loadCtxTexture: vi.fn(), getTextureData: vi.fn(async () => ({}))};
    texture.setState = vi.fn((state: string) => { texture.state = state; });
    await manager.loadTexture(texture);
    expect(texture.state).toBe('failed');
    expect(texture.loadCtxTexture).not.toHaveBeenCalled();
    expect(manager.pendingLoads).toBe(0);
  });
}
