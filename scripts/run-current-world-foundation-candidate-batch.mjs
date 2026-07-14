import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const BATCH_ROOT = path.join(ROOT, ".runtime", "ai-painter", "complete-world-visual-foundation-batches")
const maxAttempts = Math.max(1, Math.min(12, Number.parseInt(argumentValue("--max-attempts") ?? "3", 10)))
const timestamp = new Date().toISOString()
const batchId = `foundation-candidate-batch-${timestamp.replace(/[:.]/g, "-")}`
const batchPath = path.join(BATCH_ROOT, batchId, "batch.json")
const attempts = []
let status = "attempt_limit_reached_machine_rejected"

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const generation = runScript("scripts/run-current-world-foundation-bootstrap-inference.mjs")
  if (!generation.passed) {
    attempts.push({ attempt, stage: "generation", status: "failed", output: generation.output })
    status = "generation_failed"
    break
  }
  const inference = readJson(".runtime/ai-painter/complete-world-visual-bootstrap-inference/latest.json")
  const reviewRun = runScript("scripts/review-current-world-bootstrap-candidate.mjs")
  if (!reviewRun.passed) {
    attempts.push({ attempt, runId: inference.runId, imagePath: inference.outputImagePath, stage: "review", status: "failed", output: reviewRun.output })
    status = "review_failed"
    break
  }
  const review = readJson(".runtime/ai-painter/complete-world-visual-machine-reviews/latest.json")
  const row = {
    attempt,
    runId: inference.runId,
    imagePath: inference.outputImagePath,
    imageSha256: inference.outputImageSha256,
    seed: inference.seed,
    machineReviewStatus: review.status,
    machinePassed: review.passed === true,
    reviewId: review.reviewId,
    reviewPath: review.reviewPath,
    issueCodes: review.issues.map((issue) => issue.code),
  }
  attempts.push(row)
  persist()
  if (review.passed === true) {
    status = "machine_passed_waiting_owner_review"
    break
  }
  const registration = runScript("scripts/register-current-bootstrap-machine-negative.mjs")
  row.machineNegativeRegistrationStatus = registration.passed ? "completed" : "failed"
  row.machineNegativeRegistrationOutput = registration.output
  persist()
  if (!registration.passed) {
    status = "machine_negative_registration_failed"
    break
  }
}

runScript("scripts/audit-complete-map-data-sufficiency.mjs")
runScript("scripts/build-current-complete-map-dataset-package.mjs")
persist()
console.log(JSON.stringify({ status, batchId, maxAttempts, attemptCount: attempts.length, attempts, batchPath: projectPath(batchPath) }, null, 2))
process.exit(status === "generation_failed" || status === "review_failed" || status === "machine_negative_registration_failed" ? 1 : 0)

function persist() {
  writeJson(batchPath, {
    schemaVersion: "complete-world-visual-foundation-candidate-batch-v1",
    batchId,
    createdAtUtc: timestamp,
    createdAtAsiaShanghai: formatShanghai(timestamp),
    status,
    maxAttempts,
    attemptCount: attempts.length,
    attempts,
    automaticStorage: true,
    automaticPositiveRegistrationAllowed: false,
    ownerFinalReviewRequired: true,
    canEnterWorld: false,
  })
  writeJson(path.join(BATCH_ROOT, "latest.json"), { batchId, status, batchPath: projectPath(batchPath), attemptCount: attempts.length })
}

function runScript(script) {
  const child = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 })
  return { passed: child.status === 0, output: `${child.stdout || ""}${child.stderr || ""}`.trim(), exitCode: child.status }
}
function argumentValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null }
function readJson(value) { return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8")) }
function writeJson(filePath, value) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function formatShanghai(iso) { return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00` }
