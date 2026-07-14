import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const OUTPUT_ROOT = path.join(ROOT, ".runtime", "ai-painter", "world-visual-fact-manifests")
const createdAt = new Date().toISOString()

const worldPointer = readRequiredJson("data/world-runtime/latest-world.json")
const worldState = readRequiredJson(worldPointer.path)
const runtimeRecord = readRequiredJson(".runtime/game-map-runtime-frame/latest-runtime-frame.json")
const runtimeFrame = runtimeRecord.runtimeFrame
const EXPECTED_WORLD_PROFILE = "mainland-southeast-asia-tropical-monsoon-natural-home-v1"
assert(runtimeFrame, "latest RuntimeFrame is missing")
assert(worldState.worldId === runtimeFrame.worldId, "worldId mismatch between world state and RuntimeFrame")
assert(worldState.ownerId === runtimeFrame.ownerId, "ownerId mismatch between world state and RuntimeFrame")
assert(worldState.tick === runtimeFrame.tick, "tick mismatch between world state and RuntimeFrame")
assert(worldState.worldProfileId === EXPECTED_WORLD_PROFILE, "current world profile is not the authorized tropical monsoon MVP profile")
assert(worldState.homeMapState?.ecologyState?.biomeType === "tropical_monsoon_lowland_foothill_natural_home", "current world biome is not migrated")

const home = worldState.homeMapState ?? {}
const includedZones = (home.zones ?? []).filter(isCurrentVisualZone).map((zone) => ({
  factId: zone.id,
  factType: "zone",
  semanticType: zone.type,
  bounds: zone.bounds,
  tags: zone.tags ?? [],
  source: "world_state.homeMapState.zones",
}))
const includedPlacements = (home.placements ?? []).filter(isCurrentVisualPlacement).map((placement) => ({
  factId: placement.id,
  factType: "placement",
  semanticType: placementKind(placement),
  position: { x: placement.x, y: placement.y },
  layer: placement.layer,
  tags: placement.tags ?? [],
  source: "world_state.homeMapState.placements",
}))
const includedEcology = (home.ecologyState?.facts ?? []).filter(isCurrentVisualEcologyFact).map((fact) => ({
  factId: fact.id,
  factType: "ecology",
  semanticType: fact.kind,
  status: fact.status,
  strength: fact.strength,
  tags: fact.tags ?? [],
  source: "world_state.homeMapState.ecologyState.facts",
}))
const includedConnectivity = buildConnectivityVisualFacts(home.worldConnectivity)

const excludedFacts = [
  ...(home.placements ?? []).filter((item) => !isCurrentVisualPlacement(item)).map((item) => excluded(item.id, "placement", exclusionReason(item))),
  ...(home.constructionPlans ?? []).map((item) => excluded(item.id, "construction_plan", "current_scope_forbids_butler_construction")),
  ...(home.ecologyState?.facts ?? []).filter((item) => !isCurrentVisualEcologyFact(item)).map((item) => excluded(item.id, "ecology", "current_scope_forbids_visible_animal_or_insect_content")),
  ...(worldState.recentEvents ?? []).map((item) => excluded(item.id, "runtime_event", "runtime_event_is_not_a_visual_nature_fact")),
]

const visualFacts = [
  { factId: worldState.worldId, factType: "world", semanticType: "world_identity", source: "world_state" },
  ...includedZones,
  ...includedPlacements,
  ...includedEcology,
  ...includedConnectivity,
]
const visualFactIds = [...new Set(visualFacts.map((fact) => fact.factId))]
const forbiddenFactIds = new Set(excludedFacts.map((fact) => fact.factId))
const forbiddenLeakIds = visualFactIds.filter((id) => forbiddenFactIds.has(id) || /butler|construction/i.test(id))

const structureBindings = {
  runtimeFrameId: runtimeFrame.runtimeFrameId,
  structureId: runtimeFrame.structureId,
  terrainRecords: runtimeFrame.layers.terrain.map((item) => ({ structureRecordId: item.sourceId, kind: item.kind, polygon: item.polygon })),
  pathRecords: runtimeFrame.layers.terrain.filter((item) => item.kind === "path_ground").map((item) => ({ structureRecordId: item.sourceId, kind: item.kind, polygon: item.polygon })),
  objectRecords: runtimeFrame.layers.objects.map((item) => ({ structureRecordId: item.sourceObjectId, kind: item.kind, position: item.position, footprint: item.footprint })),
  walkableRecords: runtimeFrame.layers.walkable,
  collisionRecords: runtimeFrame.layers.collision,
  connectivity: runtimeFrame.structure?.connectivity ?? home.worldConnectivity
    ? {
        contractId: home.worldConnectivity?.contractId ?? null,
        blueprintId: home.worldConnectivity?.blueprintId ?? null,
        regionId: home.worldConnectivity?.currentRegion?.regionId ?? null,
        activeEdgePortIds: home.worldConnectivity?.currentRegion?.edgePorts ?? [],
        pathGraphId: home.worldConnectivity?.pathGraph?.pathGraphId ?? null,
        hydrologyGraphId: home.worldConnectivity?.hydrologyGraph?.hydrologyGraphId ?? null,
        walkableGraphId: home.worldConnectivity?.walkableGraph?.walkableGraphId ?? null,
      }
    : null,
  note: "Structure records constrain placement and geometry; they are not reclassified as world source facts.",
}

const manifestId = `world-visual-facts-${worldState.worldId}-${worldState.tick}-${createdAt.replace(/[:.]/g, "-")}`
const manifest = {
  schemaVersion: "world-visual-fact-manifest-v1",
  manifestId,
  createdAt,
  createdAtAsiaShanghai: formatShanghai(createdAt),
  status: forbiddenLeakIds.length === 0 ? "visual_facts_filtered" : "blocked_forbidden_fact_leak",
  passed: forbiddenLeakIds.length === 0,
  worldId: worldState.worldId,
  ownerId: worldState.ownerId,
  tick: worldState.tick,
  worldProfileId: worldState.worldProfileId,
  earthParameterSnapshotId: worldState.earthParameterSnapshotId,
  scope: "single_complete_natural_home_map",
  source: {
    worldStatePath: projectPath(worldPointer.path),
    worldStateVersion: worldState.version,
    runtimeFramePath: ".runtime/game-map-runtime-frame/latest-runtime-frame.json",
    runtimeFrameId: runtimeFrame.runtimeFrameId,
  },
  worldSignals: {
    seed: home.seed ?? null,
    mapSize: home.mapSize ?? null,
    biomeType: home.ecologyState?.biomeType ?? home.resources?.resourcePoolState?.biomeType ?? null,
    ecologyStatus: home.ecologyState?.status ?? null,
    groundHealth: home.resources?.groundHealth ?? null,
    naturalGrowth: home.resources?.naturalGrowth ?? null,
    resourceTags: home.resources?.tags ?? [],
    currentTime: null,
    weather: null,
    missingSignals: ["currentTime", "weather"],
  },
  visualFacts,
  visualFactIds,
  excludedFacts,
  exclusionRules: [
    "exclude_actor_and_butler_placements",
    "exclude_butler_construction_plans",
    "exclude_runtime_events_as_visual_facts",
    "exclude_currently_forbidden_visible_animal_and_insect_content",
  ],
  forbiddenLeakIds,
  structureBindings,
  counts: {
    visualFacts: visualFacts.length,
    zones: includedZones.length,
    placements: includedPlacements.length,
    ecologyFacts: includedEcology.length,
    connectivityFacts: includedConnectivity.length,
    excludedFacts: excludedFacts.length,
    structureTerrainRecords: structureBindings.terrainRecords.length,
    structureObjectRecords: structureBindings.objectRecords.length,
  },
}

function buildConnectivityVisualFacts(connectivity) {
  if (!connectivity) return []
  return [
    {
      factId: connectivity.contractId,
      factType: "world_connectivity_contract",
      semanticType: "large_world_connectivity",
      source: "world_state.homeMapState.worldConnectivity",
    },
    {
      factId: connectivity.blueprintId,
      factType: "world_connectivity_blueprint",
      semanticType: "earth_reference_region_topology",
      source: "world_state.homeMapState.worldConnectivity",
    },
    {
      factId: connectivity.currentRegion.regionId,
      factType: "world_region",
      semanticType: connectivity.currentRegion.regionalLandscapeType,
      bounds: connectivity.currentRegion.localBounds,
      source: "world_state.homeMapState.worldConnectivity.currentRegion",
    },
    ...connectivity.neighborRegionStubs.map((neighbor) => ({
      factId: neighbor.regionId,
      factType: "neighbor_region",
      semanticType: neighbor.topologyRole,
      relativePosition: neighbor.relativePosition,
      generationStatus: neighbor.generationStatus,
      source: "world_state.homeMapState.worldConnectivity.neighborRegionStubs",
    })),
    ...connectivity.edgePorts
      .filter((port) => port.regionId === connectivity.currentRegion.regionId)
      .map((port) => ({
        factId: port.edgePortId,
        factType: "world_edge_port",
        semanticType: port.kind,
        boundarySide: port.boundarySide,
        boundaryPosition: port.boundaryPosition,
        direction: port.direction,
        width: port.width,
        role: port.role,
        source: "world_state.homeMapState.worldConnectivity.edgePorts",
      })),
    {
      factId: connectivity.pathGraph.pathGraphId,
      factType: "world_path_graph",
      semanticType: "walkable_region_connection",
      source: "world_state.homeMapState.worldConnectivity.pathGraph",
    },
    {
      factId: connectivity.hydrologyGraph.hydrologyGraphId,
      factType: "world_hydrology_graph",
      semanticType: connectivity.hydrologyGraph.flowAxis,
      source: "world_state.homeMapState.worldConnectivity.hydrologyGraph",
    },
    {
      factId: connectivity.walkableGraph.walkableGraphId,
      factType: "world_walkable_graph",
      semanticType: "connected_playable_region",
      source: "world_state.homeMapState.worldConnectivity.walkableGraph",
    },
  ]
}
manifest.manifestSha256 = crypto.createHash("sha256").update(JSON.stringify(manifest)).digest("hex")

const runDir = path.join(OUTPUT_ROOT, manifestId)
const manifestPath = path.join(runDir, "visual-fact-manifest.json")
writeJson(manifestPath, manifest)
writeJson(path.join(OUTPUT_ROOT, "latest.json"), {
  schemaVersion: "world-visual-fact-manifest-latest-v1",
  manifestId,
  createdAt,
  status: manifest.status,
  passed: manifest.passed,
  worldId: manifest.worldId,
  tick: manifest.tick,
  manifestSha256: manifest.manifestSha256,
  manifestPath: projectPath(manifestPath),
})

console.log(JSON.stringify({
  ok: manifest.passed,
  manifestId,
  status: manifest.status,
  visualFactCount: manifest.counts.visualFacts,
  excludedFactCount: manifest.counts.excludedFacts,
  forbiddenLeakIds,
  manifestPath: projectPath(manifestPath),
}, null, 2))
process.exit(manifest.passed ? 0 : 1)

function isCurrentVisualZone(zone) {
  const tags = zone.tags ?? []
  return !tags.some((tag) => /construction_plan|butler_construction_intent/.test(tag))
}

function isCurrentVisualPlacement(placement) {
  const tags = placement.tags ?? []
  if (placement.layer === "actor") return false
  if (tags.some((tag) => /butler|actor|not_world_nature_fact/.test(tag))) return false
  return placement.layer === "nature" || placement.layer === "surface-decoration"
}

function isCurrentVisualEcologyFact(fact) {
  return ["terrain", "plant", "resource", "climate"].includes(fact.kind) && !(fact.tags ?? []).includes("no_unplanned_actor_spawn")
}

function placementKind(placement) {
  const tags = placement.tags ?? []
  if (tags.includes("tree")) return "tree"
  if (tags.includes("bush")) return "shrub"
  if (tags.includes("surface_decoration")) return "surface_decoration"
  return placement.assetId ?? "natural_placement"
}

function exclusionReason(item) {
  const tags = item.tags ?? []
  if (item.layer === "actor" || tags.some((tag) => /butler|actor/.test(tag))) return "current_scope_forbids_actor_or_butler"
  if (item.layer === "atmosphere") return "atmosphere_marker_is_not_a_natural_object_fact"
  return "placement_not_in_current_natural_visual_scope"
}

function excluded(factId, factType, reason) {
  return { factId, factType, reason }
}

function readRequiredJson(filePath) {
  try { return JSON.parse(fs.readFileSync(path.resolve(ROOT, filePath), "utf8")) }
  catch { throw new Error(`required JSON missing or invalid: ${filePath}`) }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function projectPath(filePath) {
  const absolute = path.resolve(ROOT, filePath)
  const relative = path.relative(ROOT, absolute)
  return relative.startsWith("..") || path.isAbsolute(relative) ? absolute : relative.replace(/\\/g, "/")
}

function formatShanghai(iso) {
  return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00`
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
