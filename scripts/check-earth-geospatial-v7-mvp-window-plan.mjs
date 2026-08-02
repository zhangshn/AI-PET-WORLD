import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { catalogPath } from "./lib/ai-pet-world-storage.mjs";

const ROOT = process.cwd();
const LATEST_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/latest.json";
const EXPECTED_AUTHORIZATION =
  "owner-authorized-v7-mvp64-gap38-real-geography-bounded-data-build-20260725";
const AUTHORIZED_SELECTION_LIMIT = 38;
const latest = readJson(LATEST_PATH);
const plan = readJson(latest.runPath);
const candidates = readJson(plan.candidateWindowsPath);
const gapList = readJson(plan.capacityGapListPath);
const assignedPlannedSlots = (gapList.plannedSlots ?? []).filter(
  (entry) => typeof entry.slotId === "string",
);
const expectedSelections = assignedPlannedSlots.length;
const unassignedReplacementCount =
  (gapList.plannedSlots ?? []).length - expectedSelections;
const gridSize = candidates.grid?.columns;

assert(
  plan.schemaVersion === "earth-geospatial-v7-mvp-window-plan-v1",
  "window plan schema mismatch",
);
assert(
  plan.status === "real_geography_window_plan_ready_condition_build_required",
  "window plan status mismatch",
);
assert(
  plan.authorizationId === EXPECTED_AUTHORIZATION &&
    latest.authorizationId === EXPECTED_AUTHORIZATION,
  "bounded authorization mismatch",
);
assertHash(plan.capacityGapListPath, plan.capacityGapListSha256);
assertHash(plan.candidateWindowsPath, plan.candidateWindowsSha256);
for (const [evidencePath, expectedHash] of [
  [plan.sourceEvidence.elevationPath, plan.sourceEvidence.elevationSha256],
  [
    plan.sourceEvidence.reconstructedNaturalLandCoverPath,
    plan.sourceEvidence.reconstructedNaturalLandCoverSha256,
  ],
  [
    plan.sourceEvidence.combinedHumanRemovalMaskPath,
    plan.sourceEvidence.combinedHumanRemovalMaskSha256,
  ],
  [plan.sourceEvidence.slopePath, plan.sourceEvidence.slopeSha256],
  [
    plan.sourceEvidence.drainageLikelihoodPath,
    plan.sourceEvidence.drainageLikelihoodSha256,
  ],
]) {
  assertHash(evidencePath, expectedHash);
}

assert(
  [7, 9, 11].includes(gridSize) &&
    candidates.grid.rows === gridSize &&
    candidates.candidates.length === gridSize * gridSize,
  "candidate grid must be one of the documented 7x7, 9x9, or 11x11 scopes",
);
if (gridSize === 11) {
  assert(
    plan.scopeExpansionAuthorizationId ===
      "owner-authorized-slot-123-thai-measurement-scope-beyond-9x9-no-rgb-20260729" &&
      candidates.grid.priorNineByNineEnvelopePreservedInside === true &&
      candidates.grid.newlyAuthorizedOuterRingOnly === true &&
      candidates.grid.eligibleNewOuterRingCandidateCount === 40 &&
      plan.selectionMethod?.priorPhysicalAssignmentsPreserved === true &&
      plan.selectionMethod?.slot123ScreeningCandidateScope ===
        "new_11x11_outer_ring_only",
    "11x11 bounded scope evidence is incomplete",
  );
}
assert(
  Number.isInteger(expectedSelections) &&
    expectedSelections > 0 &&
    expectedSelections <= AUTHORIZED_SELECTION_LIMIT &&
    gapList.requiredNewRecordCount ===
      expectedSelections + unassignedReplacementCount,
  "capacity gap count is outside the bounded 38-slot authorization",
);
assert(
  plan.assignments.length === expectedSelections &&
    plan.counts.selectedWindows === expectedSelections &&
    plan.counts.remainingUnselectedWindows ===
      (gridSize === 11
        ? candidates.grid.eligibleNewOuterRingCandidateCount
        : gridSize === 9
          ? candidates.grid.eligibleNewOuterRingCandidateCount -
            expectedSelections
          : candidates.candidates.length - expectedSelections) &&
    latest.selectedWindowCount === expectedSelections &&
    latest.capacityPlanRunId === plan.capacityPlanRunId,
  "selected window count mismatch",
);
assertUnique(
  candidates.candidates.map((entry) => entry.candidateId),
  "candidate ids",
);
assertUnique(
  candidates.candidates.map((entry) => entry.fingerprints.direct),
  "candidate direct fingerprints",
);
assertUnique(
  candidates.candidates.map(
    (entry) => entry.fingerprints.transformCanonical,
  ),
  "candidate transform fingerprints",
);
assertUnique(plan.assignments.map((entry) => entry.slotId), "selected slots");
assertUnique(
  plan.assignments.map((entry) => entry.candidateId),
  "selected candidates",
);
assertUnique(
  plan.assignments.map((entry) => entry.fingerprints.transformCanonical),
  "selected transform fingerprints",
);

const plannedBySlot = new Map(
  assignedPlannedSlots.map((entry) => [entry.slotId, entry]),
);
assert(
  plannedBySlot.size === expectedSelections,
  "capacity gap list contains duplicate slot identities",
);
for (const assignment of plan.assignments) {
  const gap = plannedBySlot.get(assignment.slotId);
  assert(gap, `assignment not found in gap plan: ${assignment.slotId}`);
  assert(
    assignment.regionalLandscapeType === gap.regionalLandscapeType &&
      assignment.monsoonSeason === gap.monsoonSeason &&
      assignment.split === gap.split,
    `assignment coverage identity mismatch: ${assignment.slotId}`,
  );
  assert(
    assignment.targetEcologyIsDirectlyClaimedByWindowSelection === false,
    `measurement planning improperly claims ecology: ${assignment.slotId}`,
  );
  assert(
    assignment.additionalEvidenceRequirements.length >= 2,
    `downstream evidence requirements missing: ${assignment.slotId}`,
  );
  assert(
    assignment.imageGenerationAuthorized === false &&
      assignment.gpuTrainingAuthorized === false,
    `assignment crossed compute gate: ${assignment.slotId}`,
  );
}
assert(
  plan.assignments.every(
    (assignment, index) =>
      assignment.slotId === assignedPlannedSlots[index].slotId,
  ),
  "assignment order does not exactly match the bound capacity gap plan",
);
assertNoOverlap(plan.assignments);

assert(
  plan.sourceBoundary.externalRgbUsed === false &&
    plan.sourceBoundary.historicalGameRgbRead === false &&
    plan.sourceBoundary.exactRealWorldGeometryCarriedForward === false &&
    plan.sourceBoundary.exactOsmGeometryCarriedForward === false &&
    plan.sourceBoundary.presetHomeSiteAllowed === false,
  "source or autonomy boundary mismatch",
);
assert(
  plan.selectionMethod.mirroredOrRotatedWindowAccepted === false &&
    plan.selectionMethod.presetHomeSiteCreated === false,
  "selection method violates novelty or autonomy",
);
assert(
  plan.outputBoundary.imageGenerationStarted === false &&
    plan.outputBoundary.rgbCreated === false &&
    plan.outputBoundary.gpuTrainingStarted === false &&
    plan.outputBoundary.runtimeFrameEligible === false &&
    plan.outputBoundary.canEnterWorld === false,
  "output boundary mismatch",
);
assert(
  plan.counts.rgbCreated === 0 && plan.counts.gpuTrainingRuns === 0,
  "window planning unexpectedly created RGB or GPU runs",
);

const runRoot = path.dirname(path.join(ROOT, latest.runPath));
const forbiddenFiles = fs
  .readdirSync(runRoot, { recursive: true })
  .filter((entry) => /\.(png|jpe?g|webp|pt|pth|ckpt|safetensors)$/i.test(entry));
assert(
  forbiddenFiles.length === 0,
  `window plan contains forbidden compute artifacts: ${forbiddenFiles.join(", ")}`,
);

const database = new DatabaseSync(catalogPath, { readOnly: true });
const indexedArtifacts = new Set(
  database
    .prepare("SELECT logical_path FROM artifacts WHERE run_id = ?")
    .all(plan.runId)
    .map((entry) => entry.logical_path),
);
const indexedEvents = database
  .prepare("SELECT COUNT(*) AS count FROM program_events WHERE run_id = ?")
  .get(plan.runId).count;
database.close();
for (const requiredPath of [latest.runPath, plan.candidateWindowsPath]) {
  assert(
    indexedArtifacts.has(requiredPath),
    `SQLite artifact index missing: ${requiredPath}`,
  );
}
assert(indexedEvents >= 2, "SQLite bilingual event evidence is incomplete");

console.log(
  JSON.stringify(
    {
      status: "earth_geospatial_v7_mvp_window_plan_passed",
      runId: plan.runId,
      candidateWindows: candidates.candidates.length,
      selectedWindows: plan.assignments.length,
      selectedSlots: {
        first: plan.assignments[0].slotId,
        last: plan.assignments.at(-1).slotId,
      },
      uniqueTransformFingerprints: new Set(
        plan.assignments.map(
          (entry) => entry.fingerprints.transformCanonical,
        ),
      ).size,
      overlappingSelectionPairs: 0,
      indexedArtifacts: indexedArtifacts.size,
      indexedEvents,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
      nextRequiredAction: plan.nextRequiredAction,
    },
    null,
    2,
  ),
);

function assertNoOverlap(assignments) {
  for (let left = 0; left < assignments.length; left += 1) {
    const a = assignments[left].sourcePixelWindow;
    for (let right = left + 1; right < assignments.length; right += 1) {
      const b = assignments[right].sourcePixelWindow;
      const overlaps =
        a.left < b.left + b.width &&
        a.left + a.width > b.left &&
        a.top < b.top + b.height &&
        a.top + a.height > b.top;
      assert(
        !overlaps,
        `selected windows overlap: ${assignments[left].slotId} and ${assignments[right].slotId}`,
      );
    }
  }
}

function assertHash(relativePath, expectedHash) {
  const absolutePath = path.join(ROOT, relativePath);
  assert(fs.existsSync(absolutePath), `artifact missing: ${relativePath}`);
  assert(
    sha256File(absolutePath) === expectedHash,
    `artifact hash mismatch: ${relativePath}`,
  );
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function assertUnique(values, label) {
  assert(new Set(values).size === values.length, `${label} are not unique`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
