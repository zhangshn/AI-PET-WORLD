import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const DATASET_POINTER_PATH = "data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json"
const AUTOENCODER_COMPARISON_PATH = ".runtime/ai-painter/ai-assisted-autoencoder-version-comparisons/latest.json"
const CONNECTIVITY_CONTRACT_PATH = "data/world-samples/world-connectivity/world-connectivity-contract-v1.json"
const COVERAGE_BLUEPRINT_PATH = "data/world-samples/original-image-library/natural-home-v1/coverage-blueprint.json"
const OUTPUT_ROOT = path.join(ROOT, ".runtime", "ai-painter", "ai-assisted-training-gate-owner-approvals")

const ownerCommandRef = argumentValue("--owner-command-ref")
const conditionalPairThreshold = integerArgument("--conditional-pair-threshold")
const connectivityPositiveThreshold = integerArgument("--connectivity-positive-threshold")
const connectivityNegativeThreshold = integerArgument("--connectivity-negative-threshold")
const connectivityPerAxisThreshold = integerArgument("--connectivity-per-axis-threshold")
const autoencoderV2Decision = argumentValue("--autoencoder-v2-decision")

assert(ownerCommandRef, "--owner-command-ref is required")
assert(autoencoderV2Decision === "approved", "--autoencoder-v2-decision must be approved")

const datasetPointer = readJson(DATASET_POINTER_PATH)
const datasetManifest = readJson(datasetPointer.manifestPath)
const autoencoderComparison = readJson(AUTOENCODER_COMPARISON_PATH)
const connectivityContract = readJson(CONNECTIVITY_CONTRACT_PATH)
const coverageBlueprint = readJson(COVERAGE_BLUEPRINT_PATH)
const connectivityAxes = connectivityContract.trainingCoverageAxes ?? []

assert(datasetManifest.currentConditionPairCount >= conditionalPairThreshold, "current condition pair count is below the approved threshold")
assert(datasetManifest.currentConditionUnpairedCount === 0, "current condition pairs are incomplete")
assert(autoencoderComparison.status === "v2_reconstruction_improved_owner_review_required", "Autoencoder v2 comparison is not waiting for owner review")
assert(autoencoderComparison.candidateImprovedAllAverageMetrics === true, "Autoencoder v2 did not improve all average metrics")
assert(autoencoderComparison.sampleCount === 6, "Autoencoder v2 comparison sample count is invalid")
assert(connectivityContract.contractId === "natural-home-large-world-connectivity-v1", "connectivity contract identity is invalid")
assert(connectivityAxes.length === 9, "connectivity training coverage axes must contain exactly nine axes")
assert(connectivityPositiveThreshold === connectivityAxes.length * connectivityPerAxisThreshold, "positive threshold must cover every connectivity axis")
assert(connectivityNegativeThreshold === connectivityAxes.length * connectivityPerAxisThreshold, "negative threshold must cover every connectivity axis")

const timestamp = new Date().toISOString()
const approvalId = `ai-assisted-training-gate-owner-approval-${timestamp.replace(/[:.]/g, "-")}`
const approvalDir = path.join(OUTPUT_ROOT, approvalId)
const approvalPath = path.join(approvalDir, "approval.json")
const currentPositiveCount = coverageBlueprint.connectivityCoverage?.currentPositiveRecordCount ?? 0
const currentNegativeCount = coverageBlueprint.connectivityCoverage?.currentNegativeRecordCount ?? 0
const axisCounts = Object.fromEntries(connectivityAxes.map((axis) => [axis, {
  positive: coverageBlueprint.connectivityCoverage?.axisCounts?.[axis]?.positive ?? 0,
  negative: coverageBlueprint.connectivityCoverage?.axisCounts?.[axis]?.negative ?? 0,
}]))

const approval = {
  schemaVersion: "ai-assisted-training-gate-owner-approval-v1",
  approvalId,
  status: "owner_approved_thresholds_recorded_coverage_pending",
  ownerCommandRef,
  reviewerRole: "project_owner",
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  approvals: {
    conditionalDenoiserThreshold: {
      decision: "approved",
      minimumCurrentConditionPairCount: conditionalPairThreshold,
      observedCurrentConditionPairCount: datasetManifest.currentConditionPairCount,
      observedCurrentConditionUnpairedCount: datasetManifest.currentConditionUnpairedCount,
      datasetPackageId: datasetManifest.packageId,
      datasetManifestPath: datasetPointer.manifestPath,
      datasetManifestSha256: sha256File(resolveProjectPath(datasetPointer.manifestPath)),
    },
    autoencoderV2VisualReview: {
      decision: "approved",
      comparisonStatusBeforeApproval: autoencoderComparison.status,
      comparisonSampleCount: autoencoderComparison.sampleCount,
      candidateModelId: autoencoderComparison.candidate.modelId,
      candidateCheckpointSha256: autoencoderComparison.candidate.checkpointSha256,
      comparisonPath: AUTOENCODER_COMPARISON_PATH,
      comparisonSha256: sha256File(resolveProjectPath(AUTOENCODER_COMPARISON_PATH)),
    },
    worldConnectivityCoverageThreshold: {
      decision: "approved",
      contractId: connectivityContract.contractId,
      minimumPositiveRecordCount: connectivityPositiveThreshold,
      minimumNegativeRecordCount: connectivityNegativeThreshold,
      minimumPositivePerAxis: connectivityPerAxisThreshold,
      minimumNegativePerAxis: connectivityPerAxisThreshold,
      coverageAxes: connectivityAxes,
      currentPositiveRecordCount: currentPositiveCount,
      currentNegativeRecordCount: currentNegativeCount,
      axisCounts,
      thresholdMetAtApproval: false,
    },
  },
  trainingStarted: false,
  automaticStorage: true,
}

writeJsonAtomic(approvalPath, approval)
const approvalRelativePath = projectPath(approvalPath)
const approvalSha256 = sha256File(approvalPath)

const nextContract = {
  ...connectivityContract,
  status: "active_contract_first_mvp_runtime_owner_approved_thresholds_approved_coverage_insufficient",
  updatedAt: formatShanghai(timestamp),
  scope: {
    ...connectivityContract.scope,
    minimumConnectivityCountsApproved: true,
  },
  coverageThresholds: {
    schemaVersion: "world-connectivity-coverage-threshold-v1",
    status: "owner_approved",
    minimumPositiveRecordCount: connectivityPositiveThreshold,
    minimumNegativeRecordCount: connectivityNegativeThreshold,
    minimumPositivePerAxis: connectivityPerAxisThreshold,
    minimumNegativePerAxis: connectivityPerAxisThreshold,
    coverageAxes: connectivityAxes,
    approvalId,
    approvalPath: approvalRelativePath,
    approvalSha256,
  },
  pendingOwnerDecisions: (connectivityContract.pendingOwnerDecisions ?? [])
    .filter((decision) => decision !== "minimum_positive_and_negative_connectivity_coverage_counts"),
}
writeJsonAtomic(resolveProjectPath(CONNECTIVITY_CONTRACT_PATH), nextContract)

const remainingCoverageBlockers = buildCoverageBlockers({
  axes: connectivityAxes,
  axisCounts,
  currentPositiveCount,
  currentNegativeCount,
  positiveThreshold: connectivityPositiveThreshold,
  negativeThreshold: connectivityNegativeThreshold,
  perAxisThreshold: connectivityPerAxisThreshold,
})
const nextCoverageBlueprint = {
  ...coverageBlueprint,
  updatedAt: formatShanghai(timestamp),
  connectivityCoverage: {
    ...coverageBlueprint.connectivityCoverage,
    status: remainingCoverageBlockers.length === 0 ? "threshold_met" : "threshold_approved_coverage_insufficient",
    minimumThresholdStatus: "owner_approved",
    minimumPositiveRecordCount: connectivityPositiveThreshold,
    minimumNegativeRecordCount: connectivityNegativeThreshold,
    minimumPositivePerAxis: connectivityPerAxisThreshold,
    minimumNegativePerAxis: connectivityPerAxisThreshold,
    currentPositiveRecordCount: currentPositiveCount,
    currentNegativeRecordCount: currentNegativeCount,
    currentQualifiedRecordCount: currentPositiveCount + currentNegativeCount,
    axisCounts,
    thresholdMet: remainingCoverageBlockers.length === 0,
    remainingBlockers: remainingCoverageBlockers,
    thresholdApprovalId: approvalId,
    thresholdApprovalPath: approvalRelativePath,
    thresholdApprovalSha256: approvalSha256,
  },
}
writeJsonAtomic(resolveProjectPath(COVERAGE_BLUEPRINT_PATH), nextCoverageBlueprint)
writeJsonAtomic(path.join(OUTPUT_ROOT, "latest.json"), {
  ...approval,
  approvalPath: approvalRelativePath,
  approvalSha256,
})

const ledgerEvent = appendAiPainterProgramEvent({
  action: "record_ai_assisted_training_gate_owner_approval",
  runId: approvalId,
  kind: "owner_approval_recorded",
  status: "success",
  title: "AI-assisted training thresholds and Autoencoder v2 visual review approved",
  titleZh: "AI辅助训练门槛与Autoencoder v2视觉验收已批准",
  detail: `conditionalPairs=${conditionalPairThreshold}; connectivityPositive=${connectivityPositiveThreshold}; connectivityNegative=${connectivityNegativeThreshold}; perAxis=${connectivityPerAxisThreshold}; coverage remains insufficient`,
  detailZh: `条件配对=${conditionalPairThreshold}；连接正样本=${connectivityPositiveThreshold}；连接负样本=${connectivityNegativeThreshold}；每轴=${connectivityPerAxisThreshold}；当前连接覆盖仍不足`,
  script: "scripts/record-ai-assisted-training-gate-owner-approval.mjs",
  currentStep: "training_gate_thresholds_owner_approved_coverage_pending",
  archiveId: approvalId,
  evidencePath: approvalRelativePath,
  finalGameMapSuccess: false,
  canEnterWorld: false,
  nextAction: "build_positive_and_negative_world_connectivity_coverage_records",
  nextActionZh: "建设大世界连接正负覆盖记录",
})

console.log(JSON.stringify({
  status: approval.status,
  approvalId,
  approvalPath: approvalRelativePath,
  conditionalPairThreshold,
  autoencoderV2VisualReview: "approved",
  connectivityPositiveThreshold,
  connectivityNegativeThreshold,
  connectivityPerAxisThreshold,
  currentPositiveCount,
  currentNegativeCount,
  remainingCoverageBlockers,
  ledgerEventId: ledgerEvent.id,
}, null, 2))

function buildCoverageBlockers({ axes, axisCounts: counts, currentPositiveCount: positive, currentNegativeCount: negative, positiveThreshold, negativeThreshold, perAxisThreshold }) {
  return [
    positive < positiveThreshold ? "world_connectivity_positive_coverage_insufficient" : null,
    negative < negativeThreshold ? "world_connectivity_negative_coverage_insufficient" : null,
    axes.some((axis) => counts[axis].positive < perAxisThreshold) ? "world_connectivity_positive_per_axis_coverage_insufficient" : null,
    axes.some((axis) => counts[axis].negative < perAxisThreshold) ? "world_connectivity_negative_per_axis_coverage_insufficient" : null,
  ].filter(Boolean)
}
function argumentValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null }
function integerArgument(name) { const value = Number(argumentValue(name)); assert(Number.isInteger(value) && value > 0, `${name} must be a positive integer`); return value }
function readJson(value) { return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8")) }
function resolveProjectPath(value) { const resolved = path.resolve(ROOT, value); assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project root: ${value}`); return resolved }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function writeJsonAtomic(filePath, value) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); const temporary = `${filePath}.${process.pid}.tmp`; fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8"); fs.renameSync(temporary, filePath) }
function assert(condition, message) { if (!condition) throw new Error(message) }
