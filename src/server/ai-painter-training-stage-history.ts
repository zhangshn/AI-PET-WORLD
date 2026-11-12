import path from "node:path";
import type { readCurrentExecutionRegistry } from "@/server/ai-painter-current-execution-registry.mjs";
import type { TrainingStageDetail, TrainingEpochMetric, TrainingStagePreview } from "@/server/ai-painter-current-training-types";
import { classifyBoundActiveTrainingProgress, adaptV24TrainingProgress, normalizeTokenAccounting, normalizeLiveProgress, directCleanLatentLiveProgress, toEpochMetric, stageNumber, sameCounts, object, arrayObjects, text, number, numberRecord, strings, type JsonObject } from "@/server/ai-painter-training-progress-projection";

type CurrentExecutionRegistrySnapshot = Awaited<ReturnType<typeof readCurrentExecutionRegistry>>;
export type CurrentTrainingSource = {
  absoluteRoot: string;
  relativeRoot: string;
  runId: string;
  packageId: string | null;
  artifactDirectory: string | null;
  role: "active" | "latest";
};

type StageHistoryInputs = {
  discoverCurrentTrainingSources: (registry: CurrentExecutionRegistrySnapshot) => Promise<CurrentTrainingSource[]>;
  listDirectory: (absolutePath: string) => Promise<Array<{ name: string; isFile(): boolean }>>;
  readJson: (relativePath: string) => Promise<JsonObject | null>;
  sha256: (relativePath: string) => Promise<string | null>;
  expectedSplits: Record<string, number>;
};

// Only projects selected evidence. The caller owns current identity and all IO.
export function createTrainingStageHistoryReader({ discoverCurrentTrainingSources, listDirectory, readJson, sha256, expectedSplits }: StageHistoryInputs) {
  async function readTrainingStages(
    registry: CurrentExecutionRegistrySnapshot,
  ): Promise<TrainingStageDetail[]> {
    const stages: TrainingStageDetail[] = [];
    const sources = await discoverCurrentTrainingSources(registry);
    for (const source of sources) {
      const entries = [{ name: source.runId, isDirectory: () => true }];
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name !== source.runId)
          continue;
        const artifactSuffix = source.artifactDirectory
          ? `/${source.artifactDirectory}`
          : "";
        const relativeArtifactRoot = `${source.relativeRoot}/${entry.name}${artifactSuffix}`;
        const relativeManifest = `${relativeArtifactRoot}/manifest.json`;
        const relativeProgress = `${relativeArtifactRoot}/progress.json`;
        const manifest = await readJson(relativeManifest);
        const progress = manifest ? null : await readJson(relativeProgress);
        if (source.role === "active") {
          const activeBinding = classifyBoundActiveTrainingProgress(
            registry.ok ? registry.registry : null,
            progress,
          );
          if (
            activeBinding.status !== "connected" ||
            activeBinding.source?.runId !== source.runId ||
            activeBinding.source.packageId !== source.packageId ||
            activeBinding.source.progressPath !== relativeProgress
          )
            continue;
        }
        const record = manifest ?? progress;
        if (!record) continue;
        const executionPackagePath = `${source.relativeRoot}/${entry.name}/execution-package.json`;
        const executionPackage =
          source.role === "active"
            ? await readJson(executionPackagePath)
            : null;
        const v24LiveProgress =
          source.role === "active" && progress
            ? adaptV24TrainingProgress(progress, executionPackage)
            : null;
        const executionTerminalPath = `${source.relativeRoot}/${entry.name}/phase-terminal.json`;
        const executionTerminal = source.artifactDirectory
          ? await readJson(executionTerminalPath)
          : null;
        const tokenLedgerPath = `.runtime/ai-painter/training-token-ledgers/${entry.name}/ledger.json`;
        const tokenLedger = await readJson(tokenLedgerPath);
        const metrics = arrayObjects(record.metrics).map(toEpochMetric);
        const previewReviewCandidates = [
          `${source.relativeRoot}/${entry.name}/machine-review.json`,
          `${relativeArtifactRoot}/fixed-preview-hard-gate-review.json`,
          `${relativeArtifactRoot}/fixed-preview-reviews.json`,
        ];
        const previewReviewEntries = await Promise.all(
          previewReviewCandidates.map(async (candidatePath) => ({
            path: candidatePath,
            value: await readJson(candidatePath),
          })),
        );
        const selectedPreviewReview = previewReviewEntries.find(
          (candidate) => candidate.value,
        );
        const previewReviewPath =
          selectedPreviewReview?.path ?? previewReviewCandidates[0];
        const previewReview = selectedPreviewReview?.value ?? null;
        const previews = await readStagePreviews({
          sourceAbsoluteRoot: source.absoluteRoot,
          sourceRelativeRoot: source.relativeRoot,
          runId: entry.name,
          artifactDirectory: source.artifactDirectory,
          metrics,
          previewReview,
        });
        const splitMetrics = object(record.splitMetrics);
        const resolution = object(record.resolutionStage) ?? object(record.resolution);
        const executionClosed = executionTerminal?.executionState === "completed";
        const activeExecutionState = text(record.executionState);
        const stageStatus =
          source.role === "active"
            ? activeExecutionState === "executing"
              ? "running"
              : activeExecutionState === "checkpoint_selected_review_pending"
                ? "pending_validation"
                : "unknown_or_stale"
            : executionClosed
          ? (text(executionTerminal?.status) ??
            text(record.status) ??
            "completed")
          : (text(record.status) ?? "unknown");
        stages.push({
          runId: entry.name,
          kind: entry.name.includes("smoke") ? "smoke" : "stage",
          status: stageStatus,
          verdict:
            executionClosed &&
            /failure|failed|rejected|closed/iu.test(stageStatus)
              ? "failed"
              : source.role === "active"
                ? stageStatus === "running"
                  ? "running"
                  : stageStatus === "pending_validation"
                    ? "pending_validation"
                    : "quarantined"
              : manifest
                ? trainingVerdict(manifest, entry.name, previewReview)
                : stageStatus === "running" || stageStatus === "starting"
                  ? "running"
                  : "quarantined",
          resolutionStage:
            number(record.resolutionStage ?? record.stageIndex ?? record.stage) ??
            stageNumber(entry.name),
          resolution: resolution
            ? {
                width: number(resolution.width) ?? 0,
                height: number(resolution.height) ?? 0,
              }
            : null,
          createdAtUtc: text(record.createdAtUtc ?? record.startedAtUtc),
          createdAtAsiaShanghai: text(
            record.createdAtAsiaShanghai ?? record.startedAtAsiaShanghai,
          ),
          updatedAtUtc: text(
            executionTerminal?.recordedAtUtc ??
              record.updatedAtUtc ??
              record.completedAtUtc ??
              record.createdAtUtc,
          ),
          updatedAtAsiaShanghai: text(
            record.updatedAtAsiaShanghai ??
              record.completedAtAsiaShanghai ??
              record.createdAtAsiaShanghai,
          ),
          durationSeconds: number(record.durationSeconds),
          device: text(record.device),
          epochCount:
            source.role === "active"
              ? (number(record.completedEpochs) ?? 0)
              : metrics.length,
          bestEpoch: number(record.bestEpoch ?? record.selectedEpoch),
          bestValidationMetric: number(record.bestValidationMetric),
          checkpointPath:
            text(record.checkpointPath) ??
            text(object(record.selectedCheckpoint)?.path),
          checkpointSha256: text(record.checkpointSha256),
          parentCheckpointPath: text(record.parentDenoiserCheckpointPath),
          parentCheckpointSha256: text(record.parentDenoiserCheckpointSha256),
          manifestPath: manifest ? relativeManifest : relativeProgress,
          manifestSha256: await sha256(
            manifest ? relativeManifest : relativeProgress,
          ),
          conditionBoundSampleCount: number(record.conditionBoundSampleCount),
          actualLoadedConditionalSampleCount: number(
            record.actualLoadedConditionalSampleCount,
          ),
          actualLoadedV7CapacityCount: number(record.actualLoadedV7CapacityCount),
          actualLoadedSplitCounts: numberRecord(record.actualLoadedSplitCounts),
          tokenLedgerPath: tokenLedger ? tokenLedgerPath : null,
          tokenLedgerSha256: tokenLedger ? await sha256(tokenLedgerPath) : null,
          tokenAccounting: normalizeTokenAccounting(
            object(record.trainingTokenAccounting) ??
              object(tokenLedger?.trainingTokenAccounting),
          ),
          liveProgress:
            v24LiveProgress ??
            normalizeLiveProgress(
              object(record.liveProgress) ?? directCleanLatentLiveProgress(record),
            ),
          splitMetrics: Object.fromEntries(
            Object.entries(splitMetrics ?? {}).map(([key, value]) => {
              const row = object(value);
              return [
                key,
                {
                  sampleCount: number(row?.sampleCount),
                  status: text(row?.status),
                },
              ];
            }),
          ),
          blockers: executionClosed
            ? [stageStatus]
            : strings(record.remainingBlockers),
          metrics,
          previewReviewPath: previewReview ? previewReviewPath : null,
          previewReviewSha256: previewReview
            ? await sha256(previewReviewPath)
            : null,
          previewGateStatus: text(previewReview?.status),
          previews,
          error: null,
        });
      }
      if (source.role !== "latest") continue;
      const failureRoot = path.join(source.absoluteRoot, "failures");
      const failures = await listDirectory(failureRoot).catch(
        () => [],
      );
      for (const entry of failures) {
        if (
          !entry.isFile() ||
          !entry.name.endsWith(".json") ||
          entry.name === "latest.json"
        )
          continue;
        const relativePath = `${source.relativeRoot}/failures/${entry.name}`;
        const failure = await readJson(relativePath);
        if (!failure) continue;
        stages.push({
          runId: text(failure.runId) ?? entry.name.replace(/\.json$/, ""),
          kind: "failure",
          status: text(failure.status) ?? "failed",
          verdict: "failed",
          resolutionStage: number(failure.resolutionStage),
          resolution: null,
          createdAtUtc: text(
            failure.failedAtUtc ?? failure.createdAtUtc ?? failure.timestampUtc,
          ),
          createdAtAsiaShanghai: text(
            failure.failedAtAsiaShanghai ??
              failure.createdAtAsiaShanghai ??
              failure.timestampAsiaShanghai,
          ),
          updatedAtUtc: text(
            failure.updatedAtUtc ??
              failure.failedAtUtc ??
              failure.createdAtUtc ??
              failure.timestampUtc,
          ),
          updatedAtAsiaShanghai: text(
            failure.updatedAtAsiaShanghai ??
              failure.failedAtAsiaShanghai ??
              failure.createdAtAsiaShanghai ??
              failure.timestampAsiaShanghai,
          ),
          durationSeconds: null,
          device: null,
          epochCount: 0,
          bestEpoch: null,
          bestValidationMetric: null,
          checkpointPath: null,
          checkpointSha256: null,
          parentCheckpointPath: null,
          parentCheckpointSha256: null,
          manifestPath: relativePath,
          manifestSha256: await sha256(relativePath),
          conditionBoundSampleCount: null,
          actualLoadedConditionalSampleCount: null,
          actualLoadedV7CapacityCount: null,
          actualLoadedSplitCounts: {},
          tokenLedgerPath: null,
          tokenLedgerSha256: null,
          tokenAccounting: null,
          liveProgress: null,
          splitMetrics: {},
          blockers: strings(failure.blockers),
          metrics: [],
          previewReviewPath: null,
          previewReviewSha256: null,
          previewGateStatus: null,
          previews: [],
          error: text(failure.error ?? failure.stderr),
        });
      }
    }
    return stages.sort(
      (left, right) =>
        Date.parse(left.createdAtUtc ?? "") -
        Date.parse(right.createdAtUtc ?? ""),
    );
  }
  
  function trainingVerdict(
    manifest: JsonObject,
    runId: string,
    previewReview: JsonObject | null,
  ): TrainingStageDetail["verdict"] {
    if (
      runId.includes("smoke") &&
      manifest.status === "conditional_denoiser_program_smoke_test_passed"
    )
      return "passed";
    if (
      runId.includes("single-sample-overfit-smoke") &&
      manifest.status ===
        "conditional_denoiser_single_sample_overfit_smoke_completed"
    )
      return previewReview?.status === "passed" ? "passed" : "quarantined";
    if (
      manifest.status ===
      "training_completed_pending_automatic_machine_review"
    )
      return previewReview?.status === "machine_reviews_passed"
        ? "passed"
        : "pending_validation";
    const repaired =
      number(manifest.actualLoadedConditionalSampleCount) === 64 &&
      number(manifest.actualLoadedV7CapacityCount) === 64 &&
      sameCounts(numberRecord(manifest.actualLoadedSplitCounts), expectedSplits);
    return repaired &&
      manifest.status ===
        "conditional_denoiser_training_completed_pending_validation"
      ? "pending_validation"
      : "quarantined";
  }
  
  async function readStagePreviews({
    sourceAbsoluteRoot,
    sourceRelativeRoot,
    runId,
    artifactDirectory,
    metrics,
    previewReview,
  }: {
    sourceAbsoluteRoot: string;
    sourceRelativeRoot: string;
    runId: string;
    artifactDirectory: string | null;
    metrics: TrainingEpochMetric[];
    previewReview: JsonObject | null;
  }): Promise<TrainingStagePreview[]> {
    const previewRoot = path.join(
      sourceAbsoluteRoot,
      runId,
      ...(artifactDirectory ? [artifactDirectory] : []),
      "fixed-epoch-previews",
    );
    const entries = await listDirectory(previewRoot).catch(
      () => [],
    );
    const reviews = arrayObjects(previewReview?.reviews);
    return Promise.all(
      entries
        .filter(
          (entry) =>
            entry.isFile() && /^epoch-\d+.*\.(png|jpe?g|webp)$/i.test(entry.name),
        )
        .map(async (entry) => {
          const epoch = Number(entry.name.match(/^epoch-(\d+)/i)?.[1] ?? 0);
          const artifactSuffix = artifactDirectory ? `/${artifactDirectory}` : "";
          const relativePath = `${sourceRelativeRoot}/${runId}${artifactSuffix}/fixed-epoch-previews/${entry.name}`;
          const review =
            reviews.find((row) => number(row.epoch) === epoch) ??
            reviews.find((row) => text(row.previewPath) === relativePath) ??
            null;
          const metric = metrics.find((row) => row.epoch === epoch) ?? null;
          return {
            epoch,
            recordedAtUtc: metric?.recordedAtUtc ?? null,
            recordedAtAsiaShanghai: metric?.recordedAtAsiaShanghai ?? null,
            imagePath: relativePath,
            imageSha256: await sha256(relativePath),
            normalizedReviewImagePath: text(
              review?.normalizedReviewImagePath ?? review?.normalizedPath,
            ),
            normalizedReviewImageSha256: text(
              review?.normalizedReviewImageSha256 ?? review?.normalizedSha256,
            ),
            machineReviewPassed:
              typeof review?.passed === "boolean" ? review.passed : null,
            machineReviewIssueCodes: strings(review?.issueCodes),
          } satisfies TrainingStagePreview;
        }),
    ).then((rows) => rows.sort((left, right) => left.epoch - right.epoch));
  }
  return readTrainingStages;
}
