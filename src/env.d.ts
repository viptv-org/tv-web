/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Local addon mode declaration for standalone/fat builds (LM-001). "1" enables the surface. */
  readonly VITE_VIPTV_LOCAL_MODE?: string;
}
