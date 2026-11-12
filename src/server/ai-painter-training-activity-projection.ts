import type { CurrentExecutionActivity, CurrentTrainingDashboardSnapshot, TrainingStageDetail } from "@/server/ai-painter-current-training-types";
import type { readTrainingControlState, readTrainingRuntimeStatus } from "@/server/ai-painter-training-state";
import { object, text, number, directCleanLatentLiveProgress, type JsonObject } from "@/server/ai-painter-training-progress-projection";
import { selectLiveActivityState } from "@/server/ai-painter-live-activity-projection.mjs";
import { ageMilliseconds } from "@/shared/ai-console/ai-console-training-time";

function observedAgeSeconds(value: string | null | undefined): number | null {
  const age = ageMilliseconds(value);
  return age === null ? null : age / 1000;
}

export function projectPostDecodeFormalExecutionActivity({
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
  const failed = isFormalStage0TerminalStatus(
    terminalStatus,
    "real_visual_failure",
  );
  const completed = isFormalStage0TerminalStatus(terminalStatus, "completed");
  const running = !failed && !completed && stateStatus === "running" && statePhase === "training";
  const reviewing = !failed && !completed &&
    stateStatus === "running" && statePhase === "automatic_machine_review";
  if (!running && !reviewing && !failed && !completed) return activity;

  const observedRunId = activity.progress.runId ?? activity.taskId;
  const sameRun = observedRunId === execution.runId;
  const activeLifecycle = activity.lifecycle === "running" ||
    activity.lifecycle === "reviewing" || activity.lifecycle === "initializing";
  // The latest training record must not replace a different current execution.
  if (activeLifecycle && !sameRun) return activity;
  const matchingLiveExecution = sameRun && activeLifecycle &&
    !activity.stalled && activity.process.childAlive;
  const stalled = (running || reviewing) && !matchingLiveExecution;

  const stage = stages.find((value) => value.runId === execution.runId) ?? null;
  const live =
    object(execution.progress?.liveProgress) ??
    (execution.progress
      ? directCleanLatentLiveProgress(execution.progress)
      : null);
  const reviewCompleted =
    number(execution.reviewProgress?.completedPreviewCount) ??
    number(execution.reviewProgress?.completedReviewCount);
  const reviewTotal =
    number(execution.reviewProgress?.previewCount) ??
    number(execution.reviewProgress?.targetReviewCount);
  const missingProgress = ["epochTarget", "batch", "batchTarget", "optimizerStep", "optimizerStepTarget", "percentage"]
    .some((field) => number(live?.[field]) === null);
  const latestMetric = stage?.metrics.at(-1) ?? null;
  const latestPreview = stage?.previews.at(-1) ?? null;
  const timestamp =
    text(execution.terminal?.recordedAtUtc) ??
    text(execution.state.updatedAtUtc) ??
    execution.occurredAtUtc;
  const lifecycle: CurrentExecutionActivity["lifecycle"] = stalled
    ? "stalled"
    : running
    ? "running"
    : reviewing
      ? "reviewing"
      : failed
        ? "failed"
        : "completed";
  return {
    ...activity,
    progressUnavailableReason: missingProgress ? "progress_observation_incomplete" : null,
    actor: "local_program",
    actorLabelZh: running ? "本地AI训练程序" : "本地AI审核程序",
    lifecycle,
    lifecycleLabelZh: stalled
      ? "未观察到匹配活动执行"
      : running
      ? "正式训练中"
      : reviewing
        ? "机器验证中"
        : failed
          ? "验证失败"
          : "验证通过",
    localAiProcessActive: (running || reviewing) && matchingLiveExecution && activity.localAiProcessActive,
    taskId: execution.runId,
    taskKind: stalled
      ? "unconfirmed_formal_stage0_execution"
      : running
      ? "formal_stage0_training"
      : reviewing
        ? "automatic_machine_review"
        : "machine_review_terminal",
    taskLabelZh: stalled
      ? "运行记录缺少匹配的活动执行"
      : running
      ? "Stage 0正式训练进行中"
      : reviewing
        ? `正在自动审核固定预览 ${reviewCompleted ?? "未记录"}/${reviewTotal ?? "未记录"}`
        : failed
          ? "自动验证完成，候选失败关闭"
          : "自动验证完成，Stage 0通过",
    detailZh: (stalled
      ? "执行记录仍标记为训练或审核，但未观察到同一Run的有效活动进程；保留已有记录，不将其视为正在运行。"
      : running
      ? "本地程序正在执行正式训练；完成后由同一执行器自动进入固定阈值机器审核和终态收口。"
      : reviewing
        ? `训练已经完成；本地程序正在执行固定阈值机器审核，当前已完成${reviewCompleted ?? "未记录"}/${reviewTotal ?? "未记录"}，并持续保存不可变进度。`
        : failed
          ? `机器审核已完成：${number(execution.review?.previewPassCount) ?? "未记录"}/${number(execution.review?.previewCount) ?? "未记录"}个固定节点通过；失败证据和裁决均已保存。`
          : "训练、预览复现和机器审核已经通过，终态证据已保存。")
      + (missingProgress ? " 部分进度读数未记录，缺失值不作估算。" : ""),
    source: stalled
      ? "formal_stage0_state_without_live_execution"
      : running || reviewing
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
    heartbeatAgeSeconds: observedAgeSeconds(timestamp),
    stalled,
    process: sameRun ? activity.process : {
      controllerPid: null,
      controllerAlive: false,
      childPid: null,
      childAlive: false,
      commandIdentity: null,
    },
    accounting: sameRun ? activity.accounting : {
      ...activity.accounting,
      localModel: { available: false, unit: "latent_spatial_token", total: null, source: null },
      externalApi: { available: false, providerCalls: null, totalTokens: null, source: null },
    },
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
        : null,
      epoch: number(live?.epoch) ?? stage?.epochCount ?? null,
      epochTarget: number(live?.epochTarget),
      batch: number(live?.batch),
      batchTarget: number(live?.batchTarget),
      optimizerStep: number(live?.optimizerStep),
      optimizerStepTarget: number(live?.optimizerStepTarget),
      percentage: number(live?.percentage),
      elapsedSeconds: number(live?.elapsedSeconds),
      etaSeconds: stalled ? null : running ? number(live?.etaSeconds) : 0,
      optimizerStepsPerSecond: number(live?.optimizerStepsPerSecond),
      lastBatchDurationSeconds: number(live?.lastBatchDurationSeconds) ??
        (sameRun ? activity.progress.lastBatchDurationSeconds : null),
      samplesInBatch: number(live?.samplesInBatch) ??
        (sameRun ? activity.progress.samplesInBatch : null),
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

export function isFormalStage0TerminalStatus(
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

export function projectFormalTrainingStatusEvidence(
  execution: PostDecodeFormalExecutionProjection | null,
  activity: CurrentExecutionActivity,
  taskIdentity: CurrentTrainingDashboardSnapshot["status"]["taskIdentity"],
): Array<CurrentTrainingDashboardSnapshot["status"] & { valid: boolean }> {
  if (!execution) return [];
  const terminalStatus = text(execution.terminal?.status);
  const failed = isFormalStage0TerminalStatus(terminalStatus, "real_visual_failure");
  const completed = isFormalStage0TerminalStatus(terminalStatus, "completed");
  const matchingActivity = activity.progress.runId === execution.runId &&
    activity.process.childAlive && !activity.stalled && !failed && !completed;
  const reviewCompleted = number(execution.reviewProgress?.completedPreviewCount) ??
    number(execution.reviewProgress?.completedReviewCount);
  const reviewTotal = number(execution.reviewProgress?.previewCount) ??
    number(execution.reviewProgress?.targetReviewCount);
  const terminalBase = {
    source: "current_execution_registry_latest_training_terminal",
    occurredAtUtc: text(execution.terminal?.recordedAtUtc),
    terminalPriority: 110,
    taskIdentity: { ...taskIdentity },
  };
  const activityBase = {
    source: activity.source,
    occurredAtUtc: activity.lastHeartbeatAtUtc,
    taskIdentity: { ...taskIdentity, trainingChainId: execution.runId },
  };
  return [
    {
      ...terminalBase,
      code: "formal_stage0_real_visual_failure",
      label: "Stage 0验证完成，真实视觉失败",
      summary: `正式Stage 0自动机器审核失败：${number(execution.review?.previewPassCount) ?? "未记录"}/${number(execution.review?.previewCount) ?? "未记录"}个固定节点通过；候选已失败关闭并保存证据。`,
      currentStep: "formal_stage0_failed_closed_after_machine_review",
      valid: failed,
    },
    {
      ...terminalBase,
      code: "formal_stage0_completed",
      label: "Stage 0训练与验证通过",
      summary: "正式Stage 0训练、固定预览复现和机器审核均已通过。",
      currentStep: "autonomous_stage1_compilation",
      valid: completed,
    },
    {
      ...activityBase,
      code: "formal_stage0_reviewing",
      label: "Stage 0训练完成，机器验证中",
      summary: `本地程序正在审核固定预览（${reviewCompleted ?? "未记录"}/${reviewTotal ?? "未记录"}）并形成终态。`,
      currentStep: "automatic_machine_review",
      terminalPriority: 20,
      valid: matchingActivity && activity.lifecycle === "reviewing" &&
        text(execution.state.status) === "running" && text(execution.state.phase) === "automatic_machine_review",
    },
    {
      ...activityBase,
      code: "formal_stage0_running",
      label: "Stage 0正式训练进行中",
      summary: `本地程序正在执行正式Stage 0训练，当前轮数 ${activity.progress.epoch ?? "未记录"}/${activity.progress.epochTarget ?? "未记录"}。`,
      currentStep: "formal_stage0_training",
      terminalPriority: 10,
      valid: matchingActivity && activity.lifecycle === "running" &&
        text(execution.state.status) === "running" && text(execution.state.phase) === "training",
    },
  ];
}

export function projectCurrentExecutionActivity({
  control,
  runtimeStatus,
  stages,
  epochTarget,
  localProcesses,
  projectRelativePath,
  activeRunId,
}: {
  control: Awaited<ReturnType<typeof readTrainingControlState>>;
  runtimeStatus: Awaited<ReturnType<typeof readTrainingRuntimeStatus>>;
  stages: TrainingStageDetail[];
  epochTarget: number | null;
  localProcesses: LocalProcessEvidence[];
  projectRelativePath: (value: string) => string;
  activeRunId: string | null;
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
        (stage) => Boolean(activeRunId) && stage.runId === activeRunId &&
          (stage.status === "running" || stage.status === "starting"),
      ) ?? null;
  const progressStage = localProcessActive ? activeStage : null;
  const liveProgress = progressStage?.liveProgress ?? null;
  const latestMetric = progressStage?.metrics.at(-1) ?? null;
  const latestPreview = progressStage?.previews.at(-1) ?? null;
  const currentEpoch = liveProgress?.epoch ?? progressStage?.epochCount ?? null;
  const targetEpoch = progressStage
    ? (liveProgress?.epochTarget ?? epochTarget)
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
  const heartbeatAgeSeconds = observedAgeSeconds(latestActivityAtUtc);
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
        ? (activeRunId ?? (heartbeatClaimsExecution || waitingForOwner
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

export type PostDecodeFormalExecutionProjection = {
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

export type LocalProcessEvidence = {
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
