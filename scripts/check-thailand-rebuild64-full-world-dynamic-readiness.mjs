import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"
import { auditCompleteMapWorldFrameIntegrity } from "./lib/complete-map-world-frame-integrity.mjs"

const ROOT = process.cwd()
const LIBRARY_ROOT = path.join(
  ROOT,
  "data/world-samples/original-image-library/natural-home-v1",
)
const COMPLETE_MAP_ROOT = path.join(LIBRARY_ROOT, "complete-maps")
const AUDIT_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-capacity-146-209-complete-framework-audits/latest.json"
const OUTPUT_ROOT =
  ".runtime/ai-painter/thailand-rebuild64-full-world-dynamic-readiness-checks"
const EXPECTED_COMPOSITION_REVISIONS = new Set([
  "owner-authorized-thailand-rebuild64-full-world-dynamic-readiness-v3-20260731",
  "owner-authorized-thailand-rebuild64-semantic-topology-diversity-v4-20260801",
  "owner-authorized-thailand-rebuild64-flowing-water-connectivity-and-all-history-novelty-v5-20260801",
  "owner-authorized-thailand-rebuild64-cross-modal-rgb-collapse-prevention-v6-20260801",
])
const EXPECTED_FRAME_CONTRACT =
  "complete-rectangular-world-and-future-dynamic-readiness-v2"
const REJECTED_RECORD_IDS = [
  "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v2",
  "ai-cold-start-v7-v7-capacity-slot-147-grassland-forest-transition-v3",
  "ai-cold-start-v7-v7-capacity-slot-148-grassland-forest-transition-v2",
  "ai-cold-start-v7-v7-capacity-slot-149-tropical-forest-glade-v2",
  "ai-cold-start-v7-v7-capacity-slot-150-tropical-forest-glade-v2",
  "ai-cold-start-v7-v7-capacity-slot-198-grassland-forest-transition-v3",
]
const FULL_FRAME_CONTROL_RECORD_ID =
  "ai-cold-start-v7-v7-capacity-slot-198-grassland-forest-transition-v2"
const createdAtUtc = new Date().toISOString()
const runId =
  `thailand-rebuild64-full-world-dynamic-readiness-check-` +
  createdAtUtc.replace(/[:.]/g, "-")
const issues = []

const pointer = readJson(AUDIT_POINTER_PATH)
check(
  pointer.status ===
    "all_64_packages_passed_full_world_dynamic_readiness_framework_standard",
  "all_64_framework_audit_status_not_passed",
)
const frameworkAudit = readJson(pointer.runPath)
check(
  frameworkAudit.summary?.auditedTargetPackageCount === 64 &&
    frameworkAudit.summary?.passedTargetPackageCount === 64 &&
    frameworkAudit.summary?.rebuildRequiredPackageCount === 0 &&
    frameworkAudit.summary?.hardFailurePairCount === 0 &&
    frameworkAudit.summary?.attentionPairCount === 0 &&
    frameworkAudit.summary?.sharedConstructionGrammarGroupCount === 0 &&
    frameworkAudit.summary?.distinctPairCount === 2016,
  "all_64_framework_summary_not_clean",
)

for (const selected of frameworkAudit.selectedPackages ?? []) {
  const blueprint = readJson(selected.blueprintPath)
  const guidePath = path.join(
    path.dirname(resolveProjectPath(selected.conditionPackPath)),
    "condition-guide-manifest.json",
  )
  const guide = readJson(guidePath)
  check(
    EXPECTED_COMPOSITION_REVISIONS.has(
      selected.semanticFrameworkEvidence?.compositionArchitectureRevision,
    ),
    `${selected.slotId}:composition_revision_mismatch`,
  )
  check(
    blueprint.worldFrameContract?.contractVersion === EXPECTED_FRAME_CONTRACT &&
      blueprint.worldFrameContract?.frameCoverage
        ?.everyPixelMustResolveToInWorldSurfaceOrInWorldObject === true &&
      blueprint.worldFrameContract?.frameCoverage?.externalBackdropAllowed ===
        false &&
      blueprint.worldFrameContract?.boundaryConnectivity
        ?.routeMustVisiblyTouchContractSide === true &&
      blueprint.worldFrameContract?.semanticDecomposition
        ?.authoritativeConditionChannelCount === 23 &&
      blueprint.worldFrameContract?.semanticDecomposition
        ?.futureRuntimeMotionReserved === true,
    `${selected.slotId}:world_frame_contract_mismatch`,
  )
  check(
    guide.schemaVersion === "complete-world-condition-guide-v2" &&
      guide.fullWorldRenderingContract?.everyPixelIsInWorld === true &&
      guide.fullWorldRenderingContract?.externalBackdropAllowed === false &&
      guide.fullWorldRenderingContract?.floatingMapOrIslandCutoutAllowed ===
        false,
    `${selected.slotId}:condition_guide_full_world_contract_mismatch`,
  )
}
check(
  frameworkAudit.selectedPackages?.length === 64,
  "selected_package_count_not_64",
)

const rejectedRgbChecks = []
for (const recordId of REJECTED_RECORD_IDS) {
  const recordPath = path.join(COMPLETE_MAP_ROOT, recordId, "record.json")
  const record = readJson(recordPath)
  const machineReview = readJson(record.reviews.machineReviewPath)
  const frameAudit = await auditCompleteMapWorldFrameIntegrity({
    record,
    imagePath: path.join(path.dirname(recordPath), record.originalImage.path),
  })
  check(record.status === "rejected", `${recordId}:record_not_rejected`)
  check(
    record.reviews?.ownerReviewStatus === "owner_rejected",
    `${recordId}:owner_rejection_missing`,
  )
  check(
    record.reviews?.machineReviewStatus === "machine_rejected" &&
      machineReview.reviewerVersion ===
        "ai-assisted-cold-start-machine-review-v8-full-world-dynamic-readiness" &&
      machineReview.worldFrameIntegrityAudit?.passed === false,
    `${recordId}:new_machine_rejection_missing`,
  )
  check(
    record.trainingEligibility === "owner_rejected" &&
      record.aiAssistedColdStartEligible === false &&
      record.independentTrainingEligible === false,
    `${recordId}:positive_training_eligibility_not_removed`,
  )
  check(frameAudit.passed === false, `${recordId}:frame_gate_did_not_reject`)
  rejectedRgbChecks.push({
    recordId,
    imageSha256: record.originalImage.sha256,
    frameGatePassed: frameAudit.passed,
    borderConnectedMatteRatio:
      frameAudit.borderConnectedMatte.borderConnectedMatteRatio,
    failureCodes: frameAudit.issues.map((issue) => issue.code),
  })
}

const controlPath = path.join(
  COMPLETE_MAP_ROOT,
  FULL_FRAME_CONTROL_RECORD_ID,
  "record.json",
)
const controlRecord = readJson(controlPath)
const controlFrameAudit = await auditCompleteMapWorldFrameIntegrity({
  record: controlRecord,
  imagePath: path.join(
    path.dirname(controlPath),
    controlRecord.originalImage.path,
  ),
})
check(controlFrameAudit.passed === true, "full_frame_control_false_positive")

const staleReadyRequests = readConditionalRequests().filter(
  (request) =>
    request.ownerAuthorizationRef ===
      "owner-authorized-thailand-rebuild64-complete-batch-generation-20260731" &&
    request.status === "ready_for_openai_assisted_generation",
)
check(staleReadyRequests.length === 0, "stale_rgb_request_still_ready")

const report = {
  schemaVersion:
    "thailand-rebuild64-full-world-dynamic-readiness-check-v1",
  runId,
  status: issues.length === 0 ? "passed" : "failed",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  ownerAuthorizationId:
    "owner-authorized-thailand-rebuild64-full-world-dynamic-readiness-upgrade-20260731",
  frameworkAuditPath: pointer.runPath,
  frameworkAuditSha256: sha256File(pointer.runPath),
  counts: {
    conditionPackages: frameworkAudit.selectedPackages?.length ?? 0,
    pairComparisons: frameworkAudit.scope?.pairComparisonCount ?? 0,
    distinctPairs: frameworkAudit.summary?.distinctPairCount ?? 0,
    rejectedRgb: rejectedRgbChecks.length,
    staleReadyRgbRequests: staleReadyRequests.length,
  },
  rejectedRgbChecks,
  fullFrameControl: {
    recordId: FULL_FRAME_CONTROL_RECORD_ID,
    passed: controlFrameAudit.passed,
    borderConnectedMatteRatio:
      controlFrameAudit.borderConnectedMatte.borderConnectedMatteRatio,
  },
  generationBoundary: {
    rgbGenerationResumed: false,
    gpuTrainingStarted: false,
    runtimeFrameStarted: false,
    worldEntered: false,
    newOwnerAuthorizationRequiredBeforeRgbResume: true,
  },
  issues,
  automaticStorage: true,
}
const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "check-report.json",
  record: report,
  latest: {
    runId,
    status: report.status,
    conditionPackageCount: report.counts.conditionPackages,
    pairComparisonCount: report.counts.pairComparisons,
    rejectedRgbCount: report.counts.rejectedRgb,
    rgbGenerationResumed: false,
  },
})
appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: "check_thailand_rebuild64_full_world_dynamic_readiness",
  runId,
  kind: "v7_data_quality_regression",
  status: report.status === "passed" ? "success" : "blocked",
  title: "Thailand rebuild64 full-world and future-dynamic readiness check completed",
  titleZh: "泰国新64组完整世界与未来动态可用性检查完成",
  detail: `packages=${report.counts.conditionPackages}; pairs=${report.counts.pairComparisons}; rejectedRgb=${report.counts.rejectedRgb}; issues=${issues.length}`,
  detailZh: `数据包=${report.counts.conditionPackages}；配对=${report.counts.pairComparisons}；拒绝RGB=${report.counts.rejectedRgb}；问题=${issues.length}`,
  script: "scripts/check-thailand-rebuild64-full-world-dynamic-readiness.mjs",
  currentStep: "full_world_dynamic_readiness_regression_complete",
  evidencePath: stored.runPath,
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

console.log(JSON.stringify({
  runId,
  status: report.status,
  reportPath: stored.runPath,
  reportSha256: sha256File(stored.runPath),
  counts: report.counts,
  issues,
}, null, 2))
if (issues.length > 0) process.exitCode = 1

function readConditionalRequests() {
  const root = path.join(
    ROOT,
    ".runtime/ai-painter/ai-assisted-cold-start/conditional-rgb-generation-requests",
  )
  if (!fs.existsSync(root)) return []
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return []
    const requestPath = path.join(root, entry.name, "request.json")
    if (!fs.existsSync(requestPath)) return []
    try {
      return [readJson(requestPath)]
    } catch {
      return []
    }
  })
}

function check(condition, code) {
  if (!condition) issues.push(code)
}

function readJson(value) {
  return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8"))
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  if (!(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`))) {
    throw new Error(`path escapes project: ${value}`)
  }
  return resolved
}

function sha256File(value) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(resolveProjectPath(value)))
    .digest("hex")
}
