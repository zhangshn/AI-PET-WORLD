import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type {
  CurrentExecutionActivity,
  CurrentTrainingDashboardSnapshot,
  AiPainterTaskCapsule,
  TrainingTokenAccounting,
  TrainingLiveProgress,
  TrainingEpochMetric,
  TrainingStageDetail,
  TrainingStagePreview,
  StrictValidationBatch,
  StrictValidationTokenAccounting,
  V7CapacityRow,
} from "@/server/ai-painter-current-training-types";
import {
  readTrainingControlState,
  readTrainingProcessLedger,
  readTrainingRuntimeStatus,
} from "@/server/ai-painter-training-state";
import { selectAuthoritativeTrainingEvidence } from "@/server/ai-painter-training-status-projection.mjs";
import { selectLiveActivityState } from "@/server/ai-painter-live-activity-projection.mjs";
import { readCurrentExecutionRegistry } from "@/server/ai-painter-current-execution-registry.mjs";
import { projectR5Stage4TaskCapsule } from "@/server/ai-painter-task-capsule-projection.mjs";
import { projectAutonomousStage4TaskCapsule } from "@/server/ai-painter-task-capsule-projection.mjs";

const execFileAsync = promisify(execFile);
const root = process.cwd();
type CurrentExecutionRegistrySnapshot = Awaited<
  ReturnType<typeof readCurrentExecutionRegistry>
>;

type CurrentTrainingSource = {
  absoluteRoot: string;
  relativeRoot: string;
  runId: string;
  artifactDirectory: string | null;
};
const configPath =
  "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json";
const datasetPointerPath =
  "data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json";
const migrationRegistryPath =
  "data/ai-painter/system-governance/local-ai-capability-migration-registry-v1.json";
const validationReconciliationPointerPath =
  ".runtime/ai-painter/v7-post-training-validation-reconciliations/latest.json";
const fullTrainingFinalizationPath =
  ".runtime/ai-painter/v7-bounded-repair-r1-full-training-finalizations/latest.json";
const ownerActionRequestPointerPath =
  ".runtime/ai-painter/owner-action-requests/latest.json";
const r2SmokeFinalizationPointerPath =
  ".runtime/ai-painter/v7-bounded-repair-r2-overfit-smoke-finalizations/latest.json";
const strictValidationRootPath =
  ".runtime/ai-painter/v7-repair-r1-strict-revalidations";
const r5Stage4FinalizationRootPath =
  ".runtime/ai-painter/v7-r5-stage4-bounded-repair-smoke-finalizations";
const validationKernelModelSmokeTerminalPath =
  ".runtime/ai-painter/stage4-validation-kernel-closures/20260810-023613404/model-smoke/model-smoke-20260810-validated-kernel/finalization/phase-terminal.json";
const validationKernelImplementationConsumptionPath =
  ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-validation-kernel-through-stage5-20260810/implementation-consumption.json";
const stageControlConvergenceTerminalPath =
  ".runtime/ai-painter/stage-control-convergence/20260810-182526279/cycles/cycle-3-20260810-185600000/phase-terminal.json";
const uniqueModulePlanPath =
  "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md";
const autonomousStage4CandidatePointerPath =
  ".runtime/ai-painter/stage4-post-carrier-bounded-candidate-recalculations/latest.json";
const expectedSplits = {
  train: 48,
  validation: 8,
  challenge: 4,
  regression: 4,
};
const cacheTtlMs = 2_500;

type JsonObject = Record<string, unknown>;
type PostDecodeFormalExecutionProjection = {
  runId: string;
  statePath: string;
  state: JsonObject;
  terminalPath: string;
  terminal: JsonObject | null;
  reviewPath: string;
  review: JsonObject | null;
  reviewProgressPath: string;
  reviewProgress: JsonObject | null;
  progressPath: string;
  progress: JsonObject | null;
  occurredAtUtc: string | null;
};
type LocalProcessEvidence = {
  pid: number;
  parentPid: number | null;
  name: string;
  startedAtUtc: string | null;
  commandIdentity:
    | "model_training"
    | "model_inference"
    | "validation"
    | "dataset_build"
    | "training_controller";
};
let cached: {
  expiresAt: number;
  value: CurrentTrainingDashboardSnapshot;
} | null = null;
let inFlight: Promise<CurrentTrainingDashboardSnapshot> | null = null;

export function readCurrentTrainingDashboard() {
  if (cached && cached.expiresAt > Date.now())
    return Promise.resolve(cached.value);
  if (inFlight) return inFlight;
  inFlight = buildSnapshot()
    .then((value) => {
      cached = { expiresAt: Date.now() + cacheTtlMs, value };
      return value;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

async function buildSnapshot(): Promise<CurrentTrainingDashboardSnapshot> {
  const [
    config,
    datasetPointer,
    control,
    runtimeStatus,
    gpu,
    hardware,
    ledger,
    authorization,
    migrationRegistry,
    validationReconciliationPointer,
    fullTrainingFinalization,
    localProcesses,
    currentRegistry,
  ] = await Promise.all([
    readJson(configPath),
    readJson(datasetPointerPath),
    readTrainingControlState(),
    readTrainingRuntimeStatus(),
    readGpu(),
    readHardware(),
    readTrainingProcessLedger(),
    readAuthorization(),
    readJson(migrationRegistryPath),
    readJson(validationReconciliationPointerPath),
    readJson(fullTrainingFinalizationPath),
    readRelevantLocalProcesses(),
    readCurrentExecutionRegistry(root),
  ]);
  const rawStages = await readTrainingStages(currentRegistry);
  const rawTaskCapsule = currentRegistry.ok
    ? (currentRegistry.taskCapsule as AiPainterTaskCapsule)
    : buildUnknownRegistryTaskCapsule(currentRegistry.errorCode);
  const taskCapsule = {
    ...rawTaskCapsule,
    latestBlocker: rawTaskCapsule.latestBlocker ?? {
      code: "no_active_blocker",
      summaryZh:
        rawTaskCapsule.nextAllowedAction?.labelZh ??
        "当前任务已登记，等待本地程序推进下一动作。",
    },
    taskIdentity: rawTaskCapsule.taskIdentity ?? {
      modelId: null,
      sampleId: null,
      conditionLabel: null,
      sampleSplit: null,
      seed: null,
      requiredBoundarySides: [],
    },
  } satisfies AiPainterTaskCapsule;
  const activeDirectCleanLatentExecution = currentRegistry.ok
    ? await readActiveDirectCleanLatentStage0Execution(currentRegistry.registry)
    : null;
  const postDecodeFormalExecution = currentRegistry.ok
    ? activeDirectCleanLatentExecution ??
      (currentRegistry.latestTrainingExecution as PostDecodeFormalExecutionProjection | null)
    : null;
  const validationReconciliationPath =
    text(validationReconciliationPointer?.reportPath) ?? "";
  const validationReconciliation = validationReconciliationPath
    ? await readJson(validationReconciliationPath)
    : null;
  const canonicalValidationBatchPath =
    text(object(validationReconciliation?.canonicalBatch)?.reportPath) ?? "";
  const canonicalValidationBatch = canonicalValidationBatchPath
    ? await readJson(canonicalValidationBatchPath)
    : null;
  const strictValidationBatches = await readStrictValidationBatches();
  const strictValidationIssueCounts = strictValidationBatches.reduce<
    Record<string, number>
  >((counts, batch) => {
    for (const trajectory of batch.trajectories) {
      for (const code of trajectory.machineReviewIssueCodes) {
        counts[code] = (counts[code] ?? 0) + 1;
      }
    }
    return counts;
  }, {});
  const validationFailed =
    validationReconciliation?.status === "reconciled_machine_failed_not_formal";
  const fullTrainingResourceBlocked =
    fullTrainingFinalization?.status === "blocked_before_gpu" &&
    strings(fullTrainingFinalization?.blockers).includes(
      "gpu_busy_with_nontraining_workload",
    );
  const fullTrainingCompleted =
    fullTrainingFinalization?.status ===
      "full_stage0_stage1_stage2_training_completed_pending_strict_revalidation" &&
    number(fullTrainingFinalization?.completedStageCount) === 3;
  const datasetManifestPath = text(datasetPointer?.manifestPath) ?? "";
  const datasetManifest = datasetManifestPath
    ? await readJson(datasetManifestPath)
    : null;
  const sourceIndexPath = text(datasetManifest?.sourceIndexPath) ?? "";
  const sourceIndex = sourceIndexPath ? await readJson(sourceIndexPath) : null;
  const samples = arrayObjects(sourceIndex?.samples);
  const v7Rows = samples.filter(
    (row) => row.v7CapacityContributionRegistered === true,
  );
  const loadedRows = samples.filter(isSelectedByCurrentPythonDataset);
  const loadedV7Rows = loadedRows.filter(
    (row) => row.v7CapacityContributionRegistered === true,
  );
  const sourceRecords = new Map(
    await Promise.all(
      v7Rows.map(async (row) => {
        const recordId = text(row.recordId) ?? "unknown-record";
        const sourceRecordPath = text(row.sourceRecordPath);
        return [
          recordId,
          sourceRecordPath ? await readJson(sourceRecordPath) : null,
        ] as const;
      }),
    ),
  );
  const rows: V7CapacityRow[] = v7Rows.map((row) => ({
    recordId: text(row.recordId) ?? "unknown-record",
    slotId: text(row.v7CapacitySlotId),
    split: text(row.split) ?? "unknown",
    conditionLabel: text(row.conditionLabel),
    conditionBound: row.conditionBound === true,
    currentConditionIdentityMatches:
      row.currentConditionIdentityMatches === true,
    capacityRegistered: row.v7CapacityContributionRegistered === true,
    selectedByCurrentPythonDataset: isSelectedByCurrentPythonDataset(row),
    createdAtUtc: text(
      sourceRecords.get(text(row.recordId) ?? "unknown-record")?.createdAtUtc,
    ),
    createdAtAsiaShanghai: text(
      sourceRecords.get(text(row.recordId) ?? "unknown-record")
        ?.createdAtAsiaShanghai,
    ),
    updatedAtUtc: text(
      sourceRecords.get(text(row.recordId) ?? "unknown-record")?.updatedAtUtc,
    ),
    updatedAtAsiaShanghai: text(
      sourceRecords.get(text(row.recordId) ?? "unknown-record")
        ?.updatedAtAsiaShanghai,
    ),
  }));
  const capacitySplits = countSplits(v7Rows);
  const actualSplits = countSplits(loadedRows);
  const mismatchReasons = [
    ...(v7Rows.length !== 64 ? [`容量登记数量=${v7Rows.length}，要求=64`] : []),
    ...(loadedRows.length !== 64
      ? [`Python Dataset实际加载=${loadedRows.length}，要求=64`]
      : []),
    ...(loadedV7Rows.length !== 64
      ? [`实际加载的新64组=${loadedV7Rows.length}，要求=64`]
      : []),
    ...(!sameCounts(capacitySplits, expectedSplits)
      ? ["容量分割不是48/8/4/4"]
      : []),
    ...(!sameCounts(actualSplits, expectedSplits)
      ? [`实际训练分割=${formatSplits(actualSplits)}，要求=48/8/4/4`]
      : []),
  ];
  const currentControlStatus = runtimeStatus.stale
    ? control.status
    : runtimeStatus.status;
  const hasActiveTraining =
    currentControlStatus === "running" || currentControlStatus === "training";
  const stages = rawStages.map((stage) =>
    !hasActiveTraining &&
    localProcesses.length === 0 &&
    (stage.status === "running" || stage.status === "starting")
      ? {
          ...stage,
          status: "stale_historical_record_no_active_process",
          verdict: "quarantined" as const,
          error:
            "历史记录未形成终态，但当前不存在对应训练进程；不得投影为当前运行任务。",
        }
      : stage,
  );
  const currentStages = selectLatestRepairedStages(stages);
  const checkpointLineageValid = validateCheckpointLineage(currentStages);
  const latestTrainingRunId = currentRegistry.ok
    ? text(currentRegistry.registry.latestTrainingTerminal?.runId)
    : null;
  const latestStage = currentStages.find(
    (stage) => stage.runId === latestTrainingRunId,
  );
  const formalTerminalStatus = text(postDecodeFormalExecution?.terminal?.status);
  const formalStage0RealVisualFailure = isFormalStage0TerminalStatus(
    formalTerminalStatus,
    "real_visual_failure",
  );
  const formalStage0Completed = isFormalStage0TerminalStatus(
    formalTerminalStatus,
    "completed",
  );
  const activeTaskIdentity = {
    modelId: taskCapsule.taskIdentity.modelId ?? text(config?.modelId),
    datasetPackageId: text(datasetManifest?.packageId),
    checkpointSha256: latestStage?.checkpointSha256 ?? null,
    trainingChainId: null,
  };
  const projectedStatus = selectAuthoritativeTrainingEvidence(
    [
      {
        code: "current_registry_unknown_or_stale",
        label: "当前执行登记无效，已禁止历史回退",
        summary:
          "唯一当前执行登记缺失、损坏或证据不一致；本地程序已失败关闭，绝不扫描历史Smoke猜测当前任务。",
        currentStep: "repair_current_execution_registry_from_immutable_evidence",
        source: "current_execution_registry",
        occurredAtUtc: null,
        terminalPriority: 130,
        taskIdentity: { ...activeTaskIdentity },
        valid: !currentRegistry.ok,
      },
      {
        code: "candidate_planned",
        label: "新候选已规划，等待CPU未激活实现",
        summary:
          taskCapsule.latestBlocker?.summaryZh ??
          taskCapsule.nextAllowedAction.labelZh,
        currentStep: taskCapsule.nextAllowedAction.code,
        source: "current_execution_registry",
        occurredAtUtc: taskCapsule.candidateTerminal.recordedAtUtc,
        terminalPriority: 120,
        taskIdentity: { ...activeTaskIdentity },
        valid:
          currentRegistry.ok &&
          taskCapsule.integrity.status === "verified" &&
          taskCapsule.candidateTerminal.status === "planned",
      },
      {
        code: "blocked_dataset_binding",
        label: "已阻断：V7样本绑定错误",
        summary:
          "64条V7容量记录未完整进入本次训练；现有checkpoint仅保留为错误样本集合证据。",
        currentStep: "dataset_binding_gate_failed",
        source: "current_dataset_binding_gate",
        occurredAtUtc: new Date().toISOString(),
        terminalPriority: 100,
        taskIdentity: activeTaskIdentity,
        valid: mismatchReasons.length > 0,
      },
      {
        code: "running",
        label: "训练运行中",
        summary: "本地训练控制器存在未过期的运行心跳。",
        currentStep:
          runtimeStatus.heartbeat?.activeStep ?? control.currentStep ?? null,
        source: runtimeStatus.statusSource,
        occurredAtUtc: runtimeStatus.heartbeat?.timestampUtc ?? null,
        terminalPriority: 10,
        taskIdentity: {
          ...activeTaskIdentity,
          trainingChainId: runtimeStatus.heartbeat?.activeTaskId ?? null,
        },
        valid: hasActiveTraining && !runtimeStatus.stale,
      },
      {
        code: "resource_blocked",
        label: "已暂停：GPU资源门禁阻断",
        summary:
          "V7修复R1完整训练在任何Python/GPU训练启动前因非训练GPU负载阻断。",
        currentStep:
          "full_training_paused_resource_gate_authorization_unconsumed",
        source: "v7_r1_full_training_finalization",
        occurredAtUtc: text(fullTrainingFinalization?.createdAtUtc),
        terminalPriority: 80,
        taskIdentity: {
          modelId: activeTaskIdentity.modelId,
          datasetPackageId: text(fullTrainingFinalization?.datasetPackageId),
          checkpointSha256: null,
          trainingChainId: text(fullTrainingFinalization?.chainId),
        },
        valid: fullTrainingResourceBlocked,
      },
      {
        code: "validation_failed",
        label: "训练后验证未通过",
        summary:
          "V7严格留出验证未通过；正式推理、RuntimeFrame和世界运行继续阻断。",
        currentStep: "post_training_validation_failed",
        source: "validation_reconciliation",
        occurredAtUtc: text(validationReconciliation?.createdAtUtc),
        terminalPriority: 90,
        taskIdentity: {
          modelId: text(canonicalValidationBatch?.modelId),
          datasetPackageId: text(canonicalValidationBatch?.datasetPackageId),
          checkpointSha256: text(validationReconciliation?.checkpointSha256),
          trainingChainId: text(
            object(validationReconciliation?.canonicalBatch)?.batchId,
          ),
        },
        valid: validationFailed,
      },
      {
        code: "formal_stage0_real_visual_failure",
        label: "Stage 0验证完成，真实视觉失败",
        summary: postDecodeFormalExecution?.review
          ? `正式Stage 0自动机器审核已完成：${number(postDecodeFormalExecution.review.previewPassCount) ?? 0}/${number(postDecodeFormalExecution.review.previewCount) ?? 0}个固定节点通过；候选已失败关闭并保存证据。`
          : "正式Stage 0自动机器审核失败，候选已失败关闭并保存证据。",
        currentStep: "formal_stage0_failed_closed_after_machine_review",
        source: "current_execution_registry_latest_training_terminal",
        occurredAtUtc: text(postDecodeFormalExecution?.terminal?.recordedAtUtc),
        terminalPriority: 110,
        taskIdentity: { ...activeTaskIdentity },
        valid: formalStage0RealVisualFailure,
      },
      {
        code: "formal_stage0_completed",
        label: "Stage 0训练与验证通过",
        summary: "正式Stage 0训练、固定预览复现和六节点机器审核均已通过。",
        currentStep: "autonomous_stage1_compilation",
        source: "current_execution_registry_latest_training_terminal",
        occurredAtUtc: text(postDecodeFormalExecution?.terminal?.recordedAtUtc),
        terminalPriority: 110,
        taskIdentity: { ...activeTaskIdentity },
        valid: formalStage0Completed,
      },
      {
        code: "formal_stage0_reviewing",
        label: "Stage 0训练完成，机器验证中",
        summary: `40 Epoch训练已完成；本地程序正在审核六个固定预览（${number(postDecodeFormalExecution?.reviewProgress?.completedPreviewCount) ?? 0}/${number(postDecodeFormalExecution?.reviewProgress?.previewCount) ?? 6}）并形成终态。`,
        currentStep: "automatic_machine_review",
        source: "stage4_post_decode_object_rgb_formal_stage0_execution_state",
        occurredAtUtc: text(postDecodeFormalExecution?.state.updatedAtUtc),
        terminalPriority: 20,
        taskIdentity: { ...activeTaskIdentity },
        valid:
          text(postDecodeFormalExecution?.state.status) === "running" &&
          text(postDecodeFormalExecution?.state.phase) === "automatic_machine_review",
      },
      {
        code: "formal_stage0_running",
        label: "Stage 0正式训练进行中",
        summary: "本地程序正在执行40 Epoch正式Stage 0训练。",
        currentStep: "formal_stage0_training",
        source: "stage4_post_decode_object_rgb_formal_stage0_execution_state",
        occurredAtUtc:
          text(postDecodeFormalExecution?.state.updatedAtUtc) ??
          text(postDecodeFormalExecution?.state.startedAtUtc),
        terminalPriority: 10,
        taskIdentity: { ...activeTaskIdentity },
        valid:
          text(postDecodeFormalExecution?.state.status) === "running" &&
          text(postDecodeFormalExecution?.state.phase) === "training",
      },
      {
        code: "controlled_smoke_qualified",
        label: "Smoke验证通过，等待正式Stage 0",
        summary:
          taskCapsule.latestBlocker?.summaryZh ??
          taskCapsule.nextAllowedAction.labelZh,
        currentStep: taskCapsule.nextAllowedAction.code,
        source: "stage4_post_decode_object_rgb_smoke_terminal",
        occurredAtUtc: taskCapsule.candidateTerminal.recordedAtUtc,
        terminalPriority: 92,
        taskIdentity: {
          ...activeTaskIdentity,
        },
        valid:
          taskCapsule.integrity.status === "verified" &&
          taskCapsule.candidateTerminal.status === "qualified",
      },
      {
        code: "candidate_failed_closed",
        label:
          taskCapsule.candidateTerminal.programStatus ===
          "failed_closed_candidate_space_exhausted"
            ? "验证已完成，候选已安全关闭"
            : "Stage4候选失败关闭",
        summary:
          taskCapsule.latestBlocker?.summaryZh ??
          taskCapsule.nextAllowedAction.labelZh,
        currentStep: taskCapsule.nextAllowedAction.code,
        source: "r5_stage4_task_capsule",
        occurredAtUtc: taskCapsule.candidateTerminal.recordedAtUtc,
        terminalPriority: 95,
        taskIdentity: {
          ...activeTaskIdentity,
        },
        valid:
          taskCapsule.integrity.status === "verified" &&
          taskCapsule.candidateTerminal.status === "failed_closed",
      },
      {
        code: "idle",
        label: "空闲",
        summary: "没有与当前模型和数据集匹配的活动训练或更新终态证据。",
        currentStep: null,
        source: "no_matching_current_evidence",
        occurredAtUtc: null,
        terminalPriority: 0,
        taskIdentity: activeTaskIdentity,
        valid: true,
      },
    ],
    activeTaskIdentity,
  );
  const relevantRunIds = new Set(
    stages
      .map((stage) => stage.runId)
      .concat(
        taskCapsule.candidateTerminal.runId ?? "",
        authorization.requestId ?? "",
        text(validationReconciliation?.reconciliationId) ?? "",
        text(object(validationReconciliation?.canonicalBatch)?.batchId) ?? "",
      ),
  );
  const events = ledger.events
    .filter(
      (event) =>
        relevantRunIds.has(event.runId) ||
        event.action === "run_ai_assisted_conditional_denoiser_training" ||
        event.action === "run_ai_assisted_v7_post_training_validation" ||
        event.action === "reconcile_ai_assisted_v7_post_training_validation",
    )
    .slice(0, 120)
    .map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      runId: event.runId,
      action: event.action,
      kind: event.kind,
      status: event.status,
      title:
        readableHumanText(event.titleZh) ??
        text(event.title) ??
        "未命名程序事件",
      detail: readableHumanText(event.detailZh) ?? text(event.detail),
      currentStep: event.currentStep ?? null,
      evidencePath: event.evidencePath ?? null,
    }));
  const training = object(config?.training);
  const projectedActivity = projectCurrentExecutionActivity({
    control,
    runtimeStatus,
    stages,
    epochTarget: number(training?.denoiserEpochs),
    localProcesses,
  });
  const activity = projectPostDecodeFormalExecutionActivity({
    activity: projectedActivity,
    execution: postDecodeFormalExecution,
    stages,
  });
  const dashboardStatus =
    activity.lifecycle === "running" && activity.progress
      ? {
          code: "formal_stage0_running",
          label: "Stage 0正式训练进行中",
          summary: `${activity.progress.stageLabel} ${activity.progress.epoch}/${activity.progress.epochTarget} Epoch，优化步 ${activity.progress.optimizerStep}/${activity.progress.optimizerStepTarget}；训练结束后由本地程序自动审核并形成终态。`,
          currentStep: activity.progress.phase,
          source: activity.source,
          occurredAtUtc: activity.lastHeartbeatAtUtc,
          terminalPriority: 10,
          taskIdentity: {
            modelId: null,
            datasetPackageId: text(datasetManifest?.packageId),
            checkpointSha256: null,
            trainingChainId: activity.progress.runId,
          },
        }
      : projectedStatus;
  return {
    schemaVersion: "ai-painter-current-training-dashboard-v1",
    generatedAtUtc: new Date().toISOString(),
    readOnly: true,
    taskCapsule,
    activity,
    status: dashboardStatus,
    model: {
      modelId: text(config?.modelId),
      architectureVersion: text(config?.architectureVersion),
      denoiserArchitecture: text(config?.denoiserArchitecture),
      predictionTarget: text(config?.predictionTarget),
      conditionChannels: number(config?.conditionChannels),
      conditionChannelOrder: strings(config?.conditionChannelOrder),
      resolutionStages: arrayObjects(training?.resolutionStages).map((row) => ({
        width: number(row.width) ?? 0,
        height: number(row.height) ?? 0,
      })),
      batchSize: number(training?.batchSize),
      epochTargetPerStage: number(training?.denoiserEpochs),
      authorizationStatus: text(training?.trainingAuthorizationStatus),
    },
    dataset: {
      packageId: text(datasetManifest?.packageId),
      manifestPath: datasetManifestPath,
      manifestSha256: datasetManifestPath
        ? await sha256(datasetManifestPath)
        : null,
      createdAtUtc: text(datasetManifest?.createdAtUtc),
      createdAtAsiaShanghai: text(datasetManifest?.createdAtAsiaShanghai),
      registeredCapacityCount: v7Rows.length,
      expectedCapacityCount: 64,
      loadedConditionalSampleCount: loadedRows.length,
      loadedV7CapacityCount: loadedV7Rows.length,
      expectedSplits,
      actualSplits,
      capacitySplits,
      mismatchReasons,
      rows,
    },
    execution: {
      stages,
      totalEpochsExecuted: stages.reduce(
        (sum, stage) => sum + stage.epochCount,
        0,
      ),
      checkpointLineageValid,
      formalInferenceEligible: false,
      checkpointDisposition: mismatchReasons.length
        ? "preserved_nonformal_wrong_sample_set_evidence"
        : fullTrainingResourceBlocked
          ? "repair_r1_full_training_authorized_unconsumed_resource_blocked"
          : fullTrainingCompleted
            ? "repair_r1_training_completed_pending_strict_revalidation"
            : validationFailed
              ? "post_training_validation_failed_nonformal"
              : "pending_post_training_validation",
    },
    validation: {
      latestBatchId: strictValidationBatches.at(0)?.batchId ?? null,
      issueCounts: strictValidationIssueCounts,
      batches: strictValidationBatches,
    },
    gpu,
    hardware,
    authorization,
    migration: {
      registryId: text(migrationRegistry?.registryId),
      status: text(migrationRegistry?.status),
      objectiveZh: text(migrationRegistry?.objectiveZh),
      currentExternalAgentRole: text(
        object(migrationRegistry?.externalAgentBoundary)?.currentRole,
      ),
      targetExternalAgentRole: text(
        object(migrationRegistry?.externalAgentBoundary)?.targetRole,
      ),
      registryPath: migrationRegistryPath,
      registrySha256: await sha256(migrationRegistryPath),
      capabilities: arrayObjects(migrationRegistry?.capabilities).map(
        (row) => ({
          id: text(row.id) ?? "unknown-capability",
          nameZh: text(row.nameZh) ?? "未命名能力",
          currentOwner: text(row.currentOwner) ?? "unknown",
          targetOwner: text(row.targetOwner) ?? "unknown",
          status: text(row.status) ?? "unknown",
          externalAgentRequired: row.externalAgentRequired === true,
          evidence: text(row.evidence),
          nextGateZh: text(row.nextGateZh),
        }),
      ),
    },
    events,
    evidence: [
      ...taskCapsule.evidence.map((item) => ({
        label: `任务胶囊：${item.labelZh}`,
        path: item.path,
        sha256: item.sha256,
        recordedAtUtc: item.recordedAtUtc,
        recordedAtAsiaShanghai: item.recordedAtAsiaShanghai,
      })),
      ...(authorization.requestPath
        ? [
            {
              label: "当前owner动作请求",
              path: authorization.requestPath,
              sha256: authorization.requestSha256,
              recordedAtUtc: authorization.recordedAtUtc,
              recordedAtAsiaShanghai: authorization.recordedAtAsiaShanghai,
            },
          ]
        : []),
      {
        label: "V7模型配置",
        path: configPath,
        sha256: await sha256(configPath),
        recordedAtUtc: text(config?.createdAtUtc ?? config?.updatedAtUtc),
        recordedAtAsiaShanghai: text(
          config?.createdAtAsiaShanghai ?? config?.updatedAtAsiaShanghai,
        ),
      },
      {
        label: "MVP64数据manifest",
        path: datasetManifestPath,
        sha256: datasetManifestPath ? await sha256(datasetManifestPath) : null,
        recordedAtUtc: text(datasetManifest?.createdAtUtc),
        recordedAtAsiaShanghai: text(datasetManifest?.createdAtAsiaShanghai),
      },
      {
        label: "MVP64 source-index",
        path: sourceIndexPath,
        sha256: sourceIndexPath ? await sha256(sourceIndexPath) : null,
        recordedAtUtc: text(sourceIndex?.createdAtUtc),
        recordedAtAsiaShanghai: text(sourceIndex?.createdAtAsiaShanghai),
      },
      {
        label: "本地AI能力迁移注册表",
        path: migrationRegistryPath,
        sha256: await sha256(migrationRegistryPath),
        recordedAtUtc: text(
          migrationRegistry?.updatedAtUtc ?? migrationRegistry?.createdAtUtc,
        ),
        recordedAtAsiaShanghai: text(
          migrationRegistry?.updatedAtAsiaShanghai ??
            migrationRegistry?.createdAtAsiaShanghai,
        ),
      },
      ...(validationReconciliationPath
        ? [
            {
              label: "V7训练后验证权威对账",
              path: validationReconciliationPath,
              sha256: await sha256(validationReconciliationPath),
              recordedAtUtc: text(validationReconciliation?.createdAtUtc),
              recordedAtAsiaShanghai: text(
                validationReconciliation?.createdAtAsiaShanghai,
              ),
            },
          ]
        : []),
      ...(fullTrainingFinalization
        ? [
            {
              label: "V7修复R1完整训练终态",
              path: fullTrainingFinalizationPath,
              sha256: await sha256(fullTrainingFinalizationPath),
              recordedAtUtc: text(fullTrainingFinalization?.createdAtUtc),
              recordedAtAsiaShanghai: text(
                fullTrainingFinalization?.createdAtAsiaShanghai,
              ),
            },
          ]
        : []),
      ...(latestStage?.tokenLedgerPath
        ? [
            {
              label: "最新训练Token账本",
              path: latestStage.tokenLedgerPath,
              sha256: latestStage.tokenLedgerSha256,
              recordedAtUtc: latestStage.createdAtUtc,
              recordedAtAsiaShanghai: latestStage.createdAtAsiaShanghai,
            },
          ]
        : []),
      ...(latestStage
        ? [
            {
              label: "最新stage-2 manifest",
              path: latestStage.manifestPath,
              sha256: latestStage.manifestSha256,
              recordedAtUtc: latestStage.createdAtUtc,
              recordedAtAsiaShanghai: latestStage.createdAtAsiaShanghai,
            },
          ]
        : []),
    ],
  };
}

function buildUnknownRegistryTaskCapsule(
  errorCode?: string,
): AiPainterTaskCapsule {
  return {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: "current-execution-registry-unknown-or-stale",
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: {
      completedStages: null,
      totalStages: null,
      percent: null,
      source: "current_execution_registry_failed_closed",
    },
    currentStage: {
      number: 4,
      total: 5,
      labelZh: "当前执行登记失败关闭",
      status: "unknown_or_stale",
    },
    candidateTerminal: {
      runId: null,
      status: "unknown_or_stale",
      programStatus: errorCode ?? "current_execution_registry_unavailable",
      previewMachineStatus: null,
      modelQualificationStatus: "unknown_or_stale",
      previewCount: null,
      previewPassCount: null,
      previewFailCount: null,
      checkpointWritten: false,
      modelWeightsModified: false,
      recordedAtUtc: null,
      recordedAtAsiaShanghai: null,
    },
    latestBlocker: {
      code: errorCode ?? "current_execution_registry_unavailable",
      summaryZh:
        "唯一当前执行登记未通过不可变证据核验。系统已禁止从历史Smoke、历史时间戳或旧任务胶囊推断当前任务。",
    },
    nextAllowedAction: {
      code: "repair_current_execution_registry_from_immutable_evidence",
      labelZh: "仅可根据不可变证据修复唯一当前执行登记。",
      ownerAuthorizationRequired: false,
      automaticExecutionAllowed: true,
      planEvidenceConfirmed: false,
    },
    forbiddenActions: [
      "fallback_to_historical_smoke",
      "select_current_by_timestamp",
      "reuse_failed_checkpoint",
      "start_training_without_verified_current_registry",
    ],
    taskIdentity: {
      modelId: null,
      sampleId: null,
      conditionLabel: null,
      sampleSplit: null,
      seed: null,
      requiredBoundarySides: [],
    },
    evidence: [],
    integrity: {
      status: "incomplete_or_mismatched",
      requiredEvidencePresent: false,
      boundEvidenceVerified: false,
      identityMatches: false,
      migrationRegistryStatus: "unknown_or_stale",
    },
  };
}

async function readCurrentR5Stage4TaskCapsule(): Promise<AiPainterTaskCapsule> {
  const autonomousCapsule = await readCurrentAutonomousStage4TaskCapsule();
  if (autonomousCapsule) return autonomousCapsule;
  const absoluteFinalizationRoot = resolveInsideRoot(
    r5Stage4FinalizationRootPath,
  );
  const entries = await readdir(absoluteFinalizationRoot, {
    withFileTypes: true,
  }).catch(() => []);
  const terminals = (
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const terminalPath = `${r5Stage4FinalizationRootPath}/${entry.name}/phase-terminal.json`;
          return {
            path: terminalPath,
            value: await readJson(terminalPath),
          };
        }),
    )
  )
    .filter((item): item is { path: string; value: JsonObject } =>
      Boolean(item.value),
    )
    .sort(
      (left, right) =>
        Date.parse(text(right.value.recordedAtUtc) ?? "") -
        Date.parse(text(left.value.recordedAtUtc) ?? ""),
    );
  const validationKernelTerminal = await readJson(
    validationKernelModelSmokeTerminalPath,
  );
  if (validationKernelTerminal) {
    terminals.push({
      path: validationKernelModelSmokeTerminalPath,
      value: validationKernelTerminal,
    });
    terminals.sort(
      (left, right) =>
        Date.parse(text(right.value.recordedAtUtc) ?? "") -
        Date.parse(text(left.value.recordedAtUtc) ?? ""),
    );
  }
  const selectedTerminal = terminals[0] ?? { path: "", value: {} };
  const rawTerminal = selectedTerminal.value;
  const derivedRunId = selectedTerminal.path.includes(
    "model-smoke-20260810-validated-kernel",
  )
    ? "model-smoke-20260810-validated-kernel"
    : text(rawTerminal.runId);
  const terminal: JsonObject = {
    ...rawTerminal,
    runId: derivedRunId,
    fixedOverallProgress:
      object(rawTerminal.fixedOverallProgress) ??
      object(rawTerminal.fixedTotalProgress),
  };
  const finalizationPath =
    text(rawTerminal.finalizationReportPath) ??
    text(rawTerminal.finalizationPath) ??
    "";
  const rawFinalization = finalizationPath
    ? ((await readJson(finalizationPath)) ?? {})
    : {};
  const finalization: JsonObject = { ...rawFinalization, runId: derivedRunId };
  const reviewBinding = object(rawFinalization.review) ?? {};
  const reviewPath = text(reviewBinding.reviewPath) ?? "";
  const review = reviewPath
    ? ((await readJson(reviewPath)) ?? {})
    : rawTerminal.status ===
        "v9-kernel_stage4_single_sample_30_epoch_gpu_smoke_execution_failed_closed"
      ? {
          runId: derivedRunId,
          status:
            "machine_reviews_not_started_training_authorization_gate_failed_closed",
          previewCount: 0,
          previewPassCount: 0,
          previewFailCount: 0,
          recordedAtUtc: rawTerminal.recordedAtUtc,
        }
      : {};
  const executionConsumptionBinding =
    object(object(rawFinalization.details)?.consumption) ?? {};
  const authorizationPath =
    text(rawFinalization.authorizationPath) ??
    text(executionConsumptionBinding.authorizationPath) ??
    "";
  const authorization = authorizationPath
    ? ((await readJson(authorizationPath)) ?? {})
    : {};
  const implementationConsumptionPath =
    text(rawFinalization.implementationConsumptionPath) ??
    (rawTerminal.status ===
    "v9-kernel_stage4_single_sample_30_epoch_gpu_smoke_execution_failed_closed"
      ? validationKernelImplementationConsumptionPath
      : "");
  const implementationConsumption = implementationConsumptionPath
    ? ((await readJson(implementationConsumptionPath)) ?? {})
    : {};
  const executionConsumptionPath =
    text(rawFinalization.executionConsumptionPath) ??
    text(executionConsumptionBinding.path) ??
    "";
  const executionConsumption = executionConsumptionPath
    ? ((await readJson(executionConsumptionPath)) ?? {})
    : {};
  const migrationRegistry = (await readJson(migrationRegistryPath)) ?? {};
  const controlConvergence =
    (await readJson(stageControlConvergenceTerminalPath)) ?? {};
  const planText = await readFile(
    resolveInsideRoot(uniqueModulePlanPath),
    "utf8",
  ).catch(() => "");
  const evidenceInput = [
    {
      kind: "stage4_terminal",
      labelZh: "R5 Stage4最新终态",
      path: selectedTerminal.path,
      sha256: selectedTerminal.path
        ? await sha256(selectedTerminal.path)
        : null,
      expectedSha256: null,
      recordedAtUtc: text(terminal.recordedAtUtc),
      recordedAtAsiaShanghai: text(terminal.recordedAtAsiaShanghai),
    },
    {
      kind: "stage4_finalization",
      labelZh: "R5 Stage4 Finalization",
      path: finalizationPath,
      sha256: finalizationPath ? await sha256(finalizationPath) : null,
      expectedSha256:
        text(rawTerminal.finalizationReportSha256) ??
        text(rawTerminal.finalizationSha256),
      recordedAtUtc: text(finalization.createdAtUtc),
      recordedAtAsiaShanghai: text(finalization.createdAtAsiaShanghai),
    },
    {
      kind: "machine_review",
      labelZh: "五张固定预览机器审核",
      path: reviewPath || finalizationPath,
      sha256: reviewPath
        ? await sha256(reviewPath)
        : finalizationPath
          ? await sha256(finalizationPath)
          : null,
      expectedSha256: text(reviewBinding.reviewSha256),
      recordedAtUtc: text(review.createdAtUtc),
      recordedAtAsiaShanghai: text(review.createdAtAsiaShanghai),
    },
    {
      kind: "owner_authorization",
      labelZh: "当前Smoke Owner授权",
      path: authorizationPath,
      sha256: authorizationPath ? await sha256(authorizationPath) : null,
      expectedSha256:
        text(rawFinalization.authorizationSha256) ??
        text(executionConsumptionBinding.authorizationSha256),
      recordedAtUtc: text(authorization.recordedAtUtc),
      recordedAtAsiaShanghai: text(authorization.recordedAtAsiaShanghai),
    },
    {
      kind: "owner_implementation_consumption",
      labelZh: "训练实施授权消费",
      path: implementationConsumptionPath,
      sha256: implementationConsumptionPath
        ? await sha256(implementationConsumptionPath)
        : null,
      expectedSha256: text(finalization.implementationConsumptionSha256),
      recordedAtUtc: text(implementationConsumption.consumedAtUtc),
      recordedAtAsiaShanghai: text(
        implementationConsumption.consumedAtAsiaShanghai,
      ),
    },
    {
      kind: "owner_gpu_execution_consumption",
      labelZh: "GPU执行授权消费",
      path: executionConsumptionPath,
      sha256: executionConsumptionPath
        ? await sha256(executionConsumptionPath)
        : null,
      expectedSha256: text(finalization.executionConsumptionSha256),
      recordedAtUtc: text(executionConsumption.consumedAtUtc),
      recordedAtAsiaShanghai: text(executionConsumption.consumedAtAsiaShanghai),
    },
    {
      kind: "unique_module_plan",
      labelZh: "唯一模块计划表",
      path: uniqueModulePlanPath,
      sha256: await sha256(uniqueModulePlanPath),
      expectedSha256: null,
      recordedAtUtc: null,
      recordedAtAsiaShanghai: null,
    },
    {
      kind: "migration_registry",
      labelZh: "本地AI能力迁移注册表",
      path: migrationRegistryPath,
      sha256: await sha256(migrationRegistryPath),
      expectedSha256: null,
      recordedAtUtc: text(migrationRegistry.updatedAtUtc),
      recordedAtAsiaShanghai: text(migrationRegistry.updatedAtAsiaShanghai),
    },
    {
      kind: "stage_control_convergence",
      labelZh: "Stage3/Stage4控制层结构收敛终态",
      path: stageControlConvergenceTerminalPath,
      sha256: await sha256(stageControlConvergenceTerminalPath),
      expectedSha256: null,
      recordedAtUtc: text(controlConvergence.recordedAtUtc),
      recordedAtAsiaShanghai: text(controlConvergence.recordedAtAsiaShanghai),
    },
  ];
  return projectR5Stage4TaskCapsule({
    terminal,
    finalization,
    review,
    authorization,
    evidence: evidenceInput,
    migrationRegistryStatus: migrationRegistry.status,
    controlConvergence,
    planEvidenceConfirmed:
      planText.includes("固定总进度为3/5（60%）") &&
      planText.includes("新的分析、候选或执行均需独立明确授权"),
  }) as AiPainterTaskCapsule;
}

async function readCurrentAutonomousStage4TaskCapsule(): Promise<AiPainterTaskCapsule | null> {
  const pointer = await readJson(autonomousStage4CandidatePointerPath);
  const terminalBinding = object(pointer?.terminal);
  const terminalPath = text(terminalBinding?.path);
  const expectedTerminalSha256 = text(terminalBinding?.sha256);
  if (!terminalPath || !expectedTerminalSha256) return null;
  const actualTerminalSha256 = await sha256(terminalPath);
  if (actualTerminalSha256 !== expectedTerminalSha256) return null;
  const terminal = await readJson(terminalPath);
  if (
    terminal?.schemaVersion !==
      "stage4-post-carrier-bounded-candidate-terminal-v1" ||
    terminal?.executionState !== "completed"
  )
    return null;
  const runRoot = path.posix.dirname(terminalPath.replaceAll("\\", "/"));
  const capsulePath = `${runRoot}/local-task-capsule.json`;
  const savedCapsule = await readJson(capsulePath);
  if (
    savedCapsule?.schemaVersion !== "ai-painter-local-task-capsule-v2" ||
    text(savedCapsule.runId) !== text(pointer?.runId) ||
    text(object(savedCapsule.latestTerminal)?.sha256) !== actualTerminalSha256
  )
    return null;

  const auditPath = text(object(terminal.evidenceAudit)?.path) ?? "";
  const audit = auditPath ? await readJson(auditPath) : null;
  const carrierFailureBinding = arrayObjects(audit?.immutableEvidence).find(
    (item) => text(item.role) === "authoritativeCarrierFailureTerminal",
  );
  const carrierFailurePath = text(carrierFailureBinding?.path) ?? "";
  const machineReviewPath = carrierFailurePath
    ? `${path.posix.dirname(carrierFailurePath.replaceAll("\\", "/"))}/machine-review.json`
    : "";
  const machineReview = machineReviewPath
    ? await readJson(machineReviewPath)
    : null;
  const reviews = arrayObjects(machineReview?.reviews);
  const previewPassCount = reviews.filter(
    (item) => item.passed === true,
  ).length;
  const previewCount = reviews.length;

  const evidenceBindings = [
    {
      kind: "autonomous_latest_pointer",
      labelZh: "本地AI当前终态指针",
      path: autonomousStage4CandidatePointerPath,
      expectedSha256: null,
    },
    {
      kind: "stage4_terminal",
      labelZh: "Stage4当前自主终态",
      path: terminalPath,
      expectedSha256: expectedTerminalSha256,
    },
    {
      kind: "local_task_capsule",
      labelZh: "本地任务胶囊",
      path: capsulePath,
      expectedSha256: null,
    },
    {
      kind: "problem_report",
      labelZh: "候选穷尽问题报告",
      path: text(object(terminal.problemReport)?.path) ?? "",
      expectedSha256: text(object(terminal.problemReport)?.sha256),
    },
    {
      kind: "evidence_audit",
      labelZh: "候选证据审计",
      path: auditPath,
      expectedSha256: text(object(terminal.evidenceAudit)?.sha256),
    },
    {
      kind: "unique_decision",
      labelZh: "候选唯一裁决",
      path: text(object(terminal.uniqueDecision)?.path) ?? "",
      expectedSha256: text(object(terminal.uniqueDecision)?.sha256),
    },
    {
      kind: "policy_boundary",
      labelZh: "自动失败关闭边界报告",
      path: text(object(terminal.policyBoundaryReport)?.path) ?? "",
      expectedSha256: text(object(terminal.policyBoundaryReport)?.sha256),
    },
    {
      kind: "cpu_report",
      labelZh: "CPU正反检查报告",
      path: text(object(terminal.cpuReport)?.path) ?? "",
      expectedSha256: text(object(terminal.cpuReport)?.sha256),
    },
    {
      kind: "machine_review",
      labelZh: "最近候选六节点机器审核",
      path: machineReviewPath,
      expectedSha256: null,
    },
    {
      kind: "unique_module_plan",
      labelZh: "唯一模块计划表",
      path: uniqueModulePlanPath,
      expectedSha256: null,
    },
  ];
  const evidence = await Promise.all(
    evidenceBindings.map(async (binding) => {
      const actual = binding.path ? await sha256(binding.path) : null;
      return {
        ...binding,
        sha256: actual,
        sha256Verified: Boolean(
          actual &&
          (!binding.expectedSha256 || actual === binding.expectedSha256),
        ),
        recordedAtUtc: text(terminal.recordedAtUtc),
        recordedAtAsiaShanghai: null,
      };
    }),
  );
  return projectAutonomousStage4TaskCapsule({
    pointer,
    terminal,
    savedCapsule,
    evidence,
    previewCount,
    previewPassCount,
  }) as AiPainterTaskCapsule;
}

async function readStrictValidationBatches(): Promise<StrictValidationBatch[]> {
  try {
    const absoluteRoot = resolveInsideRoot(strictValidationRootPath);
    const entries = await readdir(absoluteRoot, { withFileTypes: true });
    const batches = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const reportPath = `${strictValidationRootPath}/${entry.name}/validation-report.json`;
          const report = await readJson(reportPath);
          if (!report) return null;
          const trajectories = await Promise.all(
            arrayObjects(report.trajectories).map(async (trajectory) => {
              const machineReviewPath = text(trajectory.machineReviewPath);
              const review = machineReviewPath
                ? await readJson(machineReviewPath)
                : null;
              const token = object(trajectory.validationTokenAccounting);
              const runTotals = object(token?.runTotals);
              return {
                recordId: text(trajectory.recordId) ?? "unknown-record",
                conditionLabel:
                  text(trajectory.conditionLabel) ?? "unknown-condition",
                split: text(trajectory.split) ?? "unknown",
                seedIndex: number(trajectory.seedIndex) ?? 0,
                seed: number(trajectory.seed) ?? 0,
                status: text(trajectory.status) ?? "unknown",
                durationMs: number(trajectory.durationMs) ?? 0,
                runId: text(trajectory.runId) ?? "unknown-run",
                manifestPath: text(trajectory.manifestPath),
                outputImagePath: text(trajectory.outputImagePath),
                outputImageSha256: text(trajectory.outputImageSha256),
                machineReviewPath,
                machineReviewSha256: text(trajectory.machineReviewSha256),
                machineReviewIssueCodes: strings(
                  trajectory.machineReviewIssueCodes,
                ),
                reviewedAtUtc: text(review?.createdAtUtc),
                reviewedAtAsiaShanghai: text(review?.createdAtAsiaShanghai),
                gates: arrayObjects(review?.gates).map((gate) => ({
                  gate: text(gate.gate) ?? "unknown-gate",
                  passed: gate.passed === true,
                  issueCodes: strings(gate.issueCodes),
                })),
                issues: arrayObjects(review?.issues).map((issue) => ({
                  code: text(issue.code) ?? "unknown_issue",
                  message: text(issue.message),
                  messageZh: text(issue.messageZh),
                  affectedRegion: text(issue.affectedRegion),
                  nextTrainingTarget:
                    text(issue.nextFixTarget) ?? text(issue.nextTrainingTarget),
                })),
                validationTokenAccounting:
                  normalizeStrictValidationTokenAccounting(token, runTotals),
              };
            }),
          );
          return {
            batchId: text(report.batchId) ?? entry.name,
            status: text(report.status) ?? "unknown",
            createdAtUtc: text(report.createdAtUtc),
            createdAtAsiaShanghai: text(report.createdAtAsiaShanghai),
            completedAtUtc: text(report.completedAtUtc),
            completedAtAsiaShanghai: text(report.completedAtAsiaShanghai),
            reportPath,
            reportSha256: await sha256(reportPath),
            checkpointSha256: text(report.checkpointSha256),
            plannedTrajectoryCount: number(report.plannedTrajectoryCount) ?? 0,
            completedTrajectoryCount:
              number(report.completedTrajectoryCount) ?? 0,
            machinePassedCount: number(report.machinePassedCount) ?? 0,
            machineRejectedCount: number(report.machineRejectedCount) ?? 0,
            duplicateOutputHashes: strings(report.duplicateOutputHashes),
            issueCodes: strings(report.issueCodes),
            trainingWeightsModified: report.trainingWeightsModified === true,
            automaticRetryCount: number(report.automaticRetryCount) ?? 0,
            formalInferenceEligible: report.formalInferenceEligible === true,
            runtimeFrameEligible: report.runtimeFrameEligible === true,
            canEnterWorld: report.canEnterWorld === true,
            validationTokenAccounting: normalizeStrictValidationTokenAccounting(
              object(report.validationTokenAccounting),
              object(report.validationTokenAccounting),
            ),
            trajectories,
          } satisfies StrictValidationBatch;
        }),
    );
    return batches
      .filter((batch): batch is StrictValidationBatch => Boolean(batch))
      .sort(
        (left, right) =>
          Date.parse(right.createdAtUtc ?? "") -
          Date.parse(left.createdAtUtc ?? ""),
      );
  } catch {
    return [];
  }
}

function normalizeStrictValidationTokenAccounting(
  rootValue: JsonObject | null,
  totalsValue: JsonObject | null,
): StrictValidationTokenAccounting {
  const root = rootValue ?? {};
  const totals = totalsValue ?? {};
  return {
    schemaVersion: text(root.schemaVersion),
    denoiserSampleForwardPasses:
      number(totals.denoiserSampleForwardPasses) ?? 0,
    latentSpatialTokens: number(totals.latentSpatialTokens) ?? 0,
    latentChannelValues: number(totals.latentChannelValues) ?? 0,
    conditionScalarValues: number(totals.conditionScalarValues) ?? 0,
    decodedRgbFrames: number(totals.decodedRgbFrames) ?? 0,
    decodedRgbPixelPredictions: number(totals.decodedRgbPixelPredictions) ?? 0,
    externalApiTokens:
      number(root.externalApiTokens) ??
      number(object(root.externalApi)?.totalTokens) ??
      0,
  };
}

async function readRelevantLocalProcesses(): Promise<LocalProcessEvidence[]> {
  if (process.platform !== "win32") return [];
  const command = [
    "$rows = Get-CimInstance Win32_Process | Where-Object {",
    "  $_.Name -in @('python.exe','pythonw.exe','node.exe','cmd.exe') -and",
    "  $_.CommandLine -match '(train_ai_assisted|run-ai-assisted-v7|run-ai-painter-stage4|run:ai-assisted|post-training-validation|strict-revalidation|single-sample-overfit|ai-painter-training-controller)' -and",
    "  $_.CommandLine -notmatch '(check-ai-painter|check:ai-painter)'",
    "} | Select-Object @{Name='pid';Expression={$_.ProcessId}}, @{Name='parentPid';Expression={$_.ParentProcessId}}, @{Name='name';Expression={$_.Name}}, @{Name='startedAtUtc';Expression={if ($_.CreationDate) {$_.CreationDate.ToUniversalTime().ToString('o')} else {$null}}}, @{Name='commandLine';Expression={$_.CommandLine}}",
    "@($rows) | ConvertTo-Json -Compress",
  ].join("\n");
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", command],
      { timeout: 4_000, windowsHide: true, maxBuffer: 512 * 1024 },
    );
    const parsed = JSON.parse(stdout || "[]") as unknown;
    return (Array.isArray(parsed) ? parsed : [parsed])
      .map((value) => object(value))
      .filter((value): value is JsonObject => Boolean(value))
      .map((value) => {
        const commandLine = text(value.commandLine) ?? "";
        const commandIdentity: LocalProcessEvidence["commandIdentity"] =
          /train_ai_assisted|full-training|single-sample-overfit/i.test(
            commandLine,
          )
            ? "model_training"
            : /infer|generate/i.test(commandLine)
              ? "model_inference"
              : /validation|revalidation|review/i.test(commandLine)
                ? "validation"
                : /dataset|package/i.test(commandLine)
                  ? "dataset_build"
                  : "training_controller";
        return {
          pid: number(value.pid) ?? 0,
          parentPid: number(value.parentPid),
          name: text(value.name) ?? "unknown",
          startedAtUtc: text(value.startedAtUtc),
          commandIdentity,
        };
      })
      .filter((value) => value.pid > 0)
      .sort((left, right) => {
        const priority = (value: LocalProcessEvidence) =>
          value.commandIdentity === "model_training" ||
          value.commandIdentity === "model_inference"
            ? 0
            : 1;
        return priority(left) - priority(right) || left.pid - right.pid;
      });
  } catch {
    return [];
  }
}

function projectPostDecodeFormalExecutionActivity({
  activity,
  execution,
  stages,
}: {
  activity: CurrentExecutionActivity;
  execution: PostDecodeFormalExecutionProjection | null;
  stages: TrainingStageDetail[];
}): CurrentExecutionActivity {
  if (!execution) return activity;
  const stateStatus = text(execution.state.status);
  const statePhase = text(execution.state.phase);
  const terminalStatus = text(execution.terminal?.status);
  const running = stateStatus === "running" && statePhase === "training";
  const reviewing =
    stateStatus === "running" && statePhase === "automatic_machine_review";
  const failed = isFormalStage0TerminalStatus(
    terminalStatus,
    "real_visual_failure",
  );
  const completed = isFormalStage0TerminalStatus(terminalStatus, "completed");
  if (!running && !reviewing && !failed && !completed) return activity;

  const stage = stages.find((value) => value.runId === execution.runId) ?? null;
  const live =
    object(execution.progress?.liveProgress) ??
    (execution.progress
      ? directCleanLatentLiveProgress(execution.progress)
      : null);
  const reviewCompleted =
    number(execution.reviewProgress?.completedPreviewCount) ??
    number(execution.reviewProgress?.completedReviewCount) ??
    0;
  const reviewTotal =
    number(execution.reviewProgress?.previewCount) ??
    number(execution.reviewProgress?.targetReviewCount) ??
    6;
  const latestMetric = stage?.metrics.at(-1) ?? null;
  const latestPreview = stage?.previews.at(-1) ?? null;
  const timestamp =
    text(execution.terminal?.recordedAtUtc) ??
    text(execution.state.updatedAtUtc) ??
    execution.occurredAtUtc;
  const lifecycle: CurrentExecutionActivity["lifecycle"] = running
    ? "running"
    : reviewing
      ? "reviewing"
      : failed
        ? "failed"
        : "completed";
  return {
    ...activity,
    actor: "local_program",
    actorLabelZh: running ? "本地AI训练程序" : "本地AI审核程序",
    lifecycle,
    lifecycleLabelZh: running
      ? "正式训练中"
      : reviewing
        ? "机器验证中"
        : failed
          ? "验证失败"
          : "验证通过",
    localAiProcessActive: running || reviewing,
    taskId: execution.runId,
    taskKind: running
      ? "formal_stage0_training"
      : reviewing
        ? "automatic_machine_review"
        : "machine_review_terminal",
    taskLabelZh: running
      ? "Stage 0正式训练进行中"
      : reviewing
        ? `正在自动审核固定预览 ${reviewCompleted}/${reviewTotal}`
        : failed
          ? "自动验证完成，候选失败关闭"
          : "自动验证完成，Stage 0通过",
    detailZh: running
      ? "本地程序正在执行40 Epoch正式训练；完成后由同一执行器自动进入固定阈值机器审核和终态收口。"
      : reviewing
        ? `训练已经完成；本地程序正在执行固定阈值机器审核，当前已完成${reviewCompleted}/${reviewTotal}，并持续保存不可变进度。`
        : failed
          ? `机器审核已完成：${number(execution.review?.previewPassCount) ?? 0}/${number(execution.review?.previewCount) ?? 0}个固定节点通过；失败证据和裁决均已保存。`
          : "训练、预览复现和机器审核已经通过，终态证据已保存。",
    source: running || reviewing
      ? "formal_stage0_execution_state"
      : "formal_stage0_phase_terminal",
    sourcePath: running
      ? execution.progress
        ? execution.progressPath
        : execution.statePath
      : reviewing
        ? execution.reviewProgress
          ? execution.reviewProgressPath
          : execution.statePath
        : execution.terminalPath,
    startedAtUtc:
      text(execution.progress?.startedAtUtc) ?? stage?.createdAtUtc ?? null,
    startedAtAsiaShanghai:
      text(execution.progress?.startedAtAsiaShanghai) ??
      stage?.createdAtAsiaShanghai ??
      null,
    lastHeartbeatAtUtc: timestamp,
    lastHeartbeatAtAsiaShanghai:
      text(execution.progress?.updatedAtAsiaShanghai) ?? null,
    heartbeatAgeSeconds: timestamp
      ? Math.max(0, (Date.now() - Date.parse(timestamp)) / 1000)
      : null,
    stalled: false,
    progress: {
      ...activity.progress,
      runId: execution.runId,
      phase: running
        ? "training"
        : reviewing
          ? "automatic_machine_review"
          : "machine_review_completed",
      stageIndex: 0,
      stageLabel: "Stage 0",
      resolution: stage?.resolution
        ? `${stage.resolution.width}×${stage.resolution.height}`
        : "256×192",
      epoch: number(live?.epoch) ?? stage?.epochCount ?? 40,
      epochTarget: number(live?.epochTarget) ?? 40,
      batch: number(live?.batch) ?? 48,
      batchTarget: number(live?.batchTarget) ?? 48,
      optimizerStep: number(live?.optimizerStep) ?? 5760,
      optimizerStepTarget: number(live?.optimizerStepTarget) ?? 5760,
      percentage: number(live?.percentage) ?? 100,
      elapsedSeconds: number(live?.elapsedSeconds),
      etaSeconds: running ? number(live?.etaSeconds) : 0,
      optimizerStepsPerSecond: number(live?.optimizerStepsPerSecond),
      trainCompositeLoss:
        number(live?.rollingEpochLoss) ?? latestMetric?.trainCompositeLoss ?? null,
      validationCompositeScore:
        number(live?.validationCompositeScore) ??
        latestMetric?.validationCompositeScore ??
        null,
      checkpointScore:
        number(live?.checkpointSelectionScore) ??
        latestMetric?.validationCheckpointScore ??
        null,
      latestPreviewPath: latestPreview?.imagePath ?? null,
      latestPreviewRecordedAtUtc: latestPreview?.recordedAtUtc ?? null,
      latestPreviewRecordedAtAsiaShanghai:
        latestPreview?.recordedAtAsiaShanghai ?? null,
    },
  };
}

function isFormalStage0TerminalStatus(
  status: string | null,
  outcome: "completed" | "real_visual_failure",
) {
  if (!status) return false;
  const knownPrefixes = [
    "post_decode_object_rgb",
    "post_decode_full_condition_responsibility",
    "authoritative_semantic_carrier",
    "direct_clean_latent",
  ];
  return knownPrefixes.some(
    (prefix) => status === `${prefix}_stage0_${outcome}`,
  );
}

async function readActiveDirectCleanLatentStage0Execution(
  registry: JsonObject,
): Promise<PostDecodeFormalExecutionProjection | null> {
  if (
    text(registry.capabilityVersion) !==
      "stage4-direct-condition-clean-latent-generator-change-candidate-v1" ||
    text(registry.taskId) !== "compile_direct_condition_clean_latent_stage0"
  )
    return null;
  const relativeRoot =
    ".runtime/ai-painter/stage4-direct-clean-latent-formal-stage0";
  const entries = await readdir(resolveInsideRoot(relativeRoot), {
    withFileTypes: true,
  }).catch(() => []);
  const candidates: PostDecodeFormalExecutionProjection[] = [];
  for (const entry of entries) {
    if (
      !entry.isDirectory() ||
      !entry.name.startsWith("stage4-direct-clean-latent-stage0-")
    )
      continue;
    const runRoot = `${relativeRoot}/${entry.name}`;
    const statePath = `${runRoot}/execution-state.json`;
    const state = await readJson(statePath);
    if (
      !state ||
      text(state.status) !== "running" ||
      text(state.runId) !== entry.name ||
      text(state.capabilityVersion) !== text(registry.capabilityVersion)
    )
      continue;
    const terminalPath = `${runRoot}/phase-terminal.json`;
    const reviewPath = `${runRoot}/machine-review.json`;
    const reviewProgressPath = `${runRoot}/review-progress.json`;
    const progressPath = `${runRoot}/training-output/progress.json`;
    const [terminal, review, reviewProgress, progress] = await Promise.all([
      readJson(terminalPath),
      readJson(reviewPath),
      readJson(reviewProgressPath),
      readJson(progressPath),
    ]);
    candidates.push({
      runId: entry.name,
      statePath,
      state,
      terminalPath,
      terminal,
      reviewPath,
      review,
      reviewProgressPath,
      reviewProgress,
      progressPath,
      progress,
      occurredAtUtc:
        text(state.updatedAtUtc) ??
        text(progress?.updatedAtUtc) ??
        text(state.startedAtUtc),
    });
  }
  if (candidates.length > 1)
    throw new Error("multiple_active_direct_clean_latent_stage0_executions");
  return candidates[0] ?? null;
}

async function readLatestPostDecodeFormalExecution(): Promise<PostDecodeFormalExecutionProjection | null> {
  const relativeRoot =
    ".runtime/ai-painter/stage4-post-decode-object-rgb-formal-stage0";
  const absoluteRoot = resolveInsideRoot(relativeRoot);
  const entries = await readdir(absoluteRoot, { withFileTypes: true }).catch(
    () => [],
  );
  const candidates: PostDecodeFormalExecutionProjection[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const runRoot = `${relativeRoot}/${entry.name}`;
    const statePath = `${runRoot}/execution-state.json`;
    const state = await readJson(statePath);
    if (!state) continue;
    const terminalPath = `${runRoot}/phase-terminal.json`;
    const reviewPath = `${runRoot}/machine-review.json`;
    const reviewProgressPath = `${runRoot}/review-progress.json`;
    const progressPath = `${runRoot}/training-output/progress.json`;
    const [terminal, review, reviewProgress, progress] = await Promise.all([
      readJson(terminalPath),
      readJson(reviewPath),
      readJson(reviewProgressPath),
      readJson(progressPath),
    ]);
    const occurredAtUtc =
      text(terminal?.recordedAtUtc) ??
      text(state.completedAtUtc) ??
      text(state.updatedAtUtc) ??
      text(progress?.updatedAtUtc) ??
      text(state.startedAtUtc);
    candidates.push({
      runId: entry.name,
      statePath,
      state,
      terminalPath,
      terminal,
      reviewPath,
      review,
      reviewProgressPath,
      reviewProgress,
      progressPath,
      progress,
      occurredAtUtc,
    });
  }
  candidates.sort(
    (left, right) =>
      Date.parse(right.occurredAtUtc ?? "") -
      Date.parse(left.occurredAtUtc ?? ""),
  );
  return candidates[0] ?? null;
}

function projectCurrentExecutionActivity({
  control,
  runtimeStatus,
  stages,
  epochTarget,
  localProcesses,
}: {
  control: Awaited<ReturnType<typeof readTrainingControlState>>;
  runtimeStatus: Awaited<ReturnType<typeof readTrainingRuntimeStatus>>;
  stages: TrainingStageDetail[];
  epochTarget: number | null;
  localProcesses: LocalProcessEvidence[];
}): CurrentExecutionActivity {
  const heartbeat = runtimeStatus.heartbeat;
  const controllerPid =
    heartbeat?.controllerPid ?? control.controllerPid ?? null;
  const childPid = heartbeat?.childPid ?? control.childPid ?? null;
  const controllerAlive = isProcessAlive(controllerPid);
  const childAlive = isProcessAlive(childPid);
  const liveStatuses = new Set([
    "dataset_building",
    "training",
    "inferencing",
    "reviewing",
    "diagnosing",
    "backwriting",
  ]);
  const heartbeatClaimsExecution = Boolean(
    heartbeat && liveStatuses.has(heartbeat.status),
  );
  const discoveredProcess = localProcesses.at(0) ?? null;
  const processTableClaimsExecution = Boolean(discoveredProcess);
  const waitingForOwner =
    heartbeat?.status === "waiting_owner_review" && !runtimeStatus.stale;
  const recentFailure =
    control.status === "failed" &&
    isRecentTimestamp(control.finishedAt, 10 * 60);
  const recentCompletion =
    control.status === "completed" &&
    isRecentTimestamp(control.finishedAt, 2 * 60);
  const activityState = selectLiveActivityState({
    heartbeatClaimsExecution,
    heartbeatStale: runtimeStatus.stale,
    heartbeatStatus: heartbeat?.status ?? null,
    controllerAlive,
    childAlive,
    processTableClaimsExecution,
    discoveredCommandIdentity: discoveredProcess?.commandIdentity ?? null,
    waitingForOwner,
    recentFailure,
    recentCompletion,
  });
  const stalled = activityState.stalled;
  const localProcessActive =
    activityState.lifecycle === "running" ||
    activityState.lifecycle === "reviewing";
  const activeStage =
    [...stages]
      .reverse()
      .find(
        (stage) => stage.status === "running" || stage.status === "starting",
      ) ?? null;
  const progressStage = localProcessActive ? activeStage : null;
  const liveProgress = progressStage?.liveProgress ?? null;
  const latestMetric = progressStage?.metrics.at(-1) ?? null;
  const latestPreview = progressStage?.previews.at(-1) ?? null;
  const currentEpoch = liveProgress?.epoch ?? progressStage?.epochCount ?? null;
  const targetEpoch = progressStage
    ? (liveProgress?.epochTarget ??
      Math.max(epochTarget ?? 0, progressStage.epochCount))
    : null;
  const percentage =
    liveProgress?.percentage ??
    (currentEpoch !== null && targetEpoch
      ? Math.min(100, (currentEpoch / targetEpoch) * 100)
      : null);
  const elapsedSeconds = localProcessActive
    ? (liveProgress?.elapsedSeconds ??
      secondsBetween(
        progressStage?.createdAtUtc ??
          discoveredProcess?.startedAtUtc ??
          (heartbeatClaimsExecution ? control.startedAt : null) ??
          null,
        new Date().toISOString(),
      ))
    : null;
  const etaSeconds =
    liveProgress?.etaSeconds ??
    (elapsedSeconds !== null &&
    currentEpoch &&
    targetEpoch &&
    currentEpoch < targetEpoch
      ? Math.max(
          0,
          (elapsedSeconds / currentEpoch) * (targetEpoch - currentEpoch),
        )
      : null);
  const progressTimestampMs = Date.parse(liveProgress?.recordedAtUtc ?? "");
  const runtimeHeartbeatTimestampMs = Date.parse(heartbeat?.timestampUtc ?? "");
  const useProgressHeartbeat =
    localProcessActive &&
    Number.isFinite(progressTimestampMs) &&
    (!Number.isFinite(runtimeHeartbeatTimestampMs) ||
      progressTimestampMs >= runtimeHeartbeatTimestampMs);
  const latestActivityAtUtc = useProgressHeartbeat
    ? (liveProgress?.recordedAtUtc ?? null)
    : (heartbeat?.timestampUtc ?? null);
  const latestActivityAtAsiaShanghai = useProgressHeartbeat
    ? (liveProgress?.recordedAtAsiaShanghai ?? null)
    : (heartbeat?.timestampLocal ?? null);
  const heartbeatAgeSeconds = latestActivityAtUtc
    ? Math.max(0, (Date.now() - Date.parse(latestActivityAtUtc)) / 1000)
    : null;
  const tokenAccounting = progressStage?.tokenAccounting ?? null;
  const localTokenTotal = liveProgress?.localTrainingTokenCount ?? null;
  const status =
    activityState.lifecycle === "stalled"
      ? {
          actor: "local_program" as const,
          actorLabelZh: "本地训练程序",
          lifecycle: "stalled" as const,
          lifecycleLabelZh: "心跳中断",
          taskLabelZh: "本地任务可能异常停止",
          detailZh:
            "心跳仍声称任务在执行，但心跳已过期或对应进程不存在；控制台不会把它显示为正常训练。",
        }
      : activityState.lifecycle === "running" ||
          activityState.lifecycle === "reviewing"
        ? {
            actor:
              heartbeat?.status === "training" ||
              heartbeat?.status === "inferencing" ||
              discoveredProcess?.commandIdentity === "model_training" ||
              discoveredProcess?.commandIdentity === "model_inference"
                ? ("local_ai_model" as const)
                : ("local_program" as const),
            actorLabelZh:
              heartbeat?.status === "training" ||
              heartbeat?.status === "inferencing" ||
              discoveredProcess?.commandIdentity === "model_training" ||
              discoveredProcess?.commandIdentity === "model_inference"
                ? "本地自研AI模型"
                : "本地训练程序",
            lifecycle:
              heartbeat?.status === "reviewing"
                ? ("reviewing" as const)
                : ("running" as const),
            lifecycleLabelZh:
              heartbeat?.status === "reviewing" ? "审核运行中" : "运行中",
            taskLabelZh:
              livePhaseLabelZh(liveProgress?.phase) ??
              (heartbeatClaimsExecution ? heartbeat?.activeStep : null) ??
              "本地任务运行中",
            detailZh:
              heartbeatClaimsExecution && !runtimeStatus.stale && childAlive
                ? "PID与运行心跳均有效；下方进度、预览和计算量只显示本地程序已经保存的证据。"
                : "Windows进程表发现项目训练任务，但未找到有效控制器心跳；控制台只展示能够核验的进程和落盘进度。",
          }
        : activityState.lifecycle === "waiting_authorization"
          ? {
              actor: "owner" as const,
              actorLabelZh: "项目所有者",
              lifecycle: "waiting_authorization" as const,
              lifecycleLabelZh: "等待授权",
              taskLabelZh: heartbeat?.activeStep ?? "等待项目所有者决定",
              detailZh: "本地程序已停止计算，正在等待独立Owner授权。",
            }
          : activityState.lifecycle === "failed"
            ? {
                actor: "local_program" as const,
                actorLabelZh: "本地训练程序",
                lifecycle: "failed" as const,
                lifecycleLabelZh: "执行失败",
                taskLabelZh: control.currentStep ?? "本地任务执行失败",
                detailZh:
                  control.error ??
                  "本地任务已失败停止；失败证据保留，当前没有模型进程在运行。",
              }
            : activityState.lifecycle === "completed"
              ? {
                  actor: "local_program" as const,
                  actorLabelZh: "本地训练程序",
                  lifecycle: "completed" as const,
                  lifecycleLabelZh: "刚刚完成",
                  taskLabelZh: control.currentStep ?? "本地任务执行完成",
                  detailZh:
                    "本地任务已经终止运行并保存结果；页面短暂保留完成提示，随后回到空闲。",
                }
              : {
                  actor: "idle" as const,
                  actorLabelZh: "当前无人执行",
                  lifecycle: "idle" as const,
                  lifecycleLabelZh: "空闲",
                  taskLabelZh: "本地AI未运行",
                  detailZh:
                    "没有有效的本地训练子进程。历史Stage仍可查询，但不会被当成当前运行任务。",
                };
  return {
    ...status,
    localAiProcessActive: activityState.localAiProcessActive,
    taskId:
      localProcessActive || waitingForOwner
        ? ((heartbeatClaimsExecution || waitingForOwner
            ? heartbeat?.activeTaskId
            : null) ??
          progressStage?.runId ??
          (discoveredProcess ? `process-${discoveredProcess.pid}` : null))
        : null,
    taskKind:
      localProcessActive || waitingForOwner
        ? ((heartbeatClaimsExecution || waitingForOwner
            ? heartbeat?.status
            : null) ??
          liveProgress?.phase ??
          discoveredProcess?.commandIdentity ??
          null)
        : null,
    source: useProgressHeartbeat
      ? "training_progress_file"
      : heartbeatClaimsExecution || waitingForOwner
        ? runtimeStatus.statusSource
        : discoveredProcess
          ? "windows_process_table"
          : "local_process_and_heartbeat_projection",
    sourcePath: useProgressHeartbeat
      ? (progressStage?.manifestPath ?? null)
      : runtimeStatus.heartbeatPath &&
          (heartbeatClaimsExecution || waitingForOwner || stalled)
        ? projectRelativePath(runtimeStatus.heartbeatPath)
        : null,
    startedAtUtc: localProcessActive
      ? (progressStage?.createdAtUtc ??
        discoveredProcess?.startedAtUtc ??
        (heartbeatClaimsExecution ? control.startedAt : null) ??
        null)
      : null,
    startedAtAsiaShanghai: localProcessActive
      ? (progressStage?.createdAtAsiaShanghai ?? null)
      : null,
    lastHeartbeatAtUtc: latestActivityAtUtc,
    lastHeartbeatAtAsiaShanghai: latestActivityAtAsiaShanghai,
    heartbeatAgeSeconds,
    staleAfterSeconds: runtimeStatus.staleAfterMs / 1000,
    stalled,
    process: {
      controllerPid:
        heartbeatClaimsExecution || waitingForOwner
          ? controllerPid
          : (discoveredProcess?.parentPid ?? null),
      controllerAlive:
        heartbeatClaimsExecution || waitingForOwner
          ? controllerAlive
          : isProcessAlive(discoveredProcess?.parentPid),
      childPid: heartbeatClaimsExecution
        ? childPid
        : (discoveredProcess?.pid ?? null),
      childAlive:
        (heartbeatClaimsExecution && childAlive) || processTableClaimsExecution,
      commandIdentity:
        heartbeatClaimsExecution || waitingForOwner
          ? (heartbeat?.activeScript ?? null)
          : (discoveredProcess?.commandIdentity ?? null),
    },
    progress: {
      runId: progressStage?.runId ?? null,
      phase: liveProgress?.phase ?? null,
      stageIndex: progressStage?.resolutionStage ?? null,
      stageLabel: progressStage
        ? `Stage ${progressStage.resolutionStage ?? "?"}`
        : null,
      resolution: progressStage?.resolution
        ? `${progressStage.resolution.width}×${progressStage.resolution.height}`
        : null,
      epoch: currentEpoch,
      epochTarget: targetEpoch,
      batch: liveProgress?.batch ?? null,
      batchTarget: liveProgress?.batchTarget ?? null,
      optimizerStep: liveProgress?.optimizerStep ?? null,
      optimizerStepTarget: liveProgress?.optimizerStepTarget ?? null,
      percentage,
      elapsedSeconds,
      etaSeconds,
      optimizerStepsPerSecond: liveProgress?.optimizerStepsPerSecond ?? null,
      lastBatchDurationSeconds: liveProgress?.lastBatchDurationSeconds ?? null,
      samplesInBatch: liveProgress?.samplesInBatch ?? null,
      trainCompositeLoss:
        liveProgress?.batchLoss ??
        liveProgress?.rollingEpochLoss ??
        latestMetric?.trainCompositeLoss ??
        null,
      validationCompositeScore:
        liveProgress?.validationCompositeScore ??
        latestMetric?.validationCompositeScore ??
        null,
      checkpointScore:
        liveProgress?.checkpointSelectionScore ??
        latestMetric?.validationCheckpointScore ??
        null,
      latestPreviewPath: latestPreview?.imagePath ?? null,
      latestPreviewRecordedAtUtc: latestPreview?.recordedAtUtc ?? null,
      latestPreviewRecordedAtAsiaShanghai:
        latestPreview?.recordedAtAsiaShanghai ?? null,
    },
    accounting: {
      localModel: {
        available: localTokenTotal !== null,
        unit:
          liveProgress?.localTrainingTokenUnit ??
          tokenAccounting?.terminology.localTrainingTokenUnit ??
          "latent_spatial_token",
        total: localTokenTotal,
        source:
          progressStage?.tokenLedgerPath ?? progressStage?.manifestPath ?? null,
      },
      externalApi: {
        available: Boolean(tokenAccounting),
        providerCalls: tokenAccounting?.externalApi.providerCalls ?? null,
        totalTokens: tokenAccounting?.externalApi.totalTokens ?? null,
        source: progressStage?.tokenLedgerPath ?? null,
      },
      codex: {
        availability: "unavailable_to_local_program",
        totalTokens: null,
        noteZh:
          "本地项目无法读取Codex会话Token；只有外部平台提供正式计量接口后才能记录，当前不得估算或伪造。",
      },
    },
  };
}

function isProcessAlive(pid: number | null | undefined) {
  if (!pid || !Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function secondsBetween(start: string | null, end: string | null) {
  if (!start || !end) return null;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return Math.max(0, (endMs - startMs) / 1000);
}

function isRecentTimestamp(value: string | null, withinSeconds: number) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  const ageSeconds = (Date.now() - timestamp) / 1000;
  return ageSeconds >= 0 && ageSeconds <= withinSeconds;
}

function livePhaseLabelZh(value: string | null | undefined) {
  if (!value) return null;
  const labels: Record<string, string> = {
    initializing: "初始化训练器",
    training_batch: "正在执行训练Batch",
    validating_epoch: "正在执行Epoch验证",
    epoch_completed: "Epoch已完成并保存",
    completed: "训练阶段已完成",
  };
  return labels[value] ?? value;
}

function projectRelativePath(value: string) {
  const relative = path.relative(root, value);
  return relative && !relative.startsWith("..")
    ? relative.replaceAll("\\", "/")
    : value;
}

/**
 * The dashboard is a projection of the single current-execution registry. It
 * must never discover runs by scanning a hand-maintained list of historical
 * directories: that was the source of stale Smoke pointers. The registry's
 * latest-training evidence is the only source of a stage root; all paths are
 * resolved relative to the project and are rejected if they escape it.
 */
async function discoverCurrentTrainingSources(
  registry: CurrentExecutionRegistrySnapshot,
): Promise<CurrentTrainingSource[]> {
  if (!registry.ok) return [];
  const latest = object(registry.registry.latestTrainingTerminal);
  const evidence = object(latest?.evidence);
  const evidencePaths = [
    text(latest?.path),
    ...Object.values(evidence ?? {}).flatMap((value) => {
      const item = object(value);
      return item ? [text(item.path)] : [];
    }),
  ].filter((value): value is string => Boolean(value));
  const sources = new Map<string, CurrentTrainingSource>();
  for (const evidencePath of evidencePaths) {
    const source = await resolveTrainingSourceFromEvidencePath(evidencePath);
    if (source) sources.set(`${source.relativeRoot}/${source.runId}`, source);
  }
  return [...sources.values()];
}

async function resolveTrainingSourceFromEvidencePath(
  relativeEvidencePath: string,
): Promise<CurrentTrainingSource | null> {
  const normalized = relativeEvidencePath.replaceAll("\\", "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.split("/").some((segment) => segment === "..")
  )
    return null;
  let candidate = path.dirname(resolveInsideRoot(normalized));
  const projectRoot = path.resolve(root);
  while (
    candidate === projectRoot ||
    candidate.startsWith(`${projectRoot}${path.sep}`)
  ) {
    const artifactDirectory = path.join(candidate, "training-output");
    const artifactEntries = await readdir(artifactDirectory, {
      withFileTypes: true,
    }).catch(() => null);
    if (artifactEntries !== null) {
      const runRoot = candidate;
      const parentRoot = path.dirname(runRoot);
      const relativeRoot = projectRelativePath(parentRoot);
      const runId = path.basename(runRoot);
      if (
        runId &&
        relativeRoot &&
        !relativeRoot.startsWith("..") &&
        relativeRoot !== runId
      ) {
        return {
          absoluteRoot: parentRoot,
          relativeRoot,
          runId,
          artifactDirectory: "training-output",
        };
      }
      return null;
    }
    const parent = path.dirname(candidate);
    if (parent === candidate) break;
    candidate = parent;
  }
  return null;
}

async function readTrainingStages(
  registry: CurrentExecutionRegistrySnapshot,
): Promise<TrainingStageDetail[]> {
  const stages: TrainingStageDetail[] = [];
  const sources = await discoverCurrentTrainingSources(registry);
  for (const source of sources) {
    const entries = await readdir(source.absoluteRoot, {
      withFileTypes: true,
    }).catch(() => []);
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
      const record = manifest ?? progress;
      if (!record) continue;
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
      const stageStatus = executionClosed
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
        epochCount: metrics.length,
        bestEpoch: number(record.bestEpoch),
        bestValidationMetric: number(record.bestValidationMetric),
        checkpointPath: text(record.checkpointPath),
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
        liveProgress: normalizeLiveProgress(
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
    const failureRoot = path.join(source.absoluteRoot, "failures");
    const failures = await readdir(failureRoot, { withFileTypes: true }).catch(
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

async function readAuthorization() {
  const pointer = await readJson(ownerActionRequestPointerPath);
  const pointerRequestPath = text(pointer?.runPath);
  const requestCandidates: Array<{ path: string; request: JsonObject }> = [];
  if (pointerRequestPath) {
    const request = await readJson(pointerRequestPath);
    if (request) requestCandidates.push({ path: pointerRequestPath, request });
  }
  try {
    const ownerRequestRoot = path.join(
      root,
      ".runtime",
      "ai-painter",
      "owner-action-requests",
    );
    const directories = await readdir(ownerRequestRoot, {
      withFileTypes: true,
    });
    for (const directory of directories) {
      if (!directory.isDirectory()) continue;
      const requestPath = `.runtime/ai-painter/owner-action-requests/${directory.name}/request.json`;
      if (requestPath === pointerRequestPath) continue;
      const request = await readJson(requestPath);
      if (request) requestCandidates.push({ path: requestPath, request });
    }
  } catch {
    // The pointer remains a valid read-only fallback when the request directory is unavailable.
  }
  const latest =
    requestCandidates
      .sort((left, right) => {
        const leftTime =
          Date.parse(
            text(left.request.recordedAtUtc) ??
              text(left.request.updatedAtUtc) ??
              "",
          ) || 0;
        const rightTime =
          Date.parse(
            text(right.request.recordedAtUtc) ??
              text(right.request.updatedAtUtc) ??
              "",
          ) || 0;
        return rightTime - leftTime;
      })
      .at(0) ?? null;
  const requestPath = latest?.path ?? null;
  const request = latest?.request ?? null;
  const r2FinalizationPointer = await readJson(r2SmokeFinalizationPointerPath);
  const r2FinalizationPath = text(r2FinalizationPointer?.reportPath);
  const r2Finalization = r2FinalizationPath
    ? await readJson(r2FinalizationPath)
    : null;
  const terminalMatchesRequest =
    requestPath !== null &&
    text(r2Finalization?.authorizationPath) === requestPath &&
    text(r2Finalization?.status)?.endsWith("_stopped") === true;
  const blockerCode = text(request?.blockingReasonCode);
  const ownerMessageFallback =
    blockerCode ===
    "resolved_owner_authorized_v7_r2_smoke_record_closure_repair"
      ? "R2 Smoke 现有训练记录闭环修复已获授权，正在补齐7张预览的审核、登记与控制台入口。"
      : "Owner动作请求已记录；中文说明损坏，控制台已改用安全回退文案。";
  const minimumActionFallback =
    blockerCode ===
    "resolved_owner_authorized_v7_r2_smoke_record_closure_repair"
      ? "仅修复R2记录闭环并审核现有7张Epoch预览；不重新训练，不进入正式推理或世界。"
      : "请查看不可变请求文件和证据路径。";
  if (terminalMatchesRequest) {
    const passed = number(r2Finalization?.previewPassCount) ?? 0;
    const failed = number(r2Finalization?.previewFailCount) ?? 0;
    const terminalStatus = text(r2Finalization?.status);
    return {
      requestId: text(request?.requestId),
      status: terminalStatus,
      blockerCode:
        strings(r2Finalization?.blockers).at(0) ??
        terminalStatus ??
        "r2_smoke_record_closure_stopped",
      ownerMessage: `R2单样本Smoke记录闭环已完成：${passed}张机器通过、${failed}张机器拒绝，程序已停止。`,
      minimumRequestedAction:
        "查看失败预览和拒绝码；如需继续，只能另行授权下一轮有界修复，不得直接启动完整训练。",
      requestPath: r2FinalizationPath,
      requestSha256: r2FinalizationPath
        ? await sha256(r2FinalizationPath)
        : null,
      recordedAtUtc: text(r2Finalization?.createdAtUtc),
      recordedAtAsiaShanghai: text(r2Finalization?.createdAtAsiaShanghai),
    };
  }
  return {
    requestId: text(request?.requestId),
    status: text(request?.status),
    blockerCode,
    ownerMessage:
      readableHumanText(request?.ownerFacingMessageZh) ??
      readableHumanText(request?.ownerVisibleConclusionZh) ??
      ownerMessageFallback,
    minimumRequestedAction:
      readableHumanText(request?.minimumRequestedActionZh) ??
      minimumActionFallback,
    requestPath,
    requestSha256: requestPath ? await sha256(requestPath) : null,
    recordedAtUtc: text(request?.recordedAtUtc ?? request?.updatedAtUtc),
    recordedAtAsiaShanghai: text(
      request?.recordedAtAsiaShanghai ?? request?.updatedAtAsiaShanghai,
    ),
  };
}

async function readGpu() {
  try {
    const { stdout } = await execFileAsync(
      "nvidia-smi",
      [
        "--query-gpu=name,memory.total,memory.used,utilization.gpu,temperature.gpu,driver_version",
        "--format=csv,noheader,nounits",
      ],
      { windowsHide: true, timeout: 5_000 },
    );
    const [name, total, used, utilization, temperature, driver] = stdout
      .trim()
      .split(",")
      .map((value) => value.trim());
    const processResult = await execFileAsync(
      "nvidia-smi",
      ["--query-compute-apps=pid", "--format=csv,noheader,nounits"],
      { windowsHide: true, timeout: 5_000 },
    ).catch(() => ({ stdout: "" }));
    return {
      available: true,
      name,
      memoryTotalMiB: Number(total),
      memoryUsedMiB: Number(used),
      utilizationPercent: Number(utilization),
      temperatureCelsius: Number(temperature),
      driver,
      activeComputeProcessCount: processResult.stdout
        .trim()
        .split(/\r?\n/)
        .filter(Boolean).length,
    };
  } catch {
    return {
      available: false,
      name: "未检测到NVIDIA GPU",
      memoryTotalMiB: 0,
      memoryUsedMiB: 0,
      utilizationPercent: 0,
      temperatureCelsius: 0,
      driver: "--",
      activeComputeProcessCount: 0,
    };
  }
}

async function readHardware(): Promise<
  CurrentTrainingDashboardSnapshot["hardware"]
> {
  const hardwareScript = String.raw`
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$hardwareCpuRows = @(Get-CimInstance Win32_Processor)
$hardwareOsRow = Get-CimInstance Win32_OperatingSystem
$hardwareDiskRows = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
  $hardwareDiskTotal = [double]$_.Size
  $hardwareDiskFree = [double]$_.FreeSpace
  $hardwareDiskUsed = $hardwareDiskTotal - $hardwareDiskFree
  [pscustomobject]@{
    name = [string]$_.DeviceID
    volumeName = if ($_.VolumeName) { [string]$_.VolumeName } else { $null }
    fileSystem = if ($_.FileSystem) { [string]$_.FileSystem } else { $null }
    totalGiB = [math]::Round($hardwareDiskTotal / 1GB, 2)
    usedGiB = [math]::Round($hardwareDiskUsed / 1GB, 2)
    freeGiB = [math]::Round($hardwareDiskFree / 1GB, 2)
    usagePercent = if ($hardwareDiskTotal -gt 0) { [math]::Round(($hardwareDiskUsed / $hardwareDiskTotal) * 100, 1) } else { 0 }
  }
})
$hardwareAdapterRows = @(Get-NetAdapter -Physical -ErrorAction SilentlyContinue | ForEach-Object {
  [pscustomobject]@{
    name = [string]$_.Name
    status = [string]$_.Status
    linkSpeed = if ($_.LinkSpeed) { [string]$_.LinkSpeed } else { $null }
    interfaceDescription = if ($_.InterfaceDescription) { [string]$_.InterfaceDescription } else { $null }
  }
})
$hardwareCpuLoad = @($hardwareCpuRows | Where-Object { $null -ne $_.LoadPercentage } | ForEach-Object { [double]$_.LoadPercentage })
$hardwareCpuCurrentClock = @($hardwareCpuRows | Where-Object { $null -ne $_.CurrentClockSpeed } | ForEach-Object { [double]$_.CurrentClockSpeed })
$hardwareCpuMaxClock = @($hardwareCpuRows | Where-Object { $null -ne $_.MaxClockSpeed } | ForEach-Object { [double]$_.MaxClockSpeed })
$hardwareMemoryTotalMiB = [math]::Round(([double]$hardwareOsRow.TotalVisibleMemorySize) / 1024, 0)
$hardwareMemoryAvailableMiB = [math]::Round(([double]$hardwareOsRow.FreePhysicalMemory) / 1024, 0)
$hardwareMemoryUsedMiB = $hardwareMemoryTotalMiB - $hardwareMemoryAvailableMiB
$hardwareSnapshot = [pscustomobject]@{
  capturedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
  cpu = [pscustomobject]@{
    model = [string]($hardwareCpuRows | Select-Object -First 1 -ExpandProperty Name)
    loadPercent = if ($hardwareCpuLoad.Count -gt 0) { [math]::Round(($hardwareCpuLoad | Measure-Object -Average).Average, 1) } else { $null }
    physicalCoreCount = [int](($hardwareCpuRows | Measure-Object -Property NumberOfCores -Sum).Sum)
    logicalProcessorCount = [int](($hardwareCpuRows | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum)
    currentClockMhz = if ($hardwareCpuCurrentClock.Count -gt 0) { [math]::Round(($hardwareCpuCurrentClock | Measure-Object -Average).Average, 0) } else { $null }
    maxClockMhz = if ($hardwareCpuMaxClock.Count -gt 0) { [math]::Round(($hardwareCpuMaxClock | Measure-Object -Average).Average, 0) } else { $null }
    packageCount = [int]$hardwareCpuRows.Count
  }
  memory = [pscustomobject]@{
    totalMiB = $hardwareMemoryTotalMiB
    usedMiB = $hardwareMemoryUsedMiB
    availableMiB = $hardwareMemoryAvailableMiB
    usagePercent = if ($hardwareMemoryTotalMiB -gt 0) { [math]::Round(($hardwareMemoryUsedMiB / $hardwareMemoryTotalMiB) * 100, 1) } else { 0 }
  }
  disks = $hardwareDiskRows
  networkAdapters = $hardwareAdapterRows
  system = [pscustomobject]@{
    osCaption = [string]$hardwareOsRow.Caption
    version = [string]$hardwareOsRow.Version
    buildNumber = [string]$hardwareOsRow.BuildNumber
    architecture = [string]$hardwareOsRow.OSArchitecture
    hostname = [string]$hardwareOsRow.CSName
    uptimeSeconds = [math]::Floor(((Get-Date) - $hardwareOsRow.LastBootUpTime).TotalSeconds)
  }
}
$hardwareSnapshot | ConvertTo-Json -Compress -Depth 6
`;
  try {
    const { stdout } = await execFileAsync(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", hardwareScript],
      { windowsHide: true, timeout: 5_000, maxBuffer: 1024 * 1024 },
    );
    const parsed = JSON.parse(stdout.trim()) as JsonObject;
    const cpu = object(parsed.cpu);
    const memory = object(parsed.memory);
    const system = object(parsed.system);
    return {
      capturedAtUtc: text(parsed.capturedAtUtc) ?? new Date().toISOString(),
      cpu: {
        model: text(cpu?.model) ?? "未知CPU",
        loadPercent: number(cpu?.loadPercent),
        physicalCoreCount: number(cpu?.physicalCoreCount) ?? 0,
        logicalProcessorCount: number(cpu?.logicalProcessorCount) ?? 0,
        currentClockMhz: number(cpu?.currentClockMhz),
        maxClockMhz: number(cpu?.maxClockMhz),
        packageCount: number(cpu?.packageCount) ?? 0,
      },
      memory: {
        totalMiB: number(memory?.totalMiB) ?? 0,
        usedMiB: number(memory?.usedMiB) ?? 0,
        availableMiB: number(memory?.availableMiB) ?? 0,
        usagePercent: number(memory?.usagePercent) ?? 0,
      },
      disks: arrayObjects(parsed.disks).map((disk) => ({
        name: text(disk.name) ?? "--",
        volumeName: text(disk.volumeName),
        fileSystem: text(disk.fileSystem),
        totalGiB: number(disk.totalGiB) ?? 0,
        usedGiB: number(disk.usedGiB) ?? 0,
        freeGiB: number(disk.freeGiB) ?? 0,
        usagePercent: number(disk.usagePercent) ?? 0,
      })),
      networkAdapters: arrayObjects(parsed.networkAdapters).map((adapter) => ({
        name: text(adapter.name) ?? "--",
        status: text(adapter.status) ?? "Unknown",
        linkSpeed: text(adapter.linkSpeed),
        interfaceDescription: text(adapter.interfaceDescription),
      })),
      system: {
        osCaption: text(system?.osCaption) ?? "Windows",
        version: text(system?.version) ?? "--",
        buildNumber: text(system?.buildNumber) ?? "--",
        architecture: text(system?.architecture) ?? os.arch(),
        hostname: text(system?.hostname) ?? os.hostname(),
        uptimeSeconds: number(system?.uptimeSeconds) ?? Math.floor(os.uptime()),
      },
    };
  } catch {
    return fallbackHardware();
  }
}

function fallbackHardware(): CurrentTrainingDashboardSnapshot["hardware"] {
  const cpuRows = os.cpus();
  const totalMiB = Math.round(os.totalmem() / 1024 / 1024);
  const availableMiB = Math.round(os.freemem() / 1024 / 1024);
  const usedMiB = totalMiB - availableMiB;
  return {
    capturedAtUtc: new Date().toISOString(),
    cpu: {
      model: cpuRows[0]?.model ?? "未知CPU",
      loadPercent: null,
      physicalCoreCount: cpuRows.length,
      logicalProcessorCount: cpuRows.length,
      currentClockMhz: cpuRows[0]?.speed ?? null,
      maxClockMhz: cpuRows[0]?.speed ?? null,
      packageCount: cpuRows.length ? 1 : 0,
    },
    memory: {
      totalMiB,
      usedMiB,
      availableMiB,
      usagePercent: totalMiB
        ? Math.round((usedMiB / totalMiB) * 1_000) / 10
        : 0,
    },
    disks: [],
    networkAdapters: [],
    system: {
      osCaption: os.type(),
      version: os.release(),
      buildNumber: os.release(),
      architecture: os.arch(),
      hostname: os.hostname(),
      uptimeSeconds: Math.floor(os.uptime()),
    },
  };
}

function isSelectedByCurrentPythonDataset(row: JsonObject) {
  return (
    row.categoryId === "complete-maps" &&
    strings(row.trainingRoles).includes("conditional_denoiser") &&
    row.formalConditionalTrainingEligible === true &&
    row.conditionBound === true &&
    row.v7CapacityContributionRegistered === true &&
    row.ownerReviewStatus === "owner_approved" &&
    row.machineReviewStatus === "passed" &&
    row.aiAssistedColdStartEligible === true &&
    row.independentTrainingEligible === false
  );
}

function validateCheckpointLineage(stages: TrainingStageDetail[]) {
  const stage0 = stages.find((stage) => stage.resolutionStage === 0);
  const stage1 = stages.find((stage) => stage.resolutionStage === 1);
  const stage2 = stages.find((stage) => stage.resolutionStage === 2);
  return Boolean(
    stage0?.checkpointSha256 &&
    stage0.parentCheckpointSha256 === null &&
    stage1?.parentCheckpointSha256 === stage0.checkpointSha256 &&
    stage2?.parentCheckpointSha256 === stage1.checkpointSha256,
  );
}

function selectLatestRepairedStages(stages: TrainingStageDetail[]) {
  const selected: TrainingStageDetail[] = [];
  for (const resolutionStage of [0, 1, 2]) {
    const matching = stages.filter(
      (stage) =>
        stage.kind === "stage" &&
        stage.resolutionStage === resolutionStage &&
        stage.actualLoadedConditionalSampleCount === 64 &&
        stage.actualLoadedV7CapacityCount === 64 &&
        sameCounts(stage.actualLoadedSplitCounts, expectedSplits),
    );
    const latest = matching.at(-1);
    if (latest) selected.push(latest);
  }
  return selected;
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
  const entries = await readdir(previewRoot, { withFileTypes: true }).catch(
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

function normalizeTokenAccounting(
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

function normalizeLiveProgress(
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

function directCleanLatentLiveProgress(
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

function toEpochMetric(row: JsonObject): TrainingEpochMetric {
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

function stageNumber(runId: string) {
  const match = runId.match(/stage-?(\d+)/);
  return match ? Number(match[1]) : runId.includes("smoke") ? 0 : null;
}

function countSplits(rows: JsonObject[]) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const split = text(row.split) ?? "unknown";
    counts[split] = (counts[split] ?? 0) + 1;
    return counts;
  }, {});
}

function sameCounts(
  left: Record<string, number>,
  right: Record<string, number>,
) {
  return Object.keys(right).every((key) => (left[key] ?? 0) === right[key]);
}

function formatSplits(value: Record<string, number>) {
  return ["train", "validation", "challenge", "regression"]
    .map((key) => value[key] ?? 0)
    .join("/");
}

async function readJson(relativePath: string): Promise<JsonObject | null> {
  try {
    return JSON.parse(
      await readFile(resolveInsideRoot(relativePath), "utf8"),
    ) as JsonObject;
  } catch {
    return null;
  }
}

async function sha256(relativePath: string) {
  try {
    return createHash("sha256")
      .update(await readFile(resolveInsideRoot(relativePath)))
      .digest("hex");
  } catch {
    return null;
  }
}

function resolveInsideRoot(relativePath: string) {
  const absolutePath = path.resolve(root, relativePath);
  const logicalRoot = path.resolve(root);
  if (
    absolutePath !== logicalRoot &&
    !absolutePath.startsWith(`${logicalRoot}${path.sep}`)
  ) {
    throw new Error(
      `training dashboard path escapes project root: ${relativePath}`,
    );
  }
  return absolutePath;
}

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function arrayObjects(value: unknown) {
  return Array.isArray(value)
    ? value.map(object).filter((row): row is JsonObject => Boolean(row))
    : [];
}

function text(value: unknown) {
  return typeof value === "string" && value.length ? value : null;
}

function readableHumanText(value: unknown) {
  const candidate = text(value)?.trim() ?? null;
  if (!candidate) return null;
  const questionMarkCount = [...candidate].filter(
    (character) => character === "?",
  ).length;
  if (questionMarkCount / candidate.length >= 0.25) return null;
  return candidate;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numberRecord(value: unknown) {
  const row = object(value);
  if (!row) return {};
  return Object.fromEntries(
    Object.entries(row).flatMap(([key, item]) => {
      const parsed = number(item);
      return parsed === null ? [] : [[key, parsed]];
    }),
  );
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
