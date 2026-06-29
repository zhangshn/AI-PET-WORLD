import fs from "node:fs"
import path from "node:path"

const reportRoot = path.resolve(
  process.argv[2] ?? ".runtime/ai-painter/natural-home-v117-complete-game-world-frame-gate",
)
const expectedStageId = process.argv[3] ?? "natural-home-v117-complete-game-world-frame-gate"
const expectNoPassed = process.argv.includes("--expect-no-passed")
const reportPath = path.join(reportRoot, "latest.json")

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"))

assert(report.schemaVersion === "natural-home-game-world-frame-gate-v1", "unexpected game-world frame gate schema")
assert(report.stageId === expectedStageId, "unexpected game-world frame gate stageId")
assert(report.reviewScope === "natural_home_complete_game_world_frame_gate", "unexpected game-world frame review scope")
assert(report.displayAllowed === false, "game-world frame gate report must not be display allowed")
assert(report.canPromoteToWorld === false, "game-world frame gate report must not promote directly to world")
assert(report.approvedFrameStatus === "not_written", "game-world frame gate must not write ApprovedFrame")
assert(Array.isArray(report.rows) && report.rows.length > 0, "game-world frame gate must contain rows")
assert(report.summary?.rowCount === report.rows.length, "row count mismatch")

const passedRows = report.rows.filter((row) => row.gameWorldFrameStatus === "game_world_frame_passed")
assert(report.summary.gameWorldFramePassedCount === passedRows.length, "passed count mismatch")
assert(
  report.canEnterApprovedFrameCandidateReview === (passedRows.length > 0),
  "ApprovedFrame candidate review flag mismatch",
)

for (const row of report.rows) {
  assert(row.displayAllowed === false, `row must not be display allowed: ${row.sampleId}`)
  assert(row.canPromoteToWorld === false, `row must not promote directly to world: ${row.sampleId}`)
  assert(row.approvedFrameStatus === "not_written", `row must not write ApprovedFrame: ${row.sampleId}`)
  assert(
    ["game_world_frame_passed", "game_world_frame_failed"].includes(row.gameWorldFrameStatus),
    `invalid game-world frame status: ${row.sampleId}`,
  )
  assert(fs.existsSync(row.generated), `missing generated image: ${row.sampleId}`)
  assert(fs.existsSync(row.blueprint), `missing blueprint: ${row.sampleId}`)
  assert(Array.isArray(row.checks) && row.checks.length > 0, `missing checks: ${row.sampleId}`)
  for (const requiredCheck of [
    "vj2_natural_quality_must_pass",
    "complete_world_intent_tags_present",
    "complete_world_anchors_present",
    "blueprint_must_declare_complete_world_scope",
    "blueprint_must_declare_primary_world_view",
    "runtime_frame_source_declared",
  ]) {
    assert(
      row.checks.some((check) => check.id === requiredCheck),
      `missing game-world frame check ${requiredCheck}: ${row.sampleId}`,
    )
  }
}

if (expectNoPassed) {
  assert(passedRows.length === 0, "expected current gate to block all rows")
}

console.log(
  `Game-world frame gate check passed: ${report.rows.length} rows, ${passedRows.length} complete game-world candidates.`,
)
