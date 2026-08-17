import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { auditStage4Stage0To80ContinuationPlan } from "./check-ai-painter-stage4-stage0-to-80-continuation-plan.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const ROOT = process.cwd()
const CONTRACT = "data/ai-painter/system-governance/stage4-stage0-to-80-continuation-authorization-contract-v1.json"
const QUALIFICATION = ".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260816-043031696/phase-terminal.json"
const QUALIFICATION_SHA = "e71248fc1a0085c78dca4d69ae8d0436f122b3d88b5f94d33f72c0e748bf4e7b"
const CONFIG = ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-stabilization-cpu-implementations/20260815-183000000/inactive-config.json"
const CONFIG_SHA = "af6599b771b76aae4eac722c120a3d32dc1e23e1de92a1c0a26f051a82d11476"
const IMPLEMENTATION_AUTH = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-multiscale-reference-luminance-variation-preserving-mask-fallback-20260816-061630885/authorization.json"
const IMPLEMENTATION_AUTH_SHA = "b51079dcd8be012b301c4f5b6d44191914fb586022875f540206d5ab1cb1566e"
const IMPLEMENTATION_CONSUMPTION = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-multiscale-reference-luminance-variation-preserving-mask-fallback-20260816-061630885/consumption.json"
const IMPLEMENTATION_CONSUMPTION_SHA = "fc9d1705133ac2893f706faaec95c51fe89ee0bf3cb5ee8a6d18019435dfb141"
const DATASET = "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
const DATASET_SHA = "8001f5a27bb8bc18883184b0c7e39ef1336eb295ce5787618bf4e60059dd48aa"
const AUTOENCODER = ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt"
const AUTOENCODER_SHA = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
const FORMAL_RUNNER = "scripts/run-stage4-semantic-mixture-formal-stage.mjs"
const CODE = {
  authorizationPolicy: "ml/ai-painter/scripts/ai_painter_authorization_policy.py",
  modeRegistry: "ml/ai-painter/scripts/ai_painter_stage_mode_registry.py",
  trainer: "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
  compiler: "ml/ai-painter/scripts/compile_stage4_semantic_mixture_full_training_config.py",
  cpuChecker: "ml/ai-painter/scripts/check_stage4_semantic_mixture_full_training_modes_cpu.py",
  runner: FORMAL_RUNNER,
}
const ALL_ACTIONS = ["automatic_retry", "create_optimizer", "create_runtime_frame", "enter_world", "execute_backward", "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", "load_parent_denoiser", "mutate_model_weights", "promote_checkpoint", "run_formal_inference", "run_stage0", "run_stage1", "run_stage2", "run_strict_revalidation", "select_bound_sample", "write_diagnostic_checkpoint", "write_smoke_checkpoint"]

if (path.resolve(process.argv[1] ?? "") === path.resolve(SCRIPT_PATH)) {
  try {
    const args = parseArgs(process.argv.slice(2))
    const result = compileStage4Stage0To80ContinuationPlan({
      authorizationPath: required(args.authorization, "--authorization is required"),
      authorizationSha256: required(args.authorizationSha256, "--authorization-sha256 is required").toLowerCase(),
      consumptionPath: required(args.consumption, "--consumption is required"),
      consumptionSha256: required(args.consumptionSha256, "--consumption-sha256 is required").toLowerCase(),
      outputRoot: required(args.outputRoot, "--output-root is required"),
    })
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error(JSON.stringify({ status: "stage4_stage0_to_80_continuation_plan_compilation_failed_closed", errorCode: error?.code ?? "plan_compilation_failed", message: String(error?.message ?? error) }, null, 2))
    process.exitCode = 1
  }
}

export function compileStage4Stage0To80ContinuationPlan({ authorizationPath, authorizationSha256, consumptionPath, consumptionSha256, outputRoot }) {
  const tooling = verifyToolingAuthorization({ authorizationPath, authorizationSha256, consumptionPath, consumptionSha256, outputRoot })
  verifyBinding(QUALIFICATION, QUALIFICATION_SHA, "qualification")
  verifyBinding(CONFIG, CONFIG_SHA, "config")
  verifyBinding(IMPLEMENTATION_AUTH, IMPLEMENTATION_AUTH_SHA, "implementation_authorization")
  verifyBinding(IMPLEMENTATION_CONSUMPTION, IMPLEMENTATION_CONSUMPTION_SHA, "implementation_consumption")
  verifyBinding(DATASET, DATASET_SHA, "dataset")
  verifyBinding(AUTOENCODER, AUTOENCODER_SHA, "autoencoder")
  const qualification = readJson(QUALIFICATION)
  if (qualification.status !== "terminal_pass_with_late_convergence_evidence_qualified_closed" || qualification.stage0EntryPermitted !== true) fail("qualification_terminal_not_eligible")
  const normalizedOutputRoot = normalizeProjectPath(outputRoot)
  if (fs.existsSync(path.resolve(ROOT, normalizedOutputRoot))) fail("continuation_plan_output_exists")
  const runBase = path.basename(normalizedOutputRoot)
  const resolvedImplementationLineage = materializeResolvedImplementationLineage({
    outputRoot: tooling.authorization.execution.materializationOutputDirectory,
    runBase,
  })
  const plan = buildPlan(runBase, resolvedImplementationLineage)
  const audit = auditStage4Stage0To80ContinuationPlan(plan)
  const output = path.resolve(ROOT, normalizedOutputRoot)
  const planPath = path.join(output, "execution-plan.json")
  const cpuPath = path.join(output, "cpu-report.json")
  const requestPath = path.join(output, "owner-action-request.json")
  const terminalPath = path.join(output, "phase-terminal.json")
  const capsulePath = path.join(output, "local-task-capsule.json")
  const now = new Date().toISOString()
  writeJsonAtomic(planPath, plan)
  writeJsonAtomic(cpuPath, { schemaVersion: "ai-painter-stage4-stage0-to-80-continuation-plan-cpu-report-v1", status: "stage4_stage0_to_80_continuation_plan_cpu_passed", audit, sourceQualification: bind(QUALIFICATION), resolvedImplementationLineage, executionBoundary: { checkpointWeightsRead: false, ownerPrivateKeyRead: false, gpuStarted: false, trainingStarted: false }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
  writeJsonAtomic(requestPath, { schemaVersion: "ai-painter-owner-action-request-preview-v1", status: "ready_for_owner_offline_signature", requestedAction: "owner_offline_sign_stage0_stage1_stage2_continuation_once", executionPlan: bind(project(planPath)), contract: bind(CONTRACT), offlineSigner: bind("scripts/owner-offline/sign-ai-painter-stage4-stage0-to-80-continuation-package.mjs"), trustRegistry: bind("data/ai-painter/system-governance/project-owner-trust-registry-v1.json"), smokeRerunAuthorized: false, automaticRetry: false, executionStarted: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
  writeJsonAtomic(terminalPath, { schemaVersion: "ai-painter-stage4-stage0-to-80-continuation-plan-terminal-v1", status: "stage4_stage0_to_80_continuation_plan_ready_for_owner_signature_closed", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, executionPlan: bind(project(planPath)), cpuReport: bind(project(cpuPath)), ownerActionRequest: bind(project(requestPath)), qualificationTerminal: bind(QUALIFICATION), smokeRerunStarted: false, trainingStarted: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
  writeJsonAtomic(capsulePath, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter Stage4", currentStage: "Stage 0 to Stage 2 continuation awaiting one Owner offline signature", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, candidateTerminal: bind(project(terminalPath)), latestBlocker: "owner_offline_signature_required", nextLegalAction: "owner_offline_sign_then_execute_stage0_to_stage2_continuation", evidence: { qualification: bind(QUALIFICATION), plan: bind(project(planPath)), cpuReport: bind(project(cpuPath)) }, recordedAtUtc: now })
  for (const file of [planPath, cpuPath, requestPath, terminalPath, capsulePath]) index(file, runBase, "stage4_stage0_to_80_continuation_plan")
  appendAiPainterProgramEvent({ id: `stage4-stage0-to-80-continuation-plan-${runBase}`, timestamp: now, action: "stage4_compile_stage0_to_80_continuation_plan", runId: runBase, kind: "cpu_only_plan_compilation", status: "success", title: "Stage4 Stage0-to-80 continuation plan ready", titleZh: "Stage4 Stage 0至80%续跑计划已就绪", detailZh: "既有Smoke后期稳定资格已绑定；新计划仅包含Stage 0、Stage 1、Stage 2，未读取Checkpoint权重、未启动GPU或训练。", evidencePath: project(terminalPath), evidenceSha256: sha256File(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
  return { status: "stage4_stage0_to_80_continuation_plan_ready_for_owner_signature_closed", plan: bind(project(planPath)), cpuReport: bind(project(cpuPath)), ownerActionRequest: bind(project(requestPath)), terminal: bind(project(terminalPath)), capsule: bind(project(capsulePath)) }
}

function buildPlan(runBase, resolvedImplementationLineage) {
  const roles = ["stage0", "stage1", "stage2"]
  const qualification = bind(QUALIFICATION)
  const runner = bind(FORMAL_RUNNER)
  const sourceConfig = bind(CONFIG)
  const implementationAuthorization = resolvedImplementationLineage.authorization
  const implementationConsumption = resolvedImplementationLineage.consumption
  const dataset = bind(DATASET)
  const autoencoder = bind(AUTOENCODER)
  const code = Object.fromEntries(Object.entries(CODE).map(([key, value]) => [key, sha256File(path.resolve(ROOT, value))]))
  const steps = roles.map((role, stage) => {
    const runId = `${runBase}-${role}`
    const outputNamespace = `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${runId}`
    const previousRole = stage === 0 ? "late_stability_qualification" : roles[stage - 1]
    const previousStatus = stage === 0 ? "terminal_pass_with_late_convergence_evidence_qualified_closed" : "semantic_mixture_stage4_formal_stage_completed_closed"
    const actions = ["create_optimizer", "execute_backward", "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", ...(stage > 0 ? ["load_parent_denoiser"] : []), "mutate_model_weights", `run_stage${stage}`]
    const runnerAuthorization = {
      schemaVersion: "ai-painter-stage4-formal-stage-execution-authorization-v1",
      requestId: `owner-authorized-stage4-semantic-mixture-${role}-full-training-${runBase}`,
      commandRef: `owner-authorized-stage4-semantic-mixture-${role}-full-training-${runBase}`,
      scope: `one_stage4_semantic_mixture_stage${stage}_full_training_only`,
      status: "resolved_owner_authorized_not_consumed",
      executionActions: actions,
      bindings: { terminalQualification: qualification, sourceConfig, implementationAuthorization, implementationConsumption, dataset, autoencoder, code },
      taskIdentity: {
        architecture: "stage4_fact_conditioned_semantic_mixture_decoder_v1",
        trainingObjective: "stage4_object_reference_multiscale_two_lane_early_convergence_stabilization_v1",
        stage,
        resolution: [{ width: 256, height: 192 }, { width: 512, height: 384 }, { width: 1024, height: 768 }][stage],
        epochs: 40,
        previewEpochs: [1, 5, 10, 20, 30, 40],
        seed: 20263722,
        datasetCapacity: 64,
        splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 },
        initialization: stage === 0 ? "project_random_fact_conditioned_semantic_mixture" : `current_run_stage_${stage - 1}_checkpoint_only`,
        parentDenoiserCheckpoint: stage === 0 ? null : { path: "{{PREVIOUS_CHECKPOINT_PATH}}", sha256: "{{PREVIOUS_CHECKPOINT_SHA256}}" },
        outputNamespace,
      },
      explicitlyDenied: ALL_ACTIONS.filter((value) => !actions.includes(value)).sort(),
      oneTimeConsumptionRequired: true,
    }
    const baseArgs = ["--authorization", "{{RUNNER_AUTH_PATH}}", "--authorization-sha256", "{{RUNNER_AUTH_SHA256}}", "--run-id", runId, "--stage", String(stage)]
    if (stage > 0) baseArgs.push("--parent-checkpoint", "{{PREVIOUS_CHECKPOINT_PATH}}", "--parent-checkpoint-sha256", "{{PREVIOUS_CHECKPOINT_SHA256}}", "--parent-terminal", "{{PREVIOUS_TERMINAL_PATH}}", "--parent-terminal-sha256", "{{PREVIOUS_TERMINAL_SHA256}}")
    return {
      index: stage, role, stage, action: `ai_painter.stage4.run_formal_stage${stage}`, runId, previousRole,
      predecessor: { role: previousRole, requiredStatus: previousStatus }, runner, outputNamespace,
      progressPath: `${outputNamespace}/training-output/progress.json`,
      preflightArgs: [...baseArgs, "--preflight-only"], executeArgs: baseArgs,
      terminal: { path: `${outputNamespace}/finalization/phase-terminal.json`, requiredStatus: "semantic_mixture_stage4_formal_stage_completed_closed" },
      runtimeEvidenceTemplate: { schemaVersion: "ai-painter-stage4-continuation-runtime-evidence-template-v1", role, previousTerminal: { role: previousRole, path: "{{PREVIOUS_TERMINAL_PATH}}", sha256: "{{PREVIOUS_TERMINAL_SHA256}}", requiredStatus: previousStatus }, parentCheckpoint: stage === 0 ? null : { source: "previous_terminal.checkpoint", path: "{{PREVIOUS_CHECKPOINT_PATH}}", sha256: "{{PREVIOUS_CHECKPOINT_SHA256}}" } },
      runnerAuthorization,
    }
  })
  return {
    schemaVersion: "ai-painter-stage4-stage0-to-80-continuation-plan-v1",
    status: "ready_for_owner_signature",
    createdAtUtc: new Date().toISOString(),
    planCompilationRunId: runBase,
    validityHours: 168,
    baselineProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    targetProgress: { completedStages: 4, totalStages: 5, percent: 80 },
    contract: bind(CONTRACT),
    candidateIdentity: { candidateId: "stage4_object_reference_multiscale_early_convergence", status: "current_formal_candidate", config: bind(CONFIG), trainingObjectiveContractId: "stage4_object_reference_multiscale_two_lane_early_convergence_stabilization_v1" },
    qualificationTerminal: qualification,
    steps,
    executionBoundary: { ownerSignatureRequired: true, packageSigned: false, executionStarted: false, smokeRerunAuthorized: false, automaticRetry: false, stopAtFixedProgressPercent: 80, stage5Authorized: false, formalInferenceAuthorized: false, checkpointPromotionAuthorized: false, runtimeFrameAuthorized: false, worldEntryAuthorized: false },
  }
}

function verifyToolingAuthorization({ authorizationPath, authorizationSha256, consumptionPath, consumptionSha256, outputRoot }) {
  const authPath = normalizeProjectPath(authorizationPath)
  const consumedPath = normalizeProjectPath(consumptionPath)
  verifyBinding(authPath, authorizationSha256, "tooling_authorization")
  verifyBinding(consumedPath, consumptionSha256, "tooling_consumption")
  const auth = readJson(authPath)
  const consumption = readJson(consumedPath)
  if (auth.schemaVersion !== "ai-painter-owner-stage4-continuation-resolved-lineage-materialization-v1" || auth.status !== "owner_authorized_unconsumed" || auth.scope !== "cpu_only_materialize_resolved_implementation_lineage_and_compile_fresh_stage0_to_stage2_plan" || auth.execution?.continuationPlanOutputDirectory !== outputRoot) fail("tooling_authorization_identity_invalid")
  if (consumption.status !== "stage4_continuation_resolved_lineage_materialization_authorization_atomically_consumed" || consumption.requestId !== auth.requestId || consumption.commandRef !== auth.commandRef || consumption.scope !== auth.scope || consumption.authorizationPath !== authPath || consumption.authorizationSha256 !== authorizationSha256 || consumption.oneTimeConsumption !== true) fail("tooling_consumption_identity_invalid")
  return { authorization: auth, consumption }
}

function materializeResolvedImplementationLineage({ outputRoot, runBase }) {
  const normalizedRoot = normalizeProjectPath(outputRoot)
  const absoluteRoot = path.resolve(ROOT, normalizedRoot)
  if (fs.existsSync(absoluteRoot)) fail("resolved_implementation_lineage_output_exists")
  const sourceAuthorization = readJson(IMPLEMENTATION_AUTH)
  const sourceConsumption = readJson(IMPLEMENTATION_CONSUMPTION)
  if (
    sourceAuthorization.status !== "owner_authorized_unconsumed"
    || sourceAuthorization.requestId !== sourceAuthorization.commandRef
    || sourceConsumption.requestId !== sourceAuthorization.requestId
    || sourceConsumption.commandRef !== sourceAuthorization.commandRef
    || sourceConsumption.scope !== sourceAuthorization.scope
    || sourceConsumption.authorizationSha256 !== IMPLEMENTATION_AUTH_SHA
    || sourceConsumption.oneTimeConsumption !== true
  ) fail("raw_implementation_lineage_invalid")
  const now = new Date().toISOString()
  const authorizationPath = path.join(absoluteRoot, "resolved-implementation-authorization.json")
  const authorization = {
    schemaVersion: "ai-painter-stage4-resolved-implementation-authorization-v1",
    status: "resolved_owner_authorized_not_consumed",
    requestId: sourceAuthorization.requestId,
    commandRef: sourceAuthorization.commandRef,
    scope: sourceAuthorization.scope,
    sourceAuthorization: bind(IMPLEMENTATION_AUTH),
    sourceConsumption: bind(IMPLEMENTATION_CONSUMPTION),
    resolution: "raw_owner_authorization_and_atomic_consumption_verified",
    candidateId: "stage4_object_reference_multiscale_early_convergence",
    planCompilationRunId: runBase,
    resolvedAtUtc: now,
  }
  writeJsonAtomic(authorizationPath, authorization)
  const authorizationBinding = bind(project(authorizationPath))
  const consumptionPath = path.join(absoluteRoot, "resolved-implementation-consumption.json")
  const consumption = {
    schemaVersion: "ai-painter-stage4-resolved-implementation-consumption-v1",
    status: "resolved_implementation_lineage_consumption_verified",
    requestId: sourceAuthorization.requestId,
    commandRef: sourceAuthorization.commandRef,
    scope: sourceAuthorization.scope,
    authorizationPath: authorizationBinding.path,
    authorizationSha256: authorizationBinding.sha256,
    sourceAuthorization: bind(IMPLEMENTATION_AUTH),
    sourceConsumption: bind(IMPLEMENTATION_CONSUMPTION),
    oneTimeConsumption: true,
    candidateId: "stage4_object_reference_multiscale_early_convergence",
    planCompilationRunId: runBase,
    resolvedAtUtc: now,
  }
  writeJsonAtomic(consumptionPath, consumption)
  return { authorization: authorizationBinding, consumption: bind(project(consumptionPath)) }
}

function verifyBinding(value, expected, name) { const actual = sha256File(path.resolve(ROOT, normalizeProjectPath(value))); if (actual !== expected.toLowerCase()) fail(`${name}_sha256_mismatch`) }
function bind(value) { const normalized = normalizeProjectPath(value); return { path: normalized, sha256: sha256File(path.resolve(ROOT, normalized)) } }
function project(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function normalizeProjectPath(value) { const result = String(value).replaceAll("\\", "/"); if (path.isAbsolute(result) || result.startsWith("../") || result.includes("/../")) fail("project_path_invalid"); return result }
function readJson(value) { return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8")) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function index(file, runId, type) { const stat = fs.statSync(file); indexArtifact({ logicalPath: project(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, artifactType: type, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha256File(file) }) }
function required(value, message) { if (typeof value !== "string" || !value.trim()) fail(message); return value.trim() }
function fail(message) { const error = new Error(message); error.code = message; throw error }
function parseArgs(values) { const result = {}; for (let index = 0; index < values.length; index += 1) { const value = values[index]; if (!value.startsWith("--") || !values[index + 1]) fail(`unexpected_argument:${value}`); result[value.slice(2).replace(/-([a-z])/gu, (_, char) => char.toUpperCase())] = values[index + 1]; index += 1 } return result }
