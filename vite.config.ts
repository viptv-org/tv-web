import { Agent } from "node:https";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import solid from "vite-plugin-solid";
// Opt-in LAN preview upstream; defaults to the production origin only when
// explicitly provided, so dev configurations never silently proxy to prod.
const upstream = process.env.VIPTV_PREVIEW_UPSTREAM ?? "https://viptv.syek.tech";
// One pooled keep-alive agent: without it every proxied request pays a new
// TLS handshake to the upstream, which serialises a page's API burst.
const upstreamAgent = new Agent({ keepAlive: true, maxSockets: 32 });
const previewProxy = () => ({
  target: upstream, changeOrigin: true, secure: true, agent: upstreamAgent,
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
  plugins: [react({ exclude: /src\/tv-solid\// }), solid({ include: /src\/tv-solid\/.*\.tsx$/, solid: { moduleName: "@solidtv/solid", generate: "universal" } })],
  // The player contract resolves from the pinned vendored source, not the
  // generated dist-js of a sibling checkout.
  resolve: { dedupe: ["solid-js", "@solidtv/solid"], alias: { "@viptv/video": new URL("./vendor/video/src/index.ts", import.meta.url).pathname } },
  base: command === "build" ? "/tv/" : "/",
  // TV entrypoints retain ES2017. BigInt exists only in the lazily imported
  // MediaBunny chunk, gated on a modern WebCodecs runtime before import.
  esbuild: { supported: { bigint: true } },
  build: {
    target: "es2017",
    rollupOptions: {
      // Keep the working React entry for responsive web, desktop and TV while
      // SolidTV screen/interaction parity is qualified on the separate page.
      input: {
        app: resolve(import.meta.dirname, "index.html"),
        solid: resolve(import.meta.dirname, "solid.html"),
        lightning: resolve(import.meta.dirname, "lightning.html"),
      },
    },
  },
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
