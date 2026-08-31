import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
} from "./lib/ai-painter-program-event-store.mjs"
import {
  createExclusiveLeafUnderFixedParent,
  FORMAL_STAGE_VALIDATION_COMPLETED,
  JOINT_CONDITION_FULL_DATA_SCREEN_ADJUDICATION_COMMAND,
  JOINT_CONDITION_FULL_DATA_SCREEN_ADJUDICATION_TASK,
} from "./lib/ai-painter-stage4-joint-condition-local-transport-lifecycle-v1.mjs"
import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const SUCCESSOR_CAPABILITY = "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2"
const SUCCESSOR_CONTRACT_PATH = "data/ai-painter/system-governance/stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2.json"
const NEXT_TASK = "verify_stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2_cpu_contract"
const NEXT_MACHINE_ACTION = "run:ai-painter-stage4-v2-cpu-contract-acceptance"

const current = await readCurrentExecutionRegistry(ROOT)
assert.equal(current.ok, true, current.errorCode ?? "current registry is not verified")
assert.equal(current.registry.taskId, JOINT_CONDITION_FULL_DATA_SCREEN_ADJUDICATION_TASK)
assert.equal(current.registry.lifecycleStage, FORMAL_STAGE_VALIDATION_COMPLETED)
assert.equal(current.registry.executionState, "package_materialized")
assert.equal(current.registry.nextMachineAction, JOINT_CONDITION_FULL_DATA_SCREEN_ADJUDICATION_COMMAND)
assert.equal(current.registry.activeExecution, null)

const sourceRunId = requiredIdentity(current.registry.runId, "source_run_id_invalid")
const latest = requiredRecord(current.registry.latestTrainingTerminal, "latest_training_terminal_missing")
assert.equal(latest.runId, sourceRunId, "cross-run latest training terminal is forbidden")
const latestTerminal = readBinding(latest, "latest_training_terminal")
const evidence = requiredRecord(latest.evidence, "latest_training_evidence_missing")
const reviewBinding = evidence.machineReviewTimeline ?? evidence.machineReview
const review = readBinding(reviewBinding, "machine_review_timeline")
assert.equal(review.value.runId, sourceRunId, "cross-run machine review is forbidden")

const completedReviewCount = requiredCount(review.value.completedReviewCount, "completed_review_count_invalid")
const targetReviewCount = requiredCount(review.value.targetReviewCount, "target_review_count_invalid")
const passCount = requiredCount(review.value.previewPassCount, "preview_pass_count_invalid")
const failCount = requiredCount(review.value.previewFailCount, "preview_fail_count_invalid")
assert.equal(completedReviewCount, targetReviewCount, "incomplete review timeline cannot be adjudicated")
assert.equal(passCount + failCount, completedReviewCount, "review count identity mismatch")
assert.ok(Array.isArray(review.value.reviews) && review.value.reviews.length === completedReviewCount)

const issueCodes = [...new Set(review.value.reviews.flatMap((row) => {
  assert.ok(row && typeof row === "object" && !Array.isArray(row), "review node invalid")
  assert.ok(Array.isArray(row.issueCodes), "review issue codes missing")
  return row.issueCodes.map((code) => requiredIdentity(code, "review issue code invalid"))
}))].sort()
const sourceStatus = requiredIdentity(latest.status, "latest_training_status_invalid")
const visualFailure = failCount > 0 || sourceStatus.includes("visual_failure")
assert.equal(visualFailure, true, "this entrypoint only adjudicates a real visual failure")
assert.ok(issueCodes.length > 0, "visual failure lacks machine issue evidence")

const semanticFailureCodes = issueCodes.filter((code) =>
  /(condition|route|road|water|hydrology|footprints|tree|rock|vegetation|semantic)/u.test(code),
)
assert.ok(semanticFailureCodes.length > 0, "failure boundary is not machine-classifiable from semantic evidence")
const successorContract = readProjectJson(SUCCESSOR_CONTRACT_PATH)
assert.equal(successorContract.value.status, "cpu_supported_inactive")
assert.equal(successorContract.value.architectureId, SUCCESSOR_CAPABILITY)
assert.equal(successorContract.value.predecessor?.architectureId, current.registry.capabilityVersion)
assert.equal(successorContract.value.predecessor?.disposition, "rejected_read_only_not_valid_for_new_work")
assert.equal(successorContract.value.predecessor?.checkpointReusable, false)
assert.equal(Object.values(successorContract.value.activationGates ?? {}).every((value) => value === false), true)

const runId = `joint-condition-full-data-screen-boundary-adjudication-${compactUtc()}-${crypto.randomUUID().slice(0, 8)}`
const outputRoot = createExclusiveLeafUnderFixedParent({
  projectRoot: ROOT,
  parentRelative: ".runtime/ai-painter/stage4-joint-condition-local-transport-full-data-screen-failure-boundary-adjudications",
  leafIdentity: runId,
})

const problemPath = path.join(outputRoot, "problem-report.json")
const analysisPath = path.join(outputRoot, "responsibility-boundary-analysis.json")
const classificationPath = path.join(outputRoot, "capability-change-classification.json")
const terminalPath = path.join(outputRoot, "phase-terminal.json")
const capsulePath = path.join(outputRoot, "local-task-capsule.json")
const recordedAtUtc = new Date().toISOString()
const recordedAtAsiaShanghai = formatShanghai(recordedAtUtc)

writeExclusive(problemPath, {
  schemaVersion: "stage4-joint-condition-full-data-screen-failure-problem-v1",
  status: "verified",
  runId,
  sourceRunId,
  sourceCapabilityVersion: current.registry.capabilityVersion,
  sourceTerminal: latestTerminal.binding,
  machineReviewTimeline: review.binding,
  reviewSummary: { completedReviewCount, targetReviewCount, passCount, failCount },
  issueCodes,
  trainingRestarted: false,
  checkpointWeightsRead: false,
  recordedAtUtc,
  recordedAtAsiaShanghai,
})

writeExclusive(analysisPath, {
  schemaVersion: "stage4-joint-condition-full-data-screen-responsibility-boundary-analysis-v1",
  status: "visual_semantic_failure_boundary_confirmed",
  runId,
  sourceRunId,
  evidence: { problemReport: bind(problemPath), sourceTerminal: latestTerminal.binding, machineReviewTimeline: review.binding },
  findings: {
    machineReviewComplete: true,
    realVisualFailure: true,
    semanticFailureCodes,
    sameCandidateAutomaticRetryAllowed: false,
    failedCheckpointReuseAllowed: false,
    thresholdReductionAllowed: false,
    capabilityChangeClassificationRequired: true,
  },
  recordedAtUtc,
  recordedAtAsiaShanghai,
})

writeExclusive(classificationPath, {
  schemaVersion: "stage4-joint-condition-full-data-screen-capability-change-classification-v1",
  status: "major_capability_change_candidate_required",
  runId,
  sourceRunId,
  changeRequirement: "AP-CHANGE-001",
  sourceAnalysis: bind(analysisPath),
  rejectedCapabilityVersion: current.registry.capabilityVersion,
  successorCapabilityVersion: SUCCESSOR_CAPABILITY,
  successorContract: successorContract.binding,
  successorDisposition: "change_candidate_not_yet_qualified",
  classificationBasis: "The frozen full-data screen completed its machine review and retained semantic failures; resolving the recorded responsibility boundary changes model responsibility paths and therefore requires a new capability identity.",
  ownerAuthorizationRequired: false,
  trainingAuthorized: false,
  recordedAtUtc,
  recordedAtAsiaShanghai,
})

writeExclusive(terminalPath, {
  schemaVersion: "stage4-joint-condition-full-data-screen-failure-boundary-adjudication-terminal-v1",
  executionState: "completed",
  status: "joint_condition_full_data_screen_failure_boundary_adjudicated_change_candidate_required",
  runId,
  sourceRunId,
  problemReport: bind(problemPath),
  responsibilityBoundaryAnalysis: bind(analysisPath),
  capabilityChangeClassification: bind(classificationPath),
  nextLegalAction: NEXT_TASK,
  successorCapabilityVersion: SUCCESSOR_CAPABILITY,
  automaticTrainingContinuationAllowed: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc,
  recordedAtAsiaShanghai,
})

writeExclusive(capsulePath, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${runId}`,
  module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
  currentStage: { number: 4, total: 5, status: "change_candidate" },
  nextAllowedAction: {
    taskId: NEXT_TASK,
    action: NEXT_MACHINE_ACTION,
    ownerAuthorizationRequired: false,
    automaticTrainingAllowed: false,
  },
  evidence: [problemPath, analysisPath, classificationPath, terminalPath].map((file) => ({
    ...bind(file),
    sha256Verified: true,
  })).concat([{ ...successorContract.binding, sha256Verified: true }]),
  integrity: {
    status: "verified",
    requiredEvidencePresent: true,
    boundEvidenceVerified: true,
    identityMatches: true,
  },
  recordedAtUtc,
  recordedAtAsiaShanghai,
})

const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: SUCCESSOR_CAPABILITY,
  packageId: runId,
  taskId: NEXT_TASK,
  taskKind: "cpu_contract_verification",
  taskGoal: "Verify the CPU contract for the versioned full-resolution typed semantic transport and RGB-responsibility successor without starting training.",
  priority: 1,
  queueStatus: "ready",
  nextMachineAction: NEXT_MACHINE_ACTION,
  runId,
  lifecycleStage: "change_candidate",
  executionState: "package_materialized",
  activity: "cpu_contract_verification_ready",
  taskCapsulePath: projectPath(capsulePath),
  terminalEvidencePath: projectPath(terminalPath),
  expectedPreviousRegistryRevision: current.registry.registryRevision,
  expectedPreviousRegistrySha256: current.registrySha256,
})

appendAiPainterProgramEvent({
  id: `stage4-joint-condition-full-data-screen-failure-boundary-${runId}`,
  timestamp: recordedAtUtc,
  action: "joint_condition_full_data_screen_failure_boundary_adjudicated",
  runId,
  kind: "cpu_readonly_adjudication",
  status: "success",
  title: "Joint-condition full-data screen failure boundary adjudicated",
  titleZh: "联合条件全数据筛选失败责任边界已裁决",
  detailZh: "机器审核失败证据完整；原候选禁止重跑和Checkpoint复用，新的结构责任边界必须使用独立能力身份并先完成CPU合同验证。",
  evidencePath: projectPath(terminalPath),
  evidenceSha256: sha256File(terminalPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})

process.stdout.write(`${JSON.stringify({
  status: "joint_condition_full_data_screen_failure_boundary_adjudicated_change_candidate_required",
  runId,
  sourceRunId,
  successorCapabilityVersion: SUCCESSOR_CAPABILITY,
  nextMachineAction: NEXT_MACHINE_ACTION,
  terminal: bind(terminalPath),
  registryRevision: advanced.registry.registryRevision,
  ownerAuthorizationRequired: false,
}, null, 2)}\n`)

function readBinding(value, role) {
  const record = requiredRecord(value, `${role}_binding_missing`)
  const relative = normalizeRelative(requiredIdentity(record.path, `${role}_path_missing`))
  const expectedSha256 = requiredSha256(record.sha256, `${role}_sha256_invalid`)
  const absolute = resolveInside(relative)
  assert.equal(fs.existsSync(absolute), true, `${role}_file_missing`)
  assert.equal(sha256File(absolute), expectedSha256, `${role}_sha256_mismatch`)
  return { value: JSON.parse(fs.readFileSync(absolute, "utf8")), binding: { path: relative, sha256: expectedSha256 } }
}

function readProjectJson(relativePath) {
  const normalized = normalizeRelative(relativePath)
  const absolute = resolveInside(normalized)
  assert.equal(fs.existsSync(absolute), true, `required project contract missing: ${normalized}`)
  return {
    value: JSON.parse(fs.readFileSync(absolute, "utf8")),
    binding: { path: normalized, sha256: sha256File(absolute) },
  }
}

function normalizeRelative(value) {
  const candidate = value.replaceAll("\\", "/")
  assert.equal(path.posix.isAbsolute(candidate), false, "absolute path forbidden")
  assert.equal(/^[A-Za-z]:\//u.test(candidate), false, "drive path forbidden")
  const normalized = path.posix.normalize(candidate)
  assert.equal(normalized === ".." || normalized.startsWith("../"), false, "parent path forbidden")
  return normalized
}

function resolveInside(relative) {
  const normalized = normalizeRelative(relative)
  const absoluteRoot = path.resolve(ROOT)
  const absolute = path.resolve(absoluteRoot, ...normalized.split("/"))
  assert.ok(absolute.startsWith(`${absoluteRoot}${path.sep}`), "path escapes project")
  return absolute
}

function requiredRecord(value, code) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), code)
  return value
}

function requiredIdentity(value, code) {
  assert.ok(typeof value === "string" && value.length > 0, code)
  return value
}

function requiredSha256(value, code) {
  assert.match(value, /^[a-f0-9]{64}$/u, code)
  return value
}

function requiredCount(value, code) {
  assert.ok(Number.isInteger(value) && value >= 0, code)
  return value
}

function writeExclusive(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" })
}

function bind(file) {
  return { path: projectPath(file), sha256: sha256File(file) }
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}

function compactUtc() {
  return new Date().toISOString().replaceAll(/[-:.TZ]/gu, "").slice(0, 17)
}
