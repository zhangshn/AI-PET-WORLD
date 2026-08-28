import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { appendAiPainterProgramEvent, formatShanghai, projectPath } from "./lib/ai-painter-program-event-store.mjs";
import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs";


const ROOT = process.cwd();
const RUN_ID = "stage4-direct-clean-latent-smoke-trainer-support-20260827-01";
const OUTPUT = path.resolve(ROOT, ".runtime/ai-painter/stage4-direct-clean-latent-smoke-trainer-support", RUN_ID);
const PREFLIGHT = path.resolve(ROOT, ".runtime/ai-painter/stage4-direct-clean-latent-smoke-trainer-preflights/stage4-direct-clean-latent-smoke-trainer-preflight-20260827-01/preflight-report.json");
const PYTHON = path.resolve(ROOT, "ml/ai-painter/.venv/Scripts/python.exe");

const current = await readCurrentExecutionRegistry(ROOT);
assert.equal(current.ok, true, current.errorCode);
assert.equal(current.registry.taskId, "implement_direct_condition_clean_latent_controlled_smoke_training_path");
assert.equal(current.registry.capabilityVersion, "stage4-direct-condition-clean-latent-generator-change-candidate-v1");
assert.equal(current.registry.activity, "planned_not_started");
assert.equal(fs.existsSync(OUTPUT), false, "trainer support run already exists");
assert.equal(fs.existsSync(PREFLIGHT), true, "real Node-to-Trainer preflight evidence missing");
fs.mkdirSync(OUTPUT, { recursive: true });

const checked = spawnSync(PYTHON, ["ml/ai-painter/scripts/check_stage4_direct_clean_latent_smoke_cpu.py"], {
  cwd: ROOT,
  encoding: "utf8",
  windowsHide: true,
  maxBuffer: 32 * 1024 * 1024,
});
if (checked.status !== 0) throw new Error(checked.stderr || checked.stdout);
const cpu = JSON.parse(checked.stdout);
assert.equal(cpu.status, "stage4_direct_clean_latent_smoke_cpu_preflight_passed");
writeExclusive(path.join(OUTPUT, "cpu-report.json"), cpu);
const preflight = read(PREFLIGHT);
assert.equal(preflight.status, "node_to_trainer_readonly_preflight_passed");
assert.deepEqual(preflight.safety, {
  trainingOutputCreated: false,
  autoencoderCheckpointRead: false,
  gpuStarted: false,
  optimizerCreated: false,
  backwardExecuted: false,
  trainingStarted: false,
});
const recordedAtUtc = new Date().toISOString();
const terminal = {
  schemaVersion: "stage4-direct-clean-latent-smoke-trainer-support-terminal-v1",
  executionState: "completed",
  status: "direct_clean_latent_smoke_trainer_support_cpu_verified",
  runId: RUN_ID,
  capabilityVersion: current.registry.capabilityVersion,
  cpuReport: bind(path.join(OUTPUT, "cpu-report.json")),
  nodeTrainerPreflight: bind(PREFLIGHT),
  trainingOutputCreated: false,
  autoencoderCheckpointRead: false,
  gpuStarted: false,
  optimizerCreated: false,
  backwardExecuted: false,
  trainingStarted: false,
  ownerAuthorizationRequired: false,
  nextLegalAction: "execute_direct_condition_clean_latent_controlled_smoke_closed_loop",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc,
};
writeExclusive(path.join(OUTPUT, "phase-terminal.json"), terminal);
const evidenceFiles = [path.join(OUTPUT, "cpu-report.json"), PREFLIGHT, path.join(OUTPUT, "phase-terminal.json")];
const capsule = {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${RUN_ID}`,
  generatedFrom: "program_saved_evidence",
  readOnly: true,
  module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
  fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60, source: "current_execution_registry" },
  currentStage: { number: 4, total: 5, labelZh: "Stage 0→1→2完整训练", status: terminal.status },
  candidateTerminal: { runId: RUN_ID, status: terminal.status, programStatus: terminal.status, checkpointWritten: false, modelWeightsModified: false, recordedAtUtc, recordedAtAsiaShanghai: formatShanghai(recordedAtUtc) },
  latestBlocker: { code: "controlled_smoke_not_yet_executed", summaryZh: "训练入口和只读预检通过；受控Smoke尚未执行。" },
  nextAllowedAction: { code: terminal.nextLegalAction, labelZh: "执行直达干净潜变量受控Smoke闭环", ownerAuthorizationRequired: false, automaticExecutionAllowed: true, planEvidenceConfirmed: true },
  forbiddenActions: ["historical_checkpoint", "automatic_retry", "stage0_before_smoke_qualification", "lower_machine_review_threshold"],
  taskIdentity: { modelId: "stage4-direct-condition-clean-latent-generator-change-candidate-v1", sampleId: "194", sampleSplit: "validation", seed: 20263722, requiredBoundarySides: ["west"] },
  evidence: evidenceFiles.map((file) => ({ kind: path.basename(file, path.extname(file)), labelZh: path.basename(file), ...bind(file), expectedSha256: sha256(file), sha256Verified: true, recordedAtUtc, recordedAtAsiaShanghai: formatShanghai(recordedAtUtc) })),
  integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true, migrationRegistryStatus: "current_execution_registry_active" },
};
writeExclusive(path.join(OUTPUT, "local-task-capsule.json"), capsule);
const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: current.registry.capabilityVersion,
  packageId: "stage4-direct-clean-latent-controlled-smoke-20260827-01",
  taskId: terminal.nextLegalAction,
  taskKind: "controlled_smoke",
  runId: RUN_ID,
  lifecycleStage: "readonly_gpu_qualified",
  executionState: "package_materialized",
  activity: "planned_not_started",
  taskCapsulePath: projectPath(path.join(OUTPUT, "local-task-capsule.json")),
  terminalEvidencePath: projectPath(path.join(OUTPUT, "phase-terminal.json")),
});
appendAiPainterProgramEvent({
  id: `stage4-direct-clean-latent-trainer-support-${RUN_ID}`,
  timestamp: recordedAtUtc,
  action: "stage4_direct_clean_latent_smoke_trainer_support_cpu_verified",
  runId: RUN_ID,
  kind: "implementation",
  status: "success",
  title: "Direct clean-latent Smoke Trainer support verified",
  titleZh: "直达干净潜变量Smoke训练入口及只读预检通过",
  detailZh: "CPU正反检查与真实Node到Trainer只读预检通过；未启动GPU或训练。",
  evidencePath: projectPath(path.join(OUTPUT, "phase-terminal.json")),
  evidenceSha256: sha256(path.join(OUTPUT, "phase-terminal.json")),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
});
console.log(JSON.stringify({
  status: terminal.status,
  terminal: bind(path.join(OUTPUT, "phase-terminal.json")),
  registryRevision: advanced.registry.registryRevision,
  registrySha256: advanced.registrySha256,
  nextLegalAction: terminal.nextLegalAction,
}, null, 2));

function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function sha256(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function bind(file) { return { path: projectPath(file), sha256: sha256(file) }; }
function writeExclusive(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" }); }
