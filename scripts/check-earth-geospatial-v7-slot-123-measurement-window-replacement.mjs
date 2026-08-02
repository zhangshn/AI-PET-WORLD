import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { catalogPath } from "./lib/ai-pet-world-storage.mjs";
import { buildMeasurementDerivedCoarseHydrologyProfile } from "./lib/measurement-derived-coarse-hydrology.mjs";

const ROOT = process.cwd();
const SLOT_ID = "v7-capacity-slot-123";
const EXPECTED_PREVIOUS_CANDIDATE_ID =
  "sakaerat-measurement-window-r01-c06-v1";
const EXPECTED_SELECTED_CANDIDATE_ID =
  "sakaerat-measurement-window-r04-c04-v1";
const EXPECTED_AUTHORIZATION_ID =
  "project-owner-authorized-v7-capacity-slot-123-replace-with-unused-real-measurement-window-20260728";
const LATEST_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/latest.json";
const FEATURE_KEYS = [
  "anonymousSupportFraction",
  "quantizedWeightedFlowSupportFraction",
  "quantizedPeakFlowSupportFraction",
  "quantizedRelativeSupport",
];

const latest = readJson(LATEST_PATH);
const plan = readJson(latest.runPath);
const ranking = readJson(plan.replacementEvidence.path);
const parentPlan = readJson(plan.parentWindowPlanPath);
const candidates = readJson(plan.candidateWindowsPath);

assert(
  plan.replacementAuthorizationId === EXPECTED_AUTHORIZATION_ID &&
    latest.replacementAuthorizationId === EXPECTED_AUTHORIZATION_ID &&
    ranking.authorizationId === EXPECTED_AUTHORIZATION_ID,
  "measurement-window replacement authorization mismatch",
);
assertHash(plan.parentWindowPlanPath, plan.parentWindowPlanSha256);
assertHash(plan.replacementEvidence.path, plan.replacementEvidence.sha256);
assertHash(plan.candidateWindowsPath, plan.candidateWindowsSha256);
assert(
  ranking.previousBinding.candidateId ===
    EXPECTED_PREVIOUS_CANDIDATE_ID &&
    ranking.selectedBinding.candidateId ===
      EXPECTED_SELECTED_CANDIDATE_ID,
  "replacement binding identity mismatch",
);

const currentAssignment = plan.assignments.find(
  (entry) => entry.slotId === SLOT_ID,
);
const parentAssignment = parentPlan.assignments.find(
  (entry) => entry.slotId === SLOT_ID,
);
assert(
  currentAssignment?.candidateId === EXPECTED_SELECTED_CANDIDATE_ID &&
    parentAssignment?.candidateId === EXPECTED_PREVIOUS_CANDIDATE_ID,
  "slot-123 assignment was not replaced as authorized",
);

const unchangedSlots = plan.assignments.filter(
  (entry) => entry.slotId !== SLOT_ID,
);
assert(
  unchangedSlots.every((entry) => {
    const parent = parentPlan.assignments.find(
      (candidate) => candidate.slotId === entry.slotId,
    );
    return (
      parent &&
      parent.candidateId === entry.candidateId &&
      parent.fingerprints.direct === entry.fingerprints.direct
    );
  }),
  "a slot other than slot-123 changed during replacement",
);
assert(
  plan.assignments.length === parentPlan.assignments.length &&
    plan.counts.selectedWindows === parentPlan.counts.selectedWindows &&
    plan.counts.remainingUnselectedWindows ===
      parentPlan.counts.remainingUnselectedWindows,
  "replacement changed capacity-window counts",
);

const selectedProfiles = parentPlan.assignments.map((assignment) => ({
  candidateId: assignment.candidateId,
  slotId: assignment.slotId,
  profile: buildMeasurementDerivedCoarseHydrologyProfile({
    assignment,
    root: ROOT,
  }),
}));
const currentParentProfile = selectedProfiles.find(
  (entry) => entry.slotId === SLOT_ID,
);
assert(currentParentProfile, "parent slot-123 hydrology profile is missing");

const selectedCandidateIds = new Set(
  parentPlan.assignments.map((entry) => entry.candidateId),
);
const unusedCandidates = candidates.candidates.filter(
  (entry) => !selectedCandidateIds.has(entry.candidateId),
);
const slot = readJson(plan.capacityGapListPath).plannedSlots.find(
  (entry) => entry.slotId === SLOT_ID,
);
const recalculatedRankings = unusedCandidates
  .map((candidate) => {
    const assignment = {
      ...structuredClone(parentAssignment),
      candidateId: candidate.candidateId,
      measurementBounds: structuredClone(candidate.measurementBounds),
      sourcePixelWindow: structuredClone(candidate.sourcePixelWindow),
      metrics: structuredClone(candidate.metrics),
      fingerprints: structuredClone(candidate.fingerprints),
    };
    const profile = buildMeasurementDerivedCoarseHydrologyProfile({
      assignment,
      root: ROOT,
    });
    const nearest = selectedProfiles
      .map((selected) => ({
        candidateId: selected.candidateId,
        slotId: selected.slotId,
        distance: profileDistance(profile, selected.profile),
      }))
      .sort(
        (left, right) =>
          left.distance - right.distance ||
          left.candidateId.localeCompare(right.candidateId),
      )[0];
    return {
      candidateId: candidate.candidateId,
      minimumDistanceFromAnySelected: nearest.distance,
      nearestSelectedCandidateId: nearest.candidateId,
      nearestSelectedSlotId: nearest.slotId,
      distanceFromCurrentSlot123Window: profileDistance(
        profile,
        currentParentProfile.profile,
      ),
      riverFloodplainFit: round(scoreCandidate(candidate, slot)),
      coarseHydrologyProfileSha256: profile.profileSha256,
    };
  })
  .sort(compareRankings);

assert(
  recalculatedRankings[0]?.candidateId ===
    EXPECTED_SELECTED_CANDIDATE_ID,
  "independent ranking did not reproduce the selected window",
);
for (const [index, recalculated] of recalculatedRankings.entries()) {
  const stored = ranking.rankings[index];
  assert(
    stored.rank === index + 1 &&
      stored.candidateId === recalculated.candidateId &&
      stored.minimumDistanceFromAnySelected ===
        recalculated.minimumDistanceFromAnySelected &&
      stored.nearestSelectedCandidateId ===
        recalculated.nearestSelectedCandidateId &&
      stored.nearestSelectedSlotId ===
        recalculated.nearestSelectedSlotId &&
      stored.distanceFromCurrentSlot123Window ===
        recalculated.distanceFromCurrentSlot123Window &&
      stored.riverFloodplainFit ===
        recalculated.riverFloodplainFit &&
      stored.coarseHydrologyProfileSha256 ===
        recalculated.coarseHydrologyProfileSha256,
    `stored ranking mismatch at rank ${index + 1}`,
  );
}

assert(
  ranking.selectionRule.comparisonScope ===
    "every_currently_selected_real_measurement_window" &&
    ranking.selectionRule.historicalRgbRead === false &&
    ranking.selectionRule.historicalConditionGeometryRead === false &&
    ranking.selectionRule.exactRealWorldGeometryCarriedIntoGameCoordinates ===
      false &&
    ranking.counts.currentlySelectedWindows ===
      parentPlan.assignments.length &&
    ranking.counts.unusedWindowsRanked === unusedCandidates.length,
  "replacement comparison scope or source boundary mismatch",
);
assert(
  plan.outputBoundary.imageGenerationStarted === false &&
    plan.outputBoundary.rgbCreated === false &&
    plan.outputBoundary.gpuTrainingStarted === false &&
    plan.outputBoundary.runtimeFrameEligible === false &&
    plan.outputBoundary.canEnterWorld === false &&
    ranking.outputBoundary.imageGenerationStarted === false &&
    ranking.outputBoundary.rgbCreated === false &&
    ranking.outputBoundary.gpuTrainingStarted === false,
  "replacement crossed the no-compute boundary",
);

const runRoot = path.dirname(path.join(ROOT, latest.runPath));
const forbiddenFiles = fs
  .readdirSync(runRoot, { recursive: true })
  .filter((entry) =>
    /\.(png|jpe?g|webp|pt|pth|ckpt|safetensors)$/i.test(entry),
  );
assert(
  forbiddenFiles.length === 0,
  `replacement run contains forbidden artifacts: ${forbiddenFiles.join(", ")}`,
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
for (const requiredPath of [
  latest.runPath,
  plan.candidateWindowsPath,
  plan.replacementEvidence.path,
]) {
  assert(
    indexedArtifacts.has(requiredPath),
    `SQLite artifact index missing: ${requiredPath}`,
  );
}
assert(indexedEvents >= 2, "SQLite bilingual event evidence is incomplete");

console.log(
  JSON.stringify(
    {
      ok: true,
      status: "slot_123_real_measurement_window_replacement_passed",
      runId: plan.runId,
      previousCandidateId: parentAssignment.candidateId,
      selectedCandidateId: currentAssignment.candidateId,
      selectedDirectFingerprint:
        currentAssignment.fingerprints.direct,
      unusedWindowsIndependentlyRanked: unusedCandidates.length,
      selectedWindowsCompared: selectedProfiles.length,
      minimumDistanceFromAnySelected:
        recalculatedRankings[0].minimumDistanceFromAnySelected,
      distanceFromCurrentSlot123Window:
        recalculatedRankings[0].distanceFromCurrentSlot123Window,
      indexedArtifacts: indexedArtifacts.size,
      indexedEvents,
      imageGenerationStarted: false,
      rgbCreated: 0,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
);

function profileDistance(left, right) {
  const leftFeatures = profileFeatures(left);
  const rightFeatures = profileFeatures(right);
  assert(
    leftFeatures.length === rightFeatures.length,
    "coarse hydrology feature length mismatch",
  );
  return round(
    leftFeatures.reduce(
      (total, value, index) =>
        total + Math.abs(value - rightFeatures[index]),
      0,
    ) / leftFeatures.length,
  );
}

function profileFeatures(profile) {
  assert(
    profile.coarseBands?.length === 8,
    "coarse hydrology profile must contain eight bands",
  );
  return profile.coarseBands.flatMap((band) =>
    FEATURE_KEYS.map((key) => {
      const value = band[key];
      assert(Number.isFinite(value), `coarse feature missing: ${key}`);
      return value;
    }),
  );
}

function compareRankings(left, right) {
  return (
    right.minimumDistanceFromAnySelected -
      left.minimumDistanceFromAnySelected ||
    right.distanceFromCurrentSlot123Window -
      left.distanceFromCurrentSlot123Window ||
    right.riverFloodplainFit - left.riverFloodplainFit ||
    left.candidateId.localeCompare(right.candidateId)
  );
}

function scoreCandidate(candidate, slot) {
  const metrics = candidate.metrics;
  const relief = metrics.relativeRelief;
  const elevation = metrics.relativeElevation;
  const slope = metrics.normalizedSlope.mean;
  const drainage = metrics.drainageLikelihoodRatio;
  const forest = metrics.reconstructedLandCoverRatio.treeCover;
  const grass = metrics.reconstructedLandCoverRatio.grassland;
  const flatness = 1 - Math.min(1, slope);
  const type = slot.regionalLandscapeType;
  let score = forest * 0.25 + relief * 0.2 + drainage * 0.1;
  if (/mountain|foothill|rocky|low-hill/.test(type)) {
    score += relief * 1.5 + slope * 1.1 + elevation * 0.5;
  }
  if (/valley|floodplain|drainage|riverbank|stream/.test(type)) {
    score += drainage * 2 + flatness * 0.45 + (1 - elevation) * 0.25;
  }
  if (/swamp|marsh|pond|creek/.test(type)) {
    score += drainage * 2.5 + flatness * 0.6 + (1 - elevation) * 0.35;
  }
  if (/grassland|glade|transition/.test(type)) {
    score += grass * 5 + flatness * 0.45 + (1 - forest) * 0.2;
  }
  if (/forest|woodland|bamboo|teak/.test(type)) {
    score += forest * 0.8 + relief * 0.25;
  }
  if (slot.monsoonSeason === "wet_season") score += drainage * 0.4;
  if (slot.monsoonSeason === "dry_season") {
    score += metrics.reconstructedLandCoverRatio.bareOrSparse * 2;
  }
  score -= metrics.humanRemovalRatio * 0.5;
  return score;
}

function assertHash(relativePath, expectedHash) {
  assert(
    sha256File(relativePath) === expectedHash,
    `artifact hash mismatch: ${relativePath}`,
  );
}

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.resolve(ROOT, relativePath), "utf8"),
  );
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.resolve(ROOT, filePath)))
    .digest("hex");
}

function round(value) {
  return Number(value.toFixed(8));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
