import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { advanceCapabilityLifecycle } from "./ai-painter-capability-lifecycle-v1.mjs";
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
import { DIRECT_CLEAN_LATENT_CAPABILITY_VERSION } from "./ai-painter-stage4-direct-clean-latent-architecture-derivation-v1.mjs";

const ARCHITECTURE = "stage4_direct_condition_clean_latent_generator_v1";
const EXPECTED_TASK = "implement_direct_condition_clean_latent_cpu_inactive_support";
const NEXT_TASK = "run_direct_condition_clean_latent_readonly_gpu_qualification";
const OUTPUT_ROOT = ".runtime/ai-painter/stage4-direct-clean-latent-cpu-support";
const SOURCE_CONFIG = ".runtime/ai-painter/stage4-post-decode-full-condition-responsibility-formal-stage0/stage4-post-decode-full-condition-responsibility-stage0-2026082603/active-config.json";

export async function materializeDirectCleanLatentCpuSupport({
  root = process.cwd(),
  runId,
  recordedAtUtc = new Date().toISOString(),
} = {}) {
  assert.match(runId ?? "", /^[a-z0-9][a-z0-9-]{7,127}$/);
  const current = await readCurrentExecutionRegistry(root);
  assert.equal(current.ok, true, `current registry invalid: ${current.errorCode}`);
  assert.equal(current.registry.capabilityVersion, DIRECT_CLEAN_LATENT_CAPABILITY_VERSION);
  assert.equal(current.registry.taskId, EXPECTED_TASK);
  assert.equal(current.registry.activity, "planned_not_started");
  assert.equal(current.registry.lifecycleStage, "change_candidate");
  assert.equal(current.registry.activeExecution, null);

  const outputRoot = resolveInside(root, `${OUTPUT_ROOT}/${runId}`);
  assert.equal(fs.existsSync(outputRoot), false, "CPU support output already exists");
  fs.mkdirSync(path.dirname(outputRoot), { recursive: true });
  fs.mkdirSync(outputRoot, { recursive: false });
  const files = {
    config: path.join(outputRoot, "inactive-config.json"),
    support: path.join(outputRoot, "model-structure-support-contract.json"),
    parameters: path.join(outputRoot, "parameter-structure-report.json"),
    cpu: path.join(outputRoot, "cpu-report.json"),
    terminal: path.join(outputRoot, "phase-terminal.json"),
    capsule: path.join(outputRoot, "local-task-capsule.json"),
    plan: path.join(outputRoot, "plan-sync-record.json"),
  };
  const python = projectPython(root);
  const sourceConfig = resolveExisting(root, SOURCE_CONFIG);
  const compiler = resolveExisting(root, "ml/ai-painter/scripts/compile_stage4_direct_clean_latent_cpu_config.py");
  const checker = resolveExisting(root, "ml/ai-painter/scripts/check_stage4_direct_clean_latent_cpu.py");
  const contract = resolveExisting(root, "ml/ai-painter/scripts/ai_painter_direct_clean_latent_contract.py");
  const model = resolveExisting(root, "ml/ai-painter/src/ai_painter/complete_world/model.py");
  const modeRegistry = resolveExisting(root, "ml/ai-painter/scripts/ai_painter_stage_mode_registry.py");
  const compilerOutput = execFileSync(python, [compiler, "--source", sourceConfig, "--output", files.config], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  const compilerResult = parseJsonOutput(compilerOutput);
  assert.equal(compilerResult.status, "direct_clean_latent_cpu_inactive_config_compiled");
  const checkerOutput = execFileSync(python, [checker], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const checkerResult = parseJsonOutput(checkerOutput);
  assert.equal(checkerResult.status, "stage4_direct_clean_latent_cpu_support_passed");
  assert.deepEqual(checkerResult.inputShape, [1, 23, 192, 256]);
  assert.deepEqual(checkerResult.outputShape, [1, 12, 48, 64]);
  assert.deepEqual(checkerResult.decodedRgbShape, [1, 3, 192, 256]);
  assert.equal(checkerResult.modelStateUnchanged, true);
  assert.equal(checkerResult.autoencoderFrozen, true);
  assert.equal(checkerResult.gpuStarted, false);
  assert.equal(checkerResult.trainingStarted, false);

  writeJsonAtomic(files.support, {
    schemaVersion: "stage4-direct-clean-latent-model-structure-support-contract-v1",
    status: "cpu_supported_inactive",
    capabilityVersion: DIRECT_CLEAN_LATENT_CAPABILITY_VERSION,
    architecture: ARCHITECTURE,
    input: { identity: "formal_typed_conditions", channels: 23 },
    output: { identity: "predicted_clean_autoencoder_latent", channels: 12 },
    widths: [64, 128, 256],
    spatialBoundary: { autoencoderDownsampleFactor: 4 },
    publicEntry: "predict_clean_latent(conditions)",
    forbiddenPublicInputs: ["random_noisy_latent", "diffusion_timestep"],
    forbiddenParameterIdentities: ["latent_stem", "time_embedding", "time_mlp", "velocity_output"],
    retainedSupervision: "all_existing_non_diffusion_clean_latent_decoded_rgb_and_semantic_terms",
    removedInapplicableTerms: ["velocity", "velocityPredictionMse"],
    newLossTermAdded: false,
    freeArchitectureParameterChosen: false,
    activationGate: false,
    ownerAuthorizationRequired: false,
    recordedAtUtc,
  });
  writeJsonAtomic(files.parameters, {
    schemaVersion: "stage4-direct-clean-latent-parameter-structure-report-v1",
    status: "passed",
    architecture: ARCHITECTURE,
    parameterTensorCount: checkerResult.parameterTensorCount,
    parameterCount: checkerResult.parameterCount,
    derivedWidths: [64, 128, 256],
    allFormalParametersGradientReachable: true,
    allFormalParameterGradientsFiniteNonZero: true,
    diffusionParameterIdentityPresent: false,
    autoencoderFrozen: true,
    modelStateUnchanged: true,
    recordedAtUtc,
  });
  writeJsonAtomic(files.cpu, {
    schemaVersion: "stage4-direct-clean-latent-cpu-support-report-v1",
    status: "passed",
    capabilityVersion: DIRECT_CLEAN_LATENT_CAPABILITY_VERSION,
    architecture: ARCHITECTURE,
    positiveChecks: checkerResult.positiveChecks,
    negativeChecks: checkerResult.negativeChecks,
    inputShape: checkerResult.inputShape,
    outputShape: checkerResult.outputShape,
    decodedRgbShape: checkerResult.decodedRgbShape,
    modelStateUnchanged: true,
    autoencoderFrozen: true,
    historicalCheckpointRead: false,
    optimizerCreated: false,
    backwardExecuted: false,
    cudaInitialized: false,
    gpuStarted: false,
    trainingStarted: false,
    sourceBindings: [model, modeRegistry, contract, compiler, checker, sourceConfig].map((file) => bind(root, file)),
    recordedAtUtc,
  });

  const implementationEvidence = lifecycleEvidence("isolated_implementation", [
    bind(root, files.config),
    bind(root, files.support),
    bind(root, model),
    bind(root, modeRegistry),
    bind(root, contract),
  ]);
  advanceCapabilityLifecycle({
    root,
    capabilityVersion: DIRECT_CLEAN_LATENT_CAPABILITY_VERSION,
    targetState: "isolated_implementation",
    evidence: implementationEvidence,
    recordedAtUtc,
  });
  const cpuEvidence = lifecycleEvidence("cpu_contract_verified", [
    bind(root, files.cpu),
    bind(root, files.parameters),
    bind(root, files.config),
    bind(root, checker),
  ]);
  const lifecycleState = advanceCapabilityLifecycle({
    root,
    capabilityVersion: DIRECT_CLEAN_LATENT_CAPABILITY_VERSION,
    targetState: "cpu_contract_verified",
    evidence: cpuEvidence,
    recordedAtUtc,
  });
  const lifecycleStatePath = resolveExisting(root, `.runtime/ai-painter/capability-lifecycle/${DIRECT_CLEAN_LATENT_CAPABILITY_VERSION}/state.json`);
  writeJsonAtomic(files.terminal, {
    schemaVersion: "stage4-direct-clean-latent-cpu-support-terminal-v1",
    executionState: "completed",
    status: "direct_clean_latent_cpu_support_verified_inactive",
    runId,
    capabilityVersion: DIRECT_CLEAN_LATENT_CAPABILITY_VERSION,
    architecture: ARCHITECTURE,
    inactiveConfig: bind(root, files.config),
    supportContract: bind(root, files.support),
    parameterReport: bind(root, files.parameters),
    cpuReport: bind(root, files.cpu),
    lifecycleState: bind(root, lifecycleStatePath),
    nextAction: NEXT_TASK,
    fixedTotalProgress: progress(),
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    historicalCheckpointRead: false,
    optimizerCreated: false,
    backwardExecuted: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  });
  synchronizePlan(root, files, recordedAtUtc);
  writeJsonAtomic(files.capsule, currentTaskCapsule(root, runId, files, recordedAtUtc));
  for (const file of Object.values(files)) index(file, root, runId);
  index(lifecycleStatePath, root, runId);
  const registry = await advanceCurrentExecutionRegistry({
    projectRoot: root,
    capabilityVersion: DIRECT_CLEAN_LATENT_CAPABILITY_VERSION,
    packageId: runId,
    taskId: NEXT_TASK,
    taskKind: "readonly_gpu_qualification",
    runId,
    lifecycleStage: lifecycleState.state,
    executionState: "completed",
    activity: "planned_not_started",
    taskCapsulePath: relative(root, files.capsule),
    terminalEvidencePath: relative(root, files.terminal),
  });
  assert.equal(registry.ok, true, `registry advance failed: ${registry.errorCode}`);
  assert.equal(registry.registry.latestTrainingTerminal.runId, "stage4-post-decode-full-condition-responsibility-stage0-2026082603");
  appendAiPainterProgramEvent({
    id: `stage4-direct-clean-latent-cpu-support-${runId}`,
    timestamp: recordedAtUtc,
    action: "stage4_direct_clean_latent_cpu_support_verified",
    runId,
    kind: "local_autonomous_capability_implementation",
    status: "success",
    title: "Direct clean-latent CPU support verified",
    titleZh: "Stage4直接干净潜变量模型CPU未激活支持验证通过",
    detailZh: "模型、配置、Mode Registry、参数与梯度合同通过；未读取历史Checkpoint，未启动GPU或训练。",
    evidencePath: relative(root, files.terminal),
    evidenceSha256: sha256File(files.terminal),
    fixedTotalProgress: progress(),
  });
  return {
    status: "direct_clean_latent_cpu_support_verified_inactive",
    lifecycleState: lifecycleState.state,
    terminal: bind(root, files.terminal),
    inactiveConfig: bind(root, files.config),
    supportContract: bind(root, files.support),
    cpuReport: bind(root, files.cpu),
    currentRegistryRevision: registry.registry.registryRevision,
    currentRegistrySha256: registry.registrySha256,
    nextAction: NEXT_TASK,
    fixedTotalProgress: progress(),
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
  };
}

function currentTaskCapsule(root, runId, files, recordedAtUtc) {
  const evidence = [
    bind(root, files.terminal, "cpu-support-terminal"),
    bind(root, files.config, "inactive-config"),
    bind(root, files.support, "model-support-contract"),
    bind(root, files.parameters, "parameter-structure-report"),
    bind(root, files.cpu, "cpu-report"),
    bind(root, files.plan, "module-plan-sync"),
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
  return {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${runId}`,
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: { ...progress(), source: "current_execution_registry" },
    currentStage: { number: 4, total: 5, labelZh: "Stage4直接干净潜变量CPU支持", status: "cpu_contract_verified" },
    candidateTerminal: {
      runId,
      status: "completed",
      programStatus: "direct_clean_latent_cpu_support_verified_inactive",
      previewMachineStatus: "not_run_cpu_support_only",
      modelQualificationStatus: "readonly_gpu_qualification_pending",
      checkpointWritten: false,
      modelWeightsModified: false,
      recordedAtUtc,
      recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
    },
    latestBlocker: { code: "readonly_gpu_qualification_not_executed", summaryZh: "CPU支持已通过，尚未执行独立只读GPU资格。" },
    nextAllowedAction: { code: NEXT_TASK, labelZh: "执行独立只读GPU前向与梯度资格", ownerAuthorizationRequired: false, automaticExecutionAllowed: true, planEvidenceConfirmed: true },
    forbiddenActions: ["read_historical_checkpoint", "create_optimizer", "execute_backward", "modify_weights", "start_smoke", "start_training_before_gpu_qualification"],
    evidence,
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
  value = value.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4直接条件→干净潜变量模型CPU未激活支持通过；GPU未启动、训练未运行");
  const row = /^\| 2 \|[^\n]*$/m;
  assert.ok(row.test(value), "AI Painter module plan row missing");
  value = value.replace(row, "| 2 | AI Painter R5 / Stage4 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标 | 固定进度3/5（60%）；直接条件→干净潜变量新模型家族已完成CPU未激活实现，23→12输出、参数梯度、Autoencoder冻结及旧路线隔离均通过；GPU未启动、训练未运行 | 下一步仅执行独立只读GPU资格；资格通过后编译受控Smoke，Smoke通过后才允许新的Stage 0 | ");
  const start = value.indexOf("## 5. 当前阻断与后续实施顺序");
  const end = value.indexOf("## 6. 完成条件与固定边界");
  assert.ok(start >= 0 && end > start, "AI Painter plan section missing");
  const replacement = `## 5. 当前阻断与后续实施顺序\n\n当前无活动训练。\`stage4_direct_condition_clean_latent_generator_v1\`已完成隔离CPU实现：23通道条件单次前向形成12通道干净潜变量，并使用同一冻结Autoencoder解码。模型不存在噪声潜变量输入、扩散时间步、时间嵌入、速度预测或50步采样；结构宽度严格为既有64/128/256，未新增Loss项。\n\nCPU正反合同、参数形状、全参数梯度可达性、Mode Registry及旧路线隔离已通过。下一步只允许独立只读GPU资格；不得读取历史Checkpoint、创建优化器、执行.backward()、修改权重、启动Smoke或训练。\n\n`;
  value = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
  writeTextAtomic(plan, value);
  writeJsonAtomic(files.plan, {
    schemaVersion: "stage4-direct-clean-latent-cpu-support-plan-sync-v1",
    status: "synchronized",
    planPath: relative(root, plan),
    beforeSha256,
    afterSha256: sha256File(plan),
    terminal: bind(root, files.terminal),
    recordedAtUtc,
  });
}

function lifecycleEvidence(targetState, bindings) {
  return {
    schemaVersion: "ai-painter-capability-stage-evidence-v1",
    capabilityVersion: DIRECT_CLEAN_LATENT_CAPABILITY_VERSION,
    targetState,
    status: "passed",
    bindings,
  };
}
function projectPython(root) {
  const values = process.platform === "win32"
    ? ["ml/ai-painter/.venv/Scripts/python.exe"]
    : ["ml/ai-painter/.venv/bin/python"];
  for (const value of values) {
    const candidate = resolveInside(root, value);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  throw new Error("project Python runtime is missing");
}
function parseJsonOutput(value) {
  const start = value.indexOf("{");
  assert.ok(start >= 0, "program JSON output missing");
  return JSON.parse(value.slice(start));
}
function resolveExisting(root, value) { const absolute = resolveInside(root, value); assert.ok(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), `file missing: ${value}`); return absolute; }
function resolveInside(root, value) { assert.ok(typeof value === "string" && value && !path.isAbsolute(value) && !/^[A-Za-z]:[\\/]/.test(value) && !value.split(/[\\/]/).includes(".."), "project-relative path required"); const base = path.resolve(root); const absolute = path.resolve(base, value); assert.ok(absolute.startsWith(`${base}${path.sep}`), "path escapes project root"); return absolute; }
function relative(root, file) { return path.relative(path.resolve(root), file).replaceAll("\\", "/"); }
function sha256File(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function bind(root, file, role = undefined) { return { ...(role === undefined ? {} : { role }), path: relative(root, file), sha256: sha256File(file) }; }
function writeTextAtomic(file, value) { const temporary = `${file}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(temporary, value, "utf8"); fs.renameSync(temporary, file); }
function progress() { return { completedStages: 3, totalStages: 5, percent: 60 }; }
function index(file, root, runId) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, artifactType: "stage4_direct_clean_latent_cpu_support_v1", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha256File(file) }); }
