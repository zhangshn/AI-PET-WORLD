import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawn, spawnSync } from "node:child_process"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { auditAiAssistedProfessionalAesthetic } from "./lib/ai-assisted-professional-aesthetic.mjs"
import { normalizePreviewWithWindowsSafeIo } from "./lib/ai-assisted-v7-r5-stage3-preview-review.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const PYTHON = path.resolve(ROOT, "ml/ai-painter/.venv/Scripts/python.exe")
const TRAINER = path.resolve(ROOT, "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
const PREPARER = path.resolve(ROOT, "ml/ai-painter/scripts/prepare_stage4_isolated_responsibility_component_smoke_config.py")
const CHECKER = path.resolve(ROOT, "ml/ai-painter/scripts/check_stage4_isolated_responsibility_component_smoke_cpu.py")
const BACKWARD_QUALIFIER = path.resolve(ROOT, "ml/ai-painter/scripts/run_stage4_isolated_responsibility_component_backward_gpu_qualification.py")
const CONTRACT = path.resolve(ROOT, ".runtime/ai-painter/stage4-controlled-three-component-stage0-smoke-contract-compilations/20260824-023500000/controlled-three-component-stage0-smoke-contract.json")
const COMPILATION_TERMINAL = path.resolve(ROOT, ".runtime/ai-painter/stage4-controlled-three-component-stage0-smoke-contract-compilations/20260824-023500000/phase-terminal.json")
const DATASET = path.resolve(ROOT, "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json")
const SOURCE_INDEX = path.resolve(ROOT, "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json")
const AUTOENCODER = path.resolve(ROOT, ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt")
const REPAIR_SOURCE_ROOT = path.resolve(ROOT, ".runtime/ai-painter/stage4-controlled-three-component-stage0-smokes/owner-authorized-stage4-controlled-three-component-stage0-smoke-20260824-023500000-20260824-031422954")
const REPAIR_AUTH_ROOT = path.resolve(ROOT, ".runtime/ai-painter/stage4-controlled-three-component-stage0-smoke-authorizations/owner-authorized-stage4-controlled-three-component-stage0-smoke-20260824-023500000-20260824-031422954")
const REPAIR_FAILURE_TERMINAL = path.join(REPAIR_SOURCE_ROOT, "phase-terminal.json")
const REPAIR_CPU_REPORT = path.resolve(ROOT, ".runtime/ai-painter/stage4-controlled-three-component-stage0-smoke-cpu/20260824-031422954/cpu-report.json")
const REPAIR_TERRAIN_ACTIVE_CONFIG = path.join(REPAIR_AUTH_ROOT, "1-terrain-route-hydrology-spatial-realization", "active-config.json")
const REPAIR_TERRAIN_CONSUMPTION = path.join(REPAIR_AUTH_ROOT, "1-terrain-route-hydrology-spatial-realization", "gpu-consumption.json")
const SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
const ROLES = [
  "terrain_route_hydrology_spatial_realization",
  "per_class_object_semantic_realization",
  "global_visual_harmonization_and_native_complete_rgb_decode",
]
const ROLE_SLUGS = [
  "terrain-route-hydrology-spatial-realization",
  "per-class-object-semantic-realization",
  "global-visual-harmonization-native-complete-rgb-decode",
]
const EXPECTED = {
  compilationTerminal: "671c62bd5a2925df6073edf4275d60086201f322b5e09bfa3007bc5926786d8a",
  contract: "c72fa7443bc79adb794f50fcb1daaf872e5eac9b720c37588ebf9c6659262748",
  compilationCpuReport: "dcd0bd3f59e060c6b28a5a49fa9d030711f798dcac531a5753ce94cb7ea721a4",
  evidenceIsolationAudit: "114b0f824872beb1fbcc63d101ccefc717ffccad76d288333533854fdd91ad12",
  compilationOwnerRequest: "726d710e03a72a7a4b55d74f639d0da30d0bed9e4dd02751322a6cb9fa1301ec",
  autoencoder: "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba",
  sourceIndex: "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251",
  repairFailureTerminal: "44d200262813ef85eee22986a5648f0c7afa66ecc39780cfefa7a816ebe198c0",
  repairCpuReport: "a27e3f25ae95e4fa5a0408b116502337a0b00496e4518832843a99f3e9518ad5",
  repairTerrainActiveConfig: "7e929a37cc767faea23e770ab05cb0ce77ef55e179669209f821f57cc84216d5",
  repairTerrainConsumption: "e58764150f844891c74ffa02c22e5319559df60149e2a1bb66fd13f5a8060d9b",
}

export async function runControlledThreeComponentStage0Smoke(argv = process.argv.slice(2)) {
  try {
    return await executeControlledThreeComponentStage0Smoke(argv)
  } catch (error) {
    const failureId = timestampId()
    const failureRoot = path.resolve(ROOT, `.runtime/ai-painter/stage4-controlled-three-component-stage0-smoke-failures/${failureId}`)
    fs.mkdirSync(failureRoot, { recursive: true })
    const terminalPath = path.join(failureRoot, "phase-terminal.json")
    writeJsonAtomic(terminalPath, {
      schemaVersion: "stage4-controlled-three-component-stage0-smoke-entry-failure-v1",
      status: "stage4_controlled_three_component_stage0_smoke_entry_failed_closed",
      error: String(error?.message ?? error),
      authorizationAndExecutionState: "inspect_specific_failure_evidence",
      fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
      recordedAtUtc: new Date().toISOString(),
    })
    recordGovernance(failureId, terminalPath, "stage4_controlled_three_component_stage0_smoke_entry_failed_closed", [])
    console.error(JSON.stringify({ status: "stage4_controlled_three_component_stage0_smoke_entry_failed_closed", terminal: bind(terminalPath), error: String(error?.message ?? error) }, null, 2))
    return 1
  }
}

async function executeControlledThreeComponentStage0Smoke(argv) {
  if (!argv.includes("--execute-owner-authorized")) throw new Error("controlled_three_component_smoke_owner_authorization_flag_required")
  verifyBindings()
  const contract = readJson(CONTRACT)
  const runId = timestampId()
  const cpuRoot = path.resolve(ROOT, `.runtime/ai-painter/stage4-controlled-three-component-stage0-smoke-cpu/${runId}`)
  if (fs.existsSync(cpuRoot)) throw new Error("controlled_three_component_smoke_cpu_run_exists")
  fs.mkdirSync(cpuRoot, { recursive: true })
  const cpuReportPath = path.join(cpuRoot, "cpu-report.json")
  runChecked(PYTHON, [CHECKER, "--contract", CONTRACT, "--dataset-package", DATASET, "--output", cpuReportPath], "component_smoke_cpu_regression")
  const cpuReport = readJson(cpuReportPath)
  if (cpuReport.status !== "passed" || cpuReport.gpuStarted || cpuReport.optimizerCreated || cpuReport.trainingStarted) throw new Error("component_smoke_cpu_report_invalid")

  const fixtureRoot = path.join(cpuRoot, "trainer-preflight-fixtures")
  fs.mkdirSync(fixtureRoot, { recursive: false })
  for (let index = 0; index < ROLES.length; index += 1) {
    const component = contract.components[index]
    const fixture = buildAuthorization(contract, component, runId, index, true)
    const fixturePath = path.join(fixtureRoot, `${index + 1}-authorization.json`)
    writeJsonAtomic(fixturePath, fixture)
    const activePath = path.join(fixtureRoot, `${index + 1}-active-config.json`)
    runChecked(PYTHON, [PREPARER, "--source-config", component.sourceConfig.path, "--authorization", fixturePath, "--execution-state", "preflight_unconsumed", "--output", activePath], `component_${index + 1}_config_preflight_compile`)
    const outputMustNotExist = path.join(fixtureRoot, `${index + 1}-trainer-output-must-not-exist`)
    const trainerInvocationArgs = trainerArgs(activePath, outputMustNotExist, null, true)
    runChecked(PYTHON, trainerInvocationArgs, `component_${index + 1}_node_to_trainer_preflight`)
    if (fs.existsSync(outputMustNotExist)) throw new Error("component_smoke_preflight_created_training_output")
  }
  const resources = resourceSnapshot()
  if (!resources.passed) throw new Error(`component_smoke_resource_preflight_failed:${resources.blockers.join(",")}`)

  const qualificationRoot = path.resolve(ROOT, `.runtime/ai-painter/stage4-controlled-three-component-backward-gpu-qualifications/${runId}`)
  if (fs.existsSync(qualificationRoot)) throw new Error("component_backward_qualification_output_exists")
  fs.mkdirSync(qualificationRoot, { recursive: true })
  const qualificationAuthorizationPath = path.join(qualificationRoot, "authorization.json")
  const qualificationConsumptionPath = path.join(qualificationRoot, "gpu-consumption.json")
  const qualificationActiveConfigPath = path.join(qualificationRoot, "active-config.json")
  const qualificationReportPath = path.join(qualificationRoot, "gpu-report.json")
  const qualificationAuthorization = buildQualificationAuthorization(contract, runId, qualificationRoot)
  writeJsonAtomic(qualificationAuthorizationPath, qualificationAuthorization)
  writeJsonAtomic(qualificationConsumptionPath, {
    schemaVersion: "stage4-isolated-responsibility-component-backward-readonly-gpu-consumption-v1",
    status: "component_backward_readonly_gpu_authorization_consumed",
    authorization: bind(qualificationAuthorizationPath),
    consumedAtUtc: new Date().toISOString(),
  })
  runChecked(PYTHON, [PREPARER,
    "--source-config", contract.components[0].sourceConfig.path,
    "--authorization", qualificationAuthorizationPath,
    "--consumption", qualificationConsumptionPath,
    "--execution-state", "readonly_qualification_consumed",
    "--output", qualificationActiveConfigPath,
  ], "component_backward_qualification_active_config_compile")
  runChecked(PYTHON, [BACKWARD_QUALIFIER,
    "--config", qualificationActiveConfigPath,
    "--dataset-package", DATASET,
    "--autoencoder-checkpoint", AUTOENCODER,
    "--authorization", qualificationAuthorizationPath,
    "--consumption", qualificationConsumptionPath,
    "--output", qualificationReportPath,
  ], "component_backward_readonly_gpu_qualification")
  const qualificationReport = readJson(qualificationReportPath)
  if (
    qualificationReport.status !== "stage4_terrain_component_readonly_gpu_backward_qualification_passed"
    || qualificationReport.optimizerCreated !== false
    || qualificationReport.backwardExecuted !== false
    || qualificationReport.weightModified !== false
    || qualificationReport.modelStateUnchanged !== true
    || qualificationReport.autoencoderStateUnchanged !== true
  ) throw new Error("component_backward_readonly_gpu_qualification_report_invalid")
  writeJsonAtomic(path.join(qualificationRoot, "phase-terminal.json"), {
    schemaVersion: "stage4-isolated-responsibility-component-backward-gpu-qualification-terminal-v1",
    status: "stage4_terrain_component_readonly_gpu_backward_qualification_succeeded",
    authorization: bind(qualificationAuthorizationPath),
    consumption: bind(qualificationConsumptionPath),
    gpuReport: bind(qualificationReportPath),
    trainingStarted: false,
    weightModified: false,
    recordedAtUtc: new Date().toISOString(),
  })

  const packageId = `owner-authorized-${contract.packageId}-${runId}`
  const packageRoot = path.resolve(ROOT, `.runtime/ai-painter/stage4-controlled-three-component-stage0-smokes/${packageId}`)
  const authorizationRoot = path.resolve(ROOT, `.runtime/ai-painter/stage4-controlled-three-component-stage0-smoke-authorizations/${packageId}`)
  if (fs.existsSync(packageRoot) || fs.existsSync(authorizationRoot)) throw new Error("component_smoke_formal_output_exists")
  fs.mkdirSync(packageRoot, { recursive: true })
  fs.mkdirSync(authorizationRoot, { recursive: true })
  const roleContexts = contract.components.map((component, index) => {
    const roleRoot = path.join(packageRoot, `${index + 1}-${ROLE_SLUGS[index]}`)
    const authRoot = path.join(authorizationRoot, `${index + 1}-${ROLE_SLUGS[index]}`)
    fs.mkdirSync(authRoot, { recursive: false })
    const authorization = buildAuthorization(contract, component, runId, index, false, packageId, roleRoot, authRoot)
    const authorizationPath = path.join(authRoot, "authorization.json")
    writeJsonAtomic(authorizationPath, authorization)
    return { component, role: ROLES[index], index, roleRoot, authRoot, authorizationPath, authorization }
  })
  writeJsonAtomic(path.join(authorizationRoot, "authorization-package.json"), {
    schemaVersion: "owner-authorized-stage4-controlled-three-component-stage0-smoke-package-v1",
    status: "three_independent_gpu_authorizations_materialized_unconsumed",
    packageId, executionOrder: ROLES,
    authorizations: roleContexts.map((row) => ({ roleId: row.role, authorization: bind(row.authorizationPath) })),
    recordedAtUtc: new Date().toISOString(),
  })

  const results = []
  try {
    for (const context of roleContexts) {
      const runtimeResources = resourceSnapshot()
      if (!runtimeResources.passed) throw new Error(`component_${context.index + 1}_resource_gate_failed:${runtimeResources.blockers.join(",")}`)
      const consumptionPath = path.join(context.authRoot, "gpu-consumption.json")
      if (fs.existsSync(consumptionPath) || fs.existsSync(context.roleRoot)) throw new Error("component_smoke_authorization_or_output_already_consumed")
      const consumption = {
        schemaVersion: "stage4-controlled-three-component-stage0-smoke-gpu-consumption-v1",
        status: "component_gpu_smoke_authorization_atomically_consumed",
        packageId, roleId: context.role, roleIndex: context.index,
        authorization: bind(context.authorizationPath), consumedAtUtc: new Date().toISOString(),
      }
      writeJsonAtomic(consumptionPath, consumption)
      const activeConfigPath = path.join(context.authRoot, "active-config.json")
      runChecked(PYTHON, [PREPARER, "--source-config", context.component.sourceConfig.path, "--authorization", context.authorizationPath, "--consumption", consumptionPath, "--execution-state", "consumed", "--output", activeConfigPath], `component_${context.index + 1}_active_config_compile`)
      const predecessorIdentity = context.index === 0 ? null : path.join(roleContexts[context.index - 1].roleRoot, "training-output", "output-identity.json")
      const trainingOutput = path.join(context.roleRoot, "training-output")
      fs.mkdirSync(context.roleRoot, { recursive: false })
      writeJsonAtomic(path.join(context.roleRoot, "preflight-report.json"), {
        schemaVersion: "stage4-controlled-three-component-stage0-smoke-preflight-v1",
        status: "cpu_and_resource_preflight_passed_before_authorization_materialization",
        roleId: context.role, resources: runtimeResources, cpuReport: bind(cpuReportPath),
        activeConfigAudit: { path: relative(activeConfigPath), sha256: sha(activeConfigPath) },
        gpuNotStartedAtPreflight: true,
        authorizationWasUnconsumedAtPreflight: true,
      })
      const execution = await runTrainer(activeConfigPath, trainingOutput, predecessorIdentity, context.role)
      if (execution.exitCode !== 0) throw new Error(`component_${context.index + 1}_trainer_failed:${execution.exitCode}:${execution.stderr.slice(-1200)}`)
      const manifestPath = path.join(trainingOutput, "manifest.json")
      const outputIdentityPath = path.join(trainingOutput, "output-identity.json")
      const manifest = readJson(manifestPath)
      if (manifest.status !== "component_smoke_training_completed" || manifest.roleId !== context.role || !fileMatches(outputIdentityPath, manifest.outputIdentity.sha256)) throw new Error("component_smoke_manifest_or_output_identity_invalid")
      let review = null
      if (context.index === 2) review = await reviewFinalPreviews(
        trainingOutput,
        contract,
        path.join(context.roleRoot, "machine-review"),
      )
      const blockers = review && review.previewFailCount > 0 ? review.reviews.flatMap((row) => row.passed ? [] : row.issueCodes.map((code) => `epoch_${row.epoch}:${code}`)) : []
      const naturallyCompleted = true
      const status = blockers.length === 0 ? "controlled_component_smoke_completed" : "controlled_component_smoke_completed_with_real_visual_failure"
      const finalizationDir = path.join(context.roleRoot, "finalization")
      fs.mkdirSync(finalizationDir, { recursive: false })
      const finalizationPath = path.join(finalizationDir, "finalization.json")
      writeJsonAtomic(finalizationPath, {
        schemaVersion: "stage4-controlled-three-component-stage0-smoke-component-finalization-v1",
        status, packageId, roleId: context.role, roleIndex: context.index,
        naturallyCompleted, blockers, manifest: bind(manifestPath), outputIdentity: bind(outputIdentityPath),
        checkpoint: manifest.checkpoint, resourceTelemetry: bind(path.join(trainingOutput, "resource-telemetry.json")),
        machineReview: review, authorization: bind(context.authorizationPath), consumption: bind(consumptionPath),
        automaticRetryStarted: false, stage0Started: false,
      })
      const terminalPath = path.join(context.roleRoot, "phase-terminal.json")
      writeJsonAtomic(terminalPath, {
        schemaVersion: "stage4-controlled-three-component-stage0-smoke-component-terminal-v1",
        status, packageId, roleId: context.role, blockers,
        finalization: bind(finalizationPath), outputIdentity: bind(outputIdentityPath),
        fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
        recordedAtUtc: new Date().toISOString(),
      })
      results.push({ roleId: context.role, terminal: bind(terminalPath), manifest: bind(manifestPath), outputIdentity: bind(outputIdentityPath), review })
      if (blockers.length > 0) break
    }
  } catch (error) {
    return closePackageFailure({ packageId, packageRoot, authorizationRoot, cpuReportPath, results, error })
  }

  const completedAll = results.length === 3
  const visualFailure = results.some((row) => row.review?.previewFailCount > 0)
  const terminalStatus = completedAll && !visualFailure
    ? "stage4_controlled_three_component_stage0_smoke_completed_pending_late_stability_qualification"
    : "stage4_controlled_three_component_stage0_smoke_failed_closed"
  const ownerRequestPath = path.join(packageRoot, "owner-action-request.json")
  writeJsonAtomic(ownerRequestPath, {
    schemaVersion: "ai-painter-owner-action-request-v1",
    status: terminalStatus.includes("pending_late") ? "waiting_owner_authorization" : "closed_no_training_rerun_requested",
    requestedAction: terminalStatus.includes("pending_late") ? "run_cpu_readonly_late_stability_qualification_for_controlled_three_component_smoke" : "review_real_visual_failure_without_automatic_retry",
    packageId, componentTerminals: results.map((row) => ({ roleId: row.roleId, terminal: row.terminal })),
    stage0Authorized: false, stage1Authorized: false, stage2Authorized: false, automaticRetryAuthorized: false,
  })
  const terminalPath = path.join(packageRoot, "phase-terminal.json")
  writeJsonAtomic(terminalPath, {
    schemaVersion: "stage4-controlled-three-component-stage0-smoke-terminal-v1",
    status: terminalStatus, packageId, componentResults: results,
    finalMachineReview: results.at(-1)?.review ?? null,
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    ownerActionRequest: bind(ownerRequestPath),
    stage0Started: false, stage1Started: false, stage2Started: false, automaticRetryStarted: false,
    recordedAtUtc: new Date().toISOString(),
  })
  recordGovernance(packageId, terminalPath, terminalStatus, results)
  console.log(JSON.stringify({ status: terminalStatus, terminal: bind(terminalPath), ownerActionRequest: bind(ownerRequestPath), componentResults: results, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } }, null, 2))
  return terminalStatus.includes("pending_late") ? 0 : 1
}

function verifyBindings() {
  const compilation = readJson(COMPILATION_TERMINAL)
  const bindings = {
    compilationTerminal: COMPILATION_TERMINAL,
    contract: CONTRACT,
    compilationCpuReport: path.resolve(ROOT, compilation.cpuReport.path),
    evidenceIsolationAudit: path.resolve(ROOT, compilation.evidenceIsolationAudit.path),
    compilationOwnerRequest: path.resolve(ROOT, compilation.ownerActionRequest.path),
    autoencoder: AUTOENCODER,
    sourceIndex: SOURCE_INDEX,
    repairFailureTerminal: REPAIR_FAILURE_TERMINAL,
    repairCpuReport: REPAIR_CPU_REPORT,
    repairTerrainActiveConfig: REPAIR_TERRAIN_ACTIVE_CONFIG,
    repairTerrainConsumption: REPAIR_TERRAIN_CONSUMPTION,
  }
  for (const [name, file] of Object.entries(bindings)) if (!fs.existsSync(file) || sha(file) !== EXPECTED[name]) throw new Error(`controlled_three_component_smoke_binding_changed:${name}`)
  for (const file of [TRAINER, PREPARER, CHECKER, BACKWARD_QUALIFIER]) if (!fs.existsSync(file)) throw new Error(`controlled_three_component_smoke_program_missing:${relative(file)}`)
}

function buildAuthorization(contract, component, runId, index, fixture, packageId = contract.packageId, roleRoot = null, authRoot = null) {
  const role = ROLES[index]
  const predecessor = index === 0 ? { kind: "authoritative_world_structure_binding" } : {
    roleId: ROLES[index - 1], samePackageRequired: true,
    terminalPath: roleRoot ? relative(path.join(path.dirname(roleRoot), `${index}-${ROLE_SLUGS[index - 1]}`, "phase-terminal.json")) : `cpu-fixture/${index}/phase-terminal.json`,
    outputIdentityPath: roleRoot ? relative(path.join(path.dirname(roleRoot), `${index}-${ROLE_SLUGS[index - 1]}`, "training-output", "output-identity.json")) : `cpu-fixture/${index}/output-identity.json`,
  }
  return {
    schemaVersion: "owner-authorized-stage4-controlled-three-component-stage0-smoke-role-v1",
    status: fixture ? "cpu_fixture_not_authorized" : "resolved_owner_authorized_not_consumed",
    packageId, requestId: `${packageId}-${role}`, commandRef: `${packageId}-${role}`,
    runId: `${runId}-0${index + 1}`, scope: `one_30_epoch_stage0_smoke_for_${role}`,
    roleId: role, roleIndex: index, executionOrder: ROLES,
    bindings: {
      compilationTerminal: bind(COMPILATION_TERMINAL), compiledSmokeContract: bind(CONTRACT),
      sourceConfig: component.sourceConfig, readonlyGpuQualificationTerminal: component.readonlyGpuQualification.terminal,
      projectAutoencoderCheckpoint: { path: relative(AUTOENCODER), sha256: EXPECTED.autoencoder },
      sourceIndex: { path: relative(SOURCE_INDEX), sha256: EXPECTED.sourceIndex },
      trainer: bind(TRAINER), configPreparer: bind(PREPARER), cpuChecker: bind(CHECKER),
    }, predecessor,
    execution: fixture ? {} : {
      outputDirectory: relative(roleRoot), trainingOutputDirectory: relative(path.join(roleRoot, "training-output")),
      consumptionPath: relative(path.join(authRoot, "gpu-consumption.json")),
      activeConfigPath: relative(path.join(authRoot, "active-config.json")),
    },
    oneTimeConsumption: true, gpuAuthorized: !fixture, autoencoderCheckpointReadAuthorized: !fixture,
    denoiserCheckpointReadAuthorized: false, optimizerAuthorized: !fixture, backwardAuthorized: !fixture,
    modelWeightModificationAuthorized: !fixture, checkpointWriteAuthorized: !fixture,
    smokeAuthorized: !fixture, trainingAuthorized: !fixture, stage0Authorized: false,
    stage1Authorized: false, stage2Authorized: false, automaticRetryAuthorized: false,
  }
}

function buildQualificationAuthorization(contract, runId, qualificationRoot) {
  const component = contract.components[0]
  return {
    schemaVersion: "owner-authorized-stage4-isolated-responsibility-component-backward-readonly-gpu-v1",
    status: "resolved_owner_authorized_not_consumed",
    packageId: `stage4-component-backward-qualification-${runId}`,
    requestId: `stage4-component-backward-qualification-${runId}`,
    commandRef: `stage4-component-backward-qualification-${runId}`,
    runId,
    scope: "one_readonly_cuda_full_terrain_loss_autograd_grad_qualification",
    roleId: ROLES[0],
    roleIndex: 0,
    executionOrder: ROLES,
    bindings: {
      repairFailureTerminal: bind(REPAIR_FAILURE_TERMINAL),
      repairCpuReport: bind(REPAIR_CPU_REPORT),
      repairTerrainActiveConfig: bind(REPAIR_TERRAIN_ACTIVE_CONFIG),
      repairTerrainConsumption: bind(REPAIR_TERRAIN_CONSUMPTION),
      sourceConfig: component.sourceConfig,
      compiledSmokeContract: bind(CONTRACT),
      projectAutoencoderCheckpoint: { path: relative(AUTOENCODER), sha256: EXPECTED.autoencoder },
      sourceIndex: { path: relative(SOURCE_INDEX), sha256: EXPECTED.sourceIndex },
      qualifier: bind(BACKWARD_QUALIFIER),
    },
    predecessor: { kind: "authoritative_world_structure_binding" },
    execution: {
      outputDirectory: relative(qualificationRoot),
      consumptionPath: relative(path.join(qualificationRoot, "gpu-consumption.json")),
      activeConfigPath: relative(path.join(qualificationRoot, "active-config.json")),
      reportPath: relative(path.join(qualificationRoot, "gpu-report.json")),
    },
    oneTimeConsumption: true,
    readonlyGpuQualificationAuthorized: true,
    gpuAuthorized: true,
    autoencoderCheckpointReadAuthorized: true,
    denoiserCheckpointReadAuthorized: false,
    optimizerAuthorized: false,
    backwardAuthorized: false,
    modelWeightModificationAuthorized: false,
    checkpointWriteAuthorized: false,
    smokeAuthorized: false,
    trainingAuthorized: false,
    stage0Authorized: false,
    stage1Authorized: false,
    stage2Authorized: false,
    automaticRetryAuthorized: false,
  }
}

function trainerArgs(activeConfig, outputDir, predecessor, preflight) {
  const values = [TRAINER, "--config", activeConfig, "--dataset-package", DATASET, "--autoencoder-checkpoint", AUTOENCODER, "--output-dir", outputDir, "--resolution-stage", "0", "--single-sample-overfit-smoke", "--overfit-sample-id", SAMPLE_ID, "--overfit-epochs", "30", "--overfit-evaluation-interval", "5", "--stage4-responsibility-component-smoke"]
  if (predecessor) values.push("--stage4-predecessor-output-identity", predecessor)
  if (preflight) values.push("--preflight-only")
  return values
}

function runTrainer(activeConfig, outputDir, predecessor, role) {
  return new Promise((complete) => {
    const child = spawn(PYTHON, trainerArgs(activeConfig, outputDir, predecessor, false), { cwd: ROOT, env: pythonEnv(), windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""; let stderr = ""
    child.stdout.on("data", (chunk) => { stdout += chunk; process.stdout.write(chunk) })
    child.stderr.on("data", (chunk) => { stderr += chunk; process.stderr.write(chunk) })
    const timer = setInterval(() => {
      const progress = tryReadJson(path.join(outputDir, "progress.json"))
      console.log(JSON.stringify({ kind: "controlled_three_component_smoke_heartbeat", roleId: role, epoch: progress?.currentEpoch ?? null, optimizerStep: progress?.optimizerStep ?? null, recordedAtUtc: new Date().toISOString() }))
    }, 20000)
    child.on("close", (exitCode, signal) => { clearInterval(timer); complete({ exitCode, signal, stdout, stderr }) })
  })
}

export async function reviewFinalPreviews(trainingOutput, contract, reviewRoot = path.join(trainingOutput, "machine-review")) {
  const previewRoot = path.join(trainingOutput, "fixed-epoch-previews")
  const files = fs.readdirSync(previewRoot).filter((name) => name.endsWith(".png")).sort()
  const epochs = files.map((name) => Number(name.match(/^epoch-(\d+)/)?.[1]))
  if (JSON.stringify(epochs) !== JSON.stringify([1, 5, 10, 20, 30])) throw new Error("component_final_preview_schedule_invalid")
  const sourceIndex = readJson(SOURCE_INDEX)
  const { sample } = validateControlledThreeComponentSourceIndex(sourceIndex)
  const conditionPack = readJson(path.resolve(ROOT, sample.conditionPackPath))
  const reviews = []
  for (const name of files) {
    const epoch = Number(name.match(/^epoch-(\d+)/)[1])
    const source = path.join(previewRoot, name)
    const normalizedPath = path.join(reviewRoot, "fixed-preview-review-assets", `e${String(epoch).padStart(3, "0")}.png`)
    const workId = crypto.createHash("sha256").update(trainingOutput, "utf8").digest("hex").slice(0, 16)
    const normalized = await normalizePreviewWithWindowsSafeIo({ sourcePath: source, finalAssetPath: normalizedPath, workRoot: path.resolve(ROOT, ".runtime/ai-painter/stage4-controlled-three-component-smoke-review-work"), workId, epoch })
    const [aesthetic, alignment] = await Promise.all([
      auditAiAssistedProfessionalAesthetic(normalized.shortOutputPath),
      auditAiAssistedConditionAlignment({ record: { recordId: `three-component-smoke-${epoch}`, conditionBinding: { conditionPackPath: sample.conditionPackPath, worldId: conditionPack.worldId, tick: conditionPack.tick }, classification: sample.classification }, imagePath: normalized.shortOutputPath, referenceImagePath: sample.imagePath }),
    ])
    reviews.push({ epoch, previewPath: relative(source), previewSha256: sha(source), normalizedPath: relative(normalizedPath), normalizedSha256: normalized.normalizedSha256, passed: aesthetic.passed && alignment.passed, issueCodes: [...aesthetic.issues, ...alignment.issues].map((issue) => issue.code), professionalAesthetic: aesthetic, conditionAlignment: alignment })
  }
  const report = { schemaVersion: "stage4-controlled-three-component-stage0-smoke-machine-review-v1", status: reviews.every((row) => row.passed) ? "machine_reviews_passed" : "machine_reviews_failed_closed", reviewThresholdsChanged: false, requiredEpochs: [1, 5, 10, 20, 30], reviews, previewCount: reviews.length, previewPassCount: reviews.filter((row) => row.passed).length, previewFailCount: reviews.filter((row) => !row.passed).length }
  const reportPath = path.join(reviewRoot, "fixed-preview-reviews.json")
  writeJsonAtomic(reportPath, report)
  return { ...report, path: relative(reportPath), sha256: sha(reportPath) }
}

export function validateControlledThreeComponentSourceIndex(sourceIndex) {
  if (
    !sourceIndex
    || Array.isArray(sourceIndex)
    || sourceIndex.schemaVersion !== "ai-assisted-cold-start-dataset-source-index-v1"
    || sourceIndex.sampleCount !== 116
    || !Array.isArray(sourceIndex.samples)
    || sourceIndex.samples.length !== 116
    || sourceIndex.v7CapacityContributionCount !== 64
    || !Array.isArray(sourceIndex.v7CapacityContributions)
    || sourceIndex.v7CapacityContributions.length !== 64
  ) throw new Error("component_final_review_source_index_contract_invalid")
  const sampleMatches = sourceIndex.samples.filter((row) => row.sampleId === SAMPLE_ID)
  const capacityMatches = sourceIndex.v7CapacityContributions.filter((row) => row.sampleId === SAMPLE_ID)
  if (
    sampleMatches.length !== 1
    || capacityMatches.length !== 1
    || sampleMatches[0].split !== "validation"
  ) throw new Error("component_final_review_sample_identity_invalid")
  return { sample: sampleMatches[0], capacityContribution: capacityMatches[0] }
}

function closePackageFailure({ packageId, packageRoot, authorizationRoot, cpuReportPath, results, error }) {
  const unconsumedAuthorizations = ROLES.filter((_, index) => {
    const authRoot = path.join(authorizationRoot, `${index + 1}-${ROLE_SLUGS[index]}`)
    return !fs.existsSync(path.join(authRoot, "gpu-consumption.json"))
  })
  const terminalPath = path.join(packageRoot, "phase-terminal.json")
  writeJsonAtomic(terminalPath, {
    schemaVersion: "stage4-controlled-three-component-stage0-smoke-terminal-v1",
    status: "stage4_controlled_three_component_stage0_smoke_execution_failed_closed",
    packageId, error: String(error?.message ?? error), completedComponents: results,
    unconsumedAuthorizations, cpuReport: bind(cpuReportPath),
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    automaticRetryStarted: false, stage0Started: false, recordedAtUtc: new Date().toISOString(),
  })
  recordGovernance(packageId, terminalPath, "stage4_controlled_three_component_stage0_smoke_execution_failed_closed", results)
  console.error(JSON.stringify({ status: "stage4_controlled_three_component_stage0_smoke_execution_failed_closed", terminal: bind(terminalPath), error: String(error?.message ?? error) }, null, 2))
  return 1
}

function recordGovernance(packageId, terminalPath, status, results) {
  const capsulePath = path.join(path.dirname(terminalPath), "local-task-capsule.json")
  writeJsonAtomic(capsulePath, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", currentStage: "Stage4 controlled three-component Stage0 Smoke", status, latestTerminal: bind(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, nextLegalAction: status.includes("pending_late") ? "cpu_readonly_late_stability_qualification" : "none_without_new_owner_authorization", recordedAtUtc: new Date().toISOString() })
  appendAiPainterProgramEvent({ id: `stage4-controlled-three-component-smoke-${packageId}`, timestamp: new Date().toISOString(), action: "stage4_controlled_three_component_stage0_smoke", runId: packageId, kind: "gpu_smoke", status: status.includes("pending_late") ? "success" : "failed", title: "Stage4 controlled three-component Stage0 Smoke", titleZh: "Stage4受控三组件Stage 0 Smoke", detailZh: `三组件完成数 ${results.length}/3；固定进度保持60%。`, evidencePath: relative(terminalPath), evidenceSha256: sha(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
  const planPath = path.resolve(ROOT, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
  let text = fs.readFileSync(planPath, "utf8")
  text = text.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(new Date().toISOString()).replace("T", " ")}`)
  text = text.replace(/^状态：.*$/m, `状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4受控三组件Stage 0 Smoke ${status.includes("pending_late") ? "已自然完成，等待CPU只读后期稳定资格" : "已保存失败证据并关闭"}`)
  const temp = `${planPath}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(temp, text, "utf8"); fs.renameSync(temp, planPath)
}

function resourceSnapshot() {
  const gpu = spawnSync("nvidia-smi", ["--query-gpu=memory.total,memory.used,utilization.gpu", "--format=csv,noheader,nounits"], { encoding: "utf8", windowsHide: true })
  const disk = fs.statfsSync(ROOT); const freeBytes = Number(disk.bavail) * Number(disk.bsize)
  const values = gpu.status === 0 ? gpu.stdout.trim().split(",").map((value) => Number(value.trim())) : [0, 0, 100]
  const blockers = []
  if (gpu.status !== 0) blockers.push("cuda_gpu_unavailable")
  if (values[0] - values[1] < 4096) blockers.push("gpu_free_memory_below_4096_mib")
  if (freeBytes < 4 * 1024 ** 3) blockers.push("disk_free_below_4_gib")
  if (!fs.existsSync(PYTHON)) blockers.push("python_runtime_missing")
  return { passed: blockers.length === 0, blockers, gpu: { memoryTotalMiB: values[0], memoryUsedMiB: values[1], utilizationPercent: values[2] }, memory: { totalBytes: os.totalmem(), freeBytes: os.freemem() }, disk: { freeBytes }, recordedAtUtc: new Date().toISOString() }
}

function runChecked(command, args, label) { const result = spawnSync(command, args, { cwd: ROOT, env: pythonEnv(), encoding: "utf8", windowsHide: true, timeout: 20 * 60 * 1000 }); if (result.status !== 0) throw new Error(`${label}_failed:${result.stderr || result.stdout}`); return result }
function pythonEnv() { return { ...process.env, PYTHONUTF8: "1", PYTHONPATH: `${path.resolve(ROOT, "ml/ai-painter/src")};${path.resolve(ROOT, "ml/ai-painter/scripts")}` } }
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function tryReadJson(value) { try { return readJson(value) } catch { return null } }
function sha(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function fileMatches(value, expected) { return fs.existsSync(value) && sha(value) === expected }
function relative(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function bind(value) { return { path: relative(value), sha256: sha(value) } }
function timestampId() { const now = new Date(); const p = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now).replace(/[- :]/g, ""); return `${p.slice(0, 8)}-${p.slice(8)}${String(now.getMilliseconds()).padStart(3, "0")}` }

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1)))) {
  process.exit(await runControlledThreeComponentStage0Smoke(process.argv.slice(2)))
}
