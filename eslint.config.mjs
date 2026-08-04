import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
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
