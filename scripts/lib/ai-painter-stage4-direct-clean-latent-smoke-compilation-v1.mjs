import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  buildDirectCleanLatentControlledSmokeContract,
  CAPABILITY_VERSION,
  validateDirectCleanLatentControlledSmokeContract,
} from "./ai-painter-stage4-direct-clean-latent-smoke-contract-v1.mjs";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeJsonAtomic,
} from "./ai-painter-program-event-store.mjs";
import { indexArtifact } from "./ai-pet-world-storage-catalog.mjs";
import { logicalProjectPath } from "./ai-pet-world-storage.mjs";
import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../../src/server/ai-painter-current-execution-registry.mjs";

const EXPECTED_TASK = "compile_direct_condition_clean_latent_controlled_smoke_contract";
const NEXT_TASK = "implement_direct_condition_clean_latent_controlled_smoke_training_path";
const OUTPUT_ROOT = ".runtime/ai-painter/stage4-direct-clean-latent-smoke-contract-compilations";
const GPU_ROOT = ".runtime/ai-painter/stage4-direct-clean-latent-readonly-gpu-qualifications/stage4-direct-clean-latent-readonly-gpu-20260827-03";
const CPU_ROOT = ".runtime/ai-painter/stage4-direct-clean-latent-cpu-support/stage4-direct-clean-latent-cpu-support-20260827-01";
const SOURCE_INDEX = "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json";
const AUTOENCODER = ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt";

export async function compileDirectCleanLatentSmokeContract({
  root = process.cwd(),
  compilationRunId,
  reservedSmokeRunId,
  recordedAtUtc = new Date().toISOString(),
} = {}) {
  const current = await readCurrentExecutionRegistry(root);
  assert.equal(current.ok, true, `current registry invalid: ${current.errorCode}`);
  assert.equal(current.registry.capabilityVersion, CAPABILITY_VERSION);
  assert.equal(current.registry.taskId, EXPECTED_TASK);
  assert.equal(current.registry.taskKind, "contract_compilation");
  assert.equal(current.registry.lifecycleStage, "readonly_gpu_qualified");
  assert.equal(current.registry.activity, "planned_not_started");
  assert.equal(current.registry.activeExecution, null);
  const lifecyclePath = resolveExisting(root, `.runtime/ai-painter/capability-lifecycle/${CAPABILITY_VERSION}/state.json`);
  const lifecycle = read(lifecyclePath);
  assert.equal(lifecycle.state, "readonly_gpu_qualified");

  const outputRoot = resolveInside(root, `${OUTPUT_ROOT}/${compilationRunId}`);
  const futureOutput = resolveInside(root, `.runtime/ai-painter/stage4-direct-clean-latent-controlled-smokes/${reservedSmokeRunId}`);
  assert.equal(fs.existsSync(outputRoot), false, "Smoke contract compilation output already exists");
  assert.equal(fs.existsSync(futureOutput), false, "reserved Smoke output already exists");
  fs.mkdirSync(path.dirname(outputRoot), { recursive: true });
  fs.mkdirSync(outputRoot, { recursive: false });
  const files = {
    contract: path.join(outputRoot, "controlled-smoke-contract.json"),
    cpu: path.join(outputRoot, "cpu-report.json"),
    isolation: path.join(outputRoot, "evidence-isolation-audit.json"),
    nextAction: path.join(outputRoot, "local-next-action.json"),
    terminal: path.join(outputRoot, "phase-terminal.json"),
    capsule: path.join(outputRoot, "local-task-capsule.json"),
    plan: path.join(outputRoot, "plan-sync-record.json"),
  };
  const sourceEvidence = [
    evidence(root, `${GPU_ROOT}/phase-terminal.json`, "readonly-gpu-terminal"),
    evidence(root, `${GPU_ROOT}/diagnostic-output/gpu-report.json`, "readonly-gpu-report"),
    evidence(root, `${GPU_ROOT}/diagnostic-output/cuda-telemetry.json`, "cuda-telemetry"),
    evidence(root, `${GPU_ROOT}/inactive-config.json`, "qualified-inactive-config"),
    evidence(root, `${CPU_ROOT}/phase-terminal.json`, "cpu-support-terminal"),
    evidence(root, SOURCE_INDEX, "source-index"),
    evidence(root, AUTOENCODER, "frozen-autoencoder"),
    evidence(root, "scripts/run-ai-painter-stage4-post-decode-full-condition-responsibility-controlled-smoke.mjs", "machine-review-program"),
    evidence(root, "scripts/lib/ai-assisted-professional-aesthetic.mjs", "professional-aesthetic-program"),
    evidence(root, "scripts/lib/ai-assisted-condition-alignment.mjs", "condition-alignment-program"),
  ];
  assert.equal(sourceEvidence[0].sha256, current.registry.terminalEvidence.sha256);
  assert.equal(sourceEvidence[5].sha256, "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251");
  assert.equal(sourceEvidence[6].sha256, "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba");

  const checker = resolveExisting(root, "scripts/check-ai-painter-stage4-direct-clean-latent-smoke-contract.mjs");
  const checkerOutput = execFileSync(process.execPath, [checker], { cwd: root, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  const checkerResult = JSON.parse(checkerOutput);
  assert.equal(checkerResult.status, "stage4_direct_clean_latent_smoke_contract_cpu_passed");
  assert.equal(Object.values(checkerResult.positiveChecks).every(Boolean), true);
  assert.equal(Object.values(checkerResult.negativeChecks).every(Boolean), true);
  const contract = buildDirectCleanLatentControlledSmokeContract({ compilationRunId, reservedSmokeRunId, sourceEvidence });
  validateDirectCleanLatentControlledSmokeContract(contract);
  writeJsonAtomic(files.contract, contract);
  writeJsonAtomic(files.cpu, {
    schemaVersion: "stage4-direct-clean-latent-smoke-contract-cpu-report-v1",
    status: "passed",
    positiveChecks: checkerResult.positiveChecks,
    negativeChecks: checkerResult.negativeChecks,
    executionIdentity: contract.executionIdentity,
    sourceEvidenceRecomputed: true,
    reservedOutputDirectoryAbsent: true,
    gpuStarted: false,
    optimizerCreated: false,
    backwardExecuted: false,
    trainingStarted: false,
    recordedAtUtc,
  });
  writeJsonAtomic(files.isolation, {
    schemaVersion: "stage4-direct-clean-latent-smoke-evidence-isolation-audit-v1",
    status: "passed",
    capabilityVersion: CAPABILITY_VERSION,
    compilationRunId,
    reservedSmokeRunId,
    reservedOutputDirectory: relative(root, futureOutput),
    reservedOutputDirectoryAbsent: true,
    sourceEvidence,
    historicalDenoiserAccepted: false,
    historicalCheckpointAccepted: false,
    failedCheckpointAccepted: false,
    historicalRunAccepted: false,
    partialTrainingArtifactAccepted: false,
    oldSmokeNamespaceUsed: false,
    recordedAtUtc,
  });
  writeJsonAtomic(files.nextAction, {
    schemaVersion: "stage4-local-autonomous-next-action-v1",
    status: "materialized_not_started",
    action: NEXT_TASK,
    capabilityVersion: CAPABILITY_VERSION,
    controlledSmokeContract: bind(root, files.contract),
    reservedSmokeRunId,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
  });
  writeJsonAtomic(files.terminal, {
    schemaVersion: "stage4-direct-clean-latent-smoke-contract-compilation-terminal-v1",
    executionState: "completed",
    status: "direct_clean_latent_controlled_smoke_contract_compiled",
    compilationRunId,
    reservedSmokeRunId,
    capabilityVersion: CAPABILITY_VERSION,
    contract: bind(root, files.contract),
    cpuReport: bind(root, files.cpu),
    evidenceIsolationAudit: bind(root, files.isolation),
    nextAction: bind(root, files.nextAction),
    lifecycleState: bind(root, lifecyclePath),
    fixedTotalProgress: progress(),
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    gpuStarted: false,
    optimizerCreated: false,
    backwardExecuted: false,
    trainingStarted: false,
    recordedAtUtc,
  });
  synchronizePlan(root, files, recordedAtUtc);
  writeJsonAtomic(files.capsule, taskCapsule(root, files, compilationRunId, reservedSmokeRunId, recordedAtUtc));
  for (const file of Object.values(files)) index(file, root, compilationRunId);
  const registry = await advanceCurrentExecutionRegistry({
    projectRoot: root,
    capabilityVersion: CAPABILITY_VERSION,
    packageId: compilationRunId,
    taskId: NEXT_TASK,
    taskKind: "implementation",
    runId: compilationRunId,
    lifecycleStage: lifecycle.state,
    executionState: "completed",
    activity: "planned_not_started",
    taskCapsulePath: relative(root, files.capsule),
    terminalEvidencePath: relative(root, files.terminal),
  });
  assert.equal(registry.ok, true, `registry advance failed: ${registry.errorCode}`);
  appendAiPainterProgramEvent({
    id: `stage4-direct-clean-latent-smoke-contract-${compilationRunId}`,
    timestamp: recordedAtUtc,
    action: "stage4_direct_clean_latent_controlled_smoke_contract_compiled",
    runId: compilationRunId,
    kind: "cpu_contract_compilation",
    status: "success",
    title: "Direct clean-latent controlled Smoke contract compiled",
    titleZh: "Stage4直接干净潜变量受控Smoke合同编译通过",
    detailZh: "样本194、30 Epoch、自动审核、后期稳定资格和失败关闭边界已冻结；未启动GPU或训练。",
    evidencePath: relative(root, files.terminal),
    evidenceSha256: sha256File(files.terminal),
    fixedTotalProgress: progress(),
  });
  return {
    status: "direct_clean_latent_controlled_smoke_contract_compiled",
    contract: bind(root, files.contract),
    cpuReport: bind(root, files.cpu),
    evidenceIsolationAudit: bind(root, files.isolation),
    terminal: bind(root, files.terminal),
    reservedSmokeRunId,
    nextAction: NEXT_TASK,
    currentRegistryRevision: registry.registry.registryRevision,
    currentRegistrySha256: registry.registrySha256,
    fixedTotalProgress: progress(),
    ownerAuthorizationRequired: false,
    trainingStarted: false,
  };
}

function taskCapsule(root, files, compilationRunId, reservedSmokeRunId, recordedAtUtc) {
  const evidenceFiles = [files.terminal, files.contract, files.cpu, files.isolation, files.nextAction, files.plan];
  return {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${compilationRunId}`,
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: { ...progress(), source: "current_execution_registry" },
    currentStage: { number: 4, total: 5, labelZh: "Stage4直接干净潜变量受控Smoke合同", status: "contract_compiled" },
    candidateTerminal: {
      runId: compilationRunId,
      status: "completed",
      programStatus: "direct_clean_latent_controlled_smoke_contract_compiled",
      previewMachineStatus: "not_run_contract_compilation_only",
      modelQualificationStatus: "readonly_gpu_qualified_smoke_not_started",
      checkpointWritten: false,
      modelWeightsModified: false,
      recordedAtUtc,
      recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
    },
    latestBlocker: { code: "smoke_training_path_not_implemented", summaryZh: "合同已编译，训练器直接干净潜变量路径尚未完成CPU预检。" },
    nextAllowedAction: { code: NEXT_TASK, labelZh: "实现并CPU验证受控Smoke训练路径", ownerAuthorizationRequired: false, automaticExecutionAllowed: true, planEvidenceConfirmed: true },
    taskIdentity: { architecture: "stage4_direct_condition_clean_latent_generator_v1", reservedSmokeRunId, sampleId: "194", sampleSplit: "validation", seed: 20263722, requiredBoundarySides: ["west"] },
    forbiddenActions: ["reuse_old_smoke", "read_historical_denoiser_checkpoint", "start_training_before_cpu_preflight", "change_loss_data_or_threshold", "automatic_retry"],
    evidence: evidenceFiles.map((file) => ({ kind: path.basename(file), labelZh: path.basename(file), ...bind(root, file), expectedSha256: sha256File(file), sha256Verified: true, recordedAtUtc, recordedAtAsiaShanghai: formatShanghai(recordedAtUtc) })),
    integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true, migrationRegistryStatus: "current_execution_registry_active" },
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
  };
}

function synchronizePlan(root, files, recordedAtUtc) {
  const plan = resolveExisting(root, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md");
  const beforeSha256 = sha256File(plan);
  let value = fs.readFileSync(plan, "utf8");
  value = value.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(recordedAtUtc).replace("T", " ").replace("+08:00", " +08:00")}`);
  value = value.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4直接条件→干净潜变量30 Epoch受控Smoke合同已编译；训练尚未启动");
  value = value.replace(/^\| 2 \|[^\n]*$/m, "| 2 | AI Painter R5 / Stage4 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标 | 固定进度3/5（60%）；直接条件→干净潜变量候选已通过CPU与只读GPU资格，唯一30 Epoch受控Smoke合同和新证据命名空间已编译；训练尚未启动 | 下一步完成训练器直接干净潜变量路径接线、CPU正反回归和真实只读预检；全部通过后由本地程序执行一次受控Smoke及自动审核 |" );
  const start = value.indexOf("## 5. 当前阻断与后续实施顺序");
  const end = value.indexOf("## 6. 完成条件与固定边界");
  assert.ok(start >= 0 && end > start, "AI Painter plan section missing");
  const replacement = "## 5. 当前阻断与后续实施顺序\n\n当前无活动训练。`stage4_direct_condition_clean_latent_generator_v1`已完成CPU实现、只读GPU资格及唯一30 Epoch受控Smoke合同编译。合同固定validation样本194、种子20263722、west拓扑、256×192、Epoch 1/5/10/20/30预览、自动机器审核和后期稳定资格；旧Smoke、历史Denoiser、失败Checkpoint、旧runId和部分训练产物均禁止作为输入。\n\n下一步只允许实现训练器直接干净潜变量路径，并执行CPU正反回归、活动配置审计和真实Node→Trainer只读预检。全部通过后，本地程序才可原子签发一次性内部票据并启动合同绑定的新Smoke。\n\n";
  value = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
  writeTextAtomic(plan, value);
  writeJsonAtomic(files.plan, { schemaVersion: "stage4-direct-clean-latent-smoke-contract-plan-sync-v1", status: "synchronized", planPath: relative(root, plan), beforeSha256, afterSha256: sha256File(plan), terminal: bind(root, files.terminal), recordedAtUtc });
}

function evidence(root, relativePath, role) { const file = resolveExisting(root, relativePath); return { role, ...bind(root, file) }; }
function resolveExisting(root, value) { const file = resolveInside(root, value); assert.ok(fs.existsSync(file) && fs.statSync(file).isFile(), `file missing: ${value}`); return file; }
function resolveInside(root, value) { assert.ok(typeof value === "string" && value && !path.isAbsolute(value) && !/^[A-Za-z]:[\\/]/.test(value) && !value.split(/[\\/]/).includes(".."), "project-relative path required"); const base = path.resolve(root); const file = path.resolve(base, value); assert.ok(file.startsWith(`${base}${path.sep}`), "path escapes project root"); return file; }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function relative(root, file) { return path.relative(path.resolve(root), file).replaceAll("\\", "/"); }
function sha256File(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function bind(root, file) { return { path: relative(root, file), sha256: sha256File(file) }; }
function writeTextAtomic(file, value) { const temporary = `${file}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(temporary, value, "utf8"); fs.renameSync(temporary, file); }
function progress() { return { completedStages: 3, totalStages: 5, percent: 60 }; }
function index(file, root, runId) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, artifactType: "stage4_direct_clean_latent_smoke_contract_v1", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha256File(file) }); }
