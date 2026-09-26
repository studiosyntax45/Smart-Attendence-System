import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
const permissionsPolicy = "camera=(self), geolocation=(self)";

// index.html must never be cached: it names the hashed page chunks of the current build,
// and a stale copy points at chunks that no longer exist. Hashed assets can cache freely.
function setHeaders(req: { url?: string }, res: { setHeader(name: string, value: string): void }) {
  res.setHeader("Permissions-Policy", permissionsPolicy);
  const url = (req.url ?? "/").split("?")[0];
  const isPage = url.endsWith(".html") || !/\.[a-z0-9]+$/i.test(url); // "/", "/student/dashboard", ...
  if (isPage) res.setHeader("Cache-Control", "no-cache");
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "permissions-policy-header",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          setHeaders(req, res);
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          setHeaders(req, res);
          next();
        });
      },
    },
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  // The only chunk over 500 kB is @vladmandic/face-api (~1.33 MB, TensorFlow pre-bundled, cannot be split).
  // It is imported on demand by lib/face-client.ts, so it never slows the first page load.
  // Pages are split per route in src/router.tsx; everything else stays under 400 kB.
  build: { chunkSizeWarningLimit: 1400 },
  server: { port: 3000 },
  preview: { port: 3000 },
});
