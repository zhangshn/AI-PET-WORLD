import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"

const ROOT = process.cwd()
const failures = []
const routeConditionAudits = []
const pointer = readJson(".runtime/ai-painter/ai-assisted-conditional-world-facts/latest.json")
const manifest = pointer?.manifestPath ? readJson(pointer.manifestPath) : null

check(Boolean(pointer), "conditional_world_fact_pointer_missing")
check(Boolean(manifest), "conditional_world_fact_manifest_missing")
if (pointer && manifest) {
  const singleRevision = manifest.rebuildMode === "single_condition_geometry_revision"
  check(pointer.schemaVersion === "ai-assisted-conditional-world-fact-latest-v2", "conditional_world_fact_pointer_schema_invalid")
  check(manifest.schemaVersion === "ai-assisted-conditional-world-fact-batch-v2", "conditional_world_fact_schema_invalid")
  check(manifest.batchId === pointer.batchId, "conditional_world_fact_batch_identity_mismatch")
  check(manifest.status === "condition_blueprints_ready_rgb_pairs_missing", "conditional_world_fact_status_invalid")
  check(
    singleRevision
      ? /^owner-command-/.test(manifest.ownerAuthorizationRef ?? "")
        && manifest.ownerAuthorizationRef === manifest.revision?.ownerCommandRef
      : manifest.ownerAuthorizationRef === "conversation-owner-authorization-2026-07-18-rebuild-all-condition-blueprints-new-labels",
    "conditional_world_fact_owner_authorization_missing",
  )
  check(manifest.generationContractVersion === "complete-map-scope-world-facts-v2", "conditional_world_fact_generation_contract_invalid")
  check(manifest.labelPrefix === "complete-map-v2", "conditional_world_fact_label_prefix_invalid")
  check(["full_new_identity_batch", "single_condition_geometry_revision"].includes(manifest.rebuildMode), "conditional_world_fact_rebuild_mode_invalid")
  if (singleRevision) {
    check(manifest.revision?.revisedRowCount === 1, "single_condition_revision_count_invalid")
    check(manifest.revision?.inheritedRowCount === 20, "single_condition_inherited_count_invalid")
    check(Boolean(manifest.revision?.sourceRecordId), "single_condition_revision_target_missing")
    const revisedRows = (manifest.rows ?? []).filter((row) => !row.inheritedFromBatchId)
    const inheritedRows = (manifest.rows ?? []).filter((row) => row.inheritedFromBatchId)
    check(revisedRows.length === 1 && revisedRows[0]?.sourceRecordId === manifest.revision?.sourceRecordId, "single_condition_revision_row_identity_invalid")
    check(inheritedRows.length === 20, "single_condition_inherited_rows_invalid")
  }
  check(manifest.sourceBlueprintReuse === false, "conditional_world_fact_source_blueprint_reused")
  check(manifest.historicalBatchMutation === false, "conditional_world_fact_history_mutation_allowed")
  check(manifest.historicalBatchesRetained === true, "conditional_world_fact_history_retention_missing")
  check(manifest.completeMapScopeRequired === true, "conditional_world_fact_complete_map_scope_missing")
  check(manifest.worldProfileId === "mainland-southeast-asia-tropical-monsoon-natural-home-v1", "conditional_world_fact_profile_invalid")
  check(manifest.sourceMode === "generation_intent_before_rgb_plus_locked_world_rules", "conditional_world_fact_source_mode_invalid")
  check(manifest.sourceImageGeometryRead === false, "conditional_world_fact_must_not_read_rgb_geometry")
  check(manifest.changesRuntimeWorldFacts === false, "conditional_world_fact_must_not_change_runtime")
  check(manifest.existingRgbBoundToGeneratedConditions === false, "existing_rgb_must_not_be_rebound")
  check(manifest.generatedBlueprintCount === 21, "conditional_world_fact_blueprint_count_invalid")
  check(manifest.generatedConditionPackCount === 21, "conditional_world_fact_condition_count_invalid")
  check(manifest.pairedRgbCount === 0, "conditional_world_fact_must_start_unpaired")
  check(manifest.conditionalTrainingEligible === false && manifest.formalTrainingEligible === false, "conditional_training_must_remain_blocked")
  check((manifest.blockers ?? []).includes("condition_blueprints_require_new_rgb_pairs"), "new_rgb_pair_blocker_missing")
  check(Array.isArray(manifest.blockers), "historical_blueprint_blockers_missing")
  check(Array.isArray(manifest.rows) && manifest.rows.length === 21, "conditional_world_fact_rows_invalid")
  const labels = (manifest.rows ?? []).map((row) => row.conditionLabel)
  const expectedLabels = Array.from({ length: 21 }, (_, index) => `complete-map-v2-${String(index + 1).padStart(3, "0")}`)
  check(new Set(labels).size === 21, "conditional_world_fact_labels_not_unique")
  check(labels.every((label) => /^complete-map-v2-\d{3}$/.test(label ?? "")), "conditional_world_fact_label_invalid")
  check(JSON.stringify(labels) === JSON.stringify(expectedLabels), "conditional_world_fact_labels_not_contiguous")
  for (const row of manifest.rows ?? []) await validateRow(row)
}

const result = {
  ok: failures.length === 0,
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "ai_assisted_conditional_world_facts_check_passed" : "ai_assisted_conditional_world_facts_check_failed",
  batchId: manifest?.batchId ?? null,
  generatedBlueprintCount: manifest?.generatedBlueprintCount ?? 0,
  generatedConditionPackCount: manifest?.generatedConditionPackCount ?? 0,
  pairedRgbCount: manifest?.pairedRgbCount ?? 0,
  conditionalTrainingEligible: manifest?.conditionalTrainingEligible ?? false,
  blockers: manifest?.blockers ?? [],
  routeConditionAudits,
  failures,
  automaticStorage: true,
}
if (manifest && pointer?.manifestPath) {
  const reportPath = path.join(path.dirname(resolveProjectPath(pointer.manifestPath)), "condition-world-facts-check.json")
  fs.writeFileSync(reportPath, `${JSON.stringify(result, null, 2)}\n`)
}
console[failures.length === 0 ? "log" : "error"](JSON.stringify(result, null, 2))
process.exit(failures.length === 0 ? 0 : 1)

async function validateRow(row) {
  check(row.generationContractVersion === "complete-map-scope-world-facts-v2", `row_generation_contract_invalid:${row.sourceRecordId}`)
  check(/^complete-map-v2-\d{3}$/.test(row.conditionLabel ?? ""), `row_condition_label_invalid:${row.sourceRecordId}`)
  check(row.sourceBlueprintReuse === false, `row_source_blueprint_reused:${row.sourceRecordId}`)
  check(row.sourceImageGeometryRead === false, `source_image_geometry_read:${row.sourceRecordId}`)
  check(row.existingRgbBound === false, `existing_rgb_bound:${row.sourceRecordId}`)
  check(row.needsNewRgbPair === true, `new_rgb_pair_flag_missing:${row.sourceRecordId}`)
  check(row.channelCount === 23, `condition_channel_count_invalid:${row.sourceRecordId}`)
  validateHash(row.promptEvidencePath, row.promptEvidenceSha256, `prompt_hash_mismatch:${row.sourceRecordId}`)
  validateHash(row.blueprintPath, row.blueprintSha256, `blueprint_hash_mismatch:${row.sourceRecordId}`)
  validateHash(row.visualFactManifestPath, row.visualFactManifestSha256, `visual_fact_hash_mismatch:${row.sourceRecordId}`, true)
  validateHash(row.directorOutputPath, row.directorOutputSha256, `director_hash_mismatch:${row.sourceRecordId}`)
  validateHash(row.taskPackagePath, row.taskPackageSha256, `task_hash_mismatch:${row.sourceRecordId}`)

  const blueprint = readJson(row.blueprintPath)
  const director = readJson(row.directorOutputPath)
  const task = readJson(row.taskPackagePath)
  const sourceRecord = readJson(`data/world-samples/original-image-library/natural-home-v1/complete-maps/${row.sourceRecordId}/record.json`)
  const snapshot = blueprint?.earthParameterSnapshotPath ? readJson(blueprint.earthParameterSnapshotPath) : null
  const conditionManifest = readJson(row.conditionManifestPath)
  const conditionPack = readJson(row.conditionPackPath)
  check(Boolean(blueprint), `blueprint_unreadable:${row.sourceRecordId}`)
  check(Boolean(director), `director_unreadable:${row.sourceRecordId}`)
  check(Boolean(task), `task_unreadable:${row.sourceRecordId}`)
  check(Boolean(sourceRecord), `source_record_unreadable:${row.sourceRecordId}`)
  check(Boolean(snapshot), `environment_snapshot_unreadable:${row.sourceRecordId}`)
  check(Boolean(conditionManifest), `condition_manifest_unreadable:${row.sourceRecordId}`)
  check(Boolean(conditionPack), `condition_pack_unreadable:${row.sourceRecordId}`)
  if (!blueprint || !director || !task || !sourceRecord || !snapshot || !conditionManifest || !conditionPack) return

  check(blueprint.schemaVersion === "ai-assisted-training-world-fact-blueprint-v2", `blueprint_schema_invalid:${row.sourceRecordId}`)
  check(blueprint.generationContractVersion === row.generationContractVersion, `blueprint_generation_contract_mismatch:${row.sourceRecordId}`)
  check(blueprint.conditionLabel === row.conditionLabel, `blueprint_condition_label_mismatch:${row.sourceRecordId}`)
  check(blueprint.sourceBlueprintReuse === false, `blueprint_source_reuse_detected:${row.sourceRecordId}`)
  check(blueprint.completeMapScopeRequired === true, `blueprint_complete_map_scope_missing:${row.sourceRecordId}`)
  check(director.generationContractVersion === row.generationContractVersion, `director_generation_contract_mismatch:${row.sourceRecordId}`)
  check(director.conditionLabel === row.conditionLabel, `director_condition_label_mismatch:${row.sourceRecordId}`)
  check(task.generationContractVersion === row.generationContractVersion, `task_generation_contract_mismatch:${row.sourceRecordId}`)
  check(task.conditionLabel === row.conditionLabel, `task_condition_label_mismatch:${row.sourceRecordId}`)
  check(row.blueprintPath.includes(`/${row.conditionLabel}/`), `blueprint_path_label_mismatch:${row.sourceRecordId}`)
  check(row.taskPackagePath.includes(`/${row.conditionLabel}/`), `task_path_label_mismatch:${row.sourceRecordId}`)
  check(blueprint.sourceImagePathRead === false && blueprint.sourceImageGeometryRead === false, `blueprint_rgb_reverse_inference_detected:${row.sourceRecordId}`)
  check(blueprint.existingRgbMayBeBoundAsTarget === false, `blueprint_existing_rgb_binding_allowed:${row.sourceRecordId}`)
  check(blueprint.outputContract?.generatesRgb === false, `blueprint_generated_rgb:${row.sourceRecordId}`)
  check(blueprint.outputContract?.changesRuntimeWorldFacts === false, `blueprint_changed_runtime:${row.sourceRecordId}`)
  const environmentContext = blueprint.environmentContext
  check(environmentContext?.contractVersion === "world-visual-environment-context-v1", `environment_context_contract_invalid:${row.sourceRecordId}`)
  check(environmentContext?.season === snapshot.environment?.season, `environment_snapshot_season_mismatch:${row.sourceRecordId}`)
  check(environmentContext?.sourceSnapshotId === snapshot.snapshotId, `environment_snapshot_identity_mismatch:${row.sourceRecordId}`)
  if (sourceRecord.classification?.monsoonSeason) {
    check(environmentContext?.season === sourceRecord.classification.monsoonSeason, `environment_record_season_mismatch:${row.sourceRecordId}`)
  }
  check(row.environmentContextContractVersion === environmentContext?.contractVersion, `environment_row_contract_mismatch:${row.sourceRecordId}`)
  check(row.season === environmentContext?.season, `environment_row_season_mismatch:${row.sourceRecordId}`)
  check(row.environmentState === environmentContext?.environmentState, `environment_row_state_mismatch:${row.sourceRecordId}`)
  check(sameJson(task.environmentContext, environmentContext), `environment_task_mismatch:${row.sourceRecordId}`)
  check(director.singleMapEcologyPlan?.season === environmentContext?.season, `environment_director_season_mismatch:${row.sourceRecordId}`)
  check(director.singleMapMaterialPlan?.environmentState === environmentContext?.environmentState, `environment_director_state_mismatch:${row.sourceRecordId}`)
  for (const field of ["season", "environmentState", "weather", "lighting", "groundMoisture"]) {
    check(Boolean(environmentContext?.[field]), `environment_field_missing:${row.sourceRecordId}:${field}`)
  }
  const excludedObjectPolygons = (blueprint.geometry?.terrainRegions ?? [])
    .filter((region) => region.kind === "water" || region.kind === "path_ground")
    .map((region) => region.polygon)
  for (const object of blueprint.geometry?.objectFootprints ?? []) {
    check(!boundsTouchesAnyPolygon(object.footprint, excludedObjectPolygons), `object_overlaps_water_or_path:${row.sourceRecordId}:${object.objectId}`)
    check(!boundsTouchesFocalArea(object.footprint, blueprint.geometry.focalBounds), `object_overlaps_focal_area:${row.sourceRecordId}:${object.objectId}`)
  }
  check(task.sourceBindings?.sourceMode === "training_world_fact_blueprint", `task_source_mode_invalid:${row.sourceRecordId}`)
  check(task.sourceBindings?.runtimeFramePath === null, `training_task_runtime_binding_present:${row.sourceRecordId}`)
  check(task.inferenceGate?.canRunCompleteVisualInference === false, `training_task_inference_open:${row.sourceRecordId}`)
  check(JSON.stringify(task.renderLayerRecipe?.orderedLayerRefs ?? []).indexOf('"shoreline","water"') >= 0, `shoreline_water_layer_order_invalid:${row.sourceRecordId}`)
  check(conditionPack.outputKind === "model_condition_only_no_rgb", `condition_output_kind_invalid:${row.sourceRecordId}`)
  check(conditionPack.generatesPlayerFacingPixels === false && conditionPack.changesWorldFacts === false, `condition_side_effect_invalid:${row.sourceRecordId}`)
  check(conditionPack.canvas?.width === 1024 && conditionPack.canvas?.height === 768, `condition_canvas_invalid:${row.sourceRecordId}`)
  check(conditionPack.channels?.length === 23, `condition_pack_channel_count_invalid:${row.sourceRecordId}`)
  check(conditionManifest.conditionPackSha256 === conditionPack.conditionPackSha256, `condition_manifest_hash_mismatch:${row.sourceRecordId}`)
  const canonical = { ...conditionPack }
  delete canonical.conditionPackSha256
  check(sha256(Buffer.from(JSON.stringify(canonical))) === conditionPack.conditionPackSha256, `condition_pack_hash_mismatch:${row.sourceRecordId}`)
  for (const channel of conditionPack.channels ?? []) {
    validateHash(channel.path, channel.sha256, `condition_channel_hash_mismatch:${row.sourceRecordId}:${channel.id}`)
    const metadata = await sharp(resolveProjectPath(channel.path), { failOn: "error" }).metadata()
    check(metadata.width === 1024 && metadata.height === 768, `condition_channel_size_invalid:${row.sourceRecordId}:${channel.id}`)
    check(metadata.space === "b-w", `condition_channel_color_space_invalid:${row.sourceRecordId}:${channel.id}`)
  }
  const routeConditionAudit = await auditRouteCondition(conditionPack)
  routeConditionAudits.push({ sourceRecordId: row.sourceRecordId, ...routeConditionAudit })
  check(routeConditionAudit.pathPixels > 0, `path_condition_empty:${row.sourceRecordId}`)
  check(routeConditionAudit.pathWaterOverlapPixels === 0, `path_overlaps_water_condition:${row.sourceRecordId}`)
  check(routeConditionAudit.pathCollisionOverlapPixels === 0, `path_overlaps_collision_condition:${row.sourceRecordId}`)
}

async function auditRouteCondition(conditionPack) {
  const water = await readConditionChannel(conditionPack, "terrain_water")
  const route = await readConditionChannel(conditionPack, "terrain_path_ground")
  const collision = await readConditionChannel(conditionPack, "collision")
  let pathPixels = 0
  let pathWaterOverlapPixels = 0
  let pathCollisionOverlapPixels = 0
  for (let index = 0; index < route.data.length; index += 1) {
    if (route.data[index] === 0) continue
    pathPixels += 1
    if (water.data[index] > 0) pathWaterOverlapPixels += 1
    if (collision.data[index] > 0) pathCollisionOverlapPixels += 1
  }
  return { pathPixels, pathWaterOverlapPixels, pathCollisionOverlapPixels }
}

async function readConditionChannel(conditionPack, channelId) {
  const channel = conditionPack.channels?.find((entry) => entry.id === channelId)
  if (!channel) throw new Error(`condition channel missing: ${channelId}`)
  return sharp(resolveProjectPath(channel.path), { failOn: "error" }).greyscale().raw().toBuffer({ resolveWithObject: true })
}

function boundsTouchesAnyPolygon(bounds, polygons) {
  const points = [
    [bounds.x, bounds.y],
    [bounds.x + bounds.width, bounds.y],
    [bounds.x, bounds.y + bounds.height],
    [bounds.x + bounds.width, bounds.y + bounds.height],
    [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2],
  ]
  return points.some(([x, y]) => polygons.some((polygon) => pointInPolygon(x, y, polygon)))
}

function boundsTouchesFocalArea(bounds, focal) {
  if (!focal) return false
  const margin = 12
  return bounds.x < focal.x + focal.width + margin
    && bounds.x + bounds.width + margin > focal.x
    && bounds.y < focal.y + focal.height + margin
    && bounds.y + bounds.height + margin > focal.y
}

function pointInPolygon(x, y, polygon) {
  let inside = false
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current, current += 1) {
    const a = polygon[current]
    const b = polygon[previous]
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

function validateHash(value, expected, message, canonicalManifest = false) {
  const filePath = resolveProjectPath(value)
  check(fs.existsSync(filePath), `file_missing:${value}`)
  if (!fs.existsSync(filePath)) return
  if (canonicalManifest) {
    const payload = readJson(filePath)
    if (!payload) return check(false, message)
    const canonical = { ...payload }
    delete canonical.manifestSha256
    check(sha256(Buffer.from(JSON.stringify(canonical))) === expected, message)
  } else {
    check(sha256(fs.readFileSync(filePath)) === expected, message)
  }
}

function readJson(value) { try { return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8")) } catch { return null } }
function resolveProjectPath(value) { const resolved = path.resolve(ROOT, value); if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error(`path escapes project root: ${value}`); return resolved }
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex") }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
function check(condition, message) { if (!condition && !failures.includes(message)) failures.push(message) }
