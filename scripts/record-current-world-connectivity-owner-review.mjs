import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const POINTER_PATH = path.join(ROOT, "data", "world-runtime", "latest-world.json")
const CONTRACT_PATH = path.join(ROOT, "data", "world-samples", "world-connectivity", "world-connectivity-contract-v1.json")
const REVIEW_ROOT = path.join(ROOT, ".runtime", "world-connectivity-owner-reviews")
const decision = readArg("--decision")
const ownerCommand = readArg("--owner-command")

assert(decision === "approved", "only the explicitly authorized approved decision is supported")
assert(ownerCommand, "--owner-command is required")

const pointer = readJson(POINTER_PATH)
const sourcePath = path.resolve(pointer.path)
const source = readJson(sourcePath)
const connectivity = source.homeMapState?.worldConnectivity
assert(connectivity, "current world connectivity state is missing")

if (connectivity.status === "runtime_migrated_owner_approved") {
  console.log(JSON.stringify({
    ok: true,
    status: "connectivity_owner_review_already_recorded",
    worldId: source.worldId,
    tick: source.tick,
    reviewId: connectivity.ownerReview?.reviewId ?? null,
    reviewPath: connectivity.ownerReview?.reviewPath ?? null,
  }, null, 2))
  process.exit(0)
}

assert(connectivity.status === "runtime_migrated_pending_owner_review", "connectivity is not waiting for owner review")

const timestamp = new Date().toISOString()
const nextTick = Number(source.tick) + 1
const reviewId = `world-connectivity-owner-review-${source.worldId}-${timestamp.replace(/[:.]/g, "-")}`
const reviewDir = path.join(REVIEW_ROOT, reviewId)
const reviewPath = path.join(reviewDir, "owner-review.json")
const targetPath = path.join(ROOT, "data", "world-runtime", source.ownerId, source.worldId, "ticks", String(nextTick), "world-state.json")

const next = structuredClone(source)
next.tick = nextTick
next.savedAt = timestamp
next.homeMapState.updatedAt = Date.parse(timestamp)
next.homeMapState.worldConnectivity.status = "runtime_migrated_owner_approved"
next.homeMapState.worldConnectivity.walkableGraph.migrationStatus = "runtime_migrated_owner_approved"
next.homeMapState.worldConnectivity.ownerReview = {
  reviewId,
  decision: "approved",
  reviewedAtUtc: timestamp,
  reviewedAtAsiaShanghai: formatShanghai(timestamp),
  ownerCommand,
  reviewPath: projectPath(reviewPath),
}
next.homeMapState.worldConnectivity.tags = unique([
  ...(next.homeMapState.worldConnectivity.tags ?? []).filter((tag) => tag !== "pending_owner_review"),
  "owner_review_approved",
])
next.homeMapState.tags = unique([...(next.homeMapState.tags ?? []), "world_connectivity_owner_approved"])
next.recentEvents = [
  {
    id: `world-connectivity-owner-approved-${nextTick}`,
    tick: nextTick,
    title: "世界连接事实人工审核通过",
    body: "项目所有者确认第一版自然家园连接事实：北接上游河谷、南接下游洪泛地、东接对岸河岸，水流北入南出，道路从南侧连接，西侧保留自然边界。该审核不批准连接训练覆盖数量门槛。",
    source: "audit",
    createdAt: timestamp,
    tags: ["world_connectivity_owner_review", "approved", "automatic_storage"],
  },
  ...(next.recentEvents ?? []).slice(0, 49),
]
next.tags = unique([...(next.tags ?? []), "world_connectivity_owner_approved"])

fs.mkdirSync(reviewDir, { recursive: true })
writeJsonAtomic(path.join(reviewDir, "before-world-state.json"), source)
writeJsonAtomic(path.join(reviewDir, "proposed-world-state.json"), next)
writeJsonAtomic(targetPath, next)

const review = {
  schemaVersion: "world-connectivity-owner-review-v1",
  reviewId,
  status: "owner_approved",
  decision: "approved",
  decisionZh: "项目所有者审核通过",
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  ownerCommand,
  scope: "first_mvp_region_runtime_connectivity_facts_only",
  approvedFacts: {
    north: "upstream_river_valley",
    south: "downstream_floodplain",
    east: "opposite_bank_riparian",
    west: "natural_boundary",
    waterFlowAxis: "north_to_south",
    pathConnectionSide: "south",
  },
  approvedFactsZh: [
    "北接上游河谷",
    "南接下游洪泛地",
    "东接对岸河岸",
    "西侧保留自然边界",
    "水流北入南出",
    "道路从南侧连接",
  ],
  notApproved: [
    "minimum_positive_connectivity_sample_count",
    "minimum_negative_connectivity_sample_count",
    "long_term_complete_world_topology",
    "final_visual_output",
  ],
  worldId: source.worldId,
  sourceTick: source.tick,
  targetTick: nextTick,
  sourceWorldPath: projectPath(sourcePath),
  sourceWorldSha256: sha256File(sourcePath),
  targetWorldPath: projectPath(targetPath),
  targetWorldSha256: sha256File(targetPath),
  contractId: connectivity.contractId,
  blueprintId: connectivity.blueprintId,
  migrationId: connectivity.migration.migrationId,
  generatedImages: 0,
  alteredConnectivityGeometry: false,
  automaticStorage: true,
}
writeJsonAtomic(reviewPath, review)
writeJsonAtomic(path.join(REVIEW_ROOT, "latest.json"), { ...review, reviewPath: projectPath(reviewPath) })
appendJsonLine(path.join(ROOT, "data", "world-runtime", "migration-events.jsonl"), {
  schemaVersion: "world-runtime-migration-event-v1",
  action: "world_connectivity_owner_review_approved",
  reviewId,
  worldId: source.worldId,
  sourceTick: source.tick,
  targetTick: nextTick,
  reviewPath: projectPath(reviewPath),
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
})

writeJsonAtomic(POINTER_PATH, {
  ...pointer,
  tick: nextTick,
  path: targetPath,
  updatedAt: timestamp,
  connectivityOwnerReviewId: reviewId,
  connectivityOwnerReviewPath: projectPath(reviewPath),
  tags: unique([...(pointer.tags ?? []), "world_connectivity_owner_approved"]),
})

const contract = readJson(CONTRACT_PATH)
contract.status = "active_contract_first_mvp_runtime_owner_approved_pending_coverage"
contract.updatedAt = formatShanghai(timestamp)
contract.runtimeEvidence = {
  ...contract.runtimeEvidence,
  status: "runtime_migrated_owner_approved",
  ownerReviewId: reviewId,
  ownerReviewPath: projectPath(reviewPath),
  tick: nextTick,
}
writeJsonAtomic(CONTRACT_PATH, contract)

console.log(JSON.stringify({ ok: true, ...review, reviewPath: projectPath(reviewPath) }, null, 2))

function readArg(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] ?? null : null }
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function writeJsonAtomic(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); const temp = `${value}.${process.pid}.tmp`; fs.writeFileSync(temp, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.renameSync(temp, value) }
function appendJsonLine(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); fs.appendFileSync(value, `${JSON.stringify(body)}\n`, "utf8") }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function unique(values) { return Array.from(new Set(values)) }
function formatShanghai(iso) { return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00` }
function assert(condition, message) { if (!condition) throw new Error(message) }
