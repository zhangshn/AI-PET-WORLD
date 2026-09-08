import {
  auditPreRgbConditionGuideNovelty,
} from "./lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs"

const SOURCE_RECORD_ID = "v7-capacity-slot-123"
const GUIDE_PATHS = [
  ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/" +
    "earth-geospatial-v7-slot-condition-v7-capacity-slot-123-2026-07-27T20-43-51-955Z/" +
    "complete-map-condition-task/compiled-conditions/condition-guide.png",
  ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/" +
    "earth-geospatial-v7-slot-condition-v7-capacity-slot-123-2026-07-27T20-59-01-536Z/" +
    "complete-map-condition-task/compiled-conditions/condition-guide.png",
  ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/" +
    "earth-geospatial-v7-slot-condition-v7-capacity-slot-123-2026-07-27T21-59-10-859Z/" +
    "complete-map-condition-task/compiled-conditions/condition-guide.png",
  ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/" +
    "earth-geospatial-v7-slot-condition-v7-capacity-slot-123-2026-07-27T23-40-24-403Z/" +
    "complete-map-condition-task/compiled-conditions/condition-guide.png",
]
const EXPECTED_MATCH =
  "ai-cold-start-v7-v7-capacity-slot-122-river-floodplain-v2"

const audits = await Promise.all(
  GUIDE_PATHS.map((guidePath, index) =>
    auditPreRgbConditionGuideNovelty({
      sourceRecordId: SOURCE_RECORD_ID,
      guidePath,
      candidateRecordId: index === GUIDE_PATHS.length - 1
        ? "ai-cold-start-v7-v7-capacity-slot-123-river-floodplain-v3"
        : null,
    }),
  ),
)
const matchedRecordIds = audits.map((audit) =>
  audit.approvedMacroCompositionMatches.map(
    (entry) => entry.recordId,
  ),
)
const ok =
  audits.every(
    (audit, index) =>
      audit.passed === false &&
      [
        "blocked_before_rgb_complete_map_theme_architecture_duplicate",
        "blocked_before_rgb_cross_modal_historical_water_shape_duplicate",
      ].includes(audit.status) &&
      matchedRecordIds[index].includes(EXPECTED_MATCH) &&
      audit.issues.some((issue) =>
        issue.code === "complete_map_theme_architecture_duplicate" &&
        issue.matchedRecordId === EXPECTED_MATCH) &&
      (audit.status !== "blocked_before_rgb_cross_modal_historical_water_shape_duplicate" ||
        audit.crossModalHistoricalRgbWaterShapeMatches.length > 0) &&
      audit.evidenceBoundary.historicalRgbReadByAudit === true &&
      audit.evidenceBoundary.historicalRgbRead === true &&
      audit.evidenceBoundary.historicalRgbAuditReadReceipts.length > 0 &&
      audit.evidenceBoundary.historicalRgbAuditReadReceipts.every(receipt => receipt.sha256MatchesRecord &&
        receipt.sha256 === receipt.expectedSha256 && receipt.byteLength > 0) &&
      audit.evidenceBoundary.historicalRgbReadByGenerator === false &&
      audit.evidenceBoundary.historicalRgbPixelsOrPathsForwardedToGenerator === false &&
      audit.evidenceBoundary.imageGenerationStarted === false,
  )

const result = {
  ok,
  status: ok
    ? "ai_assisted_pre_rgb_condition_guide_novelty_check_passed"
    : "ai_assisted_pre_rgb_condition_guide_novelty_check_failed",
  sourceRecordId: SOURCE_RECORD_ID,
  expectedMatch: EXPECTED_MATCH,
  matchedRecordIds,
  audits,
}
console[ok ? "log" : "error"](JSON.stringify(result, null, 2))
process.exit(ok ? 0 : 1)
