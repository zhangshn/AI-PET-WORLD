import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const failures = []
const pointer = readJson("data/world-runtime/latest-world.json")
const world = pointer?.path ? readJson(pointer.path) : null
const migration = readJson(".runtime/world-connectivity-migrations/latest.json")
const ownerReview = readJson(".runtime/world-connectivity-owner-reviews/latest.json")
const connectivity = world?.homeMapState?.worldConnectivity

check(Boolean(pointer), "latest_world_pointer_missing")
check(Boolean(world), "latest_world_missing")
check(Boolean(migration), "connectivity_migration_report_missing")
check(Boolean(connectivity), "world_connectivity_state_missing")

if (world && migration && connectivity) {
  check(connectivity.schemaVersion === "world-connectivity-runtime-state-v1", "connectivity_schema_invalid")
  const allowedStatuses = [
    "runtime_migrated_pending_owner_review",
    "runtime_migrated_owner_approved",
  ]
  check(allowedStatuses.includes(connectivity.status), "connectivity_status_invalid")
  check(connectivity.blueprintId === migration.blueprintId, "migration_blueprint_mismatch")
  check(connectivity.contractId === migration.contractId, "migration_contract_mismatch")
  check(connectivity.currentRegion?.worldId === world.worldId, "connectivity_world_mismatch")
  check(connectivity.currentRegion?.worldSeed === world.homeMapState?.seed, "connectivity_seed_mismatch")
  check(connectivity.currentRegion?.neighborRegionIds?.length === 3, "neighbor_count_invalid")
  check(connectivity.currentRegion?.edgePorts?.length === 4, "current_region_port_count_invalid")
  check(connectivity.pathGraph?.crossesWater === false, "path_crosses_water")
  check(connectivity.hydrologyGraph?.flowAxis === "north_to_south", "hydrology_axis_invalid")
  check(connectivity.walkableGraph?.migrationStatus === connectivity.status, "walkable_status_invalid")
  const currentPorts = connectivity.edgePorts.filter((port) => port.regionId === connectivity.currentRegion.regionId)
  check(currentPorts.length === 4, "active_current_port_count_invalid")
  check(currentPorts.every((port) => connectivity.currentRegion.edgePorts.includes(port.edgePortId)), "current_port_identity_mismatch")
  const southPathPort = currentPorts.find((port) => port.edgePortId.endsWith(":port:south-path-exit"))
  check(southPathPort?.state === "active_runtime_migrated", "south_path_port_not_active")
  check(southPathPort?.boundaryPosition?.x === 96 && southPathPort?.boundaryPosition?.y === 768, "south_path_port_position_invalid")
  check(migration.status === "runtime_migration_completed_pending_owner_review", "migration_report_status_invalid")
  check(migration.generatedImages === 0 && migration.alteredVisualApproval === false, "migration_changed_visual_boundary")
  check(exists(migration.sourceWorldPath), "migration_source_missing")
  check(exists(migration.targetWorldPath), "migration_target_missing")
  if (exists(migration.targetWorldPath)) {
    check(sha256File(migration.targetWorldPath) === migration.targetWorldSha256, "migration_target_hash_mismatch")
  }
  if (connectivity.status === "runtime_migrated_owner_approved") {
    check(Boolean(ownerReview), "connectivity_owner_review_missing")
    check(ownerReview?.status === "owner_approved", "connectivity_owner_review_status_invalid")
    check(ownerReview?.decision === "approved", "connectivity_owner_review_decision_invalid")
    check(ownerReview?.reviewId === connectivity.ownerReview?.reviewId, "connectivity_owner_review_id_mismatch")
    check(ownerReview?.worldId === world.worldId, "connectivity_owner_review_world_mismatch")
    check(ownerReview?.targetTick === world.tick, "connectivity_owner_review_tick_mismatch")
    check(ownerReview?.generatedImages === 0, "connectivity_owner_review_generated_images")
    check(ownerReview?.alteredConnectivityGeometry === false, "connectivity_owner_review_changed_geometry")
    check(exists(ownerReview?.targetWorldPath), "connectivity_owner_review_target_missing")
    if (exists(ownerReview?.targetWorldPath)) {
      check(sha256File(ownerReview.targetWorldPath) === ownerReview.targetWorldSha256, "connectivity_owner_review_target_hash_mismatch")
    }
  }
}

const result = {
  ok: failures.length === 0,
  status: failures.length === 0
    ? "current_world_connectivity_migration_check_passed"
    : "current_world_connectivity_migration_check_failed",
  worldId: world?.worldId ?? null,
  tick: world?.tick ?? null,
  contractId: connectivity?.contractId ?? null,
  blueprintId: connectivity?.blueprintId ?? null,
  ownerReviewStatus: connectivity?.ownerReview?.decision ?? "pending",
  regionId: connectivity?.currentRegion?.regionId ?? null,
  neighborRegionCount: connectivity?.currentRegion?.neighborRegionIds?.length ?? 0,
  currentRegionEdgePortCount: connectivity?.currentRegion?.edgePorts?.length ?? 0,
  failures,
}
console[failures.length === 0 ? "log" : "error"](JSON.stringify(result, null, 2))
process.exit(failures.length === 0 ? 0 : 1)

function readJson(value) { try { return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8")) } catch { return null } }
function exists(value) { return typeof value === "string" && fs.existsSync(path.resolve(ROOT, value)) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(path.resolve(ROOT, value))).digest("hex") }
function check(condition, code) { if (!condition) failures.push(code) }
