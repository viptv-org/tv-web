import type { RendererFactory } from '@solidtv/solid';

export async function installSolidHost(factory: RendererFactory): Promise<void> {
  const { Config, setRendererFactory } = await import('@solidtv/solid');
  Config.preventDefaultOnHandledKeys = true;
  setRendererFactory(factory);
}
