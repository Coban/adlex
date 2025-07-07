import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: ["src/app/api/**/__tests__/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // TypeScript specific rules
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-inferrable-types": "error",
      "@typescript-eslint/no-non-null-assertion": "off", // 開発中は許可
      "@typescript-eslint/prefer-nullish-coalescing": "warn", // warningに変更
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/strict-boolean-expressions": "off", // Next.jsではfalsy値が多用されるため
      "@typescript-eslint/no-unnecessary-condition": "off", // 開発中は無効化
      
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
];

export default eslintConfig;
