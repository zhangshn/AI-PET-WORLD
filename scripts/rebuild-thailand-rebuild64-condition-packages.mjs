import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs";

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(
  ROOT,
  "data/ai-painter/system-governance/thailand-rebuild64-sequence-registry-v1.json",
);
const CONDITION_ROOT = path.join(
  ROOT,
  ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs",
);
const OUTPUT_ROOT =
  ".runtime/ai-painter/thailand-rebuild64-condition-package-batches";
const COMPOSITION_REVISION =
  "owner-authorized-thailand-rebuild64-full-world-dynamic-readiness-v3-20260731";
const OWNER_AUTHORIZATION_ID =
  "owner-authorized-thailand-rebuild64-full-world-dynamic-readiness-upgrade-20260731";
const createdAtUtc = new Date().toISOString();
const runId = `thailand-rebuild64-condition-package-batch-${createdAtUtc.replace(/[:.]/g, "-")}`;
const progressPath = path.join(ROOT, OUTPUT_ROOT, "active-progress.json");
const registry = readJson(REGISTRY_PATH);
const targets = registry.entries;

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  type: "thailand_rebuild64_condition_package_batch_started",
  status: "running",
  runId,
  ownerAuthorizationId: OWNER_AUTHORIZATION_ID,
  targetCount: targets.length,
  retainedSlotId: null,
  imageGenerationStarted: false,
  gpuTrainingStarted: false,
});

const results = [];
for (const target of targets) {
  const slotId = target.legacyCapacitySlotId;
  const existing = currentSuccessfulManifest(slotId);
  if (
    existing?.anonymousCompositionArchitectureRevision ===
      COMPOSITION_REVISION &&
    (existing?.anonymousGameCoordinateSeedRevision ?? null) ===
      expectedSeedRevisionForSlot(slotId)
  ) {
    ensureFullWorldConditionGuide(existing);
    results.push(resultFor(target, "reused_current_success", existing));
    persistProgress();
    continue;
  }
  try {
    execFileSync(
      process.execPath,
      [
        "scripts/build-earth-geospatial-complete-map-conditions.mjs",
        `--v7-slot-id=${slotId}`,
        `--v7-slot-composition-revision=${COMPOSITION_REVISION}`,
        ...(expectedSeedRevisionForSlot(slotId)
          ? [`--v7-slot-seed-revision=${expectedSeedRevisionForSlot(slotId)}`]
          : []),
      ],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    execFileSync(
      process.execPath,
      [
        "scripts/check-earth-geospatial-complete-map-conditions.mjs",
        `--v7-slot-id=${slotId}`,
      ],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    const manifest = currentSuccessfulManifest(slotId);
    assert(manifest, `current successful manifest missing after build: ${slotId}`);
    ensureFullWorldConditionGuide(manifest);
    results.push(resultFor(target, "rebuilt_and_checked", manifest));
  } catch (error) {
    results.push({
      sequenceCode: target.sequenceCode,
      slotId,
      status: "failed",
      error: String(error.stderr || error.stdout || error.message || error),
    });
  }
  persistProgress();
}

const failureCount = results.filter((entry) => entry.status === "failed").length;
const report = {
  schemaVersion: "thailand-rebuild64-condition-package-batch-v2",
  runId,
  status: failureCount === 0 ? "all_condition_packages_ready" : "condition_package_failures_present",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  completedAtUtc: new Date().toISOString(),
  ownerAuthorizationId: OWNER_AUTHORIZATION_ID,
  compositionRevision: COMPOSITION_REVISION,
  retainedReference: null,
  counts: {
    target: targets.length,
    passed: targets.length - failureCount,
    failed: failureCount,
  },
  results,
  imageGenerationStarted: false,
  gpuTrainingStarted: false,
};
const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "batch-report.json",
  record: report,
  latest: {
    runId,
    status: report.status,
    passedCount: report.counts.passed,
    failedCount: report.counts.failed,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
});
appendAiPainterProgramEvent({
  timestamp: new Date().toISOString(),
  type: "thailand_rebuild64_condition_package_batch_completed",
  status: failureCount === 0 ? "success" : "blocked",
  runId,
  evidencePath: stored.runPath,
  passedCount: report.counts.passed,
  failedCount: report.counts.failed,
  imageGenerationStarted: false,
  gpuTrainingStarted: false,
});
console.log(JSON.stringify({ ...report.counts, runId, status: report.status, reportPath: stored.runPath }, null, 2));
if (failureCount > 0) process.exitCode = 1;

function persistProgress() {
  writeJsonAtomic(progressPath, {
    schemaVersion: "thailand-rebuild64-condition-package-batch-progress-v1",
    runId,
    updatedAtUtc: new Date().toISOString(),
    completedCount: results.length,
    targetCount: targets.length,
    passedCount: results.filter((entry) => entry.status !== "failed").length,
    failedCount: results.filter((entry) => entry.status === "failed").length,
    results,
  });
}

function resultFor(target, status, manifest) {
  return {
    sequenceCode: target.sequenceCode,
    slotId: target.legacyCapacitySlotId,
    status,
    conditionId: manifest.conditionId,
    runId: manifest.runId,
    manifestPath: manifest.__manifestPath,
    regionalLandscapeType: manifest.regionalLandscapeType,
    monsoonSeason: manifest.monsoonSeason,
  };
}

function expectedSeedRevisionForSlot(slotId) {
  return {
    "v7-capacity-slot-185":
      "owner-directed-v7-capacity-slot-185-construction-grammar-novelty-revision-1-20260731",
    "v7-capacity-slot-190":
      "owner-directed-v7-capacity-slot-190-owner-rejected-water-route-macro-novelty-revision-1-20260801",
    "v7-capacity-slot-194":
      "owner-directed-v7-capacity-slot-194-owner-rejected-water-route-macro-novelty-revision-1-20260801",
    "v7-capacity-slot-169":
      "owner-directed-v7-capacity-slot-169-full-world-framework-novelty-revision-1-20260731",
    "v7-capacity-slot-201":
      "owner-directed-v7-capacity-slot-201-full-world-route-novelty-revision-1-20260731",
    "v7-capacity-slot-205":
      "owner-directed-v7-capacity-slot-205-full-world-framework-novelty-revision-1-20260731",
  }[slotId] ?? null;
}

function ensureFullWorldConditionGuide(manifest) {
  execFileSync(
    process.execPath,
    [
      "scripts/build-current-world-condition-guide.mjs",
      "--task",
      manifest.taskPath,
      "--condition-pack",
      manifest.conditionPackPath,
    ],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const guideManifestPath = path.join(
    path.dirname(path.resolve(ROOT, manifest.conditionPackPath)),
    "condition-guide-manifest.json",
  );
  const guideManifest = readJson(guideManifestPath);
  assert(
    guideManifest.schemaVersion === "complete-world-condition-guide-v2" &&
      guideManifest.fullWorldRenderingContract?.everyPixelIsInWorld === true &&
      guideManifest.fullWorldRenderingContract?.externalBackdropAllowed === false,
    `full-world condition guide contract missing: ${manifest.v7SlotId}`,
  );
}

function currentSuccessfulManifest(slotId) {
  if (!fs.existsSync(CONDITION_ROOT)) return null;
  const candidates = [];
  for (const entry of fs.readdirSync(CONDITION_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(CONDITION_ROOT, entry.name, "complete-map-condition-run.json");
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = readJson(manifestPath);
    if (
      manifest.v7SlotId === slotId &&
      manifest.status === "complete_map_conditions_ready_rgb_authorization_required"
    ) {
      candidates.push({ ...manifest, __manifestPath: normalize(path.relative(ROOT, manifestPath)) });
    }
  }
  return candidates.sort((left, right) => right.createdAtUtc.localeCompare(left.createdAtUtc))[0] ?? null;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalize(value) {
  return value.replaceAll("\\", "/");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
