import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";


const root = process.cwd();
const runId = process.argv[2];
assert.match(runId ?? "", /^stage4-direct-clean-latent-smoke-trainer-preflight-[a-z0-9-]+$/);

const runtimeRoot = path.resolve(root, ".runtime/ai-painter/stage4-direct-clean-latent-smoke-trainer-preflights");
const runRoot = path.join(runtimeRoot, runId);
assert.equal(fs.existsSync(runRoot), false, "preflight runId/output reuse is forbidden");
fs.mkdirSync(runtimeRoot, { recursive: true });
fs.mkdirSync(runRoot, { recursive: false });

const python = path.resolve(root, "ml/ai-painter/.venv/Scripts/python.exe");
const inactive = path.resolve(root, ".runtime/ai-painter/stage4-direct-clean-latent-readonly-gpu-qualifications/stage4-direct-clean-latent-readonly-gpu-20260827-03/inactive-config.json");
const contract = path.resolve(root, ".runtime/ai-painter/stage4-direct-clean-latent-smoke-contract-compilations/stage4-direct-clean-latent-smoke-contract-20260827-01/controlled-smoke-contract.json");
const config = path.join(runRoot, "active-preflight-config.json");
const output = path.join(runRoot, "training-output");
const dataset = path.resolve(root, "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json");
const autoencoder = path.resolve(root, ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt");
for (const file of [python, inactive, contract, dataset, autoencoder]) {
  assert.equal(fs.existsSync(file), true, `required preflight input missing: ${file}`);
}

function run(args) {
  const result = spawnSync(python, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`command failed (${result.status}): ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

const compileStdout = run([
  "ml/ai-painter/scripts/compile_stage4_direct_clean_latent_smoke_active_config.py",
  "--inactive-config", inactive,
  "--smoke-contract", contract,
  "--ticket-state", "preflight_unconsumed",
  "--output", config,
]);
assert.equal(fs.existsSync(output), false, "preflight created training output before Trainer call");
const trainerStdout = run([
  "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
  "--config", config,
  "--dataset-package", dataset,
  "--autoencoder-checkpoint", autoencoder,
  "--output-dir", output,
  "--resolution-stage", "0",
  "--single-sample-overfit-smoke",
  "--overfit-sample-id", "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
  "--overfit-epochs", "30",
  "--overfit-evaluation-interval", "5",
  "--stage4-direct-clean-latent-smoke",
  "--stage4-direct-clean-latent-smoke-contract", contract,
  "--preflight-only",
]);
assert.equal(fs.existsSync(output), false, "readonly Trainer preflight created training output");
const trainer = JSON.parse(trainerStdout);
assert.equal(trainer.status, "direct_clean_latent_smoke_trainer_preflight_passed");
assert.equal(trainer.gpuStarted, false);
assert.equal(trainer.optimizerCreated, false);
assert.equal(trainer.backwardExecuted, false);
assert.equal(trainer.trainingStarted, false);

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const report = {
  schemaVersion: "stage4-direct-clean-latent-smoke-trainer-preflight-report-v1",
  status: "node_to_trainer_readonly_preflight_passed",
  runId,
  compiler: JSON.parse(compileStdout),
  trainer,
  bindings: {
    activePreflightConfig: { path: path.relative(root, config).replaceAll("\\", "/"), sha256: sha256(config) },
    smokeContract: { path: path.relative(root, contract).replaceAll("\\", "/"), sha256: sha256(contract) },
  },
  safety: {
    trainingOutputCreated: false,
    autoencoderCheckpointRead: false,
    gpuStarted: false,
    optimizerCreated: false,
    backwardExecuted: false,
    trainingStarted: false,
  },
  recordedAtUtc: new Date().toISOString(),
};
const reportPath = path.join(runRoot, "preflight-report.json");
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({
  status: report.status,
  runId,
  reportPath: path.relative(root, reportPath).replaceAll("\\", "/"),
  reportSha256: sha256(reportPath),
  trainingOutputCreated: false,
}, null, 2));
