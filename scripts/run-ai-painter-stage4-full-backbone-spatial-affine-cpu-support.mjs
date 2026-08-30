import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
} from "./lib/ai-painter-program-event-store.mjs"
import {
  indexArtifact,
  indexProgramEvent,
} from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"
import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const CAPABILITY = "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1"
const RUN_ID = `stage4-full-backbone-spatial-affine-cpu-support-${compactUtc()}-${crypto.randomUUID()}`
const NEXT_TASK = "qualify_stage4_full_backbone_spatial_affine_readonly_gpu"
const OUTPUT = inside(`.runtime/ai-painter/stage4-full-backbone-spatial-affine-cpu-supports/${RUN_ID}`)
const FAILURE_OUTPUT = inside(`.runtime/ai-painter/stage4-full-backbone-spatial-affine-cpu-support-failures/${RUN_ID}`)
const PYTHON = inside("ml/ai-painter/.venv/Scripts/python.exe")
const TRANSACTION_PARENT = inside(".runtime/ai-painter/stage4-full-backbone-spatial-affine-cpu-support-transactions")
const TRANSACTION_ROOT = path.join(TRANSACTION_PARENT, RUN_ID)
const TRANSACTION_JOURNAL = path.join(TRANSACTION_ROOT, "transaction.json")
const STAGED_PLAN = path.join(TRANSACTION_ROOT, "next-plan.md")
const CPU_CHILD_TIMEOUT_MS = 5 * 60 * 1000

const FILES = Object.freeze({
  currentRegistry: inside(".runtime/ai-painter/current-execution-registry/current.json"),
  sourceTerminal: inside(".runtime/ai-painter/stage4-model-family-discriminations/stage4-model-family-discrimination-20260828232421-01/phase-terminal.json"),
  sourceContract: inside(".runtime/ai-painter/stage4-model-family-discriminations/stage4-model-family-discrimination-20260828232421-01/inactive-architecture-contract.json"),
  uniquePlan: inside("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md"),
  model: inside("ml/ai-painter/src/ai_painter/complete_world/model.py"),
  modeRegistry: inside("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"),
  policy: inside("ml/ai-painter/scripts/ai_painter_authorization_policy.py"),
  trainer: inside("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"),
  contract: inside("ml/ai-painter/scripts/ai_painter_full_backbone_spatial_affine_contract.py"),
  checker: inside("ml/ai-painter/scripts/check_stage4_full_backbone_spatial_affine_cpu.py"),
  test: inside("ml/ai-painter/tests/test_stage4_full_backbone_spatial_affine_conditioned_denoiser.py"),
  legacyModelTest: inside("ml/ai-painter/tests/test_stage4_spatial_affine_conditioned_decoder.py"),
  legacyPreflightTest: inside("ml/ai-painter/tests/test_stage4_spatial_affine_trainer_preflight.py"),
  legacyCheckpointTest: inside("ml/ai-painter/tests/test_stage4_spatial_affine_checkpoint_trainer_integration.py"),
  legacyContractTest: inside("ml/ai-painter/tests/test_stage4_spatial_affine_decoder_contract.py"),
  runner: inside("scripts/run-ai-painter-stage4-full-backbone-spatial-affine-cpu-support.mjs"),
})

const EXPECTED = Object.freeze({
  currentRegistry: "5d9b06ee13601d7f1900ab6656982a1f471690d8654450a7d1394b6e87dcb37e",
  sourceTerminal: "65b198ec57595282ba8d184bd19e3e446e6e690b541acafd87d6719812730baa",
  sourceContract: "81a5de48baba3b849e926b24ccc95e41a849571991b610f534412ad74d894391",
  uniquePlan: "c486226a44cae8ae96bd0d6489efc0c4c140ddc585c5a3bcbb8e26bc7eef8afa",
})

const EXECUTION_FILE_ROLES = Object.freeze([
  "model",
  "modeRegistry",
  "policy",
  "trainer",
  "contract",
  "checker",
  "test",
  "legacyModelTest",
  "legacyPreflightTest",
  "legacyCheckpointTest",
  "legacyContractTest",
  "runner",
])

main().catch((error) => {
  recordFailure(error)
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})

async function main() {
  const recoveredTransactions = await recoverIncompleteTransactions()
  if (recoveredTransactions.length > 0) {
    process.stdout.write(`${JSON.stringify({
      status: "recovered_incomplete_cpu_support_transaction",
      recoveredTransactions,
      gpuStarted: false,
      trainingStarted: false,
    }, null, 2)}\n`)
    return
  }
  for (const [role, file] of Object.entries(FILES)) {
    assert.equal(fs.existsSync(file), true, `${projectPath(file)} is missing`)
    if (Object.hasOwn(EXPECTED, role)) {
      assert.equal(sha(file), EXPECTED[role], `${role} SHA-256 mismatch`)
    }
  }
  assert.equal(fs.existsSync(OUTPUT), false, "CPU support output reuse is forbidden")
  assert.equal(fs.existsSync(TRANSACTION_ROOT), false, "CPU support transaction reuse is forbidden")

  const frozenCodeIdentity = freezeExecutionCodeIdentity()

  const current = await readCurrentExecutionRegistry(ROOT)
  assert.equal(current.ok, true, current.errorCode)
  assert.equal(current.registrySha256, EXPECTED.currentRegistry)
  assert.equal(current.registry.registryRevision, 41)
  assert.equal(current.registry.eventSequence, 41)
  assert.equal(current.registry.capabilityVersion, CAPABILITY)
  assert.equal(current.registry.taskId, "implement_stage4_full_backbone_spatial_affine_cpu_inactive_support")
  assert.equal(current.registry.activeExecution, null)

  const sourceTerminal = read(FILES.sourceTerminal)
  const sourceContract = read(FILES.sourceContract)
  assert.equal(sourceTerminal.status, "stage4_model_family_discrimination_completed_unique_bounded_successor")
  assert.equal(sourceTerminal.selectedCandidateCapabilityVersion, CAPABILITY)
  assert.equal(sourceContract.status, "cpu_design_supported_inactive_not_implemented")
  assert.equal(sourceContract.capabilityVersion, CAPABILITY)
  assert.equal(sourceContract.projectionCount, 12)
  assert.equal(sourceContract.parameterTensorCount, 24)
  assert.equal(sourceContract.parameterCount, 745472)
  assert.equal(sourceContract.netNewParameterCount, 585728)
  assert.equal(Object.values(sourceContract.activationGates).every((value) => value === false), true)

  const syntax = runSyntaxChecks()
  const checker = runPythonJson([FILES.checker])
  assert.equal(checker.status, "passed")
  assert.equal(checker.positivePassed, checker.positiveTotal)
  assert.equal(checker.negativePassed, checker.negativeTotal)
  assert.equal(checker.actualImplementation.parameterTensorCount, 24)
  assert.equal(checker.actualImplementation.parameterCount, 745472)
  assert.equal(checker.actualImplementation.device, "cpu")
  assert.equal(checker.modeAndPolicy.registeredModeCount, 1)
  assert.equal(checker.modeAndPolicy.activeModeCount, 0)
  assert.equal(checker.modeAndPolicy.ownerAuthorizationRequired, false)
  assert.equal(checker.modeAndPolicy.internalExecutionTicketRequired, false)

  const inactiveConfig = runPythonJson([
    "-c",
    "import json; from ai_painter_full_backbone_spatial_affine_contract import compile_full_backbone_spatial_affine_cpu_inactive_config as compile_config; print(json.dumps(compile_config(), ensure_ascii=False))",
  ])
  assert.equal(inactiveConfig.status, "cpu_supported_inactive")
  assert.equal(inactiveConfig.architectureId, CAPABILITY)
  assert.equal(Object.values(inactiveConfig.activationGates).every((value) => value === false), true)
  assert.equal(Object.values(inactiveConfig.executionBoundary).every((value) => value === false), true)

  const newTests = runUnitTests([FILES.test])
  assert.equal(newTests.testCount, 6)
  const legacyTests = runUnitTests([
    FILES.legacyModelTest,
    FILES.legacyPreflightTest,
    FILES.legacyCheckpointTest,
    FILES.legacyContractTest,
  ])
  assert.equal(legacyTests.testCount, 16)

  const source = fs.readFileSync(FILES.model, "utf8")
  assert.match(source, /stage4_full_backbone_spatial_affine_conditioned_denoiser_v1/u)
  const expectedBlockOrder = ["block0", "block1", "middle1", "middle2", "up_block1", "up_block0"]
  assert.deepEqual(checker.actualImplementation.blockOrder, expectedBlockOrder)
  for (const block of expectedBlockOrder) {
    const prefix = `denoiser.${block}.spatial_affine_`
    const parameters = Object.keys(checker.actualImplementation.parameterShapes)
      .filter((name) => name.startsWith(prefix))
    assert.equal(parameters.length, 4, `${block} must expose exactly four affine parameter tensors`)
  }
  const trainer = fs.readFileSync(FILES.trainer, "utf8")
  assert.match(trainer, /full_backbone_spatial_affine_denoiser_stage4_inactive/u)

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
  fs.mkdirSync(OUTPUT, { recursive: false })
  const outputs = {
    inactiveConfig: path.join(OUTPUT, "inactive-config.json"),
    architectureContract: path.join(OUTPUT, "architecture-support-contract.json"),
    parameterAudit: path.join(OUTPUT, "parameter-shape-and-gradient-audit.json"),
    compatibility: path.join(OUTPUT, "legacy-compatibility-report.json"),
    cpu: path.join(OUTPUT, "cpu-report.json"),
    nextAction: path.join(OUTPUT, "local-next-action.json"),
    planSync: path.join(OUTPUT, "plan-sync-record.json"),
    terminal: path.join(OUTPUT, "phase-terminal.json"),
    capsule: path.join(OUTPUT, "local-task-capsule.json"),
  }
  const planCommitReceipt = path.join(OUTPUT, "plan-commit-receipt.json")
  const recordedAtUtc = new Date().toISOString()
  assertExecutionCodeIdentityUnchanged(frozenCodeIdentity)
  const codeIdentity = frozenCodeIdentity

  writeExclusive(outputs.inactiveConfig, {
    ...inactiveConfig,
    sourceDesignContract: bind(FILES.sourceContract),
    implementationCodeIdentity: codeIdentity,
    recordedAtUtc,
  })
  writeExclusive(outputs.architectureContract, {
    ...inactiveConfig.fullBackboneSpatialAffineContract,
    schemaVersion: "stage4-full-backbone-spatial-affine-implemented-cpu-support-contract-v1",
    status: "cpu_supported_inactive",
    sourceDesignContract: bind(FILES.sourceContract),
    actualImplementationVerified: true,
    onlyRegisteredMode: checker.modeAndPolicy.modeId,
    activeModeRegistered: false,
    recordedAtUtc,
  })
  writeExclusive(outputs.parameterAudit, {
    schemaVersion: "stage4-full-backbone-spatial-affine-parameter-shape-gradient-audit-v1",
    status: "passed",
    capabilityVersion: CAPABILITY,
    exactDerivedIdentity: checker.exactDerivedIdentity,
    actualImplementation: checker.actualImplementation,
    formula: "normalized * (1 + gamma) + beta",
    noFreeParameterIntroduced: true,
    recordedAtUtc,
  })
  writeExclusive(outputs.compatibility, {
    schemaVersion: "stage4-full-backbone-spatial-affine-legacy-compatibility-report-v1",
    status: "passed",
    baselineAndDecoderOnlyModelIdentityUnchanged: true,
    oldSpatialAffineTests: legacyTests,
    newArchitectureTests: newTests,
    trainerHasNoActiveModeForNewArchitecture: true,
    crossArchitectureModeBindingRejected: true,
    executionTicketInjectionRejected: true,
    recordedAtUtc,
  })
  writeExclusive(outputs.cpu, {
    schemaVersion: "stage4-full-backbone-spatial-affine-cpu-support-report-v1",
    status: "passed",
    capabilityVersion: CAPABILITY,
    sourceTerminal: bind(FILES.sourceTerminal),
    sourceDesignContract: bind(FILES.sourceContract),
    currentRegistryRevisionVerified: 41,
    syntax,
    contractRegression: checker,
    newArchitectureTests: newTests,
    legacyRegressionTests: legacyTests,
    modeAndPolicy: checker.modeAndPolicy,
    codeIdentity,
    checkpointWeightsRead: false,
    optimizerCreated: false,
    backwardExecuted: false,
    modelWeightsModified: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  })
  writeExclusive(outputs.nextAction, {
    schemaVersion: "ai-painter-local-next-action-v1",
    status: "ready",
    capabilityVersion: CAPABILITY,
    nextAction: NEXT_TASK,
    scope: "one_readonly_gpu_qualification_from_fixed_random_initialization_without_optimizer_backward_or_weight_change",
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    automaticExecutionAllowed: true,
    forbiddenActions: [
      "start_training",
      "create_optimizer",
      "execute_backward",
      "modify_weights",
      "read_failed_denoiser_checkpoint",
      "reuse_historical_run_or_output",
    ],
    recordedAtUtc,
  })

  const planBeforeSha256 = sha(FILES.uniquePlan)
  assert.equal(planBeforeSha256, EXPECTED.uniquePlan)
  const nextPlan = updateUniquePlan(fs.readFileSync(FILES.uniquePlan, "utf8"), recordedAtUtc)
  const planAfterSha256 = shaText(nextPlan)
  const planCommitReceiptRecord = {
    schemaVersion: "stage4-full-backbone-spatial-affine-plan-commit-receipt-v1",
    status: "plan_committed",
    runId: RUN_ID,
    capabilityVersion: CAPABILITY,
    planPath: projectPath(FILES.uniquePlan),
    beforeSha256: planBeforeSha256,
    afterSha256: planAfterSha256,
    expectedPreviousRegistryRevision: 41,
    expectedCommittedRegistryRevision: 42,
    recordedAtUtc,
  }
  const planCommitReceiptBinding = {
    path: projectPath(planCommitReceipt),
    sha256: shaJson(planCommitReceiptRecord),
  }
  writeExclusive(outputs.planSync, {
    schemaVersion: "stage4-full-backbone-spatial-affine-cpu-support-plan-sync-v1",
    status: "prepared_for_atomic_projection_after_registry_commit",
    planPath: projectPath(FILES.uniquePlan),
    beforeSha256: planBeforeSha256,
    afterSha256: planAfterSha256,
    nextLegalAction: NEXT_TASK,
    currentFixedProgress: progress(),
    recordedAtUtc,
  })

  writeExclusive(outputs.terminal, {
    schemaVersion: "stage4-full-backbone-spatial-affine-cpu-support-terminal-v1",
    executionState: "completed",
    status: "stage4_full_backbone_spatial_affine_cpu_support_succeeded_inactive",
    runId: RUN_ID,
    capabilityVersion: CAPABILITY,
    inactiveConfig: bind(outputs.inactiveConfig),
    architectureSupportContract: bind(outputs.architectureContract),
    parameterAudit: bind(outputs.parameterAudit),
    compatibilityReport: bind(outputs.compatibility),
    cpuReport: bind(outputs.cpu),
    nextAction: bind(outputs.nextAction),
    planSyncRecord: bind(outputs.planSync),
    planCommitReceipt: planCommitReceiptBinding,
    currentFixedProgress: progress(),
    nextLegalAction: NEXT_TASK,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    checkpointWeightsRead: false,
    optimizerCreated: false,
    backwardExecuted: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  })

  const capsuleEvidence = Object.entries(outputs)
    .filter(([key]) => key !== "capsule")
    .map(([kind, file]) => ({ kind, labelZh: kind, ...bind(file), expectedSha256: sha(file), sha256Verified: true }))
  writeExclusive(outputs.capsule, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${RUN_ID}`,
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: { ...progress(), source: "current_execution_registry" },
    currentStage: { number: 4, total: 5, labelZh: "Stage 0→Stage 1→Stage 2完整训练", status: "full_backbone_spatial_affine_cpu_contract_verified" },
    latestBlocker: {
      code: "readonly_gpu_qualification_not_yet_completed",
      summaryZh: "全主干空间仿射CPU未激活支持已通过；尚需只读GPU资格证明CUDA前向、条件到达和正式参数梯度边界。",
    },
    nextAllowedAction: {
      code: NEXT_TASK,
      labelZh: "执行一次全新、只读、无权重修改的GPU资格。",
      ownerAuthorizationRequired: false,
      automaticExecutionAllowed: true,
      planEvidenceConfirmed: true,
    },
    forbiddenActions: ["start_training_before_gpu_qualification", "reuse_failed_checkpoint", "add_free_parameters", "lower_review_thresholds"],
    taskIdentity: { modelId: CAPABILITY, sourceRunId: RUN_ID, seed: 20263722 },
    evidence: capsuleEvidence,
    integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true, migrationRegistryStatus: "current_execution_registry_active" },
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
  })

  assertExecutionCodeIdentityUnchanged(frozenCodeIdentity)
  fs.mkdirSync(TRANSACTION_PARENT, { recursive: true })
  fs.mkdirSync(TRANSACTION_ROOT, { recursive: false })
  writeExclusiveText(STAGED_PLAN, nextPlan)
  const registryAdvance = {
    projectRoot: ROOT,
    capabilityVersion: CAPABILITY,
    packageId: RUN_ID,
    taskId: NEXT_TASK,
    taskKind: "readonly_gpu_qualification",
    runId: RUN_ID,
    lifecycleStage: "cpu_contract_verified",
    executionState: "completed",
    activity: "cpu_contract_verified_inactive",
    taskCapsulePath: projectPath(outputs.capsule),
    terminalEvidencePath: projectPath(outputs.terminal),
    expectedPreviousRegistryRevision: 41,
    expectedPreviousRegistrySha256: EXPECTED.currentRegistry,
  }
  const programEvent = {
    id: `stage4-full-backbone-spatial-affine-cpu-support-${RUN_ID}`,
    timestamp: recordedAtUtc,
    action: "stage4_full_backbone_spatial_affine_cpu_support_completed",
    runId: RUN_ID,
    kind: "cpu_inactive_candidate_implementation",
    status: "success",
    title: "Stage4 full-backbone spatial-affine CPU support verified",
    titleZh: "Stage4全主干空间仿射CPU未激活支持已验证",
    detailZh: "六个既有残差块共12个空间仿射投影已实现；参数、梯度、旧模式兼容和本地只读权限边界全部通过。",
    evidencePath: projectPath(outputs.terminal),
    evidenceSha256: sha(outputs.terminal),
    fixedTotalProgress: progress(),
  }
  writeJournal({
    schemaVersion: "stage4-full-backbone-spatial-affine-cpu-support-transaction-v1",
    transactionId: RUN_ID,
    runId: RUN_ID,
    capabilityVersion: CAPABILITY,
    state: "artifacts_ready",
    recordedAtUtc,
    outputRoot: projectPath(OUTPUT),
    artifacts: Object.values(outputs).map((file) => bind(file)),
    codeIdentity,
    registryAdvance: serializableRegistryAdvance(registryAdvance),
    plan: {
      path: projectPath(FILES.uniquePlan),
      stagedPath: projectPath(STAGED_PLAN),
      beforeSha256: planBeforeSha256,
      afterSha256: planAfterSha256,
      receiptPath: projectPath(planCommitReceipt),
      receiptSha256: planCommitReceiptBinding.sha256,
      receiptRecord: planCommitReceiptRecord,
    },
    programEvent,
    catalogFiles: [
      ...Object.values(outputs).map(projectPath),
      projectPath(planCommitReceipt),
    ],
  })
  const completedTransaction = await completeTransaction(readJournal(TRANSACTION_JOURNAL))
  assertExecutionCodeIdentityUnchanged(frozenCodeIdentity)

  process.stdout.write(`${JSON.stringify({
    status: "stage4_full_backbone_spatial_affine_cpu_support_succeeded_inactive",
    runId: RUN_ID,
    capabilityVersion: CAPABILITY,
    terminal: bind(outputs.terminal),
    cpuReport: bind(outputs.cpu),
    currentRegistrySha256: completedTransaction.registryCommit.registrySha256,
    currentFixedProgress: progress(),
    nextLegalAction: NEXT_TASK,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
  }, null, 2)}\n`)
}

async function recoverIncompleteTransactions() {
  if (!fs.existsSync(TRANSACTION_PARENT)) return []
  const recovered = []
  const transactionDirectories = fs.readdirSync(TRANSACTION_PARENT, {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(TRANSACTION_PARENT, entry.name))
    .sort()
  for (const directory of transactionDirectories) {
    const journalPath = path.join(directory, "transaction.json")
    if (!fs.existsSync(journalPath)) continue
    const journal = readJournal(journalPath)
    if (
      journal.schemaVersion
        !== "stage4-full-backbone-spatial-affine-cpu-support-transaction-v1"
      || journal.state === "complete"
    ) continue
    const completed = await completeTransaction(journal, journalPath)
    recovered.push({
      runId: completed.runId,
      state: completed.state,
      registryCommit: completed.registryCommit,
    })
  }
  return recovered
}

async function completeTransaction(initialJournal, journalPath = TRANSACTION_JOURNAL) {
  let journal = initialJournal
  assert.equal(
    journal.schemaVersion,
    "stage4-full-backbone-spatial-affine-cpu-support-transaction-v1",
  )
  assert.ok([
    "artifacts_ready",
    "registry_committed",
    "plan_committed",
    "event_committed",
    "complete",
  ].includes(journal.state), `unknown CPU support transaction state: ${journal.state}`)
  verifyJournalArtifacts(journal, { requirePlanReceipt: false })

  if (journal.state === "artifacts_ready") {
    assertExecutionCodeIdentityUnchanged(journal.codeIdentity)
    const registryCommit = await ensureRegistryCommitted(journal)
    journal = transitionJournal(journalPath, journal, "registry_committed", {
      registryCommit,
    })
  }
  if (journal.state === "registry_committed") {
    await verifyRegistryCommit(journal)
    const planCommit = ensurePlanCommitted(journal)
    journal = transitionJournal(journalPath, journal, "plan_committed", {
      planCommit,
    })
  }
  if (journal.state === "plan_committed") {
    await verifyRegistryCommit(journal)
    verifyPlanCommitted(journal)
    const eventCommit = ensureProgramEventCommitted(journal)
    for (const logicalPath of journal.catalogFiles) {
      index(inside(logicalPath), journal.runId)
    }
    journal = transitionJournal(journalPath, journal, "event_committed", {
      eventCommit,
      recoveryRunnerIdentity: bind(FILES.runner),
      catalogCommit: {
        status: "indexed_idempotently",
        artifactCount: journal.catalogFiles.length,
      },
    })
  }
  if (journal.state === "event_committed") {
    await verifyRegistryCommit(journal)
    verifyPlanCommitted(journal)
    verifyProgramEventCommitted(journal)
    verifyJournalArtifacts(journal, { requirePlanReceipt: true })
    verifyCompletionTerminal(journal)
    journal = transitionJournal(journalPath, journal, "complete", {
      completedAtUtc: new Date().toISOString(),
    })
  }
  assert.equal(journal.state, "complete")
  return journal
}

async function ensureRegistryCommitted(journal) {
  const current = await readCurrentExecutionRegistry(ROOT)
  assert.equal(current.ok, true, current.errorCode)
  if (
    current.registry.runId === journal.runId
    && current.registry.terminalEvidence.path
      === journal.registryAdvance.terminalEvidencePath
  ) {
    const terminalBinding = journal.artifacts.find(
      ({ path: artifactPath }) =>
        artifactPath === journal.registryAdvance.terminalEvidencePath,
    )
    assert.notEqual(terminalBinding, undefined)
    assert.equal(current.registry.terminalEvidence.sha256, terminalBinding.sha256)
    return registryCommitIdentity(current)
  }
  assert.equal(
    current.registry.registryRevision,
    journal.registryAdvance.expectedPreviousRegistryRevision,
    "CPU support recovery found a conflicting registry revision",
  )
  assert.equal(
    current.registrySha256,
    journal.registryAdvance.expectedPreviousRegistrySha256,
    "CPU support recovery found a conflicting registry identity",
  )
  const advanced = await advanceCurrentExecutionRegistry({
    ...journal.registryAdvance,
    projectRoot: ROOT,
  })
  assert.equal(advanced.ok, true, advanced.errorCode)
  return registryCommitIdentity(advanced)
}

async function verifyRegistryCommit(journal) {
  const current = await readCurrentExecutionRegistry(ROOT)
  assert.equal(current.ok, true, current.errorCode)
  assert.equal(current.registrySha256, journal.registryCommit.registrySha256)
  assert.equal(current.registry.registryRevision, journal.registryCommit.registryRevision)
  assert.equal(current.registry.transactionId, journal.registryCommit.transactionId)
  assert.equal(current.registry.runId, journal.runId)
  assert.equal(
    current.registry.terminalEvidence.path,
    journal.registryAdvance.terminalEvidencePath,
  )
  return current
}

function registryCommitIdentity(current) {
  return {
    registryRevision: current.registry.registryRevision,
    eventSequence: current.registry.eventSequence,
    registrySha256: current.registrySha256,
    transactionId: current.registry.transactionId,
    terminalEvidence: current.registry.terminalEvidence,
  }
}

function ensurePlanCommitted(journal) {
  const plan = journal.plan
  const planPath = inside(plan.path)
  const stagedPath = inside(plan.stagedPath)
  assert.equal(sha(stagedPath), plan.afterSha256, "staged plan identity mismatch")
  const currentSha256 = sha(planPath)
  if (currentSha256 === plan.beforeSha256) {
    writeAtomic(planPath, fs.readFileSync(stagedPath, "utf8"))
  } else {
    assert.equal(
      currentSha256,
      plan.afterSha256,
      "plan changed outside the recoverable CPU support transaction",
    )
  }
  assert.equal(sha(planPath), plan.afterSha256)
  const receiptPath = inside(plan.receiptPath)
  if (!fs.existsSync(receiptPath)) {
    writeExclusive(receiptPath, plan.receiptRecord)
  }
  assert.equal(sha(receiptPath), plan.receiptSha256)
  return {
    status: "plan_committed",
    receiptPath: plan.receiptPath,
    receiptSha256: plan.receiptSha256,
    committedPlanSha256: plan.afterSha256,
  }
}

function verifyPlanCommitted(journal) {
  assert.equal(sha(inside(journal.plan.path)), journal.plan.afterSha256)
  assert.equal(sha(inside(journal.plan.receiptPath)), journal.plan.receiptSha256)
}

function ensureProgramEventCommitted(journal) {
  const recoveryEvent = findProgramEvent(
    `stage4-full-backbone-spatial-affine-cpu-support-failure-${journal.runId}`,
  )
  if (recoveryEvent !== null) indexProgramEvent(recoveryEvent)
  const existing = findProgramEvent(journal.programEvent.id)
  if (existing === null) {
    const appended = appendAiPainterProgramEvent(journal.programEvent)
    verifyProgramEventIdentity(appended, journal.programEvent)
  } else {
    verifyProgramEventIdentity(existing, journal.programEvent)
    indexProgramEvent(existing)
  }
  const committed = findProgramEvent(journal.programEvent.id)
  assert.notEqual(committed, null)
  verifyProgramEventIdentity(committed, journal.programEvent)
  return {
    status: "event_committed",
    eventId: journal.programEvent.id,
  }
}

function verifyProgramEventCommitted(journal) {
  const event = findProgramEvent(journal.programEvent.id)
  assert.notEqual(event, null, "program event commit is missing")
  verifyProgramEventIdentity(event, journal.programEvent)
}

function findProgramEvent(eventId) {
  const ledger = inside(".runtime/ai-painter/training-process-ledger/events.jsonl")
  if (!fs.existsSync(ledger)) return null
  const matches = fs.readFileSync(ledger, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line.replace(/^\uFEFF/u, "")))
    .filter((event) => event.id === eventId)
  assert.ok(matches.length <= 1, `duplicate program event identity: ${eventId}`)
  return matches[0] ?? null
}

function verifyProgramEventIdentity(actual, expected) {
  for (const key of [
    "id",
    "timestamp",
    "action",
    "runId",
    "kind",
    "status",
    "evidencePath",
    "evidenceSha256",
  ]) {
    assert.deepEqual(actual[key], expected[key], `program event mismatch: ${key}`)
  }
}

function verifyJournalArtifacts(journal, { requirePlanReceipt }) {
  for (const binding of journal.artifacts) {
    const file = inside(binding.path)
    assert.equal(fs.existsSync(file), true, `transaction artifact missing: ${binding.path}`)
    assert.equal(sha(file), binding.sha256, `transaction artifact changed: ${binding.path}`)
  }
  if (requirePlanReceipt) {
    assert.equal(
      sha(inside(journal.plan.receiptPath)),
      journal.plan.receiptSha256,
      "plan commit receipt identity mismatch",
    )
  }
}

function verifyCompletionTerminal(journal) {
  const terminal = read(inside(journal.registryAdvance.terminalEvidencePath))
  assert.deepEqual(terminal.planCommitReceipt, {
    path: journal.plan.receiptPath,
    sha256: journal.plan.receiptSha256,
  })
  assert.equal(sha(inside(terminal.planCommitReceipt.path)), terminal.planCommitReceipt.sha256)
}

function transitionJournal(journalPath, journal, state, additions = {}) {
  const next = {
    ...journal,
    ...additions,
    state,
    updatedAtUtc: new Date().toISOString(),
  }
  writeJournal(next, journalPath)
  return readJournal(journalPath)
}

function serializableRegistryAdvance(value) {
  const output = { ...value }
  delete output.projectRoot
  return output
}

function freezeExecutionCodeIdentity() {
  return Object.fromEntries(
    EXECUTION_FILE_ROLES.map((role) => [role, bind(FILES[role])]),
  )
}

function assertExecutionCodeIdentityUnchanged(frozenIdentity) {
  assert.deepEqual(
    freezeExecutionCodeIdentity(),
    frozenIdentity,
    "CPU support execution code changed while checks were running",
  )
}

function runSyntaxChecks() {
  const pythonFiles = [FILES.model, FILES.modeRegistry, FILES.policy, FILES.trainer, FILES.contract, FILES.checker, FILES.test]
  const code = "import ast,pathlib,sys; [ast.parse(pathlib.Path(p).read_text(encoding='utf-8'), filename=p) for p in sys.argv[1:]]"
  const python = spawnSync(PYTHON, ["-B", "-c", code, ...pythonFiles], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    env: cpuEnvironment(),
    timeout: CPU_CHILD_TIMEOUT_MS,
    killSignal: "SIGKILL",
  })
  assertChildSucceeded(python, "Python syntax check")
  const node = spawnSync(process.execPath, ["--check", FILES.runner], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    timeout: CPU_CHILD_TIMEOUT_MS,
    killSignal: "SIGKILL",
  })
  assertChildSucceeded(node, "Node syntax check")
  return { pythonAstFiles: pythonFiles.map(projectPath), nodeSyntaxFile: projectPath(FILES.runner), status: "passed" }
}

function runPythonJson(args) {
  const result = spawnSync(PYTHON, ["-B", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    env: cpuEnvironment(),
    maxBuffer: 32 * 1024 * 1024,
    timeout: CPU_CHILD_TIMEOUT_MS,
    killSignal: "SIGKILL",
  })
  assertChildSucceeded(result, "Python JSON check")
  return JSON.parse(result.stdout)
}

function runUnitTests(files) {
  const result = spawnSync(PYTHON, ["-B", "-m", "unittest", ...files], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    env: cpuEnvironment(),
    maxBuffer: 32 * 1024 * 1024,
    timeout: CPU_CHILD_TIMEOUT_MS,
    killSignal: "SIGKILL",
  })
  assertChildSucceeded(result, "Python unittest")
  const transcript = `${result.stdout}\n${result.stderr}`
  const match = transcript.match(/Ran\s+(\d+)\s+tests?/u)
  assert.notEqual(match, null, "unittest count is missing")
  assert.match(transcript, /\bOK\b/u)
  return { status: "passed", testCount: Number(match[1]), files: files.map(projectPath) }
}

function cpuEnvironment() {
  const delimiter = path.delimiter
  const pythonPath = [inside("ml/ai-painter/src"), inside("ml/ai-painter/scripts"), process.env.PYTHONPATH].filter(Boolean).join(delimiter)
  return { ...process.env, PYTHONPATH: pythonPath, CUDA_VISIBLE_DEVICES: "" }
}

function updateUniquePlan(source, timestamp) {
  let output = source
  output = replaceOnce(output, /^更新时间：.*$/mu, `更新时间：${formatShanghai(timestamp).replace("T", " ").replace("+08:00", " +08:00")}`)
  output = replaceOnce(output, /^状态：.*$/mu, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4全主干空间仿射CPU未激活支持已通过，只读GPU资格待执行")
  output = replaceOnce(output, /^\| 2 \| AI Painter R5 \/ Stage4 \|.*$/mu, "| 2 | AI Painter R5 / Stage4 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标 | 固定进度3/5（60%）；全主干空间仿射候选已完成CPU未激活实现，六块参数、梯度、旧模式兼容和权限隔离全部通过 | 下一步由本地程序执行一次全新只读GPU资格；资格通过后才允许编译受控Smoke，不直接启动Stage 0 |")
  output = replaceOnce(output, /## 5\. 当前阻断与后续实施顺序[\s\S]*?(?=\n## 6\.)/u, `## 5. 当前阻断与后续实施顺序\n\n本地程序已完成全主干空间仿射候选的CPU未激活支持。23通道空间仿射已精确接入block0、block1、middle1、middle2、up_block1、up_block0六个既有TimeResidualBlock；每块两处归一化均使用现有3×3、bias=true投影和\`normalized * (1 + gamma) + beta\`公式。实际模型共12个投影、24个独立参数张量、745472个仿射参数，相对decoder-only净增585728个参数。\n\nCPU正反回归已验证实际模型前向、全部正式仿射参数与23通道条件梯度有限非零、固定种子初始化确定、baseline和decoder-only旧模式非退化。Mode Registry只登记一个\`cpu_inactive\`模式，授权策略由本地程序直接形成只读身份检查Grant，不需要Owner签名或内部执行票据；GPU、Autoencoder加载、优化器、backward、权重修改、Checkpoint写入、Stage、正式推理、RuntimeFrame及进入世界动作全部关闭。\n\n当前唯一阻断是尚未完成该候选的只读GPU资格。下一步由本地程序使用全新Run和输出命名空间验证真实CUDA前向、条件到达、全部正式仿射参数梯度和模型前后哈希；不得创建优化器、执行.backward()、修改权重、读取失败Denoiser Checkpoint或启动训练。资格通过后才允许物化一个受控Smoke执行包。\n`)
  return output
}

function progress() { return { completedStages: 3, totalStages: 5, percent: 60 } }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")) }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function shaText(value) { return crypto.createHash("sha256").update(value, "utf8").digest("hex") }
function shaJson(value) { return shaText(`${JSON.stringify(value, null, 2)}\n`) }
function bind(file) { return { path: projectPath(file), sha256: sha(file) } }
function writeExclusive(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" }) }
function writeExclusiveText(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value, { encoding: "utf8", flag: "wx" }) }
function writeAtomic(file, value) { const temporary = `${file}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(temporary, value, "utf8"); fs.renameSync(temporary, file) }
function writeJournal(value, journalPath = TRANSACTION_JOURNAL) { fs.mkdirSync(path.dirname(journalPath), { recursive: true }); writeAtomic(journalPath, `${JSON.stringify(value, null, 2)}\n`) }
function readJournal(journalPath) { return read(journalPath) }
function replaceOnce(source, pattern, replacement) { assert.match(source, pattern); const output = source.replace(pattern, replacement); assert.notEqual(output, source); return output }
function compactUtc() { return new Date().toISOString().replaceAll(/[-:.TZ]/gu, "").slice(0, 14) }
function inside(relative) { assert.equal(path.isAbsolute(relative), false); const candidate = path.resolve(ROOT, relative); assert.ok(candidate.startsWith(`${path.resolve(ROOT)}${path.sep}`)); return candidate }
function index(file, runId = RUN_ID) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, artifactType: "stage4_full_backbone_spatial_affine_cpu_support_v1", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) }) }

function assertChildSucceeded(result, label) {
  if (result.error?.code === "ETIMEDOUT") {
    throw new Error(`${label} timed out after ${CPU_CHILD_TIMEOUT_MS}ms`)
  }
  assert.equal(
    result.status,
    0,
    `${label} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`,
  )
}

function recordFailure(error) {
  try {
    fs.mkdirSync(path.dirname(FAILURE_OUTPUT), { recursive: true })
    fs.mkdirSync(FAILURE_OUTPUT, { recursive: false })
    const failure = path.join(FAILURE_OUTPUT, "failure-report.json")
    const transaction = fs.existsSync(TRANSACTION_JOURNAL)
      ? readJournal(TRANSACTION_JOURNAL)
      : null
    const currentRegistryRunId = transaction !== null && fs.existsSync(FILES.currentRegistry)
      ? read(FILES.currentRegistry).runId
      : null
    const registryWasCommitted = transaction !== null && (
      [
        "registry_committed",
        "plan_committed",
        "event_committed",
        "complete",
      ].includes(transaction.state)
      || currentRegistryRunId === transaction.runId
    )
    const recordedAtUtc = new Date().toISOString()
    const record = {
      schemaVersion: "stage4-full-backbone-spatial-affine-cpu-support-failure-v1",
      executionState: "completed",
      status: registryWasCommitted
        ? "cpu_support_projection_recovery_pending"
        : "cpu_inactive_support_failed_closed",
      runId: RUN_ID,
      capabilityVersion: CAPABILITY,
      error: error instanceof Error ? error.message : String(error),
      transactionState: transaction?.state ?? null,
      transactionJournal: transaction === null
        ? null
        : projectPath(TRANSACTION_JOURNAL),
      checkpointWeightsRead: false,
      gpuStarted: false,
      optimizerCreated: false,
      backwardExecuted: false,
      trainingStarted: false,
      recordedAtUtc,
    }
    writeExclusive(failure, record)
    index(failure)
    appendAiPainterProgramEvent({
      id: `stage4-full-backbone-spatial-affine-cpu-support-failure-${RUN_ID}`,
      timestamp: recordedAtUtc,
      action: registryWasCommitted
        ? "stage4_full_backbone_spatial_affine_cpu_support_recovery_pending"
        : "stage4_full_backbone_spatial_affine_cpu_support_failed_closed",
      runId: RUN_ID,
      kind: "cpu_inactive_candidate_implementation",
      status: registryWasCommitted ? "recovery_pending" : "failed",
      title: "Stage4 full-backbone spatial-affine CPU support did not close",
      titleZh: registryWasCommitted
        ? "Stage4全主干空间仿射CPU支持提交待恢复"
        : "Stage4全主干空间仿射CPU支持失败关闭",
      detailZh: record.error,
      evidencePath: projectPath(failure),
      evidenceSha256: sha(failure),
      fixedTotalProgress: progress(),
    })
  } catch (recordingError) {
    process.stderr.write(
      `failure evidence recording also failed: ${recordingError instanceof Error ? recordingError.stack : String(recordingError)}\n`,
    )
  }
}
