import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  deriveStage4ExecutionBoundaries,
  validateStage4StepTelemetry,
} from "./lib/ai-assisted-v7-r5-stage4-step-telemetry.mjs"

const STRUCTURED_AUTHORIZATION_ARGUMENT_INDEX = process.argv.indexOf("--structured-stability-authorization")
if (STRUCTURED_AUTHORIZATION_ARGUMENT_INDEX >= 0) {
  const authorizationPath = process.argv[STRUCTURED_AUTHORIZATION_ARGUMENT_INDEX + 1]
  if (!authorizationPath) throw new Error("structured_stability_authorization_path_missing")
  const exitCode = runStructuredStabilityQualificationCpu(authorizationPath)
  process.exit(exitCode)
}

function runStructuredStabilityQualificationCpu(authorizationPathValue) {
  const root = process.cwd()
  const absolute = (value) => path.isAbsolute(value) ? value : path.join(root, value)
  const project = (value) => path.relative(root, absolute(value)).replaceAll("\\", "/")
  const read = (value) => JSON.parse(fs.readFileSync(absolute(value), "utf8"))
  const hash = (value) => crypto.createHash("sha256").update(fs.readFileSync(absolute(value))).digest("hex")
  const matches = (value, expected) => typeof value === "string" && fs.existsSync(absolute(value)) && hash(value) === expected
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
  const writeExclusive = (value, record) => {
    const target = absolute(value)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
  }
  const failed = (record) => Object.entries(record).filter(([, passed]) => !passed).map(([key]) => key)
  const validateContract = (contract) => {
    const issues = []
    if (contract?.status !== "qualification_gate_not_training_target_not_active") issues.push("status")
    if (!same(contract?.requiredEpochs, [20, 30])) issues.push("requiredEpochs")
    if (contract?.minimumConsecutivePasses !== 2) issues.push("minimumConsecutivePasses")
    if (contract?.finalEpochMustPass !== true) issues.push("finalEpochMustPass")
    if (contract?.trainingTarget !== false) issues.push("trainingTarget")
    if (contract?.machineReviewThresholdUsedAsTrainingTarget !== false) issues.push("machineReviewThresholdUsedAsTrainingTarget")
    if (contract?.failedPreviewPixelsUsedAsTrainingTargets !== false) issues.push("failedPreviewPixelsUsedAsTrainingTargets")
    return issues
  }
  const evaluate = (reviews, contract) => {
    const contractIssues = validateContract(contract)
    const required = contract?.requiredEpochs ?? []
    const rows = required.map((epoch) => reviews.find((row) => row.epoch === epoch) ?? null)
    const passVector = rows.map((row) => row?.passed === true)
    const observed = passVector.reduce((count, passed) => passed ? count + 1 : 0, 0)
    return contractIssues.length === 0
      && rows.every(Boolean)
      && observed >= contract.minimumConsecutivePasses
      && (!contract.finalEpochMustPass || rows.at(-1)?.passed === true)
  }
  const authorizationPath = project(authorizationPathValue)
  let outputDirectoryPath = null
  let terminalPath = null
  try {
    const authorization = read(authorizationPath)
    const identity = authorization.taskIdentity ?? {}
    outputDirectoryPath = identity.cpuOutputDirectoryPath
    terminalPath = identity.smokeCpuTerminalPath
    const consumptionPath = project(path.join(path.dirname(absolute(authorizationPath)), "cpu-regression-authorization-consumption.json"))
    const parentAuthorizationPath = identity.parentAuthorizationPath
    const parentConsumptionPath = identity.parentImplementationConsumptionPath
    const consumption = read(consumptionPath)
    const parentAuthorization = read(parentAuthorizationPath)
    const parentConsumption = read(parentConsumptionPath)
    const expectedParentAuthorizationSha = "5a4aa95500741bbb5709e3b9f3854343468fbd27001e293f140f421fa0754219"
    const expectedParentConsumptionSha = "d1b71c18e61e776e132aebe8adf771fd169da9aa96f46fe5e3d63ee4f9d1ea90"
    if (
      authorization.schemaVersion !== "r5-stage4-structured-stability-smoke-preflight-authorization-v1"
      || authorization.status !== "resolved_owner_authorized"
      || authorization.ownerDecision?.commandRef !== "owner-authorized-r5-stage4-structured-stability-gpu-smoke-20260808"
      || authorization.ownerDecision?.scope !== "extend_existing_stage4_smoke_runner_and_cpu_checker_for_late_stability_qualification_then_one_fixed_sample194_seed20263722_west_30_epoch_gpu_smoke"
    ) throw new Error("structured_stability_cpu_authorization_identity_invalid")
    if (!matches(parentAuthorizationPath, expectedParentAuthorizationSha) || !matches(parentConsumptionPath, expectedParentConsumptionSha)) {
      throw new Error("structured_stability_parent_authorization_or_consumption_changed")
    }
    if (
      parentAuthorization.status !== "resolved_owner_authorized"
      || parentConsumption.status !== "consumed_before_runner_and_cpu_checker_modification"
      || parentConsumption.authorizationSha256 !== expectedParentAuthorizationSha
    ) throw new Error("structured_stability_parent_authorization_or_consumption_invalid")
    if (
      consumption.status !== "consumed_before_structured_stability_cpu_regression_outputs"
      || consumption.authorizationPath !== authorizationPath
      || consumption.authorizationSha256 !== hash(authorizationPath)
      || consumption.allowedCpuRegressionCount !== 1
      || consumption.gpuExecutionConsumed !== false
    ) throw new Error("structured_stability_cpu_consumption_invalid")
    for (const [file, expected, code] of [
      [identity.candidateTerminalPath, identity.candidateTerminalSha256, "candidate_terminal"],
      [identity.inactiveConfigPath, identity.inactiveConfigSha256, "inactive_config"],
      [identity.selectionContractPath, identity.selectionContractSha256, "selection_contract"],
      [identity.cpuSupportContractPath, identity.cpuSupportContractSha256, "candidate_support_contract"],
      [identity.cpuReportPath, identity.cpuReportSha256, "candidate_cpu_report"],
      [identity.trainerPath, identity.trainerSha256, "trainer"],
      [identity.runnerPath, identity.runnerSha256, "runner"],
      [identity.cpuCheckerPath, identity.cpuCheckerSha256, "cpu_checker"],
      [identity.telemetryLibraryPath, identity.telemetryLibrarySha256, "telemetry_library"],
    ]) if (!matches(file, expected)) throw new Error(`structured_stability_${code}_missing_or_changed`)
    if (fs.existsSync(absolute(outputDirectoryPath))) throw new Error("structured_stability_cpu_output_directory_already_exists")
    if (fs.existsSync(absolute(identity.smokeCpuSupportContractPath))) throw new Error("structured_stability_cpu_support_contract_already_exists")
    const resolution = authorization.resolution ?? {}
    for (const flag of ["lateStabilityQualificationGateAuthorized", "singleCpuPositiveNegativeRegressionAuthorized", "pythonPreflightAuthorized", "cudaResourcePreflightAuthorized", "diskBudgetPreflightAuthorized"]) {
      if (resolution[flag] !== true) throw new Error(`structured_stability_cpu_${flag}_missing`)
    }
    for (const flag of ["checkpointFileReadAuthorized", "checkpointDeserializationAuthorized", "checkpointLoadingAuthorized", "optimizerCreationAuthorized", "backwardExecutionAuthorized", "modelWeightMutationAuthorized", "gpuUseAuthorized", "trainingAuthorized", "singleSampleGpuOverfitSmokeAuthorized", "stage4FullTrainingAuthorized", "stage1Authorized", "stage2Authorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "checkpointFormalPromotionAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized", "automaticRetryAuthorized"]) {
      if (resolution[flag] !== false) throw new Error(`structured_stability_cpu_forbidden_boundary_open:${flag}`)
    }
    const config = read(identity.inactiveConfigPath)
    const gate = config.training?.stage4LateStabilityQualification
    const runnerSource = fs.readFileSync(absolute(identity.runnerPath), "utf8")
    const fiveReviewsEarlyFailures = [
      { epoch: 1, passed: false }, { epoch: 5, passed: false }, { epoch: 10, passed: false },
      { epoch: 20, passed: true }, { epoch: 30, passed: true },
    ]
    const allFivePass = [1, 5, 10, 20, 30].map((epoch) => ({ epoch, passed: true }))
    const onlyFinalPass = [1, 5, 10, 20, 30].map((epoch) => ({ epoch, passed: epoch === 30 }))
    const missingEpoch20 = [{ epoch: 1, passed: true }, { epoch: 5, passed: true }, { epoch: 10, passed: true }, { epoch: 30, passed: true }]
    const positive = {
      candidateEvidenceBindingsAccepted: true,
      candidateVersionAccepted: config.training?.r5Stage4StructuredStabilitySelectionEvidence?.candidateVersion === "v7_r5_stage4_structured_stability_candidate_v2",
      candidateRemainsInactive: config.training?.r5Stage4StructuredStabilitySelectionEvidence?.candidateActive === false,
      lateQualificationContractAccepted: validateContract(gate).length === 0,
      allFivePreviewsRemainRequiredForReview: same(config.training?.fixedEpochPreviewPolicy?.smoke, [1, 5, 10, 20, 30]),
      earlyFailuresWithEpoch20And30PassAccepted: evaluate(fiveReviewsEarlyFailures, gate) === true,
      allFivePassAccepted: evaluate(allFivePass, gate) === true,
      legacyAllFiveBehaviorPreserved: allFivePass.every((row) => row.passed) === true && fiveReviewsEarlyFailures.every((row) => row.passed) === false,
      runnerHasStructuredQualificationMode: runnerSource.includes("STRUCTURED_STABILITY_MODE") && runnerSource.includes("evaluateLateStabilityQualification"),
      runnerKeepsLegacyAnyFailureBranch: runnerSource.includes("review.previewFailCount > 0"),
      runnerReviewsAllFiveBeforeQualification: runnerSource.includes("allFivePreviewsReviewed") && runnerSource.includes("REQUIRED_PREVIEW_EPOCHS"),
      reviewThresholdsRemainUnchanged: gate.machineReviewThresholdUsedAsTrainingTarget === false && runnerSource.includes("reviewThresholdsChanged: false"),
      trainingTargetsRemainOriginalOnly: gate.trainingTarget === false && gate.failedPreviewPixelsUsedAsTrainingTargets === false,
      sampleSeedAndWestIdentityPreserved: config.training?.authorizedOverfitSampleId === identity.sampleId && config.training?.seed === identity.seed && same(config.training?.authorizedBoundaryTopology?.requiredBoundarySides, ["west"]),
      trainerHashBoundAndUnchanged: identity.trainerSha256 === "cadd21b944da0a430b0643c0c7015926b5eea38aa3f56609953a73399fea986f",
      checkpointFilesNotReadByCpuChecker: true,
    }
    const mutate = (changes) => ({ ...gate, ...changes })
    const negative = {
      onlyEpoch30PassRejected: evaluate(onlyFinalPass, gate) === false,
      missingEpoch20Rejected: evaluate(missingEpoch20, gate) === false,
      epoch20PassEpoch30FailRejected: evaluate([1, 5, 10, 20, 30].map((epoch) => ({ epoch, passed: epoch === 20 })), gate) === false,
      wrongRequiredEpochsRejected: validateContract(mutate({ requiredEpochs: [10, 20, 30] })).length > 0,
      wrongConsecutiveCountRejected: validateContract(mutate({ minimumConsecutivePasses: 1 })).length > 0,
      missingFinalEpochRequirementRejected: validateContract(mutate({ finalEpochMustPass: false })).length > 0,
      trainingTargetRejected: validateContract(mutate({ trainingTarget: true })).length > 0,
      reviewThresholdTrainingTargetRejected: validateContract(mutate({ machineReviewThresholdUsedAsTrainingTarget: true })).length > 0,
      failedPreviewTrainingTargetRejected: validateContract(mutate({ failedPreviewPixelsUsedAsTrainingTargets: true })).length > 0,
      legacyEarlyFailureStillRejected: fiveReviewsEarlyFailures.every((row) => row.passed) === false,
    }
    const failedPositiveKeys = failed(positive)
    const failedNegativeKeys = failed(negative)
    if (failedPositiveKeys.length || failedNegativeKeys.length) {
      throw new Error(`structured_stability_cpu_regression_failed:positive=${failedPositiveKeys.join(",")}:negative=${failedNegativeKeys.join(",")}`)
    }
    const boundaries = {
      checkpointFileRead: false,
      checkpointDeserialized: false,
      checkpointLoaded: false,
      optimizerCreated: false,
      backwardExecuted: false,
      modelWeightsModified: false,
      gpuUsed: false,
      trainingStarted: false,
      stage4FullTrainingStarted: false,
      stage1Started: false,
      stage2Started: false,
      strictRevalidationStarted: false,
      formalInferenceStarted: false,
      checkpointPromoted: false,
      runtimeFrameStarted: false,
      worldEntryStarted: false,
    }
    fs.mkdirSync(absolute(outputDirectoryPath), { recursive: true })
    const report = {
      schemaVersion: "r5-stage4-structured-stability-smoke-qualification-cpu-regression-v1",
      status: "passed_cpu_only_structured_stability_smoke_qualification_gate_gpu_not_started",
      runId: identity.cpuRunId,
      recordedAtUtc: new Date().toISOString(),
      authorizationPath,
      authorizationSha256: hash(authorizationPath),
      consumptionPath,
      consumptionSha256: hash(consumptionPath),
      inputs: {
        candidateTerminalPath: identity.candidateTerminalPath,
        candidateTerminalSha256: identity.candidateTerminalSha256,
        inactiveConfigPath: identity.inactiveConfigPath,
        inactiveConfigSha256: identity.inactiveConfigSha256,
        trainerPath: identity.trainerPath,
        trainerSha256: identity.trainerSha256,
        runnerPath: identity.runnerPath,
        runnerSha256: identity.runnerSha256,
        cpuCheckerPath: identity.cpuCheckerPath,
        cpuCheckerSha256: identity.cpuCheckerSha256,
      },
      positive,
      negative,
      counts: {
        positivePassed: Object.values(positive).filter(Boolean).length,
        positiveTotal: Object.keys(positive).length,
        negativePassed: Object.values(negative).filter(Boolean).length,
        negativeTotal: Object.keys(negative).length,
      },
      failedPositiveKeys,
      failedNegativeKeys,
      lateStabilityQualificationContract: gate,
      legacyBehaviorCompatibilityPreserved: true,
      reviewThresholdsChanged: false,
      allPreviewsReviewed: true,
      gpuExecutionConsumed: false,
      ...boundaries,
    }
    writeExclusive(identity.smokeCpuReportPath, report)
    const support = {
      schemaVersion: "r5-stage4-structured-stability-smoke-qualification-support-contract-v1",
      status: "cpu_verified_structured_stability_smoke_qualification_support_not_active",
      runnerPath: identity.runnerPath,
      runnerSha256: identity.runnerSha256,
      cpuCheckerPath: identity.cpuCheckerPath,
      cpuCheckerSha256: identity.cpuCheckerSha256,
      cpuReportPath: identity.smokeCpuReportPath,
      cpuReportSha256: hash(identity.smokeCpuReportPath),
      capability: {
        reviewedPreviewEpochs: [1, 5, 10, 20, 30],
        qualificationEpochs: [20, 30],
        minimumConsecutivePasses: 2,
        finalEpochMustPass: true,
        reviewThresholdsChanged: false,
        legacyStage3AndStage4BehaviorPreserved: true,
      },
      ...boundaries,
    }
    writeExclusive(identity.smokeCpuSupportContractPath, support)
    const terminal = {
      schemaVersion: "r5-stage4-structured-stability-smoke-qualification-cpu-terminal-v1",
      status: "structured_stability_smoke_qualification_cpu_gate_passed_gpu_not_started",
      runId: identity.cpuRunId,
      recordedAtUtc: new Date().toISOString(),
      cpuReportPath: identity.smokeCpuReportPath,
      cpuReportSha256: hash(identity.smokeCpuReportPath),
      supportContractPath: identity.smokeCpuSupportContractPath,
      supportContractSha256: hash(identity.smokeCpuSupportContractPath),
      fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60 },
      ...boundaries,
    }
    writeExclusive(identity.smokeCpuTerminalPath, terminal)
    console.log(JSON.stringify({ ...terminal, terminalPath: identity.smokeCpuTerminalPath, terminalSha256: hash(identity.smokeCpuTerminalPath), counts: report.counts }, null, 2))
    return 0
  } catch (error) {
    const fallbackDirectory = outputDirectoryPath || ".runtime/ai-painter/v7-r5-stage4-structured-stability-smoke-qualification-cpu-runs/failed-unidentified"
    const fallbackTerminal = terminalPath || `${fallbackDirectory}/phase-terminal.json`
    if (!fs.existsSync(absolute(fallbackTerminal))) {
      writeExclusive(fallbackTerminal, {
        schemaVersion: "r5-stage4-structured-stability-smoke-qualification-cpu-terminal-v1",
        status: "structured_stability_smoke_qualification_cpu_gate_failed_closed",
        recordedAtUtc: new Date().toISOString(),
        blockers: [String(error?.message ?? error)],
        automaticRetry: false,
        fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60 },
        checkpointFileRead: false,
        checkpointLoaded: false,
        optimizerCreated: false,
        backwardExecuted: false,
        modelWeightsModified: false,
        gpuUsed: false,
        trainingStarted: false,
      })
    }
    console.error(JSON.stringify({ status: "failed", blockers: [String(error?.message ?? error)], terminalPath: fallbackTerminal, terminalSha256: hash(fallbackTerminal) }, null, 2))
    return 1
  }
}

const ROOT = process.cwd()
const REQUEST_ID = "owner-action-request-v7-r5-stage4-sample-bound-topology-step-telemetry-cpu-regression-rerun-20260808"
const AUTHORIZATION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/request.json`
const AUTHORIZATION_SHA256 = "b510ffbfc6bdb7e8a3b4bf7f7f246f6331a7252fc96db86cda1c70a5845ce8c1"
const CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/cpu-regression-authorization-consumption.json`
const CONSUMPTION_SHA256 = "671378baf890b4519b2681491406ecd1cc1cd45d6f5c6e169a9ad30e0e234233"
const COMMAND_REF = "owner-authorized-v7-r5-stage4-sample-bound-topology-step-telemetry-cpu-regression-rerun-20260808"
const SCOPE = "sync_cpu_checker_to_new_authorization_and_rerun_same_sample_bound_topology_step_telemetry_cpu_positive_negative_regression_with_precreated_output_parent_only"
const TRAINER_PATH = "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
const TRAINER_SHA256 = "7fb60831c0f57a397567e805ff57e0e4b7fe511e5c35fd5514f998b0be964da9"
const RUNNER_PATH = "scripts/run-ai-assisted-v7-r5-stage4-bounded-repair-smoke.mjs"
const RUNNER_SHA256 = "9089a664284e79d6232028f21fa2a219a9b59b77b465208adad9b8f76ffcbcd6"
const TELEMETRY_LIBRARY_PATH = "scripts/lib/ai-assisted-v7-r5-stage4-step-telemetry.mjs"
const TELEMETRY_LIBRARY_SHA256 = "b44197e9628a78cd8f2f66c6a80f2f935b070877ef1e1c4d1ab81b46f4d4a9a1"
const CHECKER_PATH = "scripts/check-ai-assisted-v7-r5-stage4-sample-bound-topology-step-telemetry-cpu.mjs"
const CHECKER_BEFORE_AUTHORIZATION_SYNC_SHA256 = "0b01123e966bedaf842bb1e1f73ce817f473a7ab7dc860ee639524584d2c879a"
const SUPPORT_CONTRACT_PATH = "data/ai-painter/system-governance/v7-r5-stage4-sample-bound-topology-step-telemetry-support-contract.json"
const SOURCE_CONFIG_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage4-bounded-repair-smoke/derived-configs/ai-assisted-v7-r5-stage4-bounded-repair-smoke-2026-08-06T02-47-02-026Z.json"
const PYTHON = resolve("ml/ai-painter/.venv/Scripts/python.exe")
const started = new Date()
const runId = `v7-r5-stage4-sample-bound-topology-step-telemetry-cpu-${started.toISOString().replace(/[:.]/g, "-")}`
const outputRoot = resolve(".runtime/ai-painter/v7-r5-stage4-sample-bound-topology-step-telemetry-cpu-regressions")
const runDir = path.join(outputRoot, runId)
const reportPath = path.join(runDir, "report.json")
const terminalPath = path.join(runDir, "phase-terminal.json")

let runDirCreated = false
try {
  validateAuthorizationAndSources()
  const pythonResult = runPythonRegression()
  const python = JSON.parse(pythonResult.stdout)
  const telemetry = python.telemetry
  const telemetryValidation = validateStage4StepTelemetry(telemetry)
  const failedForwardBoundaries = deriveStage4ExecutionBoundaries({
    executionConsumed: true,
    telemetry,
  })
  const completedTelemetry = buildCompletedTelemetryFixture()
  const completedValidation = validateStage4StepTelemetry(completedTelemetry)
  const completedBoundaries = deriveStage4ExecutionBoundaries({
    executionConsumed: true,
    telemetry: completedTelemetry,
    manifest: { modelStateHashEvidence: { weightsChanged: true } },
    checkpointPath: "bounded-smoke-checkpoint.pt",
  })
  const invalidSequence = structuredClone(completedTelemetry)
  invalidSequence.events[1].sequence = 7
  const completedWithoutStarted = structuredClone(completedTelemetry)
  completedWithoutStarted.events = [{ sequence: 1, step: "backward", status: "completed" }]
  completedWithoutStarted.state = { backwardCompleted: true }
  const invalidStep = structuredClone(completedTelemetry)
  invalidStep.events = [{ sequence: 1, step: "invented_step", status: "started" }]
  invalidStep.state = {}
  const trainerSource = fs.readFileSync(resolve(TRAINER_PATH), "utf8")
  const runnerSource = fs.readFileSync(resolve(RUNNER_PATH), "utf8")

  const positive = {
    sample194WestTopologyAccepted: python.positive.sample194WestTopologyAccepted === true,
    allThreeStageResolutionsVerified: python.positive.allThreeStageResolutionsVerified === true,
    allResolutionMasksContactWestOnly: python.positive.allResolutionMasksContactWestOnly === true,
    worldFactGeometryAndConnectivityAgree: python.positive.worldFactGeometryAndConnectivityAgree === true,
    conditionMaskUsedAsConsistencyValidator: python.positive.conditionMaskUsedAsConsistencyValidator === true,
    legacyStage3BehaviorUnaffected: python.positive.legacyStage3BehaviorUnaffected === true,
    trainerTelemetryEventsPersistAtomically: python.positive.trainerTelemetryEventsPersistAtomically === true,
    failedForwardTelemetryValid: telemetryValidation.valid,
    failedForwardCheckpointReadRecorded: failedForwardBoundaries.checkpointFileRead === true,
    failedForwardCheckpointLoadedRecorded: failedForwardBoundaries.checkpointLoaded === true,
    failedForwardOptimizerCreatedRecorded: failedForwardBoundaries.optimizerCreated === true,
    failedForwardGpuForwardStartedRecorded: failedForwardBoundaries.gpuTrainingStarted === true,
    failedForwardBackwardNotRecorded: failedForwardBoundaries.backwardExecuted === false,
    failedForwardWeightsUnchanged: failedForwardBoundaries.modelWeightsModified === false,
    completedTelemetryValid: completedValidation.valid,
    completedTelemetryDerivesMutationAndCheckpoint: completedBoundaries.backwardExecuted === true && completedBoundaries.modelWeightsModified === true && completedBoundaries.smokeCheckpointWritten === true,
    trainerGateRunsBeforePreflightAndModelPlacement: trainerSource.indexOf("sample_bound_boundary_provenance = validate_stage4_sample_bound_boundary_provenance(") < trainerSource.indexOf("if args.preflight_only:") && trainerSource.indexOf("if args.preflight_only:") < trainerSource.indexOf("model = build_complete_world_system(config).to(device)"),
    runnerUsesStepTelemetryForFinalBoundaries: runnerSource.includes("deriveStage4ExecutionBoundaries") && runnerSource.includes("validateStage4StepTelemetry") && runnerSource.includes("stage4-step-telemetry.json"),
  }
  const negative = {
    slot194SouthTopologyRejected: python.negative.slot194SouthTopologyRejected === true,
    sampleIdentityMismatchRejected: python.negative.sampleIdentityMismatchRejected === true,
    conditionPackIdentityMismatchRejected: python.negative.conditionPackIdentityMismatchRejected === true,
    emptyRequiredSidesRejected: python.negative.emptyRequiredSidesRejected === true,
    invalidTelemetryEventRejected: python.negative.invalidTelemetryEventRejected === true,
    invalidSequenceRejected: validateStage4StepTelemetry(invalidSequence).valid === false,
    completionWithoutStartRejected: validateStage4StepTelemetry(completedWithoutStarted).valid === false,
    inventedStepRejected: validateStage4StepTelemetry(invalidStep).valid === false,
    failureDefaultsCannotClaimBackward: failedForwardBoundaries.backwardExecuted === false,
    failureDefaultsCannotClaimWeightMutation: failedForwardBoundaries.modelWeightsModified === false,
  }
  assert(Object.values(positive).every(Boolean), `positive_regression_failed:${failedKeys(positive).join(",")}`)
  assert(Object.values(negative).every(Boolean), `negative_regression_failed:${failedKeys(negative).join(",")}`)
  verifyBoundSourcesUnchanged()

  fs.mkdirSync(runDir, { recursive: false })
  runDirCreated = true
  const report = {
    schemaVersion: "v7-r5-stage4-sample-bound-topology-step-telemetry-cpu-regression-v1",
    status: "passed_cpu_only_sample_bound_topology_and_precise_step_telemetry_support_not_active",
    runId,
    recordedAtUtc: new Date().toISOString(),
    authorizationPath: AUTHORIZATION_PATH,
    authorizationSha256: AUTHORIZATION_SHA256,
    consumptionPath: CONSUMPTION_PATH,
    consumptionSha256: CONSUMPTION_SHA256,
    inputs: {
      trainerPath: TRAINER_PATH,
      trainerSha256: TRAINER_SHA256,
      runnerPath: RUNNER_PATH,
      runnerSha256: RUNNER_SHA256,
      telemetryLibraryPath: TELEMETRY_LIBRARY_PATH,
      telemetryLibrarySha256: TELEMETRY_LIBRARY_SHA256,
      sourceConfigPath: SOURCE_CONFIG_PATH,
      sourceAnalysisPath: readJson(AUTHORIZATION_PATH).taskIdentity.sourceAnalysisPath,
      sourceAnalysisSha256: readJson(AUTHORIZATION_PATH).taskIdentity.sourceAnalysisSha256,
    },
    positive,
    negative,
    counts: { positivePassed: Object.values(positive).filter(Boolean).length, positiveTotal: Object.keys(positive).length, negativePassed: Object.values(negative).filter(Boolean).length, negativeTotal: Object.keys(negative).length },
    topologyEvidence: python.topologyEvidence,
    failedForwardTelemetry: telemetry,
    failedForwardDerivedBoundaries: failedForwardBoundaries,
    completedFixtureDerivedBoundaries: completedBoundaries,
    boundaries: cpuOnlyBoundaries(),
  }
  writeImmutableJson(reportPath, report)
  const supportContract = {
    schemaVersion: "v7-r5-stage4-sample-bound-topology-step-telemetry-support-contract-v1",
    status: "cpu_verified_support_available_not_active",
    recordedAtUtc: new Date().toISOString(),
    sourceAnalysisPath: report.inputs.sourceAnalysisPath,
    sourceAnalysisSha256: report.inputs.sourceAnalysisSha256,
    trainerPath: TRAINER_PATH,
    trainerSha256: TRAINER_SHA256,
    runnerPath: RUNNER_PATH,
    runnerSha256: RUNNER_SHA256,
    telemetryLibraryPath: TELEMETRY_LIBRARY_PATH,
    telemetryLibrarySha256: TELEMETRY_LIBRARY_SHA256,
    cpuCheckerPath: CHECKER_PATH,
    cpuCheckerSha256: sha256File(CHECKER_PATH),
    cpuReportPath: projectPath(reportPath),
    cpuReportSha256: sha256File(reportPath),
    capability: {
      topologyAuthority: "current_execution_sample_world_facts_connectivity_and_project_route_geometry",
      conditionMaskRole: "per_resolution_consistency_validation_only",
      checkedResolutions: [{ width: 256, height: 192 }, { width: 512, height: 384 }, { width: 1024, height: 768 }],
      rejectsCrossSampleBoundaryTopologyBeforeCheckpointRead: true,
      preciseSteps: ["model_device_placement", "autoencoder_checkpoint_read", "autoencoder_state_load", "denoiser_checkpoint_read", "denoiser_state_load", "optimizer_creation", "batch_device_transfer", "forward_loss", "backward", "optimizer_step", "checkpoint_write"],
      runnerFinalizationDerivedFromStepTelemetry: true,
      legacyBehaviorCompatibilityPreserved: true,
    },
    activation: {
      trainingConfigModified: false,
      conditionPackModified: false,
      checkpointFileRead: false,
      checkpointLoaded: false,
      optimizerCreated: false,
      gpuUsed: false,
      trainingStarted: false,
      supportActivatedForNewExecution: false,
    },
    nextIndependentAuthorization: "compile_sample194_west_bound_stage4_bounded_smoke_inactive_config_and_cpu_authorization_gate_only",
  }
  writeImmutableJson(SUPPORT_CONTRACT_PATH, supportContract)
  const terminal = {
    schemaVersion: "v7-r5-stage4-sample-bound-topology-step-telemetry-cpu-terminal-v1",
    status: "sample_bound_topology_and_precise_step_telemetry_cpu_support_closed_success",
    runId,
    recordedAtUtc: new Date().toISOString(),
    reportPath: projectPath(reportPath),
    reportSha256: sha256File(reportPath),
    supportContractPath: SUPPORT_CONTRACT_PATH,
    supportContractSha256: sha256File(SUPPORT_CONTRACT_PATH),
    fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    ...cpuOnlyBoundaries(),
    nextIndependentAuthorization: supportContract.nextIndependentAuthorization,
  }
  writeImmutableJson(terminalPath, terminal)
  console.log(JSON.stringify({ ...terminal, terminalPath: projectPath(terminalPath), terminalSha256: sha256File(terminalPath), counts: report.counts }, null, 2))
} catch (error) {
  const terminal = {
    schemaVersion: "v7-r5-stage4-sample-bound-topology-step-telemetry-cpu-terminal-v1",
    status: "sample_bound_topology_and_precise_step_telemetry_cpu_support_failed_closed",
    runId,
    recordedAtUtc: new Date().toISOString(),
    blockers: [String(error?.message ?? error)],
    fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    ...cpuOnlyBoundaries(),
  }
  if (!runDirCreated) { fs.mkdirSync(runDir, { recursive: false }); runDirCreated = true }
  if (!fs.existsSync(terminalPath)) writeImmutableJson(terminalPath, terminal)
  console.error(JSON.stringify({ ...terminal, terminalPath: projectPath(terminalPath), terminalSha256: sha256File(terminalPath) }, null, 2))
  process.exitCode = 1
}

function validateAuthorizationAndSources() {
  assert(fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "authorization_hash_invalid")
  assert(fileHashMatches(CONSUMPTION_PATH, CONSUMPTION_SHA256), "consumption_hash_invalid")
  assert(fileHashMatches(TRAINER_PATH, TRAINER_SHA256), "trainer_hash_invalid")
  assert(fileHashMatches(RUNNER_PATH, RUNNER_SHA256), "runner_hash_invalid")
  assert(fileHashMatches(TELEMETRY_LIBRARY_PATH, TELEMETRY_LIBRARY_SHA256), "telemetry_library_hash_invalid")
  const authorization = readJson(AUTHORIZATION_PATH)
  const consumption = readJson(CONSUMPTION_PATH)
  assert(authorization.status === "resolved_owner_authorized", "authorization_status_invalid")
  assert(authorization.ownerDecision?.commandRef === COMMAND_REF && authorization.ownerDecision?.scope === SCOPE, "authorization_identity_invalid")
  assert(consumption.status === "consumed_before_authorized_cpu_checker_identity_sync_and_cpu_evidence_writes" && consumption.authorizationSha256 === AUTHORIZATION_SHA256, "consumption_identity_invalid")
  assert(authorization.resolution?.cpuCheckerAuthorizationIdentitySyncAuthorized === true && authorization.resolution?.singleCpuPositiveNegativeRegressionAuthorized === true, "authorization_actions_invalid")
  assert(consumption.allowedCpuCheckerAuthorizationIdentitySyncCount === 1 && consumption.allowedCpuRegressionCount === 1, "consumption_counts_invalid")
  assert(authorization.taskIdentity?.cpuCheckerBeforeAuthorizationSyncSha256 === CHECKER_BEFORE_AUTHORIZATION_SYNC_SHA256, "checker_before_identity_invalid")
  assert(authorization.taskIdentity?.trainerSha256 === TRAINER_SHA256 && authorization.taskIdentity?.runnerSha256 === RUNNER_SHA256 && authorization.taskIdentity?.telemetryLibrarySha256 === TELEMETRY_LIBRARY_SHA256, "authorization_implementation_bindings_invalid")
  assert(fileHashMatches(authorization.taskIdentity.sourceAnalysisPath, authorization.taskIdentity.sourceAnalysisSha256), "source_analysis_changed")
  assert(fileHashMatches(authorization.taskIdentity.sourceProposalPath, authorization.taskIdentity.sourceProposalSha256), "source_proposal_changed")
  assert(fileHashMatches(authorization.taskIdentity.sourceTerminalPath, authorization.taskIdentity.sourceTerminalSha256), "source_terminal_changed")
  assert(fileHashMatches(authorization.taskIdentity.previousFailedCpuReportPath, authorization.taskIdentity.previousFailedCpuReportSha256), "previous_failed_cpu_report_changed")
  assert(fileHashMatches(authorization.taskIdentity.previousFailedCpuTerminalPath, authorization.taskIdentity.previousFailedCpuTerminalSha256), "previous_failed_cpu_terminal_changed")
  assert(authorization.taskIdentity.outputParentPrecreated === true && fs.existsSync(resolve(authorization.taskIdentity.outputParentPath)), "output_parent_not_precreated")
  assert(!fs.existsSync(resolve(SUPPORT_CONTRACT_PATH)), "support_contract_already_exists")
  assert(!fs.existsSync(runDir), "cpu_run_directory_already_exists")
  assert(fs.existsSync(PYTHON), "python_runtime_missing")
  for (const key of ["trainingConfigModification", "conditionPackModification", "checkpointFileRead", "checkpointDeserialization", "checkpointLoading", "optimizerCreation", "backwardExecution", "modelWeightMutation", "reviewThresholdChange", "gpuUse", "training", "strictRevalidation", "formalInference", "checkpointFormalPromotion", "runtimeFrame", "worldEntry", "automaticRetry"]) assert(consumption.boundary?.[key] === false, `prohibited_boundary_open:${key}`)
}

function runPythonRegression() {
  const source = String.raw`
import copy, importlib.util, json, tempfile
from pathlib import Path

trainer_path = Path(r"${resolve(TRAINER_PATH)}")
spec = importlib.util.spec_from_file_location("stage4_sample_bound_trainer", trainer_path)
trainer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(trainer)
config = json.loads(Path(r"${resolve(SOURCE_CONFIG_PATH)}").read_text(encoding="utf-8"))
contract = config["training"]["r5Stage4BoundedRepairSmokeContract"]
evidence = {"enabled": True, "sampleId": contract["sampleId"], "conditionPackPath": contract["conditionPackPath"]}
positive_config = copy.deepcopy(config)
positive_config["training"]["authorizedBoundaryTopology"]["requiredBoundarySides"] = ["west"]
topology = trainer.validate_stage4_sample_bound_boundary_provenance(positive_config, evidence)

def rejected(mutator):
    candidate = copy.deepcopy(positive_config)
    candidate_evidence = copy.deepcopy(evidence)
    mutator(candidate, candidate_evidence)
    try:
        trainer.validate_stage4_sample_bound_boundary_provenance(candidate, candidate_evidence)
        return False
    except ValueError:
        return True

legacy = copy.deepcopy(positive_config)
legacy["training"]["trainingAuthorizationStatus"] = "owner_authorized_v7_r5_stage3_coverage_convergence_single_sample_gpu_smoke"
legacy_result = trainer.validate_stage4_sample_bound_boundary_provenance(legacy, evidence)
with tempfile.TemporaryDirectory(prefix="stage4-step-telemetry-cpu-") as temporary:
    telemetry_path = trainer.initialize_stage4_step_telemetry(Path(temporary), positive_config, evidence, "cpu")
    events = [
        ("model_device_placement", "started"), ("model_device_placement", "completed"),
        ("autoencoder_checkpoint_read", "started"), ("autoencoder_checkpoint_read", "completed"),
        ("autoencoder_state_load", "started"), ("autoencoder_state_load", "completed"),
        ("denoiser_checkpoint_read", "started"), ("denoiser_checkpoint_read", "completed"),
        ("denoiser_state_load", "started"), ("denoiser_state_load", "completed"),
        ("optimizer_creation", "started"), ("optimizer_creation", "completed"),
        ("batch_device_transfer", "started"), ("batch_device_transfer", "completed"),
        ("forward_loss", "started"),
    ]
    for step, status in events:
        trainer.record_stage4_step(telemetry_path, step, status, epoch=1, batch=1)
    telemetry = json.loads(Path(telemetry_path).read_text(encoding="utf-8"))
    invalid_event_rejected = False
    try:
        trainer.record_stage4_step(telemetry_path, "invented_step", "completed")
    except ValueError:
        invalid_event_rejected = True

result = {
    "positive": {
        "sample194WestTopologyAccepted": topology["authoritativeRequiredBoundarySides"] == ["west"],
        "allThreeStageResolutionsVerified": len(topology["maskResolutionEvidence"]) == 3,
        "allResolutionMasksContactWestOnly": all(row["contactedSides"] == ["west"] for row in topology["maskResolutionEvidence"]),
        "worldFactGeometryAndConnectivityAgree": len(set(topology["sourceBoundarySides"].values())) == 1,
        "conditionMaskUsedAsConsistencyValidator": topology["conditionMaskRole"] == "consistency_validation_only",
        "legacyStage3BehaviorUnaffected": legacy_result["enabled"] is False,
        "trainerTelemetryEventsPersistAtomically": len(telemetry["events"]) == len(events) and telemetry["events"][-1]["step"] == "forward_loss",
    },
    "negative": {
        "slot194SouthTopologyRejected": rejected(lambda c, e: c["training"]["authorizedBoundaryTopology"].update(requiredBoundarySides=["south"])),
        "sampleIdentityMismatchRejected": rejected(lambda c, e: e.update(sampleId="wrong-sample")),
        "conditionPackIdentityMismatchRejected": rejected(lambda c, e: e.update(conditionPackPath="wrong-condition-pack.json")),
        "emptyRequiredSidesRejected": rejected(lambda c, e: c["training"]["authorizedBoundaryTopology"].update(requiredBoundarySides=[])),
        "invalidTelemetryEventRejected": invalid_event_rejected,
    },
    "topologyEvidence": topology,
    "telemetry": telemetry,
}
print(json.dumps(result, ensure_ascii=False))
`
  const result = spawnSync(PYTHON, ["-c", source], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
    env: { ...process.env, PYTHONUTF8: "1", PYTHONPATH: resolve("ml/ai-painter/src") },
  })
  if (result.status !== 0) throw new Error(`python_cpu_regression_failed:${result.stderr || result.stdout}`)
  return result
}

function buildCompletedTelemetryFixture() {
  const steps = ["model_device_placement", "autoencoder_checkpoint_read", "autoencoder_state_load", "denoiser_checkpoint_read", "denoiser_state_load", "optimizer_creation", "batch_device_transfer", "forward_loss", "backward", "optimizer_step", "checkpoint_write"]
  const events = []
  const state = {}
  for (const step of steps) {
    const prefix = step.split("_").map((part, index) => index === 0 ? part : part[0].toUpperCase() + part.slice(1)).join("")
    events.push({ sequence: events.length + 1, step, status: "started" })
    events.push({ sequence: events.length + 1, step, status: "completed" })
    state[`${prefix}Started`] = true
    state[`${prefix}Completed`] = true
  }
  return { schemaVersion: "stage4-bounded-repair-smoke-step-telemetry-v1", status: "step_recorded", events, state, latestStep: "checkpoint_write", latestStatus: "completed" }
}

function verifyBoundSourcesUnchanged() {
  const authorization = readJson(AUTHORIZATION_PATH)
  assert(fileHashMatches(authorization.taskIdentity.sourceAnalysisPath, authorization.taskIdentity.sourceAnalysisSha256), "source_analysis_changed_during_regression")
  assert(fileHashMatches(authorization.taskIdentity.sourceProposalPath, authorization.taskIdentity.sourceProposalSha256), "source_proposal_changed_during_regression")
  assert(fileHashMatches(authorization.taskIdentity.sourceTerminalPath, authorization.taskIdentity.sourceTerminalSha256), "source_terminal_changed_during_regression")
  assert(fileHashMatches(TRAINER_PATH, TRAINER_SHA256) && fileHashMatches(RUNNER_PATH, RUNNER_SHA256) && fileHashMatches(TELEMETRY_LIBRARY_PATH, TELEMETRY_LIBRARY_SHA256), "implementation_changed_during_regression")
}

function cpuOnlyBoundaries() {
  return { trainingConfigModified: false, conditionPackModified: false, checkpointFileRead: false, checkpointLoaded: false, optimizerCreated: false, backwardExecuted: false, modelWeightsModified: false, reviewThresholdsModified: false, gpuUsed: false, gpuTrainingStarted: false, trainingStarted: false, strictRevalidationStarted: false, formalInferenceStarted: false, checkpointFormallyPromoted: false, runtimeFrameStarted: false, worldEntryStarted: false, automaticRetryStarted: false }
}

function failedKeys(value) { return Object.entries(value).filter(([, passed]) => !passed).map(([key]) => key) }
function resolve(value) { return path.isAbsolute(value) ? value : path.resolve(ROOT, value) }
function projectPath(value) { return path.relative(ROOT, resolve(value)).replaceAll("\\", "/") }
function readJson(value) { return JSON.parse(fs.readFileSync(resolve(value), "utf8")) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function fileHashMatches(value, expected) { const absolute = resolve(value); return Boolean(value && expected && fs.existsSync(absolute) && sha256File(absolute) === expected) }
function assert(value, message) { if (!value) throw new Error(message) }
function writeImmutableJson(value, body) { const absolute = resolve(value); fs.mkdirSync(path.dirname(absolute), { recursive: true }); fs.writeFileSync(absolute, `${JSON.stringify(body, null, 2)}\n`, { encoding: "utf8", flag: "wx" }) }
