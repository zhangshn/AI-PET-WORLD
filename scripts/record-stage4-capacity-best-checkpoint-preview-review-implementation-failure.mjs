import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const RUN_ID = "20260823-135123928"
const output = path.resolve(ROOT, `.runtime/ai-painter/stage4-capacity-best-checkpoint-preview-reviews/${RUN_ID}`)
const consumption = path.resolve(ROOT, `.runtime/ai-painter/owner-action-requests/owner-authorized-stage4-capacity-best-checkpoint-preview-review-${RUN_ID}/consumption.json`)
const sourcePreview = path.resolve(ROOT, ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-110753367-capacity-stage0/training-output/checkpoint-bound-preview-source/epoch-037-v7-complete-map-194-seed-20266722.png")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const rel = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: rel(value), sha256: sha(value) })
assert.equal(fs.existsSync(consumption), true, "consumption_missing")
assert.equal(sha(consumption), "b7c1d9cb259d015c683f480a091ec28a08beec1e14145ea6e704d42fc50f50c3")
assert.equal(sha(sourcePreview), "bd9590ee477e2775f089d69cc64fda3e292c18d7f1958b796ff0f19a2dbec15f", "source_preview_modified")
const failure = path.join(output, "failure-report.json")
const terminal = path.join(output, "phase-terminal.json")
assert.equal(fs.existsSync(failure), false, "failure_report_exists")
assert.equal(fs.existsSync(terminal), false, "terminal_exists")
const now = new Date().toISOString()
writeJsonAtomic(failure, {
  schemaVersion: "stage4-capacity-best-checkpoint-preview-review-implementation-failure-v1",
  status: "capacity_best_checkpoint_preview_review_implementation_failed_closed",
  errorCode: "auxiliary_focal_area_misclassified_as_reference_semantic_object",
  error: "The review wrapper required priorAcceptanceThresholdChanged on every objectSemanticAudits row, including the focal_area auxiliary audit that is not one of the four formal reference-semantic object classes.",
  effect: "The immutable preview was normalized, but no formal machine-review verdict was saved.",
  consumption: bind(consumption), sourcePreview: bind(sourcePreview), sourcePreviewModified: false,
  checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, consumedAuthorizationReusable: false,
  boundedRepair: "Restrict the threshold-identity assertion to object_footprints, object_tree, object_rock, and object_vegetation while preserving focal_area as an unchanged auxiliary audit row.",
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(terminal, {
  schemaVersion: "stage4-capacity-best-checkpoint-preview-review-terminal-v1",
  status: "capacity_best_checkpoint_preview_review_implementation_failed_closed",
  blocker: "auxiliary_focal_area_misclassified_as_reference_semantic_object",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, failureReport: bind(failure),
  sourcePreviewModified: false, checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false,
  nextLegalAction: "owner_authorize_bounded_four_object_threshold_identity_filter_repair_and_fresh_review", recordedAtUtc: now,
})
appendAiPainterProgramEvent({ id: `stage4-capacity-best-checkpoint-preview-review-implementation-failure-${RUN_ID}`, timestamp: now, action: "stage4_capacity_best_checkpoint_preview_review_implementation", runId: RUN_ID, kind: "cpu_review_wrapper_implementation_failure", status: "failed", title: "Capacity best-checkpoint review wrapper failed", titleZh: "容量结构最佳Checkpoint审核包装器实施失败", detailZh: "辅助focal_area被误当成四类参考语义对象；源预览未修改、未读取Checkpoint、未启动GPU或训练，本次已消费授权不可复用。", evidencePath: rel(terminal), evidenceSha256: sha(terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: "capacity_best_checkpoint_preview_review_implementation_failed_closed", terminal: bind(terminal), failureReport: bind(failure), sourcePreviewModified: false, checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false }, null, 2))
