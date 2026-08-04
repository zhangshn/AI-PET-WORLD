import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const OUTPUT_ROOT = ".runtime/ai-painter/v7-repaired-training-chain-checks"
const expectedSplits = { train: 48, validation: 8, challenge: 4, regression: 4 }
const runIds = {
  smoke: "ai-assisted-conditional-denoiser-v7-smoke-2026-08-02T04-55-35-881Z",
  stage0: "ai-assisted-conditional-denoiser-v7-stage-0-2026-08-02T04-56-52-635Z",
  stage1: "ai-assisted-conditional-denoiser-v7-stage-1-2026-08-02T05-08-54-120Z",
  stage2: "ai-assisted-conditional-denoiser-v7-stage-2-2026-08-02T05-20-16-111Z",
}
const legacyRunIds = [
  "ai-assisted-conditional-denoiser-v7-stage-0-2026-08-02T02-29-32-223Z",
  "ai-assisted-conditional-denoiser-v7-stage-1-2026-08-02T02-32-41-839Z",
  "ai-assisted-conditional-denoiser-v7-stage-2-2026-08-02T02-37-06-789Z",
]
const modelRoot = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7"
const authorizationPath = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-mvp64-training-sample-binding-repair-retrain-resolution-20260802/request.json"
const ledgerPath = ".runtime/ai-painter/training-process-ledger/events.jsonl"

const manifests = Object.fromEntries(Object.entries(runIds).map(([key, runId]) => {
  const manifestPath = `${modelRoot}/${runId}/manifest.json`
  return [key, { runId, manifestPath, manifest: readJson(manifestPath) }]
}))
const checks = []
for (const [key, item] of Object.entries(manifests)) {
  const manifest = item.manifest
  check(`${key}_manifest_exists`, Boolean(manifest), item.manifestPath)
  check(`${key}_checkpoint_exists`, exists(manifest?.checkpointPath), manifest?.checkpointPath)
  check(`${key}_checkpoint_hash_matches`, sha256(manifest?.checkpointPath) === manifest?.checkpointSha256, manifest?.checkpointSha256)
  check(`${key}_loads_exactly_64`, manifest?.actualLoadedConditionalSampleCount === 64, manifest?.actualLoadedConditionalSampleCount)
  check(`${key}_loads_exactly_64_v7`, manifest?.actualLoadedV7CapacityCount === 64, manifest?.actualLoadedV7CapacityCount)
  check(`${key}_split_48_8_4_4`, sameCounts(manifest?.actualLoadedSplitCounts, expectedSplits), manifest?.actualLoadedSplitCounts)
  check(`${key}_formal_inference_blocked`, manifest?.formalInferenceEligible === false, manifest?.formalInferenceEligible)
}

check("stage0_has_no_parent", manifests.stage0.manifest?.parentDenoiserCheckpointPath == null && manifests.stage0.manifest?.parentDenoiserCheckpointSha256 == null, {
  path: manifests.stage0.manifest?.parentDenoiserCheckpointPath,
  sha256: manifests.stage0.manifest?.parentDenoiserCheckpointSha256,
})
check("stage1_parent_is_repaired_stage0", manifests.stage1.manifest?.parentDenoiserCheckpointSha256 === manifests.stage0.manifest?.checkpointSha256, manifests.stage1.manifest?.parentDenoiserCheckpointSha256)
check("stage2_parent_is_repaired_stage1", manifests.stage2.manifest?.parentDenoiserCheckpointSha256 === manifests.stage1.manifest?.checkpointSha256, manifests.stage2.manifest?.parentDenoiserCheckpointSha256)

for (const legacyRunId of legacyRunIds) {
  check(`legacy_preserved_${legacyRunId}`, exists(`${modelRoot}/${legacyRunId}/manifest.json`), legacyRunId)
}
const repairedParents = [
  manifests.stage1.manifest?.parentDenoiserCheckpointPath,
  manifests.stage2.manifest?.parentDenoiserCheckpointPath,
].filter(Boolean).join("\n")
check("legacy_checkpoint_not_reused", legacyRunIds.every((runId) => !repairedParents.includes(runId)), repairedParents)

const authorization = readJson(authorizationPath)
check("repair_authorization_is_resolved", authorization?.status === "resolved_owner_authorized", authorization?.status)
check("post_training_validation_not_authorized", authorization?.resolution?.postTrainingValidationAuthorized === false, authorization?.resolution?.postTrainingValidationAuthorized)
check("runtime_frame_not_authorized", authorization?.resolution?.runtimeFrameAuthorized === false, authorization?.resolution?.runtimeFrameAuthorized)
check("world_entry_not_authorized", authorization?.resolution?.worldEntryAuthorized === false, authorization?.resolution?.worldEntryAuthorized)

const authorizationTime = Date.parse(authorization?.recordedAtUtc ?? "")
const events = readJsonLines(ledgerPath)
const forbiddenSuccessfulEvents = events.filter((event) => {
  const afterAuthorization = Number.isFinite(authorizationTime) && Date.parse(event.timestamp ?? "") >= authorizationTime
  const successful = event.status === "success" || event.status === "running"
  const prohibitedAction = /(formal.*inference|runtime[_-]?frame|enter.*world|start.*world)/i.test(String(event.action ?? ""))
  return afterAuthorization && successful && prohibitedAction
})
check("no_unauthorized_post_training_or_world_action", forbiddenSuccessfulEvents.length === 0, forbiddenSuccessfulEvents)

const gpu = readGpuSnapshot()
check("gpu_training_load_is_idle", gpu.utilizationPercent === null || gpu.utilizationPercent <= 5, gpu)
check("no_python_gpu_training_process", gpu.pythonComputeProcessCount === 0, gpu)

const failedChecks = checks.filter((item) => !item.passed)
if (failedChecks.length) {
  throw new Error(`repaired V7 training chain check failed: ${failedChecks.map((item) => item.id).join(", ")}`)
}

const createdAtUtc = new Date().toISOString()
const runId = `ai-assisted-v7-repaired-training-chain-check-${createdAtUtc.replace(/[:.]/g, "-")}`
const report = {
  schemaVersion: "ai-assisted-v7-repaired-training-chain-check-v1",
  status: "repaired_v7_training_chain_completed_pending_post_training_validation",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  authorizationId: authorization?.requestId ?? null,
  datasetBinding: {
    actualLoadedConditionalSampleCount: 64,
    actualLoadedV7CapacityCount: 64,
    actualLoadedSplitCounts: expectedSplits,
    legacyLoadedCount: 0,
  },
  chain: Object.fromEntries(Object.entries(manifests).map(([key, item]) => [key, {
    runId: item.runId,
    manifestPath: item.manifestPath,
    manifestSha256: sha256(item.manifestPath),
    checkpointPath: item.manifest.checkpointPath,
    checkpointSha256: item.manifest.checkpointSha256,
    parentCheckpointPath: item.manifest.parentDenoiserCheckpointPath ?? null,
    parentCheckpointSha256: item.manifest.parentDenoiserCheckpointSha256 ?? null,
    bestEpoch: item.manifest.bestEpoch ?? null,
    status: item.manifest.status,
  }])),
  legacyRunsPreserved: legacyRunIds,
  gpuAfterTraining: gpu,
  boundaries: {
    postTrainingValidationStarted: false,
    formalInferenceEligible: false,
    formalInferenceStarted: false,
    runtimeFrameStarted: false,
    worldEntered: false,
  },
  checks,
  nextActionRequiresOwnerAuthorization: "post_training_validation",
}

appendAiPainterProgramEvent({
  action: "check_ai_assisted_v7_repaired_training_chain",
  runId,
  kind: "verification_started",
  status: "running",
  title: "V7 repaired training chain verification started",
  titleZh: "V7修复后训练链核验已开始",
  currentStep: "verify_repaired_smoke_stage_0_1_2",
  evidencePath: projectPath(authorizationPath),
  finalGameMapSuccess: false,
  canEnterWorld: false,
})
const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "check-report.json",
  record: report,
  latest: {
    actualLoadedV7CapacityCount: 64,
    stage2CheckpointSha256: manifests.stage2.manifest.checkpointSha256,
    formalInferenceEligible: false,
  },
})
appendAiPainterProgramEvent({
  action: "check_ai_assisted_v7_repaired_training_chain",
  runId,
  kind: "verification_completed",
  status: "success",
  title: "V7 repaired training chain verification completed",
  titleZh: "V7修复后训练链核验完成",
  detail: "actualLoadedV7CapacityCount=64; split=48/8/4/4; stage0->stage1->stage2 lineage valid; formal inference remains blocked",
  detailZh: "实际加载V7容量64条，分割48/8/4/4，Stage 0→1→2父链有效；正式推理仍保持阻断。",
  currentStep: "pending_post_training_validation",
  evidencePath: stored.runPath,
  nextAction: "wait_for_owner_authorization_for_post_training_validation",
  nextActionZh: "等待项目所有者另行授权训练后验证。",
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

console.log(JSON.stringify({
  ok: true,
  status: report.status,
  reportPath: stored.runPath,
  reportSha256: sha256(stored.runPath),
  stage2CheckpointSha256: manifests.stage2.manifest.checkpointSha256,
  actualLoadedV7CapacityCount: 64,
  actualLoadedSplitCounts: expectedSplits,
  formalInferenceEligible: false,
}, null, 2))

function check(id, passed, actual) {
  checks.push({ id, passed: Boolean(passed), actual })
}

function absolute(value) {
  return value ? path.resolve(ROOT, value) : null
}

function exists(value) {
  const target = absolute(value)
  return Boolean(target && fs.existsSync(target))
}

function readJson(value) {
  const target = absolute(value)
  return target && fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, "utf8")) : null
}

function readJsonLines(value) {
  const target = absolute(value)
  if (!target || !fs.existsSync(target)) return []
  return fs.readFileSync(target, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
}

function sha256(value) {
  const target = absolute(value)
  if (!target || !fs.existsSync(target)) return null
  return createHash("sha256").update(fs.readFileSync(target)).digest("hex")
}

function sameCounts(actual, expected) {
  return Object.entries(expected).every(([key, value]) => actual?.[key] === value)
}

function readGpuSnapshot() {
  const query = spawnSync("nvidia-smi", [
    "--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu",
    "--format=csv,noheader,nounits",
  ], { encoding: "utf8", windowsHide: true })
  const [name = null, utilization = null, memoryUsed = null, memoryTotal = null, temperature = null] = query.status === 0
    ? query.stdout.trim().split(",").map((value) => value.trim())
    : []
  const processes = spawnSync("nvidia-smi", [
    "--query-compute-apps=pid,process_name",
    "--format=csv,noheader,nounits",
  ], { encoding: "utf8", windowsHide: true })
  const processRows = processes.status === 0 ? processes.stdout.split(/\r?\n/).filter(Boolean) : []
  return {
    available: query.status === 0,
    name,
    utilizationPercent: utilization === null ? null : Number(utilization),
    memoryUsedMiB: memoryUsed === null ? null : Number(memoryUsed),
    memoryTotalMiB: memoryTotal === null ? null : Number(memoryTotal),
    temperatureCelsius: temperature === null ? null : Number(temperature),
    pythonComputeProcessCount: processRows.filter((row) => /python/i.test(row)).length,
  }
}
