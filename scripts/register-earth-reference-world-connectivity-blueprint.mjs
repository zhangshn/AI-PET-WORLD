import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const requiredDirective = "use-real-earth-conditions"
const directive = readArg("--owner-directive")
if (directive !== requiredDirective) {
  throw new Error(`owner_directive_required:${requiredDirective}`)
}

const contractPath = path.join(ROOT, "data", "world-samples", "world-connectivity", "world-connectivity-contract-v1.json")
const proposalLatestPath = path.join(ROOT, ".runtime", "ai-painter", "world-connectivity-proposals", "latest.json")
const profilePath = path.join(ROOT, "data", "world-samples", "original-image-library", "natural-home-v1", "mainland-southeast-asia-tropical-monsoon-profile-v1.json")
const earthSnapshotPath = path.join(ROOT, "data", "world-samples", "original-image-library", "natural-home-v1", "earth-parameter-snapshots", "mainland-southeast-asia-reference-v1", "manifest.json")
const connectivityRoot = path.join(ROOT, "data", "world-samples", "world-connectivity")
const sourcePath = path.join(connectivityRoot, "earth-reference-sources", "mainland-southeast-asia-connectivity-v1.json")
const blueprintId = "mainland-southeast-asia-earth-reference-natural-home-region-0001-v1"
const blueprintPath = path.join(connectivityRoot, "blueprints", "mainland-southeast-asia-tropical-monsoon-natural-home-v1", blueprintId, "blueprint.json")
const latestPath = path.join(connectivityRoot, "blueprints", "latest.json")

const contract = readJson(contractPath)
const proposalLatest = readJson(proposalLatestPath)
const proposal = readJson(path.resolve(ROOT, proposalLatest.proposalPath))
const sourceTask = readJson(path.resolve(ROOT, proposal.source.taskPath))
const worldStatePath = path.resolve(ROOT, sourceTask.sourceBindings.worldStatePath)
const worldState = readJson(worldStatePath)
const profile = readJson(profilePath)
const earthSnapshot = readJson(earthSnapshotPath)
const createdAt = new Date().toISOString()

assert(contract.contractId === "natural-home-large-world-connectivity-v1", "connectivity_contract_invalid")
assert(proposal.status === "pending_owner_review", "connectivity_proposal_status_invalid")
assert(proposal.authorityBoundary?.formalBlueprintCreated === false, "connectivity_proposal_already_formal")
assert(profile.worldProfileId === earthSnapshot.worldProfileId, "earth_reference_profile_mismatch")
assert(worldState.worldId === proposal.source.worldId, "connectivity_world_state_id_mismatch")
assert(typeof worldState.homeMapState?.seed === "string" && worldState.homeMapState.seed.length > 0, "connectivity_world_seed_missing")

const sources = {
  schemaVersion: "world-connectivity-earth-reference-source-v1",
  sourceId: "mainland-southeast-asia-connectivity-earth-reference-v1",
  status: "versioned_facts_only",
  createdAt,
  createdAtAsiaShanghai: formatShanghai(createdAt),
  worldProfileId: profile.worldProfileId,
  localProjectSources: [
    {
      sourceId: earthSnapshot.snapshotId,
      path: projectPath(earthSnapshotPath),
      authority: earthSnapshot.source.authority,
      factsUsed: ["representative_elevation", "tropical_monsoon_seasonality", "wet_season_reference"],
      sha256: sha256(fs.readFileSync(earthSnapshotPath)),
    },
    {
      sourceId: profile.worldProfileId,
      path: projectPath(profilePath),
      factsUsed: ["regional_ecosystem_envelope", "allowed_landscape_types", "excluded_mvp_systems"],
      sha256: sha256(fs.readFileSync(profilePath)),
    },
  ],
  externalAuthorities: [
    {
      authority: "Mekong River Commission",
      url: "https://www.mrcmekong.org/hydrometeorological-monitoring/",
      retrievedAt: createdAt,
      factsUsed: ["mainstream_general_southerly_direction", "southwest_monsoon_drives_annual_flood_pulse"],
    },
    {
      authority: "Mekong River Commission",
      url: "https://www.mrcmekong.org/hydrology/",
      retrievedAt: createdAt,
      factsUsed: ["lower_basin_seasonal_flow_variability", "flood_season_june_to_november", "tributary_and_floodplain_ecosystem_relationship"],
    },
    {
      authority: "Mekong River Commission",
      url: "https://www.mrcmekong.org/geography/",
      retrievedAt: createdAt,
      factsUsed: ["diverse_lower_basin_topography", "tributary_network", "river_valley_and_floodplain_sequence"],
    },
    {
      authority: "Mekong River Commission",
      url: "https://www.mrcmekong.org/basin-climate/",
      retrievedAt: createdAt,
      factsUsed: ["lower_basin_tropical_monsoon_identity", "regional_rainfall_gradient"],
    },
  ],
  rightsBoundary: {
    factsOnly: true,
    externalImagesUsed: false,
    externalMapTilesUsed: false,
    namedRealLocationGeometryCopied: false,
    externalTrainingAssetsCreated: false,
  },
}
sources.sourceSha256 = sha256(stablePayload(sources, "sourceSha256"))

const regionIds = {
  current: "world-d0znz8:natural-home:region-0001",
  upstream: "world-d0znz8:natural-home:region-0002-upstream-riparian",
  downstream: "world-d0znz8:natural-home:region-0003-downstream-floodplain",
  eastBank: "world-d0znz8:natural-home:region-0004-east-bank-riparian",
}
const portIds = {
  northWater: `${regionIds.current}:port:north-water-inlet`,
  northWaterPair: `${regionIds.upstream}:port:south-water-outlet`,
  southWater: `${regionIds.current}:port:south-water-outlet`,
  southWaterPair: `${regionIds.downstream}:port:north-water-inlet`,
  eastWater: `${regionIds.current}:port:east-shared-channel`,
  eastWaterPair: `${regionIds.eastBank}:port:west-shared-channel`,
  southPath: `${regionIds.current}:port:south-path-exit`,
  southPathPair: `${regionIds.downstream}:port:north-path-entry`,
}

const blueprint = {
  schemaVersion: "world-connectivity-blueprint-v1",
  blueprintId,
  status: "owner_directed_earth_reference_ready_for_runtime_migration",
  createdAt,
  createdAtAsiaShanghai: formatShanghai(createdAt),
  contractId: contract.contractId,
  worldProfileId: profile.worldProfileId,
  ownerDirective: {
    directiveId: "owner-use-real-earth-conditions-2026-07-13",
    normalizedInstruction: "use_real_earth_conditions_as_the_connectivity_definition_basis",
    commandSource: "project_owner_current_task",
    appliedScope: "first_mvp_region_connectivity_blueprint",
    doesNotApproveFinalVisual: true,
    doesNotApproveRuntimeMigrationResult: true,
  },
  sourceBinding: {
    earthReferenceSourceId: sources.sourceId,
    earthReferenceSourcePath: projectPath(sourcePath),
    earthReferenceSourceSha256: sources.sourceSha256,
    proposalId: proposal.proposalId,
    proposalPath: proposalLatest.proposalPath,
    proposalSha256: proposal.proposalSha256,
    sourceTaskId: proposal.source.taskId,
    sourceTaskSha256: proposal.source.taskSha256,
    worldStatePath: projectPath(worldStatePath),
    worldStateSha256: sha256(fs.readFileSync(worldStatePath)),
  },
  topologyPolicy: {
    copiesNamedRealLocationGeometry: false,
    usesEarthHydrologyClimateAndTerrainRelationships: true,
    waterFlowAxis: "north_to_south",
    mvpRegionRole: "first_connected_playable_region_of_future_large_world",
    exactLongTermWorldBoundsDefined: false,
  },
  currentRegion: {
    regionId: regionIds.current,
    worldId: proposal.source.worldId,
    worldSeed: worldState.homeMapState.seed,
    worldProfileId: profile.worldProfileId,
    worldBounds: { regionX: 0, regionY: 0, widthRegions: 1, heightRegions: 1 },
    localBounds: proposal.currentRegion.bounds,
    regionalLandscapeType: "riparian-tropical-forest",
    elevationBand: {
      class: "river_valley_lowland",
      referenceElevationMeters: earthSnapshot.representativePoint.sourceElevationMeters,
      exactPerPortElevationPendingRuntimeTerrainModel: true,
    },
    neighborRegionIds: [regionIds.upstream, regionIds.downstream, regionIds.eastBank],
    edgePorts: [portIds.northWater, portIds.southWater, portIds.eastWater, portIds.southPath],
    pathGraphId: `${blueprintId}:path-graph-v1`,
    hydrologyGraphId: `${blueprintId}:hydrology-graph-v1`,
    walkableGraphId: `${blueprintId}:walkable-graph-v1`,
    objectIdentitySetId: `${proposal.source.structureId}:objects`,
    version: 1,
    contentHash: proposal.source.taskSha256,
  },
  neighborRegionStubs: [
    {
      regionId: regionIds.upstream,
      relativePosition: "north",
      regionalLandscapeType: "riparian-tropical-forest",
      topologyRole: "upstream_river_valley",
      generationStatus: "reserved_not_generated",
    },
    {
      regionId: regionIds.downstream,
      relativePosition: "south",
      regionalLandscapeType: "river-floodplain",
      topologyRole: "downstream_floodplain_and_land_route",
      generationStatus: "reserved_not_generated",
    },
    {
      regionId: regionIds.eastBank,
      relativePosition: "east",
      regionalLandscapeType: "riparian-tropical-forest",
      topologyRole: "opposite_bank_and_shared_channel_continuation",
      generationStatus: "reserved_not_generated",
    },
  ],
  edgePorts: [
    edgePort(portIds.northWater, "watercourse", regionIds.current, "north", { x: 948, y: 0 }, 152, "south", "upstream_inlet", regionIds.upstream, portIds.northWaterPair, "existing_boundary_evidence"),
    edgePort(portIds.northWaterPair, "watercourse", regionIds.upstream, "south", null, 152, "south", "downstream_outlet_pair_stub", regionIds.current, portIds.northWater, "reserved_neighbor_stub"),
    edgePort(portIds.southWater, "watercourse", regionIds.current, "south", { x: 884, y: 768 }, 280, "south", "downstream_outlet", regionIds.downstream, portIds.southWaterPair, "existing_boundary_evidence"),
    edgePort(portIds.southWaterPair, "watercourse", regionIds.downstream, "north", null, 280, "south", "upstream_inlet_pair_stub", regionIds.current, portIds.southWater, "reserved_neighbor_stub"),
    edgePort(portIds.eastWater, "watercourse", regionIds.current, "east", { x: 1024, y: 384 }, 768, "south", "shared_channel_side", regionIds.eastBank, portIds.eastWaterPair, "existing_boundary_evidence"),
    edgePort(portIds.eastWaterPair, "watercourse", regionIds.eastBank, "west", null, 768, "south", "shared_channel_side_pair_stub", regionIds.current, portIds.eastWater, "reserved_neighbor_stub"),
    edgePort(portIds.southPath, "path", regionIds.current, "south", { x: 96, y: 768 }, 32, "south", "land_route_exit", regionIds.downstream, portIds.southPathPair, "planned_requires_runtime_path_extension"),
    edgePort(portIds.southPathPair, "path", regionIds.downstream, "north", null, 32, "south", "land_route_entry_pair_stub", regionIds.current, portIds.southPath, "reserved_neighbor_stub"),
  ],
  pathGraph: {
    pathGraphId: `${blueprintId}:path-graph-v1`,
    nodes: ["entry_point", "home_center", portIds.southPath],
    edges: [
      { source: "entry_point", target: "home_center", sourceStructureId: "path-current-entry-to-home", status: "existing" },
      { source: "entry_point", target: portIds.southPath, coordinates: [{ x: 96, y: 704 }, { x: 96, y: 768 }], width: 32, status: "planned_runtime_migration" },
    ],
    westBoundaryStatus: "natural_boundary_no_active_path_port",
    crossesWater: false,
  },
  hydrologyGraph: {
    hydrologyGraphId: `${blueprintId}:hydrology-graph-v1`,
    waterBodyId: "terrain-current-water-east",
    flowAxis: "north_to_south",
    upstreamPortId: portIds.northWater,
    downstreamPortId: portIds.southWater,
    lateralContinuationPortId: portIds.eastWater,
    seasonalRegime: "tropical_monsoon_flood_pulse",
    wetSeasonReference: "may_to_october_project_profile_with_mrc_flood_context",
    exactDischargeModelStatus: "not_defined_for_mvp_visual_milestone",
  },
  walkableGraph: {
    walkableGraphId: `${blueprintId}:walkable-graph-v1`,
    requiredConnectedNodesAfterMigration: ["home_center", "entry_point", portIds.southPath],
    watercoursePortsWalkable: false,
    collisionRevalidationRequired: true,
    migrationStatus: "pending",
  },
  runtimeMigration: {
    required: true,
    status: "pending",
    requiredChanges: [
      "extend_entry_path_from_96_704_to_south_path_port_96_768",
      "bind_current_water_region_to_north_south_hydrology_ports",
      "bind_east_water_boundary_as_shared_channel_continuation",
      "persist_region_id_neighbor_stubs_and_graph_ids_in_world_state",
      "rebuild_visual_fact_manifest_task_package_and_conditions",
      "rerun_walkable_collision_path_water_and_hydrology_validation"
    ],
  },
  coverageThresholds: {
    status: "pending_owner_approval",
    positiveCounts: null,
    negativeCounts: null,
  },
  authorityBoundary: {
    worldStateMutatedByRegistration: false,
    imagesGeneratedByRegistration: false,
    externalImagesOrMapGeometryUsed: false,
    runtimeMigrationRequiresSeparateExecution: true,
    runtimeMigrationResultRequiresOwnerReview: true,
  },
}
blueprint.blueprintSha256 = sha256(stablePayload(blueprint, "blueprintSha256"))

writeJson(sourcePath, sources)
writeJson(blueprintPath, blueprint)
writeJson(latestPath, {
  schemaVersion: "world-connectivity-blueprint-manifest-v1",
  blueprintId,
  status: blueprint.status,
  createdAt,
  createdAtAsiaShanghai: blueprint.createdAtAsiaShanghai,
  contractId: contract.contractId,
  worldProfileId: profile.worldProfileId,
  currentRegionId: regionIds.current,
  blueprintSha256: blueprint.blueprintSha256,
  blueprintPath: projectPath(blueprintPath),
  sourcePath: projectPath(sourcePath),
  runtimeMigrationStatus: blueprint.runtimeMigration.status,
  automaticStorage: true,
})

console.log(JSON.stringify({
  ok: true,
  status: blueprint.status,
  blueprintId,
  blueprintPath: projectPath(blueprintPath),
  earthReferenceSourcePath: projectPath(sourcePath),
  currentRegionId: regionIds.current,
  neighborRegionCount: blueprint.neighborRegionStubs.length,
  currentRegionEdgePortCount: blueprint.currentRegion.edgePorts.length,
  waterFlowAxis: blueprint.hydrologyGraph.flowAxis,
  pathExitSide: "south",
  worldStateMutated: false,
  runtimeMigrationStatus: blueprint.runtimeMigration.status,
}, null, 2))

function edgePort(edgePortId, kind, regionId, boundarySide, boundaryPosition, width, direction, role, connectsToRegionId, connectsToEdgePortId, state) {
  return {
    edgePortId,
    kind,
    regionId,
    boundarySide,
    boundaryPosition,
    direction,
    width,
    elevation: { class: "river_valley_lowland", exactMeters: null, status: "pending_runtime_terrain_model" },
    role,
    connectsToRegionId,
    connectsToEdgePortId,
    state,
    version: 1,
  }
}

function readArg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

function stablePayload(value, hashField) {
  const copy = structuredClone(value)
  delete copy[hashField]
  return JSON.stringify(copy)
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function formatShanghai(value) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value)).replace(" ", "T") + "+08:00"
}

function projectPath(value) {
  return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/")
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`required_json_missing:${projectPath(filePath)}`)
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function assert(condition, code) {
  if (!condition) throw new Error(code)
}
