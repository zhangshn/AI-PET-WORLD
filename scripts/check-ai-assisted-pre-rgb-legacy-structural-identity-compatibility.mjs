import {
  auditPreRgbConditionGuideNovelty,
} from "./lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs"

const SLOT_ID = "v7-capacity-slot-146"
const RUN_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/" +
  "earth-geospatial-v7-slot-condition-v7-capacity-slot-146-2026-07-29T09-46-51-928Z/" +
  "complete-map-condition-task"
const audit = await auditPreRgbConditionGuideNovelty({
  sourceRecordId: SLOT_ID,
  guidePath:
    `${RUN_ROOT}/compiled-conditions/condition-guide.png`,
  blueprintPath: `${RUN_ROOT}/world-fact-blueprint.json`,
})

const compatibilityEvidence =
  audit.historicalStructuralIdentityCompatibilityEvidence ?? []
const legacyBlueprintEvidence = compatibilityEvidence.filter(
  (entry) =>
    entry.evidenceClass ===
    "legacy_blueprint_structural_identity_compatibility",
)
const guideOnlyEvidence = compatibilityEvidence.filter(
  (entry) =>
    entry.evidenceClass ===
    "legacy_guide_only_composition_reference",
)
const ok =
  audit.passed === true &&
  audit.status === "pre_rgb_condition_guide_novelty_passed" &&
  audit.historicalCompleteMapConditionGuidesCompared === 121 &&
  audit.connectivityComparisonIncompleteCount === 0 &&
  audit.skippedRecordCount === 0 &&
  audit.legacyStructuralIdentityCompatibilityCount === 120 &&
  audit.legacyGuideOnlyCompositionReferenceCount === 1 &&
  legacyBlueprintEvidence.length === 120 &&
  guideOnlyEvidence.length === 1 &&
  guideOnlyEvidence[0].recordId ===
    "ai-cold-start-map-003-condition-guided-east-river" &&
  guideOnlyEvidence[0].connectivityIdentityAvailable === false &&
  audit.approvedMacroCompositionMatches.length === 0 &&
  audit.detailContentMatches.length === 0 &&
  audit.concreteRegionConnectivityMatches.length === 0 &&
  compatibilityEvidence.every(
    (entry) =>
      entry.historicalRgbRead === false &&
      entry.historicalRecordModified === false,
  ) &&
  audit.evidenceBoundary.historicalRgbRead === false &&
  audit.evidenceBoundary.historicalRecordsModified === false &&
  audit.evidenceBoundary.imageGenerationStarted === false &&
  audit.evidenceBoundary.rgbCreated === false &&
  audit.evidenceBoundary.gpuTrainingStarted === false

const result = {
  ok,
  status: ok
    ? "pre_rgb_legacy_structural_identity_compatibility_check_passed"
    : "pre_rgb_legacy_structural_identity_compatibility_check_failed",
  slotId: SLOT_ID,
  auditStatus: audit.status,
  historicalCompleteMapConditionGuidesCompared:
    audit.historicalCompleteMapConditionGuidesCompared,
  connectivityComparisonIncompleteCount:
    audit.connectivityComparisonIncompleteCount,
  legacyStructuralIdentityCompatibilityCount:
    audit.legacyStructuralIdentityCompatibilityCount,
  legacyGuideOnlyCompositionReferenceCount:
    audit.legacyGuideOnlyCompositionReferenceCount,
  approvedMacroCompositionMatchCount:
    audit.approvedMacroCompositionMatches.length,
  detailContentMatchCount: audit.detailContentMatches.length,
  concreteRegionConnectivityMatchCount:
    audit.concreteRegionConnectivityMatches.length,
  evidenceBoundary: audit.evidenceBoundary,
}

console[ok ? "log" : "error"](JSON.stringify(result, null, 2))
process.exit(ok ? 0 : 1)
