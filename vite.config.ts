import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const upstream = "https://viptv.syek.tech";
const previewProxy = () => ({
  target: upstream, changeOrigin: true, secure: true,
  configure(proxy: import("vite").HttpProxy.Server) {
    proxy.on("proxyReq", (outgoing, incoming) => {
      // Translate only the preview's own browser origin. Unrelated origins
      // retain their value and remain rejected by backend CSRF protection.
      if (incoming.headers.origin === `http://${incoming.headers.host}`)
        outgoing.setHeader("Origin", upstream);
    });
  },
});
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "/tv/" : "/",
  build: { target: "es2017" },
  // Opt-in LAN preview: browser requests stay on its own origin; upstream TLS
  // remains verified. Production still uses the backend's same-origin mount.
  server: process.env.VITE_LAN_PREVIEW === "1" ? {
    proxy: {
      "/api": previewProxy(),
      "/media": previewProxy(),
    },
  } : undefined,
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    restoreMocks: true,
  },
}));
