import path from "path";

import react from "@vitejs/plugin-react";
import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

dotenv.config({ path: ".env.test" });

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    css: true,
    // 決定論的テスト実行設定
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // 単一スレッドで決定論化
        isolate: true, // テスト間の分離を強化
      },
    },
    // テスト間の分離を強化
    isolate: true,
    // 環境変数を決定論的に設定
    env: {
      NODE_ENV: 'test',
      TZ: 'UTC',
      VITEST: 'true',
      FORCE_COLOR: '0',
    },
    include: ["tests/**/*.{test,spec}.{ts,tsx}", "src/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "node_modules/",
      "tests/e2e/",
      "**/*.e2e.{ts,tsx}",
      "**/e2e/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "tests/",
        "**/*.d.ts",
        "*.config.*",
        "src/types/database.types.ts",
        "tests/e2e/",
        ".next/",
        "**/*.hot-update.js",
        "**/webpack/**",
        "**/chunks/**",
        "**/static/**",
        "**/vendor-chunks/**",
        "**/*-manifest.js",
        "**/polyfills.js",
      ],
    },
    typecheck: {
      include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.{ts,tsx}"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "tests": path.resolve(__dirname, "./tests"),      
    },
  },
});
