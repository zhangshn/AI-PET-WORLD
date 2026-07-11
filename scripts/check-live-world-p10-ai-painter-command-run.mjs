import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const runRecordPath = path.join(root, "data/live-world/visual-generation-dispatches/p10-active-chunks/ai-painter-command-run.json");
const latestPath = path.join(root, "data/live-world/visual-generation-dispatches/latest-ai-painter-command-run.json");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

const runRecord = JSON.parse(await readFile(runRecordPath, "utf8"));
const latest = JSON.parse(await readFile(latestPath, "utf8"));

assert(runRecord.runVersion === "live-world-p10-ai-painter-command-run-v1", "invalid command run version");
assert(runRecord.dispatchId === "p10-ai-painter-dispatch-0001", "dispatchId mismatch");
assert(
  runRecord.status === "blocked_missing_ai_painter_command" || runRecord.status === "completed",
  `unexpected command run status: ${runRecord.status}`,
);
assert(runRecord.entries.length === 9, "command run must cover 9 candidates");
assert(runRecord.forbiddenSideEffects.writesApprovedVisuals === false, "command run must not write approved visuals");
assert(runRecord.forbiddenSideEffects.writesTrainingSamples === false, "command run must not write training samples");
assert(runRecord.forbiddenSideEffects.bypassesRuntimePageGate === false, "command run must not bypass page gate");

for (const requiredEnv of [
  "LIVE_WORLD_CANDIDATE_ID",
  "LIVE_WORLD_CHUNK_ID",
  "LIVE_WORLD_INPUT_PATH",
  "LIVE_WORLD_OUTPUT_IMAGE_PATH",
  "LIVE_WORLD_OUTPUT_META_PATH",
  "LIVE_WORLD_CANDIDATE_ROOT",
]) {
  assert(runRecord.commandProtocol.inputEnv.includes(requiredEnv), `missing protocol env: ${requiredEnv}`);
}

if (runRecord.status === "blocked_missing_ai_painter_command") {
  assert(runRecord.aiPainterCommand === null, "blocked run must not contain an implicit command");
  assert(runRecord.generatedCount === 0, "blocked run must not fabricate generated images");
  assert(runRecord.failedCount === 0, "missing command should not be recorded as model failure");
  assert(runRecord.blockedCount === 9, "all candidates must be blocked without command");
  for (const entry of runRecord.entries) {
    assert(entry.status === "blocked", `entry must be blocked: ${entry.candidateId}`);
    assert(entry.exitCode === null, `blocked entry must not have exitCode: ${entry.candidateId}`);
    assert(entry.imageGenerated === false, `blocked entry must not be generated: ${entry.candidateId}`);
    assert(entry.imageHash === null, `blocked entry must not have image hash: ${entry.candidateId}`);
    assert(entry.errorMessage === "LIVE_WORLD_AI_PAINTER_COMMAND is not configured.", `blocked message mismatch: ${entry.candidateId}`);
    assert(await fileExists(path.join(root, entry.inputPath)), `candidate input missing: ${entry.candidateId}`);
    assert(await fileExists(path.join(root, entry.outputMetaPath)), `output meta missing: ${entry.candidateId}`);
    assert(!(await fileExists(path.join(root, entry.outputImagePath))), `output image must not be fabricated: ${entry.candidateId}`);
  }
}

if (runRecord.status === "completed") {
  assert(runRecord.aiPainterCommand === "node scripts/run-live-world-p10-local-ai-painter-adapter.mjs", "completed run must use the local AI Painter adapter");
  assert(runRecord.generatedCount === 9, "completed run must generate all 9 active chunk candidates");
  assert(runRecord.failedCount === 0, "completed run must not contain failed candidates");
  assert(runRecord.blockedCount === 0, "completed run must not contain blocked candidates");
  for (const entry of runRecord.entries) {
    assert(entry.status === "generated", `entry must be generated: ${entry.candidateId}`);
    assert(entry.exitCode === 0, `generated entry must exit with 0: ${entry.candidateId}`);
    assert(entry.imageGenerated === true, `generated entry must be marked generated: ${entry.candidateId}`);
    assert(typeof entry.imageHash === "string" && entry.imageHash.length === 64, `generated entry must have sha256: ${entry.candidateId}`);
    assert(entry.errorMessage === null, `generated entry must not have error message: ${entry.candidateId}`);
    assert(await fileExists(path.join(root, entry.inputPath)), `candidate input missing: ${entry.candidateId}`);
    assert(await fileExists(path.join(root, entry.outputMetaPath)), `output meta missing: ${entry.candidateId}`);
    assert(await fileExists(path.join(root, entry.outputImagePath)), `output image missing: ${entry.candidateId}`);
  }
}

assert(latest.runId === runRecord.runId, "latest runId mismatch");
assert(latest.status === runRecord.status, "latest status mismatch");
assert(latest.generatedCount === runRecord.generatedCount, "latest generatedCount mismatch");
assert(latest.blockedCount === runRecord.blockedCount, "latest blockedCount mismatch");

console.log("P10 AI Painter command run check passed");
console.log(`runId=${runRecord.runId}`);
console.log(`status=${runRecord.status}`);
console.log(`generatedCount=${runRecord.generatedCount}`);
console.log(`blockedCount=${runRecord.blockedCount}`);
