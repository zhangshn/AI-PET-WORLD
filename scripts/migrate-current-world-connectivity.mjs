import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const POINTER_PATH = path.join(ROOT, "data", "world-runtime", "latest-world.json")
const BLUEPRINT_LATEST_PATH = path.join(
  ROOT,
  "data",
  "world-samples",
  "world-connectivity",
  "blueprints",
  "latest.json",
)
const CONTRACT_PATH = path.join(
  ROOT,
  "data",
  "world-samples",
  "world-connectivity",
  "world-connectivity-contract-v1.json",
)
const MIGRATION_ROOT = path.join(ROOT, ".runtime", "world-connectivity-migrations")
const OWNER_AUTHORIZATION_REF =
  "conversation-owner-authorization-2026-07-13-world-connectivity-runtime-migration"

const pointer = readJson(POINTER_PATH)
const sourcePath = path.resolve(pointer.path)
const source = readJson(sourcePath)
const blueprintPointer = readJson(BLUEPRINT_LATEST_PATH)
const blueprintPath = path.resolve(ROOT, blueprintPointer.blueprintPath)
const blueprint = readJson(blueprintPath)

assert(source.worldId === blueprint.currentRegion.worldId, "blueprint worldId mismatch")
assert(source.worldProfileId === blueprint.worldProfileId, "blueprint world profile mismatch")
assert(source.homeMapState?.seed === blueprint.currentRegion.worldSeed, "blueprint world seed mismatch")
assert(blueprint.runtimeMigration?.status === "pending", "blueprint migration is not pending")

const existing = source.homeMapState?.worldConnectivity
if (existing?.blueprintId === blueprint.blueprintId) {
  updateContractRuntimeEvidence(existing)
  console.log(JSON.stringify({
    ok: true,
    status: "runtime_connectivity_already_migrated",
    worldId: source.worldId,
    tick: source.tick,
    blueprintId: existing.blueprintId,
    migrationId: existing.migration?.migrationId ?? null,
    reportPath: existing.migration?.reportPath ?? null,
  }, null, 2))
  process.exit(0)
}

const timestamp = new Date().toISOString()
const migrationId = `world-connectivity-migration-${source.worldId}-${timestamp.replace(/[:.]/g, "-")}`
const nextTick = Number(source.tick) + 1
const migratedRelativePath = path.join(
  "data",
  "world-runtime",
  source.ownerId,
  source.worldId,
  "ticks",
  String(nextTick),
  "world-state.json",
)
const migratedPath = path.join(ROOT, migratedRelativePath)
const migrationDir = path.join(MIGRATION_ROOT, migrationId)
const reportPath = path.join(migrationDir, "migration-report.json")
const sourceSha256 = sha256File(sourcePath)
const blueprintSha256 = canonicalBlueprintSha256(blueprint)

assert(
  blueprintPointer.blueprintSha256 === blueprintSha256,
  "blueprint pointer hash mismatch",
)

const worldConnectivity = buildRuntimeConnectivity({
  blueprint,
  blueprintPath,
  blueprintSha256,
  migrationId,
  sourceTick: source.tick,
  targetTick: nextTick,
  timestamp,
  reportPath,
})

const migrated = structuredClone(source)
migrated.tick = nextTick
migrated.savedAt = timestamp
migrated.homeMapState = {
  ...migrated.homeMapState,
  worldConnectivity,
  updatedAt: Date.parse(timestamp),
  tags: unique([
    ...(migrated.homeMapState?.tags ?? []),
    "world_connectivity_runtime_migrated",
    blueprint.blueprintId,
  ]),
}
migrated.recentEvents = [
  {
    id: `world-connectivity-migrated-${nextTick}`,
    tick: nextTick,
    title: "世界连接事实迁移完成",
    body: "当前自然家园已写入区域身份、三个邻居、四个当前区域连接口、南侧道路连接和北入南出的水文图；迁移结果等待项目所有者审核。",
    source: "runtime",
    createdAt: timestamp,
    tags: [
      "world_connectivity_runtime_migration",
      blueprint.blueprintId,
      "automatic_storage",
      "pending_owner_review",
    ],
  },
  ...(migrated.recentEvents ?? []).slice(0, 49),
]
migrated.tags = unique([
  ...(migrated.tags ?? []),
  "world_connectivity_runtime_migrated",
  blueprint.blueprintId,
])

const validation = validateMigratedWorld(migrated, blueprint)
assert(validation.ok, `connectivity migration validation failed: ${validation.failures.join(",")}`)

fs.mkdirSync(migrationDir, { recursive: true })
writeJsonAtomic(path.join(migrationDir, "source-pointer.json"), pointer)
writeJsonAtomic(path.join(migrationDir, "before-world-state.json"), source)
writeJsonAtomic(path.join(migrationDir, "proposed-world-state.json"), migrated)
writeJsonAtomic(migratedPath, migrated)
const targetSha256 = sha256File(migratedPath)

const report = {
  schemaVersion: "world-connectivity-migration-report-v1",
  migrationId,
  status: "runtime_migration_completed_pending_owner_review",
  passed: true,
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
  ownerId: migrated.ownerId,
  worldId: migrated.worldId,
  sourceTick: source.tick,
  targetTick: migrated.tick,
  sourceWorldPath: projectPath(sourcePath),
  sourceWorldSha256: sourceSha256,
  targetWorldPath: projectPath(migratedPath),
  targetWorldSha256: targetSha256,
  contractId: blueprint.contractId,
  blueprintId: blueprint.blueprintId,
  blueprintPath: projectPath(blueprintPath),
  blueprintSha256,
  currentRegionId: blueprint.currentRegion.regionId,
  neighborRegionCount: blueprint.neighborRegionStubs.length,
  currentRegionEdgePortCount: blueprint.currentRegion.edgePorts.length,
  pathGraphId: blueprint.pathGraph.pathGraphId,
  hydrologyGraphId: blueprint.hydrologyGraph.hydrologyGraphId,
  walkableGraphId: blueprint.walkableGraph.walkableGraphId,
  generatedImages: 0,
  alteredVisualApproval: false,
  historicalSourcePreserved: true,
  validation,
  automaticStorage: true,
}

writeJsonAtomic(reportPath, report)
writeJsonAtomic(path.join(MIGRATION_ROOT, "latest.json"), {
  ...report,
  reportPath: projectPath(reportPath),
})
appendJsonLine(path.join(ROOT, "data", "world-runtime", "migration-events.jsonl"), {
  schemaVersion: "world-runtime-migration-event-v1",
  action: "world_connectivity_runtime_migration_committed",
  migrationId,
  worldId: migrated.worldId,
  sourceTick: source.tick,
  targetTick: migrated.tick,
  contractId: blueprint.contractId,
  blueprintId: blueprint.blueprintId,
  reportPath: projectPath(reportPath),
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
})
writeJsonAtomic(POINTER_PATH, {
  ...pointer,
  version: migrated.version,
  ownerId: migrated.ownerId,
  worldId: migrated.worldId,
  tick: migrated.tick,
  worldProfileId: migrated.worldProfileId,
  path: migratedPath,
  updatedAt: timestamp,
  connectivityMigrationId: migrationId,
  connectivityMigrationReportPath: projectPath(reportPath),
  tags: unique([
    ...(pointer.tags ?? []),
    "world_connectivity_runtime_migrated",
    blueprint.blueprintId,
  ]),
})
updateContractRuntimeEvidence(worldConnectivity)

console.log(JSON.stringify({ ok: true, ...report, reportPath: projectPath(reportPath) }, null, 2))

function buildRuntimeConnectivity(input) {
  const currentRegionId = input.blueprint.currentRegion.regionId
  const edgePorts = input.blueprint.edgePorts.map((port) => ({
    ...port,
    state:
      port.regionId !== currentRegionId
        ? port.state
        : port.kind === "path"
          ? "active_runtime_migrated"
          : "active_runtime_bound",
  }))
  const pathGraph = structuredClone(input.blueprint.pathGraph)
  pathGraph.edges = pathGraph.edges.map((edge) => ({
    ...edge,
    status: edge.status === "planned_runtime_migration" ? "active_runtime_migrated" : edge.status,
  }))

  return {
    schemaVersion: "world-connectivity-runtime-state-v1",
    contractId: input.blueprint.contractId,
    blueprintId: input.blueprint.blueprintId,
    blueprintPath: projectPath(input.blueprintPath),
    blueprintSha256: input.blueprintSha256,
    status: "runtime_migrated_pending_owner_review",
    currentRegion: structuredClone(input.blueprint.currentRegion),
    neighborRegionStubs: structuredClone(input.blueprint.neighborRegionStubs),
    edgePorts,
    pathGraph,
    hydrologyGraph: structuredClone(input.blueprint.hydrologyGraph),
    walkableGraph: {
      ...structuredClone(input.blueprint.walkableGraph),
      migrationStatus: "runtime_migrated_pending_owner_review",
    },
    migration: {
      migrationId: input.migrationId,
      sourceTick: input.sourceTick,
      targetTick: input.targetTick,
      migratedAtUtc: input.timestamp,
      migratedAtAsiaShanghai: formatShanghai(input.timestamp),
      ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
      reportPath: projectPath(input.reportPath),
    },
    tags: [
      "class_earth_world_connectivity",
      "runtime_world_fact",
      "automatic_storage",
      "pending_owner_review",
    ],
  }
}

function validateMigratedWorld(world, expectedBlueprint) {
  const failures = []
  const connectivity = world.homeMapState?.worldConnectivity
  check(connectivity?.contractId === expectedBlueprint.contractId, failures, "contract_id_mismatch")
  check(connectivity?.blueprintId === expectedBlueprint.blueprintId, failures, "blueprint_id_mismatch")
  check(connectivity?.currentRegion?.regionId === expectedBlueprint.currentRegion.regionId, failures, "region_id_mismatch")
  check(connectivity?.neighborRegionStubs?.length === 3, failures, "neighbor_stub_count_invalid")
  check(connectivity?.currentRegion?.edgePorts?.length === 4, failures, "current_edge_port_count_invalid")
  check(connectivity?.pathGraph?.crossesWater === false, failures, "path_crosses_water")
  check(connectivity?.hydrologyGraph?.flowAxis === "north_to_south", failures, "hydrology_axis_invalid")
  check(connectivity?.walkableGraph?.migrationStatus === "runtime_migrated_pending_owner_review", failures, "walkable_migration_status_invalid")
  const southPathPort = connectivity?.edgePorts?.find((port) =>
    port.edgePortId.endsWith(":port:south-path-exit") && port.regionId === expectedBlueprint.currentRegion.regionId
  )
  check(southPathPort?.boundaryPosition?.x === 96 && southPathPort?.boundaryPosition?.y === 768, failures, "south_path_port_invalid")
  const pathEdge = connectivity?.pathGraph?.edges?.find((edge) =>
    edge.target === southPathPort?.edgePortId
  )
  check(pathEdge?.status === "active_runtime_migrated", failures, "south_path_edge_not_active")
  check((pathEdge?.coordinates ?? []).some((point) => point.x === 96 && point.y === 768), failures, "south_path_boundary_coordinate_missing")
  return {
    ok: failures.length === 0,
    failures,
    checks: [
      "region_identity_bound",
      "three_neighbor_stubs_bound",
      "four_current_edge_ports_bound",
      "south_path_extension_bound",
      "north_to_south_hydrology_bound",
      "walkable_revalidation_marked",
    ],
  }
}

function updateContractRuntimeEvidence(connectivity) {
  const contract = readJson(CONTRACT_PATH)
  const ownerApproved = connectivity.status === "runtime_migrated_owner_approved"
  contract.status = ownerApproved
    ? "active_contract_first_mvp_runtime_owner_approved_pending_coverage"
    : "active_contract_first_mvp_runtime_migrated_pending_owner_review_and_coverage"
  contract.updatedAt = ownerApproved
    ? connectivity.ownerReview?.reviewedAtAsiaShanghai ?? contract.updatedAt
    : connectivity.migration.migratedAtAsiaShanghai
  contract.scope = {
    ...contract.scope,
    firstMvpRegionRuntimeMigrated: true,
  }
  contract.runtimeEvidence = {
    status: connectivity.status,
    migrationId: connectivity.migration.migrationId,
    reportPath: connectivity.migration.reportPath,
    worldId: source.worldId,
    tick: connectivity.migration.targetTick,
    blueprintId: connectivity.blueprintId,
    automaticStorage: true,
    ...(ownerApproved
      ? {
          ownerReviewId: connectivity.ownerReview?.reviewId,
          ownerReviewPath: connectivity.ownerReview?.reviewPath,
          tick: source.tick,
        }
      : {}),
  }
  writeJsonAtomic(CONTRACT_PATH, contract)
}

function check(condition, failures, code) { if (!condition) failures.push(code) }
function unique(values) { return Array.from(new Set(values)) }
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function writeJsonAtomic(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); const temp = `${value}.${process.pid}.tmp`; fs.writeFileSync(temp, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.renameSync(temp, value) }
function appendJsonLine(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); fs.appendFileSync(value, `${JSON.stringify(body)}\n`, "utf8") }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function canonicalBlueprintSha256(value) { const copy = structuredClone(value); delete copy.blueprintSha256; return crypto.createHash("sha256").update(JSON.stringify(copy)).digest("hex") }
function formatShanghai(iso) { return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00` }
function assert(condition, message) { if (!condition) throw new Error(message) }
