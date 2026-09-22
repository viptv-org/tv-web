/* Local addon mode availability (design LOCAL_MODE.md LM-001).
   A build-time declaration, not a runtime fork: only standalone/fat builds
   set the flag, and the backend-hosted bundle keeps its sign-in-only surface. */
export const localModeAvailable = import.meta.env.VITE_VIPTV_LOCAL_MODE === "1";
