import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

const runtimeIndexPath = path.resolve(process.argv[2] ?? "data/world-runtime/latest-world.json")
const approvedRoot = path.resolve(process.argv[3] ?? "data/world-approved-frames")

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex")
}

function decodeDataImageUrl(imageUrl) {
  const match = /^data:image\/png;base64,(.+)$/i.exec(imageUrl)
  assert(match, "approved frame imageUrl must be a PNG data URL")
  return Buffer.from(match[1], "base64")
}

function buildSourceFactIds(saveRecord) {
  const homeMapState = saveRecord.homeMapState ?? {}
  const zones = Array.isArray(homeMapState.zones) ? homeMapState.zones : []
  const placements = Array.isArray(homeMapState.placements) ? homeMapState.placements : []
  const constructionPlans = Array.isArray(homeMapState.constructionPlans)
    ? homeMapState.constructionPlans
    : []
  const mapDiffs = Array.isArray(homeMapState.mapDiffs) ? homeMapState.mapDiffs : []
  const recentEvents = Array.isArray(saveRecord.recentEvents) ? saveRecord.recentEvents : []
  const connectivity = homeMapState.worldConnectivity ?? null

  return [
    saveRecord.worldId,
    ...zones.map((zone) => zone.id),
    ...placements.map((placement) => placement.id),
    ...constructionPlans.map((plan) => plan.id),
    ...mapDiffs.map((diff) => diff.id),
    ...recentEvents.map((event) => event.id),
    ...buildConnectivityFactIds(connectivity),
  ].filter((id) => typeof id === "string" && id.trim().length > 0)
}

function buildConnectivityFactIds(connectivity) {
  if (!connectivity) return []
  return [connectivity.contractId, connectivity.blueprintId, connectivity.currentRegion?.regionId,
    ...(connectivity.currentRegion?.neighborRegionIds ?? []), ...(connectivity.currentRegion?.edgePorts ?? []),
    connectivity.pathGraph?.pathGraphId, connectivity.hydrologyGraph?.hydrologyGraphId,
    connectivity.walkableGraph?.walkableGraphId]
}

function sameStringSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}

const runtimeIndex = readJson(runtimeIndexPath)
const runtimeSave = readJson(path.resolve(runtimeIndex.path))
const sourceFactIds = buildSourceFactIds(runtimeSave)
const approvedIndexPath = path.join(
  approvedRoot,
  runtimeSave.ownerId,
  runtimeSave.worldId,
  "latest-approved-frame.json",
)
const approvedIndex = readJson(approvedIndexPath)
const record = readJson(approvedIndex.path)
const frame = record.approvedFrame
const candidate = record.sourceCandidateRecord?.candidate
const condition = record.sourceCandidateRecord?.generationCondition
const request = record.sourceCandidateRecord?.aiImageGenerationRequest
const imageBytes = decodeDataImageUrl(frame.imageUrl)
const imageSha256 = sha256Buffer(imageBytes)

assert(record.version === "world-approved-frame-v1", "unexpected ApprovedFrame record version")
assert(record.ownerId === runtimeSave.ownerId, "ownerId does not match current runtime")
assert(record.worldId === runtimeSave.worldId, "worldId does not match current runtime")
assert(record.tick === runtimeSave.tick, "tick does not match current runtime")
assert(frame.frameId === `approved-frame-${record.worldId}-${record.tick}`, "frameId does not match current runtime")
assert(frame.worldId === record.worldId, "frame worldId mismatch")
assert(frame.tick === record.tick, "frame tick mismatch")
assert(record.canShowToPlayer === true, "ApprovedFrame record should be displayable in controlled MVP")
assert(frame.canShowToPlayer === true, "ApprovedFrame should be displayable in controlled MVP")
assert(frame.approvalScope === "approved_for_controlled_mvp", "approval scope mismatch")
assert(frame.productionApprovalStatus === "not_approved_for_production", "production status mismatch")
assert(frame.approvedForProduction === false, "production flag must be false")
assert(frame.vj0Status === "vj_0_passed", "frame VJ-0 must pass")
assert(frame.vj1Status === "vj_1_passed", "frame VJ-1 must pass")
assert(frame.vj2Status === "vj_2_not_implemented", "full VJ-2 must remain not implemented in controlled MVP protocol")
assert(record.reviewReport?.vj0Status === "vj_0_passed", "review VJ-0 must pass")
assert(record.reviewReport?.vj1Status === "vj_1_passed", "review VJ-1 must pass")
assert(record.reviewReport?.vj2Status === "vj_2_not_implemented", "review full VJ-2 status mismatch")
assert(
  record.reviewReport?.checks?.some((check) => check.id === "natural_home_vj2_minimal_evidence_bound" && check.passed === true),
  "minimal VJ-2 evidence must be bound",
)
assert(candidate?.sourceKind === "project_model_generated", "candidate must be project_model_generated")
assert(candidate?.canShowToPlayer === false, "source candidate must remain hidden")
assert(candidate?.worldId === record.worldId, "candidate worldId mismatch")
assert(candidate?.tick === record.tick, "candidate tick mismatch")
assert(condition?.worldId === record.worldId, "condition worldId mismatch")
assert(condition?.tick === record.tick, "condition tick mismatch")
assert(request?.condition?.conditionId === condition.conditionId, "request condition mismatch")
assert(sameStringSet(record.sourceFactIds, sourceFactIds), "record sourceFactIds mismatch current runtime")
assert(sameStringSet(frame.sourceFactIds, sourceFactIds), "frame sourceFactIds mismatch current runtime")
assert(sameStringSet(candidate.sourceFactIds, sourceFactIds), "candidate sourceFactIds mismatch current runtime")
assert(sameStringSet(condition.sourceFactIds, sourceFactIds), "condition sourceFactIds mismatch current runtime")
assert(frame.sourceImageSha256 === imageSha256, "image sha256 mismatch")
assert(frame.sourceImageByteLength === imageBytes.length, "image byte length mismatch")
assert(frame.sourceImageContentType === "image/png", "image content type mismatch")
assert(frame.sourceImagePayloadQualityPassed === true, "image payload quality must pass")
assert(approvedIndex.sourceImageSha256 === frame.sourceImageSha256, "index image sha mismatch")
assert(approvedIndex.path === path.resolve(approvedIndex.path), "approved index path should be absolute")

console.log(
  `Natural Home ApprovedFrame check passed: ${frame.frameId}, ${record.sourceFactIds.length} source facts, ${imageBytes.length} bytes.`,
)
