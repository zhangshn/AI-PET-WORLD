import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createCapabilityCandidate } from "./ai-painter-capability-lifecycle-v1.mjs";
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./ai-painter-program-event-store.mjs";
import { indexArtifact } from "./ai-pet-world-storage-catalog.mjs";
import { logicalProjectPath } from "./ai-pet-world-storage.mjs";

export const STAGE4_BOUNDED_CANDIDATE_ROOT = ".runtime/ai-painter/stage4-bounded-candidate-plans";

const EVIDENCE_RULES = Object.freeze({
  original64: {
    schemaVersion: "stage4-original-64-contract-correction-terminal-v1",
    status: "stage4_original_64_contract_satisfied_sufficiency_undefined_closed",
    selectedDecision: "original_64_contract_did_not_define_stage4_sufficiency",
  },
  autoencoder: {
    schemaVersion: "stage4-frozen-autoencoder-semantic-retention-terminal-v1",
    status: "stage4_frozen_autoencoder_semantic_retention_sufficient_closed",
    selectedDecision: "frozen_autoencoder_semantic_retention_sufficient",
  },
  conditionFusion: {
    schemaVersion: "stage4-condition-fusion-stage0-final-route-terminal-v1",
    status: "condition_fusion_multisample_semantic_capacity_insufficient_confirmed",
    selectedCause: "C",
  },
  capacity: {
    schemaVersion: "stage4-capacity-route-exit-project-route-decision-terminal-v1",
    status: "capacity_structure_route_exited_project_level_owner_decision_required",
  },
  threeComponent: {
    schemaVersion: "stage4-three-component-smoke-failure-boundary-terminal-v2",
    executionState: "completed",
    status: "three_component_smoke_failure_boundary_adjudicated",
    selectedCause: "A",
  },
});

export function adjudicateStage4BoundedCandidate(evidence) {
  assert.deepEqual(Object.keys(evidence).sort(), Object.keys(EVIDENCE_RULES).sort(), "evidence role set mismatch");
  for (const [role, rule] of Object.entries(EVIDENCE_RULES)) {
    const value = evidence[role];
    assert.ok(value && typeof value === "object", `${role} evidence is missing`);
    for (const [field, expected] of Object.entries(rule)) assert.equal(value[field], expected, `${role}.${field} mismatch`);
  }
  assert.equal(evidence.original64.original64ContractSatisfied, true, "original 64 contract must be satisfied");
  assert.equal(evidence.original64.dataDefectProven, false, "a proven data defect requires a data-route decision");
  assert.equal(evidence.autoencoder.autoencoderStateUnchanged, true, "frozen Autoencoder state identity is not stable");
  assert.equal(evidence.threeComponent.gpuStarted, false, "causal terminal must remain CPU read-only");
  assert.equal(evidence.threeComponent.trainingStarted, false, "causal terminal must not start training");

  return {
    selectedOption: "bounded_new_model_family_design_candidate",
    changeClass: "model_family",
    nextLifecycleAction: "local_ai_execute_isolated_model_family_design",
    rationaleCodes: [
      "original_64_contract_satisfied_no_data_defect_proven",
      "frozen_autoencoder_semantic_retention_sufficient",
      "condition_fusion_route_exited_after_formal_stage0",
      "capacity_route_exited_after_formal_stage0",
      "three_component_route_exited_after_complete_controlled_smoke",
      "generation_paradigm_not_proven_invalid",
      "minimum_remaining_change_axis_is_model_family",
    ],
  };
}

export function buildStage4CapabilityCandidate({ capabilityVersion, sourceEvidence, adjudication }) {
  assert.match(capabilityVersion ?? "", /^[a-z0-9][a-z0-9-]{7,127}$/, "capabilityVersion is invalid");
  assert.equal(adjudication.selectedOption, "bounded_new_model_family_design_candidate");
  const candidate = {
    schemaVersion: "ai-painter-capability-change-candidate-v1",
    capabilityVersion,
    changeClass: "model_family",
    status: "change_candidate",
    authority: "local_ai_pet_world_program",
    ownerAuthorizationRequired: false,
    ownerInLifecycle: false,
    sourceEvidence,
    selectedOption: adjudication.selectedOption,
    nextLifecycleAction: adjudication.nextLifecycleAction,
    scope: {
      phase: "cpu_design_only",
      implementationAllowed: false,
      gpuAllowed: false,
      optimizerAllowed: false,
      backwardAllowed: false,
      trainingAllowed: false,
      checkpointWeightsReadAllowed: false,
    },
    frozenBusinessAndDataBoundary: {
      approvedSampleCount: 64,
      split: { train: 48, validation: 8, challenge: 4, regression: 4 },
      conditionChannelCount: 23,
      frozenAutoencoder: true,
      nativeCompleteRgb: { width: 1024, height: 768 },
      stageDefinitionsUnchanged: true,
      machineReviewThresholdsUnchanged: true,
      worldFactsAndVisualFactManifestAuthorityUnchanged: true,
    },
    prohibitedDesignInputs: [
      "failed_preview_pixels",
      "machine_review_results_as_training_target",
      "failed_or_historical_checkpoint_weights",
      "free_width_or_layer_count",
      "free_loss_or_loss_weight",
      "free_training_hyperparameter",
      "restart_of_exited_condition_fusion_route",
      "restart_of_exited_capacity_route",
      "restart_of_exited_three_component_route",
    ],
    requiredDesignOutcome: {
      architectureDimensionsMustBeUniquelyDerivedFromCurrentContracts: true,
      ifNotUniquelyDerivable: "failed_closed_policy_boundary_report",
      noPermanentModelNameAtCandidateStage: true,
      isolatedImplementationRequiredBeforeCpuContractVerification: true,
    },
  };
  assertNoFreeDesign(candidate);
  return candidate;
}

export function materializeStage4BoundedCandidate({ root = process.cwd(), capabilityVersion, sourceEvidence, recordedAtUtc = new Date().toISOString() }) {
  const bindings = validateBindings(root, sourceEvidence);
  const evidence = Object.fromEntries(bindings.map((item) => [item.role, readJson(resolveInside(root, item.path))]));
  const adjudication = adjudicateStage4BoundedCandidate(evidence);
  const candidate = buildStage4CapabilityCandidate({ capabilityVersion, sourceEvidence: bindings.map(({ role, path: itemPath, sha256 }) => ({ role, path: itemPath, sha256 })), adjudication });
  const outputRoot = resolveInside(root, `${STAGE4_BOUNDED_CANDIDATE_ROOT}/${capabilityVersion}`);
  const lifecycleRoot = resolveInside(root, `.runtime/ai-painter/capability-lifecycle/${capabilityVersion}`);
  assert.equal(fs.existsSync(outputRoot), false, "candidate output already exists");
  assert.equal(fs.existsSync(lifecycleRoot), false, "capability lifecycle already exists");
  fs.mkdirSync(path.dirname(outputRoot), { recursive: true });
  fs.mkdirSync(outputRoot, { recursive: false });

  const files = {
    problem: path.join(outputRoot, "problem-report.json"),
    audit: path.join(outputRoot, "evidence-audit.json"),
    adjudication: path.join(outputRoot, "adjudication.json"),
    candidate: path.join(outputRoot, "candidate.json"),
    action: path.join(outputRoot, "local-next-action.json"),
    cpu: path.join(outputRoot, "cpu-report.json"),
    terminal: path.join(outputRoot, "phase-terminal.json"),
    capsule: path.join(outputRoot, "local-task-capsule.json"),
    planSync: path.join(outputRoot, "plan-sync-record.json"),
  };
  writeJsonAtomic(files.problem, { schemaVersion: "stage4-bounded-candidate-problem-report-v1", status: "existing_model_families_exhausted_without_data_or_autoencoder_defect_proven", exitedRoutes: ["condition_fusion", "capacity", "three_component"], fixedTotalProgress: progress(), recordedAtUtc });
  writeJsonAtomic(files.audit, { schemaVersion: "stage4-bounded-candidate-evidence-audit-v1", status: "passed", sourceEvidence: bindings, historicalHumanApprovalFieldsIgnoredAsAuthority: true, evidenceUsedReadOnly: true, checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc });
  writeJsonAtomic(files.adjudication, { schemaVersion: "stage4-bounded-candidate-adjudication-v1", status: "uniquely_adjudicated", ...adjudication, alternativesRejected: { generationParadigmChange: "staged generation paradigm is not proven invalid", evidenceInsufficient: "five required immutable terminals are present and consistent" }, recordedAtUtc });
  writeJsonAtomic(files.candidate, candidate);
  writeJsonAtomic(files.action, { schemaVersion: "stage4-local-autonomous-next-action-v1", status: "materialized_not_started", action: adjudication.nextLifecycleAction, capabilityVersion, ownerAuthorizationRequired: false, ownerResponseRequired: false, gpuStarted: false, trainingStarted: false, recordedAtUtc });
  writeJsonAtomic(files.cpu, { schemaVersion: "stage4-bounded-candidate-cpu-report-v1", status: "passed", evidenceRolesVerified: bindings.map((item) => item.role), selectedOption: adjudication.selectedOption, freeArchitectureParametersIntroduced: false, checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc });
  const lifecycle = createCapabilityCandidate(candidate, { root, recordedAtUtc });
  writeJsonAtomic(files.terminal, { schemaVersion: "stage4-bounded-candidate-terminal-v1", executionState: "completed", status: "bounded_model_family_change_candidate_materialized", capabilityVersion, lifecycleState: lifecycle.state.state, fixedTotalProgress: progress(), problemReport: bind(root, files.problem), evidenceAudit: bind(root, files.audit), adjudication: bind(root, files.adjudication), candidate: bind(root, files.candidate), localNextAction: bind(root, files.action), cpuReport: bind(root, files.cpu), ownerAuthorizationRequired: false, ownerResponseRequired: false, checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc });
  writeJsonAtomic(files.capsule, { schemaVersion: "ai-painter-local-task-capsule-v2", module: "AI Painter R5", currentStage: "Stage4 bounded model-family change candidate", status: "cpu_design_candidate_materialized_not_started", capabilityVersion, fixedTotalProgress: progress(), latestTerminal: bind(root, files.terminal), nextLocalAction: adjudication.nextLifecycleAction, ownerAuthorizationRequired: false, ownerResponseRequired: false, recordedAtUtc });
  const planPath = resolveInside(root, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md");
  const beforeSha256 = sha256File(planPath);
  let plan = fs.readFileSync(planPath, "utf8");
  plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(recordedAtUtc).replace("T", " ").replace("+08:00", " +08:00")}`);
  plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4有界新模型家族CPU设计候选已由本地程序物化，训练未运行");
  plan = plan.replace("当前尚未形成新的活动模型候选，也没有GPU训练运行。", "当前已经形成一个有界的新模型家族CPU设计候选，但尚未实施模型，也没有GPU训练运行。");
  plan = plan.replace("唯一下一动作是由本地AI根据裁决A物化一个有界的生成范式或模型家族能力变更候选，并为其绑定训练、验证、审核和裁决适配器，先进行CPU设计与合同验证；该动作不等待Owner签名、不复用失败Checkpoint，也不在候选合同未通过前启动GPU或训练。", "唯一下一动作是由本地AI执行该候选的隔离模型家族CPU设计，生成可唯一派生、未激活的结构合同，并为后续训练、验证、审核和裁决适配器定义边界；不复用失败Checkpoint，也不在CPU合同通过前启动GPU或训练。");
  writeTextAtomic(planPath, plan);
  writeJsonAtomic(files.planSync, { schemaVersion: "stage4-bounded-candidate-plan-sync-v1", status: "synchronized", planPath: relative(root, planPath), beforeSha256, afterSha256: sha256File(planPath), terminal: bind(root, files.terminal), recordedAtUtc });

  for (const target of Object.values(files)) index(target, root, capabilityVersion);
  index(path.join(lifecycle.candidateRoot, "candidate.json"), root, capabilityVersion);
  index(path.join(lifecycle.candidateRoot, "state.json"), root, capabilityVersion);
  index(path.join(lifecycle.candidateRoot, "lifecycle.sqlite"), root, capabilityVersion);
  appendAiPainterProgramEvent({ id: `stage4-bounded-candidate-${capabilityVersion}`, timestamp: recordedAtUtc, action: "stage4_bounded_model_family_candidate_materialized", runId: capabilityVersion, kind: "cpu_autonomous_capability_candidate", status: "success", title: "Stage4 bounded model-family candidate materialized", titleZh: "Stage4有界新模型家族CPU设计候选已由本地程序物化", detailZh: "依据五组不可变终态选择最小剩余变更轴；未启动GPU或训练。", evidencePath: relative(root, files.terminal), evidenceSha256: sha256File(files.terminal), fixedTotalProgress: progress() });
  return { status: "bounded_model_family_change_candidate_materialized", capabilityVersion, selectedOption: adjudication.selectedOption, lifecycleState: lifecycle.state.state, terminal: bind(root, files.terminal), localNextAction: bind(root, files.action), fixedTotalProgress: progress(), ownerAuthorizationRequired: false, gpuStarted: false, trainingStarted: false };
}

function validateBindings(root, sourceEvidence) {
  assert.ok(Array.isArray(sourceEvidence), "sourceEvidence must be an array");
  const roles = sourceEvidence.map((item) => item.role);
  assert.deepEqual([...roles].sort(), Object.keys(EVIDENCE_RULES).sort(), "source evidence roles mismatch");
  assert.equal(new Set(roles).size, roles.length, "duplicate source evidence role");
  return sourceEvidence.map((item) => {
    const absolute = resolveInside(root, item.path);
    assert.ok(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), `${item.role} evidence is missing`);
    assert.match(item.sha256 ?? "", /^[a-f0-9]{64}$/, `${item.role} SHA-256 is invalid`);
    assert.equal(sha256File(absolute), item.sha256, `${item.role} SHA-256 mismatch`);
    assert.equal(/\.(pt|pth|ckpt|safetensors)$/iu.test(item.path), false, `${item.role} checkpoint evidence forbidden`);
    return { role: item.role, path: relative(root, absolute), sha256: item.sha256 };
  });
}
function assertNoFreeDesign(candidate) {
  for (const field of ["modelName", "baseWidth", "layerCount", "loss", "lossWeight", "learningRate", "batchSize", "epochCount"]) assert.equal(Object.hasOwn(candidate, field), false, `free design field forbidden: ${field}`);
}
function progress() { return { completedStages: 3, totalStages: 5, percent: 60 }; }
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function resolveInside(root, relativePath) { assert.ok(typeof relativePath === "string" && relativePath && !path.isAbsolute(relativePath) && !/^[A-Za-z]:[\\/]/.test(relativePath) && !relativePath.split(/[\\/]/).includes(".."), "path must be project-relative"); const base = path.resolve(root); const absolute = path.resolve(base, relativePath); assert.ok(absolute.startsWith(`${base}${path.sep}`), "path escapes project root"); return absolute; }
function relative(root, file) { return path.relative(path.resolve(root), file).replaceAll("\\", "/"); }
function sha256File(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function bind(root, file) { return { path: relative(root, file), sha256: sha256File(file) }; }
function writeTextAtomic(file, value) { const temporary = `${file}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(temporary, value, "utf8"); fs.renameSync(temporary, file); }
function index(file, root, runId) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, artifactType: "stage4_bounded_model_family_candidate_v1", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha256File(file) }); }

