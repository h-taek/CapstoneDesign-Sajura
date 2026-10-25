import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// FE 부트스트랩 — 04_fe.md §1, plan/02_fe.md M2.F1·F5
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
      includeAssets: ["favicon-64.png", "apple-touch-icon.png"],
      // 홈 화면 설치(PWA) — 04_fe.md §6. 아이콘은 public/에 있다.
      manifest: {
        id: "/",
        name: "사주라 — 우리 가게 발주 도우미",
        short_name: "사주라",
        description: "매출 예측과 발주 추천을 한 번에 — 소상공인 수요예측·자동발주",
        lang: "ko",
        dir: "ltr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#ffffff",
        background_color: "#f4f5f8",
        categories: ["business", "productivity"],
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        // 앱 아이콘을 길게 누르면 바로 가는 메뉴
        shortcuts: [
          {
            name: "발주 추천",
            short_name: "발주",
            url: "/orders",
            icons: [{ src: "/icon-192.png", sizes: "192x192" }],
          },
          {
            name: "재고 확인",
            short_name: "재고",
            url: "/inventory",
            icons: [{ src: "/icon-192.png", sizes: "192x192" }],
          },
          {
            name: "매출 올리기",
            short_name: "매출",
            url: "/sales/upload",
            icons: [{ src: "/icon-192.png", sizes: "192x192" }],
          },
        ],
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
