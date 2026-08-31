import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildExpectedTrainingTokenAccounting,
  validateTrainingManifest,
} from "../lib/ai-painter-stage4-v2-controlled-smoke-adapters-v1.mjs";
import { bindAbsolute } from "../lib/ai-painter-stage4-v2-controlled-smoke-common-v1.mjs";

const ARCHITECTURE = "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2";
const SAMPLE = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6";

function canonicalSha(value) {
  const canonical = (item) => {
    if (Array.isArray(item)) return item.map(canonical);
    if (item && typeof item === "object") return Object.fromEntries(
      Object.keys(item).sort().map((key) => [key, canonical(item[key])]),
    );
    return item;
  };
  return crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function write(root, relative, value) {
  const target = path.join(root, ...relative.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.isBuffer(value)
    ? value : `${JSON.stringify(value, null, 2)}\n`);
  return bindAbsolute(root, target);
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-v2-training-manifest-"));
  const packageId = "stage4-v2-controlled-smoke-package-manifest-fixture";
  const runId = "stage4-v2-controlled-smoke-run-manifest-fixture";
  const outputDirectory = ".runtime/ai-painter/stage4-v2-controlled-smoke-output/fixture";
  const config = {
    latentDownsampleFactor: 4, latentChannels: 12, conditionChannels: 23,
    inferenceSteps: 4,
    training: {
      fixedValidationTimesteps: [0, 250, 500, 750],
      shortTrajectorySupervision: { enabled: true, steps: 2 },
      stage4CrossDomainVisualConsistency: { enabled: true },
      checkpointRolloutSeedsPerSample: 2,
      checkpointRolloutWeight: 0.5,
    },
  };
  const baseConfig = write(root, "config/base.json", config);
  const autoencoderCheckpoint = write(root, "data/project-autoencoder.pt", Buffer.from("ae"));
  const autoencoderStateSha256 = "a".repeat(64);
  const stateIntegrity = write(root, "qualification/state-integrity.json", {
    status: "verified_unchanged", autoencoderUnchanged: true,
    autoencoder: {
      checkpointState: autoencoderStateSha256,
      loaded: autoencoderStateSha256,
      beforeQualification: autoencoderStateSha256,
      afterQualification: autoencoderStateSha256,
    },
    denoiser: {
      fixedInitialization: "1".repeat(64),
      beforeQualification: "1".repeat(64),
      afterQualification: "1".repeat(64),
    },
  });
  const qualificationTerminal = write(root, "qualification/terminal.json", {
    status: "stage4_v2_readonly_gpu_qualification_passed",
    packageId: "stage4-v2-readonly-gpu-package-fixture",
    runId: "stage4-v2-readonly-gpu-run-fixture",
    stateIntegrity,
  });
  const conditionPack = write(root, "dataset/sample194-condition-pack.json", {
    schemaVersion: "fixture-condition-pack-v1",
    sampleId: SAMPLE,
    channels: Array.from({ length: 23 }, (_, index) => ({
      id: `channel_${index}`,
    })),
  });
  const datasetRelease = write(root, "dataset/release.json", {
    schemaVersion: "ai-painter-stage4-v2-mvp64-dataset-release-v1",
    datasetReleaseIdentity: "stage4-v2-mvp64-fixture-release",
    samples: [{
      sampleId: SAMPLE,
      split: "validation",
      conditionPack: { path: conditionPack.path, sha256: conditionPack.sha256 },
    }],
  });
  const payload = {
    packageId, runId, outputDirectory, baseConfig,
    autoencoderCheckpoint, readonlyGpuQualificationTerminal: qualificationTerminal,
    datasetRelease,
  };
  const accounting = buildExpectedTrainingTokenAccounting(config);
  const records = [];
  let bestScore = Number.POSITIVE_INFINITY;
  let bestEpoch = 0;
  for (let epoch = 1; epoch <= 30; epoch += 1) {
    const validationScore = 100 - epoch * 2;
    const rolloutScore = epoch;
    const score = validationScore + rolloutScore * 0.5;
    const update = score < bestScore;
    if (update) { bestScore = score; bestEpoch = epoch; }
    records.push({
      epoch, recordedAtUtc: `2026-09-01T00:${String(epoch).padStart(2, "0")}:00.000Z`,
      trainMetrics: { compositeLoss: 10 / epoch },
      validationMetrics: { compositeConditionQualityScore: validationScore },
      rolloutMetrics: { rolloutRgbQualityScore: rolloutScore },
      checkpointSelectionScore: score,
      trainingTokenAccounting: accounting.perEpoch[String(epoch)],
      bestCheckpointUpdated: update,
    });
  }
  let metrics;
  const telemetryRecords = [
    {
      recordedAtUtc: "2026-09-01T00:00:00.000Z", phase: "initializing",
      epoch: 0, optimizerStep: 0, gpuUtilizationPercent: 0,
      deviceMemoryUsedMiB: 512, deviceMemoryUsedBytes: 512 * 1024 * 1024,
      processMemoryAllocatedBytes: 64, processMemoryReservedBytes: 128,
      processPeakGpuMemoryBytes: 128,
    },
    {
      recordedAtUtc: "2026-09-01T00:00:10.000Z", phase: "training",
      epoch: 1, optimizerStep: 0, gpuUtilizationPercent: 90,
      deviceMemoryUsedMiB: 4096, deviceMemoryUsedBytes: 4096 * 1024 * 1024,
      processMemoryAllocatedBytes: 4000, processMemoryReservedBytes: 5000,
      processPeakGpuMemoryBytes: 4096,
    },
    {
      recordedAtUtc: "2026-09-01T01:00:00.000Z", phase: "training_completed",
      epoch: 30, optimizerStep: 30, gpuUtilizationPercent: 10,
      deviceMemoryUsedMiB: 4096, deviceMemoryUsedBytes: 4096 * 1024 * 1024,
      processMemoryAllocatedBytes: 4000, processMemoryReservedBytes: 9000,
      processPeakGpuMemoryBytes: 8192,
    },
  ];
  const resourceTelemetry = write(root, `${outputDirectory}/resource-telemetry.json`, {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-resource-telemetry-v1",
    status: "completed", packageId, runId, samplingIntervalSeconds: 10,
    peakGpuMemoryBytes: 8192, programPeakGpuMemoryBytes: 8192,
    preflightMemoryClaimedAsTrainingPeak: false, records: telemetryRecords,
  });
  const checkpoint = write(root, `${outputDirectory}/best-smoke-checkpoint.pt`, Buffer.from("checkpoint"));
  const metadata = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-checkpoint-metadata-v1",
    status: "controlled_smoke_non_promotable", packageId, runId,
    architectureId: ARCHITECTURE, sampleId: SAMPLE, sampleSplit: "validation",
    seed: 20263722, resolution: { width: 256, height: 192 },
    bestEpoch, bestValidationScore: bestScore, checkpoint,
    denoiserStateSha256: "2".repeat(64),
    autoencoderCheckpoint: {
      path: autoencoderCheckpoint.path, sha256: autoencoderCheckpoint.sha256,
    },
    autoencoderStateSha256, parentDenoiserCheckpoint: null,
    trainingTokenAccountingSha256: canonicalSha(accounting), promotable: false,
    createdAtUtc: "2026-09-01T01:00:00.000Z",
  };
  const checkpointMetadata = write(root,
    `${outputDirectory}/best-smoke-checkpoint.metadata.json`, metadata);
  const fixedConditionTensorSha256 = "c".repeat(64);
  const previews = [1, 5, 10, 20, 30].map((epoch) => {
    const bytes = Buffer.from(`preview-${epoch}`);
    const preview = write(root, `${outputDirectory}/previews/epoch-${epoch}.png`, bytes);
    const reproduction = write(root,
      `${outputDirectory}/reproductions/epoch-${epoch}.png`, bytes);
    const modelStateSha256 = epoch === 30
      ? "2".repeat(64)
      : epoch.toString(16).slice(-1).repeat(64);
    const rgbTensorSha256 = ((epoch % 9) + 1).toString().repeat(64);
    const artifact = (binding) => ({
      schemaVersion: "stage4-unified-training-preview-artifact-v1",
      epoch, sampleId: SAMPLE, conditionLabel: "fixture-condition-194",
      seed: 20266722, seedIndex: 0, sampleIndex: 0,
      denoiserStateSha256: modelStateSha256,
      conditionTensorSha256: fixedConditionTensorSha256,
      rgbTensorSha256,
      latentNormalizationSha256: "d".repeat(64),
      previewPath: binding.path,
      previewSha256: binding.sha256,
      samplingFunction: "evaluate_deterministic_rollout_rgb_quality_v7",
      deterministicAlgorithmsEnabled: true,
      cudnnDeterministic: true,
      cudnnBenchmark: false,
      cublasWorkspaceConfig: ":4096:8",
    });
    const previewReproduction = {
      schemaVersion: "stage4-fixed-epoch-preview-reproduction-v1",
      status: "fixed_epoch_preview_reproduced_exactly",
      epoch, scheduled: true,
      sourcePreview: artifact(preview),
      repeatedPreview: artifact(reproduction),
      modelStateSha256Matches: true,
      conditionTensorSha256Matches: true,
      rgbTensorSha256Matches: true,
      pngByteSha256Matches: true,
    };
    records[epoch - 1].previewReproduction = previewReproduction;
    records[epoch - 1].modelStateSha256 = modelStateSha256;
    return {
      epoch, ...preview,
      reproduction: { ...reproduction, byteExact: true },
      previewReproduction,
      modelStateSha256,
      conditionTensorSha256: fixedConditionTensorSha256,
      rgbTensorSha256,
    };
  });
  metrics = write(root, `${outputDirectory}/epoch-metrics.json`, {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-epoch-metrics-v1",
    packageId, runId, records,
  });
  const manifest = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-training-manifest-v1",
    status: "training_completed", packageId, runId, architectureId: ARCHITECTURE,
    sampleId: SAMPLE, sampleSplit: "validation", seed: 20263722,
    resolution: { width: 256, height: 192 }, epochCount: 30,
    previews,
    fixedSampleConditionTensorIdentity: {
      schemaVersion:
        "ai-painter-stage4-v2-fixed-sample-condition-tensor-identity-v1",
      sampleId: SAMPLE,
      sampleSplit: "validation",
      conditionPack: { path: conditionPack.path, sha256: conditionPack.sha256 },
      conditionTensorSha256: fixedConditionTensorSha256,
    },
    checkpoint: {
      ...checkpoint, promotable: false,
      trainingTokenAccountingSha256: canonicalSha(accounting),
    },
    checkpointMetadata, metrics, resourceTelemetry,
    trainingTokenAccounting: accounting, bestEpoch, bestValidationScore: bestScore,
    historicalDenoiserCheckpointRead: false, parentDenoiserCheckpoint: null,
    modelState: {
      initialSha256: "1".repeat(64), finalSha256: "2".repeat(64),
      terminalEpochStateSha256: "2".repeat(64),
      changedByTraining: true,
    },
    autoencoderState: {
      frozen: true, beforeSha256: autoencoderStateSha256,
      afterSha256: autoencoderStateSha256,
    },
  };
  const manifestPath = path.join(root, ...`${outputDirectory}/manifest.json`.split("/"));
  write(root, `${outputDirectory}/manifest.json`, manifest);
  const validate = () => validateTrainingManifest({ root, projectRoot: root, payload, manifestPath });
  return {
    root, payload, manifestPath, manifest, metadata, metricsPath: path.join(root, ...metrics.path.split("/")),
    metadataPath: path.join(root, ...checkpointMetadata.path.split("/")), validate,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

{
  const value = fixture();
  try { assert.equal(value.validate().bestEpoch, 30); }
  finally { value.cleanup(); }
}

for (const [name, mutate, pattern] of [
  ["alternate_checkpoint_path", (f) => {
    f.manifest.checkpoint.path = `${f.payload.outputDirectory}/old-checkpoint.pt`;
  }, /exact current-run checkpoint identity/u],
  ["forged_selection", (f) => {
    const metrics = JSON.parse(fs.readFileSync(f.metricsPath, "utf8"));
    metrics.records[10].bestCheckpointUpdated = false;
    fs.writeFileSync(f.metricsPath, `${JSON.stringify(metrics, null, 2)}\n`);
    f.manifest.metrics = bindAbsolute(f.root, f.metricsPath);
  }, /best-Checkpoint trace is forged/u],
  ["forged_token", (f) => {
    f.manifest.trainingTokenAccounting.perEpoch["1"].conditionScalars += 1;
  }, /differs from the frozen controlled-Smoke loop/u],
  ["stale_denoiser_state", (f) => {
    f.manifest.modelState.finalSha256 = f.manifest.modelState.initialSha256;
  }, /did not change/u],
  ["wrong_autoencoder_state", (f) => {
    f.manifest.autoencoderState.beforeSha256 = "b".repeat(64);
    f.manifest.autoencoderState.afterSha256 = "b".repeat(64);
  }, /differs from checkpoint metadata/u],
  ["wrong_fixed_initialization", (f) => {
    f.manifest.modelState.initialSha256 = "4".repeat(64);
  }, /initialization differs from readonly qualification/u],
  ["wrong_checkpoint_state_metadata", (f) => {
    const metadata = JSON.parse(fs.readFileSync(f.metadataPath, "utf8"));
    metadata.denoiserStateSha256 = "5".repeat(64);
    fs.writeFileSync(f.metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
    f.manifest.checkpointMetadata = bindAbsolute(f.root, f.metadataPath);
  }, /Denoiser state differs from Manifest final state/u],
  ["substituted_metadata_identity", (f) => {
    const metadata = JSON.parse(fs.readFileSync(f.metadataPath, "utf8"));
    metadata.packageId = "cross-package";
    fs.writeFileSync(f.metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
    f.manifest.checkpointMetadata = bindAbsolute(f.root, f.metadataPath);
  }, /Expected values|strictEqual/u],
  ["missing_full_preview_reproduction", (f) => {
    delete f.manifest.previews[0].previewReproduction;
  }, /full reproduction evidence is missing/u],
  ["wrong_preview_reproduction_schema", (f) => {
    f.manifest.previews[0].previewReproduction.schemaVersion = "forged-schema";
  }, /reproduction schema differs/u],
  ["wrong_preview_reproduction_status", (f) => {
    f.manifest.previews[0].previewReproduction.status = "forged-status";
  }, /reproduction status differs/u],
  ["wrong_preview_reproduction_epoch", (f) => {
    f.manifest.previews[0].previewReproduction.epoch = 2;
  }, /reproduction Epoch differs/u],
  ["unscheduled_preview_reproduction", (f) => {
    f.manifest.previews[0].previewReproduction.scheduled = false;
  }, /reproduction is not scheduled/u],
  ["missing_exact_match_boolean", (f) => {
    delete f.manifest.previews[0].previewReproduction.rgbTensorSha256Matches;
    mutateMetrics(f, (records) => {
      delete records[0].previewReproduction.rgbTensorSha256Matches;
    });
  }, /rgbTensorSha256Matches is forged/u],
  ["false_exact_match_boolean", (f) => {
    f.manifest.previews[0].previewReproduction.pngByteSha256Matches = false;
    mutateMetrics(f, (records) => {
      records[0].previewReproduction.pngByteSha256Matches = false;
    });
  }, /pngByteSha256Matches is forged|did not pass/u],
  ["source_preview_path_tampering", (f) => {
    f.manifest.previews[0].previewReproduction.sourcePreview.previewPath =
      `${f.payload.outputDirectory}/previews/foreign.png`;
    mutateMetrics(f, (records) => {
      records[0].previewReproduction.sourcePreview.previewPath =
        `${f.payload.outputDirectory}/previews/foreign.png`;
    });
  }, /source path differs from Manifest/u],
  ["repeated_preview_sha_tampering", (f) => {
    f.manifest.previews[0].previewReproduction.repeatedPreview.previewSha256 =
      "f".repeat(64);
    mutateMetrics(f, (records) => {
      records[0].previewReproduction.repeatedPreview.previewSha256 =
        "f".repeat(64);
    });
  }, /repeated PNG SHA-256 differs from Manifest/u],
  ["fixed_condition_tensor_identity_tampering", (f) => {
    f.manifest.fixedSampleConditionTensorIdentity.conditionTensorSha256 =
      "f".repeat(64);
  }, /condition identity differs from fixed sample194 tensor/u],
  ["epoch_model_state_tampering", (f) => {
    f.manifest.previews[0].modelStateSha256 = "f".repeat(64);
  }, /model-state identity differs from source evidence/u],
  ["metrics_preview_reproduction_tampering", (f) => {
    mutateMetrics(f, (records) => {
      records[0].previewReproduction.sourcePreview.rgbTensorSha256 =
        "f".repeat(64);
    });
  }, /metrics preview reproduction differs from Manifest/u],
  ["unscheduled_epoch_preview_evidence", (f) => {
    mutateMetrics(f, (records) => {
      records[1].previewReproduction = structuredClone(
        records[0].previewReproduction,
      );
    });
  }, /unscheduled Epoch 2 contains preview reproduction evidence/u],
]) {
  const value = fixture();
  try {
    mutate(value);
    fs.writeFileSync(value.manifestPath, `${JSON.stringify(value.manifest, null, 2)}\n`);
    assert.throws(() => value.validate(), pattern, `${name} was accepted`);
  } finally { value.cleanup(); }
}

function mutateMetrics(value, mutate) {
  const metrics = JSON.parse(fs.readFileSync(value.metricsPath, "utf8"));
  mutate(metrics.records);
  fs.writeFileSync(value.metricsPath, `${JSON.stringify(metrics, null, 2)}\n`);
  value.manifest.metrics = bindAbsolute(value.root, value.metricsPath);
}

process.stdout.write("Stage4 V2 Smoke training Manifest: 1 positive + 21 checkpoint/selection/Token/state/reproduction negatives passed.\n");
