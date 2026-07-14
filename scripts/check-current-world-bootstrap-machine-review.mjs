import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const pointerPath = path.join(ROOT, ".runtime", "ai-painter", "complete-world-visual-machine-reviews", "latest.json")
const failures = []
const pointer = read(pointerPath)
check(pointer.schemaVersion === "complete-world-visual-machine-review-v1", "machine_review_schema_invalid")
check(typeof pointer.reviewPath === "string" && fs.existsSync(resolvePath(pointer.reviewPath)), "machine_review_evidence_missing")
const report = read(resolvePath(pointer.reviewPath))
check(report.candidate.imageSha256 === sha256(fs.readFileSync(resolvePath(report.candidate.imagePath))), "machine_review_image_hash_mismatch")
check(report.gates.map((gate) => gate.gate).join(",") === "VJ-0,VJ-1,VJ-2,Professional Aesthetic", "machine_review_gate_order_invalid")
check(report.canEnterWorld === false, "machine_review_must_not_enter_world")
check(report.canCountAsPositiveSample === false, "unapproved_machine_review_must_not_be_positive")
check(report.automaticStorage === true, "machine_review_automatic_storage_missing")
if (!report.passed) {
  check(report.status === "machine_rejected", "failed_machine_review_status_invalid")
  check(report.issues.length > 0, "failed_machine_review_issues_missing")
  check(report.failureFeedback.length === report.issues.length, "failed_machine_review_feedback_incomplete")
}
console.log(JSON.stringify({ ok: failures.length === 0, status: failures.length === 0 ? "bootstrap_machine_review_check_passed" : "bootstrap_machine_review_check_failed", reviewId: report.reviewId, passed: report.passed, issueCodes: report.issues.map((issue) => issue.code), failures }, null, 2))
if (failures.length > 0) process.exitCode = 1

function check(condition, message) { if (!condition) failures.push(message) }
function read(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")) }
function resolvePath(value) { const resolved = path.resolve(ROOT, value); if (!(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`))) throw new Error(`path escapes root: ${value}`); return resolved }
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex") }
