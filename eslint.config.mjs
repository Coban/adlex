import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Global ignores
  {
    ignores: [
      ".next/**/*",
      "node_modules/**/*",
      "dist/**/*",
      "build/**/*",
      "out/**/*",
      "next-env.d.ts"
    ]
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "src/app/api/**/__tests__/**/*.ts",
      "src/**/__tests__/**/*.ts"
    ],
    rules: {
      // General code quality rules
      "prefer-const": "error",
      "no-var": "error",
      "no-console": "off", // 開発中はコンソールログを許可
      "eqeqeq": "error",
      "no-duplicate-imports": "error",
      "no-unused-expressions": "error",

      // React specific rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react/jsx-no-useless-fragment": "error",
      "react/jsx-curly-brace-presence": ["error", { "props": "never", "children": "never" }],

      // Import rules
      "import/order": ["warn", {
        "groups": ["builtin", "external", "internal", "parent", "sibling", "index"],
        "newlines-between": "always",
        "alphabetize": { "order": "asc" }
      }],
    },
  },
  // TypeScript files: enable type-aware linting and TS-specific rules
  {
    files: [
      "**/*.{ts,tsx}",
    ],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // TypeScript specific rules
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-inferrable-types": "error",
      "@typescript-eslint/no-non-null-assertion": "off", // 開発中は許可

      /**
       * 基本は ?? を強制（error）
       * ただし以下の“例外”では || を許可:
       *  - 条件式（if, while, 三項演算子など）→ ignoreConditionalTests
       *  - && と混在する複合論理式 → ignoreMixedLogicalExpressions
       * また fixer を suggestion 扱いに（誤修正の抑止）
       */
      "@typescript-eslint/prefer-nullish-coalescing": ["error", {
        ignoreConditionalTests: true,
        ignoreMixedLogicalExpressions: true
      }],

      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/strict-boolean-expressions": "off", // Next.jsではfalsy値が多用されるため
      "@typescript-eslint/no-unnecessary-condition": "off", // 開発中は無効化
    },
  },
  // Test files: disable type-aware linting to avoid module resolution noise
  {
    files: [
      "tests/**/*.{ts,tsx}",
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
    ],
    languageOptions: {
      parserOptions: {
        project: null,
      },
    },
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/prefer-optional-chain": "off",
      "@typescript-eslint/strict-boolean-expressions": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
    },
  },
];

export default eslintConfig;