import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const POINTER_PATH = path.join(ROOT, "data", "world-runtime", "latest-world.json")
const PROFILE_PATH = path.join(ROOT, "data", "world-samples", "original-image-library", "natural-home-v1", "mainland-southeast-asia-tropical-monsoon-profile-v1.json")
const SNAPSHOT_PATH = path.join(ROOT, "data", "world-samples", "original-image-library", "natural-home-v1", "earth-parameter-snapshots", "mainland-southeast-asia-reference-v1", "manifest.json")
const MIGRATION_ROOT = path.join(ROOT, ".runtime", "world-profile-migrations")

const sourcePointer = readJson(POINTER_PATH)
const sourcePath = path.resolve(sourcePointer.path)
assert(fs.existsSync(sourcePath), "current world save is missing")
const source = readJson(sourcePath)
const profile = readJson(PROFILE_PATH)
const earthSnapshot = readJson(SNAPSHOT_PATH)
const timestamp = new Date().toISOString()
const migrationId = `world-profile-migration-${source.worldId}-${timestamp.replace(/[:.]/g, "-")}`
const nextTick = Number(source.tick) + 1
const migratedRelativePath = path.join("data", "world-runtime", source.ownerId, source.worldId, "ticks", String(nextTick), "world-state.json")
const migratedPath = path.join(ROOT, migratedRelativePath)
const migrationDir = path.join(MIGRATION_ROOT, migrationId)

assert(profile.worldProfileId === "mainland-southeast-asia-tropical-monsoon-natural-home-v1", "unexpected current world profile")
assert(earthSnapshot.worldProfileId === profile.worldProfileId, "earth parameter snapshot profile mismatch")

const migrated = replaceLegacyProfileStrings(structuredClone(source))
Object.assign(migrated, {
  worldId: source.worldId,
  ownerId: source.ownerId,
  tick: nextTick,
  savedAt: timestamp,
  worldProfileId: profile.worldProfileId,
  worldProfileVersion: profile.schemaVersion ?? "mainland-southeast-asia-tropical-monsoon-profile-v1",
  worldProfilePath: projectPath(PROFILE_PATH),
  earthParameterSnapshotId: earthSnapshot.snapshotId,
  earthParameterSnapshotPath: projectPath(SNAPSHOT_PATH),
  profileMigration: {
    migrationId,
    sourceTick: source.tick,
    targetTick: nextTick,
    sourceWorldPath: projectPath(sourcePath),
    targetWorldPath: projectPath(migratedPath),
    sourceWorldSha256: sha256File(sourcePath),
    targetWorldProfileId: profile.worldProfileId,
    createdAtUtc: timestamp,
    createdAtAsiaShanghai: formatShanghai(timestamp),
    ownerAuthorizationRef: "conversation-owner-authorization-2026-07-13-world-profile-migration",
    preservesHistoricalSource: true,
  },
  homeMapState: buildHomeMapState(source.worldId, source.ownerId, timestamp, profile.worldProfileId),
  recentEvents: [
    {
      id: `world-profile-migrated-${nextTick}`,
      tick: nextTick,
      title: "世界生态档案迁移完成",
      body: "当前MVP世界事实已迁移到东南亚大陆热带季风自然家园档案；旧世界快照仅保留为历史证据。",
      source: "runtime",
      createdAt: timestamp,
      tags: ["world_profile_migration", profile.worldProfileId, "automatic_storage"],
    },
  ],
  recentActionSignatures: [],
  lastRuntimeAction: null,
  lastButlerRuntimeDecision: null,
  lastButlerRuntimeIntent: null,
  lastButlerWorldRuleValidation: null,
  lastButlerRuntimeAuditSummary: null,
  recentMotivationTypes: [],
  tags: ["world_runtime_save", "mvp_world_profile_migrated", profile.worldProfileId, "class_earth_world", "automatic_storage"],
})

const validation = validateMigratedWorld(migrated, sourcePath)
assert(validation.ok, `migration validation failed: ${validation.failures.join(",")}`)

fs.mkdirSync(migrationDir, { recursive: true })
writeJsonAtomic(path.join(migrationDir, "source-pointer.json"), sourcePointer)
writeJsonAtomic(path.join(migrationDir, "proposed-world-state.json"), migrated)
writeJsonAtomic(migratedPath, migrated)
const targetSha256 = sha256File(migratedPath)
const report = {
  schemaVersion: "world-profile-migration-report-v1",
  migrationId,
  status: "migration_committed",
  passed: true,
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  ownerAuthorizationRef: migrated.profileMigration.ownerAuthorizationRef,
  ownerId: migrated.ownerId,
  worldId: migrated.worldId,
  sourceTick: source.tick,
  targetTick: migrated.tick,
  sourceWorldPath: projectPath(sourcePath),
  sourceWorldSha256: migrated.profileMigration.sourceWorldSha256,
  targetWorldPath: projectPath(migratedPath),
  targetWorldSha256: targetSha256,
  targetWorldProfileId: migrated.worldProfileId,
  earthParameterSnapshotId: migrated.earthParameterSnapshotId,
  historicalSourcePreserved: true,
  validation,
  automaticStorage: true,
}
const reportPath = path.join(migrationDir, "migration-report.json")
writeJsonAtomic(reportPath, report)
writeJsonAtomic(path.join(MIGRATION_ROOT, "latest.json"), { ...report, reportPath: projectPath(reportPath) })
appendJsonLine(path.join(ROOT, "data", "world-runtime", "migration-events.jsonl"), {
  schemaVersion: "world-runtime-migration-event-v1",
  action: "world_profile_migration_committed",
  migrationId,
  worldId: migrated.worldId,
  sourceTick: source.tick,
  targetTick: migrated.tick,
  targetWorldProfileId: migrated.worldProfileId,
  reportPath: projectPath(reportPath),
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
})
writeJsonAtomic(POINTER_PATH, {
  version: migrated.version,
  ownerId: migrated.ownerId,
  worldId: migrated.worldId,
  tick: migrated.tick,
  worldProfileId: migrated.worldProfileId,
  path: migratedPath,
  updatedAt: timestamp,
  migrationId,
  migrationReportPath: projectPath(reportPath),
  tags: ["world_runtime_latest_index", "profile_migrated", migrated.worldProfileId],
})

console.log(JSON.stringify({ ok: true, ...report, reportPath: projectPath(reportPath) }, null, 2))

function buildHomeMapState(worldId, ownerId, iso, profileId) {
  const now = Date.parse(iso)
  const placements = [
    placement("tree-dipterocarp-northwest-01", "natureTreeSmall01", 6, 5, "nature", "龙脑香科常绿乔木", ["tree", "dipterocarp", "tropical_evergreen_forest"]),
    placement("tree-dipterocarp-northwest-02", "natureTreeSmall01", 10, 7, "nature", "龙脑香科常绿乔木", ["tree", "dipterocarp", "tropical_evergreen_forest"]),
    placement("tree-riverine-north-01", "natureTreeSmall01", 22, 5, "nature", "河岸常绿乔木", ["tree", "riverine_forest"]),
    placement("tree-riverine-east-01", "natureTreeSmall01", 54, 10, "nature", "河岸常绿乔木", ["tree", "riverine_forest"]),
    placement("tree-boundary-west-01", "natureTreeSmall01", 4, 20, "nature", "热带季风林边界树", ["tree", "natural_boundary"]),
    placement("tree-boundary-west-02", "natureTreeSmall01", 5, 29, "nature", "热带季风林边界树", ["tree", "natural_boundary"]),
    placement("tree-boundary-south-01", "natureTreeSmall01", 18, 43, "nature", "热带季风林边界树", ["tree", "natural_boundary"]),
    placement("tree-boundary-south-02", "natureTreeSmall01", 44, 43, "nature", "热带季风林边界树", ["tree", "natural_boundary"]),
    placement("shrub-bamboo-grove-01", "natureBushRoundLow01", 45, 13, "nature", "竹林下层植被", ["bush", "bamboo_grove", "tropical_understory"]),
    placement("shrub-bamboo-grove-02", "natureBushRoundLow01", 48, 15, "nature", "竹林下层植被", ["bush", "bamboo_grove", "tropical_understory"]),
    placement("shrub-riverbank-01", "natureBushSmall01", 51, 27, "nature", "河岸灌木", ["bush", "riverbank", "wet_edge"]),
    placement("shrub-clearing-edge-01", "natureBushSmall01", 25, 18, "nature", "林缘灌木", ["bush", "forest_edge"]),
    placement("stone-riverbank-01", "surfaceStoneSmall01", 53, 31, "surface-decoration", "河岸自然石", ["surface_decoration", "stone", "riverbank"]),
    placement("stone-clearing-01", "surfaceStoneSmall01", 31, 24, "surface-decoration", "林间自然石", ["surface_decoration", "stone", "grounded_object"]),
    placement("flower-clearing-01", "surfaceFlowerPatch01", 28, 27, "surface-decoration", "热带林缘花草", ["surface_decoration", "flower", "clearing_edge"]),
    placement("flower-riverbank-01", "surfaceFlowerPatch01", 49, 25, "surface-decoration", "河岸花草", ["surface_decoration", "flower", "riverbank"]),
    placement("grass-wetland-01", "surfaceGrassTuftLow01", 50, 34, "surface-decoration", "湿地草丛", ["surface_decoration", "grass", "freshwater_wetland"]),
    placement("grass-meadow-01", "surfaceGrassTuft01", 20, 25, "surface-decoration", "季风草地", ["surface_decoration", "grass", "monsoon_meadow"]),
  ]
  return {
    worldId,
    ownerId,
    seed: `${worldId}:mainland-southeast-asia-tropical-monsoon:mvp-v1`,
    mapSize: { columns: 64, rows: 48, tileSize: 16 },
    zones: [
      { id: "visual-center-area", type: "visual_center", name: "自然家园中心开阔地", purpose: "入口主路的视觉与游戏组织中心", bounds: { x: 25, y: 20, width: 15, height: 12 }, tags: ["world_nature_fact", "visual_center", profileId] },
      { id: "entry-area", type: "entry_area", name: "西南入口", purpose: "连接完整地图主路的正式入口", bounds: { x: 4, y: 39, width: 8, height: 7 }, tags: ["world_nature_fact", "entry_area", profileId] },
      { id: "natural-boundary-area", type: "natural_boundary", name: "热带季风林自然边界", purpose: "以林缘、河岸和低丘形成可读边界", bounds: { x: 0, y: 0, width: 64, height: 48 }, tags: ["world_nature_fact", "natural_boundary", profileId] },
    ],
    placements,
    resources: {
      groundHealth: 84,
      naturalGrowth: 78,
      materialReadiness: 42,
      careReadiness: 60,
      spacePressure: 24,
      tags: ["world_fact", "tropical_monsoon_lowland", "wet_season_post_rain", profileId],
    },
    ecologyState: {
      biomeType: "tropical_monsoon_lowland_foothill_natural_home",
      status: "stable",
      facts: [
        ecologyFact("terrain-foundation", "terrain", "热带季风低地与河谷", 86, ["terrain", "world_fact", profileId]),
        ecologyFact("plant-growth", "plant", "湿润季风植被生长", 82, ["plant", "world_fact", "tropical_evergreen_forest"]),
        ecologyFact("freshwater-hydrology", "resource", "连续淡水河流与湿地水文", 80, ["freshwater", "world_fact", "continuous_shoreline"]),
        ecologyFact("micro-climate", "climate", "雨季雨后湿热微气候", 76, ["climate", "world_fact", "wet_season_post_rain"]),
      ],
      generatedAt: now,
      tags: ["world_ecology_state", "readonly_world_fact_projection", profileId],
    },
    constructionPlans: [],
    mapDiffs: [],
    createdAt: now,
    updatedAt: now,
    tags: ["runtime_initial_home", "world_nature_initial_state", "no_character", "no_animal", "no_building", profileId],
  }
}

function placement(id, assetId, x, y, layer, label, tags) { return { id, assetId, x, y, layer, scale: 1, alpha: 1, label, source: "placement_engine", tags: ["world_nature_fact", ...tags] } }
function ecologyFact(id, kind, label, strength, tags) { return { id, kind, label, status: "stable", strength, reason: "Derived from the authorized MVP world profile and versioned Earth parameter snapshot.", tags } }
function replaceLegacyProfileStrings(value) {
  if (typeof value === "string") return value.replace(/oasis/gi, "tropical_monsoon")
  if (Array.isArray(value)) return value.map(replaceLegacyProfileStrings)
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceLegacyProfileStrings(item)]))
  return value
}
function validateMigratedWorld(value, historicalPath) {
  const serialized = JSON.stringify(value)
  const failures = []
  check(value.worldProfileId === profile.worldProfileId, failures, "world_profile_mismatch")
  check(value.homeMapState?.ecologyState?.biomeType === "tropical_monsoon_lowland_foothill_natural_home", failures, "biome_mismatch")
  check(!/oasis/i.test(serialized), failures, "legacy_oasis_token_present")
  check((value.homeMapState?.constructionPlans ?? []).length === 0, failures, "construction_plan_present")
  check(!(value.homeMapState?.placements ?? []).some((item) => item.layer === "actor" || /butler|animal|building/i.test(`${item.id}:${item.tags?.join(":")}`)), failures, "forbidden_visible_fact_present")
  check(fs.existsSync(historicalPath), failures, "historical_source_missing")
  return { ok: failures.length === 0, failures, checks: ["profile_bound", "biome_bound", "legacy_token_removed", "construction_excluded", "visible_scope_clean", "history_preserved"] }
}
function check(condition, failures, code) { if (!condition) failures.push(code) }
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function writeJsonAtomic(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); const temp = `${value}.${process.pid}.tmp`; fs.writeFileSync(temp, `${JSON.stringify(body, null, 2)}\n`); fs.renameSync(temp, value) }
function appendJsonLine(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); fs.appendFileSync(value, `${JSON.stringify(body)}\n`) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function formatShanghai(iso) { return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00` }
function assert(condition, message) { if (!condition) throw new Error(message) }
