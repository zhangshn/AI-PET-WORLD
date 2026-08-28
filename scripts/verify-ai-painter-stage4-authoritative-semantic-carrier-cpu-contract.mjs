import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { advanceCapabilityLifecycle } from "./lib/ai-painter-capability-lifecycle-v1.mjs";
import { validateAuthoritativeSemanticCarrierInactiveConfig } from "./lib/ai-painter-stage4-authoritative-semantic-carrier-v1.mjs";
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs";
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs";
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs";

const root = process.cwd();
const args = process.argv.slice(2);
const index = args.indexOf("--capability-version");
const capabilityVersion = index >= 0 ? args[index + 1] : null;
assert.match(capabilityVersion ?? "", /^[a-z0-9][a-z0-9-]{7,127}$/, "capability version is invalid");
const candidateRoot = inside(`.runtime/ai-painter/stage4-bounded-candidate-plans/${capabilityVersion}`);
const lifecycleRoot = inside(`.runtime/ai-painter/capability-lifecycle/${capabilityVersion}`);
const state = read(path.join(lifecycleRoot, "state.json"));
const implementationTerminal = read(path.join(candidateRoot, "isolated-implementation-terminal.json"));
const configPath = path.join(candidateRoot, "authoritative-semantic-carrier-inactive-config.json");
const config = read(configPath);
assert.equal(state.state, "isolated_implementation", "capability is not ready for CPU contract verification");
assert.equal(implementationTerminal.status, "isolated_model_family_implementation_completed_cpu_inactive");
assert.equal(validateAuthoritativeSemanticCarrierInactiveConfig(config), true);

const files = {
  audit: path.join(candidateRoot, "cpu-contract-config-audit.json"),
  report: path.join(candidateRoot, "cpu-contract-verification-report.json"),
  evidence: path.join(candidateRoot, "cpu-contract-stage-evidence.json"),
  terminal: path.join(candidateRoot, "cpu-contract-terminal.json"),
  action: path.join(candidateRoot, "cpu-contract-next-action.json"),
  planSync: path.join(candidateRoot, "cpu-contract-plan-sync.json"),
};
for (const file of Object.values(files)) assert.equal(fs.existsSync(file), false, `CPU contract output already exists: ${relative(file)}`);
const specific = runNode("scripts/check-ai-painter-stage4-authoritative-semantic-carrier.mjs");
const entrypoints = runNode("scripts/check-ai-painter-current-entrypoints.mjs");
const now = new Date().toISOString();
writeJsonAtomic(files.audit, {
  schemaVersion: "stage4-authoritative-semantic-carrier-config-audit-v1",
  status: "passed",
  inactiveConfig: bind(configPath),
  allActivationGatesFalse: Object.values(config.activationGates).every((value) => value === false),
  historicalCheckpointFieldPresent: Object.hasOwn(config, "checkpointPath"),
  trainingSectionPresent: Object.hasOwn(config, "training"),
  lossSectionPresent: Object.hasOwn(config, "loss"),
  ownerAuthorizationRequired: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc: now,
});
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-authoritative-semantic-carrier-cpu-contract-report-v1",
  status: "passed",
  capabilityVersion,
  positivePassed: specific.positivePassed,
  positiveTotal: specific.positiveTotal,
  negativePassed: specific.negativePassed,
  negativeTotal: specific.negativeTotal,
  carrierIdentityOrder: specific.carrierIdentityOrder,
  carrierParameterTensorCount: specific.parameterTensorCount,
  carrierParameterCount: specific.parameterCount,
  currentEntrypointCount: entrypoints.currentEntrypointCount,
  ownerRuntimeEntrypointCount: entrypoints.ownerRuntimeEntrypointCount,
  modelSource: bind(inside("ml/ai-painter/src/ai_painter/complete_world/model.py")),
  modelFamilyContract: bind(inside("data/ai-painter/system-governance/stage4-authoritative-visual-semantic-carrier-model-family-contract-v1.json")),
  configAudit: bind(files.audit),
  checkpointWeightsRead: false,
  gpuStarted: false,
  optimizerCreated: false,
  backwardExecuted: false,
  trainingStarted: false,
  recordedAtUtc: now,
});
const evidence = {
  schemaVersion: "ai-painter-capability-stage-evidence-v1",
  capabilityVersion,
  targetState: "cpu_contract_verified",
  status: "passed",
  bindings: [files.audit, files.report, configPath, inside("ml/ai-painter/src/ai_painter/complete_world/model.py"), inside("data/ai-painter/system-governance/stage4-authoritative-visual-semantic-carrier-model-family-contract-v1.json")].map(bind),
};
writeJsonAtomic(files.evidence, evidence);
const nextState = advanceCapabilityLifecycle({ root, capabilityVersion, targetState: "cpu_contract_verified", evidence, recordedAtUtc: now });
writeJsonAtomic(files.action, { schemaVersion: "stage4-local-autonomous-next-action-v1", status: "materialized_not_started", action: "local_ai_execute_authoritative_semantic_carrier_readonly_gpu_qualification", capabilityVersion, ownerAuthorizationRequired: false, ownerResponseRequired: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now });
writeJsonAtomic(files.terminal, { schemaVersion: "stage4-authoritative-semantic-carrier-cpu-contract-terminal-v1", executionState: "completed", status: "authoritative_semantic_carrier_cpu_contract_verified", capabilityVersion, lifecycleState: nextState.state, cpuContractReport: bind(files.report), configAudit: bind(files.audit), localNextAction: bind(files.action), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, ownerAuthorizationRequired: false, ownerResponseRequired: false, checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now });

const planPath = inside("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md");
const beforeSha256 = sha(planPath);
let plan = fs.readFileSync(planPath, "utf8");
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ").replace("+08:00", " +08:00")}`);
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4权威语义载体新模型家族CPU合同已通过，训练未运行");
plan = plan.replace("当前有界新模型家族已经完成CPU未激活隔离实施，但尚未取得完整CPU合同资格，也没有GPU训练运行。", "当前有界新模型家族已经完成CPU未激活隔离实施并取得CPU合同资格，但尚未执行只读GPU资格，也没有GPU训练运行。");
plan = plan.replace("唯一下一动作是由本地AI执行权威语义载体模型家族的完整CPU合同与配置正反审计；通过后才能进入只读GPU资格，仍不得在GPU资格前启动Smoke或正式训练。", "唯一下一动作是由本地AI执行权威语义载体模型家族的独立只读GPU资格，验证真实CUDA条件到达、载体梯度、掩码边界和模型状态不变；资格通过前不得启动Smoke或正式训练。");
writeText(planPath, plan);
writeJsonAtomic(files.planSync, { schemaVersion: "stage4-authoritative-semantic-carrier-cpu-contract-plan-sync-v1", status: "synchronized", planPath: relative(planPath), beforeSha256, afterSha256: sha(planPath), terminal: bind(files.terminal), recordedAtUtc: now });
for (const file of Object.values(files)) indexArtifactFile(file);
appendAiPainterProgramEvent({ id: `stage4-authoritative-semantic-carrier-cpu-contract-${capabilityVersion}`, timestamp: now, action: "stage4_authoritative_semantic_carrier_cpu_contract_verification", runId: capabilityVersion, kind: "cpu_contract_verification", status: "success", title: "Stage4 authoritative semantic carrier CPU contract verified", titleZh: "Stage4权威语义载体新模型家族CPU合同已通过", detailZh: `CPU正向${specific.positivePassed}/${specific.positiveTotal}、反向${specific.negativePassed}/${specific.negativeTotal}通过；当前入口${entrypoints.currentEntrypointCount}个，Owner运行入口0个。`, evidencePath: relative(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } });
process.stdout.write(`${JSON.stringify({ status: read(files.terminal).status, capabilityVersion, lifecycleState: nextState.state, cpuContractReport: bind(files.report), terminal: bind(files.terminal), localNextAction: bind(files.action), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, ownerAuthorizationRequired: false, gpuStarted: false, trainingStarted: false }, null, 2)}\n`);

function runNode(relativePath) { const result = spawnSync(process.execPath, [inside(relativePath)], { cwd: root, encoding: "utf8", maxBuffer: 30 * 1024 * 1024 }); assert.equal(result.status, 0, result.stderr || result.stdout); return JSON.parse(result.stdout); }
function inside(relativePath) { assert.ok(typeof relativePath === "string" && relativePath && !path.isAbsolute(relativePath) && !/^[A-Za-z]:[\\/]/.test(relativePath) && !relativePath.split(/[\\/]/).includes(".."), "project-relative path required"); const target = path.resolve(root, relativePath); assert.ok(target.startsWith(`${root}${path.sep}`)); return target; }
function relative(file) { return path.relative(root, file).replaceAll("\\", "/"); }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function bind(file) { return { path: relative(file), sha256: sha(file) }; }
function writeText(file, value) { const temporary = `${file}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(temporary, value, "utf8"); fs.renameSync(temporary, file); }
function indexArtifactFile(file) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: capabilityVersion, artifactType: "stage4_authoritative_semantic_carrier_cpu_contract_v1", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) }); }

