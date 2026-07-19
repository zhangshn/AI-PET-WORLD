import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import {
  AXIS_FAILURE_CODES,
  AXIS_SOURCE_ROW_INDEXES,
  CONNECTIVITY_COVERAGE_AXES,
  buildCoverageScenario,
  canonicalSha256,
  createNegativeScenario,
  validateCoverageScenario,
} from "./lib/world-connectivity-coverage.mjs"

const ROOT = process.cwd()
const CONTRACT_PATH = "data/world-samples/world-connectivity/world-connectivity-contract-v1.json"
const COVERAGE_BLUEPRINT_PATH = "data/world-samples/original-image-library/natural-home-v1/coverage-blueprint.json"
const COVERAGE_ROOT = "data/world-samples/world-connectivity/coverage"
const CONDITIONAL_POINTER_PATH = ".runtime/ai-painter/ai-assisted-conditional-world-facts/latest.json"
const RUNTIME_WORLD_PATH = "data/world-runtime/owner-d0znz8/world-d0znz8/ticks/3/world-state.json"
const timestamp = new Date().toISOString()
const datasetId = `world-connectivity-coverage-v1-${timestamp.replace(/[:.]/g, "-")}`
const datasetRoot = path.join(ROOT, COVERAGE_ROOT, datasetId)

const contract = readJson(CONTRACT_PATH)
const coverageBlueprint = readJson(COVERAGE_BLUEPRINT_PATH)
const conditionalPointer = readJson(CONDITIONAL_POINTER_PATH)
const conditionalManifest = readJson(conditionalPointer.manifestPath)
const runtimeWorld = readJson(RUNTIME_WORLD_PATH)
const runtimeConnectivity = runtimeWorld.homeMapState?.worldConnectivity
const allowedLandscapeTypes = (coverageBlueprint.regionalLandscapeTypes ?? []).map((entry) => entry.typeId)

assert(contract.coverageThresholds?.status === "owner_approved", "connectivity coverage thresholds are not owner approved")
assert(contract.coverageThresholds.minimumPositiveRecordCount === 27, "positive threshold mismatch")
assert(contract.coverageThresholds.minimumNegativeRecordCount === 27, "negative threshold mismatch")
assert(contract.coverageThresholds.minimumPositivePerAxis === 3, "positive per-axis threshold mismatch")
assert(contract.coverageThresholds.minimumNegativePerAxis === 3, "negative per-axis threshold mismatch")
assert(sameJson(contract.trainingCoverageAxes, CONNECTIVITY_COVERAGE_AXES), "coverage axis contract mismatch")
assert(conditionalManifest.rows?.length === 21, "expected 21 current conditional world-fact rows")
assert(runtimeConnectivity?.status === "runtime_migrated_owner_approved", "runtime connectivity is not owner approved")
assert(runtimeConnectivity.ownerReview?.decision === "approved", "runtime connectivity owner review is missing")

fs.mkdirSync(datasetRoot, { recursive: true })
const records = []
for (const axis of CONNECTIVITY_COVERAGE_AXES) {
  const sourceIndexes = AXIS_SOURCE_ROW_INDEXES[axis]
  assert(sourceIndexes?.length === 3, `axis source selection invalid: ${axis}`)
  for (let offset = 0; offset < sourceIndexes.length; offset += 1) {
    const variantIndex = offset + 1
    const sourceRow = conditionalManifest.rows[sourceIndexes[offset]]
    const sourceBlueprint = readJson(sourceRow.blueprintPath)
    assert(sourceBlueprint.completeMapScopeRequired === true, `source is not a complete-map condition: ${sourceRow.conditionLabel}`)
    const positiveScenario = buildCoverageScenario({
      axis,
      variantIndex,
      sourceRow,
      sourceBlueprint,
      runtimeConnectivity,
      runtimePlacements: runtimeWorld.homeMapState?.placements ?? [],
      allowedLandscapeTypes,
    })
    const positiveReview = validateCoverageScenario(positiveScenario)
    assert(positiveReview.passed, `positive scenario failed validation: ${axis}:${variantIndex}:${positiveReview.failureCode}`)
    records.push(writeRecord({ axis, variantIndex, polarity: "positive", sourceRow, scenario: positiveScenario, review: positiveReview }))

    const negativeScenario = createNegativeScenario(positiveScenario)
    const negativeReview = validateCoverageScenario(negativeScenario)
    assert(!negativeReview.passed, `negative scenario incorrectly passed validation: ${axis}:${variantIndex}`)
    assert(negativeReview.failureCode === AXIS_FAILURE_CODES[axis], `negative failure code mismatch: ${axis}:${variantIndex}`)
    records.push(writeRecord({ axis, variantIndex, polarity: "negative", sourceRow, scenario: negativeScenario, review: negativeReview }))
  }
}

const axisCounts = Object.fromEntries(CONNECTIVITY_COVERAGE_AXES.map((axis) => [axis, {
  positive: records.filter((record) => record.axis === axis && record.polarity === "positive").length,
  negative: records.filter((record) => record.axis === axis && record.polarity === "negative").length,
}]))
const positiveRecordCount = records.filter((record) => record.polarity === "positive").length
const negativeRecordCount = records.filter((record) => record.polarity === "negative").length
const thresholdMet = positiveRecordCount >= contract.coverageThresholds.minimumPositiveRecordCount
  && negativeRecordCount >= contract.coverageThresholds.minimumNegativeRecordCount
  && Object.values(axisCounts).every((counts) => counts.positive >= contract.coverageThresholds.minimumPositivePerAxis
    && counts.negative >= contract.coverageThresholds.minimumNegativePerAxis)
assert(thresholdMet, "generated connectivity coverage does not meet approved thresholds")

const manifest = {
  schemaVersion: "world-connectivity-coverage-dataset-v1",
  datasetId,
  status: "machine_verified_threshold_met",
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  contractId: contract.contractId,
  contractPath: CONTRACT_PATH,
  contractSha256: fileSha256(CONTRACT_PATH),
  thresholdApprovalId: contract.coverageThresholds.approvalId,
  thresholdApprovalPath: contract.coverageThresholds.approvalPath,
  connectivityBlueprintId: runtimeConnectivity.blueprintId,
  connectivityBlueprintPath: runtimeConnectivity.blueprintPath,
  connectivityBlueprintSha256: runtimeConnectivity.blueprintSha256,
  runtimeWorldPath: RUNTIME_WORLD_PATH,
  runtimeWorldSha256: fileSha256(RUNTIME_WORLD_PATH),
  runtimeTick: runtimeWorld.tick,
  runtimeOwnerReviewId: runtimeConnectivity.ownerReview.reviewId,
  runtimeOwnerReviewPath: runtimeConnectivity.ownerReview.reviewPath,
  conditionalFactsBatchId: conditionalManifest.batchId,
  conditionalFactsManifestPath: conditionalPointer.manifestPath,
  conditionalFactsManifestSha256: fileSha256(conditionalPointer.manifestPath),
  recordCount: records.length,
  positiveRecordCount,
  negativeRecordCount,
  axisCounts,
  thresholdMet,
  records: records.map((record) => ({
    recordId: record.recordId,
    axis: record.axis,
    polarity: record.polarity,
    variantIndex: record.variantIndex,
    sourceConditionLabel: record.sourceConditionLabel,
    recordPath: record.recordPath,
    recordSha256: record.recordSha256,
  })),
  trainingUseContract: {
    dataKind: "structured_connectivity_supervision",
    rgbTrainingTarget: false,
    changesRuntimeWorldFacts: false,
    positiveMeaning: "owner-approved runtime connectivity rule preserved in a complete-map condition context",
    negativeMeaning: "controlled single-axis mutation correctly rejected by the deterministic connectivity reviewer",
  },
  automaticStorage: true,
}
const manifestPath = path.join(datasetRoot, "manifest.json")
writeJsonAtomic(manifestPath, manifest)
const manifestSha256 = fileSha256(manifestPath)
writeJsonAtomic(path.join(ROOT, COVERAGE_ROOT, "latest.json"), {
  schemaVersion: "world-connectivity-coverage-latest-v1",
  datasetId,
  status: manifest.status,
  updatedAtUtc: timestamp,
  manifestPath: projectPath(manifestPath),
  manifestSha256,
  positiveRecordCount,
  negativeRecordCount,
  axisCounts,
  thresholdMet,
})

coverageBlueprint.updatedAt = formatShanghai(timestamp).replace("T", " ")
coverageBlueprint.worldConnectivityContract.status = "active_contract_first_mvp_runtime_owner_approved_coverage_met"
coverageBlueprint.connectivityCoverage = {
  ...coverageBlueprint.connectivityCoverage,
  status: "threshold_met",
  currentQualifiedRecordCount: positiveRecordCount + negativeRecordCount,
  currentPositiveRecordCount: positiveRecordCount,
  currentNegativeRecordCount: negativeRecordCount,
  axisCounts,
  thresholdMet: true,
  remainingBlockers: [],
  coverageDatasetId: datasetId,
  coverageManifestPath: projectPath(manifestPath),
  coverageManifestSha256: manifestSha256,
  lastProgramBuildAtUtc: timestamp,
}
coverageBlueprint.pendingDefinitionsBeforeFinalImageCount = (coverageBlueprint.pendingDefinitionsBeforeFinalImageCount ?? [])
  .filter((entry) => entry !== "owner_approved_connectivity_coverage_thresholds")
writeJsonAtomic(path.join(ROOT, COVERAGE_BLUEPRINT_PATH), coverageBlueprint)

contract.status = "active_contract_first_mvp_runtime_owner_approved_connectivity_coverage_met"
contract.updatedAt = formatShanghai(timestamp).replace("T", " ")
contract.scope.connectivityCoverageMet = true
contract.coverageEvidence = {
  datasetId,
  manifestPath: projectPath(manifestPath),
  manifestSha256,
  positiveRecordCount,
  negativeRecordCount,
  axisCounts,
  thresholdMet: true,
  verifiedAtUtc: timestamp,
}
writeJsonAtomic(path.join(ROOT, CONTRACT_PATH), contract)

appendAiPainterProgramEvent({
  status: "success",
  stage: "world_connectivity_coverage_built",
  titleZh: "大世界连接覆盖正负样本已由程序构建并通过机器审核",
  titleEn: "World connectivity positive and negative coverage records were built and machine verified",
  summaryZh: `程序自动保存${positiveRecordCount}条正样本和${negativeRecordCount}条负样本，9个连接轴均达到3正+3负。`,
  summaryEn: `The program automatically stored ${positiveRecordCount} positive and ${negativeRecordCount} negative records; all nine axes reached 3 positive and 3 negative records.`,
  evidence: [projectPath(manifestPath), CONTRACT_PATH, COVERAGE_BLUEPRINT_PATH],
})

console.log(JSON.stringify({
  status: manifest.status,
  datasetId,
  manifestPath: projectPath(manifestPath),
  positiveRecordCount,
  negativeRecordCount,
  axisCounts,
  thresholdMet,
  imagesGenerated: 0,
  runtimeWorldFactsChanged: false,
}, null, 2))

function writeRecord({ axis, variantIndex, polarity, sourceRow, scenario, review }) {
  const recordId = `connectivity-${axis}-${polarity}-${String(variantIndex).padStart(2, "0")}`
  const record = {
    schemaVersion: "world-connectivity-coverage-record-v1",
    recordId,
    datasetId,
    status: polarity === "positive" ? "qualified_positive" : "qualified_negative",
    createdAtUtc: timestamp,
    createdAtAsiaShanghai: formatShanghai(timestamp),
    axis,
    polarity,
    variantIndex,
    sourceConditionLabel: sourceRow.conditionLabel,
    sourceRecordId: sourceRow.sourceRecordId,
    sourceConditionBlueprintPath: sourceRow.blueprintPath,
    sourceConditionBlueprintSha256: sourceRow.blueprintSha256,
    sourceConditionPackPath: sourceRow.conditionPackPath,
    sourceConditionPackSha256: sourceRow.conditionPackSha256,
    connectivityContractId: contract.contractId,
    connectivityBlueprintId: runtimeConnectivity.blueprintId,
    runtimeTick: runtimeWorld.tick,
    scenario,
    scenarioSha256: canonicalSha256(scenario),
    controlledMutation: polarity === "negative" ? {
      isolatedAxis: axis,
      expectedFailureCode: AXIS_FAILURE_CODES[axis],
      sourceWorldFactsMutated: false,
      mutationAppliesOnlyToTrainingScenarioCopy: true,
    } : null,
    machineReview: {
      reviewer: "deterministic-world-connectivity-reviewer-v1",
      expectedPassed: polarity === "positive",
      observedPassed: review.passed,
      observedFailureCode: review.failureCode,
      reviewMatchedExpectation: polarity === "positive" ? review.passed : !review.passed && review.failureCode === AXIS_FAILURE_CODES[axis],
    },
    qualification: {
      countsTowardApprovedThreshold: true,
      structuredConnectivitySupervision: true,
      rgbTrainingTarget: false,
      ownerApprovedRuntimeFactsRequired: true,
    },
    authorityBoundary: {
      sourceWorldFactsMutated: false,
      runtimeWorldFactsChanged: false,
      imagesGenerated: 0,
      visualCanDefineTopology: false,
    },
    automaticStorage: true,
  }
  const recordPath = path.join(datasetRoot, "records", polarity, axis, `${recordId}.json`)
  writeJsonAtomic(recordPath, record)
  return {
    ...record,
    recordPath: projectPath(recordPath),
    recordSha256: fileSha256(recordPath),
  }
}

function readJson(value) {
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8"))
}

function fileSha256(value) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.resolve(ROOT, value))).digest("hex")
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}
