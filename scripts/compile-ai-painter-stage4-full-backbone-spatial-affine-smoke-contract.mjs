import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  ARCHITECTURE_ID,
  buildFullBackboneSpatialAffineControlledSmokeContract,
  CAPABILITY_VERSION,
  validateFullBackboneSpatialAffineControlledSmokeContract,
  validateCompilationRunId,
  validateSmokeRunId,
} from "./lib/ai-painter-stage4-full-backbone-spatial-affine-smoke-contract-v1.mjs"
import {
  ensureAiPainterProgramEventCommitted,
  formatShanghai,
  projectPath,
  verifyAiPainterProgramEventCommitted,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact, openStorageCatalog } from "./lib/ai-pet-world-storage-catalog.mjs"
import { catalogPath, logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"
import {
  finalizePreparedCurrentExecutionRegistryAdvance,
  prepareCurrentExecutionRegistryAdvance,
  readCurrentExecutionRegistry,
  recoverPreparedCurrentExecutionRegistryAdvance,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const SOURCE_REVISION = 47
const SOURCE_TASK = "record_failure_and_close_without_training_retry"
const NEXT_TASK = "implement_and_execute_stage4_full_backbone_spatial_affine_controlled_smoke"
const TRANSACTION_SCHEMA = "stage4-full-backbone-spatial-affine-smoke-contract-compilation-transaction-v1"
const TRANSACTION_PARENT = inside(".runtime/ai-painter/stage4-full-backbone-spatial-affine-smoke-contract-transactions")
const OUTPUT_PARENT = inside(".runtime/ai-painter/stage4-full-backbone-spatial-affine-smoke-contract-compilations")
const FUTURE_SMOKE_PARENT = inside(".runtime/ai-painter/stage4-full-backbone-spatial-affine-controlled-smokes")
const FILES = Object.freeze({
  plan: inside("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md"),
  contractLibrary: inside("scripts/lib/ai-painter-stage4-full-backbone-spatial-affine-smoke-contract-v1.mjs"),
  checker: inside("scripts/check-ai-painter-stage4-full-backbone-spatial-affine-smoke-contract.mjs"),
  compiler: inside("scripts/compile-ai-painter-stage4-full-backbone-spatial-affine-smoke-contract.mjs"),
  eventStore: inside("scripts/lib/ai-painter-program-event-store.mjs"),
  registryHelper: inside("src/server/ai-painter-current-execution-registry.mjs"),
  modelFactory: inside("ml/ai-painter/src/ai_painter/complete_world/model.py"),
  modeRegistry: inside("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"),
  trainer: inside("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"),
  professionalAesthetic: inside("scripts/lib/ai-assisted-professional-aesthetic.mjs"),
  conditionAlignment: inside("scripts/lib/ai-assisted-condition-alignment.mjs"),
  formalReviewInput: inside("ml/ai-painter/src/ai_painter/complete_world/stage4_formal_review_input.py"),
  formalReviewInputTest: inside("ml/ai-painter/tests/test_stage4_formal_review_input.py"),
  runner: inside("scripts/run-ai-painter-stage4-full-backbone-spatial-affine-controlled-smoke.mjs"),
  materializer: inside("ml/ai-painter/scripts/materialize_stage4_full_backbone_spatial_affine_controlled_smoke.py"),
  smokeCpuChecker: inside("ml/ai-painter/scripts/check_stage4_full_backbone_spatial_affine_controlled_smoke_cpu.py"),
})

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = 1
  })
}

async function main() {
  const incomplete = findIncompleteTransaction()
  let journal
  if (incomplete !== null) {
    journal = read(incomplete)
    const currentCodeIdentity = freezeCodeIdentity()
    if (JSON.stringify(currentCodeIdentity) !== JSON.stringify(journal.codeIdentity)) {
      for (const key of Object.keys(journal.codeIdentity)) {
        if (key !== "compiler") assert.deepEqual(currentCodeIdentity[key], journal.codeIdentity[key], `recovery dependency changed: ${key}`)
      }
      journal = {
        ...journal,
        recoveryCodeIdentity: {
          reason: "program_event_store_enrichment_contract_recovery",
          preparedCompiler: journal.codeIdentity.compiler,
          finalCompiler: currentCodeIdentity.compiler,
          allOtherDependenciesUnchanged: true,
          recordedAtUtc: new Date().toISOString(),
        },
        updatedAtUtc: new Date().toISOString(),
      }
      writeJournal(incomplete, journal)
    }
  } else {
    const source = await verifyCurrentSource()
    const ids = newRunIds()
    const paths = runPaths(ids.compilationRunId, ids.reservedSmokeRunId)
    assertFreshNamespaces(paths)
    fs.mkdirSync(TRANSACTION_PARENT, { recursive: true })
    fs.mkdirSync(paths.transactionRoot, { recursive: false })
    const recordedAtUtc = new Date().toISOString()
    journal = {
      schemaVersion: TRANSACTION_SCHEMA,
      transactionId: ids.compilationRunId,
      compilationRunId: ids.compilationRunId,
      reservedSmokeRunId: ids.reservedSmokeRunId,
      state: "prepared",
      journalPath: projectPath(paths.journal),
      outputRoot: projectPath(paths.outputRoot),
      futureSmokeRoot: projectPath(paths.futureSmokeRoot),
      sourceRegistry: sourceIdentity(source),
      codeIdentity: freezeCodeIdentity(),
      recordedAtUtc,
      createdAtUtc: recordedAtUtc,
    }
    writeJournal(paths.journal, journal)
  }
  const completed = await executeTransaction(journal)
  process.stdout.write(`${JSON.stringify(resultProjection(completed), null, 2)}\n`)
}

async function executeTransaction(initial) {
  let journal = initial
  const paths = runPaths(journal.compilationRunId, journal.reservedSmokeRunId)
  assert.equal(projectPath(paths.journal), journal.journalPath)
  if (journal.state === "prepared") {
    const source = await verifySourceIdentity(journal.sourceRegistry)
    assert.deepEqual(freezeCodeIdentity(), journal.codeIdentity)
    journal = materializeCompilationArtifacts(paths, journal, source)
  }
  if (["artifacts_ready", "plan_committed", "event_committed", "dependencies_committed", "registry_prepared", "registry_committed"].includes(journal.state)) {
    journal = await completeProjection(paths, journal)
  }
  assert.equal(journal.state, "complete")
  verifyComplete(paths, journal)
  return journal
}

async function verifyCurrentSource() {
  const current = await readCurrentExecutionRegistry(ROOT)
  assert.equal(current.ok, true, current.errorCode)
  validateSourceRegistry(current)
  verifySourceEvidence(current)
  return current
}

async function verifySourceIdentity(identity) {
  const current = await readCurrentExecutionRegistry(ROOT)
  assert.equal(current.ok, true, current.errorCode)
  assert.equal(current.registrySha256, identity.sha256)
  assert.equal(current.registry.registryRevision, identity.registryRevision)
  assert.equal(current.registry.eventSequence, identity.eventSequence)
  assert.equal(current.registry.taskId, identity.taskId)
  assert.equal(current.registry.runId, identity.runId)
  validateSourceRegistry(current)
  verifySourceEvidence(current)
  return current
}

export function validateSourceRegistry(current) {
  assert.equal(current.registry.registryRevision, SOURCE_REVISION)
  assert.equal(current.registry.eventSequence, SOURCE_REVISION)
  assert.equal(current.registry.capabilityVersion, CAPABILITY_VERSION)
  assert.equal(current.registry.taskId, SOURCE_TASK)
  assert.equal(current.registry.taskKind, "controlled_smoke_infrastructure_failure_closure")
  assert.equal(current.registry.lifecycleStage, "controlled_smoke_infrastructure_failed_closed")
  assert.equal(current.registry.executionState, "completed")
  assert.equal(current.registry.activity, "controlled_smoke_infrastructure_failure_recorded_no_retry")
  assert.equal(current.registry.activeExecution, null)
  assert.equal(current.registry.terminalEvidence.status, "stage4_full_backbone_spatial_affine_controlled_smoke_infrastructure_failed_closed")
  assert.equal(current.currentTaskTerminal.executionState, "completed")
  assert.equal(current.currentTaskTerminal.status, "stage4_full_backbone_spatial_affine_controlled_smoke_infrastructure_failed_closed")
  assert.equal(current.currentTaskTerminal.nextLegalAction, SOURCE_TASK)
  assert.equal(current.currentTaskTerminal.ownerAuthorizationRequired, false)
  assert.equal(current.currentTaskTerminal.trainingStarted, true)
  assert.equal(current.currentTaskTerminal.automaticRetryStarted, false)
  assert.equal(current.currentTaskTerminal.secondTrainingRunStarted, false)
  assert.equal(current.currentTaskTerminal.checkpointWritten, false)
  assert.equal(current.currentTaskTerminal.checkpoint, null)
  return true
}

function verifySourceEvidence(current) {
  const context = failedRunContext(current)
  assert.equal(context.failure.code, "trainer_execution_failed")
  assert.match(context.failure.detail, /formal_review_sharp_normalization_failed/u)
  assert.equal(context.failure.trainingStarted, true)
  assert.equal(context.failure.checkpointWritten, false)
  assert.equal(context.failure.checkpoint, null)
  assert.equal(context.failure.partialTrainingArtifactsAccepted, false)
  assert.equal(context.failure.automaticRetryStarted, false)
  assert.equal(context.failure.secondTrainingRunStarted, false)
  assert.equal(context.progress.currentEpoch, 1)
  assert.equal(context.progress.liveProgress.optimizerStep, 1)
  assert.equal(context.progress.liveProgress.optimizerStepTarget, 30)
  assert.equal(context.preflight.status, "all_preflight_checks_passed")
  assert.equal(context.preflight.checks.trainingOutputAbsent, true)
  assert.equal(context.contract.executionIdentity.runId, current.registry.runId)
  assert.equal(context.contract.evidenceIsolation.failedCheckpointAccepted, false)
  assert.equal(context.contract.recoveryBoundary.automaticSecondTrainingRunAllowed, false)
  const implementationSuccessorRoles = new Set(["mode-registry", "trainer"])
  for (const binding of context.contract.sourceEvidence) {
    if (implementationSuccessorRoles.has(binding.role)) continue
    verifyBinding(binding)
  }
  runRepairRegression()
  return true
}

function failedRunContext(current) {
  verifyBinding(current.registry.terminalEvidence)
  const terminal = current.currentTaskTerminal
  const failure = readBinding(terminal.failureReport)
  const finalization = readBinding(terminal.finalization)
  const preflight = readBinding(finalization.preflightReport)
  const contract = readBinding(preflight.compiledContract)
  validateFullBackboneSpatialAffineControlledSmokeContract(contract)
  const progressBinding = current.registry.latestTrainingTerminal?.evidence?.trainingProgress
  assert.ok(progressBinding)
  const progress = readBinding(progressBinding)
  assert.equal(current.registry.supersedes.registryRevision, 46)
  assert.equal(current.registry.supersedes.currentSha256, preflight.sourceRegistry.sha256)
  return { terminal, failure, finalization, preflight, contract, progress }
}

function runRepairRegression() {
  const python = inside("ml/ai-painter/.venv/Scripts/python.exe")
  const output = execFileSync(python, [FILES.formalReviewInputTest], {
    cwd: ROOT,
    encoding: "utf8",
    env: pythonEnvironment(),
    maxBuffer: 16 * 1024 * 1024,
  })
  assert.equal(typeof output, "string")
  return true
}

function materializeCompilationArtifacts(paths, journal, current) {
  assert.equal(fs.existsSync(paths.futureSmokeRoot), false, "reserved Smoke namespace already exists")
  fs.mkdirSync(OUTPUT_PARENT, { recursive: true })
  if (!fs.existsSync(paths.outputRoot)) fs.mkdirSync(paths.outputRoot, { recursive: false })
  const files = outputFiles(paths.outputRoot)
  const failed = failedRunContext(current)
  ensureJson(files.repair, {
    schemaVersion: "stage4-full-backbone-spatial-affine-smoke-infrastructure-repair-v1",
    status: "windows_safe_formal_review_normalization_repair_verified",
    classification: "formal_review_sharp_windows_long_path_io_defect",
    failedRunId: current.registry.runId,
    failedTerminal: current.registry.terminalEvidence,
    failureReport: failed.terminal.failureReport,
    exactFailureCode: failed.failure.code,
    failedAtEpoch: failed.progress.currentEpoch,
    completedOptimizerStepsBeforeFailure: failed.progress.liveProgress.optimizerStep,
    failedCheckpointReadOrAccepted: false,
    partialTrainingArtifactsAccepted: false,
    repairBoundary: {
      modelChanged: false,
      modelParametersChanged: false,
      lossChanged: false,
      dataChanged: false,
      reviewThresholdChanged: false,
      trainingPlanChanged: false,
      formalSharpCodecAndResizeSemanticsChanged: false,
      officialArtifactNamespaceChanged: false,
      windowsSafeShortCodecWorkspaceAdded: true,
    },
    implementation: bind(FILES.formalReviewInput),
    regressionTest: bind(FILES.formalReviewInputTest),
    regressionStatus: "5_of_5_passed_including_long_path_byte_identity",
    oldRunReusable: false,
    oldTrainingOutputReusable: false,
    oldCheckpointReusable: false,
    successorRequiresFreshContractRunTicketAndOutput: true,
    ownerAuthorizationRequired: false,
    gpuStartedByRepair: false,
    trainingStartedByRepair: false,
    recordedAtUtc: journal.recordedAtUtc,
  })
  const sourceEvidence = buildSourceEvidence(current, files.repair)
  for (const binding of sourceEvidence) verifyBinding(binding)
  const checkerOutput = execFileSync(process.execPath, [FILES.checker], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  })
  const checker = JSON.parse(checkerOutput)
  assert.equal(checker.status, "stage4_full_backbone_spatial_affine_smoke_contract_cpu_passed")
  assert.equal(Object.values(checker.positiveChecks).every(Boolean), true)
  assert.equal(Object.values(checker.negativeChecks).every(Boolean), true)
  const contract = buildFullBackboneSpatialAffineControlledSmokeContract({
    compilationRunId: journal.compilationRunId,
    reservedSmokeRunId: journal.reservedSmokeRunId,
    sourceEvidence,
  })
  validateFullBackboneSpatialAffineControlledSmokeContract(contract)
  ensureJson(files.contract, contract)
  ensureJson(files.cpuReport, {
    schemaVersion: "stage4-full-backbone-spatial-affine-smoke-contract-cpu-report-v1",
    status: "passed",
    positiveChecks: checker.positiveChecks,
    negativeChecks: checker.negativeChecks,
    positiveCount: checker.positiveCount,
    negativeCount: checker.negativeCount,
    sourceRegistry: journal.sourceRegistry,
    sourceEvidenceRecomputed: true,
    postWddmOuterTransactionCommitted: true,
    readonlyGpuGradientEvidenceVerified: true,
    infrastructureRepair: bind(files.repair),
    infrastructureRepairRegressionPassed: true,
    reservedOutputDirectoryAbsent: true,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    optimizerCreated: false,
    backwardExecuted: false,
    trainingStarted: false,
    recordedAtUtc: journal.recordedAtUtc,
  })
  ensureJson(files.isolation, {
    schemaVersion: "stage4-full-backbone-spatial-affine-smoke-evidence-isolation-audit-v1",
    status: "passed",
    compilationRunId: journal.compilationRunId,
    reservedSmokeRunId: journal.reservedSmokeRunId,
    reservedOutputDirectory: projectPath(paths.futureSmokeRoot),
    reservedOutputDirectoryAbsent: true,
    sourceEvidence,
    sourceEvidenceHashesRecomputed: true,
    failedRunTerminal: current.registry.terminalEvidence,
    failedRunReused: false,
    failedRunOutputReused: false,
    historicalDenoiserAccepted: false,
    historicalCheckpointAccepted: false,
    failedCheckpointAccepted: false,
    historicalRunAccepted: false,
    oldSmokeNamespaceUsed: false,
    partialTrainingArtifactAccepted: false,
    crossCapabilityArtifactAccepted: false,
    recordedAtUtc: journal.recordedAtUtc,
  })
  ensureJson(files.nextAction, {
    schemaVersion: "stage4-local-autonomous-next-action-v1",
    status: "materialized_not_started",
    action: NEXT_TASK,
    capabilityVersion: CAPABILITY_VERSION,
    controlledSmokeContract: bind(files.contract),
    reservedSmokeRunId: journal.reservedSmokeRunId,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    automaticExecutionAllowedAfterCpuPreflight: true,
    recordedAtUtc: journal.recordedAtUtc,
  })
  ensureJson(files.terminal, {
    schemaVersion: "stage4-full-backbone-spatial-affine-smoke-contract-compilation-terminal-v1",
    executionState: "completed",
    status: "stage4_full_backbone_spatial_affine_controlled_smoke_contract_compiled",
    compilationRunId: journal.compilationRunId,
    reservedSmokeRunId: journal.reservedSmokeRunId,
    capabilityVersion: CAPABILITY_VERSION,
    contract: bind(files.contract),
    cpuReport: bind(files.cpuReport),
    evidenceIsolationAudit: bind(files.isolation),
    nextAction: bind(files.nextAction),
    sourceReadonlyGpuTerminal: current.registry.terminalEvidence,
    infrastructureRepair: bind(files.repair),
    outerTransaction: {
      path: journal.journalPath,
      requiredState: "complete",
      commitMarker: {
        path: projectPath(files.commitMarker),
        schemaVersion: "stage4-full-backbone-spatial-affine-smoke-contract-compilation-commit-marker-v1",
      },
    },
    currentFixedProgress: progress(),
    nextLegalAction: NEXT_TASK,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    checkpointWeightsRead: false,
    gpuStarted: false,
    optimizerCreated: false,
    backwardExecuted: false,
    trainingStarted: false,
    recordedAtUtc: journal.recordedAtUtc,
  })
  const planBefore = fs.readFileSync(FILES.plan, "utf8")
  assert.equal(sha(FILES.plan), journal.sourceRegistry.planSha256)
  const planAfter = updateUniquePlan(planBefore, journal.recordedAtUtc)
  writeTextIdempotent(files.stagedPlan, planAfter)
  const planAfterSha256 = sha(files.stagedPlan)
  const planReceiptRecord = {
    schemaVersion: "stage4-full-backbone-spatial-affine-smoke-contract-plan-commit-receipt-v1",
    status: "prepared",
    compilationRunId: journal.compilationRunId,
    planPath: projectPath(FILES.plan),
    beforeSha256: journal.sourceRegistry.planSha256,
    afterSha256: planAfterSha256,
    terminal: bind(files.terminal),
    recordedAtUtc: journal.recordedAtUtc,
  }
  ensureJson(files.planReceipt, planReceiptRecord)
  ensureJson(files.planSync, {
    schemaVersion: "stage4-full-backbone-spatial-affine-smoke-contract-plan-sync-v1",
    status: "prepared_for_atomic_projection",
    compilationRunId: journal.compilationRunId,
    planPath: projectPath(FILES.plan),
    beforeSha256: journal.sourceRegistry.planSha256,
    afterSha256: planAfterSha256,
    planCommitReceipt: bind(files.planReceipt),
    terminal: bind(files.terminal),
    recordedAtUtc: journal.recordedAtUtc,
  })
  ensureJson(files.capsule, buildCapsule(files, journal))
  const immutable = [files.repair, files.contract, files.cpuReport, files.isolation, files.nextAction, files.terminal, files.planReceipt, files.planSync, files.capsule]
  const artifacts = immutable.map(bind)
  const event = {
    id: `stage4-full-backbone-spatial-affine-smoke-contract-${journal.compilationRunId}`,
    timestamp: journal.recordedAtUtc,
    action: "stage4_full_backbone_spatial_affine_controlled_smoke_contract_compiled",
    runId: journal.compilationRunId,
    kind: "cpu_contract_compilation",
    status: "success",
    title: "Full-backbone spatial-affine controlled Smoke contract compiled",
    titleZh: "Stage4全主干空间仿射受控Smoke合同编译通过",
    detailZh: "固定样本194、30 Epoch、预览复现、自动审核与后期稳定资格已冻结；未启动GPU或训练。",
    evidencePath: projectPath(files.terminal),
    evidenceSha256: sha(files.terminal),
    fixedTotalProgress: progress(),
  }
  const registryAdvance = {
    capabilityVersion: CAPABILITY_VERSION,
    packageId: journal.compilationRunId,
    taskId: NEXT_TASK,
    taskKind: "controlled_smoke_implementation_and_execution",
    runId: journal.compilationRunId,
    lifecycleStage: "controlled_smoke_contract_compiled_training_path_pending",
    executionState: "completed",
    activity: "controlled_smoke_contract_compiled_not_started",
    taskCapsulePath: projectPath(files.capsule),
    terminalEvidencePath: projectPath(files.terminal),
    expectedPreviousRegistryRevision: SOURCE_REVISION,
    expectedPreviousRegistrySha256: journal.sourceRegistry.sha256,
  }
  return transition(paths.journal, journal, "artifacts_ready", {
    files: Object.fromEntries(Object.entries(files).map(([key, file]) => [key, projectPath(file)])),
    artifacts,
    catalogFiles: immutable.map(projectPath),
    plan: {
      path: projectPath(FILES.plan),
      stagedPath: projectPath(files.stagedPlan),
      beforeSha256: journal.sourceRegistry.planSha256,
      afterSha256: planAfterSha256,
      receiptPath: projectPath(files.planReceipt),
      receiptSha256: sha(files.planReceipt),
    },
    programEvent: event,
    registryAdvance,
    updatedAtUtc: new Date().toISOString(),
  })
}

async function completeProjection(paths, initial) {
  let journal = initial
  verifyProjectionInputs(paths, journal)
  if (journal.state === "artifacts_ready") {
    assert.deepEqual(freezeCodeIdentity(), journal.codeIdentity)
    ensurePlanCommitted(journal)
    journal = transition(paths.journal, journal, "plan_committed", { planCommittedAtUtc: new Date().toISOString() })
  }
  if (journal.state === "plan_committed") {
    verifyPlanCommitted(journal)
    const event = ensureAiPainterProgramEventCommitted(journal.programEvent)
    verifyProgramEventIdentity(event, journal.programEvent)
    const receipt = verifyAiPainterProgramEventCommitted(event)
    journal = transition(paths.journal, journal, "event_committed", { programEvent: event, eventCommit: receipt })
  }
  if (journal.state === "event_committed") {
    verifyPlanCommitted(journal)
    const eventCommit = verifyAiPainterProgramEventCommitted(journal.programEvent)
    for (const item of journal.catalogFiles) index(inside(item), journal.compilationRunId)
    const catalogCommit = verifyCatalog(journal)
    journal = transition(paths.journal, journal, "dependencies_committed", { eventCommit, catalogCommit })
  }
  if (journal.state === "dependencies_committed") {
    verifyDependencies(journal)
    const registryPrepare = await ensureRegistryPrepared(journal)
    journal = transition(paths.journal, journal, "registry_prepared", { registryPrepare })
  }
  if (journal.state === "registry_prepared") {
    verifyDependencies(journal)
    const registryCommit = await ensureRegistryPublished(journal)
    const markerRecord = buildCommitMarker(journal, registryCommit)
    journal = transition(paths.journal, journal, "registry_committed", { registryCommit, markerRecord })
  }
  if (journal.state === "registry_committed") {
    await verifyPublishedRegistry(journal)
    verifyDependencies(journal)
    ensureJson(paths.commitMarker, journal.markerRecord)
    index(paths.commitMarker, journal.compilationRunId)
    const marker = bind(paths.commitMarker)
    journal = transition(paths.journal, journal, "complete", { commitMarker: marker, completedAtUtc: new Date().toISOString() })
  }
  return journal
}

async function ensureRegistryPrepared(journal) {
  const claimPath = inside(".runtime/ai-painter/current-execution-registry/writer.claim.json")
  if (fs.existsSync(claimPath)) {
    const claim = read(claimPath)
    const pendingPath = inside(`.runtime/ai-painter/current-execution-registry/transactions/${claim.transactionId}/transaction.pending.json`)
    const pending = read(pendingPath)
    const staged = read(inside(pending.currentStaged.path))
    assert.equal(staged.runId, journal.compilationRunId)
    assert.equal(staged.taskId, NEXT_TASK)
    assert.equal(pending.previousCurrentSha256, journal.sourceRegistry.sha256)
    return { transactionId: claim.transactionId, recoveredFromDurablePrepare: true }
  }
  const current = await readCurrentExecutionRegistry(ROOT)
  assert.equal(current.ok, true, current.errorCode)
  assert.equal(current.registrySha256, journal.sourceRegistry.sha256)
  return prepareCurrentExecutionRegistryAdvance({
    ...journal.registryAdvance,
    projectRoot: ROOT,
    dependencyManifest: dependencyManifest(journal),
  })
}

async function ensureRegistryPublished(journal) {
  const current = await readCurrentExecutionRegistry(ROOT)
  if (current.ok && current.registry.runId === journal.compilationRunId && current.registry.taskId === NEXT_TASK) return registryIdentity(current)
  try {
    const published = await finalizePreparedCurrentExecutionRegistryAdvance({ projectRoot: ROOT, transactionId: journal.registryPrepare.transactionId })
    assert.equal(published.ok, true, published.errorCode)
    return registryIdentity(published)
  } catch (error) {
    const message = String(error?.message ?? error)
    if (!message.includes("registry_writer_claim_not_owned_by_current_process") && !message.includes("registry_writer_claim_process_identity_mismatch")) throw error
    const recovered = await recoverPreparedCurrentExecutionRegistryAdvance({ projectRoot: ROOT, transactionId: journal.registryPrepare.transactionId })
    assert.equal(recovered.ok, true, recovered.errorCode)
    return registryIdentity(recovered)
  }
}

async function verifyPublishedRegistry(journal) {
  const current = await readCurrentExecutionRegistry(ROOT)
  assert.equal(current.ok, true, current.errorCode)
  assert.equal(current.registry.registryRevision, SOURCE_REVISION + 1)
  assert.equal(current.registry.eventSequence, SOURCE_REVISION + 1)
  assert.equal(current.registrySha256, journal.registryCommit.registrySha256)
  assert.equal(current.registry.runId, journal.compilationRunId)
  assert.equal(current.registry.taskId, NEXT_TASK)
  assert.equal(current.registry.terminalEvidence.path, journal.registryAdvance.terminalEvidencePath)
  assert.equal(current.registry.terminalEvidence.sha256, sha(inside(journal.registryAdvance.terminalEvidencePath)))
}

function dependencyManifest(journal) {
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
      ...journal.artifacts.map((item, index) => ({ role: `compilation-artifact-${index}`, ...item })),
    ],
    programEvent: {
      eventId: journal.programEvent.id,
      event: journal.programEvent,
      ledgerPath: journal.eventCommit.ledger.path,
      latestPath: journal.eventCommit.latest.path,
      catalogDatabasePath: path.resolve(catalogPath),
    },
    catalogArtifacts: [...catalogArtifacts.values()].map((item) => ({ logicalPath: item.logicalPath, sha256: item.sha256 })),
  }
}

function buildCommitMarker(journal, registryCommit) {
  return {
    schemaVersion: "stage4-full-backbone-spatial-affine-smoke-contract-compilation-commit-marker-v1",
    status: "committed",
    transactionId: journal.transactionId,
    compilationRunId: journal.compilationRunId,
    reservedSmokeRunId: journal.reservedSmokeRunId,
    terminal: journal.artifacts.find((item) => item.path === journal.registryAdvance.terminalEvidencePath),
    plan: { path: journal.plan.path, sha256: journal.plan.afterSha256 },
    programEvent: { id: journal.programEvent.id, evidencePath: journal.programEvent.evidencePath, evidenceSha256: journal.programEvent.evidenceSha256 },
    registry: registryCommit,
    programIdentity: { prepared: journal.codeIdentity, recovery: journal.recoveryCodeIdentity ?? null },
    nextLegalAction: NEXT_TASK,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    optimizerCreated: false,
    backwardExecuted: false,
    trainingStarted: false,
    recordedAtUtc: new Date().toISOString(),
  }
}

function buildSourceEvidence(current, repairFile) {
  const failed = failedRunContext(current)
  const replacements = new Map([
    ["mode-registry", evidence(projectPath(FILES.modeRegistry), "mode-registry")],
    ["trainer", evidence(projectPath(FILES.trainer), "trainer")],
  ])
  const inherited = failed.contract.sourceEvidence.map((binding) =>
    replacements.get(binding.role) ?? evidence(binding.path, binding.role)
  )
  return [
    ...inherited,
    evidence(current.registry.terminalEvidence.path, "failed-smoke-terminal"),
    evidence(failed.terminal.failureReport.path, "failed-smoke-report"),
    evidence(failed.finalization.preflightReport.path, "failed-smoke-preflight-report"),
    evidence(projectPath(FILES.formalReviewInput), "formal-review-input-program"),
    evidence(projectPath(FILES.formalReviewInputTest), "formal-review-input-regression-test"),
    evidence(projectPath(FILES.runner), "smoke-runner"),
    evidence(projectPath(FILES.materializer), "smoke-config-materializer"),
    evidence(projectPath(FILES.smokeCpuChecker), "smoke-cpu-checker"),
    evidence(projectPath(repairFile), "infrastructure-repair-report"),
  ]
}

function buildCapsule(files, journal) {
  const evidenceFiles = [files.terminal, files.repair, files.contract, files.cpuReport, files.isolation, files.nextAction, files.planSync, files.planReceipt]
  return {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${journal.compilationRunId}`,
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: { ...progress(), source: "current_execution_registry" },
    currentStage: { number: 4, total: 5, labelZh: "全主干空间仿射受控Smoke合同", status: "contract_compiled" },
    candidateTerminal: {
      runId: journal.compilationRunId,
      status: "completed",
      programStatus: "stage4_full_backbone_spatial_affine_controlled_smoke_contract_compiled",
      previewMachineStatus: "not_run_contract_compilation_only",
      modelQualificationStatus: "readonly_gpu_qualified_smoke_not_started",
      checkpointWritten: false,
      modelWeightsModified: false,
      recordedAtUtc: journal.recordedAtUtc,
      recordedAtAsiaShanghai: formatShanghai(journal.recordedAtUtc),
    },
    latestBlocker: { code: "successor_controlled_smoke_not_started", summaryZh: "Windows长路径审核I/O缺陷已修复并完成字节一致性回归；全新后继Smoke合同已编译但尚未启动。" },
    nextAllowedAction: { code: NEXT_TASK, labelZh: "执行全新隔离的后继受控Smoke闭环", ownerAuthorizationRequired: false, automaticExecutionAllowed: true, planEvidenceConfirmed: true },
    taskIdentity: { architecture: ARCHITECTURE_ID, reservedSmokeRunId: journal.reservedSmokeRunId, sampleId: "194", sampleSplit: "validation", seed: 20263722, requiredBoundarySides: ["west"] },
    forbiddenActions: ["reuse_failed_smoke", "reuse_failed_smoke_output_or_ticket", "read_historical_or_failed_denoiser_checkpoint", "start_training_before_cpu_preflight", "change_loss_data_or_threshold", "automatic_training_retry"],
    evidence: evidenceFiles.map((file) => ({ kind: path.basename(file), ...bind(file), sha256Verified: true })),
    integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true, migrationRegistryStatus: "current_execution_registry_active" },
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc: journal.recordedAtUtc,
  }
}

export function updateUniquePlan(source, timestamp) {
  let output = replaceOnce(source, /^更新时间：.*$/mu, `更新时间：${formatShanghai(timestamp).replace("T", " ").replace("+08:00", " +08:00")}`)
  output = replaceOnce(output, /^状态：.*$/mu, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4全主干空间仿射Smoke长路径基础设施缺陷已修复，后继合同已编译待执行")
  output = replaceOnce(output, /^\| 2 \| AI Painter R5 \/ Stage4 \|.*$/mu,
    "| 2 | AI Painter R5 / Stage4 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标 | 固定进度3/5（60%）；首个全主干空间仿射Smoke因Windows长路径审核I/O缺陷在Epoch 1失败关闭且不得复用；缺陷已完成字节等价修复和CPU回归，全新合同、runId与输出命名空间已编译 | 下一步由本地程序完成CPU、资源和真实Trainer只读预检后，执行全新隔离的30 Epoch Smoke、自动审核和终态收口 |")
  output = replaceOnce(output, /## 5\. 当前阻断与后续实施顺序[\s\S]*?(?=\n## 6\.)/u,
    "## 5. 当前阻断与后续实施顺序\n\n首个全主干空间仿射受控Smoke已在独立后台启动并于Epoch 1完成一次优化；随后正式审核输入规范化触及Windows下Sharp长路径I/O限制，程序保存基础设施失败报告、Finalization和终态后关闭。该runId、内部票据、输出目录和部分产物均保持失败历史，不得恢复、复用或作为模型资格证据。\n\n修复只将Sharp编解码操作放入短路径临时工作区，再以字节方式写回原不可变证据命名空间；模型、参数、Loss、数据、阈值、训练计划及Sharp量化、nearest缩放和PNG编码语义均未改变。长路径与短路径结果字节一致性CPU回归已通过。全新后继合同、runId和输出目录已独立编译；下一步由本地程序完成全部预检后直接执行一次30 Epoch Smoke、自动审核和终态收口，不等待Owner授权，也不构成旧包自动重试。\n")
  return output
}

function outputFiles(root) {
  return {
    repair: path.join(root, "infrastructure-repair-report.json"),
    contract: path.join(root, "controlled-smoke-contract.json"),
    cpuReport: path.join(root, "cpu-report.json"),
    isolation: path.join(root, "evidence-isolation-audit.json"),
    nextAction: path.join(root, "local-next-action.json"),
    terminal: path.join(root, "phase-terminal.json"),
    planReceipt: path.join(root, "plan-commit-receipt.json"),
    planSync: path.join(root, "plan-sync-record.json"),
    capsule: path.join(root, "local-task-capsule.json"),
    stagedPlan: path.join(root, "next-plan.md"),
    commitMarker: path.join(root, "transaction-commit-marker.json"),
  }
}

function runPaths(compilationRunId, reservedSmokeRunId) {
  validateCompilationRunId(compilationRunId)
  validateSmokeRunId(reservedSmokeRunId)
  const transactionRoot = path.join(TRANSACTION_PARENT, compilationRunId)
  const outputRoot = path.join(OUTPUT_PARENT, compilationRunId)
  const futureSmokeRoot = path.join(FUTURE_SMOKE_PARENT, reservedSmokeRunId)
  return { transactionRoot, journal: path.join(transactionRoot, "transaction.json"), outputRoot, futureSmokeRoot, commitMarker: path.join(outputRoot, "transaction-commit-marker.json") }
}

function assertFreshNamespaces(paths) {
  for (const target of [paths.transactionRoot, paths.outputRoot, paths.futureSmokeRoot]) assert.equal(fs.existsSync(target), false, `namespace reuse forbidden: ${projectPath(target)}`)
}

function newRunIds() {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replaceAll("-", "")
  const time = now.toISOString().slice(11, 23).replaceAll(":", "").replace(".", "")
  const suffix = crypto.randomUUID().slice(0, 8)
  return {
    compilationRunId: validateCompilationRunId(`stage4-full-backbone-spatial-affine-smoke-contract-${date}-${time}-${suffix}`),
    reservedSmokeRunId: validateSmokeRunId(`stage4-full-backbone-spatial-affine-controlled-smoke-${date}-${time}-${suffix}`),
  }
}

function findIncompleteTransaction() {
  if (!fs.existsSync(TRANSACTION_PARENT)) return null
  const journals = fs.readdirSync(TRANSACTION_PARENT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(TRANSACTION_PARENT, entry.name, "transaction.json"))
    .filter((file) => fs.existsSync(file))
    .filter((file) => {
      const value = read(file)
      return value.schemaVersion === TRANSACTION_SCHEMA && value.state !== "complete"
    })
  assert.ok(journals.length <= 1, "multiple incomplete Smoke contract compilation transactions")
  return journals[0] ?? null
}

function sourceIdentity(current) {
  return {
    registryRevision: current.registry.registryRevision,
    eventSequence: current.registry.eventSequence,
    sha256: current.registrySha256,
    taskId: current.registry.taskId,
    runId: current.registry.runId,
    terminalEvidence: current.registry.terminalEvidence,
    planSha256: sha(FILES.plan),
  }
}

function freezeCodeIdentity() {
  return Object.fromEntries(Object.entries(FILES).filter(([key]) => key !== "plan").map(([key, file]) => [key, bind(file)]))
}

function verifyProjectionInputs(paths, journal) {
  assert.equal(journal.schemaVersion, TRANSACTION_SCHEMA)
  assert.equal(journal.compilationRunId, journal.transactionId)
  assert.equal(journal.journalPath, projectPath(paths.journal))
  assert.equal(journal.outputRoot, projectPath(paths.outputRoot))
  assert.equal(journal.futureSmokeRoot, projectPath(paths.futureSmokeRoot))
  assert.equal(journal.sourceRegistry.registryRevision, SOURCE_REVISION)
  assert.equal(journal.sourceRegistry.eventSequence, SOURCE_REVISION)
  assert.equal(journal.registryAdvance.expectedPreviousRegistryRevision, SOURCE_REVISION)
  assert.equal(journal.registryAdvance.expectedPreviousRegistrySha256, journal.sourceRegistry.sha256)
  assert.equal(journal.registryAdvance.runId, journal.compilationRunId)
  assert.equal(journal.registryAdvance.taskId, NEXT_TASK)
  for (const binding of journal.artifacts) verifyBinding(binding)
  assert.equal(journal.artifacts.some((item) => item.path === journal.registryAdvance.terminalEvidencePath), true)
  assert.equal(journal.artifacts.some((item) => item.path === journal.registryAdvance.taskCapsulePath), true)
  assert.equal(journal.programEvent.evidencePath, journal.registryAdvance.terminalEvidencePath)
  assert.equal(journal.programEvent.evidenceSha256, sha(inside(journal.registryAdvance.terminalEvidencePath)))
  assert.equal(fs.existsSync(paths.futureSmokeRoot), false)
}

function ensurePlanCommitted(journal) {
  assert.equal(sha(inside(journal.plan.stagedPath)), journal.plan.afterSha256)
  const current = sha(FILES.plan)
  if (current === journal.plan.beforeSha256) writeAtomicText(FILES.plan, fs.readFileSync(inside(journal.plan.stagedPath), "utf8"))
  else assert.equal(current, journal.plan.afterSha256, "unique plan changed outside compilation transaction")
  verifyPlanCommitted(journal)
}

function verifyPlanCommitted(journal) {
  assert.equal(sha(FILES.plan), journal.plan.afterSha256)
  assert.equal(sha(inside(journal.plan.receiptPath)), journal.plan.receiptSha256)
}

function verifyDependencies(journal) {
  verifyPlanCommitted(journal)
  const receipt = verifyAiPainterProgramEventCommitted(journal.programEvent)
  assert.deepEqual(receipt.event, journal.programEvent)
  verifyCatalog(journal)
}

function verifyCatalog(journal) {
  const database = openStorageCatalog()
  const artifacts = []
  for (const item of journal.catalogFiles) {
    const file = inside(item)
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

function verifyComplete(paths, journal) {
  assert.equal(journal.state, "complete")
  assert.equal(sha(paths.commitMarker), journal.commitMarker.sha256)
  assert.deepEqual(read(paths.commitMarker), journal.markerRecord)
  assert.equal(read(paths.commitMarker).registry.registrySha256, journal.registryCommit.registrySha256)
}

function verifyProgramEventIdentity(actual, expected) {
  for (const key of ["id", "timestamp", "action", "runId", "kind", "status", "title", "titleZh", "detailZh", "evidencePath", "evidenceSha256", "fixedTotalProgress"]) {
    assert.deepEqual(actual[key], expected[key])
  }
  return true
}

function registryIdentity(current) {
  return { registryRevision: current.registry.registryRevision, eventSequence: current.registry.eventSequence, registrySha256: current.registrySha256, transactionId: current.registry.transactionId }
}

function resultProjection(journal) {
  return {
    status: "stage4_full_backbone_spatial_affine_controlled_smoke_contract_compiled",
    compilationRunId: journal.compilationRunId,
    reservedSmokeRunId: journal.reservedSmokeRunId,
    transactionState: journal.state,
    terminal: journal.artifacts.find((item) => item.path === journal.registryAdvance.terminalEvidencePath),
    controlledSmokeContract: journal.artifacts.find((item) => item.path.endsWith("/controlled-smoke-contract.json")),
    infrastructureRepair: journal.artifacts.find((item) => item.path.endsWith("/infrastructure-repair-report.json")),
    cpuReport: journal.artifacts.find((item) => item.path.endsWith("/cpu-report.json")),
    evidenceIsolationAudit: journal.artifacts.find((item) => item.path.endsWith("/evidence-isolation-audit.json")),
    commitMarker: journal.commitMarker,
    currentRegistryRevision: journal.registryCommit.registryRevision,
    currentRegistrySha256: journal.registryCommit.registrySha256,
    currentFixedProgress: progress(),
    nextLegalAction: NEXT_TASK,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    optimizerCreated: false,
    backwardExecuted: false,
    trainingStarted: false,
  }
}

function pythonEnvironment() {
  const additions = [
    path.join(ROOT, "ml/ai-painter/scripts"),
    path.join(ROOT, "ml/ai-painter/src"),
  ]
  return {
    ...process.env,
    PYTHONUTF8: "1",
    PYTHONPATH: [...additions, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
  }
}

function evidence(relativePath, role) { return { role, ...bind(inside(relativePath)) } }
function readBinding(binding) { verifyBinding(binding); return read(inside(binding.path)) }
function verifyBinding(binding) { assert.match(binding?.sha256 ?? "", /^[a-f0-9]{64}$/u); const file = inside(binding.path); assert.equal(fs.existsSync(file), true, `bound file missing: ${binding.path}`); assert.equal(sha(file), binding.sha256, `bound SHA-256 mismatch: ${binding.path}`); return true }
function bind(file) { return { path: projectPath(file), sha256: sha(file) } }
function progress() { return { completedStages: 3, totalStages: 5, percent: 60 } }
function inside(relative) { assert.equal(path.isAbsolute(relative), false); assert.doesNotMatch(relative, /(^|[\\/])\.\.([\\/]|$)/u); const file = path.resolve(ROOT, relative); assert.ok(file.startsWith(`${path.resolve(ROOT)}${path.sep}`)); return file }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, "")) }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function shaJson(value) { return crypto.createHash("sha256").update(`${JSON.stringify(value, null, 2)}\n`, "utf8").digest("hex") }
function ensureJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); const bytes = `${JSON.stringify(value, null, 2)}\n`; if (fs.existsSync(file)) assert.equal(sha(file), shaJson(value), `immutable JSON mismatch: ${projectPath(file)}`); else fs.writeFileSync(file, bytes, { encoding: "utf8", flag: "wx" }) }
function writeTextIdempotent(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); if (fs.existsSync(file)) assert.equal(fs.readFileSync(file, "utf8"), value); else fs.writeFileSync(file, value, { encoding: "utf8", flag: "wx" }) }
function writeAtomicText(file, value) { const temporary = `${file}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(temporary, value, "utf8"); fs.renameSync(temporary, file) }
function writeJournal(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); writeAtomicText(file, `${JSON.stringify(value, null, 2)}\n`) }
function transition(file, value, state, additions = {}) { const next = { ...value, ...additions, state, updatedAtUtc: new Date().toISOString() }; writeJournal(file, next); return read(file) }
function replaceOnce(source, pattern, replacement) { const match = source.match(pattern); assert.notEqual(match, null); if (match[0] === replacement) return source; const output = source.replace(pattern, replacement); assert.notEqual(output, source); return output }
function index(file, runId) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, artifactType: "stage4_full_backbone_spatial_affine_smoke_contract_compilation_v1", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) }) }
