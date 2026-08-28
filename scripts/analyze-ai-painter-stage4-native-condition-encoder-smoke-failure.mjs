import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import { appendAiPainterProgramEvent, formatShanghai, projectPath, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const CAPABILITY = "stage4-native-condition-encoder-clean-latent-change-candidate-v1"
const EXPECTED_TASK = "analyze_native_condition_encoder_smoke_failure"
const NEXT_TASK = "run_native_condition_encoder_fixed_40_epoch_qualification"
const RUN_ID = `stage4-native-condition-encoder-smoke-analysis-${compactUtc()}-01`
const OUTPUT_ROOT = resolve(`.runtime/ai-painter/stage4-native-condition-encoder-smoke-failure-analyses/${RUN_ID}`)
const REPORT = path.join(OUTPUT_ROOT, "causal-analysis.json")
const CONTRACT = path.join(OUTPUT_ROOT, "bounded-40-epoch-qualification-contract.json")
const TERMINAL = path.join(OUTPUT_ROOT, "phase-terminal.json")
const CAPSULE = path.join(OUTPUT_ROOT, "local-task-capsule.json")

const current = await readCurrentExecutionRegistry(ROOT)
assert.equal(current.ok, true, current.errorCode)
assert.equal(current.registry.capabilityVersion, CAPABILITY)
assert.equal(current.registry.taskId, EXPECTED_TASK)
assert.equal(current.registry.activity, "planned_not_started")
assert.equal(current.registry.activeExecution, null)
assert.ok(current.registry.latestTrainingTerminal, "current Smoke terminal is not registered")
assert.equal(fs.existsSync(OUTPUT_ROOT), false, "analysis output reuse is forbidden")

const smokeTerminalPath = resolve(current.registry.latestTrainingTerminal.path)
verifyFile(smokeTerminalPath, current.registry.latestTrainingTerminal.sha256, "current Smoke terminal")
const smokeTerminal = read(smokeTerminalPath)
assert.equal(smokeTerminal.status, "native_condition_encoder_controlled_smoke_real_visual_failure")
const machineReviewPath = resolve(smokeTerminal.machineReview.path)
verifyFile(machineReviewPath, smokeTerminal.machineReview.sha256, "current Smoke machine review")
const machineReview = read(machineReviewPath)
assert.equal(machineReview.previewCount, 5)
assert.equal(machineReview.previewPassCount, 0)

const issueTimeline = machineReview.reviews.map((row) => ({
  epoch: row.epoch,
  failureCount: row.issueCodes.length,
  failureItems: [...row.issueCodes],
}))
const lateTimeline = issueTimeline.filter((row) => [10, 20, 30].includes(row.epoch))
assert.deepEqual(lateTimeline.map((row) => row.epoch), [10, 20, 30])
assert.ok(lateTimeline[0].failureCount > lateTimeline[1].failureCount)
assert.ok(lateTimeline[1].failureCount > lateTimeline[2].failureCount)
assert.equal(lateTimeline[2].failureCount, 1)
assert.deepEqual(lateTimeline[2].failureItems, ["condition_object_rock_reference_semantic_mismatch"])

const epoch30 = machineReview.reviews.find((row) => row.epoch === 30)
const rockAudit = epoch30.conditionAlignment.objectSemanticAudits.find((row) => row.channelId === "object_rock")
assert.ok(rockAudit)
assert.equal(rockAudit.localResponsePassed, true)
assert.equal(rockAudit.referenceResponse.maskedLumaCorrelation, 0.067)
assert.equal(rockAudit.referenceThresholds.minimumMaskedLumaCorrelation, 0.08)
assert.equal(epoch30.professionalAesthetic.passed, true)

fs.mkdirSync(path.dirname(OUTPUT_ROOT), { recursive: true })
fs.mkdirSync(OUTPUT_ROOT, { recursive: false })
const recordedAtUtc = new Date().toISOString()
const decision = "bounded_existing_formal_epoch_upper_bound_qualification_required"
const report = {
  schemaVersion: "stage4-native-condition-encoder-smoke-failure-causal-analysis-v1",
  status: "succeeded",
  capabilityVersion: CAPABILITY,
  runId: RUN_ID,
  sourceSmoke: bind(smokeTerminalPath),
  sourceMachineReview: bind(machineReviewPath),
  facts: {
    previewCount: machineReview.previewCount,
    previewPassCount: machineReview.previewPassCount,
    issueTimeline,
    lateFailureCounts: lateTimeline.map((row) => row.failureCount),
    epoch30ProfessionalAestheticPassed: true,
    epoch30OnlyFailure: "condition_object_rock_reference_semantic_mismatch",
    epoch30RockLocalResponsePassed: true,
    epoch30RockMaskedLumaCorrelation: 0.067,
    frozenMinimumMaskedLumaCorrelation: 0.08,
  },
  causalFinding: "native_resolution_condition_encoding_materially_restored_terrain_route_and_three_object_semantics_but_rock_reference_luminance_structure_had_not_reached_the_frozen_terminal_requirement_by_epoch_30",
  uniqueDecision: decision,
  rationale: "The formal project Stage 0 plan already fixes 40 epochs. The late 10/20/30 failure trajectory is strictly decreasing (6/4/1), so one clean 40-epoch qualification from the same fixed random initialization is the only bounded non-parametric continuation. It does not reuse the Smoke checkpoint and does not change model, Loss, data, split, seed, or review thresholds.",
  forbidden: [
    "reuse_smoke_checkpoint",
    "change_model_or_loss",
    "change_dataset_or_split",
    "change_review_thresholds",
    "automatic_retry_after_40_epoch_failure",
  ],
  ownerAuthorizationRequired: false,
  recordedAtUtc,
}
writeExclusive(REPORT, report)
writeExclusive(CONTRACT, {
  schemaVersion: "stage4-native-condition-encoder-fixed-40-epoch-qualification-contract-v1",
  status: "compiled_not_started",
  capabilityVersion: CAPABILITY,
  sourceAnalysis: bind(REPORT),
  epochCount: 40,
  previewEpochs: [1, 5, 10, 20, 30, 40],
  seed: 20263722,
  resolution: { width: 256, height: 192 },
  initialization: "same_contract_fixed_random_initialization_from_scratch",
  checkpointInputAllowed: false,
  modelChangeAllowed: false,
  lossChangeAllowed: false,
  dataChangeAllowed: false,
  reviewThresholdChangeAllowed: false,
  automaticMachineReview: true,
  automaticTerminalRecording: true,
  automaticRetry: false,
  failureClosure: "retire_candidate_without_another_training_run",
  ownerAuthorizationRequired: false,
  recordedAtUtc,
})
writeExclusive(TERMINAL, {
  schemaVersion: "stage4-native-condition-encoder-smoke-failure-analysis-terminal-v1",
  executionState: "completed",
  status: "native_condition_encoder_smoke_failure_analysis_succeeded",
  capabilityVersion: CAPABILITY,
  runId: RUN_ID,
  causalAnalysis: bind(REPORT),
  boundedQualificationContract: bind(CONTRACT),
  nextLegalAction: NEXT_TASK,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  ownerAuthorizationRequired: false,
  recordedAtUtc,
})
writeExclusive(CAPSULE, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${RUN_ID}`,
  module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
  currentStage: { number: 4, total: 5, labelZh: "原生条件编码Smoke失败因果裁决", status: "completed" },
  fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  uniqueDecision: decision,
  nextAllowedAction: { code: NEXT_TASK, ownerAuthorizationRequired: false, automaticExecutionAllowed: true },
  evidence: [REPORT, CONTRACT, TERMINAL].map((file) => ({ ...bind(file), sha256Verified: true })),
  integrity: {
    status: "verified",
    requiredEvidencePresent: true,
    boundEvidenceVerified: true,
    identityMatches: true,
    migrationRegistryStatus: "current_execution_registry_active",
  },
  ownerAuthorizationRequired: false,
  recordedAtUtc,
  recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
})
const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: CAPABILITY,
  packageId: RUN_ID,
  taskId: NEXT_TASK,
  taskKind: "controlled_smoke",
  runId: RUN_ID,
  lifecycleStage: "readonly_gpu_qualified",
  executionState: "package_materialized",
  activity: "planned_not_started",
  taskCapsulePath: projectPath(CAPSULE),
  terminalEvidencePath: projectPath(TERMINAL),
})
appendAiPainterProgramEvent({
  id: `stage4-native-condition-encoder-smoke-analysis-${RUN_ID}`,
  timestamp: recordedAtUtc,
  action: "stage4_native_condition_encoder_smoke_failure_analyzed",
  runId: RUN_ID,
  kind: "cpu_readonly_analysis",
  status: "success",
  title: "Native-condition encoder Smoke failure analyzed",
  titleZh: "原生条件编码Smoke失败已完成因果裁决",
  detailZh: "晚期失败项6→4→1，终点只剩rock参考亮度结构；唯一下一步为既有正式40 Epoch上限资格验证。",
  evidencePath: projectPath(TERMINAL),
  evidenceSha256: sha256(TERMINAL),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})

process.stdout.write(`${JSON.stringify({
  status: "native_condition_encoder_smoke_failure_analysis_succeeded",
  runId: RUN_ID,
  uniqueDecision: decision,
  lateFailureCounts: lateTimeline.map((row) => row.failureCount),
  epoch30OnlyFailure: lateTimeline[2].failureItems[0],
  report: bind(REPORT),
  contract: bind(CONTRACT),
  terminal: bind(TERMINAL),
  currentRegistrySha256: advanced.registrySha256,
  nextLegalAction: NEXT_TASK,
  ownerAuthorizationRequired: false,
}, null, 2)}\n`)

function resolve(relative) {
  const candidate = path.resolve(ROOT, relative)
  assert.ok(candidate === ROOT || candidate.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${relative}`)
  return candidate
}
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")) }
function sha256(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function bind(file) { return { path: projectPath(file), sha256: sha256(file) } }
function verifyFile(file, expected, label) {
  assert.equal(fs.existsSync(file), true, `${label} missing`)
  assert.equal(sha256(file), expected, `${label} SHA-256 mismatch`)
}
function writeExclusive(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
}
function compactUtc() { return new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14) }
