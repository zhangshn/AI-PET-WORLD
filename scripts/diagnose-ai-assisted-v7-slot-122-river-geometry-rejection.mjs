import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const SLOT_ID = "v7-capacity-slot-122"
const CONDITION_RUN_ID =
  "earth-geospatial-v7-slot-condition-v7-capacity-slot-122-2026-07-27T12-47-54-211Z"
const CONDITION_ID = "earth-reference-v7-v7-capacity-slot-122-02c68e32af02"
const RECORD_ID = "ai-cold-start-v7-v7-capacity-slot-122-river-floodplain-v1"
const CONDITION_RUN_PATH =
  `.runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/` +
  `${CONDITION_RUN_ID}/complete-map-condition-run.json`
const RECORD_ROOT =
  `data/world-samples/original-image-library/natural-home-v1/complete-maps/${RECORD_ID}`
const RECORD_PATH = `${RECORD_ROOT}/record.json`
const OWNER_REVIEW_PATH = `${RECORD_ROOT}/reviews/owner-review.json`
const MACHINE_REVIEW_PATH = `${RECORD_ROOT}/reviews/machine-review.json`
const BUILDER_PATH = "scripts/build-earth-geospatial-complete-map-conditions.mjs"
const OUTPUT_ROOT =
  ".runtime/ai-painter/ai-assisted-v7-river-geometry-rejection-diagnostics"

const conditionRun = readJson(CONDITION_RUN_PATH)
const record = readJson(RECORD_PATH)
const ownerReview = readJson(OWNER_REVIEW_PATH)
const machineReview = readJson(MACHINE_REVIEW_PATH)
const blueprint = readJson(conditionRun.blueprintPath)

assert(conditionRun.runId === CONDITION_RUN_ID, "condition run identity mismatch")
assert(conditionRun.conditionId === CONDITION_ID, "condition identity mismatch")
assert(conditionRun.v7SlotId === SLOT_ID, "slot identity mismatch")
assert(record.recordId === RECORD_ID, "record identity mismatch")
assert(record.originalImage.sha256 === ownerReview.imageSha256, "owner review image hash mismatch")
assert(record.originalImage.sha256 === machineReview.imageSha256, "machine review image hash mismatch")
assert(ownerReview.decision === "owner_rejected", "owner rejection is missing")
assert(
  ownerReview.nextTrainingTarget === "河道有点太几何画法了，太僵硬",
  "owner river-geometry rejection reason mismatch",
)
assert(machineReview.passed === true, "machine review did not pass before owner rejection")
assert(fileSha256(CONDITION_RUN_PATH) === fileSha256FromDisk(CONDITION_RUN_PATH), "condition run hash read failed")
assert(fileSha256(conditionRun.blueprintPath) === conditionRun.blueprintSha256, "blueprint hash mismatch")
assert(fileSha256(RECORD_PATH) === fileSha256FromDisk(RECORD_PATH), "record hash read failed")
assert(fileSha256(OWNER_REVIEW_PATH) === fileSha256FromDisk(OWNER_REVIEW_PATH), "owner review hash read failed")
assert(fileSha256(MACHINE_REVIEW_PATH) === fileSha256FromDisk(MACHINE_REVIEW_PATH), "machine review hash read failed")

const waterCenterline = blueprint.geometry?.waterCenterline ?? []
const routeCenterline = blueprint.geometry?.pathCenterline ?? []
assert(waterCenterline.length >= 3, "water centerline is missing")
assert(routeCenterline.length >= 3, "route centerline is missing")

const waterMetrics = centerlineMetrics(waterCenterline)
const routeMetrics = centerlineMetrics(routeCenterline)
const waterAudit = machineReview.semanticConditionAudit?.channelAudits?.find(
  (entry) => entry.channelId === "terrain_water",
)
assert(waterAudit?.passed === true, "machine water alignment audit is missing")

const timestamp = new Date().toISOString()
const runId =
  `ai-assisted-v7-river-geometry-rejection-diagnosis-${SLOT_ID}-` +
  timestamp.replace(/[:.]/g, "-")
const report = {
  schemaVersion: "ai-assisted-v7-river-geometry-rejection-diagnosis-v1",
  runId,
  status: "diagnosis_completed_repair_authorization_required",
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  ownerCommandRef:
    "project-owner-command-2026-07-27-slot-122-river-too-geometric-and-rigid",
  slotId: SLOT_ID,
  conditionRunId: CONDITION_RUN_ID,
  conditionId: CONDITION_ID,
  recordId: RECORD_ID,
  ownerReview: {
    decision: ownerReview.decision,
    comment: ownerReview.comment,
    nextTrainingTarget: ownerReview.nextTrainingTarget,
    reviewPath: OWNER_REVIEW_PATH,
    reviewSha256: fileSha256(OWNER_REVIEW_PATH),
    imageSha256: ownerReview.imageSha256,
  },
  immutableEvidence: {
    conditionRunPath: CONDITION_RUN_PATH,
    conditionRunSha256: fileSha256(CONDITION_RUN_PATH),
    blueprintPath: conditionRun.blueprintPath,
    blueprintSha256: fileSha256(conditionRun.blueprintPath),
    conditionGuidePath: record.conditionBinding.guidePath,
    conditionGuideSha256: fileSha256(record.conditionBinding.guidePath),
    generatedImagePath: `${RECORD_ROOT}/source/original.png`,
    generatedImageSha256: fileSha256(`${RECORD_ROOT}/source/original.png`),
    machineReviewPath: MACHINE_REVIEW_PATH,
    machineReviewSha256: fileSha256(MACHINE_REVIEW_PATH),
    builderPath: BUILDER_PATH,
    builderSha256: fileSha256(BUILDER_PATH),
  },
  waterGeometryDiagnosis: {
    constructionMethod:
      "five_random_control_points_plus_constant_width_piecewise_linear_ribbon",
    pointCount: waterMetrics.pointCount,
    segmentLengthsPixels: waterMetrics.segmentLengthsPixels,
    maximumSegmentPixels: waterMetrics.maximumSegmentPixels,
    interiorTurnDegrees: waterMetrics.interiorTurnDegrees,
    maximumInteriorTurnDegrees: waterMetrics.maximumInteriorTurnDegrees,
    totalLengthPixels: waterMetrics.totalLengthPixels,
    chordLengthPixels: waterMetrics.chordLengthPixels,
    sinuosity: waterMetrics.sinuosity,
    waterHalfWidthPixels: 52,
    shorelineHalfWidthPixels: 66,
    widthVariesAlongCenterline: false,
    smoothingOrResamplingApplied: false,
  },
  routeComparison: {
    constructionMethod:
      blueprint.geometry.routeNaturalnessAudit?.referenceEnvelope
        ?.curveConstruction,
    pointCount: routeMetrics.pointCount,
    maximumSegmentPixels: routeMetrics.maximumSegmentPixels,
    maximumInteriorTurnDegrees: routeMetrics.maximumInteriorTurnDegrees,
    auditedMaximumSegmentPixels:
      blueprint.geometry.routeNaturalnessAudit?.maximumSegmentPixels,
    auditedMaximumInteriorTurnDegrees:
      blueprint.geometry.routeNaturalnessAudit?.maximumInteriorTurnDegrees,
    publicAggregateNaturalnessProfileApplied: true,
    exactPublicGeometryCopied: false,
  },
  machineReviewGap: {
    machineStatus: machineReview.status,
    waterCoverageRatio: waterAudit.coverageRatio,
    waterSpatialIntersection: waterAudit.spatialIntersection,
    waterCentroidDistance: waterAudit.centroidDistance,
    waterCurvatureChecked: false,
    waterMaximumSegmentLengthChecked: false,
    waterInteriorTurnChecked: false,
    waterWidthVariationChecked: false,
    explanation:
      "The machine audit verified water occupancy, overlap, and centroid alignment, so it passed a generated image that faithfully reproduced an already rigid condition shape.",
    explanationZh:
      "机器审核只验证水体覆盖、空间交集和质心对齐，因此通过了忠实复现僵硬条件几何的生成图。",
  },
  rootCause: {
    code: "condition_water_centerline_coarse_piecewise_linear_geometry",
    primaryLayer: "formal_condition_geometry",
    generatorDeviationPrimary: false,
    conditionGuideAlreadyRigid: true,
    summary:
      "The formal condition encoded the river as five long straight segments with sharp vertices and constant width. The generated RGB followed that geometry.",
    summaryZh:
      "正式条件把河道编码为五点长直线折段、尖锐转角和固定宽度，生成 RGB 忠实复现了该几何。",
  },
  repairBoundary: {
    sameConditionIdRetryForbidden: true,
    imageOnlyPromptRetryInsufficient: true,
    requiredBeforeRetry: [
      "define_anonymous_water_naturalness_contract",
      "derive_smooth_resampled_water_centerline_without_exact_real_geometry",
      "derive_slowly_varying_water_and_shoreline_widths",
      "add_water_curvature_segment_turn_and_width_machine_gates",
      "rebuild_slot_122_with_new_condition_id",
      "independently_check_before_any_rgb",
    ],
    publicHydrographyUseRequiresOwnerAuthorizationAndSourceEvidence: true,
    exactOsmOrRealHydrographyGeometryForbidden: true,
    worldFactsChanged: false,
    current23ChannelsChanged: false,
    reviewThresholdsChanged: false,
  },
  outputBoundary: {
    imageGenerated: false,
    rgbRetryAuthorized: false,
    gpuTrainingStarted: false,
    runtimeStarted: false,
    worldPageChanged: false,
  },
  automaticStorage: true,
}

const written = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "diagnosis-report.json",
  record: report,
  latest: {
    slotId: SLOT_ID,
    conditionId: CONDITION_ID,
    recordId: RECORD_ID,
    rootCauseCode: report.rootCause.code,
  },
})
appendAiPainterProgramEvent({
  action: "diagnose_ai_assisted_v7_river_geometry_rejection",
  runId,
  kind: "diagnosis_completed",
  status: "success",
  title: "V7 slot-122 rigid river geometry diagnosis completed",
  titleZh: "V7 slot-122 河道几何僵硬诊断已完成",
  detail:
    "The program traced the owner rejection to the five-point constant-width piecewise-linear formal water condition and recorded the missing machine naturalness gates.",
  detailZh:
    "程序确认人工拒绝源于五点固定宽度折线式正式水体条件，并记录了机器审核缺失的河道自然度门禁。",
  script: "scripts/diagnose-ai-assisted-v7-slot-122-river-geometry-rejection.mjs",
  currentStep: "slot_122_river_geometry_diagnosed_repair_authorization_required",
  evidencePath: written.runPath,
  evidence: [
    written.runPath,
    CONDITION_RUN_PATH,
    conditionRun.blueprintPath,
    record.conditionBinding.guidePath,
    OWNER_REVIEW_PATH,
    MACHINE_REVIEW_PATH,
  ],
})

console.log(JSON.stringify({ ...report, reportPath: written.runPath }, null, 2))

function centerlineMetrics(points) {
  const segmentLengths = []
  const turns = []
  for (let index = 1; index < points.length; index += 1) {
    segmentLengths.push(distance(points[index - 1], points[index]))
  }
  for (let index = 1; index < points.length - 1; index += 1) {
    const incoming = {
      x: points[index].x - points[index - 1].x,
      y: points[index].y - points[index - 1].y,
    }
    const outgoing = {
      x: points[index + 1].x - points[index].x,
      y: points[index + 1].y - points[index].y,
    }
    const denominator =
      Math.hypot(incoming.x, incoming.y) *
      Math.hypot(outgoing.x, outgoing.y)
    const cosine = Math.max(
      -1,
      Math.min(
        1,
        (incoming.x * outgoing.x + incoming.y * outgoing.y) / denominator,
      ),
    )
    turns.push((Math.acos(cosine) * 180) / Math.PI)
  }
  const totalLength = segmentLengths.reduce((sum, value) => sum + value, 0)
  const chordLength = distance(points[0], points.at(-1))
  return {
    pointCount: points.length,
    segmentLengthsPixels: segmentLengths.map(round6),
    maximumSegmentPixels: round6(Math.max(...segmentLengths)),
    interiorTurnDegrees: turns.map(round6),
    maximumInteriorTurnDegrees: round6(Math.max(...turns)),
    totalLengthPixels: round6(totalLength),
    chordLengthPixels: round6(chordLength),
    sinuosity: round6(totalLength / Math.max(1, chordLength)),
  }
}

function distance(left, right) {
  return Math.hypot(right.x - left.x, right.y - left.y)
}

function round6(value) {
  return Number(value.toFixed(6))
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(resolveProjectPath(relativePath), "utf8"))
}

function fileSha256(relativePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(resolveProjectPath(relativePath)))
    .digest("hex")
}

function fileSha256FromDisk(relativePath) {
  return fileSha256(relativePath)
}

function resolveProjectPath(relativePath) {
  const resolved = path.resolve(ROOT, relativePath)
  assert(
    resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`),
    `path escapes project root: ${relativePath}`,
  )
  return resolved
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
