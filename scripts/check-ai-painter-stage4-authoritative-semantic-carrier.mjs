import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildAuthoritativeSemanticCarrierInactiveConfig, validateAuthoritativeSemanticCarrierInactiveConfig } from "./lib/ai-painter-stage4-authoritative-semantic-carrier-v1.mjs";

const root = process.cwd();
const source = JSON.parse(fs.readFileSync(path.join(root, "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json"), "utf8"));
const contract = JSON.parse(fs.readFileSync(path.join(root, "data/ai-painter/system-governance/stage4-authoritative-visual-semantic-carrier-model-family-contract-v1.json"), "utf8"));
assert.equal(contract.status, "cpu_supported_inactive");
assert.ok(Object.values(contract.activationGates).every((value) => value === false));
const config = buildAuthoritativeSemanticCarrierInactiveConfig(source);
assert.equal(validateAuthoritativeSemanticCarrierInactiveConfig(config), true);
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-authoritative-carrier-"));
const configPath = path.join(directory, "inactive-config.json");
fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
const python = path.join(root, "ml/ai-painter/.venv/Scripts/python.exe");
const checker = path.join(root, "ml/ai-painter/scripts/check_stage4_authoritative_semantic_carrier_cpu.py");
const result = spawnSync(python, [checker, configPath], { cwd: root, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
assert.equal(result.status, 0, result.stderr || result.stdout);
const report = JSON.parse(result.stdout);
assert.equal(report.status, "passed");
assert.equal(report.positivePassed, report.positiveTotal);
assert.equal(report.negativePassed, report.negativeTotal);
process.stdout.write(`${JSON.stringify({ ...report, inactiveConfigValidated: true, contractValidated: true, ownerAuthorizationRequired: false }, null, 2)}\n`);

