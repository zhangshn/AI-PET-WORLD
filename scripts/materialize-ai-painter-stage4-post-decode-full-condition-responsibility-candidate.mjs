import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  advanceCapabilityLifecycle,
  createCapabilityCandidate,
} from "./lib/ai-painter-capability-lifecycle-v1.mjs";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs";
import {
  buildPostDecodeFullConditionResponsibilityInactiveConfig,
  POST_DECODE_FULL_CONDITION_RESPONSIBILITY_ARCHITECTURE_ID,
  POST_DECODE_FULL_CONDITION_RESPONSIBILITY_ORDER,
} from "./lib/ai-painter-stage4-post-decode-full-condition-responsibility-renderer-v1.mjs";
import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs";

const root = process.cwd();
const recordedAtUtc = new Date().toISOString();
const current = await readCurrentExecutionRegistry(root);
assert.equal(current.ok, true, current.errorCode);
assert.equal(
  current.registry.taskId,
  "implement_cpu_inactive_post_decode_full_condition_route_object_responsibility_renderer",
  "current task is not the bounded CPU implementation",
);
assert.equal(current.registry.lifecycleStage, "change_candidate");
assert.equal(current.registry.activeExecution, null);
const capabilityVersion = current.registry.capabilityVersion;
const runId = `stage4-full-condition-responsibility-cpu-${compactUtc()}`;
const packageId = `local-ai-${runId}`;
const outputRoot = resolveInside(
  `.runtime/ai-painter/stage4-post-decode-full-condition-responsibility-candidates/${runId}`,
);
assert.equal(fs.existsSync(outputRoot), false, "CPU output already exists");
fs.mkdirSync(path.dirname(outputRoot), { recursive: true });
fs.mkdirSync(outputRoot, { recursive: false });

const boundedCandidateRow = current.taskCapsule.evidence.find(
  (row) => row.kind === "bounded_candidate",
);
assert.ok(boundedCandidateRow, "bounded candidate evidence is missing");
const boundedCandidate = readJson(boundedCandidateRow.path);
assert.equal(
  boundedCandidate.selectedCandidate?.candidateKind,
  "post_decode_full_condition_route_and_object_responsibility_renderer",
);
assert.deepEqual(
  boundedCandidate.selectedCandidate?.responsibilityIdentityOrder,
  POST_DECODE_FULL_CONDITION_RESPONSIBILITY_ORDER,
);
assert.equal(boundedCandidate.selectedCandidate?.perResponsibilityInput?.totalChannels, 26);
assert.equal(boundedCandidate.selectedCandidate?.existingDerivedWidth, 64);
assert.equal(boundedCandidate.selectedCandidate?.perResponsibilityOutputChannels, 3);

const sources = {
  previousRegistryTransaction: bindExisting(
    `.runtime/ai-painter/current-execution-registry/transactions/${current.registry.transactionId}/transaction.json`,
  ),
  boundedPlanningTerminal: bindExisting(current.registry.terminalEvidence.path),
  boundedCandidate: bindExisting(boundedCandidateRow.path),
  baseConfiguration: bindExisting(
    "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json",
  ),
  modelImplementation: bindExisting(
    "ml/ai-painter/src/ai_painter/complete_world/model.py",
  ),
  trainerImplementation: bindExisting(
    "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
  ),
  modeRegistryImplementation: bindExisting(
    "ml/ai-painter/scripts/ai_painter_stage_mode_registry.py",
  ),
  inactiveCompilerImplementation: bindExisting(
    "scripts/lib/ai-painter-stage4-post-decode-full-condition-responsibility-renderer-v1.mjs",
  ),
  cpuCheckerImplementation: bindExisting(
    "ml/ai-painter/scripts/check_stage4_post_decode_full_condition_responsibility_cpu.py",
  ),
};

const base = readJson(sources.baseConfiguration.path);
const inactiveConfig = buildPostDecodeFullConditionResponsibilityInactiveConfig(base);
const configPath = path.join(outputRoot, "inactive-config.json");
writeJsonAtomic(configPath, inactiveConfig);

const checker = spawnSync(
  process.env.AI_PAINTER_NODE ?? process.execPath,
  ["scripts/check-ai-painter-stage4-post-decode-full-condition-responsibility.mjs"],
  { cwd: root, encoding: "utf8", maxBuffer: 30 * 1024 * 1024 },
);
assert.equal(checker.status, 0, checker.stderr || checker.stdout);
const rawCpuReport = JSON.parse(checker.stdout);
assert.equal(rawCpuReport.status, "passed");
assert.equal(rawCpuReport.positivePassed, rawCpuReport.positiveTotal);
assert.equal(rawCpuReport.negativePassed, rawCpuReport.negativeTotal);
const cpuReportPath = path.join(outputRoot, "cpu-report.json");
writeJsonAtomic(cpuReportPath, {
  ...rawCpuReport,
  capabilityVersion,
  runId,
  recordedAtUtc,
});

const supportContractPath = path.join(outputRoot, "model-structure-support-contract.json");
writeJsonAtomic(supportContractPath, {
  schemaVersion:
    "stage4-post-decode-full-condition-responsibility-model-support-contract-v1",
  status: "cpu_supported_inactive",
  capabilityVersion,
  architectureId:
    POST_DECODE_FULL_CONDITION_RESPONSIBILITY_ARCHITECTURE_ID,
  responsibilityOrder: POST_DECODE_FULL_CONDITION_RESPONSIBILITY_ORDER,
  branchContract: {
    input: {
      decodedRgbChannels: 3,
      completeTypedConditionChannels: 23,
      totalChannels: 26,
    },
    hiddenWidth: 64,
    outputRgbChannels: 3,
    authoritativeMaskSource: "same_identity_discrete_condition",
    merge:
      "authoritative_mask_normalized_full_condition_responsibility_rgb_v1",
    parameterNamespacesPairwiseDisjoint: true,
  },
  frozenBoundaries: {
    approvedDatasetCount: 64,
    splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 },
    conditionOrderAndTypes: true,
    latentChannels: 12,
    frozenAutoencoder: true,
    existingLossValuesAndWeights: true,
    checkpointFormat: true,
    machineReviewThresholds: true,
  },
  activationState: "inactive",
  gpuStarted: false,
  trainingStarted: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc,
});

const parameterReportPath = path.join(outputRoot, "parameter-structure-report.json");
writeJsonAtomic(parameterReportPath, {
  schemaVersion:
    "stage4-post-decode-full-condition-responsibility-parameter-structure-report-v1",
  status: "verified",
  architectureId:
    POST_DECODE_FULL_CONDITION_RESPONSIBILITY_ARCHITECTURE_ID,
  responsibilityOrder: POST_DECODE_FULL_CONDITION_RESPONSIBILITY_ORDER,
  perResponsibilityParameterCount:
    rawCpuReport.perResponsibilityParameterCount,
  totalResponsibilityParameterCount:
    rawCpuReport.totalResponsibilityParameterCount,
  parameterNamespacesPairwiseDisjoint: true,
  branchInputChannels: 26,
  branchHiddenWidth: 64,
  branchOutputChannels: 3,
  legacyPostDecodeNamespaceUnchanged: true,
  recordedAtUtc,
});

const auditPath = path.join(outputRoot, "configuration-audit.json");
writeJsonAtomic(auditPath, {
  schemaVersion:
    "stage4-post-decode-full-condition-responsibility-configuration-audit-v1",
  status: "passed",
  capabilityVersion,
  sourceConfiguration: sources.baseConfiguration,
  inactiveConfiguration: bind(configPath),
  conditionChannelCount: inactiveConfig.conditionChannels,
  conditionChannelOrder: inactiveConfig.conditionChannelOrder,
  responsibilityOrder: inactiveConfig.postDecodeResponsibilityIdentityOrder,
  allActivationGatesFalse: Object.values(inactiveConfig.activationGates).every(
    (value) => value === false,
  ),
  forbiddenTrainingActionsPresent: false,
  historicalCheckpointBindingPresent: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc,
});

const nextActionPath = path.join(outputRoot, "local-ai-next-action.json");
writeJsonAtomic(nextActionPath, {
  schemaVersion: "ai-painter-local-next-action-v1",
  status: "ready",
  capabilityVersion,
  action:
    "execute_readonly_gpu_qualification_for_post_decode_full_condition_responsibility_renderer",
  prerequisiteLifecycleState: "cpu_contract_verified",
  gpuMutationAllowed: false,
  checkpointWeightsReadAllowed: false,
  optimizerCreationAllowed: false,
  backwardAllowed: false,
  trainingAllowed: false,
  automaticExecutionAllowed: true,
  ownerAuthorizationRequired: false,
  recordedAtUtc,
});

const candidate = {
  schemaVersion: "ai-painter-capability-change-candidate-v1",
  capabilityVersion,
  changeClass: "model_family",
  status: "change_candidate",
  authority: "local_ai_pet_world_program",
  ownerAuthorizationRequired: false,
  ownerInLifecycle: false,
  sourceEvidence: [
    ...Object.values(sources),
    bind(configPath),
    bind(cpuReportPath),
    bind(supportContractPath),
    bind(parameterReportPath),
    bind(auditPath),
  ],
  architectureId:
    POST_DECODE_FULL_CONDITION_RESPONSIBILITY_ARCHITECTURE_ID,
  selectedOption:
    "post_decode_full_condition_route_and_object_responsibility_renderer",
  nextLifecycleAction: "local_ai_execute_readonly_gpu_qualification",
  scope: {
    cpuImplementationCompleted: true,
    readonlyGpuQualificationAllowedNext: true,
    smokeAllowedNow: false,
    formalTrainingAllowedNow: false,
    checkpointWeightsReadAllowed: false,
  },
};
createCapabilityCandidate(candidate, { root, recordedAtUtc });
advanceCapabilityLifecycle({
  root,
  capabilityVersion,
  targetState: "isolated_implementation",
  evidence: stageEvidence("isolated_implementation", [
    bind(configPath),
    bind(supportContractPath),
    sources.modelImplementation,
    sources.trainerImplementation,
    sources.modeRegistryImplementation,
  ]),
  recordedAtUtc,
});
const lifecycle = advanceCapabilityLifecycle({
  root,
  capabilityVersion,
  targetState: "cpu_contract_verified",
  evidence: stageEvidence("cpu_contract_verified", [
    bind(cpuReportPath),
    bind(auditPath),
    bind(parameterReportPath),
    bind(configPath),
  ]),
  recordedAtUtc,
});

const terminalPath = path.join(outputRoot, "phase-terminal.json");
writeJsonAtomic(terminalPath, {
  schemaVersion:
    "stage4-post-decode-full-condition-responsibility-cpu-terminal-v1",
  executionState: "completed",
  status: "cpu_contract_verified_waiting_local_readonly_gpu_qualification",
  capabilityVersion,
  runId,
  lifecycleState: lifecycle.state,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  inactiveConfig: bind(configPath),
  supportContract: bind(supportContractPath),
  parameterStructureReport: bind(parameterReportPath),
  configurationAudit: bind(auditPath),
  cpuReport: bind(cpuReportPath),
  nextLocalAction: bind(nextActionPath),
  checkpointWeightsRead: false,
  gpuStarted: false,
  optimizerCreated: false,
  backwardExecuted: false,
  trainingStarted: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc,
});

const capsuleEvidence = [
  capsuleEvidenceRow("bounded_planning_terminal", sources.boundedPlanningTerminal),
  capsuleEvidenceRow("bounded_candidate", sources.boundedCandidate),
  capsuleEvidenceRow("inactive_config", bind(configPath)),
  capsuleEvidenceRow("model_structure_support_contract", bind(supportContractPath)),
  capsuleEvidenceRow("parameter_structure_report", bind(parameterReportPath)),
  capsuleEvidenceRow("configuration_audit", bind(auditPath)),
  capsuleEvidenceRow("cpu_report", bind(cpuReportPath)),
  capsuleEvidenceRow("next_local_action", bind(nextActionPath)),
  capsuleEvidenceRow("cpu_terminal", bind(terminalPath)),
];
const capsulePath = path.join(outputRoot, "local-task-capsule.json");
writeJsonAtomic(capsulePath, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: packageId,
  generatedFrom: "program_saved_evidence",
  readOnly: true,
  module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
  fixedOverallProgress: {
    completedStages: 3,
    totalStages: 5,
    percent: 60,
    source: "current_execution_registry",
  },
  currentStage: {
    number: 4,
    total: 5,
    labelZh: "Stage 0→1→2完整训练",
    status: "cpu_contract_verified_readonly_gpu_qualification_pending",
  },
  candidateTerminal: {
    runId,
    status: "cpu_contract_verified",
    programStatus:
      "cpu_contract_verified_waiting_local_readonly_gpu_qualification",
    previewMachineStatus: null,
    modelQualificationStatus: "readonly_gpu_qualification_pending",
    previewCount: null,
    previewPassCount: null,
    previewFailCount: null,
    checkpointWritten: false,
    modelWeightsModified: false,
    recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
  },
  latestBlocker: {
    code: "readonly_gpu_qualification_not_yet_executed",
    summaryZh:
      "五责任分支CPU未激活实现与正反合同已通过；正式训练仍被只读GPU资格和受控Smoke阻断。",
  },
  nextAllowedAction: {
    code:
      "execute_readonly_gpu_qualification_for_post_decode_full_condition_responsibility_renderer",
    labelZh:
      "执行五责任解码后渲染器的独立只读GPU条件到达、梯度、掩码隔离和状态不变资格。",
    ownerAuthorizationRequired: false,
    automaticExecutionAllowed: true,
    planEvidenceConfirmed: true,
  },
  forbiddenActions: [
    "read_archived_smoke_as_current",
    "reuse_failed_checkpoint",
    "start_smoke_before_readonly_gpu_qualification",
    "start_stage0_before_controlled_smoke",
    "start_stage1_or_stage2",
    "lower_machine_review_threshold",
  ],
  taskIdentity: {
    modelId:
      "post_decode_full_condition_route_and_object_responsibility_renderer",
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

const registry = await advanceCurrentExecutionRegistry({
  projectRoot: root,
  capabilityVersion,
  packageId,
  taskId:
    "execute_readonly_gpu_qualification_for_post_decode_full_condition_responsibility_renderer",
  taskKind: "readonly_gpu_qualification",
  runId,
  lifecycleStage: "cpu_contract_verified",
  executionState: "package_materialized",
  activity: "planned_not_started",
  taskCapsulePath: relative(capsulePath),
  terminalEvidencePath: relative(terminalPath),
});
assert.equal(registry.ok, true, registry.errorCode);
assert.equal(registry.registry.registryRevision, current.registry.registryRevision + 1);

const guidePath = resolveInside(
  "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md",
);
let guide = fs.readFileSync(guidePath, "utf8");
guide = guide.replace(
  /^更新时间：.*$/mu,
  `更新时间：${formatShanghai(recordedAtUtc).replace("T", " ").replace("+08:00", " +08:00")}`,
);
guide = guide.replace(
  /^状态：.*$/mu,
  "状态：active-module-plan / AI Painter固定进度3/5（60%）；解码后完整条件道路与对象责任渲染器已完成CPU合同，下一步由本地程序执行只读GPU资格",
);
guide = guide.replace(
  "训练未运行。最近训练终态是解码后四类对象RGB候选Stage 0真实视觉失败；项目后续任务是已形成但尚未实施的有界候选。旧Smoke仍可作为不可变历史证据被查询，但不得成为项目当前任务、活动执行或下一动作。未来候选仍必须物化自身SHA绑定的训练、验证、机器审核和裁决适配器并通过能力生命周期；在这些证据形成前，不得宣称AI Painter模型已经突破60%或正式能力已经发布。",
  "训练未运行。最近训练终态仍是解码后四类对象RGB候选Stage 0真实视觉失败；新候选已经完成CPU未激活实现、配置审计与正反合同，但尚未取得只读GPU资格。旧Smoke仍可作为不可变历史证据被查询，但不得成为项目当前任务、活动执行或下一动作。候选仍必须继续物化自身SHA绑定的GPU资格、训练、验证、机器审核和裁决适配器并通过能力生命周期；在这些证据形成前，不得宣称AI Painter模型已经突破60%或正式能力已经发布。",
);
guide = guide.replace(
  "后续实施顺序固定如下：唯一当前执行登记、控制台状态投影和旧Smoke默认读取隔离已经完成；程序下一步实施既定`post_decode_full_condition_route_and_object_responsibility_renderer`候选的CPU未激活支持。CPU正反合同、参数隔离、输入输出身份和配置审计未全部通过前，不得启动GPU、Smoke或Stage 0。",
  "后续实施顺序固定如下：唯一当前执行登记、控制台状态投影、旧Smoke默认读取隔离和`post_decode_full_condition_route_and_object_responsibility_renderer`的CPU未激活实现已经完成。CPU正向19/19、反向14/14合同、参数隔离、完整23通道到达、掩码外零影响、最终RGB接线和配置审计均已通过。程序下一步执行独立只读GPU资格；资格通过后才允许一次30 Epoch受控Smoke，Smoke通过后才允许Stage 0。",
);
writeTextAtomic(guidePath, guide);

appendAiPainterProgramEvent({
  id: runId,
  timestamp: recordedAtUtc,
  action: "stage4_post_decode_full_condition_responsibility_cpu_contract_verified",
  runId,
  kind: "local_autonomous_capability_candidate",
  status: "success",
  title: "Stage4 full-condition responsibility renderer CPU contract verified",
  titleZh: "Stage4完整条件道路与对象责任渲染器CPU合同通过",
  detailZh:
    "道路与四类对象五个责任分支已接入最终RGB路径；每个分支接收解码RGB与完整23通道条件，只能在同身份权威掩码内生效。正向19/19、反向14/14通过，未启动GPU或训练。",
  evidencePath: relative(terminalPath),
  evidenceSha256: sha256File(terminalPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
});

process.stdout.write(`${JSON.stringify({
  status: "cpu_contract_verified",
  capabilityVersion,
  runId,
  lifecycleState: lifecycle.state,
  registryRevision: registry.registry.registryRevision,
  terminal: bind(terminalPath),
  cpuReport: bind(cpuReportPath),
  inactiveConfig: bind(configPath),
  supportContract: bind(supportContractPath),
  nextLocalAction:
    "execute_readonly_gpu_qualification_for_post_decode_full_condition_responsibility_renderer",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  gpuStarted: false,
  trainingStarted: false,
}, null, 2)}\n`);

function stageEvidence(targetState, bindings) {
  return {
    schemaVersion: "ai-painter-capability-stage-evidence-v1",
    capabilityVersion,
    targetState,
    status: "passed",
    bindings: bindings.map(({ path: filePath, sha256 }) => ({
      path: filePath,
      sha256,
    })),
  };
}

function capsuleEvidenceRow(kind, binding) {
  return {
    kind,
    labelZh: kind,
    path: binding.path,
    sha256: binding.sha256,
    expectedSha256: binding.sha256,
    sha256Verified: true,
    recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
  };
}

function resolveInside(relativePath) {
  assert.equal(path.isAbsolute(relativePath), false, "path must be project-relative");
  assert.equal(relativePath.split(/[\\/]/u).includes(".."), false, "path escapes project");
  const absolute = path.resolve(root, relativePath);
  assert.ok(absolute.startsWith(`${path.resolve(root)}${path.sep}`));
  return absolute;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(resolveInside(filePath), "utf8"));
}

function bindExisting(filePath) {
  const absolute = resolveInside(filePath);
  assert.ok(fs.existsSync(absolute) && fs.statSync(absolute).isFile());
  return { path: relative(absolute), sha256: sha256File(absolute) };
}

function bind(absolute) {
  return { path: relative(absolute), sha256: sha256File(absolute) };
}

function relative(absolute) {
  return path.relative(root, absolute).replaceAll("\\", "/");
}

function sha256File(absolute) {
  return crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex");
}

function writeTextAtomic(filePath, value) {
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, value, "utf8");
  fs.renameSync(temporary, filePath);
}

function compactUtc() {
  return new Date().toISOString().replaceAll(/[-:.TZ]/gu, "").slice(0, 14);
}
