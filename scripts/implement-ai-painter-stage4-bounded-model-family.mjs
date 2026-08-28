import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { advanceCapabilityLifecycle } from "./lib/ai-painter-capability-lifecycle-v1.mjs";
import { buildAuthoritativeSemanticCarrierInactiveConfig, CARRIER_IDENTITY_ORDER } from "./lib/ai-painter-stage4-authoritative-semantic-carrier-v1.mjs";
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs";
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs";
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs";

const root = process.cwd();
const args = process.argv.slice(2);
const value = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; };
const capabilityVersion = value("--capability-version");
assert.match(capabilityVersion ?? "", /^[a-z0-9][a-z0-9-]{7,127}$/, "capability version is invalid");
const candidateRoot = inside(`.runtime/ai-painter/stage4-bounded-candidate-plans/${capabilityVersion}`);
const lifecycleRoot = inside(`.runtime/ai-painter/capability-lifecycle/${capabilityVersion}`);
const candidate = read(path.join(candidateRoot, "candidate.json"));
const priorTerminal = read(path.join(candidateRoot, "phase-terminal.json"));
const state = read(path.join(lifecycleRoot, "state.json"));
assert.equal(candidate.capabilityVersion, capabilityVersion);
assert.equal(candidate.changeClass, "model_family");
assert.equal(candidate.selectedOption, "bounded_new_model_family_design_candidate");
assert.equal(priorTerminal.status, "bounded_model_family_change_candidate_materialized");
assert.equal(state.state, "change_candidate", "capability is not ready for isolated implementation");
assert.equal(state.ownerResponseRequired, false);
for (const binding of candidate.sourceEvidence) assert.equal(sha(inside(binding.path)), binding.sha256, `source evidence changed: ${binding.role}`);

const baseConfigPath = inside("ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json");
const modelSourcePath = inside("ml/ai-painter/src/ai_painter/complete_world/model.py");
const contractPath = inside("data/ai-painter/system-governance/stage4-authoritative-visual-semantic-carrier-model-family-contract-v1.json");
const checkerPath = inside("scripts/check-ai-painter-stage4-authoritative-semantic-carrier.mjs");
const config = buildAuthoritativeSemanticCarrierInactiveConfig(read(baseConfigPath));
const files = {
  config: path.join(candidateRoot, "authoritative-semantic-carrier-inactive-config.json"),
  design: path.join(candidateRoot, "isolated-model-family-design-report.json"),
  parameters: path.join(candidateRoot, "parameter-source-and-structure-audit.json"),
  cpu: path.join(candidateRoot, "isolated-implementation-cpu-report.json"),
  stageEvidence: path.join(candidateRoot, "isolated-implementation-stage-evidence.json"),
  terminal: path.join(candidateRoot, "isolated-implementation-terminal.json"),
  action: path.join(candidateRoot, "isolated-implementation-next-action.json"),
  planSync: path.join(candidateRoot, "isolated-implementation-plan-sync.json"),
};
for (const file of Object.values(files)) assert.equal(fs.existsSync(file), false, `isolated implementation output already exists: ${relative(file)}`);
writeJsonAtomic(files.config, config);
const check = spawnSync(process.execPath, [checkerPath], { cwd: root, encoding: "utf8", maxBuffer: 30 * 1024 * 1024 });
assert.equal(check.status, 0, check.stderr || check.stdout);
const cpu = JSON.parse(check.stdout);
assert.equal(cpu.status, "passed");
assert.equal(cpu.positivePassed, cpu.positiveTotal);
assert.equal(cpu.negativePassed, cpu.negativeTotal);
const now = new Date().toISOString();
writeJsonAtomic(files.design, {
  schemaVersion: "stage4-authoritative-visual-semantic-carrier-isolated-design-v1",
  status: "isolated_implementation_completed_cpu_inactive",
  capabilityVersion,
  architectureId: config.denoiserArchitecture,
  problemAddressed: "learned or collapsed semantic participation can suppress authoritative visual identities before final latent output",
  structuralDifference: {
    independentCarrierCount: CARRIER_IDENTITY_ORDER.length,
    carrierIdentityOrder: CARRIER_IDENTITY_ORDER,
    perCarrierSource: "same_identity_authoritative_discrete_condition_channel",
    perCarrierGate: "immutable_source_condition_mask",
    learnedParticipationGate: false,
    merge: "base_velocity_plus_sum_of_authoritatively_gated_carriers",
  },
  unchanged: ["23_condition_channels", "12_latent_channels", "base_width_64", "frozen_4x_autoencoder_boundary", "64_approved_samples", "48_8_4_4_split", "existing_loss_values_and_weights", "checkpoint_format", "machine_review_thresholds", "native_complete_rgb_business_contract"],
  checkpointWeightsRead: false,
  gpuStarted: false,
  optimizerCreated: false,
  backwardExecuted: false,
  trainingStarted: false,
  recordedAtUtc: now,
});
writeJsonAtomic(files.parameters, {
  schemaVersion: "stage4-authoritative-visual-semantic-carrier-parameter-audit-v1",
  status: "passed",
  conditionChannels: 23,
  latentChannels: 12,
  baseChannels: 64,
  carrierIdentityCount: CARRIER_IDENTITY_ORDER.length,
  carrierParameterTensorCount: cpu.parameterTensorCount,
  carrierParameterCount: cpu.parameterCount,
  sourceDimensionsUniquelyDerived: true,
  freeWidthChosen: false,
  freeLayerCountChosen: false,
  freeLossChosen: false,
  freeLossWeightChosen: false,
  freeTrainingHyperparameterChosen: false,
  recordedAtUtc: now,
});
writeJsonAtomic(files.cpu, { ...cpu, status: "passed", capabilityVersion, inactiveConfig: bind(files.config), modelSource: bind(modelSourcePath), supportContract: bind(contractPath), checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now });
const evidence = {
  schemaVersion: "ai-painter-capability-stage-evidence-v1",
  capabilityVersion,
  targetState: "isolated_implementation",
  status: "passed",
  bindings: [files.config, files.design, files.parameters, files.cpu, modelSourcePath, contractPath].map(bind),
};
writeJsonAtomic(files.stageEvidence, evidence);
const nextState = advanceCapabilityLifecycle({ root, capabilityVersion, targetState: "isolated_implementation", evidence, recordedAtUtc: now });
writeJsonAtomic(files.action, { schemaVersion: "stage4-local-autonomous-next-action-v1", status: "materialized_not_started", action: "local_ai_verify_authoritative_semantic_carrier_cpu_contract", capabilityVersion, ownerAuthorizationRequired: false, ownerResponseRequired: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now });
writeJsonAtomic(files.terminal, { schemaVersion: "stage4-authoritative-visual-semantic-carrier-isolated-implementation-terminal-v1", executionState: "completed", status: "isolated_model_family_implementation_completed_cpu_inactive", capabilityVersion, lifecycleState: nextState.state, designReport: bind(files.design), inactiveConfig: bind(files.config), parameterAudit: bind(files.parameters), cpuReport: bind(files.cpu), localNextAction: bind(files.action), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, ownerAuthorizationRequired: false, ownerResponseRequired: false, checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now });

const planPath = inside("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md");
const beforeSha256 = sha(planPath);
let plan = fs.readFileSync(planPath, "utf8");
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ").replace("+08:00", " +08:00")}`);
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4权威语义载体新模型家族已完成CPU未激活隔离实施，训练未运行");
plan = plan.replace("当前已经形成一个有界的新模型家族CPU设计候选，但尚未实施模型，也没有GPU训练运行。", "当前有界新模型家族已经完成CPU未激活隔离实施，但尚未取得完整CPU合同资格，也没有GPU训练运行。");
plan = plan.replace("唯一下一动作是由本地AI执行该候选的隔离模型家族CPU设计，生成可唯一派生、未激活的结构合同，并为后续训练、验证、审核和裁决适配器定义边界；不复用失败Checkpoint，也不在CPU合同通过前启动GPU或训练。", "唯一下一动作是由本地AI执行权威语义载体模型家族的完整CPU合同与配置正反审计；通过后才能进入只读GPU资格，仍不得在GPU资格前启动Smoke或正式训练。");
writeText(planPath, plan);
writeJsonAtomic(files.planSync, { schemaVersion: "stage4-authoritative-semantic-carrier-plan-sync-v1", status: "synchronized", planPath: relative(planPath), beforeSha256, afterSha256: sha(planPath), terminal: bind(files.terminal), recordedAtUtc: now });
for (const file of Object.values(files)) index(file);
appendAiPainterProgramEvent({ id: `stage4-authoritative-semantic-carrier-implementation-${capabilityVersion}`, timestamp: now, action: "stage4_authoritative_semantic_carrier_isolated_implementation", runId: capabilityVersion, kind: "cpu_inactive_model_family_implementation", status: "success", title: "Stage4 authoritative semantic carrier family implemented inactive", titleZh: "Stage4权威语义载体新模型家族已完成CPU未激活隔离实施", detailZh: `11个正式可视语义身份独立保留；CPU正向${cpu.positivePassed}/${cpu.positiveTotal}、反向${cpu.negativePassed}/${cpu.negativeTotal}通过；未启动GPU或训练。`, evidencePath: relative(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } });
process.stdout.write(`${JSON.stringify({ status: read(files.terminal).status, capabilityVersion, lifecycleState: nextState.state, architectureId: config.denoiserArchitecture, cpuReport: bind(files.cpu), terminal: bind(files.terminal), localNextAction: bind(files.action), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, ownerAuthorizationRequired: false, gpuStarted: false, trainingStarted: false }, null, 2)}\n`);

function inside(relativePath) { assert.ok(typeof relativePath === "string" && relativePath && !path.isAbsolute(relativePath) && !/^[A-Za-z]:[\\/]/.test(relativePath) && !relativePath.split(/[\\/]/).includes(".."), "project-relative path required"); const target = path.resolve(root, relativePath); assert.ok(target.startsWith(`${root}${path.sep}`)); return target; }
function relative(file) { return path.relative(root, file).replaceAll("\\", "/"); }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function bind(file) { return { path: relative(file), sha256: sha(file) }; }
function writeText(file, value) { const temporary = `${file}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(temporary, value, "utf8"); fs.renameSync(temporary, file); }
function index(file) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: capabilityVersion, artifactType: "stage4_authoritative_semantic_carrier_isolated_implementation_v1", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) }); }

