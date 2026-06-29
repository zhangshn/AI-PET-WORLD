import fs from "node:fs";
import path from "node:path";

const reportRoot = path.resolve(
  process.argv[2] ?? ".runtime/ai-painter/natural-home-v91-current-mvp-vj1-review",
);
const expectedStageId = process.argv[3] ?? "natural-home-v91-current-mvp-vj1-review";
const expectedJudgeProfile = process.argv[4] ?? "training_diagnostic";
const reportPath = path.join(reportRoot, "latest.json");
const contactSheetPath = path.join(reportRoot, "contact-sheet.png");
const formalBlockedSourceTokens = [
  "crop",
  "partial",
  "patch",
  "tile",
  "sprite",
  "diagnostic",
  "local-detail",
  "local_detail",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function blockedFormalSourceTokens(row) {
  const text = [row.sampleId, row.generated, row.target, row.blueprint]
    .filter((value) => value !== undefined && value !== null)
    .join(" ")
    .toLowerCase();
  return formalBlockedSourceTokens.filter((token) => text.includes(token));
}

const report = readJson(reportPath);
const actualJudgeProfile = report.judgeProfile ?? "training_diagnostic";
const actualTargetComparisonUsed =
  report.targetComparisonUsed ?? (actualJudgeProfile === "training_diagnostic");

assert(report.schemaVersion === "natural-home-current-mvp-vj1-review-v1", "unexpected VJ-1 schema");
assert(report.stageId === expectedStageId, "unexpected VJ-1 stageId");
assert(actualJudgeProfile === expectedJudgeProfile, "unexpected VJ-1 judge profile");
assert(
  ["training_diagnostic", "formal_world_candidate"].includes(actualJudgeProfile),
  "invalid VJ-1 judge profile",
);
assert(
  actualTargetComparisonUsed === (actualJudgeProfile === "training_diagnostic"),
  "VJ-1 target comparison flag mismatch",
);
assert(report.displayAllowed === false, "VJ-1 report must not be display allowed");
assert(report.canPromoteToWorld === false, "VJ-1 report must not promote to world");
assert(report.approvedFrameStatus === "not_written", "VJ-1 must not write ApprovedFrame");
assert(fs.existsSync(contactSheetPath), "missing VJ-1 contact sheet");
assert(Array.isArray(report.rows) && report.rows.length > 0, "VJ-1 report must contain rows");
assert(report.summary?.rowCount === report.rows.length, "VJ-1 row count mismatch");
assert(report.summary?.vj2Implemented === false, "VJ-2 must remain not implemented here");

const passedRows = report.rows.filter((row) => row.vj1Status === "vj_1_passed");
assert(
  report.summary.vj1PassedCount === passedRows.length,
  "VJ-1 passed count mismatch",
);
assert(
  report.canEnterApprovedFrameCandidateReview === (actualJudgeProfile === "formal_world_candidate" && passedRows.length > 0),
  "ApprovedFrame candidate review flag mismatch",
);

for (const row of report.rows) {
  const rowJudgeProfile = row.judgeProfile ?? actualJudgeProfile;
  const rowTargetComparisonUsed = row.targetComparisonUsed ?? actualTargetComparisonUsed;
  assert(rowJudgeProfile === actualJudgeProfile, `row judge profile mismatch: ${row.sampleId}`);
  assert(rowTargetComparisonUsed === actualTargetComparisonUsed, `row target comparison flag mismatch: ${row.sampleId}`);
  assert(row.displayAllowed === false, `row must not be display allowed: ${row.sampleId}`);
  assert(row.canPromoteToWorld === false, `row must not promote to world: ${row.sampleId}`);
  assert(
    (row.canEnterApprovedFrameCandidateReview ?? false) === (actualJudgeProfile === "formal_world_candidate" && row.vj1Status === "vj_1_passed"),
    `row ApprovedFrame candidate flag mismatch: ${row.sampleId}`,
  );
  assert(row.vj2Status === "vj_2_not_implemented", `VJ-2 must not be marked passed: ${row.sampleId}`);
  if (actualJudgeProfile === "formal_world_candidate") {
    const blockedTokens = blockedFormalSourceTokens(row);
    if (blockedTokens.length > 0) {
      assert(row.vj1Status !== "vj_1_passed", `formal crop/partial candidate passed VJ-1: ${row.sampleId}`);
      assert(
        (row.canEnterApprovedFrameCandidateReview ?? false) === false,
        `formal crop/partial candidate can enter ApprovedFrame review: ${row.sampleId}`,
      );
      assert(
        Array.isArray(row.failureReasons) &&
          row.failureReasons.includes("formal_world_candidate_must_not_be_crop_partial_patch_tile_or_sprite"),
        `missing formal source scope failure reason: ${row.sampleId}`,
      );
    }
  }
  assert(fs.existsSync(row.generated), `missing generated image: ${row.sampleId}`);
  if (actualJudgeProfile === "training_diagnostic") {
    assert(fs.existsSync(row.target), `missing target image: ${row.sampleId}`);
  }
  assert(fs.existsSync(row.blueprint), `missing blueprint: ${row.sampleId}`);
  assert(Array.isArray(row.checks) && row.checks.length > 0, `missing checks: ${row.sampleId}`);
}

console.log(
  `Current MVP VJ-1 check passed: ${report.rows.length} rows, ${passedRows.length} passed.`,
);
