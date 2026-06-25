import fs from "node:fs";
import path from "node:path";

const reportPath = path.resolve(
  ".runtime/ai-painter/natural-home-v90-current-mvp-natural-only-filter/latest.json",
);

const forbiddenTokens = [
  "shelter",
  "storehouse",
  "canopy",
  "construction",
  "construct",
  "building",
  "house",
  "foundation",
  "wall",
  "roof",
  "material",
  "settlement",
  "refuge",
  "camp",
  "hut",
  "quarry",
  "work_canopy",
  "storehouse_frame",
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function searchableText(row) {
  return [
    row.sampleId,
    row.generated,
    row.target,
    row.blueprint,
    row.sourceSha256,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));

assert(
  report.schemaVersion === "natural-home-current-mvp-candidate-filter-v1",
  "unexpected schemaVersion",
);
assert(report.displayAllowed === false, "filter output must not be display allowed");
assert(report.canPromoteToWorld === false, "filter output must not promote to world");
assert(Array.isArray(report.acceptedRows), "acceptedRows must be an array");
assert(Array.isArray(report.rejectedRows), "rejectedRows must be an array");
assert(report.acceptedRows.length > 0, "filter must keep at least one current MVP candidate");
assert(report.rejectedRows.length > 0, "filter must reject forbidden candidates");

for (const row of report.acceptedRows) {
  assert(
    row.status === "passed_for_next_training",
    `accepted row is not a passed training candidate: ${row.sampleId}`,
  );
  assert(
    row.filterDecision?.status === "accepted_for_current_mvp_training",
    `accepted row has wrong filter status: ${row.sampleId}`,
  );
  const text = searchableText(row);
  for (const token of forbiddenTokens) {
    assert(!text.includes(token), `accepted row contains forbidden token ${token}: ${row.sampleId}`);
  }
}

const rejectedForSemanticToken = report.rejectedRows.some((row) =>
  row.filterDecision?.reasons?.some((reason) => reason.code === "forbidden_semantic_token"),
);
assert(rejectedForSemanticToken, "expected at least one forbidden semantic token rejection");

console.log(
  `Current MVP filter passed: ${report.acceptedRows.length} accepted, ${report.rejectedRows.length} rejected.`,
);
