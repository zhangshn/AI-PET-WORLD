import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { adjudicateConditionFusionStage0FinalRoute, CAPACITY_ARM } from "./lib/ai-painter-stage4-condition-fusion-stage0-final-route-adjudication.mjs"
import { auditStage4Stage0To80ContinuationPlan } from "./check-ai-painter-stage4-stage0-to-80-continuation-plan.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const CONTRACT = "data/ai-painter/system-governance/stage4-stage0-to-80-continuation-authorization-contract-v1.json"
const DATASET = "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
const AUTOENCODER = ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt"
const RUNNER = "scripts/run-stage4-semantic-mixture-formal-stage.mjs"
const CANDIDATE = "stage4_capacity_only_base_width_64_to_existing_level1_128"
const ROLES = ["stage0", "stage1", "stage2"]
const RESOLUTIONS = [{ width: 256, height: 192 }, { width: 512, height: 384 }, { width: 1024, height: 768 }]
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const projectFile = (value) => { assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`); return target }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const rel = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: rel(value), sha256: sha(value) })
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const freshJson = (target, body) => { fs.mkdirSync(path.dirname(target), { recursive: true }); const handle = fs.openSync(target, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }

const authorizationArg = arg("--authorization")
const authorizationSha256 = arg("--authorization-sha256")
const consumptionArg = arg("--consumption")
assert.ok(authorizationArg && authorizationSha256 && consumptionArg, "authorization_arguments_required")
const authorizationPath = projectFile(authorizationArg)
const consumptionPath = projectFile(consumptionArg)
assert.equal(sha(authorizationPath), authorizationSha256, "authorization_sha256_mismatch")
const authorization = read(authorizationPath)
assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-condition-fusion-stage0-final-route-and-capacity-continuation-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "cpu_readonly_condition_fusion_stage0_final_route_adjudication_capacity_formal_activation_and_unsigned_continuation_plan_compilation")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.gpuAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
assert.equal(authorization.ownerPrivateKeyReadAuthorized, false)
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")
for (const [name, evidence] of Object.entries(authorization.sourceEvidence)) {
  const target = projectFile(evidence.path); assert.equal(fs.existsSync(target), true, `${name}_missing`); assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`); assert.equal(/\.pt$/iu.test(evidence.path), false, `${name}_checkpoint_weight_read_forbidden`)
}
const programs = {
  runner: projectFile("scripts/run-stage4-condition-fusion-stage0-final-route.mjs"),
  checker: projectFile("scripts/check-stage4-condition-fusion-stage0-final-route-adjudication.mjs"),
  decisionLibrary: projectFile("scripts/lib/ai-painter-stage4-condition-fusion-stage0-final-route-adjudication.mjs"),
  continuationAuditor: projectFile("scripts/check-ai-painter-stage4-stage0-to-80-continuation-plan.mjs"),
}
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])), "program_lineage_mismatch")
const output = projectFile(authorization.outputNamespace)
const planRoot = projectFile(authorization.planCompilationNamespace)
assert.equal(fs.existsSync(output), false, "output_namespace_already_exists")
assert.equal(fs.existsSync(planRoot), false, "plan_namespace_already_exists")

const cpu = spawnSync(process.execPath, [programs.checker], { cwd: ROOT, encoding: "utf8" })
assert.equal(cpu.status, 0, `causal_cpu_regression_failed:${cpu.stderr}`)
const causalCpu = JSON.parse(cpu.stdout)
assert.equal(causalCpu.positivePassed, causalCpu.positiveTotal)
assert.equal(causalCpu.negativePassed, causalCpu.negativeTotal)

const consumedAtUtc = new Date().toISOString()
freshJson(consumptionPath, {
  schemaVersion: "stage4-condition-fusion-stage0-final-route-consumption-v1",
  status: "stage4_condition_fusion_stage0_final_route_authorization_atomically_consumed",
  requestId: authorization.requestId, commandRef: authorization.commandRef, scope: authorization.scope,
  authorizationPath: authorizationArg, authorizationSha256, oneTimeConsumption: true,
  consumedAtUtc, consumedAtAsiaShanghai: formatShanghai(consumedAtUtc),
})

const e = authorization.sourceEvidence
const terminal = read(projectFile(e.stage0Terminal.path))
const manifest = read(projectFile(e.stage0Manifest.path))
const review = read(projectFile(e.stage0Review.path))
const activeConfig = read(projectFile(e.activeConfig.path))
const failedCheckpointIdentity = { path: terminal.checkpoint.path, sha256: terminal.checkpoint.sha256 }
assert.equal(failedCheckpointIdentity.sha256, "6c291777f304b2f92a2f2e40d124d97996dc76d4329ab319cee4090f4af747e3")
const decision = adjudicateConditionFusionStage0FinalRoute({
  terminal, manifest, review, activeConfig, failedCheckpointIdentity,
  resourceTelemetry: read(projectFile(e.stage0Telemetry.path)),
  crossArmTerminal: read(projectFile(e.crossArmTerminal.path)),
  crossArmReport: read(projectFile(e.crossArmReport.path)),
  crossArmDecision: read(projectFile(e.crossArmDecision.path)),
  formalCpuReport: read(projectFile(e.formalCpuReport.path)),
  capacityQualification: read(projectFile(e.capacityQualification.path)),
  directExecutionWiringDefectEvidence: false,
  directCheckpointCausalDefectEvidence: false,
})
assert.equal(decision.selectedCause, "C")
assert.equal(decision.resolution.remainingArm, CAPACITY_ARM)

fs.mkdirSync(output, { recursive: true })
const now = new Date().toISOString()
const files = {
  problem: path.join(output, "problem-report.json"), analysis: path.join(output, "causal-analysis-report.json"),
  decision: path.join(output, "adjudication.json"), exit: path.join(output, "condition-fusion-route-exit.json"),
  cpu: path.join(output, "cpu-report.json"), postmortem: path.join(output, "repeated-step-scoped-offline-signing-and-non-closed-loop-planning-postmortem.json"),
  terminal: path.join(output, "phase-terminal.json"), capsule: path.join(output, "local-task-capsule.json"), planSync: path.join(output, "plan-sync-record.json"),
}
writeJsonAtomic(files.problem, {
  schemaVersion: "stage4-condition-fusion-stage0-problem-report-v1", status: "problem_confirmed",
  facts: { epochsCompleted: 40, optimizerStepsCompleted: 5760, modelWeightsChanged: true, fixedReviewsPassed: 0, fixedReviewsTotal: 6, stage1Started: false, stage2Started: false, failedCheckpointWeightsRead: false },
  terminal: e.stage0Terminal, manifest: e.stage0Manifest, review: e.stage0Review, activeConfig: e.activeConfig,
  recordedAtUtc: now,
})
writeJsonAtomic(files.analysis, { ...decision, sourceEvidence: e, recordedAtUtc: now })
writeJsonAtomic(files.decision, { schemaVersion: "stage4-condition-fusion-stage0-final-route-decision-v1", ...decision, recordedAtUtc: now })
writeJsonAtomic(files.exit, {
  schemaVersion: "stage4-condition-fusion-route-exit-v1", status: "condition_fusion_route_exited_closed",
  exitedArm: "condition_fusion_only_final_direct_residual_23_64_12", rerunAllowed: false,
  remainingUniqueArm: CAPACITY_ARM, newLossAllowed: false, fourthArmAllowed: false,
  failedCheckpointWeightsRead: false, failedCheckpointReuseAllowed: false, sourceDecision: bind(files.decision), recordedAtUtc: now,
})
writeJsonAtomic(files.cpu, { ...causalCpu, status: "stage4_condition_fusion_stage0_final_route_cpu_passed", authorization: bind(authorizationPath), consumption: bind(consumptionPath), selectedCause: "C", checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now })

const historicRoots = [".runtime/ai-painter/stage4-continuous-executions", ".runtime/ai-painter/stage4-stage0-to-80-continuation-executions"]
const historical = historicRoots.flatMap((root) => fs.readdirSync(projectFile(root), { withFileTypes: true }).filter((item) => item.isDirectory()).map((item) => path.join(projectFile(root), item.name, "execution-state.json")).filter(fs.existsSync).map((target) => ({ ...bind(target), status: read(target).status })))
assert.equal(historical.length, 10, "ten_historical_packages_required")
assert.equal(historical.every((item) => /_failed_closed$/u.test(item.status)), true, "historical_package_not_failed_closed")
writeJsonAtomic(files.postmortem, {
  schemaVersion: "repeated_step_scoped_offline_signing_and_non_closed_loop_planning_postmortem_v1", status: "governance_correction_recorded",
  historicalPackages: historical, historicalPackageCount: 10,
  directCause: "Single-step or stale-candidate packages were repeatedly compiled before route, stages, stop conditions, and future evidence materialization were fully closed.",
  correction: [
    "All ten historical continuous or continuation packages remain failed_closed governance history only.",
    "The earlier statement that one more signature would directly reach 80 percent was not sufficiently rigorous.",
    "Owner signature may be requested only after route, all stages, stop conditions, and future evidence materialization are fixed.",
    "A consumed, failed-closed, or stale-evidence package must never be requested or consumed again.",
  ], recordedAtUtc: now,
})

const lineageRoot = projectFile(`.runtime/ai-painter/stage4-continuation-resolved-lineage-materializations/${authorization.runId}`)
assert.equal(fs.existsSync(lineageRoot), false, "resolved_lineage_namespace_already_exists")
fs.mkdirSync(lineageRoot, { recursive: true })
const resolvedAuthPath = path.join(lineageRoot, "resolved-implementation-authorization.json")
const resolvedConsumptionPath = path.join(lineageRoot, "resolved-implementation-consumption.json")
const sourceAuthorization = bind(authorizationPath)
const sourceConsumption = bind(consumptionPath)
const resolvedAtUtc = new Date().toISOString()
freshJson(resolvedAuthPath, {
  candidateId: CANDIDATE, commandRef: authorization.commandRef, planCompilationRunId: authorization.runId,
  requestId: authorization.requestId, resolution: "raw_owner_authorization_and_atomic_consumption_verified", resolvedAtUtc,
  schemaVersion: "ai-painter-stage4-resolved-implementation-authorization-v1", scope: authorization.scope,
  sourceAuthorization, sourceConsumption, status: "resolved_owner_authorized_not_consumed",
})
freshJson(resolvedConsumptionPath, {
  authorizationPath: rel(resolvedAuthPath), authorizationSha256: sha(resolvedAuthPath), candidateId: CANDIDATE,
  commandRef: authorization.commandRef, oneTimeConsumption: true, planCompilationRunId: authorization.runId,
  requestId: authorization.requestId, resolvedAtUtc, schemaVersion: "ai-painter-stage4-resolved-implementation-consumption-v1",
  scope: authorization.scope, sourceAuthorization, sourceConsumption, status: "resolved_implementation_lineage_consumption_verified",
})
const formalFixtureRoot = path.join(output, "formal-stage-implementation-lineage")
fs.mkdirSync(formalFixtureRoot, { recursive: true })
const formalFixtureAuthorization = path.join(formalFixtureRoot, "implementation-authorization.json")
const formalFixtureConsumption = path.join(formalFixtureRoot, "implementation-consumption.json")
freshJson(formalFixtureAuthorization, read(resolvedAuthPath))
freshJson(formalFixtureConsumption, {
  ...read(resolvedConsumptionPath),
  authorizationPath: rel(formalFixtureAuthorization),
  authorizationSha256: sha(formalFixtureAuthorization),
})
const formalCpuRoot = `${authorization.outputNamespace}/formal-stage-mode-cpu-regressions`
const formalCpuRunId = `${authorization.runId}-capacity`
const formalCpuProcess = spawnSync(projectFile("ml/ai-painter/.venv/Scripts/python.exe"), [
  "ml/ai-painter/scripts/check_stage4_semantic_mixture_full_training_modes_cpu.py", formalCpuRunId,
  "--source", e.capacityConfig.path,
  "--output-root", formalCpuRoot,
  "--implementation-root", rel(formalFixtureRoot),
], { cwd: ROOT, encoding: "utf8" })
assert.equal(formalCpuProcess.status, 0, `capacity_formal_cpu_regression_failed:${formalCpuProcess.stderr}`)
const capacityFormalCpu = JSON.parse(formalCpuProcess.stdout)
assert.equal(capacityFormalCpu.status, "passed_stage4_semantic_mixture_formal_stage_modes_cpu_regression")
assert.equal(capacityFormalCpu.positivePassed, capacityFormalCpu.positiveTotal)
assert.equal(capacityFormalCpu.negativePassed, capacityFormalCpu.negativeTotal)

const configBinding = e.capacityConfig
const qualificationBinding = e.capacityQualification
const routeBinding = bind(files.decision)
const crossBinding = e.crossArmDecision
const implementationAuthorization = bind(resolvedAuthPath)
const implementationConsumption = bind(resolvedConsumptionPath)
const dataset = bind(projectFile(DATASET))
const autoencoder = bind(projectFile(AUTOENCODER))
const code = {
  authorizationPolicy: sha(projectFile("ml/ai-painter/scripts/ai_painter_authorization_policy.py")),
  modeRegistry: sha(projectFile("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")),
  trainer: sha(projectFile("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")),
  compiler: sha(projectFile("ml/ai-painter/scripts/compile_stage4_semantic_mixture_full_training_config.py")),
  cpuChecker: sha(projectFile("ml/ai-painter/scripts/check_stage4_semantic_mixture_full_training_modes_cpu.py")),
  runner: sha(projectFile(RUNNER)),
}
const makeArgs = (runId, stage, preflight) => {
  const values = ["--authorization", "{{RUNNER_AUTH_PATH}}", "--authorization-sha256", "{{RUNNER_AUTH_SHA256}}", "--run-id", runId, "--stage", String(stage)]
  if (stage > 0) values.push("--parent-checkpoint", "{{PREVIOUS_CHECKPOINT_PATH}}", "--parent-checkpoint-sha256", "{{PREVIOUS_CHECKPOINT_SHA256}}", "--parent-terminal", "{{PREVIOUS_TERMINAL_PATH}}", "--parent-terminal-sha256", "{{PREVIOUS_TERMINAL_SHA256}}")
  if (preflight) values.push("--preflight-only")
  return values
}
const steps = ROLES.map((role, stage) => {
  const runId = `${authorization.runId}-capacity-${role}`
  const outputNamespace = `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${runId}`
  assert.equal(fs.existsSync(projectFile(outputNamespace)), false, `future_${role}_output_exists`)
  const previousRole = stage === 0 ? "late_stability_qualification" : ROLES[stage - 1]
  const previousStatus = stage === 0 ? "terminal_pass_with_late_convergence_evidence_qualified_closed" : "semantic_mixture_stage4_formal_stage_completed_closed"
  const executionActions = ["create_optimizer", "execute_backward", "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", ...(stage > 0 ? ["load_parent_denoiser"] : []), "mutate_model_weights", `run_stage${stage}`]
  const denied = ["automatic_retry", "create_runtime_frame", "enter_world", "promote_checkpoint", "run_formal_inference", ...ROLES.filter((_, index) => index !== stage).map((_, index) => `run_stage${index >= stage ? index + 1 : index}`), "run_strict_revalidation", "select_bound_sample", "write_diagnostic_checkpoint", "write_smoke_checkpoint"]
  return {
    index: stage, role, stage, action: `ai_painter.stage4.run_formal_stage${stage}`, runId, previousRole,
    predecessor: { role: previousRole, requiredStatus: previousStatus }, runner: bind(projectFile(RUNNER)), outputNamespace,
    progressPath: `${outputNamespace}/training-output/progress.json`, preflightArgs: makeArgs(runId, stage, true), executeArgs: makeArgs(runId, stage, false),
    terminal: { path: `${outputNamespace}/finalization/phase-terminal.json`, requiredStatus: "semantic_mixture_stage4_formal_stage_completed_closed" },
    runtimeEvidenceTemplate: { schemaVersion: "ai-painter-stage4-continuation-runtime-evidence-template-v1", role, previousTerminal: { role: previousRole, path: "{{PREVIOUS_TERMINAL_PATH}}", sha256: "{{PREVIOUS_TERMINAL_SHA256}}", requiredStatus: previousStatus }, parentCheckpoint: stage === 0 ? null : { source: "previous_terminal.checkpoint", path: "{{PREVIOUS_CHECKPOINT_PATH}}", sha256: "{{PREVIOUS_CHECKPOINT_SHA256}}" } },
    runnerAuthorization: {
      schemaVersion: "ai-painter-stage4-formal-stage-execution-authorization-v1", requestId: `owner-authorized-stage4-capacity-${role}-${authorization.runId}`, commandRef: `owner-authorized-stage4-capacity-${role}-${authorization.runId}`,
      scope: `one_stage4_semantic_mixture_stage${stage}_full_training_only`, status: "resolved_owner_authorized_not_consumed", controlledStructureArm: CAPACITY_ARM, executionActions,
      bindings: { terminalQualification: qualificationBinding, sourceConfig: configBinding, implementationAuthorization, implementationConsumption, dataset, autoencoder, routeDecision: routeBinding, crossArmDecision: crossBinding, code },
      taskIdentity: { architecture: "stage4_fact_conditioned_semantic_mixture_decoder_v1", trainingObjective: "stage4_existing_formal_loss_set_unchanged", stage, resolution: RESOLUTIONS[stage], epochs: 40, previewEpochs: [1, 5, 10, 20, 30, 40], seed: 20263722, datasetCapacity: 64, splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 }, initialization: stage === 0 ? "project_random_fact_conditioned_semantic_mixture" : `current_run_stage_${stage - 1}_checkpoint_only`, parentDenoiserCheckpoint: stage === 0 ? null : { path: "{{PREVIOUS_CHECKPOINT_PATH}}", sha256: "{{PREVIOUS_CHECKPOINT_SHA256}}" }, outputNamespace },
      explicitlyDenied: denied, oneTimeConsumptionRequired: true,
    },
  }
})
const plan = {
  schemaVersion: "ai-painter-stage4-stage0-to-80-continuation-plan-v1", status: "ready_for_owner_signature", createdAtUtc: now,
  planCompilationRunId: authorization.runId, validityHours: 168,
  baselineProgress: { completedStages: 3, totalStages: 5, percent: 60 }, targetProgress: { completedStages: 4, totalStages: 5, percent: 80 },
  contract: bind(projectFile(CONTRACT)), candidateIdentity: { candidateId: CANDIDATE, status: "current_formal_candidate", controlledStructureArm: CAPACITY_ARM, config: configBinding, trainingObjectiveContractId: "existing_formal_loss_set_unchanged" },
  qualificationTerminal: qualificationBinding, routeDecision: routeBinding, crossArmDecision: crossBinding, steps,
  executionBoundary: { ownerSignatureRequired: true, packageSigned: false, executionStarted: false, smokeRerunAuthorized: false, automaticRetry: false, stopAtFixedProgressPercent: 80, stage5Authorized: false, formalInferenceAuthorized: false, checkpointPromotionAuthorized: false, runtimeFrameAuthorized: false, worldEntryAuthorized: false },
}
fs.mkdirSync(planRoot, { recursive: true })
const planPath = path.join(planRoot, "execution-plan.json")
freshJson(planPath, plan)
const audit = auditStage4Stage0To80ContinuationPlan(plan, { root: ROOT, verifyFiles: true })
const planCheck = spawnSync(process.execPath, [programs.continuationAuditor, "--plan", rel(planPath)], { cwd: ROOT, encoding: "utf8" })
assert.equal(planCheck.status, 0, `continuation_plan_cpu_failed:${planCheck.stderr}`)
const planCpu = JSON.parse(planCheck.stdout)
assert.equal(planCpu.positivePassed, planCpu.positiveTotal)
assert.equal(planCpu.negativePassed, planCpu.negativeTotal)
writeJsonAtomic(path.join(planRoot, "cpu-report.json"), { ...planCpu, capacityRouteAudit: audit, capacityFormalStageCpu: { path: `${formalCpuRoot}/${formalCpuRunId}/cpu-report.json`, sha256: sha(projectFile(`${formalCpuRoot}/${formalCpuRunId}/cpu-report.json`)), positivePassed: capacityFormalCpu.positivePassed, positiveTotal: capacityFormalCpu.positiveTotal, negativePassed: capacityFormalCpu.negativePassed, negativeTotal: capacityFormalCpu.negativeTotal }, checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false })
const trustPath = projectFile("data/ai-painter/system-governance/project-owner-trust-registry-v1.json")
const signingCommand = `node scripts/owner-offline/sign-ai-painter-stage4-stage0-to-80-continuation-package.mjs --plan "${rel(planPath)}" --plan-sha256 "${sha(planPath)}" --trust-registry-sha256 "${sha(trustPath)}"`
writeJsonAtomic(path.join(planRoot, "owner-action-request.json"), { schemaVersion: "stage4-capacity-stage0-to-80-owner-action-request-v1", status: "ready_for_owner_offline_signature", candidateId: CANDIDATE, controlledStructureArm: CAPACITY_ARM, executionPlan: bind(planPath), signingCommand, signatureCountRequiredFromOwner: 1, executionStarted: false, recordedAtUtc: now })

const planPathMd = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const beforePlanHash = sha(planPathMd)
let planText = fs.readFileSync(planPathMd, "utf8")
planText = planText.replace(/^更新时间：.*$/mu, `更新时间：${formatShanghai(now).replace("T", " ")}`)
planText = planText.replace(/^状态：.*$/mu, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4条件融合结构Stage 0已真实视觉失败并正式退出，容量结构为唯一剩余路线；Stage 0→1→2连续计划待Owner一次离线签署")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(planText.includes(anchor), true, "unique_plan_anchor_missing")
const bullet = `- Stage4条件融合结构Stage 0因果裁决已收敛为C：结构已正确训练但多样本语义容量不足，条件融合路线退出且不得重跑；容量臂（基础宽度64→128）已有受控Smoke和后期稳定资格，成为唯一剩余结构路线。已编译一个只绑定容量臂、依次物化Stage 0/1/2父Checkpoint的待签署连续计划；历史十份连续或续执行包均保持failed_closed，不得复用。\n`
if (!planText.includes(bullet.trim())) planText = planText.replace(anchor, `${bullet}\n${anchor}`)
const tempPlan = `${planPathMd}.${process.pid}.${Date.now()}.tmp`
fs.writeFileSync(tempPlan, planText, "utf8"); fs.renameSync(tempPlan, planPathMd)
writeJsonAtomic(files.planSync, { schemaVersion: "stage4-condition-fusion-final-route-plan-sync-v1", status: "unique_plan_synchronized", planPath: rel(planPathMd), beforeSha256: beforePlanHash, afterSha256: sha(planPathMd), currentRoute: CAPACITY_ARM, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, executionPlan: bind(planPath), recordedAtUtc: now })
writeJsonAtomic(files.terminal, { schemaVersion: "stage4-condition-fusion-stage0-final-route-terminal-v1", status: "condition_fusion_multisample_semantic_capacity_insufficient_confirmed", selectedCause: "C", exitedArm: "condition_fusion_only_final_direct_residual_23_64_12", remainingUniqueArm: CAPACITY_ARM, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, adjudication: bind(files.decision), routeExit: bind(files.exit), cpuReport: bind(files.cpu), postmortem: bind(files.postmortem), executionPlan: bind(planPath), ownerActionRequest: bind(path.join(planRoot, "owner-action-request.json")), checkpointWeightsRead: false, ownerPrivateKeyRead: false, gpuStarted: false, trainingStarted: false, nextLegalAction: "owner_offline_sign_unique_capacity_stage0_to_stage2_continuation_package_once", recordedAtUtc: now })
writeJsonAtomic(files.capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, currentStage: "Stage4 capacity-only Stage 0 to Stage 2 continuation ready for one Owner offline signature", terminal: bind(files.terminal), uniqueRemainingRoute: CAPACITY_ARM, executionPlan: bind(planPath), nextLegalAction: "owner_offline_signature_then_local_continuous_executor", recordedAtUtc: now })
appendAiPainterProgramEvent({ id: `stage4-condition-fusion-final-route-${authorization.runId}`, timestamp: now, action: "stage4_condition_fusion_stage0_final_route_adjudication", runId: authorization.runId, kind: "cpu_readonly_final_route_and_plan_compilation", status: "success", title: "Condition fusion exited; capacity route ready", titleZh: "条件融合路线退出，容量路线连续包待一次签署", detailZh: "裁决C：条件融合已正确训练但多样本容量不足；容量臂为唯一路线，历史十包保持失败关闭，新Stage0→1→2计划未签署未执行。", evidencePath: rel(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: read(files.terminal).status, selectedCause: "C", remainingUniqueArm: CAPACITY_ARM, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, terminal: bind(files.terminal), executionPlan: bind(planPath), ownerActionRequest: bind(path.join(planRoot, "owner-action-request.json")), signingCommand, executionStarted: false, gpuStarted: false, trainingStarted: false }, null, 2))
