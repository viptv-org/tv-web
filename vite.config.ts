import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const upstream = "https://viptv.syek.tech";
const previewProxy = () => ({
  target: upstream, changeOrigin: true, secure: true,
  configure(proxy: import("vite").HttpProxy.Server) {
    // Only this opt-in HTTP LAN preview relaxes Secure for its own cookies.
    // Production stays HTTPS/HttpOnly/SameSite and never uses this proxy.
    proxy.on("proxyRes", (response) => {
      const cookies = response.headers["set-cookie"];
      if (cookies) response.headers["set-cookie"] = cookies.map(cookie =>
        /^viptv_(session|refresh)=/.test(cookie) ? cookie.replace(/;\s*Secure(?=;|$)/ig, "") : cookie);
    });
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
  // TV entrypoints retain ES2017. BigInt exists only in the lazily imported
  // MediaBunny chunk, gated on a modern WebCodecs runtime before import.
  esbuild: { supported: { bigint: true } },
  build: { target: "es2017" },
  // Opt-in LAN preview: browser requests stay on its own origin; upstream TLS
  // remains verified. Production still uses the backend's same-origin mount.
  server: {
    fs: {
      allow: [".."],
    },
    ...(process.env.VITE_LAN_PREVIEW === "1"
      ? {
          proxy: {
            "/api": previewProxy(),
            "/media": previewProxy(),
          },
        }
      : {}),
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    restoreMocks: true,
  },
}));
