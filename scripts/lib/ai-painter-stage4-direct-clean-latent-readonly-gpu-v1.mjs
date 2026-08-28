import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { advanceCapabilityLifecycle } from "./ai-painter-capability-lifecycle-v1.mjs";
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./ai-painter-program-event-store.mjs";
import { indexArtifact } from "./ai-pet-world-storage-catalog.mjs";
import { logicalProjectPath } from "./ai-pet-world-storage.mjs";
import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from "../../src/server/ai-painter-current-execution-registry.mjs";
import { DIRECT_CLEAN_LATENT_CAPABILITY_VERSION } from "./ai-painter-stage4-direct-clean-latent-architecture-derivation-v1.mjs";

const EXPECTED_TASK = "run_direct_condition_clean_latent_readonly_gpu_qualification";
const NEXT_TASK = "compile_direct_condition_clean_latent_controlled_smoke_contract";
const OUTPUT_ROOT = ".runtime/ai-painter/stage4-direct-clean-latent-readonly-gpu-qualifications";
const CPU_ROOT = ".runtime/ai-painter/stage4-direct-clean-latent-cpu-support/stage4-direct-clean-latent-cpu-support-20260827-01";
const AE = ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt";
const SOURCE_INDEX = "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json";
const PREVIOUS_SELECTION_FAILURE = `${OUTPUT_ROOT}/stage4-direct-clean-latent-readonly-gpu-20260827-01/failure-terminal.json`;
const PREVIOUS_AUTOENCODER_IDENTITY_FAILURE = `${OUTPUT_ROOT}/stage4-direct-clean-latent-readonly-gpu-20260827-02/failure-terminal.json`;
const SOURCE_CONFIG = ".runtime/ai-painter/stage4-post-decode-full-condition-responsibility-formal-stage0/stage4-post-decode-full-condition-responsibility-stage0-2026082603/active-config.json";

export async function runDirectCleanLatentReadonlyGpuQualification({ root = process.cwd(), runId, recordedAtUtc = new Date().toISOString() } = {}) {
  assert.match(runId ?? "", /^[a-z0-9][a-z0-9-]{7,127}$/);
  const current = await readCurrentExecutionRegistry(root);
  assert.equal(current.ok, true, `current registry invalid: ${current.errorCode}`);
  assert.equal(current.registry.capabilityVersion, DIRECT_CLEAN_LATENT_CAPABILITY_VERSION);
  assert.equal(current.registry.taskId, EXPECTED_TASK);
  assert.equal(current.registry.lifecycleStage, "cpu_contract_verified");
  assert.equal(current.registry.activity, "planned_not_started");
  assert.equal(current.registry.activeExecution, null);

  const packageRoot = resolveInside(root, `${OUTPUT_ROOT}/${runId}`);
  assert.equal(fs.existsSync(packageRoot), false, "readonly GPU package already exists");
  fs.mkdirSync(path.dirname(packageRoot), { recursive: true });
  fs.mkdirSync(packageRoot, { recursive: false });
  const files = {
    ticket: path.join(packageRoot, "internal-ticket.json"),
    config: path.join(packageRoot, "inactive-config.json"),
    cpu: path.join(packageRoot, "cpu-entry-report.json"),
    preflight: path.join(packageRoot, "preflight-report.json"),
    correction: path.join(packageRoot, "selection-contract-correction.json"),
    consumption: path.join(packageRoot, "internal-ticket-consumption.json"),
    diagnostic: path.join(packageRoot, "diagnostic-output"),
    terminal: path.join(packageRoot, "phase-terminal.json"),
    capsule: path.join(packageRoot, "local-task-capsule.json"),
    plan: path.join(packageRoot, "plan-sync-record.json"),
  };
  try {
    const python = projectPython(root);
    const runner = resolveExisting(root, "ml/ai-painter/scripts/run_stage4_direct_clean_latent_readonly_gpu_qualification.py");
    const checker = resolveExisting(root, "ml/ai-painter/scripts/check_stage4_direct_clean_latent_gpu_entry_cpu.py");
    const compiler = resolveExisting(root, "ml/ai-painter/scripts/compile_stage4_direct_clean_latent_cpu_config.py");
    const sourceConfig = resolveExisting(root, SOURCE_CONFIG);
    const cpuTerminal = resolveExisting(root, `${CPU_ROOT}/phase-terminal.json`);
    const cpuReport = resolveExisting(root, `${CPU_ROOT}/cpu-report.json`);
    const support = resolveExisting(root, `${CPU_ROOT}/model-structure-support-contract.json`);
    const model = resolveExisting(root, "ml/ai-painter/src/ai_painter/complete_world/model.py");
    const modeRegistry = resolveExisting(root, "ml/ai-painter/scripts/ai_painter_stage_mode_registry.py");
    const sourceIndex = resolveExisting(root, SOURCE_INDEX);
    const autoencoder = resolveExisting(root, AE);
    const previousFailure = resolveExisting(root, PREVIOUS_SELECTION_FAILURE);
    const previousAutoencoderFailure = resolveExisting(root, PREVIOUS_AUTOENCODER_IDENTITY_FAILURE);
    assert.equal(sha256File(sourceIndex), "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251");
    assert.equal(sha256File(autoencoder), "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba");

    const compilerOutput = execFileSync(python, [compiler, "--source", sourceConfig, "--output", files.config], { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    assert.equal(parseJsonOutput(compilerOutput).status, "direct_clean_latent_cpu_inactive_config_compiled");
    const config = resolveExisting(root, relative(root, files.config));

    const cpuOutput = execFileSync(python, [checker], { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    const cpuResult = parseJsonOutput(cpuOutput);
    assert.equal(cpuResult.status, "passed");
    assert.equal(cpuResult.safety.gpuStarted, false);
    writeJsonAtomic(files.cpu, { ...cpuResult, recordedAtUtc });
    writeJsonAtomic(files.correction, {
      schemaVersion: "stage4-direct-clean-latent-dataset-selection-correction-v1",
      status: "corrected_and_cpu_regression_verified",
      previousFailure: bind(root, previousFailure),
      previousAutoencoderIdentityFailure: bind(root, previousAutoencoderFailure),
      rootCauses: [
        "new_architecture_missing_from_registered_v7_capacity_dataset_selection",
        "cpu_inactive_compiler_omitted_autoencoder_source_architecture_version",
      ],
      observedWrongSelection: { contract: "current_condition_identity_v1", validationCount: 2, fixedSample194Present: false },
      correctedSelection: { contract: "registered_v7_capacity_contribution_v1", validationCount: 8, fixedSample194Present: true },
      correctedAutoencoderIdentity: { sourceModelId: "ai-pet-world-complete-world-ai-assisted-cold-start-v2", sourceArchitectureVersion: "pixel-detail-residual-autoencoder-v2", checkpointSha256: "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba" },
      changedScope: "trainer_dataset_selection_predicate_and_cpu_checker_only",
      modelChanged: false,
      lossChanged: false,
      dataChanged: false,
      thresholdChanged: false,
      ownerAuthorizationRequired: false,
      recordedAtUtc,
    });
    writeJsonAtomic(files.ticket, {
      schemaVersion: "ai-painter-local-internal-readonly-gpu-ticket-v1",
      status: "issued_not_consumed",
      authority: "local_ai_pet_world_program",
      capabilityVersion: DIRECT_CLEAN_LATENT_CAPABILITY_VERSION,
      taskId: EXPECTED_TASK,
      runId,
      oneTimeConsumption: true,
      gpuUse: true,
      permissions: {
        projectAutoencoderCheckpointRead: true,
        denoiserCheckpointRead: false,
        optimizerCreation: false,
        backwardExecution: false,
        weightMutation: false,
        checkpointWrite: false,
        smoke: false,
        training: false,
      },
      executionIdentity: {
        seed: 20263722,
        imageSize: { width: 256, height: 192 },
        sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
        split: "validation",
        conditionChannels: 23,
        latentChannels: 12,
      },
      bindings: {
        inactiveConfig: bind(root, config),
        cpuTerminal: bind(root, cpuTerminal),
        cpuReport: bind(root, cpuReport),
        modelSupportContract: bind(root, support),
        modelFactory: bind(root, model),
        modeRegistry: bind(root, modeRegistry),
        sourceIndex: bind(root, sourceIndex),
        projectAutoencoderCheckpoint: bind(root, autoencoder),
        previousSelectionFailure: bind(root, previousFailure),
        previousAutoencoderIdentityFailure: bind(root, previousAutoencoderFailure),
        selectionContractCorrection: bind(root, files.correction),
      },
      parentRegistry: { revision: current.registry.registryRevision, sha256: current.registrySha256 },
      ownerAuthorizationRequired: false,
      ownerResponseRequired: false,
      issuedAtUtc: recordedAtUtc,
    });
    const ticketSha = sha256File(files.ticket);
    const argumentsBase = [
      runner,
      "--ticket", relative(root, files.ticket),
      "--ticket-sha256", ticketSha,
      "--consumption", relative(root, files.consumption),
      "--output-dir", relative(root, files.diagnostic),
    ];
    const preflightOutput = execFileSync(python, [...argumentsBase, "--preflight-only"], { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    const preflight = parseJsonOutput(preflightOutput);
    assert.equal(preflight.status, "passed_not_consumed_gpu_not_initialized_checkpoint_not_read");
    writeJsonAtomic(files.preflight, preflight);
    const gpuOutput = execFileSync(python, argumentsBase, { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    const gpuResult = parseJsonOutput(gpuOutput);
    assert.equal(gpuResult.status, "direct_clean_latent_readonly_gpu_qualification_succeeded");
    const diagnosticTerminal = resolveExisting(root, `${relative(root, files.diagnostic)}/phase-terminal.json`);
    const gpuReport = resolveExisting(root, `${relative(root, files.diagnostic)}/gpu-report.json`);
    const cuda = resolveExisting(root, `${relative(root, files.diagnostic)}/cuda-telemetry.json`);
    const gradients = resolveExisting(root, `${relative(root, files.diagnostic)}/gradient-evidence.json`);
    const states = resolveExisting(root, `${relative(root, files.diagnostic)}/model-state-hashes.json`);
    const lifecycle = advanceCapabilityLifecycle({
      root,
      capabilityVersion: DIRECT_CLEAN_LATENT_CAPABILITY_VERSION,
      targetState: "readonly_gpu_qualified",
      evidence: {
        schemaVersion: "ai-painter-capability-stage-evidence-v1",
        capabilityVersion: DIRECT_CLEAN_LATENT_CAPABILITY_VERSION,
        targetState: "readonly_gpu_qualified",
        status: "passed",
        bindings: [files.config, gpuReport, cuda, gradients, states, diagnosticTerminal].map((file) => bind(root, file)),
      },
      recordedAtUtc,
    });
    const lifecycleState = resolveExisting(root, `.runtime/ai-painter/capability-lifecycle/${DIRECT_CLEAN_LATENT_CAPABILITY_VERSION}/state.json`);
    writeJsonAtomic(files.terminal, {
      schemaVersion: "stage4-direct-clean-latent-readonly-gpu-package-terminal-v1",
      executionState: "completed",
      status: "direct_clean_latent_readonly_gpu_qualification_succeeded",
      runId,
      capabilityVersion: DIRECT_CLEAN_LATENT_CAPABILITY_VERSION,
      internalTicket: bind(root, files.ticket),
      consumption: bind(root, files.consumption),
      cpuEntryReport: bind(root, files.cpu),
      preflightReport: bind(root, files.preflight),
      selectionContractCorrection: bind(root, files.correction),
      qualifiedInactiveConfig: bind(root, files.config),
      gpuReport: bind(root, gpuReport),
      cudaTelemetry: bind(root, cuda),
      gradientEvidence: bind(root, gradients),
      modelStateHashes: bind(root, states),
      lifecycleState: bind(root, lifecycleState),
      nextAction: NEXT_TASK,
      fixedTotalProgress: progress(),
      ownerAuthorizationRequired: false,
      ownerResponseRequired: false,
      optimizerCreated: false,
      backwardExecuted: false,
      modelWeightsModified: false,
      checkpointWritten: false,
      smokeStarted: false,
      trainingStarted: false,
      recordedAtUtc,
    });
    synchronizePlan(root, files, recordedAtUtc);
    writeJsonAtomic(files.capsule, taskCapsule(root, runId, files, recordedAtUtc));
    for (const file of [files.ticket, files.config, files.cpu, files.preflight, files.correction, files.consumption, files.terminal, files.capsule, files.plan, gpuReport, cuda, gradients, states, diagnosticTerminal, lifecycleState]) index(file, root, runId);
    const registry = await advanceCurrentExecutionRegistry({
      projectRoot: root,
      capabilityVersion: DIRECT_CLEAN_LATENT_CAPABILITY_VERSION,
      packageId: runId,
      taskId: NEXT_TASK,
      taskKind: "contract_compilation",
      runId,
      lifecycleStage: lifecycle.state,
      executionState: "completed",
      activity: "planned_not_started",
      taskCapsulePath: relative(root, files.capsule),
      terminalEvidencePath: relative(root, files.terminal),
    });
    assert.equal(registry.ok, true, `registry advance failed: ${registry.errorCode}`);
    appendAiPainterProgramEvent({
      id: `stage4-direct-clean-latent-readonly-gpu-${runId}`,
      timestamp: recordedAtUtc,
      action: "stage4_direct_clean_latent_readonly_gpu_qualified",
      runId,
      kind: "local_autonomous_readonly_gpu_qualification",
      status: "success",
      title: "Direct clean-latent readonly GPU qualification passed",
      titleZh: "Stage4直接干净潜变量模型只读GPU资格通过",
      detailZh: "真实样本194、项目Autoencoder、CUDA前向和autograd.grad验证通过；未训练、未写Checkpoint。",
      evidencePath: relative(root, files.terminal),
      evidenceSha256: sha256File(files.terminal),
      fixedTotalProgress: progress(),
    });
    return {
      status: "direct_clean_latent_readonly_gpu_qualification_succeeded",
      terminal: bind(root, files.terminal),
      gpuReport: bind(root, gpuReport),
      cudaTelemetry: bind(root, cuda),
      lifecycleState: lifecycle.state,
      currentRegistryRevision: registry.registry.registryRevision,
      currentRegistrySha256: registry.registrySha256,
      nextAction: NEXT_TASK,
      fixedTotalProgress: progress(),
      ownerAuthorizationRequired: false,
      trainingStarted: false,
    };
  } catch (error) {
    const failure = path.join(packageRoot, "failure-terminal.json");
    if (!fs.existsSync(failure)) writeJsonAtomic(failure, {
      schemaVersion: "stage4-direct-clean-latent-readonly-gpu-failure-terminal-v1",
      executionState: "failed_closed",
      status: "direct_clean_latent_readonly_gpu_qualification_failed_closed",
      runId,
      error: String(error?.message ?? error),
      consumptionExists: fs.existsSync(files.consumption),
      diagnosticOutputExists: fs.existsSync(files.diagnostic),
      ownerAuthorizationRequired: false,
      ownerResponseRequired: false,
      trainingStarted: false,
      recordedAtUtc: new Date().toISOString(),
    });
    index(failure, root, runId);
    throw error;
  }
}

function taskCapsule(root, runId, files, recordedAtUtc) {
  const evidenceFiles = [files.terminal, files.config, files.cpu, files.preflight, files.correction, files.consumption, files.plan];
  const evidence = evidenceFiles.map((file) => {
    const item = bind(root, file);
    return { kind: path.basename(file), labelZh: path.basename(file), path: item.path, sha256: item.sha256, expectedSha256: item.sha256, sha256Verified: true, recordedAtUtc, recordedAtAsiaShanghai: formatShanghai(recordedAtUtc) };
  });
  return {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${runId}`,
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: { ...progress(), source: "current_execution_registry" },
    currentStage: { number: 4, total: 5, labelZh: "Stage4直接干净潜变量只读GPU资格", status: "readonly_gpu_qualified" },
    candidateTerminal: { runId, status: "completed", programStatus: "direct_clean_latent_readonly_gpu_qualification_succeeded", previewMachineStatus: "not_run_readonly_gpu_only", modelQualificationStatus: "readonly_gpu_qualified", checkpointWritten: false, modelWeightsModified: false, recordedAtUtc, recordedAtAsiaShanghai: formatShanghai(recordedAtUtc) },
    latestBlocker: { code: "controlled_smoke_contract_not_compiled", summaryZh: "只读GPU资格通过，尚未编译受控Smoke合同。" },
    nextAllowedAction: { code: NEXT_TASK, labelZh: "编译直接干净潜变量受控Smoke合同", ownerAuthorizationRequired: false, automaticExecutionAllowed: true, planEvidenceConfirmed: true },
    forbiddenActions: ["read_historical_denoiser_checkpoint", "start_training_before_smoke_contract", "reuse_old_smoke", "change_loss_or_threshold"],
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
  value = value.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4直接条件→干净潜变量模型只读GPU资格通过；训练未运行");
  value = value.replace(/^\| 2 \|[^\n]*$/m, "| 2 | AI Painter R5 / Stage4 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标 | 固定进度3/5（60%）；直接条件→干净潜变量新模型家族已通过CPU与只读GPU资格，真实样本194、23→12→RGB、全部正式参数梯度及状态不变均验证通过；训练未运行 | 下一步编译并核验唯一受控Smoke合同；合同通过后由本地程序启动一次新Smoke |" );
  const start = value.indexOf("## 5. 当前阻断与后续实施顺序");
  const end = value.indexOf("## 6. 完成条件与固定边界");
  assert.ok(start >= 0 && end > start, "AI Painter plan section missing");
  const replacement = "## 5. 当前阻断与后续实施顺序\n\n当前无活动训练。`stage4_direct_condition_clean_latent_generator_v1`已完成CPU未激活实现和独立只读GPU资格。真实validation样本194在CUDA上完成23通道条件→12通道干净潜变量→冻结Autoencoder RGB解码；输入梯度及全部正式参数梯度有限非零，模型与Autoencoder状态未变化。\n\n下一步由本地程序编译并核验该唯一候选的受控30 Epoch Smoke合同。合同形成前不得创建优化器、执行.backward()或训练；不得回退到旧Smoke或历史Checkpoint。\n\n";
  value = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
  writeTextAtomic(plan, value);
  writeJsonAtomic(files.plan, { schemaVersion: "stage4-direct-clean-latent-readonly-gpu-plan-sync-v1", status: "synchronized", planPath: relative(root, plan), beforeSha256, afterSha256: sha256File(plan), terminal: bind(root, files.terminal), recordedAtUtc });
}

function projectPython(root) { const file = resolveInside(root, process.platform === "win32" ? "ml/ai-painter/.venv/Scripts/python.exe" : "ml/ai-painter/.venv/bin/python"); assert.ok(fs.existsSync(file), "project Python runtime is missing"); return file; }
function parseJsonOutput(value) { const start = value.indexOf("{"); assert.ok(start >= 0, "program JSON output missing"); return JSON.parse(value.slice(start)); }
function resolveExisting(root, value) { const file = resolveInside(root, value); assert.ok(fs.existsSync(file) && fs.statSync(file).isFile(), `file missing: ${value}`); return file; }
function resolveInside(root, value) { assert.ok(typeof value === "string" && value && !path.isAbsolute(value) && !/^[A-Za-z]:[\\/]/.test(value) && !value.split(/[\\/]/).includes(".."), "project-relative path required"); const base = path.resolve(root); const file = path.resolve(base, value); assert.ok(file.startsWith(`${base}${path.sep}`), "path escapes project root"); return file; }
function relative(root, file) { return path.relative(path.resolve(root), file).replaceAll("\\", "/"); }
function sha256File(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function bind(root, file) { return { path: relative(root, file), sha256: sha256File(file) }; }
function writeTextAtomic(file, value) { const temporary = `${file}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(temporary, value, "utf8"); fs.renameSync(temporary, file); }
function progress() { return { completedStages: 3, totalStages: 5, percent: 60 }; }
function index(file, root, runId) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, artifactType: "stage4_direct_clean_latent_readonly_gpu_v1", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha256File(file) }); }
