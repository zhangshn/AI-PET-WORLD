import fs from "node:fs";
import path from "node:path";

const reportRoot = path.resolve(
  process.argv[2] ?? ".runtime/ai-painter/natural-home-v91-current-mvp-vj1-review",
);
const expectedStageId = process.argv[3] ?? "natural-home-v91-current-mvp-vj1-review";
const reportPath = path.join(reportRoot, "latest.json");
const contactSheetPath = path.join(reportRoot, "contact-sheet.png");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const report = readJson(reportPath);

assert(report.schemaVersion === "natural-home-current-mvp-vj1-review-v1", "unexpected VJ-1 schema");
assert(report.stageId === expectedStageId, "unexpected VJ-1 stageId");
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
  report.canEnterApprovedFrameCandidateReview === (passedRows.length > 0),
  "ApprovedFrame candidate review flag mismatch",
);

for (const row of report.rows) {
  assert(row.displayAllowed === false, `row must not be display allowed: ${row.sampleId}`);
  assert(row.canPromoteToWorld === false, `row must not promote to world: ${row.sampleId}`);
  assert(row.vj2Status === "vj_2_not_implemented", `VJ-2 must not be marked passed: ${row.sampleId}`);
  assert(fs.existsSync(row.generated), `missing generated image: ${row.sampleId}`);
  assert(fs.existsSync(row.target), `missing target image: ${row.sampleId}`);
  assert(fs.existsSync(row.blueprint), `missing blueprint: ${row.sampleId}`);
  assert(Array.isArray(row.checks) && row.checks.length > 0, `missing checks: ${row.sampleId}`);
}

console.log(
  `Current MVP VJ-1 check passed: ${report.rows.length} rows, ${passedRows.length} passed.`,
);
