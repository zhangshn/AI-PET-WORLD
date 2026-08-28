import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildPostDecodeObjectRgbInactiveConfig,
  validatePostDecodeObjectRgbInactiveConfig,
} from "./lib/ai-painter-stage4-post-decode-object-rgb-compositor-v1.mjs";

const root = process.cwd();
const base = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json",
    ),
    "utf8",
  ),
);
const contract = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      "data/ai-painter/system-governance/stage4-post-decode-authoritative-object-rgb-compositor-contract-v1.json",
    ),
    "utf8",
  ),
);
const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "stage4-post-decode-object-rgb-"),
);
const configPath = path.join(temporaryRoot, "inactive-config.json");

try {
  const config = buildPostDecodeObjectRgbInactiveConfig(base);
  validatePostDecodeObjectRgbInactiveConfig(config);
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  assert.equal(contract.status, "cpu_supported_inactive");
  assert.equal(contract.architectureId, config.denoiserArchitecture);
  assert.deepEqual(
    contract.objectIdentityOrder,
    config.postDecodeObjectRgbIdentityOrder,
  );
  assert.deepEqual(
    Object.values(contract.activationGates),
    Object.values(config.activationGates),
  );
  const python = spawnSync(
    process.env.AI_PAINTER_PYTHON ??
      path.join(root, "ml/ai-painter/.venv/Scripts/python.exe"),
    [
      path.join(
        root,
        "ml/ai-painter/scripts/check_stage4_post_decode_object_rgb_compositor_cpu.py",
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
