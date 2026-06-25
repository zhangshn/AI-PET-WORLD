import fs from "node:fs"
import path from "node:path"

const reportRoot = path.resolve(
  process.argv[2] ?? ".runtime/ai-painter/natural-home-v91-current-mvp-vj2-review",
)
const expectedStageId = process.argv[3] ?? "natural-home-v91-current-mvp-vj2-review"
const allowNoCandidates = process.argv.includes("--allow-no-candidates")
const reportPath = path.join(reportRoot, "latest.json")
const contactSheetPath = path.join(reportRoot, "contact-sheet.png")

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

const report = readJson(reportPath)

assert(report.schemaVersion === "natural-home-current-mvp-vj2-review-v1", "unexpected VJ-2 schema")
assert(report.stageId === expectedStageId, "unexpected VJ-2 stageId")
assert(report.reviewScope === "natural_home_current_mvp_minimal_vj2", "unexpected VJ-2 review scope")
assert(report.displayAllowed === false, "VJ-2 report must not be display allowed")
assert(report.canPromoteToWorld === false, "VJ-2 report must not promote to world")
assert(report.approvedFrameStatus === "not_written", "VJ-2 must not write ApprovedFrame")
assert(fs.existsSync(contactSheetPath), "missing VJ-2 contact sheet")
assert(Array.isArray(report.rows) && report.rows.length > 0, "VJ-2 report must contain rows")
assert(report.summary?.rowCount === report.rows.length, "VJ-2 row count mismatch")
assert(report.summary?.vj2Implemented === true, "VJ-2 must be marked implemented in this report")

const passedRows = report.rows.filter((row) => row.vj2Status === "vj_2_passed_minimal")
assert(report.summary.vj2PassedCount === passedRows.length, "VJ-2 passed count mismatch")
assert(
  report.canEnterApprovedFrameCandidateReview === (passedRows.length > 0),
  "ApprovedFrame candidate review flag mismatch",
)

for (const row of report.rows) {
  assert(row.displayAllowed === false, `row must not be display allowed: ${row.sampleId}`)
  assert(row.canPromoteToWorld === false, `row must not promote to world: ${row.sampleId}`)
  assert(row.approvedFrameStatus === "not_written", `row must not write ApprovedFrame: ${row.sampleId}`)
  if (!allowNoCandidates || row.vj2Status === "vj_2_passed_minimal") {
    assert(row.vj1Status === "vj_1_passed", `VJ-2 passed rows must pass VJ-1 first: ${row.sampleId}`)
  }
  assert(["vj_2_passed_minimal", "vj_2_failed_minimal"].includes(row.vj2Status), `invalid VJ-2 status: ${row.sampleId}`)
  assert(fs.existsSync(row.generated), `missing generated image: ${row.sampleId}`)
  assert(fs.existsSync(row.blueprint), `missing blueprint: ${row.sampleId}`)
  assert(Array.isArray(row.checks) && row.checks.length > 0, `missing checks: ${row.sampleId}`)
  assert(row.visualStyleMetrics && typeof row.visualStyleMetrics === "object", `missing style metrics: ${row.sampleId}`)
}

if (!allowNoCandidates) {
  assert(passedRows.length > 0, "VJ-2 must produce at least one candidate for ApprovedFrame binding review")
}

console.log(
  `Current MVP VJ-2 check passed: ${report.rows.length} rows, ${passedRows.length} minimal VJ-2 candidates.`,
)
