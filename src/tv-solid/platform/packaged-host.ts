export interface PackagedTvHost {
  platform: 'tizen';
  apiOrigin: string;
}

const configurations = new WeakMap<Document, PackagedTvHost | null>();

export function packagedTvHost(protocol = location.protocol, root = document): PackagedTvHost | undefined {
  if (protocol !== 'file:') return;
  if (configurations.has(root)) return configurations.get(root) ?? undefined;
  const data = root.getElementById('viptv-packaged-host');
  if (!data) { configurations.set(root, null); return; }
  const value = JSON.parse(data.textContent ?? '') as Partial<PackagedTvHost>;
  const url = new URL(value.apiOrigin ?? '');
  if (value.platform !== 'tizen' || url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
    throw Error('The packaged TV host requires an explicit HTTPS API origin.');
  const result: PackagedTvHost = { platform: value.platform, apiOrigin: url.origin };
  configurations.set(root, result);
  return result;
}

export function tvApiOrigin(): string {
  return packagedTvHost()?.apiOrigin || import.meta.env.VITE_API_ORIGIN || location.origin;
}
