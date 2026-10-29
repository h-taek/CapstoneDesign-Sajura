// 확장 빌드 — background(ES 모듈 서비스 워커), content·dialog(번들 하나, import 없음)를 따로 만든다.
// content script는 모듈을 쓸 수 없어 IIFE로 묶는다. public/manifest.json은 dist에 그대로 복사된다.
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  build: {
    outDir: "dist",
    emptyOutDir: mode === "background",
    copyPublicDir: mode === "background",
    minify: false,
    lib: {
      entry: `src/${mode}.ts`,
      formats: [mode === "background" ? "es" : "iife"],
      name: "sajura",
      fileName: () => `${mode}.js`,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
}));
