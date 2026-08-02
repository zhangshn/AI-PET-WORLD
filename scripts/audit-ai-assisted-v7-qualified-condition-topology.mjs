import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"
import {
  auditPreRgbConditionGuideNovelty,
} from "./lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs"

const ROOT = process.cwd()
const CAPACITY_POINTER_PATH =
  ".runtime/ai-painter/ai-assisted-v7-data-capacity-plans/latest.json"
const LIBRARY_INDEX_PATH =
  "data/world-samples/original-image-library/natural-home-v1/index.json"
const AUDIT_ROOT =
  ".runtime/ai-painter/ai-assisted-v7-qualified-condition-topology-audits"
const createdAtUtc = new Date().toISOString()
const createdAtAsiaShanghai = formatShanghai(createdAtUtc)
const runId =
  `ai-assisted-v7-qualified-condition-topology-audit-` +
  createdAtUtc.replace(/[:.]/g, "-")

const capacityPointer = readJson(CAPACITY_POINTER_PATH)
const capacityPlan = readJson(capacityPointer.capacityPlanPath)
const sourceIndex = readJson(capacityPlan.sourceIndexPath)
const reclassification = readJson(
  capacityPlan.capacityReclassification.path,
)
const libraryIndex = readJson(LIBRARY_INDEX_PATH)
const suspendedRecordIds = new Set(
  capacityPlan.capacityReclassification.suspendedRecordIds ??
    (reclassification.suspendedRecords ?? []).map(
      (entry) => entry.recordId,
    ),
)
const currentConditionRecordIds = (
  sourceIndex.currentConditionPairs ?? []
).map((entry) => entry.recordId ?? entry.sampleId)
const qualifiedV7RecordIds = (
  sourceIndex.v7CapacityContributions ?? []
)
  .map((entry) => entry.recordId ?? entry.sampleId)
  .filter((recordId) => !suspendedRecordIds.has(recordId))
const qualifiedRecordIds = [
  ...new Set([
    ...currentConditionRecordIds,
    ...qualifiedV7RecordIds,
  ]),
]

assert(
  qualifiedRecordIds.length ===
    capacityPlan.auditSummary.qualifiedExistingRecordCount,
  `qualified record identity count mismatch: expected ${capacityPlan.auditSummary.qualifiedExistingRecordCount}, found ${qualifiedRecordIds.length}`,
)

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: "v7_qualified_condition_topology_reaudit_started",
  runId,
  kind: "condition_topology_reaudit",
  status: "running",
  title: "V7 qualified condition-guide topology audit started",
  titleZh: "V7当前合格条件引导图拓扑复核已启动",
  detail:
    `qualifiedRecordCount=${qualifiedRecordIds.length}; historicalRgbRead=false; imageGenerationStarted=false`,
  detailZh:
    `当前登记合格记录数=${qualifiedRecordIds.length}；读取历史RGB=false；启动图片生成=false`,
  script:
    "scripts/audit-ai-assisted-v7-qualified-condition-topology.mjs",
  currentStep: "qualified_condition_topology_reaudit",
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

const results = []
for (const recordId of qualifiedRecordIds) {
  const record = (libraryIndex.records ?? []).find(
    (entry) => entry.recordId === recordId,
  )
  assert(record, `qualified original-image record is missing: ${recordId}`)
  assert(
    record.reviews?.ownerReviewStatus === "owner_approved",
    `qualified record is not owner approved: ${recordId}`,
  )
  const guidePath = record.conditionBinding?.guidePath
  const taskPackagePath =
    record.conditionBinding?.taskPackagePath ??
    record.worldBinding?.taskPackagePath
  assert(
    taskPackagePath &&
      fs.existsSync(resolveProjectPath(taskPackagePath)),
    `qualified record task package is missing: ${recordId}`,
  )
  const task = readJson(taskPackagePath)
  const blueprintPath =
    task.sourceBindings?.trainingBlueprintPath
  assert(
    blueprintPath &&
      fs.existsSync(resolveProjectPath(blueprintPath)),
    `qualified record training blueprint is missing: ${recordId}`,
  )
  const blueprint = readJson(blueprintPath)
  const connectivityBlueprintPath =
    blueprint.connectivityBlueprintPath ??
    task.sourceBindings?.connectivityBlueprintPath
  const connectivityBlueprint =
    connectivityBlueprintPath &&
    fs.existsSync(resolveProjectPath(connectivityBlueprintPath))
      ? readJson(connectivityBlueprintPath)
      : null
  assert(guidePath, `qualified record condition guide is missing: ${recordId}`)
  assert(
    fs.existsSync(resolveProjectPath(guidePath)),
    `qualified record condition guide file is missing: ${recordId}`,
  )
  const audit = await auditPreRgbConditionGuideNovelty({
    sourceRecordId:
      record.v7CapacityContribution?.capacitySlotId ??
      record.capacityContribution?.capacitySlotId ??
      recordId,
    guidePath,
    candidateRecordId: recordId,
    blueprintPath,
  })
  const structuralIssueCodes = [
    ...(!blueprint.realEarthRegionSourcePackageId ||
    !blueprint.realEarthRegionSourcePackagePath
      ? ["real_earth_region_source_package_missing"]
      : []),
    ...(!blueprint.connectivityBlueprintId ||
    !connectivityBlueprint
      ? ["concrete_region_connectivity_instance_missing"]
      : []),
    ...(blueprint.connectivityBlueprintId ===
      "mainland-southeast-asia-earth-reference-natural-home-region-0001-v1" ||
    connectivityBlueprint?.blueprintId ===
      "mainland-southeast-asia-earth-reference-natural-home-region-0001-v1"
      ? ["concrete_region_0001_connectivity_instance_reused"]
      : []),
    ...(!connectivityBlueprint?.currentRegion
        ?.neighborRegionIds?.length &&
      !connectivityBlueprint?.neighborRegionStubs?.length
      ? ["region_world_graph_connection_missing"]
      : []),
    ...(!blueprint.structuralIdentities
        ?.themeArchitectureIdentity
      ? ["theme_architecture_identity_missing"]
      : []),
    ...(!blueprint.structuralIdentities
        ?.instanceDetailIdentity
      ? ["instance_detail_identity_missing"]
      : []),
    ...(connectivityContainsPresetHomeCenter(
      connectivityBlueprint,
    )
      ? ["preset_home_center_in_connectivity"]
      : []),
  ]
  const issueCodes = [
    ...new Set([
      ...structuralIssueCodes,
      ...audit.issues.map((issue) => issue.code),
    ]),
  ]
  const compositionMatches =
    audit.approvedMacroCompositionMatches.map(
      compactCompositionMatch,
    )
  const detailMatches = audit.detailContentMatches.map(
    (entry) => ({
      recordId: entry.recordId,
      recordStatus: entry.recordStatus,
      ownerReviewStatus: entry.ownerReviewStatus,
      detailMatchedTransforms:
        entry.detailMatchedTransforms,
    }),
  )
  const connectivityMatches =
    audit.concreteRegionConnectivityMatches.map(
      (entry) => ({
        recordId: entry.recordId,
        recordStatus: entry.recordStatus,
        ownerReviewStatus: entry.ownerReviewStatus,
        connectivityBlueprintId:
          entry.historicalConnectivityBlueprintId,
      }),
    )
  results.push({
    recordId,
    taskPackagePath,
    taskPackageSha256: sha256File(taskPackagePath),
    blueprintPath,
    blueprintSha256: sha256File(blueprintPath),
    realEarthRegionSourcePackageId:
      blueprint.realEarthRegionSourcePackageId ?? null,
    realEarthRegionSourcePackagePath:
      blueprint.realEarthRegionSourcePackagePath ?? null,
    connectivityBlueprintId:
      blueprint.connectivityBlueprintId ?? null,
    connectivityBlueprintPath:
      connectivityBlueprintPath ?? null,
    structuralIdentities:
      blueprint.structuralIdentities ?? null,
    conditionGuidePath: guidePath,
    conditionGuideSha256: audit.candidateGuideSha256,
    passed:
      structuralIssueCodes.length === 0 &&
      audit.passed,
    matchedRecordIds:
      [
        ...compositionMatches,
        ...detailMatches,
        ...connectivityMatches,
      ]
        .map((entry) => entry.recordId)
        .filter(
          (value, index, values) =>
            values.indexOf(value) === index,
        ),
    issueCodes,
    compositionMatches,
    detailMatches,
    connectivityMatches,
    comparisonSummary: {
      status: audit.status,
      historicalCompleteMapConditionGuidesCompared:
        audit.historicalCompleteMapConditionGuidesCompared,
      skippedRecordCount: audit.skippedRecordCount,
      connectivityComparisonIncompleteCount:
        audit.connectivityComparisonIncompleteCount,
      chronologyExcludedRecordCount:
        audit.chronologyExcludedRecordCount,
    },
  })
}

const findings = results.filter((entry) => !entry.passed)
const report = {
  schemaVersion:
    "ai-assisted-v7-qualified-connectivity-theme-detail-audit-v2",
  runId,
  status:
    findings.length === 0
      ? "qualified_condition_topology_audit_passed"
      : "qualified_condition_topology_audit_completed_with_findings",
  createdAtUtc,
  createdAtAsiaShanghai,
  capacityPlan: {
    runId: capacityPlan.runId,
    path: capacityPointer.capacityPlanPath,
    sha256: sha256File(capacityPointer.capacityPlanPath),
    qualifiedExistingRecordCount:
      capacityPlan.auditSummary.qualifiedExistingRecordCount,
    requiredNewRecordCount:
      capacityPlan.gapSummary.requiredNewRecordCount,
  },
  sourceIndex: {
    path: capacityPlan.sourceIndexPath,
    sha256: sha256File(capacityPlan.sourceIndexPath),
  },
  reclassification: {
    path: capacityPlan.capacityReclassification.path,
    sha256: sha256File(
      capacityPlan.capacityReclassification.path,
    ),
    suspendedHistoricalRecordCount:
      suspendedRecordIds.size,
  },
  method: {
    algorithm:
      "real_earth_source_plus_concrete_connectivity_plus_theme_architecture_plus_instance_detail_all_history_v1",
    comparisonScope:
      `current_qualified_${qualifiedRecordIds.length}_condition_guides_against_all_chronology_eligible_complete_map_references`,
    requiredGates: [
      "real_earth_region_source_package_present",
      "concrete_region_connectivity_instance_unique",
      "region_connected_to_world_graph",
      "theme_architecture_identity_unique",
      "instance_detail_identity_unique",
    ],
    historicalRgbRead: false,
    historicalConditionGuidesReadForAuditOnly: true,
    originalRecordsModified: false,
    ownerReviewsModified: false,
    capacityContributionsModified: false,
    capacityCountRewritten: false,
    imageGenerationStarted: false,
    rgbCreated: false,
    gpuTrainingStarted: false,
    runtimeFrameCreated: false,
    worldEntryStarted: false,
  },
  algorithmEvidence: {
    path:
      "scripts/lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs",
    sha256: sha256File(
      "scripts/lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs",
    ),
  },
  summary: {
    auditedRecordCount: results.length,
    passedRecordCount: results.length - findings.length,
    legacyQualifiedCount:
      capacityPlan.auditSummary.qualifiedExistingRecordCount,
    structurallyReverifiedTrainingTruthCount:
      results.length - findings.length,
    recordsRequiringReviewCount: findings.length,
    recordsRequiringReview: findings.map((entry) => ({
      recordId: entry.recordId,
      matchedRecordIds: entry.matchedRecordIds,
      issueCodes: entry.issueCodes,
    })),
    trainingBlockedPendingTopologyReview:
      findings.length > 0,
    historicalQualifiedCountIsCurrentTrainingTruth:
      findings.length === 0,
  },
  results,
  automaticStorage: true,
}

const stored = writeImmutableProgramRun({
  root: AUDIT_ROOT,
  runId,
  fileName: "audit-report.json",
  record: report,
  latest: {
    capacityPlanRunId: capacityPlan.runId,
    auditedRecordCount: report.summary.auditedRecordCount,
    recordsRequiringReviewCount:
      report.summary.recordsRequiringReviewCount,
    trainingBlockedPendingTopologyReview:
      report.summary.trainingBlockedPendingTopologyReview,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
})
const reportSha256 = sha256File(stored.runPath)
appendAiPainterProgramEvent({
  timestamp: new Date().toISOString(),
  action: "v7_qualified_condition_topology_reaudit_completed",
  runId,
  kind: "condition_topology_reaudit",
  status: findings.length === 0 ? "success" : "blocked",
  title:
    findings.length === 0
      ? "V7 qualified condition-guide topology audit passed"
      : "V7 qualified condition-guide topology audit found repeated macro structures",
  titleZh:
    findings.length === 0
      ? "V7当前合格条件引导图拓扑复核通过"
      : "V7当前合格条件引导图拓扑复核发现宏观结构重复",
  detail:
    `audited=${results.length}; requiringReview=${findings.length}; reportSha256=${reportSha256}`,
  detailZh:
    `已复核=${results.length}；需要重新确认=${findings.length}；报告SHA-256=${reportSha256}`,
  script:
    "scripts/audit-ai-assisted-v7-qualified-condition-topology.mjs",
  currentStep: "qualified_condition_topology_reaudit_complete",
  evidencePath: stored.runPath,
  evidence: [stored.runPath],
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

console.log(JSON.stringify({
  runId,
  status: report.status,
  reportPath: stored.runPath,
  reportSha256,
  summary: report.summary,
  imageGenerationStarted: false,
  rgbCreated: false,
  gpuTrainingStarted: false,
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

function connectivityContainsPresetHomeCenter(connectivity) {
  if (!connectivity) return false
  return JSON.stringify(connectivity)
    .toLowerCase()
    .includes("home_center")
}

function compactCompositionMatch(entry) {
  return {
    recordId: entry.recordId,
    recordStatus: entry.recordStatus,
    ownerReviewStatus: entry.ownerReviewStatus,
    compositionReferenceClass:
      entry.compositionReferenceClass,
    compositionReferenceReasonCodes:
      entry.compositionReferenceReasonCodes,
    guideSha256: entry.guideSha256,
    exactConditionGuideDuplicate:
      entry.exactConditionGuideDuplicate,
    macroTopologyDuplicate:
      entry.macroTopologyDuplicate,
    matchedTransform: entry.matchedTransform,
    transformDerivedDuplicate:
      entry.transformDerivedDuplicate,
    strongCompositeSkeletonDuplicate:
      entry.strongCompositeSkeletonDuplicate,
    topologyMetrics: entry.topologyMetrics,
    waterLayoutIntersection:
      entry.waterLayoutIntersection,
    routeLayoutIntersection:
      entry.routeLayoutIntersection,
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
