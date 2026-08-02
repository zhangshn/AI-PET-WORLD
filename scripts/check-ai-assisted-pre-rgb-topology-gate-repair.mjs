import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"
import {
  auditPreRgbConditionGuideNovelty,
} from "./lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs"
import {
  auditAiAssistedCompositionNovelty,
} from "./lib/ai-assisted-composition-novelty.mjs"

const ROOT = process.cwd()
const SOURCE_RECORD_ID = "v7-capacity-slot-123"
const CANDIDATE_RECORD_ID =
  "ai-cold-start-v7-v7-capacity-slot-123-river-floodplain-v3"
const GUIDE_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/" +
  "earth-geospatial-v7-slot-condition-v7-capacity-slot-123-2026-07-27T23-40-24-403Z/" +
  "complete-map-condition-task/compiled-conditions/condition-guide.png"
const OLD_AUDIT_PATH =
  ".runtime/ai-painter/ai-assisted-pre-rgb-condition-guide-novelty-audits/" +
  "ai-assisted-pre-rgb-condition-guide-novelty-v7-capacity-slot-123-2026-07-27T23-40-59-242Z/" +
  "audit-report.json"
const LATEST_CANDIDATE_RECORD_ID =
  "ai-cold-start-v7-v7-capacity-slot-123-river-floodplain-v4"
const LATEST_GUIDE_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/" +
  "earth-geospatial-v7-slot-condition-v7-capacity-slot-123-2026-07-28T06-58-36-782Z/" +
  "complete-map-condition-task/compiled-conditions/condition-guide.png"
const EXPECTED_MATCHES = [
  "ai-cold-start-v7-v7-capacity-slot-122-river-floodplain-v2",
  "ai-cold-start-v7-v7-capacity-slot-123-river-floodplain-v1",
]
const RGB_REGRESSION_RECORD_IDS = [
  "ai-cold-start-v7-v7-capacity-slot-123-river-floodplain-v1",
  "ai-cold-start-v7-v7-capacity-slot-123-river-floodplain-v2",
  "ai-cold-start-v7-v7-capacity-slot-123-river-floodplain-v3",
  "ai-cold-start-v7-v7-capacity-slot-123-river-floodplain-v4",
]
const OUTPUT_ROOT =
  ".runtime/ai-painter/ai-assisted-pre-rgb-topology-gate-repair-checks"
const CAPACITY_POINTER_PATH =
  ".runtime/ai-painter/ai-assisted-v7-data-capacity-plans/latest.json"
const oldAudit = readJson(OLD_AUDIT_PATH)
assert(oldAudit.passed === true, "historical pre-RGB audit was not a pass")
assert(
  oldAudit.candidateGuidePath === GUIDE_PATH,
  "historical audit candidate guide mismatch",
)

const repairedAudit = await auditPreRgbConditionGuideNovelty({
  sourceRecordId: SOURCE_RECORD_ID,
  guidePath: GUIDE_PATH,
  candidateRecordId: CANDIDATE_RECORD_ID,
})
const matchedRecordIds =
  repairedAudit.approvedMacroCompositionMatches.map(
    (entry) => entry.recordId,
  )
assert(
  repairedAudit.passed === false,
  "repaired pre-RGB topology gate did not block the duplicate guide",
)
for (const expectedMatch of EXPECTED_MATCHES) {
  assert(
    matchedRecordIds.includes(expectedMatch),
    `repaired pre-RGB topology gate missed ${expectedMatch}`,
  )
}
const slot122Match =
  repairedAudit.approvedMacroCompositionMatches.find(
    (entry) => entry.recordId === EXPECTED_MATCHES[0],
  )
assert(
  slot122Match.macroTopologyDuplicate === true,
  "slot-122 match was not detected by the topology hard gate",
)
assert(
  slot122Match.topologyMetrics.sameRouteAxis === false,
  "regression fixture no longer proves the old route-axis classification miss",
)
assert(
  slot122Match.routeCentroidNormalizedDistance >
    repairedAudit.thresholds
      .approvedRouteCentroidMaximumNormalizedDistance,
  "regression fixture no longer proves the old route-centroid gate miss",
)
const latestRepairedAudit = await auditPreRgbConditionGuideNovelty({
  sourceRecordId: SOURCE_RECORD_ID,
  guidePath: LATEST_GUIDE_PATH,
  candidateRecordId: LATEST_CANDIDATE_RECORD_ID,
})
const latestMatchedRecordIds =
  latestRepairedAudit.approvedMacroCompositionMatches.map(
    (entry) => entry.recordId,
  )
assert(
  latestRepairedAudit.passed === false,
  "dominant-water topology gate did not block the latest duplicate guide",
)
assert(
  latestMatchedRecordIds.includes(EXPECTED_MATCHES[0]),
  "dominant-water topology gate did not match the latest guide to slot-122",
)
const latestSlot122Match =
  latestRepairedAudit.approvedMacroCompositionMatches.find(
    (entry) => entry.recordId === EXPECTED_MATCHES[0],
  )
assert(
  latestSlot122Match.topologyMetrics
    .dominantWaterTopologyDuplicate === true,
  "latest guide was not blocked by the dominant-water topology hard gate",
)
assert(
  latestSlot122Match.topologyMetrics.routeSharedBandRatio <
    latestRepairedAudit.thresholds
      .topologyMinimumSharedRouteBandRatio,
  "latest fixture no longer proves the route-only escape",
)
const slot122Record = readJson(
  "data/world-samples/original-image-library/natural-home-v1/" +
    `complete-maps/${EXPECTED_MATCHES[0]}/record.json`,
)
const transformFixtureRoot = resolveProjectPath(
  ".runtime/ai-painter/pre-rgb-transform-regression-fixtures",
)
fs.mkdirSync(transformFixtureRoot, { recursive: true })
const horizontalMirrorFixturePath = path.join(
  transformFixtureRoot,
  `slot-122-horizontal-mirror-${process.pid}-${Date.now()}.png`,
)
await sharp(
  resolveProjectPath(slot122Record.conditionBinding.guidePath),
)
  .flop()
  .toFile(horizontalMirrorFixturePath)
let horizontalMirrorAudit
try {
  horizontalMirrorAudit =
    await auditPreRgbConditionGuideNovelty({
      sourceRecordId:
        "pre-rgb-horizontal-mirror-regression-fixture",
      guidePath: horizontalMirrorFixturePath,
    })
} finally {
  if (fs.existsSync(horizontalMirrorFixturePath)) {
    fs.unlinkSync(horizontalMirrorFixturePath)
  }
}
const horizontalMirrorSlot122Match =
  horizontalMirrorAudit.approvedMacroCompositionMatches.find(
    (entry) => entry.recordId === EXPECTED_MATCHES[0],
  )
assert(
  horizontalMirrorAudit.passed === false,
  "horizontal mirror regression fixture escaped the pre-RGB gate",
)
assert(
  horizontalMirrorSlot122Match?.transformDerivedDuplicate === true &&
    horizontalMirrorSlot122Match.matchedTransforms.includes(
      "horizontal_mirror",
    ),
  "horizontal mirror regression fixture was not classified as a transform-derived duplicate",
)
assert(
  horizontalMirrorAudit.issues.some(
    (issue) =>
      issue.matchedRecordId === EXPECTED_MATCHES[0] &&
      issue.code ===
        "historical_condition_guide_transform_derived_duplicate",
  ),
  "horizontal mirror regression fixture is missing the transform-derived block code",
)
const sharedSkeletonAudit =
  await auditPreRgbConditionGuideNovelty({
    sourceRecordId:
      "pre-rgb-shared-skeleton-regression-fixture",
    guidePath: slot122Record.conditionBinding.guidePath,
  })
const sharedSkeletonSlot122Match =
  sharedSkeletonAudit.approvedMacroCompositionMatches.find(
    (entry) => entry.recordId === EXPECTED_MATCHES[0],
  )
assert(
  sharedSkeletonAudit.passed === false &&
    sharedSkeletonSlot122Match
      ?.strongCompositeSkeletonDuplicate === true,
  "shared composite terrain/water/route skeleton escaped the pre-RGB gate",
)
assert(
  sharedSkeletonAudit.issues.some(
    (issue) =>
      issue.matchedRecordId === EXPECTED_MATCHES[0] &&
      issue.code ===
        "historical_condition_guide_shared_skeleton_duplicate",
  ),
  "shared skeleton regression fixture is missing the shared-skeleton block code",
)
const rgbCompositionAudits = []
for (const recordId of RGB_REGRESSION_RECORD_IDS) {
  const recordPath =
    `data/world-samples/original-image-library/natural-home-v1/complete-maps/${recordId}/record.json`
  const record = readJson(recordPath)
  const imagePath = resolveProjectPath(
    path.join(record.relativeDirectory, record.originalImage.path),
  )
  const audit = await auditAiAssistedCompositionNovelty({
    record,
    imagePath,
  })
  const blockedMatchedRecordIds = new Set([
    ...audit.approvedCompositionMatches.map((entry) => entry.recordId),
    ...audit.rejectedCompositionMatches.map((entry) => entry.recordId),
  ])
  assert(
    audit.passed === false,
    `post-RGB composition diversity gate missed ${recordId}`,
  )
  assert(
    blockedMatchedRecordIds.has(EXPECTED_MATCHES[0]),
    `post-RGB composition diversity gate did not match ${recordId} to ${EXPECTED_MATCHES[0]}`,
  )
  assert(
    audit.issues.some(
      (issue) =>
        issue.code === "complete_map_composition_diversity_failed" ||
        issue.code === "complete_map_theme_architecture_duplicate",
    ),
    `post-RGB composition diversity failure code is missing for ${recordId}`,
  )
  rgbCompositionAudits.push({
    recordId,
    recordPath,
    imagePath: path.relative(ROOT, imagePath).replace(/\\/g, "/"),
    audit,
  })
}
const latestRgbAudit = rgbCompositionAudits.find(
  (entry) => entry.recordId === LATEST_CANDIDATE_RECORD_ID,
)?.audit
const inferredV3Rejection = latestRgbAudit?.nearestComparisons.find(
  (entry) =>
    entry.recordId ===
      "ai-cold-start-v7-v7-capacity-slot-123-river-floodplain-v3",
)
assert(
  inferredV3Rejection?.ownerReviewReasonCodesInferred === true &&
    inferredV3Rejection.ownerReviewReasonCodes.includes(
      "composition_duplicate",
    ),
  "owner comment '主体框架完全重复' was not normalized to composition_duplicate",
)
const capacityPointer = readJson(CAPACITY_POINTER_PATH)
const capacityPlan = readJson(capacityPointer.capacityPlanPath)
const capacitySourceIndex = readJson(capacityPlan.sourceIndexPath)
const capacityGapList = readJson(capacityPointer.gapListPath)
const suspendedRecordIds = new Set(
  capacityGapList.suspendedHistoricalRecords.map(
    (entry) => entry.recordId,
  ),
)
const qualifiedRecordIds = [
  ...capacitySourceIndex.currentConditionPairs.map(
    (entry) => entry.sampleId,
  ),
  ...capacitySourceIndex.v7CapacityContributions
    .filter((entry) => !suspendedRecordIds.has(entry.sampleId))
    .map((entry) => entry.sampleId),
]
const originalImageIndex = readJson(
  "data/world-samples/original-image-library/natural-home-v1/index.json",
)
const originalImageRecordsById = new Map(
  originalImageIndex.records.map((entry) => [entry.recordId, entry]),
)
const qualifiedNoveltyFailures = []
for (const recordId of qualifiedRecordIds) {
  const record = originalImageRecordsById.get(recordId)
  assert(record, `qualified original-image record is missing: ${recordId}`)
  const imagePath = resolveProjectPath(
    path.join(record.relativeDirectory, record.originalImage.path),
  )
  const audit = await auditAiAssistedCompositionNovelty({
    record,
    imagePath,
  })
  if (!audit.passed) {
    qualifiedNoveltyFailures.push({
      recordId,
      issueCodes: audit.issues.map((entry) => entry.code),
      approvedMatchRecordIds:
        audit.approvedCompositionMatches.map((entry) => entry.recordId),
      rejectedMatchRecordIds:
        audit.rejectedCompositionMatches.map((entry) => entry.recordId),
    })
  }
}
assert(
  qualifiedRecordIds.length ===
    capacityPlan.auditSummary.qualifiedExistingRecordCount,
  "qualified RGB audit count does not match the current capacity plan",
)
assert(
  qualifiedNoveltyFailures.length === 0,
  `current qualified capacity contains repeated RGB compositions: ${qualifiedNoveltyFailures.map((entry) => entry.recordId).join(",")}`,
)

const createdAtUtc = new Date().toISOString()
const runId =
  `ai-assisted-pre-rgb-topology-gate-repair-check-` +
  createdAtUtc.replace(/[:.]/g, "-")
const report = {
  schemaVersion:
    "ai-assisted-pre-rgb-topology-gate-repair-check-v1",
  runId,
  status: "pre_rgb_topology_gate_repair_check_passed",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  sourceRecordId: SOURCE_RECORD_ID,
  candidateRecordId: CANDIDATE_RECORD_ID,
  candidateGuidePath: GUIDE_PATH,
  candidateGuideSha256: sha256File(GUIDE_PATH),
  historicalAudit: {
    path: OLD_AUDIT_PATH,
    sha256: sha256File(OLD_AUDIT_PATH),
    status: oldAudit.status,
    passed: oldAudit.passed,
    slot122WaterLayoutIntersection:
      oldAudit.nearestComparisons.find(
        (entry) => entry.recordId === EXPECTED_MATCHES[0],
      )?.waterLayoutIntersection ?? null,
  },
  repairedAudit,
  latestRepairedAudit,
  regression: {
    expectedMatchedRecordIds: EXPECTED_MATCHES,
    actualMatchedRecordIds: matchedRecordIds,
    slot122MacroTopologyDuplicate:
      slot122Match.macroTopologyDuplicate,
    slot122WaterLayoutIntersection:
      slot122Match.waterLayoutIntersection,
    slot122RouteCentroidNormalizedDistance:
      slot122Match.routeCentroidNormalizedDistance,
    slot122SameRouteAxis:
      slot122Match.topologyMetrics.sameRouteAxis,
    slot122WaterBandCentroidDistance:
      slot122Match.topologyMetrics.waterBandCentroidDistance,
    slot122RouteBandCentroidDistance:
      slot122Match.topologyMetrics.routeBandCentroidDistance,
    slot122RouteWaterRelationAgreement:
      slot122Match.topologyMetrics.routeWaterRelationAgreement,
    latestCandidateRecordId: LATEST_CANDIDATE_RECORD_ID,
    latestGuidePath: LATEST_GUIDE_PATH,
    latestMatchedRecordIds,
    latestSlot122DominantWaterTopologyDuplicate:
      latestSlot122Match.topologyMetrics
        .dominantWaterTopologyDuplicate,
    latestSlot122WaterLayoutIntersection:
      latestSlot122Match.waterLayoutIntersection,
    latestSlot122WaterBandCentroidDistance:
      latestSlot122Match.topologyMetrics
        .waterBandCentroidDistance,
    horizontalMirrorGate: {
      passed: horizontalMirrorAudit.passed,
      matchedRecordId: horizontalMirrorSlot122Match.recordId,
      matchedTransform:
        horizontalMirrorSlot122Match.matchedTransform,
      matchedTransforms:
        horizontalMirrorSlot122Match.matchedTransforms,
      transformDerivedDuplicate:
        horizontalMirrorSlot122Match.transformDerivedDuplicate,
      issueCodes: horizontalMirrorAudit.issues
        .filter(
          (issue) =>
            issue.matchedRecordId === EXPECTED_MATCHES[0],
        )
        .map((issue) => issue.code),
    },
    sharedSkeletonGate: {
      passed: sharedSkeletonAudit.passed,
      matchedRecordId: sharedSkeletonSlot122Match.recordId,
      matchedTransform:
        sharedSkeletonSlot122Match.matchedTransform,
      strongCompositeSkeletonDuplicate:
        sharedSkeletonSlot122Match
          .strongCompositeSkeletonDuplicate,
      compositeSkeletonMetrics:
        sharedSkeletonSlot122Match.compositeSkeletonMetrics,
      issueCodes: sharedSkeletonAudit.issues
        .filter(
          (issue) =>
            issue.matchedRecordId === EXPECTED_MATCHES[0],
        )
        .map((issue) => issue.code),
    },
    inferredV3CompositionDuplicateReason:
      inferredV3Rejection.ownerReviewReasonCodes,
  },
  postRgbCompositionDiversityRegression: {
    expectedApprovedMatchRecordId: EXPECTED_MATCHES[0],
    recordIds: RGB_REGRESSION_RECORD_IDS,
    audits: rgbCompositionAudits,
  },
  qualifiedCapacityRgbCompositionAudit: {
    capacityPlanRunId: capacityPlan.runId,
    capacityPlanPath: capacityPointer.capacityPlanPath,
    qualifiedRecordCount: qualifiedRecordIds.length,
    qualifiedRecordIds,
    failedRecordCount: qualifiedNoveltyFailures.length,
    failures: qualifiedNoveltyFailures,
  },
  algorithmEvidence: {
    path:
      "scripts/lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs",
    sha256: sha256File(
      "scripts/lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs",
    ),
  },
  postRgbAlgorithmEvidence: {
    path: "scripts/lib/ai-assisted-composition-novelty.mjs",
    sha256: sha256File(
      "scripts/lib/ai-assisted-composition-novelty.mjs",
    ),
  },
  businessBoundary: {
    imageGenerated: false,
    preRgbHistoricalRgbRead: false,
    postRgbHistoricalRgbReadForAuditOnly: true,
    historicalRgbSuppliedToGenerator: false,
    worldFactsChanged: false,
    conditionGeometryChanged: false,
    promptChanged: false,
    pageChanged: false,
    capacityChanged: false,
    gpuTrainingStarted: false,
    runtimeStarted: false,
    worldEntryStarted: false,
  },
  automaticStorage: true,
}
const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "repair-check-report.json",
  record: report,
  latest: {
    sourceRecordId: SOURCE_RECORD_ID,
    status: report.status,
    candidateGuideSha256: report.candidateGuideSha256,
    matchedRecordIds: [
      ...new Set([...matchedRecordIds, ...latestMatchedRecordIds]),
    ],
    imageGenerated: false,
    gpuTrainingStarted: false,
  },
})
const reportSha256 = sha256File(stored.runPath)
const event = appendAiPainterProgramEvent({
  timestamp: new Date().toISOString(),
  action: "pre_rgb_topology_gate_repair_checked",
  runId,
  kind: "repair_check",
  status: "success",
  title: "Pre-RGB macro-topology hard gate repair passed",
  titleZh: "RGB生成前宏观拓扑硬门禁修复检查通过",
  detail:
    `sourceRecordId=${SOURCE_RECORD_ID}; preRgbMatched=${matchedRecordIds.join(",")}; postRgbBlocked=${rgbCompositionAudits.length}; imageGenerated=false`,
  detailZh:
    `来源槽位=${SOURCE_RECORD_ID}；命中重复=${matchedRecordIds.join("、")}；生成图片=false`,
  script:
    "scripts/check-ai-assisted-pre-rgb-topology-gate-repair.mjs",
  currentStep: "pre_rgb_topology_gate_repair_checked",
  evidencePath: stored.runPath,
  evidence: [
    stored.runPath,
    OLD_AUDIT_PATH,
    GUIDE_PATH,
    LATEST_GUIDE_PATH,
    ...rgbCompositionAudits.map((entry) => entry.recordPath),
  ],
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

console.log(JSON.stringify({
  ok: true,
  status: report.status,
  runId,
  reportPath: stored.runPath,
  reportSha256,
  matchedRecordIds,
  latestMatchedRecordIds,
  postRgbBlockedRecordIds: rgbCompositionAudits.map(
    (entry) => entry.recordId,
  ),
  qualifiedCapacityRgbRecordCount: qualifiedRecordIds.length,
  qualifiedCapacityRgbFailureCount:
    qualifiedNoveltyFailures.length,
  historicalAuditPassed: oldAudit.passed,
  repairedAuditPassed: repairedAudit.passed,
  imageGenerated: false,
  gpuTrainingStarted: false,
  ledgerEventId: event.id,
}, null, 2))

function readJson(value) {
  return JSON.parse(
    fs.readFileSync(resolveProjectPath(value), "utf8"),
  )
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assert(
    resolved === ROOT ||
      resolved.startsWith(`${path.resolve(ROOT)}${path.sep}`),
    `path escapes project: ${value}`,
  )
  return resolved
}

function sha256File(value) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(resolveProjectPath(value)))
    .digest("hex")
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
