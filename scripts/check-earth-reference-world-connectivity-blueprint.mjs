import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const latestPath = path.join(ROOT, "data", "world-samples", "world-connectivity", "blueprints", "latest.json")
const failures = []

check(fs.existsSync(latestPath), "earth_reference_connectivity_blueprint_latest_missing")
const latest = fs.existsSync(latestPath) ? readJson(latestPath) : null
const blueprintPath = latest?.blueprintPath ? path.resolve(ROOT, latest.blueprintPath) : null
const sourcePath = latest?.sourcePath ? path.resolve(ROOT, latest.sourcePath) : null
check(Boolean(blueprintPath && fs.existsSync(blueprintPath)), "earth_reference_connectivity_blueprint_missing")
check(Boolean(sourcePath && fs.existsSync(sourcePath)), "earth_reference_connectivity_source_missing")
const blueprint = blueprintPath && fs.existsSync(blueprintPath) ? readJson(blueprintPath) : null
const source = sourcePath && fs.existsSync(sourcePath) ? readJson(sourcePath) : null
const worldStatePath = blueprint?.sourceBinding?.worldStatePath ? path.resolve(ROOT, blueprint.sourceBinding.worldStatePath) : null
const worldState = worldStatePath && fs.existsSync(worldStatePath) ? readJson(worldStatePath) : null

check(blueprint?.schemaVersion === "world-connectivity-blueprint-v1", "earth_reference_connectivity_blueprint_schema_invalid")
check(blueprint?.status === "owner_directed_earth_reference_ready_for_runtime_migration", "earth_reference_connectivity_blueprint_status_invalid")
check(blueprint?.contractId === "natural-home-large-world-connectivity-v1", "earth_reference_connectivity_contract_mismatch")
check(blueprint?.ownerDirective?.normalizedInstruction === "use_real_earth_conditions_as_the_connectivity_definition_basis", "earth_reference_owner_directive_missing")
check(blueprint?.topologyPolicy?.copiesNamedRealLocationGeometry === false, "earth_reference_named_geometry_copied")
check(blueprint?.topologyPolicy?.waterFlowAxis === "north_to_south", "earth_reference_flow_axis_invalid")
check(blueprint?.currentRegion?.regionalLandscapeType === "riparian-tropical-forest", "earth_reference_current_region_type_invalid")
check(Boolean(worldState), "earth_reference_world_state_missing")
check(blueprint?.currentRegion?.worldSeed === worldState?.homeMapState?.seed, "earth_reference_world_seed_mismatch")
check(blueprint?.pathGraph?.westBoundaryStatus === "natural_boundary_no_active_path_port", "earth_reference_west_boundary_invalid")
check(blueprint?.pathGraph?.edges?.some((edge) => edge.status === "planned_runtime_migration" && edge.target?.includes("south-path-exit")), "earth_reference_south_path_exit_missing")
check(blueprint?.hydrologyGraph?.flowAxis === "north_to_south", "earth_reference_hydrology_flow_invalid")
check(blueprint?.hydrologyGraph?.upstreamPortId?.includes("north-water-inlet"), "earth_reference_upstream_port_invalid")
check(blueprint?.hydrologyGraph?.downstreamPortId?.includes("south-water-outlet"), "earth_reference_downstream_port_invalid")
check(blueprint?.neighborRegionStubs?.length === 3, "earth_reference_neighbor_stub_count_invalid")
check(blueprint?.runtimeMigration?.status === "pending", "earth_reference_runtime_migration_status_invalid")
check(blueprint?.authorityBoundary?.worldStateMutatedByRegistration === false, "earth_reference_registration_mutated_world")
check(blueprint?.authorityBoundary?.externalImagesOrMapGeometryUsed === false, "earth_reference_external_geometry_used")
check(blueprint?.coverageThresholds?.status === "pending_owner_approval", "earth_reference_coverage_threshold_claimed")

check(source?.schemaVersion === "world-connectivity-earth-reference-source-v1", "earth_reference_source_schema_invalid")
check(source?.rightsBoundary?.factsOnly === true, "earth_reference_source_not_facts_only")
check(source?.rightsBoundary?.externalImagesUsed === false, "earth_reference_external_images_used")
check(source?.rightsBoundary?.externalMapTilesUsed === false, "earth_reference_external_tiles_used")
check(source?.externalAuthorities?.filter((item) => item.authority === "Mekong River Commission").length === 4, "earth_reference_mrc_sources_incomplete")

for (const port of blueprint?.edgePorts ?? []) {
  const pair = blueprint.edgePorts.find((candidate) => candidate.edgePortId === port.connectsToEdgePortId)
  check(Boolean(pair), `earth_reference_edge_port_pair_missing:${port.edgePortId}`)
  check(pair?.connectsToEdgePortId === port.edgePortId, `earth_reference_edge_port_pair_not_bidirectional:${port.edgePortId}`)
  check(pair?.kind === port.kind, `earth_reference_edge_port_pair_kind_mismatch:${port.edgePortId}`)
}

if (source) {
  const copy = structuredClone(source)
  delete copy.sourceSha256
  check(sha256(JSON.stringify(copy)) === source.sourceSha256, "earth_reference_source_hash_mismatch")
}
if (blueprint) {
  const copy = structuredClone(blueprint)
  delete copy.blueprintSha256
  check(sha256(JSON.stringify(copy)) === blueprint.blueprintSha256, "earth_reference_blueprint_hash_mismatch")
  check(blueprint.blueprintSha256 === latest?.blueprintSha256, "earth_reference_latest_hash_mismatch")
}

const result = {
  ok: failures.length === 0,
  status: failures.length === 0 ? "earth_reference_world_connectivity_blueprint_check_passed" : "earth_reference_world_connectivity_blueprint_check_failed",
  blueprintId: blueprint?.blueprintId ?? null,
  blueprintStatus: blueprint?.status ?? null,
  currentRegionId: blueprint?.currentRegion?.regionId ?? null,
  waterFlowAxis: blueprint?.hydrologyGraph?.flowAxis ?? null,
  pathExitSide: blueprint?.edgePorts?.find((port) => port.role === "land_route_exit")?.boundarySide ?? null,
  runtimeMigrationStatus: blueprint?.runtimeMigration?.status ?? null,
  failures,
}
console[failures.length ? "error" : "log"](JSON.stringify(result, null, 2))
process.exit(failures.length ? 1 : 0)

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function check(condition, failure) {
  if (!condition && !failures.includes(failure)) failures.push(failure)
}
