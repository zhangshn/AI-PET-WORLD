import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const SCRIPT_PATH =
  "scripts/record-earth-geospatial-v7-slot-pre-rgb-composition-blocker.mjs"
const SCRIPT_SHA256_BEFORE_OWNER_REVIEW_FIELD_FIX =
  "8b272d0445fc743e5a83c4f357ff57f89983b7d1ff31dac8bd8140a8350b1887"
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-slot-pre-rgb-composition-blockers"
const slotId = argumentValue("--v7-slot-id")
const rejectedConditionRunId = argumentValue("--rejected-condition-run-id")
const blockedConditionRunId = argumentValue("--blocked-condition-run-id")
const ownerCommandRef = argumentValue("--owner-command-ref")

assert(slotId === "v7-capacity-slot-123", "this bounded recorder only accepts slot-123")
assert(
  rejectedConditionRunId?.includes(slotId),
  "--rejected-condition-run-id must match slot-123",
)
assert(
  blockedConditionRunId?.includes(slotId),
  "--blocked-condition-run-id must match slot-123",
)
assert(ownerCommandRef, "--owner-command-ref is required")

const rejectedManifestPath = conditionManifestPath(rejectedConditionRunId)
const blockedManifestPath = conditionManifestPath(blockedConditionRunId)
const rejectedManifest = readJson(rejectedManifestPath)
const blockedManifest = readJson(blockedManifestPath)

assert(
  rejectedManifest.anonymousGameCoordinateSeedRevision ===
    "owner-directed-v7-capacity-slot-123-seed-revision-1-20260727",
  "rejected condition run is not slot-123 revision-1",
)
assert(
  blockedManifest.anonymousGameCoordinateSeedRevision ===
    "owner-directed-v7-capacity-slot-123-seed-revision-2-20260727",
  "blocked condition run is not slot-123 revision-2",
)
assert(
  rejectedManifest.conditionId !== blockedManifest.conditionId,
  "revision-2 did not create a new condition identity",
)
assert(
  rejectedManifest.outputBoundary?.imageGenerationStarted === false &&
    blockedManifest.outputBoundary?.imageGenerationStarted === false,
  "a condition run unexpectedly reports RGB generation",
)

const rejectedGuideManifestPath = path.join(
  path.dirname(resolveProjectPath(rejectedManifest.conditionPackPath)),
  "condition-guide-manifest.json",
)
const blockedGuideManifestPath = path.join(
  path.dirname(resolveProjectPath(blockedManifest.conditionPackPath)),
  "condition-guide-manifest.json",
)
const rejectedGuideManifest = readJson(rejectedGuideManifestPath)
const blockedGuideManifest = readJson(blockedGuideManifestPath)
const rejectedGuidePath = resolveProjectPath(rejectedGuideManifest.guidePath)
const blockedGuidePath = resolveProjectPath(blockedGuideManifest.guidePath)

assert(
  sha256File(rejectedGuidePath) === rejectedGuideManifest.guideSha256,
  "rejected condition guide hash mismatch",
)
assert(
  sha256File(blockedGuidePath) === blockedGuideManifest.guideSha256,
  "blocked condition guide hash mismatch",
)
assert(
  rejectedGuideManifest.guideSha256 !== blockedGuideManifest.guideSha256,
  "revision-2 condition guide is byte-identical to revision-1",
)

const authoritativeOwnerReviewPath = resolveProjectPath(
  "data/world-samples/original-image-library/natural-home-v1/complete-maps/" +
    "ai-cold-start-v7-v7-capacity-slot-123-river-floodplain-v1/reviews/owner-review.json",
)
const authoritativeOwnerReview = readJson(authoritativeOwnerReviewPath)
assert(
  authoritativeOwnerReview.decision === "owner_rejected",
  "slot-123 owner review is not rejected",
)
assert(
  authoritativeOwnerReview.reasonCodes?.includes("composition_duplicate"),
  "slot-123 owner review does not contain composition_duplicate",
)

const rejectedGuideAnalysis = await analyzeGuide(rejectedGuidePath)
const blockedGuideAnalysis = await analyzeGuide(blockedGuidePath)
const centroidDelta = {
  waterXNormalized:
    Math.abs(
      rejectedGuideAnalysis.water.centroidX -
        blockedGuideAnalysis.water.centroidX,
    ) / rejectedGuideAnalysis.width,
  waterYNormalized:
    Math.abs(
      rejectedGuideAnalysis.water.centroidY -
        blockedGuideAnalysis.water.centroidY,
    ) / rejectedGuideAnalysis.height,
  routeXNormalized:
    Math.abs(
      rejectedGuideAnalysis.route.centroidX -
        blockedGuideAnalysis.route.centroidX,
    ) / rejectedGuideAnalysis.width,
  routeYNormalized:
    Math.abs(
      rejectedGuideAnalysis.route.centroidY -
        blockedGuideAnalysis.route.centroidY,
    ) / rejectedGuideAnalysis.height,
}
const macroCompositionDuplicate =
  rejectedGuideAnalysis.water.rightHalfRatio >= 0.98 &&
  blockedGuideAnalysis.water.rightHalfRatio >= 0.98 &&
  rejectedGuideAnalysis.route.leftHalfRatio >= 0.98 &&
  blockedGuideAnalysis.route.leftHalfRatio >= 0.98 &&
  centroidDelta.waterXNormalized <= 0.06 &&
  centroidDelta.waterYNormalized <= 0.06 &&
  centroidDelta.routeXNormalized <= 0.06 &&
  centroidDelta.routeYNormalized <= 0.06

assert(
  macroCompositionDuplicate,
  "program metrics did not reproduce the owner-directed macro-composition blocker",
)

const createdAtUtc = new Date().toISOString()
const runId =
  `earth-geospatial-v7-slot-pre-rgb-composition-blocker-${slotId}-` +
  createdAtUtc.replace(/[:.]/g, "-")
const report = {
  schemaVersion:
    "earth-geospatial-v7-slot-pre-rgb-composition-blocker-v1",
  runId,
  status: "blocked_before_rgb_due_macro_composition_duplicate",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  slotId,
  ownerCommandRef,
  reasonCode: "pre_rgb_condition_guide_macro_composition_duplicate",
  reasonZh:
    "revision-2仍保持右侧宽河与左侧纵向弯路的宏观布局，与已拒绝构图过于相似。",
  reasonEn:
    "Revision 2 retains the same broad right-side river and left-side longitudinal route organization as the rejected composition.",
  rejectedCondition: {
    runId: rejectedConditionRunId,
    conditionId: rejectedManifest.conditionId,
    seedRevision: rejectedManifest.anonymousGameCoordinateSeedRevision,
    manifestPath: projectPath(rejectedManifestPath),
    manifestSha256: sha256File(rejectedManifestPath),
    guideManifestPath: projectPath(rejectedGuideManifestPath),
    guideManifestSha256: sha256File(rejectedGuideManifestPath),
    guidePath: projectPath(rejectedGuidePath),
    guideSha256: rejectedGuideManifest.guideSha256,
    guideAnalysis: rejectedGuideAnalysis,
  },
  blockedCondition: {
    runId: blockedConditionRunId,
    conditionId: blockedManifest.conditionId,
    seedRevision: blockedManifest.anonymousGameCoordinateSeedRevision,
    manifestPath: projectPath(blockedManifestPath),
    manifestSha256: sha256File(blockedManifestPath),
    guideManifestPath: projectPath(blockedGuideManifestPath),
    guideManifestSha256: sha256File(blockedGuideManifestPath),
    guidePath: projectPath(blockedGuidePath),
    guideSha256: blockedGuideManifest.guideSha256,
    guideAnalysis: blockedGuideAnalysis,
  },
  authoritativeOwnerReview: {
    path: projectPath(authoritativeOwnerReviewPath),
    sha256: sha256File(authoritativeOwnerReviewPath),
    decision: authoritativeOwnerReview.decision,
    reasonCodes: authoritativeOwnerReview.reasonCodes,
  },
  priorRecorderFailure: {
    status: "failed_recorded",
    failureCode: "owner_review_decision_literal_mismatch",
    attemptedCommand:
      "npm run record:earth-geospatial-v7-slot-pre-rgb-composition-blocker -- " +
      "--v7-slot-id v7-capacity-slot-123 " +
      `--rejected-condition-run-id ${rejectedConditionRunId} ` +
      `--blocked-condition-run-id ${blockedConditionRunId} ` +
      `--owner-command-ref ${ownerCommandRef}`,
    processExitCode: 1,
    errorName: "Error",
    errorMessage: "slot-123 owner review is not rejected",
    cause:
      "The recorder accepted the non-canonical literal rejected but the authoritative review stores decision=owner_rejected.",
    causeZh:
      "记录器接受了非权威字面值rejected，但权威审核保存的是decision=owner_rejected。",
    authoritativeDecisionChanged: false,
    scriptPath: SCRIPT_PATH,
    scriptSha256Before:
      SCRIPT_SHA256_BEFORE_OWNER_REVIEW_FIELD_FIX,
    scriptSha256After: sha256File(path.join(ROOT, SCRIPT_PATH)),
    repairScope:
      "Accept only the authoritative owner_rejected decision literal.",
    repairScopeZh: "仅适配权威的owner_rejected审核决定字面值。",
  },
  comparison: {
    contract:
      "semantic-guide-half-plane-and-normalized-centroid-comparison-v1",
    centroidDelta,
    waterRemainsEntirelyOnRightHalf:
      rejectedGuideAnalysis.water.rightHalfRatio === 1 &&
      blockedGuideAnalysis.water.rightHalfRatio === 1,
    routeRemainsEntirelyOnLeftHalf:
      rejectedGuideAnalysis.route.leftHalfRatio === 1 &&
      blockedGuideAnalysis.route.leftHalfRatio === 1,
    macroCompositionDuplicate,
  },
  nextAuthorizedSeedRevision:
    "owner-directed-v7-capacity-slot-123-seed-revision-3-20260728",
  outputBoundary: {
    rgbRequestCompiled: false,
    imageGenerationStarted: false,
    rgbCreated: false,
    gpuTrainingStarted: false,
    runtimeStarted: false,
    worldPageChanged: false,
    capacityContributionCreated: false,
  },
  evidenceMutationBoundary: {
    rejectedConditionModified: false,
    blockedConditionModified: false,
    ownerReviewModified: false,
    modelAlgorithmModified: false,
    promptModified: false,
    reviewThresholdModified: false,
  },
  automaticStorage: true,
}
const written = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "blocker-report.json",
  record: report,
  latest: {
    slotId,
    rejectedConditionRunId,
    blockedConditionRunId,
    reasonCode: report.reasonCode,
    nextAuthorizedSeedRevision: report.nextAuthorizedSeedRevision,
  },
})

const priorFailureEvent = appendAiPainterProgramEvent({
  action: "record_v7_slot_pre_rgb_composition_blocker",
  runId,
  kind: "prior_recorder_failure",
  status: "failed",
  title: "The prior slot-123 composition-blocker recorder field mismatch was recorded",
  titleZh: "slot-123构图阻断记录器此前的字段不匹配失败已记录",
  detail: report.priorRecorderFailure.errorMessage,
  detailZh:
    "此前记录器未适配权威审核中的decision=owner_rejected，失败命令、原因与修复前后哈希现已由程序保存。",
  script: SCRIPT_PATH,
  currentStep: "prior_owner_review_decision_literal_mismatch_recorded",
  errorCode: report.priorRecorderFailure.failureCode,
  evidencePath: written.runPath,
  evidence: [written.runPath, report.authoritativeOwnerReview.path],
})
const blockedEvent = appendAiPainterProgramEvent({
  action: "record_v7_slot_pre_rgb_composition_blocker",
  runId,
  kind: "pre_rgb_composition_review",
  status: "blocked",
  title: "Slot-123 revision-2 stopped before RGB because its macro composition remains duplicated",
  titleZh: "slot-123 revision-2因宏观构图仍重复而在RGB生成前停止",
  detail: report.reasonEn,
  detailZh: report.reasonZh,
  script:
    SCRIPT_PATH,
  currentStep: "pre_rgb_macro_composition_duplicate_recorded",
  errorCode: report.reasonCode,
  evidencePath: written.runPath,
  evidence: [
    written.runPath,
    report.rejectedCondition.guidePath,
    report.blockedCondition.guidePath,
    report.authoritativeOwnerReview.path,
  ],
  nextAction:
    "rebuild_slot_123_with_owner_authorized_anonymous_seed_revision_3",
  nextActionZh: "使用项目所有者已授权的匿名种子revision-3重建slot-123",
})
const authorizationEvent = appendAiPainterProgramEvent({
  action: "authorize_v7_slot_anonymous_seed_revision_3",
  runId,
  kind: "owner_authorization",
  status: "success",
  title: "Owner authorization for the bounded slot-123 revision-3 seed rebuild was recorded",
  titleZh: "slot-123 revision-3有界种子重建的项目所有者授权已记录",
  detail:
    "The authorization changes only the anonymous seed identity and does not authorize model-algorithm changes, batch RGB, GPU training, Runtime, or /world.",
  detailZh:
    "该授权仅更换匿名种子身份，不授权修改模型算法、批量RGB、GPU训练、Runtime或/world。",
  script:
    SCRIPT_PATH,
  currentStep: "slot_123_seed_revision_3_authorization_recorded",
  evidencePath: written.runPath,
  evidence: [written.runPath],
})

console.log(
  JSON.stringify(
    {
      status: report.status,
      runId,
      slotId,
      reasonCode: report.reasonCode,
      macroCompositionDuplicate,
      centroidDelta,
      nextAuthorizedSeedRevision: report.nextAuthorizedSeedRevision,
      blockerPath: written.runPath,
      eventIds: [
        priorFailureEvent.id,
        blockedEvent.id,
        authorizationEvent.id,
      ],
      ...report.outputBoundary,
    },
    null,
    2,
  ),
)

async function analyzeGuide(filePath) {
  const { data, info } = await sharp(filePath)
    .raw()
    .toBuffer({ resolveWithObject: true })
  assert(
    info.width === 1024 && info.height === 768 && info.channels >= 3,
    "condition guide dimensions are invalid",
  )
  return {
    width: info.width,
    height: info.height,
    water: semanticStats(data, info, [43, 112, 156]),
    route: semanticStats(data, info, [181, 137, 76]),
  }
}

function semanticStats(data, info, color) {
  let pixelCount = 0
  let xTotal = 0
  let yTotal = 0
  let leftHalfCount = 0
  let rightHalfCount = 0
  for (let index = 0; index < info.width * info.height; index += 1) {
    const offset = index * info.channels
    if (
      data[offset] !== color[0] ||
      data[offset + 1] !== color[1] ||
      data[offset + 2] !== color[2]
    ) {
      continue
    }
    const x = index % info.width
    const y = Math.floor(index / info.width)
    pixelCount += 1
    xTotal += x
    yTotal += y
    if (x < info.width / 2) leftHalfCount += 1
    else rightHalfCount += 1
  }
  assert(pixelCount > 0, "expected semantic color is absent from condition guide")
  return {
    pixelCount,
    centroidX: xTotal / pixelCount,
    centroidY: yTotal / pixelCount,
    leftHalfRatio: leftHalfCount / pixelCount,
    rightHalfRatio: rightHalfCount / pixelCount,
  }
}

function conditionManifestPath(runId) {
  return path.join(
    ROOT,
    ".runtime",
    "ai-painter",
    "earth-geospatial-v7-mvp-slot-condition-runs",
    runId,
    "complete-map-condition-run.json",
  )
}

function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] ?? null : null
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assert(
    resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`),
    `path escapes project: ${value}`,
  )
  return resolved
}

function readJson(value) {
  return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8"))
}

function sha256File(value) {
  return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
