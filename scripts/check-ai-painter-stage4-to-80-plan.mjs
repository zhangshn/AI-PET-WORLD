import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { sha256File } from "../src/server/project-owner-delegated-authorization-package-core.mjs"

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const REQUIRED_ROLES = ["smoke", "late_stability_qualification", "stage0", "stage1", "stage2"]
const EXPECTED_RUNNERS = {
  smoke: "scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs",
  late_stability_qualification: "scripts/run-stage4-general-late-convergence-qualification.mjs",
  stage0: "scripts/run-stage4-semantic-mixture-formal-stage.mjs",
  stage1: "scripts/run-stage4-semantic-mixture-formal-stage.mjs",
  stage2: "scripts/run-stage4-semantic-mixture-formal-stage.mjs",
}
const EXPECTED_ACTIONS = {
  smoke: "ai_painter.stage4.run_model_smoke",
  late_stability_qualification: "ai_painter.stage4.qualify_bound_smoke_late_stability",
  stage0: "ai_painter.stage4.run_formal_stage0",
  stage1: "ai_painter.stage4.run_formal_stage1",
  stage2: "ai_painter.stage4.run_formal_stage2",
}
const EXPECTED_CANDIDATE_ID = "stage4_object_reference_multiscale_early_convergence"
const EXPECTED_TRAINING_OBJECTIVE = "stage4_object_reference_multiscale_two_lane_early_convergence_stabilization_v1"
const EXPECTED_CONFIG_SHA256 = "af6599b771b76aae4eac722c120a3d32dc1e23e1de92a1c0a26f051a82d11476"
const EXPECTED_SMOKE_CONFIG_SHA256 = "3526dfedb16dbf71d2c7619d389226d1a8896755a078d84aad959d935a655f4c"
const CURRENT_SMOKE_CONTRACT = ".runtime/ai-painter/stage4-lineage-corrected-smoke-contract-integrations/20260816-040617434/inactive-gpu-smoke-contract.json"
const CURRENT_REAL_PYTHON_PREFLIGHT = ".runtime/ai-painter/stage4-early-convergence-trainer-lineage-corrections/20260816-034516556/cpu-report.json"
const CURRENT_REAL_PYTHON_PREFLIGHT_SHA256 = "f7cd9f66716fc0ff6807b57774bff4fcbccb91d02e8ef397e601559430991a50"
const CURRENT_TRAINER_LINEAGE_CORRECTION = ".runtime/ai-painter/stage4-early-convergence-trainer-lineage-corrections/20260816-034516556/implementation-report.json"
const CURRENT_TRAINER_LINEAGE_CORRECTION_SHA256 = "7d8d8f5e992d92947c8aa6a8cc56328fdec26fa4348ef064713dccc53a5c90e1"
const SMOKE_ACTIONS = ["create_optimizer", "execute_backward", "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", "mutate_model_weights", "select_bound_sample", "write_smoke_checkpoint"]
const ALL_ACTIONS = ["automatic_retry", "create_optimizer", "create_runtime_frame", "enter_world", "execute_backward", "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", "load_parent_denoiser", "mutate_model_weights", "promote_checkpoint", "run_formal_inference", "run_stage0", "run_stage1", "run_stage2", "run_strict_revalidation", "select_bound_sample", "write_diagnostic_checkpoint", "write_smoke_checkpoint"]
const EXPECTED_SMOKE_DENIED = ALL_ACTIONS.filter((value) => !SMOKE_ACTIONS.includes(value)).sort()
const DIAGNOSTIC_FIELDS = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), CURRENT_SMOKE_CONTRACT), "utf8"))
  .proposedAuthorization.taskIdentity.diagnosticManifestFields

export class Stage4PlanAuditError extends Error {
  constructor(code) { super(code); this.code = code }
}

export function auditStage4To80Plan(plan, { root = process.cwd(), existingPaths = null } = {}) {
  const projectRoot = path.resolve(root)
  check(plan?.schemaVersion === "ai-painter-stage4-to-80-execution-plan-v1" && plan?.status === "ready_for_owner_signature", "plan_status_invalid")
  check(plan?.baselineProgress?.completedStages === 3 && plan?.baselineProgress?.totalStages === 5 && plan?.baselineProgress?.percent === 60, "plan_progress_invalid")
  check(plan?.candidateIdentity?.candidateId === EXPECTED_CANDIDATE_ID && plan?.candidateIdentity?.trainingObjectiveContractId === EXPECTED_TRAINING_OBJECTIVE, "candidate_identity_invalid")
  check(plan?.candidateIdentity?.configSha256 === EXPECTED_CONFIG_SHA256 && plan?.candidateIdentity?.smokeConfigSha256 === EXPECTED_SMOKE_CONFIG_SHA256, "candidate_config_invalid")
  check(fileBindingValid(projectRoot, { path: plan.candidateIdentity.configPath, sha256: plan.candidateIdentity.configSha256 }) && fileBindingValid(projectRoot, { path: plan.candidateIdentity.smokeConfigPath, sha256: plan.candidateIdentity.smokeConfigSha256 }), "candidate_config_binding_invalid")
  check(Object.values(plan.candidateIdentity.formalEvidenceChain ?? {}).every((binding) => fileBindingValid(projectRoot, binding)), "candidate_evidence_chain_invalid")
  check(same(plan.candidateIdentity.formalEvidenceChain?.realPythonReadonlyPreflight, { path: CURRENT_REAL_PYTHON_PREFLIGHT, sha256: CURRENT_REAL_PYTHON_PREFLIGHT_SHA256 }), "candidate_real_python_preflight_missing")
  check(same(plan.candidateIdentity.formalEvidenceChain?.trainerLineageCorrection, { path: CURRENT_TRAINER_LINEAGE_CORRECTION, sha256: CURRENT_TRAINER_LINEAGE_CORRECTION_SHA256 }), "candidate_trainer_lineage_correction_missing")
  const implementationLineage = resolveCurrentImplementationLineage(projectRoot, plan.candidateIdentity.formalEvidenceChain)
  check(Array.isArray(plan?.steps) && same(plan.steps.map((step) => step.role), REQUIRED_ROLES), "step_order_invalid")
  check(new Set(plan.steps.map((step) => step.runId)).size === REQUIRED_ROLES.length, "duplicate_run_id")
  const pathExists = (value) => existingPaths ? existingPaths.has(value) : fs.existsSync(path.resolve(projectRoot, value))
  for (const [index, step] of plan.steps.entries()) {
    const previousRole = index === 0 ? null : REQUIRED_ROLES[index - 1]
    check(step.index === undefined || step.index === index, "step_index_invalid")
    check(step.previousRole === previousRole, "predecessor_role_invalid")
    check(index === 0 ? step.predecessor === null : step.predecessor?.role === previousRole, "predecessor_contract_invalid")
    check(step.runner?.path === EXPECTED_RUNNERS[step.role] && fileBindingValid(projectRoot, step.runner), "runner_identity_invalid")
    check(step.action === undefined || step.action === EXPECTED_ACTIONS[step.role], "unknown_action")
    check(safeProjectPath(step.outputNamespace) && step.outputNamespace.startsWith(".runtime/ai-painter/") && path.posix.basename(step.outputNamespace) === step.runId, "output_namespace_invalid")
    check(!pathExists(step.outputNamespace), "reused_output_namespace")
    check(Array.isArray(step.preflightArgs) && Array.isArray(step.executeArgs), "argument_contract_invalid")
    check(!JSON.stringify([step.preflightArgs, step.executeArgs, step.runtimeEvidenceTemplate]).match(/\.pt|checkpoint-[a-f0-9]|2026081[0-5].*phase-terminal/iu), "historical_or_old_checkpoint_binding")
    auditRuntimeTemplate(step, previousRole)
    if (step.role === "smoke") {
      auditSmokeOuterPreflight(step)
      auditSmokeAuthorization(step.runnerAuthorization)
      check(same(step.runnerAuthorization.bindings?.inactiveConfig, { path: plan.candidateIdentity.smokeConfigPath, sha256: plan.candidateIdentity.smokeConfigSha256 }), "smoke_candidate_config_mismatch")
      check(same(step.runnerAuthorization.bindings?.implementationAuthorization, implementationLineage.implementationAuthorization), "smoke_implementation_authorization_lineage_mismatch")
      check(same(step.runnerAuthorization.bindings?.implementationConsumption, implementationLineage.implementationConsumption), "smoke_implementation_consumption_lineage_mismatch")
    }
    else if (step.role === "late_stability_qualification") auditQualificationAuthorization(step.runnerAuthorization, step.runner)
    else {
      auditStageAuthorization(step.runnerAuthorization, Number(step.role.at(-1)))
      check(same(step.runnerAuthorization.bindings?.sourceConfig, { path: plan.candidateIdentity.configPath, sha256: plan.candidateIdentity.configSha256 }), "stage_candidate_config_mismatch")
    }
  }
  return { status: "stage4_exact_five_step_plan_audit_passed", positiveChecks: 24, stepOrder: REQUIRED_ROLES, checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false }
}

export function runStage4To80PlanRegression(validPlan, { root = process.cwd() } = {}) {
  auditStage4To80Plan(validPlan, { root })
  const cases = [
    ["wrong_step_order", (p) => [p.steps[0], p.steps[2], p.steps[1], ...p.steps.slice(3)].forEach((step, index) => { p.steps[index] = step })],
    ["duplicate_run_id", (p) => { p.steps[2].runId = p.steps[1].runId }],
    ["unknown_action", (p) => { p.steps[0].action = "unknown.action" }],
    ["forged_sha256", (p) => { p.steps[0].runner.sha256 = "0".repeat(64) }],
    ["historical_run_binding", (p) => { p.steps[2].runtimeEvidenceTemplate.previousTerminal.path = ".runtime/ai-painter/history/phase-terminal.json" }],
    ["old_checkpoint_binding", (p) => { p.steps[3].executeArgs.push(".runtime/ai-painter/history/old.pt") }],
    ["cross_package_evidence", (p) => { p.steps[3].runtimeEvidenceTemplate.parentCheckpoint.path = ".runtime/ai-painter/other-package/stage0.pt" }],
    ["unknown_smoke_execution_action", (p) => { p.steps[0].runnerAuthorization.executionActions.push("run_stage5") }],
    ["stale_candidate_identity", (p) => { p.candidateIdentity.candidateId = "stage4_fact_conditioned_semantic_mixture_decoder_v1_with_per_class_final_visible_rgb_obligation_v1" }],
    ["stale_candidate_config", (p) => { p.candidateIdentity.configSha256 = "ff0a4077a9b92a08b4582d38e5d41f6cbf539a6abf1848f10e10b9506acf1788" }],
    ["smoke_cross_candidate_config", (p) => { p.steps[0].runnerAuthorization.bindings.inactiveConfig = { path: p.candidateIdentity.configPath, sha256: p.candidateIdentity.configSha256 } }],
    ["stage_cross_candidate_config", (p) => { p.steps[2].runnerAuthorization.bindings.sourceConfig = { path: p.candidateIdentity.smokeConfigPath, sha256: p.candidateIdentity.smokeConfigSha256 } }],
    ["historical_authorization_binding", (p) => { p.steps[0].runnerAuthorization.bindings.implementationAuthorization.path = ".runtime/ai-painter/owner-action-requests/history/authorization.json" }],
    ["forged_authorization_sha256", (p) => { p.steps[0].runnerAuthorization.bindings.implementationAuthorization.sha256 = "0".repeat(64) }],
    ["historical_consumption_binding", (p) => { p.steps[0].runnerAuthorization.bindings.implementationConsumption.path = ".runtime/ai-painter/owner-action-requests/history/consumption.json" }],
    ["forged_consumption_sha256", (p) => { p.steps[0].runnerAuthorization.bindings.implementationConsumption.sha256 = "0".repeat(64) }],
    ["cross_candidate_implementation_lineage", (p) => { p.steps[0].runnerAuthorization.bindings.implementationAuthorization = structuredClone(p.candidateIdentity.formalEvidenceChain.cpuTerminal) }],
    ["missing_real_python_preflight_evidence", (p) => { delete p.candidateIdentity.formalEvidenceChain.realPythonReadonlyPreflight }],
    ["missing_trainer_lineage_correction_evidence", (p) => { delete p.candidateIdentity.formalEvidenceChain.trainerLineageCorrection }],
    ["old_smoke_contract_lineage", (p) => { p.candidateIdentity.formalEvidenceChain.smokeContract = { path: ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-smoke-entry-integrations/20260816-032403029/inactive-gpu-smoke-contract.json", sha256: "428aa5d05134ac12c189299b582368910aa4e0b1b237104ccf9538894db2a0c6" } }],
    ["smoke_outer_preflight_without_cpu_contract", (p) => { p.steps[0].preflightArgs = p.steps[0].preflightArgs.filter((value) => value !== "--cpu-contract-only") }],
    ["smoke_preflight_report_outside_formal_namespace", (p) => { p.steps[0].runnerAuthorization.execution.preflightReportPath = ".runtime/ai-painter/unrelated/preflight-report.json" }],
    ["output_namespace_path_escape", (p) => { p.steps[0].outputNamespace = `.runtime/ai-painter/../escape/${p.steps[0].runId}` }],
  ]
  for (const [label, mutate] of cases) {
    const draft = structuredClone(validPlan); mutate(draft)
    expectReject(() => auditStage4To80Plan(draft, { root }), label)
  }
  const reused = new Set([validPlan.steps[0].outputNamespace])
  expectReject(() => auditStage4To80Plan(validPlan, { root, existingPaths: reused }), "reused_output_namespace")
  return { status: "stage4_exact_five_step_plan_regression_passed", positivePassed: 1, positiveTotal: 1, negativePassed: 23, negativeTotal: 23 }
}

function auditSmokeOuterPreflight(step) {
  const baseArgs = [
    "--stage4-fact-conditioned-semantic-mixture-model-smoke",
    "--gpu-authorization",
    "{{RUNNER_AUTH_PATH}}",
    "--gpu-authorization-sha256",
    "{{RUNNER_AUTH_SHA256}}",
  ]
  check(same(step.preflightArgs, [...baseArgs, "--preflight-only", "--cpu-contract-only"]), "smoke_outer_preflight_not_cpu_contract_only")
  check(same(step.executeArgs, baseArgs), "smoke_execution_arguments_invalid")
  check(step.runnerAuthorization?.execution?.preflightReportPath === `${step.outputNamespace}/preflight-report.json`, "smoke_preflight_report_namespace_invalid")
}

function auditRuntimeTemplate(step, previousRole) {
  const value = step.runtimeEvidenceTemplate
  check(value?.schemaVersion === "ai-painter-stage4-continuous-runtime-evidence-template-v1" && value.role === step.role, "runtime_template_invalid")
  if (!previousRole) check(value.previousTerminal === null, "smoke_historical_binding_forbidden")
  else check(value.previousTerminal?.role === previousRole && value.previousTerminal?.path === "{{PREVIOUS_TERMINAL_PATH}}" && value.previousTerminal?.sha256 === "{{PREVIOUS_TERMINAL_SHA256}}" && value.previousTerminal?.requiredStatus === step.predecessor.requiredStatus, "previous_terminal_template_invalid")
  if (step.role === "stage1" || step.role === "stage2") check(value.parentCheckpoint?.source === "previous_terminal.checkpoint" && value.parentCheckpoint?.path === "{{PREVIOUS_CHECKPOINT_PATH}}" && value.parentCheckpoint?.sha256 === "{{PREVIOUS_CHECKPOINT_SHA256}}", "parent_checkpoint_template_invalid")
  else check(value.parentCheckpoint === null, "parent_checkpoint_forbidden")
}

function auditSmokeAuthorization(value) {
  check(value?.schemaVersion === "ai-painter-stage4-fact-conditioned-semantic-mixture-smoke-execution-authorization-v1" && value.status === "resolved_owner_authorized_not_consumed" && value.requestId === value.commandRef && /^owner-authorized-stage4-object-reference-multiscale-early-convergence-30-epoch-model-smoke-[0-9-]+$/u.test(value.requestId), "smoke_authorization_identity_invalid")
  check(same([...value.executionActions].sort(), [...SMOKE_ACTIONS].sort()) && same([...value.explicitlyDeniedActions].sort(), EXPECTED_SMOKE_DENIED), "smoke_action_set_invalid")
  check(value.taskIdentity?.trainingObjectiveContractId === EXPECTED_TRAINING_OBJECTIVE && value.taskIdentity?.sampleSplit === "validation" && value.taskIdentity?.seed === 20263722 && same(value.taskIdentity?.resolution, { width: 256, height: 192 }) && value.taskIdentity?.epochCount === 30 && same(value.taskIdentity?.previewEpochs, [1,5,10,20,30]) && same(value.taskIdentity?.diagnosticManifestFields, DIAGNOSTIC_FIELDS), "smoke_task_identity_invalid")
  check(value.taskIdentity.oldDenoiserCheckpointReadAuthorized === false && value.taskIdentity.diagnosticCheckpointReadAuthorized === false, "old_checkpoint_authorized")
}

function auditQualificationAuthorization(value, runner) {
  check(value?.schemaVersion === "ai-painter-owner-implementation-authorization-v1" && value.status === "resolved_owner_authorized_not_consumed" && value.requestId === value.commandRef, "qualification_authorization_identity_invalid")
  for (const [name, prefix] of [["terminal","SMOKE_TERMINAL"],["finalization","SMOKE_FINALIZATION"],["manifest","SMOKE_MANIFEST"],["review","SMOKE_REVIEW"]]) check(value.sourceEvidence?.[name]?.path === `{{${prefix}_PATH}}` && value.sourceEvidence?.[name]?.sha256 === `{{${prefix}_SHA256}}`, "qualification_historical_binding")
  check(value.runner?.path === runner.path && value.runner?.sha256 === runner.sha256, "qualification_runner_invalid")
}

function auditStageAuthorization(value, stage) {
  check(value?.status === "resolved_owner_authorized_not_consumed" && value.requestId === value.commandRef && value.scope === `one_stage4_semantic_mixture_stage${stage}_full_training_only`, "stage_authorization_identity_invalid")
  const expected = ["create_optimizer", "execute_backward", "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", ...(stage > 0 ? ["load_parent_denoiser"] : []), "mutate_model_weights", `run_stage${stage}`].sort()
  check(same(value.executionActions, expected), "stage_action_set_invalid")
  check(value.bindings?.terminalQualification?.path === "{{QUALIFICATION_TERMINAL_PATH}}" && value.bindings?.terminalQualification?.sha256 === "{{QUALIFICATION_TERMINAL_SHA256}}", "stage_qualification_template_invalid")
}

function fileBindingValid(root, binding) {
  if (!binding?.path || !/^[a-f0-9]{64}$/u.test(binding?.sha256 ?? "")) return false
  const absolute = path.resolve(root, binding.path)
  return fs.existsSync(absolute) && sha256File(absolute) === binding.sha256
}
function resolveCurrentImplementationLineage(root, formalEvidenceChain) {
  const correctionBinding = formalEvidenceChain?.trainerLineageCorrection
  check(fileBindingValid(root, correctionBinding), "candidate_trainer_lineage_correction_binding_invalid")
  const correction = JSON.parse(fs.readFileSync(path.resolve(root, correctionBinding.path), "utf8"))
  check(correction.status === "stage4_early_convergence_trainer_lineage_correction_cpu_succeeded", "candidate_trainer_lineage_correction_status_invalid")
  const implementationAuthorization = correction.authorization
  const implementationConsumption = correction.consumption
  check(fileBindingValid(root, implementationAuthorization), "candidate_implementation_authorization_lineage_invalid")
  check(fileBindingValid(root, implementationConsumption), "candidate_implementation_consumption_lineage_invalid")
  const smokeContractBinding = formalEvidenceChain?.smokeContract
  check(fileBindingValid(root, smokeContractBinding), "candidate_smoke_contract_binding_invalid")
  check(smokeContractBinding.path === CURRENT_SMOKE_CONTRACT, "candidate_smoke_contract_not_current")
  const smokeContract = JSON.parse(fs.readFileSync(path.resolve(root, smokeContractBinding.path), "utf8"))
  check(same(smokeContract.proposedAuthorization?.bindings?.implementationAuthorization, implementationAuthorization), "candidate_smoke_contract_implementation_authorization_lineage_mismatch")
  check(same(smokeContract.proposedAuthorization?.bindings?.implementationConsumption, implementationConsumption), "candidate_smoke_contract_implementation_consumption_lineage_mismatch")
  return { implementationAuthorization, implementationConsumption }
}
function safeProjectPath(value) {
  if (typeof value !== "string" || value.includes("\\") || path.isAbsolute(value)) return false
  const parts = value.split("/")
  return parts.every((part) => part !== "" && part !== "." && part !== "..") && path.posix.normalize(value) === value
}
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b) }
function check(value, code) { if (!value) throw new Stage4PlanAuditError(code) }
function expectReject(callback, label) { try { callback() } catch { return true } throw new Stage4PlanAuditError(`negative_case_not_rejected:${label}`) }

if (path.resolve(process.argv[1] ?? "") === path.resolve(SCRIPT_PATH)) {
  const planIndex = process.argv.indexOf("--plan")
  if (planIndex < 0 || !process.argv[planIndex + 1]) throw new Error("--plan is required")
  const plan = JSON.parse(fs.readFileSync(path.resolve(process.argv[planIndex + 1]), "utf8"))
  console.log(JSON.stringify({ ...auditStage4To80Plan(plan), regression: runStage4To80PlanRegression(plan) }, null, 2))
}
