import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs";
import { auditAiAssistedProfessionalAesthetic } from "./lib/ai-assisted-professional-aesthetic.mjs";
import { normalizePreviewWithWindowsSafeIo } from "./lib/ai-assisted-v7-r5-stage3-preview-review.mjs";
import { advanceCapabilityLifecycle } from "./lib/ai-painter-capability-lifecycle-v1.mjs";
import {
  appendAiPainterProgramEvent,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs";

const ROOT = process.cwd();
const PYTHON = inside("ml/ai-painter/.venv/Scripts/python.exe");
const TRAINER = inside(
  "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
);
const DATASET = inside(
  "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json",
);
const AUTOENCODER = inside(
  ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt",
);
const AUTOENCODER_SHA =
  "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba";
const FROZEN_SOURCE = inside(
  ".runtime/ai-painter/stage4-controlled-structure-controlled-smokes/20260823-051400001-condition_fusion_only_final_direct_residual_23_64_12/active-config.json",
);
const FROZEN_SOURCE_SHA =
  "fceb5a2f655fb909a3b207b1340e963846773d0d5707ee52e41c1a49bd832065";
const SAMPLE_ID =
  "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6";
const PREVIEW_EPOCHS = [1, 5, 10, 20, 30];
const ACTIONS = [
  "create_optimizer",
  "execute_backward",
  "inspect_autoencoder_identity",
  "inspect_checkpoint_identity",
  "load_autoencoder",
  "mutate_model_weights",
  "select_bound_sample",
  "write_smoke_checkpoint",
];
const capabilityVersion = required("--capability-version");
const attemptId = required("--attempt-id");
const preflightOnly = process.argv.includes("--preflight-only");
assert.match(capabilityVersion, /^[a-z0-9][a-z0-9-]{7,127}$/u);
assert.match(attemptId, /^[a-z0-9][a-z0-9-]{7,79}$/u);
const candidateRoot = inside(
  `.runtime/ai-painter/stage4-post-decode-object-rgb-candidates/${capabilityVersion}`,
);
const lifecycle = read(
  inside(
    `.runtime/ai-painter/capability-lifecycle/${capabilityVersion}/state.json`,
  ),
);
assert.equal(lifecycle.state, "readonly_gpu_qualified");
const contractPath = path.join(candidateRoot, "controlled-smoke-contract.json");
const contract = read(contractPath);
validateContract(contract);
assert.equal(sha(AUTOENCODER), AUTOENCODER_SHA);
assert.equal(sha(FROZEN_SOURCE), FROZEN_SOURCE_SHA);
const executionParent = inside(
  ".runtime/ai-painter/stage4-post-decode-object-rgb-controlled-smokes",
);
fs.mkdirSync(executionParent, { recursive: true });
const executionRoot = path.join(
  executionParent,
  `${capabilityVersion}-${attemptId}`,
);
assert.equal(
  fs.existsSync(executionRoot),
  false,
  "controlled Smoke output already exists",
);
const resources = resourceSnapshot();
if (!resources.passed)
  throw new Error(
    `controlled_smoke_resource_gate_failed:${resources.blockers.join(",")}`,
  );
fs.mkdirSync(executionRoot, { recursive: false });
writeJsonAtomic(path.join(executionRoot, "resource-preflight.json"), resources);
const ticketId = `local-ai-${capabilityVersion}-${attemptId}`;
const ticketPath = path.join(executionRoot, "internal-capability-ticket.json");
writeExclusive(ticketPath, {
  schemaVersion: "ai-painter-local-internal-capability-ticket-v1",
  status: "issued_not_consumed",
  ticketId,
  modeId: "post_decode_object_rgb_stage4_smoke",
  capabilityVersion,
  capabilityAuthority: "local_ai_pet_world_program",
  parentContract: bind(contractPath),
  executionActions: ACTIONS,
  ownerAuthorizationRequired: false,
  cannotExpandParentContract: true,
  issuedAtUtc: new Date().toISOString(),
});
const consumptionPath = path.join(
  executionRoot,
  "internal-capability-consumption.json",
);
writeExclusive(consumptionPath, {
  schemaVersion: "ai-painter-local-internal-capability-ticket-consumption-v1",
  ticketId,
  ticketSha256: sha(ticketPath),
  oneTimeConsumption: true,
  state: "consumed",
  consumedAtUtc: new Date().toISOString(),
});
const activeConfigPath = path.join(executionRoot, "active-config.json");
writeExclusive(
  activeConfigPath,
  buildActiveConfig(ticketPath, consumptionPath),
);
const trainingOutput = path.join(executionRoot, "training-output");
const trainerArgs = [
  TRAINER,
  "--config",
  activeConfigPath,
  "--dataset-package",
  DATASET,
  "--autoencoder-checkpoint",
  AUTOENCODER,
  "--output-dir",
  trainingOutput,
  "--resolution-stage",
  "0",
  "--single-sample-overfit-smoke",
  "--overfit-sample-id",
  SAMPLE_ID,
  "--overfit-epochs",
  "30",
  "--overfit-evaluation-interval",
  "5",
];
const preflight = spawnSync(PYTHON, [...trainerArgs, "--preflight-only"], {
  cwd: ROOT,
  env: pythonEnv(),
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
  windowsHide: true,
});
writeExclusive(path.join(executionRoot, "trainer-preflight.json"), {
  status: preflight.status === 0 ? "passed" : "failed",
  exitCode: preflight.status,
  stdout: preflight.stdout,
  stderr: preflight.stderr,
  gpuStarted: false,
  trainingStarted: false,
});
if (preflight.status !== 0)
  closeFailure(
    "trainer_preflight_failed",
    preflight.stderr || preflight.stdout,
  );
if (preflightOnly) {
  const terminalPath = path.join(executionRoot, "phase-terminal.json");
  writeExclusive(terminalPath, {
    schemaVersion:
      "stage4-post-decode-object-rgb-controlled-smoke-preflight-terminal-v1",
    executionState: "completed",
    status: "preflight_passed_gpu_not_started",
    capabilityVersion,
    attemptId,
    trainerPreflight: bind(path.join(executionRoot, "trainer-preflight.json")),
    internalTicket: bind(ticketPath),
    internalConsumption: bind(consumptionPath),
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    optimizerCreated: false,
    trainingStarted: false,
    recordedAtUtc: new Date().toISOString(),
  });
  process.stdout.write(
    `${JSON.stringify({ status: "preflight_passed_gpu_not_started", terminal: bind(terminalPath), ownerAuthorizationRequired: false, trainingStarted: false }, null, 2)}\n`,
  );
  process.exit(0);
}
writeJsonAtomic(path.join(executionRoot, "execution-state.json"), {
  schemaVersion: "stage4-post-decode-object-rgb-smoke-execution-state-v1",
  status: "running",
  phase: "training",
  capabilityVersion,
  attemptId,
  trainingOutput: relative(trainingOutput),
  progressPath: relative(path.join(trainingOutput, "progress.json")),
  ownerAuthorizationRequired: false,
  startedAtUtc: new Date().toISOString(),
});
const stdoutHandle = fs.openSync(
  path.join(executionRoot, "trainer.stdout.log"),
  "wx",
);
const stderrHandle = fs.openSync(
  path.join(executionRoot, "trainer.stderr.log"),
  "wx",
);
const child = spawn(PYTHON, trainerArgs, {
  cwd: ROOT,
  env: pythonEnv(),
  windowsHide: true,
  stdio: ["ignore", stdoutHandle, stderrHandle],
});
const exitCode = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (code) => resolve(code ?? 1));
});
fs.closeSync(stdoutHandle);
fs.closeSync(stderrHandle);
if (exitCode !== 0)
  closeFailure("trainer_execution_failed", `exitCode=${exitCode}`);
const manifestPath = path.join(trainingOutput, "manifest.json");
assert.ok(fs.existsSync(manifestPath), "trainer manifest missing");
writeJsonAtomic(path.join(executionRoot, "execution-state.json"), {
  schemaVersion: "stage4-post-decode-object-rgb-smoke-execution-state-v1",
  status: "running",
  phase: "automatic_review_and_qualification",
  capabilityVersion,
  attemptId,
  trainingOutput: relative(trainingOutput),
  ownerAuthorizationRequired: false,
  updatedAtUtc: new Date().toISOString(),
});
const activeConfig = read(activeConfigPath);
const review = await reviewPreviews(
  executionRoot,
  trainingOutput,
  activeConfig,
);
const qualification = qualifyLateStability(review);
const qualificationPath = path.join(
  executionRoot,
  "late-stability-qualification.json",
);
writeExclusive(qualificationPath, qualification);
const qualified = qualification.qualified;
const finalizationPath = path.join(executionRoot, "finalization.json");
const manifest = read(manifestPath);
writeExclusive(finalizationPath, {
  schemaVersion:
    "stage4-post-decode-object-rgb-controlled-smoke-finalization-v1",
  status: qualified
    ? "post_decode_object_rgb_controlled_smoke_qualified"
    : "post_decode_object_rgb_controlled_smoke_real_visual_failure",
  capabilityVersion,
  attemptId,
  manifest: bind(manifestPath),
  checkpoint: {
    path: manifest.checkpointPath,
    sha256: manifest.checkpointSha256,
    promotable: false,
  },
  machineReview: bind(path.join(executionRoot, "machine-review.json")),
  lateStabilityQualification: bind(qualificationPath),
  automaticRetryStarted: false,
  stage0Started: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc: new Date().toISOString(),
});
const terminalPath = path.join(executionRoot, "phase-terminal.json");
writeExclusive(terminalPath, {
  schemaVersion: "stage4-post-decode-object-rgb-controlled-smoke-terminal-v1",
  executionState: "completed",
  status: qualified
    ? "post_decode_object_rgb_controlled_smoke_qualified"
    : "post_decode_object_rgb_controlled_smoke_real_visual_failure",
  capabilityVersion,
  attemptId,
  finalization: bind(finalizationPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  ownerAuthorizationRequired: false,
  recordedAtUtc: new Date().toISOString(),
});
if (qualified) {
  const evidence = {
    schemaVersion: "ai-painter-capability-stage-evidence-v1",
    capabilityVersion,
    targetState: "controlled_smoke_completed",
    status: "passed",
    bindings: [
      terminalPath,
      finalizationPath,
      manifestPath,
      path.join(executionRoot, "machine-review.json"),
      qualificationPath,
    ].map(bind),
  };
  advanceCapabilityLifecycle({
    root: ROOT,
    capabilityVersion,
    targetState: "controlled_smoke_completed",
    evidence,
    recordedAtUtc: new Date().toISOString(),
  });
}
writeJsonAtomic(path.join(executionRoot, "execution-state.json"), {
  schemaVersion: "stage4-post-decode-object-rgb-smoke-execution-state-v1",
  status: "completed",
  phase: qualified ? "qualified" : "failed_closed",
  capabilityVersion,
  attemptId,
  terminal: bind(terminalPath),
  ownerAuthorizationRequired: false,
  completedAtUtc: new Date().toISOString(),
});
appendAiPainterProgramEvent({
  id: `stage4-post-decode-object-rgb-smoke-${capabilityVersion}-${attemptId}`,
  timestamp: new Date().toISOString(),
  action: "stage4_post_decode_object_rgb_controlled_smoke",
  runId: `${capabilityVersion}-${attemptId}`,
  kind: "controlled_smoke",
  status: qualified ? "success" : "failed_closed",
  title: "Stage4 post-decode object RGB controlled Smoke completed",
  titleZh: qualified
    ? "Stage4解码后对象RGB受控Smoke及自动审核通过"
    : "Stage4解码后对象RGB受控Smoke真实视觉失败并关闭",
  detailZh: `30 Epoch训练自然完成；机器审核${review.previewPassCount}/${review.previewCount}，后期稳定资格=${qualified}。`,
  evidencePath: relative(terminalPath),
  evidenceSha256: sha(terminalPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
});
process.stdout.write(
  `${JSON.stringify({ status: read(terminalPath).status, terminal: bind(terminalPath), manifest: bind(manifestPath), machineReview: bind(path.join(executionRoot, "machine-review.json")), lateStability: bind(qualificationPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, ownerAuthorizationRequired: false }, null, 2)}\n`,
);

function buildActiveConfig(ticketPath, consumptionPath) {
  const config = structuredClone(read(FROZEN_SOURCE));
  delete config.stage4ControlledStructureArm;
  delete config.stage4ResponsibilityComponentRole;
  config.modelId = "ai-painter-stage4-post-decode-object-rgb-controlled-smoke";
  config.architectureVersion = "post-decode-object-rgb-controlled-smoke-v1";
  config.status = "active_local_ai_controlled_smoke";
  config.denoiserArchitecture =
    "stage4_post_decode_authoritative_object_rgb_compositor_v1";
  config.denoiserBaseChannels = 64;
  config.postDecodeObjectRgbIdentityOrder = [
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
  ];
  config.postDecodeObjectRgbInputIdentity = "decoded_rgb_plus_same_class_mask";
  config.postDecodeObjectRgbMerge =
    "authoritative_mask_normalized_rgb_compositor_v1";
  const training = config.training;
  delete training.ownerTrainingAuthorization;
  delete training.factConditionedSemanticMixtureStage4SmokeExecution;
  delete training.stage4AuthoritativeSemanticCarrierSmokeContract;
  delete training.stage4AuthoritativeSemanticCarrierFormalStageContract;
  training.trainingAuthorizationStatus =
    "local_ai_post_decode_object_rgb_controlled_smoke_active";
  training.seed = 20263722;
  training.authorizedOverfitSampleId = SAMPLE_ID;
  training.authorizedInitialization =
    "fixed_project_random_post_decode_object_rgb";
  training.localAiCapabilityTicket = {
    ticketId: `local-ai-${capabilityVersion}-${attemptId}`,
    ticketPath: relative(ticketPath),
    ticketSha256: sha(ticketPath),
    consumptionPath: relative(consumptionPath),
    consumptionSha256: sha(consumptionPath),
    executionState: "consumed",
    status: training.trainingAuthorizationStatus,
    executionActions: ACTIONS,
  };
  training.stage4PostDecodeObjectRgbSmokeContract = {
    status: "active_local_ai_internal_capability",
    sampleId: SAMPLE_ID,
    sampleSplit: "validation",
    seed: 20263722,
    requiredBoundarySides: ["west"],
    epochCount: 30,
    previewEpochs: PREVIEW_EPOCHS,
    resolution: { width: 256, height: 192 },
    initialization: "fixed_project_random_post_decode_object_rgb",
    automaticMachineReview: true,
    automaticLateStabilityQualification: true,
    automaticRetryAllowed: false,
  };
  training.stage4PostDecodeObjectRgbFrozenTrainingContract = {
    sourceConfigPath: relative(FROZEN_SOURCE),
    sourceConfigSha256: FROZEN_SOURCE_SHA,
  };
  if (training.stage4UnifiedTrainingPreviewSamplingContract)
    training.stage4UnifiedTrainingPreviewSamplingContract.status =
      "active_local_ai_internal_capability";
  return config;
}
async function reviewPreviews(executionRoot, trainingOutput, activeConfig) {
  const previewRoot = path.join(trainingOutput, "fixed-epoch-previews");
  const files = fs
    .readdirSync(previewRoot)
    .filter((name) => name.endsWith(".png"))
    .sort((a, b) => epochOf(a) - epochOf(b));
  assert.deepEqual(files.map(epochOf), PREVIEW_EPOCHS);
  const sample =
    activeConfig.training.factConditionedSemanticMixtureSampleBinding;
  const conditionPack = read(inside(sample.conditionPackPath));
  const reviews = [];
  for (const file of files) {
    const epoch = epochOf(file);
    const sourcePath = path.join(previewRoot, file);
    const normalizedPath = path.join(
      executionRoot,
      "review-assets",
      `e${String(epoch).padStart(3, "0")}.png`,
    );
    const normalized = await normalizePreviewWithWindowsSafeIo({
      sourcePath,
      finalAssetPath: normalizedPath,
      workRoot: inside(
        ".runtime/ai-painter/post-decode-object-rgb-review-work",
      ),
      workId: shaText(relative(executionRoot)).slice(0, 16),
      epoch,
    });
    const [aesthetic, alignment] = await Promise.all([
      auditAiAssistedProfessionalAesthetic(normalized.shortOutputPath),
      auditAiAssistedConditionAlignment({
        record: {
          recordId: `post-decode-object-rgb-smoke-${epoch}`,
          conditionBinding: {
            conditionPackPath: sample.conditionPackPath,
            worldId: conditionPack.worldId,
            tick: conditionPack.tick,
          },
          classification: sample.classification,
        },
        imagePath: normalized.shortOutputPath,
        referenceImagePath: sample.imagePath,
      }),
    ]);
    reviews.push({
      epoch,
      previewPath: relative(sourcePath),
      previewSha256: sha(sourcePath),
      normalizedPath: relative(normalizedPath),
      normalizedSha256: sha(normalizedPath),
      passed: aesthetic.passed && alignment.passed,
      issueCodes: [...aesthetic.issues, ...alignment.issues].map(
        (issue) => issue.code,
      ),
      professionalAesthetic: aesthetic,
      conditionAlignment: alignment,
    });
  }
  const report = {
    schemaVersion: "stage4-post-decode-object-rgb-machine-review-v1",
    status: reviews.every((row) => row.passed)
      ? "machine_reviews_passed"
      : "machine_reviews_failed",
    reviewThresholdsChanged: false,
    reviews,
    previewCount: reviews.length,
    previewPassCount: reviews.filter((row) => row.passed).length,
    previewFailCount: reviews.filter((row) => !row.passed).length,
    recordedAtUtc: new Date().toISOString(),
  };
  writeExclusive(path.join(executionRoot, "machine-review.json"), report);
  return report;
}
function qualifyLateStability(review) {
  const late = [10, 20, 30].map((epoch) => {
    const row = review.reviews.find((item) => item.epoch === epoch);
    return {
      epoch,
      failures: row?.issueCodes.length ?? Number.POSITIVE_INFINITY,
      passed: row?.passed === true,
    };
  });
  const counts = late.map((row) => row.failures);
  const sustainedZero = counts.every((value) => value === 0);
  const decreaseThenZero = counts[2] === 0 && counts[1] === 0 && counts[0] > 0;
  const qualified = Boolean(
    late[1].passed && late[2].passed && (sustainedZero || decreaseThenZero),
  );
  return {
    schemaVersion:
      "stage4-post-decode-object-rgb-late-stability-qualification-v1",
    status: qualified ? "qualified" : "not_qualified",
    qualified,
    route: sustainedZero
      ? "sustained_zero_from_first_late_epoch"
      : decreaseThenZero
        ? "strict_decrease_then_stable_zero"
        : null,
    lateTimeline: late,
    terminalRegression: !late[2].passed,
    thresholdChanged: false,
    recordedAtUtc: new Date().toISOString(),
  };
}
function validateContract(value) {
  assert.equal(
    value.schemaVersion,
    "stage4-post-decode-object-rgb-controlled-smoke-contract-v1",
  );
  assert.equal(value.status, "compiled_not_started");
  assert.equal(value.capabilityVersion, capabilityVersion);
  assert.equal(value.ownerAuthorizationRequired, false);
  assert.equal(value.epochCount, 30);
  assert.deepEqual(value.previewEpochs, PREVIEW_EPOCHS);
}
function resourceSnapshot() {
  const gpu = spawnSync(
    "nvidia-smi",
    [
      "--query-gpu=name,utilization.gpu,memory.used,memory.free",
      "--format=csv,noheader,nounits",
    ],
    { encoding: "utf8", windowsHide: true },
  );
  const parts = gpu.stdout
    .trim()
    .split(",")
    .map((value) => value.trim());
  const processes = spawnSync(
    "nvidia-smi",
    ["--query-compute-apps=pid,process_name", "--format=csv,noheader,nounits"],
    { encoding: "utf8", windowsHide: true },
  );
  const python = processes.stdout
    .split(/\r?\n/u)
    .filter((row) => /python/iu.test(row));
  const disk = fs.statfsSync(ROOT);
  const diskFreeBytes = Number(disk.bavail) * Number(disk.bsize);
  const blockers = [];
  if (gpu.status !== 0) blockers.push("cuda_unavailable");
  if (Number(parts[1]) > 10) blockers.push("gpu_not_idle");
  if (Number(parts[3]) < 4096) blockers.push("gpu_memory_insufficient");
  if (python.length) blockers.push("python_gpu_process_active");
  if (diskFreeBytes < 4 * 1024 ** 3) blockers.push("disk_insufficient");
  return {
    schemaVersion: "stage4-post-decode-object-rgb-resource-preflight-v1",
    passed: blockers.length === 0,
    blockers,
    cpuLogicalProcessors: os.cpus().length,
    memoryFreeBytes: os.freemem(),
    diskFreeBytes,
    gpu: {
      name: parts[0],
      utilizationPercent: Number(parts[1]),
      memoryUsedMiB: Number(parts[2]),
      memoryFreeMiB: Number(parts[3]),
      pythonComputeProcesses: python,
    },
    recordedAtUtc: new Date().toISOString(),
  };
}
function closeFailure(code, detail) {
  const finalization = path.join(executionRoot, "failure-finalization.json");
  writeExclusive(finalization, {
    schemaVersion: "stage4-post-decode-object-rgb-smoke-failure-v1",
    status: "failed_closed",
    code,
    detail: String(detail),
    automaticRetryStarted: false,
    ownerAuthorizationRequired: false,
    recordedAtUtc: new Date().toISOString(),
  });
  const terminal = path.join(executionRoot, "phase-terminal.json");
  writeExclusive(terminal, {
    schemaVersion: "stage4-post-decode-object-rgb-controlled-smoke-terminal-v1",
    executionState: "failed",
    status:
      "post_decode_object_rgb_controlled_smoke_infrastructure_failed_closed",
    blocker: code,
    finalization: bind(finalization),
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    ownerAuthorizationRequired: false,
    recordedAtUtc: new Date().toISOString(),
  });
  writeJsonAtomic(path.join(executionRoot, "execution-state.json"), {
    status: "failed_closed",
    terminal: bind(terminal),
  });
  throw new Error(`${code}:${detail}`);
}
function required(flag) {
  const index = process.argv.indexOf(flag);
  assert(index >= 0 && process.argv[index + 1], `missing ${flag}`);
  return process.argv[index + 1];
}
function inside(rel) {
  assert.ok(
    typeof rel === "string" &&
      rel &&
      !path.isAbsolute(rel) &&
      !rel.split(/[\\/]/u).includes(".."),
  );
  const value = path.resolve(ROOT, rel);
  assert.ok(value.startsWith(`${path.resolve(ROOT)}${path.sep}`));
  return value;
}
function relative(file) {
  return path.relative(ROOT, file).replaceAll("\\", "/");
}
function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function sha(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}
function shaText(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function bind(file) {
  return { path: relative(file), sha256: sha(file) };
}
function writeExclusive(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}
function pythonEnv() {
  return {
    ...process.env,
    PYTHONUTF8: "1",
    PYTHONPATH: `${inside("ml/ai-painter/src")};${inside("ml/ai-painter/scripts")}`,
  };
}
function epochOf(file) {
  return Number(file.match(/epoch-(\d+)/u)?.[1]);
}
