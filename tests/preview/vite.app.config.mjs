// Preview harness, app dev server: the app's Vite config with its own dependency
// cache. Sharing node_modules/.vite with the e2e (4173) or gallery (4197) servers
// lets one of them re-optimize the deps under this one, which then serves two
// copies of React ("Invalid hook call") until it restarts.
import config from '../../vite.config.ts';

export default async (env) => {
  const base = typeof config === 'function' ? await config(env) : config;
  return { ...base, root: new URL('../..', import.meta.url).pathname, cacheDir: 'node_modules/.vite-preview-app' };
};
