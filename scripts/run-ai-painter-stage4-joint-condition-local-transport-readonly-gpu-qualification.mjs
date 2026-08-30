import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  ensureAiPainterProgramEventCommitted,
  formatShanghai,
  projectPath,
  verifyAiPainterProgramEventCommitted,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { catalogPath, logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"
import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const CAPABILITY_VERSION = "stage4_full_backbone_joint_condition_local_transport_denoiser_v1"
const CURRENT_TASK = "qualify_stage4_joint_condition_local_transport_readonly_gpu"
const NEXT_LEGAL_ACTION = "compile_and_execute_stage4_joint_condition_local_transport_controlled_smoke"
const RUN_ID = `stage4-joint-condition-local-transport-readonly-gpu-${compactUtc()}-${crypto.randomUUID().slice(0, 8)}`
const OUTPUT_ROOT_RELATIVE = `.runtime/ai-painter/stage4-joint-condition-local-transport-readonly-gpu-qualifications/${RUN_ID}`
const TICKET_ROOT_RELATIVE = `.runtime/ai-painter/stage4-joint-condition-local-transport-readonly-gpu-tickets/${RUN_ID}`
const OUTPUT_ROOT = inside(OUTPUT_ROOT_RELATIVE)
const TICKET_ROOT = inside(TICKET_ROOT_RELATIVE)
const FAILURE_ROOT = inside(`.runtime/ai-painter/stage4-joint-condition-local-transport-readonly-gpu-failures/${RUN_ID}`)
const PLAN = inside("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const PYTHON = inside("ml/ai-painter/.venv/Scripts/python.exe")
const PYTHON_ENV = {
  ...process.env,
  PYTHONPATH: [
    inside("ml/ai-painter/src"),
    inside("ml/ai-painter/scripts"),
  ].join(path.delimiter),
}
const DATASET_PACKAGE_ID = "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z"
const MAX_PEAK_ALLOCATED_BYTES = 512 * 1024 * 1024
const MAX_PEAK_RESERVED_BYTES = 768 * 1024 * 1024
const MIN_FREE_GPU_BYTES = 4 * 1024 * 1024 * 1024
const MIN_FREE_DISK_BYTES = 2 * 1024 * 1024 * 1024

const SOURCE = Object.freeze({
  cpuTerminal: inside(
    ".runtime/ai-painter/stage4-joint-condition-local-transport-cpu-supports/"
      + "stage4-joint-condition-local-transport-cpu-support-20260829T172108835Z-b8f9a501/phase-terminal.json",
  ),
  model: inside("ml/ai-painter/src/ai_painter/complete_world/model.py"),
  modeRegistry: inside("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"),
  authorizationPolicy: inside("ml/ai-painter/scripts/ai_painter_authorization_policy.py"),
  contract: inside("ml/ai-painter/scripts/ai_painter_joint_condition_local_transport_contract.py"),
  cpuChecker: inside("ml/ai-painter/scripts/check_stage4_joint_condition_local_transport_cpu.py"),
  modelTest: inside("ml/ai-painter/tests/test_stage4_joint_condition_local_transport.py"),
  gpuDiagnostic: inside("ml/ai-painter/scripts/run_stage4_joint_condition_local_transport_readonly_gpu_diagnostic.py"),
  gpuDiagnosticTest: inside("ml/ai-painter/tests/test_stage4_joint_condition_local_transport_readonly_gpu_diagnostic.py"),
  runner: inside("scripts/run-ai-painter-stage4-joint-condition-local-transport-readonly-gpu-qualification.mjs"),
})

const EXPECTED = Object.freeze({
  cpuTerminal: "2ee822859a2ad3aa6420c8ce8a04b9a186aafc6240b278e2bbb93c8d350115bf",
  model: "f7fffb58736ba41e4019a1395dd13d22e06aa66a73d2724f27e01d94b5e44de0",
  modeRegistry: "4792237e7be563b212f5c4a39f55c97078c4c8d496de8403920ac3923361dbb4",
  authorizationPolicy: "d34403fbce18b7f74e88399dfd3564408f74ee8322774042c61e095f4c35c722",
  contract: "52362e1d33ea0c3eda1f7c0e3214dbcab682d92bfade822494888ba1927fff77",
  cpuChecker: "3425100b564a9ae0209dc9a6484228197340e9e3db46561095196f1efd9c6d9c",
  modelTest: "39319b9a67e689cbfb78959922f99a90c875787a3513afe06ae9c9e8e83634df",
  gpuDiagnostic: "c3de5f3558b6f54f404066e3c7c0b0ed952fbc654bf5397f9b440f72fb0a7b41",
  gpuDiagnosticTest: "8e2c76aeab8342edab161328793b123ebc672c7bda178ae1b74317ff9ec585f1",
})

const FILES = Object.freeze({
  ticket: path.join(TICKET_ROOT, "ticket.json"),
  consumption: path.join(TICKET_ROOT, "consumption.json"),
  activeConfig: path.join(TICKET_ROOT, "active-config.json"),
  preflight: path.join(TICKET_ROOT, "resource-preflight.json"),
  diagnosticReport: path.join(OUTPUT_ROOT, "gpu-diagnostic-report.json"),
  gradientEvidence: path.join(OUTPUT_ROOT, "gradient-evidence.json"),
  telemetry: path.join(OUTPUT_ROOT, "cuda-telemetry.json"),
  stateHashes: path.join(OUTPUT_ROOT, "model-state-hashes.json"),
  resourceBoundary: path.join(OUTPUT_ROOT, "native-rgb-resource-boundary.json"),
  qualificationReport: path.join(OUTPUT_ROOT, "readonly-gpu-qualification-report.json"),
  nextAction: path.join(OUTPUT_ROOT, "local-next-action.json"),
  finalization: path.join(OUTPUT_ROOT, "finalization.json"),
  terminal: path.join(OUTPUT_ROOT, "phase-terminal.json"),
  capsule: path.join(OUTPUT_ROOT, "local-task-capsule.json"),
  stagedPlan: path.join(OUTPUT_ROOT, "next-plan.md"),
  planReceipt: path.join(OUTPUT_ROOT, "plan-commit-receipt.json"),
  planSync: path.join(OUTPUT_ROOT, "plan-sync-record.json"),
  projectionJournal: path.join(OUTPUT_ROOT, "projection-journal.json"),
})

main().catch((error) => {
  recordFailure(error)
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})

async function main() {
  const current = await readCurrentExecutionRegistry(ROOT)
  assert.equal(current.ok, true, current.errorCode)
  assert.equal(current.registry.registryRevision, 52)
  assert.equal(current.registry.eventSequence, 52)
  assert.equal(current.registrySha256, "8ea369c2f8f506d12d68bfb6832241468cdbb67bf0b55a78fdfaa9c58fddf7d4")
  assert.equal(current.registry.capabilityVersion, CAPABILITY_VERSION)
  assert.equal(current.registry.taskId, CURRENT_TASK)
  assert.equal(current.registry.taskKind, "readonly_gpu_qualification")
  assert.equal(current.registry.activity, "joint_condition_local_transport_readonly_gpu_qualification_pending")
  assert.equal(current.registry.activeExecution, null)
  assert.equal(sha(PLAN), "33c3a9737d815c729c6c31ccec6a3a3514fbe9fcc793874462d1965c30e9e1c8")
  for (const [role, file] of Object.entries(SOURCE)) {
    assert.equal(fs.existsSync(file), true, `required source missing: ${projectPath(file)}`)
    if (Object.hasOwn(EXPECTED, role)) assert.equal(sha(file), EXPECTED[role], `${role} SHA-256 mismatch`)
  }
  assert.equal(fs.existsSync(PYTHON), true, "project Python runtime is missing")
  assert.equal(fs.existsSync(OUTPUT_ROOT), false, "readonly GPU output reuse is forbidden")
  assert.equal(fs.existsSync(TICKET_ROOT), false, "readonly GPU ticket reuse is forbidden")

  const recordedAtUtc = new Date().toISOString()
  const recordedAtAsiaShanghai = formatShanghai(recordedAtUtc)
  const planBeforeSha256 = sha(PLAN)
  const sourceIdentity = Object.fromEntries(
    Object.entries(SOURCE).map(([role, file]) => [role, bind(file)]),
  )

  const pyCompile = runPython([
    "-m", "py_compile",
    projectPath(SOURCE.model),
    projectPath(SOURCE.modeRegistry),
    projectPath(SOURCE.authorizationPolicy),
    projectPath(SOURCE.contract),
    projectPath(SOURCE.cpuChecker),
    projectPath(SOURCE.modelTest),
    projectPath(SOURCE.gpuDiagnostic),
    projectPath(SOURCE.gpuDiagnosticTest),
  ], { cudaVisible: false })
  assert.equal(pyCompile.status, 0, pyCompile.stderr || pyCompile.stdout)
  const unit = runPython([
    "-m", "unittest",
    projectPath(SOURCE.modelTest),
    projectPath(SOURCE.gpuDiagnosticTest),
    "-v",
  ], { cudaVisible: false, timeout: 120000 })
  assert.equal(unit.status, 0, unit.stderr || unit.stdout)
  assert.match(unit.stderr || unit.stdout, /Ran 15 tests/u)
  const cpuChecker = runPython([projectPath(SOURCE.cpuChecker)], { cudaVisible: false })
  assert.equal(cpuChecker.status, 0, cpuChecker.stderr || cpuChecker.stdout)
  const cpuCheckerReport = parseJson(cpuChecker.stdout, "CPU checker")
  assert.equal(cpuCheckerReport.status, "passed")
  assert.equal(cpuCheckerReport.positivePassed, cpuCheckerReport.positiveTotal)
  assert.equal(cpuCheckerReport.negativePassed, cpuCheckerReport.negativeTotal)

  const preflightProcess = runPython(["-c", [
    "import json, shutil, torch",
    "assert torch.cuda.is_available(), 'CUDA unavailable'",
    "free,total=torch.cuda.mem_get_info(0)",
    "p=torch.cuda.get_device_properties(0)",
    "print(json.dumps({'python':True,'torchVersion':torch.__version__,'cudaRuntimeVersion':torch.version.cuda,'deviceName':torch.cuda.get_device_name(0),'deviceCapability':list(torch.cuda.get_device_capability(0)),'freeGpuMemoryBytes':int(free),'totalGpuMemoryBytes':int(total),'deviceTotalMemoryBytes':int(p.total_memory)}))",
  ].join(";")], { cudaVisible: true, timeout: 60000 })
  assert.equal(preflightProcess.status, 0, preflightProcess.stderr || preflightProcess.stdout)
  const gpuPreflight = parseJson(preflightProcess.stdout, "CUDA preflight")
  assert.ok(gpuPreflight.freeGpuMemoryBytes >= MIN_FREE_GPU_BYTES, "less than 4 GiB free GPU memory")
  const disk = fs.statfsSync(ROOT)
  const freeDiskBytes = Number(disk.bavail) * Number(disk.bsize)
  assert.ok(freeDiskBytes >= MIN_FREE_DISK_BYTES, "less than 2 GiB free disk")

  const ticketProcess = runPython(["-c", [
    "import json",
    "from ai_painter_joint_condition_local_transport_contract import issue_and_consume_joint_condition_local_transport_readonly_gpu_ticket as issue",
    `active,ticket=issue(dataset_package_id=${JSON.stringify(DATASET_PACKAGE_ID)},run_id=${JSON.stringify(RUN_ID)},output_namespace=${JSON.stringify(OUTPUT_ROOT_RELATIVE)})`,
    "print(json.dumps({'activeConfig':active,'ticketIdentity':ticket},ensure_ascii=False))",
  ].join(";")], { cudaVisible: false })
  assert.equal(ticketProcess.status, 0, ticketProcess.stderr || ticketProcess.stdout)
  const issued = parseJson(ticketProcess.stdout, "internal ticket issuer")
  assert.equal(issued.ticketIdentity.executionState, "consumed")
  assert.equal(issued.ticketIdentity.runId, RUN_ID)
  assert.equal(issued.ticketIdentity.outputNamespace, OUTPUT_ROOT_RELATIVE)
  assert.equal(issued.activeConfig.ownerAuthorizationRequired, false)
  ensureJson(FILES.activeConfig, issued.activeConfig)
  assert.deepEqual(bind(FILES.ticket), {
    path: issued.ticketIdentity.ticketPath,
    sha256: issued.ticketIdentity.ticketSha256,
  })
  assert.deepEqual(bind(FILES.consumption), {
    path: issued.ticketIdentity.consumptionPath,
    sha256: issued.ticketIdentity.consumptionSha256,
  })
  ensureJson(FILES.preflight, {
    schemaVersion: "stage4-joint-condition-local-transport-readonly-gpu-resource-preflight-v1",
    status: "passed_before_internal_ticket_consumption",
    runId: RUN_ID,
    gpu: gpuPreflight,
    disk: { freeDiskBytes, minimumRequiredBytes: MIN_FREE_DISK_BYTES },
    cpuRegression: {
      pythonCompile: "passed",
      unitTests: 15,
      positiveContractChecks: cpuCheckerReport.positivePassed,
      negativeContractChecks: cpuCheckerReport.negativePassed,
    },
    ownerAuthorizationRequired: false,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  const configValidation = runPython(["-c", [
    "import json",
    "from pathlib import Path",
    "from ai_painter_joint_condition_local_transport_contract import validate_joint_condition_local_transport_readonly_gpu_config as validate",
    `v=json.loads(Path(${JSON.stringify(projectPath(FILES.activeConfig))}).read_text(encoding='utf-8'))`,
    "print(json.dumps(validate(v,require_execution_ticket=True),ensure_ascii=False))",
  ].join(";")], { cudaVisible: false })
  assert.equal(configValidation.status, 0, configValidation.stderr || configValidation.stdout)
  const configValidationReport = parseJson(configValidation.stdout, "active config validator")
  assert.equal(configValidationReport.status, "joint_condition_local_transport_readonly_gpu_config_valid")
  assert.equal(configValidationReport.ownerAuthorizationRequired, false)
  assert.equal(configValidationReport.trainingAllowed, false)

  const diagnostic = runPython([
    projectPath(SOURCE.gpuDiagnostic),
    "--active-config", projectPath(FILES.activeConfig),
    "--active-config-sha256", sha(FILES.activeConfig),
    "--output-dir", OUTPUT_ROOT_RELATIVE,
  ], { cudaVisible: true, timeout: 20 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 })
  assert.equal(diagnostic.status, 0, diagnostic.stderr || diagnostic.stdout)
  const diagnosticResult = parseJson(diagnostic.stdout, "readonly GPU diagnostic")
  assert.equal(diagnosticResult.status, "passed")
  assert.equal(diagnosticResult.runId, RUN_ID)
  assert.equal(diagnosticResult.transportParameterTensorsQualified, 24)
  assert.equal(diagnosticResult.conditionChannelsQualified, 23)
  assert.equal(diagnosticResult.modelStateUnchanged, true)
  assert.deepEqual(diagnosticResult.report, bind(FILES.diagnosticReport))

  const report = readBound(FILES.diagnosticReport)
  assert.equal(report.status, "passed")
  assert.equal(report.runId, RUN_ID)
  assert.equal(report.transportParameterTensorCount, 24)
  assert.equal(report.conditionChannels, 23)
  assert.equal(report.safety.autoencoderCheckpointRead, true)
  assert.equal(report.safety.autoencoderFrozen, true)
  for (const key of [
    "denoiserCheckpointRead", "historicalDenoiserCheckpointRead",
    "failedDenoiserCheckpointRead", "optimizerCreated", "backwardExecuted",
    "weightsModified", "checkpointWritten", "smokeStarted", "trainingStarted",
  ]) assert.equal(report.safety[key], false, `safety boundary changed: ${key}`)
  const gradient = readBound(FILES.gradientEvidence)
  assert.equal(gradient.status, "passed")
  assert.equal(gradient.samples.length, 2)
  for (const sample of gradient.samples) {
    assert.equal(sample.conditionGradient.all23ChannelsFiniteNonzero, true)
    assert.equal(sample.transportParameterTensorCount, 24)
    assert.equal(sample.transportParameterGradients.length, 24)
    assert.equal(sample.transportParameterGradients.every((value) => value.finite && value.nonzero), true)
    assert.equal(sample.allParameterGradFieldsRemainNone, true)
  }
  const stateHashes = readBound(FILES.stateHashes)
  assert.equal(stateHashes.denoiserUnchanged, true)
  assert.equal(stateHashes.autoencoderUnchanged, true)
  assert.equal(stateHashes.allParameterGradFieldsRemainNone, true)
  const telemetry = readBound(FILES.telemetry)
  assert.equal(telemetry.status, "completed")
  assert.ok(telemetry.peakAllocatedBytes <= MAX_PEAK_ALLOCATED_BYTES, "readonly GPU peak allocation exceeded 512 MiB")
  assert.ok(telemetry.peakReservedBytes <= MAX_PEAK_RESERVED_BYTES, "readonly GPU peak reserve exceeded 768 MiB")
  const nativeBoundary = readBound(FILES.resourceBoundary)
  assert.equal(nativeBoundary.nativeDecodeExecuted, false)
  assert.equal(nativeBoundary.nativeTrainingExecuted, false)
  assert.equal(nativeBoundary.nativePeakGpuMemoryMeasured, false)
  assert.equal(nativeBoundary.nativeRuntimeFeasibilityClaimed, false)

  ensureJson(FILES.qualificationReport, {
    schemaVersion: "stage4-joint-condition-local-transport-readonly-gpu-qualification-report-v1",
    status: "passed",
    runId: RUN_ID,
    capabilityVersion: CAPABILITY_VERSION,
    activeConfig: bind(FILES.activeConfig),
    internalCapabilityTicket: bind(FILES.ticket),
    ticketConsumption: bind(FILES.consumption),
    resourcePreflight: bind(FILES.preflight),
    gpuDiagnostic: bind(FILES.diagnosticReport),
    gradientEvidence: bind(FILES.gradientEvidence),
    cudaTelemetry: bind(FILES.telemetry),
    modelStateHashes: bind(FILES.stateHashes),
    nativeRgbReadonlyResourceBoundary: bind(FILES.resourceBoundary),
    sourceEvidence: sourceIdentity,
    measured: {
      conditionChannelsFiniteNonzero: 23,
      transportParameterTensorsFiniteNonzero: 24,
      transportParameterCount: 22464,
      firstFormalTrainRecordQualified: true,
      fixedValidationSample194Qualified: true,
      peakGpuMemoryBytes: telemetry.peakGpuMemoryBytes,
      peakReservedBytes: telemetry.peakReservedBytes,
      durationSeconds: telemetry.durationSeconds,
    },
    safety: report.safety,
    ownerAuthorizationRequired: false,
    trainingStarted: false,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  ensureJson(FILES.nextAction, {
    schemaVersion: "stage4-local-next-action-v1",
    status: "ready_for_local_controlled_smoke_compilation_and_execution",
    runId: RUN_ID,
    action: NEXT_LEGAL_ACTION,
    taskKind: "controlled_smoke_compilation_and_execution",
    constraints: {
      fixedSeed: 20263722,
      fixedSampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
      fixedResolution: "256x192",
      epochCount: 30,
      previewEpochs: [1, 5, 10, 20, 30],
      freshRandomDenoiserInitialization: true,
      historicalDenoiserCheckpointAllowed: false,
      automaticValidationReviewAndTerminalRequired: true,
      automaticRetryAllowed: false,
    },
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  const fixedProgress = { completedStages: 3, totalStages: 5, percent: 60 }
  ensureJson(FILES.finalization, {
    schemaVersion: "stage4-joint-condition-local-transport-readonly-gpu-finalization-v1",
    executionState: "completed",
    status: "readonly_gpu_qualification_passed",
    runId: RUN_ID,
    qualificationReport: bind(FILES.qualificationReport),
    localNextAction: bind(FILES.nextAction),
    fixedTotalProgress: fixedProgress,
    ownerAuthorizationRequired: false,
    optimizerCreated: false,
    backwardExecuted: false,
    modelWeightsModified: false,
    checkpointWritten: false,
    trainingStarted: false,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })
  ensureJson(FILES.terminal, {
    schemaVersion: "stage4-joint-condition-local-transport-readonly-gpu-terminal-v1",
    executionState: "completed",
    status: "stage4_joint_condition_local_transport_readonly_gpu_qualification_succeeded",
    runId: RUN_ID,
    capabilityVersion: CAPABILITY_VERSION,
    finalization: bind(FILES.finalization),
    qualificationReport: bind(FILES.qualificationReport),
    localNextAction: bind(FILES.nextAction),
    nextLegalAction: NEXT_LEGAL_ACTION,
    fixedTotalProgress: fixedProgress,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    denoiserCheckpointWeightsRead: false,
    gpuStarted: true,
    optimizerCreated: false,
    backwardExecuted: false,
    modelWeightsModified: false,
    checkpointWritten: false,
    trainingStarted: false,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  ensureJson(FILES.capsule, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${RUN_ID}`,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    currentStage: { number: 4, total: 5, labelZh: "联合条件局部传输只读GPU资格", status: "completed" },
    fixedOverallProgress: fixedProgress,
    uniqueDecision: "joint_condition_local_transport_readonly_gpu_qualified",
    latestBlocker: "controlled_30_epoch_smoke_not_yet_executed",
    nextAllowedAction: {
      code: NEXT_LEGAL_ACTION,
      taskKind: "controlled_smoke_compilation_and_execution",
      ownerAuthorizationRequired: false,
      automaticTrainingAllowed: true,
    },
    latestTrainingTerminal: current.registry.latestTrainingTerminal,
    evidence: [
      FILES.activeConfig, FILES.ticket, FILES.consumption, FILES.preflight,
      FILES.diagnosticReport, FILES.gradientEvidence, FILES.telemetry,
      FILES.stateHashes, FILES.resourceBoundary, FILES.qualificationReport,
      FILES.finalization, FILES.nextAction, FILES.terminal,
    ].map((file) => ({ ...bind(file), sha256Verified: true })),
    integrity: {
      status: "verified",
      requiredEvidencePresent: true,
      boundEvidenceVerified: true,
      identityMatches: true,
      migrationRegistryStatus: "current_execution_registry_pending_atomic_advance",
    },
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  const planSource = fs.readFileSync(PLAN, "utf8")
  const planAfter = updatePlan(planSource, recordedAtUtc, telemetry)
  ensureText(FILES.stagedPlan, planAfter)
  const planAfterSha256 = sha(FILES.stagedPlan)
  assert.equal(sha(PLAN), planBeforeSha256, "unique plan changed during readonly GPU transaction")
  writeAtomicText(PLAN, planAfter)
  assert.equal(sha(PLAN), planAfterSha256)
  ensureJson(FILES.planReceipt, {
    schemaVersion: "stage4-joint-condition-local-transport-readonly-gpu-plan-commit-receipt-v1",
    status: "committed",
    runId: RUN_ID,
    planPath: projectPath(PLAN),
    beforeSha256: planBeforeSha256,
    afterSha256: planAfterSha256,
    terminal: bind(FILES.terminal),
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })
  ensureJson(FILES.planSync, {
    schemaVersion: "stage4-joint-condition-local-transport-readonly-gpu-plan-sync-v1",
    status: "committed",
    runId: RUN_ID,
    planPath: projectPath(PLAN),
    beforeSha256: planBeforeSha256,
    afterSha256: planAfterSha256,
    planCommitReceipt: bind(FILES.planReceipt),
    terminal: bind(FILES.terminal),
    nextLegalAction: NEXT_LEGAL_ACTION,
    currentFixedProgress: fixedProgress,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  const eventInput = {
    id: `stage4-joint-condition-local-transport-readonly-gpu-${RUN_ID}`,
    timestamp: recordedAtUtc,
    action: "stage4_joint_condition_local_transport_readonly_gpu_qualification_succeeded",
    runId: RUN_ID,
    kind: "readonly_gpu_qualification",
    status: "success",
    title: "Stage4 joint-condition local-transport read-only GPU qualification passed",
    titleZh: "Stage4联合条件局部传输只读GPU资格通过",
    detailZh: `真实CUDA已验证23/23条件通道与24/24局部传输参数张量梯度有限非零，模型前后状态不变；峰值显存${telemetry.peakGpuMemoryBytes}字节。`,
    evidencePath: projectPath(FILES.terminal),
    evidenceSha256: sha(FILES.terminal),
    fixedTotalProgress: fixedProgress,
  }
  for (const file of outputArtifacts()) index(file)
  const event = ensureAiPainterProgramEventCommitted(eventInput)
  const eventCommit = verifyAiPainterProgramEventCommitted(event)
  ensureJson(FILES.projectionJournal, {
    schemaVersion: "stage4-joint-condition-local-transport-readonly-gpu-projection-journal-v1",
    state: "dependencies_committed",
    runId: RUN_ID,
    sourceRegistry: {
      registryRevision: current.registry.registryRevision,
      eventSequence: current.registry.eventSequence,
      sha256: current.registrySha256,
      transactionId: current.registry.transactionId,
    },
    plan: {
      path: projectPath(PLAN),
      beforeSha256: planBeforeSha256,
      afterSha256: planAfterSha256,
      receipt: bind(FILES.planReceipt),
      sync: bind(FILES.planSync),
    },
    programEvent: event,
    terminal: bind(FILES.terminal),
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })
  index(FILES.projectionJournal)

  const catalogFiles = [...outputArtifacts(), FILES.projectionJournal]
  const catalogArtifacts = catalogFiles.map((file) => ({
    logicalPath: logicalProjectPath(file),
    sha256: sha(file),
  }))
  const advanced = await advanceCurrentExecutionRegistry({
    projectRoot: ROOT,
    capabilityVersion: CAPABILITY_VERSION,
    packageId: RUN_ID,
    taskId: NEXT_LEGAL_ACTION,
    taskKind: "controlled_smoke_compilation_and_execution",
    runId: RUN_ID,
    lifecycleStage: "joint_condition_local_transport_readonly_gpu_qualified",
    executionState: "completed",
    activity: "joint_condition_local_transport_controlled_smoke_pending",
    taskCapsulePath: projectPath(FILES.capsule),
    terminalEvidencePath: projectPath(FILES.terminal),
    latestTrainingTerminal: current.registry.latestTrainingTerminal,
    expectedPreviousRegistryRevision: current.registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256,
    dependencyManifest: {
      schemaVersion: "ai-painter-current-execution-registry-dependency-manifest-v1",
      mode: "external",
      outerJournal: {
        path: projectPath(FILES.projectionJournal),
        sha256: sha(FILES.projectionJournal),
        requiredState: "dependencies_committed",
      },
      bindings: [
        { role: "committed-plan", path: projectPath(PLAN), sha256: planAfterSha256 },
        { role: "plan-commit-receipt", ...bind(FILES.planReceipt) },
        { role: "readonly-gpu-terminal", ...bind(FILES.terminal) },
        { role: "qualification-report", ...bind(FILES.qualificationReport) },
        { role: "internal-capability-ticket", ...bind(FILES.ticket) },
        { role: "ticket-consumption", ...bind(FILES.consumption) },
        { role: "local-task-capsule", ...bind(FILES.capsule) },
        { role: "source-cpu-terminal", ...bind(SOURCE.cpuTerminal) },
      ],
      programEvent: {
        eventId: event.id,
        event,
        ledgerPath: eventCommit.ledger.path,
        latestPath: eventCommit.latest.path,
        catalogDatabasePath: path.resolve(catalogPath),
      },
      catalogArtifacts,
    },
  })
  assert.equal(advanced.ok, true, advanced.errorCode)
  assert.equal(advanced.registry.registryRevision, 53)
  assert.equal(advanced.registry.taskId, NEXT_LEGAL_ACTION)

  process.stdout.write(`${JSON.stringify({
    status: read(FILES.terminal).status,
    runId: RUN_ID,
    capabilityVersion: CAPABILITY_VERSION,
    conditionChannelsQualified: 23,
    transportParameterTensorsQualified: 24,
    peakGpuMemoryBytes: telemetry.peakGpuMemoryBytes,
    durationSeconds: telemetry.durationSeconds,
    terminal: bind(FILES.terminal),
    qualificationReport: bind(FILES.qualificationReport),
    nextLegalAction: NEXT_LEGAL_ACTION,
    currentRegistryRevision: advanced.registry.registryRevision,
    currentRegistrySha256: advanced.registrySha256,
    currentFixedProgress: fixedProgress,
    ownerAuthorizationRequired: false,
    denoiserCheckpointWeightsRead: false,
    optimizerCreated: false,
    backwardExecuted: false,
    trainingStarted: false,
  }, null, 2)}\n`)
}

function runPython(args, options = {}) {
  const env = { ...PYTHON_ENV }
  if (options.cudaVisible === false) env.CUDA_VISIBLE_DEVICES = ""
  return spawnSync(PYTHON, args, {
    cwd: ROOT,
    env,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: options.maxBuffer ?? 32 * 1024 * 1024,
    timeout: options.timeout ?? 120000,
    killSignal: "SIGKILL",
  })
}

function parseJson(value, label) {
  try {
    return JSON.parse(String(value ?? "").trim())
  } catch (error) {
    throw new Error(`${label} did not return a JSON object: ${error.message}`)
  }
}

function readBound(file) {
  assert.equal(fs.existsSync(file), true, `bound evidence missing: ${projectPath(file)}`)
  const value = read(file)
  for (const [key, binding] of Object.entries({
    gradientEvidence: value.gradientEvidence,
    modelStateHashes: value.modelStateHashes,
    cudaTelemetry: value.cudaTelemetry,
    nativeRgbReadonlyResourceBoundary: value.nativeRgbReadonlyResourceBoundary,
  })) {
    if (binding !== undefined) {
      const target = inside(binding.path)
      assert.equal(fs.existsSync(target), true, `${key} binding is missing`)
      assert.equal(sha(target), binding.sha256, `${key} binding SHA-256 mismatch`)
    }
  }
  return value
}

function updatePlan(source, utc, telemetry) {
  const shanghai = formatShanghai(utc).replace("T", " ").replace("+08:00", " +08:00")
  const status = "状态：active-module-plan / AI Painter固定进度3/5（60%）；联合条件局部传输只读GPU资格通过，30 Epoch受控Smoke待自动编译执行"
  const current = "固定进度3/5（60%）；联合条件局部传输候选已完成历史去重、CPU设计与实现、正反回归、真实CUDA只读梯度资格和资源遥测；尚未启动Smoke训练"
  const next = "下一步由本地程序在同一闭环包内编译并执行固定30 Epoch受控Smoke，随后自动复现、机器审核、裁决和终态收口；不等待Owner授权"
  const latest = `联合条件局部传输候选的独立只读GPU资格已通过。固定种子20263722、256×192正式条件输入下，正式首条train记录与固定validation样本194均完成真实CUDA前向及torch.autograd.grad；23/23条件通道和24/24局部传输参数张量的梯度全部有限非零。\n\nDenoiser与冻结Autoencoder前后状态哈希完全一致，未读取任何历史或失败Denoiser Checkpoint，未创建优化器、未执行.backward()、未修改权重、未写Checkpoint、未训练。实测峰值GPU已分配显存为${telemetry.peakGpuMemoryBytes}字节，峰值保留显存为${telemetry.peakReservedBytes}字节；1024×768仅保存尺寸与静态张量资源边界，没有冒充原生训练峰值。`
  const blocker = "当前唯一缺口是本候选的一次固定30 Epoch受控Smoke。该Smoke必须固定样本194、seed 20263722、256×192、Epoch 1/5/10/20/30预览，从全新固定随机Denoiser初始化开始；训练自然完成后必须在同一执行包中自动完成字节复现、正式机器审核、结果裁决、Finalization、phase-terminal及计划表/任务胶囊/事件账本/SQLite同步，不得再次停在等待验证状态。\n\n固定进度保持3/5（60%）。只读GPU资格证明执行接线、梯度和资源可行，不等于视觉语义已经通过；Smoke真实视觉失败必须保存证据并失败关闭，不允许自动重试、调参或降低阈值。"
  let output = replaceOnce(source, /^更新时间：.*$/mu, `更新时间：${shanghai}`)
  output = replaceOnce(output, /^状态：.*$/mu, status)
  output = replaceOnce(
    output,
    /^\| 2 \| AI Painter R5 \/ Stage4 \|.*$/mu,
    `| 2 | AI Painter R5 / Stage4 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标 | ${current} | ${next} |`,
  )
  output = replaceOnce(output, /## 4\. 最近一次模块终态[\s\S]*?(?=\n## 5\.)/u, `## 4. 最近一次模块终态\n\n${latest}\n`)
  output = replaceOnce(output, /## 5\. 当前阻断与后续实施顺序[\s\S]*?(?=\n## 6\.)/u, `## 5. 当前阻断与后续实施顺序\n\n${blocker}\n`)
  return output
}

function replaceOnce(source, pattern, replacement) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`
  const matches = source.match(new RegExp(pattern.source, flags)) ?? []
  assert.equal(matches.length, 1, `plan replacement count mismatch: ${pattern}`)
  return source.replace(pattern, replacement)
}

function outputArtifacts() {
  return [
    FILES.ticket,
    FILES.consumption,
    FILES.activeConfig,
    FILES.preflight,
    FILES.diagnosticReport,
    FILES.gradientEvidence,
    FILES.telemetry,
    FILES.stateHashes,
    FILES.resourceBoundary,
    FILES.qualificationReport,
    FILES.nextAction,
    FILES.finalization,
    FILES.terminal,
    FILES.capsule,
    FILES.stagedPlan,
    FILES.planReceipt,
    FILES.planSync,
  ]
}

function index(file) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId: RUN_ID,
    artifactType: "stage4_joint_condition_local_transport_readonly_gpu_qualification",
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: sha(file),
  })
}

function recordFailure(error) {
  try {
    fs.mkdirSync(FAILURE_ROOT, { recursive: true })
    const failure = path.join(FAILURE_ROOT, "failure-report.json")
    if (!fs.existsSync(failure)) {
      fs.writeFileSync(failure, `${JSON.stringify({
        schemaVersion: "stage4-joint-condition-local-transport-readonly-gpu-failure-v1",
        status: "failed_closed",
        runId: RUN_ID,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
        internalTicketConsumed: fs.existsSync(FILES.consumption),
        outputNamespaceCreated: fs.existsSync(OUTPUT_ROOT),
        denoiserCheckpointWeightsRead: false,
        optimizerCreated: false,
        backwardExecuted: false,
        trainingStarted: false,
        recordedAtUtc: new Date().toISOString(),
      }, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
    }
  } catch {
    // Preserve the original failure if writing its evidence also fails.
  }
}

function bind(file) {
  return { path: projectPath(file), sha256: sha(file) }
}

function compactUtc() {
  return new Date().toISOString().replace(/[-:.]/gu, "")
}

function inside(relative) {
  const candidate = path.resolve(ROOT, relative)
  assert.ok(candidate === ROOT || candidate.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${relative}`)
  return candidate
}

function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, ""))
}

function sha(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}

function ensureJson(file, value) {
  if (!fs.existsSync(file)) writeExclusiveJson(file, value)
  assert.deepEqual(read(file), value, `immutable JSON mismatch: ${projectPath(file)}`)
}

function writeExclusiveJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
}

function ensureText(file, value) {
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, value, { encoding: "utf8", flag: "wx" })
  }
  assert.equal(fs.readFileSync(file, "utf8"), value, `immutable text mismatch: ${projectPath(file)}`)
}

function writeAtomicText(file, value) {
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`
  fs.writeFileSync(temporary, value, { encoding: "utf8", flag: "wx" })
  fs.renameSync(temporary, file)
}
