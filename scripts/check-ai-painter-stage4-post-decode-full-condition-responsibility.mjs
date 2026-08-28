import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildPostDecodeFullConditionResponsibilityInactiveConfig,
  validatePostDecodeFullConditionResponsibilityInactiveConfig,
} from "./lib/ai-painter-stage4-post-decode-full-condition-responsibility-renderer-v1.mjs";

const root = process.cwd();
const basePath = path.join(
  root,
  "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json",
);
const base = JSON.parse(fs.readFileSync(basePath, "utf8"));
const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "stage4-post-decode-full-condition-responsibility-"),
);
const configPath = path.join(temporaryRoot, "inactive-config.json");

try {
  const config = buildPostDecodeFullConditionResponsibilityInactiveConfig(base);
  validatePostDecodeFullConditionResponsibilityInactiveConfig(config);
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  const python = spawnSync(
    process.env.AI_PAINTER_PYTHON ??
      path.join(root, "ml/ai-painter/.venv/Scripts/python.exe"),
    [
      path.join(
        root,
        "ml/ai-painter/scripts/check_stage4_post_decode_full_condition_responsibility_cpu.py",
      ),
      configPath,
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 30 * 1024 * 1024 },
  );
  assert.equal(python.status, 0, python.stderr || python.stdout);
  const report = JSON.parse(python.stdout);
  assert.equal(report.status, "passed");
  assert.equal(report.positivePassed, report.positiveTotal);
  assert.equal(report.negativePassed, report.negativeTotal);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
