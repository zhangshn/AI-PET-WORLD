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
  const controlConvergence = record(input?.controlConvergence)
  const controlLayerConverged = controlConvergence.status === "stage3_stage4_control_layer_convergence_completed_closed"
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
      code: controlLayerConverged
        ? "new_independent_v9_validation_kernel_model_smoke_authorization_required"
        : latestBlockerCode,
      summaryZh: controlLayerConverged
        ? "Stage3/Stage4控制层状态分派阻断已结构性关闭；当前没有运行故障，下一步等待Owner授予一个新的独立V9 Validation Kernel模型Smoke额度。"
        : terminal.status === "v9-kernel_stage4_single_sample_30_epoch_gpu_smoke_execution_failed_closed"
        ? "Phase0工程资格已通过；唯一模型Smoke在样本选择授权状态门停止，训练未启动、权重未修改、预览与Checkpoint未生成。"
        : latestBlockerCode === "fixed_preview_machine_review_failed"
        ? `固定预览机器审核仅${previewPassCount ?? 0}/${previewCount ?? 0}通过，当前候选失败关闭。`
        : latestBlockerCode === "unified_preview_determinism_scope_blocks_training_backward"
          ? "统一预览确定性范围阻断首次训练反向传播；优化器步数为0、权重未修改、预览与Checkpoint均未生成，当前候选路线失败关闭。"
        : "当前R5 Stage4证据不完整或身份不一致，禁止推导下一执行。",
    },
    nextAllowedAction: {
      code: controlLayerConverged
        ? "owner_may_authorize_one_new_independent_v9_validation_kernel_model_smoke"
        : terminal.status === "v9-kernel_stage4_single_sample_30_epoch_gpu_smoke_execution_failed_closed"
        ? "owner_must_authorize_single_gate_status_fix_and_new_independent_model_smoke"
        : failedClosed
          ? "owner_must_choose_materially_different_stage4_route_or_stop_candidate_development"
        : "owner_must_explicitly_choose_new_analysis_candidate_or_execution",
      labelZh: controlLayerConverged
        ? "由项目所有者建立新的不可变授权并授予一个独立V9 Validation Kernel固定单样本30 Epoch模型Smoke额度；Smoke通过后才能另行授权Stage 0→1→2完整训练。"
        : terminal.status === "v9-kernel_stage4_single_sample_30_epoch_gpu_smoke_execution_failed_closed"
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
      controlLayerConverged,
    },
  }
}

export function projectAutonomousStage4TaskCapsule(input) {
  const pointer = record(input?.pointer)
  const terminal = record(input?.terminal)
  const savedCapsule = record(input?.savedCapsule)
  const evidence = Array.isArray(input?.evidence) ? input.evidence.map(normalizeEvidence) : []
  const progress = record(terminal.fixedTotalProgress)
  const verified = Boolean(
    terminal.executionState === "completed"
    && terminal.status === "failed_closed_candidate_space_exhausted"
    && terminal.selectedOutcome === "no_unique_bounded_candidate_remaining"
    && savedCapsule.status === terminal.status
    && savedCapsule.ownerAuthorizationRequired === false
    && savedCapsule.ownerResponseRequired === false
    && evidence.length >= 9
    && evidence.every((item) => item.sha256Verified),
  )
  const previewCount = finiteNumber(input?.previewCount)
  const previewPassCount = finiteNumber(input?.previewPassCount)
  return {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: stringValue(pointer.runId) ?? "stage4-autonomous-current",
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: {
      completedStages: finiteNumber(progress.completedStages),
      totalStages: finiteNumber(progress.totalStages),
      percent: finiteNumber(progress.percent),
      source: "stage4_autonomous_terminal",
    },
    currentStage: {
      number: 4,
      total: 5,
      labelZh: "Stage 0→1→2完整训练",
      status: "failed_closed_not_completed",
    },
    candidateTerminal: {
      runId: stringValue(pointer.runId),
      status: verified ? "failed_closed" : "unknown_or_stale",
      programStatus: stringValue(terminal.status),
      previewMachineStatus: previewCount === 0 ? null : "machine_reviews_failed",
      modelQualificationStatus: "not_qualified_no_unique_bounded_candidate_remaining",
      previewCount,
      previewPassCount,
      previewFailCount: previewCount === null || previewPassCount === null ? null : previewCount - previewPassCount,
      checkpointWritten: false,
      modelWeightsModified: false,
      recordedAtUtc: stringValue(terminal.recordedAtUtc),
      recordedAtAsiaShanghai: null,
    },
    latestBlocker: {
      code: "no_unique_bounded_candidate_remaining",
      summaryZh: "机器验证与候选复算均已完成；当前合同内可唯一派生的Stage4候选已穷尽，程序已安全关闭且没有训练运行。",
    },
    nextAllowedAction: {
      code: "remain_failed_closed_until_new_uniquely_derived_architecture_rule_exists",
      labelZh: "本地程序保持失败关闭；只有形成不重复既有失败路线、且可由当前合同唯一派生的新架构规则后，才可自主重新进入能力生命周期。",
      ownerAuthorizationRequired: false,
      automaticExecutionAllowed: true,
      planEvidenceConfirmed: true,
    },
    forbiddenActions: [
      "repeat_exited_route",
      "free_hyperparameter_selection",
      "reuse_failed_checkpoint",
      "lower_machine_review_threshold",
      "start_stage1_or_stage2",
    ],
    taskIdentity: {
      modelId: "stage4-authoritative-semantic-carrier",
      sampleId: "194",
      conditionLabel: "validation-194",
      sampleSplit: "validation",
      seed: 20263722,
      requiredBoundarySides: ["west"],
    },
    evidence,
    integrity: {
      status: verified ? "verified" : "incomplete_or_mismatched",
      requiredEvidencePresent: evidence.length >= 9,
      boundEvidenceVerified: evidence.every((item) => item.sha256Verified),
      identityMatches: stringValue(pointer.runId) === stringValue(savedCapsule.runId),
      migrationRegistryStatus: "local_autonomous_runtime_active",
    },
  }
}

export function projectPostDecodeObjectRgbSmokeTaskCapsule(input) {
  const terminal = record(input?.terminal)
  const finalization = record(input?.finalization)
  const review = record(input?.review)
  const qualification = record(input?.qualification)
  const lifecycle = record(input?.lifecycle)
  const evidence = Array.isArray(input?.evidence) ? input.evidence.map(normalizeEvidence) : []
  const progress = record(terminal.fixedTotalProgress)
  const previewCount = finiteNumber(review.previewCount)
  const previewPassCount = finiteNumber(review.previewPassCount)
  const previewFailCount = finiteNumber(review.previewFailCount)
  const identityMatches = Boolean(
    terminal.capabilityVersion
    && terminal.capabilityVersion === finalization.capabilityVersion
    && finalization.capabilityVersion === lifecycle.capabilityVersion,
  )
  const qualified = Boolean(
    terminal.executionState === "completed"
    && terminal.status === "post_decode_object_rgb_controlled_smoke_qualified"
    && finalization.status === terminal.status
    && qualification.status === "qualified"
    && qualification.qualified === true
    && qualification.terminalRegression === false
    && lifecycle.state === "controlled_smoke_completed"
  )
  const failedClosed = Boolean(
    terminal.executionState === "completed"
    && terminal.status === "post_decode_object_rgb_controlled_smoke_real_visual_failure"
    && finalization.status === terminal.status
    && qualification.qualified === false
  )
  const requiredEvidencePresent = evidence.length >= 7
  const boundEvidenceVerified = requiredEvidencePresent && evidence.every((item) => item.sha256Verified)
  const verified = identityMatches && boundEvidenceVerified && (qualified || failedClosed)
  const candidateStatus = verified
    ? qualified
      ? "qualified"
      : "failed_closed"
    : "unknown_or_stale"

  return {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: stringValue(terminal.attemptId) ?? "stage4-post-decode-object-rgb-smoke",
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: {
      completedStages: finiteNumber(progress.completedStages),
      totalStages: finiteNumber(progress.totalStages),
      percent: finiteNumber(progress.percent),
      source: "stage4_post_decode_object_rgb_smoke_terminal",
    },
    currentStage: {
      number: 4,
      total: 5,
      labelZh: "Stage 0→1→2完整训练",
      status: qualified
        ? "controlled_smoke_qualified_formal_stage0_not_started"
        : failedClosed
          ? "controlled_smoke_failed_closed"
          : "evidence_incomplete",
    },
    candidateTerminal: {
      runId: stringValue(terminal.attemptId),
      status: candidateStatus,
      programStatus: stringValue(terminal.status),
      previewMachineStatus: qualified
        ? "late_stability_qualified"
        : stringValue(review.status),
      modelQualificationStatus: qualified
        ? "qualified_for_formal_stage0_not_checkpoint_promotable"
        : failedClosed
          ? "not_qualified_real_visual_failure"
          : "unknown_or_stale",
      previewCount,
      previewPassCount,
      previewFailCount,
      checkpointWritten: Boolean(record(finalization.checkpoint).path),
      modelWeightsModified: true,
      recordedAtUtc: stringValue(terminal.recordedAtUtc),
      recordedAtAsiaShanghai: null,
    },
    latestBlocker: {
      code: qualified
        ? "formal_stage0_not_started_after_qualified_smoke"
        : failedClosed
          ? "controlled_smoke_real_visual_failure"
          : "post_decode_smoke_evidence_incomplete",
      summaryZh: qualified
        ? "受控Smoke时间线为6→3→2→0→0，Epoch 20和30连续全部通过，后期稳定资格已通过；当前阻断是正式Stage 0尚未启动，不是终态六项失败。"
        : failedClosed
          ? "受控Smoke已保存真实视觉失败并关闭；早期失败不会被伪造为后期资格。"
          : "解码后对象RGB候选的终态、审核、后期资格或生命周期证据不完整。",
    },
    nextAllowedAction: {
      code: qualified
        ? "local_ai_compile_and_execute_fresh_formal_stage0"
        : "local_ai_close_or_select_next_bounded_route",
      labelZh: qualified
        ? "本地程序应使用同一候选的固定随机初始化编译并执行40 Epoch正式Stage 0；Smoke Checkpoint不得晋级或作为初始化。"
        : "本地程序保存失败证据并按生效能力合同关闭或选择下一有界路线。",
      ownerAuthorizationRequired: false,
      automaticExecutionAllowed: qualified,
      planEvidenceConfirmed: input?.planEvidenceConfirmed === true,
    },
    forbiddenActions: [
      "promote_smoke_checkpoint",
      "initialize_formal_stage0_from_smoke_checkpoint",
      "lower_machine_review_threshold",
      "start_stage1_before_formal_stage0_success",
      "start_stage2_before_formal_stage1_success",
    ],
    taskIdentity: {
      modelId: "ai-painter-stage4-post-decode-object-rgb-compositor-candidate",
      sampleId: "194",
      conditionLabel: "v7-complete-map-194",
      sampleSplit: "validation",
      seed: 20263722,
      requiredBoundarySides: ["west"],
    },
    evidence,
    integrity: {
      status: verified ? "verified" : "incomplete_or_mismatched",
      requiredEvidencePresent,
      boundEvidenceVerified,
      identityMatches,
      migrationRegistryStatus: "local_autonomous_runtime_active",
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
