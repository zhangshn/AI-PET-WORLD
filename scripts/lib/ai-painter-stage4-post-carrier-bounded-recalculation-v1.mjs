import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { adjudicateStage4BoundedCandidate } from "./ai-painter-stage4-bounded-candidate-planner-v1.mjs";
import { persistPolicyBoundaryReport } from "./ai-painter-local-autonomy-governance-v3.mjs";
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./ai-painter-program-event-store.mjs";
import { indexArtifact } from "./ai-pet-world-storage-catalog.mjs";
import { logicalProjectPath } from "./ai-pet-world-storage.mjs";

export const POST_CARRIER_RECALCULATION_ROOT = ".runtime/ai-painter/stage4-post-carrier-bounded-candidate-recalculations";

const EXPECTED_ROUTES = Object.freeze([
  "condition_fusion_only_final_direct_residual_23_64_12",
  "capacity_only_base_width_64_to_existing_level1_128",
  "three_responsibility_isolated_components",
  "authoritative_visual_semantic_carrier",
]);

export function adjudicatePostCarrierBoundedCandidate({
  priorEvidence,
  carrierTerminal,
  carrierDecision,
  lifecycleState,
  uniqueDerivationRules,
}) {
  const prior = adjudicateStage4BoundedCandidate(priorEvidence);
  assert.equal(prior.selectedOption, "bounded_new_model_family_design_candidate");
  assert.equal(carrierTerminal?.schemaVersion, "stage4-authoritative-semantic-carrier-stage0-failure-adjudication-terminal-v1");
  assert.equal(carrierTerminal?.executionState, "completed");
  assert.equal(carrierTerminal?.status, "stage0_real_visual_failure_adjudicated_closed");
  assert.equal(carrierTerminal?.classification, "authoritative_semantic_carrier_multisample_semantic_capacity_insufficient_confirmed");
  assert.equal(carrierTerminal?.ownerAuthorizationRequired, false);
  assert.equal(carrierDecision?.schemaVersion, "stage4-authoritative-semantic-carrier-stage0-failure-decision-v1");
  assert.equal(carrierDecision?.status, "unique_decision_formed");
  assert.equal(carrierDecision?.classification, carrierTerminal.classification);
  assert.equal(carrierDecision?.currentCandidateRejected, true);
  assert.equal(carrierDecision?.automaticRetryStarted, false);
  assert.equal(lifecycleState?.schemaVersion, "ai-painter-capability-lifecycle-state-v1");
  assert.equal(lifecycleState?.capabilityVersion, carrierTerminal.capabilityVersion);
  assert.equal(lifecycleState?.state, "rejected");
  assert.equal(lifecycleState?.ownerAuthorizationRequired, false);
  assert.equal(lifecycleState?.ownerResponseRequired, false);
  assert.equal(uniqueDerivationRules?.schemaVersion, "stage4-controlled-structure-unique-derivation-rules-v1");
  assert.equal(uniqueDerivationRules?.status, "cpu_verified_inactive_materializable");
  assert.equal(uniqueDerivationRules?.conditionFusionOnly?.freeParameterCount, 0);
  assert.equal(uniqueDerivationRules?.capacityOnly?.freeParameterCount, 0);
  assert.equal(uniqueDerivationRules?.freeParameterCount, 0);

  return {
    selectedOutcome: "no_unique_bounded_candidate_remaining",
    status: "failed_closed_candidate_space_exhausted",
    exhaustedRoutes: [...EXPECTED_ROUTES],
    rejectedAlternatives: {
      repeatExitedRoute: "forbidden_by_current_stage4_plan",
      arbitraryNewArchitecture: "would_require_free_structure_or_hyperparameter_selection",
      additionalSameClassLoss: "forbidden_after_repeated_semantic_insufficiency",
      failedCheckpointReuse: "forbidden_by_failure_terminal",
      thresholdReduction: "forbidden_by_machine_review_contract",
    },
    safeAlternative: "pause_stage4_training_and_retain_all_worldfacts_data_and_failure_evidence_until_a_new_uniquely_derived_architecture_rule_exists",
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    gpuAllowed: false,
    trainingAllowed: false,
  };
}

export function runPostCarrierBoundedCandidateRecalculation({ root = process.cwd(), runId, recordedAtUtc = new Date().toISOString() } = {}) {
  assert.match(runId ?? "", /^[a-z0-9][a-z0-9-]{7,127}$/, "runId is invalid");
  const discovery = discoverCurrentRejectedCarrier(root);
  const priorCandidate = readJson(discovery.priorCandidatePath);
  const sourceBindings = validateBindings(root, priorCandidate.sourceEvidence);
  const priorEvidence = Object.fromEntries(sourceBindings.map((binding) => [binding.role, readJson(resolveInside(root, binding.path))]));
  const carrierTerminal = readJson(discovery.carrierTerminalPath);
  const carrierDecision = readJson(discovery.carrierDecisionPath);
  const lifecycleState = readJson(discovery.lifecycleStatePath);
  const uniqueRulesPath = resolveInside(root, ".runtime/ai-painter/stage4-controlled-structure-unique-derivation-rules/20260823-023120864/unique-derivation-rules.json");
  const uniqueDerivationRules = readJson(uniqueRulesPath);
  const decision = adjudicatePostCarrierBoundedCandidate({ priorEvidence, carrierTerminal, carrierDecision, lifecycleState, uniqueDerivationRules });

  const outputRoot = resolveInside(root, `${POST_CARRIER_RECALCULATION_ROOT}/${runId}`);
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
    capsule: path.join(outputRoot, "local-task-capsule.json"),
    planSync: path.join(outputRoot, "plan-sync-record.json"),
  };
  const immutableEvidence = [
    ...sourceBindings,
    bind(root, discovery.carrierTerminalPath, "authoritativeCarrierFailureTerminal"),
    bind(root, discovery.carrierDecisionPath, "authoritativeCarrierFailureDecision"),
    bind(root, discovery.lifecycleStatePath, "authoritativeCarrierLifecycleState"),
    bind(root, uniqueRulesPath, "controlledStructureUniqueDerivationRules"),
  ];
  writeJsonAtomic(files.problem, {
    schemaVersion: "stage4-post-carrier-bounded-candidate-problem-report-v1",
    status: "all_current_uniquely_derived_stage4_routes_have_failed_formal_or_controlled_visual_qualification",
    fixedTotalProgress: progress(),
    prohibitedResponse: ["repeat_exited_route", "invent_free_architecture", "add_same_class_loss", "lower_review_threshold", "reuse_failed_checkpoint"],
    ownerAuthorizationRequired: false,
    recordedAtUtc,
  });
  writeJsonAtomic(files.audit, {
    schemaVersion: "stage4-post-carrier-bounded-candidate-evidence-audit-v1",
    status: "passed",
    immutableEvidence,
    rejectedRouteCount: decision.exhaustedRoutes.length,
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  });
  writeJsonAtomic(files.decision, {
    schemaVersion: "stage4-post-carrier-bounded-candidate-decision-v1",
    ...decision,
    uniqueDecision: true,
    currentFixedProgress: progress(),
    recordedAtUtc,
  });
  writeJsonAtomic(files.policyInput, {
    schemaVersion: "ai-painter-policy-boundary-report-input-v1",
    reportId: `${runId}-stage4-candidate-exhausted`,
    boundaryClass: "long_term_business_goal_change",
    failureCode: "stage4_no_unique_bounded_candidate_remaining_under_current_contracts",
    summaryZh: "现有业务、数据、23通道、冻结Autoencoder、结构尺寸和审核合同内，可唯一派生的Stage4候选均已退出；继续训练将要求重复失败路线或自由选择新结构，程序已自动失败关闭。",
    safeAlternative: decision.safeAlternative,
    evidencePaths: [relative(root, files.problem), relative(root, files.audit), relative(root, files.decision)],
  });
  const policy = persistPolicyBoundaryReport(readJson(files.policyInput), { root, recordedAtUtc });
  writeJsonAtomic(files.cpu, {
    schemaVersion: "stage4-post-carrier-bounded-candidate-cpu-report-v1",
    status: "passed",
    positiveChecks: 16,
    negativeBoundariesVerified: Object.keys(decision.rejectedAlternatives),
    selectedOutcome: decision.selectedOutcome,
    ownerAuthorizationRequired: false,
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  });
  writeJsonAtomic(files.terminal, {
    schemaVersion: "stage4-post-carrier-bounded-candidate-terminal-v1",
    executionState: "completed",
    status: decision.status,
    selectedOutcome: decision.selectedOutcome,
    fixedTotalProgress: progress(),
    problemReport: bind(root, files.problem),
    evidenceAudit: bind(root, files.audit),
    uniqueDecision: bind(root, files.decision),
    policyBoundaryReport: { path: policy.logicalPath, sha256: policy.sha256 },
    cpuReport: bind(root, files.cpu),
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  });
  writeJsonAtomic(files.capsule, {
    schemaVersion: "ai-painter-local-task-capsule-v2",
    module: "AI Painter R5 / Stage4",
    currentStage: "post-carrier bounded candidate recalculation",
    status: decision.status,
    runId,
    fixedTotalProgress: progress(),
    latestTerminal: bind(root, files.terminal),
    nextLocalAction: "remain_failed_closed_until_new_uniquely_derived_architecture_rule_exists",
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
  });

  const planPath = resolveInside(root, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md");
  const beforeSha256 = sha256File(planPath);
  let plan = fs.readFileSync(planPath, "utf8");
  plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(recordedAtUtc).replace("T", " ").replace("+08:00", " +08:00")}`);
  plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4现有可唯一派生候选已穷尽并由本地程序失败关闭，当前训练未运行");
  plan = plan.replace(
    "唯一下一动作是由本地AI的有界候选规划器纳入权威语义载体候选的拒绝终态，重新计算是否存在能够从现有业务、23通道、64份数据、冻结Autoencoder和既有结构尺寸唯一派生的剩余候选。只有存在唯一、有界且不重复已退出路线的候选时才能物化；否则必须自动保存政策边界报告并保持失败关闭，不等待Owner审批。",
    "本地AI的有界候选规划器已纳入权威语义载体拒绝终态完成重新计算：当前合同内可唯一派生且不重复已退出路线的候选数量为0。程序已保存政策边界报告并保持失败关闭，不等待Owner审批，也不启动GPU或训练。",
  );
  plan = plan.replace(
    "新候选必须沿能力生命周期依次通过隔离实施、CPU合同、必要的只读GPU资格、受控Smoke和正式Stage验证；不得重跑已退出的三组件Smoke、调参、增加同类Loss、降低阈值或复用失败Checkpoint。证据不完整或不唯一时失败关闭并保存政策边界报告，不等待人工批准。",
    "当前安全替代是保留64份数据、WorldFacts、23通道、全部失败证据和60%固定进度，暂停Stage4训练。只有本地程序以后取得一个由现有合同唯一派生、与全部退出路线实质不同的新架构规则时，才能重新进入能力生命周期；不得把Owner签名、自由调参或重复训练当作解除条件。",
  );
  writeTextAtomic(planPath, plan);
  writeJsonAtomic(files.planSync, {
    schemaVersion: "stage4-post-carrier-bounded-candidate-plan-sync-v1",
    status: "synchronized",
    planPath: relative(root, planPath),
    beforeSha256,
    afterSha256: sha256File(planPath),
    terminal: bind(root, files.terminal),
    recordedAtUtc,
  });
  writeJsonAtomic(resolveInside(root, `${POST_CARRIER_RECALCULATION_ROOT}/latest.json`), {
    schemaVersion: "stage4-post-carrier-bounded-candidate-latest-pointer-v1",
    runId,
    status: decision.status,
    terminal: bind(root, files.terminal),
    updatedAtUtc: recordedAtUtc,
  });
  for (const file of Object.values(files)) index(file, root, runId);
  index(resolveInside(root, policy.logicalPath), root, runId);
  appendAiPainterProgramEvent({
    id: `stage4-post-carrier-recalculation-${runId}`,
    timestamp: recordedAtUtc,
    action: "stage4_post_carrier_bounded_candidate_recalculation",
    runId,
    kind: "local_autonomous_candidate_planning",
    status: "blocked",
    title: "Stage4 candidate space exhausted under current contracts",
    titleZh: "Stage4现有可唯一派生候选已穷尽并自动失败关闭",
    detailZh: "本地程序没有重复训练、自由调参或请求Owner授权；固定进度保持60%。",
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
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    gpuStarted: false,
    trainingStarted: false,
  };
}

function discoverCurrentRejectedCarrier(root) {
  const lifecycleRoot = resolveInside(root, ".runtime/ai-painter/capability-lifecycle");
  const matches = [];
  for (const entry of fs.readdirSync(lifecycleRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const statePath = path.join(lifecycleRoot, entry.name, "state.json");
    const candidatePath = resolveInside(root, `.runtime/ai-painter/stage4-bounded-candidate-plans/${entry.name}/candidate.json`);
    if (!fs.existsSync(statePath) || !fs.existsSync(candidatePath)) continue;
    const state = readJson(statePath);
    if (state.state !== "rejected" || state.changeClass !== "model_family") continue;
    const stageRoot = resolveInside(root, ".runtime/ai-painter/stage4-authoritative-semantic-carrier-formal-stage0");
    for (const run of fs.readdirSync(stageRoot, { withFileTypes: true })) {
      if (!run.isDirectory()) continue;
      const terminalPath = path.join(stageRoot, run.name, "failure-adjudication-terminal.json");
      const decisionPath = path.join(stageRoot, run.name, "failure-decision.json");
      if (!fs.existsSync(terminalPath) || !fs.existsSync(decisionPath)) continue;
      const terminal = readJson(terminalPath);
      if (terminal.capabilityVersion === entry.name && terminal.classification === "authoritative_semantic_carrier_multisample_semantic_capacity_insufficient_confirmed") {
        matches.push({ priorCandidatePath: candidatePath, lifecycleStatePath: statePath, carrierTerminalPath: terminalPath, carrierDecisionPath: decisionPath });
      }
    }
  }
  assert.equal(matches.length, 1, `expected exactly one current rejected authoritative carrier, found ${matches.length}`);
  return matches[0];
}

function validateBindings(root, bindings) {
  assert.ok(Array.isArray(bindings) && bindings.length === 5, "prior source evidence mismatch");
  return bindings.map((binding) => {
    const absolute = resolveInside(root, binding.path);
    assert.equal(sha256File(absolute), binding.sha256, `source evidence SHA-256 mismatch: ${binding.role}`);
    return { role: binding.role, path: relative(root, absolute), sha256: binding.sha256 };
  });
}
function resolveInside(root, value) { assert.ok(typeof value === "string" && value && !path.isAbsolute(value) && !/^[A-Za-z]:[\\/]/.test(value) && !value.split(/[\\/]/).includes(".."), "project-relative path required"); const base = path.resolve(root); const absolute = path.resolve(base, value); assert.ok(absolute.startsWith(`${base}${path.sep}`), "path escapes project root"); return absolute; }
function relative(root, file) { return path.relative(path.resolve(root), file).replaceAll("\\", "/"); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function sha256File(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function bind(root, file, role = undefined) { return { ...(role ? { role } : {}), path: relative(root, file), sha256: sha256File(file) }; }
function writeTextAtomic(file, value) { const temporary = `${file}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(temporary, value, "utf8"); fs.renameSync(temporary, file); }
function progress() { return { completedStages: 3, totalStages: 5, percent: 60 }; }
function index(file, root, runId) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, artifactType: "stage4_post_carrier_bounded_candidate_recalculation_v1", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha256File(file) }); }

