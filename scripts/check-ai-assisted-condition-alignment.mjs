import fs from "node:fs"
import path from "node:path"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"

const ROOT = process.cwd()
const passingRecord = readRecord("ai-cold-start-condition-pair-001-tropical-monsoon-lowland-v2")
const rejectedRecord = readRecord("ai-cold-start-condition-pair-002-inland-tropical-river-valley-v1")
const noWaterRecord = readRecord("ai-cold-start-condition-pair-005-seasonal-evergreen-semi-evergreen-forest-v2")
const drySeasonRejectedRecord = readRecord("ai-cold-start-condition-pair-006-dry-dipterocarp-woodland-v2")
const drySeasonPassingRecord = readRecord("ai-cold-start-condition-pair-006-dry-dipterocarp-woodland-v3")
const disconnectedWarmGroundRecord = readRecord("ai-cold-start-earth-reference-earth-reference-naturalized-complete-map-b3be6a28ffb6-v1")
const noWaterForestedLowMountainRecord = readRecord("ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v1")
const passingAudit = await audit(passingRecord)
const rejectedAudit = await audit(rejectedRecord)
const noWaterAudit = await audit(noWaterRecord)
const drySeasonRejectedAudit = await audit(drySeasonRejectedRecord)
const drySeasonPassingAudit = await audit(drySeasonPassingRecord)
const disconnectedWarmGroundAudit = await audit(disconnectedWarmGroundRecord)
const noWaterForestedLowMountainAudit = await audit(noWaterForestedLowMountainRecord)
const failures = []

check(passingAudit.passed === true, "known_owner_approved_001_alignment_should_pass")
check(rejectedAudit.passed === false, "known_repeated_002_layout_should_fail")
check(rejectedAudit.issues.some((issue) => issue.code === "condition_terrain_water_spatial_distribution_mismatch"), "repeated_002_water_distribution_failure_missing")
check(rejectedAudit.issues.length > 0, "known_repeated_002_must_remain_rejected")
check(noWaterAudit.passed === true, "known_owner_approved_005_no_water_alignment_should_pass")
check(noWaterAudit.channelAudits.find((item) => item.channelId === "terrain_water")?.absenceExpected === true, "005_empty_water_channel_absence_branch_missing")
check(drySeasonRejectedAudit.passed === false, "known_006_v2_low_contrast_dry_route_should_fail")
check(drySeasonRejectedAudit.pathClassifier?.mode === "dry_season_red_brown_route_separated_from_straw_grass_v1", "006_v2_dry_season_classifier_missing")
check(drySeasonPassingAudit.passed === true, "006_v3_distinct_dry_route_alignment_should_pass")
check(drySeasonPassingAudit.pathClassifier?.mode === "dry_season_red_brown_route_separated_from_straw_grass_v1", "006_v3_dry_season_classifier_missing")
check(passingAudit.pathClassifier?.mode === "humid_and_transition_season_warm_earth_route_v1", "001_wet_season_classifier_regressed")
check(disconnectedWarmGroundAudit.passed === true, "disconnected_warm_ground_should_not_shift_route_centroid")
check(disconnectedWarmGroundAudit.pathClassifier?.signalIsolationMode === "condition_supported_connected_components_v1", "condition_supported_path_component_filter_missing")
check(disconnectedWarmGroundAudit.channelAudits.find((item) => item.channelId === "terrain_path_ground")?.signalIsolation?.rejectedPixelCount > 0, "disconnected_warm_ground_pixels_were_not_isolated")
check(noWaterForestedLowMountainAudit.passed === true, "no_water_forested_low_mountain_blue_green_shadows_should_pass")
check(noWaterForestedLowMountainAudit.waterClassifier?.mode === "condition_presence_aware_water_signal_v3", "condition_presence_aware_water_classifier_missing")
check(noWaterForestedLowMountainAudit.channelAudits.find((item) => item.channelId === "terrain_water")?.classifierMode === "condition_absent_strong_blue_dominance_v2", "dense_water_surface_absence_classifier_missing")
check(noWaterForestedLowMountainAudit.channelAudits.find((item) => item.channelId === "terrain_water")?.actualSignalRatio <= 0.005, "no_water_forested_low_mountain_false_water_signal_not_removed")
check(noWaterForestedLowMountainAudit.channelAudits.find((item) => item.channelId === "terrain_water")?.signalIsolation?.acceptanceThresholdsChanged === false, "water_false_positive_repair_changed_thresholds")

const result = {
  ok: failures.length === 0,
  status: failures.length === 0 ? "ai_assisted_condition_alignment_check_passed" : "ai_assisted_condition_alignment_check_failed",
  passingRecordId: passingRecord.recordId,
  passingWaterAudit: passingAudit.channelAudits.find((item) => item.channelId === "terrain_water"),
  rejectedRecordId: rejectedRecord.recordId,
  rejectedFailureCodes: rejectedAudit.issues.map((issue) => issue.code),
  noWaterRecordId: noWaterRecord.recordId,
  noWaterAudit: noWaterAudit.channelAudits.find((item) => item.channelId === "terrain_water"),
  drySeasonRejectedRecordId: drySeasonRejectedRecord.recordId,
  drySeasonRejectedPathAudit: drySeasonRejectedAudit.channelAudits.find((item) => item.channelId === "terrain_path_ground"),
  drySeasonPassingRecordId: drySeasonPassingRecord.recordId,
  drySeasonPassingPathAudit: drySeasonPassingAudit.channelAudits.find((item) => item.channelId === "terrain_path_ground"),
  disconnectedWarmGroundRecordId: disconnectedWarmGroundRecord.recordId,
  disconnectedWarmGroundPathAudit: disconnectedWarmGroundAudit.channelAudits.find((item) => item.channelId === "terrain_path_ground"),
  noWaterForestedLowMountainRecordId: noWaterForestedLowMountainRecord.recordId,
  noWaterForestedLowMountainWaterAudit: noWaterForestedLowMountainAudit.channelAudits.find((item) => item.channelId === "terrain_water"),
  failures,
}
console[failures.length === 0 ? "log" : "error"](JSON.stringify(result, null, 2))
process.exit(failures.length === 0 ? 0 : 1)

async function audit(record) {
  return auditAiAssistedConditionAlignment({
    record,
    imagePath: resolveProjectPath(path.join(record.relativeDirectory, record.originalImage.path)),
  })
}
function readRecord(recordId) {
  return JSON.parse(fs.readFileSync(resolveProjectPath(`data/world-samples/original-image-library/natural-home-v1/complete-maps/${recordId}/record.json`), "utf8"))
}
function check(condition, failure) { if (!condition) failures.push(failure) }
function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error(`path escapes project: ${value}`)
  return resolved
}
