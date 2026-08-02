import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"
import {
  auditAiAssistedCompositionNovelty,
} from "./lib/ai-assisted-composition-novelty.mjs"

const ROOT = process.cwd()
const TOPOLOGY_AUDIT_POINTER_PATH =
  ".runtime/ai-painter/ai-assisted-v7-qualified-condition-topology-audits/latest.json"
const LIBRARY_INDEX_PATH =
  "data/world-samples/original-image-library/natural-home-v1/index.json"
const OUTPUT_ROOT =
  ".runtime/ai-painter/ai-assisted-v7-qualified-topology-diagnostics"
const topologyAuditPointer = readJson(
  TOPOLOGY_AUDIT_POINTER_PATH,
)
const topologyAudit = readJson(topologyAuditPointer.runPath)
const capacityPlan = readJson(topologyAudit.capacityPlan.path)
const reclassification = readJson(
  capacityPlan.capacityReclassification.path,
)
const libraryIndex = readJson(LIBRARY_INDEX_PATH)
const qualifiedRecordIds = new Set(
  topologyAudit.results.map((entry) => entry.recordId),
)
const suspendedRecordIds = new Set(
  capacityPlan.capacityReclassification.suspendedRecordIds ??
    (reclassification.suspendedRecords ?? []).map(
      (entry) => entry.recordId,
    ),
)
const findingResults = topologyAudit.results.filter(
  (entry) => !entry.passed,
)

assert(
  topologyAudit.summary.auditedRecordCount ===
    capacityPlan.auditSummary.qualifiedExistingRecordCount,
  "topology audit and capacity plan qualified counts differ",
)
assert(
  findingResults.length ===
    topologyAudit.summary.recordsRequiringReviewCount,
  "topology audit finding count mismatch",
)

const createdAtUtc = new Date().toISOString()
const createdAtAsiaShanghai = formatShanghai(createdAtUtc)
const runId =
  `ai-assisted-v7-qualified-topology-diagnosis-` +
  createdAtUtc.replace(/[:.]/g, "-")

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: "v7_qualified_topology_findings_diagnosis_started",
  runId,
  kind: "topology_diagnosis",
  status: "running",
  title: "V7 qualified topology findings diagnosis started",
  titleZh: "V7当前合格拓扑命中项诊断已启动",
  detail:
    `findingRecordCount=${findingResults.length}; historicalRgbReadForAuditOnly=true; imageGenerationStarted=false`,
  detailZh:
    `命中记录数=${findingResults.length}；仅审核读取历史RGB=true；启动图片生成=false`,
  script:
    "scripts/diagnose-ai-assisted-v7-qualified-topology-findings.mjs",
  currentStep: "qualified_topology_findings_diagnosis",
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

const diagnostics = []
for (const finding of findingResults) {
  const record = recordById(finding.recordId)
  const imagePath = resolveRecordImagePath(record)
  assert(
    fs.existsSync(imagePath),
    `qualified record image is missing: ${record.recordId}`,
  )
  const rgbAudit = await auditAiAssistedCompositionNovelty({
    record,
    imagePath,
  })
  const matchedReferences =
    finding.compositionMatches.map(
      (comparison) => {
        const reference = recordById(comparison.recordId)
        const referenceClass = classifyReference(
          comparison,
          reference,
        )
        return {
          recordId: comparison.recordId,
          referenceClass,
          currentQualified:
            qualifiedRecordIds.has(comparison.recordId),
          suspendedHistorical:
            suspendedRecordIds.has(comparison.recordId),
          ownerReviewStatus:
            reference.reviews?.ownerReviewStatus ?? null,
          ownerReviewReasonCodes:
            comparison.compositionReferenceReasonCodes,
          conditionGuideSha256: comparison.guideSha256,
          exactConditionGuideDuplicate:
            comparison.exactConditionGuideDuplicate,
          macroTopologyDuplicate:
            comparison.macroTopologyDuplicate,
          topologyMetrics: comparison.topologyMetrics,
          waterLayoutIntersection:
            comparison.waterLayoutIntersection,
          routeLayoutIntersection:
            comparison.routeLayoutIntersection,
          rgbExactOrNearDuplicate:
            rgbAudit.exactMatches.some(
              (entry) =>
                entry.recordId === comparison.recordId,
            ),
          rgbRejectedCompositionMatch:
            rgbAudit.rejectedCompositionMatches.some(
              (entry) =>
                entry.recordId === comparison.recordId,
            ),
          rgbNearestMetrics:
            rgbAudit.nearestComparisons.find(
              (entry) =>
                entry.recordId === comparison.recordId,
            ) ?? null,
        }
      },
    )
  diagnostics.push({
    recordId: record.recordId,
    capacitySlotId:
      record.v7CapacityContribution?.capacitySlotId ??
      record.capacityContribution?.capacitySlotId ??
      null,
    currentQualified: true,
    conditionGuidePath:
      record.conditionBinding.guidePath,
    conditionGuideSha256:
      finding.conditionGuideSha256,
    rgbImagePath: projectPath(imagePath),
    rgbImageSha256: record.originalImage.sha256,
    matchedReferences,
    currentQualifiedMatches:
      matchedReferences
        .filter((entry) => entry.currentQualified)
        .map((entry) => entry.recordId),
    ownerRejectedPatternMatches:
      matchedReferences
        .filter(
          (entry) =>
            entry.referenceClass ===
            "owner_rejected_topology_pattern_reuse",
        )
        .map((entry) => entry.recordId),
    suspendedHistoricalMatches:
      matchedReferences
        .filter(
          (entry) =>
            entry.referenceClass ===
            "suspended_historical_topology_reuse",
        )
        .map((entry) => entry.recordId),
    excludedHistoricalMatches:
      matchedReferences
        .filter(
          (entry) =>
            entry.referenceClass ===
            "excluded_historical_topology_reuse",
        )
        .map((entry) => entry.recordId),
    rgbAudit,
    diagnosis:
      matchedReferences.some((entry) => entry.currentQualified)
        ? "current_qualified_topology_collision_owner_decision_required"
        : matchedReferences.some(
              (entry) =>
                entry.referenceClass ===
                "owner_rejected_topology_pattern_reuse",
            )
          ? "owner_rejected_pattern_reuse_owner_decision_required"
          : "historical_excluded_pattern_reuse_owner_decision_required",
  })
}

const currentQualifiedCollisionEdges = diagnostics.flatMap(
  (entry) =>
    entry.currentQualifiedMatches.map((matchedRecordId) => [
      entry.recordId,
      matchedRecordId,
    ]),
)
const collisionGroups = buildCollisionGroups(
  currentQualifiedCollisionEdges,
)
const currentQualifiedDuplicateExcessCount =
  collisionGroups.reduce(
    (total, group) => total + Math.max(0, group.length - 1),
    0,
  )
const report = {
  schemaVersion:
    "ai-assisted-v7-qualified-topology-findings-diagnosis-v1",
  runId,
  status:
    "qualified_topology_findings_diagnosed_owner_decision_required",
  createdAtUtc,
  createdAtAsiaShanghai,
  sourceTopologyAudit: {
    runId: topologyAudit.runId,
    path: topologyAuditPointer.runPath,
    sha256: sha256File(topologyAuditPointer.runPath),
  },
  capacityPlan: {
    runId: capacityPlan.runId,
    path: topologyAudit.capacityPlan.path,
    sha256: sha256File(topologyAudit.capacityPlan.path),
    registeredQualifiedCount:
      capacityPlan.auditSummary.qualifiedExistingRecordCount,
    registeredRemainingCount:
      capacityPlan.gapSummary.requiredNewRecordCount,
  },
  summary: {
    diagnosedFindingRecordCount: diagnostics.length,
    currentQualifiedCollisionGroupCount:
      collisionGroups.length,
    currentQualifiedCollisionGroups:
      collisionGroups,
    currentQualifiedDuplicateExcessCount,
    diagnosticDistinctTopologyLowerBound:
      capacityPlan.auditSummary.qualifiedExistingRecordCount -
      currentQualifiedDuplicateExcessCount,
    ownerRejectedPatternReuseRecordCount:
      diagnostics.filter(
        (entry) =>
          entry.ownerRejectedPatternMatches.length > 0,
      ).length,
    suspendedHistoricalPatternReuseRecordCount:
      diagnostics.filter(
        (entry) =>
          entry.suspendedHistoricalMatches.length > 0,
      ).length,
    excludedHistoricalPatternReuseRecordCount:
      diagnostics.filter(
        (entry) =>
          entry.excludedHistoricalMatches.length > 0,
      ).length,
    ownerDecisionRequired: true,
    capacityCountChanged: false,
    trainingBlockedPendingOwnerDecision: true,
  },
  diagnostics,
  method: {
    conditionTopologyAudit:
      "macro_topology_corridors_plus_water_route_iou_v3",
    rgbAudit:
      "chronology_bounded_sha256_dhash_blurred_structure_water_route_v3",
    historicalRgbReadForAuditOnly: true,
    historicalRgbProvidedToGenerator: false,
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
    conditionTopologyPath:
      "scripts/lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs",
    conditionTopologySha256: sha256File(
      "scripts/lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs",
    ),
    rgbAuditPath:
      "scripts/lib/ai-assisted-composition-novelty.mjs",
    rgbAuditSha256: sha256File(
      "scripts/lib/ai-assisted-composition-novelty.mjs",
    ),
  },
  automaticStorage: true,
}

const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "diagnosis-report.json",
  record: report,
  latest: {
    sourceTopologyAuditRunId: topologyAudit.runId,
    diagnosedFindingRecordCount:
      report.summary.diagnosedFindingRecordCount,
    currentQualifiedCollisionGroupCount:
      report.summary.currentQualifiedCollisionGroupCount,
    currentQualifiedCollisionGroups:
      report.summary.currentQualifiedCollisionGroups,
    diagnosticDistinctTopologyLowerBound:
      report.summary.diagnosticDistinctTopologyLowerBound,
    ownerDecisionRequired: true,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
})
const reportSha256 = sha256File(stored.runPath)
appendAiPainterProgramEvent({
  timestamp: new Date().toISOString(),
  action: "v7_qualified_topology_findings_diagnosis_completed",
  runId,
  kind: "topology_diagnosis",
  status: "blocked",
  title:
    "V7 qualified topology findings diagnosed; owner decision required",
  titleZh:
    "V7当前合格拓扑命中项诊断完成，等待项目所有者决定",
  detail:
    `findings=${diagnostics.length}; currentQualifiedCollisionGroups=${collisionGroups.length}; registeredCapacityChanged=false; reportSha256=${reportSha256}`,
  detailZh:
    `命中项=${diagnostics.length}；当前合格集内部碰撞组=${collisionGroups.length}；登记容量变化=false；报告SHA-256=${reportSha256}`,
  script:
    "scripts/diagnose-ai-assisted-v7-qualified-topology-findings.mjs",
  currentStep:
    "qualified_topology_findings_diagnosed_waiting_owner_decision",
  evidencePath: stored.runPath,
  evidence: [stored.runPath, topologyAuditPointer.runPath],
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

console.log(JSON.stringify({
  runId,
  status: report.status,
  reportPath: stored.runPath,
  reportSha256,
  summary: report.summary,
  currentQualifiedCollisionGroups: collisionGroups,
  imageGenerationStarted: false,
  rgbCreated: false,
  gpuTrainingStarted: false,
}, null, 2))

function classifyReference(comparison, record) {
  if (qualifiedRecordIds.has(record.recordId)) {
    return "current_qualified_topology_collision"
  }
  if (
    comparison.compositionReferenceClass ===
    "owner_rejected_composition_duplicate"
  ) {
    return "owner_rejected_topology_pattern_reuse"
  }
  if (suspendedRecordIds.has(record.recordId)) {
    return "suspended_historical_topology_reuse"
  }
  return "excluded_historical_topology_reuse"
}

function buildCollisionGroups(edges) {
  const parent = new Map()
  function find(value) {
    if (!parent.has(value)) parent.set(value, value)
    const current = parent.get(value)
    if (current !== value) parent.set(value, find(current))
    return parent.get(value)
  }
  function union(left, right) {
    const leftRoot = find(left)
    const rightRoot = find(right)
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot)
  }
  for (const [left, right] of edges) union(left, right)
  const groups = new Map()
  for (const value of parent.keys()) {
    const root = find(value)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(value)
  }
  return [...groups.values()]
    .map((group) => [...new Set(group)].sort())
    .filter((group) => group.length > 1)
    .sort((left, right) => left[0].localeCompare(right[0]))
}

function recordById(recordId) {
  const record = (libraryIndex.records ?? []).find(
    (entry) => entry.recordId === recordId,
  )
  assert(record, `original-image record is missing: ${recordId}`)
  return record
}

function resolveRecordImagePath(record) {
  return resolveProjectPath(
    path.join(
      record.relativeDirectory,
      record.originalImage.path,
    ),
  )
}

function projectPath(value) {
  return path
    .relative(ROOT, path.resolve(value))
    .replace(/\\/g, "/")
}

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
