/**
 * The TV authoring canvas. Every TV screen is laid out at 1920 x 1080 (the
 * reference size) and letterboxed onto the device by the scaler in useAuth.
 */
export const TV_CANVAS_WIDTH = 1920;
export const TV_CANVAS_HEIGHT = 1080;
/**
 * Legacy TV geometry was authored at 1280 x 720; its lengths are multiplied by
 * this factor (CSS: `var(--tv-k)`) until each screen family is rebuilt.
 */
export const LEGACY_TV_SCALE = TV_CANVAS_WIDTH / 1280;
