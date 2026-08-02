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
      audit.status ===
        "blocked_before_rgb_complete_map_theme_architecture_duplicate" &&
      matchedRecordIds[index].includes(EXPECTED_MATCH) &&
      audit.evidenceBoundary.historicalRgbRead === false &&
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
