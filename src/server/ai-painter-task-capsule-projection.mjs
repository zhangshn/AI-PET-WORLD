const REQUIRED_EVIDENCE_KINDS = [
  "stage4_terminal",
  "stage4_finalization",
  "machine_review",
  "owner_authorization",
  "owner_implementation_consumption",
  "owner_gpu_execution_consumption",
  "unique_module_plan",
  "migration_registry",
]

export function projectR5Stage4TaskCapsule(input) {
  const terminal = record(input?.terminal)
  const finalization = record(input?.finalization)
  const review = record(input?.review)
  const authorization = record(input?.authorization)
  const taskIdentity = {
    ...record(authorization.fixedTaskIdentity),
    ...record(authorization.taskIdentity),
  }
  const progress = {
    ...record(terminal.fixedTotalProgress),
    ...record(terminal.fixedOverallProgress),
  }
  const evidence = Array.isArray(input?.evidence) ? input.evidence.map(normalizeEvidence) : []
  const evidenceByKind = new Map(evidence.map((item) => [item.kind, item]))
  const requiredEvidencePresent = REQUIRED_EVIDENCE_KINDS.every((kind) => evidenceByKind.has(kind))
  const boundEvidenceVerified = REQUIRED_EVIDENCE_KINDS.every((kind) => {
    const item = evidenceByKind.get(kind)
    return item?.sha256Verified === true
  })
  const identityMatches = Boolean(
    terminal.runId
      && terminal.runId === finalization.runId
      && finalization.runId === review.runId,
  )
  const verified = requiredEvidencePresent && boundEvidenceVerified && identityMatches
  const previewCount = finiteNumber(review.previewCount)
  const previewPassCount = finiteNumber(review.previewPassCount)
  const previewFailCount = finiteNumber(review.previewFailCount)
  const blockerCodes = strings(terminal.blockers)
  const latestBlockerCode = blockerCodes[0] ?? "unknown_or_stale"
  const failedClosed = verified && (
    (
      terminal.status === "stage4_bounded_repair_single_sample_gpu_smoke_failed_stopped"
      && review.status === "machine_reviews_failed_closed"
    )
    || (
      terminal.status === "stage4_continuous_closure_candidate_route_failed_closed"
      && review.status === "machine_reviews_not_started_training_execution_failed_closed"
    )
    || (
      terminal.status === "v9-kernel_stage4_single_sample_30_epoch_gpu_smoke_execution_failed_closed"
      && review.status === "machine_reviews_not_started_training_authorization_gate_failed_closed"
    )
  )

  return {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: terminal.runId
      ? `ai-painter-r5-stage4-${terminal.runId}`
      : "ai-painter-r5-stage4-unknown",
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: {
      id: "ai-painter-v7-failure-learning-r5",
      nameZh: "AI Painter V7失败学习与R5隔离候选",
    },
    fixedOverallProgress: {
      completedStages: finiteNumber(progress.completedStages),
      totalStages: finiteNumber(progress.totalStages),
      percent: finiteNumber(progress.percent),
      source: "stage4_terminal",
    },
    currentStage: {
      number: 4,
      total: 5,
      labelZh: "Stage 0→1→2完整训练",
      status: terminal.stage4Complete === true ? "completed" : "in_progress_not_completed",
    },
    candidateTerminal: {
      runId: stringValue(terminal.runId),
      status: failedClosed ? "failed_closed" : "unknown_or_stale",
      programStatus: stringValue(terminal.status),
      previewMachineStatus: stringValue(review.status),
      modelQualificationStatus: failedClosed ? "not_qualified_checkpoint_not_promotable" : "unknown_or_stale",
      previewCount,
      previewPassCount,
      previewFailCount,
      checkpointWritten: finalization.smokeCheckpointWritten === true,
      modelWeightsModified: finalization.modelWeightsModified === true,
      recordedAtUtc: stringValue(terminal.recordedAtUtc),
      recordedAtAsiaShanghai: stringValue(terminal.recordedAtAsiaShanghai),
    },
    latestBlocker: {
      code: latestBlockerCode,
      summaryZh: terminal.status === "v9-kernel_stage4_single_sample_30_epoch_gpu_smoke_execution_failed_closed"
        ? "Phase0工程资格已通过；唯一模型Smoke在样本选择授权状态门停止，训练未启动、权重未修改、预览与Checkpoint未生成。"
        : latestBlockerCode === "fixed_preview_machine_review_failed"
        ? `固定预览机器审核仅${previewPassCount ?? 0}/${previewCount ?? 0}通过，当前候选失败关闭。`
        : latestBlockerCode === "unified_preview_determinism_scope_blocks_training_backward"
          ? "统一预览确定性范围阻断首次训练反向传播；优化器步数为0、权重未修改、预览与Checkpoint均未生成，当前候选路线失败关闭。"
        : "当前R5 Stage4证据不完整或身份不一致，禁止推导下一执行。",
    },
    nextAllowedAction: {
      code: terminal.status === "v9-kernel_stage4_single_sample_30_epoch_gpu_smoke_execution_failed_closed"
        ? "owner_must_authorize_single_gate_status_fix_and_new_independent_model_smoke"
        : failedClosed
          ? "owner_must_choose_materially_different_stage4_route_or_stop_candidate_development"
        : "owner_must_explicitly_choose_new_analysis_candidate_or_execution",
      labelZh: terminal.status === "v9-kernel_stage4_single_sample_30_epoch_gpu_smoke_execution_failed_closed"
        ? "由项目所有者以新的不可变授权绑定本次失败终态，仅集中修正样本选择授权状态门，并授予新的独立模型Smoke额度；不得使用已消费授权重跑或直接启动完整训练。"
        : failedClosed
          ? "由项目所有者选择实质不同的Stage4路线或停止候选开发；不得修补后重跑本次Smoke，也不得直接启动完整训练。"
        : "由项目所有者以新的明确授权选择后续分析、候选或执行；不得自动重试或直接启动完整训练。",
      ownerAuthorizationRequired: true,
      automaticExecutionAllowed: false,
      planEvidenceConfirmed: input?.planEvidenceConfirmed === true,
    },
    forbiddenActions: [
      "automatic_retry",
      "reuse_failed_smoke_checkpoint_for_promotion",
      "start_stage4_full_training_without_new_owner_authorization",
      "start_stage1_or_stage2",
      "start_stage5_strict_revalidation",
      "formal_inference",
      "checkpoint_formal_promotion",
      "runtime_frame",
      "world_entry",
    ],
    taskIdentity: {
      modelId: stringValue(taskIdentity.modelId),
      sampleId: stringValue(taskIdentity.sampleId),
      conditionLabel: stringValue(taskIdentity.conditionLabel),
      sampleSplit: stringValue(taskIdentity.sampleSplit),
      seed: finiteNumber(taskIdentity.seed),
      requiredBoundarySides: strings(taskIdentity.requiredBoundarySides),
    },
    evidence,
    integrity: {
      status: verified ? "verified" : "incomplete_or_mismatched",
      requiredEvidencePresent,
      boundEvidenceVerified,
      identityMatches,
      migrationRegistryStatus: stringValue(input?.migrationRegistryStatus),
    },
  }
}

function normalizeEvidence(value) {
  const row = record(value)
  const sha256 = stringValue(row.sha256)
  const expectedSha256 = stringValue(row.expectedSha256)
  return {
    kind: stringValue(row.kind) ?? "unknown",
    labelZh: stringValue(row.labelZh) ?? "未命名证据",
    path: stringValue(row.path) ?? "",
    sha256,
    expectedSha256,
    sha256Verified: Boolean(
      sha256
        && (!expectedSha256 || sha256 === expectedSha256),
    ),
    recordedAtUtc: stringValue(row.recordedAtUtc),
    recordedAtAsiaShanghai: stringValue(row.recordedAtAsiaShanghai),
  }
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {}
}

function stringValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function strings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : []
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}
