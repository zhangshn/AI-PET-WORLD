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
  buildPostDecodeObjectRgbInactiveConfig,
  POST_DECODE_OBJECT_RGB_ARCHITECTURE_ID,
  POST_DECODE_OBJECT_RGB_IDENTITY_ORDER,
} from "./lib/ai-painter-stage4-post-decode-object-rgb-compositor-v1.mjs";

const root = process.cwd();
const capabilityVersion = required("--capability-version");
assert.match(capabilityVersion, /^[a-z0-9][a-z0-9-]{7,127}$/u);
const recordedAtUtc = new Date().toISOString();
const outputRoot = resolveInside(
  `.runtime/ai-painter/stage4-post-decode-object-rgb-candidates/${capabilityVersion}`,
);
assert.equal(
  fs.existsSync(outputRoot),
  false,
  "candidate output already exists",
);
fs.mkdirSync(path.dirname(outputRoot), { recursive: true });
fs.mkdirSync(outputRoot, { recursive: false });

const sources = {
  exhaustedCandidateSpace: bindExisting(
    ".runtime/ai-painter/stage4-post-carrier-bounded-candidate-recalculations/stage4-post-carrier-20260825-autonomous-recalculation/phase-terminal.json",
  ),
  authoritativeCarrierBestReview: bindExisting(
    ".runtime/ai-painter/stage4-authoritative-semantic-carrier-formal-stage0/20260824-184800-authoritative-carrier-stage0/best-checkpoint-machine-review.json",
  ),
  frozenAutoencoderRetention: bindExisting(
    ".runtime/ai-painter/stage4-frozen-autoencoder-semantic-retention-audits/20260822-125730775/phase-terminal.json",
  ),
  structureContract: bindExisting(
    "data/ai-painter/system-governance/stage4-post-decode-authoritative-object-rgb-compositor-contract-v1.json",
  ),
  modelImplementation: bindExisting(
    "ml/ai-painter/src/ai_painter/complete_world/model.py",
  ),
  trainerImplementation: bindExisting(
    "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
  ),
  gpuQualificationImplementation: bindExisting(
    "ml/ai-painter/scripts/run_stage4_post_decode_object_rgb_readonly_gpu_qualification.py",
  ),
  cpuCheckerImplementation: bindExisting(
    "ml/ai-painter/scripts/check_stage4_post_decode_object_rgb_compositor_cpu.py",
  ),
  priorQualificationFailure: bindExisting(
    ".runtime/ai-painter/stage4-post-decode-object-rgb-readonly-gpu/20260825-104100-post-decode-object-rgb-gpu/failure-report.json",
  ),
  priorQualificationStderr: bindExisting(
    ".runtime/ai-painter/stage4-post-decode-object-rgb-readonly-gpu/20260825-104100-post-decode-object-rgb-gpu/qualification.stderr.log",
  ),
};

const exhausted = readJson(sources.exhaustedCandidateSpace.path);
const review = readJson(sources.authoritativeCarrierBestReview.path);
const autoencoder = readJson(sources.frozenAutoencoderRetention.path);
const priorQualificationFailure = readJson(
  sources.priorQualificationFailure.path,
);
assert.equal(exhausted.status, "failed_closed_candidate_space_exhausted");
assert.equal(
  exhausted.selectedOutcome,
  "no_unique_bounded_candidate_remaining",
);
assert.equal(
  autoencoder.selectedDecision,
  "frozen_autoencoder_semantic_retention_sufficient",
);
assert.equal(autoencoder.autoencoderStateUnchanged, true);
assert.equal(review.epoch, 37);
assert.equal(priorQualificationFailure.status, "failed_closed");
assert.equal(priorQualificationFailure.trainingStarted, false);
assert.match(
  fs.readFileSync(resolveInside(sources.priorQualificationStderr.path), "utf8"),
  /object RGB head qualification failed: object_footprints/u,
);
assert.equal(review.sourceAndReproductionBytesMatch, true);
assert.equal(review.professionalAesthetic?.passed, true);
assert.deepEqual(
  [...review.issueCodes].sort(),
  [
    "condition_object_footprints_reference_semantic_mismatch",
    "condition_object_rock_reference_semantic_mismatch",
    "condition_object_tree_reference_semantic_mismatch",
    "condition_object_vegetation_reference_semantic_mismatch",
  ].sort(),
);

const base = readJson(
  "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json",
);
const inactiveConfig = buildPostDecodeObjectRgbInactiveConfig(base);
const configPath = path.join(outputRoot, "inactive-config.json");
writeJsonAtomic(configPath, inactiveConfig);

const checker = spawnSync(
  process.env.AI_PAINTER_NODE ?? process.execPath,
  ["scripts/check-ai-painter-stage4-post-decode-object-rgb-compositor.mjs"],
  { cwd: root, encoding: "utf8", maxBuffer: 30 * 1024 * 1024 },
);
assert.equal(checker.status, 0, checker.stderr || checker.stdout);
const cpuReport = JSON.parse(checker.stdout);
assert.equal(cpuReport.status, "passed");
assert.equal(cpuReport.positivePassed, cpuReport.positiveTotal);
assert.equal(cpuReport.negativePassed, cpuReport.negativeTotal);
const cpuReportPath = path.join(outputRoot, "cpu-report.json");
writeJsonAtomic(cpuReportPath, {
  ...cpuReport,
  capabilityVersion,
  recordedAtUtc,
});

const derivationPath = path.join(outputRoot, "unique-derivation.json");
writeJsonAtomic(derivationPath, {
  schemaVersion: "stage4-post-decode-object-rgb-unique-derivation-v1",
  status: "uniquely_derived_cpu_verified",
  capabilityVersion,
  architectureId: POST_DECODE_OBJECT_RGB_ARCHITECTURE_ID,
  problemBoundary:
    "frozen_autoencoder_retains_semantics_but_latent_only_generation_collapses_four_object_identities_after_decode",
  priorQualificationCorrection: {
    classification: "diagnostic_fixture_sample_selection_defect",
    originalBehavior: "first_train_sample_reused_for_all_object_classes",
    correctedBehavior:
      "first_nonempty_mask_sample_selected_per_class_by_formal_source_index",
    modelDefectProvenByPriorFailure: false,
    priorTrainingStarted: false,
  },
  derivedStructure: {
    retainedPath: "existing_latent_terrain_route_hydrology_generation",
    newPath: "four_independent_post_decode_object_rgb_heads",
    inputPerHead: "decoded_rgb_3_plus_same_class_authoritative_mask_1",
    hiddenWidthSource: "existing_formal_base_width_64",
    outputPerHead: "rgb_3",
    identityOrder: POST_DECODE_OBJECT_RGB_IDENTITY_ORDER,
    merge: "authoritative_mask_normalized_rgb_compositor_v1",
    freeBlendWeights: false,
  },
  frozenBoundaries: {
    approvedDataAndSplit: true,
    conditionChannelsAndOrder: true,
    frozenAutoencoder: true,
    existingLossValuesAndWeights: true,
    machineReviewThresholds: true,
    failedCheckpointReuseForbidden: true,
  },
  sourceEvidence: sources,
  ownerAuthorizationRequired: false,
  ownerResponseRequired: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc,
});

const sourceEvidence = [
  ...Object.entries(sources).map(([role, value]) => ({ role, ...value })),
  { role: "inactiveConfig", ...bind(configPath) },
  { role: "cpuReport", ...bind(cpuReportPath) },
  { role: "uniqueDerivation", ...bind(derivationPath) },
];
const candidate = {
  schemaVersion: "ai-painter-capability-change-candidate-v1",
  capabilityVersion,
  changeClass: "model_family",
  status: "change_candidate",
  authority: "local_ai_pet_world_program",
  ownerAuthorizationRequired: false,
  ownerInLifecycle: false,
  sourceEvidence,
  architectureId: POST_DECODE_OBJECT_RGB_ARCHITECTURE_ID,
  selectedOption: "post_decode_authoritative_object_rgb_compositor",
  nextLifecycleAction: "local_ai_execute_readonly_gpu_qualification",
  scope: {
    cpuImplementationCompleted: true,
    readonlyGpuQualificationAllowedNext: true,
    smokeAllowedNow: false,
    formalTrainingAllowedNow: false,
    checkpointWeightsReadAllowed: false,
  },
};
const candidatePath = path.join(outputRoot, "candidate.json");
writeJsonAtomic(candidatePath, candidate);

createCapabilityCandidate(candidate, { root, recordedAtUtc });
advanceCapabilityLifecycle({
  root,
  capabilityVersion,
  targetState: "isolated_implementation",
  evidence: stageEvidence("isolated_implementation", [
    sources.structureContract,
    sources.modelImplementation,
    sources.trainerImplementation,
    bind(configPath),
    bind(derivationPath),
  ]),
  recordedAtUtc,
});
const lifecycle = advanceCapabilityLifecycle({
  root,
  capabilityVersion,
  targetState: "cpu_contract_verified",
  evidence: stageEvidence("cpu_contract_verified", [
    bind(cpuReportPath),
    bind(configPath),
    sources.structureContract,
  ]),
  recordedAtUtc,
});

const terminalPath = path.join(outputRoot, "phase-terminal.json");
writeJsonAtomic(terminalPath, {
  schemaVersion: "stage4-post-decode-object-rgb-cpu-support-terminal-v1",
  executionState: "completed",
  status: "cpu_contract_verified_waiting_local_readonly_gpu_qualification",
  capabilityVersion,
  lifecycleState: lifecycle.state,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  architectureId: POST_DECODE_OBJECT_RGB_ARCHITECTURE_ID,
  sourceEvidence: sources,
  uniqueDerivation: bind(derivationPath),
  inactiveConfig: bind(configPath),
  cpuReport: bind(cpuReportPath),
  ownerAuthorizationRequired: false,
  ownerResponseRequired: false,
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc,
});
const capsulePath = path.join(outputRoot, "local-task-capsule.json");
writeJsonAtomic(capsulePath, {
  schemaVersion: "ai-painter-local-task-capsule-v2",
  module: "AI Painter R5 / Stage4",
  currentStage: "post-decode object RGB compositor CPU contract",
  status: "cpu_contract_verified",
  capabilityVersion,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  latestTerminal: bind(terminalPath),
  nextLocalAction: "local_ai_execute_readonly_gpu_qualification",
  ownerAuthorizationRequired: false,
  ownerResponseRequired: false,
  recordedAtUtc,
});

const planPath = resolveInside(
  "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md",
);
let plan = fs.readFileSync(planPath, "utf8");
plan = plan.replace(
  /^更新时间：.*$/mu,
  `更新时间：${formatShanghai(recordedAtUtc).replace("T", " ").replace("+08:00", " +08:00")}`,
);
plan = plan.replace(
  /^状态：.*$/mu,
  "状态：active-module-plan / AI Painter固定进度3/5（60%）；解码后四类对象RGB候选已完成CPU合同，下一步由本地程序执行只读GPU资格",
);
plan = plan.replace(
  "本地AI的有界候选规划器已纳入权威语义载体拒绝终态完成重新计算：当前合同内可唯一派生且不重复已退出路线的候选数量为0。程序已保存政策边界报告并保持失败关闭，不等待Owner审批，也不启动GPU或训练。",
  "本地AI已依据冻结Autoencoder语义保留、权威载体最佳Checkpoint四类对象同时失败及既有路线穷尽证据，唯一派生出解码后四类对象RGB合成候选。该候选保留现有潜空间地形、道路和水文路径，只在冻结Autoencoder解码后增加四个按权威对象掩码隔离的RGB头；CPU正反合同已通过，尚未启动GPU或训练。",
);
plan = plan.replace(
  "当前安全替代是保留64份数据、WorldFacts、23通道、全部失败证据和60%固定进度，暂停Stage4训练。只有本地程序以后取得一个由现有合同唯一派生、与全部退出路线实质不同的新架构规则时，才能重新进入能力生命周期；不得把Owner签名、自由调参或重复训练当作解除条件。",
  "当前唯一下一动作是本地程序对解码后四类对象RGB候选执行独立只读GPU资格，验证最终RGB到达、四类参数与条件来源隔离、掩码外零影响及模型状态不变。资格通过后才允许一次30 Epoch受控Smoke；Smoke未通过不得进入40 Epoch Stage 0。",
);
writeTextAtomic(planPath, plan);

appendAiPainterProgramEvent({
  id: `stage4-post-decode-object-rgb-${capabilityVersion}`,
  timestamp: recordedAtUtc,
  action: "stage4_post_decode_object_rgb_cpu_contract_verified",
  runId: capabilityVersion,
  kind: "local_autonomous_capability_candidate",
  status: "success",
  title: "Stage4 post-decode object RGB CPU contract verified",
  titleZh: "Stage4解码后四类对象RGB候选CPU合同已通过",
  detailZh:
    "四类RGB头已进入Denoiser优化器与Checkpoint命名空间，正式最终RGB训练、rollout及Checkpoint路径统一接线；未启动GPU或训练。",
  evidencePath: relative(terminalPath),
  evidenceSha256: sha256File(terminalPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
});

process.stdout.write(
  `${JSON.stringify(
    {
      status: "cpu_contract_verified",
      capabilityVersion,
      lifecycleState: lifecycle.state,
      terminal: bind(terminalPath),
      nextLocalAction: "local_ai_execute_readonly_gpu_qualification",
      ownerAuthorizationRequired: false,
      gpuStarted: false,
      trainingStarted: false,
    },
    null,
    2,
  )}\n`,
);

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

function required(flag) {
  const index = process.argv.indexOf(flag);
  assert(index >= 0 && process.argv[index + 1], `missing ${flag}`);
  return process.argv[index + 1];
}

function resolveInside(relativePath) {
  assert.equal(
    path.isAbsolute(relativePath),
    false,
    "path must be project-relative",
  );
  assert.equal(
    relativePath.split(/[\\/]/u).includes(".."),
    false,
    "path escapes project",
  );
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
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(absolute))
    .digest("hex");
}

function writeTextAtomic(filePath, value) {
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, value, "utf8");
  fs.renameSync(temporary, filePath);
}
