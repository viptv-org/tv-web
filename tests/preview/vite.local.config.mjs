// Preview harness, local-mode dev server: the app's Vite config with its own
// dependency cache so it can run next to the normal preview server.
import config from '../../vite.config.ts';

export default async (env) => {
  const base = typeof config === 'function' ? await config(env) : config;
  return { ...base, root: new URL('../..', import.meta.url).pathname, cacheDir: 'node_modules/.vite-preview-local' };
};
