import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const CONTRACT_PATH = path.join(ROOT, "data", "world-samples", "world-connectivity", "world-connectivity-contract-v1.json")
const COVERAGE_PATH = path.join(ROOT, "data", "world-samples", "original-image-library", "natural-home-v1", "coverage-blueprint.json")
const DOCUMENT_PATHS = [
  "docs/BUSINESS_SPEC.md",
  "docs/ARCHITECTURE.md",
  "docs/DIRECTORY_STRUCTURE.md",
  "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md",
  "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
  "docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md",
]
const failures = []

check(fs.existsSync(CONTRACT_PATH), "world_connectivity_contract_missing")
check(fs.existsSync(COVERAGE_PATH), "world_connectivity_coverage_blueprint_missing")

const contract = fs.existsSync(CONTRACT_PATH) ? readJson(CONTRACT_PATH) : null
const coverage = fs.existsSync(COVERAGE_PATH) ? readJson(COVERAGE_PATH) : null

check(contract?.schemaVersion === "world-connectivity-contract-v1", "world_connectivity_contract_schema_invalid")
check(contract?.contractId === "natural-home-large-world-connectivity-v1", "world_connectivity_contract_id_invalid")
check(contract?.status === "active_contract_first_mvp_runtime_owner_approved_pending_coverage", "world_connectivity_contract_status_invalid")
check(contract?.authority?.visualCanDefineTopology === false, "world_connectivity_visual_authority_invalid")
check(contract?.authority?.rgbCanCreateWorldFacts === false, "world_connectivity_rgb_authority_invalid")
check(contract?.authority?.mechanicalImageCompositionAllowed === false, "world_connectivity_composition_rule_invalid")
check(contract?.scope?.exactWorldTopologyApproved === false, "world_connectivity_unapproved_topology_claimed")
check(contract?.scope?.firstMvpRegionConnectivityBlueprintDefined === true, "world_connectivity_first_mvp_blueprint_not_defined")
check(contract?.scope?.firstMvpRegionRuntimeMigrated === true, "world_connectivity_runtime_migration_not_recorded")
check(contract?.scope?.firstMvpRegionConnectivityBlueprintId === "mainland-southeast-asia-earth-reference-natural-home-region-0001-v1", "world_connectivity_first_mvp_blueprint_id_invalid")
check(contract?.scope?.minimumConnectivityCountsApproved === false, "world_connectivity_unapproved_threshold_claimed")
check(contract?.runtimeEvidence?.status === "runtime_migrated_owner_approved", "world_connectivity_runtime_evidence_status_invalid")
check(contract?.runtimeEvidence?.automaticStorage === true, "world_connectivity_runtime_evidence_storage_invalid")
check(nonEmpty(contract?.runtimeEvidence?.ownerReviewId), "world_connectivity_owner_review_id_missing")
check(nonEmpty(contract?.runtimeEvidence?.ownerReviewPath), "world_connectivity_owner_review_path_missing")

const mvp = contract?.coordinateSystems?.currentMvpRegion
check(mvp?.logicalGridWidth === 64 && mvp?.logicalGridHeight === 48, "world_connectivity_logical_grid_invalid")
check(mvp?.tileSize === 16, "world_connectivity_tile_size_invalid")
check(mvp?.visualWidth === 1024 && mvp?.visualHeight === 768, "world_connectivity_visual_size_invalid")

for (const field of ["regionId", "worldId", "worldSeed", "worldProfileId", "edgePorts", "pathGraphId", "hydrologyGraphId", "walkableGraphId", "objectIdentitySetId", "contentHash"]) {
  check(contract?.requiredRegionFields?.includes(field), `world_connectivity_region_field_missing:${field}`)
}
for (const field of ["edgePortId", "kind", "regionId", "boundarySide", "boundaryPosition", "direction", "width", "elevation", "connectsToRegionId", "connectsToEdgePortId", "state", "version"]) {
  check(contract?.edgePortContract?.requiredFields?.includes(field), `world_connectivity_edge_port_field_missing:${field}`)
}
for (const kind of ["path", "watercourse", "ecology_transition", "elevation_transition"]) {
  check(contract?.edgePortContract?.allowedKinds?.includes(kind), `world_connectivity_edge_port_kind_missing:${kind}`)
}
for (const code of ["disconnected_region", "unmatched_edge_port", "broken_cross_region_path", "broken_hydrology", "path_overlaps_water", "isolated_walkable_component", "adjacency_profile_conflict", "object_identity_discontinuity", "visual_invented_connectivity"]) {
  check(contract?.failureCodes?.includes(code), `world_connectivity_failure_code_missing:${code}`)
}

check(coverage?.worldConnectivityContract?.contractId === contract?.contractId, "coverage_connectivity_contract_id_mismatch")
check(coverage?.worldConnectivityContract?.path === "data/world-samples/world-connectivity/world-connectivity-contract-v1.json", "coverage_connectivity_contract_path_invalid")
check(coverage?.worldConnectivityContract?.firstMvpRegionConnectivityBlueprintId === contract?.scope?.firstMvpRegionConnectivityBlueprintId, "coverage_connectivity_blueprint_id_mismatch")
check(coverage?.connectivityCoverage?.minimumThresholdStatus === "pending_owner_approval", "coverage_connectivity_threshold_status_invalid")
check(coverage?.connectivityCoverage?.currentQualifiedRecordCount === 0, "coverage_connectivity_records_unexpectedly_qualified")
for (const axis of ["connectivityBlueprintId", "regionId", "edgePortIds", "pathGraphId", "hydrologyGraphId", "walkableGraphId"]) {
  check(coverage?.coverageAxes?.["complete-maps"]?.includes(axis), `coverage_connectivity_axis_missing:${axis}`)
}

for (const relativePath of DOCUMENT_PATHS) {
  const absolutePath = path.join(ROOT, relativePath)
  check(fs.existsSync(absolutePath), `world_connectivity_document_missing:${relativePath}`)
  if (!fs.existsSync(absolutePath)) continue
  const source = fs.readFileSync(absolutePath, "utf8")
  check(source.includes("natural-home-large-world-connectivity-v1"), `world_connectivity_document_reference_missing:${relativePath}`)
}

const result = {
  ok: failures.length === 0,
  status: failures.length === 0 ? "world_connectivity_contract_check_passed" : "world_connectivity_contract_check_failed",
  contractId: contract?.contractId ?? null,
  topologyBlueprintStatus: contract?.status ?? null,
  firstMvpRegionConnectivityBlueprintId: contract?.scope?.firstMvpRegionConnectivityBlueprintId ?? null,
  qualifiedConnectivityRecordCount: coverage?.connectivityCoverage?.currentQualifiedRecordCount ?? null,
  failures,
}
console[failures.length ? "error" : "log"](JSON.stringify(result, null, 2))
process.exit(failures.length ? 1 : 0)

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function check(condition, failure) {
  if (!condition && !failures.includes(failure)) failures.push(failure)
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0
}
