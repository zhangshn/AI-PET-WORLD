import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { advanceCapabilityLifecycle } from "./lib/ai-painter-capability-lifecycle-v1.mjs";
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs";
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs";
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs";

const root = process.cwd();
const args = process.argv.slice(2);
const option = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; };
const capabilityVersion = option("--capability-version");
const attemptId = option("--attempt-id");
assert.match(capabilityVersion ?? "", /^[a-z0-9][a-z0-9-]{7,127}$/);
assert.match(attemptId ?? "", /^[a-z0-9][a-z0-9-]{7,79}$/);
const candidateRoot = inside(`.runtime/ai-painter/stage4-bounded-candidate-plans/${capabilityVersion}`);
const lifecycleRoot = inside(`.runtime/ai-painter/capability-lifecycle/${capabilityVersion}`);
const state = read(path.join(lifecycleRoot, "state.json"));
const cpuTerminal = read(path.join(candidateRoot, "cpu-contract-terminal.json"));
assert.equal(state.state, "cpu_contract_verified");
assert.equal(cpuTerminal.status, "authoritative_semantic_carrier_cpu_contract_verified");
const configPath = path.join(candidateRoot, "authoritative-semantic-carrier-inactive-config.json");
const baseConfigPath = inside("ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json");
const checkpointPath = inside(".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt");
assert.equal(sha(checkpointPath), "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba");
const output = path.join(candidateRoot, `readonly-gpu-qualification-${attemptId}`);
assert.equal(fs.existsSync(output), false, "readonly GPU output already exists");
const python = inside("ml/ai-painter/.venv/Scripts/python.exe");
const runner = inside("ml/ai-painter/scripts/run_stage4_authoritative_semantic_carrier_readonly_gpu_qualification.py");
const result = spawnSync(python, [runner, configPath, baseConfigPath, checkpointPath, output], { cwd: root, encoding: "utf8", maxBuffer: 60 * 1024 * 1024 });
assert.equal(result.status, 0, result.stderr || result.stdout);
const report = JSON.parse(result.stdout);
assert.equal(report.status, "passed");
assert.equal(report.modelStateUnchanged, true);
assert.ok(report.samples.length >= 2);
const now = new Date().toISOString();
const gpuReport = path.join(output, "gpu-report.json");
const cuda = path.join(output, "cuda-telemetry.json");
const files = {
  evidence: path.join(candidateRoot, "readonly-gpu-stage-evidence.json"),
  terminal: path.join(candidateRoot, "readonly-gpu-terminal.json"),
  action: path.join(candidateRoot, "readonly-gpu-next-action.json"),
  planSync: path.join(candidateRoot, "readonly-gpu-plan-sync.json"),
};
for (const file of Object.values(files)) assert.equal(fs.existsSync(file), false);
const evidence = { schemaVersion: "ai-painter-capability-stage-evidence-v1", capabilityVersion, targetState: "readonly_gpu_qualified", status: "passed", bindings: [gpuReport, cuda, configPath, checkpointPath, runner].map(bind) };
writeJsonAtomic(files.evidence, evidence);
const nextState = advanceCapabilityLifecycle({ root, capabilityVersion, targetState: "readonly_gpu_qualified", evidence, recordedAtUtc: now });
writeJsonAtomic(files.action, { schemaVersion: "stage4-local-autonomous-next-action-v1", status: "materialized_not_started", action: "local_ai_compile_authoritative_semantic_carrier_controlled_smoke", capabilityVersion, ownerAuthorizationRequired: false, ownerResponseRequired: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now });
writeJsonAtomic(files.terminal, { schemaVersion: "stage4-authoritative-semantic-carrier-readonly-gpu-terminal-v1", executionState: "completed", status: "authoritative_semantic_carrier_readonly_gpu_qualified", capabilityVersion, lifecycleState: nextState.state, gpuReport: bind(gpuReport), cudaTelemetry: bind(cuda), internalConsumption: bind(path.join(output, "internal-consumption.json")), localNextAction: bind(files.action), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, ownerAuthorizationRequired: false, ownerResponseRequired: false, optimizerCreated: false, backwardExecuted: false, modelWeightsModified: false, trainingStarted: false, recordedAtUtc: now });
const planPath = inside("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md");
const beforeSha256 = sha(planPath);
let plan = fs.readFileSync(planPath, "utf8");
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ").replace("+08:00", " +08:00")}`);
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4权威语义载体新模型家族只读GPU资格已通过，训练未运行");
plan = plan.replace("当前有界新模型家族已经完成CPU未激活隔离实施并取得CPU合同资格，但尚未执行只读GPU资格，也没有GPU训练运行。", "当前有界新模型家族已经完成CPU合同和独立只读GPU资格，但尚未编译受控Smoke，也没有训练运行。");
plan = plan.replace("唯一下一动作是由本地AI执行权威语义载体模型家族的独立只读GPU资格，验证真实CUDA条件到达、载体梯度、掩码边界和模型状态不变；资格通过前不得启动Smoke或正式训练。", "唯一下一动作是由本地AI编译权威语义载体模型家族的受控30 Epoch Smoke合同并完成CPU门禁；合同通过后由本地闭环执行器自主启动Smoke、自动审核和失败关闭。");
writeText(planPath, plan);
writeJsonAtomic(files.planSync, { schemaVersion: "stage4-authoritative-semantic-carrier-readonly-gpu-plan-sync-v1", status: "synchronized", planPath: relative(planPath), beforeSha256, afterSha256: sha(planPath), terminal: bind(files.terminal), recordedAtUtc: now });
for (const file of [gpuReport, cuda, path.join(output, "internal-consumption.json"), ...Object.values(files)]) indexFile(file);
appendAiPainterProgramEvent({ id: `stage4-authoritative-semantic-carrier-readonly-gpu-${capabilityVersion}`, timestamp: now, action: "stage4_authoritative_semantic_carrier_readonly_gpu_qualification", runId: capabilityVersion, kind: "readonly_gpu_qualification", status: "success", title: "Stage4 authoritative semantic carrier readonly GPU qualified", titleZh: "Stage4权威语义载体新模型家族只读GPU资格已通过", detailZh: `真实CUDA验证${report.samples.length}个固定样本、11个语义载体到达最终解码RGB；模型状态不变，未训练。`, evidencePath: relative(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } });
process.stdout.write(`${JSON.stringify({ status: read(files.terminal).status, capabilityVersion, lifecycleState: nextState.state, gpuReport: bind(gpuReport), cudaTelemetry: bind(cuda), terminal: bind(files.terminal), localNextAction: bind(files.action), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, ownerAuthorizationRequired: false, trainingStarted: false }, null, 2)}\n`);

function inside(relativePath) { assert.ok(typeof relativePath === "string" && relativePath && !path.isAbsolute(relativePath) && !/^[A-Za-z]:[\\/]/.test(relativePath) && !relativePath.split(/[\\/]/).includes("..")); const target = path.resolve(root, relativePath); assert.ok(target.startsWith(`${root}${path.sep}`)); return target; }
function relative(file) { return path.relative(root, file).replaceAll("\\", "/"); }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function bind(file) { return { path: relative(file), sha256: sha(file) }; }
function writeText(file, value) { const temporary = `${file}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(temporary, value, "utf8"); fs.renameSync(temporary, file); }
function indexFile(file) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: capabilityVersion, artifactType: "stage4_authoritative_semantic_carrier_readonly_gpu_v1", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) }); }
