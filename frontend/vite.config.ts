import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const backendProxyTarget = process.env.VITE_BACKEND_PROXY_TARGET ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: backendProxyTarget,
        changeOrigin: true
      },
      "/media": {
        target: backendProxyTarget,
        changeOrigin: true
      }
    }
  }
});
