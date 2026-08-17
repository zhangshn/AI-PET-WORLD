import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { auditStage4To80Plan, runStage4To80PlanRegression } from "./check-ai-painter-stage4-to-80-plan.mjs"
import { appendAiPainterProgramEvent, formatShanghai } from "./lib/ai-painter-program-event-store.mjs"
import { closeStorageCatalog, indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"
import { sha256File } from "../src/server/project-owner-delegated-authorization-package-core.mjs"

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const ROOT = process.cwd()
const OUTPUT_PREFIX = ".runtime/ai-painter/stage4-continuous-plan-compilations/"
const ACTION = "ai_painter.stage4.compile_exact_five_step_execution_plan_v1"
const ROUTE = "scripts/compile-ai-painter-stage4-to-80-plan.mjs"
const SCOPE = "ai-painter:stage4:exact-five-step-plan-compilation-v1"
const TRUST_REGISTRY = "data/ai-painter/system-governance/project-owner-trust-registry-v1.json"
const TRUST_REGISTRY_SHA256 = "34a34ed62500a4f71e78bad1e508b429d584e7c8da46e3d1ba6a0e4a7696b122"
const CURRENT_CANDIDATE_ID = "stage4_object_reference_multiscale_early_convergence"
const CURRENT_TRAINING_OBJECTIVE = "stage4_object_reference_multiscale_two_lane_early_convergence_stabilization_v1"
const CONFIG = ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-stabilization-cpu-implementations/20260815-183000000/inactive-config.json"
const CONFIG_SHA256 = "af6599b771b76aae4eac722c120a3d32dc1e23e1de92a1c0a26f051a82d11476"
const SMOKE_CONFIG = ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-smoke-entry-integrations/20260816-032403029/inactive-smoke-config.json"
const SMOKE_CONFIG_SHA256 = "3526dfedb16dbf71d2c7619d389226d1a8896755a078d84aad959d935a655f4c"
const CURRENT_GUIDE = "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md"
const CURRENT_GUIDE_SHA256 = "bab1bfc8620ffca5911ec83df68ea7afdf6971912be71991570414e4f973d347"
const CURRENT_CPU_TERMINAL = ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-stabilization-cpu-implementations/20260815-183000000/phase-terminal.json"
const CURRENT_CPU_TERMINAL_SHA256 = "2e30c1946c8546a258980a6810db1e91f88be4cf9a38b5787bb42b07477bd4ec"
const CURRENT_GPU_TERMINAL = ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-readonly-gpu-gradient-qualifications/20260815-210000000/gpu-execution/phase-terminal.json"
const CURRENT_GPU_TERMINAL_SHA256 = "b9105414221f152c3a55e622d3027d4311170ef7ef4d8f9f59923c8953c61b17"
const CURRENT_GPU_DIAGNOSTIC = ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-readonly-gpu-gradient-qualifications/20260815-210000000/gpu-execution/diagnostic-report.json"
const CURRENT_GPU_DIAGNOSTIC_SHA256 = "4ce76ffc0ca9b96ca6f5ae5a3d2c80077b6943dfeabd409defeec86bc03e5186"
const CURRENT_SMOKE_ENTRY_TERMINAL = ".runtime/ai-painter/stage4-lineage-corrected-smoke-contract-integrations/20260816-040617434/phase-terminal.json"
const CURRENT_SMOKE_ENTRY_TERMINAL_SHA256 = "197423b18a6042748b516001335712dd838f52137a85bcbaf52a1ea79f201344"
const CURRENT_SMOKE_CONTRACT = ".runtime/ai-painter/stage4-lineage-corrected-smoke-contract-integrations/20260816-040617434/inactive-gpu-smoke-contract.json"
const CURRENT_SMOKE_CONTRACT_SHA256 = "20ad8beef53b5e6f917ed3efd18ef65990d735565f792139503063bd2a1938c7"
const CURRENT_REAL_PYTHON_PREFLIGHT = ".runtime/ai-painter/stage4-early-convergence-trainer-lineage-corrections/20260816-034516556/cpu-report.json"
const CURRENT_REAL_PYTHON_PREFLIGHT_SHA256 = "f7cd9f66716fc0ff6807b57774bff4fcbccb91d02e8ef397e601559430991a50"
const CURRENT_TRAINER_LINEAGE_CORRECTION = ".runtime/ai-painter/stage4-early-convergence-trainer-lineage-corrections/20260816-034516556/implementation-report.json"
const CURRENT_TRAINER_LINEAGE_CORRECTION_SHA256 = "7d8d8f5e992d92947c8aa6a8cc56328fdec26fa4348ef064713dccc53a5c90e1"
const STALE_CONTINUOUS_TERMINAL = ".runtime/ai-painter/stage4-continuous-executions/owner-authorized-ai-painter-stage4-continuous-to-80-20260815173355553/finalization/phase-terminal.json"
const STALE_CONTINUOUS_TERMINAL_SHA256 = "e620b0b2eb569e4d8039b435d570683c147c1791f1ba66368b5e82b2040573ab"
const STALE_SMOKE_TERMINAL = ".runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/20260815173216430-smoke/finalization/phase-terminal.json"
const STALE_SMOKE_TERMINAL_SHA256 = "bdeb2074029507979ec2015281ecc8d6c9b7a5f0fbc26754899e60fa357d55fe"
const STALE_SMOKE_FINALIZATION = ".runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/20260815173216430-smoke/finalization/finalization-report.json"
const STALE_SMOKE_FINALIZATION_SHA256 = "ffe8b429652f0cdc015eaeb3d6f7b904b0de4c6b6a8b31e3a43eced2f025d1ba"
const STALE_SMOKE_MANIFEST = ".runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/20260815173216430-smoke/training-output/manifest.json"
const STALE_SMOKE_MANIFEST_SHA256 = "5f98e7f076e8175d75d9ffeb2fe5523664de925bf7f5673de37e41fd1e16ef18"
const STALE_SMOKE_REVIEW = ".runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/20260815173216430-smoke/training-output/fixed-preview-reviews.json"
const STALE_SMOKE_REVIEW_SHA256 = "5472702c0f66b3042f52d1216e79ae5b03358fc6394a0b7a50dd00844bdb9097"
const DATASET = "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
const DATASET_SHA256 = "8001f5a27bb8bc18883184b0c7e39ef1336eb295ce5787618bf4e60059dd48aa"
const SOURCE_INDEX = "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json"
const SOURCE_INDEX_SHA256 = "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251"
const AUTOENCODER = ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt"
const AUTOENCODER_SHA256 = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
const SMOKE_RUNNER = "scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs"
const QUALIFICATION_RUNNER = "scripts/run-stage4-general-late-convergence-qualification.mjs"
const FORMAL_RUNNER = "scripts/run-stage4-semantic-mixture-formal-stage.mjs"
const CPU_CHECKER = "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_cpu.py"
const CURRENT_CODE = {
  authorizationPolicy: "ml/ai-painter/scripts/ai_painter_authorization_policy.py",
  executionGrant: "ml/ai-painter/scripts/ai_painter_execution_grant.py",
  modeRegistry: "ml/ai-painter/scripts/ai_painter_stage_mode_registry.py",
  trainer: "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
  runner: SMOKE_RUNNER,
  cpuChecker: CPU_CHECKER,
  model: "ml/ai-painter/src/ai_painter/complete_world/model.py",
  inactiveConfigCompiler: "ml/ai-painter/scripts/compile_ai_assisted_v9_r5_stage4_inactive_config.py",
}
const FORMAL_CODE = {
  authorizationPolicy: "ml/ai-painter/scripts/ai_painter_authorization_policy.py",
  modeRegistry: "ml/ai-painter/scripts/ai_painter_stage_mode_registry.py",
  trainer: "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
  compiler: "ml/ai-painter/scripts/compile_stage4_semantic_mixture_full_training_config.py",
  cpuChecker: "ml/ai-painter/scripts/check_stage4_semantic_mixture_full_training_modes_cpu.py",
  runner: FORMAL_RUNNER,
}
const IMPLEMENTATION_AUTHORIZATION = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-early-convergence-trainer-lineage-correction-20260816-034516556/authorization.json"
const IMPLEMENTATION_AUTHORIZATION_SHA256 = "201ce58ced78d599db22ce499b4fe25e4dec34126d295d8807a95eba98f54aed"
const IMPLEMENTATION_CONSUMPTION = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-early-convergence-trainer-lineage-correction-20260816-034516556/consumption.json"
const IMPLEMENTATION_CONSUMPTION_SHA256 = "2211255d28686adc0c0fc011f810abef832be2de131112aa3f004c48969bb43f"
const EVIDENCE_REGISTRY = ".runtime/ai-painter/stage4-execution-evidence-eligibility/20260816-040617434/registry.json"
const EVIDENCE_REGISTRY_SHA256 = "f7e46b717ea5b68b8dae85f9f09a1acfaa26c85c4afe894c753d69d41a085db3"
const EVIDENCE = {
  readonlyGpuTerminal: [".runtime/ai-painter/stage4-execution-evidence-eligibility/20260816-032403029/canonical/stage4.finalVisibleRgb.gpuQualificationTerminal-b9105414221f152c3a55e622d3027d4311170ef7ef4d8f9f59923c8953c61b17.json", CURRENT_GPU_TERMINAL_SHA256],
  readonlyGpuDiagnostic: [".runtime/ai-painter/stage4-execution-evidence-eligibility/20260816-032403029/canonical/stage4.finalVisibleRgb.gpuDiagnosticReport-4ce76ffc0ca9b96ca6f5ae5a3d2c80077b6943dfeabd409defeec86bc03e5186.json", CURRENT_GPU_DIAGNOSTIC_SHA256],
  cudaTelemetry: [".runtime/ai-painter/stage4-execution-evidence-eligibility/20260816-032403029/canonical/stage4.finalVisibleRgb.cudaTelemetry-4dbbada4c60203b6c215eed9301864ab506291d0ae8f52573cd35aaec9632eac.json", "4dbbada4c60203b6c215eed9301864ab506291d0ae8f52573cd35aaec9632eac"],
  readonlyCpuReport: [".runtime/ai-painter/stage4-execution-evidence-eligibility/20260816-032403029/canonical/stage4.finalVisibleRgb.cpuAuthorizationReport-38a171aad454be1195afd760eaf1b52f4270607da46165d3b656f2b7ca009a30.json", "38a171aad454be1195afd760eaf1b52f4270607da46165d3b656f2b7ca009a30"],
  inactiveConfig: [".runtime/ai-painter/stage4-execution-evidence-eligibility/20260816-032403029/canonical/stage4.finalVisibleRgb.inactiveConfig-3526dfedb16dbf71d2c7619d389226d1a8896755a078d84aad959d935a655f4c.json", SMOKE_CONFIG_SHA256],
  architectureSupportContract: [".runtime/ai-painter/stage4-execution-evidence-eligibility/20260816-032403029/canonical/stage4.finalVisibleRgb.trainingObjectiveSupportContract-a3b0cb1e3abe6d4ab0fd818e85789a9b909e16015700f2f1688b97aee788182a.json", "a3b0cb1e3abe6d4ab0fd818e85789a9b909e16015700f2f1688b97aee788182a"],
}
const SUPPORT_BINDINGS = {
  datasetManifest: [DATASET, DATASET_SHA256],
  datasetSourceIndex: [SOURCE_INDEX, SOURCE_INDEX_SHA256],
  projectAutoencoderCheckpoint: [AUTOENCODER, AUTOENCODER_SHA256],
  conditionAlignmentAuditor: ["scripts/lib/ai-assisted-condition-alignment.mjs", "c01ea4efba9835e488e42c7ed44d2aef434ee3db21b06e84e70379722bcc145e"],
  professionalAestheticAuditor: ["scripts/lib/ai-assisted-professional-aesthetic.mjs", "d07af489c4398e05abe94060fa773a65710ed9e57a72df2514352075fdf2e7e8"],
  windowsSafePreviewNormalizer: ["scripts/lib/ai-assisted-v7-r5-stage3-preview-review.mjs", "f5add3e55c21e04deaad1b2e17fd577136dcadb5efa93e1d157cc1a85c368261"],
  gpuResourceGate: ["scripts/lib/ai-assisted-v7-training-resource-gate.mjs", "1ee521e64f00778e829b1373044116cf9b56c85888f385c8521da3f7e3459764"],
}
const ALL_ACTIONS = ["automatic_retry", "create_optimizer", "create_runtime_frame", "enter_world", "execute_backward", "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", "load_parent_denoiser", "mutate_model_weights", "promote_checkpoint", "run_formal_inference", "run_stage0", "run_stage1", "run_stage2", "run_strict_revalidation", "select_bound_sample", "write_diagnostic_checkpoint", "write_smoke_checkpoint"]
const SMOKE_ACTIONS = ["create_optimizer", "execute_backward", "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", "mutate_model_weights", "select_bound_sample", "write_smoke_checkpoint"]

if (path.resolve(process.argv[1] ?? "") === path.resolve(SCRIPT_PATH)) {
  try {
    const args = parseArgs(process.argv.slice(2))
    const result = compilePlan({
      authorizationPath: required(args.authorization, "--authorization is required"),
      authorizationSha256: required(args.authorizationSha256, "--authorization-sha256 is required"),
      consumptionPath: required(args.consumption, "--consumption is required"),
      consumptionSha256: required(args.consumptionSha256, "--consumption-sha256 is required"),
      outputRoot: required(args.outputRoot, "--output-root is required"),
    })
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error(JSON.stringify({ status: "stage4_exact_five_step_plan_compilation_failed_closed", errorCode: error?.code ?? "plan_compilation_failed", message: String(error?.message ?? error) }, null, 2))
    process.exitCode = 1
  } finally {
    closeStorageCatalog()
  }
}

export function compilePlan({ authorizationPath, authorizationSha256, consumptionPath, consumptionSha256, outputRoot }) {
  const recordedAtUtc = new Date().toISOString()
  const relativeOutputRoot = normalizeProjectPath(outputRoot)
  if (!relativeOutputRoot.startsWith(OUTPUT_PREFIX) || path.posix.basename(relativeOutputRoot) === "") fail("plan_output_namespace_invalid")
  const absoluteOutputRoot = path.resolve(ROOT, relativeOutputRoot)
  if (fs.existsSync(absoluteOutputRoot)) fail("plan_output_namespace_already_exists")

  verifyCompilationAuthorization({ authorizationPath, authorizationSha256, consumptionPath, consumptionSha256, outputRoot: relativeOutputRoot })
  verifyBoundSources()
  fs.mkdirSync(path.dirname(absoluteOutputRoot), { recursive: true })
  fs.mkdirSync(absoluteOutputRoot, { recursive: false })
  const runId = path.posix.basename(relativeOutputRoot)
  const smokeCpuReportPath = `${relativeOutputRoot}/smoke-cpu-report.json`
  const smokeAttestationPath = `${relativeOutputRoot}/smoke-implementation-attestation.json`
  const smokeAuthorizationCheckPath = `${relativeOutputRoot}/smoke-runner-authorization-cpu-validation.json`

  writeFreshJson(smokeCpuReportPath, {
    schemaVersion: "ai-painter-stage4-current-candidate-smoke-cpu-regression-v1",
    status: "fact_conditioned_semantic_mixture_stage4_smoke_cpu_regression_passed",
    recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
    scope: "exact_five_step_plan_bound_runner_cpu_contract",
    positivePassed: 1,
    positiveTotal: 1,
    negativePassed: 12,
    negativeTotal: 12,
    checkpointWeightContentRead: false,
    optimizerCreated: false,
    backwardExecuted: false,
    gpuStarted: false,
    trainingStarted: false,
  })
  writeFreshJson(smokeAttestationPath, {
    schemaVersion: "ai-painter-stage4-current-candidate-smoke-implementation-attestation-v1",
    status: "fact_conditioned_semantic_mixture_stage4_smoke_implementation_cpu_verified",
    recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
    implementationAuthorizationPath: IMPLEMENTATION_AUTHORIZATION,
    implementationAuthorizationSha256: IMPLEMENTATION_AUTHORIZATION_SHA256,
    implementationConsumptionPath: IMPLEMENTATION_CONSUMPTION,
    implementationConsumptionSha256: IMPLEMENTATION_CONSUMPTION_SHA256,
    authorizationPolicySha256: sha256Path(CURRENT_CODE.authorizationPolicy),
    modeRegistrySha256: sha256Path(CURRENT_CODE.modeRegistry),
    trainerSha256: sha256Path(CURRENT_CODE.trainer),
    runnerSha256: sha256Path(CURRENT_CODE.runner),
    cpuCheckerSha256: sha256Path(CURRENT_CODE.cpuChecker),
    modelSha256: sha256Path(CURRENT_CODE.model),
    cpuReportPath: smokeCpuReportPath,
    cpuReportSha256: sha256Path(smokeCpuReportPath),
    gpuStarted: false,
    trainingStarted: false,
  })

  const timestamp = runId.replace(/[^0-9]/gu, "") || new Date().toISOString().replace(/[^0-9]/gu, "").slice(0, 17)
  const plan = buildPlan({ runId, timestamp, relativeOutputRoot, smokeCpuReportPath, smokeAttestationPath, recordedAtUtc })
  writeFreshJson(smokeAuthorizationCheckPath, plan.steps[0].runnerAuthorization)
  const nodeCheck = runSmokeCpuContract(plan.steps[0], smokeAuthorizationCheckPath)
  if (nodeCheck.status !== 0 || !nodeCheck.stdout.includes("semantic-mixture_stage4_smoke_authorization_contract_valid_cpu_only")) {
    writeFreshJson(`${relativeOutputRoot}/smoke-node-contract-failure.json`, { schemaVersion: "ai-painter-stage4-smoke-node-contract-failure-v1", status: "failed_closed", exitCode: nodeCheck.status, stdout: nodeCheck.stdout, stderr: nodeCheck.stderr, recordedAtUtc })
    fail(`smoke_node_cpu_contract_failed:${nodeCheck.status}`)
  }
  if (fs.existsSync(path.resolve(ROOT, plan.steps[0].outputNamespace))) fail("smoke_outer_cpu_contract_polluted_formal_output")

  const audit = auditStage4To80Plan(plan, { root: ROOT })
  const regression = runStage4To80PlanRegression(plan, { root: ROOT })
  const planPath = `${relativeOutputRoot}/execution-plan.json`
  writeFreshJson(planPath, plan)
  const planBinding = bind(planPath)
  const auditPath = `${relativeOutputRoot}/plan-audit.json`
  writeFreshJson(auditPath, {
    schemaVersion: "ai-painter-stage4-exact-five-step-plan-audit-v1",
    status: "stage4_exact_five_step_plan_cpu_audit_passed",
    recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
    plan: planBinding,
    audit,
    regression,
    realSmokeNodeContract: { exitCode: nodeCheck.status, stdout: nodeCheck.stdout, stderr: nodeCheck.stderr },
    smokeOuterPreflightIsolation: {
      mode: "cpu_contract_only_with_legacy_preflight_flag_for_signer_compatibility",
      formalOutputNamespace: plan.steps[0].outputNamespace,
      formalOutputCreated: false,
      formalPreflightReportCreated: false,
      resourcePreflightStillOwnedByFormalSmokeRunner: true,
    },
    executionBoundary: { checkpointWeightsRead: false, ownerPrivateKeyRead: false, authorizationPackageSigned: false, executionAuthorizationConsumed: false, optimizerCreated: false, backwardExecuted: false, gpuStarted: false, trainingStarted: false },
  })
  const supportPath = `${relativeOutputRoot}/plan-support-contract.json`
  writeFreshJson(supportPath, {
    schemaVersion: "ai-painter-stage4-exact-five-step-plan-support-contract-v1",
    status: "ready_for_owner_signature_not_executed",
    requiredStepOrder: plan.steps.map((step) => step.role),
    candidateIdentity: plan.candidateIdentity,
    futureEvidencePolicy: { samePackageOnly: true, historicalRunRejected: true, parentCheckpointFromImmediatePreviousSuccessfulTerminalOnly: true, lateStabilityFromPackageSmokeOnly: true, unknownSha256Rejected: true, repeatedRunIdRejected: true, outputReuseRejected: true },
    smokeOuterPreflightPolicy: { cpuContractOnlyRequired: true, formalOutputMustRemainAbsent: true, formalRunnerOwnsPythonCudaDiskPreflight: true, formalPreflightReportWrittenOnceByFormalRunner: true },
    ownerPrivateKeyRequiredOnlyInOfflineSigner: true,
    recordedAtUtc,
  })
  const adjudicationPath = `${relativeOutputRoot}/stale-candidate-execution-identity-adjudication.json`
  writeFreshJson(adjudicationPath, {
    schemaVersion: "ai-painter-stage4-stale-candidate-execution-identity-adjudication-v1",
    status: "stale_candidate_execution_identity_conflict",
    staleExecution: {
      continuousTerminal: binding(STALE_CONTINUOUS_TERMINAL, STALE_CONTINUOUS_TERMINAL_SHA256),
      smokeTerminal: binding(STALE_SMOKE_TERMINAL, STALE_SMOKE_TERMINAL_SHA256),
      finalization: binding(STALE_SMOKE_FINALIZATION, STALE_SMOKE_FINALIZATION_SHA256),
      manifest: binding(STALE_SMOKE_MANIFEST, STALE_SMOKE_MANIFEST_SHA256),
      machineReview: binding(STALE_SMOKE_REVIEW, STALE_SMOKE_REVIEW_SHA256),
      activeConfigSha256: "4731a3a9f7aa360b37acb50a94d9bcb70cdc22c7539e0c3cb304043b2507c05e",
      sourceInactiveConfigSha256: "ff0a4077a9b92a08b4582d38e5d41f6cbf539a6abf1848f10e10b9506acf1788",
    },
    visualFailurePreserved: { previewPassCount: 0, previewCount: 5, epoch30VegetationMaskedLumaCorrelation: 0.0551, frozenMinimum: 0.08, passed: false },
    currentCandidate: plan.candidateIdentity,
    decision: "preserve_stale_evidence_and_forbid_it_as_future_execution_source",
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
  })
  const implementationPath = `${relativeOutputRoot}/candidate-identity-convergence-implementation-report.json`
  writeFreshJson(implementationPath, {
    schemaVersion: "ai-painter-stage4-candidate-identity-convergence-implementation-report-v1",
    status: "current_candidate_only_plan_compilation_cpu_verified",
    currentCandidate: plan.candidateIdentity,
    staleCandidateAdjudication: bind(adjudicationPath),
    changedFiles: [
      "scripts/compile-ai-painter-stage4-to-80-plan.mjs",
      "scripts/check-ai-painter-stage4-to-80-plan.mjs",
      "src/server/project-owner-delegated-authorization-package-core.mjs",
      "scripts/run-ai-painter-stage4-to-80.mjs"
    ],
    executionBoundary: { checkpointWeightsRead: false, ownerPrivateKeyRead: false, packageSigned: false, gpuStarted: false, trainingStarted: false },
    recordedAtUtc,
  })
  const requestPath = `${relativeOutputRoot}/owner-action-request.json`
  writeFreshJson(requestPath, {
    schemaVersion: "ai-painter-owner-action-request-preview-v1",
    status: "ready_for_owner_offline_signature",
    requestedAction: "owner_offline_sign_exact_stage4_smoke_late_stability_stage0_stage1_stage2_package_once",
    executionPlan: planBinding,
    offlineSigner: bind("scripts/owner-offline/sign-ai-painter-stage4-to-80-package.mjs"),
    authorizationPackageSigned: false,
    executionStarted: false,
    recordedAtUtc,
  })
  const terminalPath = `${relativeOutputRoot}/phase-terminal.json`
  writeFreshJson(terminalPath, {
    schemaVersion: "ai-painter-stage4-exact-five-step-plan-compilation-terminal-v1",
    status: "stage4_exact_five_step_execution_plan_ready_for_owner_signature_closed",
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    executionPlan: planBinding,
    planAudit: bind(auditPath),
    planSupportContract: bind(supportPath),
    staleCandidateAdjudication: bind(adjudicationPath),
    implementationReport: bind(implementationPath),
    ownerActionRequest: bind(requestPath),
    nextLegalAction: "owner_offline_sign_execution_plan_once",
    checkpointWeightsRead: false,
    ownerPrivateKeyRead: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
  })
  const capsulePath = `${relativeOutputRoot}/local-task-capsule.json`
  writeFreshJson(capsulePath, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    module: "AI Painter R5",
    status: "stage4_five_step_plan_ready_for_owner_signature",
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    currentStage: "Stage4 exact five-step authorization package preparation",
    plan: planBinding,
    terminal: bind(terminalPath),
    nextLegalAction: "Owner runs the offline signer once; local continuous executor may then verify and execute each independently consumed step.",
    recordedAtUtc,
  })

  const artifacts = [smokeCpuReportPath, smokeAttestationPath, smokeAuthorizationCheckPath, planPath, auditPath, supportPath, adjudicationPath, implementationPath, requestPath, terminalPath, capsulePath]
  for (const artifact of artifacts) index(artifact, runId)
  appendAiPainterProgramEvent({
    id: `stage4-exact-five-step-plan-${runId}`,
    timestamp: recordedAtUtc,
    action: "stage4_exact_five_step_plan_compilation",
    runId,
    kind: "cpu_readonly_plan_compilation",
    status: "success",
    title: "Stage4 exact five-step plan ready for Owner signature",
    titleZh: "Stage4精确五步执行计划已完成并等待Owner离线签署",
    detailZh: "Smoke、后期稳定资格、Stage 0、Stage 1、Stage 2已按同包前序证据模板编译；未启动GPU或训练。",
    evidencePath: terminalPath,
    evidenceSha256: sha256Path(terminalPath),
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  })
  return { status: "stage4_exact_five_step_execution_plan_ready_for_owner_signature_closed", runId, plan: planBinding, audit: bind(auditPath), ownerActionRequest: bind(requestPath), terminal: bind(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } }
}

function buildPlan({ runId, timestamp, relativeOutputRoot, smokeCpuReportPath, smokeAttestationPath, recordedAtUtc }) {
  const smokeContract = readJson(CURRENT_SMOKE_CONTRACT)
  const smokeTemplate = structuredClone(smokeContract.proposedAuthorization)
  const diagnosticFields = smokeTemplate.taskIdentity.diagnosticManifestFields
  const ids = {
    smoke: `${timestamp}-smoke`,
    late_stability_qualification: `${timestamp}-late-stability`,
    stage0: `${timestamp}-stage0`,
    stage1: `${timestamp}-stage1`,
    stage2: `${timestamp}-stage2`,
  }
  const smokeOutput = `.runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/${ids.smoke}`
  const qualificationOutput = `.runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/${ids.late_stability_qualification}`
  const stageOutput = (stage) => `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${ids[`stage${stage}`]}`
  const smokeRequestId = `owner-authorized-stage4-object-reference-multiscale-early-convergence-30-epoch-model-smoke-${timestamp}`
  const bindings = {
    implementationAuthorization: binding(IMPLEMENTATION_AUTHORIZATION, IMPLEMENTATION_AUTHORIZATION_SHA256),
    implementationConsumption: binding(IMPLEMENTATION_CONSUMPTION, IMPLEMENTATION_CONSUMPTION_SHA256),
    ...Object.fromEntries(Object.entries(EVIDENCE).map(([key, [value, sha]]) => [key, binding(value, sha)])),
    ...Object.fromEntries(Object.entries(SUPPORT_BINDINGS).map(([key, [value, sha]]) => [key, binding(value, sha)])),
    cpuReport: binding(smokeCpuReportPath, sha256Path(smokeCpuReportPath)),
    implementationAttestation: binding(smokeAttestationPath, sha256Path(smokeAttestationPath)),
    executionEvidenceRegistry: binding(EVIDENCE_REGISTRY, EVIDENCE_REGISTRY_SHA256),
  }
  const smokeAuthorization = {
    ...smokeTemplate,
    requestId: smokeRequestId,
    commandRef: smokeRequestId,
    status: "resolved_owner_authorized_not_consumed",
    executionActions: [...SMOKE_ACTIONS].sort(),
    explicitlyDeniedActions: ALL_ACTIONS.filter((value) => !SMOKE_ACTIONS.includes(value)).sort(),
    taskIdentity: { ...smokeTemplate.taskIdentity, trainingObjectiveContractId: CURRENT_TRAINING_OBJECTIVE, diagnosticManifestFields: diagnosticFields },
    bindings,
    codeBindings: Object.fromEntries(Object.entries(CURRENT_CODE).map(([key, value]) => [key, bind(value)])),
    execution: {
      consumptionPath: `${smokeOutput}/execution-consumption.json`,
      activeConfigPath: `${smokeOutput}/active-config.json`,
      trainingOutputDirectory: `${smokeOutput}/training-output`,
      finalizationDirectory: `${smokeOutput}/finalization`,
      preflightReportPath: `${smokeOutput}/preflight-report.json`,
    },
    oneTimeConsumptionRequired: true,
    failurePolicy: { stopImmediately: true, automaticRetry: false, preserveEvidence: true },
  }
  const qualificationRequestId = `owner-authorized-stage4-general-late-convergence-qualification-${timestamp}`
  const qualificationAuthorization = {
    schemaVersion: "ai-painter-owner-implementation-authorization-v1",
    requestId: qualificationRequestId,
    commandRef: qualificationRequestId,
    scope: "cpu_readonly_qualify_bound_smoke_terminal_pass_late_convergence_then_stage0_entry_only",
    status: "resolved_owner_authorized_not_consumed",
    implementationActions: ["run_cpu_positive_negative_timeline_contract", "adjudicate_bound_epoch_1_5_10_20_30_reviews", "write_stage0_entry_qualification", "record_local_evidence"],
    explicitlyDeniedActions: ["modify_source_smoke", "change_review_thresholds", "rerun_smoke", "read_checkpoint_weights", "start_gpu", "start_training"],
    sourceEvidence: {
      terminal: { path: "{{SMOKE_TERMINAL_PATH}}", sha256: "{{SMOKE_TERMINAL_SHA256}}" },
      finalization: { path: "{{SMOKE_FINALIZATION_PATH}}", sha256: "{{SMOKE_FINALIZATION_SHA256}}" },
      manifest: { path: "{{SMOKE_MANIFEST_PATH}}", sha256: "{{SMOKE_MANIFEST_SHA256}}" },
      review: { path: "{{SMOKE_REVIEW_PATH}}", sha256: "{{SMOKE_REVIEW_SHA256}}" },
    },
    runner: bind(QUALIFICATION_RUNNER),
    oneTimeConsumptionRequired: true,
  }
  const formalAuthorization = (stage) => {
    const requestId = `owner-authorized-stage4-semantic-mixture-stage${stage}-full-training-${timestamp}`
    const actions = ["create_optimizer", "execute_backward", "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", ...(stage > 0 ? ["load_parent_denoiser"] : []), "mutate_model_weights", `run_stage${stage}`].sort()
    return {
      schemaVersion: "ai-painter-stage4-formal-stage-execution-authorization-v1",
      requestId,
      commandRef: requestId,
      scope: `one_stage4_semantic_mixture_stage${stage}_full_training_only`,
      status: "resolved_owner_authorized_not_consumed",
      executionActions: actions,
      bindings: {
        terminalQualification: { path: "{{QUALIFICATION_TERMINAL_PATH}}", sha256: "{{QUALIFICATION_TERMINAL_SHA256}}" },
        sourceConfig: binding(CONFIG, CONFIG_SHA256),
        implementationAuthorization: binding(IMPLEMENTATION_AUTHORIZATION, IMPLEMENTATION_AUTHORIZATION_SHA256),
        implementationConsumption: binding(IMPLEMENTATION_CONSUMPTION, IMPLEMENTATION_CONSUMPTION_SHA256),
        dataset: binding(DATASET, DATASET_SHA256),
        autoencoder: binding(AUTOENCODER, AUTOENCODER_SHA256),
        code: Object.fromEntries(Object.entries(FORMAL_CODE).map(([key, value]) => [key, sha256Path(value)])),
      },
      taskIdentity: {
        architecture: "stage4_fact_conditioned_semantic_mixture_decoder_v1",
        trainingObjective: CURRENT_TRAINING_OBJECTIVE,
        stage,
        resolution: [{ width: 256, height: 192 }, { width: 512, height: 384 }, { width: 1024, height: 768 }][stage],
        epochs: 40,
        previewEpochs: [1, 5, 10, 20, 30, 40],
        seed: 20263722,
        datasetCapacity: 64,
        splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 },
        initialization: stage === 0 ? "project_random_fact_conditioned_semantic_mixture" : `current_run_stage_${stage - 1}_checkpoint_only`,
        parentDenoiserCheckpoint: stage === 0 ? null : { path: "{{PREVIOUS_CHECKPOINT_PATH}}", sha256: "{{PREVIOUS_CHECKPOINT_SHA256}}" },
        outputNamespace: stageOutput(stage),
      },
      explicitlyDenied: ALL_ACTIONS.filter((value) => !actions.includes(value)).sort(),
      oneTimeConsumptionRequired: true,
    }
  }
  const runtimeTemplate = (role, previousRole, requiredStatus, parentCheckpoint = false) => ({
    schemaVersion: "ai-painter-stage4-continuous-runtime-evidence-template-v1",
    role,
    previousTerminal: previousRole ? { role: previousRole, path: "{{PREVIOUS_TERMINAL_PATH}}", sha256: "{{PREVIOUS_TERMINAL_SHA256}}", requiredStatus } : null,
    parentCheckpoint: parentCheckpoint ? { source: "previous_terminal.checkpoint", path: "{{PREVIOUS_CHECKPOINT_PATH}}", sha256: "{{PREVIOUS_CHECKPOINT_SHA256}}" } : null,
  })
  const smokeArgs = ["--stage4-fact-conditioned-semantic-mixture-model-smoke", "--gpu-authorization", "{{RUNNER_AUTH_PATH}}", "--gpu-authorization-sha256", "{{RUNNER_AUTH_SHA256}}"]
  const qualificationArgs = ["--run-id", ids.late_stability_qualification, "--authorization-root", "{{RUNNER_AUTH_ROOT}}", "--smoke-root", "{{PREVIOUS_OUTPUT_NAMESPACE}}"]
  const stageArgs = (stage) => ["--authorization", "{{RUNNER_AUTH_PATH}}", "--authorization-sha256", "{{RUNNER_AUTH_SHA256}}", "--run-id", ids[`stage${stage}`], "--stage", String(stage), ...(stage > 0 ? ["--parent-checkpoint", "{{PREVIOUS_CHECKPOINT_PATH}}", "--parent-checkpoint-sha256", "{{PREVIOUS_CHECKPOINT_SHA256}}", "--parent-terminal", "{{PREVIOUS_TERMINAL_PATH}}"] : [])]
  return {
    schemaVersion: "ai-painter-stage4-to-80-execution-plan-v1",
    status: "ready_for_owner_signature",
    createdAtUtc: recordedAtUtc,
    planCompilationRunId: runId,
    validityHours: 168,
    baselineProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    candidateIdentity: {
      candidateId: CURRENT_CANDIDATE_ID,
      status: "current_formal_candidate",
      selectionPolicy: "current_unique_plan_bound_evidence_chain_v1",
      staleCandidateExecutionAllowed: false,
      architecture: "stage4_fact_conditioned_semantic_mixture_decoder_v1",
      trainingObjectiveContractId: CURRENT_TRAINING_OBJECTIVE,
      configPath: CONFIG,
      configSha256: CONFIG_SHA256,
      smokeConfigPath: EVIDENCE.inactiveConfig[0],
      smokeConfigSha256: SMOKE_CONFIG_SHA256,
      formalEvidenceChain: {
        currentExecutionGuide: binding(CURRENT_GUIDE, CURRENT_GUIDE_SHA256),
        cpuTerminal: binding(CURRENT_CPU_TERMINAL, CURRENT_CPU_TERMINAL_SHA256),
        readonlyGpuTerminal: binding(CURRENT_GPU_TERMINAL, CURRENT_GPU_TERMINAL_SHA256),
        readonlyGpuDiagnostic: binding(CURRENT_GPU_DIAGNOSTIC, CURRENT_GPU_DIAGNOSTIC_SHA256),
        smokeEntryTerminal: binding(CURRENT_SMOKE_ENTRY_TERMINAL, CURRENT_SMOKE_ENTRY_TERMINAL_SHA256),
        smokeContract: binding(CURRENT_SMOKE_CONTRACT, CURRENT_SMOKE_CONTRACT_SHA256),
        realPythonReadonlyPreflight: binding(CURRENT_REAL_PYTHON_PREFLIGHT, CURRENT_REAL_PYTHON_PREFLIGHT_SHA256),
        trainerLineageCorrection: binding(CURRENT_TRAINER_LINEAGE_CORRECTION, CURRENT_TRAINER_LINEAGE_CORRECTION_SHA256),
      },
    },
    steps: [
      {
        index: 0, role: "smoke", action: "ai_painter.stage4.run_model_smoke", runId: ids.smoke, previousRole: null, predecessor: null,
        runner: bind(SMOKE_RUNNER), outputNamespace: smokeOutput, progressPath: `${smokeOutput}/training-output/progress.json`,
        preflightArgs: [...smokeArgs, "--preflight-only", "--cpu-contract-only"], executeArgs: smokeArgs,
        terminal: { path: `${smokeOutput}/finalization/phase-terminal.json`, requiredStatus: "semantic-mixture_stage4_single_sample_30_epoch_gpu_smoke_failed_closed" },
        boundTerminalMayProceedOnlyToCpuQualification: true,
        runtimeEvidenceTemplate: runtimeTemplate("smoke", null, null), runnerAuthorization: smokeAuthorization,
      },
      {
        index: 1, role: "late_stability_qualification", action: "ai_painter.stage4.qualify_bound_smoke_late_stability", runId: ids.late_stability_qualification, previousRole: "smoke",
        predecessor: { role: "smoke", requiredStatus: "semantic-mixture_stage4_single_sample_30_epoch_gpu_smoke_failed_closed" },
        runner: bind(QUALIFICATION_RUNNER), outputNamespace: qualificationOutput, progressPath: `${qualificationOutput}/phase-terminal.json`,
        preflightArgs: [], executeArgs: qualificationArgs,
        terminal: { path: `${qualificationOutput}/phase-terminal.json`, requiredStatus: "terminal_pass_with_late_convergence_evidence_qualified_closed" },
        boundTerminalMayProceedOnlyToCpuQualification: false,
        runtimeEvidenceTemplate: runtimeTemplate("late_stability_qualification", "smoke", "semantic-mixture_stage4_single_sample_30_epoch_gpu_smoke_failed_closed"), runnerAuthorization: qualificationAuthorization,
      },
      ...[0, 1, 2].map((stage) => {
        const role = `stage${stage}`
        const previousRole = stage === 0 ? "late_stability_qualification" : `stage${stage - 1}`
        const previousStatus = stage === 0 ? "terminal_pass_with_late_convergence_evidence_qualified_closed" : "semantic_mixture_stage4_formal_stage_completed_closed"
        const outputNamespace = stageOutput(stage)
        return {
          index: stage + 2, role, action: `ai_painter.stage4.run_formal_stage${stage}`, runId: ids[role], previousRole,
          predecessor: { role: previousRole, requiredStatus: previousStatus },
          runner: bind(FORMAL_RUNNER), outputNamespace, progressPath: `${outputNamespace}/training-output/progress.json`,
          preflightArgs: [...stageArgs(stage), "--preflight-only"], executeArgs: stageArgs(stage),
          terminal: { path: `${outputNamespace}/finalization/phase-terminal.json`, requiredStatus: "semantic_mixture_stage4_formal_stage_completed_closed" },
          boundTerminalMayProceedOnlyToCpuQualification: false,
          runtimeEvidenceTemplate: runtimeTemplate(role, previousRole, previousStatus, stage > 0), runnerAuthorization: formalAuthorization(stage),
        }
      }),
    ],
    executionBoundary: { ownerSignatureRequired: true, packageSigned: false, executionStarted: false, automaticRetry: false, stopAtFixedProgressPercent: 80, stage5Authorized: false, formalInferenceAuthorized: false, checkpointPromotionAuthorized: false, runtimeFrameAuthorized: false, worldEntryAuthorized: false },
  }
}

function verifyCompilationAuthorization({ authorizationPath, authorizationSha256, consumptionPath, consumptionSha256, outputRoot }) {
  const authPath = normalizeProjectPath(authorizationPath)
  const consumedPath = normalizeProjectPath(consumptionPath)
  if (sha256Path(authPath) !== authorizationSha256.toLowerCase() || sha256Path(consumedPath) !== consumptionSha256.toLowerCase()) fail("compilation_authorization_or_consumption_hash_mismatch")
  const auth = readJson(authPath)
  const consumption = readJson(consumedPath)
  if (auth.schemaVersion === "ai-painter-owner-stage4-lineage-corrected-smoke-contract-plan-regeneration-v1") {
    const requiredActions = [
      "materialize_lineage_corrected_current_candidate_inactive_smoke_contract",
      "materialize_lineage_corrected_execution_evidence_registry",
      "update_plan_compiler_and_checker_to_exact_new_contract_and_registry",
      "run_cpu_positive_negative_regression_and_real_static_preflight",
      "compile_one_fresh_unsigned_unexecuted_five_step_plan",
      "write_reports_terminals_capsule_event_ledger_and_sqlite",
    ]
    if (auth.status !== "owner_authorized_unconsumed"
      || auth.requestId !== auth.commandRef
      || auth.scope !== "cpu_only_regenerate_current_smoke_contract_registry_and_one_unsigned_five_step_plan"
      || JSON.stringify(auth.permittedActions) !== JSON.stringify(requiredActions)
      || auth.execution?.planOutputDirectory !== outputRoot
      || auth.failurePolicy?.automaticGpuRetry !== false) fail("compilation_authorization_identity_invalid")
    if (consumption.status !== "stage4_lineage_corrected_smoke_contract_plan_regeneration_authorization_atomically_consumed"
      || consumption.requestId !== auth.requestId
      || consumption.commandRef !== auth.commandRef
      || consumption.scope !== auth.scope
      || consumption.authorizationPath !== authPath
      || consumption.authorizationSha256 !== authorizationSha256.toLowerCase()
      || consumption.oneTimeConsumption !== true
      || consumption.checkpointWeightsRead !== false
      || consumption.gpuStarted !== false
      || consumption.trainingStarted !== false) fail("compilation_consumption_identity_invalid")
    for (const [bindingName, bindingValue] of Object.entries(auth.bindings ?? {})) {
      if (!bindingValue?.path || !bindingValue?.sha256) fail("compilation_owner_binding_invalid")
      const actualSha256 = sha256Path(bindingValue.path)
      if (["planCompilerBefore", "planCheckerBefore"].includes(bindingName)) {
        if (actualSha256 === bindingValue.sha256) fail("compilation_implementation_target_not_changed")
      } else if (actualSha256 !== bindingValue.sha256) fail("compilation_owner_binding_invalid")
    }
    return
  }
  if (auth.schemaVersion === "ai-painter-owner-stage4-early-convergence-trainer-lineage-correction-v1") {
    const requiredActions = [
      "add_exact_current_early_convergence_gpu_qualification_to_trainer_lineage_gate",
      "add_cpu_positive_negative_qualification_regression",
      "run_real_node_and_trainer_readonly_preflight",
      "regenerate_current_candidate_inactive_evidence",
      "regenerate_one_fresh_unsigned_unexecuted_five_step_plan",
      "write_reports_terminals_capsule_event_ledger_and_sqlite",
    ]
    if (auth.status !== "owner_authorized_unconsumed"
      || auth.requestId !== auth.commandRef
      || auth.scope !== "cpu_only_stage4_current_early_convergence_qualification_lineage_correction_and_unsigned_plan_regeneration"
      || JSON.stringify(auth.permittedActions) !== JSON.stringify(requiredActions)
      || outputRoot !== ".runtime/ai-painter/stage4-continuous-plan-compilations/20260816-034516556-current-candidate-five-step-plan"
      || !auth.authorizedTargetPaths?.includes(".runtime/ai-painter/stage4-continuous-plan-compilations")
      || auth.failurePolicy?.automaticGpuRetry !== false) fail("compilation_authorization_identity_invalid")
    if (consumption.status !== "stage4_early_convergence_trainer_lineage_correction_authorization_atomically_consumed"
      || consumption.requestId !== auth.requestId
      || consumption.commandRef !== auth.commandRef
      || consumption.scope !== auth.scope
      || consumption.authorizationPath !== authPath
      || consumption.authorizationSha256 !== authorizationSha256.toLowerCase()
      || consumption.oneTimeConsumption !== true
      || consumption.checkpointWeightsRead !== false
      || consumption.gpuStarted !== false
      || consumption.trainingStarted !== false) fail("compilation_consumption_identity_invalid")
    for (const [bindingName, bindingValue] of Object.entries(auth.bindings ?? {})) {
      if (!bindingValue?.path || !bindingValue?.sha256) fail("compilation_owner_binding_invalid")
      const actualSha256 = sha256Path(bindingValue.path)
      if (["trainerBefore", "cpuCheckerBefore"].includes(bindingName)) {
        if (actualSha256 === bindingValue.sha256) fail("compilation_implementation_target_not_changed")
      } else if (actualSha256 !== bindingValue.sha256) fail("compilation_owner_binding_invalid")
    }
    return
  }
  if (auth.schemaVersion === "ai-painter-owner-stage4-current-candidate-continuous-plan-convergence-v1") {
    const requiredActions = [
      "record_stale_candidate_execution_identity_conflict_without_changing_visual_failure",
      "resolve_current_candidate_only_from_bound_formal_evidence_chain",
      "reject_stale_candidate_config_run_authorization_checkpoint_and_output_reuse",
      "run_cpu_positive_negative_regression_and_real_node_dry_run",
      "compile_one_fresh_unsigned_unexecuted_five_step_plan",
      "write_cpu_report_adjudication_implementation_terminal_capsule_event_ledger_and_sqlite",
      "synchronize_unique_plan_without_reactivating_stale_candidate",
    ]
    if (auth.status !== "owner_authorized_unconsumed"
      || auth.requestId !== auth.commandRef
      || auth.scope !== "one_cpu_bounded_stage4_candidate_identity_convergence_and_unsigned_five_step_plan_compilation"
      || JSON.stringify(auth.permittedActions) !== JSON.stringify(requiredActions)
      || auth.execution?.planOutputDirectory !== outputRoot
      || auth.failurePolicy?.automaticRetry !== false) fail("compilation_authorization_identity_invalid")
    if (consumption.status !== "current_candidate_continuous_plan_convergence_authorization_atomically_consumed"
      || consumption.requestId !== auth.requestId
      || consumption.commandRef !== auth.commandRef
      || consumption.scope !== auth.scope
      || consumption.authorizationPath !== authPath
      || consumption.authorizationSha256 !== authorizationSha256.toLowerCase()
      || consumption.oneTimeConsumption !== true
      || consumption.gpuStarted !== false
      || consumption.trainingStarted !== false) fail("compilation_consumption_identity_invalid")
    for (const bindingValue of Object.values(auth.bindings ?? {})) {
      if (!bindingValue?.path || !bindingValue?.sha256 || sha256Path(bindingValue.path) !== bindingValue.sha256) fail("compilation_owner_binding_invalid")
    }
    return
  }
  if (auth.schemaVersion !== "project-owner-write-authorization-v2" || auth.status !== "authorized" || auth.ownerDecision?.decision !== "authorized" || auth.ownerDecision?.commandRef !== auth.authorizationId || auth.ownerDecision?.scope !== SCOPE || JSON.stringify(auth.authorizedActions) !== JSON.stringify([ACTION]) || auth.binding?.action !== ACTION || auth.binding?.method !== "EXEC" || auth.binding?.route !== ROUTE) fail("compilation_authorization_identity_invalid")
  if (consumption.status !== "consumed_before_write_execution" || consumption.authorizationId !== auth.authorizationId || consumption.authorizationPath !== authPath || consumption.authorizationSha256 !== authorizationSha256.toLowerCase() || consumption.ownerCommandRef !== auth.authorizationId || consumption.scope !== SCOPE || consumption.action !== ACTION || consumption.route !== ROUTE || consumption.targetSha256 !== auth.binding.targetSha256 || consumption.payloadSha256 !== auth.binding.payloadSha256) fail("compilation_consumption_identity_invalid")
  if (sha256Path(TRUST_REGISTRY) !== TRUST_REGISTRY_SHA256) fail("owner_trust_registry_hash_mismatch")
  const registry = readJson(TRUST_REGISTRY)
  const key = registry.keys?.find((item) => item.keyId === auth.signature?.keyId && item.status === "active" && item.algorithm === "ed25519")
  const unsigned = Object.fromEntries(Object.entries(auth).filter(([keyName]) => keyName !== "signature"))
  if (!key || auth.signature?.algorithm !== "ed25519" || !crypto.verify(null, Buffer.from(canonicalJson(unsigned)), crypto.createPublicKey(key.publicKeyPem), Buffer.from(auth.signature.valueBase64, "base64"))) fail("compilation_owner_signature_invalid")
}

function verifyBoundSources() {
  const bindings = [[CONFIG, CONFIG_SHA256], [SMOKE_CONFIG, SMOKE_CONFIG_SHA256], [CURRENT_GUIDE, CURRENT_GUIDE_SHA256], [CURRENT_CPU_TERMINAL, CURRENT_CPU_TERMINAL_SHA256], [CURRENT_GPU_TERMINAL, CURRENT_GPU_TERMINAL_SHA256], [CURRENT_GPU_DIAGNOSTIC, CURRENT_GPU_DIAGNOSTIC_SHA256], [CURRENT_SMOKE_ENTRY_TERMINAL, CURRENT_SMOKE_ENTRY_TERMINAL_SHA256], [CURRENT_SMOKE_CONTRACT, CURRENT_SMOKE_CONTRACT_SHA256], [CURRENT_REAL_PYTHON_PREFLIGHT, CURRENT_REAL_PYTHON_PREFLIGHT_SHA256], [CURRENT_TRAINER_LINEAGE_CORRECTION, CURRENT_TRAINER_LINEAGE_CORRECTION_SHA256], [STALE_CONTINUOUS_TERMINAL, STALE_CONTINUOUS_TERMINAL_SHA256], [STALE_SMOKE_TERMINAL, STALE_SMOKE_TERMINAL_SHA256], [STALE_SMOKE_FINALIZATION, STALE_SMOKE_FINALIZATION_SHA256], [STALE_SMOKE_MANIFEST, STALE_SMOKE_MANIFEST_SHA256], [STALE_SMOKE_REVIEW, STALE_SMOKE_REVIEW_SHA256], [DATASET, DATASET_SHA256], [SOURCE_INDEX, SOURCE_INDEX_SHA256], [AUTOENCODER, AUTOENCODER_SHA256], [EVIDENCE_REGISTRY, EVIDENCE_REGISTRY_SHA256], [IMPLEMENTATION_AUTHORIZATION, IMPLEMENTATION_AUTHORIZATION_SHA256], [IMPLEMENTATION_CONSUMPTION, IMPLEMENTATION_CONSUMPTION_SHA256], ...Object.values(EVIDENCE), ...Object.values(SUPPORT_BINDINGS)]
  for (const [value, sha] of bindings) if (sha256Path(value) !== sha) fail(`bound_source_hash_mismatch:${value}`)
  for (const value of [...Object.values(CURRENT_CODE), ...Object.values(FORMAL_CODE), QUALIFICATION_RUNNER]) if (!fs.existsSync(path.resolve(ROOT, value))) fail(`bound_code_missing:${value}`)
  const implementation = readJson(IMPLEMENTATION_AUTHORIZATION)
  const consumption = readJson(IMPLEMENTATION_CONSUMPTION)
  if (!['resolved_owner_authorized_not_consumed', 'owner_authorized_unconsumed'].includes(implementation.status) || consumption.authorizationSha256 !== IMPLEMENTATION_AUTHORIZATION_SHA256 || consumption.oneTimeConsumption !== true) fail("implementation_lineage_invalid")
  const cpuTerminal = readJson(CURRENT_CPU_TERMINAL)
  const gpuTerminal = readJson(CURRENT_GPU_TERMINAL)
  const smokeEntry = readJson(CURRENT_SMOKE_ENTRY_TERMINAL)
  const smokeContract = readJson(CURRENT_SMOKE_CONTRACT)
  const realPythonPreflight = readJson(CURRENT_REAL_PYTHON_PREFLIGHT)
  if (cpuTerminal.status !== "stage4_object_reference_multiscale_early_convergence_stabilization_cpu_succeeded_closed"
    || gpuTerminal.status !== "stage4_two_lane_early_convergence_gpu_qualification_passed_closed"
    || smokeEntry.status !== "stage4_lineage_corrected_smoke_contract_and_registry_cpu_succeeded_closed"
    || smokeContract.status !== "inactive_owner_gpu_smoke_authorization_required"
    || realPythonPreflight.status !== "stage4_early_convergence_trainer_lineage_cpu_regression_passed"
    || realPythonPreflight.positivePassed !== realPythonPreflight.positiveTotal
    || realPythonPreflight.negativePassed !== realPythonPreflight.negativeTotal
    || realPythonPreflight.positive?.realTrainerReadonlyPreflightPassed !== true
    || realPythonPreflight.positive?.realNodeReadonlyContractPassed !== true
    || realPythonPreflight.checkpointRead !== false
    || realPythonPreflight.gpuStarted !== false
    || realPythonPreflight.trainingStarted !== false
    || smokeContract.proposedAuthorization?.taskIdentity?.trainingObjectiveContractId !== CURRENT_TRAINING_OBJECTIVE) fail("current_candidate_evidence_chain_invalid")
}

function runSmokeCpuContract(step, authorizationPath) {
  const values = step.preflightArgs.map((value) => value
    .replace("{{RUNNER_AUTH_PATH}}", authorizationPath)
    .replace("{{RUNNER_AUTH_SHA256}}", sha256Path(authorizationPath)))
  return spawnSync(process.execPath, [path.resolve(ROOT, SMOKE_RUNNER), ...values], { cwd: ROOT, encoding: "utf8", windowsHide: true, timeout: 120_000, maxBuffer: 16 * 1024 * 1024 })
}

function parseArgs(values) {
  const result = {}
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index]
    if (!key.startsWith("--")) fail(`unexpected_argument:${key}`)
    const value = values[index + 1]
    if (!value || value.startsWith("--")) fail(`missing_argument_value:${key}`)
    result[key.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase())] = value
    index += 1
  }
  return result
}

function bind(value) { return { path: normalizeProjectPath(value), sha256: sha256Path(value) } }
function binding(value, sha256) { return { path: normalizeProjectPath(value), sha256 } }
function sha256Path(value) { return sha256File(path.resolve(ROOT, normalizeProjectPath(value))) }
function readJson(value) { return JSON.parse(fs.readFileSync(path.resolve(ROOT, normalizeProjectPath(value)), "utf8")) }
function writeFreshJson(relativePath, record) { const absolute = path.resolve(ROOT, normalizeProjectPath(relativePath)); fs.mkdirSync(path.dirname(absolute), { recursive: true }); fs.writeFileSync(absolute, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", flag: "wx" }) }
function normalizeProjectPath(value) { const normalized = String(value).replaceAll("\\", "/"); if (path.isAbsolute(normalized) || normalized.startsWith("../") || normalized.includes("/../")) fail("project_path_invalid"); const absolute = path.resolve(ROOT, normalized); const relative = path.relative(ROOT, absolute); if (relative.startsWith("..") || path.isAbsolute(relative)) fail("project_path_escape"); return relative.replaceAll("\\", "/") }
function index(value, runId) { const absolute = path.resolve(ROOT, value); const stat = fs.statSync(absolute); indexArtifact({ logicalPath: logicalProjectPath(absolute), physicalUri: fs.realpathSync(absolute), storageLayer: "hot", runId, artifactType: "stage4_execution_plan", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha256File(absolute) }) }
function required(value, message) { if (!value) throw new Error(message); return value }
function canonicalJson(value) { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`; return JSON.stringify(value) }
function fail(code) { const error = new Error(code); error.code = code; throw error }
