import { createTrainingStageHistoryReader, type CurrentTrainingSource } from "@/server/ai-painter-training-stage-history";
import { createValidationHistoryReader } from "@/server/ai-painter-training-validation-history";
import { projectCurrentExecutionActivity, projectPostDecodeFormalExecutionActivity, projectFormalTrainingStatusEvidence, type PostDecodeFormalExecutionProjection, type LocalProcessEvidence } from "@/server/ai-painter-training-activity-projection";
import {
  classifyBoundActiveTrainingProgress,
  countSplits, sameCounts, formatSplits,
  object, arrayObjects, text, readableHumanText, number, strings,
  type JsonObject,
} from "@/server/ai-painter-training-progress-projection";
export { classifyBoundActiveTrainingProgress, adaptV24TrainingProgress } from "@/server/ai-painter-training-progress-projection";
import { readGpu, readHardware } from "@/server/ai-painter-training-hardware";
import {runtimeWorkingDirectory,resolveRuntimePath} from '../../scripts/lib/runtime-working-directory.mjs'
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";

import path from "node:path";
import { promisify } from "node:util";
import type {
  CurrentTrainingDashboardSnapshot,
  AiPainterTaskCapsule,
  TrainingStageDetail,
  V7CapacityRow,
} from "@/server/ai-painter-current-training-types";
import {
  readTrainingControlState,
  readTrainingProcessLedger,
  readTrainingRuntimeStatus,
} from "@/server/ai-painter-training-state";
import { selectAuthoritativeTrainingEvidence } from "@/server/ai-painter-training-status-projection.mjs";
import { readCurrentExecutionRegistry } from "@/server/ai-painter-current-execution-registry.mjs";

const execFileAsync = promisify(execFile);
const root = runtimeWorkingDirectory();
type CurrentExecutionRegistrySnapshot = Awaited<
  ReturnType<typeof readCurrentExecutionRegistry>
>;

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

const expectedSplits = {
  train: 48,
  validation: 8,
  challenge: 4,
  regression: 4,
};
const readStrictValidationBatches = createValidationHistoryReader({
  readJson,
  sha256,
  listDirectories: (relativePath) => readdir(resolveInsideRoot(relativePath), { withFileTypes: true }),
});

const readTrainingStages = createTrainingStageHistoryReader({
  discoverCurrentTrainingSources, readJson, sha256, expectedSplits,
  listDirectory: (absolutePath) => readdir(absolutePath, { withFileTypes: true }),
});

const cacheTtlMs = 2_500;

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
  const activeTaskIdentity = {
    modelId: taskCapsule.taskIdentity.modelId ?? text(config?.modelId),
    datasetPackageId: text(datasetManifest?.packageId),
    checkpointSha256: latestStage?.checkpointSha256 ?? null,
    trainingChainId: null,
  };
  const training = object(config?.training);
  const projectedActivity = projectCurrentExecutionActivity({
    control,
    runtimeStatus,
    stages,
    epochTarget: number(training?.denoiserEpochs),
    activeRunId: currentRegistry.ok ? text(currentRegistry.registry.activeExecution?.runId) : null,
    localProcesses,
    projectRelativePath,
  });
  const activity = projectPostDecodeFormalExecutionActivity({
    activity: projectedActivity,
    execution: postDecodeFormalExecution,
    stages,
  });
  const registryFailureStatus: CurrentTrainingDashboardSnapshot["status"] = {
    code: "current_registry_unknown_or_stale",
    label: "当前执行登记无效，已禁止历史回退",
    summary:
      "唯一当前执行登记缺失、损坏或证据不一致；当前任务不能确认，不使用历史训练状态替代登记故障。",
    currentStep: "repair_current_execution_registry_from_immutable_evidence",
    source: "current_execution_registry",
    occurredAtUtc: null,
    terminalPriority: 130,
    taskIdentity: { ...activeTaskIdentity },
  };
  const projectedStatus = currentRegistry.ok ? selectAuthoritativeTrainingEvidence(
    [
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
        valid: currentRegistry.ok && activity.lifecycle === "running" && !activity.stalled && activity.process.childAlive,
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
      ...projectFormalTrainingStatusEvidence(postDecodeFormalExecution, activity, activeTaskIdentity),
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
  ) : registryFailureStatus;
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
  const dashboardStatus =
    currentRegistry.ok && activity.lifecycle === "running" && !activity.stalled && activity.process.childAlive && activity.progress
      ? {
          code: activity.taskKind === "formal_stage0_training" ? "formal_stage0_running" as const : "running" as const,
          label: activity.lifecycleLabelZh,
          summary: `${activity.taskLabelZh}；阶段 ${activity.progress.stageLabel ?? "未记录"}，轮数 ${activity.progress.epoch ?? "未记录"}/${activity.progress.epochTarget ?? "未记录"}，优化步 ${activity.progress.optimizerStep ?? "未记录"}/${activity.progress.optimizerStepTarget ?? "未记录"}。`,
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

function projectRelativePath(value: string) {
  const relative = path.relative(root, value);
  return relative && !relative.startsWith("..")
    ? relative.replaceAll("\\", "/")
    : value;
}

/**
 * The dashboard is a projection of the single current-execution registry. It
 * never scans historical directories to choose the current Run. Active work is
 * bound from the verified registry lock; the latest terminal remains a
 * separate read-only source for historical continuity.
 */
async function discoverCurrentTrainingSources(
  registry: CurrentExecutionRegistrySnapshot,
): Promise<CurrentTrainingSource[]> {
  if (!registry.ok) return [];
  const sources = new Map<string, CurrentTrainingSource>();
  const activeProbe = classifyBoundActiveTrainingProgress(
    registry.registry,
    null,
  );
  if (activeProbe.source) {
    const activeProgress = await readJson(activeProbe.source.progressPath);
    const active = classifyBoundActiveTrainingProgress(
      registry.registry,
      activeProgress,
    );
    if (active.status === "connected" && active.source) {
      const relativeRoot = path.posix.dirname(active.source.outputRoot);
      sources.set(`active:${active.source.outputRoot}`, {
        absoluteRoot: resolveInsideRoot(relativeRoot),
        relativeRoot,
        runId: active.source.runId,
        packageId: active.source.packageId,
        artifactDirectory: null,
        role: "active",
      });
    }
  }
  const latest = object(registry.registry.latestTrainingTerminal);
  const evidence = object(latest?.evidence);
  const evidencePaths = [
    text(latest?.path),
    ...Object.values(evidence ?? {}).flatMap((value) => {
      const item = object(value);
      return item ? [text(item.path)] : [];
    }),
  ].filter((value): value is string => Boolean(value));
  for (const evidencePath of evidencePaths) {
    const source = await resolveTrainingSourceFromEvidencePath(evidencePath);
    if (source)
      sources.set(`latest:${source.relativeRoot}/${source.runId}`, source);
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
  const projectRoot = resolveRuntimePath(root);
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
          packageId: null,
          artifactDirectory: "training-output",
          role: "latest",
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
  const absolutePath = resolveRuntimePath(root, relativePath);
  const logicalRoot = resolveRuntimePath(root);
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

