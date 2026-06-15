/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import fs from "fs";
import { execSync } from "child_process";

function liveVersionsPlugin() {
  return {
    name: 'live-versions',
    config() {
      const getVersion = (pkgName: string) => {
        try {
          return JSON.parse(fs.readFileSync(`node_modules/${pkgName}/package.json`, 'utf-8')).version;
        } catch {
          return "Unknown";
        }
      };
      
      const nodeVersion = process.version.replace('v', '');
      let npmVersion = "Unknown";
      try {
        npmVersion = execSync('npm -v').toString().trim();
      } catch {}
      
      return {
        define: {
          __LIVE_FRONTEND_VERSIONS__: JSON.stringify({
            react: getVersion('react'),
            vite: getVersion('vite'),
            molstar: getVersion('pdbe-molstar'),
            lucideReact: getVersion('lucide-react'),
            nodeJs: nodeVersion,
            npm: npmVersion,
            ubuntuBase: "24.04 LTS",
            cuda: "13.0.0",
            docker: "27.x"
          })
        }
      };
    }
  };
}

const backendProxyTarget = process.env.VITE_BACKEND_PROXY_TARGET ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react(), liveVersionsPlugin()],
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
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setupTests.ts"],
    globals: true
  }
});
