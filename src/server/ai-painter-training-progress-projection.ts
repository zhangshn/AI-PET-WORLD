import type { TrainingTokenAccounting, TrainingLiveProgress, TrainingEpochMetric } from "@/server/ai-painter-current-training-types";

// Pure projection of already-read evidence. This module has no process,
// filesystem, registry mutation, training or release dependencies.
export type JsonObject = Record<string, unknown>;

type BoundActiveTrainingProgressSource = {
  runId: string;
  packageId: string;
  outputRoot: string;
  progressPath: string;
};

type BoundActiveTrainingProgressResult = {
  status: "idle" | "connected" | "disconnected" | "rejected";
  reason: string;
  source: BoundActiveTrainingProgressSource | null;
};

export function classifyBoundActiveTrainingProgress(
  registry: Record<string, unknown> | null,
  progress: Record<string, unknown> | null,
): BoundActiveTrainingProgressResult {
  const activeExecution = object(registry?.activeExecution);
  if (!activeExecution) {
    return {
      status: "idle",
      reason: "registry_has_no_active_execution",
      source: null,
    };
  }
  const runId = text(activeExecution.runId);
  const packageId = text(activeExecution.packageId);
  const lockPathValue = text(object(activeExecution.lock)?.path);
  const normalizedLockPath = lockPathValue?.replaceAll("\\", "/") ?? "";
  const pathSegments = normalizedLockPath.split("/");
  const invalidLockPath =
    !runId ||
    !packageId ||
    !normalizedLockPath ||
    normalizedLockPath.startsWith("/") ||
    /^[A-Za-z]:\//u.test(normalizedLockPath) ||
    pathSegments.some((segment) => !segment || segment === "..") ||
    pathSegments.at(-1) !== "execution-lock.json";
  if (invalidLockPath) {
    return {
      status: "rejected",
      reason: "active_execution_lock_path_invalid",
      source: null,
    };
  }
  const outputRoot = pathSegments.slice(0, -1).join("/");
  if (!outputRoot || pathSegments.at(-2) !== runId) {
    return {
      status: "rejected",
      reason: "active_execution_lock_run_identity_mismatch",
      source: null,
    };
  }
  const source = {
    runId,
    packageId,
    outputRoot,
    progressPath: `${outputRoot}/progress.json`,
  };
  if (!progress) {
    return {
      status: "disconnected",
      reason: "active_progress_snapshot_missing",
      source,
    };
  }
  if (
    progress.schemaVersion !==
    "ai-painter-stage4-mvp256-dry-v24-progress-v1"
  ) {
    return {
      status: "rejected",
      reason: "active_progress_schema_invalid",
      source,
    };
  }
  if (progress.runId !== runId || progress.packageId !== packageId) {
    return {
      status: "rejected",
      reason: "active_progress_identity_mismatch",
      source,
    };
  }
  const actualEpoch = progress.actualEpoch;
  const completedEpochs = progress.completedEpochs;
  const generatorSteps = progress.optimizerStepsGenerator;
  const discriminatorSteps = progress.optimizerStepsDiscriminator;
  if (
    !Number.isSafeInteger(actualEpoch) ||
    Number(actualEpoch) < 0 ||
    !Number.isSafeInteger(completedEpochs) ||
    Number(completedEpochs) < 0 ||
    Number(completedEpochs) > Number(actualEpoch) ||
    !Number.isSafeInteger(generatorSteps) ||
    Number(generatorSteps) < 0 ||
    !Number.isSafeInteger(discriminatorSteps) ||
    Number(discriminatorSteps) < 0
  ) {
    return {
      status: "rejected",
      reason: "active_progress_counter_invalid",
      source,
    };
  }
  const updatedAtUtc = text(progress.updatedAtUtc);
  if (
    !updatedAtUtc ||
    !updatedAtUtc.endsWith("Z") ||
    !Number.isFinite(Date.parse(updatedAtUtc))
  ) {
    return {
      status: "rejected",
      reason: "active_progress_timestamp_invalid",
      source,
    };
  }
  if (
    progress.executionState !== "executing" &&
    progress.executionState !== "checkpoint_selected_review_pending"
  ) {
    return {
      status: "rejected",
      reason: "active_progress_execution_state_invalid",
      source,
    };
  }
  return {
    status: "connected",
    reason: "active_progress_identity_verified",
    source,
  };
}

export function adaptV24TrainingProgress(
  progress: Record<string, unknown>,
  executionPackage: Record<string, unknown> | null,
): TrainingLiveProgress | null {
  if (
    progress.schemaVersion !==
      "ai-painter-stage4-mvp256-dry-v24-progress-v1" ||
    executionPackage?.schemaVersion !==
      "ai-painter-stage4-mvp256-dry-v24-execution-package-v1" ||
    progress.runId !== executionPackage.runId ||
    progress.packageId !== executionPackage.packageId
  )
    return null;
  const trainingPlan = object(executionPackage.trainingPlan);
  const epochTarget = number(trainingPlan?.epochs);
  const generatorTarget = number(trainingPlan?.generatorOptimizerSteps);
  const discriminatorTarget = number(
    trainingPlan?.discriminatorOptimizerSteps,
  );
  const trainRows = number(trainingPlan?.trainRows);
  const generatorSteps = number(progress.optimizerStepsGenerator);
  const discriminatorSteps = number(progress.optimizerStepsDiscriminator);
  const optimizerStep =
    generatorSteps !== null && discriminatorSteps !== null
      ? Math.min(generatorSteps, discriminatorSteps)
      : null;
  const optimizerStepTarget =
    generatorTarget !== null && discriminatorTarget !== null
      ? Math.min(generatorTarget, discriminatorTarget)
      : null;
  const percentage =
    optimizerStep !== null && optimizerStepTarget && optimizerStepTarget > 0
      ? Math.min(100, (optimizerStep / optimizerStepTarget) * 100)
      : null;
  return {
    schemaVersion: text(progress.schemaVersion) ?? "unknown",
    recordedAtUtc: text(progress.updatedAtUtc),
    recordedAtAsiaShanghai: null,
    phase: text(progress.executionState),
    epoch: number(progress.actualEpoch),
    epochTarget,
    batch: null,
    batchTarget: trainRows,
    optimizerStep,
    optimizerStepTarget,
    percentage,
    elapsedSeconds: null,
    etaSeconds: null,
    optimizerStepsPerSecond: null,
    batchLoss: null,
    rollingEpochLoss: null,
    lastBatchDurationSeconds: null,
    samplesInBatch: null,
    validationCompositeScore: null,
    checkpointSelectionScore: null,
    localDenoiserSampleForwardPasses: null,
    localTrainingTokenCount: null,
    localTrainingTokenUnit: null,
  };
}

export function normalizeTokenAccounting(
  value: JsonObject | null,
): TrainingTokenAccounting | null {
  if (!value) return null;
  const terminology = object(value.terminology);
  const externalApi = object(value.externalApi);
  const geometry = object(value.geometry);
  const perEpoch = object(value.perEpoch);
  const postEpoch = object(value.postEpochEvaluation);
  const runTotals = object(value.runTotals);
  const scope = object(value.scope);
  if (
    !terminology ||
    !externalApi ||
    !geometry ||
    !perEpoch ||
    !postEpoch ||
    !runTotals ||
    !scope
  )
    return null;
  return {
    schemaVersion: text(value.schemaVersion) ?? "unknown",
    source: text(value.source) ?? "unknown",
    terminology: {
      localTrainingTokenUnit:
        text(terminology.localTrainingTokenUnit) ?? "unknown",
      isNlpToken: terminology.isNlpToken === true,
      tokenizerUsed: terminology.tokenizerUsed === true,
      noteZh: text(terminology.noteZh) ?? "",
    },
    externalApi: {
      providerCalls: number(externalApi.providerCalls) ?? 0,
      promptTokens: number(externalApi.promptTokens) ?? 0,
      completionTokens: number(externalApi.completionTokens) ?? 0,
      totalTokens: number(externalApi.totalTokens) ?? 0,
      costCny: number(externalApi.costCny) ?? 0,
      measurementStatus: text(externalApi.measurementStatus) ?? "unknown",
      externalAgentConversationTokensAvailableToLocalProgram:
        externalApi.externalAgentConversationTokensAvailableToLocalProgram ===
        true,
    },
    geometry: {
      imageWidth: number(geometry.imageWidth) ?? 0,
      imageHeight: number(geometry.imageHeight) ?? 0,
      imagePixelsPerSample: number(geometry.imagePixelsPerSample) ?? 0,
      latentWidth: number(geometry.latentWidth) ?? 0,
      latentHeight: number(geometry.latentHeight) ?? 0,
      latentSpatialPositionsPerSample:
        number(geometry.latentSpatialPositionsPerSample) ?? 0,
      latentChannels: number(geometry.latentChannels) ?? 0,
      conditionChannels: number(geometry.conditionChannels) ?? 0,
      latentDownsampleFactor: number(geometry.latentDownsampleFactor) ?? 0,
    },
    perEpoch: normalizeComputeCounts(perEpoch),
    postEpochEvaluation: {
      ...normalizeComputeCounts(postEpoch),
      fixedGridSamplePasses: number(postEpoch.fixedGridSamplePasses) ?? 0,
      conditionEvidenceSamplePasses:
        number(postEpoch.conditionEvidenceSamplePasses) ?? 0,
      latentNormalizationEncoderSamples:
        number(postEpoch.latentNormalizationEncoderSamples) ?? 0,
    },
    runTotals: {
      ...normalizeComputeCounts(runTotals),
      epochCount: number(runTotals.epochCount) ?? 0,
      decodedRgbPixelPredictions:
        number(runTotals.decodedRgbPixelPredictions) ?? 0,
    },
    scope: {
      included: strings(scope.included),
      excluded: strings(scope.excluded),
    },
  };
}

export function normalizeLiveProgress(
  value: JsonObject | null,
): TrainingLiveProgress | null {
  if (!value) return null;
  return {
    schemaVersion: text(value.schemaVersion) ?? "unknown",
    recordedAtUtc: text(value.recordedAtUtc),
    recordedAtAsiaShanghai: text(value.recordedAtAsiaShanghai),
    phase: text(value.phase),
    epoch: number(value.epoch),
    epochTarget: number(value.epochTarget),
    batch: number(value.batch),
    batchTarget: number(value.batchTarget),
    optimizerStep: number(value.optimizerStep),
    optimizerStepTarget: number(value.optimizerStepTarget),
    percentage: number(value.percentage),
    elapsedSeconds: number(value.elapsedSeconds),
    etaSeconds: number(value.etaSeconds),
    optimizerStepsPerSecond: number(value.optimizerStepsPerSecond),
    batchLoss: number(value.batchLoss),
    rollingEpochLoss: number(value.rollingEpochLoss),
    lastBatchDurationSeconds: number(value.lastBatchDurationSeconds),
    samplesInBatch: number(value.samplesInBatch),
    validationCompositeScore: number(value.validationCompositeScore),
    checkpointSelectionScore: number(value.checkpointSelectionScore),
    localDenoiserSampleForwardPasses: number(
      value.localDenoiserSampleForwardPasses,
    ),
    localTrainingTokenCount: number(value.localTrainingTokenCount),
    localTrainingTokenUnit: text(value.localTrainingTokenUnit),
  };
}

export function directCleanLatentLiveProgress(
  value: JsonObject,
): JsonObject | null {
  if (
    text(value.schemaVersion) !==
    "stage4-direct-clean-latent-stage0-progress-v1"
  )
    return null;
  const metric = object(value.latestMetric);
  return {
    schemaVersion: text(value.schemaVersion),
    recordedAtUtc: text(value.updatedAtUtc),
    phase: text(value.phase),
    epoch: number(value.currentEpoch),
    epochTarget: number(value.epochTarget),
    batch: number(value.currentBatch),
    batchTarget: number(value.batchTarget),
    optimizerStep: number(value.optimizerStep),
    optimizerStepTarget: number(value.optimizerStepTarget),
    percentage: number(value.percent),
    etaSeconds: number(value.etaSeconds),
    rollingEpochLoss: number(metric?.trainingCompositeLoss),
    validationCompositeScore: number(metric?.validationCompositeLoss),
    checkpointSelectionScore: number(
      metric?.validationCheckpointSelectionScore,
    ),
  };
}

function normalizeComputeCounts(value: JsonObject) {
  return {
    trainingSamplePresentations:
      number(value.trainingSamplePresentations) ?? undefined,
    optimizerSteps: number(value.optimizerSteps) ?? undefined,
    fixedValidationSamplePasses:
      number(value.fixedValidationSamplePasses) ?? undefined,
    rolloutTrajectories: number(value.rolloutTrajectories) ?? undefined,
    rolloutDenoiserSteps: number(value.rolloutDenoiserSteps) ?? undefined,
    decodedRgbFrames: number(value.decodedRgbFrames) ?? undefined,
    denoiserSampleForwardPasses: number(value.denoiserSampleForwardPasses) ?? 0,
    latentSpatialTokens: number(value.latentSpatialTokens) ?? 0,
    latentChannelValues: number(value.latentChannelValues) ?? 0,
    conditionScalarValues: number(value.conditionScalarValues) ?? 0,
  };
}

export function toEpochMetric(row: JsonObject): TrainingEpochMetric {
  return {
    epoch: number(row.epoch) ?? 0,
    recordedAtUtc: text(row.recordedAtUtc),
    recordedAtAsiaShanghai: text(row.recordedAtAsiaShanghai),
    trainCompositeLoss: number(
      row.trainCompositeLoss ?? row.trainingCompositeLoss,
    ),
    validationCompositeScore: number(
      row.validationFixedGridCompositeConditionQualityScore ??
        row.validationCompositeLoss,
    ),
    validationCheckpointScore: number(row.validationCheckpointSelectionScore),
    rolloutWorstTrajectoryScore: number(
      row.validationRolloutWorstTrajectoryQualityScore,
    ),
    bestCheckpointUpdated: row.bestCheckpointUpdated === true,
  };
}

export function stageNumber(runId: string) {
  const match = runId.match(/stage-?(\d+)/);
  return match ? Number(match[1]) : runId.includes("smoke") ? 0 : null;
}

export function countSplits(rows: JsonObject[]) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const split = text(row.split) ?? "unknown";
    counts[split] = (counts[split] ?? 0) + 1;
    return counts;
  }, {});
}

export function sameCounts(
  left: Record<string, number>,
  right: Record<string, number>,
) {
  return Object.keys(right).every((key) => (left[key] ?? 0) === right[key]);
}

export function formatSplits(value: Record<string, number>) {
  return ["train", "validation", "challenge", "regression"]
    .map((key) => value[key] ?? 0)
    .join("/");
}

export function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

export function arrayObjects(value: unknown) {
  return Array.isArray(value)
    ? value.map(object).filter((row): row is JsonObject => Boolean(row))
    : [];
}

export function text(value: unknown) {
  return typeof value === "string" && value.length ? value : null;
}

export function readableHumanText(value: unknown) {
  const candidate = text(value)?.trim() ?? null;
  if (!candidate) return null;
  const questionMarkCount = [...candidate].filter(
    (character) => character === "?",
  ).length;
  if (questionMarkCount / candidate.length >= 0.25) return null;
  return candidate;
}

export function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function numberRecord(value: unknown) {
  const row = object(value);
  if (!row) return {};
  return Object.fromEntries(
    Object.entries(row).flatMap(([key, item]) => {
      const parsed = number(item);
      return parsed === null ? [] : [[key, parsed]];
    }),
  );
}

export function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
