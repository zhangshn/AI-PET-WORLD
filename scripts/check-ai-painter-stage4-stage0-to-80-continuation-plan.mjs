import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const ROLES = Object.freeze(["stage0", "stage1", "stage2"])
const RESOLUTIONS = Object.freeze([{ width: 256, height: 192 }, { width: 512, height: 384 }, { width: 1024, height: 768 }])
const RUNNER = "scripts/run-stage4-semantic-mixture-formal-stage.mjs"
const QUALIFICATION_STATUS = "terminal_pass_with_late_convergence_evidence_qualified_closed"
const STAGE_STATUS = "semantic_mixture_stage4_formal_stage_completed_closed"
const PLACEHOLDERS = new Set([
  "RUNNER_AUTH_PATH", "RUNNER_AUTH_SHA256", "PREVIOUS_TERMINAL_PATH",
  "PREVIOUS_TERMINAL_SHA256", "PREVIOUS_CHECKPOINT_PATH",
  "PREVIOUS_CHECKPOINT_SHA256", "QUALIFICATION_TERMINAL_PATH",
  "QUALIFICATION_TERMINAL_SHA256",
])

export function auditStage4Stage0To80ContinuationPlan(plan, { root = process.cwd(), verifyFiles = true } = {}) {
  const projectRoot = path.resolve(root)
  check(plan?.schemaVersion === "ai-painter-stage4-stage0-to-80-continuation-plan-v1", "plan_schema_invalid")
  check(plan?.status === "ready_for_owner_signature", "plan_status_invalid")
  check(plan?.baselineProgress?.completedStages === 3 && plan?.baselineProgress?.totalStages === 5 && plan?.baselineProgress?.percent === 60, "baseline_progress_invalid")
  check(plan?.targetProgress?.completedStages === 4 && plan?.targetProgress?.totalStages === 5 && plan?.targetProgress?.percent === 80, "target_progress_invalid")
  check(plan?.executionBoundary?.smokeRerunAuthorized === false && plan?.executionBoundary?.automaticRetry === false, "execution_boundary_invalid")
  check(plan?.candidateIdentity?.candidateId === "stage4_object_reference_multiscale_early_convergence", "candidate_identity_invalid")
  check(bindingValid(projectRoot, plan?.candidateIdentity?.config, verifyFiles), "candidate_config_invalid")
  check(bindingValid(projectRoot, plan?.qualificationTerminal, verifyFiles), "qualification_binding_invalid")
  if (verifyFiles) {
    const qualification = readJson(path.resolve(projectRoot, plan.qualificationTerminal.path))
    check(qualification?.status === QUALIFICATION_STATUS && qualification?.stage0EntryPermitted === true, "qualification_status_invalid")
  }
  check(Array.isArray(plan?.steps) && same(plan.steps.map((step) => step.role), ROLES), "step_order_invalid")
  check(new Set(plan.steps.map((step) => step.runId)).size === ROLES.length, "duplicate_run_id")
  check(new Set(plan.steps.map((step) => step.outputNamespace)).size === ROLES.length, "duplicate_output_namespace")
  for (const [index, step] of plan.steps.entries()) auditStep(projectRoot, plan, step, index, verifyFiles)
  return {
    status: "stage4_stage0_to_80_continuation_plan_audit_passed",
    positiveChecks: 26,
    stepOrder: ROLES,
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
  }
}

function auditStep(root, plan, step, index, verifyFiles) {
  const role = ROLES[index]
  const stage = index
  const previousRole = stage === 0 ? "late_stability_qualification" : ROLES[index - 1]
  const previousStatus = stage === 0 ? QUALIFICATION_STATUS : STAGE_STATUS
  check(step?.index === index && step?.role === role && step?.stage === stage, "step_identity_invalid")
  check(step?.action === `ai_painter.stage4.run_formal_stage${stage}`, "step_action_invalid")
  check(safeId(step?.runId) && !step.runId.includes("20260816040617434"), "run_id_invalid_or_reused")
  check(step?.previousRole === previousRole && step?.predecessor?.role === previousRole && step?.predecessor?.requiredStatus === previousStatus, "predecessor_invalid")
  check(step?.runner?.path === RUNNER && bindingValid(root, step.runner, verifyFiles), "runner_binding_invalid")
  check(step?.outputNamespace === `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${step.runId}`, "output_namespace_invalid")
  check(step?.terminal?.path === `${step.outputNamespace}/finalization/phase-terminal.json` && step?.terminal?.requiredStatus === STAGE_STATUS, "terminal_contract_invalid")
  check(step?.progressPath === `${step.outputNamespace}/training-output/progress.json`, "progress_path_invalid")
  if (verifyFiles) check(!fs.existsSync(path.resolve(root, step.outputNamespace)), "output_namespace_already_exists")
  check(step?.runtimeEvidenceTemplate?.role === role, "runtime_template_invalid")
  check(step?.runtimeEvidenceTemplate?.previousTerminal?.role === previousRole, "runtime_previous_role_invalid")
  check(step?.runtimeEvidenceTemplate?.previousTerminal?.requiredStatus === previousStatus, "runtime_previous_status_invalid")
  check(stage === 0 ? step.runtimeEvidenceTemplate.parentCheckpoint == null : step.runtimeEvidenceTemplate.parentCheckpoint?.source === "previous_terminal.checkpoint", "runtime_parent_checkpoint_invalid")
  check(argsValid(step.preflightArgs, step, true), "preflight_args_invalid")
  check(argsValid(step.executeArgs, step, false), "execute_args_invalid")
  auditRunnerAuthorization(root, plan, step, verifyFiles)
  assertPlaceholdersKnown(step)
}

function auditRunnerAuthorization(root, plan, step, verifyFiles) {
  const value = step?.runnerAuthorization
  const stage = step.stage
  const expectedActions = ["create_optimizer", "execute_backward", "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", ...(stage > 0 ? ["load_parent_denoiser"] : []), "mutate_model_weights", `run_stage${stage}`]
  check(value?.schemaVersion === "ai-painter-stage4-formal-stage-execution-authorization-v1", "runner_authorization_schema_invalid")
  check(value?.status === "resolved_owner_authorized_not_consumed", "runner_authorization_status_invalid")
  check(value?.scope === `one_stage4_semantic_mixture_stage${stage}_full_training_only`, "runner_authorization_scope_invalid")
  check(same(value?.executionActions, expectedActions), "runner_authorization_actions_invalid")
  check(value?.bindings?.terminalQualification?.path === plan.qualificationTerminal.path && value?.bindings?.terminalQualification?.sha256 === plan.qualificationTerminal.sha256, "runner_qualification_binding_invalid")
  for (const key of ["sourceConfig", "implementationAuthorization", "implementationConsumption", "dataset", "autoencoder"]) check(bindingValid(root, value?.bindings?.[key], verifyFiles), `runner_binding_${key}_invalid`)
  auditResolvedImplementationLineage(root, plan, value?.bindings?.implementationAuthorization, value?.bindings?.implementationConsumption, verifyFiles)
  check(value?.bindings?.sourceConfig?.path === plan.candidateIdentity.config.path && value?.bindings?.sourceConfig?.sha256 === plan.candidateIdentity.config.sha256, "runner_config_binding_invalid")
  check(value?.taskIdentity?.stage === stage && sameObject(value?.taskIdentity?.resolution, RESOLUTIONS[stage]), "runner_task_stage_invalid")
  check(value?.taskIdentity?.epochs === 40 && same(value?.taskIdentity?.previewEpochs, [1, 5, 10, 20, 30, 40]), "runner_epoch_contract_invalid")
  check(value?.taskIdentity?.seed === 20263722 && value?.taskIdentity?.datasetCapacity === 64 && sameObject(value?.taskIdentity?.splitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 }), "runner_dataset_contract_invalid")
  check(value?.taskIdentity?.outputNamespace === step.outputNamespace, "runner_output_binding_invalid")
  check(stage === 0 ? value?.taskIdentity?.parentDenoiserCheckpoint == null : value?.taskIdentity?.parentDenoiserCheckpoint?.path === "{{PREVIOUS_CHECKPOINT_PATH}}", "runner_parent_checkpoint_invalid")
  check(value?.oneTimeConsumptionRequired === true, "runner_consumption_invalid")
}

function auditResolvedImplementationLineage(root, plan, authorizationBinding, consumptionBinding, verifyFiles) {
  const lineageRoot = `.runtime/ai-painter/stage4-continuation-resolved-lineage-materializations/${plan.planCompilationRunId}`
  check(authorizationBinding?.path === `${lineageRoot}/resolved-implementation-authorization.json`, "resolved_implementation_authorization_path_invalid")
  check(consumptionBinding?.path === `${lineageRoot}/resolved-implementation-consumption.json`, "resolved_implementation_consumption_path_invalid")
  if (!verifyFiles) return
  const authorization = readJson(path.resolve(root, authorizationBinding.path))
  const consumption = readJson(path.resolve(root, consumptionBinding.path))
  auditResolvedImplementationLineageValues(root, plan, authorizationBinding, consumptionBinding, authorization, consumption)
}

function auditResolvedImplementationLineageValues(root, plan, authorizationBinding, consumptionBinding, authorization, consumption) {
  const authorizationFields = ["candidateId", "commandRef", "planCompilationRunId", "requestId", "resolution", "resolvedAtUtc", "schemaVersion", "scope", "sourceAuthorization", "sourceConsumption", "status"]
  const consumptionFields = ["authorizationPath", "authorizationSha256", "candidateId", "commandRef", "oneTimeConsumption", "planCompilationRunId", "requestId", "resolvedAtUtc", "schemaVersion", "scope", "sourceAuthorization", "sourceConsumption", "status"]
  check(same(Object.keys(authorization).sort(), authorizationFields), "resolved_implementation_authorization_fields_invalid")
  check(same(Object.keys(consumption).sort(), consumptionFields), "resolved_implementation_consumption_fields_invalid")
  check(authorization.schemaVersion === "ai-painter-stage4-resolved-implementation-authorization-v1" && authorization.status === "resolved_owner_authorized_not_consumed", "resolved_implementation_authorization_status_invalid")
  check(consumption.schemaVersion === "ai-painter-stage4-resolved-implementation-consumption-v1" && consumption.status === "resolved_implementation_lineage_consumption_verified", "resolved_implementation_consumption_status_invalid")
  check(authorization.requestId === authorization.commandRef && consumption.requestId === authorization.requestId && consumption.commandRef === authorization.commandRef && consumption.scope === authorization.scope, "resolved_implementation_identity_invalid")
  check(authorization.resolution === "raw_owner_authorization_and_atomic_consumption_verified", "resolved_implementation_resolution_invalid")
  check(authorization.candidateId === plan.candidateIdentity.candidateId && consumption.candidateId === plan.candidateIdentity.candidateId, "resolved_implementation_candidate_invalid")
  check(authorization.planCompilationRunId === plan.planCompilationRunId && consumption.planCompilationRunId === plan.planCompilationRunId, "resolved_implementation_run_id_invalid")
  check(consumption.authorizationPath === authorizationBinding.path && consumption.authorizationSha256 === authorizationBinding.sha256 && consumption.oneTimeConsumption === true, "resolved_implementation_consumption_binding_invalid")
  check(sameObject(authorization.sourceAuthorization, consumption.sourceAuthorization) && sameObject(authorization.sourceConsumption, consumption.sourceConsumption), "resolved_implementation_source_binding_mismatch")
  check(bindingValid(root, authorization.sourceAuthorization, true) && bindingValid(root, authorization.sourceConsumption, true), "resolved_implementation_source_binding_invalid")
  const sourceAuthorization = readJson(path.resolve(root, authorization.sourceAuthorization.path))
  const sourceConsumption = readJson(path.resolve(root, authorization.sourceConsumption.path))
  check(sourceAuthorization.schemaVersion === "ai-painter-owner-stage4-multiscale-reference-luminance-variation-preserving-mask-fallback-v1", "resolved_implementation_source_schema_invalid")
  check(sourceAuthorization.scope === "implement_cpu_audit_readonly_gpu_qualify_and_prepare_fresh_stage0_to_stage2_plan", "resolved_implementation_source_scope_invalid")
  check(sourceAuthorization.status === "owner_authorized_unconsumed" && sourceAuthorization.requestId === sourceAuthorization.commandRef, "resolved_implementation_source_authorization_invalid")
  check(sourceConsumption.status === "stage4_multiscale_reference_luminance_variation_preserving_mask_fallback_authorization_atomically_consumed", "resolved_implementation_source_consumption_status_invalid")
  check(sourceConsumption.requestId === sourceAuthorization.requestId && sourceConsumption.commandRef === sourceAuthorization.commandRef && sourceConsumption.scope === sourceAuthorization.scope, "resolved_implementation_source_identity_invalid")
  check(sourceConsumption.authorizationSha256 === authorization.sourceAuthorization.sha256 && sourceConsumption.oneTimeConsumption === true, "resolved_implementation_source_consumption_invalid")
  check(consumptionBinding.sha256 === sha256File(path.resolve(root, consumptionBinding.path)), "resolved_implementation_consumption_hash_invalid")
}

function argsValid(values, step, preflight) {
  if (!Array.isArray(values)) return false
  const expected = ["--authorization", "{{RUNNER_AUTH_PATH}}", "--authorization-sha256", "{{RUNNER_AUTH_SHA256}}", "--run-id", step.runId, "--stage", String(step.stage)]
  if (step.stage > 0) expected.push("--parent-checkpoint", "{{PREVIOUS_CHECKPOINT_PATH}}", "--parent-checkpoint-sha256", "{{PREVIOUS_CHECKPOINT_SHA256}}", "--parent-terminal", "{{PREVIOUS_TERMINAL_PATH}}", "--parent-terminal-sha256", "{{PREVIOUS_TERMINAL_SHA256}}")
  if (preflight) expected.push("--preflight-only")
  return same(values, expected)
}

function assertPlaceholdersKnown(value) {
  for (const match of JSON.stringify(value).matchAll(/\{\{([A-Z0-9_]+)\}\}/gu)) check(PLACEHOLDERS.has(match[1]), `unknown_placeholder_${match[1]}`)
}

function bindingValid(root, value, verifyFiles) {
  if (!value || typeof value.path !== "string" || !isSha256(value.sha256) || !safeProjectPath(value.path)) return false
  return !verifyFiles || (fs.existsSync(path.resolve(root, value.path)) && sha256File(path.resolve(root, value.path)) === value.sha256)
}
function safeProjectPath(value) { return !path.isAbsolute(value) && !value.startsWith("../") && !value.includes("/../") && !value.includes("\\") }
function safeId(value) { return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{7,159}$/u.test(value) }
function isSha256(value) { return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b) }
function sameObject(a, b) { return same(a, b) }
function check(value, code) { if (!value) { const error = new Error(code); error.code = code; throw error } }
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }

if (path.resolve(process.argv[1] ?? "") === path.resolve(SCRIPT_PATH)) {
  const index = process.argv.indexOf("--plan")
  assert.ok(index >= 0 && process.argv[index + 1], "--plan is required")
  const plan = readJson(path.resolve(process.cwd(), process.argv[index + 1]))
  const positive = auditStage4Stage0To80ContinuationPlan(plan)
  const negatives = {
    old_run_id_rejected: reject(plan, (p) => p.steps[0].runId = "20260816040617434-stage0"),
    role_order_rejected: reject(plan, (p) => [p.steps[0], p.steps[1]] = [p.steps[1], p.steps[0]]),
    duplicate_run_rejected: reject(plan, (p) => p.steps[1].runId = p.steps[0].runId),
    old_output_rejected: reject(plan, (p) => p.steps[0].outputNamespace = ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260816040617434-stage0"),
    wrong_qualification_rejected: reject(plan, (p) => p.qualificationTerminal.sha256 = "0".repeat(64)),
    wrong_config_rejected: reject(plan, (p) => p.candidateIdentity.config.sha256 = "0".repeat(64)),
    wrong_stage_rejected: reject(plan, (p) => p.steps[1].stage = 2),
    wrong_resolution_rejected: reject(plan, (p) => p.steps[2].runnerAuthorization.taskIdentity.resolution.width = 512),
    wrong_parent_rejected: reject(plan, (p) => p.steps[1].runtimeEvidenceTemplate.parentCheckpoint.source = "historical_checkpoint"),
    unknown_action_rejected: reject(plan, (p) => p.steps[0].runnerAuthorization.executionActions.push("run_smoke")),
    auto_retry_rejected: reject(plan, (p) => p.executionBoundary.automaticRetry = true),
    smoke_rerun_rejected: reject(plan, (p) => p.executionBoundary.smokeRerunAuthorized = true),
    output_reuse_rejected: reject(plan, (p) => p.steps[1].outputNamespace = p.steps[0].outputNamespace),
    unknown_placeholder_rejected: reject(plan, (p) => p.steps[1].executeArgs.push("{{HISTORICAL_CHECKPOINT}}")),
    historical_resolved_lineage_rejected: reject(plan, (p) => p.steps[0].runnerAuthorization.bindings.implementationAuthorization.path = ".runtime/ai-painter/stage4-continuation-resolved-lineage-materializations/historical/resolved-implementation-authorization.json"),
    cross_candidate_resolved_lineage_rejected: reject(plan, (p) => p.steps[1].runnerAuthorization.bindings.implementationConsumption.path = p.steps[0].runnerAuthorization.bindings.implementationAuthorization.path),
  }
  const resolvedAuthorizationBinding = plan.steps[0].runnerAuthorization.bindings.implementationAuthorization
  const resolvedConsumptionBinding = plan.steps[0].runnerAuthorization.bindings.implementationConsumption
  const resolvedAuthorization = readJson(path.resolve(process.cwd(), resolvedAuthorizationBinding.path))
  const resolvedConsumption = readJson(path.resolve(process.cwd(), resolvedConsumptionBinding.path))
  const lineageNegatives = {
    implementation_status_alias_rejected: rejectLineage(plan, resolvedAuthorizationBinding, resolvedConsumptionBinding, resolvedAuthorization, resolvedConsumption, (a) => a.status = "owner_authorized_unconsumed"),
    forged_source_hash_rejected: rejectLineage(plan, resolvedAuthorizationBinding, resolvedConsumptionBinding, resolvedAuthorization, resolvedConsumption, (a) => a.sourceAuthorization.sha256 = "0".repeat(64)),
    request_id_mismatch_rejected: rejectLineage(plan, resolvedAuthorizationBinding, resolvedConsumptionBinding, resolvedAuthorization, resolvedConsumption, (_a, c) => c.requestId = "forged-request-id"),
    cross_candidate_lineage_rejected: rejectLineage(plan, resolvedAuthorizationBinding, resolvedConsumptionBinding, resolvedAuthorization, resolvedConsumption, (a) => a.candidateId = "historical_candidate"),
    resolved_authorization_hash_mismatch_rejected: rejectLineage(plan, { ...resolvedAuthorizationBinding, sha256: "0".repeat(64) }, resolvedConsumptionBinding, resolvedAuthorization, resolvedConsumption, () => {}),
    one_time_consumption_false_rejected: rejectLineage(plan, resolvedAuthorizationBinding, resolvedConsumptionBinding, resolvedAuthorization, resolvedConsumption, (_a, c) => c.oneTimeConsumption = false),
    unknown_resolved_field_rejected: rejectLineage(plan, resolvedAuthorizationBinding, resolvedConsumptionBinding, resolvedAuthorization, resolvedConsumption, (a) => a.unknown = true),
  }
  assert.ok(Object.values(negatives).every(Boolean))
  assert.ok(Object.values(lineageNegatives).every(Boolean))
  console.log(JSON.stringify({ schemaVersion: "ai-painter-stage4-stage0-to-80-continuation-plan-cpu-report-v1", status: "stage4_stage0_to_80_continuation_plan_cpu_passed", positive, negative: { ...negatives, ...lineageNegatives }, positivePassed: 1, positiveTotal: 1, negativePassed: Object.values({ ...negatives, ...lineageNegatives }).filter(Boolean).length, negativeTotal: Object.keys({ ...negatives, ...lineageNegatives }).length, executionBoundary: { checkpointWeightsRead: false, ownerPrivateKeyRead: false, gpuStarted: false, trainingStarted: false } }, null, 2))
}

function reject(source, mutate) {
  const value = structuredClone(source)
  mutate(value)
  try { auditStage4Stage0To80ContinuationPlan(value, { verifyFiles: false }); return false } catch { return true }
}

function rejectLineage(plan, authorizationBinding, consumptionBinding, sourceAuthorization, sourceConsumption, mutate) {
  const authorization = structuredClone(sourceAuthorization)
  const consumption = structuredClone(sourceConsumption)
  mutate(authorization, consumption)
  try { auditResolvedImplementationLineageValues(process.cwd(), plan, authorizationBinding, consumptionBinding, authorization, consumption); return false } catch { return true }
}
