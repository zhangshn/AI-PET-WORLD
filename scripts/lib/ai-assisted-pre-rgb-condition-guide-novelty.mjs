import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const INDEX_PATH =
  "data/world-samples/original-image-library/natural-home-v1/index.json"
const AUDIT_ROOT =
  ".runtime/ai-painter/ai-assisted-pre-rgb-condition-guide-novelty-audits"
const LEGACY_STRUCTURAL_IDENTITY_BLUEPRINT_SCHEMAS = new Set([
  "ai-assisted-training-world-fact-blueprint-v1",
  "ai-assisted-training-world-fact-blueprint-v2",
])
const LEGACY_GUIDE_ONLY_RECORD_IDS = new Set([
  "ai-cold-start-map-003-condition-guided-east-river",
])
const COLORS = {
  grass: [102, 155, 72],
  mud: [120, 88, 62],
  tallGrass: [69, 128, 52],
  shoreline: [130, 116, 76],
  water: [43, 112, 156],
  route: [181, 137, 76],
  naturalBoundary: [35, 78, 42],
}
const THRESHOLDS = {
  approvedWaterLayoutDuplicateMinimumIoU: 0.75,
  approvedRouteLayoutDuplicateMinimumIoU: 0.65,
  approvedRouteCentroidMaximumNormalizedDistance: 0.12,
  dominantHalfMinimumRatio: 0.7,
  topologyVerticalBandCount: 8,
  topologySideDeadband: 0.08,
  topologyMinimumSharedWaterBandRatio: 0.75,
  topologyMinimumSharedRouteBandRatio: 0.5,
  topologyMaximumWaterBandCentroidDistance: 0.05,
  topologyMaximumRouteBandCentroidDistance: 0.25,
  topologyMinimumRelativeRelationAgreement: 0.75,
  dominantWaterMinimumLayoutIoU: 0.7,
  dominantWaterMinimumSharedBandRatio: 0.875,
  dominantWaterMaximumBandCentroidDistance: 0.05,
  compositeSkeletonRasterWidth: 64,
  compositeSkeletonRasterHeight: 48,
  strongCompositeSkeletonMinimumEqualityRatio: 0.985,
  strongCompositeSkeletonMinimumNonZeroIoU: 0.95,
  detailSkeletonRasterWidth: 256,
  detailSkeletonRasterHeight: 192,
  detailSkeletonMinimumEqualityRatio: 0.995,
  detailSkeletonMinimumNonZeroIoU: 0.98,
  crossModalHistoricalRgbWaterShapeMaximumIoU: 0.38,
  crossModalHistoricalRgbWaterLayoutMinimumIoU: 0.2,
  crossModalHistoricalRgbWaterShapeStrongIoU: 0.45,
  crossModalHistoricalRgbMinimumWaterCoverageRatio: 0.02,
  crossModalWaterRasterWidth: 64,
  crossModalWaterRasterHeight: 48,
  crossModalNormalizedWaterWidth: 32,
  crossModalNormalizedWaterHeight: 32,
}
const COMPOSITE_SKELETON_COLOR_CODES = new Map([
  [COLORS.mud.join(","), 1],
  [COLORS.tallGrass.join(","), 2],
  [COLORS.shoreline.join(","), 3],
  [COLORS.water.join(","), 4],
  [COLORS.route.join(","), 5],
  [COLORS.naturalBoundary.join(","), 6],
])
const CONDITION_GUIDE_FINGERPRINT_CACHE = new Map()
const HISTORICAL_RGB_WATER_FINGERPRINT_CACHE = new Map()

export async function auditPreRgbConditionGuideNovelty({
  sourceRecordId,
  guidePath,
  candidateRecordId = null,
  blueprintPath = null,
  excludedHistoricalRecordIds = [],
}) {
  const excludedRecordIdSet = new Set(excludedHistoricalRecordIds)
  const index = readJson(INDEX_PATH)
  const candidate = await fingerprintGuide(resolveProjectPath(guidePath))
  const candidateBlueprint = blueprintPath
    ? readJson(resolveProjectPath(blueprintPath))
    : null
  const candidateRecord = candidateRecordId
    ? (index.records ?? []).find(
        (record) => record.recordId === candidateRecordId,
      )
    : null
  const candidateCreatedAtMs = timestampMs(
    candidateRecord?.createdAtUtc,
  )
  const candidateVariants = guideTransformVariants(candidate)
  const comparisons = []
  let skippedRecordCount = 0
  let connectivityComparisonIncompleteCount = 0
  let chronologyExcludedRecordCount = 0
  let legacyStructuralIdentityCompatibilityCount = 0
  let legacyGuideOnlyCompositionReferenceCount = 0
  let crossModalHistoricalRgbComparisonIncompleteCount = 0
  const historicalStructuralIdentityCompatibilityEvidence = []

  for (const record of index.records ?? []) {
    const compositionReference = compositionReferenceFor(record)
    if (
      record.categoryId !== "complete-maps" ||
      record.recordId === candidateRecordId ||
      excludedRecordIdSet.has(record.recordId) ||
      !compositionReference ||
      !record.conditionBinding?.guidePath
    ) {
      continue
    }
    const referenceCreatedAtMs = timestampMs(record.createdAtUtc)
    if (
      candidateCreatedAtMs !== null &&
      referenceCreatedAtMs !== null &&
      referenceCreatedAtMs > candidateCreatedAtMs
    ) {
      chronologyExcludedRecordCount += 1
      continue
    }
    const historicalGuidePath = resolveProjectPath(
      record.conditionBinding.guidePath,
    )
    if (!fs.existsSync(historicalGuidePath)) {
      skippedRecordCount += 1
      continue
    }
    try {
      const historical = await fingerprintGuide(historicalGuidePath)
      const historicalRgbImagePath = resolveRecordImagePath(record)
      let historicalRgbWater = null
      if (candidate.water.pixelCount > 0) {
        if (
          !historicalRgbImagePath ||
          !fs.existsSync(historicalRgbImagePath)
        ) {
          crossModalHistoricalRgbComparisonIncompleteCount += 1
        } else {
          historicalRgbWater =
            await fingerprintHistoricalRgbWater(
              historicalRgbImagePath,
            )
        }
      }
      const historicalBlueprintEvidence =
        blueprintEvidenceForRecord(record, historical)
      const historicalBlueprint =
        historicalBlueprintEvidence.blueprint
      if (
        historicalBlueprintEvidence.evidenceClass ===
        "legacy_blueprint_structural_identity_compatibility"
      ) {
        legacyStructuralIdentityCompatibilityCount += 1
        historicalStructuralIdentityCompatibilityEvidence.push(
          historicalBlueprintEvidence.auditEvidence,
        )
      } else if (
        historicalBlueprintEvidence.evidenceClass ===
        "legacy_guide_only_composition_reference"
      ) {
        legacyGuideOnlyCompositionReferenceCount += 1
        historicalStructuralIdentityCompatibilityEvidence.push(
          historicalBlueprintEvidence.auditEvidence,
        )
      }
      if (
        candidateBlueprint &&
        record.conditionBinding?.taskPackagePath &&
        historicalBlueprintEvidence.structuralIdentityComparable !==
          true
      ) {
        connectivityComparisonIncompleteCount += 1
      }
      const variantComparisons = candidateVariants.map(
        ({ transform, guide }) =>
          compareGuideVariant({
            transform,
            candidate: guide,
            historical,
          }),
      )
      const directComparison = variantComparisons.find(
        (entry) => entry.transform === "direct",
      )
      const strongestComparison = [...variantComparisons].sort(
        (left, right) =>
          Number(right.approvedMacroCompositionDuplicate) -
            Number(left.approvedMacroCompositionDuplicate) ||
          Number(left.transform !== "direct") -
            Number(right.transform !== "direct") ||
          right.waterLayoutIntersection -
            left.waterLayoutIntersection ||
          right.routeLayoutIntersection -
            left.routeLayoutIntersection,
      )[0]
      const waterLayoutIntersection =
        directComparison.waterLayoutIntersection
      const routeLayoutIntersection =
        directComparison.routeLayoutIntersection
      const routeCentroidNormalizedDistance =
        directComparison.routeCentroidNormalizedDistance
      const candidateRouteDominantHalf =
        directComparison.candidateRouteDominantHalf
      const historicalRouteDominantHalf = dominantHorizontalHalf(
        historical.route,
      )
      const sameRouteDominantHalf =
        directComparison.sameRouteDominantHalf
      const approvedMacroCompositionDuplicate =
        variantComparisons.some(
          (entry) =>
            entry.approvedMacroCompositionDuplicate,
        )
      const matchedTransforms = variantComparisons
        .filter(
          (entry) =>
            entry.approvedMacroCompositionDuplicate,
        )
        .map((entry) => entry.transform)
      const detailContentDuplicate =
        variantComparisons.some(
          (entry) => entry.detailContentDuplicate,
        )
      const detailMatchedTransforms = variantComparisons
        .filter((entry) => entry.detailContentDuplicate)
        .map((entry) => entry.transform)
      const concreteRegionConnectivityInstanceReused = Boolean(
        candidateBlueprint?.connectivityBlueprintId &&
          historicalBlueprint?.connectivityBlueprintId &&
          candidateBlueprint.connectivityBlueprintId ===
            historicalBlueprint.connectivityBlueprintId,
      )
      const crossModalWaterComparisons = historicalRgbWater
        ? candidateVariants.map(({ transform, guide }) => ({
            transform,
            layoutIntersection: maskIntersectionOverUnion(
              guide.rgbAuditWater.mask,
              historicalRgbWater.mask,
            ),
            normalizedShapeIntersection: maskIntersectionOverUnion(
              guide.rgbAuditWater.normalizedMask,
              historicalRgbWater.normalizedMask,
            ),
          }))
        : []
      const strongestCrossModalWaterComparison =
        [...crossModalWaterComparisons].sort(
          (left, right) =>
            right.normalizedShapeIntersection -
              left.normalizedShapeIntersection ||
            right.layoutIntersection - left.layoutIntersection,
        )[0] ?? null
      const qualifyingCrossModalWaterComparison =
        crossModalWaterComparisons.find(
          (entry) =>
            entry.normalizedShapeIntersection >=
              THRESHOLDS
                .crossModalHistoricalRgbWaterShapeMaximumIoU &&
            (
              entry.layoutIntersection >=
                THRESHOLDS
                  .crossModalHistoricalRgbWaterLayoutMinimumIoU ||
              entry.normalizedShapeIntersection >=
                THRESHOLDS
                  .crossModalHistoricalRgbWaterShapeStrongIoU
            ),
        ) ?? null
      const crossModalHistoricalRgbWaterShapeDuplicate = Boolean(
        qualifyingCrossModalWaterComparison &&
          candidate.water.pixelCount > 0 &&
          historicalRgbWater.pixelCount > 0 &&
          historicalRgbWater.coverageRatio >=
            THRESHOLDS
              .crossModalHistoricalRgbMinimumWaterCoverageRatio,
      )

      comparisons.push({
        recordId: record.recordId,
        recordStatus: record.status,
        ownerReviewStatus: record.reviews?.ownerReviewStatus ?? null,
        compositionReferenceClass: compositionReference.referenceClass,
        compositionReferenceReasonCodes:
          compositionReference.reasonCodes,
        guidePath: projectPath(historicalGuidePath),
        guideSha256: historical.sha256,
        exactConditionGuideDuplicate:
          candidate.sha256 === historical.sha256,
        waterLayoutIntersection,
        routeLayoutIntersection,
        routeCentroidNormalizedDistance,
        candidateRouteDominantHalf,
        historicalRouteDominantHalf,
        sameRouteDominantHalf,
        candidateMacroTopology:
          strongestComparison.topologyComparison.candidate,
        historicalMacroTopology:
          strongestComparison.topologyComparison.historical,
        topologyMetrics:
          strongestComparison.topologyComparison.metrics,
        macroTopologyDuplicate:
          strongestComparison.topologyComparison
            .macroTopologyDuplicate,
        matchedTransform:
          approvedMacroCompositionDuplicate
            ? strongestComparison.transform
            : null,
        matchedTransforms,
        transformDerivedDuplicate:
          directComparison.approvedMacroCompositionDuplicate !== true &&
          matchedTransforms.some(
            (transform) => transform !== "direct",
          ),
        strongCompositeSkeletonDuplicate:
          strongestComparison
            .strongCompositeSkeletonDuplicate,
        compositeSkeletonMetrics: {
          equalityRatio:
            strongestComparison.compositeSkeletonEqualityRatio,
          nonZeroIntersectionOverUnion:
            strongestComparison
              .compositeSkeletonNonZeroIntersectionOverUnion,
        },
        detailContentDuplicate,
        detailMatchedTransforms,
        concreteRegionConnectivityInstanceReused,
        crossModalHistoricalRgbWaterShapeDuplicate,
        crossModalHistoricalRgbWaterShapeMetrics:
          qualifyingCrossModalWaterComparison ??
          strongestCrossModalWaterComparison
            ? {
                ...strongestCrossModalWaterComparison,
                historicalRgbWaterCoverageRatio:
                  historicalRgbWater?.coverageRatio ?? 0,
              }
            : null,
        crossModalHistoricalRgbWaterShapeComparisons:
          crossModalWaterComparisons,
        candidateConnectivityBlueprintId:
          candidateBlueprint?.connectivityBlueprintId ?? null,
        historicalConnectivityBlueprintId:
          historicalBlueprint?.connectivityBlueprintId ?? null,
        historicalStructuralIdentityEvidenceClass:
          historicalBlueprintEvidence.evidenceClass,
        historicalThemeArchitectureIdentity:
          historicalBlueprint?.structuralIdentities
            ?.themeArchitectureIdentity ?? null,
        historicalInstanceDetailIdentity:
          historicalBlueprint?.structuralIdentities
            ?.instanceDetailIdentity ?? null,
        transformComparisons: variantComparisons.map(
          (entry) => ({
            transform: entry.transform,
            waterLayoutIntersection:
              entry.waterLayoutIntersection,
            routeLayoutIntersection:
              entry.routeLayoutIntersection,
            routeCentroidNormalizedDistance:
              entry.routeCentroidNormalizedDistance,
            macroTopologyDuplicate:
              entry.topologyComparison
                .macroTopologyDuplicate,
            compositeSkeletonEqualityRatio:
              entry.compositeSkeletonEqualityRatio,
            compositeSkeletonNonZeroIntersectionOverUnion:
              entry
                .compositeSkeletonNonZeroIntersectionOverUnion,
            strongCompositeSkeletonDuplicate:
              entry.strongCompositeSkeletonDuplicate,
            detailSkeletonEqualityRatio:
              entry.detailSkeletonEqualityRatio,
            detailSkeletonNonZeroIntersectionOverUnion:
              entry.detailSkeletonNonZeroIntersectionOverUnion,
            detailContentDuplicate:
              entry.detailContentDuplicate,
            approvedMacroCompositionDuplicate:
              entry.approvedMacroCompositionDuplicate,
          }),
        ),
        approvedMacroCompositionDuplicate,
      })
    } catch {
      skippedRecordCount += 1
    }
  }

  comparisons.sort(
    (left, right) =>
      Number(right.approvedMacroCompositionDuplicate) -
        Number(left.approvedMacroCompositionDuplicate) ||
      right.waterLayoutIntersection - left.waterLayoutIntersection ||
      right.routeLayoutIntersection - left.routeLayoutIntersection,
  )
  const approvedMacroCompositionMatches = comparisons.filter(
    (entry) => entry.approvedMacroCompositionDuplicate,
  )
  const detailContentMatches = comparisons.filter(
    (entry) => entry.detailContentDuplicate,
  )
  const concreteRegionConnectivityMatches = comparisons.filter(
    (entry) => entry.concreteRegionConnectivityInstanceReused,
  )
  const crossModalHistoricalRgbWaterShapeMatches =
    comparisons.filter(
      (entry) =>
        entry.crossModalHistoricalRgbWaterShapeDuplicate,
    )
  const passed =
    approvedMacroCompositionMatches.length === 0 &&
    detailContentMatches.length === 0 &&
    concreteRegionConnectivityMatches.length === 0 &&
    crossModalHistoricalRgbWaterShapeMatches.length === 0 &&
    crossModalHistoricalRgbComparisonIncompleteCount === 0 &&
    connectivityComparisonIncompleteCount === 0 &&
    skippedRecordCount === 0
  return {
    schemaVersion:
      "ai-assisted-pre-rgb-condition-guide-novelty-audit-v1",
    status: passed
      ? "pre_rgb_condition_guide_novelty_passed"
      : skippedRecordCount > 0
        ? "blocked_before_rgb_historical_condition_guide_comparison_incomplete"
        : connectivityComparisonIncompleteCount > 0
          ? "blocked_before_rgb_historical_structural_identity_comparison_incomplete"
          : concreteRegionConnectivityMatches.length > 0
            ? "blocked_before_rgb_concrete_region_connectivity_instance_reused"
            : crossModalHistoricalRgbComparisonIncompleteCount > 0
              ? "blocked_before_rgb_historical_rgb_water_shape_comparison_incomplete"
              : crossModalHistoricalRgbWaterShapeMatches.length > 0
                ? "blocked_before_rgb_cross_modal_historical_water_shape_duplicate"
            : approvedMacroCompositionMatches.length > 0
              ? "blocked_before_rgb_complete_map_theme_architecture_duplicate"
              : "blocked_before_rgb_complete_map_detail_content_duplicate",
    passed,
    sourceRecordId,
    candidateGuidePath: projectPath(resolveProjectPath(guidePath)),
    candidateGuideSha256: candidate.sha256,
    method:
      "chronology_bounded_concrete_connectivity_plus_theme_architecture_plus_fine_detail_direct_horizontal_vertical_and_180_v7",
    thresholds: THRESHOLDS,
    historicalApprovedConditionGuidesCompared: comparisons.length,
    historicalCompositionReferencesCompared: comparisons.length,
    historicalCompleteMapConditionGuidesCompared:
      comparisons.length,
    chronologyEligibleConditionGuideCount:
      comparisons.length + skippedRecordCount,
    comparisonScope:
      "all_chronology_eligible_historical_complete_map_condition_guides",
    comparisonScopeIncludes: [
      "owner_approved",
      "owner_rejected",
      "machine_rejected",
      "pending_review",
      "other_historical_complete_map_condition_guides",
    ],
    compositionReferenceClassCounts: Object.fromEntries(
      [...new Set(comparisons.map(
        (entry) => entry.compositionReferenceClass,
      ))].map((referenceClass) => [
        referenceClass,
        comparisons.filter(
          (entry) =>
            entry.compositionReferenceClass === referenceClass,
        ).length,
      ]),
    ),
    chronologyExcludedRecordCount,
    explicitlyExcludedHistoricalRecordIds: [...excludedRecordIdSet],
    explicitlyExcludedHistoricalRecordCount: excludedRecordIdSet.size,
    skippedRecordCount,
    connectivityComparisonIncompleteCount,
    crossModalHistoricalRgbComparisonIncompleteCount,
    legacyStructuralIdentityCompatibilityCount,
    legacyGuideOnlyCompositionReferenceCount,
    historicalStructuralIdentityCompatibilityEvidence,
    nearestComparisons: comparisons.slice(0, 12),
    approvedMacroCompositionMatches,
    themeArchitectureMatches: approvedMacroCompositionMatches,
    detailContentMatches,
    concreteRegionConnectivityMatches,
    crossModalHistoricalRgbWaterShapeMatches,
    candidateStructuralIdentities:
      candidateBlueprint?.structuralIdentities ?? null,
    issues: [
      ...(skippedRecordCount > 0
        ? [{
            code: "historical_condition_guide_comparison_incomplete",
            matchedRecordId: null,
            message:
              `All chronology-eligible historical complete-map condition guides must be compared; ${skippedRecordCount} record(s) were missing or unreadable.`,
            messageZh:
              `所有时间顺序有效的历史完整地图条件引导都必须参与比较；有 ${skippedRecordCount} 条记录缺失或无法读取。`,
          }]
        : []),
      ...(connectivityComparisonIncompleteCount > 0
        ? [{
            code:
              "historical_structural_identity_comparison_incomplete",
            matchedRecordId: null,
            message:
              `All chronology-eligible conditioned complete maps must expose a concrete connectivity identity, a theme architecture identity, and an instance detail identity; ${connectivityComparisonIncompleteCount} record(s) could not be fully compared.`,
            messageZh:
              `所有按时间顺序有效且带条件的历史完整地图，都必须提供具体连接身份、主题架构身份和实例细节身份；当前有 ${connectivityComparisonIncompleteCount} 条记录无法完成结构身份比较。`,
          }]
        : []),
      ...concreteRegionConnectivityMatches.map((entry) => ({
        code: "concrete_region_connectivity_instance_reused",
        matchedRecordId: entry.recordId,
        message:
          `The candidate reuses concrete regional connectivity instance ${entry.candidateConnectivityBlueprintId} from historical complete map ${entry.recordId}.`,
      })),
      ...(crossModalHistoricalRgbComparisonIncompleteCount > 0
        ? [{
            code:
              "historical_rgb_water_shape_comparison_incomplete",
            matchedRecordId: null,
            message:
              `All historical RGB water-shape signatures required for a water-bearing condition must be readable; ${crossModalHistoricalRgbComparisonIncompleteCount} comparison(s) were incomplete.`,
          }]
        : []),
      ...crossModalHistoricalRgbWaterShapeMatches.map((entry) => ({
        code:
          "cross_modal_historical_rgb_water_shape_duplicate",
        matchedRecordId: entry.recordId,
        message:
          `The condition water skeleton is likely to render as the same position/scale-independent river template as historical RGB ${entry.recordId}.`,
        messageZh:
          `当前条件水体骨架在位置与尺度归一化后，仍可能生成与历史RGB ${entry.recordId} 相同的河道模板。`,
      })),
      ...approvedMacroCompositionMatches.map((entry) => ({
      code: "complete_map_theme_architecture_duplicate",
      matchedRecordId: entry.recordId,
      message:
        entry.transformDerivedDuplicate
          ? `The condition guide is a mirrored or 180-degree transformed macro-structure duplicate of historical complete map ${entry.recordId}.`
          : entry.strongCompositeSkeletonDuplicate
            ? `The condition guide reuses the composite terrain, water, and route skeleton of historical complete map ${entry.recordId}.`
            : entry.compositionReferenceClass ===
                "owner_rejected_composition_duplicate"
              ? `The condition guide duplicates the macro water/route organization of owner-rejected complete map ${entry.recordId}.`
              : entry.compositionReferenceClass === "owner_approved"
                ? `The condition guide duplicates the macro water/route organization of approved complete map ${entry.recordId}.`
                : `The condition guide duplicates the macro water/route organization of historical complete map ${entry.recordId} (${entry.compositionReferenceClass}).`,
      messageZh:
        entry.transformDerivedDuplicate
          ? `当前条件引导图与历史完整地图${entry.recordId}构成镜像或180度变换的宏观结构重复。`
          : entry.strongCompositeSkeletonDuplicate
            ? `当前条件引导图复用了历史完整地图${entry.recordId}的地形、水体和道路复合骨架。`
            : entry.compositionReferenceClass ===
                "owner_rejected_composition_duplicate"
              ? `当前条件引导图与项目所有者已拒绝完整地图${entry.recordId}的水体/道路宏观组织重复。`
              : entry.compositionReferenceClass === "owner_approved"
                ? `当前条件引导图与已通过完整地图${entry.recordId}的水体/道路宏观组织重复。`
                : `当前条件引导图与历史完整地图${entry.recordId}（${entry.compositionReferenceClass}）的水体/道路宏观组织重复。`,
      })), 
      ...detailContentMatches.map((entry) => ({
        code: "complete_map_detail_content_duplicate",
        matchedRecordId: entry.recordId,
        message:
          `The candidate repeats fine-grained terrain, shoreline, route, boundary, or object-footprint content from historical complete map ${entry.recordId}.`,
      })),
    ],
    evidenceBoundary: {
      historicalRgbRead: false,
      historicalRgbReadByGenerator: false,
      historicalRgbWaterShapeSignaturesReadForAuditOnly:
        candidate.water.pixelCount > 0,
      historicalRgbPixelsOrPathsForwardedToGenerator: false,
      historicalConditionGuidesReadForAuditOnly: true,
      historicalBlueprintsReadForCompatibilityAuditOnly: true,
      historicalRecordsModified: false,
      legacyGuideOnlyReferenceCanSupplyConnectivityIdentity: false,
      historicalGeometryCopied: false,
      promptModified: false,
      imageGenerationStarted: false,
      rgbCreated: false,
      gpuTrainingStarted: false,
    },
  }
}

export function persistPreRgbConditionGuideNoveltyAudit(audit) {
  const timestamp = new Date().toISOString()
  const runId =
    `ai-assisted-pre-rgb-condition-guide-novelty-${audit.sourceRecordId}-` +
    timestamp.replace(/[:.]/g, "-")
  const record = {
    ...audit,
    runId,
    createdAtUtc: timestamp,
    createdAtAsiaShanghai: formatShanghai(timestamp),
    automaticStorage: true,
  }
  const stored = writeImmutableProgramRun({
    root: AUDIT_ROOT,
    runId,
    fileName: "audit-report.json",
    record,
    latest: {
      sourceRecordId: audit.sourceRecordId,
      passed: audit.passed,
      status: audit.status,
      matchedRecordIds: audit.approvedMacroCompositionMatches.map(
        (entry) => entry.recordId,
      ).concat(
        audit.detailContentMatches.map((entry) => entry.recordId),
        audit.concreteRegionConnectivityMatches.map(
          (entry) => entry.recordId,
        ),
      ).filter((value, index, values) => values.indexOf(value) === index),
    },
  })
  const storedSha256 = sha256File(resolveProjectPath(stored.runPath))
  appendAiPainterProgramEvent({
    action: audit.passed
      ? "pre_rgb_condition_guide_novelty_passed"
      : "pre_rgb_condition_guide_macro_composition_blocked",
    runId,
    kind: audit.passed
      ? "pre_rgb_composition_gate_passed"
      : "pre_rgb_composition_gate_blocked",
    status: audit.passed ? "success" : "blocked",
    title: audit.passed
      ? "The condition guide passed the all-history pre-RGB composition gate"
      : "The condition guide was blocked before RGB because it duplicates a historical complete-map composition",
    titleZh: audit.passed
      ? "条件引导图已通过全部历史完整地图的生成前构图门禁"
      : "条件引导图因重复历史完整地图构图而在RGB生成前被阻断",
    detail: audit.passed
      ? `sourceRecordId=${audit.sourceRecordId}; compared=${audit.historicalApprovedConditionGuidesCompared}; matches=0`
      : `sourceRecordId=${audit.sourceRecordId}; matched=${audit.approvedMacroCompositionMatches.map((entry) => entry.recordId).join(",")}`,
    detailZh: audit.passed
      ? `来源槽位=${audit.sourceRecordId}；已比较=${audit.historicalApprovedConditionGuidesCompared}；重复=0`
      : `来源槽位=${audit.sourceRecordId}；命中重复=${audit.approvedMacroCompositionMatches.map((entry) => entry.recordId).join("、")}`,
    script:
      "scripts/lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs",
    currentStep: "pre_rgb_condition_guide_novelty_gate",
    errorCode: audit.passed
      ? null
      : audit.issues[0]?.code ?? "complete_map_structural_novelty_failed",
    evidencePath: stored.runPath,
    evidence: [
      stored.runPath,
      audit.candidateGuidePath,
      ...audit.approvedMacroCompositionMatches.map(
        (entry) => entry.guidePath,
      ),
    ],
    finalGameMapSuccess: false,
    canEnterWorld: false,
  })
  return {
    runId,
    runPath: stored.runPath,
    sha256: storedSha256,
  }
}

async function fingerprintGuide(filePath) {
  const cacheKey = path.resolve(filePath)
  if (CONDITION_GUIDE_FINGERPRINT_CACHE.has(cacheKey)) {
    return CONDITION_GUIDE_FINGERPRINT_CACHE.get(cacheKey)
  }
  const fingerprintPromise = computeGuideFingerprint(cacheKey)
  CONDITION_GUIDE_FINGERPRINT_CACHE.set(
    cacheKey,
    fingerprintPromise,
  )
  return fingerprintPromise
}

async function computeGuideFingerprint(filePath) {
  const bytes = fs.readFileSync(filePath)
  const { data, info } = await sharp(bytes, { failOn: "error" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const water = semanticMask(data, info, COLORS.water)
  const route = semanticMask(data, info, COLORS.route)
  const rgbAuditWaterMask = resampleBinaryMaskNearest(
    water.mask,
    info.width,
    info.height,
    THRESHOLDS.crossModalWaterRasterWidth,
    THRESHOLDS.crossModalWaterRasterHeight,
  )
  return {
    sha256: sha256(bytes),
    width: info.width,
    height: info.height,
    water,
    route,
    rgbAuditWater: {
      mask: rgbAuditWaterMask,
      normalizedMask: normalizeBinaryMaskShape(
        rgbAuditWaterMask,
        THRESHOLDS.crossModalWaterRasterWidth,
        THRESHOLDS.crossModalWaterRasterHeight,
        THRESHOLDS.crossModalNormalizedWaterWidth,
        THRESHOLDS.crossModalNormalizedWaterHeight,
      ),
    },
    compositeSkeleton: compositeSkeletonFromGuide(data, info),
    detailSkeleton: categoricalSkeletonFromGuide(
      data,
      info,
      THRESHOLDS.detailSkeletonRasterWidth,
      THRESHOLDS.detailSkeletonRasterHeight,
    ),
  }
}

function semanticMask(data, info, color) {
  const mask = new Uint8Array(info.width * info.height)
  const bandPixelCounts = Array(
    THRESHOLDS.topologyVerticalBandCount,
  ).fill(0)
  const bandXTotals = Array(
    THRESHOLDS.topologyVerticalBandCount,
  ).fill(0)
  let pixelCount = 0
  let xTotal = 0
  let yTotal = 0
  let leftHalfCount = 0
  let rightHalfCount = 0
  let minimumX = info.width
  let maximumX = -1
  let minimumY = info.height
  let maximumY = -1
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * info.channels
    if (
      data[offset] !== color[0] ||
      data[offset + 1] !== color[1] ||
      data[offset + 2] !== color[2]
    ) {
      continue
    }
    const x = index % info.width
    const y = Math.floor(index / info.width)
    mask[index] = 1
    pixelCount += 1
    xTotal += x
    yTotal += y
    minimumX = Math.min(minimumX, x)
    maximumX = Math.max(maximumX, x)
    minimumY = Math.min(minimumY, y)
    maximumY = Math.max(maximumY, y)
    const bandIndex = Math.min(
      THRESHOLDS.topologyVerticalBandCount - 1,
      Math.floor(
        (y / info.height) *
          THRESHOLDS.topologyVerticalBandCount,
      ),
    )
    bandPixelCounts[bandIndex] += 1
    bandXTotals[bandIndex] += x
    if (x < info.width / 2) leftHalfCount += 1
    else rightHalfCount += 1
  }
  const verticalBandCentroidX = bandPixelCounts.map(
    (count, index) =>
      count > 0 ? bandXTotals[index] / count / info.width : null,
  )
  const horizontalSpanRatio =
    pixelCount > 0
      ? (maximumX - minimumX + 1) / info.width
      : 0
  const verticalSpanRatio =
    pixelCount > 0
      ? (maximumY - minimumY + 1) / info.height
      : 0
  const occupiedVerticalBandRatio =
    bandPixelCounts.filter((count) => count > 0).length /
    THRESHOLDS.topologyVerticalBandCount
  return {
    mask,
    pixelCount,
    coverageRatio: Number(
      (pixelCount / Math.max(1, mask.length)).toFixed(6),
    ),
    centroidX: pixelCount > 0 ? xTotal / pixelCount : null,
    centroidY: pixelCount > 0 ? yTotal / pixelCount : null,
    leftHalfRatio:
      pixelCount > 0 ? leftHalfCount / pixelCount : 0,
    rightHalfRatio:
      pixelCount > 0 ? rightHalfCount / pixelCount : 0,
    normalizedCentroidX:
      pixelCount > 0 ? xTotal / pixelCount / info.width : null,
    normalizedCentroidY:
      pixelCount > 0 ? yTotal / pixelCount / info.height : null,
    horizontalSpanRatio: Number(horizontalSpanRatio.toFixed(6)),
    verticalSpanRatio: Number(verticalSpanRatio.toFixed(6)),
    occupiedVerticalBandRatio: Number(
      occupiedVerticalBandRatio.toFixed(6),
    ),
    verticalBandCentroidX: verticalBandCentroidX.map((value) =>
      value === null ? null : Number(value.toFixed(6)),
    ),
  }
}

function guideTransformVariants(guide) {
  return [
    {
      transform: "direct",
      guide,
    },
    {
      transform: "horizontal_mirror",
      guide: transformGuide(guide, "horizontal_mirror"),
    },
    {
      transform: "vertical_mirror",
      guide: transformGuide(guide, "vertical_mirror"),
    },
    {
      transform: "rotate_180",
      guide: transformGuide(guide, "rotate_180"),
    },
  ]
}

function transformGuide(guide, transform) {
  const transformedRgbAuditWaterMask = transformBinaryMask(
    guide.rgbAuditWater.mask,
    THRESHOLDS.crossModalWaterRasterWidth,
    THRESHOLDS.crossModalWaterRasterHeight,
    transform,
  )
  return {
    sha256: `${guide.sha256}:${transform}`,
    width: guide.width,
    height: guide.height,
    water: summarizeBinaryMask(
      transformBinaryMask(
        guide.water.mask,
        guide.width,
        guide.height,
        transform,
      ),
      guide.width,
      guide.height,
    ),
    route: summarizeBinaryMask(
      transformBinaryMask(
        guide.route.mask,
        guide.width,
        guide.height,
        transform,
      ),
      guide.width,
      guide.height,
    ),
    rgbAuditWater: {
      mask: transformedRgbAuditWaterMask,
      normalizedMask: normalizeBinaryMaskShape(
        transformedRgbAuditWaterMask,
        THRESHOLDS.crossModalWaterRasterWidth,
        THRESHOLDS.crossModalWaterRasterHeight,
        THRESHOLDS.crossModalNormalizedWaterWidth,
        THRESHOLDS.crossModalNormalizedWaterHeight,
      ),
    },
    compositeSkeleton: transformSmallGrid(
      guide.compositeSkeleton,
      THRESHOLDS.compositeSkeletonRasterWidth,
      THRESHOLDS.compositeSkeletonRasterHeight,
      transform,
    ),
    detailSkeleton: transformSmallGrid(
      guide.detailSkeleton,
      THRESHOLDS.detailSkeletonRasterWidth,
      THRESHOLDS.detailSkeletonRasterHeight,
      transform,
    ),
  }
}

async function fingerprintHistoricalRgbWater(filePath) {
  const cacheKey = path.resolve(filePath)
  if (HISTORICAL_RGB_WATER_FINGERPRINT_CACHE.has(cacheKey)) {
    return HISTORICAL_RGB_WATER_FINGERPRINT_CACHE.get(cacheKey)
  }
  const fingerprintPromise = computeHistoricalRgbWaterFingerprint(
    cacheKey,
  )
  HISTORICAL_RGB_WATER_FINGERPRINT_CACHE.set(
    cacheKey,
    fingerprintPromise,
  )
  return fingerprintPromise
}

async function computeHistoricalRgbWaterFingerprint(filePath) {
  const { data, info } = await sharp(
    fs.readFileSync(filePath),
    { failOn: "error" },
  )
    .removeAlpha()
    .resize(
      THRESHOLDS.crossModalWaterRasterWidth,
      THRESHOLDS.crossModalWaterRasterHeight,
      { fit: "fill" },
    )
    .blur(4)
    .raw()
    .toBuffer({ resolveWithObject: true })
  const mask = new Uint8Array(info.width * info.height)
  let pixelCount = 0
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * info.channels
    const red = data[offset]
    const green = data[offset + 1]
    const blue = data[offset + 2]
    if (
      blue > red * 1.12 &&
      green > red * 1.08 &&
      blue > green * 0.72 &&
      blue >= 55
    ) {
      mask[index] = 1
      pixelCount += 1
    }
  }
  return {
    mask,
    pixelCount,
    coverageRatio: Number(
      (pixelCount / Math.max(1, mask.length)).toFixed(6),
    ),
    normalizedMask: normalizeBinaryMaskShape(
      mask,
      info.width,
      info.height,
      THRESHOLDS.crossModalNormalizedWaterWidth,
      THRESHOLDS.crossModalNormalizedWaterHeight,
    ),
  }
}

function resampleBinaryMaskNearest(
  source,
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight,
) {
  const output = new Uint8Array(targetWidth * targetHeight)
  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(
      sourceHeight - 1,
      Math.floor(((y + 0.5) / targetHeight) * sourceHeight),
    )
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(
        sourceWidth - 1,
        Math.floor(((x + 0.5) / targetWidth) * sourceWidth),
      )
      output[y * targetWidth + x] =
        source[sourceY * sourceWidth + sourceX] ? 1 : 0
    }
  }
  return output
}

function normalizeBinaryMaskShape(
  mask,
  width,
  height,
  targetWidth,
  targetHeight,
) {
  let minimumX = width
  let maximumX = -1
  let minimumY = height
  let maximumY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue
      minimumX = Math.min(minimumX, x)
      maximumX = Math.max(maximumX, x)
      minimumY = Math.min(minimumY, y)
      maximumY = Math.max(maximumY, y)
    }
  }
  if (maximumX < minimumX || maximumY < minimumY) {
    return new Uint8Array(targetWidth * targetHeight)
  }
  const output = new Uint8Array(targetWidth * targetHeight)
  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.round(
      minimumY +
        (y * (maximumY - minimumY)) /
          Math.max(1, targetHeight - 1),
    )
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.round(
        minimumX +
          (x * (maximumX - minimumX)) /
            Math.max(1, targetWidth - 1),
      )
      output[y * targetWidth + x] =
        mask[sourceY * width + sourceX] ? 1 : 0
    }
  }
  return output
}

function transformBinaryMask(mask, width, height, transform) {
  const transformed = new Uint8Array(mask.length)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = y * width + x
      if (!mask[sourceIndex]) continue
      const targetX =
        transform === "horizontal_mirror" ||
        transform === "rotate_180"
          ? width - 1 - x
          : x
      const targetY =
        transform === "vertical_mirror" ||
        transform === "rotate_180"
          ? height - 1 - y
          : y
      transformed[targetY * width + targetX] = 1
    }
  }
  return transformed
}

function transformSmallGrid(source, width, height, transform) {
  const transformed = new Uint8Array(source.length)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = y * width + x
      const targetX =
        transform === "horizontal_mirror" ||
        transform === "rotate_180"
          ? width - 1 - x
          : x
      const targetY =
        transform === "vertical_mirror" ||
        transform === "rotate_180"
          ? height - 1 - y
          : y
      transformed[targetY * width + targetX] =
        source[sourceIndex]
    }
  }
  return transformed
}

function compositeSkeletonFromGuide(data, info) {
  return categoricalSkeletonFromGuide(
    data,
    info,
    THRESHOLDS.compositeSkeletonRasterWidth,
    THRESHOLDS.compositeSkeletonRasterHeight,
  )
}

function categoricalSkeletonFromGuide(data, info, width, height) {
  const skeleton = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(
      info.height - 1,
      Math.floor(((y + 0.5) / height) * info.height),
    )
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(
        info.width - 1,
        Math.floor(((x + 0.5) / width) * info.width),
      )
      const offset =
        (sourceY * info.width + sourceX) * info.channels
      const key =
        `${data[offset]},${data[offset + 1]},${data[offset + 2]}`
      skeleton[y * width + x] =
        COMPOSITE_SKELETON_COLOR_CODES.get(key) ?? 0
    }
  }
  return skeleton
}

function summarizeBinaryMask(mask, width, height) {
  const bandPixelCounts = Array(
    THRESHOLDS.topologyVerticalBandCount,
  ).fill(0)
  const bandXTotals = Array(
    THRESHOLDS.topologyVerticalBandCount,
  ).fill(0)
  let pixelCount = 0
  let xTotal = 0
  let yTotal = 0
  let leftHalfCount = 0
  let rightHalfCount = 0
  let minimumX = width
  let maximumX = -1
  let minimumY = height
  let maximumY = -1
  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index]) continue
    const x = index % width
    const y = Math.floor(index / width)
    pixelCount += 1
    xTotal += x
    yTotal += y
    minimumX = Math.min(minimumX, x)
    maximumX = Math.max(maximumX, x)
    minimumY = Math.min(minimumY, y)
    maximumY = Math.max(maximumY, y)
    const bandIndex = Math.min(
      THRESHOLDS.topologyVerticalBandCount - 1,
      Math.floor(
        (y / height) *
          THRESHOLDS.topologyVerticalBandCount,
      ),
    )
    bandPixelCounts[bandIndex] += 1
    bandXTotals[bandIndex] += x
    if (x < width / 2) leftHalfCount += 1
    else rightHalfCount += 1
  }
  const horizontalSpanRatio =
    pixelCount > 0 ? (maximumX - minimumX + 1) / width : 0
  const verticalSpanRatio =
    pixelCount > 0 ? (maximumY - minimumY + 1) / height : 0
  const occupiedVerticalBandRatio =
    bandPixelCounts.filter((count) => count > 0).length /
    THRESHOLDS.topologyVerticalBandCount
  return {
    mask,
    pixelCount,
    centroidX: pixelCount > 0 ? xTotal / pixelCount : null,
    centroidY: pixelCount > 0 ? yTotal / pixelCount : null,
    leftHalfRatio:
      pixelCount > 0 ? leftHalfCount / pixelCount : 0,
    rightHalfRatio:
      pixelCount > 0 ? rightHalfCount / pixelCount : 0,
    normalizedCentroidX:
      pixelCount > 0 ? xTotal / pixelCount / width : null,
    normalizedCentroidY:
      pixelCount > 0 ? yTotal / pixelCount / height : null,
    horizontalSpanRatio: Number(horizontalSpanRatio.toFixed(6)),
    verticalSpanRatio: Number(verticalSpanRatio.toFixed(6)),
    occupiedVerticalBandRatio: Number(
      occupiedVerticalBandRatio.toFixed(6),
    ),
    verticalBandCentroidX: bandPixelCounts.map(
      (count, index) =>
        count > 0
          ? Number(
              (bandXTotals[index] / count / width).toFixed(6),
            )
          : null,
    ),
  }
}

function compareGuideVariant({
  transform,
  candidate,
  historical,
}) {
  const dimensionsMatch =
    candidate.width === historical.width &&
    candidate.height === historical.height
  const waterLayoutIntersection = dimensionsMatch
    ? maskIntersectionOverUnion(
        candidate.water.mask,
        historical.water.mask,
      )
    : 0
  const routeLayoutIntersection = dimensionsMatch
    ? maskIntersectionOverUnion(
        candidate.route.mask,
        historical.route.mask,
      )
    : 0
  const routeCentroidNormalizedDistance = dimensionsMatch
    ? normalizedCentroidDistance(
        candidate.route,
        historical.route,
        candidate.width,
        candidate.height,
      )
    : 1
  const candidateRouteDominantHalf = dominantHorizontalHalf(
    candidate.route,
  )
  const historicalRouteDominantHalf = dominantHorizontalHalf(
    historical.route,
  )
  const sameRouteDominantHalf =
    candidateRouteDominantHalf === historicalRouteDominantHalf
  const bothContainWater =
    candidate.water.pixelCount > 0 &&
    historical.water.pixelCount > 0
  const bothOmitWater =
    candidate.water.pixelCount === 0 &&
    historical.water.pixelCount === 0
  const topologyComparison = compareMacroTopology(
    candidate,
    historical,
    waterLayoutIntersection,
  )
  const compositeSkeletonEqualityRatio =
    categoricalGridEqualityRatio(
      candidate.compositeSkeleton,
      historical.compositeSkeleton,
    )
  const compositeSkeletonNonZeroIntersectionOverUnion =
    categoricalGridNonZeroIntersectionOverUnion(
      candidate.compositeSkeleton,
      historical.compositeSkeleton,
    )
  const strongCompositeSkeletonDuplicate =
    dimensionsMatch &&
    compositeSkeletonEqualityRatio >=
      THRESHOLDS.strongCompositeSkeletonMinimumEqualityRatio &&
    compositeSkeletonNonZeroIntersectionOverUnion >=
      THRESHOLDS.strongCompositeSkeletonMinimumNonZeroIoU
  const detailSkeletonEqualityRatio =
    categoricalGridEqualityRatio(
      candidate.detailSkeleton,
      historical.detailSkeleton,
    )
  const detailSkeletonNonZeroIntersectionOverUnion =
    categoricalGridNonZeroIntersectionOverUnion(
      candidate.detailSkeleton,
      historical.detailSkeleton,
    )
  const detailContentDuplicate =
    dimensionsMatch &&
    detailSkeletonEqualityRatio >=
      THRESHOLDS.detailSkeletonMinimumEqualityRatio &&
    detailSkeletonNonZeroIntersectionOverUnion >=
      THRESHOLDS.detailSkeletonMinimumNonZeroIoU
  const legacyLayoutDuplicate =
    dimensionsMatch &&
    (bothOmitWater ||
      (bothContainWater &&
        waterLayoutIntersection >=
          THRESHOLDS.approvedWaterLayoutDuplicateMinimumIoU)) &&
    routeLayoutIntersection >=
      THRESHOLDS.approvedRouteLayoutDuplicateMinimumIoU &&
    sameRouteDominantHalf &&
    routeCentroidNormalizedDistance <=
      THRESHOLDS.approvedRouteCentroidMaximumNormalizedDistance
  const exactConditionGuideDuplicate =
    transform === "direct" &&
    dimensionsMatch &&
    candidate.sha256 === historical.sha256
  return {
    transform,
    dimensionsMatch,
    waterLayoutIntersection,
    routeLayoutIntersection,
    routeCentroidNormalizedDistance,
    candidateRouteDominantHalf,
    historicalRouteDominantHalf,
    sameRouteDominantHalf,
    topologyComparison,
    compositeSkeletonEqualityRatio,
    compositeSkeletonNonZeroIntersectionOverUnion,
    strongCompositeSkeletonDuplicate,
    detailSkeletonEqualityRatio,
    detailSkeletonNonZeroIntersectionOverUnion,
    detailContentDuplicate,
    legacyLayoutDuplicate,
    exactConditionGuideDuplicate,
    approvedMacroCompositionDuplicate:
      exactConditionGuideDuplicate ||
      strongCompositeSkeletonDuplicate ||
      topologyComparison.macroTopologyDuplicate ||
      legacyLayoutDuplicate,
  }
}

function compareMacroTopology(
  candidate,
  historical,
  waterLayoutIntersection,
) {
  const candidateTopology = macroTopology(candidate)
  const historicalTopology = macroTopology(historical)
  const waterCorridor = corridorDistance(
    candidate.water,
    historical.water,
  )
  const routeCorridor = corridorDistance(
    candidate.route,
    historical.route,
  )
  const relationAgreement = categoricalAgreement(
    candidateTopology.routeWaterBandRelations,
    historicalTopology.routeWaterBandRelations,
  )
  const bothContainWater =
    candidate.water.pixelCount > 0 &&
    historical.water.pixelCount > 0
  const bothContainRoute =
    candidate.route.pixelCount > 0 &&
    historical.route.pixelCount > 0
  const sameWaterAxis =
    candidateTopology.water.axis === historicalTopology.water.axis
  const sameWaterSide =
    candidateTopology.water.side === historicalTopology.water.side
  const sameRouteAxis =
    candidateTopology.route.axis === historicalTopology.route.axis
  const sameRouteSide =
    candidateTopology.route.side === historicalTopology.route.side
  const sameDominantRelation =
    candidateTopology.dominantRouteWaterRelation !== "mixed" &&
    candidateTopology.dominantRouteWaterRelation ===
      historicalTopology.dominantRouteWaterRelation
  const routeAndWaterTopologyDuplicate =
    bothContainWater &&
    bothContainRoute &&
    sameWaterAxis &&
    sameWaterSide &&
    sameRouteSide &&
    sameDominantRelation &&
    waterCorridor.sharedBandRatio >=
      THRESHOLDS.topologyMinimumSharedWaterBandRatio &&
    routeCorridor.sharedBandRatio >=
      THRESHOLDS.topologyMinimumSharedRouteBandRatio &&
    waterCorridor.meanCentroidDistance <=
      THRESHOLDS.topologyMaximumWaterBandCentroidDistance &&
    routeCorridor.meanCentroidDistance <=
      THRESHOLDS.topologyMaximumRouteBandCentroidDistance &&
    relationAgreement >=
      THRESHOLDS.topologyMinimumRelativeRelationAgreement
  const dominantWaterTopologyDuplicate =
    bothContainWater &&
    sameWaterAxis &&
    sameWaterSide &&
    waterLayoutIntersection >=
      THRESHOLDS.dominantWaterMinimumLayoutIoU &&
    waterCorridor.sharedBandRatio >=
      THRESHOLDS.dominantWaterMinimumSharedBandRatio &&
    waterCorridor.meanCentroidDistance <=
      THRESHOLDS.dominantWaterMaximumBandCentroidDistance
  const macroTopologyDuplicate =
    routeAndWaterTopologyDuplicate ||
    dominantWaterTopologyDuplicate
  return {
    candidate: candidateTopology,
    historical: historicalTopology,
    metrics: {
      sameWaterAxis,
      sameWaterSide,
      sameRouteAxis,
      sameRouteSide,
      sameDominantRelation,
      waterSharedBandRatio: waterCorridor.sharedBandRatio,
      routeSharedBandRatio: routeCorridor.sharedBandRatio,
      waterBandCentroidDistance:
        waterCorridor.meanCentroidDistance,
      routeBandCentroidDistance:
        routeCorridor.meanCentroidDistance,
      routeWaterRelationAgreement: relationAgreement,
      waterLayoutIntersection,
      routeAndWaterTopologyDuplicate,
      dominantWaterTopologyDuplicate,
    },
    macroTopologyDuplicate,
  }
}

function macroTopology(guide) {
  const routeWaterBandRelations =
    guide.route.verticalBandCentroidX.map((routeX, index) => {
      const waterX = guide.water.verticalBandCentroidX[index]
      if (routeX === null || waterX === null) return null
      const difference = routeX - waterX
      if (difference <= -THRESHOLDS.topologySideDeadband) {
        return "route_left_of_water"
      }
      if (difference >= THRESHOLDS.topologySideDeadband) {
        return "route_right_of_water"
      }
      return "route_overlaps_water_axis"
    })
  return {
    water: semanticTopology(guide.water),
    route: semanticTopology(guide.route),
    routeWaterBandRelations,
    dominantRouteWaterRelation: dominantCategory(
      routeWaterBandRelations,
    ),
  }
}

function semanticTopology(value) {
  return {
    present: value.pixelCount > 0,
    axis: semanticAxis(value),
    side: semanticSide(value),
    horizontalSpanRatio: value.horizontalSpanRatio,
    verticalSpanRatio: value.verticalSpanRatio,
    occupiedVerticalBandRatio: value.occupiedVerticalBandRatio,
    verticalBandCentroidX: value.verticalBandCentroidX,
  }
}

function semanticAxis(value) {
  if (value.pixelCount === 0) return "absent"
  if (value.verticalSpanRatio >= value.horizontalSpanRatio * 1.15) {
    return "vertical"
  }
  if (value.horizontalSpanRatio >= value.verticalSpanRatio * 1.15) {
    return "horizontal"
  }
  return "mixed"
}

function semanticSide(value) {
  if (value.normalizedCentroidX === null) return "absent"
  if (
    value.normalizedCentroidX <
    0.5 - THRESHOLDS.topologySideDeadband
  ) {
    return "left"
  }
  if (
    value.normalizedCentroidX >
    0.5 + THRESHOLDS.topologySideDeadband
  ) {
    return "right"
  }
  return "center"
}

function corridorDistance(left, right) {
  let sharedBandCount = 0
  let distanceTotal = 0
  const leftOccupied = left.verticalBandCentroidX.filter(
    (value) => value !== null,
  ).length
  const rightOccupied = right.verticalBandCentroidX.filter(
    (value) => value !== null,
  ).length
  for (
    let index = 0;
    index < THRESHOLDS.topologyVerticalBandCount;
    index += 1
  ) {
    const leftX = left.verticalBandCentroidX[index]
    const rightX = right.verticalBandCentroidX[index]
    if (leftX === null || rightX === null) continue
    sharedBandCount += 1
    distanceTotal += Math.abs(leftX - rightX)
  }
  return {
    sharedBandRatio: Number(
      (
        sharedBandCount /
        Math.max(1, leftOccupied, rightOccupied)
      ).toFixed(6),
    ),
    meanCentroidDistance: Number(
      (
        distanceTotal / Math.max(1, sharedBandCount)
      ).toFixed(6),
    ),
  }
}

function categoricalAgreement(left, right) {
  let compared = 0
  let matches = 0
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] === null || right[index] === null) continue
    compared += 1
    if (left[index] === right[index]) matches += 1
  }
  return Number((matches / Math.max(1, compared)).toFixed(6))
}

function dominantCategory(values) {
  const counts = new Map()
  for (const value of values) {
    if (value === null) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  const sorted = [...counts.entries()].sort(
    (left, right) =>
      right[1] - left[1] || left[0].localeCompare(right[0]),
  )
  if (sorted.length === 0) return "none"
  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) {
    return "mixed"
  }
  return sorted[0][0]
}

function dominantHorizontalHalf(value) {
  if (value.leftHalfRatio >= THRESHOLDS.dominantHalfMinimumRatio) {
    return "left"
  }
  if (value.rightHalfRatio >= THRESHOLDS.dominantHalfMinimumRatio) {
    return "right"
  }
  return "mixed"
}

function normalizedCentroidDistance(left, right, width, height) {
  if (
    left.centroidX === null ||
    left.centroidY === null ||
    right.centroidX === null ||
    right.centroidY === null
  ) {
    return 1
  }
  return Number(
    Math.hypot(
      (left.centroidX - right.centroidX) / width,
      (left.centroidY - right.centroidY) / height,
    ).toFixed(6),
  )
}

function categoricalGridEqualityRatio(left, right) {
  if (left.length !== right.length) return 0
  let equal = 0
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] === right[index]) equal += 1
  }
  return Number((equal / Math.max(1, left.length)).toFixed(6))
}

function categoricalGridNonZeroIntersectionOverUnion(left, right) {
  if (left.length !== right.length) return 0
  let intersection = 0
  let union = 0
  for (let index = 0; index < left.length; index += 1) {
    const leftActive = left[index] !== 0
    const rightActive = right[index] !== 0
    if (leftActive || rightActive) union += 1
    if (leftActive && rightActive) intersection += 1
  }
  return Number(
    (union === 0 ? 1 : intersection / union).toFixed(6),
  )
}

function maskIntersectionOverUnion(left, right) {
  let intersection = 0
  let union = 0
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] || right[index]) union += 1
    if (left[index] && right[index]) intersection += 1
  }
  return Number((intersection / Math.max(1, union)).toFixed(6))
}

function resolveRecordImagePath(record) {
  if (!record.relativeDirectory || !record.originalImage?.path) {
    return null
  }
  return resolveProjectPath(
    path.join(record.relativeDirectory, record.originalImage.path),
  )
}

function compositionReferenceFor(record) {
  const reviewPath = record.reviews?.ownerReviewPath
  let review = null
  if (reviewPath) {
    const resolved = resolveProjectPath(reviewPath)
    if (fs.existsSync(resolved)) review = readJson(resolved)
  }
  const decision =
    review?.decision ?? record.reviews?.ownerReviewStatus ?? null
  const recordedReasonCodes = Array.isArray(review?.reasonCodes)
    ? review.reasonCodes
    : []
  const reasonCodes = effectiveOwnerRejectionReasonCodes(review)
  if (decision === "owner_approved") {
    return {
      referenceClass: "owner_approved",
      reasonCodes,
      recordedReasonCodes,
    }
  }
  if (
    decision === "owner_rejected" &&
    reasonCodes.includes("composition_duplicate")
  ) {
    return {
      referenceClass: "owner_rejected_composition_duplicate",
      reasonCodes,
      recordedReasonCodes,
    }
  }
  if (decision === "owner_rejected") {
    return {
      referenceClass: "owner_rejected",
      reasonCodes,
      recordedReasonCodes,
    }
  }
  if (
    decision === "not_reached_machine_failed" ||
    record.status === "rejected"
  ) {
    return {
      referenceClass: "machine_rejected",
      reasonCodes,
      recordedReasonCodes,
    }
  }
  if (
    decision === "pending_review" ||
    record.status === "ai_assisted_cold_start_intake"
  ) {
    return {
      referenceClass: "pending_review",
      reasonCodes,
      recordedReasonCodes,
    }
  }
  return {
    referenceClass:
      "other_historical_complete_map_condition_guide",
    reasonCodes,
    recordedReasonCodes,
  }
}

function blueprintEvidenceForRecord(record, historicalGuide) {
  const taskPackagePath =
    record.conditionBinding?.taskPackagePath ??
    record.worldBinding?.taskPackagePath
  if (!taskPackagePath) {
    return {
      blueprint: null,
      structuralIdentityComparable: false,
      evidenceClass: "historical_task_package_missing",
      auditEvidence: null,
    }
  }
  try {
    const resolvedTaskPackagePath =
      resolveProjectPath(taskPackagePath)
    const task = readJson(resolvedTaskPackagePath)
    const blueprintPath =
      task.sourceBindings?.trainingBlueprintPath
    if (!blueprintPath) {
      if (
        LEGACY_GUIDE_ONLY_RECORD_IDS.has(record.recordId) &&
        task.schemaVersion === "runtime-frame-generation-task-v1"
      ) {
        return {
          blueprint: null,
          structuralIdentityComparable: true,
          evidenceClass: "legacy_guide_only_composition_reference",
          auditEvidence: {
            recordId: record.recordId,
            evidenceClass:
              "legacy_guide_only_composition_reference",
            taskPackagePath: projectPath(resolvedTaskPackagePath),
            taskPackageSha256: sha256(
              fs.readFileSync(resolvedTaskPackagePath),
            ),
            guidePath: record.conditionBinding.guidePath,
            guideSha256: historicalGuide.sha256,
            connectivityIdentityAvailable: false,
            themeAndDetailComparisonMethod:
              "condition_guide_direct_horizontal_vertical_and_180_geometry_audit",
            historicalRgbRead: false,
            historicalRecordModified: false,
          },
        }
      }
      return {
        blueprint: null,
        structuralIdentityComparable: false,
        evidenceClass: "historical_training_blueprint_binding_missing",
        auditEvidence: null,
      }
    }
    const resolvedBlueprintPath = resolveProjectPath(blueprintPath)
    const blueprint = readJson(resolvedBlueprintPath)
    const hasCurrentStructuralIdentities = Boolean(
      blueprint.connectivityBlueprintId &&
        blueprint.structuralIdentities
          ?.themeArchitectureIdentity &&
        blueprint.structuralIdentities
          ?.instanceDetailIdentity,
    )
    if (hasCurrentStructuralIdentities) {
      return {
        blueprint,
        structuralIdentityComparable: true,
        evidenceClass: "native_structural_identity",
        auditEvidence: null,
      }
    }
    if (
      LEGACY_STRUCTURAL_IDENTITY_BLUEPRINT_SCHEMAS.has(
        blueprint.schemaVersion,
      ) &&
      blueprint.connectivityBlueprintId &&
      blueprint.geometry
    ) {
      const structuralIdentities =
        buildLegacyStructuralIdentityCompatibility(blueprint)
      return {
        blueprint: {
          ...blueprint,
          structuralIdentities,
        },
        structuralIdentityComparable: true,
        evidenceClass:
          "legacy_blueprint_structural_identity_compatibility",
        auditEvidence: {
          recordId: record.recordId,
          evidenceClass:
            "legacy_blueprint_structural_identity_compatibility",
          blueprintPath: projectPath(resolvedBlueprintPath),
          blueprintSha256: sha256(
            fs.readFileSync(resolvedBlueprintPath),
          ),
          connectivityBlueprintId:
            blueprint.connectivityBlueprintId,
          structuralIdentities,
          themeAndDetailComparisonMethod:
            "immutable_legacy_blueprint_geometry_identity_plus_condition_guide_direct_horizontal_vertical_and_180_geometry_audit",
          historicalRgbRead: false,
          historicalRecordModified: false,
        },
      }
    }
    return {
      blueprint,
      structuralIdentityComparable: false,
      evidenceClass: "historical_structural_identity_missing",
      auditEvidence: null,
    }
  } catch {
    return {
      blueprint: null,
      structuralIdentityComparable: false,
      evidenceClass: "historical_blueprint_unreadable",
      auditEvidence: null,
    }
  }
}

function buildLegacyStructuralIdentityCompatibility(blueprint) {
  const terrainRegions = blueprint.geometry?.terrainRegions ?? []
  const themePayload = {
    compatibilitySchema:
      "legacy-complete-map-structural-identity-compatibility-v1",
    connectivityBlueprintId: blueprint.connectivityBlueprintId,
    landscapeType: blueprint.landscapeType ?? null,
    hasWater: blueprint.geometry?.hasWater === true,
    terrainKinds: [...new Set(
      terrainRegions.map((entry) => entry.kind),
    )].sort(),
    terrainKindCounts: Object.fromEntries(
      [...new Set(
        terrainRegions.map((entry) => entry.kind),
      )].sort().map((kind) => [
        kind,
        terrainRegions.filter((entry) => entry.kind === kind).length,
      ]),
    ),
    terrainRegionBounds: terrainRegions
      .map((entry) => ({
        kind: entry.kind,
        bounds: normalizedPolygonBounds(
          entry.polygon,
          blueprint.canvas,
        ),
      }))
      .sort(compareCanonicalEntries),
  }
  const detailPayload = {
    compatibilitySchema:
      "legacy-complete-map-structural-identity-compatibility-v1",
    geometry: blueprint.geometry,
  }
  const themeArchitectureIdentity =
    canonicalSha256(themePayload)
  const instanceDetailIdentity =
    canonicalSha256(detailPayload)
  return {
    schemaVersion:
      "legacy-complete-map-structural-identity-compatibility-v1",
    themeArchitectureIdentity,
    instanceDetailIdentity,
    themeArchitecturePayloadSha256:
      themeArchitectureIdentity,
    instanceDetailPayloadSha256: instanceDetailIdentity,
    comparisonRequiredAgainstAllHistory: true,
    directMirrorVerticalMirrorAndRotate180Required: true,
    auditOnly: true,
    historicalRecordModified: false,
  }
}

function normalizedPolygonBounds(points, canvas = {}) {
  if (!Array.isArray(points) || points.length === 0) {
    return null
  }
  const width = Math.max(1, Number(canvas.width) || 1024)
  const height = Math.max(1, Number(canvas.height) || 768)
  const xs = points.map((point) => Number(point.x) || 0)
  const ys = points.map((point) => Number(point.y) || 0)
  return {
    minimumX: quantizedRatio(Math.min(...xs), width),
    minimumY: quantizedRatio(Math.min(...ys), height),
    maximumX: quantizedRatio(Math.max(...xs), width),
    maximumY: quantizedRatio(Math.max(...ys), height),
  }
}

function quantizedRatio(value, maximum) {
  return Number((value / maximum).toFixed(4))
}

function compareCanonicalEntries(left, right) {
  return canonicalJson(left).localeCompare(canonicalJson(right))
}

function canonicalSha256(value) {
  return crypto
    .createHash("sha256")
    .update(canonicalJson(value))
    .digest("hex")
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJson(value[key])}`,
    ).join(",")}}`
  }
  return JSON.stringify(value)
}

function effectiveOwnerRejectionReasonCodes(review) {
  const reasonCodes = new Set(
    Array.isArray(review?.reasonCodes) ? review.reasonCodes : [],
  )
  if (
    review?.decision === "owner_rejected" &&
    ownerCommentDescribesCompositionDuplicate(review)
  ) {
    reasonCodes.add("composition_duplicate")
  }
  return [...reasonCodes]
}

function ownerCommentDescribesCompositionDuplicate(review) {
  const normalized = [
    review?.comment,
    review?.notes,
    review?.nextTrainingTarget,
  ]
    .filter((value) => typeof value === "string")
    .join(" ")
    .trim()
    .toLowerCase()
  const duplicateSignal =
    /(重复|雷同|相同|一样|重新画|duplicate|duplicated|reus(?:e|ed|ing))/.test(normalized)
  const compositionSignal =
    /(构图|主体|框架|结构|布局|地图|河道|道路|composition|framework|template|layout|map|river|route)/.test(normalized)
  return duplicateSignal && compositionSignal
}

function readJson(value) {
  return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8"))
}

function timestampMs(value) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  if (
    resolved !== ROOT &&
    !resolved.startsWith(`${ROOT}${path.sep}`)
  ) {
    throw new Error(`path escapes project: ${value}`)
  }
  return resolved
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function sha256File(value) {
  return sha256(fs.readFileSync(value))
}
