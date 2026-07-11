import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const paths = {
  p12: "data/live-world/owner-reviews/p12-active-chunks/p12-owner-review-decision-batch.json",
  p13: "data/live-world/approved-visuals/p13-approved-visual-promotion-manifest.json",
  p14: "data/live-world/page-gates/p14-runtime-page-gate.json",
  p15Manifest: "data/live-world/training/p15-training-sample-manifest.json",
  p15Run: "data/live-world/training/p15-training-run-record.json",
  p16: "data/live-world/runtime-readiness/p16-runtime-page-readiness.json",
  p17: "data/live-world/closure-reports/p17-live-world-mvp-closure-report.json",
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fileExists(filePath) {
  try {
    await access(path.join(root, filePath));
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(path.join(root, filePath), "utf8"));
}

for (const [key, filePath] of Object.entries(paths)) {
  assert(await fileExists(filePath), `missing ${key}: ${filePath}`);
}

const p12 = await readJson(paths.p12);
const p13 = await readJson(paths.p13);
const p14 = await readJson(paths.p14);
const p15Manifest = await readJson(paths.p15Manifest);
const p15Run = await readJson(paths.p15Run);
const p16 = await readJson(paths.p16);
const p17 = await readJson(paths.p17);

assert(p12.status === "blocked_pending_owner_decision", "P12 must be blocked pending owner decision");
assert(p12.candidateCount === 9, "P12 must cover 9 candidates");
assert(p12.pendingCount === 9, "P12 must keep all candidates pending");
assert(p12.approvedCount === 0, "P12 must not auto approve candidates");
assert(p12.forbiddenSideEffects.writesApprovedVisuals === false, "P12 must not write approved visuals");

assert(p13.status === "blocked_no_owner_approved_visuals", "P13 must block without owner approved visuals");
assert(p13.approvedVisualCount === 0, "P13 must not promote visuals without owner approval");
assert(p13.missingApprovedVisualChunkIds.length === 9, "P13 must report 9 missing approved visuals");

assert(p14.status === "blocked_no_approved_visuals", "P14 gate must block without approved visuals");
assert(p14.canRenderWorldPage === false, "P14 must not allow world rendering");
assert(p14.approvedVisualCount === 0, "P14 approved visual count must be 0");

assert(p15Manifest.totalTrainableSamples === 0, "P15 must have no trainable samples");
assert(p15Manifest.blockedSampleCounts.pending === 9, "P15 must count 9 pending samples");
assert(p15Run.status === "blocked_no_trainable_samples", "P15 run must be blocked");
assert(p15Run.outputArchivePlan.canWriteModelArtifact === false, "P15 must not write model artifacts");

assert(p16.status === "blocked_waiting_for_approved_visuals", "P16 must block runtime readiness");
assert(p16.canRenderWorldPage === false, "P16 must not render world page");
assert(p16.runtimeReadModel.readsCandidates === false, "P16 must not read candidate visuals");

assert(p17.status === "closed_with_owner_approval_blocker", "P17 closure status mismatch");
assert(p17.canRenderWorldPage === false, "P17 must report runtime blocked");
assert(p17.canStartTraining === false, "P17 must report training blocked");
assert(p17.counts.ownerPending === 9, "P17 owner pending count mismatch");
assert(p17.counts.approvedVisuals === 0, "P17 approved visual count mismatch");

console.log("P12-P17 closure check passed");
console.log(`closureStatus=${p17.status}`);
console.log(`ownerPending=${p17.counts.ownerPending}`);
console.log(`canRenderWorldPage=${p17.canRenderWorldPage}`);
