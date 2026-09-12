import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// FE 부트스트랩 — 10_frontend_design.md §1, plan/02_fe.md M2.F1·F5
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectManifest: { globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"] },
      manifest: {
        name: "사주라",
        short_name: "사주라",
        description: "소상공인 수요예측·자동발주",
        theme_color: "#0f172a",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
      },
    }),
  ],
  // dev에서 FE(5173) ↔ BE(8000)를 같은 origin으로 통합 — Safari ITP의 cross-site
  // cookie 차단으로 OAuth refresh가 실패하는 것을 방지. /api/* 요청만 BE로 전달.
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
  build: { sourcemap: true, target: "es2022" },
});
