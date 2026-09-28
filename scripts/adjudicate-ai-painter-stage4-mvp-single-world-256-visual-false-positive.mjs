import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const SOURCE_CAPABILITY = "stage4_mvp_native_complete_rgb_object_crop_renderer_v8"
const REJECTED_CAPABILITY = "stage4_mvp_single_thailand_natural_world_256_v1"
const PACKAGE_ID = "mvp-single-natural-world-256-visual-false-positive-v1"
const SOURCE_RUN_ID = "mvp-stage0-99497fdd09536b4aacd3314b980f7caccd0de7838d29cb3e"
const TASK_ID = `${SOURCE_RUN_ID}-visual-false-positive-adjudicated`
const OUTPUT_ROOT = `.runtime/ai-painter/stage4-mvp-single-natural-world-256-false-positive-adjudications/${SOURCE_RUN_ID}`
const TERMINAL_PATH = `${OUTPUT_ROOT}/terminal.json`
const CAPSULE_PATH = `${OUTPUT_ROOT}/task-capsule.json`

const args = parseArgs(process.argv.slice(2))
const detailReviewBinding = {
  path: required(args, "detail-review").replaceAll("\\", "/"),
  sha256: required(args, "detail-review-sha256"),
}
const detailReview = readBoundJson(detailReviewBinding, "detailReview")
assert.equal(detailReview.schemaVersion, "stage4-mvp-256-detail-sufficiency-review-v1")
assert.equal(detailReview.status, "stage4_mvp_256_detail_sufficiency_review_failed")
assert.equal(detailReview.executionState, "completed")
assert.equal(detailReview.runId, SOURCE_RUN_ID)
assert.equal(detailReview.architectureId, SOURCE_CAPABILITY)
assert.equal(detailReview.candidateCount, 8)
assert.equal(detailReview.candidatePassCount, 0)
assert.equal(detailReview.candidateFailCount, 8)
assert.equal(detailReview.boundary?.readOnly, true)
assert.equal(detailReview.boundary?.trainingAllowed, false)
assert.equal(detailReview.boundary?.weightsModified, false)
assert.equal(detailReview.boundary?.historicalReviewEvidenceModified, false)
assert.equal(detailReview.reviews.every((review) => review.passed === false), true)
const selectedReview = detailReview.reviews.find((review) => review.sampleIndex === 6)
assert.ok(selectedReview, "historically selected candidate detail review missing")
assert.equal(selectedReview.sampleId, "ai-cold-start-v7-v7-capacity-slot-200-forested-low-mountain-v2")
assert.deepEqual(selectedReview.issueCodes, ["professional_reference_relative_detail_insufficient"])

const current = await readCurrentExecutionRegistry(ROOT)
assert.equal(current.ok, true, current.errorCode ?? "current registry invalid")
if (current.registry.taskId === TASK_ID) {
  assert.equal(current.registry.terminalEvidence.path, TERMINAL_PATH)
  assert.equal(current.currentTaskTerminal.detailReview.sha256, detailReviewBinding.sha256)
  process.stdout.write(`${JSON.stringify({
    status: current.currentTaskTerminal.status,
    registryRevision: current.registry.registryRevision,
    recoveredCommittedResult: true,
  }, null, 2)}\n`)
  process.exit(0)
}
assert.equal(current.registry.activeExecution, null, "active execution blocks false-positive adjudication")
assert.equal(current.registry.capabilityVersion, REJECTED_CAPABILITY)
assert.equal(current.registry.lifecycleStage, "mvp_single_world_256_model_slice_accepted")
assert.equal(current.currentTaskTerminal.status, "mvp_single_natural_world_256_model_slice_accepted")
assert.equal(current.currentTaskTerminal.mvpModelSliceCompleted, true)
assert.equal(current.currentTaskTerminal.machineReview.sha256, "63ac039af5c828816ed6485c84be7b112b63b1c018622506c4b6363dd41df429")
const supersededTerminalBinding = current.registry.terminalEvidence
const supersededCapsuleBinding = current.registry.taskCapsule
const detailContractBinding = detailReview.contract
readBoundJson(detailContractBinding, "detailContract")
const historicalMachineReviewBinding = current.currentTaskTerminal.machineReview
const historicalMachineReview = readBoundJson(historicalMachineReviewBinding, "historicalMachineReview")
assert.equal(historicalMachineReview.candidatePassCount, 1)
assert.equal(historicalMachineReview.reviews.find((review) => review.sampleIndex === 6)?.passed, true)

const recordedAtUtc = fs.existsSync(inside(TERMINAL_PATH))
  ? JSON.parse(fs.readFileSync(inside(TERMINAL_PATH), "utf8")).recordedAtUtc
  : new Date().toISOString()
const terminal = {
  schemaVersion: "stage4-mvp-single-natural-world-256-visual-false-positive-terminal-v1",
  executionState: "failed_closed",
  status: "mvp_single_natural_world_256_visual_false_positive_rejected",
  capabilityVersion: REJECTED_CAPABILITY,
  sourceCapabilityVersion: SOURCE_CAPABILITY,
  packageId: PACKAGE_ID,
  runId: SOURCE_RUN_ID,
  supersededAcceptanceTerminal: supersededTerminalBinding,
  historicalMachineReview: historicalMachineReviewBinding,
  detailReview: detailReviewBinding,
  detailReviewContract: detailContractBinding,
  adjudication: {
    historicalMachineReviewFalsePositive: true,
    historicalProfessionalAuditOnlyEnforcedTextureUpperBounds: true,
    candidateCount: 8,
    detailPassCount: 0,
    detailFailCount: 8,
    historicallySelectedSampleIndex: 6,
    historicallySelectedSampleId: selectedReview.sampleId,
    selectedCandidateRatios: selectedReview.ratios,
    selectedCandidateIssueCodes: selectedReview.issueCodes,
    mvpVisualAccepted: false,
    mvpModelSliceCompleted: false,
    sourceTrainingCompleted: true,
    sourceCheckpointPreserved: true,
    fullStage4Completed: false,
    fixedStageProgressPercent: 60,
  },
  preservation: {
    originalTrainingEvidenceModified: false,
    historicalMachineReviewModified: false,
    historicalAcceptanceEvidenceModified: false,
    originalImagesModified: false,
    datasetSplitsModified: false,
    checkpointWeightsModified: false,
    trainingStarted: false,
    gpuStarted: false,
  },
  nextBoundedAction: "design_and_cpu_validate_mvp_256_detail_recovery_successor",
  nextMachineAction: null,
  recordedAtUtc,
}
writeOrVerifyJson(TERMINAL_PATH, terminal)
const terminalBinding = bind(TERMINAL_PATH)
const capsule = {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${TASK_ID}`,
  generatedFrom: "verified_false_positive_detail_reassessment",
  readOnly: true,
  module: { id: "ai-painter-stage4-mvp", nameZh: "AI Painter单一自然世界256视觉误判裁决" },
  fixedOverallProgress: {
    completedStages: 3,
    totalStages: 5,
    percent: 60,
    source: "full_stage4_historical_progress_unchanged",
  },
  mvpSliceProgress: {
    status: terminal.status,
    trainingExecutionCompleted: true,
    modelSliceCompleted: false,
    visualAccepted: false,
    fullStage4Completed: false,
  },
  currentStage: {
    number: 4,
    total: 5,
    labelZh: "256×192训练结果视觉质量收口",
    status: terminal.status,
  },
  candidateTerminal: { runId: SOURCE_RUN_ID, status: terminal.status, recordedAtUtc },
  latestBlocker: {
    code: "professional_reference_relative_detail_insufficient",
    summaryZh: "8张候选全部严重过度平滑；历史审核缺少最低细节门禁，原1张通过结论为假阳性。",
  },
  nextAllowedAction: terminal.nextBoundedAction,
  forbiddenActions: [
    "claim_mvp_visual_acceptance",
    "claim_single_world_model_slice_completion",
    "claim_full_stage4_completion",
    "publish_runtime_or_approved_frame",
    "modify_historical_evidence",
    "lower_machine_review_threshold",
    "automatic_retry_without_bounded_successor_contract",
  ],
  taskIdentity: { modelId: REJECTED_CAPABILITY, runId: SOURCE_RUN_ID },
  latestTerminal: terminalBinding,
  evidence: [
    { kind: "superseded_acceptance_terminal", ...supersededTerminalBinding, sha256Verified: true },
    { kind: "superseded_acceptance_capsule", ...supersededCapsuleBinding, sha256Verified: true },
    { kind: "historical_machine_review", ...historicalMachineReviewBinding, sha256Verified: true },
    { kind: "detail_sufficiency_contract", ...detailContractBinding, sha256Verified: true },
    { kind: "detail_sufficiency_review", ...detailReviewBinding, sha256Verified: true },
    { kind: "visual_false_positive_terminal", ...terminalBinding, sha256Verified: true },
  ],
  integrity: {
    status: "verified",
    requiredEvidencePresent: true,
    boundEvidenceVerified: true,
    identityMatches: true,
  },
}
writeOrVerifyJson(CAPSULE_PATH, capsule)
const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: REJECTED_CAPABILITY,
  packageId: PACKAGE_ID,
  taskId: TASK_ID,
  taskKind: "mvp_single_world_256_visual_false_positive_adjudication",
  taskGoal: "Reject the unsafe single-world MVP visual acceptance while preserving the completed local training and all immutable evidence.",
  priority: 1,
  queueStatus: "failed_closed",
  nextMachineAction: null,
  queuedAtUtc: recordedAtUtc,
  runId: SOURCE_RUN_ID,
  lifecycleStage: "mvp_256_visual_acceptance_rejected",
  executionState: "failed_closed",
  activity: terminal.status,
  taskCapsulePath: CAPSULE_PATH,
  terminalEvidencePath: TERMINAL_PATH,
  activeExecution: null,
  expectedPreviousRegistryRevision: current.registry.registryRevision,
  expectedPreviousRegistrySha256: current.registrySha256,
})
process.stdout.write(`${JSON.stringify({
  status: terminal.status,
  registryRevision: advanced.registry.registryRevision,
  detailPassCount: 0,
  detailFailCount: 8,
  fixedStageProgressPercent: 60,
  nextBoundedAction: terminal.nextBoundedAction,
}, null, 2)}\n`)

function parseArgs(values) {
  const parsed = new Map()
  for (let index = 0; index < values.length; index += 2) {
    assert.ok(values[index]?.startsWith("--"), "invalid argument")
    assert.ok(values[index + 1] && !values[index + 1].startsWith("--"), `missing value for ${values[index]}`)
    parsed.set(values[index].slice(2), values[index + 1])
  }
  return parsed
}
function required(values, name) { const value = values.get(name); assert.ok(value, `--${name} is required`); return value }
function inside(logicalPath) {
  assert.equal(path.isAbsolute(logicalPath), false, "project-relative path required")
  const resolved = path.resolve(ROOT, logicalPath)
  assert.ok(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), "path escapes project")
  return resolved
}
function sha256File(filePath) { return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex") }
function projectPath(filePath) { return path.relative(ROOT, path.resolve(filePath)).replaceAll("\\", "/") }
function bind(logicalPath) { const absolute = inside(logicalPath); return { path: projectPath(absolute), sha256: sha256File(absolute) } }
function verifyBinding(binding, role) {
  assert.ok(binding && typeof binding === "object", `${role} binding missing`)
  assert.match(binding.sha256 ?? "", /^[a-f0-9]{64}$/u, `${role} SHA-256 invalid`)
  const absolute = inside(binding.path)
  assert.equal(fs.statSync(absolute).isFile(), true, `${role} is not a file`)
  assert.equal(sha256File(absolute), binding.sha256, `${role} SHA-256 mismatch`)
  return absolute
}
function readBoundJson(binding, role) { return JSON.parse(fs.readFileSync(verifyBinding(binding, role), "utf8")) }
function writeOrVerifyJson(logicalPath, value) {
  const absolute = inside(logicalPath)
  const content = `${JSON.stringify(value, null, 2)}\n`
  fs.mkdirSync(path.dirname(absolute), { recursive: true })
  if (fs.existsSync(absolute)) {
    assert.equal(fs.readFileSync(absolute, "utf8"), content, `${logicalPath} differs`)
    return
  }
  fs.writeFileSync(absolute, content, { encoding: "utf8", flag: "wx" })
}
