import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx,js,mjs}"],
    rules: {
      "@typescript-eslint/no-unused-vars": "error",
    },
  },
  {
    files: ["src/server/**/*.{ts,tsx,js,mjs}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{
        group: ["@/app/**", "**/app/**"],
        message: "Server modules must consume shared contracts, not page implementations.",
      }] }],
    },
  },
  {
    files: ["src/app/api/**/*.{ts,tsx,js,mjs}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{
        group: ["@/app/ai-console/*catalog*", "**/app/ai-console/*catalog*"],
        message: "Import console definitions from src/shared/ai-console; page paths are compatibility exports only.",
      }] }],
    },
  },
  {
    files: ["src/shared/ai-console/**/*.{ts,tsx,js,mjs}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{
        group: ["@/app/**", "**/app/**"],
        message: "Shared console definitions must not depend on pages or client hooks.",
      }] }],
    },
  },
  {
    files: ["src/ai/destiny-core/ziwei-core/{interpretation,shared}/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{
        group: ["**/page-view/**"],
        message: "Ziwei interpretation and shared definitions must consume shared chart labels, not page implementations.",
      }] }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".runtime/**",
    ".runtime-f-drive-backup-*/**",
    ".test-output/**",
    "runtime-data/**",
    "coverage/**",
    "data/**",
    "ml/ai-painter/.venv/**",
    "ml/ai-painter/checkpoints/**",
    "ml/ai-painter/outputs/**",
    "**/__pycache__/**",
    ".pytest_cache/**",
    ".mypy_cache/**",
    ".ruff_cache/**",
  ]),
]);

export default eslintConfig;
