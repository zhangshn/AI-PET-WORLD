import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const reviewPointer = readJson(".runtime/ai-painter/complete-world-visual-machine-reviews/latest.json")
assert(reviewPointer?.schemaVersion === "complete-world-visual-machine-review-v1", "latest complete-map machine review missing")
assert(reviewPointer.passed === false && reviewPointer.status === "machine_rejected", "only a machine-rejected candidate can be registered here")
const taskPointer = readJson(".runtime/ai-painter/world-visual-generation-task-packages/latest.json")
const task = readJson(taskPointer.taskPath)
const conditionManifest = readJson(path.join(path.dirname(taskPointer.taskPath), "compiled-conditions", "manifest.json"))
const conditionPack = readJson(conditionManifest.conditionPackPath)
assert(reviewPointer.candidate.taskId === task.taskId, "machine review is not bound to the current task")
assert(reviewPointer.candidate.imageSha256 === sha256(fs.readFileSync(resolvePath(reviewPointer.candidate.imagePath))), "machine-negative image hash mismatch")

const request = {
  schemaVersion: "complete-map-sample-registration-request-v1",
  sampleType: "machine_negative",
  sampleScope: "complete_map",
  imagePath: reviewPointer.candidate.imagePath,
  sourceType: "local_model_generated",
  sourcePath: reviewPointer.candidate.imagePath,
  sourceLicense: { status: "project_generated" },
  dictionaryVersionId: task.dictionaryVersionId,
  directorPlanId: task.directorPlan.directorRunId,
  taskPackageId: task.taskId,
  blueprintHash: task.taskSha256,
  conditionHashes: conditionPack.channels.map((channel) => channel.sha256),
  machineReviewStatus: "machine_rejected",
  ownerReviewStatus: "not_reached_machine_failed",
  rejectedBy: "complete_map_machine_review",
  sourceReviewRecordId: reviewPointer.reviewId,
  mustNotTrainAsPositive: true,
  failureCodes: reviewPointer.issues.map((issue) => issue.code),
  failureRegions: [...new Set(reviewPointer.issues.map((issue) => issue.affectedRegion))],
  rootCauses: reviewPointer.failureFeedback.map((item) => `${item.failureCode}:${item.modelCapabilityTarget}`),
  nextTrainingTask: reviewPointer.failureFeedback.map((item) => item.nextTaskConstraint).join(","),
  trainingUsage: "negative",
  split: "train",
  modelVersion: reviewPointer.candidate.modelVersion,
  checkpoint: readJson(".runtime/ai-painter/complete-world-visual-bootstrap-inference/latest.json").modelCheckpointPath,
  seed: reviewPointer.candidate.seed,
  labels: ["bootstrap_complete_map", "machine_rejected", "must_not_train_as_positive"],
}
const requestPath = path.join(path.dirname(resolvePath(reviewPointer.reviewPath)), "machine-negative-registration-request.json")
writeJson(requestPath, request)
const child = spawnSync(process.execPath, ["scripts/register-complete-map-training-sample.mjs", "--request", projectPath(requestPath)], { cwd: ROOT, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 })
assert(child.status === 0, `machine-negative registration failed: ${child.stderr || child.stdout}`)
console.log(child.stdout.trim())

function readJson(value) { return JSON.parse(fs.readFileSync(resolvePath(value), "utf8")) }
function writeJson(filePath, value) { fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`) }
function resolvePath(value) { const resolved = path.resolve(ROOT, value); assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project root: ${value}`); return resolved }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex") }
function assert(condition, message) { if (!condition) throw new Error(message) }
