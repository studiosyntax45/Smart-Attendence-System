import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
const permissionsPolicy = "camera=(self), geolocation=(self)";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "permissions-policy-header",
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          res.setHeader("Permissions-Policy", permissionsPolicy);
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((_req, res, next) => {
          res.setHeader("Permissions-Policy", permissionsPolicy);
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
