import path from "path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    css: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "node_modules/",
      "e2e/",
      "**/*.e2e.{ts,tsx}",
      "**/e2e/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/test/",
        "**/*.d.ts",
        "*.config.*",
        "src/types/database.types.ts",
        "e2e/",
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
    },
  },
});
