import fs from "node:fs";
import path from "node:path";

const sourceReportPath = path.resolve(
  process.argv[2] ??
    ".runtime/ai-painter/natural-home-v109-pure-natural-formal-world-formal-vj2-review/latest.json",
);
const outputRoot = path.resolve(
  process.argv[3] ?? ".runtime/ai-painter/natural-home-v110-v109-formal-passed-safe-pack",
);

const blockedFormalSourceTokens = [
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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function blockedFormalSourceTokensFor(row) {
  const text = [row.sampleId, row.generated, row.target, row.blueprint]
    .filter((value) => value !== undefined && value !== null)
    .join(" ")
    .toLowerCase();
  return blockedFormalSourceTokens.filter((token) => text.includes(token));
}

const sourceReport = readJson(sourceReportPath);
assert(
  sourceReport.schemaVersion === "natural-home-current-mvp-vj2-review-v1",
  "source report must be a formal VJ-2 report",
);
assert(
  sourceReport.sourceVj1JudgeProfile === "formal_world_candidate",
  "source VJ-1 profile must be formal_world_candidate",
);

const rows = (sourceReport.rows ?? [])
  .filter((row) => {
    return (
      row &&
      row.vj1Status === "vj_1_passed" &&
      row.vj2Status === "vj_2_passed_minimal" &&
      row.displayAllowed === false &&
      row.canPromoteToWorld === false &&
      row.canEnterApprovedFrameCandidateReview === true &&
      blockedFormalSourceTokensFor(row).length === 0 &&
      fs.existsSync(row.generated) &&
      fs.existsSync(row.blueprint)
    );
  })
  .map((row) => ({
    ...row,
    status: "passed_for_next_training",
    sha256: row.sourceSha256,
    score: row.sourceTrainingQualityScore ?? row.score ?? 0,
    formalVisualScore: row.formalVisualScore ?? row.score ?? 0,
    sourceVj2Report: sourceReportPath,
    trainingUseOnly: true,
    displayAllowed: false,
    canPromoteToWorld: false,
    approvedFrameStatus: "not_written",
  }))
  .sort((a, b) => {
    const scoreDelta = Number(b.score ?? 0) - Number(a.score ?? 0);
    if (scoreDelta !== 0) return scoreDelta;
    return String(a.sampleId).localeCompare(String(b.sampleId));
  });

assert(rows.length >= 8, `V110 requires at least 8 passed formal candidates, got ${rows.length}`);

const report = {
  schemaVersion: "natural-home-v110-v109-formal-passed-pack-v1",
  status: "completed",
  displayAllowed: false,
  canPromoteToWorld: false,
  stageId: "natural-home-v110-v109-formal-passed-safe-pack",
  sourceReport: sourceReportPath,
  sourceStageId: sourceReport.stageId,
  outputRoot,
  acceptedStatus: "passed_for_next_training",
  rowCount: rows.length,
  sourceSummary: sourceReport.summary ?? null,
  note:
    "Hidden training pack only. Rows are V109 formal full-world candidates that passed VJ-1 and VJ-2; this file never writes or promotes ApprovedFrame.",
  rows,
};

writeJson(path.join(outputRoot, "latest.json"), report);
writeJson(path.join(outputRoot, "accepted-rows.json"), report);
console.log(JSON.stringify(report, null, 2));
