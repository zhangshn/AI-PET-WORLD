import fs from "node:fs"
import path from "node:path"
import {
  auditAiAssistedConditionAlignment,
} from "./lib/ai-assisted-condition-alignment.mjs"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const INDEX_PATH =
  "data/world-samples/original-image-library/natural-home-v1/index.json"
const TARGET_RECORD_ID =
  "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v1"
const KNOWN_WATER_MISMATCH_RECORD_ID =
  "ai-cold-start-condition-pair-002-inland-tropical-river-valley-v1"
const index = readJson(INDEX_PATH)
const priorPassedRecords = []

for (const summary of index.records ?? []) {
  if (
    summary.categoryId !== "complete-maps" ||
    !summary.conditionBinding?.conditionPackPath ||
    !summary.relativeDirectory ||
    !summary.originalImage?.path ||
    !summary.reviews?.machineReviewPath
  ) {
    continue
  }
  const reviewPath = resolveProjectPath(
    summary.reviews.machineReviewPath,
  )
  if (!fs.existsSync(reviewPath)) continue
  const review = readJson(reviewPath)
  const priorWaterAudit =
    review.semanticConditionAudit?.channelAudits?.find(
      (entry) => entry.channelId === "terrain_water",
    )
  if (
    priorWaterAudit?.passed === true ||
    summary.recordId === TARGET_RECORD_ID ||
    summary.recordId === KNOWN_WATER_MISMATCH_RECORD_ID
  ) {
    priorPassedRecords.push({
      summary,
      priorWaterAudit,
    })
  }
}

const results = []
for (const { summary, priorWaterAudit } of priorPassedRecords) {
  const record = readJson(summary.recordPath)
  const imagePath = resolveProjectPath(
    path.join(
      record.relativeDirectory,
      record.originalImage.path,
    ),
  )
  const audit = await auditAiAssistedConditionAlignment({
    record,
    imagePath,
  })
  const waterAudit = audit.channelAudits.find(
    (entry) => entry.channelId === "terrain_water",
  )
  results.push({
    recordId: record.recordId,
    priorPassed: priorWaterAudit?.passed === true,
    expectedNonZeroRatio: waterAudit.expectedNonZeroRatio,
    actualSignalRatio: waterAudit.actualSignalRatio,
    rawActualSignalRatio: waterAudit.rawActualSignalRatio,
    passed: waterAudit.passed,
    issueCodes: waterAudit.issues.map((entry) => entry.code),
    classifierMode: waterAudit.classifierMode,
    acceptanceThresholdsChanged:
      audit.waterClassifier
        ?.acceptanceThresholdsChanged ?? null,
  })
}

const priorPassRegressions = results.filter(
  (entry) => entry.priorPassed && !entry.passed,
)
const target = results.find(
  (entry) => entry.recordId === TARGET_RECORD_ID,
)
const knownMismatch = results.find(
  (entry) =>
    entry.recordId === KNOWN_WATER_MISMATCH_RECORD_ID,
)
const waterPresentPassCount = results.filter(
  (entry) =>
    entry.priorPassed &&
    entry.expectedNonZeroRatio > 0 &&
    entry.passed,
).length
const noWaterPassCount = results.filter(
  (entry) =>
    entry.priorPassed &&
    entry.expectedNonZeroRatio === 0 &&
    entry.passed,
).length
const ok =
  priorPassRegressions.length === 0 &&
  waterPresentPassCount > 0 &&
  noWaterPassCount > 0 &&
  target?.passed === true &&
  target.expectedNonZeroRatio === 0 &&
  target.actualSignalRatio <= 0.005 &&
  target.classifierMode ===
    "condition_absent_strong_blue_dominance_v2" &&
  knownMismatch?.passed === false &&
  knownMismatch.classifierMode ===
    "condition_present_broad_freshwater_color_signal_v1" &&
  results.every(
    (entry) =>
      entry.classifierMode === (
        entry.expectedNonZeroRatio === 0
          ? "condition_absent_strong_blue_dominance_v2"
          : "condition_present_broad_freshwater_color_signal_v1"
      ) &&
      entry.acceptanceThresholdsChanged === false,
  )

const createdAtUtc = new Date().toISOString()
const runId =
  "ai-assisted-water-signal-classifier-regression-" +
  createdAtUtc.replace(/[:.]/g, "-")
const report = {
  schemaVersion:
    "ai-assisted-water-signal-classifier-regression-v1",
  runId,
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  ok,
  status: ok
    ? "water_signal_classifier_regression_passed"
    : "water_signal_classifier_regression_failed",
  comparedRecordCount: results.length,
  priorPassedRecordCount: results.filter(
    (entry) => entry.priorPassed,
  ).length,
  waterPresentPassCount,
  noWaterPassCount,
  priorPassRegressionCount: priorPassRegressions.length,
  priorPassRegressions,
  target,
  knownMismatch,
  imageModified: false,
  worldFactsModified: false,
  conditionChannelsModified: false,
  acceptanceThresholdsChanged: false,
  rgbGenerated: 0,
  gpuTrainingStarted: false,
  automaticStorage: true,
}
const stored = writeImmutableProgramRun({
  root:
    ".runtime/ai-painter/ai-assisted-water-signal-classifier-regression-checks",
  runId,
  fileName: "report.json",
  record: report,
  latest: {
    status: report.status,
    comparedRecordCount: report.comparedRecordCount,
    priorPassRegressionCount:
      report.priorPassRegressionCount,
    targetRecordId: TARGET_RECORD_ID,
    targetActualSignalRatio:
      report.target?.actualSignalRatio ?? null,
  },
})
appendAiPainterProgramEvent({
  action:
    "check_ai_assisted_water_signal_classifier_regression",
  runId,
  kind: ok ? "regression_completed" : "step_failed",
  status: ok ? "success" : "failed",
  title: ok
    ? "Water-signal classifier regression passed without changing review thresholds"
    : "Water-signal classifier regression failed",
  titleZh: ok
    ? "水体信号分类器在审核阈值不变的条件下通过回归"
    : "水体信号分类器回归失败",
  detail:
    `compared=${report.comparedRecordCount}; priorPassRegressions=${report.priorPassRegressionCount}; targetSignal=${report.target?.actualSignalRatio}`,
  detailZh:
    `比较=${report.comparedRecordCount}；历史通过回归失败=${report.priorPassRegressionCount}；当前信号=${report.target?.actualSignalRatio}`,
  script:
    "scripts/check-ai-assisted-water-signal-classifier-regression.mjs",
  currentStep: ok
    ? "water_signal_classifier_regression_passed"
    : "water_signal_classifier_regression_failed",
  error: ok
    ? null
    : "water_signal_classifier_regression_failed",
  errorZh: ok ? null : "水体信号分类器回归失败",
  finalGameMapSuccess: false,
  canEnterWorld: false,
  evidencePath: stored.runPath,
  nextAction: ok
    ? "rereview_same_slot_146_image"
    : "stop_and_ask_project_owner",
  nextActionZh: ok
    ? "复审同一张slot-146图片"
    : "停止并询问项目所有者",
})
report.reportPath = stored.runPath

console[ok ? "log" : "error"](JSON.stringify(report, null, 2))
process.exit(ok ? 0 : 1)

function readJson(value) {
  return JSON.parse(
    fs.readFileSync(resolveProjectPath(value), "utf8"),
  )
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  if (
    resolved !== ROOT &&
    !resolved.startsWith(`${ROOT}${path.sep}`)
  ) {
    throw new Error(`path escapes project: ${value}`)
  }
  return resolved
}
