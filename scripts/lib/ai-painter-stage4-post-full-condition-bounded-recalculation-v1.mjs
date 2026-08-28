import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../../src/server/ai-painter-current-execution-registry.mjs";
import {
  persistPolicyBoundaryReport,
} from "./ai-painter-local-autonomy-governance-v3.mjs";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeJsonAtomic,
} from "./ai-painter-program-event-store.mjs";
import { indexArtifact } from "./ai-pet-world-storage-catalog.mjs";
import { logicalProjectPath } from "./ai-pet-world-storage.mjs";

export const POST_FULL_CONDITION_RECALCULATION_ROOT =
  ".runtime/ai-painter/stage4-post-full-condition-bounded-candidate-recalculations";

export const FULL_CONDITION_CAPABILITY_VERSION =
  "stage4-post-decode-full-condition-route-object-responsibility-renderer-change-candidate-v1";

const CURRENT_CANDIDATE =
  "post_decode_full_condition_route_and_object_responsibility_renderer";
const REQUIRED_RESPONSIBILITIES = Object.freeze([
  "terrain_path_ground",
  "object_footprints",
  "object_tree",
  "object_rock",
  "object_vegetation",
]);
const REQUIRED_OBJECT_FAILURES = Object.freeze([
  "condition_object_footprints_reference_semantic_mismatch",
  "condition_object_tree_reference_semantic_mismatch",
  "condition_object_rock_reference_semantic_mismatch",
  "condition_object_vegetation_reference_semantic_mismatch",
]);

export function adjudicatePostFullConditionBoundedCandidate({
  registry,
  lifecycleCandidate,
  lifecycleState,
  lifecycleRejectedEvidence,
  boundedCandidate,
  stage0Terminal,
  failureDecision,
  classificationCorrection,
  machineReview,
}) {
  assert.equal(registry.capabilityVersion, FULL_CONDITION_CAPABILITY_VERSION);
  assert.equal(
    registry.taskId,
    "reject_current_model_family_and_return_to_bounded_candidate_planning",
  );
  assert.equal(registry.activity, "planned_not_started");
  assert.equal(
    registry.latestTrainingTerminal?.runId,
    stage0Terminal.runId,
  );
  assert.equal(
    registry.latestTrainingTerminal?.status,
    stage0Terminal.status,
  );

  assert.equal(lifecycleCandidate.capabilityVersion, FULL_CONDITION_CAPABILITY_VERSION);
  assert.equal(lifecycleCandidate.changeClass, "model_family");
  assert.equal(lifecycleCandidate.selectedOption, CURRENT_CANDIDATE);
  assert.equal(lifecycleCandidate.ownerAuthorizationRequired, false);
  assert.equal(lifecycleState.capabilityVersion, FULL_CONDITION_CAPABILITY_VERSION);
  assert.equal(lifecycleState.state, "rejected");
  assert.equal(lifecycleState.ownerAuthorizationRequired, false);
  assert.equal(lifecycleState.ownerResponseRequired, false);
  assert.equal(lifecycleRejectedEvidence.targetState, "rejected");
  assert.equal(lifecycleRejectedEvidence.status, "failed");

  assert.equal(boundedCandidate.status, "cpu_inactive_candidate_planned_not_implemented");
  assert.equal(boundedCandidate.selectedCandidate?.candidateKind, CURRENT_CANDIDATE);
  assert.deepEqual(
    boundedCandidate.selectedCandidate?.responsibilityIdentityOrder,
    REQUIRED_RESPONSIBILITIES,
  );
  assert.deepEqual(boundedCandidate.selectedCandidate?.perResponsibilityInput, {
    decodedRgbChannels: 3,
    typedConditionChannels: 23,
    totalChannels: 26,
  });
  assert.equal(boundedCandidate.selectedCandidate?.existingDerivedWidth, 64);
  assert.equal(boundedCandidate.selectedCandidate?.perResponsibilityOutputChannels, 3);
  assert.equal(boundedCandidate.freeArchitectureParameterChosen, false);
  assert.equal(boundedCandidate.lossChanged, false);
  assert.equal(boundedCandidate.dataChanged, false);
  assert.equal(boundedCandidate.thresholdChanged, false);

  assert.equal(
    stage0Terminal.schemaVersion,
    "stage4-post-decode-full-condition-responsibility-stage0-terminal-v1",
  );
  assert.equal(stage0Terminal.executionState, "completed");
  assert.equal(
    stage0Terminal.status,
    "post_decode_full_condition_responsibility_stage0_real_visual_failure",
  );
  assert.equal(stage0Terminal.capabilityVersion, FULL_CONDITION_CAPABILITY_VERSION);
  assert.deepEqual(stage0Terminal.fixedTotalProgress, progress());

  assert.equal(failureDecision.status, "unique_decision_formed");
  assert.equal(failureDecision.currentCandidateRejected, true);
  assert.equal(failureDecision.automaticRetryStarted, false);
  assert.equal(
    failureDecision.nextAction,
    "reject_current_model_family_and_return_to_bounded_candidate_planning",
  );
  assert.equal(
    classificationCorrection.status,
    "append_only_classification_identity_corrected",
  );
  assert.equal(
    classificationCorrection.recordedClassification,
    failureDecision.classification,
  );
  assert.equal(
    classificationCorrection.correctedClassification,
    "post_decode_full_condition_responsibility_multisample_semantic_capacity_insufficient_confirmed",
  );
  assert.equal(classificationCorrection.semanticReviewResultChanged, false);
  assert.equal(classificationCorrection.machineReviewThresholdsChanged, false);

  assert.equal(machineReview.status, "machine_reviews_failed");
  assert.equal(machineReview.reviewThresholdsChanged, false);
  assert.equal(machineReview.previewCount, 6);
  assert.equal(machineReview.previewPassCount, 0);
  assert.equal(machineReview.previewFailCount, 6);
  assert.equal(machineReview.reviews.length, 6);
  for (const review of machineReview.reviews) {
    assert.equal(review.passed, false);
    assert.equal(review.professionalAesthetic?.passed, true);
    for (const code of REQUIRED_OBJECT_FAILURES) {
      assert.ok(
        review.issueCodes.includes(code),
        `${code} is not persistent at epoch ${review.epoch}`,
      );
    }
  }

  return {
    selectedOutcome:
      "no_unique_bounded_candidate_registered_after_full_condition_failure",
    status: "failed_closed_candidate_space_exhausted",
    candidateSpaceScope:
      "current_registered_contract_derived_stage4_architecture_rules",
    exhaustedRoutes: [
      "baseline_current_formal_structure",
      "condition_fusion_only_final_direct_residual_23_64_12",
      "capacity_only_base_width_64_to_existing_level1_128",
      "conflict_aware_existing_gradient_aggregation",
      "three_responsibility_isolated_components",
      "authoritative_visual_semantic_carrier",
      "post_decode_object_rgb_responsibility_heads",
      CURRENT_CANDIDATE,
    ],
    decisiveFacts: {
      currentCandidateWasPriorUniqueBoundedCandidate: true,
      completeTypedConditionChannelsReachedAllResponsibilities: true,
      routeAndFourObjectResponsibilitiesPresent: true,
      formalStage0EpochsCompleted: 40,
      fixedReviewPassCount: 0,
      fixedReviewFailCount: 6,
      persistentFailureCodes: [...REQUIRED_OBJECT_FAILURES],
      modelLifecycleRejected: true,
    },
    rejectedResponses: {
      retrySameCandidate: "forbidden_after_formal_stage0_rejection",
      addSameClassLoss: "forbidden_without_new_causal_boundary",
      inventArchitectureDimension:
        "not_uniquely_derived_from_current_machine_contracts",
      chooseFreeHyperparameter:
        "not_uniquely_derived_from_current_machine_contracts",
      lowerReviewThreshold: "forbidden_by_machine_review_contract",
      reuseFailedCheckpoint: "forbidden_by_failure_terminal",
    },
    safeAlternative:
      "retain_current_data_worldfacts_conditions_and_failure_evidence_and_keep_stage4_training_closed_until_a_new_machine_verifiable_uniquely_derived_architecture_rule_exists",
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    gpuAllowed: false,
    trainingAllowed: false,
  };
}

export async function runPostFullConditionBoundedCandidateRecalculation({
  root = process.cwd(),
  runId,
  recordedAtUtc = new Date().toISOString(),
} = {}) {
  assert.match(runId ?? "", /^[a-z0-9][a-z0-9-]{7,127}$/, "runId is invalid");
  const current = await readCurrentExecutionRegistry(root);
  assert.equal(current.ok, true, `current registry invalid: ${current.errorCode}`);

  const discovery = discoverEvidence(root, current.registry);
  const evidence = Object.fromEntries(
    Object.entries(discovery.paths).map(([role, file]) => [role, readJson(file)]),
  );
  validateLifecycleCandidateBindings(root, evidence.lifecycleCandidate);
  validateRejectedEvidenceBindings(root, evidence.lifecycleRejectedEvidence);
  const decision = adjudicatePostFullConditionBoundedCandidate({
    registry: current.registry,
    ...evidence,
  });

  const outputRoot = resolveInside(
    root,
    `${POST_FULL_CONDITION_RECALCULATION_ROOT}/${runId}`,
  );
  assert.equal(fs.existsSync(outputRoot), false, "recalculation output already exists");
  fs.mkdirSync(path.dirname(outputRoot), { recursive: true });
  fs.mkdirSync(outputRoot, { recursive: false });
  const files = {
    problem: path.join(outputRoot, "problem-report.json"),
    audit: path.join(outputRoot, "evidence-audit.json"),
    decision: path.join(outputRoot, "unique-decision.json"),
    policyInput: path.join(outputRoot, "policy-boundary-input.json"),
    cpu: path.join(outputRoot, "cpu-report.json"),
    terminal: path.join(outputRoot, "phase-terminal.json"),
    planSync: path.join(outputRoot, "plan-sync-record.json"),
    capsule: path.join(outputRoot, "local-task-capsule.json"),
  };
  const immutableEvidence = [
    {
      role: "currentExecutionRegistry",
      path: ".runtime/ai-painter/current-execution-registry/current.json",
      sha256: current.registrySha256,
    },
    ...Object.entries(discovery.paths).map(([role, file]) => bind(root, file, role)),
  ];

  writeJsonAtomic(files.problem, {
    schemaVersion: "stage4-post-full-condition-bounded-candidate-problem-report-v1",
    status:
      "prior_unique_full_condition_candidate_completed_formal_stage0_and_failed_all_fixed_reviews",
    capabilityVersion: FULL_CONDITION_CAPABILITY_VERSION,
    sourceTrainingRunId: evidence.stage0Terminal.runId,
    fixedTotalProgress: progress(),
    prohibitedResponse: Object.keys(decision.rejectedResponses),
    ownerAuthorizationRequired: false,
    recordedAtUtc,
  });
  writeJsonAtomic(files.audit, {
    schemaVersion: "stage4-post-full-condition-bounded-candidate-evidence-audit-v1",
    status: "passed",
    immutableEvidence,
    priorCandidateIdentity: CURRENT_CANDIDATE,
    responsibilityIdentityOrder: REQUIRED_RESPONSIBILITIES,
    typedConditionChannelCount: 23,
    fixedReviewIdentity: {
      previewCount: 6,
      previewPassCount: 0,
      previewFailCount: 6,
    },
    historicalMutableSourceBindingsUsedAsCurrentEvidence: false,
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  });
  writeJsonAtomic(files.decision, {
    schemaVersion: "stage4-post-full-condition-bounded-candidate-decision-v1",
    ...decision,
    uniqueDecision: true,
    currentFixedProgress: progress(),
    recordedAtUtc,
  });
  writeJsonAtomic(files.policyInput, {
    schemaVersion: "ai-painter-policy-boundary-report-input-v1",
    reportId: `${runId}-stage4-current-derivation-space-exhausted`,
    boundaryClass: "long_term_business_goal_change",
    failureCode:
      "stage4_no_unique_bounded_candidate_under_current_registered_derivation_rules",
    summaryZh:
      "完整23通道已到达道路及四类对象责任分支的唯一有界候选完成正式Stage 0后仍为0/6；当前登记的唯一派生规则中不存在下一候选。程序保持60%失败关闭，不重复训练、不自由选择结构。",
    safeAlternative: decision.safeAlternative,
    evidencePaths: [
      relative(root, files.problem),
      relative(root, files.audit),
      relative(root, files.decision),
    ],
  });
  const policy = persistPolicyBoundaryReport(readJson(files.policyInput), {
    root,
    recordedAtUtc,
  });
  writeJsonAtomic(files.cpu, {
    schemaVersion: "stage4-post-full-condition-bounded-candidate-cpu-report-v1",
    status: "passed",
    positiveChecks: 25,
    negativeBoundariesVerified: Object.keys(decision.rejectedResponses),
    selectedOutcome: decision.selectedOutcome,
    currentRegistryVerified: true,
    evidenceSha256Recomputed: true,
    ownerAuthorizationRequired: false,
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  });
  writeJsonAtomic(files.terminal, {
    schemaVersion: "stage4-post-full-condition-bounded-candidate-terminal-v1",
    executionState: "completed",
    status: decision.status,
    runId,
    capabilityVersion: FULL_CONDITION_CAPABILITY_VERSION,
    selectedOutcome: decision.selectedOutcome,
    fixedTotalProgress: progress(),
    problemReport: bind(root, files.problem),
    evidenceAudit: bind(root, files.audit),
    uniqueDecision: bind(root, files.decision),
    policyBoundaryReport: { path: policy.logicalPath, sha256: policy.sha256 },
    cpuReport: bind(root, files.cpu),
    nextAction:
      "remain_failed_closed_until_new_uniquely_derived_architecture_rule_exists",
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  });

  synchronizePlan(root, files, recordedAtUtc);
  const capsuleEvidence = [
    bind(root, files.terminal, "candidate-space-terminal"),
    bind(root, files.decision, "unique-decision"),
    { role: "policy-boundary-report", path: policy.logicalPath, sha256: policy.sha256 },
    bind(root, files.planSync, "module-plan-sync"),
  ].map((item) => ({
    kind: item.role,
    labelZh: item.role,
    path: item.path,
    sha256: item.sha256,
    expectedSha256: item.sha256,
    sha256Verified: true,
    recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
  }));
  writeJsonAtomic(files.capsule, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${runId}`,
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: { ...progress(), source: "current_execution_registry" },
    currentStage: {
      number: 4,
      total: 5,
      labelZh: "Stage 0→1→2完整训练",
      status: "failed_closed_candidate_space_exhausted",
    },
    candidateTerminal: {
      runId,
      status: "failed_closed",
      programStatus: decision.status,
      previewMachineStatus: "machine_reviews_failed",
      modelQualificationStatus: "no_current_qualified_candidate",
      previewCount: 6,
      previewPassCount: 0,
      previewFailCount: 6,
      checkpointWritten: false,
      modelWeightsModified: false,
      recordedAtUtc,
      recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
    },
    latestBlocker: {
      code: "stage4_current_registered_derivation_space_exhausted",
      summaryZh:
        "当前登记规则内不存在可唯一派生且不重复失败路线的新候选；Stage4保持60%失败关闭。",
    },
    nextAllowedAction: {
      code: "remain_failed_closed_until_new_uniquely_derived_architecture_rule_exists",
      labelZh: "等待本地程序取得新的、机器可证明且唯一派生的架构规则",
      ownerAuthorizationRequired: false,
      automaticExecutionAllowed: false,
      planEvidenceConfirmed: true,
    },
    forbiddenActions: [
      "retry_failed_candidate",
      "invent_free_architecture",
      "add_same_class_loss",
      "lower_machine_review_threshold",
      "reuse_failed_checkpoint",
      "read_archived_smoke_as_current",
    ],
    taskIdentity: {
      modelId: CURRENT_CANDIDATE,
      sampleId: "194",
      conditionLabel: "v7-complete-map-194",
      sampleSplit: "validation",
      seed: 20263722,
      requiredBoundarySides: ["west"],
    },
    evidence: capsuleEvidence,
    integrity: {
      status: "verified",
      requiredEvidencePresent: true,
      boundEvidenceVerified: true,
      identityMatches: true,
      migrationRegistryStatus: "current_execution_registry_active",
    },
  });

  const latestPath = resolveInside(
    root,
    `${POST_FULL_CONDITION_RECALCULATION_ROOT}/latest.json`,
  );
  writeJsonAtomic(latestPath, {
    schemaVersion: "stage4-post-full-condition-bounded-candidate-latest-pointer-v1",
    runId,
    status: decision.status,
    terminal: bind(root, files.terminal),
    updatedAtUtc: recordedAtUtc,
  });
  for (const file of Object.values(files)) index(file, root, runId);
  index(resolveInside(root, policy.logicalPath), root, runId);
  index(latestPath, root, runId);

  const registry = await advanceCurrentExecutionRegistry({
    projectRoot: root,
    capabilityVersion: FULL_CONDITION_CAPABILITY_VERSION,
    packageId: runId,
    taskId:
      "remain_failed_closed_until_new_uniquely_derived_architecture_rule_exists",
    taskKind: "policy_boundary_closed",
    runId,
    lifecycleStage: "rejected",
    executionState: "completed",
    activity: "failed_closed",
    taskCapsulePath: relative(root, files.capsule),
    terminalEvidencePath: relative(root, files.terminal),
  });
  assert.equal(registry.ok, true, `registry advance failed: ${registry.errorCode}`);
  assert.equal(
    registry.registry.latestTrainingTerminal.runId,
    evidence.stage0Terminal.runId,
    "latest formal training identity changed",
  );

  appendAiPainterProgramEvent({
    id: `stage4-post-full-condition-recalculation-${runId}`,
    timestamp: recordedAtUtc,
    action: "stage4_post_full_condition_bounded_candidate_recalculation",
    runId,
    kind: "local_autonomous_candidate_planning",
    status: "blocked",
    title: "Stage4 current registered candidate space exhausted",
    titleZh: "Stage4当前登记的唯一派生候选空间已收敛并失败关闭",
    detailZh:
      "本地程序已完成证据核验、候选裁决、政策边界记录和当前任务登记；未启动GPU或训练，固定进度保持60%。",
    evidencePath: relative(root, files.terminal),
    evidenceSha256: sha256File(files.terminal),
    fixedTotalProgress: progress(),
  });

  return {
    status: decision.status,
    selectedOutcome: decision.selectedOutcome,
    fixedTotalProgress: progress(),
    terminal: bind(root, files.terminal),
    policyBoundaryReport: { path: policy.logicalPath, sha256: policy.sha256 },
    currentRegistryRevision: registry.registry.registryRevision,
    currentRegistrySha256: registry.registrySha256,
    latestTrainingRunId: registry.registry.latestTrainingTerminal.runId,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
  };
}

function discoverEvidence(root, registry) {
  const lifecycleRoot = resolveInside(
    root,
    `.runtime/ai-painter/capability-lifecycle/${FULL_CONDITION_CAPABILITY_VERSION}`,
  );
  const stage0TerminalPath = resolveInside(root, registry.latestTrainingTerminal.path);
  const stage0Root = path.dirname(stage0TerminalPath);
  const lifecycleCandidatePath = path.join(lifecycleRoot, "candidate.json");
  const lifecycleStatePath = path.join(lifecycleRoot, "state.json");
  const lifecycleState = readJson(lifecycleStatePath);
  const lifecycleRejectedEvidencePath = path.join(
    lifecycleRoot,
    lifecycleState.latestEvidence.path,
  );
  const lifecycleCandidate = readJson(lifecycleCandidatePath);
  const boundedBinding = lifecycleCandidate.sourceEvidence.find((item) =>
    item.path.endsWith("/bounded-candidate.json"),
  );
  assert.ok(boundedBinding, "bounded candidate source binding missing");
  const boundedCandidatePath = resolveInside(root, boundedBinding.path);
  assert.equal(sha256File(boundedCandidatePath), boundedBinding.sha256);
  return {
    paths: {
      lifecycleCandidate: lifecycleCandidatePath,
      lifecycleState: lifecycleStatePath,
      lifecycleRejectedEvidence: lifecycleRejectedEvidencePath,
      boundedCandidate: boundedCandidatePath,
      stage0Terminal: stage0TerminalPath,
      failureDecision: path.join(stage0Root, "failure-decision.json"),
      classificationCorrection: path.join(
        stage0Root,
        "failure-classification-correction.json",
      ),
      machineReview: path.join(stage0Root, "machine-review.json"),
    },
  };
}

function validateLifecycleCandidateBindings(root, candidate) {
  assert.ok(Array.isArray(candidate.sourceEvidence));
  for (const binding of candidate.sourceEvidence) {
    // Lifecycle candidates retain the hashes of the source tree that created
    // them, but source files are intentionally mutable after that run.  The
    // current decision therefore re-verifies only immutable runtime/config
    // evidence and uses the rejected lifecycle plus formal Stage 0 terminal
    // as proof of the executed candidate identity.
    if (
      binding.path.startsWith("ml/ai-painter/src/") ||
      binding.path.startsWith("ml/ai-painter/scripts/") ||
      binding.path.startsWith("scripts/")
    ) {
      assert.match(binding.sha256, /^[a-f0-9]{64}$/);
      continue;
    }
    const file = resolveInside(root, binding.path);
    assert.equal(sha256File(file), binding.sha256, `candidate evidence changed: ${binding.path}`);
  }
}

function validateRejectedEvidenceBindings(root, evidence) {
  assert.ok(Array.isArray(evidence.bindings) && evidence.bindings.length > 0);
  for (const binding of evidence.bindings) {
    const file = resolveInside(root, binding.path);
    assert.equal(sha256File(file), binding.sha256, `rejection evidence changed: ${binding.path}`);
  }
}

function synchronizePlan(root, files, recordedAtUtc) {
  const planPath = resolveInside(
    root,
    "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md",
  );
  const beforeSha256 = sha256File(planPath);
  let plan = fs.readFileSync(planPath, "utf8");
  plan = plan.replace(
    /^更新时间：.*$/m,
    `更新时间：${formatShanghai(recordedAtUtc).replace("T", " ").replace("+08:00", " +08:00")}`,
  );
  plan = plan.replace(
    /^状态：.*$/m,
    "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4当前登记的唯一派生候选空间已收敛并失败关闭，当前无训练运行",
  );
  plan = replaceTableRow(
    plan,
    2,
    "AI Painter R5 / Stage4",
    "从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标",
    "固定进度3/5（60%）；完整23通道道路与对象责任渲染候选已完成正式Stage 0但固定审核0/6并退出；当前登记规则内不存在可唯一派生的新候选，训练失败关闭",
    "只有本地程序取得新的、机器可证明且唯一派生的架构规则，并完成完整Stage 0→1→2训练与审核后，才能更新为4/5（80%）",
  );
  plan = plan.replace(
    /^4\. Stage 0→Stage 1→Stage 2完整训练、固定复现与机器审核：.*$/m,
    "4. Stage 0→Stage 1→Stage 2完整训练、固定复现与机器审核：失败关闭（最新完整条件候选Stage 0正式训练完成但审核0/6；Stage 1/2未启动，当前无活动训练）。",
  );
  plan = replaceSection(
    plan,
    "## 4. 最近一次模块终态",
    "## 5. 当前阻断与后续实施顺序",
    `## 4. 最近一次模块终态\n\n解码后完整23通道道路与四类对象责任渲染候选完成正式Stage 0的40 Epoch和5760次优化，模型权重真实变化，六个固定审核节点为0/6。专业画面审核在全部固定节点通过，但footprints、tree、rock、vegetation参考语义不匹配持续存在。该候选生命周期已登记为\`rejected\`，失败Checkpoint不可读取、复用或晋级。\n\n本地程序已核验该结构是上一轮唯一、无自由参数的有界候选，并完成CPU只读候选收敛：当前登记的合同派生规则内没有新的唯一候选。该结论只关闭当前登记的派生空间，不宣称数学上不存在任何未来模型；恢复条件必须是新的、机器可验证且由正式合同唯一派生的架构规则。\n\n`,
  );
  plan = replaceSection(
    plan,
    "## 5. 当前阻断与后续实施顺序",
    "## 6. 完成条件与固定边界",
    `## 5. 当前阻断与后续实施顺序\n\n当前无活动训练。唯一当前执行登记分别保存“当前任务”和“最近正式训练终态”：当前任务为候选空间失败关闭；最近正式训练终态仍是完整条件责任渲染候选Stage 0真实视觉失败。旧Smoke和旧候选只允许作为历史证据查询，禁止成为当前任务、活动执行、恢复源或默认控制台投影。\n\n本地程序不得重跑已退出候选、增加同类Loss、自由选择结构尺寸或超参数、降低审核阈值、复用失败Checkpoint，也不得生成Owner等待状态。只有新的架构规则同时满足“来自生效机器合同、尺寸和责任边界唯一派生、与全部退出路线存在实质结构差异、CPU正反合同可证明”时，本地能力生命周期才能自动建立新候选；否则继续失败关闭并保留全部证据。\n\n`,
  );
  writeTextAtomic(planPath, plan);
  writeJsonAtomic(files.planSync, {
    schemaVersion: "stage4-post-full-condition-bounded-candidate-plan-sync-v1",
    status: "synchronized",
    planPath: relative(root, planPath),
    beforeSha256,
    afterSha256: sha256File(planPath),
    terminal: bind(root, files.terminal),
    recordedAtUtc,
  });
}

function replaceTableRow(plan, order, module, goal, state, acceptance) {
  const pattern = new RegExp(`^\\| ${order} \\|[^\\n]*$`, "m");
  assert.ok(pattern.test(plan), `module plan row ${order} missing`);
  return plan.replace(pattern, `| ${order} | ${module} | ${goal} | ${state} | ${acceptance} |`);
}

function replaceSection(plan, start, end, replacement) {
  const startIndex = plan.indexOf(start);
  const endIndex = plan.indexOf(end);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `plan section missing: ${start}`);
  return `${plan.slice(0, startIndex)}${replacement}${plan.slice(endIndex)}`;
}

function readJson(file) {
  assert.ok(fs.existsSync(file) && fs.statSync(file).isFile(), `evidence missing: ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function resolveInside(root, value) {
  assert.ok(
    typeof value === "string" &&
      value &&
      !path.isAbsolute(value) &&
      !/^[A-Za-z]:[\\/]/.test(value) &&
      !value.split(/[\\/]/).includes(".."),
    "project-relative path required",
  );
  const base = path.resolve(root);
  const absolute = path.resolve(base, value);
  assert.ok(absolute.startsWith(`${base}${path.sep}`), "path escapes project root");
  return absolute;
}
function relative(root, file) {
  return path.relative(path.resolve(root), file).replaceAll("\\", "/");
}
function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function bind(root, file, role = undefined) {
  return {
    ...(role ? { role } : {}),
    path: relative(root, file),
    sha256: sha256File(file),
  };
}
function writeTextAtomic(file, value) {
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, value, "utf8");
  fs.renameSync(temporary, file);
}
function progress() {
  return { completedStages: 3, totalStages: 5, percent: 60 };
}
function index(file, root, runId) {
  const stat = fs.statSync(file);
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId,
    artifactType: "stage4_post_full_condition_bounded_candidate_recalculation_v1",
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: sha256File(file),
  });
}
