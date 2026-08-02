import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const AUTHORIZATION_ID = "owner-authorized-thailand-rebuild64-failed8-rgb-replacements-20260801"
const CONTRACT_PATH = "data/ai-painter/system-governance/thailand-rebuild64-failed8-rgb-replacement-contract-v1.json"
const FINAL_REVIEW_PATH = ".runtime/ai-painter/thailand-rebuild64-machine-final-reviews/thailand-rebuild64-machine-final-review-2026-08-01T07-09-11-618Z/review-report.json"
const AUDIT_POINTER_PATH = ".runtime/ai-painter/earth-geospatial-v7-capacity-146-209-complete-framework-audits/latest.json"
const OUTPUT_ROOT = ".runtime/ai-painter/thailand-rebuild64-failed8-repair-packages"
const EXPECTED_SEQUENCES = ["23", "33", "39", "43", "45", "47", "49", "55"]

const authorizationPath = `.runtime/ai-painter/owner-action-requests/${AUTHORIZATION_ID}/request.json`
const authorization = readJson(authorizationPath)
assert(authorization.status === "owner_authorized_pending_execution", "failed8 authorization is not active")
assert(authorization.ownerDecision?.decision === "authorized", "failed8 authorization decision is invalid")
const contract = readJson(CONTRACT_PATH)
assert(contract.status === "active_owner_authorized", "failed8 contract is not active")
const review = readJson(FINAL_REVIEW_PATH)
const failed = review.records.filter((entry) => entry.machinePassed === false)
assert(sameJson(failed.map((entry) => entry.sequenceCode), EXPECTED_SEQUENCES), "failed8 sequence identity changed")
const auditPointer = readJson(AUDIT_POINTER_PATH)
const audit = readJson(auditPointer.runPath)
assert(audit.selectedPackages?.length === 64, "current64 condition audit is incomplete")

const timestamp = new Date().toISOString()
const runId = `thailand-rebuild64-failed8-repair-packages-${timestamp.replace(/[:.]/g, "-")}`
const runRoot = path.join(ROOT, OUTPUT_ROOT, runId)
const packages = []

for (const failure of failed) {
  const slotMatch = /v7-capacity-slot-(\d{3})/.exec(failure.recordId)
  assert(slotMatch, `${failure.recordId}: slot identity missing`)
  const slotId = `v7-capacity-slot-${slotMatch[1]}`
  const selected = audit.selectedPackages.find((entry) => entry.slotId === slotId)
  assert(selected, `${slotId}: current condition package missing`)
  const conditionRun = readJson(selected.manifestPath)
  const taskManifestPath = path.join(path.dirname(resolve(conditionRun.taskPath)), "task-manifest.json")
  const taskManifest = readJson(taskManifestPath)
  const blueprint = readJson(taskManifest.blueprintPath)
  const conditionPack = readJson(conditionRun.conditionPackPath)
  const route = conditionPack.channels.find((entry) => entry.id === "terrain_path_ground")
  const failedRecordPath = `data/world-samples/original-image-library/natural-home-v1/complete-maps/${failure.recordId}/record.json`
  const failedRecord = readJson(failedRecordPath)
  const machineReview = readJson(failedRecord.reviews.machineReviewPath)
  assert(machineReview.imageSha256 === failedRecord.originalImage.sha256, `${failure.recordId}: failure hash mismatch`)
  assert(sameJson(machineReview.issues.map((entry) => entry.code), failure.issueCodes), `${failure.recordId}: issue codes changed`)

  const authorizedBoundarySide = entranceSide(blueprint.geometry.entranceBounds)
  const forbiddenBoundarySides = ["north", "east", "south", "west"].filter((side) => side !== authorizedBoundarySide)
  const requiredRepairs = compileRepairs(failure.issueCodes, {
    authorizedBoundarySide,
    forbiddenBoundarySides,
    expectedNonZeroRatio: route.statistics.nonZeroRatio,
    themeArchitectureIdentity: blueprint.structuralIdentities.themeArchitectureIdentity,
    instanceDetailIdentity: blueprint.structuralIdentities.instanceDetailIdentity,
  })
  const repairPackage = {
    schemaVersion: "thailand-rebuild64-failed-rgb-repair-package-v1",
    repairPackageId: `thailand-rebuild64-${failure.sequenceCode}-${slotId}-repair-v1`,
    status: "ready_for_owner_authorized_single_replacement_generation",
    createdAtUtc: timestamp,
    createdAtAsiaShanghai: formatShanghai(timestamp),
    authorizationId: AUTHORIZATION_ID,
    contractPath: CONTRACT_PATH,
    sequenceCode: failure.sequenceCode,
    slotId,
    sourceFailedRecordId: failure.recordId,
    sourceFailedImageSha256: failedRecord.originalImage.sha256,
    sourceFailedRgbMayBeUsedAsGenerationReference: false,
    issueCodes: failure.issueCodes,
    currentCondition: {
      conditionId: conditionRun.conditionId,
      conditionRunManifestPath: selected.manifestPath,
      taskManifestPath: projectPath(taskManifestPath),
      conditionPackId: conditionPack.conditionPackId,
      conditionPackPath: conditionRun.conditionPackPath,
      conditionGuidePath: conditionRun.conditionGuidePath,
      themeArchitectureIdentity: blueprint.structuralIdentities.themeArchitectureIdentity,
      instanceDetailIdentity: blueprint.structuralIdentities.instanceDetailIdentity,
    },
    routeContract: {
      authorizedBoundarySide,
      entranceBounds: blueprint.geometry.entranceBounds,
      forbiddenBoundarySides,
      expectedNonZeroRatio: route.statistics.nonZeroRatio,
      routeChannelSha256: route.sha256,
      authorizedBoundaryContactRequired: true,
      allOtherBoundaryContactsForbidden: true,
    },
    requiredRepairs,
    retryReason: requiredRepairs.join(" "),
    generationInputBoundary: {
      onlyImageReferenceRole: "authoritative_semantic_condition_guide",
      historicalRgbReferencesAllowed: false,
      failedRgbReferenceAllowed: false,
      worldFactsMayChange: false,
      conditionGeometryMayChange: false,
      reviewThresholdsMayChange: false,
    },
    oneReplacementGenerationAuthorized: true,
    automaticSecondRetryAuthorized: false,
  }
  const packagePath = path.join(runRoot, "packages", `${failure.sequenceCode}-${slotId}.json`)
  writeJsonAtomic(packagePath, repairPackage)
  packages.push({
    sequenceCode: failure.sequenceCode,
    slotId,
    packagePath: projectPath(packagePath),
    packageSha256: sha256File(packagePath),
    conditionId: conditionRun.conditionId,
    issueCodes: failure.issueCodes,
  })
}

const report = {
  schemaVersion: "thailand-rebuild64-failed8-repair-package-batch-v1",
  runId,
  status: "all_eight_repair_packages_ready",
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  authorizationId: AUTHORIZATION_ID,
  contractPath: CONTRACT_PATH,
  sourceFinalReviewPath: FINAL_REVIEW_PATH,
  targetCount: packages.length,
  packages,
  imageGenerationStarted: false,
  gpuTrainingStarted: false,
}
const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "batch-report.json",
  record: report,
  latest: { targetCount: packages.length, authorizationId: AUTHORIZATION_ID },
})
appendAiPainterProgramEvent({
  action: "build_thailand_rebuild64_failed8_repair_packages",
  runId,
  kind: "step_completed",
  status: "success",
  title: "Thailand rebuild64 failed8 repair packages compiled",
  titleZh: "泰国新64组失败8张修复包已编译",
  detail: `packages=${packages.length}; oldFailedRgbReferences=0; imageGenerationStarted=false`,
  detailZh: `修复包=${packages.length}；旧失败RGB引用=0；尚未开始图像生成。`,
  script: "scripts/build-thailand-rebuild64-failed8-repair-packages.mjs",
  currentStep: "repair_packages_ready",
  evidencePath: stored.runPath,
})
console.log(JSON.stringify({ status: report.status, runId, reportPath: stored.runPath, packages }, null, 2))

function compileRepairs(issueCodes, context) {
  const repairs = []
  if (issueCodes.some((code) => ["historical_rejected_composition_duplicate", "complete_map_composition_diversity_failed"].includes(code))) {
    repairs.push(`Render the exact current guide skeleton identified by themeArchitectureIdentity=${context.themeArchitectureIdentity} and instanceDetailIdentity=${context.instanceDetailIdentity}; do not reuse, approximate or visually drift toward any prior map skeleton, central clearing, S-road template, repeated vegetation massing or historical composition.`)
  }
  if (issueCodes.includes("condition_terrain_path_ground_required_boundary_contact_missing")) {
    repairs.push(`The compacted-earth route must visibly intersect and cross the ${context.authorizedBoundarySide} canvas edge inside the guide-defined entrance bounds; keep the route continuous to that edge.`)
  }
  if (issueCodes.includes("condition_terrain_path_ground_coverage_mismatch")) {
    repairs.push(`Render the entire guide-defined terrain_path_ground footprint with continuous reddish-brown soil and stable shoulders; visual route coverage must stay close to expectedNonZeroRatio=${context.expectedNonZeroRatio}, with no grass-colored gaps or truncated segments.`)
  }
  if (issueCodes.includes("condition_terrain_path_ground_uncontracted_boundary_contact")) {
    repairs.push(`The route may contact only the authorized ${context.authorizedBoundarySide} edge; it must not touch ${context.forbiddenBoundarySides.join(", ")}. Close every unauthorized edge with ordinary in-world terrain and dense natural ecology, not route-colored pixels.`)
  }
  assert(repairs.length > 0, `unsupported issue codes: ${issueCodes.join(",")}`)
  return repairs
}
function entranceSide(bounds) {
  if (bounds.x === 0) return "west"
  if (bounds.y === 0) return "north"
  if (bounds.x + bounds.width === 1024) return "east"
  if (bounds.y + bounds.height === 768) return "south"
  throw new Error(`entrance bounds do not touch a canvas edge: ${JSON.stringify(bounds)}`)
}
function resolve(value) { return path.resolve(ROOT, value) }
function readJson(value) { return JSON.parse(fs.readFileSync(resolve(value), "utf8")) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
function assert(condition, message) { if (!condition) throw new Error(message) }
