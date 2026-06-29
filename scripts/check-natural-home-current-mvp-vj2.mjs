import fs from "node:fs"
import path from "node:path"

const reportRoot = path.resolve(
  process.argv[2] ?? ".runtime/ai-painter/natural-home-v91-current-mvp-vj2-review",
)
const expectedStageId = process.argv[3] ?? "natural-home-v91-current-mvp-vj2-review"
const allowNoCandidates = process.argv.includes("--allow-no-candidates")
const reportPath = path.join(reportRoot, "latest.json")
const contactSheetPath = path.join(reportRoot, "contact-sheet.png")
const formalBlockedSourceTokens = [
  "crop",
  "partial",
  "patch",
  "tile",
  "sprite",
  "diagnostic",
  "local-detail",
  "local_detail",
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function blockedFormalSourceTokens(row) {
  const text = [row.sampleId, row.generated, row.target, row.blueprint]
    .filter((value) => value !== undefined && value !== null)
    .join(" ")
    .toLowerCase()
  return formalBlockedSourceTokens.filter((token) => text.includes(token))
}

const report = readJson(reportPath)

assert(report.schemaVersion === "natural-home-current-mvp-vj2-review-v1", "unexpected VJ-2 schema")
assert(report.stageId === expectedStageId, "unexpected VJ-2 stageId")
assert(report.reviewScope === "natural_home_current_mvp_minimal_vj2", "unexpected VJ-2 review scope")
assert(report.sourceVj1JudgeProfile === "formal_world_candidate", "VJ-2 source VJ-1 must be formal world candidate profile")
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
  assert(row.sourceVj1JudgeProfile === "formal_world_candidate", `row source VJ-1 profile mismatch: ${row.sampleId}`)
  assert(row.displayAllowed === false, `row must not be display allowed: ${row.sampleId}`)
  assert(row.canPromoteToWorld === false, `row must not promote to world: ${row.sampleId}`)
  assert(row.approvedFrameStatus === "not_written", `row must not write ApprovedFrame: ${row.sampleId}`)
  if (row.vj2Status === "vj_2_passed_minimal") {
    assert(row.vj1Status === "vj_1_passed", `VJ-2 passed rows must pass VJ-1 first: ${row.sampleId}`)
  }
  assert(["vj_2_passed_minimal", "vj_2_failed_minimal"].includes(row.vj2Status), `invalid VJ-2 status: ${row.sampleId}`)
  const blockedTokens = blockedFormalSourceTokens(row)
  if (blockedTokens.length > 0) {
    assert(row.vj2Status !== "vj_2_passed_minimal", `formal crop/partial candidate passed VJ-2: ${row.sampleId}`)
    assert(
      (row.canEnterApprovedFrameCandidateReview ?? false) === false,
      `formal crop/partial candidate can enter ApprovedFrame review: ${row.sampleId}`,
    )
    assert(
      Array.isArray(row.failureReasons) &&
        row.failureReasons.includes("formal_world_candidate_must_not_be_crop_partial_patch_tile_or_sprite"),
      `missing formal source scope failure reason: ${row.sampleId}`,
    )
  }
  assert(fs.existsSync(row.generated), `missing generated image: ${row.sampleId}`)
  assert(fs.existsSync(row.blueprint), `missing blueprint: ${row.sampleId}`)
  assert(Array.isArray(row.checks) && row.checks.length > 0, `missing checks: ${row.sampleId}`)
  assert(row.visualStyleMetrics && typeof row.visualStyleMetrics === "object", `missing style metrics: ${row.sampleId}`)
  assert(row.visibleSemanticMetrics && typeof row.visibleSemanticMetrics === "object", `missing visible semantic metrics: ${row.sampleId}`)
  for (const requiredCheck of [
    "visible_water_region_present",
    "visible_earth_path_region_present",
    "not_green_only_local_patch",
    "visible_scene_semantic_variety",
  ]) {
    assert(
      row.checks.some((check) => check.id === requiredCheck),
      `missing VJ-2 visible semantic check ${requiredCheck}: ${row.sampleId}`,
    )
  }
}

if (!allowNoCandidates) {
  assert(passedRows.length > 0, "VJ-2 must produce at least one candidate for ApprovedFrame binding review")
}

console.log(
  `Current MVP VJ-2 check passed: ${report.rows.length} rows, ${passedRows.length} minimal VJ-2 candidates.`,
)
