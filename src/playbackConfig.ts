import { configureBrowserPlayback } from '@viptv/video';

configureBrowserPlayback({
  clientInspection: import.meta.env.VITE_BROWSER_PREPARATION === '1',
  localRemux: import.meta.env.VITE_LOCAL_MSE_REMUX === '1',
});
