import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawn, spawnSync } from "node:child_process"
import { pathToFileURL } from "node:url"

import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { auditAiAssistedProfessionalAesthetic } from "./lib/ai-assisted-professional-aesthetic.mjs"
import { normalizePreviewWithWindowsSafeIo } from "./lib/ai-assisted-v7-r5-stage3-preview-review.mjs"
import {
  ensureAiPainterProgramEventCommitted,
  formatShanghai,
  projectPath,
  verifyAiPainterProgramEventCommitted,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { adjudicateLateReviewRows } from "./lib/ai-painter-stage4-late-convergence-qualification.mjs"
import { indexArtifact, openStorageCatalog } from "./lib/ai-pet-world-storage-catalog.mjs"
import { catalogPath, logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"
import {
  finalizePreparedCurrentExecutionRegistryAdvance,
  prepareCurrentExecutionRegistryAdvance,
  readCurrentExecutionRegistry,
  recoverPreparedCurrentExecutionRegistryAdvance,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = path.resolve(process.cwd())
const CAPABILITY = "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1"
const ARCHITECTURE = CAPABILITY
const SOURCE_TASK = "implement_and_execute_stage4_full_backbone_spatial_affine_controlled_smoke"
const SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
const SEED = 20263722
const EPOCH_COUNT = 30
const PREVIEW_EPOCHS = [1, 5, 10, 20, 30]
const LATE_EPOCHS = [10, 20, 30]
const PYTHON = inside("ml/ai-painter/.venv/Scripts/python.exe")
const TRAINER = inside("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
const MATERIALIZER = inside("ml/ai-painter/scripts/materialize_stage4_full_backbone_spatial_affine_controlled_smoke.py")
const CPU_CHECKER = inside("ml/ai-painter/scripts/check_stage4_full_backbone_spatial_affine_controlled_smoke_cpu.py")
const RESOURCE_PREFLIGHT = inside("ml/ai-painter/scripts/run_stage4_full_backbone_spatial_affine_smoke_resource_preflight.py")
const PLAN = inside("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const DATASET = inside("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json")
const AUTOENCODER = inside(".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt")
const DATASET_SHA256 = "8001f5a27bb8bc18883184b0c7e39ef1336eb295ce5787618bf4e60059dd48aa"
const AUTOENCODER_SHA256 = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
const EXECUTION_PARENT = inside(".runtime/ai-painter/stage4-full-backbone-spatial-affine-controlled-smokes")
const TRANSACTION_PARENT = inside(".runtime/ai-painter/stage4-full-backbone-spatial-affine-controlled-smoke-transactions")
const CONTROLLED_LAUNCH_FAILURE_PARENT = inside(".runtime/ai-painter/stage4-full-backbone-spatial-affine-controlled-smoke-launch-failures")
const REVIEW_WORK_ROOT = inside(".runtime/ai-painter/stage4-full-backbone-spatial-affine-review-work")
const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
const BACKGROUND_LAUNCH = process.argv.includes("--background")

export async function executeFullBackboneSpatialAffineControlledSmoke() {
  const source = await verifyCompiledContractSource()
  const { contract, contractPath, contractSha256, runId, outputNamespace } = source
  const executionRoot = inside(outputNamespace)
  const paths = outputPaths(executionRoot)
  if (fs.existsSync(executionRoot)) {
    if (fs.existsSync(paths.terminal) && fs.existsSync(paths.projectionJournal)) {
      const journal = await completeProjection(read(paths.projectionJournal), paths)
      return resultProjection(journal, paths)
    }
    assert.equal(
      fs.existsSync(paths.trainingOutput),
      false,
      "controlled_smoke_training_output_exists_restart_forbidden",
    )
  }

  const codeIdentity = freezeCodeIdentity()
  const planBeforeSha256 = sha(PLAN)
  const preflight = fs.existsSync(executionRoot)
    ? recoverUntrainedPartialState({ source, contract, contractPath, contractSha256, runId, outputNamespace, paths })
    : runAllPreflightChecks({
        source,
        contract,
        contractPath,
        contractSha256,
        runId,
        outputNamespace,
        paths,
      })
  if (!fs.existsSync(executionRoot)) {
    fs.mkdirSync(EXECUTION_PARENT, { recursive: true })
    fs.mkdirSync(executionRoot, { recursive: false })
    writeExclusive(paths.preflight, preflight)
  } else if (!fs.existsSync(paths.preflight)) {
    writeExclusive(paths.preflight, preflight)
  }

  const materialized = fs.existsSync(paths.activeConfig)
    ? { status: "active_config_materialized_with_consumed_internal_ticket", recovered: true }
    : runJson(PYTHON, [
        MATERIALIZER,
        "--operation", "consume",
        "--run-id", runId,
        "--output-namespace", outputNamespace,
        "--compiled-contract", contractPath,
        "--compiled-contract-sha256", contractSha256,
        "--dataset-package-id", preflight.datasetPackageId,
        "--output", paths.activeConfig,
      ], 300_000)
  assert.equal(materialized.status, "active_config_materialized_with_consumed_internal_ticket")
  const activeValidation = runJson(PYTHON, [MATERIALIZER, "--operation", "validate", "--config", paths.activeConfig], 300_000)
  assert.equal(activeValidation.status, "full_backbone_spatial_affine_controlled_smoke_config_valid")
  assert.equal(fs.existsSync(paths.trainingOutput), false, "training-output exists before Trainer")
  verifyPostConsumptionRoot(paths)

  writeJsonAtomic(paths.executionState, {
    schemaVersion: "stage4-full-backbone-spatial-affine-controlled-smoke-execution-state-v1",
    status: "running",
    phase: "training",
    capabilityVersion: CAPABILITY,
    architectureId: ARCHITECTURE,
    runId,
    trainingOutput: projectPath(paths.trainingOutput),
    progressPath: projectPath(paths.progress),
    automaticMachineReviewAfterTraining: true,
    ownerAuthorizationRequired: false,
    startedAtUtc: new Date().toISOString(),
  })

  const trainerArgs = trainerArguments(paths.activeConfig, paths.trainingOutput, contractPath, false)
  const stdoutHandle = fs.openSync(paths.stdout, "wx")
  const stderrHandle = fs.openSync(paths.stderr, "wx")
  let child
  let projectionInput
  try {
    child = spawn(PYTHON, trainerArgs, {
      cwd: ROOT,
      env: pythonEnv(),
      windowsHide: true,
      stdio: ["ignore", stdoutHandle, stderrHandle],
    })
  } catch (error) {
    fs.closeSync(stdoutHandle)
    fs.closeSync(stderrHandle)
    return closeInfrastructureFailure({
      code: "trainer_spawn_failed",
      detail: error?.stack ?? error,
      source,
      paths,
      codeIdentity,
      planBeforeSha256,
      trainingStarted: false,
    })
  }
  const processIdentity = {
    pid: child.pid,
    spawnedAtUtc: new Date().toISOString(),
    detachedFromCodexByOuterLauncher:
      BACKGROUND_LAUNCH || process.env.AI_PAINTER_AUTONOMOUS_BACKGROUND === "1",
  }
  const monitorRows = []
  const startedMs = Date.now()
  const heartbeat = () => recordHeartbeat({ paths, runId, processIdentity, monitorRows, startedMs })
  heartbeat()
  const heartbeatInterval = setInterval(heartbeat, 10_000)
  const exitCode = await new Promise((resolveExit, reject) => {
    child.once("error", reject)
    child.once("exit", (code) => resolveExit(code ?? 1))
  }).catch(async (error) => {
    clearInterval(heartbeatInterval)
    return { error }
  })
  clearInterval(heartbeatInterval)
  heartbeat()
  fs.closeSync(stdoutHandle)
  fs.closeSync(stderrHandle)
  if (typeof exitCode === "object") {
    return closeInfrastructureFailure({
      code: "trainer_process_error",
      detail: exitCode.error?.stack ?? exitCode.error,
      source,
      paths,
      codeIdentity,
      planBeforeSha256,
      trainingStarted: true,
    })
  }
  if (exitCode !== 0) {
    return closeInfrastructureFailure({
      code: "trainer_execution_failed",
      detail: `exitCode=${exitCode}; stderr=${tail(paths.stderr, 16000)}`,
      source,
      paths,
      codeIdentity,
      planBeforeSha256,
      trainingStarted: true,
    })
  }

  try {
    assert.equal(fs.existsSync(paths.trainingManifest), true, "Trainer manifest missing")
    assert.equal(fs.existsSync(paths.progress), true, "Trainer progress missing")
    assert.equal(fs.existsSync(paths.trainingTelemetry), true, "formal training resource telemetry missing")
  writeJsonAtomic(paths.executionState, {
    schemaVersion: "stage4-full-backbone-spatial-affine-controlled-smoke-execution-state-v1",
    status: "running",
    phase: "automatic_machine_review",
    capabilityVersion: CAPABILITY,
    architectureId: ARCHITECTURE,
    runId,
    trainingOutput: projectPath(paths.trainingOutput),
    progressPath: projectPath(paths.progress),
    automaticMachineReviewAfterTraining: true,
    ownerAuthorizationRequired: false,
    updatedAtUtc: new Date().toISOString(),
  })
  const review = await reviewPreviews({ paths, runId })
  const qualification = qualifyLateStability(review, runId)
  writeExclusive(paths.qualification, qualification)
  const qualified = qualification.qualified === true
  const terminalStatus = qualified
    ? "stage4_full_backbone_spatial_affine_controlled_smoke_qualified"
    : "stage4_full_backbone_spatial_affine_controlled_smoke_real_visual_failure"
  const nextLegalAction = qualified
    ? contract.nextActionMapping.qualified
    : contract.nextActionMapping.realVisualFailure
  const trainingManifest = read(paths.trainingManifest)
  const checkpoint = normalizeCheckpointIdentity(trainingManifest)

  writeExclusive(paths.manifest, {
    schemaVersion: "stage4-full-backbone-spatial-affine-controlled-smoke-root-manifest-v1",
    status: qualified ? "qualified" : "real_visual_failure",
    capabilityVersion: CAPABILITY,
    architectureId: ARCHITECTURE,
    runId,
    controlledSmokeContract: bind(contractPath),
    activeConfig: bind(paths.activeConfig),
    internalTicket: bind(paths.ticket),
    internalTicketConsumption: bind(paths.consumption),
    preflightReport: bind(paths.preflight),
    trainingManifest: bind(paths.trainingManifest),
    progress: bind(paths.progress),
    resourceTelemetry: bind(paths.trainingTelemetry),
    machineReviewTimeline: bind(paths.machineReview),
    lateStabilityQualification: bind(paths.qualification),
    checkpoint: { ...checkpoint, promotable: false, formalStageInitializationAllowed: false },
    modelWeightsModified: true,
    automaticRetryStarted: false,
    stage0Started: false,
    ownerAuthorizationRequired: false,
    recordedAtUtc: new Date().toISOString(),
  })
  writeExclusive(paths.finalization, {
    schemaVersion: "stage4-full-backbone-spatial-affine-controlled-smoke-finalization-v1",
    status: terminalStatus,
    capabilityVersion: CAPABILITY,
    architectureId: ARCHITECTURE,
    runId,
    manifest: bind(paths.manifest),
    trainingManifest: bind(paths.trainingManifest),
    machineReviewTimeline: bind(paths.machineReview),
    lateStabilityQualification: bind(paths.qualification),
    resourceTelemetry: bind(paths.trainingTelemetry),
    checkpoint: { ...checkpoint, promotable: false, formalStageInitializationAllowed: false },
    automaticRetryStarted: false,
    stage0Started: false,
    ownerAuthorizationRequired: false,
    recordedAtUtc: new Date().toISOString(),
  })
  projectionInput = { terminalStatus, nextLegalAction, review, qualified }
  writeExclusive(paths.terminal, {
    schemaVersion: "stage4-full-backbone-spatial-affine-controlled-smoke-terminal-v1",
    executionState: "completed",
    status: terminalStatus,
    capabilityVersion: CAPABILITY,
    architectureId: ARCHITECTURE,
    runId,
    finalization: bind(paths.finalization),
    manifest: bind(paths.manifest),
    machineReviewTimeline: bind(paths.machineReview),
    lateStabilityQualification: bind(paths.qualification),
    resourceTelemetry: bind(paths.trainingTelemetry),
    checkpointWritten: true,
    checkpointPromotable: false,
    modelWeightsModified: true,
    trainingStarted: true,
    automaticRetryStarted: false,
    stage0Started: false,
    ownerAuthorizationRequired: false,
    currentFixedProgress: fixedProgress(),
    nextLegalAction,
    recordedAtUtc: new Date().toISOString(),
  })
  } catch (error) {
    return closeInfrastructureFailure({
      code: "post_training_automatic_review_or_finalization_failed",
      detail: error?.stack ?? error,
      source,
      paths,
      codeIdentity,
      planBeforeSha256,
      trainingStarted: true,
    })
  }
  writeJsonAtomic(paths.executionState, {
    schemaVersion: "stage4-full-backbone-spatial-affine-controlled-smoke-execution-state-v1",
    status: "completed",
    phase: projectionInput.qualified ? "qualified" : "real_visual_failure_closed",
    capabilityVersion: CAPABILITY,
    architectureId: ARCHITECTURE,
    runId,
    terminal: bind(paths.terminal),
    ownerAuthorizationRequired: false,
    completedAtUtc: new Date().toISOString(),
  })
  writeExclusive(paths.capsule, buildCapsule({ paths, runId, ...projectionInput }))
  const journal = prepareProjection({
    source,
    paths,
    runId,
    ...projectionInput,
    codeIdentity,
    planBeforeSha256,
  })
  const complete = await completeProjection(journal, paths)
  return resultProjection(complete, paths)
}

async function verifyCompiledContractSource() {
  const current = await readCurrentExecutionRegistry(ROOT)
  assert.equal(current.ok, true, current.errorCode)
  const registry = current.registry
  assert.ok(Number.isInteger(registry.registryRevision) && registry.registryRevision >= 46)
  assert.equal(registry.eventSequence, registry.registryRevision)
  assert.equal(registry.capabilityVersion, CAPABILITY)
  assert.equal(registry.taskId, SOURCE_TASK)
  assert.equal(registry.taskKind, "controlled_smoke_implementation_and_execution")
  assert.equal(registry.lifecycleStage, "controlled_smoke_contract_compiled_training_path_pending")
  assert.equal(registry.executionState, "completed")
  assert.equal(registry.activity, "controlled_smoke_contract_compiled_not_started")
  assert.equal(registry.activeExecution, null)
  verifyBinding(registry.terminalEvidence)
  const compilationTerminal = read(inside(registry.terminalEvidence.path))
  assert.equal(compilationTerminal.executionState, "completed")
  assert.equal(compilationTerminal.status, "stage4_full_backbone_spatial_affine_controlled_smoke_contract_compiled")
  assert.equal(compilationTerminal.nextLegalAction, SOURCE_TASK)
  assert.equal(compilationTerminal.ownerAuthorizationRequired, false)
  assert.equal(compilationTerminal.gpuStarted, false)
  assert.equal(compilationTerminal.trainingStarted, false)
  const contractPath = inside(compilationTerminal.contract.path)
  assert.equal(sha(contractPath), compilationTerminal.contract.sha256)
  const contract = read(contractPath)
  assert.equal(contract.schemaVersion, "stage4-full-backbone-spatial-affine-controlled-smoke-contract-v1")
  assert.equal(contract.status, "compiled_not_started")
  assert.equal(contract.capabilityVersion, CAPABILITY)
  assert.equal(contract.architectureId, ARCHITECTURE)
  assert.equal(contract.executionIdentity.runId, compilationTerminal.reservedSmokeRunId)
  assert.equal(contract.executionIdentity.sampleId, SAMPLE_ID)
  assert.equal(contract.executionIdentity.sampleSplit, "validation")
  assert.equal(contract.executionIdentity.seed, SEED)
  assert.equal(contract.executionIdentity.topology, "west")
  assert.deepEqual(contract.executionIdentity.resolution, { width: 256, height: 192 })
  assert.equal(contract.executionIdentity.epochCount, EPOCH_COUNT)
  assert.deepEqual(contract.executionIdentity.previewEpochs, PREVIEW_EPOCHS)
  assert.equal(contract.internalCapability.ownerAuthorizationRequired, false)
  assert.equal(contract.internalCapability.issueOnlyAfterAllPreflightChecksPass, true)
  assert.equal(contract.outputOwnership.preflightMustNotCreateTrainingOutput, true)
  assert.equal(contract.outputOwnership.trainerCreatesTrainingOutputExactlyOnce, true)
  assert.equal(contract.recoveryBoundary.automaticSecondTrainingRunAllowed, false)
  assert.equal(contract.nextActionMapping.stage0AutomaticStartInsideSmokePackage, false)
  const permittedImplementationSuccessors = []
  const implementationRoles = new Set(["mode-registry", "trainer"])
  for (const binding of contract.sourceEvidence) {
    const sourcePath = inside(binding.path)
    const currentSha256 = sha(sourcePath)
    if (implementationRoles.has(binding.role) && currentSha256 !== binding.sha256) {
      permittedImplementationSuccessors.push({
        role: binding.role,
        path: binding.path,
        compiledPreImplementationSha256: binding.sha256,
        currentImplementedSha256: currentSha256,
        reason: "compiled_contract_authorized_runner_trainer_and_mode_support_implementation",
      })
      continue
    }
    assert.equal(currentSha256, binding.sha256, `compiled source evidence changed: ${binding.role}`)
  }
  assert.equal(sha(DATASET), DATASET_SHA256)
  assert.equal(sha(AUTOENCODER), AUTOENCODER_SHA256)
  const outputNamespace = contract.futureEvidenceNamespace.outputDirectory
  assert.equal(outputNamespace, `.runtime/ai-painter/stage4-full-backbone-spatial-affine-controlled-smokes/${contract.executionIdentity.runId}`)
  return {
    current,
    registryIdentity: {
      registryRevision: registry.registryRevision,
      eventSequence: registry.eventSequence,
      sha256: current.registrySha256,
      transactionId: registry.transactionId,
      planSha256: sha(PLAN),
    },
    compilationTerminal,
    contract,
    contractPath,
    contractSha256: sha(contractPath),
    runId: contract.executionIdentity.runId,
    outputNamespace,
    permittedImplementationSuccessors,
  }
}

function runAllPreflightChecks({ source, contractPath, contractSha256, runId, outputNamespace, paths }) {
  if (fs.existsSync(paths.executionRoot)) assert.deepEqual(fs.readdirSync(paths.executionRoot), [])
  assert.equal(fs.existsSync(paths.trainingOutput), false)
  const cpu = runJson(PYTHON, [CPU_CHECKER], 600_000)
  assert.equal(cpu.status, "stage4_full_backbone_spatial_affine_controlled_smoke_cpu_gate_passed")
  assert.equal(cpu.gpuStarted, false)
  assert.equal(cpu.trainingStarted, false)
  runChecked(PYTHON, ["-m", "py_compile", TRAINER, MATERIALIZER, CPU_CHECKER, RESOURCE_PREFLIGHT], 300_000)

  const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-painter-full-backbone-smoke-preflight-"))
  const templatePath = path.join(workRoot, "preflight-template.json")
  let templateResult
  let trainerPreflight
  let template
  let templateEvidence
  try {
    templateResult = runJson(PYTHON, [
      MATERIALIZER,
      "--operation", "template",
      "--run-id", runId,
      "--output-namespace", outputNamespace,
      "--compiled-contract", contractPath,
      "--compiled-contract-sha256", contractSha256,
      "--output", templatePath,
    ], 300_000)
    assert.equal(templateResult.status, "preflight_template_materialized_without_ticket")
    assert.equal(templateResult.internalTicketIssued, false)
    assert.equal(templateResult.gpuStarted, false)
    assert.equal(templateResult.trainingStarted, false)
    template = read(templatePath)
    templateEvidence = {
      pathScope: "ephemeral_ticket_free_preflight_workspace",
      sha256: sha(templatePath),
      schemaVersion: template.schemaVersion,
      activeConfigPresentDuringPreflight: false,
      deterministicDerivationTarget: projectPath(paths.activeConfig),
    }
    assert.equal(templateResult.configSha256, templateEvidence.sha256)
    assert.equal(template.training.localAiCapabilityTicket, undefined)
    assert.equal(template.training.stage4FullBackboneSpatialAffineSmokeContract.sampleId, SAMPLE_ID)
    assert.equal(template.training.stage4FullBackboneSpatialAffineSmokeContract.epochCount, EPOCH_COUNT)
    assert.deepEqual(template.training.stage4FullBackboneSpatialAffineSmokeContract.previewEpochs, PREVIEW_EPOCHS)
    const preflightProcess = runChecked(
      PYTHON,
      trainerArguments(templatePath, paths.trainingOutput, contractPath, true),
      900_000,
    )
    trainerPreflight = JSON.parse(preflightProcess.stdout)
    assert.equal(trainerPreflight.status, "full_backbone_spatial_affine_controlled_smoke_trainer_preflight_passed")
    assert.equal(fs.existsSync(paths.trainingOutput), false, "Trainer preflight created training-output")
  } finally {
    const resolved = path.resolve(workRoot)
    assert.equal(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep), true)
    fs.rmSync(resolved, { recursive: true, force: false })
  }
  const resources = runJson(PYTHON, [RESOURCE_PREFLIGHT], 300_000)
  assert.equal(resources.status, "passed")
  assert.equal(resources.python.cudaAvailable, true)
  assert.equal(resources.gpuWorkloadStarted, false)
  assert.deepEqual(resources.blockers, [])
  assert.ok(resources.disk.projectFreeBytes >= resources.disk.minimumFreeBytes)
  assert.ok(resources.disk.runtimeFreeBytes >= resources.disk.minimumFreeBytes)
  const packageManifest = read(DATASET)
  const datasetPackageId = packageManifest.packageId
  assert.equal(datasetPackageId, contractDatasetPackageId(source.contract))
  return {
    schemaVersion: "stage4-full-backbone-spatial-affine-controlled-smoke-preflight-report-v1",
    status: "all_preflight_checks_passed",
    runId,
    outputNamespace,
    compiledContract: {
      path: projectPath(contractPath),
      sha256: contractSha256,
      schemaVersion: source.contract.schemaVersion,
      status: source.contract.status,
      compilationRunId: source.contract.compilationRunId,
    },
    checks: {
      cpuPositiveNegativeGate: true,
      activeConfigAudit: true,
      nodeTrainerReadonlyPreflight: true,
      pythonCudaResource: true,
      diskCapacity: true,
      trainingOutputAbsent: true,
    },
    activeConfigAuditEvidence: {
      auditKind: "ticket_free_template_to_future_consumed_active_config_deterministic_derivation",
      templateSchemaVersion: template.schemaVersion,
      templateSha256: templateEvidence.sha256,
      templatePathScope: templateEvidence.pathScope,
      consumedActiveConfigExistedDuringPreflight: false,
      consumedActiveConfigValidationTiming: "after_internal_ticket_consumption_before_trainer_start",
      deterministicDerivationVerifiedByCpuGate: true,
      claimLimitedToPreflightTemplate: true,
    },
    cpuGate: cpu,
    preflightTemplate: {
      schemaVersion: template.schemaVersion,
      sha256: templateResult.configSha256,
      persistedAfterPreflight: false,
      internalTicketIssued: false,
    },
    trainerPreflight,
    resources,
    datasetPackageId,
    datasetManifest: bind(DATASET),
    frozenAutoencoder: bind(AUTOENCODER),
    sourceRegistry: source.registryIdentity,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc: new Date().toISOString(),
  }
}

function trainerArguments(configPath, outputDir, contractPath, preflightOnly) {
  const args = [
    TRAINER,
    "--config", configPath,
    "--dataset-package", DATASET,
    "--autoencoder-checkpoint", AUTOENCODER,
    "--output-dir", outputDir,
    "--resolution-stage", "0",
    "--overfit-sample-id", SAMPLE_ID,
    "--overfit-epochs", String(EPOCH_COUNT),
    "--overfit-evaluation-interval", "5",
    "--stage4-full-backbone-spatial-affine-smoke",
    "--stage4-full-backbone-spatial-affine-smoke-contract", contractPath,
  ]
  if (preflightOnly) args.push("--preflight-only")
  return args
}

function contractDatasetPackageId(contract) {
  const binding = contract.sourceEvidence.find((row) => row.role === "formal-objective-contract")
  assert.ok(binding)
  const formal = read(inside(binding.path))
  assert.equal(sha(inside(binding.path)), binding.sha256)
  return formal.data.datasetPackageId
}

function recoverUntrainedPartialState({
  source,
  contract,
  contractPath,
  contractSha256,
  runId,
  outputNamespace,
  paths,
}) {
  assert.equal(fs.existsSync(paths.trainingOutput), false, "training-output exists; training restart is forbidden")
  const names = fs.readdirSync(paths.executionRoot).sort()
  const allowedStates = [
    [],
    ["preflight-report.json"],
    ["internal-ticket.json", "preflight-report.json"],
    ["internal-ticket-consumption.json", "internal-ticket.json", "preflight-report.json"],
    ["active-config.json", "internal-ticket-consumption.json", "internal-ticket.json", "preflight-report.json"],
  ]
  assert.equal(
    allowedStates.some((state) => JSON.stringify(state) === JSON.stringify(names)),
    true,
    `controlled_smoke_untrained_partial_state_not_recoverable:${names.join(",")}`,
  )
  if (!fs.existsSync(paths.preflight)) {
    return runAllPreflightChecks({
      source,
      contract,
      contractPath,
      contractSha256,
      runId,
      outputNamespace,
      paths,
    })
  }
  const report = read(paths.preflight)
  assert.equal(report.schemaVersion, "stage4-full-backbone-spatial-affine-controlled-smoke-preflight-report-v1")
  assert.equal(report.status, "all_preflight_checks_passed")
  assert.equal(report.runId, runId)
  assert.equal(report.outputNamespace, outputNamespace)
  assert.equal(report.compiledContract.path, projectPath(contractPath))
  assert.equal(report.compiledContract.sha256, contractSha256)
  assert.equal(report.checks.activeConfigAudit, true)
  assert.equal(
    report.activeConfigAuditEvidence?.auditKind,
    "ticket_free_template_to_future_consumed_active_config_deterministic_derivation",
  )
  assert.equal(report.activeConfigAuditEvidence?.consumedActiveConfigExistedDuringPreflight, false)
  assert.equal(report.preflightTemplate?.schemaVersion, report.activeConfigAuditEvidence?.templateSchemaVersion)
  assert.equal(report.gpuStarted, false)
  assert.equal(report.trainingStarted, false)
  verifyBinding(report.datasetManifest)
  verifyBinding(report.frozenAutoencoder)
  assert.equal(report.datasetPackageId, contractDatasetPackageId(contract))
  if (fs.existsSync(paths.activeConfig)) {
    assert.equal(fs.existsSync(paths.ticket), true)
    assert.equal(fs.existsSync(paths.consumption), true)
  }
  return report
}

function verifyPostConsumptionRoot(paths) {
  const actual = new Set(fs.readdirSync(paths.executionRoot))
  const expected = new Set([
    "preflight-report.json",
    "internal-ticket.json",
    "internal-ticket-consumption.json",
    "active-config.json",
  ])
  assert.deepEqual(actual, expected)
  assert.equal(read(paths.consumption).state, "consumed")
  assert.equal(read(paths.consumption).ticketSha256, sha(paths.ticket))
  assert.equal(fs.existsSync(paths.trainingOutput), false)
}

function recordHeartbeat({ paths, runId, processIdentity, monitorRows, startedMs }) {
  const progress = fs.existsSync(paths.progress) ? safeRead(paths.progress) : null
  const gpu = gpuSnapshot()
  const live = progress?.liveProgress ?? progress ?? {}
  const row = {
    recordedAtUtc: new Date().toISOString(),
    epoch: live.epoch ?? progress?.currentEpoch ?? 0,
    epochTarget: live.epochTarget ?? progress?.epochTarget ?? EPOCH_COUNT,
    batch: live.batch ?? progress?.currentBatch ?? null,
    batchTarget: live.batchTarget ?? progress?.batchTarget ?? null,
    optimizerStep: live.optimizerStep ?? progress?.optimizerStep ?? 0,
    optimizerStepTarget: live.optimizerStepTarget ?? progress?.targetOptimizerSteps ?? null,
    phase: live.phase ?? progress?.phase ?? "initializing",
    etaSeconds: live.etaSeconds ?? progress?.etaSeconds ?? null,
    ...gpu,
  }
  monitorRows.push(row)
  writeJsonAtomic(paths.monitorTelemetry, {
    schemaVersion: "stage4-full-backbone-spatial-affine-controlled-smoke-monitor-telemetry-v1",
    status: "recording",
    runId,
    processIdentity,
    rows: monitorRows,
    peakObservedGpuMemoryMiB: Math.max(...monitorRows.map((item) => item.memoryUsedMiB ?? 0)),
    formalTrainingPeakSource: projectPath(paths.trainingTelemetry),
    preflightMemoryIsTrainingPeak: false,
    updatedAtUtc: new Date().toISOString(),
  })
  writeJsonAtomic(paths.heartbeat, {
    schemaVersion: "stage4-full-backbone-spatial-affine-controlled-smoke-heartbeat-v1",
    status: "training_process_active",
    runId,
    processIdentity,
    progress: row,
    elapsedSeconds: Math.round((Date.now() - startedMs) / 1000),
    ownerAuthorizationRequired: false,
    recordedAtUtc: row.recordedAtUtc,
  })
}

async function reviewPreviews({ paths, runId }) {
  const manifest = read(paths.trainingManifest)
  assert.deepEqual(manifest.previewEpochs, PREVIEW_EPOCHS)
  assert.ok(Array.isArray(manifest.fixedPreviews))
  assert.equal(manifest.fixedPreviews.length, PREVIEW_EPOCHS.length)
  assert.deepEqual(manifest.fixedPreviews.map((row) => row.epoch), PREVIEW_EPOCHS)
  const packageManifest = read(DATASET)
  const sourceIndexPath = inside(packageManifest.sourceIndexPath)
  const sourceIndex = read(sourceIndexPath)
  assert.equal(sourceIndex.schemaVersion, "ai-assisted-cold-start-dataset-source-index-v1")
  assert.equal(sourceIndex.sampleCount, sourceIndex.samples.length)
  const matches = sourceIndex.samples.filter((row) => row.sampleId === SAMPLE_ID)
  assert.equal(matches.length, 1)
  const sample = matches[0]
  assert.equal(sample.split, "validation")
  assert.equal(sample.v7CapacityContributionRegistered, true)
  assert.equal(sample.formalConditionalTrainingEligible, true)
  assert.equal(sample.conditionBound, true)
  const conditionPackPath = inside(sample.conditionPackPath)
  const conditionPack = read(conditionPackPath)
  const referenceImagePath = inside(sample.imagePath)
  const reviews = []
  for (const artifact of manifest.fixedPreviews) {
    const epoch = artifact.epoch
    const sourcePath = inside(artifact.path)
    const reproductionPath = inside(artifact.reproductionPath)
    verifyFile(sourcePath, artifact.sha256, `Epoch ${epoch} fixed preview`)
    verifyFile(reproductionPath, artifact.reproductionSha256, `Epoch ${epoch} reproduction`)
    assert.equal(artifact.sha256, artifact.reproductionSha256)
    assert.equal(artifact.byteExactReproduced ?? true, true)
    const normalizedPath = path.join(paths.reviewAssets, `epoch-${String(epoch).padStart(3, "0")}.png`)
    const normalized = await normalizePreviewWithWindowsSafeIo({
      sourcePath,
      finalAssetPath: normalizedPath,
      workRoot: REVIEW_WORK_ROOT,
      workId: shaText(runId).slice(0, 16),
      epoch,
    })
    const [aesthetic, alignment] = await Promise.all([
      auditAiAssistedProfessionalAesthetic(normalized.shortOutputPath),
      auditAiAssistedConditionAlignment({
        record: {
          recordId: `full-backbone-spatial-affine-controlled-smoke-${epoch}`,
          conditionBinding: {
            conditionPackPath: sample.conditionPackPath,
            worldId: conditionPack.worldId,
            tick: conditionPack.tick,
          },
          classification: sample.classification,
        },
        imagePath: normalized.shortOutputPath,
        referenceImagePath,
      }),
    ])
    const issueCodes = [...new Set([
      ...aesthetic.issues.map((item) => item.code),
      ...alignment.issues.map((item) => item.code),
    ])].sort()
    reviews.push({
      epoch,
      previewPath: projectPath(sourcePath),
      previewSha256: sha(sourcePath),
      reproductionPath: projectPath(reproductionPath),
      reproductionSha256: sha(reproductionPath),
      byteExactReproduced: true,
      normalizedPath: projectPath(normalizedPath),
      normalizedSha256: sha(normalizedPath),
      passed: aesthetic.passed === true && alignment.passed === true,
      issueCodes,
      professionalAesthetic: aesthetic,
      conditionAlignment: alignment,
    })
    writeJsonAtomic(paths.machineReview, buildReviewTimeline(runId, reviews, false))
  }
  const completed = buildReviewTimeline(runId, reviews, true)
  writeJsonAtomic(paths.machineReview, completed)
  return completed
}

function buildReviewTimeline(runId, reviews, completed) {
  return {
    schemaVersion: "stage4-full-backbone-spatial-affine-controlled-smoke-machine-review-timeline-v1",
    status: completed
      ? reviews.every((row) => row.passed) ? "machine_reviews_passed" : "machine_reviews_failed"
      : "running",
    runId,
    sampleId: SAMPLE_ID,
    sampleSplit: "validation",
    completedReviewCount: reviews.length,
    targetReviewCount: PREVIEW_EPOCHS.length,
    previewPassCount: reviews.filter((row) => row.passed).length,
    previewFailCount: reviews.filter((row) => !row.passed).length,
    reviewThresholdsChanged: false,
    failedPreviewPixelsUsedAsTrainingTarget: false,
    machineReviewResultsUsedAsTrainingTarget: false,
    reviews,
    updatedAtUtc: new Date().toISOString(),
    ...(completed ? { completedAtUtc: new Date().toISOString() } : {}),
  }
}

function qualifyLateStability(review, runId) {
  const decision = adjudicateLateReviewRows(review.reviews, {
    requiredEpochs: PREVIEW_EPOCHS,
    lateEpochs: LATE_EPOCHS,
  })
  const terminalRows = decision.issueSequence
  const conditionAndObjectEvidencePassed = terminalRows.every((row) => {
    const original = review.reviews.find((item) => item.epoch === row.epoch)
    const alignment = original?.conditionAlignment
    return original?.passed === true
      && alignment?.passed === true
      && Object.values(alignment?.channelAudits ?? {}).every((item) => item?.passed === true)
      && Object.values(alignment?.objectSemanticAudits ?? {}).every((item) => item?.passed === true)
  })
  const qualified = decision.qualified === true && conditionAndObjectEvidencePassed
  return {
    schemaVersion: "stage4-full-backbone-spatial-affine-controlled-smoke-late-stability-qualification-v1",
    status: qualified ? "terminal_pass_with_late_convergence_evidence" : "late_stability_not_qualified",
    runId,
    route: decision.qualificationRoute === "none" ? null : decision.qualificationRoute,
    lateEpochs: terminalRows.map((row) => ({
      epoch: row.epoch,
      passed: row.passed,
      failureCount: row.issueCodes.length,
      failureItems: [...row.issueCodes],
    })),
    sustainedZeroFromFirstLateEpoch: decision.sustainedZeroFromFirstLateEpoch,
    strictDecreaseThenStableZero: decision.strictDecreaseThenStableZero,
    consecutiveTerminalPasses: terminalRows.at(-2)?.passed === true && terminalRows.at(-1)?.passed === true,
    noTerminalRegression: decision.noRegression,
    conditionAndObjectEvidencePassed,
    finalPreviewByteReproductionValid: review.reviews.find((row) => row.epoch === EPOCH_COUNT)?.byteExactReproduced === true,
    qualified,
    thresholdsChanged: false,
    recordedAtUtc: new Date().toISOString(),
  }
}

function normalizeCheckpointIdentity(trainingManifest) {
  const candidate = trainingManifest.checkpoint
    ?? (trainingManifest.checkpointPath && trainingManifest.checkpointSha256
      ? { path: trainingManifest.checkpointPath, sha256: trainingManifest.checkpointSha256 }
      : null)
  assert.ok(candidate && typeof candidate.path === "string" && /^[a-f0-9]{64}$/u.test(candidate.sha256))
  const checkpointPath = inside(candidate.path)
  assert.equal(sha(checkpointPath), candidate.sha256)
  return { path: projectPath(checkpointPath), sha256: candidate.sha256 }
}

async function closeInfrastructureFailure({
  code,
  detail,
  source,
  paths,
  codeIdentity,
  planBeforeSha256,
  trainingStarted,
}) {
  assert.equal(typeof code, "string")
  const recordedAtUtc = new Date().toISOString()
  const runId = source.runId
  const nextLegalAction = source.contract.nextActionMapping.infrastructureFailure
  const checkpoint = discoverExistingCheckpoint(paths)
  const existingFinalization = fs.existsSync(paths.finalization) ? safeRead(paths.finalization) : null
  const failureFinalizationPath = existingFinalization
    && !String(existingFinalization.status ?? "").includes("infrastructure_failed_closed")
    ? paths.infrastructureFailureFinalization
    : paths.finalization
  assert.equal(nextLegalAction, "record_failure_and_close_without_training_retry")
  if (!fs.existsSync(paths.failure)) {
    writeExclusive(paths.failure, {
      schemaVersion: "stage4-full-backbone-spatial-affine-controlled-smoke-infrastructure-failure-v1",
      executionState: "failed_closed",
      status: "stage4_full_backbone_spatial_affine_controlled_smoke_infrastructure_failed_closed",
      capabilityVersion: CAPABILITY,
      architectureId: ARCHITECTURE,
      runId,
      code,
      detail: String(detail),
      trainingStarted,
      trainingManifest: fs.existsSync(paths.trainingManifest) ? bind(paths.trainingManifest) : null,
      checkpointWritten: checkpoint.written,
      checkpoint: checkpoint.identity,
      checkpointPromotable: false,
      partialTrainingArtifactsAccepted: false,
      automaticRetryStarted: false,
      secondTrainingRunStarted: false,
      stage0Started: false,
      ownerAuthorizationRequired: false,
      recordedAtUtc,
    })
  }
  if (!fs.existsSync(failureFinalizationPath)) {
    writeExclusive(failureFinalizationPath, {
      schemaVersion: "stage4-full-backbone-spatial-affine-controlled-smoke-finalization-v1",
      status: "stage4_full_backbone_spatial_affine_controlled_smoke_infrastructure_failed_closed",
      capabilityVersion: CAPABILITY,
      architectureId: ARCHITECTURE,
      runId,
      failureReport: bind(paths.failure),
      preflightReport: fs.existsSync(paths.preflight) ? bind(paths.preflight) : null,
      activeConfig: fs.existsSync(paths.activeConfig) ? bind(paths.activeConfig) : null,
      trainingManifest: fs.existsSync(paths.trainingManifest) ? bind(paths.trainingManifest) : null,
      checkpointWritten: checkpoint.written,
      checkpoint: checkpoint.identity,
      trainingOutputAccepted: false,
      checkpointPromotable: false,
      automaticRetryStarted: false,
      stage0Started: false,
      ownerAuthorizationRequired: false,
      recordedAtUtc,
    })
  }
  if (!fs.existsSync(paths.terminal)) {
    writeExclusive(paths.terminal, {
      schemaVersion: "stage4-full-backbone-spatial-affine-controlled-smoke-terminal-v1",
      executionState: "completed",
      status: "stage4_full_backbone_spatial_affine_controlled_smoke_infrastructure_failed_closed",
      capabilityVersion: CAPABILITY,
      architectureId: ARCHITECTURE,
      runId,
      failureReport: bind(paths.failure),
      finalization: bind(failureFinalizationPath),
      trainingStarted,
      partialTrainingArtifactsAccepted: false,
      checkpointWritten: checkpoint.written,
      checkpoint: checkpoint.identity,
      checkpointPromotable: false,
      modelWeightsModified: checkpoint.written ? true : trainingStarted ? null : false,
      automaticRetryStarted: false,
      secondTrainingRunStarted: false,
      stage0Started: false,
      ownerAuthorizationRequired: false,
      currentFixedProgress: fixedProgress(),
      nextLegalAction,
      recordedAtUtc,
    })
  }
  writeJsonAtomic(paths.executionState, {
    schemaVersion: "stage4-full-backbone-spatial-affine-controlled-smoke-execution-state-v1",
    status: "completed",
    phase: "infrastructure_failed_closed",
    capabilityVersion: CAPABILITY,
    architectureId: ARCHITECTURE,
    runId,
    terminal: bind(paths.terminal),
    ownerAuthorizationRequired: false,
    completedAtUtc: new Date().toISOString(),
  })
  if (!fs.existsSync(paths.capsule)) {
    writeExclusive(paths.capsule, buildCapsule({
      paths,
      runId,
      terminalStatus: read(paths.terminal).status,
      nextLegalAction,
      review: null,
      qualified: false,
    }))
  }
  const journal = prepareProjection({
    source,
    paths,
    runId,
    terminalStatus: read(paths.terminal).status,
    nextLegalAction,
    review: null,
    qualified: false,
    codeIdentity,
    planBeforeSha256,
  })
  const complete = await completeProjection(journal, paths)
  return resultProjection(complete, paths)
}

function discoverExistingCheckpoint(paths) {
  if (!fs.existsSync(paths.trainingManifest)) return { written: false, identity: null }
  try {
    const identity = normalizeCheckpointIdentity(read(paths.trainingManifest))
    return {
      written: true,
      identity: { ...identity, promotable: false, formalStageInitializationAllowed: false },
    }
  } catch {
    return { written: false, identity: null }
  }
}

function buildCapsule({ paths, runId, terminalStatus, nextLegalAction, review, qualified }) {
  const recordedAtUtc = new Date().toISOString()
  const evidenceFiles = [
    paths.preflight,
    paths.activeConfig,
    paths.ticket,
    paths.consumption,
    paths.executionState,
    paths.progress,
    paths.trainingManifest,
    paths.trainingTelemetry,
    paths.machineReview,
    paths.qualification,
    paths.manifest,
    paths.finalization,
    paths.infrastructureFailureFinalization,
    paths.failure,
    paths.terminal,
  ].filter((file) => fs.existsSync(file))
  const infrastructureFailure = terminalStatus.includes("infrastructure_failed_closed")
  const realVisualFailure = terminalStatus.includes("real_visual_failure")
  return {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${runId}`,
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: { ...fixedProgress(), source: "current_execution_registry" },
    currentStage: {
      number: 4,
      total: 5,
      labelZh: "全主干空间仿射受控Smoke",
      status: qualified
        ? "controlled_smoke_qualified"
        : infrastructureFailure
          ? "controlled_smoke_infrastructure_failed_closed"
          : "controlled_smoke_real_visual_failure_closed",
    },
    candidateTerminal: {
      runId,
      status: "completed",
      programStatus: terminalStatus,
      previewMachineStatus: review?.status ?? "not_available",
      modelQualificationStatus: qualified ? "qualified" : "not_qualified",
      previewCount: review?.targetReviewCount ?? null,
      previewPassCount: review?.previewPassCount ?? null,
      previewFailCount: review?.previewFailCount ?? null,
      checkpointWritten: discoverExistingCheckpoint(paths).written,
      modelWeightsModified: discoverExistingCheckpoint(paths).written,
      recordedAtUtc,
      recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
    },
    latestBlocker: qualified
      ? { code: "formal_stage0_contract_not_yet_compiled", summaryZh: "受控Smoke通过；正式Stage 0合同尚未编译或执行。" }
      : infrastructureFailure
        ? { code: terminalStatus, summaryZh: "受控Smoke基础设施失败已关闭；不得自动重新训练。" }
        : realVisualFailure
          ? { code: terminalStatus, summaryZh: "受控Smoke已自然完成，但固定机器审核或后期稳定资格未通过。" }
          : { code: terminalStatus, summaryZh: "受控Smoke未取得Stage 0准入。" },
    nextAllowedAction: {
      code: nextLegalAction,
      labelZh: nextLegalAction,
      ownerAuthorizationRequired: false,
      automaticExecutionAllowed: true,
      planEvidenceConfirmed: true,
    },
    forbiddenActions: [
      "reuse_old_smoke_or_output",
      "reuse_historical_or_failed_denoiser_checkpoint",
      "automatic_training_retry",
      "change_loss_data_or_machine_review_threshold",
      "initialize_stage0_from_smoke_checkpoint",
      "start_stage1_or_stage2",
    ],
    taskIdentity: {
      modelId: ARCHITECTURE,
      sampleId: SAMPLE_ID,
      sampleSplit: "validation",
      seed: SEED,
      requiredBoundarySides: ["west"],
      resolution: { width: 256, height: 192 },
      epochCount: EPOCH_COUNT,
      previewEpochs: [...PREVIEW_EPOCHS],
    },
    evidence: evidenceFiles.map((file) => ({
      kind: path.basename(file, path.extname(file)),
      labelZh: path.basename(file),
      ...bind(file),
      expectedSha256: sha(file),
      sha256Verified: true,
      recordedAtUtc,
      recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
    })),
    integrity: {
      status: "verified",
      requiredEvidencePresent: true,
      boundEvidenceVerified: true,
      identityMatches: true,
      migrationRegistryStatus: "current_execution_registry_active",
    },
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
  }
}

function prepareProjection({
  source,
  paths,
  runId,
  terminalStatus,
  nextLegalAction,
  review,
  qualified,
  codeIdentity,
  planBeforeSha256,
}) {
  if (fs.existsSync(paths.projectionJournal)) return read(paths.projectionJournal)
  assert.equal(sha(PLAN), planBeforeSha256, "unique plan changed before projection preparation")
  assert.equal(planBeforeSha256, source.registryIdentity.planSha256)
  const recordedAtUtc = new Date().toISOString()
  const initial = {
    schemaVersion: "stage4-full-backbone-spatial-affine-controlled-smoke-projection-transaction-v1",
    transactionId: runId,
    runId,
    state: "projection_preparing",
    journalPath: projectPath(paths.projectionJournal),
    transactionRoot: projectPath(paths.transactionRoot),
    sourceRegistry: {
      registryRevision: source.registryIdentity.registryRevision,
      eventSequence: source.registryIdentity.eventSequence,
      sha256: source.registryIdentity.sha256,
      transactionId: source.registryIdentity.transactionId,
      taskId: SOURCE_TASK,
      planSha256: source.registryIdentity.planSha256,
    },
    codeIdentity,
    terminalStatus,
    nextLegalAction,
    qualificationOutcome: qualified ? "qualified" : "failed_closed",
    reviewSummary: review ? {
      status: review.status,
      previewCount: review.targetReviewCount,
      previewPassCount: review.previewPassCount,
      previewFailCount: review.previewFailCount,
    } : null,
    planBeforeSha256,
    terminal: bind(paths.terminal),
    capsule: bind(paths.capsule),
    ownerAuthorizationRequired: false,
    recordedAtUtc,
    updatedAtUtc: recordedAtUtc,
  }
  writeJournal(paths.projectionJournal, initial)
  return finishProjectionPreparation(read(paths.projectionJournal), paths)
}

function finishProjectionPreparation(initial, paths) {
  if (initial.state !== "projection_preparing") return initial
  assert.equal(initial.runId, path.basename(paths.executionRoot))
  assertCodeIdentityUnchanged(initial.codeIdentity)
  fs.mkdirSync(TRANSACTION_PARENT, { recursive: true })
  if (!fs.existsSync(paths.transactionRoot)) fs.mkdirSync(paths.transactionRoot, { recursive: false })
  const planSource = fs.readFileSync(PLAN, "utf8")
  assert.equal(shaText(planSource), initial.planBeforeSha256)
  const terminal = read(paths.terminal)
  const nextPlan = updateUniquePlan(planSource, terminal, initial.reviewSummary)
  writeTextIdempotent(paths.stagedPlan, nextPlan)
  const planAfterSha256 = sha(paths.stagedPlan)
  const receiptRecord = {
    schemaVersion: "stage4-full-backbone-spatial-affine-controlled-smoke-plan-commit-receipt-v1",
    status: "prepared_for_atomic_projection",
    runId: initial.runId,
    planPath: projectPath(PLAN),
    beforeSha256: initial.planBeforeSha256,
    afterSha256: planAfterSha256,
    terminal: bind(paths.terminal),
    recordedAtUtc: initial.recordedAtUtc,
  }
  ensureJson(paths.planReceipt, receiptRecord)
  ensureJson(paths.planSync, {
    schemaVersion: "stage4-full-backbone-spatial-affine-controlled-smoke-plan-sync-v1",
    status: "prepared_for_atomic_projection",
    runId: initial.runId,
    planPath: projectPath(PLAN),
    beforeSha256: initial.planBeforeSha256,
    afterSha256: planAfterSha256,
    planCommitReceipt: bind(paths.planReceipt),
    terminal: bind(paths.terminal),
    nextLegalAction: initial.nextLegalAction,
    currentFixedProgress: fixedProgress(),
    recordedAtUtc: initial.recordedAtUtc,
  })
  sealRuntimeProjectionFiles(paths, terminal)
  const programEvent = buildProgramEvent(initial, terminal)
  const registryAdvance = buildRegistryAdvance(initial, paths, terminal)
  const catalogFiles = walkFiles(paths.executionRoot)
    .filter((file) => file !== paths.projectionJournal && file !== paths.commitMarker)
    .map(projectPath)
  const artifacts = catalogFiles.map((file) => bind(inside(file)))
  return transition(paths.projectionJournal, initial, "artifacts_ready", {
    plan: {
      path: projectPath(PLAN),
      stagedPath: projectPath(paths.stagedPlan),
      beforeSha256: initial.planBeforeSha256,
      afterSha256: planAfterSha256,
      receiptPath: projectPath(paths.planReceipt),
      receiptSha256: sha(paths.planReceipt),
    },
    artifacts,
    catalogFiles,
    programEvent,
    registryAdvance,
  })
}

async function completeProjection(initial, paths) {
  let journal = initial
  if (journal.state === "projection_preparing") journal = finishProjectionPreparation(journal, paths)
  verifyProjectionIdentity(journal, paths)
  if (journal.state === "artifacts_ready") {
    assertCodeIdentityUnchanged(journal.codeIdentity)
    ensurePlanCommitted(journal)
    journal = transition(paths.projectionJournal, journal, "plan_committed", {
      planCommittedAtUtc: new Date().toISOString(),
    })
  }
  if (journal.state === "plan_committed") {
    verifyPlanCommitted(journal)
    const event = ensureAiPainterProgramEventCommitted(journal.programEvent)
    verifyProgramEventIdentity(event, journal.programEvent)
    const eventCommit = verifyAiPainterProgramEventCommitted(event)
    journal = transition(paths.projectionJournal, journal, "event_committed", {
      programEvent: event,
      eventCommit,
    })
  }
  if (journal.state === "event_committed") {
    verifyPlanCommitted(journal)
    const eventCommit = verifyAiPainterProgramEventCommitted(journal.programEvent)
    for (const relative of journal.catalogFiles) index(inside(relative), journal.runId)
    const catalogCommit = verifyCatalogFiles(journal)
    journal = transition(paths.projectionJournal, journal, "dependencies_committed", {
      eventCommit,
      catalogCommit,
    })
  }
  if (journal.state === "dependencies_committed") {
    verifyProjectionDependencies(journal)
    const registryPrepare = await ensureRegistryPrepared(journal)
    journal = transition(paths.projectionJournal, journal, "registry_prepared", { registryPrepare })
  }
  if (journal.state === "registry_prepared") {
    verifyProjectionDependencies(journal)
    const registryCommit = await ensureRegistryPublished(journal)
    const markerRecord = buildProjectionCommitMarker(journal, registryCommit)
    journal = transition(paths.projectionJournal, journal, "registry_committed", {
      registryCommit,
      markerRecord,
    })
  }
  if (journal.state === "registry_committed") {
    await verifyRegistryPublished(journal)
    verifyProjectionDependencies(journal)
    ensureJson(paths.commitMarker, journal.markerRecord)
    index(paths.commitMarker, journal.runId)
    verifyCatalogBinding(paths.commitMarker)
    journal = transition(paths.projectionJournal, journal, "complete", {
      commitMarker: bind(paths.commitMarker),
      completedAtUtc: new Date().toISOString(),
    })
  }
  assert.equal(journal.state, "complete")
  verifyProjectionComplete(journal, paths)
  return journal
}

function buildProgramEvent(journal, terminal) {
  const qualified = journal.qualificationOutcome === "qualified"
  const infrastructureFailure = terminal.status.includes("infrastructure_failed_closed")
  const review = journal.reviewSummary
  return {
    id: `stage4-full-backbone-spatial-affine-controlled-smoke-${journal.runId}`,
    timestamp: terminal.recordedAtUtc ?? new Date().toISOString(),
    action: qualified
      ? "stage4_full_backbone_spatial_affine_controlled_smoke_qualified"
      : infrastructureFailure
        ? "stage4_full_backbone_spatial_affine_controlled_smoke_infrastructure_failed_closed"
        : "stage4_full_backbone_spatial_affine_controlled_smoke_real_visual_failure",
    runId: journal.runId,
    kind: "controlled_smoke",
    status: qualified ? "success" : "failed_closed",
    title: "Stage4 full-backbone spatial-affine controlled Smoke completed",
    titleZh: qualified
      ? "Stage4全主干空间仿射受控Smoke及自动审核通过"
      : infrastructureFailure
        ? "Stage4全主干空间仿射受控Smoke基础设施失败关闭"
        : "Stage4全主干空间仿射受控Smoke真实视觉失败关闭",
    detailZh: infrastructureFailure
      ? "执行基础设施失败证据已保存并关闭；未自动重新训练。"
      : `30 Epoch训练与自动审核闭环完成；机器审核${review?.previewPassCount ?? 0}/${review?.previewCount ?? PREVIEW_EPOCHS.length}。`,
    evidencePath: projectPath(pathsForTerminal(journal).terminal),
    evidenceSha256: journal.terminal.sha256,
    fixedTotalProgress: fixedProgress(),
  }
}

function pathsForTerminal(journal) {
  return { terminal: inside(journal.terminal.path) }
}

function buildRegistryAdvance(journal, paths, terminal) {
  const qualified = journal.qualificationOutcome === "qualified"
  const infrastructureFailure = terminal.status.includes("infrastructure_failed_closed")
  const latestTrainingTerminal = buildLatestTrainingTerminal(paths, terminal)
  return {
    capabilityVersion: CAPABILITY,
    packageId: journal.runId,
    taskId: journal.nextLegalAction,
    taskKind: qualified
      ? "formal_stage0_contract_compilation"
      : infrastructureFailure
        ? "controlled_smoke_infrastructure_failure_closure"
        : "cpu_readonly_smoke_failure_classification",
    runId: journal.runId,
    lifecycleStage: qualified
      ? "controlled_smoke_qualified_stage0_contract_pending"
      : infrastructureFailure
        ? "controlled_smoke_infrastructure_failed_closed"
        : "controlled_smoke_real_visual_failure_closed",
    executionState: "completed",
    activity: qualified
      ? "controlled_smoke_qualified_stage0_not_started"
      : infrastructureFailure
        ? "controlled_smoke_infrastructure_failure_recorded_no_retry"
        : "controlled_smoke_real_visual_failure_recorded",
    taskCapsulePath: projectPath(paths.capsule),
    terminalEvidencePath: projectPath(paths.terminal),
    ...(latestTrainingTerminal ? { latestTrainingTerminal } : {}),
    expectedPreviousRegistryRevision: journal.sourceRegistry.registryRevision,
    expectedPreviousRegistrySha256: journal.sourceRegistry.sha256,
  }
}

function buildLatestTrainingTerminal(paths, terminal) {
  if (terminal.trainingStarted !== true) return null
  const evidence = {}
  for (const [kind, file] of Object.entries({
    executionState: paths.executionState,
    trainingProgress: paths.progress,
    resourceTelemetry: paths.trainingTelemetry,
    machineReviewTimeline: paths.machineReview,
    lateStabilityQualification: paths.qualification,
  })) {
    evidence[kind] = fs.existsSync(file) ? bind(file) : null
  }
  return {
    runId: terminal.runId,
    path: projectPath(paths.terminal),
    sha256: sha(paths.terminal),
    status: terminal.status,
    evidence,
  }
}

function updateUniquePlan(source, terminal, reviewSummary) {
  const qualified = terminal.status.endsWith("_qualified")
  const infrastructureFailure = terminal.status.includes("infrastructure_failed_closed")
  const time = formatShanghai(terminal.recordedAtUtc ?? new Date().toISOString())
    .replace("T", " ")
    .replace("+08:00", " +08:00")
  const status = qualified
    ? "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4全主干空间仿射受控Smoke通过，正式Stage 0合同待编译"
    : infrastructureFailure
      ? "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4全主干空间仿射受控Smoke基础设施失败关闭，禁止自动重训"
      : "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4全主干空间仿射受控Smoke真实视觉失败，CPU只读分类待执行"
  const currentState = qualified
    ? "固定进度3/5（60%）；全主干空间仿射候选30 Epoch受控Smoke、固定预览复现、自动机器审核及后期稳定资格通过；正式Stage 0尚未启动"
    : infrastructureFailure
      ? "固定进度3/5（60%）；全主干空间仿射受控Smoke发生基础设施失败并已保存证据关闭；未自动重训，部分产物不得作为成功证据"
      : `固定进度3/5（60%）；全主干空间仿射候选30 Epoch受控Smoke自然完成，机器审核${reviewSummary?.previewPassCount ?? 0}/${reviewSummary?.previewCount ?? PREVIEW_EPOCHS.length}，真实视觉失败并关闭`
  const next = qualified
    ? "下一步由本地程序编译全主干空间仿射正式Stage 0执行合同；Smoke Checkpoint不得作为Stage 0初始化"
    : infrastructureFailure
      ? "本次训练不得自动重试；仅允许基于已保存证据完成同包基础设施失败分类或保持关闭"
      : "下一步仅对本次不可变Smoke证据执行CPU只读失败边界分类；不得重跑、调参或降低审核阈值"
  const section = qualified
    ? "全主干空间仿射候选已从固定随机初始化完成一次30 Epoch受控Smoke。Epoch 1/5/10/20/30固定预览及字节级复现、正式机器审核、后期稳定资格、Manifest、Finalization和终态均已形成，且未读取历史或失败Denoiser Checkpoint。\n\n该结果仅取得正式Stage 0合同编译准入，固定进度仍为3/5（60%）。下一步由本地程序编译并执行同一候选的全新Stage 0；受控Smoke Checkpoint不可晋级或作为Stage 0初始化，Stage 1/2不得提前启动。"
    : infrastructureFailure
      ? "全主干空间仿射受控Smoke在执行基础设施边界内失败，失败报告、Finalization和终态已保存并原子投影；未自动启动第二次训练，任何部分训练产物均不得作为成功、资格或Checkpoint晋级证据。\n\n固定进度保持3/5（60%）。本次训练不得自动重试；只允许本地程序基于已保存证据执行不扩大训练范围的基础设施失败分类或保持正式关闭。"
      : `全主干空间仿射候选已从固定随机初始化自然完成一次30 Epoch受控Smoke，Epoch 1/5/10/20/30固定预览均完成字节级复现；正式机器审核为${reviewSummary?.previewPassCount ?? 0}/${reviewSummary?.previewCount ?? PREVIEW_EPOCHS.length}，后期稳定资格未通过，结果按真实视觉失败保存并关闭。\n\n固定进度保持3/5（60%）。下一步只允许本地程序对本次不可变训练、预览、机器审核和后期稳定证据执行CPU只读失败边界分类；不得自动重跑、自由调参、修改Loss/数据/阈值、复用Smoke Checkpoint或启动Stage 0/1/2。`
  let output = replaceOnce(source, /^更新时间：.*$/mu, `更新时间：${time}`)
  output = replaceOnce(output, /^状态：.*$/mu, status)
  output = replaceOnce(output, /^\| 2 \| AI Painter R5 \/ Stage4 \|.*$/mu,
    `| 2 | AI Painter R5 / Stage4 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标 | ${currentState} | ${next} |`)
  output = replaceOnce(output, /## 5\. 当前阻断与后续实施顺序[\s\S]*?(?=\n## 6\.)/u,
    `## 5. 当前阻断与后续实施顺序\n\n${section}\n`)
  return output
}

function ensurePlanCommitted(journal) {
  assert.equal(sha(inside(journal.plan.stagedPath)), journal.plan.afterSha256)
  const current = sha(PLAN)
  if (current === journal.plan.beforeSha256) {
    writeAtomicText(PLAN, fs.readFileSync(inside(journal.plan.stagedPath), "utf8"))
  } else {
    assert.equal(current, journal.plan.afterSha256, "unique plan changed outside the Smoke transaction")
  }
  verifyPlanCommitted(journal)
}

function verifyPlanCommitted(journal) {
  assert.equal(sha(PLAN), journal.plan.afterSha256)
  assert.equal(sha(inside(journal.plan.receiptPath)), journal.plan.receiptSha256)
}

function verifyProjectionIdentity(journal, paths) {
  assert.equal(journal.schemaVersion, "stage4-full-backbone-spatial-affine-controlled-smoke-projection-transaction-v1")
  assert.equal(journal.transactionId, journal.runId)
  assert.equal(journal.runId, path.basename(paths.executionRoot))
  assert.equal(journal.journalPath, projectPath(paths.projectionJournal))
  assert.equal(journal.transactionRoot, projectPath(paths.transactionRoot))
  assert.ok(Number.isInteger(journal.sourceRegistry.registryRevision) && journal.sourceRegistry.registryRevision >= 46)
  assert.equal(journal.sourceRegistry.eventSequence, journal.sourceRegistry.registryRevision)
  assert.equal(journal.sourceRegistry.taskId, SOURCE_TASK)
  assert.equal(journal.registryAdvance.expectedPreviousRegistryRevision, journal.sourceRegistry.registryRevision)
  assert.equal(journal.registryAdvance.expectedPreviousRegistrySha256, journal.sourceRegistry.sha256)
  assert.equal(journal.registryAdvance.runId, journal.runId)
  assert.equal(journal.registryAdvance.terminalEvidencePath, projectPath(paths.terminal))
  assert.equal(journal.registryAdvance.taskCapsulePath, projectPath(paths.capsule))
  assert.equal(journal.programEvent.evidencePath, projectPath(paths.terminal))
  assert.equal(journal.programEvent.evidenceSha256, sha(paths.terminal))
  for (const binding of journal.artifacts) verifyBinding(binding)
}

function verifyProjectionDependencies(journal) {
  verifyPlanCommitted(journal)
  const eventCommit = verifyAiPainterProgramEventCommitted(journal.programEvent)
  assert.deepEqual(eventCommit.event, journal.programEvent)
  verifyCatalogFiles(journal)
}

async function ensureRegistryPrepared(journal) {
  const claimPath = inside(".runtime/ai-painter/current-execution-registry/writer.claim.json")
  if (fs.existsSync(claimPath)) {
    const claim = read(claimPath)
    const pendingPath = inside(`.runtime/ai-painter/current-execution-registry/transactions/${claim.transactionId}/transaction.pending.json`)
    const pending = read(pendingPath)
    const staged = read(inside(pending.currentStaged.path))
    assert.equal(staged.runId, journal.runId)
    assert.equal(staged.taskId, journal.nextLegalAction)
    assert.equal(pending.previousCurrentSha256, journal.sourceRegistry.sha256)
    return { transactionId: claim.transactionId, recoveredFromDurablePrepare: true }
  }
  const current = await readCurrentExecutionRegistry(ROOT)
  assert.equal(current.ok, true, current.errorCode)
  assert.equal(current.registry.registryRevision, journal.sourceRegistry.registryRevision)
  assert.equal(current.registrySha256, journal.sourceRegistry.sha256)
  return prepareCurrentExecutionRegistryAdvance({
    ...journal.registryAdvance,
    projectRoot: ROOT,
    dependencyManifest: buildRegistryDependencyManifest(journal),
  })
}

async function ensureRegistryPublished(journal) {
  const current = await readCurrentExecutionRegistry(ROOT)
  if (current.ok && current.registry.runId === journal.runId && current.registry.taskId === journal.nextLegalAction) {
    return registryIdentity(current)
  }
  try {
    const published = await finalizePreparedCurrentExecutionRegistryAdvance({
      projectRoot: ROOT,
      transactionId: journal.registryPrepare.transactionId,
    })
    assert.equal(published.ok, true, published.errorCode)
    return registryIdentity(published)
  } catch (error) {
    const message = String(error?.message ?? error)
    if (!message.includes("registry_writer_claim_not_owned_by_current_process")
      && !message.includes("registry_writer_claim_process_identity_mismatch")) throw error
    const recovered = await recoverPreparedCurrentExecutionRegistryAdvance({
      projectRoot: ROOT,
      transactionId: journal.registryPrepare.transactionId,
    })
    assert.equal(recovered.ok, true, recovered.errorCode)
    return registryIdentity(recovered)
  }
}

async function verifyRegistryPublished(journal) {
  const current = await readCurrentExecutionRegistry(ROOT)
  assert.equal(current.ok, true, current.errorCode)
  assert.equal(current.registry.registryRevision, journal.sourceRegistry.registryRevision + 1)
  assert.equal(current.registry.eventSequence, journal.sourceRegistry.eventSequence + 1)
  assert.equal(current.registrySha256, journal.registryCommit.registrySha256)
  assert.equal(current.registry.runId, journal.runId)
  assert.equal(current.registry.taskId, journal.nextLegalAction)
  assert.equal(current.registry.terminalEvidence.path, journal.registryAdvance.terminalEvidencePath)
  assert.equal(current.registry.terminalEvidence.sha256, journal.terminal.sha256)
}

function buildRegistryDependencyManifest(journal) {
  const catalogArtifacts = new Map(journal.catalogCommit.artifacts.map((item) => [item.logicalPath, item]))
  for (const artifact of [journal.eventCommit.catalog.ledgerArtifact, journal.eventCommit.catalog.latestArtifact]) {
    catalogArtifacts.set(artifact.path, { logicalPath: artifact.path, sha256: artifact.sha256 })
  }
  return {
    schemaVersion: "ai-painter-current-execution-registry-dependency-manifest-v1",
    mode: "external",
    outerJournal: { path: journal.journalPath, requiredState: "registry_prepared" },
    bindings: [
      { role: "committed-plan", path: journal.plan.path, sha256: journal.plan.afterSha256 },
      { role: "plan-commit-receipt", path: journal.plan.receiptPath, sha256: journal.plan.receiptSha256 },
      ...journal.artifacts.map((item, index) => ({ role: `controlled-smoke-artifact-${index}`, ...item })),
    ],
    programEvent: {
      eventId: journal.programEvent.id,
      event: journal.programEvent,
      ledgerPath: journal.eventCommit.ledger.path,
      latestPath: journal.eventCommit.latest.path,
      catalogDatabasePath: path.resolve(catalogPath),
    },
    catalogArtifacts: [...catalogArtifacts.values()].map((item) => ({
      logicalPath: item.logicalPath,
      sha256: item.sha256,
    })),
  }
}

function buildProjectionCommitMarker(journal, registryCommit) {
  const terminal = read(inside(journal.terminal.path))
  return {
    schemaVersion: "stage4-full-backbone-spatial-affine-controlled-smoke-commit-marker-v1",
    status: "committed",
    transactionId: journal.transactionId,
    runId: journal.runId,
    qualificationOutcome: journal.qualificationOutcome,
    terminal: journal.terminal,
    plan: { path: journal.plan.path, sha256: journal.plan.afterSha256 },
    programEvent: {
      id: journal.programEvent.id,
      evidencePath: journal.programEvent.evidencePath,
      evidenceSha256: journal.programEvent.evidenceSha256,
    },
    registry: registryCommit,
    codeIdentity: journal.codeIdentity,
    nextLegalAction: journal.nextLegalAction,
    currentFixedProgress: fixedProgress(),
    ownerAuthorizationRequired: false,
    automaticRetryPerformed: false,
    trainingStarted: terminal.trainingStarted === true,
    stage0Started: false,
    recordedAtUtc: new Date().toISOString(),
  }
}

function verifyProjectionComplete(journal, paths) {
  assert.equal(journal.state, "complete")
  assert.equal(journal.commitMarker.path, projectPath(paths.commitMarker))
  assert.equal(sha(paths.commitMarker), journal.commitMarker.sha256)
  assert.deepEqual(read(paths.commitMarker), journal.markerRecord)
  assert.equal(read(paths.commitMarker).registry.registrySha256, journal.registryCommit.registrySha256)
  assert.equal(read(paths.commitMarker).terminal.sha256, journal.terminal.sha256)
}

function verifyProgramEventIdentity(actual, expected) {
  for (const key of [
    "id", "timestamp", "action", "runId", "kind", "status", "title", "titleZh",
    "detailZh", "evidencePath", "evidenceSha256", "fixedTotalProgress",
  ]) assert.deepEqual(actual[key], expected[key])
}

function verifyCatalogFiles(journal) {
  const database = openStorageCatalog()
  const artifacts = []
  for (const relative of journal.catalogFiles) {
    const file = inside(relative)
    const logicalPath = logicalProjectPath(file)
    const stat = fs.statSync(file)
    const digest = sha(file)
    const row = database.prepare("SELECT byte_size, sha256 FROM artifacts WHERE logical_path = ?").get(logicalPath)
    assert.notEqual(row, undefined, `catalog artifact missing: ${logicalPath}`)
    assert.equal(Number(row.byte_size), stat.size)
    assert.equal(row.sha256, digest)
    artifacts.push({ logicalPath, byteSize: stat.size, sha256: digest })
  }
  return { status: "verified", artifactCount: artifacts.length, artifacts }
}

function verifyCatalogBinding(file) {
  const database = openStorageCatalog()
  const logicalPath = logicalProjectPath(file)
  const row = database.prepare("SELECT byte_size, sha256 FROM artifacts WHERE logical_path = ?").get(logicalPath)
  assert.notEqual(row, undefined, `catalog artifact missing: ${logicalPath}`)
  assert.equal(Number(row.byte_size), fs.statSync(file).size)
  assert.equal(row.sha256, sha(file))
}

function index(file, runId) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId,
    artifactType: "stage4_full_backbone_spatial_affine_controlled_smoke_v1",
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: sha(file),
  })
}

function resultProjection(journal, paths) {
  const terminal = read(paths.terminal)
  return {
    schemaVersion: "stage4-full-backbone-spatial-affine-controlled-smoke-result-v1",
    status: terminal.status,
    runId: journal.runId,
    transactionState: journal.state,
    terminal: bind(paths.terminal),
    manifest: fs.existsSync(paths.manifest) ? bind(paths.manifest) : null,
    machineReviewTimeline: fs.existsSync(paths.machineReview) ? bind(paths.machineReview) : null,
    lateStabilityQualification: fs.existsSync(paths.qualification) ? bind(paths.qualification) : null,
    resourceTelemetry: fs.existsSync(paths.trainingTelemetry) ? bind(paths.trainingTelemetry) : null,
    commitMarker: journal.commitMarker,
    currentRegistryRevision: journal.registryCommit.registryRevision,
    currentRegistrySha256: journal.registryCommit.registrySha256,
    currentFixedProgress: fixedProgress(),
    nextLegalAction: journal.nextLegalAction,
    ownerAuthorizationRequired: false,
    automaticRetryPerformed: false,
    stage0Started: false,
  }
}

function outputPaths(executionRoot) {
  const runId = path.basename(executionRoot)
  const trainingOutput = path.join(executionRoot, "training-output")
  const transactionRoot = path.join(TRANSACTION_PARENT, runId)
  return {
    executionRoot,
    trainingOutput,
    progress: path.join(trainingOutput, "progress.json"),
    trainingManifest: path.join(trainingOutput, "manifest.json"),
    trainingTelemetry: path.join(trainingOutput, "resource-telemetry.json"),
    fixedPreviews: path.join(trainingOutput, "fixed-epoch-previews"),
    preflight: path.join(executionRoot, "preflight-report.json"),
    ticket: path.join(executionRoot, "internal-ticket.json"),
    consumption: path.join(executionRoot, "internal-ticket-consumption.json"),
    activeConfig: path.join(executionRoot, "active-config.json"),
    executionState: path.join(executionRoot, "execution-state.json"),
    heartbeat: path.join(executionRoot, "heartbeat.json"),
    monitorTelemetry: path.join(executionRoot, "monitor-resource-telemetry.json"),
    stdout: path.join(executionRoot, "trainer.stdout.log"),
    stderr: path.join(executionRoot, "trainer.stderr.log"),
    reviewAssets: path.join(executionRoot, "review-assets"),
    machineReview: path.join(executionRoot, "machine-review-timeline.json"),
    qualification: path.join(executionRoot, "late-stability-qualification.json"),
    manifest: path.join(executionRoot, "manifest.json"),
    finalization: path.join(executionRoot, "finalization", "finalization.json"),
    infrastructureFailureFinalization: path.join(executionRoot, "finalization", "infrastructure-failure-finalization.json"),
    failure: path.join(executionRoot, "failure-report.json"),
    terminal: path.join(executionRoot, "phase-terminal.json"),
    capsule: path.join(executionRoot, "local-task-capsule.json"),
    planReceipt: path.join(executionRoot, "plan-commit-receipt.json"),
    planSync: path.join(executionRoot, "plan-sync-record.json"),
    commitMarker: path.join(executionRoot, "transaction-commit-marker.json"),
    projectionJournal: path.join(executionRoot, "outer-transaction.json"),
    transactionRoot,
    stagedPlan: path.join(transactionRoot, "next-plan.md"),
  }
}

function freezeCodeIdentity() {
  const files = {
    runner: inside("scripts/run-ai-painter-stage4-full-backbone-spatial-affine-controlled-smoke.mjs"),
    trainer: TRAINER,
    materializer: MATERIALIZER,
    cpuChecker: CPU_CHECKER,
    resourcePreflight: RESOURCE_PREFLIGHT,
    modelFactory: inside("ml/ai-painter/src/ai_painter/complete_world/model.py"),
    modeRegistry: inside("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"),
    authorizationPolicy: inside("ml/ai-painter/scripts/ai_painter_authorization_policy.py"),
    architectureContract: inside("ml/ai-painter/scripts/ai_painter_full_backbone_spatial_affine_contract.py"),
    formalReviewInput: inside("ml/ai-painter/src/ai_painter/complete_world/stage4_formal_review_input.py"),
    professionalAesthetic: inside("scripts/lib/ai-assisted-professional-aesthetic.mjs"),
    conditionAlignment: inside("scripts/lib/ai-assisted-condition-alignment.mjs"),
    previewNormalizer: inside("scripts/lib/ai-assisted-v7-r5-stage3-preview-review.mjs"),
    lateQualification: inside("scripts/lib/ai-painter-stage4-late-convergence-qualification.mjs"),
    eventStore: inside("scripts/lib/ai-painter-program-event-store.mjs"),
    registryHelper: inside("src/server/ai-painter-current-execution-registry.mjs"),
  }
  return Object.fromEntries(Object.entries(files).map(([key, file]) => [key, bind(file)]))
}

function assertCodeIdentityUnchanged(identity) {
  for (const binding of Object.values(identity)) verifyBinding(binding)
}

function sealRuntimeProjectionFiles(paths, terminal) {
  if (fs.existsSync(paths.monitorTelemetry)) {
    const monitor = read(paths.monitorTelemetry)
    writeJsonAtomic(paths.monitorTelemetry, {
      ...monitor,
      status: "completed",
      terminal: bind(paths.terminal),
      completedAtUtc: new Date().toISOString(),
    })
  }
  if (fs.existsSync(paths.heartbeat)) {
    const heartbeat = read(paths.heartbeat)
    writeJsonAtomic(paths.heartbeat, {
      ...heartbeat,
      status: "training_process_exited",
      terminalStatus: terminal.status,
      terminal: bind(paths.terminal),
      recordedAtUtc: new Date().toISOString(),
    })
  }
}

function runChecked(command, args, timeout, allowFailure = false) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env: pythonEnv(),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    timeout,
  })
  if (!allowFailure && (result.error || result.status !== 0)) {
    throw result.error ?? new Error(`${command} exited ${result.status}: ${result.stderr || result.stdout}`)
  }
  return result
}

function runJson(command, args, timeout) {
  const result = runChecked(command, args, timeout)
  const output = String(result.stdout ?? "").trim()
  const start = output.indexOf("{")
  const end = output.lastIndexOf("}")
  assert.ok(start >= 0 && end >= start, `${path.basename(command)} returned no JSON object`)
  return JSON.parse(output.slice(start, end + 1))
}

function pythonEnv() {
  const values = [inside("ml/ai-painter/src"), inside("ml/ai-painter/scripts")]
  if (process.env.PYTHONPATH) values.push(process.env.PYTHONPATH)
  return { ...process.env, PYTHONUTF8: "1", PYTHONPATH: values.join(path.delimiter) }
}

function gpuSnapshot() {
  const result = runChecked("nvidia-smi", [
    "--query-gpu=name,utilization.gpu,memory.used,memory.free,memory.total",
    "--format=csv,noheader,nounits",
  ], 30_000, true)
  if (result.error || result.status !== 0) {
    return {
      name: null,
      utilizationPercent: null,
      memoryUsedMiB: null,
      memoryFreeMiB: null,
      memoryTotalMiB: null,
      queryStatus: "unavailable",
    }
  }
  const values = String(result.stdout).trim().split(",").map((value) => value.trim())
  return {
    name: values[0] || null,
    utilizationPercent: numberOrNull(values[1]),
    memoryUsedMiB: numberOrNull(values[2]),
    memoryFreeMiB: numberOrNull(values[3]),
    memoryTotalMiB: numberOrNull(values[4]),
    queryStatus: "available",
  }
}

function numberOrNull(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function walkFiles(root) {
  const files = []
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isSymbolicLink()) throw new Error(`symlink evidence is forbidden: ${projectPath(file)}`)
      if (entry.isDirectory()) visit(file)
      else if (entry.isFile()) files.push(file)
    }
  }
  visit(root)
  return files.sort((left, right) => projectPath(left).localeCompare(projectPath(right)))
}

function verifyBinding(binding) {
  assert.ok(binding && typeof binding.path === "string")
  assert.match(binding.sha256, /^[a-f0-9]{64}$/u)
  const file = inside(binding.path)
  assert.equal(fs.existsSync(file), true, `bound file missing: ${binding.path}`)
  assert.equal(sha(file), binding.sha256, `bound SHA-256 mismatch: ${binding.path}`)
}

function verifyFile(file, expectedSha256, label) {
  assert.equal(fs.existsSync(file), true, `${label} missing`)
  assert.equal(sha(file), expectedSha256, `${label} SHA-256 mismatch`)
}

function bind(file) {
  return { path: projectPath(file), sha256: sha(file) }
}

function registryIdentity(current) {
  return {
    registryRevision: current.registry.registryRevision,
    eventSequence: current.registry.eventSequence,
    registrySha256: current.registrySha256,
    transactionId: current.registry.transactionId,
  }
}

function fixedProgress() {
  return { completedStages: 3, totalStages: 5, percent: 60 }
}

function inside(relative) {
  assert.equal(path.isAbsolute(relative), false, `absolute project path is forbidden: ${relative}`)
  assert.doesNotMatch(relative, /(^|[\\/])\.\.([\\/]|$)/u)
  const file = path.resolve(ROOT, relative)
  assert.ok(file.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${relative}`)
  return file
}

function safeRead(file) {
  try { return read(file) } catch { return null }
}

function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, ""))
}

function sha(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}

function shaText(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex")
}

function ensureJson(file, value) {
  const bytes = `${JSON.stringify(value, null, 2)}\n`
  fs.mkdirSync(path.dirname(file), { recursive: true })
  if (fs.existsSync(file)) assert.equal(fs.readFileSync(file, "utf8"), bytes, `immutable JSON mismatch: ${projectPath(file)}`)
  else fs.writeFileSync(file, bytes, { encoding: "utf8", flag: "wx" })
}

function writeExclusive(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
}

function writeTextIdempotent(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  if (fs.existsSync(file)) assert.equal(fs.readFileSync(file, "utf8"), value)
  else fs.writeFileSync(file, value, { encoding: "utf8", flag: "wx" })
}

function writeAtomicText(file, value) {
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(temporary, value, "utf8")
  fs.renameSync(temporary, file)
}

function writeJournal(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  writeAtomicText(file, `${JSON.stringify(value, null, 2)}\n`)
}

function transition(file, value, state, additions = {}) {
  const next = { ...value, ...additions, state, updatedAtUtc: new Date().toISOString() }
  writeJournal(file, next)
  return read(file)
}

function replaceOnce(source, pattern, replacement) {
  const match = source.match(pattern)
  assert.notEqual(match, null, `unique plan pattern not found: ${pattern}`)
  if (match[0] === replacement) return source
  const output = source.replace(pattern, replacement)
  assert.notEqual(output, source)
  return output
}

function tail(file, maximumCharacters) {
  if (!fs.existsSync(file)) return ""
  return fs.readFileSync(file, "utf8").slice(-maximumCharacters)
}

async function recordControlledLaunchFailure(error) {
  const current = await readCurrentExecutionRegistry(ROOT)
  if (!current.ok || current.registry.taskId !== SOURCE_TASK) return null
  const terminalBinding = current.registry.terminalEvidence
  verifyBinding(terminalBinding)
  const compilationTerminal = read(inside(terminalBinding.path))
  const contractBinding = compilationTerminal.contract
  verifyBinding(contractBinding)
  const contract = read(inside(contractBinding.path))
  const runId = contract.executionIdentity?.runId
  const outputNamespace = contract.futureEvidenceNamespace?.outputDirectory
  assert.equal(typeof runId, "string")
  assert.equal(
    outputNamespace,
    `.runtime/ai-painter/stage4-full-backbone-spatial-affine-controlled-smokes/${runId}`,
  )
  const reservedRoot = inside(outputNamespace)
  const reservedTerminal = path.join(reservedRoot, "phase-terminal.json")
  if (fs.existsSync(reservedRoot) && fs.existsSync(reservedTerminal)) return null
  const failureRoot = path.join(CONTROLLED_LAUNCH_FAILURE_PARENT, runId)
  const failurePath = path.join(failureRoot, "controlled-launch-error.json")
  if (fs.existsSync(failurePath)) return bind(failurePath)
  fs.mkdirSync(CONTROLLED_LAUNCH_FAILURE_PARENT, { recursive: true })
  if (!fs.existsSync(failureRoot)) fs.mkdirSync(failureRoot, { recursive: false })
  assert.equal(fs.statSync(failureRoot).isDirectory(), true)
  assert.equal(fs.lstatSync(failureRoot).isSymbolicLink(), false)
  writeExclusive(failurePath, {
    schemaVersion: "stage4-full-backbone-spatial-affine-controlled-smoke-launch-error-v1",
    status: "controlled_launch_failed_before_terminal",
    capabilityVersion: CAPABILITY,
    architectureId: ARCHITECTURE,
    runId,
    reservedOutputNamespace: outputNamespace,
    reservedOutputRootExisted: fs.existsSync(reservedRoot),
    reservedTerminalExisted: false,
    error: error instanceof Error ? error.stack : String(error),
    retryTrainingAutomaticallyAllowed: false,
    ownerAuthorizationRequired: false,
    recordedAtUtc: new Date().toISOString(),
  })
  return bind(failurePath)
}

if (isMain) {
  executeFullBackboneSpatialAffineControlledSmoke()
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch(async (error) => {
      let launchFailure = null
      try {
        launchFailure = await recordControlledLaunchFailure(error)
      } catch (recordError) {
        process.stderr.write(`controlled launch failure evidence could not be recorded: ${recordError instanceof Error ? recordError.stack : String(recordError)}\n`)
      }
      process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
      if (launchFailure) process.stderr.write(`controlledLaunchFailure=${JSON.stringify(launchFailure)}\n`)
      process.exitCode = 1
    })
}
